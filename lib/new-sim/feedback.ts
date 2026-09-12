/** Feedback-to-controller mapping. These are illustrative parameters, not measured model outputs. */
export interface FeedbackModel {
  name: string; steeringFeel?: string; tags?: string[]; communityScore?: number; totalVotes?: number;
  consensus?: string; note?: string; positives?: string[]; negatives?: string[];
  sentiment?: { great?: number; good?: number; ok?: number; bad?: number };
}
export interface TraitEvidence {
  dimension: 'Lane centering' | 'Lateral control' | 'Longitudinal' | 'Stop & go';
  effect: string;
  quote: string;
  source: 'positive feedback' | 'negative feedback' | 'community summary' | 'model note' | 'steering feel' | 'model tags';
}
export interface FeedbackPhysics {
  headway: number; accelerationMax: number; comfortDecel: number; lateralPatience: number;
  curveLineBias: number; laneWobble: number; laneOffset: number; departureLag: number;
  creepTendency: boolean; jerkLimit: number; centeringGain: number; lateralDamping: number; stopOffset: number;
  steeringDelay: number; steeringTimeConstant: number; steeringRateLimit: number; lookaheadTime: number;
  speedResponseTime: number; speedOscillation: number; cruiseFactor: number;
  stopDwell: number; rollingStop: boolean; wobbleSpeedBias: number;
  laneBiasContext: 'always' | 'night-without-lead';
  evidence: TraitEvidence[];
  evidenceCoverage: 'Detailed' | 'Partial' | 'Limited';
  sentiment: { positive: number; neutral: number; negative: number; votes: number | null } | null;
}
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const normalize = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-');
/** Negation/resolution belongs to the match's clause, not an unrelated sentence. */
export function reportsFault(text: string, pattern: RegExp): boolean {
  const value = normalize(text);
  for (const match of value.matchAll(new RegExp(pattern.source, 'g'))) {
    const before = value.slice(0, match.index).split(/\b(?:but|however|yet)\b|[.;]/).at(-1) ?? '';
    if (/\b(?:without|no longer|rather than|instead of)\b/.test(match[0])) continue;
    if (/\b(?:no|not|without|never|zero|rather than|instead of)(?:[\s-]+[a-z0-9']+){0,5}[\s-]*$/.test(before)) continue;
    if (/\b(?:cur(?:ed|es)|fix(?:ed|es)?|resolv(?:es|ed)|eliminat(?:ed|es)|remov(?:ed|es)|reduc(?:ed|es)|improv(?:ed|es)|lack of)\b.{0,65}$/.test(before)) continue;
    return true;
  }
  return false;
}

export function deriveFeedbackPhysics(model: FeedbackModel): FeedbackPhysics {
  const evidence: TraitEvidence[] = [];
  const reports = [
    ...(model.positives ?? []).map(quote => ({ quote, source: 'positive feedback' as const })),
    ...(model.negatives ?? []).map(quote => ({ quote, source: 'negative feedback' as const })),
    ...(model.consensus ?? '').split(/(?<=[.!?])\s+/).filter(Boolean).map(quote => ({ quote, source: 'community summary' as const })),
    ...(model.note ? [{ quote: model.note, source: 'model note' as const }] : []),
  ];
  const record = (dimension: TraitEvidence['dimension'], effect: string, pattern: RegExp, fault = false) => {
    const found = reports.filter(r => fault ? (r.source !== 'positive feedback' || /\b(?:but|however|still)\b/i.test(r.quote)) && reportsFault(r.quote, pattern) : pattern.test(normalize(r.quote)));
    for (const report of found.slice(0, 2)) {
      if (!evidence.some(e => e.effect === effect && e.quote === report.quote)) evidence.push({ dimension, effect, ...report });
    }
    return found.length > 0;
  };
  const tags = (model.tags ?? []).join(' ').toLowerCase();
  const feel = normalize(model.steeringFeel ?? '');
  const p: FeedbackPhysics = {
    headway: 1.7, accelerationMax: 1.8, comfortDecel: -2.4, lateralPatience: 2.1,
    curveLineBias: 0, laneWobble: 0.025, laneOffset: 0, departureLag: 0.25,
    creepTendency: false, jerkLimit: 2.5, centeringGain: 2.2, lateralDamping: 1.05, stopOffset: 0,
    steeringDelay: 0.14, steeringTimeConstant: 0.2, steeringRateLimit: 0.4, lookaheadTime: 0.85,
    speedResponseTime: 0.35, speedOscillation: 0, cruiseFactor: 1,
    stopDwell: 2, rollingStop: false, wobbleSpeedBias: 0, laneBiasContext: 'always',
    evidence, evidenceCoverage: 'Limited', sentiment: null,
  };
  const counts = model.sentiment;
  if (counts) {
    const total = (counts.great ?? 0) + (counts.good ?? 0) + (counts.ok ?? 0) + (counts.bad ?? 0);
    if (total > 0) p.sentiment = {
      positive: ((counts.great ?? 0) + (counts.good ?? 0)) / total * 100,
      neutral: (counts.ok ?? 0) / total * 100, negative: (counts.bad ?? 0) / total * 100,
      votes: model.totalVotes ?? null,
    };
  }
  // Sentiment only moderates an explicitly reported fault; it never invents a
  // steering or braking defect from an overall popularity / satisfaction score.
  const severity = 0.9 + (p.sentiment?.negative ?? 25) / 250;
  if (/comfort|eco/.test(tags)) {
    Object.assign(p, { headway: 2.2, accelerationMax: 1.35, comfortDecel: -1.8, jerkLimit: 1.3, lateralPatience: 1.65 });
    evidence.push({ dimension: 'Longitudinal', effect: 'Longer gap and gentler acceleration', quote: (model.tags ?? []).join(', '), source: 'model tags' });
  }
  if (/aggressive|fast long/.test(tags)) {
    Object.assign(p, { headway: 1.25, accelerationMax: 2.4, comfortDecel: -3.3, jerkLimit: 4.1, lateralPatience: 2.5, departureLag: 0.1 });
    evidence.push({ dimension: 'Longitudinal', effect: 'Shorter gap and stronger acceleration', quote: (model.tags ?? []).join(', '), source: 'model tags' });
  }
  if (/ultra-smooth|smooth|natural|solid|firm|planted|stiff|confident/.test(feel) || /stable/.test(tags)) {
    Object.assign(p, { laneWobble: 0.015, centeringGain: 2.9, lateralDamping: 1.3, steeringTimeConstant: 0.22 });
    if (/smooth|natural/.test(feel)) p.jerkLimit = 1.3;
    evidence.push({ dimension: 'Lateral control', effect: 'Damped, consistent steering response', quote: model.steeringFeel ?? tags, source: model.steeringFeel ? 'steering feel' : 'model tags' });
  }
  if (/light|heavy/.test(feel)) { p.centeringGain = 1.55; p.lookaheadTime = 1.05; p.steeringTimeConstant = 0.32; }
  if (/twitchy|volatile|oscillating/.test(feel)) {
    Object.assign(p, { laneWobble: 0.14, centeringGain: 2.5, lateralDamping: 1.25, steeringRateLimit: 0.4, steeringDelay: 0.18 });
    evidence.push({ dimension: 'Lateral control', effect: 'More frequent steering corrections', quote: model.steeringFeel!, source: 'steering feel' });
  }

  if (record('Lane centering', 'Calmer lane tracking', /(?:stable|planted|locked-in|excellent|exceptional|great|rock.solid|consistent).{0,35}(?:lane|lateral|steer|highway)|(?:no|without|resolves|resolved).{0,50}(?:wander|weav|steering oscill)|(?:smooth|natural).{0,20}(?:steer|lateral)/)) {
    Object.assign(p, { laneWobble: 0.015, centeringGain: 2.9, lateralDamping: 1.4 });
  }
  if (record('Lane centering', 'Oscillating lane corrections', /ping.pong|see.saw|(?:steer\w*|lateral).{0,30}oscillat|oscillat.{0,30}(?:steer|lane)|lane.weav|wobbl|twitch/, true)) {
    Object.assign(p, { laneWobble: clamp(0.15 * severity, 0.12, 0.18), centeringGain: 2.5, lateralDamping: 1.25, steeringDelay: 0.18, steeringRateLimit: 0.4, lookaheadTime: 0.95 });
    const adverse = reports.filter(r => r.source !== 'positive feedback' && reportsFault(r.quote, /ping.pong|see.saw|oscillat|wobbl|twitch/)).map(r => normalize(r.quote)).join(' ');
    p.wobbleSpeedBias = /low.speed|slow.speed|below 6/.test(adverse) ? -1 : /high.speed|above (?:50|65)|at speed/.test(adverse) ? 1 : 0;
  }
  if (record('Lane centering', 'Slower return toward lane centre', /wander|drifts|lazy|loose|floaty|late (?:lane|to cent)|slow.{0,20}(?:wheel return|straighten|unwind)/, true)) {
    p.centeringGain = 1.3; p.steeringTimeConstant = 0.4; p.steeringDelay = 0.35;
    p.laneWobble = Math.max(p.laneWobble, 0.11);
  }
  if (record('Lateral control', 'Delayed, sharper corrective steering', /hard snaps|late lane corrections|outside the painted|octagonal|jerky.{0,20}(?:steer|curve)/, true)) {
    Object.assign(p, { steeringDelay: 0.22, steeringTimeConstant: 0.24, steeringRateLimit: 0.45, centeringGain: 2.6, lateralDamping: 1.3 });
  }
  if (record('Lane centering', 'Rightward lane bias', /right.hug|hug\w*.{0,15}right|right.side lane hugging/, true) || /right-hug/.test(tags)) p.laneOffset = 0.28;
  if (record('Lane centering', 'Leftward lane bias', /left.hug|hug\w*.{0,15}left|left.lane hugging/, true)) {
    p.laneOffset = -0.28;
    if (reports.some(r => /hugs left at night without lead/i.test(r.quote))) p.laneBiasContext = 'night-without-lead';
  }
  if (record('Lateral control', 'Tighter inside line through bends', /cut.{0,20}corners|corners.{0,20}tight|hugs turns tight|inside.line|inside.corner apex|too tight/, true)) p.curveLineBias = 0.3;
  if (record('Lateral control', 'Wider line and slower steering unwind', /understeer|gives up.{0,35}(?:turn|sharp)|drifts wide|takes.{0,20}turns.{0,20}wide|wide turns/, true)) {
    p.curveLineBias = -0.25; p.steeringTimeConstant = Math.max(0.4, p.steeringTimeConstant);
  }
  if (record('Lateral control', 'More speed reduction before corners', /slows (?:heavily )?for curves|predictable deceleration.{0,20}turns|curve speed|gently drifts into turns/)) p.lateralPatience = 1.65;
  if (record('Lateral control', 'More confident cornering pace', /good.{0,12}turn handling|phenomenal lateral holding|outstanding lateral|excellent.{0,15}curv|good curve turn.in|better cornering/)) p.lateralPatience = 2.5;

  if (record('Longitudinal', 'Gentler speed and braking transitions', /(?:smooth|softest|gentle|consistent|natural|progressive|seamless).{0,30}(?:brak|accel|longitudinal|stop|decel)|(?:longitudinal|braking).{0,40}smooth|no low.speed jerkiness/)) p.jerkLimit = 1.3;
  if (record('Longitudinal', 'Earlier, gentler braking', /gentle braking|begins decelerating.{0,20}sooner|stops short|brakes early|slows so early|stops smoothly just before|progressive.{0,15}braking/)) { p.comfortDecel = -1.8; p.stopOffset = -1.25; }
  if (record('Longitudinal', 'Later, firmer braking', /late brak|brak\w*.{0,15}late|hard.{0,8}brak|brak\w*.{0,12}(?:hard|abrupt)|harsh brak|abrupt decel|too fast to stop/, true)) {
    p.comfortDecel = -3.5; p.speedResponseTime = 0.6; p.jerkLimit = Math.max(p.jerkLimit, 4.4); p.stopOffset = 0.6;
  }
  if (record('Longitudinal', 'More space behind the lead vehicle', /conservative.{0,20}follow|longer.{0,15}(?:gap|following)|relaxed following/)) p.headway = 2.25;
  if (record('Longitudinal', 'Closer following distance', /tighter following|close following|tailgat|stops too close|shorter.{0,15}gap/, true)) p.headway = 1.25;
  if (record('Longitudinal', 'Fluctuating speed and following gap', /yoyo|yo-yo|surging|inconsistent gap|gas.brake/, true)) { p.speedOscillation = 0.75 * severity; p.speedResponseTime = 0.85; p.jerkLimit = Math.max(4.4, p.jerkLimit); }
  if (record('Stop & go', 'Quicker acceleration after the lead moves', /quick acceleration|fast.{0,25}gas|dec.level acceleration|aggressive longitudinal acceleration|faster reactions|accelerates from a stop better|smooth city acceleration/)) { p.accelerationMax = 2.45; p.departureLag = 0.1; }
  if (record('Stop & go', 'Hesitation when pulling away', /hesitan\w*.{0,35}(?:accel|lead|stop)|sluggish.{0,35}(?:launch|accel|off.the.line)|stalls off|slow to follow|afraid of green|conservative acceleration|gas pedal/, true)) {
    p.departureLag = 1.1; p.accelerationMax = Math.min(1.3, p.accelerationMax); p.speedResponseTime = 0.65;
  }
  if (record('Longitudinal', 'Cruises below the requested speed', /drives too slow|bleeds speed|settles around 48|settling at 53|slow without a lead/, true)) p.cruiseFactor = 0.91;
  if (record('Stop & go', 'Inches forward while waiting', /creeps at red|creeps slightly|creep.{0,30}(?:stop line|traffic light)|fails to stay stopped/, true)) { p.creepTendency = true; p.stopOffset = 0.65; }
  if (record('Stop & go', 'Rolling stop-sign approach', /rolling stops|rolls? stop signs|rolled.{0,20}stop signs|california stop|misses.{0,12}stop signs/, true)) { p.rollingStop = true; p.stopDwell = 0; }
  if (record('Stop & go', 'Deliberate stop-sign dwell', /smooth and reliable stop sign|recognises stop signs better|stops for every stop|stops smoothly just before|stop sign performance.{0,30}best/)) { if (!p.rollingStop) p.stopDwell = 2.4; }
  // Bound the illustrative fault response; sentiment must not destabilize the controller.
  p.lookaheadTime = Math.max(p.lookaheadTime, 1.05);
  p.lateralDamping = Math.max(p.lateralDamping, 1.2);
  p.steeringDelay = Math.min(p.steeringDelay, 0.2);
  p.steeringTimeConstant = Math.min(p.steeringTimeConstant, 0.28);
  p.centeringGain = Math.max(p.centeringGain, 2);
  const dimensions = new Set(evidence.filter(e => !['steering feel', 'model tags'].includes(e.source)).map(e => e.dimension));
  p.evidenceCoverage = dimensions.size >= 3 ? 'Detailed' : dimensions.size >= 1 ? 'Partial' : 'Limited';
  return p;
}
