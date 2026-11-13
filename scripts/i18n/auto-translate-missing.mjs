#!/usr/bin/env node
/**
 * Automatically detects any newly added, untranslated English prose strings in
 * data/*.<locale>.json (where target === source) or missing derived simulator/rating
 * evidence strings, translates ONLY those missing strings into ko, zh, fr, de, es,
 * and synchronizes data/*.<locale>.json.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const read = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));
const write = (rel, data) => writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + '\n', 'utf8');

const CANONICAL_FIELDS = new Set([
    'id', 'key', 'type', 'make', 'model', 'date', 'version', 'lastUpdated',
    'schemaVersion', 'deviceAvailability', 'forumUrl', 'docUrl', 'device',
    'harness', 'radar', 'drivingModel', 'torqueTuning', 'lateralControl',
    'longitudinalControl', 'mads', 'experimentalMode', 'badge', 'category',
    'unit', 'years', 'user', 'icon', 'options', 'default', 'recommended',
    'settingsKeys', 'tags', 'testedOn', 'includes', 'steeringFeel',
    'manifestUrl', 'modelRef', 'shortName', 'minimumSelectorVersion',
    'dataSource', 'radar'
]);

const TARGET_LANGS = {
    ko: 'ko',
    zh: 'zh-TW',
    fr: 'fr',
    de: 'de',
    es: 'es',
};

async function translateTextGoogle(text, targetLang) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (res.status === 429) {
                await new Promise(r => setTimeout(r, attempt * 1500));
                continue;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const translated = data[0].map(s => s[0]).join('');
            if (translated && translated.trim()) return translated.trim();
        } catch {
            await new Promise(r => setTimeout(r, 500 * attempt));
        }
    }
    return `[${targetLang}] ${text}`;
}

function collectUntranslatedStrings(englishValues) {
    const missing = new Set();
    const locales = Object.keys(TARGET_LANGS);

    // 1. Check data/*.<locale>.json for any newly copied English prose where target === source
    for (const kind of ['cars', 'features', 'models', 'toggles']) {
        const source = read(`data/${kind}.json`);
        for (const locale of locales) {
            const target = read(`data/${kind}.${locale}.json`);
            function walk(from, to, location, field = '') {
                if (Array.isArray(from)) {
                    if (!Array.isArray(to)) return;
                    from.forEach((val, idx) => walk(val, to[idx], `${location}[${idx}]`, field));
                } else if (from && typeof from === 'object') {
                    if (!to || typeof to !== 'object') return;
                    for (const [k, v] of Object.entries(from)) {
                        walk(v, to[k], `${location}.${k}`, k);
                    }
                } else if (typeof from === 'string') {
                    if (CANONICAL_FIELDS.has(field) || ['name', 'dataSource', 'radar'].includes(field)) return;
                    if (/[A-Za-z]/.test(from) && from.split(/\s+/).length > 3 && from === to) {
                        missing.add(from);
                    }
                }
            }
            walk(source, target, kind);
        }
    }

    // 2. Check derived simulator evidence quotes and skill rating sources
    try {
        const probeScript = `
            import { ENGLISH_CONTENT, loadLocalizedContent } from './lib/localizedContent';
            import { deriveFeedbackPhysics } from './lib/new-sim/feedback';
            import { deriveSkillRatingsDetail } from './lib/skillRatings';
            import { translateText } from './lib/textTranslation';
            (async () => {
                const models = ENGLISH_CONTENT.models.categories.flatMap(c => c.models);
                const quotes = new Set(models.flatMap(m => deriveFeedbackPhysics(m).evidence.map(e => e.quote)).filter(q => q.split(/\\s+/).length >= 5));
                const sources = new Set(models.flatMap(m => deriveSkillRatingsDetail(m).evidence.filter(e => e.delta !== 0).map(e => e.source)));
                const contentDe = await loadLocalizedContent('de');
                const untranslated = [];
                for (const q of quotes) {
                    if (translateText(q, contentDe.messages, 'de') === q) untranslated.push(q);
                }
                for (const s of sources) {
                    if (translateText(s, contentDe.messages, 'de') === s) untranslated.push(s);
                }
                console.log(JSON.stringify([...new Set(untranslated)]));
            })();
        `;
        const out = execFileSync('npx', ['tsx', '-e', probeScript], { cwd: ROOT, encoding: 'utf8' });
        const derived = JSON.parse(out.trim());
        for (const str of derived) {
            if (typeof str === 'string' && /[A-Za-z]/.test(str) && !englishValues.has(str)) {
                missing.add(str);
            }
        }
    } catch (err) {
        console.warn('[auto-translate] Warning probing derived strings:', err.message);
    }

    return [...missing];
}

async function main() {
    const english = read('locales/en.json');
    const englishValues = new Set(Object.values(english));
    const missing = collectUntranslatedStrings(englishValues);

    if (missing.length === 0) {
        console.log('✓ All localized datasets and derived evidence strings are 100% translated.');
        return;
    }

    console.log(`🌐 Translating ${missing.length} new string(s) into ko, zh, fr, de, es...`);
    const localeData = {};
    for (const loc of Object.keys(TARGET_LANGS)) {
        localeData[loc] = read(`locales/${loc}.json`);
    }

    for (const str of missing) {
        const key = `content.${createHash('sha256').update(str).digest('hex').slice(0, 12)}`;
        english[key] = str;
        for (const [loc, langCode] of Object.entries(TARGET_LANGS)) {
            if (!localeData[loc][key]) {
                const translated = await translateTextGoogle(str, langCode);
                localeData[loc][key] = translated === str ? `[${loc.toUpperCase()}] ${str}` : translated;
            }
        }
    }

    write('locales/en.json', english);
    for (const loc of Object.keys(TARGET_LANGS)) {
        write(`locales/${loc}.json`, localeData[loc]);
    }
    console.log(`✓ Added ${missing.length} string(s) to locales/*.json.`);

    // Sync the newly translated strings into data/*.<locale>.json
    execFileSync('node', ['scripts/i18n/sync-reviewed-content.mjs'], { cwd: ROOT, stdio: 'inherit' });
}

main().catch(err => {
    console.error('[auto-translate] Fatal error:', err);
    process.exit(1);
});
