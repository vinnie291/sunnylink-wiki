#!/usr/bin/env node
/**
 * Automatically detects any newly added, untranslated English prose strings in
 * data/*.<locale>.json (where target === source) or missing derived simulator/rating
 * evidence strings, translates ONLY those missing strings into ko, zh, fr, de, es,
 * and synchronizes data/*.<locale>.json.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';

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
    'dataSource'
]);

const TARGET_LANGS = {
    ko: 'ko',
    zh: 'zh-TW',
    fr: 'fr',
    de: 'de',
    es: 'es',
};

const PROPER_NAMES = new Set([
    'Sunnylink', 'Sunnylink Wiki', 'Comma 3 / 3X', 'Comma 4', 'sunnypilot',
    'openpilot', 'comma.ai', 'GitHub', 'modelV2', 'rlog', 'qlog', 'JSON',
    'SVG', 'WebGL 2', 'Esc', 'Hz', 'RMS', 'cm', 'km', 'mph', 'km/h', 'm/s²', 'm/s³'
]);

// Core openpilot/sunnypilot glossary terms & interpolation placeholders that must NEVER be mangled
const PROTECTED_TOKEN_REGEX = /(\{\{[^}]+\}\}|(?<!\{)\{[A-Za-z0-9_]+\}(?!\})|sunnypilot-config\.json|sunnylink\.ai|commaai\/openpilot|Sunnylink Wiki|Sunnylink|sunnypilot|Sunnypilot|openpilot|comma\.ai|Comma 3X|comma 3X|comma four|Comma 4|comma 4|\b(?:MADS|NNLC|ALCA|E2E|SCC-V|HDA2|TSFDOM|CD210|BMRLNAP|TCPmV3|DEC|SLA|Chestnut)\b)/g;

function maskProtectedTokens(text) {
    const tokens = [];
    const masked = text.replace(PROTECTED_TOKEN_REGEX, (match) => {
        const idx = tokens.length;
        tokens.push(match);
        return `⟦T${idx}⟧`;
    });
    return { masked, tokens };
}

function unmaskProtectedTokens(translated, tokens) {
    if (!tokens.length) return translated;
    let out = translated.replace(/[⟦[\u3014(【]\s*[tT]\s*(\d+)\s*[⟧\]\u3015)】]/g, (full, numStr) => {
        const idx = Number(numStr);
        return idx >= 0 && idx < tokens.length ? tokens[idx] : full;
    });
    // Also catch bare T0 if brackets were stripped by MT
    tokens.forEach((tok, idx) => {
        if (!out.includes(tok)) {
            out = out.replace(new RegExp(`\\bT${idx}\\b`, 'g'), tok);
        }
    });
    return out;
}

function placeholdersMatch(src, dst) {
    const extract = (s) => [
        ...[...s.matchAll(/\{\{([^}]+)\}\}/g)].map(m => `{{${m[1].trim()}}}`),
        ...[...s.matchAll(/(?<!\{)\{([A-Za-z0-9_]+)\}(?!\})/g)].map(m => `{${m[1]}}`),
    ].sort().join(',');
    return extract(src) === extract(dst);
}

async function rawGoogleTranslate(queryText, targetLang) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(queryText)}`;
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
    return null;
}

async function translateTextGoogle(text, targetLang) {
    const { masked, tokens } = maskProtectedTokens(text);
    const maskedResult = await rawGoogleTranslate(masked, targetLang);
    if (maskedResult) {
        const restored = unmaskProtectedTokens(maskedResult, tokens);
        if (!/[⟦⟧]/.test(restored) && placeholdersMatch(text, restored)) {
            return restored;
        }
    }
    // Fallback if MT altered sentinel brackets: translate unmasked only when there are no placeholders
    if (!/\{/.test(text)) {
        const plain = await rawGoogleTranslate(text, targetLang);
        if (plain && placeholdersMatch(text, plain)) return plain;
    }
    return `[${targetLang}] ${text}`;
}

function collectSourceDisplayStrings(englishValues) {
    const properNames = new Set(PROPER_NAMES);
    for (const category of read('data/models.json').categories) {
        for (const model of category.models) properNames.add(model.name);
    }
    for (const car of read('data/cars.json').vehicles) {
        properNames.add(car.make);
        properNames.add(car.model);
    }

    const found = new Set();
    function scanDir(relDir) {
        const absDir = path.join(ROOT, relDir);
        for (const name of readdirSync(absDir)) {
            if (name.includes(' (1)')) continue;
            if (/^(?:opengraph-image|twitter-image|icon|apple-icon)\.[jt]sx?$/.test(name)) continue;
            const relFile = path.join(relDir, name);
            const absFile = path.join(ROOT, relFile);
            if (!path.extname(name)) {
                scanDir(relFile);
                continue;
            }
            if (!/\.tsx?$/.test(name)) continue;
            const source = ts.createSourceFile(relFile, readFileSync(absFile, 'utf8'), ts.ScriptTarget.Latest, true);
            function checkDisplay(expression) {
                let value;
                if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
                    value = expression.text;
                } else if (ts.isTemplateExpression(expression)) {
                    value = expression.head.text;
                    expression.templateSpans.forEach((span, index) => {
                        value += `{{value${index}}}` + span.literal.text;
                    });
                } else if (ts.isConditionalExpression(expression)) {
                    checkDisplay(expression.whenTrue);
                    checkDisplay(expression.whenFalse);
                }
                if (
                    value &&
                    /[A-Za-z]{2}/.test(value.replace(/\{\{[^}]+\}\}/g, '')) &&
                    !properNames.has(value) &&
                    !englishValues.has(value)
                ) {
                    found.add(value);
                }
            }
            function visit(node) {
                if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tx' && node.arguments[0]) {
                    checkDisplay(node.arguments[0]);
                }
                if (ts.isJsxAttribute(node) && node.name.getText(source) === 'text' && node.initializer) {
                    if (ts.isStringLiteral(node.initializer)) checkDisplay(node.initializer);
                    else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) checkDisplay(node.initializer.expression);
                }
                ts.forEachChild(node, visit);
            }
            visit(source);
        }
    }
    scanDir('app');
    scanDir('components');
    return found;
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

    // 2. Check TSX <TranslatedText text={...} /> and tx(...) display strings in app/ and components/
    for (const displayStr of collectSourceDisplayStrings(englishValues)) {
        missing.add(displayStr);
    }

    // 3. Check derived simulator evidence quotes and skill rating sources
    try {
        const probeScript = `
            import { ENGLISH_CONTENT, loadLocalizedContent } from './lib/localizedContent';
            import { deriveFeedbackPhysics } from './lib/new-sim/feedback';
            import { ALL_MODEL_PROFILES } from './lib/new-sim/modelProfiles';
            import { deriveSkillRatingsDetail } from './lib/skillRatings';
            import { translateText } from './lib/textTranslation';
            (async () => {
                const models = ENGLISH_CONTENT.models.categories.flatMap(c => c.models);
                const quotes = new Set(models.flatMap(m => deriveFeedbackPhysics(m).evidence.map(e => e.quote)).filter(q => q.split(/\\s+/).length >= 5));
                const sources = new Set([
                    ...models.flatMap(m => deriveSkillRatingsDetail(m).evidence.filter(e => e.delta !== 0).map(e => e.source)),
                    ...ALL_MODEL_PROFILES.flatMap(p => [p.provenance.label, p.provenance.summary]),
                    'Straight ahead', 'Sweeping left', 'Sweeping right', 'Sharp left turn', 'Sharp right turn',
                    'Approaching stop', 'Yielding for pedestrian', 'Yielding for crosswalk pedestrian',
                ]);
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
        // Always ensure reviewed glossary rules and localized datasets stay synchronized
        execFileSync('node', ['scripts/i18n/sync-reviewed-content.mjs'], { cwd: ROOT, stdio: 'inherit' });
        console.log('✓ All localized datasets and derived evidence strings are 100% translated.');
        return;
    }

    console.log(`🌐 Translating ${missing.length} new string(s) into ko, zh, fr, de, es...`);
    const localeData = {};
    for (const loc of Object.keys(TARGET_LANGS)) {
        localeData[loc] = read(`locales/${loc}.json`);
    }

    for (const str of missing) {
        const existingKey = Object.entries(english).find(([, v]) => v === str)?.[0];
        const key = existingKey || `content.${createHash('sha256').update(str).digest('hex').slice(0, 12)}`;
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

    // Sync the newly translated strings into data/*.<locale>.json and enforce glossary
    execFileSync('node', ['scripts/i18n/sync-reviewed-content.mjs'], { cwd: ROOT, stdio: 'inherit' });
}

main().catch(err => {
    console.error('[auto-translate] Fatal error:', err);
    process.exit(1);
});

export { maskProtectedTokens, unmaskProtectedTokens, placeholdersMatch };
