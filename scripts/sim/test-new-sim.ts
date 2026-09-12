import assert from 'node:assert/strict';
import { Simulation, Road, DEFAULT_OPTIONS, SCENARIOS, FIXED_STEP, signalPhase, crossGreen, type Scenario } from '../../lib/new-sim/simulation';
import { ALL_MODEL_PROFILES } from '../../lib/new-sim/modelProfiles';

function run(sim: Simulation, seconds: number, check?: () => void) {
  for (let i = 0; i < seconds / FIXED_STEP; i++) { sim.step(); check?.(); }
}
// Road seams and equal-distance sampling must remain smooth on every layout.
for (const scenario of ['city', 'boulevard', 'curves', 'highway'] as Scenario[]) {
  const road = new Road(scenario);
  assert.ok(road.point(0).distanceTo(road.point(road.length)) < 1e-6);
  assert.ok(road.tangent(0).dot(road.tangent(road.length - 0.01)) > 0.999);
  for (let s = 0; s < road.length; s += 10) assert.ok(Math.abs(road.point(s).distanceTo(road.point(s + 1)) - 1) < 0.03);
}
console.log('PASS continuous roads and metre-scale sampling');
for (let time = 0; time < 108; time += 0.1) {
  for (const id of [0, 2]) assert.ok(!(signalPhase(time, id) !== 'red' && crossGreen(time, id)), 'Conflicting protected phases');
}
console.log('PASS traffic signal phase separation');
const stop = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'city', speed: 35, density: 0 }, 'stop');
stop.cars = [stop.ego];
const stopSign = stop.road.junctions.find(j => j.kind === 'stop')!;
let stationary = 0, released = false;
run(stop, 35, () => {
  if (stop.ego.speed < 0.2) stationary += FIXED_STEP;
  if (stop.ego.released === stopSign.id) { released = true; assert.ok(stationary >= 1.99, 'Stop released without a full dwell'); }
});
assert.ok(released, 'Stop sign never released');
assert.ok(stop.distance > 90, 'Vehicle did not continue after stop sign');
console.log('PASS full stop, dwell and departure');
const light = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'city', speed: 35, density: 0 }, 'signal');
light.cars = [light.ego];
const signal = light.road.junctions.find(j => j.kind === 'signal')!;
light.ego.s = signal.s - 50;
let waited = false;
run(light, 25, () => {
  if (light.time < 11) {
    assert.ok(light.ego.s + 2.35 <= signal.s - 11.9, 'Vehicle crossed initial red stop line');
    if (light.ego.speed === 0) waited = true;
  }
});
assert.ok(waited, 'Vehicle did not wait at red');
assert.ok(light.ego.s > signal.s + 15, 'Vehicle did not resume at green');
console.log('PASS red-light stop and green-light departure');
for (const scenario of ['city', 'boulevard', 'curves', 'highway'] as Scenario[]) {
  const sim = new Simulation({ ...DEFAULT_OPTIONS, scenario, density: 100, speed: 55 });
  let minGap = Infinity;
  const previousPositions = sim.cars.map(car => car.s);
  let crossings = 0;
  run(sim, 400, () => {
    for (const car of sim.cars) {
      assert.ok(Number.isFinite(car.speed) && Number.isFinite(car.s));
      assert.ok(car.speed >= 0);
      const gap = sim.lead(car).gap;
      minGap = Math.min(gap, minGap);
      assert.ok(gap >= 0.4, `Vehicle overlap in ${scenario}: ${gap.toFixed(3)}m`);
      for (const junction of sim.road.junctions.filter(j => j.kind === 'signal')) {
        const oldDistance = sim.road.distance(previousPositions[car.id] + car.direction * 2.35, junction.s - car.direction * 12, car.direction);
        const newDistance = sim.road.distance(car.s + car.direction * 2.35, junction.s - car.direction * 12, car.direction);
        // Only continuous motion counts: a recycled car is repositioned, not driven.
        const travelled = sim.road.distance(previousPositions[car.id], car.s, car.direction);
        if (travelled < 5 && oldDistance < 1 && newDistance > sim.road.length - 1) {
          crossings++;
          assert.notEqual(signalPhase(sim.time, junction.id), 'red', 'Vehicle entered on red');
        }
        const centerDistance = Math.min(sim.road.distance(car.s, junction.s), sim.road.distance(junction.s, car.s));
        assert.ok(!(centerDistance < 9 && sim.crossCars.some(c => c.junction === junction.id && Math.abs(c.x) < 10)), 'Conflicting traffic in intersection');
      }
      previousPositions[car.id] = car.s;
    }
  });
  // Rush hour is meant to be slow, but never gridlocked: 1.4 km in 400 s is
  // about 8 mph average, below which the layout would be deadlocked.
  assert.ok(sim.distance > 1400, `Traffic gridlocked in ${scenario}: ${sim.distance.toFixed(0)}m in 400s`);
  console.log(`PASS ${scenario}: 400 simulated seconds at max density, ${(sim.distance / 1000).toFixed(1)} km`
    + ` (${(sim.distance / 400 * 2.23694).toFixed(0)} mph avg), minimum gap ${minGap.toFixed(2)}m, ${crossings} compliant signal crossings`);
}
// The highway layout is a junction-free five lane one-way carriageway.
const highway = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'highway', speed: 65, density: 70 });
assert.equal(highway.road.laneCount, 5, 'Highway must expose five lanes');
assert.equal(highway.road.junctions.length, 0, 'Highway must be junction free');
assert.equal(highway.nextJunction(highway.ego), null, 'Junction-free layout must report no junction');
assert.ok(highway.cars.every(car => car.direction === 1), 'Highway traffic must be one-way');
assert.ok(new Set(highway.cars.map(car => car.lane)).size === 5, 'Every highway lane must carry traffic');
const highwayTelemetry = highway.telemetry();
assert.equal(highwayTelemetry.nextKind, 'none');
assert.equal(highwayTelemetry.phase, 'none');
assert.equal(highwayTelemetry.laneCount, 5);
run(highway, 240);
assert.ok(highway.telemetry().speed > 45, `Highway cruise stalled at ${highway.telemetry().speed.toFixed(1)} mph`);
assert.ok(highway.stops === 0, 'Highway run should never come to a stop');
console.log(`PASS highway: 5 one-way lanes, no junctions, ${(highway.distance / 1000).toFixed(1)} km at ${highway.telemetry().speed.toFixed(0)} mph`);
// Model traits have to reach the car: lane centering, smoothness, following
// distance and stop-line behaviour must measurably differ between profiles.
function driveProfile(modelId: string, seconds = 90, scenario: Scenario = 'curves', density = 0) {
  const sim = new Simulation({ ...DEFAULT_OPTIONS, scenario, density, speed: SCENARIOS[scenario].limit, modelId });
  if (!density) sim.cars = [sim.ego];
  // Weave is the spread of the lane position, not its average: a model that
  // sits a steady 20 cm right of centre is biased, not wandering.
  let sum = 0, sumSquares = 0, maxJerk = 0, samples = 0, previous = 0;
  run(sim, seconds, () => {
    sum += sim.ego.lateral; sumSquares += sim.ego.lateral ** 2; samples++;
    // Only while rolling: coming to a dead stop snaps acceleration to zero,
    // which is a modelling artefact rather than something a rider feels.
    if (sim.ego.speed > 1) maxJerk = Math.max(maxJerk, Math.abs(sim.ego.acceleration - previous) / FIXED_STEP);
    previous = sim.ego.acceleration;
  });
  const mean = sum / samples;
  return { weave: Math.sqrt(Math.max(0, sumSquares / samples - mean * mean)), bias: mean, maxJerk, distance: sim.distance };
}
const steady = ALL_MODEL_PROFILES.find(m => m.laneWobble <= 0.02 && m.centeringGain >= 2.8)!;
const wobbly = ALL_MODEL_PROFILES.find(m => m.laneWobble >= 0.12 && m.wobbleSpeedBias !== -1)!;
const glassy = ALL_MODEL_PROFILES.find(m => m.jerkLimit <= 1.3)!;
const abrupt = ALL_MODEL_PROFILES.find(m => m.jerkLimit >= 4.4)!;
assert.ok(steady && wobbly && glassy && abrupt, 'Model profiles no longer span the behaviour range');
const steadyDrive = driveProfile(steady.id, 90, 'highway'), wobblyDrive = driveProfile(wobbly.id, 90, 'highway');
assert.ok(wobblyDrive.weave > steadyDrive.weave * 3,
  `Lane centering does not differ: ${steady.name} ${steadyDrive.weave.toFixed(3)}m vs ${wobbly.name} ${wobblyDrive.weave.toFixed(3)}m`);
assert.ok(steadyDrive.weave < 0.06, `${steady.name} should hold the lane, weaved ${steadyDrive.weave.toFixed(3)}m`);
const glassyDrive = driveProfile(glassy.id, 120, 'highway', 50), abruptDrive = driveProfile(abrupt.id, 120, 'highway', 50);
assert.ok(abruptDrive.maxJerk > glassyDrive.maxJerk * 1.5,
  `Longitudinal smoothness does not differ: ${glassy.name} ${glassyDrive.maxJerk.toFixed(1)} vs ${abrupt.name} ${abruptDrive.maxJerk.toFixed(1)} m/s³`);
console.log(`PASS lateral: ${steady.name} weaves ${(steadyDrive.weave * 100).toFixed(1)}cm vs ${wobbly.name} ${(wobblyDrive.weave * 100).toFixed(1)}cm`);
console.log(`PASS longitudinal: ${glassy.name} ${glassyDrive.maxJerk.toFixed(1)} vs ${abrupt.name} ${abruptDrive.maxJerk.toFixed(1)} m/s³ peak jerk`);

// Following headway is tested against an identical fixed-speed lead in
// test-model-behavior.ts. Dense free traffic can merge, so an instantaneous
// end-of-run gap there is not a controlled measure of the model's headway.
const creeper = ALL_MODEL_PROFILES.find(m => m.creepTendency);
if (creeper) {
  const stopLine = (modelId: string) => {
    // Stop-line behaviour needs a layout that actually has a stop sign.
    const sim = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'city', speed: 35, density: 0, modelId }, 'stop');
    sim.cars = [sim.ego];
    const junction = sim.road.junctions.find(j => j.kind === 'stop')!;
    let closest = Infinity;
    run(sim, 20, () => {
      if (sim.ego.speed < 0.3) closest = Math.min(closest, sim.road.distance(sim.ego.s, junction.s));
    });
    return closest;
  };
  const planted = ALL_MODEL_PROFILES.find(m => !m.creepTendency && m.stopOffset === 0)!;
  assert.ok(stopLine(creeper.id) < stopLine(planted.id),
    `${creeper.name} creeps, so it should end up nearer the line than ${planted.name}`);
  console.log(`PASS stop line: ${creeper.name} creeps ${(stopLine(planted.id) - stopLine(creeper.id)).toFixed(1)}m closer than ${planted.name}`);
}

// Skipping along the route must land on clear road, never on top of traffic.
{
  const sim = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'highway', density: 70, speed: 65 });
  run(sim, 20);
  for (let jump = 0; jump < 12; jump++) {
    sim.skip(jump % 3 === 2 ? -200 : 200);
    assert.ok(sim.lead(sim.ego).gap > 8, `Skip landed ${sim.lead(sim.ego).gap.toFixed(1)}m behind another car`);
    assert.equal(sim.ego.prevS, sim.ego.s, 'A skip must not be interpolated across the map');
    run(sim, 2);
  }
  console.log('PASS route skipping stays clear of traffic');
}

// Traffic overtakes and cuts in on multi-lane roads, and never on a road whose
// lanes run opposite ways — and no manoeuvre may put two cars in one place.
{
  const highway = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'highway', density: 60, speed: 65 });
  let minGap = Infinity;
  run(highway, 300, () => { for (const car of highway.cars) minGap = Math.min(minGap, highway.lead(car).gap); });
  assert.ok(highway.laneChanges > 40, `Highway traffic barely changed lanes (${highway.laneChanges})`);
  assert.ok(highway.cutIns > 0, 'No vehicle ever cut in front of the ego');
  assert.ok(minGap > 0.4, `Lane change put cars ${minGap.toFixed(2)}m apart`);
  const city = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'city', density: 60 });
  run(city, 300);
  assert.equal(city.laneChanges, 0, 'A two-lane two-way street has no lane to change into');
  console.log(`PASS manoeuvres: highway ${highway.laneChanges} lane changes, ${highway.cutIns} cut-ins, min gap ${minGap.toFixed(2)}m; city 0`);
}

// The density slider has to change how the road drives, not just the car count.
for (const scenario of ['city', 'boulevard', 'curves', 'highway'] as Scenario[]) {
  const options = { ...DEFAULT_OPTIONS, scenario, speed: SCENARIOS[scenario].limit };
  const quiet = new Simulation({ ...options, density: 0 });
  const rush = new Simulation({ ...options, density: 100 });
  assert.ok(rush.cars.length >= quiet.cars.length * 4, `${scenario} rush hour only adds ${rush.cars.length - quiet.cars.length} vehicles`);
  run(quiet, 300); run(rush, 300);
  const quietSpeed = quiet.distance / 300, rushSpeed = rush.distance / 300;
  // A forest lane is curvature limited, so its traffic thickens without jamming.
  const slowdown = scenario === 'curves' ? 1 : 0.86;
  assert.ok(rushSpeed <= quietSpeed * slowdown,
    `${scenario} rush hour barely slowed the ego: ${(quietSpeed * 2.23694).toFixed(0)} -> ${(rushSpeed * 2.23694).toFixed(0)} mph`);
  const gaps = rush.cars.map(car => rush.lead(car).gap).filter(gap => gap < 400);
  const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  assert.ok(median < 70, `${scenario} rush hour still runs ${median.toFixed(0)}m between cars`);
  console.log(`PASS ${scenario} density: ${quiet.cars.length}->${rush.cars.length} cars, `
    + `${(quietSpeed * 2.23694).toFixed(0)}->${(rushSpeed * 2.23694).toFixed(0)} mph, median gap ${median.toFixed(0)}m`);
}
// No layout may spawn two vehicles on top of each other at any density.
for (const scenario of ['city', 'boulevard', 'curves', 'highway'] as Scenario[]) {
  for (const density of [0, 30, 50, 70, 100]) {
    const sim = new Simulation({ ...DEFAULT_OPTIONS, scenario, density });
    for (const car of sim.cars) {
      assert.ok(sim.lead(car).gap > 8, `${scenario} @${density}: spawn gap ${sim.lead(car).gap.toFixed(1)}m in lane ${car.lane}`);
    }
  }
}
console.log('PASS clear spawn spacing across every layout and density');
// Each layout is its own road, not a scaled copy of another.
const shapes = (['city', 'boulevard', 'curves', 'highway'] as Scenario[]).map(scenario => {
  const road = new Road(scenario);
  return { scenario, road, lanes: road.laneCount, width: road.lanes.surface, length: road.length };
});
for (const shape of shapes) {
  for (const other of shapes) {
    if (other === shape) continue;
    assert.ok(Math.abs(shape.length - other.length) > 50, `${shape.scenario} and ${other.scenario} share a road length`);
    assert.notDeepEqual(shape.road.lanes, other.road.lanes, `${shape.scenario} and ${other.scenario} share a lane layout`);
  }
  const kinds = new Set(shape.road.junctions.map(j => j.kind));
  const advertised = SCENARIOS[shape.scenario].chapters;
  assert.equal(kinds.has('signal'), advertised.includes('signal'), `${shape.scenario} signal chapter does not match its junctions`);
  assert.equal(kinds.has('stop'), advertised.includes('stop'), `${shape.scenario} stop chapter does not match its junctions`);
  // Junctions must sit on the straighter parts of a layout, never mid-corner.
  for (const junction of shape.road.junctions) {
    assert.ok(shape.road.curvature(junction.s) < 0.006,
      `${shape.scenario} junction ${junction.name} sits on a bend (radius ${(1 / shape.road.curvature(junction.s)).toFixed(0)}m)`);
  }
}
console.log(`PASS distinct layouts: ${shapes.map(s => `${s.scenario} ${s.lanes}L/${(s.width * 2).toFixed(1)}m/${(s.length / 1000).toFixed(1)}km`).join(', ')}`);
const a = new Simulation(DEFAULT_OPTIONS), b = new Simulation(DEFAULT_OPTIONS);
run(a, 10); for (let frame = 0; frame < 300; frame++) { b.step(); b.step(); }
assert.equal(a.ego.s, b.ego.s); assert.equal(a.ego.speed, b.ego.speed);
console.log('PASS deterministic fixed-step replay at 30/60 fps');
