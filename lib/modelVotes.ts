import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ModelSurveyAnswers {
    hasDriven?: boolean;
    hardware?: string; // 'c3' | 'c3x' | 'c4' | 'other'
    rating?: number; // 1 (Poor), 2 (Bad), 3 (Ok), 4 (Good), 5 (Great)
    lateral?: string[];
    longitudinalMode?: string;
    longitudinalBehaviors?: string[];
    steeringControl?: string;
}

export interface ModelVoteRecord {
    voterHash: string;
    modelName: string;
    answers: ModelSurveyAnswers;
    updatedAt: string;
}

export interface ModelOptionStat {
    label: string;
    count: number;
    percentage: number;
}

export interface QuestionSummary {
    voters: number;
    options: Record<string, ModelOptionStat>;
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
    hasDrivenCount: number;
    questions: {
        hasDriven: QuestionSummary;
        hardware: QuestionSummary;
        rating: QuestionSummary;
        lateral: QuestionSummary;
        longitudinalMode: QuestionSummary;
        longitudinalBehaviors: QuestionSummary;
        steeringControl: QuestionSummary;
    };
    live: ModelLiveScoreData;
    userVote?: ModelSurveyAnswers;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const VOTES_FILE = path.join(DATA_DIR, 'model_votes.json');
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

function computeQuestionStats(
    voterCount: number,
    counts: Record<string, number>,
    totalEntries: number
): QuestionSummary {
    const options: Record<string, ModelOptionStat> = {};
    for (const [key, count] of Object.entries(counts)) {
        const percentage = totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0;
        options[key] = { label: key, count, percentage };
    }
    return {
        voters: voterCount,
        options,
    };
}

export function calculateBlendedModelStats(
    modelName: string,
    baseCommunityScore?: number,
    baseTotalVotes?: number,
    baseSentiment?: { great: number; good: number; ok: number; bad: number },
    currentVoterHash?: string
): ModelVoteSummary {
    const allVotes = loadVotes();
    const modelVotes = Object.values(allVotes).filter(v => v.modelName.toLowerCase() === modelName.toLowerCase());

    const hardwareCounts: Record<string, number> = {};
    const ratingCounts: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    const lateralCounts: Record<string, number> = {};
    const longModeCounts: Record<string, number> = {};
    const longBehaviorCounts: Record<string, number> = {};
    const steeringCounts: Record<string, number> = {};
    const hasDrivenCounts: Record<string, number> = { yes: 0, no: 0 };

    let hasDrivenVoters = 0;
    let hardwareVoters = 0;
    let ratingVoters = 0;
    let lateralVoters = 0;
    let lateralTotalEntries = 0;
    let longModeVoters = 0;
    let longBehaviorVoters = 0;
    let longBehaviorTotalEntries = 0;
    let steeringVoters = 0;

    let userVote: ModelSurveyAnswers | undefined;

    for (const vote of modelVotes) {
        if (currentVoterHash && vote.voterHash === currentVoterHash) {
            userVote = vote.answers;
        }

        const a = vote.answers;

        if (a.hasDriven !== undefined) {
            hasDrivenVoters++;
            const k = a.hasDriven ? 'yes' : 'no';
            hasDrivenCounts[k] = (hasDrivenCounts[k] || 0) + 1;
        }

        if (a.hardware) {
            hardwareVoters++;
            hardwareCounts[a.hardware] = (hardwareCounts[a.hardware] || 0) + 1;
        }

        if (a.rating && a.rating >= 1 && a.rating <= 5) {
            ratingVoters++;
            const rStr = String(a.rating);
            ratingCounts[rStr] = (ratingCounts[rStr] || 0) + 1;
        }

        if (Array.isArray(a.lateral) && a.lateral.length > 0) {
            lateralVoters++;
            for (const item of a.lateral) {
                lateralCounts[item] = (lateralCounts[item] || 0) + 1;
                lateralTotalEntries++;
            }
        }

        if (a.longitudinalMode) {
            longModeVoters++;
            longModeCounts[a.longitudinalMode] = (longModeCounts[a.longitudinalMode] || 0) + 1;
        }

        if (Array.isArray(a.longitudinalBehaviors) && a.longitudinalBehaviors.length > 0) {
            longBehaviorVoters++;
            for (const item of a.longitudinalBehaviors) {
                longBehaviorCounts[item] = (longBehaviorCounts[item] || 0) + 1;
                longBehaviorTotalEntries++;
            }
        }

        if (a.steeringControl) {
            steeringVoters++;
            steeringCounts[a.steeringControl] = (steeringCounts[a.steeringControl] || 0) + 1;
        }
    }

    // Blend live community ratings with baseline
    const baseVotes = baseTotalVotes ?? 15;
    const baseS = baseSentiment ?? { great: 40, good: 35, ok: 20, bad: 5 };

    const baseGreat = Math.round(baseVotes * (baseS.great / 100));
    const baseGood = Math.round(baseVotes * (baseS.good / 100));
    const baseOk = Math.round(baseVotes * (baseS.ok / 100));
    const baseBad = Math.max(0, baseVotes - (baseGreat + baseGood + baseOk));

    // Live ratings mapping:
    // 5 -> great
    // 4 -> good
    // 3 -> ok
    // 2 & 1 -> bad
    const liveGreat = ratingCounts['5'] || 0;
    const liveGood = ratingCounts['4'] || 0;
    const liveOk = ratingCounts['3'] || 0;
    const liveBad = (ratingCounts['2'] || 0) + (ratingCounts['1'] || 0);

    const totalGreat = baseGreat + liveGreat;
    const totalGood = baseGood + liveGood;
    const totalOk = baseOk + liveOk;
    const totalBad = baseBad + liveBad;
    const totalSentimentCount = Math.max(1, totalGreat + totalGood + totalOk + totalBad);

    const greatPct = Math.round((totalGreat / totalSentimentCount) * 100);
    const goodPct = Math.round((totalGood / totalSentimentCount) * 100);
    const okPct = Math.round((totalOk / totalSentimentCount) * 100);
    const badPct = Math.max(0, 100 - (greatPct + goodPct + okPct));

    const liveScore = Math.min(100, Math.max(0, Math.round(
        greatPct * 1.0 + goodPct * 0.75 + okPct * 0.50 + badPct * 0.0
    )));

    const liveTotalVotes = baseVotes + modelVotes.length;

    return {
        modelName,
        totalVoters: modelVotes.length,
        hasDrivenCount: hasDrivenCounts.yes || 0,
        questions: {
            hasDriven: computeQuestionStats(hasDrivenVoters, hasDrivenCounts, hasDrivenVoters),
            hardware: computeQuestionStats(hardwareVoters, hardwareCounts, hardwareVoters),
            rating: computeQuestionStats(ratingVoters, ratingCounts, ratingVoters),
            lateral: computeQuestionStats(lateralVoters, lateralCounts, lateralTotalEntries || lateralVoters),
            longitudinalMode: computeQuestionStats(longModeVoters, longModeCounts, longModeVoters),
            longitudinalBehaviors: computeQuestionStats(longBehaviorVoters, longBehaviorCounts, longBehaviorTotalEntries || longBehaviorVoters),
            steeringControl: computeQuestionStats(steeringVoters, steeringCounts, steeringVoters),
        },
        live: {
            communityScore: liveScore,
            totalVotes: liveTotalVotes,
            sentiment: {
                great: greatPct,
                good: goodPct,
                ok: okPct,
                bad: badPct,
            },
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
