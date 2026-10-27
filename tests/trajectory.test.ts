import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTrajectoryRun, type ModelV2ReplaySnapshot } from '../lib/trajectory';

const profile = (o: Partial<Record<'lateralBias' | 'turnInTiming' | 'longitudinalAggressiveness' | 'stopLineCreep', number>> = {}) => ({
    lateralBias: 0, turnInTiming: 0, longitudinalAggressiveness: 0.4, stopLineCreep: 0.05, ...o,
});
const lastSample = <T,>(xs: T[]) => xs[xs.length - 1];

test('all scenarios produce finite 20 Hz samples', () => {
    for (const scenario of ['highway', 'scurve', 'intersection'] as const) {
        const run = buildTrajectoryRun(scenario, profile());
        assert.equal(run.dt, 0.05);
        assert.ok(run.samples.length > 100);
        for (const s of run.samples) {
            for (const n of [s.s, s.v, s.a, s.plan, s.highTorque, s.torqueLimited]) assert.ok(Number.isFinite(n));
            assert.ok(s.v >= 0);
        }
    }
});

test('lateral bias offsets the plan on the highway', () => {
    const left = buildTrajectoryRun('highway', profile({ lateralBias: -0.8 }));
    const right = buildTrajectoryRun('highway', profile({ lateralBias: 0.8 }));
    assert.ok(left.samples[20].plan < 0 && right.samples[20].plan > 0);
});

test('late turn-in on a limited-torque rack tracks worse than early turn-in; high-authority stays close', () => {
    const early = buildTrajectoryRun('scurve', profile({ turnInTiming: -0.6 }));
    const late = buildTrajectoryRun('scurve', profile({ turnInTiming: 0.8 }));
    assert.ok(late.maxTrackingError > early.maxTrackingError);
    assert.ok(late.maxTrackingError <= 1.41, 'understeer must stay bounded');
    const highErr = Math.max(...late.samples.map(s => Math.abs(s.highTorque - s.plan)));
    assert.ok(highErr < late.maxTrackingError);
    assert.ok(highErr < 0.6);
});

test('chill models brake earlier and softer; aggressive models brake later and harder', () => {
    const chill = buildTrajectoryRun('intersection', profile({ longitudinalAggressiveness: 0.05 }));
    const hard = buildTrajectoryRun('intersection', profile({ longitudinalAggressiveness: 0.95 }));
    const peak = (r: typeof chill) => -Math.min(...r.samples.map(s => s.a));
    const brakeStart = (r: typeof chill) => r.samples.find(s => s.a < -0.5)!.s;
    assert.ok(peak(hard) > peak(chill));
    assert.ok(brakeStart(hard) > brakeStart(chill));
    assert.equal(chill.longitudinalStyle, 'early');
    assert.equal(hard.longitudinalStyle, 'late');
});

test('stop-line creep carries the car past the line; holding models do not', () => {
    const hold = buildTrajectoryRun('intersection', profile({ stopLineCreep: 0.0 }));
    const creep = buildTrajectoryRun('intersection', profile({ stopLineCreep: 0.8 }));
    assert.equal(hold.stopOvershoot, 0);
    assert.ok(creep.stopOvershoot > 0.5);
});

test('ego never collides with the highway lead', () => {
    for (const agg of [0, 0.5, 1]) {
        const run = buildTrajectoryRun('highway', profile({ longitudinalAggressiveness: agg }));
        assert.ok((run.minGap ?? 0) > 3, `gap ${run.minGap} at aggressiveness ${agg}`);
    }
});

test('a modelV2 replay snapshot overrides the simulated plan and speeds', () => {
    const n = 100;
    const replay: ModelV2ReplaySnapshot = {
        x: Array.from({ length: n }, (_, i) => i * 1.2),
        y: Array.from({ length: n }, () => 0.5),
        v: Array.from({ length: n }, () => 24),
        a: Array.from({ length: n }, (_, i) => (i === 50 ? -2 : 0)),
        hz: 20,
    };
    const run = buildTrajectoryRun('highway', profile(), replay);
    assert.equal(run.fromReplay, true);
    assert.equal(run.samples.length, n);
    assert.equal(run.samples[10].plan, 0.5);
    assert.equal(run.samples[50].a, -2);
    assert.equal(lastSample(run.samples).v, 24);
});

test('malformed replay arrays fall back to simulation', () => {
    const run = buildTrajectoryRun('highway', profile(), { x: [0, 1], y: [0], v: [1, 2], a: [0, 0] });
    assert.equal(run.fromReplay, false);
});
