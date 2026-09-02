import fleetStatsData from '../data/fleet_model_stats.json';

export interface FleetModelStat {
    rawName?: string;
    displayName?: string;
    cleanName: string;
    routes: number;
    rank: number;
    slug: string;
}

export interface FleetStatsInfo {
    lastUpdated: string;
    stockRoutes: number;
    totalCustomRoutes: number;
    models: FleetModelStat[];
}

export const FLEET_STATS: FleetStatsInfo = {
    lastUpdated: fleetStatsData.lastUpdated,
    stockRoutes: fleetStatsData.stockRoutes,
    totalCustomRoutes: fleetStatsData.totalCustomRoutes,
    models: fleetStatsData.models as FleetModelStat[],
};

// Normalize names for fuzzy matching
function normalize(str: string): string {
    return str
        .toLowerCase()
        .replace(/\s*\([A-Za-z]+ \d{1,2},? \d{4}\)/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

const lookupMap = new Map<string, FleetModelStat>();

FLEET_STATS.models.forEach(model => {
    lookupMap.set(normalize(model.cleanName), model);
    if (model.displayName) lookupMap.set(normalize(model.displayName), model);
    if (model.rawName) lookupMap.set(normalize(model.rawName), model);
    lookupMap.set(normalize(model.slug), model);
});

// Custom alias definitions
const aliases: Record<string, string> = {
    'dtrv6': 'down to ride v6',
    'dtr v6': 'down to ride v6',
    'wmiv12': 'wmi v12',
    'pop model': 'pop model v2',
    'pop model (v1)': 'pop model',
    'pop model v1': 'pop model',
    'cd210': 'cd210 model',
    'dark souls v2': 'dark souls model v2',
    'opm10v3': 'op model 10 v3',
    'op model 10': 'op model 10 v3',
    'kumar\'s vibe': 'kumars vibe',
    'kumars vibe': 'kumars vibe',
    'tcpmv3': 'the cool peoples model v3',
    'tcp v3': 'the cool peoples model v3',
    'off-policy model v5 (angle)': 'off-policy model v5',
    'off policy v3': 'op model 10 v3',
};

Object.entries(aliases).forEach(([alias, target]) => {
    const targetStat = lookupMap.get(normalize(target));
    if (targetStat) {
        lookupMap.set(normalize(alias), targetStat);
    }
});

/**
 * Looks up the fleet route stats for any model name or slug.
 */
export function getModelFleetStat(modelName?: string | null): FleetModelStat | undefined {
    if (!modelName) return undefined;
    const key = normalize(modelName);
    return lookupMap.get(key);
}

/**
 * Returns formatted routes count (e.g. "7.9k" or "8,357").
 */
export function formatRouteCount(count: number, compact = false): string {
    if (compact) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
        }
        return count.toLocaleString();
    }
    return count.toLocaleString();
}

/**
 * Returns top N driven custom models across the fleet.
 */
export function getTopDrivenModels(limit = 10): FleetModelStat[] {
    return FLEET_STATS.models.slice(0, limit);
}

// Brand Fleet Telemetry (Sunnylink Dongle IDs by Brand & Branch)
import fleetBrandData from '../data/fleet_brand_branch_stats.json';

export interface BrandFleetStat {
    brand: string;
    totalDevices: number;
    branches: Record<string, number>;
    rank: number;
    sharePercent: number;
}

export interface FleetBrandInfo {
    lastUpdated: string;
    totalDevices: number;
    brands: BrandFleetStat[];
    branchTotals: Record<string, number>;
    makeToBrand: Record<string, string>;
}

export const FLEET_BRAND_STATS: FleetBrandInfo = {
    lastUpdated: fleetBrandData.lastUpdated,
    totalDevices: fleetBrandData.totalDevices,
    brands: fleetBrandData.brands as BrandFleetStat[],
    branchTotals: fleetBrandData.branchTotals as Record<string, number>,
    makeToBrand: fleetBrandData.makeToBrand as Record<string, string>,
};

const brandLookup = new Map<string, BrandFleetStat>();
FLEET_BRAND_STATS.brands.forEach(b => {
    brandLookup.set(b.brand.toLowerCase(), b);
});

/**
 * Returns brand fleet statistics for a given car make (e.g. "Toyota", "Lexus", "Hyundai", "Kia", "Genesis", "Ford", etc.).
 */
export function getBrandFleetStat(make?: string | null): BrandFleetStat | undefined {
    if (!make) return undefined;
    const cleanMake = make.toLowerCase().trim();
    const mappedBrand = FLEET_BRAND_STATS.makeToBrand[cleanMake] || cleanMake;
    return brandLookup.get(mappedBrand);
}

/**
 * Formats a device count (e.g. 1648 -> "1.6k" or "1,648").
 */
export function formatDeviceCount(count: number, compact = false): string {
    if (compact) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
        }
        return count.toLocaleString();
    }
    return count.toLocaleString();
}

