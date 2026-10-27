/**
 * Parameterized trajectory kinematics for the model visualizer (Phase 2).
 *
 * A driving model outputs a desired path/curvature plan — not steering torque.
 * This module turns a ModelTelemetryProfile into:
 *   - an ideal plan (what the network asks for),
 *   - a high-authority execution (angle racks / tuned NNLC track the plan), and
 *   - a torque-limited EPS execution (rate / acceleration saturation causes
 *     understeer and a wide exit when turn-in is late),
 * plus a 20 Hz longitudinal desiredAcceleration timeline.
 *
 * Everything here is an illustrative simulation driven by feedback-derived
 * or curated telemetry values — it is not recorded modelV2 output unless a
 * ModelV2ReplaySnapshot is supplied.
 */
import type { ModelTelemetryProfile } from './modelMetadata';

export type TrajectoryScenario = 'highway' | 'scurve' | 'intersection';
export type ExecutionKind = 'highTorque' | 'torqueLimited';

export const TRAJECTORY_SCENARIOS: Record<TrajectoryScenario, { label: string; blurb: string }> = {
    highway: { label: 'Highway Straight', blurb: 'Lane centering and offset bias with a lead vehicle slowing ahead.' },
    scurve: { label: 'S-Curve / Sweeper', blurb: 'Apex cutting, turn-in timing and mid-corner corrections.' },
    intersection: { label: 'Urban Intersection', blurb: 'Deceleration to a stop line and red-light creep.' },
};

/** Static modelV2 replay snapshot (20 Hz): forward distance, lateral offset, speed, acceleration. */
export interface ModelV2ReplaySnapshot {
    x: number[];
    y: number[];
    v: number[];
    a: number[];
    hz?: number;
    label?: string;
}

export interface TrajectorySample {
    t: number;
    /** Distance travelled along the road (m). */
    s: number;
    /** Speed (m/s). */
    v: number;
    /** Model desiredAcceleration (m/s²). */
    a: number;
    /** Ideal plan lateral position at the car's s (m, + = right). */
    plan: number;
    highTorque: number;
    torqueLimited: number;
    /** Lead vehicle distance along the road, when present. */
    lead?: number;
}

export interface TrajectoryRun {
    scenario: TrajectoryScenario;
    dt: number;
    duration: number;
    samples: TrajectorySample[];
    stopLineS?: number;
    fromReplay: boolean;
    roadAt: (s: number) => number;
    planAt: (s: number) => number;
    execAt: (kind: ExecutionKind, s: number) => number;
    /** Largest lateral gap between the torque-limited execution and the plan (m). */
    maxTrackingError: number;
    /** How far past the stop line the car travelled (m); 0 when it stopped short. */
    stopOvershoot: number;
    /** Minimum bumper gap to the lead vehicle (m), when applicable. */
    minGap?: number;
    longitudinalStyle: 'early' | 'standard' | 'late';
}

export const LANE_WIDTH_M = 3.7;
export const DT = 0.05; // 20 Hz
const MAX_BIAS_M = 0.35;
const AMAX_HIGH = 3.2;       // m/s² lateral authority: angle racks / tuned NNLC
const AMAX_LIMITED = 1.6;    // m/s² lateral authority: stock low-torque EPS
const MAX_REL_LATERAL_SPEED = 2.0;  // m/s: bound on lateral speed relative to the plan
const MAX_TRACKING_ERROR_M = 1.4;   // m: roughly where the car would leave its lane

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ─── Road geometry ────────────────────────────────────────────────────────

const CURVE_AMPLITUDE = 4.0;
const CURVE_WAVELENGTH = 180;
const CURVE_K = (2 * Math.PI) / CURVE_WAVELENGTH;

function roadX(scenario: TrajectoryScenario, s: number): number {
    if (scenario !== 'scurve') return 0;
    return CURVE_AMPLITUDE * Math.sin(CURVE_K * s);
}
/** Second derivative of the road centreline (≈ curvature for small angles). */
function roadKappa(scenario: TrajectoryScenario, s: number): number {
    if (scenario !== 'scurve') return 0;
    return -CURVE_AMPLITUDE * CURVE_K * CURVE_K * Math.sin(CURVE_K * s);
}

// ─── Ideal lateral plan ───────────────────────────────────────────────────

function makePlan(scenario: TrajectoryScenario, p: ModelTelemetryProfile): (s: number) => number {
    const biasM = clamp(p.lateralBias, -1, 1) * MAX_BIAS_M;
    if (scenario !== 'scurve') return () => biasM;

    const timing = clamp(p.turnInTiming, -1, 1);
    // Early turn-in leads the road; late turn-in lags it.
    const lead = -timing * 9;
    // Early models dive to the apex (inside); late models run wide.
    const cut = -timing * 0.5;
    const kappaMax = CURVE_AMPLITUDE * CURVE_K * CURVE_K;
    const correctionAmp = 0.3 * Math.max(0, timing);

    // A late entry must be recovered with a sharper sweep, raising peak lateral demand.
    const sweep = 1 + 0.5 * Math.max(0, timing);

    return (s: number) => {
        // Inside of a bend is the side the centreline curves toward (sign of x'').
        const cutTerm = cut * (roadKappa('scurve', s) / kappaMax);
        const correction = correctionAmp * Math.sin(2 * CURVE_K * s + 0.8) * Math.min(1, Math.max(0, s) / 40);
        return sweep * roadX('scurve', s + lead) + biasM + cutTerm + correction;
    };
}

function interp(xs: number[], ys: number[], x: number): number {
    if (x <= xs[0]) return ys[0];
    const last = xs.length - 1;
    if (x >= xs[last]) return ys[last];
    let lo = 0, hi = last;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] <= x) lo = mid; else hi = mid;
    }
    const f = (x - xs[lo]) / Math.max(1e-6, xs[hi] - xs[lo]);
    return ys[lo] + (ys[hi] - ys[lo]) * f;
}

// ─── Longitudinal simulation ──────────────────────────────────────────────

interface LongResult { s: number[]; v: number[]; a: number[]; lead?: number[]; stopLineS?: number; minGap?: number; overshoot: number }

function simulateLongitudinal(scenario: TrajectoryScenario, p: ModelTelemetryProfile): LongResult {
    const agg = clamp(p.longitudinalAggressiveness, 0, 1);
    const creep = clamp(p.stopLineCreep, 0, 1);
    const tau = 0.9 - 0.5 * agg;                 // response filter (s)
    const maxBrake = 2.6 + 1.4 * agg;
    const maxAccel = 1.3 + 1.1 * agg;

    const s: number[] = [], v: number[] = [], a: number[] = [], lead: number[] = [];
    let pos = 0, vel = scenario === 'intersection' ? 13.4 : scenario === 'scurve' ? 19 : 28;
    let aOut = 0;
    const duration = scenario === 'scurve' ? 20 : scenario === 'intersection' ? 17 : 15;
    const steps = Math.round(duration / DT);

    // Highway lead vehicle: cruises, then slows by 8 m/s and recovers.
    const v0 = vel;
    let leadPos = 55, leadVel = v0;
    let minGap = Infinity;

    // Intersection stop line.
    const stopLineS = 80;
    let stoppedFor = 0;
    let creepTarget = 0;

    // Speed limit through curves (comfortable lateral acceleration grows with aggressiveness).
    const aLatComfort = 1.0 + 0.9 * agg;
    const kappaPeak = CURVE_AMPLITUDE * CURVE_K * CURVE_K;
    const vCurve = Math.sqrt(aLatComfort / kappaPeak);
    const lookDist = 25 + 30 * (1 - agg);
    const vLimitAt = (x: number) => {
        let limit = v0;
        for (let u = 0; u <= lookDist; u += 5) {
            const k = Math.abs(roadKappa(scenario, x + u)) / kappaPeak;
            limit = Math.min(limit, k > 0.55 ? vCurve + (v0 - vCurve) * (1 - k) : v0);
        }
        return limit;
    };

    for (let i = 0; i < steps; i++) {
        const t = i * DT;
        let aDes = 0;

        if (scenario === 'highway') {
            // Lead slows between t=3s and 6s, holds, then speeds back up from t=10s.
            const leadA = t >= 3 && t < 6 ? -2.7 : t >= 10 && t < 13 ? 2.0 : 0;
            leadVel = clamp(leadVel + leadA * DT, v0 - 8, v0);
            leadPos += leadVel * DT;
            const gap = leadPos - pos - 4.5;
            minGap = Math.min(minGap, gap);
            const headway = 2.1 - 0.9 * agg;
            const desiredGap = headway * vel + 4;
            aDes = 0.8 * (leadVel - vel) + 0.12 * (gap - desiredGap);
            if (gap > desiredGap * 2.2) aDes = Math.max(aDes, 0.4); // free-flow catch-up
        } else if (scenario === 'scurve') {
            aDes = clamp(0.8 * (vLimitAt(pos) - vel), -maxBrake, maxAccel);
        } else {
            const remaining = stopLineS - pos - (1 - agg) * 6;
            const required = vel > 0.2 && remaining > 0.5 ? (vel * vel) / (2 * remaining) : 0;
            const threshold = 0.5 + 2.4 * agg;
            if (vel > 0.15) {
                aDes = required >= threshold ? -Math.min(maxBrake, required * (1 + 0.15 * agg)) : 0;
                if (remaining <= 0.5) aDes = -maxBrake;
            } else {
                stoppedFor += DT;
                aDes = 0;
                // Red-light creep: after a pause, inch forward past the line.
                if (creep > 0.2 && stoppedFor > 1.2) creepTarget = 0.5 + creep * 0.9;
            }
            if (creepTarget > 0) {
                const limitS = stopLineS + creep * 2.8;
                aDes = pos < limitS ? clamp(0.9 * (creepTarget - vel), -1.5, 0.8) : clamp(-vel * 1.5, -1.5, 0);
                if (pos >= limitS) creepTarget = 0;
            }
        }

        aDes = clamp(aDes, -maxBrake - 0.6, maxAccel);
        aOut += (aDes - aOut) * Math.min(1, DT / tau);
        s.push(pos); v.push(vel); a.push(aOut); lead.push(leadPos);

        vel = Math.max(0, vel + aOut * DT);
        pos += vel * DT;
    }

    return {
        s, v, a,
        lead: scenario === 'highway' ? lead : undefined,
        stopLineS: scenario === 'intersection' ? stopLineS : undefined,
        minGap: scenario === 'highway' ? minGap : undefined,
        overshoot: scenario === 'intersection' ? Math.max(0, Math.max(...s) - stopLineS) : 0,
    };
}

// ─── Lateral execution ────────────────────────────────────────────────────

function trackPlan(
    planAt: (s: number) => number,
    s: number[],
    v: number[],
    aMax: number,
    omega: number,
    delay: number,
): number[] {
    const out: number[] = [];
    let x = planAt(s[0]);
    // Begin already moving with the plan; a zero-velocity start on a sloped plan
    // would be an unrealistic transient that saturates the limited executor.
    let xv = Math.max(v[0], 0.01) * (planAt(s[0] + 1) - planAt(s[0] - 1)) / 2;
    const kp = omega * omega;
    const kd = 2 * omega;
    for (let i = 0; i < s.length; i++) {
        out.push(x);
        const speed = Math.max(v[i], 0.01);
        const sT = s[i] + speed * delay;
        const pT = planAt(sT);
        const eps = 1;
        const pV = speed * (planAt(sT + eps) - planAt(sT - eps)) / (2 * eps);
        const pA = speed * speed * (planAt(sT + eps) - 2 * pT + planAt(sT - eps)) / (eps * eps);
        const cmd = pA + kp * (pT - x) + kd * (pV - xv);
        const a = clamp(cmd, -aMax, aMax);
        xv += a * DT;
        // Anti-windup: a saturated rack lags the plan but cannot run away from it.
        xv = pV + clamp(xv - pV, -MAX_REL_LATERAL_SPEED, MAX_REL_LATERAL_SPEED);
        x += xv * DT;
        x = pT + clamp(x - pT, -MAX_TRACKING_ERROR_M, MAX_TRACKING_ERROR_M);
    }
    return out;
}

function nearestIndex(samples: TrajectorySample[], s: number): number {
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].s < s) lo = mid + 1; else hi = mid;
    }
    return lo;
}

// ─── Public builder ───────────────────────────────────────────────────────

export function buildTrajectoryRun(
    scenario: TrajectoryScenario,
    profile: ModelTelemetryProfile,
    replay?: ModelV2ReplaySnapshot,
): TrajectoryRun {
    const valid = Boolean(replay
        && replay.x.length > 3
        && replay.x.length === replay.y.length
        && replay.x.length === replay.v.length
        && replay.x.length === replay.a.length);

    let sArr: number[], vArr: number[], aArr: number[];
    let leadArr: number[] | undefined, stopLineS: number | undefined, minGap: number | undefined, overshoot = 0;
    let planAt: (s: number) => number;
    const dt = replay?.hz && valid ? 1 / replay.hz : DT;

    if (valid && replay) {
        sArr = replay.x; vArr = replay.v; aArr = replay.a;
        planAt = (s: number) => interp(replay.x, replay.y, s);
    } else {
        const long = simulateLongitudinal(scenario, profile);
        sArr = long.s; vArr = long.v; aArr = long.a;
        leadArr = long.lead; stopLineS = long.stopLineS; minGap = long.minGap; overshoot = long.overshoot;
        planAt = makePlan(scenario, profile);
    }

    const highArr = trackPlan(planAt, sArr, vArr, AMAX_HIGH, 2.6, 0.1);
    const limitedArr = trackPlan(planAt, sArr, vArr, AMAX_LIMITED, 1.7, 0.25);

    const samples: TrajectorySample[] = sArr.map((s, i) => ({
        t: i * dt,
        s,
        v: vArr[i],
        a: aArr[i],
        plan: planAt(s),
        highTorque: highArr[i],
        torqueLimited: limitedArr[i],
        lead: leadArr?.[i],
    }));

    const maxTrackingError = samples.reduce((m, x) => Math.max(m, Math.abs(x.torqueLimited - x.plan)), 0);
    const decels = samples.map(x => x.a).filter(a => a < -0.2);
    const peakDecel = decels.length ? -Math.min(...decels) : 0;
    const agg = profile.longitudinalAggressiveness;
    const byProfile: TrajectoryRun['longitudinalStyle'] = agg < 0.3 ? 'early' : agg > 0.62 ? 'late' : 'standard';
    const byReplay: TrajectoryRun['longitudinalStyle'] = peakDecel > 3.0 ? 'late' : peakDecel > 0 && peakDecel < 2.0 ? 'early' : 'standard';
    const longitudinalStyle = valid ? byReplay : byProfile;

    return {
        scenario,
        dt,
        duration: samples.length * dt,
        samples,
        stopLineS,
        fromReplay: valid,
        roadAt: (s: number) => roadX(scenario, s),
        planAt,
        execAt: (kind: ExecutionKind, s: number) => {
            const i = nearestIndex(samples, s);
            if (i <= 0) return samples[0][kind];
            const a = samples[i - 1], b = samples[i];
            const f = clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
            return a[kind] + (b[kind] - a[kind]) * f;
        },
        maxTrackingError,
        stopOvershoot: overshoot,
        minGap,
        longitudinalStyle,
    };
}
