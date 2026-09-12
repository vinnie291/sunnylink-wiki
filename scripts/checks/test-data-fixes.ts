import assert from 'node:assert/strict';
import { getFleetAttribution, getBrandFleetStat } from '../../lib/fleetStats';
import { hasDefaultValue, formatDefaultValue } from '../../components/SettingsDatabase';
import toggles from '../../data/toggles.json';
import en from '../../locales/en.json';

// 1 — a sub-brand must never present its parent company's device count as its own.
for (const [child, parent] of [['Lexus', 'Toyota'], ['Kia', 'Hyundai'], ['Genesis', 'Hyundai'], ['Audi', 'Volkswagen'], ['RAM', 'Chrysler']] as const) {
  const childFleet = getFleetAttribution(child)!;
  const parentFleet = getFleetAttribution(parent)!;
  assert.ok(childFleet, `${child} should resolve to a fleet record`);
  assert.equal(childFleet.isGroupTotal, true, `${child} count is a ${parent} group total and must say so`);
  assert.equal(childFleet.groupName, parent);
  assert.ok(childFleet.coveredMakes.includes(child), `${parent} group should list ${child}`);
  assert.equal(parentFleet.isGroupTotal, false, `${parent} owns its own count`);
  assert.equal(childFleet.stat.totalDevices, parentFleet.stat.totalDevices, 'both read the same group record');
}
// Siblings share a parent, so neither may be shown as a standalone figure.
assert.equal(getFleetAttribution('Kia')!.isGroupTotal, getFleetAttribution('Genesis')!.isGroupTotal);
// A make with no fleet data at all (BYD) reports nothing rather than borrowing a number.
assert.equal(getFleetAttribution('BYD'), undefined);
assert.equal(getBrandFleetStat('BYD'), undefined);
assert.equal(getFleetAttribution(null), undefined);
console.log('PASS fleet counts are attributed to the brand that owns them');

// 4 — every default renders as something, including empty strings.
assert.equal(formatDefaultValue(''), 'N/A');
assert.equal(formatDefaultValue('   '), 'N/A');
assert.equal(formatDefaultValue(null), 'N/A');
assert.equal(formatDefaultValue(undefined), 'N/A');
assert.equal(formatDefaultValue(false), 'false');
assert.equal(formatDefaultValue(0), '0');
assert.equal(hasDefaultValue(false), true, 'false is a real default, not a missing one');
assert.equal(hasDefaultValue(0), true, 'zero is a real default, not a missing one');
// The JSON's inferred literal types differ per setting; only these two fields matter here.
type ToggleSetting = { label: string; default?: string | number | boolean | null };
const settings: ToggleSetting[] = toggles.categories.flatMap(
  (category) => category.settings as unknown as ToggleSetting[]
);
for (const setting of settings) {
  const rendered = formatDefaultValue(setting.default);
  assert.ok(rendered.trim().length > 0, `${setting.label} renders an empty default cell`);
}
const emptyDefaults = settings.filter((setting) => !hasDefaultValue(setting.default));
console.log(`PASS ${settings.length} settings render a default, ${emptyDefaults.length} of them as N/A`);

// 2 — keys the UI asks for must exist, or the raw key is what users read.
const messages = en as Record<string, string>;
for (const key of ['cars.recommended', 'cars.communityRating', 'cars.noRatingsYet', 'cars.closeDetails', 'features.flagFeature', 'cars.fleetStats.groupTotal']) {
  assert.ok(messages[key], `locales/en.json is missing ${key}`);
}
console.log('PASS translation keys used by the UI exist in English');
