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

export type ScenarioKey = 'highway' | 'curves' | 'city';

interface Scenario {
    key: ScenarioKey;
    label: string;
    loopZ: number;
    speedMul: number;
    heading: (z: number) => number;
    x: (z: number) => number;
    relativeX: (carZ: number, d: number) => number;
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

    // Trapezoid integration; the heading is odd-symmetric over its period
    // so the integral closes to 0 → x() is itself periodic in loopZ.
    const TABLE_SIZE = 4096;
    const dz = loopZ / TABLE_SIZE;
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
}

export default function DriveSimulation({ profile, seedKey, disableRainbow, hideStatus }: Props) {
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
    const scenarioRef = useRef<Scenario>(SCENARIOS[profile.scenarioKey]);
    // Current traffic-light colour, written by the physics loop and read by
    // drawFrame so the rendered light matches the car's stop/hold behaviour
    // (the two run as separate passes and must not disagree).
    const lightStateRef = useRef<'red' | 'yellow' | 'green'>('red');
    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { unitRef.current = unit; }, [unit]);
    useEffect(() => { scenarioRef.current = SCENARIOS[profile.scenarioKey]; }, [profile.scenarioKey]);

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
            }

            if (intersectionGroupRef.current) {
                let svg = '';
                if (scenario.key === 'city') {
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
                                
                                // Mirror the physics loop's current light colour
                                // (set in tick) so the rendered signal agrees with
                                // the car's stop/hold behaviour. In the static
                                // (reduced-motion) redraw the loop isn't running, so
                                // this reads its last/default value — a red light,
                                // which is fine to show at rest.
                                const lightState: 'red' | 'yellow' | 'green' =
                                    profile.afraidOfGreen ? 'green' : lightStateRef.current;

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
        drawFrame(0, 0, trajX, initialDepths, 0, restingCarX);
    }, [isVisible, reduceMotion, profile, drawFrame]);

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

                // Minimum time the car holds at a stopped red light before the
                // signal cycles to green — long enough to read as a real light
                // rather than a momentary tap-stop.
                const RED_LIGHT_HOLD_S = 3.5;

                let lightState: 'red' | 'yellow' | 'green' = 'red';

                if (profile.afraidOfGreen) {
                    // Light is green but the model hesitates to proceed through it.
                    lightState = 'green';
                    stopTime = 0;
                    if (dToStop > 0 && dToStop < 22) {
                        targetSpeedMph = Math.min(targetSpeedMph, 11.0);
                        currentStatus = "⚠️ HESITATING AT GREEN";
                        statusColor = "#fbbf24"; // amber-400
                    } else {
                        targetSpeedMph = speedMph;
                    }
                } else if (dToStop > 0) {
                    // Approaching the line — decelerate. Red lights stay red on
                    // approach (a real light you stop at doesn't pre-empt green).
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
                    lightState = 'red';

                    if (isStopSign) {
                        currentStatus = "🛑 APPROACHING STOP SIGN";
                    } else {
                        currentStatus = "🔴 APPROACHING RED LIGHT";
                    }
                    statusColor = "#f87171"; // red-400
                } else {
                    // Stopped at the line.
                    stopTime += dt;
                    if (profile.creepMode === 'creep') {
                        lightState = 'red';
                        targetSpeedMph = 2.5;
                        currentStatus = "🐌 CREEPING AT RED";
                        statusColor = "#fbbf24"; // amber-400
                    } else if (profile.creepMode === 'fails_stop') {
                        lightState = 'red';
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
                        // Stop signs are a brief full stop, then proceed.
                        lightState = 'red';
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
                        // Red light: hold for the full signal duration, then the
                        // light turns green and the car proceeds.
                        if (stopTime > RED_LIGHT_HOLD_S) {
                            lightState = 'green';
                            targetSpeedMph = speedMph;
                            currentStatus = "🟢 GREEN — PROCEEDING";
                            statusColor = "#34d399"; // emerald-400
                        } else {
                            lightState = 'red';
                            targetSpeedMph = 0.0;
                            currentStatus = "🛑 STOPPED AT RED LIGHT";
                            statusColor = "#ef4444"; // red-500
                        }
                    }
                }

                // Publish for drawFrame so the rendered light matches the physics.
                lightStateRef.current = lightState;
            }

            // Implement speed fluctuations in yoyoMode trailing a lead car
            if (profile.yoyoMode && currentStatus === "SYSTEM ACTIVE") {
                // Sinusoidal speed fluctuation: simulate dynamic acceleration/deceleration overcorrecting
                const fluctuation = Math.sin(carZ / 12) * (speedMph * 0.12);
                targetSpeedMph += fluctuation;
                currentStatus = "🔄 YOYO FOLLOWING";
                statusColor = "#22d3ee"; // cyan-400
            }

            // Smooth speed transitions
            if (targetSpeedMph > currentSpeedMph) {
                const accelRate = profile.accelerationLag ? 0.35 : 1.3;
                currentSpeedMph += (targetSpeedMph - currentSpeedMph) * accelRate * dt;
            } else if (targetSpeedMph < currentSpeedMph) {
                const brakeRate = 2.5;
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

            // Triangle-wave "ping-pong" wobble
            const tSec = now / 1000;
            const wobbleAmp = profile.laneWobble * 16;
            const bounceFreq = 2.0 + profile.laneWobble * 3;
            const triangle = Math.asin(Math.sin(tSec * bounceFreq + phase1)) / (Math.PI / 2);
            const detune =
                Math.sin(tSec * 3.3 + phase2) * 0.12 +
                Math.sin(tSec * 5.9 + phase3) * 0.06;
            const wobble = (triangle + detune) * wobbleAmp;

            // Apex cutting
            const currentCurvature = scenario.heading(carZ);
            const apexCutOffset =
                currentCurvature * profile.curveStyle * (1 - profile.reactionLag) * 30;

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

            drawFrame(carZ, actualTipX, finalTargetTipX, markerDepths, finalWheelAngle, carX);

            // Update dynamic status overlay
            if (statusTextRef.current) {
                statusTextRef.current.textContent = currentStatus;
                statusTextRef.current.style.color = statusColor;

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
                </g>

                {/* Lead-car chevron — visualises followDistance.
                    Positioned/scaled per-frame in drawFrame; starts fully
                    collapsed so it doesn't flash on the first paint. */}
                <g ref={leadCarRef} transform="translate(200 225) scale(0)" pointerEvents="none">
                    <polygon
                        points="-15,-10 15,-10 0,10"
                        fill="#facc15"
                        stroke="#854d0e"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
                    <polygon
                        points="-11,-15 11,-15 0,-5"
                        fill="#facc15"
                        opacity="0.55"
                    />
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

            {/* Route info (top-left): a thin, subtle personality label with the
                live drive status stacked beneath it. Both stay minimal so they
                never crowd the speed indicator at any simulator size. */}
            <div className="absolute left-[4%] top-[8%] select-none pointer-events-none max-w-[55%] flex flex-col gap-0.5">
                <span
                    className="text-[clamp(7px,1.4cqw,10px)] font-medium tracking-[0.2em] uppercase opacity-55 whitespace-nowrap truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
                    style={{ color: profile.pathColor }}
                >
                    {profile.label}
                </span>
                {!hideStatus && (
                    <span
                        ref={statusTextRef}
                        className="text-[clamp(7px,1.5cqw,11px)] font-semibold tracking-[0.1em] uppercase text-emerald-400 truncate transition-colors duration-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                    >
                        SYSTEM ACTIVE
                    </span>
                )}
            </div>

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
        </div>
    );
}
