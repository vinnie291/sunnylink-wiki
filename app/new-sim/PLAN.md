# Driving Lab — model library integration

Standalone route: `/new-sim` (legacy `/sim-test` redirects here). Model cards retain their lightweight previews and open the lazy-loaded Driving Lab through an explicit **Try in simulator** action. Existing `/models?sim=model-slug` deep links open the same full-screen lab.

## First iteration
- Real 3D scene: metre-scale lane geometry sampled along an arc-length parameterized, closed centripetal spline. Continuous tangents and curvature-aware speed planning.
- Detailed procedural sedan, SUV, van, heavy truck and motorcycle meshes: shaped body and glass, steerable/rolling wheels, mirrors, lights and braking/turn-signal indication. No external model downloads.
- Deterministic 60 Hz simulation with independent lane streams, car following, queue formation, comfortable acceleration and braking, opposing traffic, protected cross traffic, amber / all-red clearance, and a two-second stop-sign dwell.
- Four distinct layouts, each with its own road geometry, lane layout, furniture and palette:
  - **City streets** — 1421 m of straight blocks joined by 46 m corners, one lane each way between parking strips, painted centre line, signals, crosswalks and a stop sign, buildings hard against the sidewalk.
  - **Open boulevard** — 3 km of open sweepers, two lanes each way around a planted median of palms, twin-head median lamps, pedestrian crossings, buildings set well back, widely spaced signals.
  - **Winding road** — 2.4 km of linked bends through woods, a single-track unmarked lane (6.8 m), gravel verge, staggered conifer ranks, rocks and reflector posts, trail crossings and rural stop-sign junctions, close haze.
  - **Highway** — a 6.2 km sweeping loop, five one-way lanes, concrete median barrier, overhead exit gantries and mile markers, no junctions.
- Behavior presets, density, car colour, speed, camera, route overlay, perception view, restart, pause and playback rate. Each layout offers only the road events it actually has.
- Responsive lab UI with speed, following distance, steering, acceleration, route progress and recent speed trace. Reduced-motion support, offscreen / background suspension, WebGL fallback and explicit resource disposal.

## Second iteration — Empirical Calibration, Crosswalk Pedestrians & Turn Intent
- **Empirical `ModelDataV2` kinematic calibration & provenance**:
  - Speed-dependent front-wheel steering rate & lateral-jerk bounds matching openpilot EPS / `ModelDataV2` envelopes, architecture-era priors (`chestnut_gpu`, `world_2026`, `opm`, `comfort`, `aggressive_exp`), and S-curve stop-line deceleration.
  - Explicit `CalibrationProvenance` surfaced on every profile (`Recorded ModelDataV2 Replay`, `Poll + Feedback Calibrated`, `Feedback-Derived Approximation`, or `Baseline Era Defaults`) in `ModelBehaviorReadout` so users know exact evidence backing vs neutral defaults.
- **Deterministic crosswalk pedestrians**:
  - Signal-synchronized urban crosswalks and midblock/rural crossings with 3D procedural walking figures and painted zebra stripes.
  - Both ego and traffic smoothly yield before the crosswalk yield bar when pedestrians are approaching or crossing, with zero pedestrian-vehicle conflicts across 30/60 Hz fixed-step replays.
- **Route-level maneuver & turn-intent lookahead**:
  - Real-time spline curvature & hazard lookahead (`Straight ahead`, `Sweeping left/right`, `Sharp left/right turn`, `Approaching stop`, `Yielding for pedestrian`) driving ego blinker indication, HUD maneuver status, and trajectory ribbon clamping.

## Validation
- `npm run build` — production build passed; `/new-sim` is statically prerendered with a lazy-loaded client renderer.
- `npx tsc --noEmit` and ESLint — passed.
- `node --import tsx scripts/sim/test-new-sim.ts` — checks continuous road seams, metre-scale sampling, protected signal phases, stop dwell / departure, red stop / green departure, crosswalk pedestrian yielding & zero-conflict safety, turn-intent curvature lookahead, dense traffic across multiple laps, and deterministic 30/60 fps stepping.
- `node --import tsx scripts/sim/test-model-behavior.ts` — evidence parsing, provenance tiers, stationary stability, model-specific departures and controlled following gaps, stop policies, and full model/road runs at maximum selectable cruise speed with zero lane containment corrections.
