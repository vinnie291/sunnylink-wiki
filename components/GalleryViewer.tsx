'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { computeModelRenderFrame, drawModelRenderFrame } from '../lib/openpilotModelRenderer';
import { GalleryRouteData } from '../lib/gallery/loadGalleryRoute';

const CANVAS_W = 800;
const CANVAS_H = 450;

interface Props {
    data: GalleryRouteData;
    label: string;
}

export default function GalleryViewer({ data, label }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [playing, setPlaying] = useState(true);
    const [currentSec, setCurrentSec] = useState(0);

    const durationSec = Math.max(0.001, data.frames.length / data.fps);

    const currentSecRef = useRef(currentSec);
    currentSecRef.current = currentSec;
    const playingRef = useRef(playing);
    playingRef.current = playing;

    const draw = useCallback((sec: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || data.frames.length === 0) return;

        const idx = Math.min(data.frames.length - 1, Math.max(0, Math.floor(sec * data.fps)));
        const model = data.frames[idx];

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H / 2);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, CANVAS_H / 2, CANVAS_W, CANVAS_H / 2);

        const frame = computeModelRenderFrame(model, data.calib.rpy, CANVAS_W, CANVAS_H, data.calib.height);
        drawModelRenderFrame(ctx, frame, CANVAS_W, CANVAS_H);
    }, [data]);

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
        <div className="force-dark relative w-full overflow-hidden rounded-xl bg-slate-950" style={{ aspectRatio: '16 / 9' }}>
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 w-full h-full"
                aria-label={`${label} driving path on the canonical test road`}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/45 to-transparent" />

            <div className="absolute left-3 top-3 select-none">
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-emerald-400 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                    {label}
                </span>
            </div>

            <div className="absolute right-3 top-3 select-none text-right">
                <span className="text-[10px] font-mono text-slate-300/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                    {data.route}
                </span>
            </div>

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
