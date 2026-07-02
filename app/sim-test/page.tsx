'use client';

// TEST-ONLY page (not linked in nav): compares the OLD synthetic simulator
// against the NEW simulator driven by a real recorded modelV2 stream.
//   /sim-test
// Data: public/sim/demo_route.json (commaai openpilotci public route),
// produced by scripts/sim/extract_modelv2.py.

import { useMemo, useState } from 'react';
import DriveSimulation, { deriveDrivingProfile } from '@/components/DriveSimulation';
import RealModelSimulation from '@/components/RealModelSimulation';

// A few representative synthetic "models" to feed the old simulator.
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
];

export default function SimTestPage() {
  const [modelIdx, setModelIdx] = useState(0);
  const model = SAMPLE_MODELS[modelIdx];
  const profile = useMemo(() => deriveDrivingProfile(model), [model]);

  return (
    <div className="force-dark min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold">Simulator A/B — synthetic vs real modelV2</h1>
        <p className="mt-1 text-sm text-slate-400">
          Test-only page. Left: existing procedural simulator. Right: new simulator replaying a
          real recorded <code className="text-emerald-300">modelV2</code> stream from a public
          openpilot route, reprojected with openpilot&apos;s own camera math.
        </p>

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

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                OLD · synthetic
              </span>
              <span className="text-xs text-slate-500">{model.name}</span>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-800">
              <DriveSimulation profile={profile} seedKey={model.name} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Path/lanes generated from text-derived parameters (smoothness, wobble, offset).
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                NEW · real modelV2
              </span>
              <span className="text-xs text-slate-500">recorded route</span>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-800">
              <RealModelSimulation src="/sim/demo_route.json" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Real predicted path, lane lines (opacity = model confidence) and road edges,
              projected exactly like the on-device UI.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
