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
function roadHeading(z: number) {
    const LOOP_Z = 200;
    const TAU = Math.PI * 2;
    const p = (z % LOOP_Z) / LOOP_Z;
    return 0.15 * Math.sin(TAU * p) + 0.1 * Math.sin(TAU * p * 2) + 0.05 * Math.sin(TAU * p * 3);
}

function roadX(z: number) {
    const LOOP_Z = 200;
    const TAU = Math.PI * 2;
    const k1 = TAU / LOOP_Z;
    const k2 = 2 * TAU / LOOP_Z;
    const k3 = 3 * TAU / LOOP_Z;
    return -0.15/k1 * Math.cos(k1 * z) - 0.1/k2 * Math.cos(k2 * z) - 0.05/k3 * Math.cos(k3 * z);
}

function relativeX(carZ: number, d: number) {
    return roadX(carZ + d) - roadX(carZ) - d * roadHeading(carZ);
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
    const [speed, setSpeed] = useState(profile.speed);

    // Keep displayed speed in sync when the underlying model/profile changes
    useEffect(() => {
        setSpeed(profile.speed);
    }, [profile.speed]);

    const SPEED_STEP = 5;
    const SPEED_MIN = 5;
    const SPEED_MAX = 120;
    const adjustSpeed = (delta: number) =>
        setSpeed((s) => Math.max(SPEED_MIN, Math.min(SPEED_MAX, s + delta)));

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
        const PERSPECTIVE_K = 1.6;
        const depthToYFrac = (d: number) => d / (d + PERSPECTIVE_K);
        const yFracToDepth = (yFrac: number) =>
            yFrac >= 1 ? Infinity : (yFrac * PERSPECTIVE_K) / (1 - yFrac);

        const laneHalfWidth = (yFrac: number) =>
            LANE_HALF_BOTTOM + (LANE_HALF_TOP - LANE_HALF_BOTTOM) * yFrac;

        const PATH_WIDTH_BOTTOM = 0.80;
        const PATH_WIDTH_TOP = 0.80;
        const TIP_YFRAC = 0.88;

        // ===== draw a single frame from current state =====
        const drawFrame = (
            carZ: number,
            actualTipX: number,
            targetTipX: number,
            markerDepths: number[],
            wheelAngle: number
        ) => {
            const STEPS = 24;
            
            const getRoadCenterX = (yFrac: number) => {
                if (yFrac >= 1) return VB_W / 2 - roadHeading(carZ) * 400;
                const d = yFracToDepth(yFrac);
                const rx = relativeX(carZ, d);
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
            const relativeTipX = targetTipX - actualTipX;
            const arcDX = (yFrac: number) => relativeTipX * Math.pow(yFrac / TIP_YFRAC, 2);
            
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
                const curvature = Math.abs(roadHeading(carZ));
                const alpha = Math.max(0.3, 0.9 - (curvature / 0.3) * 0.4);
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
        let startTs = 0;
        let lastNow = 0;
        let perceivedTipX = 0;
        let perceivedWheelAngle = 0;
        let carZ = 0;

        const tick = (now: number) => {
            if (!startTs) startTs = now;
            if (!lastNow) lastNow = now;
            const dt = Math.min(0.05, (now - lastNow) / 1000);
            lastNow = now;

            const worldSpeed = 2.0 + (speed / 70) * 5.5;
            carZ += worldSpeed * dt;

            const tipD = yFracToDepth(TIP_YFRAC);
            const actualTipX = (relativeX(carZ, tipD) / (tipD + PERSPECTIVE_K)) * 400;

            const trackRate = 0.7 + profile.pathSmoothness * 5.5;
            perceivedTipX = actualTipX + (perceivedTipX - actualTipX) * Math.exp(-trackRate * dt);

            const tSec = now / 1000;
            const wobbleAmp = profile.laneWobble * 14;
            const wobble =
                (Math.sin(tSec * 1.7 + phase1) * 0.5 +
                 Math.sin(tSec * 3.3 + phase2) * 0.3 +
                 Math.sin(tSec * 5.9 + phase3) * 0.2) * wobbleAmp;

            const offsetBias = profile.laneOffset * 14;
            
            let targetTipX = perceivedTipX + offsetBias + wobble;

            const tipLaneHW = laneHalfWidth(TIP_YFRAC);
            const tipTaper = PATH_WIDTH_BOTTOM + (PATH_WIDTH_TOP - PATH_WIDTH_BOTTOM) * TIP_YFRAC;
            const tipPathHW = tipLaneHW * tipTaper * profile.pathWidth;
            const margin = 0.5;

            const minTipX = actualTipX - tipLaneHW + margin + tipPathHW;
            const maxTipX = actualTipX + tipLaneHW - margin - tipPathHW;

            if (targetTipX < minTipX) targetTipX = minTipX;
            else if (targetTipX > maxTipX) targetTipX = maxTipX;

            const targetWheelAngle = (actualTipX / 70) * 45;
            perceivedWheelAngle = targetWheelAngle + (perceivedWheelAngle - targetWheelAngle) * Math.exp(-6 * dt);

            for (let i = 0; i < markerDepths.length; i++) {
                markerDepths[i] -= worldSpeed * dt;
                if (markerDepths[i] < -1.0) markerDepths[i] += MAX_DEPTH;
            }

            drawFrame(carZ, actualTipX, targetTipX, markerDepths, perceivedWheelAngle);

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [isVisible, reduceMotion, profile, seed, speed]);

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg bg-slate-950"
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
                        {speed}
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

            {/* speed controls — flank the MPH readout */}
            <div
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-[14%] select-none"
                style={{ top: '16%' }}
            >
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); adjustSpeed(-SPEED_STEP); }}
                    disabled={speed <= SPEED_MIN}
                    aria-label="Decrease simulation speed"
                    className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 backdrop-blur-sm text-white text-base font-bold leading-none flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    −
                </button>
                {/* spacer reserved for the SVG MPH text */}
                <div aria-hidden="true" className="w-12" />
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); adjustSpeed(SPEED_STEP); }}
                    disabled={speed >= SPEED_MAX}
                    aria-label="Increase simulation speed"
                    className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/35 backdrop-blur-sm text-white text-base font-bold leading-none flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    +
                </button>
            </div>
        </div>
    );
}
