'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTransform,
  polyToSvgPoints,
  projectFrame,
  type ProjectedFrame,
  type Rect,
  type RouteData,
} from './realsim/projection';

// Projection rect = full camera-fit space (matches the on-device UI geometry).
const RECT: Rect = { x: 0, y: 0, width: 400, height: 225 };
// Visible viewBox = a 16:9 window cropped to the road band so the horizon sits
// near the top (parity with the old simulator) instead of under a tall sky.
const VIEW = { x: 70, y: 128, w: 260, h: 146 };

interface Props {
  // URL of a JSON produced by scripts/sim/extract_modelv2.py
  src?: string;
  // or pass already-loaded data directly
  data?: RouteData;
  paused?: boolean;
}

/**
 * Replays a real recorded modelV2 stream (predicted path + lane lines + road
 * edges) onto a virtual road, reprojected with the exact openpilot math in
 * ./realsim/projection.ts. This is the "new" simulator — driven by real model
 * output instead of synthetic profile parameters.
 */
export default function RealModelSimulation({ src = '/sim/demo_route.json', data, paused }: Props) {
  const [route, setRoute] = useState<RouteData | null>(data ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (data) {
      setRoute(data);
      return;
    }
    let alive = true;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: RouteData) => alive && setRoute(j))
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [src, data]);

  // car-space -> screen transform (calibration is constant for the route)
  const T = useMemo(
    () => (route ? buildTransform(route.camera, route.calib, RECT) : null),
    [route]
  );

  // playback clock: advance by wall-time so 1s real == 1s playback
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!route || paused) return;
    let raf = 0;
    const n = route.frames.length;
    const dt = 1000 / (route.fps || 20);
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      setFrameIdx(Math.floor(elapsed / dt) % n);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [route, paused]);

  const projected: ProjectedFrame | null = useMemo(() => {
    if (!route || !T) return null;
    const frame = route.frames[frameIdx];
    if (!frame) return null;
    return projectFrame(frame, route.calib, T, RECT);
  }, [route, T, frameIdx]);

  if (err) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-900 text-sm text-rose-300">
        Failed to load sim data: {err}
      </div>
    );
  }
  if (!route || !projected) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-900 text-sm text-slate-400">
        Loading recorded model…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-800 to-slate-950">
      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* asphalt */}
          <linearGradient id="rms-road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0b1120" />
          </linearGradient>
          {/* chosen-path fill — openpilot throttle green, fading toward horizon */}
          <linearGradient id="rms-path" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgb(13,248,122)" stopOpacity="0.55" />
            <stop offset="55%" stopColor="rgb(72,255,92)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="rgb(72,255,92)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="url(#rms-road)" />

        {/* road edges (red, alpha = 1 - std) */}
        {projected.edges.map((e, i) =>
          e.points.length ? (
            <polygon
              key={`edge-${i}`}
              points={polyToSvgPoints(e.points)}
              fill="rgb(255,0,0)"
              fillOpacity={Math.max(0, Math.min(1, 1 - e.std)) * 0.9}
            />
          ) : null
        )}

        {/* lane lines (white, alpha = prob clamped to 0.7) */}
        {projected.lanes.map((l, i) =>
          l.points.length ? (
            <polygon
              key={`lane-${i}`}
              points={polyToSvgPoints(l.points)}
              fill="rgb(255,255,255)"
              fillOpacity={Math.max(0, Math.min(0.7, l.prob))}
            />
          ) : null
        )}

        {/* chosen path */}
        {projected.path.length ? (
          <polygon points={polyToSvgPoints(projected.path)} fill="url(#rms-path)" />
        ) : null}
      </svg>

      <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] leading-tight text-emerald-300 backdrop-blur">
        <div>REAL modelV2 · {route.fps}Hz</div>
        <div className="text-slate-300">
          frame {frameIdx + 1}/{route.frames.length}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 max-w-[60%] truncate rounded-md bg-black/40 px-2 py-1 text-right font-mono text-[9px] text-slate-400 backdrop-blur">
        {route.route}
      </div>
    </div>
  );
}
