'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

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
    };
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

// 10s scripted curvature in raw viewBox units. Built as:
//   - C∞ smooth periodic baseline (multi-sine) → continuous highway-style drift
//   - Gaussian "bumps" → distinct bend events of various radii
// All bumps are wide (width ≥ 0.07) so the curves enter and exit gradually,
// like real freeway/arterial geometry rather than tight switchbacks.
function roadCurveAt(p: number): number {
    const TAU = Math.PI * 2;
    // Gentle continuous baseline — small amplitudes, multi-frequency.
    const baseline =
        Math.sin(TAU * p) * 12 +
        Math.sin(TAU * p * 2 + 0.7) * 6 +
        Math.sin(TAU * p * 3 - 0.3) * 3;

    const bump = (center: number, amp: number, width: number) => {
        let d = p - center;
        if (d > 0.5) d -= 1;
        else if (d < -0.5) d += 1;
        return amp * Math.exp(-(d * d) / (2 * width * width));
    };

    // Realistic mix: long sweeping curves rather than switchbacks.
    return (
        baseline +
        bump(0.20, 38, 0.075) +   // long sweeping right (highway curve)
        bump(0.42, -28, 0.07) +   // moderate left transition
        bump(0.65, -52, 0.075) +  // moderate left curve (the most pronounced bend)
        bump(0.85, 26, 0.07)      // recovering right
    );
}

// View geometry — three-lane road. The car (trajectory) sits in the MIDDLE lane,
// centered at viewport X = 200. Lane dividers run on BOTH sides of the car view.
const VB_W = 400;
const VB_H = 225;
const HORIZON_Y = 88;
const CAR_Y = VB_H;             // bottom edge
const LANE_HALF_BOTTOM = 55;    // half of one lane's width at camera
const LANE_HALF_TOP = 5;        // half of one lane's width at horizon

interface Props {
    profile: DrivingProfile;
    seedKey: string; // model name (deterministic noise)
}

export default function DriveSimulation({ profile, seedKey }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const leftEdgeRef = useRef<SVGPathElement>(null);
    const rightEdgeRef = useRef<SVGPathElement>(null);
    const roadFillRef = useRef<SVGPathElement>(null);
    const chosenPathRef = useRef<SVGPathElement>(null);
    const dashGroupRef = useRef<SVGGElement>(null);
    const wheelRef = useRef<SVGGElement>(null);
    const speedTextRef = useRef<SVGTextElement>(null);

    const [isVisible, setIsVisible] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);

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

    // Animation loop
    useEffect(() => {
        if (!isVisible) return;

        // ===== geometry helpers (shared across frames) =====
        // Middle-lane centerline (= the car's lane). Trajectory anchors here at
        // x = VB_W/2 at the camera. Bend uses smoothstep so the curve is visible
        // throughout the road, not just compressed at the horizon.
        const myLaneCenterX = (yFrac: number, horizonX: number) =>
            VB_W / 2 + horizonX * yFrac * yFrac * (3 - 2 * yFrac);
        // Half-width of ONE lane at depth yFrac (perspective taper).
        const laneHalfWidth = (yFrac: number) =>
            LANE_HALF_BOTTOM + (LANE_HALF_TOP - LANE_HALF_BOTTOM) * yFrac;
        // Two dividers — one on each side of the car's lane.
        const dividerLeftXAt = (yFrac: number, horizonX: number) =>
            myLaneCenterX(yFrac, horizonX) - laneHalfWidth(yFrac);
        const dividerRightXAt = (yFrac: number, horizonX: number) =>
            myLaneCenterX(yFrac, horizonX) + laneHalfWidth(yFrac);
        // Outer road edges (3 lane-widths from middle-lane center).
        const leftRoadEdgeX = (yFrac: number, horizonX: number) =>
            myLaneCenterX(yFrac, horizonX) - 3 * laneHalfWidth(yFrac);
        const rightRoadEdgeX = (yFrac: number, horizonX: number) =>
            myLaneCenterX(yFrac, horizonX) + 3 * laneHalfWidth(yFrac);
        // World depth → screen yFrac via hyperbolic perspective.
        // Markers at small depth → small yFrac → near camera (bottom of screen).
        // dy/dd is large at small d → markers visibly accelerate toward camera.
        const PERSPECTIVE_K = 1.6;
        const depthToYFrac = (d: number) => d / (d + PERSPECTIVE_K);
        // Inverse: yFrac → world depth (used to set marker spacing in world units)
        const yFracToDepth = (yFrac: number) =>
            yFrac >= 1 ? Infinity : (yFrac * PERSPECTIVE_K) / (1 - yFrac);

        // Chosen-path width tapers wide-at-camera → narrow-at-tip
        const PATH_WIDTH_BOTTOM = 0.78;
        const PATH_WIDTH_TOP = 0.30;
        // Trajectory ends short of the horizon (like a real driver-assist UI's
        // near-future plan). Gives lateral room without exiting the road.
        const TIP_YFRAC = 0.88;

        // ===== draw a single frame from current state =====
        const drawFrame = (
            t: number,
            actualHorizonX: number,
            trajectoryX: number,
            markerDepths: number[],
            wheelAngle: number
        ) => {
            const STEPS = 24;
            // Outer road edges (left and right) + full-road fill.
            let leftD = '', rightD = '';
            for (let i = 0; i <= STEPS; i++) {
                const yFrac = i / STEPS;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const lx = leftRoadEdgeX(yFrac, actualHorizonX);
                const rx = rightRoadEdgeX(yFrac, actualHorizonX);
                if (i === 0) {
                    leftD = `M ${lx.toFixed(2)} ${y.toFixed(2)}`;
                    rightD = `M ${rx.toFixed(2)} ${y.toFixed(2)}`;
                } else {
                    leftD += ` L ${lx.toFixed(2)} ${y.toFixed(2)}`;
                    rightD += ` L ${rx.toFixed(2)} ${y.toFixed(2)}`;
                }
            }
            // Fill: walk left edge bottom→top, then right edge top→bottom (whole road, both lanes).
            let fillD = leftD;
            for (let i = STEPS; i >= 0; i--) {
                const yFrac = i / STEPS;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                fillD += ` L ${rightRoadEdgeX(yFrac, actualHorizonX).toFixed(2)} ${y.toFixed(2)}`;
            }
            fillD += ' Z';
            leftEdgeRef.current?.setAttribute('d', leftD);
            rightEdgeRef.current?.setAttribute('d', rightD);
            roadFillRef.current?.setAttribute('d', fillD);

            // Chosen path: a single smooth arc from the car (yFrac=0) to a model-determined
            // trajectory tip (yFrac=TIP_YFRAC). Acts like a planned car trajectory — anchored
            // at the bottom, never twists or bulges off the lane.
            // Curve uses yFrac² (not the road's smoothstep) so the arc naturally cuts the
            // inside of the curve, the way a real driving line does.
            // actualHorizonX is unused here (the trajectoryX is already model-relative);
            // void-ref it to silence linters.
            void actualHorizonX;
            const widthScale = profile.pathWidth;
            const arcDX = (yFrac: number) => trajectoryX * yFrac * yFrac;
            const pathHW = (yFrac: number) => {
                const taper = PATH_WIDTH_BOTTOM + (PATH_WIDTH_TOP - PATH_WIDTH_BOTTOM) * yFrac;
                return laneHalfWidth(yFrac) * taper * widthScale;
            };
            let chosenD = '';
            for (let i = 0; i <= STEPS; i++) {
                const yFrac = (i / STEPS) * TIP_YFRAC;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const cx = VB_W / 2 + arcDX(yFrac);
                const lx = cx - pathHW(yFrac);
                if (i === 0) chosenD = `M ${lx.toFixed(2)} ${y.toFixed(2)}`;
                else chosenD += ` L ${lx.toFixed(2)} ${y.toFixed(2)}`;
            }
            for (let i = STEPS; i >= 0; i--) {
                const yFrac = (i / STEPS) * TIP_YFRAC;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const cx = VB_W / 2 + arcDX(yFrac);
                chosenD += ` L ${(cx + pathHW(yFrac)).toFixed(2)} ${y.toFixed(2)}`;
            }
            chosenD += ' Z';
            chosenPathRef.current?.setAttribute('d', chosenD);

            // Lane divider dashes — rendered on BOTH dividers (one each side of the car's lane).
            // Each dash is a perspective trapezoid: spans world depths [d − L/2, d + L/2],
            // narrow at the far end, wider at the near end, naturally tilted along the road's
            // tangent because near and far X are sampled from dividerXAt at each end.
            if (dashGroupRef.current) {
                const DASH_LEN = 1.4;     // world units
                const DASH_BASE_W = 5;    // viewBox units at camera
                let svg = '';
                for (const d of markerDepths) {
                    const dNear = Math.max(0.05, d - DASH_LEN / 2);
                    const dFar = d + DASH_LEN / 2;
                    const yFracNear = depthToYFrac(dNear);
                    const yFracFar = depthToYFrac(dFar);
                    if (yFracFar > 0.94) continue; // dash entirely past horizon

                    const yNear = CAR_Y + (HORIZON_Y - CAR_Y) * yFracNear;
                    const yFar = CAR_Y + (HORIZON_Y - CAR_Y) * yFracFar;
                    const wNear = DASH_BASE_W * (1 - yFracNear);
                    const wFar = DASH_BASE_W * (1 - yFracFar);

                    // Opacity gates on the far end (so dashes fade in as they emerge from horizon)
                    const opacity = Math.max(0, Math.min(0.85, (0.94 - yFracFar) * 1.5));
                    if (opacity <= 0.005) continue;

                    // Both divider dashes for this depth — left and right of the car
                    const xNL = dividerLeftXAt(yFracNear, actualHorizonX);
                    const xFL = dividerLeftXAt(yFracFar, actualHorizonX);
                    const xNR = dividerRightXAt(yFracNear, actualHorizonX);
                    const xFR = dividerRightXAt(yFracFar, actualHorizonX);

                    const fill = `rgba(255,255,255,${opacity.toFixed(2)})`;
                    svg += `<path d="M ${(xNL - wNear / 2).toFixed(2)} ${yNear.toFixed(2)} L ${(xFL - wFar / 2).toFixed(2)} ${yFar.toFixed(2)} L ${(xFL + wFar / 2).toFixed(2)} ${yFar.toFixed(2)} L ${(xNL + wNear / 2).toFixed(2)} ${yNear.toFixed(2)} Z" fill="${fill}"/>`;
                    svg += `<path d="M ${(xNR - wNear / 2).toFixed(2)} ${yNear.toFixed(2)} L ${(xFR - wFar / 2).toFixed(2)} ${yFar.toFixed(2)} L ${(xFR + wFar / 2).toFixed(2)} ${yFar.toFixed(2)} L ${(xNR + wNear / 2).toFixed(2)} ${yNear.toFixed(2)} Z" fill="${fill}"/>`;
                }
                dashGroupRef.current.innerHTML = svg;
            }

            // Steering wheel rotation — match the road's bend direction.
            if (wheelRef.current) {
                wheelRef.current.setAttribute(
                    'transform',
                    `translate(20 ${VB_H - 22}) rotate(${wheelAngle.toFixed(2)})`
                );
            }

            // Speed text alpha pulse with curvature
            if (speedTextRef.current) {
                const curvature = Math.abs(roadCurveAt(t));
                const alpha = 0.9 - (curvature / 95) * 0.15;
                speedTextRef.current.setAttribute('opacity', alpha.toFixed(2));
            }
        };

        // ===== reduced motion: render one static frame =====
        if (reduceMotion) {
            const initialDepths: number[] = [];
            for (let i = 0; i < 5; i++) initialDepths.push(1.5 + i * 3.5);
            const trajX = profile.laneOffset * 14;
            drawFrame(0, 0, trajX, initialDepths, 0);
            return;
        }

        // ===== animated state =====
        const seedRng = rng(seed);
        // wobble: sum of sines with random phases — smooth, deterministic
        const phase1 = seedRng() * Math.PI * 2;
        const phase2 = seedRng() * Math.PI * 2;
        const phase3 = seedRng() * Math.PI * 2;

        // Persistent state across frames
        let perceivedHorizonX = 0; // exponentially smoothed actualHorizonX

        // Marker world depths spaced uniformly between camera and MAX_DEPTH.
        // Fewer + farther → no stacking when perspective compresses near the horizon.
        const NUM_MARKERS = 5;
        const MAX_DEPTH = 18;
        const markerDepths: number[] = [];
        for (let i = 0; i < NUM_MARKERS; i++) {
            markerDepths.push(1 + (i / NUM_MARKERS) * MAX_DEPTH);
        }

        let raf = 0;
        let startTs = 0;
        let lastNow = 0;
        let perceivedWheelAngle = 0; // exponentially smoothed steering angle
        const DURATION = 10000;

        const tick = (now: number) => {
            if (!startTs) startTs = now;
            if (!lastNow) lastNow = now;
            const dt = Math.min(0.05, (now - lastNow) / 1000);
            lastNow = now;

            const elapsed = (now - startTs) % DURATION;
            const t = elapsed / DURATION;

            // Actual road horizon offset (viewBox units). roadCurveAt is ~[-95, +95].
            const actualHorizonX = roadCurveAt(t) * 0.7;

            // Temporal smoothing — perceivedHorizonX exponentially eases toward actual.
            // Higher pathSmoothness → faster tracking; lower → more lag (heavy/twitchy).
            const trackRate = 0.7 + profile.pathSmoothness * 5.5;
            perceivedHorizonX =
                actualHorizonX +
                (perceivedHorizonX - actualHorizonX) * Math.exp(-trackRate * dt);

            // Wobble: 3-sine sum, deterministic per model.
            const tSec = now / 1000;
            const wobbleAmp = profile.laneWobble * 14;
            const wobble =
                (Math.sin(tSec * 1.7 + phase1) * 0.5 +
                    Math.sin(tSec * 3.3 + phase2) * 0.3 +
                    Math.sin(tSec * 5.9 + phase3) * 0.2) *
                wobbleAmp;

            // Right/left-hugging bias — applied to where the trajectory points at its tip
            const offsetBias = profile.laneOffset * 14;

            // Trajectory tip X-offset: where the model's planned path AIMS at TIP_YFRAC.
            // Sources: smoothed perception of the road curve, intentional bias, wobble.
            // Clamped to keep the path's edges inside the RIGHT LANE at the trajectory tip
            // (a normal car shouldn't drift into the oncoming/adjacent lane).
            const tipSmooth = TIP_YFRAC * TIP_YFRAC * (3 - 2 * TIP_YFRAC); // road bend at tip
            const tipQuad = TIP_YFRAC * TIP_YFRAC; // path bend at tip (yFrac²)
            const tipLaneHW = LANE_HALF_BOTTOM + (LANE_HALF_TOP - LANE_HALF_BOTTOM) * TIP_YFRAC;
            const tipTaper = PATH_WIDTH_BOTTOM + (PATH_WIDTH_TOP - PATH_WIDTH_BOTTOM) * TIP_YFRAC;
            const tipPathHW = tipLaneHW * tipTaper * profile.pathWidth;
            const margin = 0.5;
            const minTrajX = (actualHorizonX * tipSmooth - tipLaneHW + margin + tipPathHW) / tipQuad;
            const maxTrajX = (actualHorizonX * tipSmooth + tipLaneHW - margin - tipPathHW) / tipQuad;

            let trajectoryX = perceivedHorizonX + offsetBias + wobble;
            if (trajectoryX < minTrajX) trajectoryX = minTrajX;
            else if (trajectoryX > maxTrajX) trajectoryX = maxTrajX;

            // Steering wheel: target angle proportional to where the model PERCEIVES
            // the road is curving. Smoothed for natural hand motion.
            const targetWheelAngle = (perceivedHorizonX / 66.5) * 38; // ±38° at peak curvature
            perceivedWheelAngle =
                targetWheelAngle +
                (perceivedWheelAngle - targetWheelAngle) * Math.exp(-6 * dt);

            // Advance markers (constant world speed → perspective creates visual acceleration).
            const worldSpeed = 2.0 + (profile.speed / 70) * 5.5;
            for (let i = 0; i < markerDepths.length; i++) {
                markerDepths[i] -= worldSpeed * dt;
                if (markerDepths[i] < 0) markerDepths[i] += MAX_DEPTH;
            }

            drawFrame(t, actualHorizonX, trajectoryX, markerDepths, perceivedWheelAngle);

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [isVisible, reduceMotion, profile, seed]);

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg bg-slate-950"
            style={{ aspectRatio: '16 / 9' }}
            aria-hidden="true"
        >
            <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f172a" />
                        <stop offset="60%" stopColor="#020617" />
                    </linearGradient>
                    <linearGradient id={`path-${seed}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={profile.pathColor} stopOpacity="0.15" />
                        <stop offset="60%" stopColor={profile.pathColor} stopOpacity="0.55" />
                        <stop offset="100%" stopColor={profile.pathColor} stopOpacity="0.85" />
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

                {/* chosen path (model's decision — sits in the middle lane) */}
                <path ref={chosenPathRef} d="M 170 225 L 197 104 L 203 104 L 230 225 Z" fill={`url(#path-${seed})`} stroke={profile.pathColor} strokeOpacity="0.6" strokeWidth="0.8" />

                {/* speed indicator (top-center) */}
                <g>
                    <text
                        ref={speedTextRef}
                        x={VB_W / 2}
                        y="42"
                        textAnchor="middle"
                        fill="white"
                        fontSize="28"
                        fontWeight="700"
                        fontFamily="system-ui, -apple-system, sans-serif"
                        style={{ paintOrder: 'stroke' }}
                    >
                        {profile.speed}
                    </text>
                    <text
                        x={VB_W / 2}
                        y="58"
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.65)"
                        fontSize="9"
                        fontWeight="600"
                        letterSpacing="2"
                        fontFamily="system-ui, -apple-system, sans-serif"
                    >
                        MPH
                    </text>
                </g>

                {/* personality label (top-left) */}
                <text
                    x="14"
                    y="22"
                    fill={profile.pathColor}
                    fontSize="9"
                    fontWeight="700"
                    letterSpacing="1.5"
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    {profile.label}
                </text>

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

            {/* subtle vignette at top to fade the scene */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/40 to-transparent" />
        </div>
    );
}
