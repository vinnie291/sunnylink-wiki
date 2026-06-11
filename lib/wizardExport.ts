import type { ConfigValues } from '../components/ConfigWizard';

/**
 * Builds the sunnylink-standard export JSON from the wizard's internal
 * config state. Shape mirrors the files produced by the official
 * sunnylink/SunnyTune export (exportVersion 1): nested camelCase sections
 * with real booleans/numbers, not the wizard's flat PascalCase string map.
 */

const bool = (v: string | number | undefined) =>
    String(v).toLowerCase() === 'true';

const num = (v: string | number | undefined, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

// Dropdown label → device enum maps (labels from data/toggles.json)
const MADS_STEERING_MODE: Record<string, number> = {
    'Default': 0,
    'Remain Active': 1,
};

const AUTO_LANE_CHANGE_TIMER: Record<string, number> = {
    'Off': -1,
    'Nudge': 0,
    'Nudgeless': 0.1,
    '0.5 s': 0.5,
    '1 s': 1,
    '2 s': 2,
    '3 s': 3,
};

const HYUNDAI_LONG_TUNE: Record<string, number> = {
    'Off': 0,
    'Predictive': 1,
    'Dynamic': 2,
};

const TORQUE_CONTROL_TUNE: Record<string, number> = {
    'Default': 1,
    'v1.0': 1,
    'v0.0': 0,
};

const SPEED_LIMIT_MODE: Record<string, number> = {
    'Information': 1,
    'User Confirm': 2,
    'Auto': 3,
};

const SPEED_LIMIT_POLICY: Record<string, number> = {
    'Car State': 2,
    'Map Data': 3,
    'Combined': 4,
};

const SCREEN_BRIGHTNESS: Record<string, number> = {
    'Auto': 0,
    'Low': 20,
    'Medium': 50,
    'High': 100,
};

const HARDWARE: Record<string, string> = {
    'comma 3': 'comma3',
    'comma 3X': 'comma3x',
    'comma 4': 'comma4',
};

function lookup(map: Record<string, number>, v: string | number | undefined, fallback: number): number {
    return map[String(v)] ?? fallback;
}

export function buildSunnylinkExport(config: ConfigValues) {
    const make = String(config.make || '').trim();
    const model = String(config.model || '').trim();
    const year = num(config.year, new Date().getFullYear());

    const mapEnabled = bool(config.MapBasedTurnSpeedControl);
    const e2eEnabled = bool(config.ExperimentalMode);
    const offsetValue = num(config.SpeedLimitOffsetValue, 0);
    const offsetType = offsetValue === 0
        ? 'none'
        : String(config.SpeedLimitOffsetType) === 'Percentage' ? 'percentage' : 'fixed';
    const drivingModel = String(config.DrivingModel || '');
    // -0.35..0.35 m is the device-accepted camera offset range
    const cameraOffset = Math.max(-0.35, Math.min(0.35, num(config.CameraOffset, 0)));

    const tags: string[] = [];
    const hardware = HARDWARE[String(config.device)] || '';
    if (hardware) tags.push(hardware);
    if (bool(config.Mads)) tags.push('mads');
    if (bool(config.BlindSpotDetection)) tags.push('bsm');

    return {
        exportVersion: 1,
        exportedAt: new Date().toISOString(),
        name: `${make} ${model} ${year}`.trim(),
        description: 'Generated with the sunnylink.wiki Config Wizard',
        vehicleMake: make.toLowerCase(),
        vehicleModel: model,
        vehicleYear: year,
        tags,
        category: 'daily-driver',
        config: {
            commaAI: {
                mads: bool(config.Mads),
                gsmApn: String(config.GsmApn ?? ''),
                gsmRoaming: bool(config.GsmRoaming),
                ldwEnabled: bool(config.IsLdwEnabled),
                recordDrives: bool(config.RecordUploadDriverCamera),
                connectEnabled: true,
                madsMainCruise: bool(config.MadsMainCruiseAllowed),
                madsSteeringMode: lookup(MADS_STEERING_MODE, config.MadsSteeringMode, 0),
                uploadOnlyOnWifi: bool(config.GsmMetered),
                sunnypilotEnabled: true,
                recordAudioFeedback: bool(config.RecordUploadMicAudio),
                madsUnifiedEngagement: true,
                disengageOnAccelerator: bool(config.DisengageOnAccelerator),
            },
            lateral: {
                lagdDelay: 0.2,
                liveTorque: bool(config.SelfTune) || bool(config.LiveTorqueParamsToggle),
                useNNModel: bool(config.NNLCEnabled),
                lagdEnabled: bool(config.SelfTune),
                cameraOffset,
                torqueOverride: {
                    enabled: false,
                    friction: 0.1,
                    latAccelFactor: 2.5,
                },
                liveTorqueRelaxed: true,
                torqueControlTune: lookup(TORQUE_CONTROL_TUNE, config.TorqueControlTuneVersion, 1),
                enforceTorqueControl: false,
                customTorqueParams: false,
            },
            vehicle: {
                make: make.toLowerCase(),
                year,
                model,
            },
            advanced: {
                quickBoot: bool(config.QuickBoot),
                disableUpdates: bool(config.DisableUpdates),
                maxTimeOffroad: 0,
                wakeupBehavior: 0,
                disablePowerDown: bool(config.DisablePowerDown),
                deviceBootMode: 0,
            },
            metadata: {
                branch: 'staging-sp',
                hardware,
                activeModel: drivingModel === 'Default' ? '' : drivingModel,
                sunnypilotVersion: '2026.001.000',
            },
            interface: {
                devUI: String(config.DeveloperUIInfo) !== 'Off',
                language: String(config.Language || 'en'),
                quietMode: bool(config.QuietMode),
                torqueBar: false,
                useMetric: bool(config.UseMetricUnits),
                alwaysOnDM: bool(config.AlwaysOnDriverMonitor),
                hideVegoUI: false,
                trueVegoUI: false,
                chevronInfo: String(config.ChevronInfo) !== 'Off',
                rainbowMode: bool(config.RainbowMode),
                steeringArc: bool(config.SteeringArc),
                blindSpotHUD: bool(config.BlindSpotDetection),
                screenOffTimer: 15,
                greenLightAlert: bool(config.GreenLightAlert),
                leadDepartAlert: bool(config.LeadDepartAlert),
                roadNameDisplay: bool(config.DisplayRoadName),
                showTurnSignals: bool(config.ShowTurnSignals),
                standstillTimer: bool(config.StandstillTimer),
                realTimeAccelBar: bool(config.DisplayRocketFuelBar),
                screenBrightness: lookup(SCREEN_BRIGHTNESS, config.ScreenBrightness, 0),
                disableOnroadUploads: !bool(config.OnroadUploads),
                interactivityTimeout: 90,
                showAdvancedControls: bool(config.ShowAdvancedControls),
                screenBrightnessDelay: 0,
                displayMetricsPosition: 0,
                showDebugInfo: false,
                recordAudio: false,
            },
            laneChange: {
                enabled: String(config.AutoLaneChangeTimer) !== 'Off',
                autoTimer: lookup(AUTO_LANE_CHANGE_TIMER, config.AutoLaneChangeTimer, 0),
                minimumSpeed: 20,
                bsmMonitoring: bool(config.BlindSpotDetection),
                laneTurnDesire: false,
                adjustLaneTurnSpeed: 0,
                blinkerPauseLateral: false,
                blinkerReengageDelay: 0,
                autoLaneChangeBsmDelay: bool(config.AutoLaneChangeBsmDelay),
                laneTurnSpeed: 0,
            },
            navigation: {
                osmEnabled: mapEnabled,
            },
            longitudinal: {
                dynamicE2E: bool(config.DynamicExperimentalControl),
                e2eEnabled,
                customAccLong: num(config.CustomAccLongPressIncrement, 5),
                customAccShort: num(config.CustomAccShortPressIncrement, 1),
                hyundaiLongTune: lookup(HYUNDAI_LONG_TUNE, config.HyundaiLongitudinalTuning, 0),
                planplusEnabled: e2eEnabled,
                alphaLongEnabled: bool(config.AlphaLongitudinal),
                customAccEnabled: bool(config.CustomAccIncrements),
            },
            speedControl: {
                mapEnabled,
                icbmEnabled: false,
                visionEnabled: bool(config.VisionBasedTurnSpeedControl),
                speedLimitControl: {
                    mode: lookup(SPEED_LIMIT_MODE, config.SpeedLimitAssistMode, 1),
                    policy: lookup(SPEED_LIMIT_POLICY, config.SpeedLimitSource, 3),
                    offsetType,
                    offsetValue,
                },
                mapAdvisorySpeedLimit: bool(config.MapAdvisorySpeedLimit),
            },
            vehicleSpecific: {
                subaruStopAndGo: bool(config.SubaruStopAndGo),
                teslaCoopSteering: bool(config.TeslaCoopSteering),
                toyotaEnforceFactoryLong: bool(config.ToyotaEnforceFactoryLongitudinalControl),
                toyotaStopAndGo: false,
            },
            drivingPersonality: {
                longitudinalPersonality: String(config.DrivingPersonality || 'Standard').toLowerCase(),
            },
        },
    };
}
