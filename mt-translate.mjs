import fs from 'fs';
import path from 'path';
import { translate } from 'google-translate-api-x';
import pLimit from 'p-limit';

const DATA_DIR = '/Users/vinhle/Documents/dev/sunnylink-wiki/data';
const limit = pLimit(10); // Throttle concurrent translation requests

// Mapping internal locale codes to Google Translate codes
const LOCALE_MAP = {
    ko: 'ko',
    zh: 'zh-CN',
    fr: 'fr',
    de: 'de',
    es: 'es'
};

const SETTING_TRANSLATABLE_FIELDS = [
    'label', 'description', 'useCase', 'userNote', 'warning', 'helpText', 'deepDive'
];

const MODEL_TRANSLATABLE_FIELDS = [
    'consensus', 'note'
];

// Helper to translate text safely
async function autoTranslate(text, toLocale) {
    if (!text || typeof text !== 'string') return text;

    // Skip short values that might already be translated by our previous script
    // if they match our shortLabels. But since we want to be safe, just translate it.
    try {
        const res = await limit(() => translate(text, { to: LOCALE_MAP[toLocale] }));
        return res.text;
    } catch (err) {
        console.warn(`Translation failed for "${text}":`, err.message);
        return text;
    }
}

async function deepTranslateToggles(data, locale) {
    const result = JSON.parse(JSON.stringify(data));

    for (const cat of result.categories) {
        // Translate category description specifically (name is usually short enough logic handles it)
        cat.description = await autoTranslate(cat.description, locale);

        // Provide full sentence translations for all toggles
        for (const setting of cat.settings) {
            for (const field of SETTING_TRANSLATABLE_FIELDS) {
                if (setting[field] && typeof setting[field] === 'string') {
                    // If we see it's basically English text (contains a to z), translate it again
                    if (/[a-zA-Z]{4,}/.test(setting[field])) {
                        setting[field] = await autoTranslate(setting[field], locale);
                    }
                }
            }
            if (Array.isArray(setting.tradeoffs)) {
                setting.tradeoffs = await Promise.all(
                    setting.tradeoffs.map(async t => /[a-zA-Z]{4,}/.test(t) ? await autoTranslate(t, locale) : t)
                );
            }
        }
    }

    return result;
}

async function deepTranslateModels(data, locale) {
    const result = JSON.parse(JSON.stringify(data));

    if (result.vibeGuide) {
        for (const [key, guide] of Object.entries(result.vibeGuide)) {
            if (/[a-zA-Z]{4,}/.test(guide.vibe)) guide.vibe = await autoTranslate(guide.vibe, locale);
            if (/[a-zA-Z]{4,}/.test(guide.recommendation)) guide.recommendation = await autoTranslate(guide.recommendation, locale);
        }
    }

    for (const cat of result.categories) {
        if (/[a-zA-Z]{4,}/.test(cat.description)) {
            cat.description = await autoTranslate(cat.description, locale);
        }

        for (const model of cat.models) {
            for (const field of MODEL_TRANSLATABLE_FIELDS) {
                if (model[field] && typeof model[field] === 'string' && /[a-zA-Z]{4,}/.test(model[field])) {
                    model[field] = await autoTranslate(model[field], locale);
                }
            }
        }
    }

    return result;
}

async function deepTranslateFeatures(data, locale) {
    const result = JSON.parse(JSON.stringify(data));

    for (const feature of result.features) {
        if (/[a-zA-Z]{4,}/.test(feature.officialDefinition)) feature.officialDefinition = await autoTranslate(feature.officialDefinition, locale);
        if (/[a-zA-Z]{4,}/.test(feature.userSummary)) feature.userSummary = await autoTranslate(feature.userSummary, locale);
        if (/[a-zA-Z]{4,}/.test(feature.userTranslation)) feature.userTranslation = await autoTranslate(feature.userTranslation, locale);
    }

    if (result.glossary) {
        for (const [term, def] of Object.entries(result.glossary)) {
            if (/[a-zA-Z]{4,}/.test(def)) {
                result.glossary[term] = await autoTranslate(def, locale);
            }
        }
    }

    return result;
}

async function main() {
    const locales = Object.keys(LOCALE_MAP);

    // We use the original English versions as base to ensure no chained translation errors
    const originalToggles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'toggles.json'), 'utf8'));
    const originalModels = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'models.json'), 'utf8'));
    const originalFeatures = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'features.json'), 'utf8'));

    for (const locale of locales) {
        console.log(`\nStarting Google Translate pass for ${locale}...`);

        // Merge existing short labels via require
        const existingToggles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `toggles.${locale}.json`), 'utf8'));
        const existingModels = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `models.${locale}.json`), 'utf8'));
        const existingFeatures = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `features.${locale}.json`), 'utf8'));

        // Toggles
        console.log(` Translating toggles for ${locale}...`);
        const tToggles = await deepTranslateToggles(existingToggles, locale);
        fs.writeFileSync(path.join(DATA_DIR, `toggles.${locale}.json`), JSON.stringify(tToggles, null, 2), 'utf8');

        // Models
        console.log(` Translating models for ${locale}...`);
        const tModels = await deepTranslateModels(existingModels, locale);
        fs.writeFileSync(path.join(DATA_DIR, `models.${locale}.json`), JSON.stringify(tModels, null, 2), 'utf8');

        // Features
        console.log(` Translating features for ${locale}...`);
        const tFeatures = await deepTranslateFeatures(existingFeatures, locale);
        fs.writeFileSync(path.join(DATA_DIR, `features.${locale}.json`), JSON.stringify(tFeatures, null, 2), 'utf8');

        console.log(`✓ Completed full machine translation for ${locale}`);
    }
}

main().catch(console.error);
