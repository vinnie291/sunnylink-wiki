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

/**
 * Normalize a string for fuzzy matching:
 * lowercase, strip non-alphanumeric, collapse whitespace
 */
function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Extract the base model name by stripping parenthetical specs
 * e.g. "Ioniq 5 (with HDA II)" -> "Ioniq 5"
 */
function stripParens(s: string): string {
    return s.replace(/\s*\(.*?\)/g, '').trim();
}

/**
 * Check if a year falls within the vehicle's year range
 */
function yearInRange(year: number, yearsStr: string): boolean {
    if (isNaN(year)) return false;
    const parts = yearsStr.split('-').map(y => parseInt(y.trim()));
    const startYear = parts[0];
    const endYear = parts.length > 1 ? parts[1] : startYear;
    return !isNaN(startYear) && !isNaN(endYear) && year >= startYear && year <= endYear;
}

/**
 * Check if two model strings are a fuzzy match
 */
function modelsMatch(apiModel: string, ourModel: string): boolean {
    // Try exact normalized match first
    const normApi = normalize(apiModel);
    const normOur = normalize(ourModel);
    if (normApi === normOur) return true;

    // Strip parenthetical specs and try again
    const strippedApi = normalize(stripParens(apiModel));
    const strippedOur = normalize(stripParens(ourModel));
    if (strippedApi === strippedOur) return true;

    // Check substring containment (either direction)
    const alphaApi = normApi.replace(/\s/g, '');
    const alphaOur = normOur.replace(/\s/g, '');
    if (alphaApi && alphaOur && (alphaApi.includes(alphaOur) || alphaOur.includes(alphaApi))) return true;

    // Also try with stripped versions
    const alphaStrippedApi = strippedApi.replace(/\s/g, '');
    if (alphaStrippedApi && alphaOur && (alphaStrippedApi.includes(alphaOur) || alphaOur.includes(alphaStrippedApi))) return true;

    return false;
}

/**
 * Score a config match - higher is better
 * Prioritizes: view count, rating, clone count
 */
function scoreConfig(config: SunnyTuneConfig): number {
    let score = 0;
    score += (config.viewCount || 0) * 1;
    score += (config.cloneCount || 0) * 10;
    score += (config.avgRating || 0) * 20;
    score += (config.ratingCount || 0) * 5;
    return score;
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

        // If we got fewer than the limit, we've reached the end
        if (configs.length < limit || allConfigs.length >= (data.total || 0)) {
            break;
        }
        page++;
    }

    return allConfigs;
}

async function syncSunnyTune() {
    console.log('Fetching shared configs from SunnyTune...');
    try {
        const configs = await fetchAllConfigs();
        console.log(`Found ${configs.length} total configs on SunnyTune.`);

        const carsData: CarsData = JSON.parse(fs.readFileSync(CARS_JSON_PATH, 'utf-8'));
        let updatedCount = 0;

        for (const vehicle of carsData.vehicles) {
            // Find all matching configs for this vehicle
            const matches = configs.filter(c => {
                // Get make from top-level or nested config.vehicle
                const apiMake = c.vehicleMake || c.config?.vehicle?.make || '';
                const apiModel = c.vehicleModel || c.config?.vehicle?.model || '';
                const apiYear = c.vehicleYear ?? c.config?.vehicle?.year ?? NaN;

                // Skip configs with missing critical data
                if (!apiMake || !apiModel) return false;

                // Make comparison (case-insensitive)
                const makeMatch = apiMake.toLowerCase() === vehicle.make.toLowerCase();
                if (!makeMatch) return false;

                // Model comparison (fuzzy)
                if (!modelsMatch(apiModel, vehicle.model)) return false;

                // Year comparison - match if year is within vehicle's range, or if no year specified
                const year = typeof apiYear === 'number' ? apiYear : parseInt(String(apiYear));
                const yearMatch = isNaN(year) || yearInRange(year, vehicle.years);

                return yearMatch;
            });

            if (matches.length === 0) continue;

            // Pick the best match by score
            const bestMatch = matches.sort((a, b) => scoreConfig(b) - scoreConfig(a))[0];
            const newUrl = `https://sunny-tune.vercel.app/shared/${bestMatch.shareToken}`;

            if (vehicle.sunnyTuneUrl !== newUrl) {
                console.log(`  ${vehicle.make} ${vehicle.model} (${vehicle.years}): ${vehicle.sunnyTuneUrl || 'none'} -> ${newUrl}`);
                vehicle.sunnyTuneUrl = newUrl;
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            fs.writeFileSync(CARS_JSON_PATH, JSON.stringify(carsData, null, 4) + '\n');
            console.log(`\nUpdated ${updatedCount} vehicles with SunnyTune links.`);
        } else {
            console.log('\nNo new updates found.');
        }

    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

syncSunnyTune();
