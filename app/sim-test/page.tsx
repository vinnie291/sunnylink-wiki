'use client';

// TEST-ONLY page (not linked in nav): THREE-way comparison of the driving
// simulator renderers.
//   /sim-test
//
// LEFT:   OLD synthetic simulator (SVG-based DriveSimulation)
// CENTER: NEW unified renderer (synthetic route → real openpilot Canvas2D)
// RIGHT:  Real modelV2 replay (recorded route from public openpilotci)

import { useMemo, useState } from 'react';
import DriveSimulation, { deriveDrivingProfile } from '@/components/DriveSimulation';
import UnifiedDriveSimulation from '@/components/UnifiedDriveSimulation';
import RealModelSimulation from '@/components/RealModelSimulation';
import type { ScenarioKey } from '@/lib/gauntletRoute';

// A few representative synthetic "models" to feed the simulators.
const SAMPLE_MODELS = [
  {
    name: 'Smooth Highway Model',
    tags: ['Highway'],
    steeringFeel: 'Ultra-Smooth',
    communityScore: 82,
    positives: ['stable highway speed matching', 'smooth stops behind leads'],
    negatives: [],
  },
  {
    name: 'Twitchy City Model',
    tags: ['City'],
    steeringFeel: 'Twitchy',
    communityScore: 41,
    positives: ['quick acceleration'],
    negatives: ['late lane corrections', 'hugs left'],
  },
  {
    name: 'Curve Carver',
    tags: ['Curves'],
    steeringFeel: 'Confident',
    communityScore: 70,
    positives: ['good 90-degree turn handling', 'slows for curves'],
    negatives: [],
  },
  {
    name: 'Gauntlet Stress Test',
    tags: ['Off-Policy'],
    steeringFeel: 'Balanced',
    communityScore: 60,
    positives: ['consistent braking'],
    negatives: ['ping-pong', 'wobble'],
  },
];

const SCENARIO_OPTIONS: { key: ScenarioKey; label: string }[] = [
  { key: 'gauntlet', label: '🎯 Gauntlet' },
  { key: 'highway', label: '🛣️ Highway' },
  { key: 'curves', label: '🔄 Curves' },
  { key: 'city', label: '🏙️ City' },
];

export default function SimTestPage() {
  const [modelIdx, setModelIdx] = useState(0);
  const [scenarioOverride, setScenarioOverride] = useState<ScenarioKey | null>(null);
  const model = SAMPLE_MODELS[modelIdx];
  const profile = useMemo(() => deriveDrivingProfile(model), [model]);

  return (
    <div className="force-dark min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-semibold">
          Simulator A/B/C — synthetic SVG vs unified renderer vs real modelV2
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Test-only page. Compare the old SVG simulator, the new unified renderer
          (synthetic route → real openpilot math), and a real recorded{' '}
          <code className="text-emerald-300">modelV2</code> stream.
        </p>

        {/* Model selector */}
        <div className="mt-4 flex flex-wrap gap-2">
          {SAMPLE_MODELS.map((m, i) => (
            <button
              key={m.name}
              onClick={() => setModelIdx(i)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                i === modelIdx
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Scenario override */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider">Scenario:</span>
          <button
            onClick={() => setScenarioOverride(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              scenarioOverride === null
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Auto
          </button>
          {SCENARIO_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setScenarioOverride(s.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                scenarioOverride === s.key
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* OLD: SVG synthetic simulator */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                OLD · SVG synthetic
              </span>
              <span className="text-xs text-slate-500">{model.name}</span>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-800">
              <DriveSimulation
                profile={profile}
                seedKey={model.name}
                scenarioOverride={scenarioOverride ?? undefined}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Path/lanes generated from text-derived parameters (smoothness, wobble, offset).
              Custom SVG perspective rendering.
            </p>
          </section>

          {/* NEW: Unified renderer (synthetic route → real openpilot math) */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                NEW · unified renderer
              </span>
              <span className="text-xs text-slate-500">{model.name}</span>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl border border-cyan-800/40">
              <UnifiedDriveSimulation
                profile={profile}
                seedKey={model.name}
                scenarioOverride={scenarioOverride ?? undefined}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Same synthetic route, but rendered through openpilot&apos;s real
              <code className="text-cyan-300"> calcFrameMatrix</code> →{' '}
              <code className="text-cyan-300">drawModelRenderFrame</code> pipeline.
            </p>
          </section>

          {/* REAL: modelV2 replay */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                REAL · recorded modelV2
              </span>
              <span className="text-xs text-slate-500">recorded route</span>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-800">
              <RealModelSimulation src="/sim/demo_route.json" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Real predicted path, lane lines and road edges from a recorded openpilot drive,
              projected through the same renderer.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
