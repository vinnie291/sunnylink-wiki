/**
 * Maps vehicle manufacturer/brand to its official sunnypilot Discourse forum category.
 * Subcategories under https://community.sunnypilot.ai/c/vehicle-talk/76
 */

export const MANUFACTURER_FORUM_MAP: Record<string, string> = {
    // Hyundai, Kia, Genesis (HKG)
    hyundai: 'https://community.sunnypilot.ai/c/vehicle-talk/hyundai-kia-genesis/11',
    kia: 'https://community.sunnypilot.ai/c/vehicle-talk/hyundai-kia-genesis/11',
    genesis: 'https://community.sunnypilot.ai/c/vehicle-talk/hyundai-kia-genesis/11',

    // Toyota, Lexus
    toyota: 'https://community.sunnypilot.ai/c/vehicle-talk/toyota-lexus/87',
    lexus: 'https://community.sunnypilot.ai/c/vehicle-talk/toyota-lexus/87',

    // Honda, Acura
    honda: 'https://community.sunnypilot.ai/c/vehicle-talk/honda-acura/81',
    acura: 'https://community.sunnypilot.ai/c/vehicle-talk/honda-acura/81',

    // Volkswagen, Audi, Škoda
    volkswagen: 'https://community.sunnypilot.ai/c/vehicle-talk/volkswagen-audi-skoda/88',
    vw: 'https://community.sunnypilot.ai/c/vehicle-talk/volkswagen-audi-skoda/88',
    audi: 'https://community.sunnypilot.ai/c/vehicle-talk/volkswagen-audi-skoda/88',
    skoda: 'https://community.sunnypilot.ai/c/vehicle-talk/volkswagen-audi-skoda/88',
    'škoda': 'https://community.sunnypilot.ai/c/vehicle-talk/volkswagen-audi-skoda/88',

    // Ford, Lincoln
    ford: 'https://community.sunnypilot.ai/c/vehicle-talk/ford/79',
    lincoln: 'https://community.sunnypilot.ai/c/vehicle-talk/ford/79',

    // General Motors (Chevrolet, GMC, Cadillac, Buick)
    chevrolet: 'https://community.sunnypilot.ai/c/vehicle-talk/general-motors/80',
    chevy: 'https://community.sunnypilot.ai/c/vehicle-talk/general-motors/80',
    gmc: 'https://community.sunnypilot.ai/c/vehicle-talk/general-motors/80',
    cadillac: 'https://community.sunnypilot.ai/c/vehicle-talk/general-motors/80',
    buick: 'https://community.sunnypilot.ai/c/vehicle-talk/general-motors/80',
    'general motors': 'https://community.sunnypilot.ai/c/vehicle-talk/general-motors/80',
    gm: 'https://community.sunnypilot.ai/c/vehicle-talk/general-motors/80',

    // Chrysler, Jeep, Ram, Dodge, Fiat
    chrysler: 'https://community.sunnypilot.ai/c/vehicle-talk/chrysler-jeep-ram/78',
    jeep: 'https://community.sunnypilot.ai/c/vehicle-talk/chrysler-jeep-ram/78',
    ram: 'https://community.sunnypilot.ai/c/vehicle-talk/chrysler-jeep-ram/78',
    dodge: 'https://community.sunnypilot.ai/c/vehicle-talk/chrysler-jeep-ram/78',
    fiat: 'https://community.sunnypilot.ai/c/vehicle-talk/chrysler-jeep-ram/78',

    // Subaru
    subaru: 'https://community.sunnypilot.ai/c/vehicle-talk/subaru/85',

    // Nissan, Infiniti
    nissan: 'https://community.sunnypilot.ai/c/vehicle-talk/nissan/84',
    infiniti: 'https://community.sunnypilot.ai/c/vehicle-talk/nissan/84',

    // Mazda
    mazda: 'https://community.sunnypilot.ai/c/vehicle-talk/mazda/83',

    // BMW
    bmw: 'https://community.sunnypilot.ai/c/vehicle-talk/bmw/91',

    // Tesla
    tesla: 'https://community.sunnypilot.ai/c/vehicle-talk/tesla/86',

    // Volvo
    volvo: 'https://community.sunnypilot.ai/c/vehicle-talk/volvo/89',

    // Rivian
    rivian: 'https://community.sunnypilot.ai/c/vehicle-talk/rivian/90',

    // BYD
    byd: 'https://community.sunnypilot.ai/c/vehicle-talk/byd/77',

    // Peugeot, Citroën, Opel
    peugeot: 'https://community.sunnypilot.ai/c/vehicle-talk/peugeot-citroen-opel/130',
    citroen: 'https://community.sunnypilot.ai/c/vehicle-talk/peugeot-citroen-opel/130',
    'citroën': 'https://community.sunnypilot.ai/c/vehicle-talk/peugeot-citroen-opel/130',
    opel: 'https://community.sunnypilot.ai/c/vehicle-talk/peugeot-citroen-opel/130',

    // Tata, Land Rover, Jaguar
    tata: 'https://community.sunnypilot.ai/c/vehicle-talk/tata/129',
    'land rover': 'https://community.sunnypilot.ai/c/vehicle-talk/tata/129',
    jaguar: 'https://community.sunnypilot.ai/c/vehicle-talk/tata/129',
};

export const DEFAULT_VEHICLE_TALK_URL = 'https://community.sunnypilot.ai/c/vehicle-talk/76';

/**
 * Returns the exact community forum URL for a given vehicle make.
 */
export function getVehicleForumUrl(make?: string | null, customUrl?: string | null): string {
    if (make) {
        const key = make.trim().toLowerCase();
        if (MANUFACTURER_FORUM_MAP[key]) {
            return MANUFACTURER_FORUM_MAP[key];
        }
    }
    if (customUrl && customUrl.startsWith('https://community.sunnypilot.ai/c/vehicle-talk/')) {
        return customUrl;
    }
    return DEFAULT_VEHICLE_TALK_URL;
}
