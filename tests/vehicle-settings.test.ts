import assert from 'node:assert/strict';
import { test } from 'node:test';
import toggles from '../data/toggles.json';
import { buildSunnylinkExport } from '../lib/wizardExport';
import type { ConfigValues } from '../components/ConfigWizard';
import { AUTOMATIC_VEHICLE_CAPABILITIES, isSettingApplicableToMake, isVehicleSpecificSetting, resetInapplicableVehicleSettings } from '../lib/vehicleSettings';

const allKeys = toggles.categories.flatMap(category => category.settings.map(setting => setting.key));
const forMake = (make?: string) => allKeys.filter(key => isSettingApplicableToMake(key, make));

test('a selected make keeps common settings and only its vehicle settings', () => {
    const subaru = forMake('Subaru');
    assert.ok(subaru.includes('SubaruStopAndGo'));
    assert.ok(subaru.includes('SubaruStopAndGoManualParkingBrake'));
    assert.ok(subaru.includes('MadsEnabled'));
    for (const key of ['ToyotaStopAndGoHack', 'TeslaCoopSteering', 'HyundaiLongitudinalTuning']) {
        assert.ok(!subaru.includes(key), key);
    }

    const toyota = forMake('Toyota');
    assert.ok(toyota.includes('ToyotaStopAndGoHack'));
    assert.ok(!toyota.includes('SubaruStopAndGo'));
    assert.ok(forMake('Lexus').includes('ToyotaStopAndGoHack'));
    assert.ok(forMake('Kia').includes('HyundaiLongitudinalTuning'));
    assert.ok(forMake('Acura').includes('HondaGasInterceptor'));
    assert.ok(forMake('Ram').includes('ChryslerSteerToZero'));
    assert.ok(forMake('Volkswagen').includes('MadsEnabled'));
    assert.ok(!forMake('Volkswagen').includes('SubaruStopAndGo'));
    assert.equal(forMake().length, allKeys.length);
});

test('automatic hardware capabilities are identified as information', () => {
    for (const key of ['ToyotaZSS', 'ToyotaSmartDSU', 'HondaGasInterceptor', 'RivianLongitudinalHarness', 'GMNonAccSupport', 'ChryslerSteerToZero']) {
        assert.ok(AUTOMATIC_VEHICLE_CAPABILITIES.has(key));
        assert.ok(allKeys.includes(key));
    }
    assert.ok(!AUTOMATIC_VEHICLE_CAPABILITIES.has('SubaruStopAndGo'));
    for (const key of ['HyundaiLongitudinalTuning', 'TeslaCoopSteering', 'ToyotaEnforceFactoryLongitudinalControl',
        'ToyotaStopAndGoHack', 'SubaruStopAndGo', 'SubaruStopAndGoManualParkingBrake']) {
        assert.ok(isVehicleSpecificSetting(key));
    }
});

test('changing makes clears stale options and the export omits unrelated brands', () => {
    const defaults = { make: 'Subaru', SubaruStopAndGo: 'False', TeslaCoopSteering: 'False', ToyotaStopAndGoHack: 'False' };
    const changed = resetInapplicableVehicleSettings({ ...defaults, make: 'Toyota', SubaruStopAndGo: 'True' }, defaults, 'Toyota');
    assert.equal(changed.SubaruStopAndGo, 'False');

    const config = {
        make: 'Subaru', model: 'Crosstrek', year: 2020, device: 'comma 3X',
        SubaruStopAndGo: 'True', SubaruStopAndGoManualParkingBrake: 'False',
        TeslaCoopSteering: 'True', ToyotaStopAndGoHack: 'True',
        ToyotaEnforceFactoryLongitudinalControl: 'True', HyundaiLongitudinalTuning: 'Dynamic',
    } as unknown as ConfigValues;
    const subaru = buildSunnylinkExport(config);
    assert.deepEqual(Object.keys(subaru.config.vehicleSpecific).sort(), ['subaruStopAndGo', 'subaruStopAndGoManualParkingBrake']);
    assert.ok(!('hyundaiLongTune' in subaru.config.longitudinal));
    assert.equal(subaru.config.vehicleSpecific.subaruStopAndGo, true);

    const toyota = buildSunnylinkExport({ ...config, make: 'Toyota' });
    assert.deepEqual(Object.keys(toyota.config.vehicleSpecific).sort(), ['toyotaEnforceFactoryLong', 'toyotaStopAndGo']);
});
