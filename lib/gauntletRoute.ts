// Shared route/geometry primitives for the driving visualizers. Pure,
// DOM-free functions and constants only — no React, no refs, no
// DrivingProfile-driven behavior (that stays in components/DriveSimulation.tsx,
// which is the only consumer of the heuristic per-model reactions).

const TAU = Math.PI * 2;

// Cheap deterministic 32-bit hash → seed for per-model noise / scenario pick.
export function hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function smoothstep(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}

// Quintic polynomial (smootherstep) with C2 continuity (zero 1st & 2nd derivatives at boundaries)
// for continuous, curvature-smooth road easement transitions without angular kinks.
export function smootherstep(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return x * x * x * (x * (x * 6 - 15) + 10);
}

export type ScenarioKey = 'highway' | 'curves' | 'city' | 'gauntlet';

export interface Scenario {
    key: ScenarioKey;
    label: string;
    loopZ: number;
    speedMul: number;
    heading: (z: number) => number;
    x: (z: number) => number;
    relativeX: (carZ: number, d: number) => number;
}

export function buildScenario(
    key: ScenarioKey,
    label: string,
    loopZ: number,
    speedMul: number,
    headingFn: (z: number) => number,
): Scenario {
    // Trapezoid integration. Harmonic scenarios are odd-symmetric so their
    // integral closes to 0 naturally; designed routes (gauntlet) get a
    // constant-heading drift correction so x() stays periodic in loopZ.
    const TABLE_SIZE = 4096;
    const dz = loopZ / TABLE_SIZE;

    let drift = 0;
    for (let i = 0; i < TABLE_SIZE; i++) {
        drift += (headingFn(i * dz) + headingFn((i + 1) * dz)) * 0.5 * dz;
    }
    const correction = drift / loopZ;
    const heading = (z: number) => headingFn((((z % loopZ) + loopZ) % loopZ)) - correction;

    const table = new Float32Array(TABLE_SIZE + 1);
    let acc = 0;
    table[0] = 0;
    for (let i = 0; i < TABLE_SIZE; i++) {
        acc += (heading(i * dz) + heading((i + 1) * dz)) * 0.5 * dz;
        table[i + 1] = acc;
    }
    const x = (z: number) => {
        const period = (((z % loopZ) + loopZ) % loopZ);
        const idxF = period / dz;
        const i0 = Math.floor(idxF);
        const t = idxF - i0;
        return table[i0] * (1 - t) + table[i0 + 1] * t;
    };
    const relativeX = (carZ: number, d: number) =>
        x(carZ + d) - x(carZ) - d * heading(carZ);

    return { key, label, loopZ, speedMul, heading, x, relativeX };
}

function makeScenario(
    key: ScenarioKey,
    label: string,
    loopZ: number,
    speedMul: number,
    deadzone: number,
    harmonics: { n: number; amp: number }[],
): Scenario {
    const headingRaw = (z: number) => {
        const p = (((z % loopZ) + loopZ) % loopZ) / loopZ;
        return harmonics.reduce(
            (acc, { n, amp }) => acc + amp * Math.sin(TAU * n * p),
            0,
        );
    };
    const heading = (z: number) => {
        const raw = headingRaw(z);
        if (deadzone <= 0) return raw;
        const abs = Math.abs(raw);
        if (abs <= deadzone * 0.4) return 0;
        if (abs >= deadzone * 1.6) return Math.sign(raw) * (abs - deadzone);
        const t = (abs - deadzone * 0.4) / (deadzone * 1.2);
        return Math.sign(raw) * (abs - deadzone * 0.4) * smootherstep(t);
    };
    return buildScenario(key, label, loopZ, speedMul, heading);
}

// ── The Gauntlet — one designed route that stresses every behavior ──
// Corners of increasing sharpness, two traffic lights, a stop sign, a
// stopped-traffic zone, and a cut-in event, laid out along a single
// 440-unit loop.
export const GAUNTLET_LOOP = 440;

export interface GauntletCorner {
    start: number;
    end: number;
    curv: number;       // signed curvature (+ = right)
    sharpness: 1 | 2 | 3 | 4;
}

export const GAUNTLET_CORNERS: GauntletCorner[] = [
    { start: 45, end: 75, curv: 0.14, sharpness: 1 },   // gentle right
    { start: 110, end: 140, curv: -0.20, sharpness: 2 },  // medium left
    { start: 180, end: 205, curv: 0.28, sharpness: 3 },   // sharp right
    { start: 238, end: 252, curv: -0.22, sharpness: 2 },  // S-curve left…
    { start: 258, end: 272, curv: 0.22, sharpness: 2 },   // …then right
    { start: 305, end: 335, curv: -0.38, sharpness: 4 },  // hairpin left
];

export const GAUNTLET_EVENTS = {
    leadZoneEnd: 78,         // lead-follow demo until here (and after leadZoneRestart)
    leadZoneRestart: 398,
    redLightZ: 95,
    trafficZone: { carZ: 165, stopAt: 158.5, end: 178 },
    cutInZ: 215,
    greenLightZ: 288,
    stopSignZ: 368,          // straight after the hairpin (braking zone clears the exit ramp)
} as const;

// Per-sharpness corner speed factor (fraction of set speed a careful
// model slows to). Sharper corner → bigger required slowdown.
export const CORNER_SPEED_FACTOR: Record<number, number> = { 1: 0.85, 2: 0.65, 3: 0.45, 4: 0.32 };

// Minimum time the car holds at a stopped red light before the signal
// cycles to green — long enough to read as a real light rather than a
// momentary tap-stop. Shared by the city and gauntlet scenarios.
export const RED_LIGHT_HOLD_S = 3.5;

function gauntletHeading(z: number): number {
    // Smooth easement transition into each constant-curvature arc using
    // quintic smootherstep with a generous ramp distance (matching real highway clothoids).
    const RAMP = 14;
    let h = 0;
    for (const c of GAUNTLET_CORNERS) {
        if (z <= c.start - RAMP || z >= c.end + RAMP) continue;
        let w = 1;
        if (z < c.start) w = smootherstep((z - (c.start - RAMP)) / RAMP);
        else if (z > c.end) w = smootherstep(((c.end + RAMP) - z) / RAMP);
        h += c.curv * w;
    }
    return h;
}

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
    highway: makeScenario('highway', 'HIGHWAY', 220, 1.0, 0.08, [
        { n: 1, amp: 0.13 },
        { n: 2, amp: 0.08 },
        { n: 3, amp: 0.04 },
    ]),
    curves: makeScenario('curves', 'CURVES', 130, 0.85, 0.04, [
        { n: 1, amp: 0.22 },
        { n: 2, amp: 0.15 },
        { n: 3, amp: 0.08 },
    ]),
    city: makeScenario('city', 'CITY', 110, 0.55, 0.03, [
        { n: 1, amp: 0.08 },
        { n: 3, amp: 0.18 },
        { n: 5, amp: 0.10 },
    ]),
    gauntlet: buildScenario('gauntlet', 'GAUNTLET', GAUNTLET_LOOP, 0.7, gauntletHeading),
};

export function pickScenarioKey(name: string, tags: string[]): ScenarioKey {
    if (tags.includes('City')) return 'city';
    if (tags.includes('Curves')) return 'curves';
    if (tags.includes('Highway')) return 'highway';
    // Hash-based fallback so models without explicit road tags get variety
    // (each model deterministically lands on one scenario).
    const choices: ScenarioKey[] = ['highway', 'curves', 'city'];
    return choices[hashSeed(name) % 3];
}

// View geometry — three-lane road. The car (trajectory) sits in the MIDDLE lane,
// centered at viewport X = 200. Lane dividers run on BOTH sides of the car view.
export const VB_W = 400;
export const VB_H = 225;
export const HORIZON_Y = 88;
export const CAR_Y = VB_H;             // bottom edge
export const LANE_HALF_BOTTOM = 55;    // half of one lane's width at camera
export const LANE_HALF_TOP = 5;        // half of one lane's width
export const PERSPECTIVE_K = 1.6;

export const depthToYFrac = (d: number) => d / (d + PERSPECTIVE_K);
export const yFracToDepth = (yFrac: number) =>
    yFrac >= 1 ? Infinity : (yFrac * PERSPECTIVE_K) / (1 - yFrac);
export const laneHalfWidth = (yFrac: number) =>
    LANE_HALF_BOTTOM + (LANE_HALF_TOP - LANE_HALF_BOTTOM) * yFrac;
