/**
 * Converts synthetic route state (gauntlet/highway/curves/city) into
 * ParsedModelV2-shaped frames, so the wiki's drive simulator can render
 * through openpilot's real projection + Canvas2D pipeline.
 *
 * The generator samples the route's heading(z) and relativeX(carZ, d)
 * functions at 33 depth points (matching openpilot's T_IDXS spacing)
 * and outputs position/laneLines/roadEdges/laneLineProbs/roadEdgeStds
 * in the exact same format the real model produces.
 *
 * Coordinate frame (matching openpilot modelV2):
 *   x → forward (m)
 *   y → left    (m)   ← NOTE: positive y = LEFT
 *   z → up      (m)
 */

import type { Scenario } from './gauntletRoute';

// ── openpilot-matching depth samples ──
// 33 points from 0m → ~192m, mirroring the quadratic-ish T_IDXS spacing
// in selfdrive/modeld/constants.py. The exact values don't matter much —
// what matters is that the forward range covers 0..MAX_DRAW_DISTANCE and
// the spacing is denser near the car (for visual resolution).
const N_POINTS = 33;
const MAX_FORWARD_M = 192;

function buildDepthSamples(): Float32Array {
    const pts = new Float32Array(N_POINTS);
    for (let i = 0; i < N_POINTS; i++) {
        // Quadratic spacing: denser near the car, sparser at distance
        const t = i / (N_POINTS - 1);
        pts[i] = t * t * MAX_FORWARD_M;
    }
    return pts;
}

const DEPTH_SAMPLES = buildDepthSamples();

// ── Lane geometry constants (meters) ──
const LANE_WIDTH = 3.7;          // standard US lane width
const HALF_LANE = LANE_WIDTH / 2;
const ROAD_EDGE_OFFSET = LANE_WIDTH * 2;  // edges at ±2 lanes from center

// ── XYZTPoints (same shape as ParsedModelV2 fields) ──
export interface XYZTPoints {
    x: Float32Array;
    y: Float32Array;
    z: Float32Array;
}

export interface SyntheticModelFrame {
    logMonoTime: bigint;
    position: XYZTPoints;
    laneLines: XYZTPoints[];
    laneLineProbs: Float32Array;
    roadEdges: XYZTPoints[];
    roadEdgeStds: Float32Array;
    accelerationX: Float32Array;
}

// ── Profile influence parameters ──
export interface RouteProfileParams {
    /** 0..1: random lateral jitter amplitude */
    laneWobble: number;
    /** -1..1: lateral bias (negative = right, positive = left) */
    laneOffset: number;
    /** 0..1: how cleanly the path tracks the ideal line */
    pathSmoothness: number;
    /** 0..1: how much the model cuts corners (shifts path inside the apex) */
    cornerCutting: number;
    /** Deterministic noise seed */
    seed: number;
    /** Current display speed in mph (used to scale wobble frequency) */
    speedMph: number;
    /** Whether the car is effectively stopped (short predicted path) */
    stopped: boolean;
    /** Camera height above road (meters) */
    calibHeight: number;
}

// Mulberry32 PRNG — same as DriveSimulation uses
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Generate a single modelV2-shaped frame from the synthetic route state.
 *
 * @param scenario    The active route scenario (gauntlet, highway, etc.)
 * @param carZ        Car's current position along the route (route units ≈ meters)
 * @param params      Profile influence parameters
 * @param frameTime   Monotonic frame time (seconds, for wobble phase animation)
 */
export function generateSyntheticFrame(
    scenario: Scenario,
    carZ: number,
    params: RouteProfileParams,
    frameTime: number,
): SyntheticModelFrame {
    const n = N_POINTS;
    const rng = mulberry32(params.seed + Math.floor(carZ * 10));

    // ── Build the predicted path ──
    const pathX = new Float32Array(n);
    const pathY = new Float32Array(n);
    const pathZ = new Float32Array(n);

    // How far ahead the model "sees" — a stopped car predicts a short path
    const maxForward = params.stopped ? 8 : MAX_FORWARD_M;

    // Wobble parameters: frequency and amplitude from profile (0 when stopped)
    const speedScale = params.stopped || params.speedMph <= 0.05 ? 0 : Math.min(1, Math.max(0, params.speedMph / 5));
    const wobbleAmp = params.laneWobble * 0.45 * speedScale; // max ~0.45m lateral jitter, 0 at standstill
    const wobbleFreq1 = 0.8 + params.speedMph * 0.02;
    const wobbleFreq2 = 1.7 + params.speedMph * 0.01;
    const wobblePhase1 = frameTime * wobbleFreq1;
    const wobblePhase2 = frameTime * wobbleFreq2;

    // Lane offset in meters (profile's -1..1 → ±HALF_LANE)
    const offsetM = params.laneOffset * HALF_LANE;

    for (let i = 0; i < n; i++) {
        const d = Math.min(DEPTH_SAMPLES[i], maxForward);
        pathX[i] = d;

        // Route's lateral deviation at distance d ahead
        // relativeX returns positive for right-turning road
        // openpilot y-axis: positive = LEFT
        // So negate: right turn → negative y (car moves right)
        const routeLateralRaw = scenario.relativeX(carZ, d);

        // Corner cutting: shift the path toward the inside of curves
        // The route curvature sign tells us which direction the corner goes
        const headingAtD = scenario.heading(carZ + d);
        const cutShift = params.cornerCutting * headingAtD * 0.6 * Math.min(1, d / 20);

        // Smoothness: high smoothness → path closely follows the route;
        // low smoothness → path lags/overshoots
        const smoothFactor = 0.5 + params.pathSmoothness * 0.5;
        const routeLateral = routeLateralRaw * smoothFactor;

        // Wobble: sinusoidal noise that decays with distance (wobble is most
        // visible near the car and fades at the horizon)
        const distFade = Math.max(0, 1 - d / 60);
        const wobble = wobbleAmp * distFade * (
            Math.sin(wobblePhase1 + d * 0.15 + rng() * 0.3) * 0.6 +
            Math.sin(wobblePhase2 + d * 0.25) * 0.4
        );

        // Combine: route deviation + offset + wobble + corner cutting
        // Negate routeLateral because relativeX positive = right, model y positive = left
        pathY[i] = -routeLateral + offsetM + wobble + cutShift;

        // Z = road surface height (flat road → 0)
        pathZ[i] = 0;
    }

    // ── Lane lines (4 lines: far-left, left, right, far-right) ──
    const laneLines: XYZTPoints[] = [];
    const laneOffsets = [
        -HALF_LANE * 3,  // far-left lane line
        -HALF_LANE,      // left lane line (nearest left)
        HALF_LANE,       // right lane line (nearest right)
        HALF_LANE * 3,   // far-right lane line
    ];

    for (const laneOff of laneOffsets) {
        const lx = new Float32Array(n);
        const ly = new Float32Array(n);
        const lz = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            lx[i] = pathX[i]; // same forward distances
            // Lane line sits at a fixed lateral offset from the PATH
            // (openpilot's lane lines are in the same car-space frame;
            // they move with the road, not fixed to the car)
            ly[i] = pathY[i] + laneOff;
            lz[i] = params.calibHeight; // Set to ground level (camera height)
        }
        laneLines.push({ x: lx, y: ly, z: lz });
    }

    // Lane line probabilities — inner lines are high confidence, outer lines lower.
    // Real models report ~0.3–1.0 for visible lines and ~0 for lines they can't see.
    // The real renderer draws lane lines with:
    //   - ribbon width = 0.025 * prob (so prob must be ~0.5+ to be visible)
    //   - fill alpha   = clamp(prob, 0, 0.7)
    // We use high probabilities to match real driving output.
    const curvature = Math.abs(scenario.heading(carZ));
    const baseProb = params.stopped ? 0.3 : 1.0;
    const curveFade = Math.max(0.5, 1 - curvature * 0.8);
    const laneLineProbs = Float32Array.from([
        baseProb * curveFade * 0.55,   // far-left: lower confidence
        baseProb * curveFade * 0.95,   // left: high confidence
        baseProb * curveFade * 0.95,   // right: high confidence
        baseProb * curveFade * 0.55,   // far-right: lower confidence
    ]);

    // ── Road edges (2 edges: left, right) ──
    const roadEdges: XYZTPoints[] = [];
    const edgeOffsets = [-ROAD_EDGE_OFFSET, ROAD_EDGE_OFFSET];
    for (const edgeOff of edgeOffsets) {
        const ex = new Float32Array(n);
        const ey = new Float32Array(n);
        const ez = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            ex[i] = pathX[i];
            ey[i] = pathY[i] + edgeOff;
            ez[i] = params.calibHeight; // Set to ground level
        }
        roadEdges.push({ x: ex, y: ey, z: ez });
    }

    // Road edge standard deviations — lower std = more visible.
    // The real renderer draws edges with alpha = clamp(1 - std, 0, 1),
    // so std ~0.2 → alpha ~0.8 (visible), std ~0.9 → alpha ~0.1 (faint).
    // Curves increase uncertainty (fainter edges).
    const edgeStd = params.stopped ? 0.6 : Math.min(0.7, 0.1 + curvature * 0.8);
    const roadEdgeStds = Float32Array.from([edgeStd, edgeStd]);

    // ── Acceleration (placeholder — not rendered, but needed by the type) ──
    const accelerationX = new Float32Array(n);

    return {
        logMonoTime: BigInt(Math.floor(frameTime * 1e9)),
        position: { x: pathX, y: pathY, z: pathZ },
        laneLines,
        laneLineProbs,
        roadEdges,
        roadEdgeStds,
        accelerationX,
    };
}

// ── Default calibration for the synthetic simulator ──
// Uses comma three's AR0231 road camera parameters, with a neutral
// calibration (slight downward pitch matching a typical mount).
export const SYNTHETIC_CALIB = {
    rpyCalib: Float32Array.from([0.0, 0.05, 0.0]),  // slight pitch down
    height: 1.22,  // HEIGHT_INIT from openpilot
};
