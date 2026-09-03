/**
 * Maps Discourse topic content to local data schemas.
 * Performs case-insensitive title matching between Discourse topics
 * and local toggles/features data.
 */

// ─── Types ───────────────────────────────────────────────────

export interface DiscourseDescriptions {
    /** Map of normalized title → cooked HTML for toggle settings */
    settings: Map<string, string>;
    /** Map of normalized title → cooked HTML for feature entries */
    features: Map<string, string>;
    /** Map of normalized category name → cooked HTML for category-level enrichment */
    categories: Map<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────

function normalize(s: string): string {
    return s.toLowerCase().trim();
}

/**
 * Known mappings from Discourse topic titles to local category names.
 * This handles cases where the Discourse title doesn't exactly match
 * the local category name (e.g., "Toggles Settings" → "Toggles").
 */
const CATEGORY_TITLE_MAP: Record<string, string> = {
    'toggles settings': 'toggles',
    'models settings': 'model settings',
    'device settings': 'device settings',
    'software settings': 'software settings',
    'display settings': 'display settings',
    'visuals settings': 'visuals settings',
    'developer settings': 'developer settings',
    'mads settings': 'mads settings',
    'lane change settings': 'lane change settings',
    'torque settings': 'torque settings',
    'speed limit source': 'speed limit source',
    'osm settings': 'osm settings',
    'tesla settings': 'tesla settings',
    'trips settings': 'trips settings',
    'firehose settings': 'firehose settings',
    'sunnylink settings': 'sunnylink settings',
    'network settings': 'network settings',
    'platform differences': 'platform differences',
};

/**
 * Known mappings from Discourse topic titles to local setting labels.
 * These are individual settings within categories.
 */
const SETTING_TITLE_MAP: Record<string, string> = {
    'blinker pause lateral control': 'blinker pause lateral control',
    'torque control': 'enforce torque control',
    'alpha longitudinal': 'sunnypilot longitudinal control (alpha)',
    'quiet mode feature': 'quiet mode',
    'speed limit assist': 'speed limit assist mode',
    'speed limit source': 'speed limit source',
    'intelligent cruise button management': 'intelligent cruise button management',
    'dynamic experimental control': 'dynamic experimental control',
    'auto lane change': 'auto lane change by blinker',
    'neural network lateral control': 'neural network lateral control',
    'enable sunnylink': 'enable sunnylink',
};

/**
 * Known mappings from Discourse topic titles to local feature names/fullNames.
 */
const FEATURE_TITLE_MAP: Record<string, string> = {
    'modular assistive driving system': 'm.a.d.s.',
    'mads': 'm.a.d.s.',
    'mads settings': 'm.a.d.s.',
    'neural network lateral control': 'nnlc',
    'nnlc': 'nnlc',
    'dynamic experimental control': 'dec',
    'intelligent cruise button management': 'icbm',
    'smart cruise control - vision': 'scc-v',
    'smart cruise control vision': 'scc-v',
    'smart cruise control - map': 'scc-m',
    'smart cruise control map': 'scc-m',
    'speed limit assist': 'sla',
    'auto lane change': 'alc',
    'hyundai longitudinal tuning': 'hkg tuning',
    'custom acc increments': 'custom acc',
    'blinker pause lateral control': 'blinker pause',
    'torque control': 'torque control',
    'torque settings': 'torque control',
    'quiet mode feature': 'quiet mode',
    'quiet mode': 'quiet mode',
    'alpha longitudinal': 'alpha longitudinal',
    'osm maps': 'osm maps',
    'osm settings': 'osm maps',
    'sunnylink': 'sunnylink',
    'sunnylink settings': 'sunnylink',
    'sunnylink connected services': 'sunnylink',
    'hud & visuals': 'hud visuals',
    'hud visuals': 'hud visuals',
    'models & ai': 'models & ai',
    'models settings': 'models & ai',
};

// ─── Main mapper ─────────────────────────────────────────────

/**
 * Takes raw Discourse content map (title → HTML) and produces
 * structured lookup maps for settings, features, and categories.
 */
export function mapDiscourseContent(
    contentMap: Map<string, string>
): DiscourseDescriptions {
    const settings = new Map<string, string>();
    const features = new Map<string, string>();
    const categories = new Map<string, string>();

    for (const [rawTitle, html] of contentMap.entries()) {
        const normalizedTitle = normalize(rawTitle);

        // 1. Check if it maps to a category
        const categoryKey = CATEGORY_TITLE_MAP[normalizedTitle];
        if (categoryKey) {
            categories.set(categoryKey, html);
        }

        // 2. Check if it maps to a specific setting label
        const settingKey = SETTING_TITLE_MAP[normalizedTitle];
        if (settingKey) {
            settings.set(settingKey, html);
        }

        // 3. Check if it maps to a feature
        const featureKey = FEATURE_TITLE_MAP[normalizedTitle];
        if (featureKey) {
            features.set(featureKey, html);
        }

        // 4. Fallback: store with both the raw title and try matching directly
        // This enables auto-matching when Discourse titles directly match
        // local setting labels or feature names
        settings.set(normalizedTitle, html);
        features.set(normalizedTitle, html);
    }

    return { settings, features, categories };
}

// ─── Data enrichment ─────────────────────────────────────────

interface ToggleSetting {
    key: string;
    label: string;
    type: string;
    description: string;
    discourseHtml?: string;
    [key: string]: unknown;
}

interface ToggleCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
    settings: ToggleSetting[];
    [key: string]: unknown;
}

interface TogglesData {
    categories: ToggleCategory[];
    [key: string]: unknown;
}

/**
 * Enriches toggles data with Discourse content.
 * Only adds discourseHtml to settings that have a matching Discourse topic.
 */
export function enrichTogglesData(
    togglesData: TogglesData,
    descriptions: DiscourseDescriptions
): TogglesData {
    return {
        ...togglesData,
        categories: togglesData.categories.map((category) => ({
            ...category,
            settings: category.settings.map((setting) => {
                const normalizedLabel = normalize(setting.label);

                // Try to find a Discourse match for this setting
                const discourseHtml =
                    descriptions.settings.get(normalizedLabel) ?? undefined;

                if (discourseHtml) {
                    return { ...setting, discourseHtml };
                }
                return setting;
            }),
        })),
    };
}

interface Feature {
    id: string;
    name: string;
    fullName: string;
    officialDefinition: string;
    discourseHtml?: string;
    [key: string]: unknown;
}

interface FeaturesData {
    features: Feature[];
    [key: string]: unknown;
}

/**
 * Enriches features data with Discourse content.
 * Only adds discourseHtml to features that have a matching Discourse topic.
 */
export function enrichFeaturesData(
    featuresData: FeaturesData,
    descriptions: DiscourseDescriptions
): FeaturesData {
    return {
        ...featuresData,
        features: featuresData.features.map((feature) => {
            const normalizedName = normalize(feature.name);
            const normalizedFullName = normalize(feature.fullName);

            // Try to find a Discourse match — by feature name, fullName, or explicit mapping
            const discourseHtml =
                descriptions.features.get(normalizedName) ??
                descriptions.features.get(normalizedFullName) ??
                undefined;

            if (discourseHtml) {
                return { ...feature, discourseHtml };
            }
            return feature;
        }),
    };
}
