import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const DISCORD_DIR = path.join(DATA_DIR, 'discord_feedback');
const DISCOURSE_BASE = 'https://community.sunnypilot.ai';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sunnypilot/sunnypilot-models/refs/heads/gh-pages/docs';
const MANIFEST_SOURCES = [
    { id: 'chestnut', name: 'Chestnut GPU (Big Models)', file: 'driving_models_chestnut_v23.json', targetCategory: 'chestnut_gpu' },
    { id: 'qcom_v22', name: 'Qualcomm Standard (v22)', file: 'driving_models_v22.json', targetCategory: 'world_2026' }
];

interface ModelManifestBundle {
    index: number | string;
    short_name: string;
    display_name: string;
    generation?: number | string;
    environment?: string;
    is_20hz?: boolean;
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
    bestFor?: string;
    steeringFeel?: string;
    positives?: string[];
    negatives?: string[];
    testedOn?: string[];
    forumUrl?: string;
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
    targetCategory: string;
    rawDisplayName: string;
    cleanName: string;
    extractedDate?: string;
    shortName: string;
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

function matchesLocalModel(remoteCleanName: string, localName: string): boolean {
    const normRemote = normalize(remoteCleanName);
    const normLocal = normalize(localName);

    if (normRemote === normLocal) return true;

    // Check known aliases
    if (KNOWN_ALIASES[normRemote] && KNOWN_ALIASES[normRemote] === normLocal) {
        return true;
    }

    // Strip "Model" suffix
    const strippedRemote = normalize(remoteCleanName.replace(/\s+Model$/i, ''));
    const strippedLocal = normalize(localName.replace(/\s+Model$/i, ''));
    if (strippedRemote === strippedLocal) return true;

    // Local names often have suffix like "(gWM9)" or "(LA2)"
    const localNoParens = normalize(localName.replace(/\s*\([^)]*\)/g, ''));
    if (normRemote === localNoParens || strippedRemote === localNoParens) return true;

    return false;
}

function parseDisplayName(displayName: string): { cleanName: string; extractedDate?: string } {
    const dateMatch = displayName.match(/\(([^)]+ \d{1,2}, \d{4})\)/);
    const cleanName = displayName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return {
        cleanName,
        extractedDate: dateMatch ? dateMatch[1] : undefined
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
 * Fetch and scan GitHub manifests.
 */
async function scanGitHubManifests(localData: LocalModelsData): Promise<ScannedModel[]> {
    const results: ScannedModel[] = [];

    for (const source of MANIFEST_SOURCES) {
        const url = `${GITHUB_RAW_BASE}/${source.file}`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                console.warn(`⚠️ Failed to fetch manifest ${source.file}: HTTP ${resp.status}`);
                continue;
            }
            const data = await resp.json() as { bundles?: ModelManifestBundle[] };
            const bundles = data.bundles || [];

            for (const bundle of bundles) {
                const { cleanName, extractedDate } = parseDisplayName(bundle.display_name);

                let match: { categoryId: string; model: LocalModel } | undefined;
                for (const cat of localData.categories) {
                    for (const m of cat.models) {
                        if (matchesLocalModel(cleanName, m.name)) {
                            match = { categoryId: cat.id, model: m };
                            break;
                        }
                    }
                    if (match) break;
                }

                results.push({
                    sourceId: source.id,
                    sourceName: source.name,
                    targetCategory: source.targetCategory,
                    rawDisplayName: bundle.display_name,
                    cleanName,
                    extractedDate,
                    shortName: bundle.short_name,
                    index: bundle.index,
                    generation: bundle.generation,
                    isNew: !match,
                    localCategory: match?.categoryId,
                    matchedLocalModel: match?.model
                });
            }
        } catch (err) {
            console.error(`❌ Error fetching manifest ${source.file}:`, err);
        }
    }

    return results;
}

/**
 * Research a model on community.sunnypilot.ai Discourse forum.
 */
async function researchDiscourse(modelName: string): Promise<DiscourseResearchResult | null> {
    try {
        const cleanQuery = modelName.replace(/\s+Model$/i, '').trim();
        const query = encodeURIComponent(cleanQuery);
        const searchUrl = `${DISCOURSE_BASE}/search.json?q=${query}`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) return null;

        const searchData = await searchResp.json() as { topics?: Array<{ id: number; title: string; created_at: string; posts_count: number }> };
        let topics = searchData.topics || [];

        if (topics.length === 0) {
            // Fallback to Category 9 (Model drops)
            const catResp = await fetch(`${DISCOURSE_BASE}/c/9.json`);
            if (catResp.ok) {
                const catData = await catResp.json() as { topic_list?: { topics?: Array<{ id: number; title: string; created_at: string; posts_count: number }> } };
                topics = catData.topic_list?.topics || [];
            }
        }

        if (topics.length === 0) return null;

        // Rank topics by matching precision
        const lowerName = cleanQuery.toLowerCase();
        const tokens = lowerName.split(/\s+/).filter(t => t.length > 1);

        const scoredTopics = topics.map(t => {
            const lowerTitle = t.title.toLowerCase();
            let score = 0;
            if (lowerTitle.includes(lowerName)) score += 50;
            // Version match check (e.g. "v6", "v4")
            const vMatch = lowerName.match(/\bv(\d+)\b/);
            if (vMatch) {
                if (lowerTitle.includes(vMatch[0])) score += 30;
                else score -= 20;
            }
            for (const token of tokens) {
                if (lowerTitle.includes(token)) score += 10;
            }
            return { topic: t, score };
        });

        scoredTopics.sort((a, b) => b.score - a.score);
        const bestMatch = scoredTopics[0];
        if (!bestMatch || bestMatch.score < 10) return null;

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
                if (poll.name === 'overall') {
                    pollVoters = poll.voters;
                    let greatVotes = 0;
                    let goodVotes = 0;
                    let okVotes = 0;
                    let badVotes = 0;

                    for (const opt of poll.options) {
                        const h = opt.html.toLowerCase();
                        const v = opt.votes || 0;
                        if (h.includes('great') || h.includes('5')) greatVotes += v;
                        else if (h.includes('good') || h.includes('4')) goodVotes += v;
                        else if (h.includes('ok') || h.includes('3')) okVotes += v;
                        else if (h.includes('bad') || h.includes('poor') || h.includes('2') || h.includes('1')) badVotes += v;
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

/**
 * Apply newly discovered models to data/models.json and sync translations.
 */
function applyNewModels(
    localData: LocalModelsData,
    newModelsWithResearch: Array<{
        scanned: ScannedModel;
        discourse: DiscourseResearchResult | null;
        discord: DiscordResearchResult | null;
    }>
) {
    let addedCount = 0;

    for (const item of newModelsWithResearch) {
        const { scanned, discourse, discord } = item;
        const targetCat = localData.categories.find(c => c.id === scanned.targetCategory);
        if (!targetCat) {
            console.warn(`Target category ${scanned.targetCategory} not found for ${scanned.cleanName}`);
            continue;
        }

        const score = discourse?.pollScore ?? discord?.communityScore ?? 75;
        const votes = (discourse?.pollVoters || 0) + (discord?.messagesAnalyzed || 0);

        const newModelEntry: LocalModel = {
            name: scanned.cleanName,
            date: scanned.extractedDate || discourse?.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            badge: 'New Release',
            tags: [scanned.sourceId === 'chestnut' ? 'Chestnut eGPU' : '2026', 'Experimental'],
            communityScore: score,
            totalVotes: votes > 0 ? votes : 10,
            sentiment: discourse?.sentiment || discord?.sentiment || { great: 45, good: 35, ok: 15, bad: 5 },
            bestFor: 'Testing the latest sunnypilot training release.',
            steeringFeel: discourse?.extractedSteering || 'Active community testing; consult forum thread for impressions.',
            positives: (discourse?.extractedPositives && discourse.extractedPositives.length > 0)
                ? discourse.extractedPositives
                : ['Latest model architecture updates from comma.ai', 'Improved training dataset'],
            negatives: (discourse?.extractedNegatives && discourse.extractedNegatives.length > 0)
                ? discourse.extractedNegatives
                : ['May exhibit early-run quirks; verify on vehicle with disengage hand ready'],
            testedOn: ['Community Fleet'],
            forumUrl: discourse?.forumUrl || 'https://community.sunnypilot.ai'
        };

        targetCat.models.unshift(newModelEntry);
        addedCount++;
        console.log(` Added "${scanned.cleanName}" to category [${targetCat.name}]`);
    }

    if (addedCount > 0) {
        localData.totalModels = localData.categories.reduce((acc, c) => acc + c.models.length, 0);
        localData.lastUpdated = new Date().toISOString().slice(0, 10);
        fs.writeFileSync(MODELS_FILE, JSON.stringify(localData, null, 2) + '\n', 'utf-8');
        console.log(`\n Successfully updated ${MODELS_FILE} (Total models: ${localData.totalModels})`);

        // Propagate to localized models
        const syncScript = path.join(process.cwd(), 'scripts', 'sync_models.mjs');
        if (fs.existsSync(syncScript)) {
            console.log('🔄 Running sync_models.mjs to update localized JSON catalogs...');
            execSync(`node "${syncScript}"`, { stdio: 'inherit' });
        }
    } else {
        console.log('ℹ️ No new models to add.');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const isCheckOnly = args.includes('--check');
    const isApply = args.includes('--apply');
    const isJson = args.includes('--json');
    const researchArgIndex = args.indexOf('--research');
    const specificQuery = researchArgIndex !== -1 ? args[researchArgIndex + 1] : undefined;

    console.log('🚀 Sunnypilot Model Scanner & Researcher\n');

    const localData = loadLocalModels();
    console.log(` Local catalog loaded: ${localData.totalModels} models across ${localData.categories.length} categories.`);

    console.log('🌐 Fetching GitHub manifests (sunnypilot/sunnypilot-models:gh-pages)...');
    const scanned = await scanGitHubManifests(localData);

    const newModels = scanned.filter(m => m.isNew);
    const existingModels = scanned.filter(m => !m.isNew);

    if (isCheckOnly) {
        console.log(`\n📊 Scan Summary:`);
        console.log(`- Total remote models scanned: ${scanned.length}`);
        console.log(`- Existing in local catalog: ${existingModels.length}`);
        console.log(`- New / Uncatalogued models: ${newModels.length}\n`);

        if (newModels.length > 0) {
            console.log('🚨 Found New Uncatalogued Models in GitHub:');
            for (const m of newModels) {
                console.log(`  • [${m.sourceName}] "${m.cleanName}" (Index: ${m.index}, Short: ${m.shortName}, Date: ${m.extractedDate || 'N/A'})`);
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
        : (newModels.length > 0 ? newModels : scanned.slice(-3));

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
        applyNewModels(localData, researchResults.filter(r => r.scanned.isNew));
    } else {
        console.log('\n✅ Research complete! Use `--apply` to automatically save changes to models.json.');
    }
}

main().catch(err => {
    console.error('Fatal error running model scanner:', err);
    process.exit(1);
});
