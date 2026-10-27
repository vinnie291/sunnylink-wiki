/** Vehicle visibility shared by the settings reference and config wizard.
 * The device's SettingsSchema remains authoritative for a connected vehicle:
 * a make alone cannot reveal hardware, firmware, or branch capabilities.
 */
const VEHICLE_MAKES: Record<string, readonly string[]> = {
    HyundaiLongitudinalTuning: ['Hyundai', 'Kia', 'Genesis'],
    TeslaCoopSteering: ['Tesla'],
    ToyotaEnforceFactoryLongitudinalControl: ['Toyota', 'Lexus'],
    ToyotaStopAndGoHack: ['Toyota', 'Lexus'],
    ToyotaZSS: ['Toyota', 'Lexus'],
    ToyotaSmartDSU: ['Toyota', 'Lexus'],
    SubaruStopAndGo: ['Subaru'],
    SubaruStopAndGoManualParkingBrake: ['Subaru'],
    HondaGasInterceptor: ['Honda', 'Acura'],
    RivianLongitudinalHarness: ['Rivian'],
    GMNonAccSupport: ['Chevrolet', 'GMC', 'Cadillac', 'Buick'],
    ChryslerSteerToZero: ['Chrysler', 'Dodge', 'Jeep', 'Ram'],
};

/** These are platform capabilities, detected from vehicle hardware, not user toggles. */
export const AUTOMATIC_VEHICLE_CAPABILITIES = new Set([
    'ToyotaZSS',
    'ToyotaSmartDSU',
    'HondaGasInterceptor',
    'RivianLongitudinalHarness',
    'GMNonAccSupport',
    'ChryslerSteerToZero',
]);

export const AUTOMATIC_CAPABILITY_NOTES: Record<string, string> = {
    ToyotaZSS: 'Detected automatically when compatible Zorro Steering Sensor hardware is present. There is no ZSS toggle.',
    ToyotaSmartDSU: 'Detected automatically when compatible Smart DSU hardware is present. Alpha Longitudinal is a separate setting.',
    HondaGasInterceptor: 'Detected automatically on supported non-Bosch Honda and Acura platforms when comma Pedal hardware is present.',
    RivianLongitudinalHarness: 'The longitudinal harness is detected from the installed hardware. Alpha Longitudinal is a separate setting.',
    GMNonAccSupport: 'Non-ACC support is determined by the vehicle platform; it is not a user toggle.',
    ChryslerSteerToZero: 'Steer to Zero is detected from the vehicle platform; it is not a user toggle.',
};

export const SUBARU_MANUAL_BRAKE_DESCRIPTION =
    'Enables stop-and-go on supported Subaru Global vehicles with a manual lever parking brake. Keep this disabled with an electronic parking brake. Unavailable on Global Gen2 and Hybrid platforms.';

export function isSettingApplicableToMake(key: string, make?: string | null): boolean {
    const allowed = VEHICLE_MAKES[key];
    if (!allowed || !make) return true; // No selection keeps the reference browsable.
    return allowed.some(candidate => candidate.toLowerCase() === make.trim().toLowerCase());
}

export function isVehicleSpecificSetting(key: string): boolean {
    return key in VEHICLE_MAKES;
}

export function resetInapplicableVehicleSettings<T extends Record<string, string | number>>(
    config: T, defaults: T, make: string,
): T {
    const next = { ...config };
    for (const key of Object.keys(VEHICLE_MAKES)) {
        if (!isSettingApplicableToMake(key, make) && key in defaults) {
            next[key as keyof T] = defaults[key as keyof T];
        }
    }
    return next;
}
