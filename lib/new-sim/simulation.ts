/** Deterministic, fixed-step traffic sandbox. Distances are metres, time seconds. */
import { CatmullRomCurve3, Vector3 } from 'three';
import { getModelProfile, DEFAULT_MODEL_ID, type ModelSimProfile } from './modelProfiles';

export type Scenario = 'city' | 'boulevard' | 'curves' | 'highway';
export type CameraMode = 'follow' | 'overview' | 'driver';
export type SignalPhase = 'green' | 'amber' | 'red';
export type Behavior = 'relaxed' | 'balanced' | 'responsive';
export type Chapter = 'start' | 'signal' | 'stop' | 'bend';
export interface SimOptions {
  scenario: Scenario;
  density: number;
  behavior: Behavior;
  speed: number; // mph
  playing: boolean;
  rate: number;
  camera: CameraMode;
  path: boolean;
  perception: boolean;
  modelId?: string;
  carColor: string;
  /** 'auto' follows the site theme; day/night pin the scene's lighting. */
  lighting: 'auto' | 'day' | 'night';
}
export const CAR_COLORS = [
  { id: 'pearl', name: 'Pearl white', hex: '#f6f8f7' },
  { id: 'graphite', name: 'Graphite', hex: '#40484d' },
  { id: 'midnight', name: 'Midnight blue', hex: '#28405f' },
  { id: 'silver', name: 'Silver', hex: '#b7bec1' },
  { id: 'forest', name: 'Forest green', hex: '#2c5b46' },
  { id: 'crimson', name: 'Crimson', hex: '#932b2b' },
  { id: 'sunset', name: 'Sunset orange', hex: '#c8642a' },
  { id: 'sand', name: 'Desert sand', hex: '#c2ab84' },
];
export const DEFAULT_CAR_COLOR = CAR_COLORS[0].hex;
const SCENARIOS_DEFAULT_SPEED = 65; // highway limit; keep in step with SCENARIOS.highway
export const DEFAULT_OPTIONS: SimOptions = {
  scenario: 'highway', density: 50, behavior: 'balanced', speed: SCENARIOS_DEFAULT_SPEED,
  playing: true, rate: 1, camera: 'follow', path: true, perception: false,
  modelId: DEFAULT_MODEL_ID, carColor: DEFAULT_CAR_COLOR, lighting: 'auto',
};
export const SCENARIOS: Record<Scenario, {
  name: string; subtitle: string; limit: number; maxSpeed: number; chapters: Chapter[];
}> = {
  city: { name: 'City streets', subtitle: 'Tight blocks, signals & stop signs', limit: 35, maxSpeed: 55, chapters: ['start', 'signal', 'bend', 'stop'] },
  boulevard: { name: 'Open boulevard', subtitle: 'Divided avenue, palms & long sweeps', limit: 45, maxSpeed: 55, chapters: ['start', 'signal', 'bend'] },
  curves: { name: 'Winding road', subtitle: 'Single-track forest lane, tight bends', limit: 40, maxSpeed: 55, chapters: ['start', 'bend', 'stop'] },
  highway: { name: 'Highway', subtitle: '5 lanes, no junctions, sustained speed', limit: 65, maxSpeed: 85, chapters: ['start', 'bend'] },
};
export const BEHAVIORS = {
  relaxed: { name: 'Relaxed', headway: 2.3, acceleration: 1.3, lateral: 1.6 },
  balanced: { name: 'Balanced', headway: 1.7, acceleration: 1.8, lateral: 2.1 },
  responsive: { name: 'Responsive', headway: 1.3, acceleration: 2.3, lateral: 2.5 },
};
export const mod = (n: number, m: number) => ((n % m) + m) % m;
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const LANE_WIDTH = 3.6;
export const CAR_LENGTH = 4.7;
export const FIXED_STEP = 1 / 60;
const CURVATURE_STEP = 2;
/** Deterministic 0..1 hash, so traffic decisions replay identically. */
const hash = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;

export interface Junction { id: number; s: number; kind: 'signal' | 'stop'; name: string; }
/**
 * Lane geometry for a layout. Offsets are metres from the centreline, positive
 * to the left of travel, so a two-way street keeps opposing lanes at +offset.
 */
export interface LaneLayout {
  offsets: number[];
  directions: number[];
  egoLane: number;
  surface: number;   // half-width of asphalt
  verge: number;     // half-width of the shoulder / sidewalk slab
  edgeLine: number;  // |offset| of the solid outer edge line
  dividers: number[];// dashed lane dividers
  centerLine: boolean;
  barrier: number | null; // median barrier offset (highway only)
  median: number | null;  // half-width of a planted median (boulevard only)
}
// One lane each way between parking strips, split by a painted centre line.
const CITY: LaneLayout = {
  offsets: [-1.8, 1.8], directions: [1, -1], egoLane: 0,
  surface: 5.2, verge: 9.4, edgeLine: 4.95, dividers: [], centerLine: true, barrier: null, median: null,
};
// Two lanes each way around a planted median: no centre line, wide verges.
const BOULEVARD: LaneLayout = {
  offsets: [-3.5, -7.1, 3.5, 7.1], directions: [1, 1, -1, -1], egoLane: 1,
  surface: 9, verge: 13.4, edgeLine: 8.75, dividers: [-5.3, 5.3], centerLine: false, barrier: null, median: 1.7,
};
// A single-track forest lane: no markings at all, gravel verge, trees at the edge.
const FOREST: LaneLayout = {
  offsets: [-1.55, 1.55], directions: [1, -1], egoLane: 0,
  surface: 3.4, verge: 5.1, edgeLine: 0, dividers: [], centerLine: false, barrier: null, median: null,
};
// Five lanes in a single direction; lane 0 is the leftmost (fastest) lane.
const HIGHWAY: LaneLayout = {
  offsets: [7.2, 3.6, 0, -3.6, -7.2], directions: [1, 1, 1, 1, 1], egoLane: 2,
  surface: 10.7, verge: 13.8, edgeLine: 9.03, dividers: [-5.4, -1.8, 1.8, 5.4], centerLine: false, barrier: 9.9, median: null,
};
const LAYOUTS: Record<Scenario, LaneLayout> = { city: CITY, boulevard: BOULEVARD, curves: FOREST, highway: HIGHWAY };
/**
 * Each layout gets its own road geometry, not a scaled copy of another:
 * city blocks are long straights joined by tight corners, the boulevard runs
 * as wide open sweepers, and the forest lane links tight alternating bends.
 */
/** City blocks: long straight runs joined by fixed-radius corners. */
function cityBlocks(halfX: number, halfZ: number, radius: number): [number, number][] {
  const points: [number, number][] = [];
  const cx = halfX - radius, cz = halfZ - radius;
  const arc = (centreX: number, centreZ: number, from: number) => {
    for (let i = 0; i <= 3; i++) {
      const a = from + (i / 3) * (Math.PI / 2);
      points.push([centreX + radius * Math.cos(a), centreZ + radius * Math.sin(a)]);
    }
  };
  const straight = (x: number, z: number, toX: number, toZ: number) => {
    for (let i = 1; i <= 3; i++) points.push([x + (toX - x) * (i / 4), z + (toZ - z) * (i / 4)]);
  };
  straight(halfX, -cz, halfX, cz); arc(cx, cz, 0);                 // east side, north-east corner
  straight(cx, halfZ, -cx, halfZ); arc(-cx, cz, Math.PI / 2);      // north side, north-west corner
  straight(-halfX, cz, -halfX, -cz); arc(-cx, -cz, Math.PI);       // west side, south-west corner
  straight(-cx, -halfZ, cx, -halfZ); arc(cx, -cz, Math.PI * 1.5);  // south side, south-east corner
  return points;
}
const POINTS: Partial<Record<Scenario, [number, number][]>> = {
  city: cityBlocks(170, 205, 46),
  boulevard: [[0, 0], [0, 240], [35, 495], [150, 700], [370, 830], [620, 840], [815, 735],
    [920, 540], [910, 310], [805, 115], [620, -35], [380, -92], [160, -80]],
  curves: [[0, 0], [0, 138], [84, 254], [12, 380], [104, 500], [276, 540], [374, 452], [313, 322],
    [412, 215], [568, 229], [644, 96], [583, -70], [403, -133], [226, -90], [90, -151]],
};
export class Road {
  curve: CatmullRomCurve3;
  length: number;
  junctions: Junction[];
  lanes: LaneLayout;
  bendStart: number;
  private curvatureTable: Float64Array;
  constructor(public scenario: Scenario) {
    // A wide 6 km sweeping loop. Curvature stays gentle (radius >= ~450 m) so a
    // highway run holds cruise speed instead of being curvature limited.
    const highwayLoop = Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return [Math.sin(a) * 800, Math.cos(a) * 1150] as [number, number];
    });
    const points = POINTS[scenario] ?? highwayLoop;
    this.curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal');
    // Arc-length sampling has to stay sub-metre on every layout, and the loops
    // differ by 4x in length, so size the table from the measured length.
    this.curve.arcLengthDivisions = 2400;
    this.curve.updateArcLengths();
    this.curve.arcLengthDivisions = clamp(Math.round(this.curve.getLength() * 2.5), 2400, 18000);
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();
    this.curvatureTable = this.buildCurvatureTable();
    this.lanes = LAYOUTS[scenario];
    this.bendStart = scenario === 'highway' ? this.length * 0.28
      : scenario === 'curves' ? this.length * 0.1 : this.length * 0.24;
    // A freeway has no at-grade junctions; a forest lane has crossings but no
    // signals; the boulevard meets other avenues at widely spaced lights.
    const junctions: Junction[] = scenario === 'highway' ? []
      : scenario === 'curves' ? [
        { id: 1, s: this.length * 0.34, kind: 'stop', name: 'Timber Hollow' },
        { id: 4, s: this.length * 0.71, kind: 'stop', name: 'Miller Creek' },
      ]
      : scenario === 'boulevard' ? [
        { id: 0, s: this.length * 0.16, kind: 'signal', name: 'Grand & Palm' },
        { id: 2, s: this.length * 0.61, kind: 'signal', name: 'The Esplanade' },
      ]
      : [
        { id: 0, s: 130, kind: 'signal', name: 'Maple & 3rd' },
        { id: 1, s: this.length * 0.58, kind: 'stop', name: 'Cedar crossing' },
        { id: 2, s: this.length * 0.83, kind: 'signal', name: 'Park Avenue' },
      ];
    // Junctions belong on straight sections: a crossing laid over a tight bend
    // reads as broken geometry and makes the stop line impossible to judge.
    this.junctions = junctions.map(j => ({ ...j, s: this.straightest(j.s, 34) }));
  }
  /** The lowest-curvature point within `range` metres of `s`. */
  private straightest(s: number, range: number) {
    let best = s, bestCurvature = Infinity;
    for (let d = -range; d <= range; d += 4) {
      const c = this.curvature(s + d);
      if (c < bestCurvature) { bestCurvature = c; best = mod(s + d, this.length); }
    }
    return best;
  }
  get laneCount() { return this.lanes.offsets.length; }
  point(s: number, offset = 0) {
    const t = mod(s, this.length) / this.length;
    const p = this.curve.getPointAt(t);
    const tangent = this.curve.getTangentAt(t);
    return p.add(new Vector3(tangent.z, 0, -tangent.x).multiplyScalar(offset));
  }
  tangent(s: number) { return this.curve.getTangentAt(mod(s, this.length) / this.length); }
  /**
   * Curvature is sampled ten times per vehicle per step for the speed preview,
   * and each raw sample costs two arc-length searches, so it is precomputed
   * every CURVATURE_STEP metres and interpolated.
   */
  curvature(s: number) { return Math.abs(this.curvatureSigned(s)); }
  /** Positive turning left, negative turning right. */
  curvatureSigned(s: number) {
    const table = this.curvatureTable;
    const x = mod(s, this.length) / CURVATURE_STEP;
    const i = Math.floor(x);
    const a = table[i % table.length], b = table[(i + 1) % table.length];
    return a + (b - a) * (x - i);
  }
  private buildCurvatureTable() {
    const count = Math.max(8, Math.ceil(this.length / CURVATURE_STEP));
    const table = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const s = i * CURVATURE_STEP;
      const a = this.tangent(s - 2), b = this.tangent(s + 2);
      const angle = Math.acos(clamp(a.dot(b), -1, 1)) / 4;
      table[i] = angle * Math.sign(a.z * b.x - a.x * b.z || 1);
    }
    return table;
  }
  distance(from: number, to: number, direction = 1) { return mod((to - from) * direction, this.length); }
}

// 36s cycle: cross traffic clears before either direction receives green.
export function signalPhase(time: number, id: number): SignalPhase {
  const t = mod(time + id * 7, 36);
  return t < 11 ? 'red' : t < 29 ? 'green' : t < 32 ? 'amber' : 'red';
}
export function crossGreen(time: number, id: number) {
  const t = mod(time + id * 7, 36);
  return t >= 1 && t < 7;
}
export function signalRemaining(time: number, id: number) {
  const t = mod(time + id * 7, 36);
  return Math.ceil(t < 11 ? 11 - t : t < 29 ? 29 - t : t < 32 ? 32 - t : 47 - t);
}
export interface Vehicle {
  id: number; s: number; lane: number; direction: number; speed: number; acceleration: number;
  desired: number; stoppedAt: number; dwell: number; released: number; kind: 'sedan' | 'suv' | 'van';
  braking: boolean;
  /** Metres off the lane centre, and its rate. Driven by the model profile. */
  lateral: number; lateralRate: number;
  /** Metres already crept past the point where it first stopped. */
  creep: number;
  /** Simulation time before which the model will not pull away. */
  holdUntil: number;
  /** Seconds before this driver will consider another lane change. */
  changeCooldown: number;
  /** State at the previous fixed step, so rendering can interpolate between them. */
  prevS: number; prevLateral: number;
  headingError: number; prevHeading: number; steeringAngle: number; prevSteering: number;
  yawRate: number; requestedAcceleration: number; waitingForRelease: boolean;
}
export interface CrossVehicle { id: number; junction: number; x: number; direction: number; speed: number; prevX: number; }
export interface Telemetry {
  speed: number; acceleration: number; gap: number | null; steering: number;
  brake: boolean;
  elapsed: number; distance: number; progress: number; status: string;
  nextName: string; nextKind: 'signal' | 'stop' | 'none'; nextDistance: number; phase: SignalPhase | 'stop' | 'none'; remaining: number;
  lane: number; laneCount: number; lanePosition: number;
  vehicles: number; stops: number; laneChanges: number; cutIns: number; history: number[];
  model: ModelSimProfile;
  modelReaction: string;
  lateralAcceleration: number; laneErrorRms: number; peakJerk: number; interventions: number;
}
export class Simulation {
  road: Road;
  cars: Vehicle[] = [];
  crossCars: CrossVehicle[] = [];
  time = 0;
  distance = 0;
  stops = 0;
  history: number[] = [];
  private sampleTime = 0;
  private wasStopped = false;
  private window = 0;
  private rowSpacing = 0;
  status = 'Following the route';
  modelReaction = 'Ready to drive';
  laneChanges = 0;
  cutIns = 0;
  private cutInAt = -99;
  private steeringCommands: { at: number; value: number }[] = [];
  private laneErrorSquared = 0;
  private rollingTime = 0;
  peakJerk = 0;
  interventions = 0;
  private constrained = false;
  constructor(public options: SimOptions, chapter: Chapter = 'start', private profileOverride?: ModelSimProfile) {
    this.road = new Road(options.scenario);
    const stopJunction = this.road.junctions.find(j => j.kind === 'stop');
    const signalJunction = this.road.junctions.find(j => j.kind === 'signal');
    const start = chapter === 'stop' && stopJunction ? mod(stopJunction.s - 65, this.road.length)
      : chapter === 'bend' ? this.road.bendStart
        : chapter === 'signal' && signalJunction ? mod(signalJunction.s - 75, this.road.length) : 45;
    const layout = this.road.lanes;
    const lanes = this.road.laneCount;
    const highway = options.scenario === 'highway';
    this.cars.push({ id: 0, s: start, lane: layout.egoLane, direction: 1, speed: highway ? 24 : 10, acceleration: 0,
      desired: options.speed * 0.44704, stoppedAt: -1, dwell: 0, released: -1, kind: 'sedan', braking: false,
      lateral: 0, lateralRate: 0, creep: 0, holdUntil: 0, changeCooldown: 0, prevS: start, prevLateral: 0, headingError: 0, prevHeading: 0, steeringAngle: 0, prevSteering: 0, yawRate: 0, requestedAcceleration: 0, waitingForRelease: false });
    // Density spans an empty road to a genuine rush hour: at 100 the city runs
    // ~33 m between cars in each lane (queues at every light) and the highway
    // packs five lanes at ~40 m. A forest lane stays quiet even at its busiest.
    const traffic = { city: [10, 0.7], boulevard: [12, 1.12], curves: [5, 0.62], highway: [22, 1.22] }[options.scenario];
    const count = Math.round(traffic[0] + options.density * traffic[1]);
    // Highway lanes are ranked: the leftmost lane runs fastest, the rightmost slowest.
    // Highway traffic packs into a window around the ego instead of thinning out
    // over a 6 km loop, so every lane stays populated on screen.
    // Rows are spread with a clear zone kept around the ego, so no stream ever
    // wraps onto the vehicle behind it however many lanes there are. The two
    // long loops pack their traffic into a window around the ego instead of
    // thinning it out over kilometres the driver never sees.
    // The window also tightens as density rises, so the slider changes how close
    // the traffic runs, not only how much of it there is.
    const windowBase = { city: 0, boulevard: 1400, curves: 0, highway: 1500 }[options.scenario];
    const window = windowBase ? windowBase * (1 - options.density * 0.0037) : 0;
    this.window = window;
    const rows = Math.ceil(count / lanes);
    const spacing = (window || this.road.length - 100) / rows;
    this.rowSpacing = spacing;
    const stagger = Math.min(window ? 17 : 23, spacing / (lanes + 1));
    for (let i = 1; i <= count; i++) {
      // Independent lane streams. Rotating by the ego lane puts the first car —
      // the deliberately visible lead — at the head of the ego's own stream, so
      // it never lands on another car's slot.
      const lane = (i - 1 + layout.egoLane) % lanes;
      const row = Math.floor((i - 1) / lanes);
      // Oncoming lanes are spread over the whole loop and left alone: they sweep
      // past the ego continuously, so packing them into a window would deliver
      // one clump per lap and empty road in between.
      const oncoming = layout.directions[lane] !== 1;
      const laneSpacing = window && !oncoming ? spacing : (this.road.length - 100) / rows;
      const phase = lane === layout.egoLane ? (highway ? 70 : 34)
        : (window && !oncoming ? -window * 0.3 : 60) + lane * stagger;
      const s = start + phase + row * laneSpacing;
      // Traffic is paced off the ego's set speed. A fixed field speed lets the ego
      // drive off the front of the pack, leaving an empty road at any density.
      // Cars in one lane hold nearly the same speed, or a packed carriageway
      // disperses into platoons and voids within a couple of minutes.
      const set = options.speed * 0.44704;
      const desired = highway
        ? set * (1.05 - lane * 0.028) + (i % 5) * 0.12
        : set * (0.82 + (i % 5) * 0.045);
      this.cars.push({ id: i, s: mod(s, this.road.length), lane, direction: layout.directions[lane],
        speed: highway ? 22 + (i % 4) : 9 + (i % 4), acceleration: 0, desired,
        stoppedAt: -1, dwell: 0, released: -1, kind: i % 7 === 0 ? 'van' : i % 3 === 0 ? 'suv' : 'sedan', braking: false,
        lateral: 0, lateralRate: 0, creep: 0, holdUntil: 0, changeCooldown: 0, prevS: start, prevLateral: 0, headingError: 0, prevHeading: 0, steeringAngle: 0, prevSteering: 0, yawRate: 0, requestedAcceleration: 0, waitingForRelease: false });
    }
    for (const j of this.road.junctions.filter(j => j.kind === 'signal')) {
      for (let i = 0; i < 4; i++) this.crossCars.push({ id: j.id * 10 + i, junction: j.id, x: -45 - i * 15,
        direction: i % 2 ? -1 : 1, speed: 7, prevX: -45 - i * 15 });
    }
    for (const car of this.cars) car.prevS = car.s;
    this.modelReaction = `${this.model.steeringFeel} tracking`;
    this.ego.steeringAngle = Math.atan(2.93 * this.road.curvatureSigned(start));
    this.ego.prevSteering = this.ego.steeringAngle;
  }
  get ego() { return this.cars[0]; }
  get model(): ModelSimProfile { return this.profileOverride ?? getModelProfile(this.options.modelId); }
  laneOffset(car: Vehicle) {
    // `lateral` is integrated in step(); positive road offsets are to the left.
    return this.road.lanes.offsets[car.lane] + car.lateral;
  }
  /**
   * Where in the lane this model wants to sit right now: its standing bias, the
   * apex it cuts (or the wide line it drifts onto) through a bend, and the
   * micro-weave drivers describe as ping-ponging.
   */
  private lateralTarget(car: Vehicle, s = car.s, time = this.time) {
    const profile = this.model;
    const moving = clamp(car.speed / 3, 0, 1);
    const biasActive = profile.laneBiasContext !== 'night-without-lead'
      || (this.options.lighting === 'night' && this.lead(car).gap > 100);
    let target = biasActive ? -profile.laneOffset : 0;
    const curvature = this.road.curvatureSigned(s + 8 * car.direction);
    target += profile.curveLineBias * clamp(Math.abs(curvature) / 0.018, 0, 1) * Math.sign(curvature);
    const speedBias = profile.wobbleSpeedBias < 0 ? 1 - 0.8 * clamp((car.speed - 6) / 12, 0, 1)
      : profile.wobbleSpeedBias > 0 ? 0.2 + 0.8 * clamp((car.speed - 12) / 12, 0, 1) : 1;
    target += (Math.sin(time * 0.85) + 0.15 * Math.sin(time * 1.35)) * profile.laneWobble * speedBias * moving;
    return clamp(target, -0.38, 0.38);
  }
  plannedLaneOffset(distance: number) {
    const target = this.lateralTarget(this.ego, this.ego.s + distance, this.time + distance / Math.max(3, this.ego.speed));
    const blend = 1 - Math.exp(-distance / 15);
    return this.road.lanes.offsets[this.ego.lane] + this.ego.lateral * (1 - blend) + target * blend;
  }
  computeSteerAngle(car: Vehicle): number {
    if (car.id === 0) return car.steeringAngle;
    const k = this.road.curvatureSigned(car.s) * car.direction;
    return Math.atan(2.93 * k);
  }
  /** Kinematic bicycle in lane-relative coordinates. Steering causes yaw and
   * lateral displacement; a parked car cannot slide sideways. The controller
   * follows a preview target with model-specific perception and actuator lag.
   * Pure-pursuit geometry: CMU-RI-TR-92-01 (Coulter, 1992).
   */
  private steerEgo(dt: number, travelled: number) {
    const car = this.ego, p = this.model;
    car.prevHeading = car.headingError; car.prevSteering = car.steeringAngle;
    const look = Math.max(5, car.speed * p.lookaheadTime);
    const base = this.road.lanes.offsets[car.lane];
    const k = this.road.curvatureSigned(car.s);
    // Anticipate the distance travelled during the actual steering latency.
    // A fixed fraction of lookahead turned in too early and overshot on exit.
    const previewK = this.road.curvatureSigned(car.s + car.speed * (p.steeringDelay + p.steeringTimeConstant));
    const targetCurvature = previewK / Math.max(0.5, 1 - previewK * base)
      + 2 * (p.centeringGain / 2.2) * (this.lateralTarget(car, car.s + look * 0.3) - car.lateral) / (look * look)
      - 2 * p.lateralDamping * car.headingError / look;
    const desired = Math.atan(2.93 * targetCurvature);
    this.steeringCommands.push({ at: this.time, value: desired });
    while (this.steeringCommands.length > 1 && this.steeringCommands[1].at <= this.time - p.steeringDelay) this.steeringCommands.shift();
    const command = this.steeringCommands[0].value;
    car.steeringAngle += clamp((command - car.steeringAngle) / p.steeringTimeConstant, -p.steeringRateLimit, p.steeringRateLimit) * dt;
    car.steeringAngle = clamp(car.steeringAngle, -0.58, 0.58);
    car.yawRate = car.speed / 2.93 * Math.tan(car.steeringAngle);
    if (car.speed < 0.05) { car.yawRate = 0; car.lateralRate = 0; return; }
    car.headingError += car.yawRate * dt - k * travelled;
    car.headingError = clamp(car.headingError, -0.45, 0.45);
    car.lateralRate = car.speed * Math.sin(car.headingError);
    car.lateral += car.lateralRate * dt;
    // Shared sandbox containment is separate from model ability. Count a
    // correction instead of claiming that the model held the lane unaided.
    const laneHalfWidth = this.options.scenario === 'curves' ? 1.55 : 1.8;
    const bound = laneHalfWidth - 0.94 - 0.05;
    const limited = Math.abs(car.lateral) > bound;
    if (limited) {
      if (!this.constrained) this.interventions++;
      car.lateral = clamp(car.lateral, -bound, bound);
      if (Math.sign(car.headingError) === Math.sign(car.lateral)) car.headingError *= 0.8;
    }
    this.constrained = limited;
    this.laneErrorSquared += car.lateral ** 2 * dt; this.rollingTime += dt;
  }
  /** The junction the vehicle reaches next, or null on a junction-free layout. */
  nextJunction(car: Vehicle): (Junction & { distance: number }) | null {
    return this.road.junctions.map(j => ({ ...j, distance: this.road.distance(car.s, j.s - car.direction * 12, car.direction) }))
      .sort((a, b) => a.distance - b.distance)[0] ?? null;
  }
  lead(car: Vehicle) {
    let gap = this.road.length, speed = car.desired;
    for (const other of this.cars) {
      if (other.id === car.id || other.lane !== car.lane) continue;
      const d = this.road.distance(car.s, other.s, car.direction) - CAR_LENGTH;
      if (d < gap) { gap = d; speed = other.speed; }
    }
    return { gap, speed };
  }
  signal(id: number): SignalPhase {
    const phase = signalPhase(this.time, id);
    return phase !== 'red' && this.crossCars.some(c => c.junction === id && Math.abs(c.x) < 12) ? 'red' : phase;
  }
  crossCanProceed(id: number) {
    const junction = this.road.junctions.find(j => j.id === id);
    return Boolean(junction && crossGreen(this.time, id) && !this.cars.some(car =>
      Math.min(this.road.distance(car.s, junction.s), this.road.distance(junction.s, car.s)) < 12));
  }
  step(dt = FIXED_STEP) {
    this.time += dt;
    const profile = this.model;
    const behaviorMod = this.options.behavior === 'relaxed' ? 0.85 : this.options.behavior === 'responsive' ? 1.15 : 1.0;
    const headwayMod = this.options.behavior === 'relaxed' ? 0.35 : this.options.behavior === 'responsive' ? -0.3 : 0;
    const updates = this.cars.map(car => {
      const isEgo = car.id === 0;
      const accelMax = isEgo ? profile.accelerationMax * behaviorMod : 1.6;
      const headway = isEgo ? Math.max(1.0, profile.headway + headwayMod) : 1.5 + (car.id % 3) * 0.2;
      const lateral = isEgo ? profile.lateralPatience * (this.options.behavior === 'relaxed' ? 0.85 : this.options.behavior === 'responsive' ? 1.15 : 1.0) : 2;
      let desired = isEgo ? this.options.speed * 0.44704 * profile.cruiseFactor : car.desired;
      if (isEgo && profile.speedOscillation) desired += Math.sin(this.time * 0.8) * profile.speedOscillation;
      // Preview curvature, then decelerate before a bend, not after entering it.
      for (let d = 0; d <= 90; d += 10) {
        const curveSpeed = Math.sqrt(lateral / Math.max(0.0001, this.road.curvature(car.s + d * car.direction)));
        desired = Math.min(desired, Math.sqrt(curveSpeed ** 2 + 2 * (isEgo ? Math.abs(profile.comfortDecel) * 0.75 : 1.7) * d));
      }
      const lead = this.lead(car);
      let gap = lead.gap, leadSpeed = lead.speed;
      const junction = this.nextJunction(car);
      let mustStop = false;
      if (junction && junction.distance < 150) {
        if (junction.kind === 'signal') {
          const phase = this.signal(junction.id);
          // A vehicle too close to brake comfortably clears during amber.
          mustStop = phase === 'red' || (phase === 'amber' && junction.distance > car.speed ** 2 / 5 + 3);
        } else {
          if (car.released === junction.id && junction.distance > 25) { car.released = -1; car.dwell = 0; car.stoppedAt = -1; }
          mustStop = car.released !== junction.id;
          if (mustStop && junction.distance + (isEgo ? profile.stopOffset : 0) < 5.2 && car.speed < (isEgo && profile.rollingStop ? 1.4 : 0.2)) {
            if (car.stoppedAt !== junction.id) { car.stoppedAt = junction.id; car.dwell = 0; }
            car.dwell += dt;
            if (car.dwell >= (isEgo ? profile.stopDwell : 2)) { car.released = junction.id; mustStop = false; }
          }
        }
        if (mustStop && junction.distance - CAR_LENGTH / 2 < gap) {
          // Where this model actually comes to rest: creepers roll past the
          // line, early brakers stop short of it.
          gap = junction.distance - CAR_LENGTH / 2 + (isEgo ? profile.stopOffset + car.creep : 0);
          leadSpeed = 0;
        }
      }
      const closing = car.speed - leadSpeed;
      const desiredGap = 2.2 + Math.max(0, car.speed * headway + car.speed * closing / (2 * Math.sqrt(accelMax * (isEgo ? Math.abs(profile.comfortDecel) : 2.5))));
      const idm = accelMax * (1 - (car.speed / Math.max(1, desired)) ** 4 - (desiredGap / Math.max(0.25, gap)) ** 2);
      // A model's comfortable braking limit is its own, but it may always brake
      // harder than that rather than run into the car ahead.
      const brakeLimit = isEgo ? Math.min(-1.2, profile.comfortDecel) : -4.5;
      const emergency = gap < Math.max(2.5, car.speed * 0.9);
      let requested = clamp(idm, emergency ? -5.5 : brakeLimit, accelMax);
      if (isEgo) {
        car.requestedAcceleration += (requested - car.requestedAcceleration) * Math.min(1, dt / profile.speedResponseTime);
        requested = emergency ? Math.min(requested, car.requestedAcceleration) : car.requestedAcceleration;
        const blocked = mustStop || lead.gap < 3;
        if (car.speed < 0.2 && blocked) car.waitingForRelease = true;
        if (car.waitingForRelease && !blocked && requested > 0.1) {
          car.holdUntil = this.time + profile.departureLag; car.waitingForRelease = false;
        }
        if (car.speed < 0.2 && mustStop && junction?.kind === 'signal' && profile.creepTendency) {
          car.creep = Math.min(0.9, car.creep + dt * 0.22);
        } else if (car.speed > 1.5) car.creep = 0;
      }
      // Longitudinal smoothness: the jerk limit is what riders feel as "glassy"
      // versus "abrupt" at the very same following distance.
      const jerk = (isEgo ? profile.jerkLimit : 2.5) * dt;
      let acceleration = car.acceleration + clamp(requested - car.acceleration, -jerk * 1.2, jerk);
      if (isEgo && this.time < car.holdUntil) acceleration = Math.min(acceleration, 0);
      let speed = Math.max(0, car.speed + acceleration * dt);
      // Conservative nonpenetration guard for queues / a signal phase change.
      const arcFactor = isEgo ? Math.cos(car.headingError) / Math.max(0.55, 1 - this.road.curvatureSigned(car.s) * this.laneOffset(car)) : 1;
      speed = Math.min(speed, Math.max(0, (gap - 0.7) / dt / Math.max(1, arcFactor)));
      if (speed < 0.14 && requested < 0) speed = 0;
      if (speed === 0) acceleration = 0;
      // Brake lights logic:
      // - Stays ON during stops (holding brake until accelerating away)
      // - Stays OFF while driving (cruising, accelerating, coasting)
      // - Turns ON whenever a braking command is sent from the model (requested < -0.15 or deceleration < -0.2)
      const isStopped = speed < 0.2;
      const isDeparting = isStopped && requested > 0.15 && !mustStop && this.time >= car.holdUntil;
      const modelBrakingCommand = requested < -0.15 || acceleration < -0.2;
      const braking = (isStopped && !isDeparting) || (!isStopped && modelBrakingCommand);

      if (isEgo) {
        if (this.time < car.holdUntil && !mustStop) {
          this.modelReaction = 'Hesitating before departure'; this.status = `${profile.name} · Waiting to pull away`;
        } else if (mustStop && junction && junction.distance < 80) {
          if (junction.kind === 'stop') {
            this.modelReaction = car.speed < 0.2 ? 'Full stop · scanning intersection' : 'Approaching stop line';
            this.status = car.speed < 0.2 ? `${profile.name} · Full stop · safety scan` : `${profile.name} · Approaching stop sign`;
          } else {
            this.modelReaction = car.speed < 0.2
              ? profile.creepTendency ? 'Creeping toward stop line' : 'Holding at stop line'
              : profile.comfortDecel < -2.8 ? 'Firm braking into signal' : 'Gentle gliding deceleration';
            this.status = car.speed < 0.2
              ? profile.creepTendency ? `${profile.name} · Creeping forward at red` : `${profile.name} · Waiting for green light`
              : `${profile.name} · Slowing for traffic light`;
          }
        } else if (this.time - this.cutInAt < 3.5) {
          this.modelReaction = 'Yielding to a cut-in';
          this.status = `${profile.name} · Vehicle merged in ahead`;
        } else if (lead.gap < car.speed * headway + 14) {
          this.modelReaction = car.speed < 0.2
            ? 'Holding queue gap'
            : profile.headway < 1.4 ? 'Aggressive close following' : 'Smooth car-following';
          this.status = car.speed < 0.2
            ? `${profile.name} · Queued in traffic (${headway.toFixed(1)}s gap)`
            : `${profile.name} · Following lead (${Math.round(lead.gap)}m, ${headway.toFixed(1)}s)`;
        } else if (desired < this.options.speed * 0.44704 - 1) {
          this.modelReaction = profile.curveLineBias > 0.3 ? 'Hugging curve apex' : 'Adapting speed for bend';
          this.status = `${profile.name} · Speed adaptation for curve`;
        } else {
          this.modelReaction = `${profile.steeringFeel} centering`;
          this.status = `${profile.name} · ${profile.steeringFeel} tracking`;
        }
      }
      return { car, speed, acceleration, braking };
    });
    for (const { car, speed, acceleration, braking } of updates) {
      car.prevS = car.s; car.prevLateral = car.lateral;
      if (car.id === 0 && car.speed > 1) this.peakJerk = Math.max(this.peakJerk, Math.abs(acceleration - car.acceleration) / dt);
      car.speed = speed; car.acceleration = acceleration; car.braking = braking;
      const travelled = speed * dt;
      const arcDistance = car.id === 0 ? travelled * Math.cos(car.headingError) / Math.max(0.55, 1 - this.road.curvatureSigned(car.s) * this.laneOffset(car)) : travelled;
      car.s = mod(car.s + arcDistance * car.direction, this.road.length);
      if (car.id === 0) {
        this.distance += travelled;
        this.steerEgo(dt, arcDistance);
      }
    }
    // Cross streams get a protected phase; queues stay behind the crossing.
    for (const car of this.crossCars) {
      car.prevX = car.x;
      const allowed = this.crossCanProceed(car.junction);
      const ahead = this.crossCars.filter(c => c.junction === car.junction && c.direction === car.direction && c.x > car.x);
      const leadX = ahead.length ? Math.min(...ahead.map(c => c.x)) - 7 : Infinity;
      const boundary = allowed || car.x > -13 ? 65 : -14;
      car.x = Math.min(car.x + car.speed * dt, boundary, leadX);
      if (car.x > 60) car.x = -70;
    }
    this.driveLaneChanges(dt);
    if (this.window) this.recycleTraffic();
    if (this.ego.speed === 0 && !this.wasStopped) { this.stops++; this.wasStopped = true; }
    else if (this.ego.speed > 1) this.wasStopped = false;
    if (this.time - this.sampleTime >= 0.5) {
      this.history.push(this.ego.speed * 2.23694);
      if (this.history.length > 100) this.history.shift();
      this.sampleTime = this.time;
    }
  }
  /** Lanes running the same way whose centres sit one lane width apart. */
  private neighbourLanes(car: Vehicle) {
    const { offsets, directions } = this.road.lanes;
    const width = offsets.length > 1 ? Math.abs(offsets[0] - offsets[1]) : 3.6;
    const lanes: number[] = [];
    for (let lane = 0; lane < offsets.length; lane++) {
      if (lane === car.lane || directions[lane] !== car.direction) continue;
      if (Math.abs(offsets[lane] - offsets[car.lane]) < width * 1.2) lanes.push(lane);
    }
    return lanes;
  }
  /** Room to move over: a gap ahead, and one behind for whoever is back there. */
  private roomIn(car: Vehicle, lane: number, urgency = 1) {
    let ahead = Infinity, behind = Infinity, behindSpeed = 0;
    for (const other of this.cars) {
      if (other.id === car.id || other.lane !== lane || other.direction !== car.direction) continue;
      const forward = this.road.distance(car.s, other.s, car.direction) - CAR_LENGTH;
      const back = this.road.distance(other.s, car.s, car.direction) - CAR_LENGTH;
      if (forward < ahead) ahead = forward;
      if (back < behind) { behind = back; behindSpeed = other.speed; }
    }
    return ahead > (9 + car.speed * 0.75) * urgency && behind > (7 + behindSpeed * 0.55) * urgency;
  }
  private moveTo(car: Vehicle, lane: number, cooldown: number) {
    const offsets = this.road.lanes.offsets;
    // Carry the old lane's offset as lateral error and let it decay: the car
    // slides across rather than teleporting, while car-following already sees
    // it in its new lane.
    // Both the live and previous offsets shift with the lane, so the rendered
    // position stays continuous while the car slides across.
    const shift = offsets[car.lane] - offsets[lane];
    car.lateral += shift; car.prevLateral += shift;
    car.lane = lane;
    car.changeCooldown = cooldown;
    this.laneChanges++;
  }
  /**
   * Traffic overtakes, keeps right, and occasionally merges into the ego's lane
   * in front of it — the cut-in every driving model gets judged on.
   */
  private driveLaneChanges(dt: number) {
    const offsets = this.road.lanes.offsets;
    for (const car of this.cars) {
      if (car.id === 0) continue;
      // Ease whatever lateral error a change left behind back to the lane centre.
      car.lateral -= car.lateral * Math.min(1, dt * 1.1);
      if (car.changeCooldown > 0) { car.changeCooldown -= dt; continue; }
      if (car.speed < 4) continue;
      const neighbours = this.neighbourLanes(car);
      if (!neighbours.length) continue;

      // A cut-in: alongside the ego, slightly ahead, and feeling opportunistic.
      const gapToEgo = this.road.distance(this.ego.s, car.s, this.ego.direction);
      if (car.direction === this.ego.direction && neighbours.includes(this.ego.lane)
        && gapToEgo > 9 && gapToEgo < 38 && this.time - this.cutInAt > 5
        && hash(car.id * 97 + Math.floor(this.time / 3)) < 0.16
        && this.roomIn(car, this.ego.lane, 0.55)) {
        this.moveTo(car, this.ego.lane, 14);
        this.cutIns++; this.cutInAt = this.time;
        continue;
      }

      const lead = this.lead(car);
      const held = lead.gap < car.speed * 1.15 + 8 && lead.speed < car.desired - 1.2;
      if (held) {
        // Overtake toward the faster side of the carriageway (lower offset index).
        const overtaking = neighbours
          .filter(lane => offsets[lane] > offsets[car.lane] === (car.direction > 0 ? false : true))
          .sort((a, b) => Math.abs(offsets[a]) - Math.abs(offsets[b]));
        for (const lane of overtaking) {
          if (this.roomIn(car, lane)) { this.moveTo(car, lane, 8); break; }
        }
        continue;
      }
      // Otherwise drift back toward the slow lane, as most drivers eventually do.
      if (hash(car.id * 31 + Math.floor(this.time / 5)) < 0.25) {
        const keepRight = neighbours.filter(lane => Math.abs(offsets[lane]) > Math.abs(offsets[car.lane]));
        for (const lane of keepRight) {
          if (this.roomIn(car, lane, 1.25)) { this.moveTo(car, lane, 10); break; }
        }
      }
    }
  }
  /**
   * Jump the ego along the route, forward or back, landing on a stretch that is
   * not already occupied. Used by the skip controls to move through a lap.
   */
  skip(metres: number) {
    const probe = Math.sign(metres) * 12;
    let target = this.ego.s + metres;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = mod(target, this.road.length);
      const clear = this.cars.every(other => other.id === 0 || other.lane !== this.ego.lane
        || Math.min(this.road.distance(candidate, other.s), this.road.distance(other.s, candidate)) > 13);
      if (clear) break;
      target += probe;
    }
    this.ego.s = mod(target, this.road.length);
    this.ego.prevS = this.ego.s;
    this.ego.creep = 0; this.ego.holdUntil = 0;
    this.ego.released = -1; this.ego.stoppedAt = -1; this.ego.dwell = 0;
    this.ego.headingError = 0; this.ego.prevHeading = 0; this.ego.lateralRate = 0; this.steeringCommands = [];
  }
  /** Signed distance from the ego, negative behind, on a closed loop. */
  private relative(s: number) {
    return mod(s - this.ego.s + this.road.length / 2, this.road.length) - this.road.length / 2;
  }
  /**
   * On the long loops the field is packed into a window around the ego. Lanes
   * run at different speeds, so without recycling the packs shear apart and the
   * road empties out after a few minutes however high the density is set. Cars
   * are moved only well beyond the fog distance, so nothing pops in view.
   */
  private recycleTraffic() {
    // Half a window each side keeps the field at exactly its spawn density; a
    // wider band would let it spread out to half of it. Both layouts fog out
    // well before this distance, so the move is never visible.
    const limit = this.window * 0.5;
    for (const car of this.cars) {
      // Only the ego's own direction is recycled; oncoming lanes ring the loop.
      if (car.id === 0 || car.direction !== 1) continue;
      const offset = this.relative(car.s);
      if (Math.abs(offset) <= limit) continue;
      // Periodic boundary: a car leaving one end of the band re-enters the other
      // exactly one band-width away, which preserves the spacing it was spawned
      // with instead of stacking it onto the back of a platoon.
      const candidate = mod(car.s - Math.sign(offset) * limit * 2, this.road.length);
      // A recycled vehicle must approach a signal under its own braking
      // controller, never materialize inside a crossing or its stopping zone.
      const approach = 25 + car.speed * car.speed / 4;
      if (this.road.junctions.some(j => this.road.distance(candidate, j.s, car.direction) < approach
        || this.road.distance(j.s, candidate, car.direction) < 25)) continue;
      // Never drop a car onto another one: if the slot is taken (a lane that has
      // drifted or bunched at a light), leave it and retry on a later step.
      const clear = this.cars.every(other => other.id === car.id || other.lane !== car.lane
        || Math.min(this.road.distance(candidate, other.s), this.road.distance(other.s, candidate)) > 12);
      if (!clear) continue;
      car.s = candidate;
      car.prevS = candidate;
    }
  }
  telemetry(): Telemetry {
    const next = this.nextJunction(this.ego);
    const lead = this.lead(this.ego);
    const steerRad = this.computeSteerAngle(this.ego);
    return {
      speed: this.ego.speed * 2.23694, acceleration: this.ego.acceleration,
      gap: lead.gap < 150 ? lead.gap : null, steering: (steerRad * 180) / Math.PI,
      brake: this.ego.braking,
      elapsed: this.time, distance: this.distance, progress: this.ego.s / this.road.length,
      status: this.status,
      nextName: next ? next.name : 'Open highway', nextKind: next ? next.kind : 'none',
      nextDistance: next ? next.distance : 0,
      phase: !next ? 'none' : next.kind === 'stop' ? 'stop' : this.signal(next.id),
      remaining: !next || next.kind === 'stop' ? 0 : signalRemaining(this.time, next.id),
      lane: this.ego.lane, laneCount: this.road.laneCount, lanePosition: this.ego.lateral,
      vehicles: this.cars.length + this.crossCars.length, stops: this.stops,
      laneChanges: this.laneChanges, cutIns: this.cutIns, history: [...this.history],
      lateralAcceleration: this.ego.yawRate * this.ego.speed,
      laneErrorRms: Math.sqrt(this.laneErrorSquared / Math.max(0.01, this.rollingTime)),
      peakJerk: this.peakJerk, interventions: this.interventions,
      model: this.model, modelReaction: this.modelReaction || `${this.model.steeringFeel} tracking`,
    };
  }
}
