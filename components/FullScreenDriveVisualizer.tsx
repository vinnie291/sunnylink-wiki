'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Fuse from 'fuse.js';

import DriveSimulation, { deriveDrivingProfile, DrivingProfile } from './DriveSimulation';

interface SentimentData {
    great: number;
    good: number;
    ok: number;
    bad: number;
}

export interface VisualizerModel {
    name: string;
    tags?: string[];
    steeringFeel?: string;
    communityScore?: number;
    sentiment?: SentimentData;
    consensus?: string;
    badge?: string;
    positives?: string[];
    negatives?: string[];
}

type DrivingPersonality = 'aggressive' | 'standard' | 'relaxed';

// Mirrors the model-affecting subset of sunnylink.ai's Steering / Cruise / Visuals
// settings. Items that don't influence the visualizer are still surfaced (so the
// panel reads like the real settings) but only the wired-up ones are used to
// derive the live driving profile below.
interface SunnylinkSettings {
    // ── Steering ──
    cameraOffset: number;                 // -0.35..0.35 m  (live → laneOffset)
    madsEnabled: boolean;                 // visual parity only
    pauseLateralWithBlinker: boolean;     // visual parity only
    laneTurnDesires: boolean;             // visual parity only
    laneTurnSpeed: number;                // 0..50 mph  (visual parity)
    neuralNetworkLateralControl: boolean; // live → smoother path, less wobble
    selfTune: boolean;                    // live → less wobble
    // ── Cruise ──
    experimentalMode: boolean;            // live → small reaction-lag boost
    disengageCruiseOnAccelerator: boolean;// visual parity only
    drivingPersonality: DrivingPersonality; // live → followDistance + reactionLag
    // ── Visuals ──
    teslaRainbowMode: boolean;            // live → rainbow chosen-path
}

const DEFAULT_SETTINGS: SunnylinkSettings = {
    cameraOffset: 0,
    madsEnabled: true,
    pauseLateralWithBlinker: true,
    laneTurnDesires: false,
    laneTurnSpeed: 19,
    neuralNetworkLateralControl: false,
    selfTune: false,
    experimentalMode: false,
    disengageCruiseOnAccelerator: false,
    drivingPersonality: 'standard',
    teslaRainbowMode: false,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Props {
    isOpen: boolean;
    onClose: () => void;
    models: VisualizerModel[];
    initialModelName?: string;
}

export default function FullScreenDriveVisualizer({ isOpen, onClose, models, initialModelName }: Props) {
    const [mounted, setMounted] = useState(false);
    const [selectedName, setSelectedName] = useState<string>(initialModelName ?? models[0]?.name ?? '');
    const [settings, setSettings] = useState<SunnylinkSettings>(DEFAULT_SETTINGS);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (initialModelName) setSelectedName(initialModelName);
    }, [initialModelName]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [isOpen, onClose]);

    const selectedModel = useMemo(
        () => models.find((m) => m.name === selectedName) ?? models[0],
        [selectedName, models]
    );

    // Derive the live profile by layering model-affecting settings on top of
    // the model's base profile. Settings that don't directly drive the
    // visualizer (e.g. blinker pause) are intentionally ignored here.
    const profile = useMemo<DrivingProfile>(() => {
        if (!selectedModel) return deriveDrivingProfile({ name: '' });
        const base = deriveDrivingProfile(selectedModel);

        let pathSmoothness = base.pathSmoothness;
        let laneWobble = base.laneWobble;
        let followDistance = base.followDistance;
        let reactionLag = base.reactionLag;
        const pathColor = base.pathColor;

        if (settings.neuralNetworkLateralControl) {
            pathSmoothness = clamp(pathSmoothness + 0.15, 0, 1);
            laneWobble = clamp(laneWobble * 0.7, 0, 1);
        }
        if (settings.selfTune) {
            laneWobble = clamp(laneWobble * 0.5, 0, 1);
        }
        if (settings.experimentalMode) {
            // Experimental Mode reacts a touch quicker to road geometry.
            reactionLag = clamp(reactionLag - 0.05, 0, 1);
        }

        switch (settings.drivingPersonality) {
            case 'aggressive':
                followDistance = 0.3;
                reactionLag = clamp(reactionLag - 0.1, 0, 1);
                break;
            case 'relaxed':
                followDistance = 0.85;
                reactionLag = clamp(reactionLag + 0.15, 0, 1);
                break;
            // 'standard' leaves the base values
        }

        return {
            ...base,
            laneOffset: clamp(settings.cameraOffset / 0.35, -1, 1),
            pathSmoothness,
            laneWobble,
            followDistance,
            reactionLag,
            pathColor,
            rainbowMode: settings.teslaRainbowMode,
        };
    }, [selectedModel, settings]);

    if (!mounted || !isOpen || !selectedModel) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in duration-150">
            <header className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
                <span className="hidden sm:inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    <span aria-hidden>🛣️</span> Drive Visualizer
                </span>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <label className="text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Model</label>
                    <ModelSearchCombobox
                        models={models}
                        value={selectedModel.name}
                        onChange={setSelectedName}
                    />
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close fullscreen visualizer"
                    className="h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                {/* Settings sidebar — sits on the left on large screens, stacks below on mobile */}
                <aside className="order-2 lg:order-1 lg:w-[360px] lg:shrink-0 max-h-[55vh] lg:max-h-none overflow-y-auto border-t lg:border-t-0 lg:border-r border-slate-800 bg-slate-900/60">
                    <SettingsPanel
                        settings={settings}
                        onChange={setSettings}
                        modelName={selectedModel.name}
                    />
                </aside>

                <div className="order-1 lg:order-2 flex-1 min-h-0 flex items-center justify-center p-3 md:p-6 bg-slate-950">
                    <div
                        className="w-full"
                        style={{
                            aspectRatio: '16 / 9',
                            maxWidth: 'calc((100vh - 160px) * 16 / 9)',
                        }}
                    >
                        <DriveSimulation profile={profile} seedKey={selectedModel.name} />
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ───────────────────────────────────────── Model search combobox ─────────────────────────────────────────

function ModelSearchCombobox({
    models,
    value,
    onChange,
}: {
    models: VisualizerModel[];
    value: string;
    onChange: (name: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const fuse = useMemo(
        () => new Fuse(models, {
            keys: ['name', 'tags', 'badge', 'consensus'],
            threshold: 0.35,
            ignoreLocation: true,
            minMatchCharLength: 1,
        }),
        [models]
    );

    const results = useMemo(() => {
        const trimmed = query.trim();
        if (!trimmed) return [...models].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100);
        return fuse.search(trimmed).slice(0, 50).map((r) => r.item);
    }, [query, fuse, models]);

    // Keep the highlighted index in range when results change.
    useEffect(() => {
        if (highlight >= results.length) setHighlight(0);
    }, [results, highlight]);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const commit = (name: string) => {
        onChange(name);
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
        } else if (e.key === 'Enter') {
            if (open && results[highlight]) {
                e.preventDefault();
                commit(results[highlight].name);
            }
        } else if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setQuery('');
            }
        }
    };

    // Scroll the highlighted option into view.
    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    return (
        <div ref={wrapperRef} className="relative flex-1 max-w-md min-w-0">
            <div className="relative">
                <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    aria-controls="visualizer-model-listbox"
                    value={open ? query : value}
                    onFocus={() => { setOpen(true); setQuery(''); setHighlight(0); }}
                    onChange={(e) => { setOpen(true); setQuery(e.target.value); setHighlight(0); }}
                    onKeyDown={onKeyDown}
                    placeholder="Search models..."
                    className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-white text-sm rounded-lg pl-8 pr-9 py-2 truncate transition-colors"
                />
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {open && (
                <div
                    id="visualizer-model-listbox"
                    role="listbox"
                    ref={listRef}
                    className="absolute top-full left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-20"
                >
                    {results.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-slate-500 text-center">No models match &ldquo;{query}&rdquo;</div>
                    ) : (
                        results.map((m, i) => {
                            const active = i === highlight;
                            const selected = m.name === value;
                            return (
                                <button
                                    key={m.name}
                                    data-idx={i}
                                    role="option"
                                    aria-selected={selected}
                                    type="button"
                                    onMouseEnter={() => setHighlight(i)}
                                    onClick={() => commit(m.name)}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
                                        active ? 'bg-cyan-500/15 text-white' : 'text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    <span className="truncate flex items-center gap-2">
                                        {selected && (
                                            <svg className="shrink-0 w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        <span className="truncate">{m.name}</span>
                                    </span>
                                    {m.badge && (
                                        <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700">
                                            {m.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// ───────────────────────────────────────── Settings panel ─────────────────────────────────────────

function SettingsPanel({
    settings,
    onChange,
    modelName,
}: {
    settings: SunnylinkSettings;
    onChange: (s: SunnylinkSettings) => void;
    modelName: string;
}) {
    const update = <K extends keyof SunnylinkSettings>(key: K, val: SunnylinkSettings[K]) =>
        onChange({ ...settings, [key]: val });

    return (
        <div className="p-4 lg:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-white font-semibold text-base">Sunnylink Settings</h3>
                    <p className="text-xs text-slate-500 truncate">
                        Driving <span className="text-cyan-300 font-medium">{modelName}</span>
                    </p>
                </div>
                <button
                    onClick={() => onChange(DEFAULT_SETTINGS)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold border bg-slate-800 border-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                    Reset
                </button>
            </div>

            <Accordion title="Steering" icon="🛞" subtitle="Lateral control, lane changes, and steering behavior" defaultOpen>
                <Section label="Camera">
                    <Slider
                        label="Adjust Camera Offset"
                        min={-0.35}
                        max={0.35}
                        step={0.01}
                        unit="m"
                        decimals={2}
                        value={settings.cameraOffset}
                        onChange={(v) => update('cameraOffset', v)}
                        hint="Shift the model's center left (+) or right (–) of the lane."
                    />
                </Section>

                <Section label="Modular Assistive Driving System (MADS)">
                    <Toggle
                        label="Enable MADS"
                        value={settings.madsEnabled}
                        onChange={(v) => update('madsEnabled', v)}
                        hint="Enable the beloved MADS feature."
                    />
                </Section>

                <Section label="Blinker Control">
                    <Toggle
                        label="Pause Lateral Control with Blinker"
                        value={settings.pauseLateralWithBlinker}
                        onChange={(v) => update('pauseLateralWithBlinker', v)}
                        hint="Pause lateral control with blinker below the desired speed."
                    />
                </Section>

                <Section label="Lane Turn">
                    <Toggle
                        label="Use Lane Turn Desires"
                        value={settings.laneTurnDesires}
                        onChange={(v) => update('laneTurnDesires', v)}
                        hint="Plan a turn at the nearest drivable path with blinker on, ≤ 20 mph."
                    />
                    <div className={`transition-opacity ${settings.laneTurnDesires ? '' : 'opacity-40 pointer-events-none'}`}>
                        <Slider
                            label="Adjust Lane Turn Speed"
                            min={0}
                            max={50}
                            step={1}
                            unit="mph"
                            decimals={0}
                            value={settings.laneTurnSpeed}
                            onChange={(v) => update('laneTurnSpeed', v)}
                            hint="Maximum speed at which lane turn desires are active."
                        />
                    </div>
                </Section>

                <Section label="Path Tuning">
                    <Toggle
                        label="Neural Network Lateral Control"
                        value={settings.neuralNetworkLateralControl}
                        onChange={(v) => update('neuralNetworkLateralControl', v)}
                        hint="Smoother, more confident path. Live in the visualizer."
                        live
                    />
                    <Toggle
                        label="Self-Tune"
                        value={settings.selfTune}
                        onChange={(v) => update('selfTune', v)}
                        hint="Reduces lateral wobble over time. Live in the visualizer."
                        live
                    />
                </Section>
            </Accordion>

            <Accordion title="Cruise" icon="🛟" subtitle="Longitudinal control, speed limits, and cruise behavior">
                <Toggle
                    label="Experimental Mode"
                    value={settings.experimentalMode}
                    onChange={(v) => update('experimentalMode', v)}
                    hint="Slightly snappier reaction to road geometry."
                    live
                />
                <Toggle
                    label="Disengage Cruise on Accelerator Pedal"
                    value={settings.disengageCruiseOnAccelerator}
                    onChange={(v) => update('disengageCruiseOnAccelerator', v)}
                    hint="When enabled, pressing the accelerator disengages longitudinal control."
                />
                <Segmented
                    label="Driving Personality"
                    value={settings.drivingPersonality}
                    onChange={(v) => update('drivingPersonality', v)}
                    options={[
                        { value: 'aggressive', label: 'Aggressive' },
                        { value: 'standard', label: 'Standard' },
                        { value: 'relaxed', label: 'Relaxed' },
                    ]}
                    hint="Standard is recommended. Aggressive follows closer; Relaxed stays further back."
                    live
                />
            </Accordion>

            <Accordion title="Visuals" icon="🎨" subtitle="HUD overlays, alerts, and on-screen display elements">
                <Toggle
                    label="Tesla Rainbow Mode"
                    value={settings.teslaRainbowMode}
                    onChange={(v) => update('teslaRainbowMode', v)}
                    hint="A beautiful rainbow effect on the path the model wants to take. Does not affect driving."
                    live
                />
            </Accordion>

            <p className="text-[11px] text-slate-500 leading-relaxed pt-2">
                Use the <span className="text-slate-300">−</span> / <span className="text-slate-300">+</span> buttons on the simulator to change speed. Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300">Esc</kbd> to close.
            </p>
        </div>
    );
}

// ───────────────────────────────────────── Primitives ─────────────────────────────────────────

function Accordion({
    title,
    subtitle,
    icon,
    defaultOpen,
    children,
}: {
    title: string;
    subtitle?: string;
    icon?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(!!defaultOpen);
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
                aria-expanded={open}
            >
                <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold text-white text-sm">
                        {icon && <span aria-hidden>{icon}</span>}
                        <span>{title}</span>
                    </span>
                    {subtitle && <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{subtitle}</span>}
                </span>
                <svg
                    className={`shrink-0 w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>}
        </div>
    );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            {label && (
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">{label}</div>
            )}
            {children}
        </div>
    );
}

function Slider({
    label,
    value,
    min,
    max,
    step,
    unit,
    onChange,
    hint,
    decimals = 2,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (v: number) => void;
    hint?: string;
    decimals?: number;
}) {
    return (
        <div>
            <div className="flex justify-between items-baseline mb-1.5 gap-2">
                <label className="text-xs text-slate-300 font-medium">{label}</label>
                <span className="text-xs text-cyan-300 tabular-nums font-medium">
                    {value.toFixed(decimals)}{unit ? ` ${unit}` : ''}
                </span>
            </div>
            <input
                type="range"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
            />
            {hint && <p className="mt-1 text-[11px] text-slate-500 leading-snug">{hint}</p>}
        </div>
    );
}

function Toggle({
    label,
    value,
    onChange,
    hint,
    live,
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    hint?: string;
    live?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition-colors text-left"
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span>{label}</span>
                    {live && <LiveBadge />}
                </div>
                {hint && <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</div>}
            </div>
            <span
                className={`shrink-0 inline-flex h-5 w-9 rounded-full transition-colors ${value ? 'bg-cyan-500' : 'bg-slate-700'}`}
                aria-hidden
            >
                <span
                    className={`h-5 w-5 rounded-full bg-white shadow transform transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`}
                />
            </span>
        </button>
    );
}

function Segmented<T extends string>({
    label,
    value,
    onChange,
    options,
    hint,
    live,
}: {
    label: string;
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string }[];
    hint?: string;
    live?: boolean;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-xs text-slate-300 font-medium">{label}</label>
                {live && <LiveBadge />}
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-800/60 border border-slate-700/50">
                {options.map((opt) => {
                    const active = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                active
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'text-slate-400 hover:text-white border border-transparent'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
            {hint && <p className="mt-1 text-[11px] text-slate-500 leading-snug">{hint}</p>}
        </div>
    );
}

function LiveBadge() {
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
            Live
        </span>
    );
}
