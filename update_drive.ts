import fs from 'fs';

let content = fs.readFileSync('components/DriveSimulation.tsx', 'utf-8');

// Replace the roadCurveAt function with the new world functions
content = content.replace(
/function roadCurveAt[\s\S]*?return \([\s\S]*?\);\n}/m,
`function roadHeading(z: number) {
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
}`
);

// We need to replace actualHorizonX and trajectoryX in drawFrame
// We'll just replace the whole drawFrame function.
const drawFrameOldStart = "        // ===== draw a single frame from current state =====";
const drawFrameOldEnd = "        // ===== animated state =====";

const drawFrameNew = `        // ===== geometry helpers (shared across frames) =====
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
                    leftD = \`M \${lx.toFixed(2)} \${y.toFixed(2)}\`;
                    rightD = \`M \${rx.toFixed(2)} \${y.toFixed(2)}\`;
                } else {
                    leftD += \` L \${lx.toFixed(2)} \${y.toFixed(2)}\`;
                    rightD += \` L \${rx.toFixed(2)} \${y.toFixed(2)}\`;
                }
            }
            
            let fillD = leftD;
            for (let i = STEPS; i >= 0; i--) {
                const yFrac = i / STEPS;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const centerX = getRoadCenterX(yFrac);
                fillD += \` L \${(centerX + 3 * laneHalfWidth(yFrac)).toFixed(2)} \${y.toFixed(2)}\`;
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
                if (i === 0) chosenD = \`M \${lx.toFixed(2)} \${y.toFixed(2)}\`;
                else chosenD += \` L \${lx.toFixed(2)} \${y.toFixed(2)}\`;
            }
            for (let i = STEPS; i >= 0; i--) {
                const yFrac = (i / STEPS) * TIP_YFRAC;
                const y = CAR_Y + (HORIZON_Y - CAR_Y) * yFrac;
                const roadCx = getRoadCenterX(yFrac);
                const cx = roadCx + arcDX(yFrac);
                chosenD += \` L \${(cx + pathHW(yFrac)).toFixed(2)} \${y.toFixed(2)}\`;
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
                    if (yFracFar > 0.94) continue;

                    const yNear = CAR_Y + (HORIZON_Y - CAR_Y) * yFracNear;
                    const yFar = CAR_Y + (HORIZON_Y - CAR_Y) * yFracFar;
                    
                    const wNear = DASH_BASE_W * (1 - yFracNear);
                    const wFar = DASH_BASE_W * (1 - yFracFar);
                    const wMid = (wNear + wFar) / 2;

                    const opacity = Math.max(0, Math.min(0.85, (0.94 - yFracFar) * 1.5));
                    if (opacity <= 0.005) continue;

                    const centerNear = getRoadCenterX(yFracNear);
                    const centerFar = getRoadCenterX(yFracFar);

                    const hwNear = laneHalfWidth(yFracNear);
                    const hwFar = laneHalfWidth(yFracFar);

                    const xNL = centerNear - hwNear;
                    const xFL = centerFar - hwFar;
                    const xNR = centerNear + hwNear;
                    const xFR = centerFar + hwFar;

                    const fill = \`rgba(255,255,255,\${opacity.toFixed(2)})\`;
                    svg += \`<path d="M \${xNL.toFixed(2)} \${yNear.toFixed(2)} L \${xFL.toFixed(2)} \${yFar.toFixed(2)}" stroke="\${fill}" stroke-width="\${wMid.toFixed(2)}" stroke-linecap="butt" fill="none" />\`;
                    svg += \`<path d="M \${xNR.toFixed(2)} \${yNear.toFixed(2)} L \${xFR.toFixed(2)} \${yFar.toFixed(2)}" stroke="\${fill}" stroke-width="\${wMid.toFixed(2)}" stroke-linecap="butt" fill="none" />\`;
                }
                dashGroupRef.current.innerHTML = svg;
            }

            if (wheelRef.current) {
                wheelRef.current.setAttribute(
                    'transform',
                    \`translate(20 \${VB_H - 22}) rotate(\${wheelAngle.toFixed(2)})\`
                );
            }

            if (speedTextRef.current) {
                const curvature = Math.abs(roadHeading(carZ));
                const alpha = Math.max(0.3, 0.9 - (curvature / 0.3) * 0.4);
                speedTextRef.current.setAttribute('opacity', alpha.toFixed(2));
            }
        };

        // ===== reduced motion: render one static frame =====
`;

content = content.replace(/        \/\/ ===== geometry helpers \([\s\S]*?\/\/ ===== reduced motion: render one static frame =====\n/m, drawFrameNew);

const animateStateOldStart = "        // ===== animated state =====";
const animateStateOldEnd = "        raf = requestAnimationFrame(tick);\n        return () => cancelAnimationFrame(raf);";

const animateStateNew = `        // ===== animated state =====
        const seedRng = rng(seed);
        const phase1 = seedRng() * Math.PI * 2;
        const phase2 = seedRng() * Math.PI * 2;
        const phase3 = seedRng() * Math.PI * 2;

        const NUM_MARKERS = 5;
        const MAX_DEPTH = 18;
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

            const worldSpeed = 2.0 + (profile.speed / 70) * 5.5;
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
        return () => cancelAnimationFrame(raf);`;

content = content.replace(/        \/\/ ===== animated state =====[\s\S]*?return \(\) => cancelAnimationFrame\(raf\);\n/m, animateStateNew + "\n");

// Also fix the reduced motion call:
content = content.replace(/        if \(reduceMotion\) \{[\s\S]*?drawFrame\(0, 0, trajX, initialDepths, 0\);[\s\S]*?return;\n        \}/m, `        if (reduceMotion) {
            const initialDepths: number[] = [];
            for (let i = 0; i < 5; i++) initialDepths.push(1.5 + i * 3.5);
            const trajX = profile.laneOffset * 14;
            drawFrame(0, 0, trajX, initialDepths, 0);
            return;
        }`);


fs.writeFileSync('components/DriveSimulation.tsx', content);
