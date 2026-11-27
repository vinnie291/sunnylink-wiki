import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
    sanitizeStackAnswers,
    tallyControlStack,
    tallyDomainRatings,
    type ControlStackTally,
    type DomainRatingTally,
} from './controlStack';

export type ModelSurveyAnswers = Record<string, unknown>;

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
    id: string; // Poll name (e.g. 'overall', 'poll', 'vs_default', 'lateral', etc.)
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
    /** Per-domain (lateral / chill long / E2E long) reviewer ratings, 1-5. */
    domains?: DomainRatingTally;
    /** Lateral controller / longitudinal mode / hardware tags reported by voters. */
    stacks?: ControlStackTally;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const REPO_VOTES_FILE = path.join(DATA_DIR, 'model_votes.json');
const FALLBACK_VOTES_FILE = path.join(os.tmpdir(), 'sunnylink-model-votes.json');
const DISCOURSE_POLLS_FILE = path.join(DATA_DIR, 'discourse_polls.json');
const SALT = process.env.VOTE_SALT || 'sunnylink-wiki-voter-secret-salt-2026';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_RATE_LIMIT_KEYS = 5_000;

const VOTER_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VOTER_SIG_REGEX = /^[0-9a-f]{24}$/;

// Bounded in-memory rate limiting map: voterHash -> timestamps array
const rateLimitMap = new Map<string, number[]>();

export function getRateLimitMapSize(): number {
    return rateLimitMap.size;
}

function signVoterUuid(uuid: string): string {
    return crypto.createHmac('sha256', SALT).update(uuid).digest('hex').slice(0, 24);
}

export function createSignedVoterToken(): string {
    const uuid = crypto.randomUUID().toLowerCase();
    return `${uuid}.${signVoterUuid(uuid)}`;
}

export function verifySignedVoterToken(raw?: string | null): boolean {
    if (typeof raw !== 'string' || raw.length !== 61) {
        return false;
    }
    const dotIndex = raw.indexOf('.');
    if (dotIndex !== 36 || raw.indexOf('.', dotIndex + 1) !== -1) {
        return false;
    }
    const uuid = raw.slice(0, 36);
    const sig = raw.slice(37);
    if (!VOTER_UUID_REGEX.test(uuid) || !VOTER_SIG_REGEX.test(sig)) {
        return false;
    }
    const expected = signVoterUuid(uuid);
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
}

export function generateVoterHash(ip: string, clientToken?: string): string {
    const raw = `${ip.trim()}_${clientToken || ''}_${SALT}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

function evictStaleAndCapRateLimitMap(now: number): void {
    for (const [key, ts] of rateLimitMap.entries()) {
        const fresh = ts.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (fresh.length === 0) {
            rateLimitMap.delete(key);
        } else if (fresh.length !== ts.length) {
            rateLimitMap.set(key, fresh);
        }
    }
    while (rateLimitMap.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = rateLimitMap.keys().next().value;
        if (oldestKey === undefined) break;
        rateLimitMap.delete(oldestKey);
    }
}

export function checkRateLimit(voterHash: string, maxVotesPerMinute = 30): boolean {
    const now = Date.now();
    const existing = rateLimitMap.get(voterHash);
    const timestamps = existing ? existing.filter(t => now - t < RATE_LIMIT_WINDOW_MS) : [];

    if (timestamps.length >= maxVotesPerMinute) {
        if (existing) {
            rateLimitMap.set(voterHash, timestamps);
        }
        return false;
    }

    if (!rateLimitMap.has(voterHash) && rateLimitMap.size >= MAX_RATE_LIMIT_KEYS) {
        evictStaleAndCapRateLimitMap(now);
    }

    timestamps.push(now);
    // Re-insert so active keys stay freshest in Map iteration order
    rateLimitMap.delete(voterHash);
    rateLimitMap.set(voterHash, timestamps);
    return true;
}

interface DiscoursePollOption {
    id?: string;
    html?: string;
    votes?: number;
}

interface DiscoursePoll {
    name?: string;
    type?: string;
    min?: number | null;
    max?: number | null;
    voters?: number;
    title?: string;
    options?: DiscoursePollOption[];
}

interface DiscourseModelData {
    topicId?: string;
    title?: string;
    polls?: DiscoursePoll[];
}

// In-memory cache with two-tier persistence (atomic local + optional Cloud Run GCS sync)
let cachedVotes: Record<string, ModelVoteRecord> | null = null;
let cachedVotesSourcePath: string | null = null;
let forceTmpFallback = false;
let cachedDiscoursePolls: Record<string, DiscourseModelData> | null = null;

let gcsHydrated = false;
let gcsLastAttemptAt = 0;
let gcsHydrationPromise: Promise<void> | null = null;
let gcsUploadTimer: ReturnType<typeof setTimeout> | null = null;
let cachedMetadataToken: { token: string; expiresAt: number } | null = null;

function isWritableTarget(dirPath: string, filePath: string): boolean {
    try {
        if (fs.existsSync(dirPath)) {
            fs.accessSync(dirPath, fs.constants.W_OK);
            if (fs.existsSync(filePath)) {
                fs.accessSync(filePath, fs.constants.W_OK);
            }
            return true;
        }
        fs.accessSync(process.cwd(), fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

function resolveVotesFilePath(): { path: string; isFallback: boolean } {
    const envPath = process.env.VOTES_FILE_PATH?.trim();
    if (envPath) {
        return { path: path.resolve(envPath), isFallback: false };
    }
    if (!forceTmpFallback && isWritableTarget(DATA_DIR, REPO_VOTES_FILE)) {
        return { path: REPO_VOTES_FILE, isFallback: false };
    }
    return { path: FALLBACK_VOTES_FILE, isFallback: true };
}

function sanitizeVoteMap(raw: unknown): Record<string, ModelVoteRecord> {
    const clean: Record<string, ModelVoteRecord> = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return clean;
    }
    for (const key of Object.getOwnPropertyNames(raw)) {
        if (FORBIDDEN_KEYS.has(key)) continue;
        const rec = (raw as Record<string, unknown>)[key];
        if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
        const { voterHash, modelName, answers, updatedAt } = rec as Partial<ModelVoteRecord>;
        if (typeof voterHash !== 'string' || typeof modelName !== 'string') continue;
        if (!answers || typeof answers !== 'object' || Array.isArray(answers)) continue;
        const safeAnswers: ModelSurveyAnswers = {};
        for (const aKey of Object.getOwnPropertyNames(answers)) {
            if (!FORBIDDEN_KEYS.has(aKey)) {
                safeAnswers[aKey] = (answers as Record<string, unknown>)[aKey];
            }
        }
        clean[key] = {
            voterHash,
            modelName,
            answers: safeAnswers,
            updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
        };
    }
    return clean;
}

function readVotesFileSafe(filePath: string): Record<string, ModelVoteRecord> | null {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return sanitizeVoteMap(JSON.parse(content));
        }
    } catch (err) {
        console.error('[modelVotes] Failed to read votes file:', err);
    }
    return null;
}

function writeVotesAtomically(targetPath: string, serialized: string): void {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${targetPath}.tmp.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    try {
        fs.writeFileSync(tempPath, serialized, 'utf-8');
        try {
            fs.renameSync(tempPath, targetPath);
        } catch {
            // Safe fallback if rename across special mounts fails
            fs.copyFileSync(tempPath, targetPath);
        }
    } finally {
        try {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        } catch {
            // Ignore temp cleanup errors
        }
    }
}

function persistLocalVotes(votes: Record<string, ModelVoteRecord>): void {
    const serialized = JSON.stringify(votes, null, 2);
    const resolved = resolveVotesFilePath();
    try {
        writeVotesAtomically(resolved.path, serialized);
        cachedVotesSourcePath = resolved.path;
    } catch (err) {
        if (!process.env.VOTES_FILE_PATH?.trim() && resolved.path !== FALLBACK_VOTES_FILE) {
            forceTmpFallback = true;
            try {
                writeVotesAtomically(FALLBACK_VOTES_FILE, serialized);
                cachedVotesSourcePath = FALLBACK_VOTES_FILE;
                return;
            } catch (fallbackErr) {
                console.error('[modelVotes] Failed to write fallback votes file:', fallbackErr);
                return;
            }
        }
        console.error('[modelVotes] Failed to write votes file:', err);
    }
}

function loadVotes(): Record<string, ModelVoteRecord> {
    const { path: activePath, isFallback } = resolveVotesFilePath();
    if (cachedVotes !== null && cachedVotesSourcePath === activePath) {
        return cachedVotes;
    }

    const loaded = readVotesFileSafe(activePath);
    if (loaded !== null) {
        cachedVotes = loaded;
        cachedVotesSourcePath = activePath;
        return cachedVotes;
    }

    // Seed tmpdir fallback from repo baseline data/model_votes.json when available
    if (isFallback) {
        const seeded = readVotesFileSafe(REPO_VOTES_FILE);
        if (seeded !== null) {
            cachedVotes = seeded;
            persistLocalVotes(seeded);
            cachedVotesSourcePath = activePath;
            return cachedVotes;
        }
    }

    cachedVotes = {};
    cachedVotesSourcePath = activePath;
    return cachedVotes;
}

function getGcsConfig(): { bucket: string; object: string } | null {
    if (process.env.VOTES_GCS_DISABLED === '1') {
        return null;
    }
    const explicitBucket = process.env.VOTES_GCS_BUCKET?.trim();
    const bucket = explicitBucket || (process.env.K_SERVICE ? 'sunnylink-wiki_cloudbuild' : '');
    if (!bucket) {
        return null;
    }
    const object = process.env.VOTES_GCS_OBJECT?.trim() || 'state/model_votes.json';
    return { bucket, object };
}

async function fetchMetadataAccessToken(): Promise<string | null> {
    const now = Date.now();
    if (cachedMetadataToken && cachedMetadataToken.expiresAt - now > 60_000) {
        return cachedMetadataToken.token;
    }
    const metadataUrl =
        process.env.VOTES_GCS_METADATA_URL?.trim() ||
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
    try {
        const res = await fetch(metadataUrl, {
            headers: { 'Metadata-Flavor': 'Google' },
            signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
        if (typeof json.access_token !== 'string' || !json.access_token) {
            return null;
        }
        const ttlSec = typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 300;
        cachedMetadataToken = {
            token: json.access_token,
            expiresAt: now + ttlSec * 1000,
        };
        return cachedMetadataToken.token;
    } catch {
        return null;
    }
}

function parseTimestamp(iso?: string): number {
    if (!iso) return 0;
    const parsed = Date.parse(iso);
    return Number.isFinite(parsed) ? parsed : 0;
}

function mergeVoteRecords(
    localVotes: Record<string, ModelVoteRecord>,
    remoteVotes: Record<string, ModelVoteRecord>
): Record<string, ModelVoteRecord> {
    const merged: Record<string, ModelVoteRecord> = { ...remoteVotes };
    for (const [key, localRec] of Object.entries(localVotes)) {
        if (FORBIDDEN_KEYS.has(key)) continue;
        const remoteRec = merged[key];
        if (!remoteRec || parseTimestamp(localRec.updatedAt) >= parseTimestamp(remoteRec.updatedAt)) {
            merged[key] = localRec;
        }
    }
    return merged;
}

async function hydrateFromGcsInternal(): Promise<void> {
    const cfg = getGcsConfig();
    if (!cfg || gcsHydrated) return;

    const now = Date.now();
    if (gcsLastAttemptAt > 0 && now - gcsLastAttemptAt < 30_000) {
        return;
    }
    gcsLastAttemptAt = now;

    try {
        const token = await fetchMetadataAccessToken();
        if (!token) return;

        const apiBase = process.env.VOTES_GCS_API_BASE?.trim() || 'https://storage.googleapis.com';
        const url = `${apiBase}/storage/v1/b/${encodeURIComponent(cfg.bucket)}/o/${encodeURIComponent(cfg.object)}?alt=media`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(1500),
        });

        if (res.status === 404) {
            gcsHydrated = true;
            return;
        }
        if (!res.ok) {
            return;
        }

        const remoteRaw = await res.json();
        const remoteVotes = sanitizeVoteMap(remoteRaw);
        const currentLocal = loadVotes();
        const merged = mergeVoteRecords(currentLocal, remoteVotes);
        cachedVotes = merged;
        persistLocalVotes(merged);
        gcsHydrated = true;
    } catch {
        // Fail silently when metadata server or GCS is unreachable (local dev / CI / tests)
    }
}

export async function ensureCloudVotesHydrated(): Promise<void> {
    const cfg = getGcsConfig();
    if (!cfg || gcsHydrated) return;

    if (!gcsHydrationPromise) {
        gcsHydrationPromise = hydrateFromGcsInternal().finally(() => {
            gcsHydrationPromise = null;
        });
    }

    // Bound await time so API handlers stay responsive even on cold network hiccups
    await Promise.race([
        gcsHydrationPromise,
        new Promise<void>(resolve => {
            const t = setTimeout(resolve, 1600);
            t.unref();
        }),
    ]);
}

async function uploadVotesToGcs(): Promise<void> {
    const cfg = getGcsConfig();
    if (!cfg) return;

    try {
        if (!gcsHydrated) {
            await hydrateFromGcsInternal();
        }
        const token = await fetchMetadataAccessToken();
        if (!token) return;

        const votesSnapshot = loadVotes();
        const apiBase = process.env.VOTES_GCS_API_BASE?.trim() || 'https://storage.googleapis.com';
        const url = `${apiBase}/upload/storage/v1/b/${encodeURIComponent(cfg.bucket)}/o?uploadType=media&name=${encodeURIComponent(cfg.object)}`;
        await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(votesSnapshot, null, 2),
            signal: AbortSignal.timeout(2500),
        });
    } catch {
        // Fail silently so GCS hiccups never affect user voting
    }
}

function scheduleCloudVotesSync(): void {
    if (!getGcsConfig()) return;
    if (gcsUploadTimer) {
        clearTimeout(gcsUploadTimer);
    }
    gcsUploadTimer = setTimeout(() => {
        gcsUploadTimer = null;
        void uploadVotesToGcs();
    }, 250);
    gcsUploadTimer.unref();
}

function saveVotes(votes: Record<string, ModelVoteRecord>) {
    cachedVotes = votes;
    persistLocalVotes(votes);
    scheduleCloudVotesSync();
}

function loadDiscoursePolls(): Record<string, DiscourseModelData> {
    if (cachedDiscoursePolls !== null) {
        return cachedDiscoursePolls;
    }
    try {
        if (fs.existsSync(DISCOURSE_POLLS_FILE)) {
            const content = fs.readFileSync(DISCOURSE_POLLS_FILE, 'utf-8');
            cachedDiscoursePolls = (JSON.parse(content) as Record<string, DiscourseModelData>) || {};
            return cachedDiscoursePolls;
        }
    } catch (err) {
        console.error('[modelVotes] Failed to read discourse polls file:', err);
    }
    cachedDiscoursePolls = {};
    return cachedDiscoursePolls;
}

/** Discourse poll titles/options arrive as cooked HTML; reduce them to plain text. */
function stripDiscourseHtml(value?: string): string {
    if (!value) return '';
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .replace(/\s+([:?.,])/g, '$1')
        .trim();
}

function findDiscourseForModel(modelName: string): DiscourseModelData | null {
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

function optionMatchesUserChoice(optKey: string, choiceVal: unknown): boolean {
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
    const localVotersByQuestion = new Map<string, number>();
    let hasDiscoursePolls = false;
    let recordedBaseVotes = 0;

    if (discourseData?.polls && Array.isArray(discourseData.polls) && discourseData.polls.length > 0) {
        hasDiscoursePolls = true;
        // Put the primary rating poll ('overall' / 'poll') first so step 1 is consistent across all cards
        const orderedPolls = [...discourseData.polls].sort((a, b) => {
            const aIsRating = a.name === 'overall' || a.name === 'poll' ? 0 : 1;
            const bIsRating = b.name === 'overall' || b.name === 'poll' ? 0 : 1;
            return aIsRating - bIsRating;
        });

        // Build questions based on Discourse polls
        for (const p of orderedPolls) {
            const qId = p.name || 'poll';
            const isMulti = p.type === 'multiple';
            const baseVoters = typeof p.voters === 'number' ? p.voters : 0;
            const optionsList: { key: string; label: string; baseVotes: number }[] = (p.options || []).map((o: { html?: string; votes?: number }) => ({
                key: stripDiscourseHtml(o.html),
                label: stripDiscourseHtml(o.html),
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

            localVotersByQuestion.set(qId, localVoterHashes.size);
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
                title: stripDiscourseHtml(p.title) || 'How is this model?',
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

        const weights = baseSentiment
            ? [baseSentiment.great, baseSentiment.good, baseSentiment.ok, baseSentiment.bad]
            : [0, 0, 0, 0];
        const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
        const baseVotes = Number.isInteger(baseTotalVotes) && baseTotalVotes! > 0
            && weights.every(weight => Number.isFinite(weight) && weight >= 0) && weightTotal > 0
            ? baseTotalVotes! : 0;
        recordedBaseVotes = baseVotes;
        // Only use an explicitly recorded baseline. Allocate its rounded counts
        // together so option totals cannot exceed the recorded voter count.
        const exactCounts = weights.map(weight => baseVotes > 0 ? baseVotes * weight / weightTotal : 0);
        const counts = exactCounts.map(Math.floor);
        const remainderOrder = exactCounts.map((count, index) => ({ index, remainder: count - counts[index] }))
            .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
        const remaining = baseVotes - counts.reduce((sum, count) => sum + count, 0);
        for (let i = 0; i < remaining; i++) counts[remainderOrder[i].index]++;
        const [baseGreat, baseGood, baseOk, baseBad] = counts;

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

        localVotersByQuestion.set(qId, localVoterHashes.size);
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

    // Compute live blended overall community score and sentiment breakdown.
    // Only treat a question as a rating poll if it is explicitly 'overall'/'poll' or has rating options
    // (never vs_default or would_merge).
    const ratingQ = questions.find(q => q.id === 'overall' || q.id === 'poll')
        || questions.find(q => q.id !== 'vs_default' && q.id !== 'would_merge' && q.options.some(o => /\b(?:great|good|poor|horrible)\b/i.test(o.key)));

    let liveScore = 0;
    let liveSentiment = { great: 0, good: 0, ok: 0, bad: 0 };
    let liveTotalVotes = 0;

    const localRatingVoters = ratingQ ? (localVotersByQuestion.get(ratingQ.id) ?? 0) : 0;

    if (!hasDiscoursePolls && localRatingVoters === 0) {
        // Preserve exact recorded baseline when no Discourse poll or local wiki votes exist,
        // avoiding integer-rounding quantization drift and preserving curated scores.
        if (recordedBaseVotes > 0 && baseSentiment) {
            liveTotalVotes = recordedBaseVotes;
            liveSentiment = { ...baseSentiment };
            liveScore = baseCommunityScore !== undefined
                ? baseCommunityScore
                : Math.min(100, Math.max(0, Math.round(
                    baseSentiment.great * 1.0 + baseSentiment.good * 0.75 + baseSentiment.ok * 0.50
                )));
        }
    } else if (ratingQ && ratingQ.options.length > 0) {
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

    const localAnswers = modelVotes.map(v => v.answers as Record<string, unknown>);

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
        domains: tallyDomainRatings(localAnswers),
        stacks: tallyControlStack(questions, localAnswers),
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

    const filteredPartial: Record<string, unknown> = {};
    for (const pKey of Object.getOwnPropertyNames(partialAnswers)) {
        if (!FORBIDDEN_KEYS.has(pKey)) {
            filteredPartial[pKey] = (partialAnswers as Record<string, unknown>)[pKey];
        }
    }

    const updatedAnswers: ModelSurveyAnswers = {
        ...(existing ? existing.answers : {}),
        ...sanitizeStackAnswers(filteredPartial),
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
