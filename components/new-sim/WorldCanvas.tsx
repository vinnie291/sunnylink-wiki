'use client';

import { useEffect, useRef, useState } from 'react';
import { Simulation, FIXED_STEP, type SimOptions, type Chapter, type Telemetry } from '@/lib/new-sim/simulation';
import { DrivingScene } from '@/lib/new-sim/scene';

interface Props {
  options: SimOptions;
  revision: number;
  chapter: Chapter;
  skipRef?: { current: ((metres: number) => void) | null };
  theme: 'dark' | 'light';
  onTelemetry: (value: Telemetry) => void;
}
export default function WorldCanvas({ options, revision, chapter, theme, skipRef, onTelemetry }: Props) {
  // 'auto' follows the wiki's own light/dark setting.
  const lighting: 'dark' | 'light' = options.lighting === 'auto' ? theme : options.lighting === 'night' ? 'dark' : 'light';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef(options);
  const onTelemetryRef = useRef(onTelemetry);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { onTelemetryRef.current = onTelemetry; }, [onTelemetry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let view: DrivingScene;
    const sim = new Simulation({ ...optionsRef.current, scenario: options.scenario, density: options.density }, chapter);
    try { view = new DrivingScene(canvas, sim, lighting); }
    // Renderer initialization is an external-system result reflected in the fallback UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch (error) { console.error('Driving Lab renderer failed', error); setError(true); return; }
    setError(false); setReady(true);
    let frame = 0, last = 0, accumulator = 0, lastUi = 0, visible = true;
    const resize = new ResizeObserver(([entry]) => { view.resize(entry.contentRect.width, entry.contentRect.height); view.update(0, optionsRef.current); });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; });
    observer.observe(canvas);
    const lost = (event: Event) => { event.preventDefault(); setError(true); cancelAnimationFrame(frame); };
    canvas.addEventListener('webglcontextlost', lost);
    const visibility = () => { last = 0; accumulator = 0; };
    document.addEventListener('visibilitychange', visibility);
    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      if (document.hidden || !visible) { last = 0; return; }
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      sim.options = { ...optionsRef.current, lighting: lighting === 'dark' ? 'night' : 'day' };
      if (sim.options.playing) {
        accumulator += dt * sim.options.rate;
        while (accumulator >= FIXED_STEP) { sim.step(); accumulator -= FIXED_STEP; }
      } else accumulator = 0;
      // Frames rarely land on a fixed step, so hand the renderer how far it is
      // between the last two: without this the traffic visibly stutters.
      view.update(dt, sim.options, sim.options.playing ? accumulator / FIXED_STEP : 1);
      if (now - lastUi > 120) { onTelemetryRef.current(sim.telemetry()); lastUi = now; }
    }
    onTelemetryRef.current(sim.telemetry());
    // Expose route skipping to the transport controls above.
    if (skipRef) skipRef.current = (metres: number) => { sim.skip(metres); onTelemetryRef.current(sim.telemetry()); };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect();
      canvas.removeEventListener('webglcontextlost', lost); document.removeEventListener('visibilitychange', visibility);
      if (skipRef) skipRef.current = null;
      view.dispose();
    };
  }, [options.scenario, options.density, revision, chapter, lighting, skipRef]);

  return <>
    <canvas ref={canvasRef} aria-label="3D driving simulation showing traffic, road curves, traffic lights and stop signs" style={{ display: 'block', width: '100%', height: '100%' }} />
    {(!ready || error) && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', background: 'var(--background)', color: 'var(--foreground)', textAlign: 'center', padding: 30 }} role="status">
      {error ? <><strong>The 3D view could not start.</strong><p>Enable hardware acceleration or try a browser with WebGL 2 support.</p><button onClick={() => window.location.reload()}>Reload simulator</button></> : <span>Building your surroundings…</span>}
    </div>}
  </>;
}
