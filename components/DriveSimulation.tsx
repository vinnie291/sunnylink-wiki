'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

interface SentimentData {
    great: number;
    good: number;
    ok: number;
    bad: number;
}

interface ModelLike {
    name: string;
    tags?: string[];
    steeringFeel?: string;
    communityScore?: number;
    sentiment?: SentimentData;
    consensus?: string;
    badge?: string;
    positives?: string[];
    negatives?: string[];
}

export interface DrivingProfile {
    speed: number;          // displayed mph
    pathSmoothness: number; // 0..1 (how cleanly the path lerps to target)
    laneWobble: number;     // 0..1 (random jitter amplitude)
    laneOffset: number;     // -1..1 (lateral bias relative to lane width)
    pathColor: string;      // chosen-path fill color
    followDistance: number; // 0..1 (1 = far)
    reactionLag: number;    // 0..1 (1 = late to react to curves)
    pathWidth: number;      // 0..1 (visual confidence)
    label: string;          // short personality tag
    rainbowMode?: boolean;  // when true the chosen-path fill cycles through hues
    curveStyle: number;     // -1..1 (>0 hugs apex, <0 drifts wide)
    scenarioKey: ScenarioKey;
    yoyoMode?: boolean;
    octagonalMode?: boolean;
    accelerationLag?: boolean;
    lateBraking?: boolean;
    creepMode?: 'creep' | 'fails_stop' | 'none';
    stopSignStops?: boolean;
    afraidOfGreen?: boolean;
    slowWheelReturn?: boolean;
    negatives?: string[];
    positives?: string[];
    // ── Behavior ratings (0..1, derived from community feedback phrases) ──
    cornerCutting: number;          // 1 = badly cuts corners / hugs apex inside
    longPingPong: number;           // 1 = severe speed/gap oscillation behind a lead
    trafficHandling: number;        // 1 = handles slower/stopped traffic well
    leadAccelResponse: number;      // 1 = accelerates promptly when lead pulls away
    cornerBrakeReliability: number; // 1 = reliably slows for corners
    lightStopReliability: number;   // 1 = reliably stops (and stays stopped) for lights
    wobbleSpeedBias: number;        // 1 = wobble worsens at high speed, -1 = at low speed
    slowWobble?: boolean;           // "drunk driver" slow ping-pong character
}

export function deriveDrivingProfile(model: ModelLike): DrivingProfile {
    const tags = model.tags || [];
    const feel = model.steeringFeel || '';
    const score = model.communityScore ?? 50;
    const consensus = (model.consensus || '').toLowerCase();
    const negs = (model.negatives || []).join(' ').toLowerCase();
    const pos = (model.positives || []).join(' ').toLowerCase();

    // --- speed ---
    let speed = 45;
    if (tags.includes('City')) speed = 30;
    else if (tags.includes('Comfort') || tags.includes('Eco')) speed = 40;
    else if (tags.includes('Highway') || tags.includes('Curves')) speed = 65;
    if (tags.includes('Aggressive') || tags.includes('Fast Long')) speed = 75;

    if (negs.includes('speeds aggressively') || negs.includes('aggressive speed')) {
        speed = Math.min(100, speed + 10);
    }

    // --- smoothness ---
    let smoothness = 0.7;
    if (feel === 'Ultra-Smooth') smoothness = 0.95;
    else if (feel === 'Balanced') smoothness = 0.85;
    else if (feel === 'Stiff') smoothness = 0.92;
    else if (feel === 'Confident') smoothness = 0.88;
    else if (feel === 'Light') smoothness = 0.65;
    else if (feel === 'Heavy') smoothness = 0.6;
    else if (feel === 'Twitchy') smoothness = 0.3;
    else if (feel === 'Volatile (Varies by Drop)' || feel === 'Varies') smoothness = 0.25;
    
    if (tags.includes('Twitchy') || tags.includes('Unstable') || tags.includes('Horrible') || negs.includes('jerky') || negs.includes('octagonal')) {
        smoothness *= 0.5;
    }

    if (negs.includes('notchy') || consensus.includes('notchy') || negs.includes('jerkiness') || consensus.includes('jerkiness') || negs.includes('oscillations') || negs.includes('twitchy') || consensus.includes('twitchy')) {
        smoothness = Math.min(smoothness, 0.3);
    }
    if (negs.includes('late lane corrections') || negs.includes('snaps') || negs.includes('hard snaps') || negs.includes('correction')) {
        smoothness = 0.15;
    }

    // --- wobble ---
    const badPct = model.sentiment?.bad ?? 0;
    let wobble = Math.min(0.55, badPct / 60);
    
    // Explicit keywords override wobble severity
    if (negs.includes('ping-pong') || negs.includes('wobble') || negs.includes('oscillating') || negs.includes('twitchy') || consensus.includes('ping-pong')) {
        wobble = Math.max(wobble, 0.6); // pronounced wobble
    }
    
    if (feel === 'Twitchy' || feel === 'Volatile (Varies by Drop)') wobble = Math.max(wobble, 0.5);
    if (consensus.includes('wiggl') || consensus.includes('jerky') || consensus.includes('twitch')) {
        wobble = Math.max(wobble, 0.3);
    }

    if (negs.includes('ping-pong') || negs.includes('wobble') || negs.includes('oscillating') || negs.includes('oscillations') || negs.includes('twitchy') || negs.includes('ping-ponging') || negs.includes('motion sickness') || negs.includes('notchy') || negs.includes('jerkiness') || consensus.includes('ping-pong') || consensus.includes('oscillation') || consensus.includes('notchy')) {
        wobble = Math.max(wobble, 0.65);
    }
    if (negs.includes('late lane corrections') || negs.includes('snaps') || negs.includes('hard snaps') || negs.includes('correction')) {
        wobble = Math.max(wobble, 0.75);
    }
    
    // Super stable overrides
    if (tags.includes('Stable Benchmark') || tags.includes('Stable') || feel === 'Stock' || pos.includes('stable')) {
        wobble = Math.min(wobble, 0.05);
    }

    // --- lane offset ---
    let offset = 0;
    if (tags.includes('Right-Hugging(C4)') || negs.includes('right-hugging') || consensus.includes('hugs right')) {
        offset = 0.35;
    }
    if (negs.includes('left-hugging') || negs.includes('hugs left') || consensus.includes('hugs left') || negs.includes('left-lane hugging')) {
        offset = -0.35;
    }

    // --- color ---
    let color = '#22c55e'; // Green
    if (score < 80) color = '#06b6d4'; // Cyan
    if (score < 60) color = '#eab308'; // Yellow
    if (score < 40) color = '#ef4444'; // Red

    // --- follow distance ---
    let followDistance = 0.6;
    if (tags.includes('Aggressive') || pos.includes('close following')) followDistance = 0.3;
    if (tags.includes('Comfort') || feel === 'Ultra-Smooth' || pos.includes('relaxed')) followDistance = 0.8;
    if (negs.includes('yoyo') || negs.includes('yo-yo')) followDistance = 0.7;

    // --- reaction lag ---
    let reactionLag = 0.4;
    if (feel === 'Stiff' || tags.includes('Stable Benchmark')) reactionLag = 0.1;
    else if (feel === 'Twitchy') reactionLag = 0.7;
    else if (feel === 'Heavy') reactionLag = 0.55;
    else if (feel === 'Ultra-Smooth') reactionLag = 0.3;
    
    // "Hugs turns tight" means turning early/sharp
    if (negs.includes('hugs turns tight') || pos.includes('tight curves')) reactionLag = 0.05;
    if (negs.includes('oversteer')) reactionLag = 0.15; 
    if (negs.includes('late braking') || negs.includes('lock out partway')) reactionLag = 0.8;

    if (negs.includes('slow to straighten') || negs.includes('slow wheel return') || negs.includes('sluggish wheel return') || consensus.includes('slow to straighten') || consensus.includes('slow wheel return')) {
        reactionLag = Math.max(reactionLag, 0.85);
    }
    if (negs.includes('late lane corrections') || negs.includes('snaps') || negs.includes('hard snaps') || negs.includes('correction')) {
        reactionLag = Math.max(reactionLag, 0.85);
    }

    // --- path width ---
    let pathWidth = 0.7;
    if (feel === 'Confident' || feel === 'Ultra-Smooth') pathWidth = 0.85;
    if (feel === 'Twitchy' || feel === 'Light') pathWidth = 0.55;
    if (feel === 'Stiff') pathWidth = 0.75;
    if (wobble > 0.4) pathWidth = 0.5; // low confidence path visualization

    // --- label ---
    let label = 'WMI';
    if (tags.includes('Stable Benchmark') || tags.includes('Legendary')) label = 'LEGENDARY';
    else if (tags.includes('Aggressive')) label = 'AGGRESSIVE';
    else if (tags.includes('Comfort')) label = 'COMFORT';
    else if (tags.includes('Off-Policy')) label = 'OFF-POLICY';
    else if (tags.includes('Stable')) label = 'STABLE';
    else if (tags.includes('Highway')) label = 'HIGHWAY';
    else if (tags.includes('City')) label = 'CITY';
    else if (tags.includes('Curves')) label = 'CURVES';
    else if (tags.includes('Experimental') || tags.includes('Dev') || tags.includes('Early')) label = 'EXPERIMENTAL';
    else if (feel) label = feel.toUpperCase().split(' ')[0];

    // --- curve style ---
    // >0 = hugs apex (cuts inside the bend); <0 = drifts wide.
    let curveStyle = 0.2;
    if (tags.includes('Aggressive') || negs.includes('hugs turns tight') || pos.includes('tight curves')) {
        curveStyle = 0.8;
    } else if (tags.includes('Stable Benchmark') || feel === 'Stiff') {
        curveStyle = 0.0;
    } else if (negs.includes('wide turns') || negs.includes('understeer') || negs.includes('drifts')) {
        curveStyle = -0.55;
    } else if (feel === 'Ultra-Smooth' || feel === 'Confident') {
        curveStyle = 0.35;
    }

    // --- scenario ---
    const scenarioKey = pickScenarioKey(model.name, tags);

    const negatives = model.negatives || [];
    const positives = model.positives || [];
    const yoyoMode = negs.includes('yoyo') || negs.includes('yo-yo');
    const octagonalMode = negs.includes('octagonal') || negs.includes('jerky curve') || consensus.includes('octagonal');
    const accelerationLag = negs.includes('hesitant to accelerate') || negs.includes('sluggish off-the-line') || consensus.includes('hesitant to accelerate');
    const lateBraking = negs.includes('late braking') || negs.includes('lock out partway');
    
    let creepMode: 'creep' | 'fails_stop' | 'none' = 'none';
    if (negs.includes('creeps at red') || negs.includes('creeps') || consensus.includes('creeps')) {
        creepMode = 'creep';
    } else if (negs.includes('fails to stay stopped') || consensus.includes('fails to stay stopped')) {
        creepMode = 'fails_stop';
    }
    
    const stopSignStops = pos.includes('stops for every stop') || pos.includes('stop sign') || consensus.includes('stop sign');
    const afraidOfGreen = negs.includes('afraid of green') || negs.includes('green lights') || consensus.includes('afraid of green');
    const slowWheelReturn = negs.includes('slow to straighten') || negs.includes('slow wheel return') || negs.includes('sluggish wheel return') || consensus.includes('slow to straighten') || consensus.includes('slow wheel return');

    // ── Behavior ratings, mined from community feedback phrasing ──
    // Each starts at a community-score-informed baseline, then explicit
    // positive/negative phrases pull it toward 1 or 0.
    const all = `${negs} ${consensus}`;
    const baseline = Math.max(0.25, Math.min(0.8, 0.35 + (score - 50) / 120));
    const hasAny = (haystack: string, terms: string[]) => terms.some((t) => haystack.includes(t));

    // Does it cut corners?
    let cornerCutting = 0.2;
    if (hasAny(all, ['cut urban corners', 'cuts corners', 'curve inside-line', 'inside line', 'hugs turns tight', 'too tight'])) cornerCutting = 0.85;
    else if (tags.includes('Aggressive')) cornerCutting = 0.5;
    if (hasAny(pos, ['wider turns away from curbs', 'wide turns']) || hasAny(negs, ['wide turns', 'understeer'])) cornerCutting = 0.05;

    // Longitudinal ping-pong following a lead car
    let longPingPong = Math.max(0, 0.45 - baseline * 0.4);
    if (hasAny(all, ['yoyo', 'yo-yo', 'inconsistent gap', 'surging'])) longPingPong = 0.85;
    if (hasAny(pos, ['solid longitudinal', 'smooth stops for leads', 'smooth stops behind leads', 'stable highway speed matching', 'stabilizes speed'])) longPingPong = Math.min(longPingPong, 0.1);

    // Slower / stopped traffic ahead
    let trafficHandling = baseline;
    if (hasAny(all, ['stop-and-go', 'heavy traffic', 'requires driver interventions', 'brakes hard for no reason', 'late braking', 'sluggish stops'])) trafficHandling = 0.2;
    if (hasAny(pos, ['smooth stops', 'consistent braking', 'softest', 'solid longitudinal', 'resolves v2’s sluggish stops', 'sluggish stops'])) trafficHandling = Math.max(trafficHandling, 0.85);

    // Acceleration following a lead
    let leadAccelResponse = baseline;
    if (hasAny(all, ['hesitant when lead vehicle moves', 'hesitant to accelerate', 'sluggish launch', 'sluggish off-the-line', 'drives too slow without a lead', 'slow to follow'])) leadAccelResponse = 0.15;
    if (hasAny(pos, ['quick acceleration', 'aggressive longitudinal acceleration', 'smooth city acceleration', 'reaches cruise speed well', 'more willing to reach set speeds', 'dec-level acceleration'])) leadAccelResponse = Math.max(leadAccelResponse, 0.9);

    // Reliably slows for corners
    let cornerBrakeReliability = baseline + 0.15;
    if (hasAny(all, ['oversteer on high-speed', 'poor turn-in', 'turns lock out', 'speeds aggressively', 'too fast into', 'hot into'])) cornerBrakeReliability = 0.2;
    if (hasAny(pos, ['good 90-degree turn handling', 'better cornering', 'slows for curves', 'curve speed'])) cornerBrakeReliability = Math.max(cornerBrakeReliability, 0.9);
    cornerBrakeReliability = Math.max(0, Math.min(1, cornerBrakeReliability));

    // Reliably stops for lights
    let lightStopReliability = baseline + 0.2;
    if (creepMode !== 'none' || afraidOfGreen) lightStopReliability = 0.15;
    if (hasAny(all, ['hesitant at neighborhood intersections', 'inconsistent city speed', 'complex intersections'])) lightStopReliability = Math.min(lightStopReliability, 0.35);
    if (hasAny(pos, ['stays stopped at red lights', 'consistent stopping for lights', 'stops for every stop'])) lightStopReliability = 0.95;
    lightStopReliability = Math.max(0, Math.min(1, lightStopReliability));

    // Wobble that depends on speed ("extreme ping-pong above 50mph",
    // "twitchy at low speeds") — biases the live wobble amplitude.
    let wobbleSpeedBias = 0;
    if (hasAny(all, ['above 50mph', 'above 65mph', 'high speed', 'high-speed', 'at high speeds'])) wobbleSpeedBias = 1;
    else if (hasAny(all, ['at low speeds', 'low-speed jerk', 'low speed jerk'])) wobbleSpeedBias = -1;

    const slowWobble = all.includes('drunk');

    return {
        speed,
        pathSmoothness: smoothness,
        laneWobble: wobble,
        laneOffset: offset,
        pathColor: color,
        followDistance,
        reactionLag,
        pathWidth,
        label,
        rainbowMode: false,
        curveStyle,
        scenarioKey,
        yoyoMode,
        octagonalMode,
        accelerationLag,
        lateBraking,
        creepMode,
        stopSignStops,
        afraidOfGreen,
        slowWheelReturn,
        negatives,
        positives,
        cornerCutting,
        longPingPong,
        trafficHandling,
        leadAccelResponse,
        cornerBrakeReliability,
        lightStopReliability,
        wobbleSpeedBias,
        slowWobble,
    };
}

// Speed unit detection — show mph in places that use it for road signs,
// kph everywhere else. Maps the locale region; falls back to mph for SSR.
type SpeedUnit = 'mph' | 'kph';
const MPH_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

function detectSpeedUnit(): SpeedUnit {
    if (typeof navigator === 'undefined') return 'mph';
    const lang = navigator.language || '';
    let region = '';
    try {
        const loc = new Intl.Locale(lang);
        region = (loc.maximize?.().region ?? '').toUpperCase();
    } catch {
        // older browsers — fall through
    }
    if (!region) {
        const m = lang.match(/-([A-Z]{2})/i);
        region = m?.[1]?.toUpperCase() ?? '';
    }
    return MPH_REGIONS.has(region) ? 'mph' : 'kph';
}

const SPEED_LIMITS: Record<SpeedUnit, { min: number; max: number; step: number }> = {
    mph: { min: 25, max: 100, step: 5 },
    kph: { min: 40, max: 160, step: 10 },
};
const MPH_TO_KPH = 1.609344;

function clampToStep(value: number, limits: { min: number; max: number; step: number }): number {
    const snapped = Math.round(value / limits.step) * limits.step;
    return Math.max(limits.min, Math.min(limits.max, snapped));
}

// Cheap deterministic 32-bit hash → seed for per-model noise
function hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// Mulberry32 PRNG
function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Driving scenarios — each is a periodic multi-sine with its own loop
// length, speed scaling, and integration table. Different scenarios stress
// different model behaviors (highway = gentle drift, curves = constant
// steering, city = sharp kinks + lower top speed).
const TAU = Math.PI * 2;

export type ScenarioKey = 'highway' | 'curves' | 'city' | 'gauntlet';

interface Scenario {
    key: ScenarioKey;
    label: string;
    loopZ: number;
    speedMul: number;
    heading: (z: number) => number;
    x: (z: number) => number;
    relativeX: (carZ: number, d: number) => number;
}

function buildScenario(
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
        if (Math.abs(raw) < deadzone) return 0;
        return Math.sign(raw) * (Math.abs(raw) - deadzone);
    };
    return buildScenario(key, label, loopZ, speedMul, heading);
}

// ── The Gauntlet — one designed route that stresses every behavior ──
// Corners of increasing sharpness, two traffic lights, a stopped-traffic
// zone, and a cut-in event, laid out along a single 380-unit loop.
export const GAUNTLET_LOOP = 380;

export interface GauntletCorner {
    start: number;
    end: number;
    curv: number;       // signed curvature (+ = right)
    sharpness: 1 | 2 | 3 | 4;
}

export const GAUNTLET_CORNERS: GauntletCorner[] = [
    { start: 45, end: 75, curv: 0.14, sharpness: 1 },   // gentle right
    { start: 110, end: 140, curv: -0.20, sharpness: 2 },  // medium left
    { start: 180, end: 205, curv: 0.30, sharpness: 3 },   // sharp right
    { start: 240, end: 255, curv: -0.22, sharpness: 2 },  // S-curve left…
    { start: 256, end: 271, curv: 0.22, sharpness: 2 },   // …then right
    { start: 300, end: 330, curv: -0.42, sharpness: 4 },  // hairpin left
];

export const GAUNTLET_EVENTS = {
    leadZoneEnd: 78,         // lead-follow demo until here (and after leadZoneRestart)
    leadZoneRestart: 338,
    redLightZ: 95,
    trafficZone: { carZ: 165, stopAt: 158.5, end: 178 },
    cutInZ: 215,
    greenLightZ: 288,
} as const;

// Per-sharpness corner speed factor (fraction of set speed a careful
// model slows to). Sharper corner → bigger required slowdown.
const CORNER_SPEED_FACTOR: Record<number, number> = { 1: 0.85, 2: 0.65, 3: 0.45, 4: 0.32 };

function gauntletHeading(z: number): number {
    // Smooth ramp in/out of each constant-curvature arc (real roads use
    // clothoid-like transitions; smoothstep is close enough visually).
    const RAMP = 7;
    let h = 0;
    for (const c of GAUNTLET_CORNERS) {
        if (z <= c.start - RAMP || z >= c.end + RAMP) continue;
        let w = 1;
        if (z < c.start) w = smoothstep((z - (c.start - RAMP)) / RAMP);
        else if (z > c.end) w = smoothstep(((c.end + RAMP) - z) / RAMP);
        h += c.curv * w;
    }
    return h;
}

function smoothstep(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}

const SCENARIOS: Record<ScenarioKey, Scenario> = {
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

function pickScenarioKey(name: string, tags: string[]): ScenarioKey {
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
const VB_W = 400;
const VB_H = 225;
const HORIZON_Y = 88;
const CAR_Y = VB_H;             // bottom edge
const LANE_HALF_BOTTOM = 55;    // half of one lane's width at camera
const LANE_HALF_TOP = 5;        // half of one lane's width

// Car body half-width is 28 vbox units (see player-car SVG below); lane
// half-width at the camera is 55. To keep the body visibly centred we
// constrain the *target* to ±12 (well inside the lane) and hard-clamp
// the actual position to ±18 to absorb any spring overshoot.
const CAR_BOUND = 18;
const CAR_SAFE_BOUND = 12;

interface Props {
    profile: DrivingProfile;
    seedKey: string; // model name (deterministic noise)
    disableRainbow?: boolean;
    hideStatus?: boolean;
    scenarioOverride?: ScenarioKey;
}

// Ghosted block car — rear view, semi-transparent so it reads as
// "simulated traffic" rather than a real obstacle. Used for the lead car,
// stopped traffic, ambient adjacent-lane traffic, and the cut-in car.
function ghostCarSvg(x: number, y: number, scale: number, opacity: number, braking: boolean): string {
    const brake = braking ? 1 : 0.45;
    return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})" opacity="${opacity.toFixed(2)}">`
        + `<rect x="-16" y="-28" width="32" height="28" rx="4.5" fill="#475569" fill-opacity="0.55" stroke="#94a3b8" stroke-opacity="0.8" stroke-width="1.4" />`
        + `<rect x="-12" y="-24" width="24" height="9" rx="2" fill="#0f172a" fill-opacity="0.7" />`
        + `<rect x="-14.5" y="-8" width="8" height="4.5" rx="1.2" fill="#ef4444" fill-opacity="${brake}" />`
        + `<rect x="6.5" y="-8" width="8" height="4.5" rx="1.2" fill="#ef4444" fill-opacity="${brake}" />`
        + `</g>`;
}

// Roadside chevron warning sign for sharp corners (sharpness ≥ 3).
function chevronSignSvg(x: number, y: number, scale: number, dir: number): string {
    const a = 6 * dir;
    return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})">`
        + `<line x1="0" y1="0" x2="0" y2="-20" stroke="#64748b" stroke-width="2" />`
        + `<rect x="-9" y="-34" width="18" height="14" rx="2" fill="#facc15" stroke="#854d0e" stroke-width="1" />`
        + `<path d="M ${-a} -31 L ${a} -27 L ${-a} -23" fill="none" stroke="#1c1917" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />`
        + `</g>`;
}

interface FrameExtras {
    lead: { depth: number; lateral: number; opacity: number; braking: boolean } | null;
    ghosts: { depth: number; lateral: number; opacity: number; braking: boolean }[];
    routePos: number;
    redLightGreen: boolean; // gauntlet light #1 has released
}

export default function DriveSimulation({ profile, seedKey, disableRainbow, hideStatus, scenarioOverride }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const leftEdgeRef = useRef<SVGPathElement>(null);
    const rightEdgeRef = useRef<SVGPathElement>(null);
    const roadFillRef = useRef<SVGPathElement>(null);
    const chosenPathRef = useRef<SVGPathElement>(null);
    const leftLaneKeepRef = useRef<SVGPathElement>(null);
    const rightLaneKeepRef = useRef<SVGPathElement>(null);
    const dashGroupRef = useRef<SVGGElement>(null);
    const wheelRef = useRef<SVGGElement>(null);
    const speedTextRef = useRef<HTMLDivElement>(null);
    const rainbowGradientRef = useRef<SVGLinearGradientElement>(null);
    const leadCarRef = useRef<SVGGElement>(null);
    const intersectionGroupRef = useRef<SVGGElement>(null);
    const trafficGroupRef = useRef<SVGGElement>(null);
    const progressDotRef = useRef<HTMLDivElement>(null);
    const speedValRef = useRef<HTMLSpanElement>(null);
    const statusTextRef = useRef<HTMLSpanElement>(null);

    const [isVisible, setIsVisible] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    // SSR-safe default; the unit-detection effect refines this on mount.
    const [unit, setUnit] = useState<SpeedUnit>('mph');
    const limits = SPEED_LIMITS[unit];
    const [speed, setSpeed] = useState(() =>
        clampToStep(profile.speed, SPEED_LIMITS.mph)
    );

    // Refs let the animation loop pick up live profile/speed/unit changes
    // without tearing down the RAF (which would reset carZ + marker depths).
    const profileRef = useRef(profile);
    const speedRef = useRef(speed);
    const unitRef = useRef(unit);
    const effectiveScenarioKey = scenarioOverride ?? profile.scenarioKey;
    const scenarioRef = useRef<Scenario>(SCENARIOS[effectiveScenarioKey]);
    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { unitRef.current = unit; }, [unit]);
    useEffect(() => { scenarioRef.current = SCENARIOS[effectiveScenarioKey]; }, [effectiveScenarioKey]);

    // Detect the user's preferred speed unit once on mount.
    useEffect(() => { setUnit(detectSpeedUnit()); }, []);

    // Resync the displayed speed when the model/profile or unit changes,
    // converting profile.speed (always in mph) into the active unit and
    // clamping into the unit's allowed band.
    useEffect(() => {
        const nativeRaw = unit === 'mph' ? profile.speed : profile.speed * MPH_TO_KPH;
        setSpeed(clampToStep(nativeRaw, SPEED_LIMITS[unit]));
    }, [profile.speed, unit]);

    const adjustSpeed = (delta: number) =>
        setSpeed((s) => Math.max(limits.min, Math.min(limits.max, s + delta)));

    // Detect reduced motion
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduceMotion(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    // Visibility gate
    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }
        const io = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { rootMargin: '120px', threshold: 0.05 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const seed = useMemo(() => hashSeed(seedKey), [seedKey]);

    // ===== shared geometry helpers (closure captures only refs / module constants) =====
    const PERSPECTIVE_K = 1.6;
    const depthToYFrac = (d: number) => d / (d + PERSPECTIVE_K);
    const yFracToDepth = (yFrac: number) =>
        yFrac >= 1 ? Infinity : (yFrac * PERSPECTIVE_K) / (1 - yFrac);
    const laneHalfWidth = (yFrac: number) =>
        LANE_HALF_BOTTOM + (LANE_HALF_TOP - LANE_HALF_BOTTOM) * yFrac;
    const PATH_WIDTH_BOTTOM = 0.80;
    const PATH_WIDTH_TOP = 0.80;
    const TIP_YFRAC = 0.88;

    // Stable drawFrame: reads live profile from ref, so a settings change
    // updates the next frame without restarting the RAF loop.
    const drawFrame = useCallback((
        carZ: number,
        actualTipX: number,
        targetTipX: number,
        markerDepths: number[],
        wheelAngle: number,
        carX: number,
        extras?: FrameExtras,
    ) => {
        const profile = profileRef.current;
        const scenario = scenarioRef.current;
        const STEPS = 24;

            const getRoadCenterX = (yFrac: number) => {
                if (yFrac >= 1) return VB_W / 2 - scenario.heading(carZ) * 400;
                const d = yFracToDepth(yFrac);
                const rx = scenario.relativeX(carZ, d);
                return VB_W / 2 + (rx / (d + PERSPECTIVE_K)) * 400;
            };

            let leftD = '', rightD = '';
            for (let i = 0; i <= STEPS; i++) {
                const yFrac = i / STEPS;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const centerX = getRoadCenterX(yFrac);
                
                const lx = centerX - 3 * laneHalfWidth(yFrac);
                const rx = centerX + 3 * laneHalfWidth(yFrac);
                if (i === 0) {
                    leftD = `M ${lx.toFixed(2)} ${y.toFixed(2)}`;
                    rightD = `M ${rx.toFixed(2)} ${y.toFixed(2)}`;
                } else {
                    leftD += ` L ${lx.toFixed(2)} ${y.toFixed(2)}`;
                    rightD += ` L ${rx.toFixed(2)} ${y.toFixed(2)}`;
                }
            }
            
            let fillD = leftD;
            for (let i = STEPS; i >= 0; i--) {
                const yFrac = i / STEPS;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const centerX = getRoadCenterX(yFrac);
                fillD += ` L ${(centerX + 3 * laneHalfWidth(yFrac)).toFixed(2)} ${y.toFixed(2)}`;
            }
            fillD += ' Z';
            
            leftEdgeRef.current?.setAttribute('d', leftD);
            rightEdgeRef.current?.setAttribute('d', rightD);
            roadFillRef.current?.setAttribute('d', fillD);

            const widthScale = profile.pathWidth;
            // Path emanates from the car (depth 0) and curves up to the
            // model's tip target. Quadratic ease-in keeps the line tangent
            // to the car's heading at the bottom and bends toward the tip
            // — so the painted path and the car are always visibly joined.
            const relativeTipX = targetTipX - actualTipX;
            const arcDX = (yFrac: number) => {
                const t = yFrac / TIP_YFRAC;
                return carX + (relativeTipX - carX) * Math.pow(t, 2);
            };
            
            const pathHW = (yFrac: number) => {
                const taper = PATH_WIDTH_BOTTOM + (PATH_WIDTH_TOP - PATH_WIDTH_BOTTOM) * yFrac;
                return laneHalfWidth(yFrac) * taper * widthScale;
            };
            
            let chosenD = '';
            for (let i = 0; i <= STEPS; i++) {
                const yFrac = (i / STEPS) * TIP_YFRAC;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const roadCx = getRoadCenterX(yFrac);
                const cx = roadCx + arcDX(yFrac);
                const lx = cx - pathHW(yFrac);
                if (i === 0) chosenD = `M ${lx.toFixed(2)} ${y.toFixed(2)}`;
                else chosenD += ` L ${lx.toFixed(2)} ${y.toFixed(2)}`;
            }
            for (let i = STEPS; i >= 0; i--) {
                const yFrac = (i / STEPS) * TIP_YFRAC;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const roadCx = getRoadCenterX(yFrac);
                const cx = roadCx + arcDX(yFrac);
                chosenD += ` L ${(cx + pathHW(yFrac)).toFixed(2)} ${y.toFixed(2)}`;
            }
            chosenD += ' Z';
            chosenPathRef.current?.setAttribute('d', chosenD);

            // Lane-keeping lines: solid strokes that hug the inner lane
            // dividers and follow the road's curvature. Sit just inside the
            // lane edges so they have visible padding from the chosen path.
            const LANE_KEEP_INSET = 0.92;
            let leftLkD = '', rightLkD = '';
            for (let i = 0; i <= STEPS; i++) {
                const yFrac = (i / STEPS) * TIP_YFRAC;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const roadCx = getRoadCenterX(yFrac);
                const lkHW = laneHalfWidth(yFrac) * LANE_KEEP_INSET;
                if (i === 0) {
                    leftLkD = `M ${(roadCx - lkHW).toFixed(2)} ${y.toFixed(2)}`;
                    rightLkD = `M ${(roadCx + lkHW).toFixed(2)} ${y.toFixed(2)}`;
                } else {
                    leftLkD += ` L ${(roadCx - lkHW).toFixed(2)} ${y.toFixed(2)}`;
                    rightLkD += ` L ${(roadCx + lkHW).toFixed(2)} ${y.toFixed(2)}`;
                }
            }
            leftLaneKeepRef.current?.setAttribute('d', leftLkD);
            rightLaneKeepRef.current?.setAttribute('d', rightLkD);

            if (dashGroupRef.current) {
                const DASH_LEN = 1.4;
                const DASH_BASE_W = 5;
                let svg = '';
                for (const d of markerDepths) {
                    const dFar = d + DASH_LEN / 2;
                    if (dFar < 0) continue;

                    const dNear = Math.max(-1.2, d - DASH_LEN / 2);
                    const yFracNear = depthToYFrac(dNear);
                    const yFracFar = depthToYFrac(dFar);
                    if (yFracFar > 0.98) continue;

                    const yNear = CAR_Y + (HORIZON_Y - CAR_Y) * yFracNear;
                    const yFar = CAR_Y + (HORIZON_Y - CAR_Y) * yFracFar;
                    
                    const wNear = DASH_BASE_W * (1 - yFracNear);
                    const wFar = DASH_BASE_W * (1 - yFracFar);
                    const wMid = (wNear + wFar) / 2;

                    const opacity = Math.max(0, Math.min(0.85, (0.98 - yFracFar) * 8));
                    if (opacity <= 0.005) continue;

                    const centerNear = getRoadCenterX(yFracNear);
                    const centerFar = getRoadCenterX(yFracFar);

                    const hwNear = laneHalfWidth(yFracNear);
                    const hwFar = laneHalfWidth(yFracFar);

                    const xNL = centerNear - hwNear;
                    const xFL = centerFar - hwFar;
                    const xNR = centerNear + hwNear;
                    const xFR = centerFar + hwFar;

                    const fill = `rgba(255,255,255,${opacity.toFixed(2)})`;
                    svg += `<path d="M ${xNL.toFixed(2)} ${yNear.toFixed(2)} L ${xFL.toFixed(2)} ${yFar.toFixed(2)}" stroke="${fill}" stroke-width="${wMid.toFixed(2)}" stroke-linecap="butt" fill="none" />`;
                    svg += `<path d="M ${xNR.toFixed(2)} ${yNear.toFixed(2)} L ${xFR.toFixed(2)} ${yFar.toFixed(2)}" stroke="${fill}" stroke-width="${wMid.toFixed(2)}" stroke-linecap="butt" fill="none" />`;
                }
                dashGroupRef.current.innerHTML = svg;
            }

            if (wheelRef.current) {
                wheelRef.current.setAttribute(
                    'transform',
                    `translate(20 ${VB_H - 22}) rotate(${wheelAngle.toFixed(2)})`
                );
            }

            if (speedTextRef.current) {
                const curvature = Math.abs(scenario.heading(carZ));
                const alpha = Math.max(0.3, 0.9 - (curvature / 0.3) * 0.4);
                speedTextRef.current.style.opacity = alpha.toFixed(2);
            }

            // Lead-car chevron — visualises followDistance.
            // Positioned/scaled per-frame in drawFrame; starts fully
            // collapsed so it doesn't flash on the first paint.
            if (leadCarRef.current) {
                if (extras) {
                    // Gauntlet: longitudinal sim drives the lead car directly.
                    if (extras.lead) {
                        const leadYFrac = depthToYFrac(extras.lead.depth);
                        const leadY = CAR_Y + (HORIZON_Y - CAR_Y) * leadYFrac;
                        const leadX = getRoadCenterX(leadYFrac) + extras.lead.lateral * 2 * laneHalfWidth(leadYFrac);
                        const leadScale = Math.max(0.12, 1 - leadYFrac);
                        leadCarRef.current.setAttribute(
                            'transform',
                            `translate(${leadX.toFixed(2)} ${leadY.toFixed(2)}) scale(${leadScale.toFixed(3)})`
                        );
                        leadCarRef.current.setAttribute('opacity', extras.lead.opacity.toFixed(2));
                        leadCarRef.current.querySelectorAll<SVGRectElement>('[data-brake]').forEach((r) =>
                            r.setAttribute('fill-opacity', extras.lead!.braking ? '1' : '0.45'));
                    } else {
                        leadCarRef.current.setAttribute('transform', 'translate(200 225) scale(0)');
                    }
                } else {
                    let followDistance = profile.followDistance;
                    if (profile.yoyoMode) {
                        const fluctuation = Math.sin(carZ / 10) * 0.12;
                        followDistance = Math.max(0.2, Math.min(0.95, followDistance + fluctuation));
                    }
                    const leadDepth = 1.5 + followDistance * 7;
                    const leadYFrac = depthToYFrac(leadDepth);
                    const leadY = CAR_Y + (HORIZON_Y - CAR_Y) * leadYFrac;
                    const leadX = getRoadCenterX(leadYFrac);
                    const leadScale = Math.max(0.12, 1 - leadYFrac);
                    leadCarRef.current.setAttribute(
                        'transform',
                        `translate(${leadX.toFixed(2)} ${leadY.toFixed(2)}) scale(${leadScale.toFixed(3)})`
                    );
                    leadCarRef.current.setAttribute('opacity', '1');
                }
            }

            // Gauntlet ghost traffic — stopped cars, cut-in car, ambient
            // adjacent-lane traffic. Rendered far-to-near so closer cars
            // paint on top.
            if (trafficGroupRef.current) {
                let svg = '';
                if (extras) {
                    const sorted = [...extras.ghosts].sort((a, b) => b.depth - a.depth);
                    for (const g of sorted) {
                        if (g.depth < -0.5 || g.depth > 42 || g.opacity <= 0.02) continue;
                        const yFrac = depthToYFrac(g.depth);
                        if (yFrac > 0.96) continue;
                        const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                        const x = getRoadCenterX(yFrac) + g.lateral * 2 * laneHalfWidth(yFrac);
                        const scale = Math.max(0.1, (1 - yFrac) * 1.55);
                        svg += ghostCarSvg(x, y, scale, g.opacity, g.braking);
                    }
                }
                trafficGroupRef.current.innerHTML = svg;
            }

            // Gauntlet route progress dot
            if (extras && progressDotRef.current) {
                const frac = (extras.routePos / GAUNTLET_LOOP) * 100;
                progressDotRef.current.style.left = `${frac.toFixed(2)}%`;
            }

            if (intersectionGroupRef.current) {
                let svg = '';
                if (scenario.key === 'gauntlet' && extras) {
                    const routePos = extras.routePos;
                    const wrapDist = (z: number) => {
                        const d = ((z - routePos) % GAUNTLET_LOOP + GAUNTLET_LOOP) % GAUNTLET_LOOP;
                        return d > GAUNTLET_LOOP / 2 ? d - GAUNTLET_LOOP : d;
                    };

                    const drawLight = (lightZ: number, state: 'red' | 'green') => {
                        const stopDistance = wrapDist(lightZ);
                        if (stopDistance <= -1.2 || stopDistance >= 45) return;
                        const yFrac = depthToYFrac(stopDistance);
                        if (yFrac >= 0.98) return;
                        const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                        const roadCenterX = getRoadCenterX(yFrac);
                        const hw = laneHalfWidth(yFrac);
                        const scale = (1.0 / Math.max(0.2, stopDistance + PERSPECTIVE_K)) * 2.2;

                        svg += `<path d="M ${(roadCenterX - hw).toFixed(2)} ${y.toFixed(2)} L ${(roadCenterX + hw).toFixed(2)} ${y.toFixed(2)}" stroke="rgba(255,255,255,0.75)" stroke-width="${(4 * scale).toFixed(2)}" stroke-linecap="square" />`;

                        const poleX = roadCenterX + hw * 1.35;
                        const poleTopY = y - 40 * scale;
                        svg += `<line x1="${poleX.toFixed(2)}" y1="${y.toFixed(2)}" x2="${poleX.toFixed(2)}" y2="${poleTopY.toFixed(2)}" stroke="#64748b" stroke-width="${(1.8 * scale).toFixed(2)}" />`;
                        svg += `<rect x="${(poleX - 3.5 * scale).toFixed(2)}" y="${(poleTopY - 9 * scale).toFixed(2)}" width="${(7 * scale).toFixed(2)}" height="${(18 * scale).toFixed(2)}" rx="${(1.5 * scale).toFixed(2)}" fill="#1e293b" stroke="#475569" stroke-width="${(0.6 * scale).toFixed(2)}" />`;

                        const r = 2.0 * scale;
                        const lamps: ['red' | 'yellow' | 'green', number, string, string][] = [
                            ['red', poleTopY - 4.5 * scale, '#ef4444', '#450a0a'],
                            ['yellow', poleTopY, '#facc15', '#422006'],
                            ['green', poleTopY + 4.5 * scale, '#22c55e', '#062f14'],
                        ];
                        for (const [name, cy, on, off] of lamps) {
                            const lit = name === state;
                            const glow = lit ? ` style="filter: drop-shadow(0 0 ${4 * scale}px ${on})"` : '';
                            svg += `<circle cx="${poleX.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${lit ? on : off}"${glow} />`;
                        }
                    };

                    drawLight(GAUNTLET_EVENTS.redLightZ, extras.redLightGreen ? 'green' : 'red');
                    drawLight(GAUNTLET_EVENTS.greenLightZ, 'green');

                    // Chevron warning signs on the outside of sharp corners
                    for (const c of GAUNTLET_CORNERS) {
                        if (c.sharpness < 3) continue;
                        for (let signZ = c.start; signZ < c.end; signZ += 11) {
                            const d = wrapDist(signZ);
                            if (d <= 0 || d >= 40) continue;
                            const yFrac = depthToYFrac(d);
                            if (yFrac >= 0.96) continue;
                            const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                            const hw = laneHalfWidth(yFrac);
                            // outside of the curve: right curve (+) → left roadside
                            const side = c.curv > 0 ? -1 : 1;
                            const x = getRoadCenterX(yFrac) + side * hw * 3.6;
                            const scale = Math.max(0.1, (1 - yFrac) * 1.4);
                            svg += chevronSignSvg(x, y, scale, c.curv > 0 ? 1 : -1);
                        }
                    }
                } else if (scenario.key === 'city') {
                    const intersectionInterval = 120;
                    const currentIntersectionZ = Math.floor(carZ / intersectionInterval) * intersectionInterval + intersectionInterval;
                    const stopDistance = currentIntersectionZ - carZ;
                    
                    if (stopDistance > -1.2 && stopDistance < 45) {
                        const yFrac = depthToYFrac(stopDistance);
                        if (yFrac < 0.98) {
                            const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                            const roadCenterX = getRoadCenterX(yFrac);
                            const hw = laneHalfWidth(yFrac);
                            const scale = (1.0 / Math.max(0.2, stopDistance + PERSPECTIVE_K)) * 2.2;
                            
                            const lx = roadCenterX - hw;
                            const rx = roadCenterX + hw;
                            const stopLineWidth = 4 * scale;
                            svg += `<path d="M ${lx.toFixed(2)} ${y.toFixed(2)} L ${rx.toFixed(2)} ${y.toFixed(2)}" stroke="rgba(255,255,255,0.75)" stroke-width="${stopLineWidth.toFixed(2)}" stroke-linecap="square" />`;
                            
                            const poleX = roadCenterX + hw * 1.35;
                            const poleTopY = y - 40 * scale;
                            const poleWidth = 1.8 * scale;
                            svg += `<line x1="${poleX.toFixed(2)}" y1="${y.toFixed(2)}" x2="${poleX.toFixed(2)}" y2="${poleTopY.toFixed(2)}" stroke="#64748b" stroke-width="${poleWidth.toFixed(2)}" />`;
                            
                            const intersectionId = Math.floor(currentIntersectionZ / intersectionInterval);
                            const isStopSign = profile.stopSignStops ? true : (profile.afraidOfGreen || profile.creepMode !== 'none' ? false : (intersectionId % 2 === 0));
                            
                            if (isStopSign) {
                                const r = 9 * scale;
                                const pts: string[] = [];
                                for (let a = 0; a < 8; a++) {
                                    const angle = (a * Math.PI) / 4 + Math.PI / 8;
                                    const px = poleX + r * Math.cos(angle);
                                    const py = poleTopY + r * Math.sin(angle);
                                    pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
                                }
                                svg += `<polygon points="${pts.join(' ')}" fill="#ef4444" stroke="white" stroke-width="${(0.8 * scale).toFixed(2)}" />`;
                                svg += `<text x="${poleX.toFixed(2)}" y="${(poleTopY + 2.5 * scale).toFixed(2)}" fill="white" font-size="${(3.5 * scale).toFixed(2)}" font-weight="bold" font-family="sans-serif" text-anchor="middle">STOP</text>`;
                            } else {
                                const boxW = 7 * scale;
                                const boxH = 18 * scale;
                                const bx = poleX - boxW / 2;
                                const by = poleTopY - boxH / 2;
                                svg += `<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" rx="${(1.5 * scale).toFixed(2)}" fill="#1e293b" stroke="#475569" stroke-width="${(0.6 * scale).toFixed(2)}" />`;
                                
                                let lightState: 'red' | 'yellow' | 'green' = 'red';
                                if (profile.afraidOfGreen) {
                                    lightState = 'green';
                                } else if (profile.creepMode !== 'none') {
                                    lightState = 'red';
                                } else {
                                    if (stopDistance < 18) {
                                        lightState = 'green';
                                    } else if (stopDistance < 24) {
                                        lightState = 'yellow';
                                    } else {
                                        lightState = 'red';
                                    }
                                }
                                
                                const r = 2.0 * scale;
                                const cyRed = poleTopY - 4.5 * scale;
                                const cyYellow = poleTopY;
                                const cyGreen = poleTopY + 4.5 * scale;
                                
                                const redColor = lightState === 'red' ? '#ef4444' : '#450a0a';
                                const yellowColor = lightState === 'yellow' ? '#facc15' : '#422006';
                                const greenColor = lightState === 'green' ? '#22c55e' : '#062f14';
                                
                                const redGlow = lightState === 'red' ? `style="filter: drop-shadow(0 0 ${4*scale}px #ef4444)"` : '';
                                const yellowGlow = lightState === 'yellow' ? `style="filter: drop-shadow(0 0 ${4*scale}px #facc15)"` : '';
                                const greenGlow = lightState === 'green' ? `style="filter: drop-shadow(0 0 ${4*scale}px #22c55e)"` : '';
                                
                                svg += `<circle cx="${poleX.toFixed(2)}" cy="${cyRed.toFixed(2)}" r="${r.toFixed(2)}" fill="${redColor}" ${redGlow} />`;
                                svg += `<circle cx="${poleX.toFixed(2)}" cy="${cyYellow.toFixed(2)}" r="${r.toFixed(2)}" fill="${yellowColor}" ${yellowGlow} />`;
                                svg += `<circle cx="${poleX.toFixed(2)}" cy="${cyGreen.toFixed(2)}" r="${r.toFixed(2)}" fill="${greenColor}" ${greenGlow} />`;
                            }
                        }
                    }
                }
                intersectionGroupRef.current.innerHTML = svg;
            }

            if (profile.rainbowMode && !disableRainbow && rainbowGradientRef.current) {
                // Animate the rainbow path — flow it down towards the car at a vibrant pace
                const offset = (carZ * 1.8) % 1;
                rainbowGradientRef.current.setAttribute('gradientTransform', `translate(0, ${offset})`);
            }
        }, [disableRainbow]);

    // Static-frame redraw — runs in reduced-motion mode whenever profile changes.
    useEffect(() => {
        if (!isVisible || !reduceMotion) return;
        const profile = profileRef.current;
        const initialDepths: number[] = [];
        for (let i = 0; i < 5; i++) initialDepths.push(1.5 + i * 3.5);
        const trajX = profile.laneOffset * 14;
        const restingCarX = profile.laneOffset * 14;
        const extras: FrameExtras | undefined = effectiveScenarioKey === 'gauntlet'
            ? {
                lead: { depth: 1.5 + profile.followDistance * 7, lateral: 0, opacity: 0.85, braking: false },
                ghosts: [
                    { depth: 14, lateral: -1, opacity: 0.35, braking: false },
                    { depth: 20, lateral: 1, opacity: 0.35, braking: false },
                ],
                routePos: 0,
                redLightGreen: false,
            }
            : undefined;
        drawFrame(0, 0, trajX, initialDepths, 0, restingCarX, extras);
    }, [isVisible, reduceMotion, profile, drawFrame, effectiveScenarioKey]);

    // Animation loop — only restarts when seed (model) or visibility changes.
    // Live profile/speed edits flow through refs without tearing down state.
    useEffect(() => {
        if (!isVisible || reduceMotion) return;

        const seedRng = rng(seed);
        const phase1 = seedRng() * Math.PI * 2;
        const phase2 = seedRng() * Math.PI * 2;
        const phase3 = seedRng() * Math.PI * 2;

        const NUM_MARKERS = 11;
        const MAX_DEPTH = 40;
        const markerDepths: number[] = [];
        for (let i = 0; i < NUM_MARKERS; i++) {
            markerDepths.push(1 + (i / NUM_MARKERS) * MAX_DEPTH);
        }

        let raf = 0;
        let lastNow = 0;
        let perceivedTipX = 0;
        let perceivedWheelAngle = 0;
        let carZ = 0;
        let carX = profileRef.current.laneOffset * 14;
        let carVx = 0;
        let currentSpeedMph = unitRef.current === 'mph' ? speedRef.current : speedRef.current / MPH_TO_KPH;
        let stopTime = 0;
        let snapTimer = 0;
        let snapDirection = 0; // -1 for left snap, 1 for right snap, 0 for none

        // ── Gauntlet event state (reset each lap) ──
        let gLap = -1;
        let gLightStopT = 0;
        let gLightDone = false;
        let gTrafficPhase: 'idle' | 'waiting' | 'resume' | 'done' = 'idle';
        let gTrafficWaitT = 0;
        let gTrafficAdvance = 0;
        let gCutInPhase: 'idle' | 'merging' | 'following' | 'leaving' | 'done' = 'idle';
        let gCutInT = 0;

        const tick = (now: number) => {
            const profile = profileRef.current;
            const scenario = scenarioRef.current;
            const speed = speedRef.current;
            // Animation calibration is in mph; convert if the UI is showing kph.
            const speedMph = unitRef.current === 'mph' ? speed : speed / MPH_TO_KPH;

            if (!lastNow) lastNow = now;
            const dt = Math.min(0.05, (now - lastNow) / 1000);
            lastNow = now;

            let targetSpeedMph = speedMph;
            let currentStatus = "SYSTEM ACTIVE";
            let statusColor = "#34d399"; // emerald-400

            if (scenario.key === 'city') {
                const intersectionInterval = 120;
                const currentIntersectionZ = Math.floor(carZ / intersectionInterval) * intersectionInterval + intersectionInterval;
                const stopDistance = currentIntersectionZ - carZ;
                const dToStop = stopDistance - 4.5;
                
                const intersectionId = Math.floor(currentIntersectionZ / intersectionInterval);
                const isStopSign = profile.stopSignStops ? true : (profile.afraidOfGreen || profile.creepMode !== 'none' ? false : (intersectionId % 2 === 0));
                
                let lightState: 'red' | 'yellow' | 'green' = 'red';
                if (profile.afraidOfGreen) {
                    lightState = 'green';
                } else if (profile.creepMode !== 'none') {
                    lightState = 'red';
                } else {
                    if (stopDistance < 18) {
                        lightState = 'green';
                    } else if (stopDistance < 24) {
                        lightState = 'yellow';
                    } else {
                        lightState = 'red';
                    }
                }
                
                if (isStopSign || lightState === 'red') {
                    if (dToStop > 0) {
                        let decel = 1.0;
                        if (profile.lateBraking) {
                            decel = Math.min(1.0, Math.pow(dToStop / 18, 2));
                        } else if (profile.pathSmoothness < 0.4) {
                            decel = Math.min(1.0, dToStop / 40);
                        } else {
                            decel = Math.min(1.0, dToStop / 30);
                        }
                        targetSpeedMph = Math.min(targetSpeedMph, speedMph * decel);
                        stopTime = 0;
                        
                        if (isStopSign) {
                            currentStatus = "🛑 APPROACHING STOP SIGN";
                            statusColor = "#f87171"; // red-400
                        } else {
                            currentStatus = "🔴 APPROACHING RED LIGHT";
                            statusColor = "#f87171"; // red-400
                        }
                    } else {
                        stopTime += dt;
                        if (profile.creepMode === 'creep') {
                            targetSpeedMph = 2.5;
                            currentStatus = "🐌 CREEPING AT RED";
                            statusColor = "#fbbf24"; // amber-400
                        } else if (profile.creepMode === 'fails_stop') {
                            if (stopTime > 1.0) {
                                targetSpeedMph = 4.0;
                                currentStatus = "🚨 FAILING TO STAY STOPPED";
                                statusColor = "#ef4444"; // red-500
                            } else {
                                targetSpeedMph = 0.0;
                                currentStatus = "🛑 STOPPED AT RED LIGHT";
                                statusColor = "#ef4444"; // red-500
                            }
                        } else if (isStopSign) {
                            if (stopTime > 1.8) {
                                targetSpeedMph = speedMph;
                                currentStatus = "🟢 RECOVERING SPEED";
                                statusColor = "#34d399"; // emerald-400
                            } else {
                                targetSpeedMph = 0.0;
                                currentStatus = "🛑 STOPPED AT STOP SIGN";
                                statusColor = "#ef4444"; // red-500
                            }
                        } else {
                            if (stopTime > 2.0) {
                                targetSpeedMph = speedMph;
                                currentStatus = "🟢 RECOVERING SPEED";
                                statusColor = "#34d399"; // emerald-400
                            } else {
                                targetSpeedMph = 0.0;
                                currentStatus = "🛑 STOPPED AT RED LIGHT";
                                statusColor = "#ef4444"; // red-500
                            }
                        }
                    }
                } else if (lightState === 'green' && profile.afraidOfGreen) {
                    if (dToStop > 0 && dToStop < 22) {
                        targetSpeedMph = Math.min(targetSpeedMph, 11.0);
                        currentStatus = "⚠️ HESITATING AT GREEN";
                        statusColor = "#fbbf24"; // amber-400
                    } else {
                        targetSpeedMph = speedMph;
                    }
                }
            }

            // ───────────────── Gauntlet — all behaviors on one route ─────────────────
            let gauntletExtras: FrameExtras | undefined;
            if (scenario.key === 'gauntlet') {
                const tSec = now / 1000;
                const routePos = ((carZ % GAUNTLET_LOOP) + GAUNTLET_LOOP) % GAUNTLET_LOOP;
                const curLap = Math.floor(carZ / GAUNTLET_LOOP);
                if (curLap !== gLap) {
                    gLap = curLap;
                    gLightStopT = 0; gLightDone = false;
                    gTrafficPhase = 'idle'; gTrafficWaitT = 0; gTrafficAdvance = 0;
                    gCutInPhase = 'idle'; gCutInT = 0;
                }

                const ghosts: FrameExtras['ghosts'] = [];
                let lead: FrameExtras['lead'] = null;

                const consider = (t: number, status: string, color: string) => {
                    if (t < targetSpeedMph) {
                        targetSpeedMph = Math.max(0, t);
                        currentStatus = status;
                        statusColor = color;
                    }
                };

                // 1) Corners — does it slow down reliably? does it cut the apex?
                const brakeReliability = profile.cornerBrakeReliability;
                for (const c of GAUNTLET_CORNERS) {
                    const caps = [99, 55, 38, 26];
                    const cornerSpeed = Math.min(speedMph * CORNER_SPEED_FACTOR[c.sharpness], caps[c.sharpness - 1]);
                    // Unreliable models don't shed enough speed before the bend
                    const effective = cornerSpeed + (speedMph - cornerSpeed) * (1 - brakeReliability) * 0.7;
                    const brakeDist = profile.lateBraking ? 13 : 26;
                    const dTo = c.start - routePos;
                    if (dTo > 0 && dTo < brakeDist) {
                        const ramp = profile.lateBraking ? Math.pow(dTo / brakeDist, 2) : dTo / brakeDist;
                        consider(
                            effective + (speedMph - effective) * ramp,
                            brakeReliability < 0.4 ? `⚠️ HOT INTO CORNER S${c.sharpness}` : `🌀 SLOWING FOR CORNER S${c.sharpness}`,
                            brakeReliability < 0.4 ? '#fbbf24' : '#38bdf8',
                        );
                    } else if (routePos >= c.start && routePos <= c.end) {
                        let st = `🌀 CORNER S${c.sharpness}`;
                        let col = '#38bdf8';
                        if (profile.cornerCutting > 0.5) { st = `✂️ CUTTING APEX S${c.sharpness}`; col = '#f472b6'; }
                        else if (brakeReliability < 0.4) { st = `⚠️ HOT INTO CORNER S${c.sharpness}`; col = '#fbbf24'; }
                        consider(effective, st, col);
                    }
                }

                // 2) Red light — stop reliability, creeping, failing to stay stopped
                const lightStopAt = GAUNTLET_EVENTS.redLightZ - 4.5;
                const dToLight = lightStopAt - routePos;
                if (!gLightDone) {
                    if (dToLight > 0 && dToLight < 32) {
                        const ramp = profile.lateBraking ? Math.pow(dToLight / 32, 2) : dToLight / 32;
                        consider(speedMph * ramp, '🔴 APPROACHING RED LIGHT', '#f87171');
                    } else if (dToLight <= 0 && routePos < GAUNTLET_EVENTS.redLightZ + 3) {
                        gLightStopT += dt;
                        if (profile.creepMode === 'creep') {
                            consider(2.5, '🐌 CREEPING AT RED', '#fbbf24');
                        } else if (profile.creepMode === 'fails_stop' && gLightStopT > 1.0) {
                            consider(4.0, '🚨 FAILING TO STAY STOPPED', '#ef4444');
                        } else if (profile.lightStopReliability < 0.3 && profile.creepMode === 'none') {
                            consider(3.0, '⚠️ ROLLING THE RED LIGHT', '#fbbf24');
                        } else {
                            consider(0, '🛑 STOPPED AT RED LIGHT', '#ef4444');
                        }
                        if (gLightStopT > 2.2) gLightDone = true; // light releases
                    }
                }

                // 3) Stopped traffic ahead — ghosted block cars in our lane
                const tz = GAUNTLET_EVENTS.trafficZone;
                if (gTrafficPhase !== 'done') {
                    const dTraffic = tz.stopAt - routePos;
                    const handling = profile.trafficHandling;
                    if (gTrafficPhase === 'idle' && dTraffic > 0 && dTraffic < 30) {
                        let t: number;
                        if (handling < 0.4) {
                            // late, harsh braking with pumping pulses
                            t = speedMph * Math.pow(dTraffic / 30, 2.2) + Math.sin(tSec * 9) * 2.5;
                            consider(Math.max(0, t), '🚨 HARSH LATE BRAKING', '#ef4444');
                        } else {
                            t = dTraffic < 6 ? (dTraffic / 6) * 8 : 6 + (speedMph - 6) * (dTraffic / 30);
                            consider(t, '🚗 SLOW TRAFFIC AHEAD', '#fbbf24');
                        }
                        if (dTraffic < 1.2) gTrafficPhase = 'waiting';
                    } else if (dTraffic <= 0 || gTrafficPhase !== 'idle') {
                        if (gTrafficPhase === 'idle') gTrafficPhase = 'waiting';
                        if (gTrafficPhase === 'waiting') {
                            gTrafficWaitT += dt;
                            consider(0, '🛑 STOPPED BEHIND TRAFFIC', '#ef4444');
                            if (gTrafficWaitT > 1.6) gTrafficPhase = 'resume';
                        } else if (gTrafficPhase === 'resume') {
                            gTrafficAdvance += dt * (4 + gTrafficAdvance * 1.1);
                            if (gTrafficAdvance > 32) gTrafficPhase = 'done';
                            const gap = (tz.carZ + gTrafficAdvance) - routePos - 4;
                            consider(
                                Math.min(speedMph, Math.max(0, gap * 4)),
                                profile.leadAccelResponse < 0.4 ? '🐌 SLUGGISH RESUME BEHIND LEAD' : '🟢 TRAFFIC CLEARING — RESUMING',
                                profile.leadAccelResponse < 0.4 ? '#fbbf24' : '#34d399',
                            );
                        }
                    }
                    // The stopped pack: two in our lane, one in the left lane
                    const fade = Math.max(0, Math.min(0.75, 0.75 - Math.max(0, gTrafficAdvance - 18) / 12));
                    const braking = gTrafficPhase !== 'resume';
                    ghosts.push({ depth: (tz.carZ + gTrafficAdvance) - routePos, lateral: 0, opacity: fade, braking });
                    ghosts.push({ depth: (tz.carZ + 4 + gTrafficAdvance * 1.06) - routePos, lateral: -1, opacity: fade, braking });
                    ghosts.push({ depth: (tz.carZ + 7 + gTrafficAdvance * 0.95) - routePos, lateral: 0, opacity: fade * 0.9, braking });
                }

                // 4) Cut-in — a car merges from the right lane directly ahead
                if (gCutInPhase === 'idle' && routePos > GAUNTLET_EVENTS.cutInZ - 14 && routePos < GAUNTLET_EVENTS.cutInZ) {
                    gCutInPhase = 'merging';
                    gCutInT = 0;
                }
                if (gCutInPhase !== 'idle' && gCutInPhase !== 'done') {
                    gCutInT += dt;
                    const reactDelay = 0.2 + (1 - profile.trafficHandling) * 0.8;
                    if (gCutInPhase === 'merging') {
                        const m = smoothstep(Math.min(1, gCutInT / 1.1));
                        ghosts.push({ depth: 7.5 - m * 1.5, lateral: 1 - m, opacity: 0.85, braking: false });
                        if (gCutInT > reactDelay) {
                            consider(
                                speedMph * 0.55,
                                profile.trafficHandling < 0.4 ? '⚠️ LATE REACTION TO CUT-IN' : '🚧 CUT-IN — ADJUSTING GAP',
                                profile.trafficHandling < 0.4 ? '#ef4444' : '#fbbf24',
                            );
                        }
                        if (gCutInT >= 1.1) { gCutInPhase = 'following'; gCutInT = 0; }
                    } else if (gCutInPhase === 'following') {
                        ghosts.push({ depth: 6 + gCutInT * 0.4, lateral: 0, opacity: 0.85, braking: gCutInT < 0.8 });
                        consider(speedMph * 0.72, '🚧 FOLLOWING CUT-IN CAR', '#fbbf24');
                        if (gCutInT > 2.2) { gCutInPhase = 'leaving'; gCutInT = 0; }
                    } else if (gCutInPhase === 'leaving') {
                        const op = Math.max(0, 0.85 - gCutInT * 0.45);
                        ghosts.push({ depth: 7 + gCutInT * 9, lateral: 0, opacity: op, braking: false });
                        if (gCutInT > 2) gCutInPhase = 'done';
                    }
                }

                // 5) Lead-follow zone — accel response + longitudinal ping-pong
                const inLeadZone = routePos < GAUNTLET_EVENTS.leadZoneEnd || routePos > GAUNTLET_EVENTS.leadZoneRestart;
                if (inLeadZone) {
                    const baseGap = 2.5 + profile.followDistance * 5;
                    const leadOsc = Math.sin(tSec * 0.55);     // lead naturally varying speed
                    const pp = profile.longPingPong;
                    const ppOsc = Math.sin(tSec * 1.7) * pp;   // our overshooting response
                    let leadDepth = baseGap + leadOsc * 2.0 + ppOsc * 2.8;
                    if (profile.leadAccelResponse < 0.45 && leadOsc > 0) {
                        leadDepth += leadOsc * 2.5; // gap stretches when the lead pulls away
                    }
                    // fade near the zone edges so the lead doesn't pop in/out
                    let opacity = 0.85;
                    if (routePos < GAUNTLET_EVENTS.leadZoneEnd) {
                        opacity *= Math.min(1, (GAUNTLET_EVENTS.leadZoneEnd - routePos) / 8);
                    } else {
                        opacity *= Math.min(1, (routePos - GAUNTLET_EVENTS.leadZoneRestart) / 8);
                    }
                    lead = { depth: Math.max(1.2, leadDepth), lateral: 0, opacity, braking: leadOsc < -0.35 };

                    const t = speedMph * (1 + leadOsc * 0.10 + ppOsc * 0.14);
                    if (t < targetSpeedMph) targetSpeedMph = t;
                    if (currentStatus === 'SYSTEM ACTIVE') {
                        if (pp > 0.45 && Math.abs(ppOsc) > pp * 0.5) {
                            currentStatus = '🪀 PING-PONG FOLLOWING'; statusColor = '#22d3ee';
                        } else if (profile.leadAccelResponse < 0.45 && leadOsc > 0.3) {
                            currentStatus = '🐌 SLOW TO FOLLOW LEAD'; statusColor = '#fbbf24';
                        } else {
                            currentStatus = '🚘 FOLLOWING LEAD'; statusColor = '#34d399';
                        }
                    }
                }

                // Ambient ghost traffic in the adjacent lanes
                ghosts.push({ depth: 30 - ((carZ * 0.35 + 7) % 34), lateral: 1, opacity: 0.35, braking: false });
                ghosts.push({ depth: 30 - ((carZ * 0.5 + 21) % 34), lateral: -1, opacity: 0.35, braking: false });

                gauntletExtras = { lead, ghosts, routePos, redLightGreen: gLightDone };
            }

            // Implement speed fluctuations in yoyoMode trailing a lead car
            if (scenario.key !== 'gauntlet' && profile.yoyoMode && currentStatus === "SYSTEM ACTIVE") {
                // Sinusoidal speed fluctuation: simulate dynamic acceleration/deceleration overcorrecting
                const fluctuation = Math.sin(carZ / 12) * (speedMph * 0.12);
                targetSpeedMph += fluctuation;
                currentStatus = "🔄 YOYO FOLLOWING";
                statusColor = "#22d3ee"; // cyan-400
            }

            // Smooth speed transitions. Acceleration rate reflects how
            // promptly the model gets going again behind a lead.
            if (targetSpeedMph > currentSpeedMph) {
                let accelRate = profile.accelerationLag ? 0.35 : 1.3;
                if (scenario.key === 'gauntlet') {
                    accelRate = 0.3 + profile.leadAccelResponse * 1.4;
                    if (profile.accelerationLag) accelRate = Math.min(accelRate, 0.35);
                }
                currentSpeedMph += (targetSpeedMph - currentSpeedMph) * accelRate * dt;
            } else if (targetSpeedMph < currentSpeedMph) {
                // Poor traffic handling brakes later but harder.
                const brakeRate = scenario.key === 'gauntlet' && profile.trafficHandling < 0.4 ? 3.6 : 2.5;
                currentSpeedMph += (targetSpeedMph - currentSpeedMph) * brakeRate * dt;
            }

            // Update displayed speed text directly on DOM for high-performance fluid renders
            const displayedSpeed = Math.round(unitRef.current === 'mph' ? currentSpeedMph : currentSpeedMph * MPH_TO_KPH);
            if (speedValRef.current) {
                speedValRef.current.textContent = String(displayedSpeed);
            }

            // Scenario speedMul scales how fast the world flows past — city
            // scenarios visually feel slower than highway at the same mph.
            const worldSpeed = (2.0 + (currentSpeedMph / 70) * 5.5) * scenario.speedMul;
            carZ += worldSpeed * dt;

            const tipD = yFracToDepth(TIP_YFRAC);
            const actualTipX = (scenario.relativeX(carZ, tipD) / (tipD + PERSPECTIVE_K)) * 400;

            const trackRate = 0.7 + profile.pathSmoothness * 5.5;
            perceivedTipX = actualTipX + (perceivedTipX - actualTipX) * Math.exp(-trackRate * dt);

            // Triangle-wave "ping-pong" wobble. Community feedback often
            // notes wobble that only appears at high (or low) speed —
            // wobbleSpeedBias scales the live amplitude accordingly.
            const tSec = now / 1000;
            let wobbleAmp = profile.laneWobble * 16;
            if (profile.wobbleSpeedBias > 0) {
                wobbleAmp *= 0.35 + Math.max(0, currentSpeedMph - 25) / 50;
            } else if (profile.wobbleSpeedBias < 0) {
                wobbleAmp *= Math.max(0.3, 1.5 - currentSpeedMph / 45);
            }
            // "drunk driver look" = slow, lazy ping-pong
            const bounceFreq = (2.0 + profile.laneWobble * 3) * (profile.slowWobble ? 0.45 : 1);
            const triangle = Math.asin(Math.sin(tSec * bounceFreq + phase1)) / (Math.PI / 2);
            const detune =
                Math.sin(tSec * 3.3 + phase2) * 0.12 +
                Math.sin(tSec * 5.9 + phase3) * 0.06;
            const wobble = (triangle + detune) * wobbleAmp;

            // Apex cutting — on the gauntlet the dedicated cornerCutting
            // rating dominates so corner-cutting models visibly dive inside.
            const currentCurvature = scenario.heading(carZ);
            const cutGain = scenario.key === 'gauntlet'
                ? profile.curveStyle * 0.4 + profile.cornerCutting * 1.3
                : profile.curveStyle;
            const apexCutOffset =
                currentCurvature * cutGain * (1 - profile.reactionLag) * 30;

            const offsetBias = profile.laneOffset * 14 + apexCutOffset;

            let targetTipX = perceivedTipX + offsetBias + wobble;

            const tipLaneHW = laneHalfWidth(TIP_YFRAC);
            const tipTaper = PATH_WIDTH_BOTTOM + (PATH_WIDTH_TOP - PATH_WIDTH_BOTTOM) * TIP_YFRAC;
            const tipPathHW = tipLaneHW * tipTaper * profile.pathWidth;
            const margin = 0.5;

            const minTipX = actualTipX - tipLaneHW + margin + tipPathHW;
            const maxTipX = actualTipX + tipLaneHW - margin - tipPathHW;

            if (targetTipX < minTipX) targetTipX = minTipX;
            else if (targetTipX > maxTipX) targetTipX = maxTipX;

            // Steering Wheel Rotation depends on BOTH road curvature and lateral speed input (carVx)
            const targetWheelAngle = (actualTipX / 70) * 45 + (carVx * 4.0);
            
            let returnRate = 6.0;
            if (profile.slowWheelReturn) {
                // If returning to center (wheel angle moving towards 0), slow it down drastically
                const isReturning = Math.sign(targetWheelAngle) !== Math.sign(perceivedWheelAngle) || Math.abs(targetWheelAngle) < Math.abs(perceivedWheelAngle);
                if (isReturning) {
                    returnRate = 1.0; // very sluggish return!
                }
            }
            perceivedWheelAngle = targetWheelAngle + (perceivedWheelAngle - targetWheelAngle) * Math.exp(-returnRate * dt);

            let finalWheelAngle = perceivedWheelAngle;
            if (profile.octagonalMode) {
                finalWheelAngle = Math.round(perceivedWheelAngle / 8) * 8;
                if (currentStatus === "SYSTEM ACTIVE" && Math.abs(finalWheelAngle) > 2) {
                    currentStatus = "⚙️ NOTCHY STEERING";
                    statusColor = "#818cf8"; // indigo-400
                }
            }

            let finalTargetTipX = targetTipX;
            if (profile.octagonalMode) {
                finalTargetTipX = Math.round(targetTipX / 3.5) * 3.5;
            }

            for (let i = 0; i < markerDepths.length; i++) {
                markerDepths[i] -= worldSpeed * dt;
                if (markerDepths[i] < -1.0) markerDepths[i] += MAX_DEPTH;
            }

            const rawTarget = (offsetBias + wobble) * 0.35;
            let targetCarX = Math.max(-CAR_SAFE_BOUND, Math.min(CAR_SAFE_BOUND, rawTarget));

            // Implement realistic "late lane corrections / dramatic snaps" for unstable models
            const isLateCorrectingModel = profile.pathSmoothness < 0.25;
            let stiffness = 6 + profile.pathSmoothness * 14;
            let damping = 4 + profile.pathSmoothness * 8;

            if (isLateCorrectingModel) {
                if (snapTimer > 0) {
                    snapTimer -= dt;
                    stiffness = 32; // extremely tight, fast snap-back
                    damping = 10;   // high damping to arrest the velocity
                    targetCarX = snapDirection * 7.5; // pull hard back in the opposite direction
                    currentStatus = "🚨 CORRECTING SNAP";
                    statusColor = "#ef4444"; // red-500
                } else {
                    // Drift phase: extremely low stiffness so the car wanders off center
                    stiffness = 1.8;
                    damping = 1.2;
                    
                    // If we drift too close to the lane edge, trigger a snap!
                    if (Math.abs(carX) > 8.5) {
                        snapTimer = 0.75; // snap-back duration of 0.75s
                        snapDirection = -Math.sign(carX); // snap in the opposite direction
                    } else if (Math.abs(carX) > 4.5) {
                        currentStatus = "⚠️ DRIFTING OUT OF LANE";
                        statusColor = "#fbbf24"; // amber-400
                    }
                }
            }

            carVx += (targetCarX - carX) * stiffness * dt;
            carVx *= Math.exp(-damping * dt);
            carX += carVx * dt;

            if (carX > CAR_BOUND) { carX = CAR_BOUND; carVx = Math.min(0, carVx); }
            else if (carX < -CAR_BOUND) { carX = -CAR_BOUND; carVx = Math.max(0, carVx); }

            drawFrame(carZ, actualTipX, finalTargetTipX, markerDepths, finalWheelAngle, carX, gauntletExtras);

            // Update dynamic status overlay
            if (statusTextRef.current) {
                statusTextRef.current.textContent = currentStatus;
                statusTextRef.current.style.color = statusColor;
                statusTextRef.current.style.borderColor = statusColor + "40"; // 25% opacity border matching the color
                
                // Add pulsing animation for warnings and critical snaps
                if (currentStatus.startsWith("🚨") || currentStatus.startsWith("🔴") || currentStatus.startsWith("🛑")) {
                    statusTextRef.current.style.animation = "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite";
                } else {
                    statusTextRef.current.style.animation = "none";
                }
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [isVisible, reduceMotion, seed, drawFrame]);

    const isRainbowActive = profile.rainbowMode && !disableRainbow;

    return (
        <div
            ref={containerRef}
            className="force-dark relative w-full overflow-hidden rounded-lg bg-slate-950"
            style={{ aspectRatio: '16 / 9' }}
        >
            <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
            >
                <defs>
                    <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="60%" stopColor="#020617" />
                    </linearGradient>

                    {/* Horizon fade — opaque near the camera, transparent as we
                        approach the horizon, so the chosen path and lane-keep
                        lines no longer terminate in a hard flat edge.
                        userSpaceOnUse so the stops are anchored to viewBox y. */}
                    <linearGradient
                        id={`path-fade-${seed}`}
                        gradientUnits="userSpaceOnUse"
                        x1="0" y1={CAR_Y}
                        x2="0" y2={HORIZON_Y}
                    >
                        <stop offset="0%" stopColor="white" stopOpacity="1" />
                        <stop offset="60%" stopColor="white" stopOpacity="1" />
                        <stop offset="92%" stopColor="white" stopOpacity="0" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                    <mask id={`fade-mask-${seed}`} maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
                        <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#path-fade-${seed})`} />
                    </mask>
                    <linearGradient 
                        id={`path-${seed}`} 
                        ref={rainbowGradientRef}
                        x1="0" y1="0" x2="0" y2="1" 
                        spreadMethod="repeat"
                    >
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
                        <stop offset="16.6%" stopColor="#f97316" stopOpacity="1" />
                        <stop offset="33.3%" stopColor="#eab308" stopOpacity="1" />
                        <stop offset="50%" stopColor="#22c55e" stopOpacity="1" />
                        <stop offset="66.6%" stopColor="#3b82f6" stopOpacity="1" />
                        <stop offset="83.3%" stopColor="#a855f7" stopOpacity="1" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
                    </linearGradient>
                </defs>

                {/* sky / scene background */}
                <rect x="0" y="0" width={VB_W} height={HORIZON_Y} fill={`url(#bg-${seed})`} />
                {/* horizon haze */}
                <rect x="0" y={HORIZON_Y - 8} width={VB_W} height="14" fill="rgba(148,163,184,0.08)" />
                {/* ground */}
                <rect x="0" y={HORIZON_Y} width={VB_W} height={VB_H - HORIZON_Y} fill="#0b1220" />

                {/* road fill (full 3-lane road) */}
                <path ref={roadFillRef} d="M 35 225 L 185 88 L 215 88 L 365 225 Z" fill="#1e293b" />
                {/* lane divider dashes (perspective trapezoids on both dividers) */}
                <g ref={dashGroupRef} />
                {/* outer road edges */}
                <path ref={leftEdgeRef} d="M 35 225 L 185 88" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <path ref={rightEdgeRef} d="M 365 225 L 215 88" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />

                {/* chosen path + lane-keep lines, grouped so a single horizon
                    fade mask softly dissolves them as they approach the horizon. */}
                <g mask={`url(#fade-mask-${seed})`}>
                    {/* chosen path (model's decision — sits in the middle lane) */}
                    <path
                        ref={chosenPathRef}
                        d="M 170 225 L 197 104 L 203 104 L 230 225 Z"
                        fill={isRainbowActive ? `url(#path-${seed})` : profile.pathColor}
                        fillOpacity={isRainbowActive ? '1' : '0.4'}
                        stroke="none"
                    />

                    {/* lane-keeping lines: solid colored strokes hugging the lane edges */}
                    <path
                        ref={leftLaneKeepRef}
                        d=""
                        fill="none"
                        stroke={profile.pathColor}
                        strokeOpacity="0.9"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        ref={rightLaneKeepRef}
                        d=""
                        fill="none"
                        stroke={profile.pathColor}
                        strokeOpacity="0.9"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* 3D dynamic intersections (traffic lights, stop signs & lines) */}
                    <g ref={intersectionGroupRef} />

                    {/* Ghosted block-car traffic (gauntlet scenario) */}
                    <g ref={trafficGroupRef} />
                </g>

                {/* Lead car — ghosted block car visualising followDistance /
                    the gauntlet's longitudinal sim. Positioned/scaled
                    per-frame in drawFrame; starts fully collapsed so it
                    doesn't flash on the first paint. */}
                <g ref={leadCarRef} transform="translate(200 225) scale(0)" pointerEvents="none">
                    <rect x="-16" y="-28" width="32" height="28" rx="4.5" fill="#475569" fillOpacity="0.6" stroke="#94a3b8" strokeOpacity="0.85" strokeWidth="1.4" />
                    <rect x="-12" y="-24" width="24" height="9" rx="2" fill="#0f172a" fillOpacity="0.75" />
                    <rect data-brake x="-14.5" y="-8" width="8" height="4.5" rx="1.2" fill="#ef4444" fillOpacity="0.45" />
                    <rect data-brake x="6.5" y="-8" width="8" height="4.5" rx="1.2" fill="#ef4444" fillOpacity="0.45" />
                </g>

                {/* steering wheel (bottom-left) — rotates with the road's curvature */}
                <g ref={wheelRef} transform={`translate(22 ${VB_H - 24})`}>
                    {/* drop shadow for depth */}
                    <circle cx="0" cy="0.8" r="13" fill="rgba(0,0,0,0.45)" />
                    {/* outer rim (thicker donut) */}
                    <circle r="12.5" fill="white" />
                    <circle r="8.5" fill="#0b1220" />
                    {/* three trapezoidal spokes — upside-down triangle: 2 upper points (left + right), 1 lower point */}
                    <g fill="white" transform="rotate(180)">
                        <path d="M -2.4 -2.6 L -1.5 -8.4 L 1.5 -8.4 L 2.4 -2.6 Z" />
                        <path d="M -2.4 -2.6 L -1.5 -8.4 L 1.5 -8.4 L 2.4 -2.6 Z" transform="rotate(120)" />
                        <path d="M -2.4 -2.6 L -1.5 -8.4 L 1.5 -8.4 L 2.4 -2.6 Z" transform="rotate(-120)" />
                    </g>
                    {/* center boss + inner airbag detail */}
                    <circle r="4" fill="white" />
                    <circle r="2.4" fill="#0b1220" />
                    <circle r="0.9" fill="white" />
                </g>
            </svg>

            {/* personality label (top-left) — shrunk and capped so it never
                crowds the speed indicator at any simulator size. */}
            <div
                className="absolute left-[4%] top-[8%] select-none pointer-events-none max-w-[28%] truncate"
                style={{ color: profile.pathColor }}
            >
                <span className="text-[clamp(8px,1.7cqw,12px)] font-bold tracking-[0.18em] uppercase opacity-90 whitespace-nowrap">
                    {profile.label}
                </span>
            </div>

            {/* Dynamic Telemetry Status (top-right) */}
            {!hideStatus && (
                <div className="absolute right-[4%] top-[8%] select-none pointer-events-none max-w-[50%] truncate text-right">
                    <span
                        ref={statusTextRef}
                        className="text-[clamp(8px,1.7cqw,12px)] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded bg-slate-900/80 border border-white/10 text-emerald-400 shadow-md backdrop-blur-sm transition-all duration-300"
                    >
                        SYSTEM ACTIVE
                    </span>
                </div>
            )}

{/* subtle vignette at top to fade the scene */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/45 to-transparent" />

            {/* speed controls — flank the MPH readout.
                Vertically centered within the area above the horizon (top ~39% of
                the viewBox), using container queries for proportional scaling. */}
            <div
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none pointer-events-none @container"
                style={{ top: '19%', width: '100%' }}
            >
                <div className="flex items-center gap-[clamp(10px,3cqw,24px)]">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); adjustSpeed(-limits.step); }}
                        disabled={speed <= limits.min}
                        aria-label={`Decrease simulation speed (${unit})`}
                        className="pointer-events-auto h-[8cqw] w-[8cqw] min-h-[24px] min-w-[24px] rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 backdrop-blur-md text-white text-[5cqw] font-bold leading-none flex items-center justify-center transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 border border-white/5 shadow-lg"
                    >
                        −
                    </button>

                    <div
                        ref={speedTextRef}
                        className="flex flex-col items-center leading-none w-[20cqw] min-w-[68px]"
                    >
                        <span ref={speedValRef} className="text-[clamp(28px,11cqw,64px)] font-bold text-white tracking-tighter tabular-nums">
                            {speed}
                        </span>
                        <span className="text-[clamp(8px,3.2cqw,16px)] font-semibold text-white/70 tracking-[0.25em] -mt-[0.5cqw]">
                            {unit.toUpperCase()}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); adjustSpeed(limits.step); }}
                        disabled={speed >= limits.max}
                        aria-label={`Increase simulation speed (${unit})`}
                        className="pointer-events-auto h-[8cqw] w-[8cqw] min-h-[24px] min-w-[24px] rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 backdrop-blur-md text-white text-[5cqw] font-bold leading-none flex items-center justify-center transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 border border-white/5 shadow-lg"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Gauntlet route progress strip — event markers along the loop,
                with a moving dot showing where the car currently is. */}
            {effectiveScenarioKey === 'gauntlet' && !hideStatus && (
                <div className="absolute inset-x-[4%] bottom-[4%] select-none pointer-events-none">
                    <div className="relative h-1 rounded-full bg-white/15">
                        {GAUNTLET_CORNERS.map((c) => (
                            <div
                                key={`c-${c.start}`}
                                className="absolute -top-0.5 h-2 rounded-sm bg-sky-400/60"
                                style={{
                                    left: `${(c.start / GAUNTLET_LOOP) * 100}%`,
                                    width: `${((c.end - c.start) / GAUNTLET_LOOP) * 100}%`,
                                }}
                                title={`Corner S${c.sharpness}`}
                            />
                        ))}
                        <div className="absolute -top-1 h-3 w-1 rounded-sm bg-red-400" style={{ left: `${(GAUNTLET_EVENTS.redLightZ / GAUNTLET_LOOP) * 100}%` }} title="Red light" />
                        <div className="absolute -top-1 h-3 w-1 rounded-sm bg-emerald-400" style={{ left: `${(GAUNTLET_EVENTS.greenLightZ / GAUNTLET_LOOP) * 100}%` }} title="Green light" />
                        <div className="absolute -top-1 h-3 w-1.5 rounded-sm bg-amber-400" style={{ left: `${(GAUNTLET_EVENTS.trafficZone.carZ / GAUNTLET_LOOP) * 100}%` }} title="Stopped traffic" />
                        <div className="absolute -top-1 h-3 w-1 rounded-sm bg-fuchsia-400" style={{ left: `${(GAUNTLET_EVENTS.cutInZ / GAUNTLET_LOOP) * 100}%` }} title="Cut-in" />
                        <div
                            ref={progressDotRef}
                            className="absolute -top-[3px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                            style={{ left: '0%' }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
