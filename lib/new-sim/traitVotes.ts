import type { PollQuestionDef } from '../modelVotes';
import type { ModelSimProfile } from './modelProfiles';

/** Only explicit behavior answers affect controls. Overall approval is not a trait vote. */
export function applyTraitVotes(profile: ModelSimProfile, questions: PollQuestionDef[]): ModelSimProfile {
  const result = { ...profile, evidence: [...profile.evidence] };
  const rules = [
    { context: /lateral|steer|lane/i, match: /smooth and steady|stable|well.centered/i, key: 'laneWobble', target: .01, dimension: 'Lane centering', effect: 'Steady lane tracking' },
    { context: /lateral|steer|lane/i, match: /ping.pong|wobbl|oscillat|twitch/i, key: 'laneWobble', target: .18, dimension: 'Lane centering', effect: 'Reported lane oscillation' },
    { context: /longitudinal|follow|gap/i, match: /too close|tailgat|short.*gap/i, key: 'headway', target: 1.2, dimension: 'Longitudinal', effect: 'Closer following' },
    { context: /longitudinal|follow|gap/i, match: /too far|long.*gap|relaxed/i, key: 'headway', target: 2.4, dimension: 'Longitudinal', effect: 'More following space' },
    { context: /longitudinal|brak|accel/i, match: /smooth|gentle/i, key: 'jerkLimit', target: 1.2, dimension: 'Longitudinal', effect: 'Gentler speed changes' },
    { context: /longitudinal|brak|accel/i, match: /harsh|abrupt|jerky/i, key: 'jerkLimit', target: 4.4, dimension: 'Longitudinal', effect: 'Sharper speed changes' },
    { context: /longitudinal|accel|stop/i, match: /hesitant|sluggish|slow to/i, key: 'departureLag', target: 1.2, dimension: 'Stop & go', effect: 'Delayed departure' },
  ] as const;
  const contributions = new Map<string, { target: number; weight: number }[]>();
  for (const q of questions) {
    if (!(q.voters > 0)) continue;
    for (const option of q.options) {
      if (!(option.votes > 0) || /no |without |not /i.test(option.label)) continue;
      for (const rule of rules) {
        if (!rule.context.test(`${q.id} ${q.title}`) || !rule.match.test(option.label)) continue;
        const weight = Math.min(1, option.votes / q.voters) * q.voters / (q.voters + 12);
        contributions.set(rule.key, [...(contributions.get(rule.key) ?? []), { target: rule.target, weight }]);
        result.evidence.push({ dimension: rule.dimension, effect: rule.effect, source: 'trait poll', quote: `${option.label}: ${option.votes}/${q.voters} voters (${q.title})` });
      }
    }
  }
  for (const [key, votes] of contributions) {
    const k = key as 'laneWobble' | 'headway' | 'jerkLimit' | 'departureLag';
    const total = votes.reduce((n, v) => n + v.weight, 0);
    const target = votes.reduce((n, v) => n + v.target * v.weight, 0) / total;
    const weight = Math.min(.7, total);
    result[k] = profile[k] * (1 - weight) + target * weight;
  }
  return result;
}
