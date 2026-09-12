import assert from 'node:assert/strict';
import { ALL_MODEL_PROFILES, getModelProfile, deriveModelSimProfile } from '../../lib/new-sim/modelProfiles';
import { deriveFeedbackPhysics, reportsFault } from '../../lib/new-sim/feedback';
import { Simulation, DEFAULT_OPTIONS, FIXED_STEP, SCENARIOS } from '../../lib/new-sim/simulation';

const run = (sim: Simulation, seconds: number, each?: () => void) => { for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) { sim.step(); each?.(); } };
const model = (name: string) => { const m = ALL_MODEL_PROFILES.find(p => p.name === name); assert.ok(m, `Missing model ${name}`); return m; };
// Praise about a removed fault must never turn into a simulated fault.
assert.equal(reportsFault('No low-speed oscillations', /oscillat/), false);
assert.equal(reportsFault('Completely cures the severe low-speed steering oscillations of v3', /steering.{0,30}oscillat/), false);
assert.equal(reportsFault('Natural steering without wander or low-speed oscillation', /steering.{0,40}oscillat/), false);
assert.equal(reportsFault('Gradual deceleration rather than harsh brake stabbing', /harsh brak/), false);
assert.equal(reportsFault('Smooth on highway, but still oscillating at low speed', /oscillat/), true);
const unknown = deriveFeedbackPhysics({name:'No evidence', sentiment:{bad:100}});
const popular = deriveFeedbackPhysics({name:'No evidence', sentiment:{great:100}});
assert.equal(unknown.laneWobble, popular.laneWobble, 'Overall sentiment fabricated lateral defects');
assert.equal(unknown.evidenceCoverage, 'Limited');
const corrected = model('BMRLNAP Model v4'), oscillating = model('BMRLNAP Model v3'), sad = model('Sad Model');
assert.ok(corrected.laneWobble < oscillating.laneWobble / 5, 'Resolved v3 oscillations leaked into v4');
assert.ok(sad.laneWobble < 0.03, 'Negated Sad Model oscillation became a fault');
assert.ok(corrected.departureLag > model('OP Model 10 v3').departureLag);
assert.ok(model('Down to Ride v6').headway > model('Dark Souls Model v2').headway);
assert.ok(model('OP Model 10 v2').departureLag > model('OP Model 10 v3').departureLag);
assert.ok(model('Pop v2').speedOscillation > 0, 'Reported yoyo following must affect speed');
assert.ok(oscillating.rollingStop, 'Reported California stops are missing');
console.log('PASS negation, resolved faults, sentiment attribution and named-model evidence');

// Lateral dynamics must be a consequence of steering and speed.
// Use a reliable full-stop profile to hold the vehicle in place during its dwell.
const full = new Simulation({...DEFAULT_OPTIONS, scenario:'city', speed:35, modelId:sad.id}, 'stop');
full.cars=[full.ego]; full.ego.s=full.road.junctions.find(j=>j.kind==='stop')!.s-16.55; full.ego.speed=0; full.ego.lateral=0.25;
run(full,1);
assert.equal(full.ego.lateral,0.25,'A parked vehicle slid sideways');
assert.equal(full.ego.yawRate,0,'A parked vehicle rotated');
const moving = new Simulation({...DEFAULT_OPTIONS, scenario:'highway',modelId:sad.id,speed:55});
moving.cars=[moving.ego]; moving.ego.lateral=0.4;
let maxSteerRate=0, old=moving.ego.steeringAngle;
run(moving,12,()=>{maxSteerRate=Math.max(maxSteerRate,Math.abs(moving.ego.steeringAngle-old)/FIXED_STEP);old=moving.ego.steeringAngle;assert.ok(Number.isFinite(moving.ego.headingError));});
assert.ok(maxSteerRate <= sad.steeringRateLimit + 1e-8);
assert.ok(Math.abs(moving.ego.lateral)<0.2,'Stable model did not recover a lateral offset');
assert.equal(moving.computeSteerAngle(moving.ego),moving.ego.steeringAngle,'Wheel angle is disconnected from physics');
console.log('PASS parked-car stability, steering-rate limits and lane recovery');

// Same environment / traffic seed regardless of chosen model.
const a=new Simulation({...DEFAULT_OPTIONS,modelId:sad.id}),b=new Simulation({...DEFAULT_OPTIONS,modelId:oscillating.id});
assert.deepEqual(a.cars.map(c=>[c.s,c.lane,c.speed]),b.cars.map(c=>[c.s,c.lane,c.speed]));
console.log('PASS model comparisons share identical initial traffic');

// Explicit longitudinal feedback changes the actual response to a moving lead.
function depart(profile: ReturnType<typeof deriveModelSimProfile>) {
 const sim=new Simulation({...DEFAULT_OPTIONS,scenario:'highway',speed:35},'start',profile);
 const lead=sim.cars[1]; lead.lane=sim.ego.lane; lead.s=sim.ego.s+6.9; lead.speed=0;
 sim.cars=[sim.ego,lead];sim.ego.speed=0;lead.desired=0;
 run(sim,1);sim.cars=[sim.ego];const release=sim.time; let launch=Infinity;
 run(sim,5,()=>{if(sim.ego.speed>0.3&&launch===Infinity)launch=sim.time-release;});return launch;
}
const normal=deriveModelSimProfile({name:'Baseline'}),hesitant=deriveModelSimProfile({name:'Hesitant',negatives:['Hesitant to accelerate from a stop']});
const quickTime=depart(normal),slowTime=depart(hesitant);
assert.ok(slowTime>quickTime+0.5,`Departure delay not reflected: ${quickTime} vs ${slowTime}`);
console.log(`PASS queue departure: baseline ${quickTime.toFixed(2)}s, hesitant ${slowTime.toFixed(2)}s`);

// All catalog profiles must remain finite and continue after their stop policy.
let rollingCount=0;
for(const profile of ALL_MODEL_PROFILES){
 const sim=new Simulation({...DEFAULT_OPTIONS,scenario:'city',density:0,speed:35,modelId:profile.id},'stop');sim.cars=[sim.ego];
 let minSpeed=Infinity;
 run(sim,40,()=>{minSpeed=Math.min(minSpeed,sim.ego.speed);assert.ok([sim.ego.s,sim.ego.speed,sim.ego.lateral,sim.ego.steeringAngle].every(Number.isFinite),profile.name);});
 assert.ok(sim.distance>95,`${profile.name} stuck at stop: ${sim.distance.toFixed(1)}m`);
 if(profile.rollingStop){rollingCount++; assert.ok(minSpeed>0.2,`${profile.name} rolling-stop report produced a full stop`);}
 else assert.ok(minSpeed<0.2,`${profile.name} full-stop policy never stopped`);
}
assert.ok(rollingCount>0);
assert.equal(getModelProfile('dark-souls-model-v2').name,'Dark Souls Model v2');
console.log(`PASS all ${ALL_MODEL_PROFILES.length} catalog profiles: finite motion, stop and departure (${rollingCount} reported rolling-stop profiles)`);

// Fixed lead speed isolates headway from incidental merges and signal timing.
function steadyFollowing(profile: ReturnType<typeof deriveModelSimProfile>) {
 const sim = new Simulation({...DEFAULT_OPTIONS,scenario:'highway',speed:35},'start',profile);
 const lead=sim.cars[1]; lead.lane=sim.ego.lane; lead.s=sim.ego.s+45;lead.speed=10;lead.desired=10;lead.changeCooldown=Infinity;
 sim.cars=[sim.ego,lead];sim.ego.speed=10;
 run(sim,90);return sim.lead(sim.ego).gap;
}
const relaxed=deriveModelSimProfile({name:'Comfort control',tags:['Comfort']}), assertive=deriveModelSimProfile({name:'Assertive control',tags:['Aggressive']});
const relaxedGap=steadyFollowing(relaxed),assertiveGap=steadyFollowing(assertive);
assert.ok(relaxedGap>assertiveGap+5, `Headway gap: ${relaxedGap} vs ${assertiveGap}`);
console.log(`PASS identical lead: comfort ${relaxedGap.toFixed(1)}m vs assertive ${assertiveGap.toFixed(1)}m`);

// A feedback profile must illustrate mild weave without bouncing off containment.
// Cover every model at the maximum requested cruise speed of all four layouts.
let worstOffset = 0, worstLateralRate = 0;
for (const profile of ALL_MODEL_PROFILES) {
  for (const scenario of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
    const sim = new Simulation({ ...DEFAULT_OPTIONS, modelId: profile.id, scenario, speed: SCENARIOS[scenario].maxSpeed, density: 0 });
    sim.cars = [sim.ego];
    run(sim, 120, () => {
      worstOffset = Math.max(worstOffset, Math.abs(sim.ego.lateral));
      worstLateralRate = Math.max(worstLateralRate, Math.abs(sim.ego.lateralRate));
      assert.ok(Math.abs(sim.ego.lateral) < 0.48, `${profile.name} ${scenario}: excessive lane excursion`);
      assert.ok(Math.abs(sim.ego.lateralRate) < 0.6, `${profile.name} ${scenario}: abrupt sideways movement`);
    });
    assert.equal(sim.interventions, 0, `${profile.name} ${scenario}: relying on lane containment`);
  }
}
console.log(`PASS ${ALL_MODEL_PROFILES.length * Object.keys(SCENARIOS).length} model/road runs at max cruise: ${(worstOffset * 100).toFixed(1)}cm maximum offset, ${worstLateralRate.toFixed(2)}m/s maximum lateral drift, zero containment corrections`);
