'use client';

import { useState } from 'react';
import PageShell from '@/components/PageShell';
import DriveSimulation, { deriveDrivingProfile } from '@/components/DriveSimulation';
import OnroadLogSourcePanel from '@/components/OnroadLogSourcePanel';
import OpenpilotLogReplay from '@/components/OpenpilotLogReplay';
import type { ParsedLog } from '@/lib/openpilotLog/parseLogFile';

// A stand-in "stable benchmark" profile for the left/synthetic pane — this
// page is about comparing the *kind* of output (heuristic vs. real), not
// any one specific community model's rating.
const BASELINE_MODEL = {
    name: 'Synthetic Baseline',
    tags: ['Stable Benchmark'],
    communityScore: 80,
};

export default function ModelReplayClient() {
    const [log, setLog] = useState<ParsedLog | null>(null);
    const [fileName, setFileName] = useState('');
    const profile = deriveDrivingProfile(BASELINE_MODEL);

    return (
        <PageShell>
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
                    Synthetic vs. Real Model Vision
                </h1>
                <p className="text-sm text-slate-400 max-w-3xl">
                    Two genuinely different things, side by side — not the same route.
                </p>
            </div>

            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90 leading-relaxed">
                <strong className="text-amber-300">What this actually is:</strong> the left pane is
                this wiki&apos;s existing heuristic simulator — a hand-tuned animation that fakes how
                a driving model &quot;feels&quot; from community sentiment text, driving a synthetic
                hand-designed test loop (the &quot;Gauntlet&quot;). It is <em>not</em> running any real
                model. The right pane plays back a real recorded openpilot drive: it decodes the
                actual <code className="text-amber-100">modelV2</code> messages from a real{' '}
                <code className="text-amber-100">rlog</code>/<code className="text-amber-100">qlog</code>{' '}
                file and renders them with a direct TypeScript port of openpilot&apos;s own real
                onroad rendering code — so that path and those lane lines are the real model&apos;s
                real output on a real road, not a recreation. The two panes are different routes;
                this is a comparison of a heuristic stand-in versus genuine model output, not a
                frame-matched test.
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Synthetic — heuristic simulation
                        </h2>
                    </div>
                    <DriveSimulation profile={profile} seedKey="model-replay-baseline" scenarioOverride="gauntlet" />
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                            Real model — recorded drive
                        </h2>
                    </div>
                    {log ? (
                        <div className="space-y-2">
                            <OpenpilotLogReplay log={log} />
                            <button
                                type="button"
                                onClick={() => setLog(null)}
                                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                ← load a different log ({fileName})
                            </button>
                        </div>
                    ) : (
                        <div
                            className="force-dark relative w-full rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center"
                            style={{ aspectRatio: '16 / 9' }}
                        >
                            <div className="w-full max-w-sm px-6">
                                <OnroadLogSourcePanel onLoaded={(parsed, name) => { setLog(parsed); setFileName(name); }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
