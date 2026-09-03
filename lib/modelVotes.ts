import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type ModelSurveyAnswers = Record<string, any>;

export interface ModelVoteRecord {
    voterHash: string;
    modelName: string;
    answers: ModelSurveyAnswers;
    updatedAt: string;
}

export interface PollOptionDef {
    key: string;
    label: string;
    votes: number; // Discourse baseline + local wiki votes
    percentage: number;
}

export interface PollQuestionDef {
    id: string; // Poll name (e.g. 'poll', 'overall', 'vs_default', 'lateral', etc.)
    title: string;
    type: 'single' | 'multi';
    maxChoices?: number;
    voters: number; // Total voters for this specific question
    options: PollOptionDef[];
}

export interface ModelLiveScoreData {
    communityScore: number;
    totalVotes: number;
    sentiment: {
        great: number;
        good: number;
        ok: number;
        bad: number;
    };
}

export interface ModelVoteSummary {
    modelName: string;
    totalVoters: number;
    questions: PollQuestionDef[];
    live: ModelLiveScoreData;
    userVote?: ModelSurveyAnswers;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const VOTES_FILE = path.join(DATA_DIR, 'model_votes.json');
const DISCOURSE_POLLS_FILE = path.join(DATA_DIR, 'discourse_polls.json');
const SALT = process.env.VOTE_SALT || 'sunnylink-wiki-voter-secret-salt-2026';

// In-memory rate limiting map: voterHash -> timestamps array
const rateLimitMap = new Map<string, number[]>();

export function generateVoterHash(ip: string, clientToken?: string): string {
    const raw = `${ip.trim()}_${clientToken || ''}_${SALT}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

export function checkRateLimit(voterHash: string, maxVotesPerMinute = 30): boolean {
    const now = Date.now();
    const timestamps = (rateLimitMap.get(voterHash) || []).filter(t => now - t < 60000);
    if (timestamps.length >= maxVotesPerMinute) {
        return false;
    }
    timestamps.push(now);
    rateLimitMap.set(voterHash, timestamps);
    return true;
}

// In-memory cache with file persistence
let cachedVotes: Record<string, ModelVoteRecord> | null = null;
let cachedDiscoursePolls: Record<string, any> | null = null;

function loadVotes(): Record<string, ModelVoteRecord> {
    if (cachedVotes !== null) {
        return cachedVotes;
    }

    try {
        if (fs.existsSync(VOTES_FILE)) {
            const content = fs.readFileSync(VOTES_FILE, 'utf-8');
            cachedVotes = JSON.parse(content);
            return cachedVotes || {};
        }
    } catch (err) {
        console.error('[modelVotes] Failed to read votes file:', err);
    }

    cachedVotes = {};
    return cachedVotes;
}

function saveVotes(votes: Record<string, ModelVoteRecord>) {
    cachedVotes = votes;
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const tempPath = `${VOTES_FILE}.tmp.${Date.now()}`;
        fs.writeFileSync(tempPath, JSON.stringify(votes, null, 2), 'utf-8');
        fs.renameSync(tempPath, VOTES_FILE);
    } catch (err) {
        console.error('[modelVotes] Failed to write votes file:', err);
    }
}

function loadDiscoursePolls(): Record<string, any> {
    if (cachedDiscoursePolls !== null) {
        return cachedDiscoursePolls;
    }
    try {
        if (fs.existsSync(DISCOURSE_POLLS_FILE)) {
            const content = fs.readFileSync(DISCOURSE_POLLS_FILE, 'utf-8');
            cachedDiscoursePolls = JSON.parse(content) || {};
            return cachedDiscoursePolls!;
        }
    } catch (err) {
        console.error('[modelVotes] Failed to read discourse polls file:', err);
    }
    cachedDiscoursePolls = {};
    return cachedDiscoursePolls;
}

function findDiscourseForModel(modelName: string): any | null {
    const discourseMap = loadDiscoursePolls();
    if (discourseMap[modelName]) {
        return discourseMap[modelName];
    }
    const target = modelName.toLowerCase();
    for (const [key, val] of Object.entries(discourseMap)) {
        if (key.toLowerCase() === target) {
            return val;
        }
    }
    return null;
}

function optionMatchesUserChoice(optKey: string, choiceVal: any): boolean {
    if (choiceVal === undefined || choiceVal === null) return false;
    const optLower = optKey.toLowerCase().trim();
    if (typeof choiceVal === 'string') {
        const choiceLower = choiceVal.toLowerCase().trim();
        if (optLower === choiceLower) return true;
        // Check numeric prefix e.g. "5 - Great" matches "5" or "Great"
        if (optLower.startsWith(`${choiceLower} -`) || optLower.endsWith(`- ${choiceLower}`)) return true;
        if (choiceLower.startsWith(`${optLower} -`) || choiceLower.endsWith(`- ${optLower}`)) return true;
    } else if (typeof choiceVal === 'number') {
        if (optLower.startsWith(`${choiceVal} -`)) return true;
        if (choiceVal === 5 && optLower.includes('great')) return true;
        if (choiceVal === 4 && optLower.includes('good')) return true;
        if (choiceVal === 3 && optLower.includes('ok')) return true;
        if (choiceVal === 2 && optLower.includes('bad')) return true;
        if (choiceVal === 1 && (optLower.includes('poor') || optLower.includes('horrible'))) return true;
    } else if (typeof choiceVal === 'boolean') {
        if (choiceVal && (optLower.startsWith('yes') || optLower.includes('driven'))) return true;
        if (!choiceVal && (optLower.startsWith('no') || optLower.startsWith('not yet'))) return true;
    }
    return false;
}

export function calculateBlendedModelStats(
    modelName: string,
    baseCommunityScore?: number,
    baseTotalVotes?: number,
    baseSentiment?: { great: number; good: number; ok: number; bad: number },
    currentVoterHash?: string
): ModelVoteSummary {
    const allVotes = loadVotes();
    const targetName = modelName.toLowerCase();
    const modelVotes = Object.values(allVotes).filter(v => v.modelName.toLowerCase() === targetName);

    let userVote: ModelSurveyAnswers | undefined;
    if (currentVoterHash) {
        const userRec = modelVotes.find(v => v.voterHash === currentVoterHash);
        if (userRec) {
            userVote = userRec.answers;
        }
    }

    const discourseData = findDiscourseForModel(modelName);
    const questions: PollQuestionDef[] = [];

    if (discourseData?.polls && Array.isArray(discourseData.polls) && discourseData.polls.length > 0) {
        // Build questions based on Discourse polls
        for (const p of discourseData.polls) {
            const qId = p.name || 'poll';
            const isMulti = p.type === 'multiple';
            const baseVoters = typeof p.voters === 'number' ? p.voters : 0;
            const optionsList: { key: string; label: string; baseVotes: number }[] = (p.options || []).map((o: any) => ({
                key: o.html || '',
                label: o.html || '',
                baseVotes: typeof o.votes === 'number' ? o.votes : 0,
            }));

            // Track local wiki votes for this question
            const localOptionCounts: Record<string, number> = {};
            const localVoterHashes = new Set<string>();

            for (const v of modelVotes) {
                // Check both direct qId answer and legacy rating/etc answer
                let choice = v.answers?.[qId];
                if (choice === undefined) {
                    if ((qId === 'overall' || qId === 'poll') && v.answers?.rating !== undefined) {
                        choice = v.answers.rating;
                    } else if ((qId === 'lateral' || qId === 'poll3') && v.answers?.lateral !== undefined) {
                        choice = v.answers.lateral;
                    } else if ((qId === 'long_mode' || qId === 'poll4') && v.answers?.longitudinalMode !== undefined) {
                        choice = v.answers.longitudinalMode;
                    } else if ((qId === 'longitudinal' || qId === 'poll5') && v.answers?.longitudinalBehaviors !== undefined) {
                        choice = v.answers.longitudinalBehaviors;
                    } else if (qId === 'steering' && v.answers?.steeringControl !== undefined) {
                        choice = v.answers.steeringControl;
                    }
                }

                if (choice !== undefined && choice !== null) {
                    let hasChosen = false;
                    if (Array.isArray(choice)) {
                        for (const item of choice) {
                            const matchedOpt = optionsList.find(o => optionMatchesUserChoice(o.key, item));
                            if (matchedOpt) {
                                localOptionCounts[matchedOpt.key] = (localOptionCounts[matchedOpt.key] || 0) + 1;
                                hasChosen = true;
                            }
                        }
                    } else {
                        const matchedOpt = optionsList.find(o => optionMatchesUserChoice(o.key, choice));
                        if (matchedOpt) {
                            localOptionCounts[matchedOpt.key] = (localOptionCounts[matchedOpt.key] || 0) + 1;
                            hasChosen = true;
                        }
                    }
                    if (hasChosen) {
                        localVoterHashes.add(v.voterHash);
                    }
                }
            }

            const totalQustionVoters = baseVoters + localVoterHashes.size;

            let totalVoteEntries = 0;
            for (const opt of optionsList) {
                totalVoteEntries += opt.baseVotes + (localOptionCounts[opt.key] || 0);
            }

            const finalOptions: PollOptionDef[] = optionsList.map(opt => {
                const totalOptVotes = opt.baseVotes + (localOptionCounts[opt.key] || 0);
                const denom = isMulti ? Math.max(1, totalVoteEntries || totalQustionVoters) : Math.max(1, totalQustionVoters);
                const percentage = denom > 0 ? Math.round((totalOptVotes / denom) * 100) : 0;
                return {
                    key: opt.key,
                    label: opt.label,
                    votes: totalOptVotes,
                    percentage,
                };
            });

            questions.push({
                id: qId,
                title: p.title || 'How is this model?',
                type: isMulti ? 'multi' : 'single',
                maxChoices: p.max || 5,
                voters: totalQustionVoters,
                options: finalOptions,
            });
        }
    } else {
        // Fallback for models without Discourse polls: Single rating question
        const qId = 'overall';
        const defaultOptions = [
            '5 - Great',
            '4 - Good',
            '3 - Ok',
            '2 - Bad',
            '1 - Poor'
        ];

        const baseVotes = baseTotalVotes ?? 10;
        const baseS = baseSentiment ?? { great: 45, good: 35, ok: 15, bad: 5 };

        const baseGreat = Math.round(baseVotes * (baseS.great / 100));
        const baseGood = Math.round(baseVotes * (baseS.good / 100));
        const baseOk = Math.round(baseVotes * (baseS.ok / 100));
        const baseBad = Math.max(0, baseVotes - (baseGreat + baseGood + baseOk));

        const baseCounts: Record<string, number> = {
            '5 - Great': baseGreat,
            '4 - Good': baseGood,
            '3 - Ok': baseOk,
            '2 - Bad': baseBad,
            '1 - Poor': 0,
        };

        const localOptionCounts: Record<string, number> = {};
        const localVoterHashes = new Set<string>();

        for (const v of modelVotes) {
            const choice = v.answers?.overall ?? v.answers?.poll ?? v.answers?.rating;
            if (choice !== undefined && choice !== null) {
                const matchedOpt = defaultOptions.find(o => optionMatchesUserChoice(o, choice));
                if (matchedOpt) {
                    localOptionCounts[matchedOpt] = (localOptionCounts[matchedOpt] || 0) + 1;
                    localVoterHashes.add(v.voterHash);
                }
            }
        }

        const totalQustionVoters = baseVotes + localVoterHashes.size;

        const finalOptions: PollOptionDef[] = defaultOptions.map(opt => {
            const totalOptVotes = (baseCounts[opt] || 0) + (localOptionCounts[opt] || 0);
            const percentage = totalQustionVoters > 0 ? Math.round((totalOptVotes / totalQustionVoters) * 100) : 0;
            return {
                key: opt,
                label: opt,
                votes: totalOptVotes,
                percentage,
            };
        });

        questions.push({
            id: qId,
            title: 'How is this model?',
            type: 'single',
            voters: totalQustionVoters,
            options: finalOptions,
        });
    }

    // Compute live blended overall community score and sentiment breakdown
    // Identify rating poll: first poll named 'overall' or 'poll', or questions[0]
    const ratingQ = questions.find(q => q.id === 'overall' || q.id === 'poll') || questions[0];

    let liveScore = baseCommunityScore ?? 75;
    let liveSentiment = baseSentiment ?? { great: 40, good: 35, ok: 20, bad: 5 };
    let liveTotalVotes = baseTotalVotes ?? questions[0]?.voters ?? 0;

    if (ratingQ && ratingQ.options.length > 0) {
        let greatVotes = 0;
        let goodVotes = 0;
        let okVotes = 0;
        let badVotes = 0;

        for (const opt of ratingQ.options) {
            const text = opt.key.toLowerCase();
            if (text.includes('great') || text.startsWith('5')) {
                greatVotes += opt.votes;
            } else if (text.includes('good') || text.startsWith('4')) {
                goodVotes += opt.votes;
            } else if (text.includes('ok') || text.startsWith('3')) {
                okVotes += opt.votes;
            } else if (text.includes('bad') || text.includes('horrible') || text.includes('poor') || text.startsWith('2') || text.startsWith('1')) {
                badVotes += opt.votes;
            }
        }

        const totalSentimentCount = greatVotes + goodVotes + okVotes + badVotes;
        if (totalSentimentCount > 0) {
            const greatPct = Math.round((greatVotes / totalSentimentCount) * 100);
            const goodPct = Math.round((goodVotes / totalSentimentCount) * 100);
            const okPct = Math.round((okVotes / totalSentimentCount) * 100);
            const badPct = Math.max(0, 100 - (greatPct + goodPct + okPct));

            liveScore = Math.min(100, Math.max(0, Math.round(
                greatPct * 1.0 + goodPct * 0.75 + okPct * 0.50 + badPct * 0.0
            )));
            liveSentiment = {
                great: greatPct,
                good: goodPct,
                ok: okPct,
                bad: badPct,
            };
            liveTotalVotes = totalSentimentCount;
        }
    }

    const maxVotersAcrossQuestions = Math.max(...questions.map(q => q.voters), liveTotalVotes, 0);

    return {
        modelName,
        totalVoters: maxVotersAcrossQuestions,
        questions,
        live: {
            communityScore: liveScore,
            totalVotes: liveTotalVotes,
            sentiment: liveSentiment,
        },
        userVote,
    };
}

export function recordVote(
    modelName: string,
    voterHash: string,
    partialAnswers: Partial<ModelSurveyAnswers>,
    baseCommunityScore?: number,
    baseTotalVotes?: number,
    baseSentiment?: { great: number; good: number; ok: number; bad: number }
): { stats: ModelVoteSummary; userVote: ModelSurveyAnswers } {
    const allVotes = loadVotes();
    const key = `${voterHash}:::${modelName.toLowerCase()}`;
    const existing = allVotes[key];

    const updatedAnswers: ModelSurveyAnswers = {
        ...(existing ? existing.answers : {}),
        ...partialAnswers,
    };

    allVotes[key] = {
        voterHash,
        modelName,
        answers: updatedAnswers,
        updatedAt: new Date().toISOString(),
    };

    saveVotes(allVotes);

    const stats = calculateBlendedModelStats(
        modelName,
        baseCommunityScore,
        baseTotalVotes,
        baseSentiment,
        voterHash
    );

    return { stats, userVote: updatedAnswers };
}

export function getAllModelVoteSummaries(
    currentVoterHash?: string,
    modelsList?: Array<{ name: string; communityScore?: number; totalVotes?: number; sentiment?: { great: number; good: number; ok: number; bad: number } }>
): Record<string, ModelVoteSummary> {
    const result: Record<string, ModelVoteSummary> = {};
    if (modelsList) {
        for (const m of modelsList) {
            result[m.name.toLowerCase()] = calculateBlendedModelStats(
                m.name,
                m.communityScore,
                m.totalVotes,
                m.sentiment,
                currentVoterHash
            );
        }
    }
    return result;
}
