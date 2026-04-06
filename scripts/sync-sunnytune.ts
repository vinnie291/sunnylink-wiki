import fs from 'fs';
import path from 'path';

const CARS_JSON_PATH = path.join(process.cwd(), 'data/cars.json');

interface SunnyTuneConfig {
    id: string;
    shareToken: string;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    name: string;
    description: string | null;
    viewCount: number;
    cloneCount: number;
    avgRating: number | null;
    ratingCount: number;
    config?: {
        vehicle?: {
            make?: string;
            model?: string;
            year?: number;
        };
    };
}

interface Vehicle {
    id: string;
    make: string;
    model: string;
    years: string;
    sunnyTuneUrl?: string;
    [key: string]: unknown;
}

interface CarsData {
    vehicles: Vehicle[];
    [key: string]: unknown;
}

// ─── Brand inference from model names ───────────────────────────────────
// When the API reports make as "other" or blank, we can infer the real brand
// from well-known model names. This uses common automotive knowledge.
const MODEL_TO_BRAND: Record<string, string> = {
    // Tesla
    'model 3':       'tesla',
    'model y':       'tesla',
    'model s':       'tesla',
    'model x':       'tesla',
    'cybertruck':    'tesla',
    // Rivian
    'r1t':           'rivian',
    'r1s':           'rivian',
    // Lucid
    'air':           'lucid',
    'gravity':       'lucid',
    // GM / Chevrolet
    'bolt':          'chevrolet',
    'bolt ev':       'chevrolet',
    'bolt euv':      'chevrolet',
    'equinox ev':    'chevrolet',
    // Ford
    'f-150':         'ford',
    'f150':          'ford',
    'mustang mach-e':'ford',
    'mach-e':        'ford',
    'lightning':     'ford',
    'bronco':        'ford',
    // Hyundai
    'ioniq 5':       'hyundai',
    'ioniq 6':       'hyundai',
    'kona':          'hyundai',
    'tucson':        'hyundai',
    'palisade':      'hyundai',
    'elantra':       'hyundai',
    'sonata':        'hyundai',
    'santa fe':      'hyundai',
    'santa cruz':    'hyundai',
    'custin':        'hyundai',
    // Kia
    'ev6':           'kia',
    'ev9':           'kia',
    'niro':          'kia',
    'telluride':     'kia',
    'sportage':      'kia',
    'k5':            'kia',
    'sorento':       'kia',
    // Genesis
    'gv60':          'genesis',
    'gv70':          'genesis',
    'gv80':          'genesis',
    'g70':           'genesis',
    'g80':           'genesis',
    'g90':           'genesis',
    // Toyota
    'camry':         'toyota',
    'corolla':       'toyota',
    'rav4':          'toyota',
    'prius':         'toyota',
    'highlander':    'toyota',
    'sienna':        'toyota',
    'tundra':        'toyota',
    'tacoma':        'toyota',
    '4runner':       'toyota',
    // Lexus
    'rx':            'lexus',
    'rx 350':        'lexus',
    'is':            'lexus',
    'es':            'lexus',
    'nx':            'lexus',
    'rc':            'lexus',
    // Honda
    'civic':         'honda',
    'accord':        'honda',
    'cr-v':          'honda',
    'pilot':         'honda',
    'odyssey':       'honda',
    'ridgeline':     'honda',
    'hr-v':          'honda',
    // Subaru
    'outback':       'subaru',
    'forester':      'subaru',
    'crosstrek':     'subaru',
    'ascent':        'subaru',
    'wrx':           'subaru',
    'impreza':       'subaru',
    // Mazda
    'cx-5':          'mazda',
    'cx-50':         'mazda',
    'mazda3':        'mazda',
    'mazda6':        'mazda',
    // Chrysler / Stellantis
    'pacifica':      'chrysler',
    // RAM
    '1500':          'ram',
    // Lincoln
    'navigator':     'lincoln',
    'corsair':       'lincoln',
    'aviator':       'lincoln',
    // Volvo
    'xc90':          'volvo',
    'xc60':          'volvo',
    'xc40':          'volvo',
    's60':           'volvo',
    // Audi
    'a3':            'audi',
    'a4':            'audi',
    'q5':            'audi',
    'e-tron':        'audi',
    // BYD
    'frigate':       'byd',
    'seal':          'byd',
    'atto 3':        'byd',
    'dolphin':       'byd',
    'han':           'byd',
};

// ─── Brand aliases ──────────────────────────────────────────────────────
// Maps alternate spellings or groupings to canonical brand names
const BRAND_ALIASES: Record<string, string[]> = {
    'chevrolet': ['chevy', 'gm', 'general motors'],
    'ram':       ['dodge'],
    'genesis':   ['hyundai'],  // Genesis is Hyundai's luxury arm
    'lexus':     ['toyota'],   // Lexus is Toyota's luxury arm
    'kia':       ['hyundai'],  // Kia and Hyundai share HKG platforms; API often mislabels
};

/**
 * Normalize a string for fuzzy matching:
 * lowercase, strip non-alphanumeric (keep spaces), collapse whitespace
 */
function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Strip parenthetical specs from a model name
 * e.g. "Ioniq 5 (with HDA II)" -> "Ioniq 5"
 */
function stripParens(s: string): string {
    return s.replace(/\s*\(.*?\)/g, '').trim();
}

/**
 * Infer the real brand from a model name string when make is "other" or missing.
 * Uses MODEL_TO_BRAND lookup with progressive substring matching.
 */
function inferBrandFromModel(modelStr: string): string | null {
    const cleaned = normalize(stripParens(modelStr));

    // 1. Try exact match on cleaned model
    if (MODEL_TO_BRAND[cleaned]) return MODEL_TO_BRAND[cleaned];

    // 2. Try matching each known model name as a substring of the API model
    //    Sort by longest key first to prefer "model 3 awd" matching "model 3" over "3"
    const sortedKeys = Object.keys(MODEL_TO_BRAND).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        if (cleaned.includes(key) || key.includes(cleaned)) {
            return MODEL_TO_BRAND[key];
        }
    }

    // 3. Try word-by-word: e.g. "Model 3 AWD" → first two words "model 3"
    const words = cleaned.split(' ');
    for (let len = words.length; len >= 1; len--) {
        const partial = words.slice(0, len).join(' ');
        if (MODEL_TO_BRAND[partial]) return MODEL_TO_BRAND[partial];
    }

    return null;
}

/**
 * Check if two brand names refer to the same or related manufacturer.
 */
function brandsMatch(apiBrand: string, ourBrand: string): boolean {
    const a = normalize(apiBrand);
    const b = normalize(ourBrand);

    if (a === b) return true;

    // Check aliases in both directions
    for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
        const group = [canonical, ...aliases];
        if (group.includes(a) && group.includes(b)) return true;
    }

    return false;
}

/**
 * Check if a year falls within the vehicle's year range string
 */
function yearInRange(year: number, yearsStr: string): boolean {
    if (isNaN(year)) return false;
    const parts = yearsStr.split('-').map(y => parseInt(y.trim()));
    const startYear = parts[0];
    const endYear = parts.length > 1 ? parts[1] : startYear;
    return !isNaN(startYear) && !isNaN(endYear) && year >= startYear && year <= endYear;
}

/**
 * Check if two model strings are a fuzzy match.
 * Handles parenthetical specs, slash-separated models, and substring containment.
 */
function modelsMatch(apiModel: string, ourModel: string): boolean {
    const normApi = normalize(apiModel);
    const normOur = normalize(ourModel);

    // Direct match
    if (normApi === normOur) return true;

    // Strip parenthetical specs
    const strippedApi = normalize(stripParens(apiModel));
    const strippedOur = normalize(stripParens(ourModel));
    if (strippedApi === strippedOur) return true;

    // Handle slash-separated models in our DB (e.g. "Model 3 / Y")
    // Check if the API model matches ANY of the slash-separated parts
    const ourParts = ourModel.split('/').map(p => normalize(p.trim()));
    for (const part of ourParts) {
        if (!part) continue;
        if (strippedApi === part) return true;
        if (strippedApi.includes(part) || part.includes(strippedApi)) return true;

        // Also strip parens from each part
        const strippedPart = normalize(stripParens(part));
        if (strippedApi === strippedPart) return true;
        if (strippedApi.includes(strippedPart) || strippedPart.includes(strippedApi)) return true;
    }

    // Substring containment on alphanumeric-only versions
    const alphaApi = strippedApi.replace(/\s/g, '');
    const alphaOur = strippedOur.replace(/\s/g, '');
    if (alphaApi && alphaOur && (alphaApi.includes(alphaOur) || alphaOur.includes(alphaApi))) return true;

    return false;
}

/**
 * Score a config match — higher is better.
 * Prioritizes: view count, ratings, clone count.
 */
function scoreConfig(config: SunnyTuneConfig): number {
    let score = 0;
    score += (config.viewCount || 0) * 1;
    score += (config.cloneCount || 0) * 10;
    score += (config.avgRating || 0) * 20;
    score += (config.ratingCount || 0) * 5;
    return score;
}

/**
 * Resolve the effective brand for an API config.
 * Falls back to model-name inference when brand is "other" or missing.
 */
function resolveApiBrand(config: SunnyTuneConfig): string {
    const rawMake = config.vehicleMake || config.config?.vehicle?.make || '';
    const rawModel = config.vehicleModel || config.config?.vehicle?.model || '';

    // If brand is a real brand (not "other" / empty), use it directly
    if (rawMake && rawMake.toLowerCase() !== 'other') {
        return rawMake.toLowerCase();
    }

    // Try to infer from model name
    if (rawModel) {
        const inferred = inferBrandFromModel(rawModel);
        if (inferred) {
            console.log(`  ℹ️  Inferred brand "${inferred}" from model "${rawModel}" (API reported: "${rawMake}")`);
            return inferred;
        }
    }

    // Try to infer from config name as last resort
    if (config.name) {
        const inferred = inferBrandFromModel(config.name);
        if (inferred) {
            console.log(`  ℹ️  Inferred brand "${inferred}" from config name "${config.name}" (API reported: "${rawMake}")`);
            return inferred;
        }
    }

    return rawMake.toLowerCase();
}

async function fetchAllConfigs(): Promise<SunnyTuneConfig[]> {
    const allConfigs: SunnyTuneConfig[] = [];
    let page = 1;
    const limit = 50;

    while (true) {
        const url = `https://sunny-tune.vercel.app/api/explore?sort=trending&page=${page}&limit=${limit}`;
        console.log(`Fetching page ${page}...`);
        const response = await fetch(url);

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Failed to fetch page ${page}: ${response.status} ${response.statusText} - ${body}`);
        }

        const data = await response.json();
        const configs: SunnyTuneConfig[] = data.configs || [];
        allConfigs.push(...configs);

        if (configs.length < limit || allConfigs.length >= (data.total || 0)) {
            break;
        }
        page++;
    }

    return allConfigs;
}

async function syncSunnyTune() {
    console.log('Fetching shared configs from SunnyTune...\n');
    try {
        const configs = await fetchAllConfigs();
        console.log(`Found ${configs.length} total configs on SunnyTune.\n`);

        const carsData: CarsData = JSON.parse(fs.readFileSync(CARS_JSON_PATH, 'utf-8'));
        let updatedCount = 0;

        // Pre-resolve brands for all configs (so we log inference only once)
        const resolvedBrands = new Map<string, string>();
        for (const c of configs) {
            if (!resolvedBrands.has(c.id)) {
                resolvedBrands.set(c.id, resolveApiBrand(c));
            }
        }
        console.log('');

        for (const vehicle of carsData.vehicles) {
            // Find all matching configs for this vehicle
            const matches = configs.filter(c => {
                const apiModel = c.vehicleModel || c.config?.vehicle?.model || '';
                const apiYear = c.vehicleYear ?? c.config?.vehicle?.year ?? NaN;

                // Skip configs with no model info at all
                if (!apiModel) return false;

                // Use pre-resolved brand
                const resolvedBrand = resolvedBrands.get(c.id) || '';

                // Brand comparison (with alias support)
                if (!brandsMatch(resolvedBrand, vehicle.make)) return false;

                // Model comparison (fuzzy)
                if (!modelsMatch(apiModel, vehicle.model)) return false;

                // Year comparison — match if in range, or skip year check if missing
                const year = typeof apiYear === 'number' ? apiYear : parseInt(String(apiYear));
                const yearMatch = isNaN(year) || yearInRange(year, vehicle.years);

                return yearMatch;
            });

            if (matches.length === 0) continue;

            // Pick the best match by score
            const bestMatch = matches.sort((a, b) => scoreConfig(b) - scoreConfig(a))[0];
            const newUrl = `https://sunny-tune.vercel.app/shared/${bestMatch.shareToken}`;

            if (vehicle.sunnyTuneUrl !== newUrl) {
                console.log(`✅ ${vehicle.make} ${vehicle.model} (${vehicle.years})`);
                console.log(`   Old: ${vehicle.sunnyTuneUrl || '(none)'}`);
                console.log(`   New: ${newUrl}`);
                console.log(`   From: "${bestMatch.name}" (${bestMatch.viewCount} views, rating: ${bestMatch.avgRating ?? 'n/a'})\n`);
                vehicle.sunnyTuneUrl = newUrl;
                updatedCount++;
            } else {
                console.log(`— ${vehicle.make} ${vehicle.model}: already up-to-date`);
            }
        }

        if (updatedCount > 0) {
            fs.writeFileSync(CARS_JSON_PATH, JSON.stringify(carsData, null, 4) + '\n');
            console.log(`\n🎉 Updated ${updatedCount} vehicles with SunnyTune links.`);
        } else {
            console.log('\n✓ No new updates needed.');
        }

    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

syncSunnyTune();
