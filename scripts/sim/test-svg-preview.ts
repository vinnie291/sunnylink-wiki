import assert from 'node:assert/strict';
import { Simulation, DEFAULT_OPTIONS, FIXED_STEP, vehicleLength, type Scenario } from '../../lib/new-sim/simulation';
import { createSvgCamera, projectPoint, projectPolygon, renderSvgFrame } from '../../lib/new-sim/svgProjection';
import { deriveModelSimProfile } from '../../lib/new-sim/modelProfiles';
import { trafficCarSvg } from '../../lib/new-sim/svgCar';

const near = projectPoint({ x: 1.8, z: 10, height: 0 });
const far = projectPoint({ x: 1.8, z: 20, height: 0 });
assert.equal(near.x - 240, 2 * (far.x - 240), 'Lane width must halve at twice the camera depth');
assert.equal(near.y - 84, 2 * (far.y - 84), 'Road and lane width must share perspective');
assert.equal(projectPolygon([{ x: 0, z: -1, height: 0 }, { x: 1, z: 0, height: 0 }, { x: -1, z: 1, height: 0 }]), '');
assert.ok(!/NaN|Infinity/.test(projectPolygon([{ x: -1, z: 0, height: 0 }, { x: 1, z: 10, height: 0 }, { x: -1, z: 10, height: 0 }])));

for (const scenario of ['highway', 'curves', 'city'] as Scenario[]) {
  const options = { ...DEFAULT_OPTIONS, scenario, density: 25 };
  const sim = new Simulation(options);
  const reference = new Simulation({ ...options });
  const initial = JSON.stringify(renderSvgFrame(sim));
  assert.equal(JSON.stringify(renderSvgFrame(sim)), initial, 'Painting a paused frame must not mutate simulation');
  const camera = createSvgCamera(sim);
  const ahead = camera(sim.ego.s + 8, sim.laneOffset(sim.ego));
  assert.ok(ahead.z > 7 && ahead.z < 9, 'Camera forward must agree with travel direction');
  const left = camera(sim.ego.s + 8, sim.laneOffset(sim.ego) + 1);
  assert.ok(left.x < ahead.x, 'Positive lane offsets must project left');
  for (let i = 0; i < 600; i++) {
    sim.step(FIXED_STEP); reference.step(FIXED_STEP);
    if (i % 30 === 0) {
      const frame = renderSvgFrame(sim);
      assert.ok(frame.road.length > 100 && frame.path.length > 10);
      assert.ok(!/NaN|Infinity/.test(JSON.stringify(frame)), `${scenario}: nonfinite projection`);
    }
  }
  assert.deepEqual(sim.ego, reference.ego, 'SVG rendering must not alter shared-engine results');
  assert.notEqual(JSON.stringify(renderSvgFrame(sim)), initial, 'A moving simulation must change its projection');
}
const negated = deriveModelSimProfile({ name: 'Negated', consensus: 'No ping-pong or oscillations' });
const fault = deriveModelSimProfile({ name: 'Fault', negatives: ['Steering oscillations at high speed'] });
assert.ok(negated.laneWobble < fault.laneWobble);
console.log('PASS metric perspective, near clipping, camera orientation, pause immutability, engine parity, three road layouts and negated feedback');

const traffic = new Simulation({ ...DEFAULT_OPTIONS, density: 45, previewTraffic: true });
const repeat = new Simulation({ ...DEFAULT_OPTIONS, density: 45, previewTraffic: true });
let firstCutAt = Infinity, brakingAfterCut = false, greatestLateralStep = 0;
for (let i = 0; i < 60 * 35; i++) {
  const before = traffic.cars.map(car => traffic.laneOffset(car));
  traffic.step(); repeat.step();
  traffic.cars.forEach((car, index) => {
    if (car.id !== 0) greatestLateralStep = Math.max(greatestLateralStep, Math.abs(traffic.laneOffset(car) - before[index]));
  });
  if (traffic.cutIns && !Number.isFinite(firstCutAt)) firstCutAt = traffic.time;
  if (traffic.time > firstCutAt && traffic.time < firstCutAt + 5 && traffic.ego.braking) brakingAfterCut = true;
}
assert.ok(firstCutAt < 10, 'A visible cut-in should happen early in a short preview');
assert.ok(traffic.laneChanges > traffic.cutIns && traffic.cutIns >= 2, 'Traffic should include repeated cut-ins and other lane changes');
assert.ok(brakingAfterCut, 'Ego must react to the cut-in through actual braking');
assert.ok(greatestLateralStep < .05, `Traffic jumped sideways: ${greatestLateralStep} metres`);
assert.deepEqual(traffic.cars, repeat.cars, 'Traffic must be repeatable');
assert.ok(renderSvgFrame(traffic).laneLines.includes('#36ed77'), 'Green lane guides are missing');
const sample = { ...traffic.cars[1], id: 1 };
assert.notEqual(trafficCarSvg({ ...sample, kind: 'sedan' }, 0), trafficCarSvg({ ...sample, kind: 'suv' }, 0));
assert.notEqual(trafficCarSvg({ ...sample, braking: true }, 0), trafficCarSvg({ ...sample, braking: false }, 0));
const changing = { ...sample, laneChange: { from: 1, offset: 3.6, elapsed: 1, duration: 3.5 } };
assert.notEqual(trafficCarSvg(changing, 0), trafficCarSvg(changing, .5), 'Turn indicators must blink while merging');
console.log(`PASS varied traffic: ${traffic.laneChanges} lane changes, ${traffic.cutIns} cut-ins, first at ${firstCutAt.toFixed(1)}s, smooth motion, braking response, repeatability and vehicle artwork`);

const leadPreview = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'city' }, 'signal');
const tracked = { ...leadPreview.ego, id: 999, s: leadPreview.ego.s + 25, lateral: 0 };
leadPreview.cars.splice(0, leadPreview.cars.length, leadPreview.ego, tracked);
const trackedFrame = renderSvgFrame(leadPreview);
assert.ok(trackedFrame.leadArrow.includes('data-lead="999"'), 'Same-lane lead must be tracked');
assert.ok(trackedFrame.pathFade.length > 0, 'Path must fade at the lead bumper');
tracked.lateral = 4;
assert.equal(renderSvgFrame(leadPreview).leadArrow, '', 'Adjacent-lane car must not get a lead arrow');
tracked.lateral = 0;
tracked.s = leadPreview.ego.s - 10;
assert.equal(renderSvgFrame(leadPreview).leadArrow, '', 'A car behind ego must not get a lead arrow');
for (const scenario of ['city', 'curves'] as const) {
  const crossing = new Simulation({ ...DEFAULT_OPTIONS, scenario }, 'stop');
  for (const distance of [40, 12, 2, -2]) {
    crossing.ego.s = crossing.road.junctions[0].s - distance;
    const frame = renderSvgFrame(crossing);
    assert.ok(frame.intersections.includes('data-intersection='), 'Cross street must remain visible through the junction');
    assert.ok(!/NaN|Infinity/.test(frame.intersections));
  }
}
assert.equal(renderSvgFrame(new Simulation({ ...DEFAULT_OPTIONS, scenario: 'highway' })).intersections, '');
console.log('PASS same-lane lead tracking, bumper fade, adjacent/behind exclusion and visible cross streets');

const mixed = new Simulation({ ...DEFAULT_OPTIONS, previewTraffic: true, density: 45 });
for (const kind of ['sedan', 'suv', 'van', 'truck', 'motorcycle']) {
  assert.ok(mixed.cars.some(car => car.kind === kind), `Missing traffic type: ${kind}`);
}
const truck = { ...mixed.ego, id: 777, kind: 'truck' as const, s: mixed.ego.s + 30 };
mixed.cars.splice(1, mixed.cars.length - 1, truck);
assert.equal(mixed.lead(mixed.ego).gap, 30 - (vehicleLength(truck) + vehicleLength(mixed.ego)) / 2, 'Truck gap must use both vehicle lengths');
assert.ok(renderSvgFrame(mixed).traffic.includes('data-kind="truck"'));
const cycling = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'city', previewTraffic: true }, 'signal');
assert.ok(cycling.cyclists.length > 0);
const cyclist = cycling.cyclists[0], beforeCycling = cyclist.s;
cycling.step();
assert.ok(cyclist.s > beforeCycling, 'Cyclist should advance through simulation steps');
const stop = cycling.road.junctions.find(j => j.kind === 'stop')!;
cyclist.s = stop.s - 13;
for (let i = 0; i < 60; i++) cycling.step();
assert.ok(Math.abs(cyclist.s - (stop.s - 13)) < .001, 'Cyclist must wait at stop signs');
for (let i = 0; i < 100; i++) cycling.step();
assert.ok(cyclist.s > stop.s - 13, 'Cyclist should continue after stopping');
console.log('PASS mixed vehicle types, physical truck spacing, cyclist motion and stop behavior');

const followingGaps: number[] = [];
for (const followDistance of [1, 2, 3, 4] as const) {
  const sim = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'curves', speed: 35, followDistance });
  const lead = { ...sim.ego, id: 900, s: sim.ego.s + 35, speed: 10, desired: 10 };
  sim.cars.splice(1, sim.cars.length - 1, lead);
  // Remove junction stops for a controlled, same-speed following comparison.
  sim.road.junctions = [];
  for (let i = 0; i < 60 * 45; i++) sim.step();
  followingGaps.push(sim.lead(sim.ego).gap);
}
for (let i = 1; i < followingGaps.length; i++) {
  assert.ok(followingGaps[i] > followingGaps[i - 1] + 1, `More bars must produce a larger following gap: ${followingGaps}`);
}
console.log(`PASS four following-distance levels: ${followingGaps.map(g => g.toFixed(1)).join(', ')} m`);

// Changing controls on an existing simulation must take effect without a restart.
const live = new Simulation({ ...DEFAULT_OPTIONS, scenario: 'highway', speed: 35, followDistance: 1 });
live.cars.splice(1);
for (let i = 0; i < 60 * 25; i++) live.step();
const slowSpeed = live.ego.speed;
live.options.speed = 55;
for (let i = 0; i < 60 * 30; i++) live.step();
assert.ok(live.ego.speed > slowSpeed + 5, 'Raising the set speed must accelerate the live car');
live.options.speed = 25;
for (let i = 0; i < 60 * 30; i++) live.step();
assert.ok(live.ego.speed <= 25 * .44704 + .2, 'Lowering set speed must slow the live car to its target');
const gapLead = { ...live.ego, id: 901, s: live.ego.s + 30, speed: 10, desired: 10, changeCooldown: 999 };
live.cars.push(gapLead);
live.options.speed = 45;
for (let i = 0; i < 60 * 40; i++) live.step();
const closeGap = live.lead(live.ego).gap;
live.options.followDistance = 4;
for (let i = 0; i < 60 * 40; i++) live.step();
assert.ok(live.lead(live.ego).gap > closeGap + 8, 'Increasing bars live must open the actual gap');
console.log('PASS live set-speed increase/decrease and live following-distance change');
