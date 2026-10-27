'use client';
import TranslatedText from '@/components/TranslatedText';


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
                     <TranslatedText text={"Synthetic vs. Real Model Vision"} /> </h1>
                <p className="text-sm text-slate-400 max-w-3xl">
                     <TranslatedText text={"Two genuinely different things, side by side — not the same route."} /> </p>
            </div>

            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90 leading-relaxed">
                <strong className="text-amber-300"><TranslatedText text="What this actually is:" /></strong>{' '}
                <TranslatedText text="The left pane is this wiki's existing heuristic simulator: a hand-tuned animation that approximates a driving model's feel from community sentiment text on a synthetic test loop (the Gauntlet). It does not run any real model." />{' '}
                <TranslatedText text="The right pane replays a recorded openpilot drive. It decodes modelV2 messages from a real rlog/qlog file and renders them using a direct TypeScript port of openpilot's onroad rendering code. The path and lane lines are actual model output from a real road. The panes show different routes; this compares a heuristic simulation with actual model output, rather than matching frames." />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                             <TranslatedText text={"Synthetic — heuristic simulation"} /> </h2>
                    </div>
                    <DriveSimulation profile={profile} seedKey="model-replay-baseline" scenarioOverride="gauntlet" />
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                             <TranslatedText text={"Real model — recorded drive"} /> </h2>
                    </div>
                    {log ? (
                        <div className="space-y-2">
                            <OpenpilotLogReplay log={log} />
                            <button
                                type="button"
                                onClick={() => setLog(null)}
                                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                 <TranslatedText text={"← load a different log ("} />{fileName})
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
