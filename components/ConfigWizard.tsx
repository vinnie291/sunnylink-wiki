'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLanguage } from '../lib/i18n';
import { GitFork, RefreshCw, X, CheckCircle2, Download } from 'lucide-react';
import './ConfigWizard.css';

import togglesData from '../data/toggles.json';
import carsData from '../data/cars.json';
import modelsData from '../data/models.json';

// ─── Types ───

export type WizardStepId = 'welcome' | 'car' | 'expert' | 'driving' | 'steering' | 'speed' | 'visuals' | 'review' | 'export';

export interface ConfigValues {
    // Vehicle
    make: string;
    model: string;
    year: number;
    device: string;
    // Expert / System
    UseMetricUnits: string;
    QuietMode: string;
    Language: string;
    OnroadUploads: string;
    AlwaysOnDriverMonitor: string;
    RecordUploadDriverCamera: string;
    RecordUploadMicAudio: string;
    GsmApn: string;
    GsmRoaming: string;
    QuickBoot: string;
    DisablePowerDown: string;
    AlphaLongitudinal: string;
    DisableUpdates: string;
    EnableSsh: string;
    EnableAdb: string;
    [key: string]: string | number;
}

interface CarMatch {
    id: string;
    make: string;
    model: string;
    years: string;
    bestSettings: Record<string, string>;
    communityConsensus: string;
    sunnyTuneUrl?: string;
    hardware: { device: string; harness: string; radar: string };
}

export interface SettingMeta {
    key: string;
    label: string;
    type: string;
    default?: string | number | boolean;
    description?: string;
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    helpText?: string;
    recommended?: string | boolean;
    userNote?: string;
    warning?: string;
    tradeoffs?: string[];
    dependencies?: { key: string; label: string }[];
    isAdvanced?: boolean;
}

// ─── Default config values ───
const DEFAULT_CONFIG: ConfigValues = {
    make: '', model: '', year: 2024, device: 'comma 3X',
    // Expert
    UseMetricUnits: 'False',
    QuietMode: 'False',
    Language: 'en',
    OnroadUploads: 'True',
    AlwaysOnDriverMonitor: 'False',
    RecordUploadDriverCamera: 'False',
    RecordUploadMicAudio: 'False',
    GsmApn: '',
    GsmRoaming: 'False',
    QuickBoot: 'False',
    DisablePowerDown: 'False',
    AlphaLongitudinal: 'False',
    DisableUpdates: 'False',
    // Driving
    DrivingModel: 'Default',
    ExperimentalMode: 'False',
    DrivingPersonality: 'Standard',
    DynamicExperimentalControl: 'False',
    DisengageOnAccelerator: 'True',
    IsLdwEnabled: 'False',
    RecordFront: 'True',
    GsmMetered: 'True',
    Mads: 'False',
    MadsSteeringMode: 'Remain Active',
    MadsMainCruiseAllowed: 'True',
    NNLCEnabled: 'False',
    SelfTune: 'True',
    LiveTorqueParamsToggle: 'True',
    CameraOffset: 0,
    AutoLaneChangeTimer: 'Nudge',
    AutoLaneChangeBsmDelay: 'True',
    HyundaiLongitudinalTuning: 'Standard',
    TorqueControlTuneVersion: 'Default',
    TeslaCoopSteering: 'False',
    VisionBasedTurnSpeedControl: 'True',
    MapBasedTurnSpeedControl: 'False',
    SpeedLimitAssistMode: 'Information',
    SpeedLimitSource: 'Map Data',
    SpeedLimitOffsetType: 'Fixed',
    SpeedLimitOffsetValue: 0,
    MapAdvisorySpeedLimit: 'True',
    CustomAccIncrements: 'False',
    CustomAccShortPressIncrement: 1,
    CustomAccLongPressIncrement: 5,
    GreenLightAlert: 'True',
    LeadDepartAlert: 'True',
    BlindSpotDetection: 'True',
    ShowTurnSignals: 'False',
    DisplayRoadName: 'True',
    ScreenBrightness: 'Auto',
    StandstillTimer: 'False',
    DisplayRocketFuelBar: 'False',
    SteeringArc: 'False',
    ChevronInfo: 'Off',
    DeveloperUIInfo: 'Off',
    RainbowMode: 'False',
    ToyotaEnforceFactoryLongitudinalControl: 'False',
    SubaruStopAndGo: 'False',
    EnableSsh: 'False',
    EnableAdb: 'False',
    ShowAdvancedControls: 'False',
};

// ─── Step definitions ───
const STEPS: { id: WizardStepId; icon: string; label: string }[] = [
    { id: 'welcome', icon: '👋', label: 'Welcome' },
    { id: 'car', icon: '🚗', label: 'Your Car' },
    { id: 'expert', icon: '⚙️', label: 'Expert Mode' },
    { id: 'driving', icon: '🛞', label: 'Core Driving' },
    { id: 'steering', icon: '🎯', label: 'Steering & MADS' },
    { id: 'speed', icon: '⚡', label: 'Speed & Cruise' },
    { id: 'visuals', icon: '🎨', label: 'Visuals & HUD' },
    { id: 'review', icon: '📋', label: 'Review' },
    { id: 'export', icon: '📦', label: 'Export Config' },
];

// ─── Resolve settings metadata from toggles.json ───
function getSettingMeta(key: string): SettingMeta | null {
    for (const cat of togglesData.categories) {
        for (const s of cat.settings) {
            if (s.key === key) {
                const meta = { ...s } as SettingMeta;
                if (key === 'DrivingModel' && !meta.options) {
                    const allModels = (modelsData.categories as Array<{ models: Array<{ name: string }> }>).flatMap(c => c.models.map((m) => m.name));
                    meta.options = ['Default', ...allModels];
                }
                return meta;
            }
        }
    }
    return null;
}

// ─── Find car match from cars.json ───
function findCarMatch(make: string, model: string): CarMatch | null {
    if (!make || !model) return null;
    const vehicles = (carsData as { vehicles: CarMatch[] }).vehicles;
    return vehicles.find(v =>
        v.make.toLowerCase() === make.toLowerCase() &&
        v.model.toLowerCase().includes(model.toLowerCase())
    ) || null;
}

// ─── Get unique car makes from cars.json ───
function getUniqueMakes(): string[] {
    const vehicles = (carsData as { vehicles: CarMatch[] }).vehicles;
    const makes = [...new Set(vehicles.map(v => v.make))];
    return makes.sort();
}

function getModelsForMake(make: string): string[] {
    const vehicles = (carsData as { vehicles: CarMatch[] }).vehicles;
    return vehicles
        .filter(v => v.make.toLowerCase() === make.toLowerCase())
        .map(v => v.model);
}

// ─── Reusable UI Components ───

function WizardToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            className={`cw-toggle ${value ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && onChange(!value)}
            aria-pressed={value}
        />
    );
}

function WizardDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="cw-select bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all min-w-[140px] hover:bg-slate-800/60"
        >
            {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    );
}

function WizardSlider({ value, min, max, step, unit, onChange }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center gap-3 w-full">
            <input
                type="range"
                min={min} max={max} step={step || 1}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="cw-slider flex-1"
            />
            <span className="text-sm font-mono text-cyan-400 min-w-[48px] text-right">{value}{unit ? ` ${unit}` : ''}</span>
        </div>
    );
}

function SettingCard({ settingKey, meta, value, onChange, config, isCommunityDefault, isAdvanced }: {
    settingKey: string;
    meta: SettingMeta | null;
    value: string | number;
    onChange: (key: string, value: string | number) => void;
    config: ConfigValues;
    isCommunityDefault?: boolean;
    isAdvanced?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    if (!meta) return null;

    const label = meta.label;
    const desc = meta.description || '';
    const isBool = meta.type === 'toggle';
    const isDropdown = meta.type === 'dropdown';
    const isSlider = meta.type === 'slider';
    const boolVal = String(value) === 'True' || String(value) === 'true';

    // Check dependencies
    if (meta.dependencies) {
        for (const dep of meta.dependencies) {
            let key = dep.key;
            if (key === 'MadsEnabled') key = 'Mads';
            if (key === 'NeuralNetworkLateralControl') key = 'NNLCEnabled';
            
            const depVal = config[key];
            if (depVal === 'False' || depVal === 'false' || depVal === 'Off' || depVal === undefined) {
                return null; // Hide if dependency not met
            }
        }
    }

    return (
        <div className={`cw-setting-card rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 ${isAdvanced ? 'border-l-2 border-l-purple-500/50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-slate-100">{label}</h4>
                        {isCommunityDefault && (
                            <span className="cw-badge-community text-[10px] px-1.5 py-0.5 rounded-full font-medium">★ Community</span>
                        )}
                        {isAdvanced && (
                            <span className="cw-badge-advanced text-[10px] px-1.5 py-0.5 rounded-full font-medium">Expert</span>
                        )}
                        {meta.warning && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-500/20 border border-red-500/30 text-red-400">⚠ Warning</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{desc}</p>

                    {expanded && (
                        <div className="mt-3 space-y-2 animate-fade-in">
                            {meta.userNote && (
                                <div className="text-xs text-cyan-400/80 bg-cyan-500/5 rounded-lg px-3 py-2 border border-cyan-500/10">
                                    💡 {meta.userNote}
                                </div>
                            )}
                            {meta.tradeoffs && meta.tradeoffs.length > 0 && (
                                <div className="text-xs text-slate-400 space-y-1">
                                    <span className="text-slate-300 font-medium">Tradeoffs:</span>
                                    {meta.tradeoffs.map((t, i) => <p key={i} className="ml-2">• {t}</p>)}
                                </div>
                            )}
                            {meta.warning && (
                                <div className="text-xs text-red-400/80 bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/10">
                                    ⚠️ {meta.warning}
                                </div>
                            )}
                        </div>
                    )}

                    <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-cyan-500 hover:text-cyan-400 mt-1.5 transition-colors">
                        {expanded ? '▲ Less info' : '▼ More info'}
                    </button>
                </div>

                <div className="flex-shrink-0">
                    {isBool && (
                        <WizardToggle value={boolVal} onChange={v => onChange(settingKey, v ? 'True' : 'False')} />
                    )}
                    {isDropdown && meta.options && (
                        <WizardDropdown value={String(value)} options={meta.options} onChange={v => onChange(settingKey, v)} />
                    )}
                    {isSlider && (
                        <div className="w-[180px]">
                            <WizardSlider
                                value={Number(value)}
                                min={meta.min ?? 0} max={meta.max ?? 100}
                                unit={meta.unit}
                                onChange={v => onChange(settingKey, v)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Step Components ───

function WelcomeStep({ onNext }: { onNext: () => void }) {
    const { t } = useLanguage();

    return (
        <div className="cw-step-enter space-y-6">
            <div className="text-center space-y-4">
                <div className="text-5xl mb-2">🛠️</div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                    {t('cw.welcome.title') === 'cw.welcome.title' ? 'Config Wizard' : t('cw.welcome.title')}
                </h2>
                <div className="flex items-center justify-center gap-1.5 -mt-1 mb-8">
                    <span className="text-slate-400 text-sm">Powered by</span>
                    <a 
                        href="https://sunny-tune.vercel.app/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1.5 text-cyan-500 hover:text-cyan-400 font-medium transition-colors text-sm"
                    >
                        <GitFork className="w-4 h-4" />
                        SunnyTune
                    </a>
                </div>
                <p className="text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Build a complete, device-ready sunnypilot configuration file in minutes.
                    We&apos;ll guide you through every setting with community-tested recommendations for your specific vehicle.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {[
                    { icon: '🚗', title: 'Car-Aware Defaults', desc: 'Auto-loads community-tested settings for your vehicle' },
                    { icon: '📋', title: 'Step-by-Step', desc: 'Every setting explained in plain English with context' },
                    { icon: '📦', title: 'Ready-to-Use JSON', desc: 'Download a file that works directly on your device' },
                ].map((f, i) => (
                    <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 text-center">
                        <div className="text-2xl mb-2">{f.icon}</div>
                        <div className="text-sm font-semibold text-slate-200">{f.title}</div>
                        <div className="text-xs text-slate-400 mt-1">{f.desc}</div>
                    </div>
                ))}
            </div>

            {/* Disclaimer */}
            <div className="max-w-2xl mx-auto rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <div>
                        <h3 className="text-sm font-semibold text-amber-300">Important Safety Disclaimer</h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            sunnypilot is an open-source driver assistance system. It does NOT make your car autonomous.
                            You must always keep your hands on the wheel and eyes on the road.
                            Settings generated by this wizard are community recommendations — not guarantees.
                            Always start with conservative settings and test in safe conditions.
                        </p>
                    </div>
                </div>
                <div className="mt-2 pt-3 border-t border-amber-500/20 text-center">
                    <p className="text-xs font-medium text-amber-400/90">By using this builder you accept the safety terms above.</p>
                </div>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={onNext}
                    className="px-8 py-3 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20"
                >
                    Get Started →
                </button>
            </div>
        </div>
    );
}

function CarStep({ config, onChange, onNext, onBack }: { config: ConfigValues; onChange: (key: string, value: string | number) => void; onNext: () => void; onBack: () => void }) {
    const makes = useMemo(() => [...getUniqueMakes(), 'Other'], []);
    const models = useMemo(() => config.make ? getModelsForMake(config.make as string) : [], [config.make]);
    const carMatch = useMemo(() => findCarMatch(config.make as string, config.model as string), [config.make, config.model]);

    return (
        <div className="cw-step-enter space-y-6">
            <div className="text-center space-y-2">
                <div className="text-4xl">🚗</div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Your Vehicle</h2>
                <p className="text-sm text-slate-400">Select your vehicle to load community-recommended settings</p>
            </div>

            <div className="max-w-xl mx-auto space-y-4">
                {/* Make */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Car Make</label>
                    <select
                        value={config.make}
                        onChange={e => { onChange('make', e.target.value); onChange('model', ''); }}
                        className="cw-select w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all hover:bg-slate-800/60"
                    >
                        <option value="">Select make...</option>
                        {makes.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* Model */}
                {config.make && config.make !== 'Other' && models.length > 0 && (
                    <div className="space-y-1.5 animate-fade-in">
                        <label className="text-sm font-medium text-slate-300">Model</label>
                        <select
                            value={config.model}
                            onChange={e => onChange('model', e.target.value)}
                            className="cw-select w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 outline-none transition-all hover:bg-slate-800/60"
                        >
                            <option value="">Select model...</option>
                            {models.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                )}

                {/* Manual model input for Other or custom */}
                {(config.make === 'Other' || (config.make && models.length === 0)) && (
                    <div className="space-y-1.5 animate-fade-in">
                        <label className="text-sm font-medium text-slate-300">Model (manual)</label>
                        <input
                            type="text"
                            value={config.model}
                            onChange={e => onChange('model', e.target.value)}
                            placeholder="e.g. Corolla"
                            className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 outline-none transition-all hover:bg-slate-800/60"
                        />
                    </div>
                )}

                {/* Year */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Year</label>
                    <input
                        type="number"
                        value={config.year}
                        onChange={e => onChange('year', Number(e.target.value))}
                        min={2015} max={2027}
                        className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 outline-none transition-all hover:bg-slate-800/60"
                    />
                </div>

                {/* Device */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Comma Device</label>
                    <div className="cw-segmented">
                        <div className="cw-segmented-indicator" data-index={['comma 3', 'comma 3X', 'comma 4'].indexOf(config.device as string)} />
                        {[
                            { value: 'comma 3', label: 'comma 3', sub: 'Legacy' },
                            { value: 'comma 3X', label: 'comma 3X', sub: 'Popular' },
                            { value: 'comma 4', label: 'comma 4', sub: 'Latest' },
                        ].map(d => (
                            <button
                                key={d.value}
                                type="button"
                                className={`cw-segmented-btn ${config.device === d.value ? 'active' : ''}`}
                                onClick={() => onChange('device', d.value)}
                            >
                                <span>{d.label}</span>
                                <span className="cw-seg-sub">{d.sub}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Car match banner */}
                {carMatch && (
                    <div className="animate-fade-in rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">✅</span>
                            <span className="text-sm font-semibold text-green-400">Vehicle found in community database!</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{carMatch.communityConsensus}</p>
                        <p className="text-xs text-cyan-400">Community settings have been pre-loaded into your config.</p>
                        {carMatch.sunnyTuneUrl && (
                            <a href={carMatch.sunnyTuneUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors mt-1">
                                🎵 View community SunnyTune config →
                            </a>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between max-w-xl mx-auto">
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all">
                    ← Back
                </button>
                <button 
                    onClick={onNext}
                    disabled={!config.make || !String(config.model || '').trim()}
                    className={`px-8 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        !config.make || !String(config.model || '').trim()
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20'
                    }`}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}

function SettingsStep({ title, icon, description, settingKeys, config, onChange, onNext, onBack, isAdvancedMode, communityKeys }: {
    title: string; icon: string; description: string;
    settingKeys: string[];
    config: ConfigValues;
    onChange: (key: string, value: string | number) => void;
    onNext: () => void; onBack: () => void;
    isAdvancedMode: boolean;
    communityKeys: Set<string>;
}) {
    // Split settings into beginner/advanced
    const advancedSettingKeys = useMemo(() => new Set([
        'NNLCEnabled', 'SelfTune', 'LiveTorqueParamsToggle', 'CameraOffset',
        'HyundaiLongitudinalTuning', 'TorqueControlTuneVersion', 'TeslaCoopSteering',
        'MapBasedTurnSpeedControl', 'SpeedLimitSource', 'SpeedLimitOffsetType', 'SpeedLimitOffsetValue',
        'CustomAccIncrements', 'CustomAccShortPressIncrement', 'CustomAccLongPressIncrement',
        'DeveloperUIInfo', 'ChevronInfo', 'StandstillTimer', 'DisplayRocketFuelBar', 'SteeringArc',
        'RainbowMode', 'AutoLaneChangeBsmDelay', 'MapAdvisorySpeedLimit',
        'ToyotaEnforceFactoryLongitudinalControl', 'SubaruStopAndGo',
        'DynamicExperimentalControl', 'RecordFront', 'GsmMetered',
        'UseMetricUnits', 'QuietMode', 'Language', 'OnroadUploads',
        'AlwaysOnDriverMonitor', 'RecordUploadDriverCamera', 'RecordUploadMicAudio',
        'GsmApn', 'GsmRoaming', 'QuickBoot', 'DisablePowerDown',
        'AlphaLongitudinal', 'DisableUpdates', 'EnableSsh', 'EnableAdb',
    ]), []);

    const visibleSettings = settingKeys.filter(key => {
        if (!isAdvancedMode && advancedSettingKeys.has(key)) return false;
        return true;
    });

    return (
        <div className="cw-step-enter space-y-5">
            <div className="text-center space-y-2">
                <div className="text-4xl">{icon}</div>
                <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
                <p className="text-sm text-slate-400">{description}</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-3">
                {visibleSettings.map(key => {
                    const meta = getSettingMeta(key);
                    return (
                        <SettingCard
                            key={key}
                            settingKey={key}
                            meta={meta}
                            value={config[key]}
                            onChange={onChange}
                            config={config}
                            isCommunityDefault={communityKeys.has(key)}
                            isAdvanced={advancedSettingKeys.has(key)}
                        />
                    );
                })}
                {visibleSettings.length === 0 && (
                    <div className="text-center text-sm text-slate-500 py-8">No settings in this category match your current configuration.</div>
                )}
            </div>

            <div className="flex justify-between max-w-2xl mx-auto">
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all">
                    ← Back
                </button>
                <button onClick={onNext}
                    className="px-8 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20 transition-all">
                    Next →
                </button>
            </div>
        </div>
    );
}

function ReviewStep({
    config,
    onBack,
    onNext,
    onChange
}: {
    config: ConfigValues;
    onBack: () => void;
    onNext: () => void;
    onChange: (key: string, value: string | number) => void;
}) {
    const groupedSettings: { name: string; settings: { key: string; val: string | number | boolean | undefined; meta: SettingMeta | null }[] }[] = [];
    const excludeKeys = new Set(['make', 'model', 'year', 'device']);
    
    for (const cat of togglesData.categories) {
        const catSettings = [];
        for (const rawMeta of cat.settings) {
            const meta = getSettingMeta(rawMeta.key);
            if (meta && meta.key in config && !excludeKeys.has(meta.key)) {
                catSettings.push({ key: meta.key, val: config[meta.key as keyof ConfigValues], meta });
            }
        }
        if (catSettings.length > 0) {
            groupedSettings.push({ name: cat.name, settings: catSettings });
        }
    }
    
    const matchedKeys = new Set(groupedSettings.flatMap(g => g.settings.map(s => s.key)));
    const orphans = [];
    for (const [k, v] of Object.entries(config)) {
        if (!excludeKeys.has(k) && !matchedKeys.has(k)) {
            orphans.push({ key: k, val: v, meta: null });
        }
    }
    if (orphans.length > 0) {
        groupedSettings.push({ name: "OTHER", settings: orphans });
    }

    const renderControl = (key: string, value: string | number | boolean | undefined, meta: SettingMeta | null) => {
        if (meta?.type === 'toggle' || value === 'True' || value === 'False' || value === 'true' || value === 'false') {
            const isOn = String(value).toLowerCase() === 'true';
            return (
                <button 
                    onClick={() => onChange(key, isOn ? 'False' : 'True')}
                    className="flex items-center justify-between w-full text-xs font-sans font-medium hover:opacity-80 transition-opacity text-left"
                >
                    <span className={isOn ? 'text-white' : 'text-slate-500'}>{isOn ? '✓ ON' : '✗ OFF'}</span>
                </button>
            );
        }
        if (meta?.type === 'dropdown' && meta.options) {
            return (
                <select 
                    value={String(value)} 
                    onChange={e => onChange(key, e.target.value)}
                    className="bg-transparent text-xs font-sans font-medium text-slate-200 outline-none w-full cursor-pointer hover:text-cyan-400"
                >
                    {meta.options.map(opt => (
                        <option key={opt} value={opt} className="bg-slate-800 text-white">{opt}</option>
                    ))}
                </select>
            );
        }
        if (meta?.type === 'slider' || typeof value === 'number') {
            return (
                <div className="flex items-center gap-1 w-full">
                    <input 
                        type="number"
                        value={value === undefined ? '' : Number(value)}
                        onChange={e => onChange(key, Number(e.target.value))}
                        className="bg-transparent text-xs font-sans font-medium text-slate-200 outline-none w-full hover:text-cyan-400 focus:text-cyan-400"
                        step={meta?.step || 1}
                        min={meta?.min}
                        max={meta?.max}
                    />
                    {meta?.unit && <span className="text-xs text-slate-500">{meta.unit}</span>}
                </div>
            );
        }
        return (
            <input 
                type="text"
                value={String(value)}
                onChange={e => onChange(key, e.target.value)}
                className="bg-transparent text-xs font-sans font-medium text-slate-200 outline-none w-full hover:text-cyan-400 focus:text-cyan-400"
            />
        );
    };

    let totalExported = 0;
    groupedSettings.forEach(g => { totalExported += g.settings.length; });

    return (
        <div className="cw-step-enter space-y-6">
            <div className="text-center space-y-2">
                <div className="text-4xl px-2">📋</div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Review Settings</h2>
                <p className="text-sm text-slate-400">Review and adjust your {totalExported} settings before exporting</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
                {groupedSettings.map(group => (
                    <div key={group.name} className="space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-sans">{group.name}</div>
                        <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/20 divide-y divide-slate-700/50">
                            {group.settings.map(s => (
                                <div key={s.key} className="flex min-h-[36px]">
                                    <div className="w-1/2 px-4 py-2 border-r border-slate-700/50 text-slate-300 text-xs font-sans flex items-center">
                                        {s.meta?.label || s.key}
                                    </div>
                                    <div className="w-1/2 px-4 py-2 flex items-center bg-slate-800/40">
                                        {renderControl(s.key, s.val, s.meta)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between max-w-2xl mx-auto pt-4">
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all">
                    ← Back
                </button>
                <button onClick={onNext}
                    className="px-8 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20 transition-all">
                    Next: Export →
                </button>
            </div>
        </div>
    );
}

function ExportStep({ config, onBack, onRestart }: { config: ConfigValues; onBack: () => void; onRestart: () => void }) {
    const [copied, setCopied] = useState(false);
    const [showJson, setShowJson] = useState(false);
    const previewRef = useRef<HTMLPreElement>(null);

    // Build export object
    const exportObj = useMemo(() => {
        const settings: Record<string, string | number> = {};
        // Exclude vehicle meta keys from settings
        const excludeKeys = new Set(['make', 'model', 'year', 'device']);
        for (const [key, val] of Object.entries(config)) {
            if (excludeKeys.has(key)) continue;
            settings[key] = val;
        }
        return {
            version: 2,
            timestamp: Date.now(),
            source: 'sunnylink-wiki-wizard',
            vehicle: {
                make: config.make || 'Unknown',
                model: config.model || 'Unknown',
                year: config.year,
                device: config.device,
            },
            settings,
        };
    }, [config]);

    const jsonStr = useMemo(() => JSON.stringify(exportObj, null, 2), [exportObj]);

    const handleDownload = useCallback(() => {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const makeSafe = String(config.make || '').replace(/[^a-zA-Z0-9]/g, '');
        const modelSafe = String(config.model || '').replace(/[^a-zA-Z0-9]/g, '');
        const dateStr = new Date().toISOString().split('T')[0];

        let filename = `SunnyLink-${dateStr}.json`;
        if (makeSafe && modelSafe) {
            filename = `SunnyLink-${makeSafe}-${modelSafe}-${dateStr}.json`;
        } else if (makeSafe) {
            filename = `SunnyLink-${makeSafe}-${dateStr}.json`;
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [jsonStr, config.make, config.model]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(jsonStr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* fallback - select text */ }
    }, [jsonStr]);

    // Count changed settings
    const changedCount = useMemo(() => {
        const excludeKeys = new Set(['make', 'model', 'year', 'device']);
        let count = 0;
        for (const [key, val] of Object.entries(config)) {
            if (excludeKeys.has(key) && val !== DEFAULT_CONFIG[key]) continue;
            if (!excludeKeys.has(key) && val !== DEFAULT_CONFIG[key]) count++;
        }
        return count;
    }, [config]);

    return (
        <div className="cw-step-enter space-y-6">
            <div className="text-center space-y-2">
                <div className="text-4xl">📦</div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Your Config is Ready!</h2>
                <p className="text-sm text-slate-400">
                    {config.make && config.model
                        ? `${config.year} ${config.make} ${config.model} — ${changedCount} customized settings`
                        : `${changedCount} customized settings`}
                </p>
            </div>

            {/* Summary cards */}
            <div className="max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Vehicle', value: config.make && config.model ? `${config.make} ${config.model}` : 'Custom' },
                    { label: 'Device', value: config.device },
                    { label: 'Model', value: config.DrivingModel },
                    { label: 'MADS', value: config.Mads === 'True' ? 'On' : 'Off' },
                ].map((s, i) => (
                    <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3 text-center">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</div>
                        <div className="text-sm font-semibold text-slate-200 mt-1 truncate">{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Action buttons */}
            <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 flex-wrap justify-center">
                <button onClick={handleDownload}
                    className="px-8 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2">
                    ⬇️ Download JSON Config
                </button>
                <a href="https://sunny-tune.vercel.app/configure" target="_blank" rel="noopener noreferrer"
                    className="px-6 py-3 rounded-xl font-semibold text-sm text-white hover:opacity-90 shadow-lg shadow-[#2663eb]/20 transition-all flex items-center justify-center gap-2 bg-[#2663eb]">
                    <GitFork className="w-4 h-4" />
                    Upload to SunnyTune
                </a>
            </div>

            {/* JSON preview toggle */}
            <div className="max-w-2xl mx-auto">
                <button onClick={() => setShowJson(!showJson)}
                    className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors flex items-center gap-1 mx-auto">
                    {showJson ? '▲ Hide' : '▼ Show'} JSON Preview
                </button>
                {showJson && (
                    <div className="mt-3 animate-fade-in relative">
                        <div className="absolute top-3 right-3 z-10">
                            <button onClick={handleCopy}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 backdrop-blur-sm text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-600 transition-all flex items-center justify-center gap-1.5 shadow-lg">
                                {copied ? '✅ Copied!' : '📋 Copy JSON'}
                            </button>
                        </div>
                        <pre ref={previewRef}
                            className="cw-json-preview bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-x-auto max-h-96 text-slate-300">
                            {jsonStr}
                        </pre>
                    </div>
                )}
            </div>

            {/* How to use */}
            <div className="max-w-2xl mx-auto rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-200">How to use this file</h3>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
                    <li>Sign in at <a href="https://sunnylink.ai" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">sunnylink.ai</a></li>
                    <li>On the Overview page, click <span className="text-slate-200 font-medium">Open Migration Wizard</span></li>
                    <li>Select your device from the list</li>
                    <li>Follow the steps to upload your <code className="text-cyan-400 bg-slate-800 px-1 rounded text-[11px]">.json</code> config file</li>
                </ol>
            </div>

            {/* Navigation */}
            <div className="flex justify-between max-w-2xl mx-auto">
                <button onClick={onBack} className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all">
                    ← Back
                </button>
                <button onClick={onRestart}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-all">
                    🔄 Start Over
                </button>
            </div>


        </div>
    );
}

// ─── Progress Bar ───
function ProgressBar({ currentStep, steps }: { currentStep: number; steps: typeof STEPS }) {
    return (
        <div className="w-full pt-2 pb-6">
            {/* Desktop Progress Bar (hidden on mobile) */}
            <div className="hidden lg:block">
                {/* The Track with Segments and Dot */}
                <div className="relative h-2 mb-4 flex items-center">
                    {/* Segments container */}
                    <div className="flex w-full gap-1.5 h-full relative z-0">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`flex-[1_1_0%] h-full relative rounded-full transition-colors duration-700 ${i <= currentStep ? 'bg-[#22d3ee] shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-slate-800'
                                    }`}
                            >
                                {/* Dot indicator strictly locked to the right side of the currently active segment */}
                                {i === currentStep && (
                                    <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-[#22d3ee] rounded-full border-2 border-slate-900 shadow-[0_0_12px_rgba(34,211,238,0.8)] z-10 transition-all duration-300" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Labels - Left Aligned to each Segment */}
                <div className="flex w-full gap-1.5 pb-2">
                    {steps.map((s, i) => (
                        <div
                            key={s.id}
                            className={`flex-[1_1_0%] flex flex-col items-start pt-1 transition-all duration-300 ${i <= currentStep ? 'opacity-100' : 'opacity-40'
                                }`}
                        >
                            {/* Icon positioned slightly smaller/tighter to match a cleaner aesthetic */}
                            <span className="text-xl leading-none mb-1.5">{s.icon}</span>
                            <span className={`text-[10px] leading-[1.2] font-bold tracking-wider uppercase whitespace-normal break-words w-full ${i <= currentStep ? 'text-cyan-400' : 'text-slate-400'
                                }`}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Mobile / Tablet Summary (hidden on large desktop) */}
            <div className="lg:hidden flex flex-col">
                <div className="relative h-[4px] mb-4 flex items-center w-full">
                    <div className="flex w-full gap-1 h-full z-0">
                        {steps.map((_, i) => (
                            <div key={i} className={`flex-[1_1_0%] h-full rounded-full transition-colors duration-700 ${i <= currentStep ? 'bg-[#22d3ee] shadow-[0_0_6px_rgba(34,211,238,0.4)]' : 'bg-slate-800'}`} />
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">
                        {currentStep + 1}
                    </span>
                    <span className="text-slate-200 text-sm font-semibold">{steps[currentStep].icon} {steps[currentStep].label}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Step {currentStep + 1} of {steps.length}</div>
            </div>
        </div>
    );
}

// ─── Main Orchestrator ───
export default function ConfigWizard() {
    const [currentStepId, setCurrentStepId] = useState<WizardStepId>('welcome');
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [config, setConfig] = useState<ConfigValues>({ ...DEFAULT_CONFIG });
    const [communityKeys, setCommunityKeys] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    // Dynamic steps list
    const activeSteps = useMemo(() => {
        return STEPS.filter(s => s.id !== 'expert' || isAdvancedMode);
    }, [isAdvancedMode]);

    const stepIndex = useMemo(() => {
        const idx = activeSteps.findIndex(s => s.id === currentStepId);
        return idx >= 0 ? idx : 0;
    }, [activeSteps, currentStepId]);

    const enforceDependencies = useCallback((currentConfig: ConfigValues) => {
        const newConfig = { ...currentConfig };
        let changed = false;

        const getNormalizedKey = (k: string) => {
            if (k === 'MadsEnabled') return 'Mads';
            if (k === 'NeuralNetworkLateralControl') return 'NNLCEnabled';
            return k;
        };

        // 1. Process toggles.json dependencies
        for (const cat of togglesData.categories) {
            for (const s of cat.settings) {
                const sMeta = s as SettingMeta;
                if (sMeta.dependencies) {
                    const normTarget = getNormalizedKey(sMeta.key);
                    if (normTarget in newConfig) {
                        const depsMet = sMeta.dependencies.every((dep: { key: string }) => {
                            const normDep = getNormalizedKey(dep.key);
                            const val = newConfig[normDep];
                            return val !== undefined && val !== 'False' && val !== 'Off';
                        });

                        if (!depsMet) {
                            const defVal = DEFAULT_CONFIG[normTarget] !== undefined ? DEFAULT_CONFIG[normTarget] : 'False';
                            if (newConfig[normTarget] !== defVal && newConfig[normTarget] !== 'False') {
                                newConfig[normTarget] = defVal;
                                changed = true;
                            }
                        }
                    }
                }
            }
        }

        // 2. Custom mutually exclusive pairings (Disallowed settings)
        // NNLC disable Torque Tune variables entirely
        if (newConfig.NNLCEnabled === 'True') {
            if (newConfig.SelfTune !== 'False') { newConfig.SelfTune = 'False'; changed = true; }
            if (newConfig.LiveTorqueParamsToggle !== 'False') { newConfig.LiveTorqueParamsToggle = 'False'; changed = true; }
            if (newConfig.TorqueControlTuneVersion !== 'Default') { newConfig.TorqueControlTuneVersion = 'Default'; changed = true; }
        }

        // Return the modified config if changes were made, otherwise return null indicating stable
        return changed ? newConfig : null;
    }, []);

    // Apply car match defaults when car changes
    useEffect(() => {
        const match = findCarMatch(config.make as string, config.model as string);
        if (match && match.bestSettings) {
            const newConfig = { ...config };
            const newCommunityKeys = new Set<string>();

            // Map car bestSettings keys to config keys
            const keyMap: Record<string, string> = {
                drivingModel: 'DrivingModel',
                experimentalMode: 'ExperimentalMode',
                mads: 'Mads',
            };

            for (const [bsKey, bsVal] of Object.entries(match.bestSettings)) {
                const configKey = keyMap[bsKey] || bsKey;
                if (configKey in DEFAULT_CONFIG) {
                    newConfig[configKey] = bsVal;
                    newCommunityKeys.add(configKey);
                }
            }

            // Waterfall dependency enforcement for loaded settings
            let stable = false;
            let iterations = 0;
            let finalConfig = { ...newConfig };
            while (!stable && iterations < 5) {
                const enforced = enforceDependencies(finalConfig);
                if (enforced) {
                    finalConfig = enforced;
                    iterations++;
                } else {
                    stable = true;
                }
            }

            setConfig(finalConfig);
            setCommunityKeys(newCommunityKeys);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.make, config.model, enforceDependencies]);

    const handleChange = useCallback((key: string, value: string | number) => {
        setConfig(prev => {
            let nextConfig = { ...prev, [key]: value };
            
            // Waterfall dependency enforcement (resolve cascading toggles)
            let stable = false;
            let iterations = 0;
            while (!stable && iterations < 5) {
                const enforced = enforceDependencies(nextConfig);
                if (enforced) {
                    nextConfig = enforced;
                    iterations++;
                } else {
                    stable = true;
                }
            }
            return nextConfig;
        });
    }, [enforceDependencies]);

    const goNext = useCallback(() => {
        const idx = activeSteps.findIndex(s => s.id === currentStepId);
        if (idx < activeSteps.length - 1) {
            setCurrentStepId(activeSteps[idx + 1].id);
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [activeSteps, currentStepId]);

    const goBack = useCallback(() => {
        const idx = activeSteps.findIndex(s => s.id === currentStepId);
        if (idx > 0) {
            setCurrentStepId(activeSteps[idx - 1].id);
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [activeSteps, currentStepId]);

    const restart = useCallback(() => {
        setCurrentStepId('welcome');
        setConfig({ ...DEFAULT_CONFIG });
        setCommunityKeys(new Set());
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // Setting keys per step
    const expertKeys = ['UseMetricUnits', 'QuietMode', 'Language', 'OnroadUploads', 'AlwaysOnDriverMonitor', 'RecordUploadDriverCamera', 'RecordUploadMicAudio', 'GsmApn', 'GsmRoaming', 'QuickBoot', 'DisablePowerDown', 'AlphaLongitudinal', 'DisableUpdates', 'EnableSsh', 'EnableAdb'];
    const drivingKeys = ['DrivingModel', 'ExperimentalMode', 'DrivingPersonality', 'DynamicExperimentalControl', 'DisengageOnAccelerator', 'IsLdwEnabled', 'RecordFront', 'GsmMetered'];
    const steeringKeys = ['Mads', 'MadsSteeringMode', 'MadsMainCruiseAllowed', 'NNLCEnabled', 'SelfTune', 'LiveTorqueParamsToggle', 'CameraOffset', 'AutoLaneChangeTimer', 'AutoLaneChangeBsmDelay', 'HyundaiLongitudinalTuning', 'TorqueControlTuneVersion', 'TeslaCoopSteering'];
    const speedKeys = ['VisionBasedTurnSpeedControl', 'MapBasedTurnSpeedControl', 'SpeedLimitAssistMode', 'SpeedLimitSource', 'SpeedLimitOffsetType', 'SpeedLimitOffsetValue', 'MapAdvisorySpeedLimit', 'CustomAccIncrements', 'CustomAccShortPressIncrement', 'CustomAccLongPressIncrement'];
    const visualKeys = ['GreenLightAlert', 'LeadDepartAlert', 'BlindSpotDetection', 'ShowTurnSignals', 'DisplayRoadName', 'ScreenBrightness', 'StandstillTimer', 'DisplayRocketFuelBar', 'SteeringArc', 'ChevronInfo', 'DeveloperUIInfo', 'RainbowMode'];

    return (
        <div ref={containerRef} className="py-6 px-2 md:px-0 space-y-6">
            {/* Header + Advanced toggle */}
            {currentStepId !== 'welcome' && (
                <div className="w-full max-w-2xl mx-auto px-4 md:px-0">
                    <ProgressBar currentStep={stepIndex} steps={activeSteps as typeof STEPS} />
                </div>
            )}

            {/* Advanced mode toggle (after welcome) */}
            {currentStepId !== 'welcome' && currentStepId !== 'export' && (
                <div className="flex justify-between items-center max-w-2xl mx-auto px-4 md:px-0">
                    <button onClick={restart} className="text-xs font-semibold text-red-500 hover:text-red-400 transition-colors flex items-center gap-1.5 py-1">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset Config
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs text-slate-400">Expert Mode</span>
                        <WizardToggle value={isAdvancedMode} onChange={setIsAdvancedMode} />
                    </label>
                </div>
            )}

            {/* Steps */}
            {currentStepId === 'welcome' && <WelcomeStep onNext={goNext} />}
            {currentStepId === 'car' && <CarStep config={config} onChange={handleChange} onNext={goNext} onBack={goBack} />}
            {currentStepId === 'expert' && (
                <SettingsStep title="Expert & System" icon="⚙️" description="Configure device-level system settings and power user features"
                    settingKeys={expertKeys} config={config} onChange={handleChange}
                    onNext={goNext} onBack={goBack} isAdvancedMode={isAdvancedMode} communityKeys={communityKeys} />
            )}
            {currentStepId === 'driving' && (
                <SettingsStep title="Core Driving" icon="🛞" description="Choose your driving model, personality, and core behavior"
                    settingKeys={drivingKeys} config={config} onChange={handleChange}
                    onNext={goNext} onBack={goBack} isAdvancedMode={isAdvancedMode} communityKeys={communityKeys} />
            )}
            {currentStepId === 'steering' && (
                <SettingsStep title="Steering & MADS" icon="🎯" description="Configure MADS, lane changes, and steering assist behavior"
                    settingKeys={steeringKeys} config={config} onChange={handleChange}
                    onNext={goNext} onBack={goBack} isAdvancedMode={isAdvancedMode} communityKeys={communityKeys} />
            )}
            {currentStepId === 'speed' && (
                <SettingsStep title="Speed & Cruise" icon="⚡" description="Speed limits, turn speed control, and ACC customization"
                    settingKeys={speedKeys} config={config} onChange={handleChange}
                    onNext={goNext} onBack={goBack} isAdvancedMode={isAdvancedMode} communityKeys={communityKeys} />
            )}
            {currentStepId === 'visuals' && (
                <SettingsStep title="Visuals & HUD" icon="🎨" description="Customize your on-screen display, alerts, and visual feedback"
                    settingKeys={visualKeys} config={config} onChange={handleChange}
                    onNext={goNext} onBack={goBack} isAdvancedMode={isAdvancedMode} communityKeys={communityKeys} />
            )}
            {currentStepId === 'review' && <ReviewStep config={config} onBack={goBack} onNext={goNext} onChange={handleChange} />}
            {currentStepId === 'export' && <ExportStep config={config} onBack={goBack} onRestart={restart} />}
        </div>
    );
}
