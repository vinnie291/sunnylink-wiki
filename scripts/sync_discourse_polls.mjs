import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const DISCOURSE_POLLS_FILE = path.join(DATA_DIR, 'discourse_polls.json');
const DISCOURSE_BASE = 'https://community.sunnypilot.ai';

function decodeHtml(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

function cleanQuestionTitle(pollName, rawTitle) {
    const cleaned = decodeHtml(rawTitle);
    if (cleaned && cleaned.length > 0) {
        return cleaned;
    }
    switch (pollName) {
        case 'poll':
        case 'overall':
            return 'How is this model?';
        case 'vs_default':
            return 'Compared to default model:';
        case 'would_merge':
            return 'Should this become the new default?';
        case 'lateral':
        case 'poll3':
            return 'Lateral (steering):';
        case 'long_mode':
        case 'poll4':
            return 'Longitudinal used:';
        case 'longitudinal':
        case 'poll5':
            return 'Longitudinal (acceleration and braking):';
        case 'steering':
            return 'Steering control:';
        default:
            return pollName.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
}

function calculateSentimentAndScore(ratingPoll) {
    if (!ratingPoll || !ratingPoll.options) return null;
    let great = 0, good = 0, ok = 0, bad = 0;
    for (const opt of ratingPoll.options) {
        const text = opt.html.toLowerCase();
        if (text.includes('great') || text.startsWith('5')) {
            great += opt.votes;
        } else if (text.includes('good') || text.startsWith('4')) {
            good += opt.votes;
        } else if (text.includes('ok') || text.startsWith('3')) {
            ok += opt.votes;
        } else if (text.includes('bad') || text.includes('horrible') || text.includes('poor') || text.startsWith('2') || text.startsWith('1')) {
            bad += opt.votes;
        }
    }
    const total = great + good + ok + bad;
    if (total === 0) return null;
    const greatPct = Math.round((great / total) * 100);
    const goodPct = Math.round((good / total) * 100);
    const okPct = Math.round((ok / total) * 100);
    const badPct = Math.max(0, 100 - (greatPct + goodPct + okPct));
    const score = Math.min(100, Math.max(0, Math.round(greatPct * 1.0 + goodPct * 0.75 + okPct * 0.50)));
    return {
        score,
        totalVotes: total,
        sentiment: {
            great: greatPct,
            good: goodPct,
            ok: okPct,
            bad: badPct
        }
    };
}

async function fetchTopic(topicId) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const res = await fetch(`${DISCOURSE_BASE}/t/${topicId}.json`);
            if (res.status === 429) {
                const waitTime = 2000 * (attempt + 1);
                console.log(`[Rate limit 429] Waiting ${waitTime}ms for topic ${topicId}...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            if (!res.ok) {
                return null;
            }
            return await res.json();
        } catch (err) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
    return null;
}

export async function syncDiscoursePolls(options = { fetchRemote: true }) {
    console.log('🔄 Synchronizing Sunnypilot Discourse polls...');
    const modelsData = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf8'));

    const topicMap = [];
    for (const cat of modelsData.categories) {
        for (const m of cat.models) {
            if (m.forumUrl && m.forumUrl.includes('/t/')) {
                const match = m.forumUrl.match(/\/t\/.*?\/(\d+)/) || m.forumUrl.match(/\/t\/(\d+)/);
                if (match) {
                    topicMap.push({ name: m.name, topicId: match[1], url: m.forumUrl, modelRef: m });
                }
            }
        }
    }

    console.log(`Found ${topicMap.length} models with Discourse forum URLs.`);

    let existingPolls = {};
    if (fs.existsSync(DISCOURSE_POLLS_FILE)) {
        try {
            existingPolls = JSON.parse(fs.readFileSync(DISCOURSE_POLLS_FILE, 'utf8'));
        } catch (e) {
            existingPolls = {};
        }
    }

    const updatedPolls = {};
    for (const [name, info] of Object.entries(existingPolls)) {
        updatedPolls[name] = {
            ...info,
            polls: (info.polls || []).map(p => ({
                ...p,
                title: cleanQuestionTitle(p.name, p.title),
                options: (p.options || []).map(o => ({
                    ...o,
                    html: decodeHtml(o.html),
                }))
            }))
        };
    }
    let modelsUpdated = 0;

    if (options.fetchRemote) {
        for (let i = 0; i < topicMap.length; i++) {
            const item = topicMap[i];
            const data = await fetchTopic(item.topicId);
            if (!data) {
                console.log(`[${i + 1}/${topicMap.length}] ⚠️ Skipped / not found: ${item.name} (#${item.topicId})`);
                continue;
            }

            const firstPost = data.post_stream?.posts?.[0];
            const rawPolls = firstPost?.polls || [];

            const formattedPolls = rawPolls.map(p => {
                const title = cleanQuestionTitle(p.name, p.title);
                return {
                    name: p.name,
                    type: p.type === 'multiple' ? 'multiple' : 'regular',
                    min: p.min ?? null,
                    max: p.max ?? null,
                    voters: p.voters || 0,
                    title,
                    options: (p.options || []).map(o => ({
                        id: o.id,
                        html: decodeHtml(o.html),
                        votes: o.votes || 0,
                    })),
                };
            });

            updatedPolls[item.name] = {
                topicId: item.topicId,
                title: data.title,
                polls: formattedPolls,
                updatedAt: new Date().toISOString(),
            };

            console.log(`[${i + 1}/${topicMap.length}] ✓ ${item.name} (${formattedPolls.length} polls, max voters: ${formattedPolls.reduce((m, p) => Math.max(m, p.voters), 0)})`);
            await new Promise(r => setTimeout(r, 600)); // Rate limit protection
        }
    }

    fs.writeFileSync(DISCOURSE_POLLS_FILE, JSON.stringify(updatedPolls, null, 2), 'utf8');
    console.log(`💾 Saved ${Object.keys(updatedPolls).length} model polls to ${DISCOURSE_POLLS_FILE}`);

    // Update models.json with Discourse baseline score and sentiment
    for (const cat of modelsData.categories) {
        for (const m of cat.models) {
            const pollInfo = updatedPolls[m.name] || Object.values(updatedPolls).find(
                (p, idx) => Object.keys(updatedPolls)[idx]?.toLowerCase() === m.name.toLowerCase()
            );

            if (pollInfo && pollInfo.polls && pollInfo.polls.length > 0) {
                const ratingPoll = pollInfo.polls.find(p => p.name === 'overall' || p.name === 'poll') || pollInfo.polls[0];
                const stats = calculateSentimentAndScore(ratingPoll);
                if (stats && stats.totalVotes > 0) {
                    m.communityScore = stats.score;
                    m.totalVotes = stats.totalVotes;
                    m.sentiment = stats.sentiment;
                    modelsUpdated++;
                }
            }
        }
    }

    modelsData.lastUpdated = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: '2-digit',
        year: 'numeric'
    });

    fs.writeFileSync(MODELS_FILE, JSON.stringify(modelsData, null, 2) + '\n', 'utf8');
    console.log(`💾 Updated models.json with parity data for ${modelsUpdated} models.`);

    // Run sync_models.mjs to propagate to localized models files
    try {
        const syncScript = path.join(process.cwd(), 'scripts', 'sync_models.mjs');
        if (fs.existsSync(syncScript)) {
            await import('./sync_models.mjs');
            console.log('✓ Propagated updates to localized models.*.json files.');
        }
    } catch (e) {
        console.error('Error running sync_models.mjs:', e);
    }
}

// Execute directly if run from CLI
if (process.argv[1]?.endsWith('sync_discourse_polls.mjs')) {
    const fetchRemote = !process.argv.includes('--cached-only');
    syncDiscoursePolls({ fetchRemote }).then(() => {
        console.log('🎉 Discourse poll sync completed successfully!');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Sync failed:', err);
        process.exit(1);
    });
}
