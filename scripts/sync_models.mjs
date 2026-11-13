import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';
const BASE_FILE = 'models.json';
const LOCALES = ['de', 'es', 'fr', 'ko', 'zh'];

function syncFiles() {
    const baseContent = JSON.parse(fs.readFileSync(path.join(DATA_DIR, BASE_FILE), 'utf8'));

    for (const locale of LOCALES) {
        const localeFile = `models.${locale}.json`;
        const localePath = path.join(DATA_DIR, localeFile);
        
        if (!fs.existsSync(localePath)) {
            console.log(`Creating missing file: ${localeFile}`);
            fs.writeFileSync(localePath, JSON.stringify(baseContent, null, 2), 'utf8');
            continue;
        }

        const localeContent = JSON.parse(fs.readFileSync(localePath, 'utf8'));

        // Update top-level metadata
        localeContent.totalModels = baseContent.totalModels;
        localeContent.lastUpdated = baseContent.lastUpdated;
        localeContent.version = baseContent.version;

        // Sync vibeGuide
        if (baseContent.vibeGuide) {
            if (!localeContent.vibeGuide) localeContent.vibeGuide = {};
            for (const [key, vibe] of Object.entries(baseContent.vibeGuide)) {
                if (!localeContent.vibeGuide[key]) {
                    localeContent.vibeGuide[key] = { ...vibe };
                } else {
                    // Update includes and title/subtitle if they represent structural changes
                    // but usually we want to keep translated title/subtitle/vibe.
                    // For now, only add missing keys.
                    localeContent.vibeGuide[key].includes = vibe.includes;
                }
            }
        }

        // Sync categories and models
        const syncedCategories = baseContent.categories.map(baseCat => {
            const existingCat = localeContent.categories.find(c => c.id === baseCat.id);
            
            if (!existingCat) {
                return { ...baseCat };
            }

            // Sync models within category
            const syncedModels = baseCat.models.map(baseModel => {
                const existingModel = existingCat.models.find(m => m.name === baseModel.name);
                
                if (!existingModel) {
                    return { ...baseModel };
                }

                // Hard/canonical data always tracks the base file (matches check-i18n.mjs canonical set).
                const dataFields = [
                    'date', 'badge', 'tags', 'communityScore', 'totalVotes',
                    'sentiment', 'testedOn', 'forumUrl', 'steeringFeel',
                    'manifestUrl', 'modelRef', 'shortName', 'minimumSelectorVersion',
                    'routesDriven', 'fleetRank'
                ];
                // Prose fields keep their localized translations once translated,
                // and only seed from the base file when unset.
                const localizedFields = [
                    'bestFor', 'positives', 'negatives', 'consensus', 'note'
                ];

                const updatedModel = { ...existingModel };
                for (const field of dataFields) {
                    if (baseModel[field] !== undefined) {
                        updatedModel[field] = baseModel[field];
                    }
                }
                // An absent value or an empty list carries no translation, so it
                // is safe to seed from the base file.
                const isUnset = (v) => v === undefined || (Array.isArray(v) && v.length === 0);
                for (const field of localizedFields) {
                    if (baseModel[field] !== undefined && isUnset(updatedModel[field])) {
                        updatedModel[field] = baseModel[field];
                    }
                }

                return updatedModel;
            });

            return {
                ...existingCat,
                description: existingCat.description || baseCat.description,
                models: syncedModels
            };
        });

        localeContent.categories = syncedCategories;

        const nextRaw = JSON.stringify(localeContent, null, 2) + '\n';
        const prevRaw = fs.readFileSync(localePath, 'utf8');
        if (nextRaw !== prevRaw) {
            fs.writeFileSync(localePath, nextRaw, 'utf8');
            console.log(`✓ Synchronized ${localeFile}`);
        }
    }
}

syncFiles();
