'use client';

/**
 * UnifiedDriveSimulation — Canvas2D drive simulator that renders the
 * synthetic routes (gauntlet/highway/curves/city) through openpilot's
 * real projection and rendering math.
 *
 * This replaces the SVG-based DriveSimulation for rendering, while
 * keeping the same profile-driven behavior (wobble, corner cutting,
 * lane offset, etc.). The output looks exactly like the real on-device
 * openpilot UI.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    hashSeed,
    ScenarioKey,
    Scenario,
    SCENARIOS,
    GAUNTLET_LOOP,
    GAUNTLET_CORNERS,
    GAUNTLET_EVENTS,
    CORNER_SPEED_FACTOR,
    RED_LIGHT_HOLD_S,
    pickScenarioKey,
} from '../lib/gauntletRoute';
import {
    generateSyntheticFrame,
    SYNTHETIC_CALIB,
    type RouteProfileParams,
} from '../lib/syntheticModelV2';
import {
    computeModelRenderFrame,
    drawModelRenderFrame,
} from '../lib/openpilotModelRenderer';
import type { DrivingProfile } from './DriveSimulation';

// Canvas dimensions (same 16:9 ratio as OpenpilotLogReplay)
const CANVAS_W = 800;
const CANVAS_H = 450;

// Speed unit detection (mirrors DriveSimulation)
type SpeedUnit = 'mph' | 'kph';
const MPH_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);
const MPH_TO_KPH = 1.609344;

function detectSpeedUnit(): SpeedUnit {
    if (typeof navigator === 'undefined') return 'mph';
    const lang = navigator.language || '';
    let region = '';
    try {
        const loc = new Intl.Locale(lang);
        region = (loc.maximize?.().region ?? '').toUpperCase();
    } catch { /* older browsers */ }
    if (!region) {
        const m = lang.match(/-([A-Z]{2})/i);
        region = m?.[1]?.toUpperCase() ?? '';
    }
    return MPH_REGIONS.has(region) ? 'mph' : 'kph';
}

const SPEED_LIMITS: Record<SpeedUnit, { min: number; max: number; step: number }> = {
    mph: { min: 25, max: 100, step: 5 },
    kph: { min: 40, max: 160, step: 10 },
};

function clampToStep(value: number, limits: { min: number; max: number; step: number }): number {
    const snapped = Math.round(value / limits.step) * limits.step;
    return Math.max(limits.min, Math.min(limits.max, snapped));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Props {
    profile: DrivingProfile;
    seedKey: string;
    scenarioOverride?: ScenarioKey;
    /** When true, skips the HUD overlay (for embedding in tight spaces) */
    hideHud?: boolean;
}

export default function UnifiedDriveSimulation({ profile, seedKey, scenarioOverride, hideHud }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [unit, setUnit] = useState<SpeedUnit>('mph');
    const limits = SPEED_LIMITS[unit];
    const [displaySpeed, setDisplaySpeed] = useState(() =>
        clampToStep(profile.speed, SPEED_LIMITS.mph)
    );

    // Refs for the animation loop (no teardown on changes)
    const profileRef = useRef(profile);
    const speedRef = useRef(displaySpeed);
    const unitRef = useRef(unit);
    const effectiveScenarioKey = scenarioOverride ?? profile.scenarioKey;
    const scenarioRef = useRef<Scenario>(SCENARIOS[effectiveScenarioKey]);

    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { speedRef.current = displaySpeed; }, [displaySpeed]);
    useEffect(() => { unitRef.current = unit; }, [unit]);
    useEffect(() => { scenarioRef.current = SCENARIOS[effectiveScenarioKey]; }, [effectiveScenarioKey]);

    // Detect speed unit
    useEffect(() => { setUnit(detectSpeedUnit()); }, []);

    // Resync display speed when profile or unit changes
    useEffect(() => {
        const nativeRaw = unit === 'mph' ? profile.speed : profile.speed * MPH_TO_KPH;
        setDisplaySpeed(clampToStep(nativeRaw, SPEED_LIMITS[unit]));
    }, [profile.speed, unit]);

    const adjustSpeed = (delta: number) =>
        setDisplaySpeed((s) => Math.max(limits.min, Math.min(limits.max, s + delta)));

    const seed = useMemo(() => hashSeed(seedKey), [seedKey]);

    // Visibility gate
    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }
        const io = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { rootMargin: '120px', threshold: 0.05 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Status text refs
    const statusRef = useRef<HTMLSpanElement>(null);
    const speedValRef = useRef<HTMLSpanElement>(null);
    const labelRef = useRef<HTMLSpanElement>(null);

    // ──────────────────────────── Draw a single frame ────────────────────────────
    const drawFrame = useCallback((
        scenario: Scenario,
        carZ: number,
        currentSpeedMph: number,
        stopped: boolean,
        frameTime: number,
        statusText: string,
        statusColor: string,
    ) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const prof = profileRef.current;

        // Generate a synthetic modelV2 frame from the route state
        const params: RouteProfileParams = {
            laneWobble: prof.laneWobble,
            laneOffset: prof.laneOffset,
            pathSmoothness: prof.pathSmoothness,
            cornerCutting: prof.cornerCutting,
            seed,
            speedMph: currentSpeedMph,
            stopped,
            calibHeight: SYNTHETIC_CALIB.height,
        };

        const frame = generateSyntheticFrame(scenario, carZ, params, frameTime);

        // Render through openpilot's real pipeline
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // Background gradient (sky → asphalt)
        const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        bg.addColorStop(0, '#0f172a');
        bg.addColorStop(0.35, '#1e293b');
        bg.addColorStop(0.5, '#1e293b');
        bg.addColorStop(1, '#0b1120');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const rpyCalib = SYNTHETIC_CALIB.rpyCalib;
        const pathOffsetZ = SYNTHETIC_CALIB.height;
        const renderFrame = computeModelRenderFrame(
            frame,
            rpyCalib,
            CANVAS_W,
            CANVAS_H,
            pathOffsetZ,
            8, // laneLineScale: boost lane line / edge ribbon width for visibility
        );
        drawModelRenderFrame(ctx, renderFrame, CANVAS_W, CANVAS_H);

        // Update HUD refs
        if (speedValRef.current) {
            const unitStr = unitRef.current;
            const displayVal = unitStr === 'mph' ? currentSpeedMph : currentSpeedMph * MPH_TO_KPH;
            speedValRef.current.textContent = Math.round(displayVal).toString();
        }
        if (statusRef.current) {
            statusRef.current.textContent = statusText;
            statusRef.current.style.color = statusColor;
        }
        if (labelRef.current) {
            labelRef.current.textContent = prof.label;
        }
    }, [seed]);

    // ──────────────────────────── Animation loop ────────────────────────────
    useEffect(() => {
        if (!isVisible) return;

        let raf = 0;
        let lastNow = 0;
        let carZ = 0;
        let currentSpeedMph = unitRef.current === 'mph'
            ? speedRef.current
            : speedRef.current / MPH_TO_KPH;
        let stopTime = 0;

        // Gauntlet event state
        let gLightPhase: 'approach' | 'yellow' | 'red' | 'go' = 'approach';
        let gLightT = 0;
        let gLightStopT = 0;
        let gSignStopT = 0;
        let gSignDone = false;
        let gLap = -1;

        const tick = (now: number) => {
            const profile = profileRef.current;
            const scenario = scenarioRef.current;
            const speed = speedRef.current;
            const speedMph = unitRef.current === 'mph' ? speed : speed / MPH_TO_KPH;

            if (!lastNow) lastNow = now;
            const dt = Math.min(0.05, (now - lastNow) / 1000);
            lastNow = now;

            let targetSpeedMph = speedMph;
            let statusText = 'SYSTEM ACTIVE';
            let statusColor = '#34d399';

            // ── Corner braking (all scenarios) ──
            if (scenario.key === 'gauntlet') {
                const routePos = ((carZ % GAUNTLET_LOOP) + GAUNTLET_LOOP) % GAUNTLET_LOOP;
                const lap = Math.floor(carZ / GAUNTLET_LOOP);

                // Reset event state on new lap
                if (lap !== gLap) {
                    gLap = lap;
                    gLightPhase = 'approach';
                    gLightT = 0;
                    gLightStopT = 0;
                    gSignStopT = 0;
                    gSignDone = false;
                }

                // Corner braking
                for (const c of GAUNTLET_CORNERS) {
                    const approach = c.start - 15;
                    if (routePos >= approach && routePos <= c.end) {
                        const factor = CORNER_SPEED_FACTOR[c.sharpness] ?? 0.7;
                        const brakeReliability = profile.cornerBrakeReliability;
                        const appliedFactor = factor + (1 - factor) * (1 - brakeReliability);
                        targetSpeedMph = Math.min(targetSpeedMph, speedMph * appliedFactor);
                        statusText = `🔄 SLOWING FOR CORNER S${c.sharpness}`;
                        statusColor = '#fbbf24';
                    }
                }

                // Red light (gauntlet event at ~95)
                const dToLight = GAUNTLET_EVENTS.redLightZ - routePos;
                if (routePos < GAUNTLET_EVENTS.redLightZ && dToLight < 30 && dToLight > 0) {
                    gLightT += dt;
                    if (gLightPhase === 'approach') {
                        // Approaching red — decelerate
                        const decel = clamp(dToLight / 25, 0, 1);
                        targetSpeedMph = Math.min(targetSpeedMph, speedMph * decel);
                        statusText = '🔴 APPROACHING RED LIGHT';
                        statusColor = '#f87171';
                        if (dToLight < 2) gLightPhase = 'red';
                    }
                } else if (gLightPhase === 'red') {
                    gLightStopT += dt;
                    targetSpeedMph = 0;
                    statusText = '🛑 STOPPED AT RED LIGHT';
                    statusColor = '#ef4444';
                    if (gLightStopT > RED_LIGHT_HOLD_S) {
                        gLightPhase = 'go';
                    }
                } else if (gLightPhase === 'go') {
                    targetSpeedMph = speedMph;
                    statusText = '🟢 GREEN — PROCEEDING';
                    statusColor = '#34d399';
                }

                // Stop sign (gauntlet event at ~368)
                if (!gSignDone) {
                    const dToSign = GAUNTLET_EVENTS.stopSignZ - routePos;
                    if (dToSign > 0 && dToSign < 25) {
                        const decel = clamp(dToSign / 20, 0, 1);
                        targetSpeedMph = Math.min(targetSpeedMph, speedMph * decel);
                        statusText = '🛑 APPROACHING STOP SIGN';
                        statusColor = '#f87171';
                    } else if (dToSign <= 0 && dToSign > -5) {
                        gSignStopT += dt;
                        targetSpeedMph = 0;
                        statusText = '🛑 STOPPED AT STOP SIGN';
                        statusColor = '#ef4444';
                        if (gSignStopT > 2.0) {
                            gSignDone = true;
                        }
                    }
                }

                // Lead car following zone
                if (routePos < GAUNTLET_EVENTS.leadZoneEnd || routePos > GAUNTLET_EVENTS.leadZoneRestart) {
                    statusText = statusText === 'SYSTEM ACTIVE' ? '🚗 FOLLOWING LEAD' : statusText;
                    statusColor = statusColor === '#34d399' && statusText === '🚗 FOLLOWING LEAD' ? '#60a5fa' : statusColor;
                }
            } else {
                // Simple corner braking for non-gauntlet scenarios
                const curvature = Math.abs(scenario.heading(carZ));
                if (curvature > 0.1) {
                    const brakeFactor = Math.max(0.3, 1 - curvature * 2);
                    const reliability = profile.cornerBrakeReliability;
                    const applied = brakeFactor + (1 - brakeFactor) * (1 - reliability);
                    targetSpeedMph = Math.min(targetSpeedMph, speedMph * applied);
                    statusText = '🔄 NAVIGATING CURVE';
                    statusColor = '#fbbf24';
                }
            }

            // Smooth speed transitions
            const accelRate = 12; // mph/s
            const decelRate = 18; // mph/s
            if (currentSpeedMph < targetSpeedMph) {
                currentSpeedMph = Math.min(targetSpeedMph, currentSpeedMph + accelRate * dt);
            } else if (currentSpeedMph > targetSpeedMph) {
                currentSpeedMph = Math.max(targetSpeedMph, currentSpeedMph - decelRate * dt);
            }

            const stopped = currentSpeedMph < 1;
            if (stopped) stopTime += dt;
            else stopTime = 0;

            // Advance car position (mph → units/s, with scenario speed multiplier)
            const unitsPerSec = (currentSpeedMph / 60) * scenario.speedMul * 15;
            carZ += unitsPerSec * dt;

            // Draw
            drawFrame(
                scenario,
                carZ,
                currentSpeedMph,
                stopped,
                now / 1000,
                statusText,
                statusColor,
            );

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [isVisible, seed, drawFrame]);

    return (
        <div
            ref={containerRef}
            className="force-dark relative w-full overflow-hidden rounded-xl bg-slate-950"
            style={{ aspectRatio: '16 / 9' }}
        >
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 w-full h-full"
                aria-label="Synthetic route rendered through real openpilot model projection"
            />

            {/* Gradient overlay for readability */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/40 to-transparent" />

            {!hideHud && (
                <>
                    {/* Label badge */}
                    <div className="absolute left-3 top-3 select-none">
                        <span
                            ref={labelRef}
                            className="text-[10px] font-medium tracking-[0.2em] uppercase text-cyan-400 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
                        >
                            {profile.label}
                        </span>
                    </div>

                    {/* Speed + controls */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex items-center gap-6 select-none">
                        <button
                            type="button"
                            onClick={() => adjustSpeed(-limits.step)}
                            className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 backdrop-blur text-white text-2xl font-bold flex items-center justify-center transition-colors"
                            aria-label="Decrease speed"
                        >
                            −
                        </button>
                        <div className="text-center">
                            <span
                                ref={speedValRef}
                                className="text-5xl font-bold text-white tabular-nums [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]"
                            >
                                {displaySpeed}
                            </span>
                            <div className="text-xs tracking-[0.3em] uppercase text-white/60 mt-0.5">
                                {unit}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => adjustSpeed(limits.step)}
                            className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 backdrop-blur text-white text-2xl font-bold flex items-center justify-center transition-colors"
                            aria-label="Increase speed"
                        >
                            +
                        </button>
                    </div>

                    {/* Status text */}
                    <div className="absolute top-[58%] left-1/2 -translate-x-1/2 select-none">
                        <span
                            ref={statusRef}
                            className="text-[10px] font-semibold tracking-wider uppercase [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]"
                            style={{ color: '#34d399' }}
                        >
                            SYSTEM ACTIVE
                        </span>
                    </div>

                    {/* Renderer badge */}
                    <div className="pointer-events-none absolute right-3 top-3 select-none">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 text-[9px] font-mono text-emerald-300/80 backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            REAL RENDERER
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
