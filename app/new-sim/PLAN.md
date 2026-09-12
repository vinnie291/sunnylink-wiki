# Driving Lab — model library integration

Standalone route: `/new-sim`. Model cards retain their lightweight previews and open the lazy-loaded Driving Lab through an explicit **Try in simulator** action. Existing `/models?sim=model-slug` deep links open the same full-screen lab.

## First iteration
- Real 3D scene: metre-scale lane geometry sampled along an arc-length parameterized, closed centripetal spline. Continuous tangents and curvature-aware speed planning.
- Detailed procedural sedan, SUV and van meshes: shaped body and glass, wheels, mirrors, lights and braking indication. No external model downloads.
- Deterministic 60 Hz simulation with independent lane streams, car following, queue formation, comfortable acceleration and braking, opposing traffic, protected cross traffic, amber / all-red clearance, and a two-second stop-sign dwell.
- Four distinct layouts, each with its own road geometry, lane layout, furniture and palette:
  - **City streets** — 1421 m of straight blocks joined by 46 m corners, one lane each way between parking strips, painted centre line, signals and a stop sign, buildings hard against the sidewalk.
  - **Open boulevard** — 3 km of open sweepers, two lanes each way around a planted median of palms, twin-head median lamps, buildings set well back, widely spaced signals.
  - **Winding road** — 2.4 km of linked bends through woods, a single-track unmarked lane (6.8 m), gravel verge, staggered conifer ranks, rocks and reflector posts, rural stop-sign crossings, close haze.
  - **Highway** — a 6.2 km sweeping loop, five one-way lanes, concrete median barrier, overhead exit gantries and mile markers, no junctions.
- Behavior presets, density, car colour, speed, camera, route overlay, perception view, restart, pause and playback rate. Each layout offers only the road events it actually has.
- Responsive lab UI with speed, following distance, steering, acceleration, route progress and recent speed trace. Reduced-motion support, offscreen / background suspension, WebGL fallback and explicit resource disposal.

## Scope and interpretation
This is a procedural traffic simulation, not real traffic telemetry or model inference. The 127 profiles use the existing `data/models.json`: explicit community feedback and steering descriptions tune centering, lateral response, following headway, acceleration, braking, and stop/go timing. Negated and resolved faults are excluded. Overall sentiment only moderates explicitly described faults. Missing traits use neutral defaults. These are illustrative synthetic drivers, not measured model outputs or safety assessments.

The kinematic bicycle controller integrates front-wheel steering, yaw and lateral displacement. Damped steering, delay-aware curve anticipation, and small slow target oscillations retain reported ping-pong without creating unstable lane-edge bouncing. Shared containment is separately counted in the readout.

The native full-screen dialog contains focus, restores focus and scrolling on close, and unmounts/disposes the scene. Previous/next and the model selector preserve scenario, traffic, camera and cruise settings while restarting the vehicle. Sharing uses the selected model’s existing `?sim=` URL (environment settings are session-only).

## Validation
- `npm run build` — production build passed; `/new-sim` is statically prerendered with a lazy-loaded client renderer.
- `npx tsc --noEmit` and targeted ESLint — passed.
- `node --import tsx scripts/sim/test-new-sim.ts` — checks continuous road seams, metre-scale sampling, protected signal phases, stop dwell / departure, red stop / green departure, dense traffic across multiple laps, signal entries, intersection conflicts, and deterministic 30/60 fps stepping.
- Browser review — city and winding scenes, all camera modes, scenario and event selection, pause, density, cruise speed, playback rate and overlays verified. 390px mobile layout has no horizontal overflow.
- `node --import tsx scripts/sim/test-model-behavior.ts` — evidence parsing, stationary stability, model-specific departures and controlled following gaps, all 127 stop policies, and 508 model/road runs at maximum selectable cruise speed with no lane containment corrections.
- Existing build-time Discourse fetch warnings (rate limits / a missing topic) do not block the build.

## Following iterations
Add pedestrians and route-level turning intent; calibrate behavior against actual route recordings. Elevation, map ingestion and weather are future extensions.
