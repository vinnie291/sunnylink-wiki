import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const DISCORD_DIR = path.join(DATA_DIR, 'discord_feedback');
const DISCOURSE_BASE = 'https://community.sunnypilot.ai';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sunnypilot/sunnypilot-models/refs/heads/gh-pages/docs';
const MANIFEST_INDEX = 'https://api.github.com/repos/sunnypilot/sunnypilot-models/contents/docs?ref=gh-pages';
const MANIFEST_FAMILIES = [
    { id: 'chestnut', name: 'Chestnut GPU (Big Models)', prefix: 'driving_models_chestnut_v', targetCategory: 'chestnut_gpu' },
    { id: 'qcom', name: 'Qualcomm Standard', prefix: 'driving_models_v', targetCategory: 'world_2026' },
    { id: 'usbgpu', name: 'USB GPU (Big Models)', prefix: 'driving_models_usbgpu_v', targetCategory: 'chestnut_gpu' }
];

interface ModelManifestBundle {
    index: number | string;
    short_name: string;
    display_name: string;
    ref?: string;
    minimum_selector_version?: number | string;
    generation?: number | string;
    environment?: string;
    is_20hz?: boolean;
    overrides?: {
        folder?: string;
        lat?: string;
        long?: string;
    };
    models?: Array<{
        type?: string;
        artifact?: {
            fileName?: string;
            downloadUri?: { uri?: string };
        };
    }>;
}

interface LocalModel {
    name: string;
    date?: string;
    badge?: string;
    tags?: string[];
    communityScore?: number;
    totalVotes?: number;
    sentiment?: {
        great: number;
        good: number;
        ok: number;
        bad: number;
    };
    consensus?: string;
    note?: string;
    bestFor?: string;
    steeringFeel?: string;
    positives?: string[];
    negatives?: string[];
    testedOn?: string[];
    forumUrl?: string;
    manifestUrl?: string;
    modelRef?: string;
    shortName?: string;
    minimumSelectorVersion?: number;
    [key: string]: unknown;
}

interface LocalCategory {
    id: string;
    name: string;
    description?: string;
    models: LocalModel[];
    [key: string]: unknown;
}

interface LocalModelsData {
    appName: string;
    version: string;
    totalModels: number;
    lastUpdated: string;
    categories: LocalCategory[];
    [key: string]: unknown;
}

interface ScannedModel {
    sourceId: string;
    sourceName: string;
    manifestFile: string;
    targetCategory: string;
    rawDisplayName: string;
    cleanName: string;
    extractedDate?: string;
    shortName: string;
    modelRef?: string;
    minimumSelectorVersion?: number;
    folder?: string;
    index: number | string;
    generation?: number | string;
    isNew: boolean;
    localCategory?: string;
    matchedLocalModel?: LocalModel;
}

interface DiscoursePollOption {
    html: string;
    votes: number;
}

interface DiscoursePoll {
    name: string;
    title?: string;
    voters: number;
    options: DiscoursePollOption[];
}

interface DiscoursePost {
    id: number;
    post_number: number;
    username: string;
    name?: string | null;
    created_at: string;
    cooked: string;
    score?: number;
    actions_summary?: Array<{ id: number; count?: number }>;
    polls?: DiscoursePoll[];
}

interface DiscourseResearchResult {
    topicId: number;
    title: string;
    forumUrl: string;
    createdAt: string;
    author: string;
    opSnippet: string;
    pollScore?: number;
    pollVoters?: number;
    sentiment?: {
        great: number;
        good: number;
        ok: number;
        bad: number;
    };
    extractedPositives: string[];
    extractedNegatives: string[];
    extractedSteering?: string;
    comments: Array<{
        username: string;
        text: string;
        likes: number;
    }>;
}

interface DiscordResearchResult {
    matchedFiles: string[];
    messagesAnalyzed: number;
    sentiment: {
        great: number;
        good: number;
        ok: number;
        bad: number;
    };
    communityScore: number;
    sampleQuotes: string[];
}

const MODEL_METADATA_FILE = path.join(DATA_DIR, 'model_metadata.json');

const KNOWN_ALIASES: Record<string, string> = {
    'lav2': 'losangelesv2la2',
    'popmodelv2': 'popv2',
    'gwmv9': 'gwmv9gwm9',
    'teetime': 'teetimemodel',
    'teetimemodel': 'teetimemodel',
    'tcpmv3': 'tcpmv3thecoolpeoplesmodel',
    'dtr6': 'downtoridev6',
    'downtoride6': 'downtoridev6',
    'downtoriderevision6': 'downtoridev6',
    'popmodel': 'popmodel',
};

function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function loadCuratedAliases(): Record<string, string> {
    const aliases: Record<string, string> = { ...KNOWN_ALIASES };
    try {
        if (fs.existsSync(MODEL_METADATA_FILE)) {
            const raw = JSON.parse(fs.readFileSync(MODEL_METADATA_FILE, 'utf-8')) as Record<string, { aliasOf?: string }>;
            for (const [slug, entry] of Object.entries(raw)) {
                if (slug.startsWith('$') || !entry || typeof entry !== 'object' || !entry.aliasOf) continue;
                aliases[normalize(slug)] = normalize(entry.aliasOf);
            }
        }
    } catch {
        // Ignore metadata read errors and fall back to built-in aliases
    }
    return aliases;
}

const CURATED_ALIASES = loadCuratedAliases();

/**
 * Extracts a normalized version signature from a model name so distinct versions
 * (e.g., "Cinque Terre Model V2" vs "Cinque Terre Model", "BMRLNAP Model v3" vs "BMRLNAP Model",
 * "Light Speed Model v1.1" vs "Light Speed 2") never collide during fuzzy matching.
 */
function extractVersionSignature(name: string): string {
    const cleaned = name
        .toLowerCase()
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const tokens: string[] = [];
    const regex = /(?:^|\b|[a-z])(?:v|rev[- ]?)(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?)\b/g;
    for (const match of cleaned.matchAll(regex)) {
        const ver = match[1] ?? match[2];
        if (ver && !/^20\d{2}$/.test(ver)) {
            tokens.push(ver);
        }
    }
    return tokens.join('.');
}

function matchesLocalModel(
    remoteCleanName: string,
    localName: string,
    remoteRef?: string,
    localRef?: string,
    remoteShort?: string,
    localShort?: string
): boolean {
    if (remoteRef && localRef) {
        return remoteRef === localRef;
    }

    const normRemote = normalize(remoteCleanName);
    const normLocal = normalize(localName);

    if (normRemote === normLocal) return true;

    // Check curated & known aliases (both directions)
    if (
        (CURATED_ALIASES[normRemote] && CURATED_ALIASES[normRemote] === normLocal) ||
        (CURATED_ALIASES[normLocal] && CURATED_ALIASES[normLocal] === normRemote)
    ) {
        return true;
    }

    // Enforce version-number parity before any fuzzy/suffix/shortName fallback
    const remoteVer = extractVersionSignature(remoteCleanName);
    const localVer = extractVersionSignature(localName);
    if (remoteVer !== localVer) {
        return false;
    }

    // Strip "Model" word
    const stripModelWord = (s: string) => s.replace(/\s*\bmodel\b\s*/gi, ' ').replace(/\s+/g, ' ').trim();
    const strippedRemote = normalize(stripModelWord(remoteCleanName));
    const strippedLocal = normalize(stripModelWord(localName));
    if (strippedRemote && strippedRemote === strippedLocal) return true;

    // Local names often have suffix like "(gWM9)" or "(LA2)"
    const localWithoutParens = localName.replace(/\s*\([^)]*\)/g, '');
    const localNoParens = normalize(localWithoutParens);
    const strippedLocalNoParens = normalize(stripModelWord(localWithoutParens));
    if (
        normRemote === localNoParens ||
        strippedRemote === localNoParens ||
        strippedRemote === strippedLocalNoParens
    ) {
        return true;
    }

    // Only fall back to shortName matching if neither side has a conflicting modelRef,
    // version signatures match, and the normalized name is a plausible abbreviation/match
    // (prevents e.g. "Sharp Cheddar" [SC] from colliding with "Shredded cheddar" [SC],
    // and prevents "Cinque Terre Model V2" from colliding with "Cinque Terre Model").
    if (
        remoteShort &&
        localShort &&
        remoteShort.toUpperCase() === localShort.toUpperCase() &&
        (!remoteRef || !localRef)
    ) {
        if (normRemote.includes(normLocal) || normLocal.includes(normRemote)) {
            return true;
        }
    }

    return false;
}

function parseDisplayName(displayName: string): { cleanName: string; extractedDate?: string } {
    const cleaned = displayName.replace(/\s*\(BIG\s+MODEL\)\s*$/i, '').trim();
    const dateMatch = cleaned.match(/\(([^)]+\d{4})\)\s*$/);
    const cleanName = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return {
        cleanName,
        extractedDate: dateMatch ? dateMatch[1].trim() : undefined
    };
}

function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

const POSITIVE_KEYWORDS = [
    'great', 'awesome', 'amazing', 'perfect', 'best', 'smooth', 'love', 'good', 'impressed', 
    'excellent', 'confident', 'stable', 'rock solid', 'wife approved', 'gentle', 'clean', 
    'highly recommend', 'daily driver', 'favorites', 'solid', 'like a charm', 'no issues', 
    'no complaints', 'natural', 'quieter', 'nice', 'smoothness', 'confident lateral', 'resolved',
    'comfy', 'on rails', 'liked', 'preferred', 'improvement', 'fixed'
];

const NEGATIVE_KEYWORDS = [
    'bad', 'terrible', 'worst', 'ping-pong', 'ping pong', 'left hugging', 'right hugging', 
    'hug left', 'hug right', 'twitchy', 'wobble', 'oscillat', 'jerk', 'hard braking', 'creeps', 
    'scary', 'unstable', 'motion sickness', 'snaps', 'veer', 'fails', 'horrible', 'rough', 
    'sluggish', 'hesitat', 'dramatic', 'late correction', 'drifts', 'pingpong', 'not recommended',
    'stay away', 'hate', 'trash', 'regret', 'struggle', 'problem', 'issue', 'bug', 'broken'
];

function analyzeSentiment(text: string): 'great' | 'good' | 'ok' | 'bad' {
    const lower = text.toLowerCase();
    let pos = 0;
    let neg = 0;
    for (const w of POSITIVE_KEYWORDS) if (lower.includes(w)) pos++;
    for (const w of NEGATIVE_KEYWORDS) if (lower.includes(w)) neg++;
    if (pos > neg) return pos >= 2 ? 'great' : 'good';
    if (neg > pos) return 'bad';
    return 'ok';
}

/**
 * Loads the local models dataset.
 */
function loadLocalModels(): LocalModelsData {
    if (!fs.existsSync(MODELS_FILE)) {
        throw new Error(`models.json not found at ${MODELS_FILE}`);
    }
    return JSON.parse(fs.readFileSync(MODELS_FILE, 'utf-8'));
}

/**
 * Fetch and scan GitHub manifests (scanning the latest 2 selector generations per family
 * so models landing in e.g. v25 before v26 are never missed).
 */
async function scanGitHubManifests(localData: LocalModelsData, includeCustomUploads = false): Promise<ScannedModel[]> {
    const results: ScannedModel[] = [];
    const indexResponse = await fetch(MANIFEST_INDEX, { signal: AbortSignal.timeout(30000) });
    if (!indexResponse.ok) throw new Error(`Manifest discovery failed: HTTP ${indexResponse.status}`);
    const files = await indexResponse.json() as Array<{ name: string }>;
    if (!Array.isArray(files)) throw new Error('Manifest index is not a file list');

    for (const family of MANIFEST_FAMILIES) {
        const versions = files.flatMap(({ name }) => {
            if (!name.startsWith(family.prefix)) return [];
            const match = name.slice(family.prefix.length).match(/^(\d+)\.json$/);
            return match ? [{ file: name, version: Number(match[1]) }] : [];
        }).sort((a, b) => b.version - a.version);
        if (!versions.length) throw new Error(`No manifest found for ${family.name}`);

        const seenInFamily = new Set<string>();
        for (const ver of versions.slice(0, 2)) {
            const source = { ...family, ...ver, name: `${family.name} (v${ver.version})` };
            console.log(`  ${source.name}: ${source.file}`);
            const url = `${GITHUB_RAW_BASE}/${source.file}`;
            try {
                const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json() as { bundles?: ModelManifestBundle[] };
                if (!Array.isArray(data.bundles) || !data.bundles.length) throw new Error('Manifest has no model bundles');

                for (const bundle of data.bundles) {
                    const { cleanName, extractedDate } = parseDisplayName(bundle.display_name);
                    const dedupKey = bundle.ref || normalize(cleanName);
                    if (seenInFamily.has(dedupKey)) continue;
                    seenInFamily.add(dedupKey);

                    const folder = bundle.overrides?.folder?.trim();

                    let match: { categoryId: string; model: LocalModel } | undefined;
                    for (const cat of localData.categories) {
                        for (const m of cat.models) {
                            if (matchesLocalModel(cleanName, m.name, bundle.ref, m.modelRef, bundle.short_name, m.shortName)) {
                                match = { categoryId: cat.id, model: m };
                                break;
                            }
                        }
                        if (match) break;
                    }

                    // Skip uncurated user hash uploads (folder === "custom") unless already in catalog or explicitly requested.
                    // Note: "Custom Merge Models" is a curated Model Manager folder and must NOT be skipped.
                    if (!match && !includeCustomUploads && folder && /^custom$/i.test(folder)) {
                        continue;
                    }

                    results.push({
                        sourceId: source.id,
                        sourceName: source.name,
                        manifestFile: source.file,
                        targetCategory: source.targetCategory,
                        rawDisplayName: bundle.display_name,
                        cleanName,
                        extractedDate,
                        shortName: bundle.short_name,
                        modelRef: bundle.ref,
                        minimumSelectorVersion: bundle.minimum_selector_version ? Number(bundle.minimum_selector_version) : undefined,
                        folder,
                        index: bundle.index,
                        generation: bundle.generation,
                        isNew: !match,
                        localCategory: match?.categoryId,
                        matchedLocalModel: match?.model
                    });
                }
            } catch (err) {
                throw new Error(`Incomplete scan: ${source.file}`, { cause: err });
            }
        }
    }

    return results;
}

/**
 * Scan Discourse `model_drop` and `big_model` tags so forum-first official model drops
 * (e.g., Cinque Terre Model V2) are discovered even before manifest sync.
 */
async function scanDiscourseModelDrops(localData: LocalModelsData, existingScanned: ScannedModel[]): Promise<ScannedModel[]> {
    const discovered: ScannedModel[] = [];
    const linkedTopicIds = new Set<number>();
    for (const cat of localData.categories) {
        for (const m of cat.models) {
            const idMatch = m.forumUrl?.match(/\/t\/(?:[^/]+\/)?(\d+)/);
            if (idMatch) linkedTopicIds.add(Number(idMatch[1]));
        }
    }

    const topicMap = new Map<number, { id: number; title: string; created_at: string; tags?: Array<string | { name: string }> }>();
    const tagUrls = [
        `${DISCOURSE_BASE}/tag/model_drop.json`,
        `${DISCOURSE_BASE}/tag/big_model.json`,
    ];

    const responses = await Promise.allSettled(
        tagUrls.map(u => fetch(u, { signal: AbortSignal.timeout(10000) }))
    );

    for (const res of responses) {
        if (res.status === 'fulfilled' && res.value.ok) {
            try {
                const payload = await res.value.json() as {
                    topic_list?: { topics?: Array<{ id: number; title: string; created_at: string; tags?: Array<string | { name: string }> }> };
                };
                for (const t of payload.topic_list?.topics || []) {
                    topicMap.set(t.id, t);
                }
            } catch {
                // ignore malformed tag response
            }
        }
    }

    for (const topic of topicMap.values()) {
        if (linkedTopicIds.has(topic.id)) continue;

        const tagNames = (topic.tags || []).map(t => (typeof t === 'string' ? t : t.name).toLowerCase());
        if (!tagNames.includes('model_drop')) continue;

        const { cleanName, extractedDate } = parseDisplayName(topic.title);
        // Official model drop threads include a parenthetical release year (2026+)
        if (!extractedDate || !/\b202[6-9]\b/.test(extractedDate)) continue;

        const matchesLocal = localData.categories.some(cat =>
            cat.models.some(m => matchesLocalModel(cleanName, m.name))
        );
        if (matchesLocal) continue;

        const matchesManifest = existingScanned.some(s =>
            matchesLocalModel(cleanName, s.cleanName)
        );
        if (matchesManifest) continue;

        const isBigModel = tagNames.includes('big_model') || /\(big\s+model\)/i.test(topic.title);
        discovered.push({
            sourceId: isBigModel ? 'chestnut' : 'discourse',
            sourceName: isBigModel ? 'Discourse Forum (big_model)' : 'Discourse Forum (model_drop)',
            manifestFile: '',
            targetCategory: isBigModel ? 'chestnut_gpu' : 'world_2026',
            rawDisplayName: topic.title,
            cleanName,
            extractedDate,
            shortName: '',
            index: `topic#${topic.id}`,
            isNew: true,
        });
    }

    return discovered;
}

/**
 * Research a model on community.sunnypilot.ai Discourse forum.
 */
async function researchDiscourse(modelName: string): Promise<DiscourseResearchResult | null> {
    try {
        const cleanQuery = modelName.replace(/\s*\b(?:driving\s+)?model\b\s*/gi, ' ').replace(/\s+/g, ' ').trim();
        const query = encodeURIComponent(cleanQuery);
        const topicById = new Map<number, { id: number; title: string; created_at: string; posts_count: number }>();

        // Check Category 9, model_drop/big_model tags, and search endpoint
        const [catResp, tagResp, bigTagResp, searchResp] = await Promise.allSettled([
            fetch(`${DISCOURSE_BASE}/c/9.json`, { signal: AbortSignal.timeout(10000) }),
            fetch(`${DISCOURSE_BASE}/tag/model_drop.json`, { signal: AbortSignal.timeout(10000) }),
            fetch(`${DISCOURSE_BASE}/tag/big_model.json`, { signal: AbortSignal.timeout(10000) }),
            fetch(`${DISCOURSE_BASE}/search.json?q=${query}`, { signal: AbortSignal.timeout(10000) })
        ]);

        for (const resp of [catResp, tagResp, bigTagResp]) {
            if (resp.status === 'fulfilled' && resp.value.ok) {
                const data = await resp.value.json() as { topic_list?: { topics?: Array<{ id: number; title: string; created_at: string; posts_count: number }> } };
                for (const t of data.topic_list?.topics || []) topicById.set(t.id, t);
            }
        }
        if (searchResp.status === 'fulfilled' && searchResp.value.ok) {
            const searchData = await searchResp.value.json() as { topics?: Array<{ id: number; title: string; created_at: string; posts_count: number }> };
            for (const t of searchData.topics || []) topicById.set(t.id, t);
        }

        const topics = [...topicById.values()];
        if (topics.length === 0) return null;

        // Rank topics by matching precision + strict version-signature awareness
        const lowerName = cleanQuery.toLowerCase();
        const queryVersion = extractVersionSignature(modelName);
        const genericWords = new Set(['model', 'driving', 'the', 'new', 'custom', 'sp']);
        const distinctiveTokens = lowerName.split(/\s+/).filter(t => t.length > 1 && !genericWords.has(t));

        const scoredTopics = topics.map(t => {
            const lowerTitle = t.title.toLowerCase();
            const rawTitleBeforeDate = t.title
                .replace(/\s*\(big\s+model\)\s*$/i, '')
                .replace(/\s*\([^)]*\)\s*$/, '');
            const titleBeforeDate = rawTitleBeforeDate
                .toLowerCase()
                .replace(/\s*\b(?:driving\s+)?model\b\s*/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const topicVersion = extractVersionSignature(rawTitleBeforeDate);

            let score = 0;
            if (titleBeforeDate === lowerName || lowerTitle.startsWith(lowerName + ' (')) score += 80;
            else if (titleBeforeDate.includes(lowerName)) score += 50;

            // Strict version-signature match on titleBeforeDate (prevents "2" matching "2026" and V1 matching V2)
            if (queryVersion !== topicVersion) {
                score -= 60;
            } else if (queryVersion) {
                score += 30;
            }

            for (const token of distinctiveTokens) {
                if (titleBeforeDate.includes(token)) score += 15;
                else score -= 15;
            }
            return { topic: t, score };
        });

        scoredTopics.sort((a, b) => b.score - a.score);
        const bestMatch = scoredTopics[0];
        if (!bestMatch || bestMatch.score < 35) return null;

        const topic = bestMatch.topic;
        const topicUrl = `${DISCOURSE_BASE}/t/${topic.id}.json`;
        const topicResp = await fetch(topicUrl);
        if (!topicResp.ok) return null;

        const topicData = await topicResp.json() as {
            id: number;
            title: string;
            post_stream?: { posts?: DiscoursePost[] };
        };

        const posts = topicData.post_stream?.posts || [];
        if (posts.length === 0) return null;

        const op = posts[0];
        let pollScore: number | undefined;
        let pollVoters: number | undefined;
        let sentiment: { great: number; good: number; ok: number; bad: number } | undefined;
        const extractedPositives: string[] = [];
        const extractedNegatives: string[] = [];
        let extractedSteering: string | undefined;

        if (op.polls && op.polls.length > 0) {
            for (const poll of op.polls) {
                if (poll.name === 'overall' || poll.name === 'poll') {
                    pollVoters = poll.voters;
                    let greatVotes = 0;
                    let goodVotes = 0;
                    let okVotes = 0;
                    let badVotes = 0;

                    for (const opt of poll.options) {
                        const h = stripHtml(opt.html).toLowerCase();
                        const v = opt.votes || 0;
                        if (h.includes('great') || h.startsWith('5')) greatVotes += v;
                        else if (h.includes('good') || h.startsWith('4')) goodVotes += v;
                        else if (h.includes('ok') || h.startsWith('3')) okVotes += v;
                        else if (h.includes('bad') || h.includes('horrible') || h.includes('poor') || h.startsWith('2') || h.startsWith('1')) badVotes += v;
                    }

                    const total = greatVotes + goodVotes + okVotes + badVotes;
                    if (total > 0) {
                        const greatPct = Math.round((greatVotes / total) * 100);
                        const goodPct = Math.round((goodVotes / total) * 100);
                        const okPct = Math.round((okVotes / total) * 100);
                        const badPct = Math.max(0, 100 - (greatPct + goodPct + okPct));

                        sentiment = { great: greatPct, good: goodPct, ok: okPct, bad: badPct };
                        pollScore = Math.round(greatPct * 1.0 + goodPct * 0.75 + okPct * 0.50 + badPct * 0.0);
                    }
                } else if (poll.name === 'lateral' || poll.name === 'longitudinal') {
                    for (const opt of poll.options) {
                        if ((opt.votes || 0) > 0) {
                            const optText = opt.html.trim();
                            const sent = analyzeSentiment(optText);
                            if (sent === 'great' || sent === 'good') {
                                if (!extractedPositives.includes(optText)) extractedPositives.push(optText);
                            } else if (sent === 'bad') {
                                if (!extractedNegatives.includes(optText)) extractedNegatives.push(optText);
                            }
                        }
                    }
                } else if (poll.name === 'steering') {
                    const sortedOpts = [...poll.options].sort((a, b) => (b.votes || 0) - (a.votes || 0));
                    if (sortedOpts.length > 0 && (sortedOpts[0].votes || 0) > 0) {
                        extractedSteering = sortedOpts[0].html.replace(/^\d+\s*-\s*/, '').trim();
                    }
                }
            }
        }

        const comments: Array<{ username: string; text: string; likes: number }> = [];
        for (let i = 1; i < posts.length && comments.length < 5; i++) {
            const p = posts[i];
            const text = stripHtml(p.cooked);
            if (text.length > 20) {
                const likeAction = p.actions_summary?.find(a => a.id === 2);
                comments.push({
                    username: p.username,
                    text: text.length > 280 ? text.substring(0, 280) + '…' : text,
                    likes: likeAction?.count || 0
                });
            }
        }

        return {
            topicId: topic.id,
            title: topic.title,
            forumUrl: `https://community.sunnypilot.ai/t/${topic.id}`,
            createdAt: op.created_at,
            author: op.username,
            opSnippet: stripHtml(op.cooked).substring(0, 350),
            pollScore,
            pollVoters,
            sentiment,
            extractedPositives,
            extractedNegatives,
            extractedSteering,
            comments
        };
    } catch (err) {
        console.warn(`Discourse research error for ${modelName}:`, err);
        return null;
    }
}

/**
 * Scan local Discord feedback archive for mentions of the model.
 */
function researchDiscord(modelName: string): DiscordResearchResult | null {
    if (!fs.existsSync(DISCORD_DIR)) return null;

    const files = fs.readdirSync(DISCORD_DIR).filter(f => f.endsWith('.json'));
    const normModel = normalize(modelName.replace(/\s+Model$/i, ''));
    const matchedFiles: string[] = [];

    for (const f of files) {
        const normFile = normalize(f);
        if (normFile.includes(normModel)) {
            matchedFiles.push(f);
        }
    }

    if (matchedFiles.length === 0) return null;

    let great = 0, good = 0, ok = 0, bad = 0;
    let totalMessages = 0;
    const sampleQuotes: string[] = [];

    for (const file of matchedFiles) {
        try {
            const content = JSON.parse(fs.readFileSync(path.join(DISCORD_DIR, file), 'utf-8'));
            const msgs = content.messages || [];

            for (const msg of msgs) {
                if (msg.author?.isBot || !msg.content || msg.content.trim() === '') continue;
                const text = msg.content.trim();
                const sent = analyzeSentiment(text);
                totalMessages++;

                if (sent === 'great') great++;
                else if (sent === 'good') good++;
                else if (sent === 'ok') ok++;
                else if (sent === 'bad') bad++;

                if (sampleQuotes.length < 4 && text.length > 40 && text.length < 250) {
                    sampleQuotes.push(`"${text}" — @${msg.author?.username || 'user'}`);
                }
            }
        } catch {}
    }

    if (totalMessages === 0) return null;

    const total = great + good + ok + bad;
    const greatPct = Math.round((great / total) * 100);
    const goodPct = Math.round((good / total) * 100);
    const okPct = Math.round((ok / total) * 100);
    const badPct = Math.max(0, 100 - (greatPct + goodPct + okPct));

    const communityScore = Math.round(
        greatPct * 1.0 + goodPct * 0.75 + okPct * 0.50 + badPct * 0.0
    );

    return {
        matchedFiles,
        messagesAnalyzed: totalMessages,
        sentiment: { great: greatPct, good: goodPct, ok: okPct, bad: badPct },
        communityScore,
        sampleQuotes
    };
}

const CURATED_QCOM_FOLDERS = new Set([
    '2026 deep rl models',
    'master models',
    'release models',
]);

function isCuratedQualcommDrop(scanned: ScannedModel): boolean {
    const folder = (scanned.folder || '').trim().toLowerCase();
    return CURATED_QCOM_FOLDERS.has(folder);
}

/**
 * Apply newly discovered models (and newly discovered forum links for unlinked models)
 * to data/models.json and sync translations.
 */
function applyNewModels(
    localData: LocalModelsData,
    researchedModels: Array<{
        scanned: ScannedModel;
        discourse: DiscourseResearchResult | null;
        discord: DiscordResearchResult | null;
    }>
) {
    let addedCount = 0;
    let enrichedCount = 0;

    for (const item of researchedModels) {
        const { scanned, discourse, discord } = item;

        // If this is an existing model that lacked a specific topic forumUrl, enrich it when a Discourse topic is found
        if (!scanned.isNew && scanned.matchedLocalModel) {
            const existing = scanned.matchedLocalModel;
            const hasPlaceholderForumUrl =
                !existing.forumUrl ||
                existing.forumUrl === 'https://community.sunnypilot.ai' ||
                /\/tag\//i.test(existing.forumUrl);
            if (hasPlaceholderForumUrl && discourse?.forumUrl) {
                existing.forumUrl = discourse.forumUrl;
                if (discourse.pollVoters && discourse.pollVoters > 0 && discourse.pollScore !== undefined && discourse.sentiment) {
                    existing.communityScore = discourse.pollScore;
                    existing.totalVotes = discourse.pollVoters;
                    existing.sentiment = discourse.sentiment;
                }
                enrichedCount++;
                console.log(` 🔗 Linked "${existing.name}" to Discourse topic ${discourse.forumUrl}`);
            }
            continue;
        }

        if (!scanned.isNew) continue;

        // Qualcomm standard manifest includes self-serve user builds; auto-add curated release/Deep RL folders
        // or any model backed by an active Discourse/Discord thread
        if (scanned.sourceId === 'qcom' && !isCuratedQualcommDrop(scanned) && !discourse && !discord) {
            console.log(` ⏭️  Skipping unannounced Qualcomm build "${scanned.cleanName}" (folder: "${scanned.folder || 'none'}", no Discourse/Discord thread yet)`);
            continue;
        }

        const targetCat = localData.categories.find(c => c.id === scanned.targetCategory);
        if (!targetCat) {
            console.warn(`Target category ${scanned.targetCategory} not found for ${scanned.cleanName}`);
            continue;
        }

        const votes = (discourse?.pollVoters || 0) + (discord?.messagesAnalyzed || 0);
        const score = discourse?.pollScore ?? discord?.communityScore;
        const sentiment = discourse?.sentiment || discord?.sentiment;
        const isChestnut = scanned.sourceId === 'chestnut' || scanned.sourceId === 'usbgpu';
        const isDeepRl = /deep rl/i.test(scanned.folder || '');

        const tags = [
            ...(isChestnut ? ['Big Model', 'Chestnut'] : []),
            ...(isDeepRl ? ['Deep RL'] : ['2026']),
            'Experimental'
        ];

        const newModelEntry: LocalModel = {
            name: scanned.cleanName,
            date: scanned.extractedDate || discourse?.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            badge: 'EXPERIMENTAL',
            tags,
            ...(votes > 0 && score !== undefined && sentiment ? {
                communityScore: score,
                totalVotes: votes,
                sentiment
            } : {}),
            bestFor: 'Early experimental testing; performance is not yet verified.',
            ...(discourse?.extractedSteering ? { steeringFeel: discourse.extractedSteering } : {}),
            ...(scanned.manifestFile ? { manifestUrl: `https://github.com/sunnypilot/sunnypilot-models/blob/gh-pages/docs/${scanned.manifestFile}` } : {}),
            ...(scanned.modelRef ? { modelRef: scanned.modelRef } : {}),
            ...(scanned.shortName ? { shortName: scanned.shortName } : {}),
            ...(scanned.minimumSelectorVersion ? { minimumSelectorVersion: scanned.minimumSelectorVersion } : {}),
            testedOn: [],
            positives: (discourse?.extractedPositives && discourse.extractedPositives.length > 0)
                ? discourse.extractedPositives
                : [],
            negatives: (discourse?.extractedNegatives && discourse.extractedNegatives.length > 0)
                ? discourse.extractedNegatives
                : [],
            ...(discourse?.forumUrl ? { forumUrl: discourse.forumUrl } : {})
        };

        targetCat.models.push(newModelEntry);
        addedCount++;
        console.log(` ➕ Added "${scanned.cleanName}" to category [${targetCat.name}]`);
    }

    if (addedCount > 0 || enrichedCount > 0) {
        localData.totalModels = localData.categories.reduce((acc, c) => acc + c.models.length, 0);
        localData.lastUpdated = new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: '2-digit',
            year: 'numeric'
        });
        fs.writeFileSync(MODELS_FILE, JSON.stringify(localData, null, 2) + '\n', 'utf-8');
        console.log(`\n💾 Updated ${MODELS_FILE} (+${addedCount} new, ${enrichedCount} enriched; Total models: ${localData.totalModels})`);

        // Propagate structural changes to localized models
        const syncScript = path.join(process.cwd(), 'scripts', 'sync_models.mjs');
        if (fs.existsSync(syncScript)) {
            console.log('🔄 Running sync_models.mjs to update localized JSON catalogs...');
            execSync(`node "${syncScript}"`, { stdio: 'inherit' });
        }

        // Auto-translate any newly introduced strings and sync reviewed content
        const autoTranslateScript = path.join(process.cwd(), 'scripts', 'i18n', 'auto-translate-missing.mjs');
        if (fs.existsSync(autoTranslateScript)) {
            console.log('🌐 Running auto-translate-missing.mjs to localize new strings...');
            execSync(`node "${autoTranslateScript}"`, { stdio: 'inherit' });
        }
    } else {
        console.log('ℹ️ No new models or forum links to apply.');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const isCheckOnly = args.includes('--check');
    const isApply = args.includes('--apply');
    const isJson = args.includes('--json');
    const includeCustomUploads = args.includes('--include-custom-uploads');
    const researchArgIndex = args.indexOf('--research');
    const specificQuery = researchArgIndex !== -1 && args[researchArgIndex + 1] && !args[researchArgIndex + 1].startsWith('--')
        ? args[researchArgIndex + 1]
        : undefined;

    console.log('🚀 Sunnypilot Model Scanner & Researcher\n');

    const localData = loadLocalModels();
    console.log(` Local catalog loaded: ${localData.totalModels} models across ${localData.categories.length} categories.`);

    console.log('🌐 Fetching GitHub manifests (sunnypilot/sunnypilot-models:gh-pages)...');
    const manifestScanned = await scanGitHubManifests(localData, includeCustomUploads);

    console.log('💬 Checking Discourse model_drop & big_model tags...');
    const forumDrops = await scanDiscourseModelDrops(localData, manifestScanned);
    const scanned = [...manifestScanned, ...forumDrops];

    const newModels = Array.from(
        new Map(
            scanned
                .filter(m => m.isNew)
                .map(m => [m.modelRef || `${m.sourceId}:${normalize(m.cleanName)}`, m])
        ).values()
    );
    const existingModels = scanned.filter(m => !m.isNew);
    const unlinkedByFamily = MANIFEST_FAMILIES.flatMap(family =>
        existingModels
            .filter(
                m =>
                    m.sourceId === family.id &&
                    m.matchedLocalModel &&
                    (
                        !m.matchedLocalModel.forumUrl ||
                        m.matchedLocalModel.forumUrl === 'https://community.sunnypilot.ai' ||
                        /\/tag\//i.test(m.matchedLocalModel.forumUrl)
                    )
            )
            .slice(-5)
    );
    const unlinkedRecentExisting = Array.from(
        new Map(unlinkedByFamily.map(m => [normalize(m.cleanName), m])).values()
    );

    if (isCheckOnly) {
        console.log(`\n📊 Scan Summary:`);
        console.log(`- Total remote model entries scanned: ${scanned.length}`);
        console.log(`- Existing in local catalog: ${existingModels.length}`);
        console.log(`- New / Uncatalogued models: ${newModels.length}\n`);

        if (newModels.length > 0) {
            console.log('🚨 Found New Uncatalogued Models in GitHub / Discourse:');
            for (const m of newModels) {
                console.log(`  • [${m.sourceName}] "${m.cleanName}" (Index: ${m.index}, Short: ${m.shortName || 'N/A'}, Date: ${m.extractedDate || 'N/A'})`);
            }
            console.log('\n💡 Run `npm run scan:models -- --research` to research these models.');
        } else {
            console.log(' All remote models are currently catalogued in data/models.json!');
        }
        return;
    }

    // Research mode
    const modelsToResearch = specificQuery
        ? scanned.filter(m => m.cleanName.toLowerCase().includes(specificQuery.toLowerCase()))
        : isApply
            ? [...newModels, ...unlinkedRecentExisting]
            : (newModels.length > 0 ? newModels : scanned.slice(-3));

    if (modelsToResearch.length === 0) {
        console.log('\n✅ All remote models and forum links are up-to-date. Nothing to research.');
        return;
    }

    console.log(`\n🔬 Conducting research on ${modelsToResearch.length} model(s)...`);

    const researchResults: Array<{
        scanned: ScannedModel;
        discourse: DiscourseResearchResult | null;
        discord: DiscordResearchResult | null;
    }> = [];

    for (const m of modelsToResearch) {
        console.log(`\n--------------------------------------------------`);
        console.log(`🔍 Researching: "${m.cleanName}" (${m.sourceName})`);

        const discourse = await researchDiscourse(m.cleanName);
        if (discourse) {
            console.log(`  💬 Discourse: Found topic #${discourse.topicId} "${discourse.title}"`);
            console.log(`     URL: ${discourse.forumUrl}`);
            if (discourse.pollScore !== undefined) {
                console.log(`     Poll Score: ${discourse.pollScore}/100 (${discourse.pollVoters} voters)`);
            }
            console.log(`     Replies: ${discourse.comments.length} sample comments extracted.`);
        } else {
            console.log(`  💬 Discourse: No matching forum thread found.`);
        }

        const discord = researchDiscord(m.cleanName);
        if (discord) {
            console.log(`  🎮 Discord: Matched ${discord.matchedFiles.length} feedback file(s). Messages: ${discord.messagesAnalyzed}`);
            console.log(`     Sentiment: Great ${discord.sentiment.great}%, Good ${discord.sentiment.good}%, OK ${discord.sentiment.ok}%, Bad ${discord.sentiment.bad}%`);
            console.log(`     Community Score: ${discord.communityScore}`);
        } else {
            console.log(`  🎮 Discord: No local thread dumps matched.`);
        }

        researchResults.push({ scanned: m, discourse, discord });
    }

    if (isJson) {
        console.log('\n' + JSON.stringify(researchResults, null, 2));
        return;
    }

    if (isApply) {
        console.log('\n💾 Applying updates to models.json...');
        applyNewModels(localData, researchResults);
    } else {
        console.log('\n✅ Research complete! Use `--apply` to automatically save changes to models.json.');
    }
}

export {
    matchesLocalModel,
    extractVersionSignature,
    isCuratedQualcommDrop,
    parseDisplayName,
    normalize,
    scanDiscourseModelDrops,
};

if (process.argv[1]?.endsWith('scan_models.ts')) {
    main().catch(err => {
        console.error('Fatal error running model scanner:', err);
        process.exit(1);
    });
}
