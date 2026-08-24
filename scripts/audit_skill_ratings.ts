/**
 * Audits the derived model skill ratings against the catalogue.
 *
 *   npm run ratings:audit          summary + calibration check
 *   npm run ratings:audit -- full  adds a per-model dump with evidence
 *
 * Checks that matter:
 *  - the bars track community polarity rather than raw vote volume
 *  - no model is rated well on an axis its own `negatives` call out
 *  - the six axes still discriminate (spread is not collapsed)
 *  - the corpus constants baked into lib/skillRatings.ts still match the data
 */

import models from '../data/models.json';
import {
    deriveSkillRatingsDetail,
    SKILL_AXES,
    SkillAxis,
    RatableModel,
} from '../lib/skillRatings';

interface Row extends RatableModel {
    categoryId: string;
}

const rows: Row[] = [];
for (const category of models.categories) {
    for (const model of category.models) {
        rows.push({ ...(model as unknown as RatableModel), categoryId: category.id });
    }
}

const stats = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    return {
        min: sorted[0],
        p25: sorted[Math.floor(sorted.length * 0.25)],
        median: sorted[Math.floor(sorted.length / 2)],
        p75: sorted[Math.floor(sorted.length * 0.75)],
        max: sorted[sorted.length - 1],
        mean,
        sd,
    };
};

const corr = (a: number[], b: number[]) => {
    const n = a.length;
    const ma = a.reduce((x, y) => x + y, 0) / n;
    const mb = b.reduce((x, y) => x + y, 0) / n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
        num += (a[i] - ma) * (b[i] - mb);
        da += (a[i] - ma) ** 2;
        db += (b[i] - mb) ** 2;
    }
    return num / Math.sqrt(da * db);
};

const polarityOf = (model: RatableModel) => {
    const s = model.sentiment;
    if (!s) return model.communityScore ?? 50;
    const opinionated = s.great + s.good + s.bad;
    return opinionated ? (100 * (s.great + 0.75 * s.good)) / opinionated : 50;
};

const details = rows.map((model) => ({ model, detail: deriveSkillRatingsDetail(model) }));

console.log(`\n=== Skill ratings audit — ${rows.length} models ===\n`);

console.log('Per-axis distribution');
for (const axis of SKILL_AXES) {
    const s = stats(details.map((d) => d.detail.ratings[axis]));
    console.log(
        `  ${axis.padEnd(10)} min ${String(s.min).padStart(2)}  p25 ${String(s.p25).padStart(2)}` +
        `  med ${String(s.median).padStart(2)}  p75 ${String(s.p75).padStart(2)}  max ${String(s.max).padStart(2)}` +
        `  mean ${s.mean.toFixed(1)}  sd ${s.sd.toFixed(1)}`,
    );
}

const polarity = details.map((d) => polarityOf(d.model));
const logVotes = details.map((d) => Math.log(d.model.totalVotes ?? 1));
const communityScore = details.map((d) => d.model.communityScore ?? 50);

console.log('\nCorrelation of each axis with community polarity (want: strong positive)');
for (const axis of SKILL_AXES) {
    console.log(`  ${axis.padEnd(10)} ${corr(polarity, details.map((d) => d.detail.ratings[axis])).toFixed(2)}`);
}

console.log('\nCorrelation with log(vote count) (want: near zero — volume is not quality)');
for (const axis of SKILL_AXES) {
    console.log(`  ${axis.padEnd(10)} ${corr(logVotes, details.map((d) => d.detail.ratings[axis])).toFixed(2)}`);
}

// Contradiction check: an axis rated above the corpus median while the model's
// own negatives name that axis is the failure mode the old heuristic had.
const AXIS_NEGATIVE_TERMS: Record<SkillAxis, string[]> = {
    lat: ['lateral', 'centering', 'weaving', 'hugging', 'hugs left', 'hugs right', 'lane', 'snaps', 'ping-pong'],
    stability: ['unstable', 'wobble', 'oscillat', 'twitchy', 'high speed', 'high-speed'],
    turns: ['turn', 'corner', 'curve', 'oversteer', 'understeer', 'lock out'],
    long: ['brak', 'accel', 'gap', 'follow', 'hesitant', 'sluggish', 'yoyo', 'yo-yo'],
    urban: ['city', 'intersection', 'stop sign', 'red light', 'green light', 'creep', 'stop-and-go'],
    comfort: ['jerk', 'harsh', 'rough', 'stiff', 'motion sickness', 'uncomfortab', 'notchy'],
};

const medians: Record<string, number> = {};
for (const axis of SKILL_AXES) medians[axis] = stats(details.map((d) => d.detail.ratings[axis])).median;

console.log('\nContradictions — axis rated above the corpus median despite being named in `negatives`');
let contradictions = 0;
for (const { model, detail } of details) {
    for (const axis of SKILL_AXES) {
        const named = (model.negatives ?? []).some((n) =>
            AXIS_NEGATIVE_TERMS[axis].some((term) => n.toLowerCase().includes(term)),
        );
        if (named && detail.ratings[axis] > medians[axis]) {
            console.log(`  ⚠️  ${model.name} — ${axis} = ${detail.ratings[axis]} (median ${medians[axis]})`);
            contradictions++;
        }
    }
}
if (contradictions === 0) console.log('  none');

console.log('\nCalibration constants vs. current data');
const polStats = stats(polarity);
const scoreStats = stats(communityScore);
console.log(`  polarity       mean ${polStats.mean.toFixed(1)}  sd ${polStats.sd.toFixed(1)}   (lib: 59.2 / 17.3)`);
console.log(`  communityScore mean ${scoreStats.mean.toFixed(1)}  sd ${scoreStats.sd.toFixed(1)}   (lib: 54.3 / 11.5)`);
console.log(`  ok%% vs log(votes) correlation ${corr(logVotes, details.map((d) => d.model.sentiment?.ok ?? 50)).toFixed(2)} ` +
    '(the sample-size bias that keeps communityScore out of the anchor)');

if (process.argv.includes('full')) {
    console.log('\n=== Per-model detail ===');
    for (const { model, detail } of details) {
        const bars = SKILL_AXES.map((a) => `${a}=${detail.ratings[a]}`).join(' ');
        console.log(
            `\n[${model.name}] ${model.categoryId} · polarity ${detail.polarity.toFixed(0)} · ` +
            `anchor ${detail.anchor.toFixed(0)} · confidence ${detail.confidence.toFixed(2)} · votes ${model.totalVotes}`,
        );
        console.log(`  ${bars}`);
        const top = detail.evidence
            .filter((e) => e.delta !== 0)
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 8);
        for (const e of top) {
            console.log(`    ${e.delta > 0 ? '+' : '-'}${Math.abs(e.delta).toFixed(1).padStart(5)} ${e.axis.padEnd(10)} ${e.source}`);
        }
    }
}

console.log('');
