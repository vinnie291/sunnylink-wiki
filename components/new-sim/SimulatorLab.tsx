'use client';

import { useEffect, useRef, useState, useSyncExternalStore, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUpRight, Play, Pause, RotateCcw, Route, Navigation, Layers3,
  TrafficCone, Car, CarFront, Camera, SlidersHorizontal, Maximize2,
  Minimize2, Trees, Building2, Eye, MoveUpRight, ScanLine,
  SignpostBig, ChevronUp, Sun, Moon, SunMoon, SkipBack, SkipForward, X, ChevronLeft, ChevronRight, Share2
} from 'lucide-react';
import {
  DEFAULT_OPTIONS, SCENARIOS, BEHAVIORS, CAR_COLORS, type SimOptions, type Scenario,
  type Behavior, type CameraMode, type Telemetry
} from '@/lib/new-sim/simulation';
import { ALL_MODEL_PROFILES, getModelProfile, type ModelSimProfile } from '@/lib/new-sim/modelProfiles';
import ModelAccordionSelector from './ModelAccordionSelector';
import { detectSpeedUnit, toDisplaySpeed, MPH_TO_KPH, type SpeedUnit } from '@/lib/new-sim/units';
import styles from './SimulatorLab.module.css';

const WorldCanvas = dynamic(() => import('./WorldCanvas'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Preparing the driving environment…</div>,
});

const SCENARIO_ICONS: Record<Scenario, typeof Building2> = {
  city: Building2,
  boulevard: MoveUpRight,
  curves: Trees,
  highway: SignpostBig,
};

const defaultProfile = getModelProfile();
const initialTelemetry: Telemetry = {
  speed: 22,
  acceleration: 0,
  gap: 29,
  steering: 0,
  brake: false,
  elapsed: 0,
  distance: 0,
  progress: 0.03,
  status: 'Following the route',
  nextName: 'Maple & 3rd',
  nextKind: 'signal',
  nextDistance: 85,
  phase: 'red',
  remaining: 11,
  lane: 0,
  laneCount: 2,
  lanePosition: 0,
  vehicles: 34,
  stops: 0,
  laneChanges: 0,
  cutIns: 0,
  history: [],
  model: defaultProfile,
  modelReaction: 'Ultra-Smooth centering',
  lateralAcceleration: 0, laneErrorRms: 0, peakJerk: 0, interventions: 0,
};

const RATES = [0.5, 1, 2];
const SKIP_METRES = 200;

const TRAFFIC_PRESETS = [
  { label: 'Light', value: 15 },
  { label: 'Moderate', value: 50 },
  { label: 'Busy', value: 80 },
  { label: 'Rush hour', value: 100 },
];

const LIGHTING_OPTIONS = [
  { key: 'auto', name: 'Follow site theme', icon: SunMoon },
  { key: 'day', name: 'Day', icon: Sun },
  { key: 'night', name: 'Night', icon: Moon },
] as const;

const cameras: { key: CameraMode; name: string; icon: typeof Navigation }[] = [
  { key: 'follow', name: 'Follow', icon: Navigation },
  { key: 'overview', name: 'Overview', icon: Layers3 },
  { key: 'driver', name: 'Driver', icon: Eye },
];

/** One labelled row of chips. Every setting in the panel uses this shape. */
function SettingRow({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingHead}>
        <span>{label}</span>
        {value && <b>{value}</b>}
      </div>
      <div className={styles.settingChips} role="group" aria-label={label}>{children}</div>
    </div>
  );
}

function Chip({ active, onClick, label, children }: { active: boolean; onClick: () => void; label?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      className={`${styles.chip} ${active ? styles.chipActive : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function elapsed(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

// The wiki toggles themes by putting `light` on <html>; watch that class so the
// 3D scene can repaint with the page instead of staying stuck on one palette.
// The unit never changes within a session, so a constant snapshot keeps this
// out of an effect and out of hydration's way.
const subscribeUnit = () => () => {};
const unitSnapshot = () => detectSpeedUnit();
const unitServerSnapshot = (): SpeedUnit => 'mph';

const subscribeTheme = (callback: () => void) => {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};
const themeSnapshot = () => (document.documentElement.classList.contains('light') ? 'light' : 'dark');

// The stage is too narrow below this width to lay the environment groups out
// inline, so they collapse into one labelled menu instead of wrapping or
// scrolling sideways.
const COMPACT_QUERY = '(max-width: 540px)';
const subscribeCompact = (callback: () => void) => {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};
const compactSnapshot = () => window.matchMedia(COMPACT_QUERY).matches;

const subscribeMotion = (callback: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};
const motionSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SimulatorLabProps {
  initialModelId?: string;
  embedded?: boolean;
  onClose?: () => void;
  onModelChange?: (id: string) => void;
}

export default function SimulatorLab({ initialModelId, embedded = false, onClose, onModelChange }: SimulatorLabProps) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, () => true);
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, () => 'dark' as const);
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false);
  const unit = useSyncExternalStore(subscribeUnit, unitSnapshot, unitServerSnapshot);
  const [allowMotion, setAllowMotion] = useState(false);
  const [settings, setOptions] = useState<SimOptions>(() => ({ ...DEFAULT_OPTIONS, modelId: getModelProfile(initialModelId).id }));
  const options = { ...settings, playing: settings.playing && (!reducedMotion || allowMotion) };
  const [telemetry, setTelemetry] = useState<Telemetry>(initialTelemetry);
  const [revision, setRevision] = useState(0);
  const [shareStatus, setShareStatus] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [previousInitialModelId, setPreviousInitialModelId] = useState(initialModelId);
  // Prop-driven deep-link navigation resets the vehicle, preserving the environment.
  if (previousInitialModelId !== initialModelId) {
    setPreviousInitialModelId(initialModelId);
    if (initialModelId && getModelProfile(initialModelId).id !== settings.modelId) {
      setOptions(o => ({ ...o, modelId: getModelProfile(initialModelId).id }));
      setRevision(v => v + 1);
    }
  }
  const [expanded, setExpanded] = useState(false);
  // One menu open at a time, so the stage never stacks two panels over the road.
  const skipRef = useRef<((metres: number) => void) | null>(null);
  const [openMenu, setOpenMenu] = useState<'settings' | 'environment' | 'camera' | null>(null);

  const activeModel: ModelSimProfile = useMemo(() => {
    return getModelProfile(options.modelId);
  }, [options.modelId]);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (openMenu || expanded)) { e.preventDefault(); if (openMenu) setOpenMenu(null); else setExpanded(false); }
      if (e.code !== 'Space' || (e.target instanceof HTMLElement && /INPUT|BUTTON|SELECT|TEXTAREA|A/.test(e.target.tagName))) return;
      e.preventDefault();
      setAllowMotion(true);
      setOptions(o => ({ ...o, playing: !options.playing }));
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [options.playing, openMenu, expanded]);

  useEffect(() => {
    if (!openMenu) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-dock]')) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [openMenu]);

  const update = <K extends keyof SimOptions>(key: K, value: SimOptions[K]) => {
    if (key === 'playing') setAllowMotion(true);
    setOptions(o => ({ ...o, [key]: value }));
  };

  const selectRoad = (key: Scenario) => {
    setOpenMenu(null);
    setOptions(o => ({ ...o, scenario: key, speed: SCENARIOS[key].limit }));
  };

  const restart = () => setRevision(v => v + 1);
  const selectModel = (id: string) => {
    update('modelId', id);
    restart();
    setShareStatus(''); setShareUrl('');
    onModelChange?.(id);
  };
  const adjacentModel = (direction: number) => {
    const index = ALL_MODEL_PROFILES.findIndex(m => m.id === activeModel.id);
    selectModel(ALL_MODEL_PROFILES[(index + direction + ALL_MODEL_PROFILES.length) % ALL_MODEL_PROFILES.length].id);
  };
  const shareSimulation = async () => {
    const url = new URL('/models', window.location.origin);
    url.searchParams.set('sim', activeModel.id);
    try { await navigator.clipboard.writeText(url.href); setShareStatus('Link copied'); setShareUrl(''); }
    catch { setShareUrl(url.href); setShareStatus('Copy this simulation link'); }
  };

  const scenario = SCENARIOS[options.scenario];
  const settingsOpen = openMenu === 'settings';
  // Derived, so rotating to a wide layout cannot leave a hidden panel open.
  const environmentOpen = compact && openMenu === 'environment';
  const activeCamera = cameras.find(camera => camera.key === options.camera) ?? cameras[0];
  const ActiveCameraIcon = activeCamera.icon;
  const cameraOpen = compact && openMenu === 'camera';
  // Cruise speed is stored in mph; step it in whole units of whatever the
  // reader sees, so km/h lands on 50, 60, 70 rather than 48, 56, 64.
  const stepSpeed = (direction: number) => {
    const step = unit === 'mph' ? 5 : 10 / MPH_TO_KPH;
    const snapped = unit === 'mph'
      ? Math.round(options.speed / 5) * 5
      : Math.round(toDisplaySpeed(options.speed, unit) / 10) * 10 / MPH_TO_KPH;
    return Math.round(Math.min(scenario.maxSpeed, Math.max(15, snapped + direction * step)));
  };
  const trafficPreset = TRAFFIC_PRESETS.reduce((closest, preset) =>
    Math.abs(preset.value - options.density) < Math.abs(closest.value - options.density) ? preset : closest);

  return (
    <div className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      <div className={styles.shell}>
        <header className={styles.labHeader} aria-label="Simulation controls">
          <h1 className="sr-only">Driving simulator</h1>
          <div className={styles.labActions}>
            {embedded ? <button type="button" onClick={onClose}><ArrowLeft size={14} /> All models</button>
              : <Link href="/models"><ArrowLeft size={14} /> All models</Link>}
          </div>
          <div className={styles.labActions}>
            <div className={styles.modelStepper} role="group" aria-label="Model comparison">
              <button type="button" onClick={() => adjacentModel(-1)} aria-label="Previous model" title="Previous model"><ChevronLeft size={16} /></button>
              {!compact && <div className={styles.headerModel} title={activeModel.name} aria-live="polite">
                <span className={styles.dot} style={{ background: activeModel.pathColor }} />
                <b>{activeModel.name}</b>
              </div>}
              <button type="button" onClick={() => adjacentModel(1)} aria-label="Next model" title="Next model"><ChevronRight size={16} /></button>
            </div>
            <button type="button" onClick={shareSimulation}><Share2 size={14} /> Share simulation</button>
            {embedded && <button type="button" onClick={onClose} aria-label="Close simulator"><X size={18} /></button>}
          </div>
        </header>
        <div role="status" className={styles.shareStatus}>{shareStatus}
          {shareUrl && <input aria-label="Simulation share link" readOnly value={shareUrl} onFocus={e => e.target.select()} />}
        </div>

        <div className={styles.workspace}>
          <section className={`${styles.stage} ${expanded ? styles.expanded : ''}`} aria-label="Driving simulator">
            <WorldCanvas options={options} revision={revision} chapter="start" theme={theme} skipRef={skipRef} onTelemetry={setTelemetry} />
            
            <div className={styles.sceneTop}>
              <div className={styles.envBar}>
                <div className={styles.sceneTitle}>
                  <span className={options.playing ? styles.liveDot : styles.pausedDot} />
                  <b>{options.playing ? 'LIVE' : 'PAUSED'}</b>
                </div>

                {compact && (
                  <div className={styles.modelPill} title={activeModel.name}>
                    <span className={styles.dot} style={{ background: activeModel.pathColor }} />
                    <b>{activeModel.name}</b>
                  </div>
                )}

                {compact ? (
                  <div className={styles.envMenuWrap} data-dock>
                    <button
                      type="button"
                      className={styles.envMenuButton}
                      aria-expanded={environmentOpen}
                      aria-haspopup="dialog"
                      onClick={() => setOpenMenu(environmentOpen ? null : 'environment')}
                    >
                      <SlidersHorizontal size={14} />
                      <b>Environment settings</b>
                      <ChevronUp size={13} className={environmentOpen ? '' : styles.chevronOpen} />
                    </button>

                    {environmentOpen && (
                      <div className={styles.envPanel} role="dialog" aria-label="Environment settings">
                        <SettingRow label="Road" value={scenario.name}>
                          {(Object.keys(SCENARIOS) as Scenario[]).map(key => {
                            const Icon = SCENARIO_ICONS[key] || Building2;
                            return (
                              <Chip key={key} active={options.scenario === key} onClick={() => selectRoad(key)}>
                                <Icon size={13} /> {SCENARIOS[key].name}
                              </Chip>
                            );
                          })}
                        </SettingRow>

                        <SettingRow label="Traffic" value={`${telemetry.vehicles} cars`}>
                          {TRAFFIC_PRESETS.map((preset, index) => (
                            <Chip
                              key={preset.label}
                              active={trafficPreset.label === preset.label}
                              onClick={() => update('density', preset.value)}
                            >
                              <span className={styles.chipCars} aria-hidden="true">
                                {Array.from({ length: index + 1 }, (_, i) => <CarFront key={i} size={12} />)}
                              </span>
                              {preset.label}
                            </Chip>
                          ))}
                        </SettingRow>

                        <SettingRow label="Lighting">
                          {LIGHTING_OPTIONS.map(({ key, name, icon: Icon }) => (
                            <Chip key={key} active={options.lighting === key} onClick={() => update('lighting', key)}>
                              <Icon size={13} /> {key === 'auto' ? 'Auto' : name}
                            </Chip>
                          ))}
                        </SettingRow>

                      </div>
                    )}
                  </div>
                ) : (
                  <>
                {/* Environment: every option is one click, no menu to open. */}
                <div className={styles.envGroup} role="radiogroup" aria-label="Road">
                  <span className={styles.envLabel}>Road</span>
                  {(Object.keys(SCENARIOS) as Scenario[]).map(key => {
                    const Icon = SCENARIO_ICONS[key] || Building2;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={options.scenario === key}
                        aria-label={SCENARIOS[key].name}
                        title={SCENARIOS[key].name}
                        className={options.scenario === key ? styles.envActive : ''}
                        onClick={() => selectRoad(key)}
                      >
                        <Icon size={15} />
                      </button>
                    );
                  })}
                </div>

                <div className={styles.envGroup} role="radiogroup" aria-label="Traffic density">
                  <span className={styles.envLabel}>Traffic</span>
                  {TRAFFIC_PRESETS.map((preset, index) => (
                    <button
                      key={preset.label}
                      type="button"
                      role="radio"
                      aria-checked={trafficPreset.label === preset.label}
                      aria-label={`${preset.label} traffic`}
                      title={`${preset.label} traffic`}
                      className={`${styles.envCars} ${trafficPreset.label === preset.label ? styles.envActive : ''}`}
                      onClick={() => update('density', preset.value)}
                    >
                      {Array.from({ length: index + 1 }, (_, i) => <CarFront key={i} size={13} />)}
                    </button>
                  ))}
                </div>

                <div className={styles.envGroup} role="radiogroup" aria-label="Lighting">
                  <span className={styles.envLabel}>Light</span>
                  {LIGHTING_OPTIONS.map(({ key, name, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={options.lighting === key}
                      aria-label={name}
                      title={name}
                      className={options.lighting === key ? styles.envActive : ''}
                      onClick={() => update('lighting', key)}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>


                  </>
                )}
              </div>
              <button
                className={styles.iconButton}
                aria-label={expanded ? 'Exit expanded view' : 'Expand simulator'}
                onClick={() => setExpanded(v => !v)}
              >
                {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            </div>

            {/* Two docks, one per bottom corner: what you change on the left,
                what you read on the right. Nothing sits over the road itself. */}
            {/* One menu holds every option; the stage keeps only the two things
                you touch mid-run (play/pause, restart) and the speed readout. */}


            <div className={styles.dockLeft} data-dock>
              {settingsOpen && (
                <div className={styles.settingsPanel} role="dialog" aria-label="Simulator settings">
                  <SettingRow label="Pacing">
                    {(Object.keys(BEHAVIORS) as Behavior[]).map(key => (
                      <Chip key={key} active={options.behavior === key} onClick={() => update('behavior', key)}>
                        {BEHAVIORS[key].name}
                      </Chip>
                    ))}
                  </SettingRow>

                  <SettingRow label="Overlays">
                    <Chip active={options.path} onClick={() => update('path', !options.path)}>
                      <Route size={13} /> Route
                    </Chip>
                    <Chip active={options.perception} onClick={() => update('perception', !options.perception)}>
                      <ScanLine size={13} /> Lane lines
                    </Chip>
                  </SettingRow>
                  <SettingRow label="Car colour" value={CAR_COLORS.find(c => c.hex === options.carColor)?.name}>
                    {CAR_COLORS.map(color => (
                      <button
                        key={color.id}
                        type="button"
                        role="radio"
                        aria-checked={options.carColor === color.hex}
                        aria-label={color.name}
                        title={color.name}
                        className={`${styles.colorSwatch} ${options.carColor === color.hex ? styles.colorSwatchActive : ''}`}
                        style={{ background: color.hex }}
                        onClick={() => update('carColor', color.hex)}
                      />
                    ))}
                  </SettingRow>

                </div>
              )}

              <div className={styles.dockPill}>
                <button
                  type="button"
                  className={styles.pillSettings}
                  aria-expanded={settingsOpen}
                  aria-haspopup="dialog"
                  onClick={() => setOpenMenu(settingsOpen ? null : 'settings')}
                >
                  <Car size={15} />
                  <b>Car</b>
                  <ChevronUp size={13} className={settingsOpen ? styles.chevronOpen : ''} />
                </button>
                <span className={styles.pillDivider} />
                <button
                  type="button"
                  className={styles.pillGhost}
                  aria-label="Skip back 200 metres"
                  onClick={() => skipRef.current?.(-SKIP_METRES)}
                >
                  <SkipBack size={13} />
                </button>
                <button
                  type="button"
                  className={styles.pillPrimary}
                  aria-label={options.playing ? 'Pause simulation' : 'Play simulation'}
                  onClick={() => update('playing', !options.playing)}
                >
                  {options.playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                </button>
                <button
                  type="button"
                  className={styles.pillGhost}
                  aria-label="Skip forward 200 metres"
                  onClick={() => skipRef.current?.(SKIP_METRES)}
                >
                  <SkipForward size={13} />
                </button>
                <button type="button" className={styles.pillGhost} aria-label="Restart simulation" onClick={restart}>
                  <RotateCcw size={13} />
                </button>
                <button
                  type="button"
                  className={styles.pillRate}
                  aria-label={`Playback speed ${options.rate}×, tap to change`}
                  onClick={() => update('rate', RATES[(RATES.indexOf(options.rate) + 1) % RATES.length])}
                >
                  {options.rate}×
                </button>
              </div>
            </div>

            <div className={`${styles.dockRight} ${compact && settingsOpen ? styles.dockHidden : ''}`}>
              {!compact && (
                <div className={`${styles.envGroup} ${styles.cameraControls}`} role="radiogroup" aria-label="Camera view">
                  <span className={styles.envLabel}>Camera view</span>
                  {cameras.map(({ key, name, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={options.camera === key}
                      aria-label={name}
                      title={name}
                      className={options.camera === key ? styles.envActive : ''}
                      onClick={() => update('camera', key)}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>
              )}
              {compact && (
                <div className={styles.cameraDock} data-dock>
                  {cameraOpen && (
                    <div className={styles.dockMenu} role="radiogroup" aria-label="Camera view">
                      {cameras.map(({ key, name, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={options.camera === key}
                          className={options.camera === key ? styles.dockMenuActive : ''}
                          onClick={() => { update('camera', key); setOpenMenu(null); }}
                        >
                          <Icon size={15} />
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.dockPill}
                    aria-expanded={cameraOpen}
                    aria-haspopup="true"
                    aria-label={`Camera view: ${activeCamera.name}`}
                    onClick={() => setOpenMenu(cameraOpen ? null : 'camera')}
                  >
                    <Camera size={15} />
                    <b>View</b>
                    <span className={styles.cameraValue}>
                      <ActiveCameraIcon size={12} /> {activeCamera.name}
                    </span>
                    <ChevronUp size={13} className={cameraOpen ? styles.chevronOpen : ''} />
                  </button>
                </div>
              )}

              <div className={`${styles.dockPill} ${styles.readout}`}>
                <strong>{Math.round(toDisplaySpeed(telemetry.speed, unit))}</strong>
                <span>{unit}</span>
                <div className={styles.cruiseStepper}>
                  <button
                    type="button"
                    aria-label="Decrease cruise speed"
                    disabled={options.speed <= 15}
                    onClick={() => update('speed', stepSpeed(-1))}
                  >
                    −
                  </button>
                  <span>SET <b>{Math.round(toDisplaySpeed(options.speed, unit))}</b></span>
                  <button
                    type="button"
                    aria-label="Increase cruise speed"
                    disabled={options.speed >= scenario.maxSpeed}
                    onClick={() => update('speed', stepSpeed(1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className={styles.controls} aria-label="Driving models">
            <ModelAccordionSelector
              activeModelId={options.modelId}
              onSelectModel={selectModel}
            />
          </aside>
        </div>

        {/* Transport Controls */}
        <div className={styles.transport}>
          <div className={styles.routeProgress}>
            <div>
              <span>ROUTE PROGRESS</span>
              <b>{elapsed(telemetry.elapsed)} · {(telemetry.distance / 1000).toFixed(2)} km driven</b>
            </div>
            <progress value={telemetry.progress} max={1} aria-label="Route lap progress" />
          </div>
          <span className={styles.keyboard}>Space to {options.playing ? 'pause' : 'play'}</span>
        </div>

        <footer className={styles.footer}>
          <p>
            <TrafficCone size={15} />
            <span>Experimental playground · Feedback-based behavior approximation · Not actual model inference or measured performance.</span>
          </p>
          <Link href={embedded ? "/new-sim" : "/models"}>{embedded ? "Open standalone lab" : "Back to models"} <ArrowUpRight size={14} /></Link>
        </footer>
      </div>
    </div>
  );
}
