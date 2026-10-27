'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import TranslatedText from '@/components/TranslatedText';
import { useTextTranslation } from '@/lib/i18n';
import { resolveModelMetadata } from '@/lib/modelMetadata';
import {
    LANE_WIDTH_M,
    TRAJECTORY_SCENARIOS,
    buildTrajectoryRun,
    type ExecutionKind,
    type ModelV2ReplaySnapshot,
    type TrajectoryScenario,
} from '@/lib/trajectory';
import replayData from '@/data/model_replays.json';
import { detectSpeedUnit, toDisplaySpeed, type SpeedUnit } from '@/lib/new-sim/units';

type ControllerView = 'plan' | 'highTorque' | 'torqueLimited' | 'compare';

const SCENARIOS = Object.keys(TRAJECTORY_SCENARIOS) as TrajectoryScenario[];

const CONTROLLERS: { id: ControllerView; label: string; hint: string }[] = [
    { id: 'plan', label: 'Ideal plan', hint: 'The exact path the neural network requests.' },
    { id: 'highTorque', label: 'High-torque / angle', hint: 'High-authority racks or tuned NNLC track the plan closely.' },
    { id: 'torqueLimited', label: 'Torque-limited EPS', hint: 'Steering rate / torque saturation: late turn-in causes a wide exit and understeer.' },
    { id: 'compare', label: 'Compare all', hint: 'Plan and both execution paths together.' },
];

// Lateral axis is exaggerated relative to forward distance so small offsets are visible.
const VIEW_W = 320;
const VIEW_H = 340;
const PX_PER_M_X = 13;
const PX_PER_M_Y = 4.2;
const CAR_Y = 270;
const AHEAD_M = 66;
const BEHIND_M = 14;

const COLORS = { plan: '#22d3ee', planAlt: '#4ade80', high: '#f8fafc', limited: '#f59e0b' };

type ReplayTable = Record<string, Partial<Record<TrajectoryScenario, ModelV2ReplaySnapshot>>>;
const REPLAYS = replayData as unknown as ReplayTable;

function accelColor(a: number) {
    return a < 0 ? '#f87171' : '#4ade80';
}

export default function ModelTrajectoryVisualizer({ modelName }: { modelName: string }) {
    const tx = useTextTranslation();
    const meta = useMemo(() => resolveModelMetadata(modelName), [modelName]);
    const profile = meta.telemetryProfile;
    const estimated = meta.inferredFields.includes('telemetryProfile');

    const [scenario, setScenario] = useState<TrajectoryScenario>('scurve');
    const [controller, setController] = useState<ControllerView>('compare');
    const [useReplay, setUseReplay] = useState(true);
    const [playing, setPlaying] = useState(true);
    const [unit, setUnit] = useState<SpeedUnit>('mph');
    const [currentTime, setCurrentTime] = useState(0);

    const replay = REPLAYS[meta.id]?.[scenario];
    const run = useMemo(
        () => buildTrajectoryRun(scenario, profile, useReplay ? replay : undefined),
        [scenario, profile, replay, useReplay],
    );

    const timeRef = useRef(0);
    const playingRef = useRef(playing);
    useEffect(() => { playingRef.current = playing; }, [playing]);
    const runRef = useRef(run);
    useEffect(() => {
        runRef.current = run;
        timeRef.current = 0;
    }, [run]);

    const [prevRun, setPrevRun] = useState(run);
    if (run !== prevRun) {
        setPrevRun(run);
        setCurrentTime(0);
    }

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const init = requestAnimationFrame(() => {
            setUnit(detectSpeedUnit());
            if (media.matches) {
                setPlaying(false);
                const t = runRef.current.duration * 0.42;
                timeRef.current = t;
                setCurrentTime(t);
            }
        });
        const onChange = () => { if (media.matches) setPlaying(false); };
        media.addEventListener('change', onChange);
        return () => { cancelAnimationFrame(init); media.removeEventListener('change', onChange); };
    }, []);

    useEffect(() => {
        let raf = 0, last = 0, lastPaint = 0;
        const tick = (now: number) => {
            raf = requestAnimationFrame(tick);
            if (document.hidden) { last = 0; return; }
            const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
            last = now;
            if (playingRef.current) {
                const r = runRef.current;
                timeRef.current += dt;
                if (timeRef.current >= r.duration) timeRef.current = 0;
                if (now - lastPaint >= 33) {
                    lastPaint = now;
                    setCurrentTime(timeRef.current);
                }
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const restart = useCallback(() => {
        timeRef.current = 0;
        setCurrentTime(0);
    }, []);

    // ── Current frame ─────────────────────────────────────────────────────
    const idx = Math.min(run.samples.length - 1, Math.max(0, Math.floor(currentTime / run.dt)));
    const cur = run.samples[idx];
    const camX = run.roadAt(cur.s);
    const px = (x: number) => VIEW_W / 2 + (x - camX) * PX_PER_M_X;
    const py = (s: number) => CAR_Y - (s - cur.s) * PX_PER_M_Y;

    const sampleS: number[] = [];
    for (let u = -BEHIND_M; u <= AHEAD_M; u += 3) sampleS.push(cur.s + u);
    const poly = (fn: (s: number) => number) => sampleS.map(s => `${px(fn(s)).toFixed(1)},${py(s).toFixed(1)}`).join(' ');
    const offsetLine = (off: number) => poly(s => run.roadAt(s) + off);
    const aheadS = sampleS.filter(s => s >= cur.s - 1);
    const aheadPoly = (fn: (s: number) => number) => aheadS.map(s => `${px(fn(s)).toFixed(1)},${py(s).toFixed(1)}`).join(' ');

    const egoKind: ExecutionKind | 'plan' = controller === 'plan' ? 'plan'
        : controller === 'highTorque' ? 'highTorque'
        : 'torqueLimited';
    const egoX = egoKind === 'plan' ? cur.plan : cur[egoKind];
    const egoVisualX = controller === 'compare' ? cur.torqueLimited : egoX;

    const showHigh = controller === 'highTorque' || controller === 'compare';
    const showLimited = controller === 'torqueLimited' || controller === 'compare';

    const edge = LANE_WIDTH_M * 1.5;
    const roadPoly = `${poly(s => run.roadAt(s) - edge - 0.4)} ${[...sampleS].reverse().map(s => `${px(run.roadAt(s) + edge + 0.4).toFixed(1)},${py(s).toFixed(1)}`).join(' ')}`;

    const speedDisplay = Math.round(toDisplaySpeed(cur.v / 0.44704, unit));
    const accelPct = Math.min(1, Math.abs(cur.a) / 3);

    const longLabel = run.longitudinalStyle === 'early'
        ? 'Early, gentle deceleration'
        : run.longitudinalStyle === 'late' ? 'Late, firm braking' : 'Standard braking';
    const creepNote = run.scenario === 'intersection' && run.stopOvershoot > 0.3
        ? `Creeps ≈${run.stopOvershoot.toFixed(1)} m past the stop line`
        : run.scenario === 'intersection' ? 'Holds at the stop line' : '';

    // Sparkline of desiredAcceleration over the whole run.
    const SW = 320, SH = 54;
    const step = Math.max(1, Math.floor(run.samples.length / 160));
    const spark = run.samples.filter((_, i) => i % step === 0)
        .map(s => `${((s.t / run.duration) * SW).toFixed(1)},${(SH / 2 - (Math.max(-3.5, Math.min(3.5, s.a)) / 3.5) * (SH / 2 - 3)).toFixed(1)}`).join(' ');

    const btn = 'inline-flex h-7 min-w-7 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300';

    const radioKeys = <T extends string>(list: T[], current: T, set: (v: T) => void) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
        const i = list.indexOf(current);
        const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % list.length
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + list.length - 1) % list.length : -1;
        if (next < 0) return;
        e.preventDefault();
        set(list[next]);
        (e.currentTarget.parentElement?.querySelectorAll('button')[next] as HTMLButtonElement | undefined)?.focus();
    };

    return (
        <div className="force-dark overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950 text-slate-200">
            {/* Scenario presets */}
            <div className="border-b border-white/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        <TranslatedText text="Trajectory & controller" />
                    </span>
                    <div className="flex gap-0.5">
                        <button type="button" className={btn} aria-label={tx(playing ? 'Pause trajectory animation' : 'Play trajectory animation')} onClick={() => setPlaying(p => !p)}>
                            {playing ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        <button type="button" className={btn} aria-label={tx('Restart trajectory animation')} onClick={restart}>
                            <RotateCcw size={13} />
                        </button>
                    </div>
                </div>
                <div role="radiogroup" aria-label={tx('Scenario preset')} className="grid grid-cols-3 gap-0.5 rounded-full bg-slate-800/80 p-0.5 ring-1 ring-white/10">
                    {SCENARIOS.map(id => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={scenario === id}
                            tabIndex={scenario === id ? 0 : -1}
                            onClick={() => setScenario(id)}
                            onKeyDown={radioKeys(SCENARIOS, scenario, setScenario)}
                            title={tx(TRAJECTORY_SCENARIOS[id].blurb)}
                            className={`h-7 truncate rounded-full px-1.5 text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 ${scenario === id ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-400 hover:text-white'}`}
                        >
                            <TranslatedText text={TRAJECTORY_SCENARIOS[id].label} />
                        </button>
                    ))}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400"><TranslatedText text={TRAJECTORY_SCENARIOS[scenario].blurb} /></p>
            </div>

            {/* Top-down 3-lane view */}
            <div className="relative bg-slate-900">
                <svg
                    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                    className="block h-auto w-full"
                    role="img"
                    aria-label={tx(`${modelName}: ${TRAJECTORY_SCENARIOS[scenario].label} trajectory, viewed from above. Lateral bias ${profile.lateralBias.toFixed(2)}, turn-in timing ${profile.turnInTiming.toFixed(2)}.`)}
                >
                    <defs>
                        <linearGradient id="traj-plan" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0" stopColor={COLORS.planAlt} />
                            <stop offset="1" stopColor={COLORS.plan} />
                        </linearGradient>
                    </defs>
                    <rect width={VIEW_W} height={VIEW_H} fill="#0f1b1a" />
                    <polygon points={roadPoly} fill="#27323f" />
                    <polyline points={offsetLine(-edge)} fill="none" stroke="#e2e8f0" strokeOpacity=".75" strokeWidth="1.6" />
                    <polyline points={offsetLine(edge)} fill="none" stroke="#e2e8f0" strokeOpacity=".75" strokeWidth="1.6" />
                    <polyline points={offsetLine(-LANE_WIDTH_M / 2)} fill="none" stroke="#cbd5e1" strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="10 9" />
                    <polyline points={offsetLine(LANE_WIDTH_M / 2)} fill="none" stroke="#cbd5e1" strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="10 9" />

                    {run.stopLineS !== undefined && py(run.stopLineS) > -10 && py(run.stopLineS) < VIEW_H && (
                        <g>
                            <line
                                x1={px(run.roadAt(run.stopLineS) - LANE_WIDTH_M / 2)} x2={px(run.roadAt(run.stopLineS) + LANE_WIDTH_M / 2)}
                                y1={py(run.stopLineS)} y2={py(run.stopLineS)} stroke="#f8fafc" strokeWidth="4"
                            />
                            <rect x={px(run.roadAt(run.stopLineS) - 0.95)} y={py(run.stopLineS + 9)} width={1.9 * PX_PER_M_X} height={4.5 * PX_PER_M_Y} rx="3" fill="#64748b" />
                        </g>
                    )}
                    {cur.lead !== undefined && (
                        <rect
                            x={px(run.roadAt(cur.lead)) - (0.95 * PX_PER_M_X)} y={py(cur.lead) - 4.5 * PX_PER_M_Y}
                            width={1.9 * PX_PER_M_X} height={4.5 * PX_PER_M_Y} rx="3" fill="#94a3b8"
                        />
                    )}

                    {/* Ideal plan — green/cyan spline */}
                    <polyline points={aheadPoly(run.planAt)} fill="none" stroke="url(#traj-plan)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".8" />
                    {showHigh && (
                        <polyline points={aheadPoly(s => run.execAt('highTorque', s))} fill="none" stroke={COLORS.high} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    {showLimited && (
                        <polyline points={aheadPoly(s => run.execAt('torqueLimited', s))} fill="none" stroke={COLORS.limited} strokeWidth="2.4" strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
                    )}

                    {/* Ego vehicle */}
                    <rect
                        x={px(egoVisualX) - 0.95 * PX_PER_M_X} y={CAR_Y - 2.25 * PX_PER_M_Y}
                        width={1.9 * PX_PER_M_X} height={4.5 * PX_PER_M_Y} rx="4" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1.2"
                    />
                </svg>
                <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-300">
                    {run.fromReplay ? <TranslatedText text="modelV2 replay" /> : <TranslatedText text="Simulated · lateral axis exaggerated" />}
                </div>
                <div className="pointer-events-none absolute right-2 top-2 text-right tabular-nums">
                    <span className="text-2xl font-semibold text-white">{speedDisplay}</span>
                    <span className="ml-1 text-[10px] text-slate-300">{unit}</span>
                </div>
            </div>

            {/* Controller toggle + legend */}
            <div className="space-y-2 border-t border-white/10 p-3">
                <div role="radiogroup" aria-label={tx('Chassis and controller simulation')} className="grid grid-cols-2 gap-1">
                    {CONTROLLERS.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={controller === c.id}
                            tabIndex={controller === c.id ? 0 : -1}
                            onClick={() => setController(c.id)}
                            onKeyDown={radioKeys(CONTROLLERS.map(x => x.id), controller, setController)}
                            title={tx(c.hint)}
                            className={`rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 ${
                                controller === c.id ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100' : 'border-slate-700/60 bg-slate-800/50 text-slate-300 hover:text-white'
                            }`}
                        >
                            <TranslatedText text={c.label} />
                        </button>
                    ))}
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                    <li className="flex items-center gap-1.5"><span className="h-1 w-5 rounded" style={{ background: `linear-gradient(90deg, ${COLORS.planAlt}, ${COLORS.plan})` }} /><TranslatedText text="Ideal model plan" /></li>
                    <li className="flex items-center gap-1.5"><span className="h-0.5 w-5" style={{ background: COLORS.high }} /><TranslatedText text="High-torque / angle (solid)" /></li>
                    <li className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: COLORS.limited }} /><TranslatedText text="Torque-limited EPS (dashed)" /></li>
                </ul>
                {scenario === 'scurve' && showLimited && (
                    <p className="text-[10px] text-amber-300/90">
                        <TranslatedText text={`Peak deviation from the plan on a torque-limited rack: ${run.maxTrackingError.toFixed(1)} m.`} />
                    </p>
                )}
                {replay && (
                    <label className="flex items-center gap-2 text-[10px] text-slate-300">
                        <input type="checkbox" checked={useReplay} onChange={e => setUseReplay(e.target.checked)} className="accent-cyan-400" />
                        <TranslatedText text={replay.label ?? 'Use recorded modelV2 replay snapshot'} />
                    </label>
                )}
            </div>

            {/* Longitudinal acceleration / braking indicator */}
            <div className="space-y-2 border-t border-white/10 p-3">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-bold uppercase tracking-widest text-slate-300"><TranslatedText text="Longitudinal · desiredAcceleration @ 20 Hz" /></span>
                    <span className="font-mono tabular-nums" style={{ color: accelColor(cur.a) }}>{cur.a >= 0 ? '+' : ''}{cur.a.toFixed(2)} m/s²</span>
                </div>
                <div
                    role="meter"
                    aria-label={tx('Desired acceleration')}
                    aria-valuemin={-3}
                    aria-valuemax={3}
                    aria-valuenow={Number(Math.max(-3, Math.min(3, cur.a)).toFixed(2))}
                    aria-valuetext={tx(`${cur.a < -0.1 ? 'Braking' : cur.a > 0.1 ? 'Accelerating' : 'Coasting'} ${Math.abs(cur.a).toFixed(1)} metres per second squared`)}
                    className="relative h-3 overflow-hidden rounded-full bg-slate-800"
                >
                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-500" />
                    <div
                        className="absolute inset-y-0 rounded-full transition-[width] duration-75"
                        style={{
                            background: accelColor(cur.a),
                            width: `${accelPct * 50}%`,
                            left: cur.a < 0 ? `${50 - accelPct * 50}%` : '50%',
                        }}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500"><span><TranslatedText text="Brake" /></span><span><TranslatedText text="Accelerate" /></span></div>

                <svg viewBox={`0 0 ${SW} ${SH}`} className="block h-auto w-full" role="img" aria-label={tx('Desired acceleration over the scenario')}>
                    <line x1="0" x2={SW} y1={SH / 2} y2={SH / 2} stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                    <polyline points={spark} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
                    <line x1={(cur.t / run.duration) * SW} x2={(cur.t / run.duration) * SW} y1="0" y2={SH} stroke="#22d3ee" strokeWidth="1.5" />
                </svg>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className={`rounded-full border px-2 py-0.5 font-semibold ${
                        run.longitudinalStyle === 'late' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                            : run.longitudinalStyle === 'early' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-600/50 bg-slate-800/60 text-slate-300'
                    }`}>
                        <TranslatedText text={longLabel} />
                    </span>
                    {creepNote && (
                        <span className={`rounded-full border px-2 py-0.5 font-semibold ${run.stopOvershoot > 0.3 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-slate-600/50 bg-slate-800/60 text-slate-300'}`}>
                            <TranslatedText text={creepNote} />
                        </span>
                    )}
                    {run.minGap !== undefined && (
                        <span className="rounded-full border border-slate-600/50 bg-slate-800/60 px-2 py-0.5 text-slate-300">
                            <TranslatedText text={`Closest gap ${Math.round(run.minGap)} m`} />
                        </span>
                    )}
                </div>
            </div>

            {/* Telemetry values driving the scene */}
            <details className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-400">
                <summary className="cursor-pointer py-1 text-slate-300"><TranslatedText text="Telemetry profile driving this scene" /></summary>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                    <dt><TranslatedText text="Lateral bias" /></dt><dd className="text-right text-slate-200">{profile.lateralBias.toFixed(2)}</dd>
                    <dt><TranslatedText text="Turn-in timing" /></dt><dd className="text-right text-slate-200">{profile.turnInTiming.toFixed(2)}</dd>
                    <dt><TranslatedText text="Longitudinal aggressiveness" /></dt><dd className="text-right text-slate-200">{profile.longitudinalAggressiveness.toFixed(2)}</dd>
                    <dt><TranslatedText text="Stop-line creep" /></dt><dd className="text-right text-slate-200">{profile.stopLineCreep.toFixed(2)}</dd>
                </dl>
                <p className="mt-2 leading-snug text-slate-500">
                    <TranslatedText text={estimated
                        ? 'Illustrative: values are estimated from community feedback, tags and polls — not recorded driving. Controller execution is a simplified saturation model.'
                        : 'Curated telemetry values. Controller execution is a simplified saturation model.'} />
                </p>
            </details>
        </div>
    );
}
