/**
 * Speed units follow the reader's locale: the handful of regions that post
 * limits in miles per hour get mph, everyone else gets km/h.
 */
const MPH_REGIONS = new Set(['US', 'GB', 'LR', 'MM', 'PR', 'GU', 'VI', 'AS', 'MP', 'BS', 'BZ', 'KY', 'DM', 'FK', 'GD', 'KN', 'LC', 'VC', 'WS']);

export type SpeedUnit = 'mph' | 'km/h';
export const MPH_TO_KPH = 1.609344;

export function detectSpeedUnit(): SpeedUnit {
  if (typeof navigator === 'undefined') return 'mph';
  try {
    for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
      const region = new Intl.Locale(tag).maximize().region;
      if (region) return MPH_REGIONS.has(region) ? 'mph' : 'km/h';
    }
  } catch { /* Intl.Locale is unavailable on very old engines; fall through. */ }
  return 'mph';
}

/** Speeds are stored in mph throughout the simulation; this is display only. */
export const toDisplaySpeed = (mph: number, unit: SpeedUnit) => (unit === 'mph' ? mph : mph * MPH_TO_KPH);
export const fromDisplaySpeed = (value: number, unit: SpeedUnit) => (unit === 'mph' ? value : value / MPH_TO_KPH);
