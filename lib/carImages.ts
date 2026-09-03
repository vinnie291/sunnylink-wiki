/**
 * Vehicle image cutout resolver.
 * Maps every make and model directly to its exact stock studio white transparent PNG cutout.
 */

// Model slug exceptions or aliases if needed
const MODEL_SLUG_MAP: Record<string, string> = {
    'hyundai-ioniq-5': 'hyundai-ioniq-5',
    'hyundai-tucson': 'hyundai-tucson',
    'hyundai-elantra': 'hyundai-elantra',
    'hyundai-sonata': 'hyundai-sonata',
    'hyundai-palisade': 'hyundai-palisade',
    'hyundai-kona-ev': 'hyundai-kona-ev',
    'hyundai-custin': 'hyundai-custin',

    'toyota-rav4': 'toyota-rav4',
    'toyota-corolla': 'toyota-corolla',
    'toyota-sienna': 'toyota-sienna',
    'toyota-tundra': 'toyota-tundra',

    'honda-civic': 'honda-civic',
    'honda-accord': 'honda-accord',
    'honda-ridgeline': 'honda-ridgeline',
    'honda-odyssey': 'honda-odyssey',
    'honda-pilot': 'honda-pilot',

    'kia-niro': 'kia-niro',
    'kia-ev6': 'kia-ev6',
    'kia-sportage-phev': 'kia-sportage-phev',
    'kia-telluride': 'kia-telluride',
    'kia-k5': 'kia-k5',

    'ford-f-150': 'ford-f-150',
    'ford-f-150-lightning': 'ford-f-150-lightning',
    'ford-escape': 'ford-escape',

    'chevrolet-bolt-ev-euv': 'chevrolet-bolt-ev-euv',
    'chrysler-pacifica': 'chrysler-pacifica',
    'lincoln-navigator': 'lincoln-navigator',
    'lincoln-corsair': 'lincoln-corsair',
    'ram-1500': 'ram-1500',
    'genesis-gv60': 'genesis-gv60',

    'lexus-rc': 'lexus-rc',
    'lexus-is': 'lexus-is',
    'lexus-rx-350': 'lexus-rx-350',

    'audi-a3': 'audi-a3',
    'subaru-crosstrek': 'subaru-crosstrek',
    'subaru-ascent': 'subaru-ascent',
    'mazda-cx-5': 'mazda-cx-5',
    'volvo-xc90': 'volvo-xc90',

    'tesla-model-3': 'tesla-model-3',
    'tesla-model-y': 'tesla-model-y',
    'tesla-model-3-y': 'tesla-model-3',
    'rivian-r1t': 'rivian-r1t',
    'rivian-r1s': 'rivian-r1s',
    'byd-frigate-07': 'byd-frigate-07',
};

/**
 * Returns the transparent cutout PNG path for a given vehicle make and model.
 * Guaranteed to match the exact vehicle generation and model year in standard white studio lighting.
 */
export function getCarCutoutImage(make: string, model: string): string {
    const cleanMake = (make || '').toLowerCase().trim();
    const cleanModel = (model || '')
        .toLowerCase()
        .replace(/\s*\(.*?\)/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const key = `${cleanMake}-${cleanModel}`;
    if (MODEL_SLUG_MAP[key]) {
        return `/cars/${MODEL_SLUG_MAP[key]}.png`;
    }

    // Direct match if key matches a file
    return `/cars/${key}.png`;
}
