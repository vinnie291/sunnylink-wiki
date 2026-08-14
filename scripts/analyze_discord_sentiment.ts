import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const DISCORD_DIR = path.join(DATA_DIR, 'discord_feedback');

interface Model {
    name: string;
    communityScore?: number;
    totalVotes?: number;
    sentiment?: {
        great: number;
        good: number;
        ok: number;
        bad: number;
    };
    [key: string]: unknown;
}

interface Category {
    id: string;
    name: string;
    models: Model[];
    [key: string]: unknown;
}

interface ModelsData {
    appName: string;
    version: string;
    totalModels: number;
    lastUpdated: string;
    categories: Category[];
    [key: string]: unknown;
}

// Positive and Negative keywords/phrases for driving model assessment
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
    'stay away', 'hate', 'trash', 'regret', 'struggle', 'doesn\'t', 'problem', 'issue', 'bug', 
    'broken', 'jerkiness', 'hesitation', 'disagree', 'negative', 'poor', 'snapping'
];

// Strong words to force 'great' classification
const STRONG_POSITIVE_KEYWORDS = [
    'great', 'awesome', 'amazing', 'perfect', 'best', 'love', 'excellent', 'on rails', 'impressed'
];

// Custom model-to-filename aliases for exact mapping of main models
const SPECIAL_ALIASES: Record<string, string[]> = {
    "TCPmV3 (The Cool Peoples Model)": ["the cool peoples model v3", "the cool people’s model v3", "tcpmv3"],
    "GWM V9 (gWM9)": ["gwm9"],
    "Down to Ride v6": ["down to ride [revision 6]", "down to ride revision 6", "dtr6"],
    "WMI V12": ["wmiv12", "wmi v12"],
    "WMI V11": ["wmiv11", "wmi v11"],
    "WMI v10": ["wmiv10", "wmi v10"],
    "WMI V9": ["wmiv9", "wmi v9"],
    "WMI V8": ["wmiv8", "wmi v8"],
    "WMI V7": ["wmiv7", "wmi v7"],
    "Dark Souls Model v2": ["dark souls model v2", "darksouls model v2", "dark souls v2"],
    "OP Model 10 v3": ["op model 10 v3", "opmodel 10 v3", "op model 10v3"],
    "OP Model 10 v2": ["op model 10 v2", "opmodel 10 v2", "op model 10v2"],
    "OP Model 10": ["op model 10", "opmodel 10", "op model 10 [", "op model 10 (", "op model 10 "], 
    "OP Model 9": ["op model 9", "opmodel 9"],
    "OP Model 8": ["op model 8", "opmodel 8"],
    "OP Model 7": ["op model 7", "opmodel 7"],
    "OP Model": ["op model ", "opmodel [", "op model (", "op model [", "op model_drop"], 
    "Pop v2": ["pop model v2", "pop v2"],
    "Pop Model": ["pop model ", "pop model ["],

    // Models whose thread title differs from the model name. Without these the
    // thread exists but is silently skipped, leaving the model unscored.
    "Aggressive TR": ["aggressive tomb raider"],
    "Neurips Driving Model": ["neurips model"],
    "Liquid Crystal Driving": ["liquid crystal"],
    "WMI": ["wmi model"],
    "WMI2": ["wmiv2"],
    "gWM Model v3": ["gwm v3 model"],
    "gWM v5": ["gwm5"],
    "gWM v6": ["gwm6"],
    "gWM v8": ["gwm8"],
    // Registry/in-car name is "Digon"; the Discord thread spells it "Dijon".
    "Nuggets in Digon": ["nuggets in dijon", "nuggets in digon"],
    // Thread is titled just "DA" — too short for the generic matcher, so pin it exactly.
    "Duck Amigo": ["=da"],

    // Models recovered from the Discord archive.
    "New Lemon Pie (NLP)": ["new lemon pie"],
    "Bad Dragon (BD)": ["bad dragon"],
    "New Delhi (ND)": ["new delhi"],
    // "LA- Los Angeles" is a prefix of "LA- Los Angeles V2", so v1 must match exactly.
    "Los Angeles (LA)": ["=la- los angeles"],
    "Los Angeles V2 (LA2)": ["la- los angeles v2"],
    // Also a prefix of both "... V2" and "CHLR - Recertified Herbalist".
    "Certified Herbalist (CH)": ["=ch - certified herbalist"],
    "Vibe (Custom Model)": ["vibe (custom model)"],
    "Down to Ride (Original)": ["=dtr - down to ride"],
    "Down to Ride v3": ["down to ride v3"],
    "Down to Ride v4": ["down to ride v4"],
    "Organic Kerrygold": ["organic kerrygold"],
    "Watermelon Model (WM)": ["watermelon model (wm)"],
    "Green Watermelon (gWM)": ["green watermelon"],
    "gWM Model v2": ["gwm model v2"],
    "gWM v4": ["gwm v4"],
    "gWM7": ["gwm7"],
    "Tomb Raider 10": ["tomb raider 10"],
    "Cookiemonster Tomb Raider": ["cookiemonster"],
    "Space Lab Model": ["=space lab model"],
    "UV Model": ["uv model"],
};

function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getThreadNameFromFilename(filename: string): string {
    // Filenames are usually in format: sunnypilot - driving-model-discussion - Thread Name [ID].json
    const match = filename.match(/^sunnypilot - driving-model-discussion - (.*?) \[?\d+\]?\.json$/);
    if (match) return match[1];
    return filename.replace('.json', '');
}

function matchesModel(modelName: string, filename: string): boolean {
    const threadName = getThreadNameFromFilename(filename);
    const normThread = normalize(threadName);
    const normModel = normalize(modelName);

    // 1. Check special custom aliases.
    //    An alias prefixed with '=' must match the whole thread name, which is how
    //    a model is kept from also swallowing its own sequel's thread (e.g. the
    //    "Los Angeles" thread name is a prefix of "Los Angeles V2").
    if (SPECIAL_ALIASES[modelName]) {
        for (const alias of SPECIAL_ALIASES[modelName]) {
            if (alias.startsWith('=')) {
                if (normThread === normalize(alias.slice(1))) {
                    return true;
                }
            } else if (normThread.includes(normalize(alias))) {
                return true;
            }
        }
        return false;
    }

    // 2. Generic prefix / substring matching (for the longest substrings)
    // Avoid short matches like "WMI" matching "WMI V12" if we are matching shorter strings
    if (normModel.length > 3 && normThread.includes(normModel)) {
        return true;
    }

    // 3. Fallback: Check if model name (without spaces/special chars) is in the thread name
    const cleanedModel = modelName.toLowerCase().replace(/🛰️/g, '').trim();
    if (cleanedModel.length > 3 && threadName.toLowerCase().includes(cleanedModel)) {
        return true;
    }

    return false;
}

function analyzeMessageSentiment(content: string): 'great' | 'good' | 'ok' | 'bad' {
    const text = content.toLowerCase();
    let posScore = 0;
    let negScore = 0;
    let hasStrongPos = false;

    for (const word of POSITIVE_KEYWORDS) {
        if (text.includes(word)) {
            posScore++;
            if (STRONG_POSITIVE_KEYWORDS.includes(word)) {
                hasStrongPos = true;
            }
        }
    }

    for (const word of NEGATIVE_KEYWORDS) {
        if (text.includes(word)) {
            negScore++;
        }
    }

    if (posScore > negScore) {
        if (posScore >= 2 || hasStrongPos) {
            return 'great';
        }
        return 'good';
    } else if (negScore > posScore) {
        return 'bad';
    } else {
        return 'ok';
    }
}

function main() {
    console.log('🏁 Starting Discord sentiment analysis...\n');

    if (!fs.existsSync(MODELS_FILE)) {
        console.error(`❌ Error: Models file not found at ${MODELS_FILE}`);
        process.exit(1);
    }

    if (!fs.existsSync(DISCORD_DIR)) {
        console.error(`❌ Error: Discord feedback directory not found at ${DISCORD_DIR}`);
        process.exit(1);
    }

    const modelsData = JSON.parse(fs.readFileSync(MODELS_FILE, 'utf-8')) as ModelsData;
    const discordFiles = fs.readdirSync(DISCORD_DIR).filter(f => f.endsWith('.json'));

    console.log(`📂 Found ${discordFiles.length} Discord feedback JSON files.`);
    console.log(`🧠 Parsing and matching driving models...\n`);

    let totalUpdatedModels = 0;

    // Collect all models from models.json
    const allModels: Model[] = [];
    for (const category of modelsData.categories) {
        for (const model of category.models) {
            allModels.push(model);
        }
    }

    // Sort models by name length descending to ensure specific models get matched first
    allModels.sort((a, b) => b.name.length - a.name.length);

    const matchedFilesTracker = new Set<string>();

    for (const model of allModels) {
        const matchedFiles = discordFiles.filter(file => {
            // Match model, ensuring we don't double-match files if they are already precisely mapped
            return matchesModel(model.name, file);
        });

        if (matchedFiles.length === 0) {
            continue;
        }

        console.log(`🔍 Model: "${model.name}" matches ${matchedFiles.length} file(s):`);
        for (const file of matchedFiles) {
            console.log(`   └─ 📄 ${file}`);
            matchedFilesTracker.add(file);
        }

        let greatCount = 0;
        let goodCount = 0;
        let okCount = 0;
        let badCount = 0;
        let messagesAnalyzed = 0;

        for (const file of matchedFiles) {
            const filePath = path.join(DISCORD_DIR, file);
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const messages = data.messages || [];

                for (const msg of messages) {
                    // Skip bot messages or blank system messages
                    if (msg.author?.isBot || !msg.content || msg.content.trim() === '') {
                        continue;
                    }

                    const sentiment = analyzeMessageSentiment(msg.content);
                    messagesAnalyzed++;

                    if (sentiment === 'great') greatCount++;
                    else if (sentiment === 'good') goodCount++;
                    else if (sentiment === 'ok') okCount++;
                    else if (sentiment === 'bad') badCount++;
                }
            } catch (err) {
                console.error(`   ❌ Failed to parse ${file}:`, err);
            }
        }

        if (messagesAnalyzed > 0) {
            const total = greatCount + goodCount + okCount + badCount;
            const greatPct = Math.round((greatCount / total) * 100);
            const goodPct = Math.round((goodCount / total) * 100);
            const okPct = Math.round((okCount / total) * 100);
            // Ensure percentages sum exactly to 100
            const badPct = 100 - (greatPct + goodPct + okPct);

            const score = Math.round(
                greatPct * 1.0 +
                goodPct * 0.75 +
                okPct * 0.50 +
                Math.max(0, badPct) * 0.0
            );

            // Update model in memory
            model.totalVotes = messagesAnalyzed;
            model.communityScore = score;
            model.sentiment = {
                great: greatPct,
                good: goodPct,
                ok: okPct,
                bad: Math.max(0, badPct)
            };

            console.log(`   📊 Calculated Sentiment: Great ${greatPct}%, Good ${goodPct}%, OK ${okPct}%, Bad ${Math.max(0, badPct)}%`);
            console.log(`   📈 Total Messages: ${messagesAnalyzed} | Community Score: ${score}\n`);
            totalUpdatedModels++;
        } else {
            console.log(`   ⚠️  No user messages found to analyze.\n`);
        }
    }

    // Write updated models.json back to disk
    fs.writeFileSync(MODELS_FILE, JSON.stringify(modelsData, null, 4), 'utf-8');
    console.log(`💾 Successfully updated data/models.json with Discord sentiment data.`);
    console.log(`📈 Summary: Updated ${totalUpdatedModels} models using ${matchedFilesTracker.size} unique feedback files.`);

    // Run localization sync
    console.log(`\n🔄 Propagating updates to localized models file via sync script...`);
    try {
        if (fs.existsSync(path.join(process.cwd(), 'scripts/sync_models.mjs'))) {
            execSync('node scripts/sync_models.mjs', { stdio: 'inherit' });
            console.log('✓ Localization models successfully synced!');
        } else if (fs.existsSync(path.join(process.cwd(), 'scripts/sync_models.py'))) {
            execSync('python3 scripts/sync_models.py', { stdio: 'inherit' });
            console.log('✓ Localization models successfully synced!');
        }
    } catch (err) {
        console.error('❌ Failed to run localization sync script:', err);
    }

    console.log(`\n🎉 Discord sentiment analysis sync completed successfully!`);
}

main();
