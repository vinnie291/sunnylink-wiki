import type { PollQuestionDef } from '../modelVotes';
import type { ModelSimProfile } from './modelProfiles';

type NumericTraitKey = 'laneWobble' | 'headway' | 'jerkLimit' | 'departureLag' | 'curveLineBias' | 'comfortDecel' | 'cruiseFactor' | 'stopOffset';

/** Only explicit behavior answers affect controls. Overall approval is not a trait vote. */
export function applyTraitVotes(profile: ModelSimProfile, questions: PollQuestionDef[]): ModelSimProfile {
  const result = { ...profile, evidence: [...profile.evidence] };
  const rules: ReadonlyArray<{
    context: RegExp;
    match: RegExp;
    key: NumericTraitKey;
    target: number;
    dimension: 'Lane centering' | 'Lateral control' | 'Longitudinal' | 'Stop & go';
    effect: string;
    setsCreep?: boolean;
  }> = [
    { context: /lateral|steer|lane|poll3/i, match: /smooth (?:and|&) steady|stable|well.centered/i, key: 'laneWobble', target: .01, dimension: 'Lane centering', effect: 'Steady lane tracking' },
    { context: /lateral|steer|lane|poll3/i, match: /ping.pong|wobbl|oscillat|twitch|wanders/i, key: 'laneWobble', target: .18, dimension: 'Lane centering', effect: 'Reported lane oscillation' },
    { context: /lateral|steer|lane|poll3/i, match: /understeer|gives up.{0,20}turn|drifts wide/i, key: 'curveLineBias', target: -.25, dimension: 'Lateral control', effect: 'Wider line and slower steering unwind' },
    { context: /lateral|steer|lane|poll3/i, match: /cut.{0,15}corners|over.?steer/i, key: 'curveLineBias', target: .3, dimension: 'Lateral control', effect: 'Tighter inside line through bends' },
    { context: /longitudinal|follow|gap|poll5/i, match: /too close|tailgat|short.*gap/i, key: 'headway', target: 1.2, dimension: 'Longitudinal', effect: 'Closer following' },
    { context: /longitudinal|follow|gap|poll5/i, match: /too far|long.*gap|relaxed/i, key: 'headway', target: 2.4, dimension: 'Longitudinal', effect: 'More following space' },
    { context: /longitudinal|brak|accel|poll5/i, match: /smooth|gentle/i, key: 'jerkLimit', target: 1.2, dimension: 'Longitudinal', effect: 'Gentler speed changes' },
    { context: /longitudinal|brak|accel|poll5/i, match: /harsh|abrupt|jerky/i, key: 'jerkLimit', target: 4.4, dimension: 'Longitudinal', effect: 'Sharper speed changes' },
    { context: /longitudinal|brak|accel|poll5/i, match: /hard.{0,8}brak|late.{0,8}brak|harsh.{0,8}brak/i, key: 'comfortDecel', target: -3.5, dimension: 'Longitudinal', effect: 'Later, firmer braking' },
    { context: /longitudinal|accel|stop|poll5/i, match: /hesitant|sluggish|slow to|bad.{0,10}stop\s*(?:and|&)\s*go/i, key: 'departureLag', target: 1.2, dimension: 'Stop & go', effect: 'Delayed departure' },
    { context: /longitudinal|speed|poll5/i, match: /does not hold.{0,15}speed|bleeds speed/i, key: 'cruiseFactor', target: .91, dimension: 'Longitudinal', effect: 'Cruises below the requested speed' },
    { context: /longitudinal|stop|poll5/i, match: /overshoots.{0,20}stop|rolls through/i, key: 'stopOffset', target: .65, dimension: 'Stop & go', effect: 'Inches forward while waiting', setsCreep: true },
  ];
  const contributions = new Map<NumericTraitKey, { target: number; weight: number }[]>();
  let creepWeight = 0;
  for (const q of questions) {
    if (!(q.voters > 0)) continue;
    for (const option of q.options) {
      if (!(option.votes > 0) || /\b(?:no|without|not)\b/i.test(option.label) && !/does not hold/i.test(option.label)) continue;
      for (const rule of rules) {
        if (!rule.context.test(`${q.id} ${q.title}`) || !rule.match.test(option.label)) continue;
        const weight = Math.min(1, option.votes / q.voters) * q.voters / (q.voters + 12);
        contributions.set(rule.key, [...(contributions.get(rule.key) ?? []), { target: rule.target, weight }]);
        if (rule.setsCreep) creepWeight += weight;
        result.evidence.push({ dimension: rule.dimension, effect: rule.effect, source: 'trait poll', quote: `${option.label}: ${option.votes}/${q.voters} voters (${q.title})` });
      }
    }
  }
  for (const [key, votes] of contributions) {
    const total = votes.reduce((n, v) => n + v.weight, 0);
    const target = votes.reduce((n, v) => n + v.target * v.weight, 0) / total;
    const weight = Math.min(.7, total);
    result[key] = profile[key] * (1 - weight) + target * weight;
  }
  if (creepWeight >= 0.12) {
    result.creepTendency = true;
  }
  if (creepWeight >= 0.25) {
    result.rollingStop = true;
  }
  return result;
}
