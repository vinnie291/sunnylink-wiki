'use client';

import { useEffect, useId, useRef, useState, useMemo } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { ALL_MODEL_PROFILES, deriveModelSimProfile, withModelVotes } from '@/lib/new-sim/modelProfiles';
import type { ModelVoteSummary } from '@/lib/modelVotes';
import { DEFAULT_OPTIONS, FIXED_STEP, SCENARIOS, Simulation, type Scenario } from '@/lib/new-sim/simulation';
import { detectSpeedUnit, toDisplaySpeed, type SpeedUnit } from '@/lib/new-sim/units';
import { renderSvgFrame } from '@/lib/new-sim/svgProjection';

const ROADS: Scenario[] = ['highway', 'curves', 'city'];
const EMPTY_PROFILE = deriveModelSimProfile({ name: 'Unspecified model' });

/** Lightweight view of the same state and feedback profiles used by Driving Lab. */
export default function ModelSvgPreview({ modelName, votes }: { modelName: string; votes?: ModelVoteSummary }) {
  const id = useId().replace(/:/g, '');
  // Never parse translated prose or silently substitute another driving model.
  const model = useMemo(() => withModelVotes(ALL_MODEL_PROFILES.find(p => p.name === modelName) ?? EMPTY_PROFILE, votes), [modelName, votes]);
  const suggestedScenario: Scenario = model.rollingStop || Math.abs(model.curveLineBias) > .1 ? 'curves'
    : model.creepTendency || model.departureLag > .6 || model.wobbleSpeedBias < 0 ? 'city' : 'highway';
  const [scenario, setScenario] = useState<Scenario>(suggestedScenario);
  const [followDistance, setFollowDistance] = useState<1 | 2 | 3 | 4>(2);
  const [playing, setPlaying] = useState(true);
  const [restart, setRestart] = useState(0);
  const [unit, setUnit] = useState<SpeedUnit>('mph');
  const [speed, setSpeed] = useState(SCENARIOS[suggestedScenario].limit);
  const [readout, setReadout] = useState({ speed: 0, gap: '—', offset: '0 cm', status: 'Preparing preview', corrections: 0, cutIns: 0, laneChanges: 0 });
  const root = useRef<HTMLDivElement>(null);
  const road = useRef<SVGPathElement>(null), shoulder = useRef<SVGPathElement>(null), path = useRef<SVGPathElement>(null);
  const intersections = useRef<SVGGElement>(null);
  const markings = useRef<SVGGElement>(null), traffic = useRef<SVGGElement>(null), furniture = useRef<SVGGElement>(null);
  const wheel = useRef<SVGGElement>(null);
  const pathFade = useRef<SVGGElement>(null), leadArrow = useRef<SVGGElement>(null);
  const scenery = useRef<SVGGElement>(null);
  const laneLines = useRef<SVGGElement>(null), curveFill = useRef<SVGPathElement>(null);
  const settings = useRef({ playing, speed, unit, followDistance });
  useEffect(() => { settings.current = { playing, speed, unit, followDistance }; }, [playing, speed, unit, followDistance]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const initial = requestAnimationFrame(() => {
      setUnit(detectSpeedUnit());
      if (preference.matches) setPlaying(false);
    });
    const changed = () => { if (preference.matches) setPlaying(false); };
    preference.addEventListener('change', changed);
    return () => { cancelAnimationFrame(initial); preference.removeEventListener('change', changed); };
  }, []);

  useEffect(() => {
    const sim = new Simulation({ ...DEFAULT_OPTIONS, scenario, density: 45, previewTraffic: true, speed: settings.current.speed, followDistance: settings.current.followDistance, modelId: model.id },
      scenario === 'city' ? 'signal' : scenario === 'curves' ? model.rollingStop ? 'stop' : 'bend' : 'start', model);
    let visible = false, frame = 0, last = 0, accumulator = 0, lastPaint = 0, lastReadout = 0;
    let previousCutIns = 0, lastCutInTime = -10;
    const draw = () => {
      const svg = renderSvgFrame(sim);
      road.current?.setAttribute('d', svg.road); shoulder.current?.setAttribute('d', svg.shoulder); path.current?.setAttribute('d', svg.path);
      // Only numeric geometry and fixed literals enter these groups; no feedback text is HTML.
      if (intersections.current) intersections.current.innerHTML = svg.intersections;
      if (markings.current) markings.current.innerHTML = svg.markings;
      if (laneLines.current) laneLines.current.innerHTML = svg.laneLines;
      if (traffic.current) traffic.current.innerHTML = svg.traffic;
      if (furniture.current) furniture.current.innerHTML = svg.furniture;
      if (pathFade.current) pathFade.current.innerHTML = svg.pathFade;
      if (leadArrow.current) leadArrow.current.innerHTML = svg.leadArrow;
      if (scenery.current) scenery.current.innerHTML = svg.scenery;
      wheel.current?.setAttribute('transform', `translate(27 238) rotate(${-sim.ego.steeringAngle * 180 / Math.PI})`);
      // Fill from centre using actual front-wheel steering, positive = left.
      // 0.12 radians fills one half; stronger turns saturate at the bar's edge.
      const displacement = -Math.max(-1, Math.min(1, sim.ego.steeringAngle / .12)) * 74;
      const end = 240 + displacement;
      const endY = 251 + 4 * (displacement / 74) ** 2;
      curveFill.current?.setAttribute('d', `M240 251 Q${240 + displacement / 2} 251 ${end} ${endY}`);
    };
    const updateReadout = () => {
      const lead = sim.lead(sim.ego), offset = Math.round(Math.abs(sim.ego.lateral) * 100);
      if (sim.cutIns !== previousCutIns) { previousCutIns = sim.cutIns; lastCutInTime = sim.time; }
      setReadout({ speed: Math.round(toDisplaySpeed(sim.ego.speed / .44704, settings.current.unit)),
        gap: lead.gap < 150 ? `${Math.round(lead.gap)} m` : '—',
        offset: offset < 2 ? 'Centred' : `${offset} cm ${sim.ego.lateral > 0 ? 'L' : 'R'}`,
        status: sim.time - lastCutInTime < 4 ? 'Cut-in · adjusting gap' : sim.ego.speed < .2 ? 'Stopped' : sim.ego.braking ? 'Braking' : Math.abs(sim.road.curvatureSigned(sim.ego.s)) > .004 ? 'Following bend' : 'Following road',
        corrections: sim.interventions, cutIns: sim.cutIns, laneChanges: sim.laneChanges });
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) { last = 0; return; }
      const dt = last ? Math.min(.1, (now - last) / 1000) : 0;
      last = now;
      sim.options.speed = settings.current.speed;
      sim.options.followDistance = settings.current.followDistance;
      if (settings.current.playing) {
        accumulator += dt;
        while (accumulator >= FIXED_STEP) { sim.step(); accumulator -= FIXED_STEP; }
      } else accumulator = 0;
      // Physics remains at 60 Hz; small cards only need 30 visual updates per second.
      if (settings.current.playing && now - lastPaint >= 1000 / 30) { draw(); lastPaint = now; }
      if (now - lastReadout >= 200) { updateReadout(); lastReadout = now; }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; }, { rootMargin: '40px' });
    if (root.current) observer.observe(root.current);
    draw(); updateReadout(); frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [model, scenario, restart]);

  const changeScenario = (next: Scenario) => { setSpeed(SCENARIOS[next].limit); setScenario(next); };
  const button = 'inline-flex h-7 min-w-7 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300';
  return <div ref={root} className="force-dark bg-slate-950 text-slate-200" onClick={e => e.stopPropagation()}>
    <div className="relative aspect-video overflow-hidden">
      <svg viewBox="0 0 480 270" className="absolute inset-0 h-full w-full" role="img" aria-label={`${modelName}: illustrative ${SCENARIOS[scenario].name.toLowerCase()} driving preview`}>
        <defs>
          <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#0b192e"/><stop offset="1" stopColor="#24465a"/></linearGradient>
          <linearGradient id={`${id}-fade`} x2="0" y2="1"><stop offset=".28" stopColor="white" stopOpacity="0"/><stop offset=".48" stopColor="white"/></linearGradient>
          <mask id={`${id}-mask`}><rect width="480" height="270" fill={`url(#${id}-fade)`}/></mask>
        </defs>
        <rect width="480" height="270" fill={`url(#${id}-sky)`}/>
        <path d="M0 87 L37 75 L62 83 L99 66 L139 85 L183 76 L233 86 L285 70 L328 85 L371 74 L421 83 L459 69 L480 79 V110 H0Z" fill="#243e4c"/>
        <rect y="86" width="480" height="184" fill="#132c2b"/>
        <g mask={`url(#${id}-mask)`}>
          <path ref={shoulder} fill="#354447"/><path ref={road} fill="#27323f"/>
          <g ref={intersections}/><g ref={markings}/><path ref={path} fill="#2ddc73" fillOpacity=".28"/><g ref={pathFade}/>
          <g ref={laneLines}/>
        </g>
        <g ref={scenery}/>
        <g ref={traffic}/>
        <g ref={leadArrow}/>
        {/* Sign heads rise above the road horizon; the road fade would erase them. */}
        <g ref={furniture}/>
        <g ref={wheel} transform="translate(27 238)" fill="#f1f3f3">
          <path fillRule="evenodd" d="M0-12a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z M-7.4-6.8Q0-13 7.4-6.8Q9-4.8 7-4.7L-7-4.7Q-9-4.8-7.4-6.8Z M-8.8-1.8Q-5-2.4-3.2 1Q-1.4 5-3 8.6Q-9.8 6.6-8.8-1.8Z M8.8-1.8Q5-2.4 3.2 1Q1.4 5 3 8.6Q9.8 6.6 8.8-1.8Z"/>
        </g>
        <g aria-label="Steering amount: fills left or right from centre"><title>Steering amount · left / straight / right</title>
          <path d="M166 255 Q240 247 314 255" fill="none" stroke="white" strokeOpacity=".4" strokeWidth="8" strokeLinecap="round"/>
          <path ref={curveFill} d="M240 251 L240 251" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"/>
          <circle cx="240" cy="251" r="2.7" fill="#a9afad"/>
        </g>
      </svg>
      <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-cyan-100/80"><span className={`h-1.5 w-1.5 rounded-full ${playing ? 'bg-emerald-300' : 'bg-slate-400'}`}/>{playing ? 'Driving preview' : 'Paused'}</div>
      <div className="absolute left-1/2 top-[15%] -translate-x-1/2 text-center tabular-nums"><span className="text-4xl font-semibold tracking-tight text-white">{readout.speed}</span><span className="ml-1 text-[10px] text-slate-300">{unit}</span></div>
      <button type="button" aria-label={`Following distance: ${followDistance} of 4. Click to increase; cycles back to 1.`}
        title={`Following distance: ${['Close', 'Standard', 'Far', 'Farthest'][followDistance - 1]}`}
        onClick={() => setFollowDistance(n => (n % 4 + 1) as 1 | 2 | 3 | 4)}
        className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950/75 text-white transition-colors hover:bg-slate-800/95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
        <svg viewBox="0 0 32 42" className="h-10 w-8" fill="none" aria-hidden="true">
          {[0, 1, 2, 3].map(i => <rect key={i} x="8" y={2 + i * 5} width="16" height="2" rx="1" fill="currentColor" opacity={i >= 4 - followDistance ? 1 : .16}/>)}
          <g transform="translate(0 6)">
          <path d="M7 27V24L9.5 19H22.5L25 24V31H7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 24H23M10 31V33M22 31V33" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M10 27H12M20 27H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </g>
        </svg>
      </button>
    </div>
    <div className="space-y-2 border-t border-white/10 px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <div role="radiogroup" aria-label="Preview road" className="relative isolate grid grid-cols-3 rounded-full bg-slate-800/80 p-0.5 ring-1 ring-white/10">
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 -z-10 w-[calc((100%-4px)/3)] rounded-full bg-cyan-400/20 shadow-sm transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `translateX(${ROADS.indexOf(scenario) * 100}%)` }}/>
          {ROADS.map((r, index) => <button key={r} type="button" role="radio" aria-checked={scenario === r} tabIndex={scenario === r ? 0 : -1}
            onClick={() => changeScenario(r)} onKeyDown={e => {
              const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (index + 1) % 3 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (index + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : -1;
              if (next < 0) return;
              e.preventDefault(); changeScenario(ROADS[next]);
              (e.currentTarget.parentElement?.querySelectorAll('button')[next] as HTMLButtonElement)?.focus();
            }} className={`h-7 rounded-full px-2 text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 ${scenario === r ? 'text-cyan-100' : 'text-slate-400 hover:text-white'}`}>
            {r === 'curves' ? 'Curves' : r === 'city' ? 'City' : 'Highway'}
          </button>)}
        </div>
        <div className="flex gap-0.5"><button type="button" className={button} aria-label={playing ? 'Pause driving preview' : 'Play driving preview'} onClick={() => setPlaying(p => !p)}>{playing ? <Pause size={13}/> : <Play size={13}/>}</button><button type="button" className={button} aria-label="Restart driving preview" onClick={() => setRestart(n => n + 1)}><RotateCcw size={13}/></button></div>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 tabular-nums"><span>Gap <b className="font-medium text-slate-200">{readout.gap}</b></span><label className="flex items-center gap-1">Set <select aria-label="Preview cruise speed" className="rounded bg-slate-800 px-1 py-0.5 text-slate-200" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[25, 35, 40, 45, 55, 65, 75, 85].filter(s => s <= SCENARIOS[scenario].maxSpeed).map(s => <option key={s} value={s}>{Math.round(toDisplaySpeed(s, unit))} {unit}</option>)}</select></label></div>
      <div className="flex justify-between text-[9px] text-slate-400"><span>{readout.laneChanges} lane changes · {readout.cutIns} cut-ins</span><span>Same starting traffic</span></div>
      <p className="text-[9px] leading-4 text-slate-500">Feedback-based illustration · {model.evidenceCoverage.toLowerCase()} evidence · not recorded driving</p>
      <details className="text-[10px] text-slate-400">
        <summary className="cursor-pointer py-1 text-slate-300">Driving character · {model.steeringFeel}</summary>
        <p className="py-1">{model.headway.toFixed(1)}s following target · {model.departureLag.toFixed(1)}s launch delay · {model.jerkLimit < 2 ? 'Gentle' : model.jerkLimit > 3 ? 'Firm' : 'Balanced'} acceleration changes</p>
        <p className="pb-1">Try Curves for steering differences and City for stopping and launch. Highway cruising can look similar.</p>
        {model.evidence.slice(-4).map((e, i) => <p key={i} className="mb-1" title={e.quote}>{e.effect} <span className="text-slate-500">· {e.source}</span></p>)}
        <p className="text-slate-500">{model.sentiment?.votes ?? 0} overall votes. Overall votes only moderate reported faults; specific behavior polls influence the matching trait. Small polls have less influence. Similar evidence can produce similar driving.</p>
      </details>
    </div>
  </div>;
}
