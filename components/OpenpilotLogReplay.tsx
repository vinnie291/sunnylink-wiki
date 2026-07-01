'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ParsedLog, ParsedModelV2, ParsedLiveCalibration } from '../lib/openpilotLog/parseLogFile';
import { computeModelRenderFrame, drawModelRenderFrame } from '../lib/openpilotModelRenderer';

const CANVAS_W = 800;
const CANVAS_H = 450;

// Finds the most recent sample at or before `targetTime`, or the first
// sample if the timeline hasn't reached any sample yet. Samples are sorted
// ascending by logMonoTime (parseLogFile guarantees this).
function findNearestSample<T extends { logMonoTime: bigint }>(samples: T[], targetTime: bigint): T | null {
    if (samples.length === 0) return null;
    let lo = 0, hi = samples.length - 1;
    if (targetTime <= samples[0].logMonoTime) return samples[0];
    if (targetTime >= samples[hi].logMonoTime) return samples[hi];
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (samples[mid].logMonoTime <= targetTime) lo = mid;
        else hi = mid - 1;
    }
    return samples[lo];
}

interface Props {
    log: ParsedLog;
}

export default function OpenpilotLogReplay({ log }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [playing, setPlaying] = useState(true);
    const [currentSec, setCurrentSec] = useState(0);
    const [sample, setSample] = useState<{ model: ParsedModelV2 | null; calib: ParsedLiveCalibration | null }>({
        model: null,
        calib: null,
    });

    const startTime = log.modelV2[0]?.logMonoTime ?? 0n;
    const endTime = log.modelV2[log.modelV2.length - 1]?.logMonoTime ?? 0n;
    const durationSec = Math.max(0.001, Number(endTime - startTime) / 1e9);

    const currentSecRef = useRef(currentSec);
    currentSecRef.current = currentSec;
    const playingRef = useRef(playing);
    playingRef.current = playing;

    const draw = useCallback((sec: number) => {
        const targetTime = startTime + BigInt(Math.max(0, Math.floor(sec * 1e9)));
        const model = findNearestSample(log.modelV2, targetTime);
        const calib = findNearestSample(log.liveCalibration, targetTime);
        setSample({ model, calib });

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !model) return;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        // sky/ground so an empty canvas doesn't read as broken while a log
        // loads — the real "road" comes entirely from the model's own
        // captured lane lines/road edges once a frame is drawn below.
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H / 2);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, CANVAS_H / 2, CANVAS_W, CANVAS_H / 2);

        const rpyCalib = calib?.rpyCalib ?? [0, 0, 0];
        const pathOffsetZ = calib?.height ?? 0;
        const frame = computeModelRenderFrame(model, rpyCalib, CANVAS_W, CANVAS_H, pathOffsetZ);
        drawModelRenderFrame(ctx, frame, CANVAS_W, CANVAS_H);
    }, [log, startTime]);

    // Playback loop — real-time replay of already-computed model output, so
    // (unlike live inference) there's no latency/frame-rate caveat here.
    useEffect(() => {
        let raf = 0;
        let lastNow = 0;
        const tick = (now: number) => {
            if (!lastNow) lastNow = now;
            const dt = (now - lastNow) / 1000;
            lastNow = now;

            if (playingRef.current) {
                let next = currentSecRef.current + dt;
                if (next >= durationSec) next = 0; // loop
                currentSecRef.current = next;
                setCurrentSec(next);
            }
            draw(currentSecRef.current);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [draw, durationSec]);

    const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sec = Number(e.target.value);
        setCurrentSec(sec);
        currentSecRef.current = sec;
        draw(sec);
    };

    return (
        <div className="force-dark relative w-full overflow-hidden rounded-lg bg-slate-950" style={{ aspectRatio: '16 / 9' }}>
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 w-full h-full"
                aria-label="Real model driving path, replayed from a recorded log"
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/45 to-transparent" />

            <div className="absolute left-3 top-3 select-none">
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-emerald-400 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                    REAL MODEL — RECORDED DRIVE
                </span>
            </div>

            {sample.model && (
                <div className="absolute right-3 top-3 select-none text-right">
                    <span className="text-[10px] font-mono text-slate-300/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                        frame {sample.model.logMonoTime.toString()}
                    </span>
                </div>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/40 px-3 py-2 backdrop-blur-sm">
                <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    className="pointer-events-auto shrink-0 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 text-white text-xs font-bold h-7 w-7 flex items-center justify-center transition-colors"
                    aria-label={playing ? 'Pause' : 'Play'}
                >
                    {playing ? '❚❚' : '▶'}
                </button>
                <input
                    type="range"
                    min={0}
                    max={durationSec}
                    step={durationSec / 500}
                    value={currentSec}
                    onChange={onScrub}
                    className="pointer-events-auto flex-1 accent-cyan-400"
                    aria-label="Scrub playback position"
                />
                <span className="shrink-0 text-[10px] font-mono text-slate-300 tabular-nums">
                    {currentSec.toFixed(1)}s / {durationSec.toFixed(1)}s
                </span>
            </div>
        </div>
    );
}
