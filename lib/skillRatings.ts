/**
 * Skill ratings — the six bars rendered on every model card.
 *
 * The catalogue never ships hand-authored per-axis numbers, so these bars are
 * derived. The goal of this module is that every bar is traceable to something
 * actually recorded about the model, and that a bar is only as confident as the
 * evidence behind it.
 *
 * Three layers, in order:
 *
 *   1. ANCHOR — a quality estimate from the community vote breakdown. This sets
 *      where all six bars start.
 *   2. EVIDENCE — per-axis adjustments from curated fields (tags, steering feel,
 *      "best for", badge, catalogue category) and from feedback prose.
 *   3. CONFIDENCE — evidence is scaled down for models whose behaviour is
 *      reported as vehicle-dependent, volatile, or barely tested, so thin data
 *      produces bars near the anchor instead of invented spread.
 *
 * Design notes worth keeping in mind when editing:
 *
 * - `communityScore` is NOT used as the primary anchor. scripts/analyze_discord_sentiment.ts
 *   computes it as great*1.0 + good*0.75 + ok*0.5, and the "ok" bucket is that
 *   classifier's default for messages with no sentiment keywords. More messages
 *   scanned therefore means more neutral filler: across the catalogue, ok% rises
 *   with vote count (r = +0.58) and models with 150+ votes collapse to a
 *   communityScore of 51.6 +/- 1.9 regardless of how they are actually received.
 *   We anchor on polarity among *opinionated* votes instead, which carries no
 *   such sample-size bias, then shrink toward the corpus prior by sample size.
 *
 * - Phrase matching is polarity-scoped. A term found in `negatives` can only
 *   ever subtract, a term in `positives` can only ever add, and prose is split
 *   into clauses whose own polarity decides the sign. Terms are matched on word
 *   boundaries over normalised text, so "unstable" no longer counts as "stable"
 *   and "uncomfortably close" no longer credits comfort.
 *
 * - Ratings are computed from the canonical English record, looked up by name.
 *   Only `consensus` and `note` are translated in data/models.<locale>.json, so
 *   deriving from the active locale's copy would give the same model different
 *   bars in different languages.
 */

import modelsEn from '../data/models.json';

export interface SkillRatings {
    lat: number;
    stability: number;
    turns: number;
    long: number;
    urban: number;
    comfort: number;
}

export type SkillAxis = keyof SkillRatings;

export const SKILL_AXES: SkillAxis[] = ['lat', 'stability', 'turns', 'long', 'urban', 'comfort'];

interface SentimentData {
    great: number;
    good: number;
    ok: number;
    bad: number;
}

export interface RatableModel {
    name: string;
    tags?: string[];
    consensus?: string;
    note?: string;
    badge?: string;
    communityScore?: number;
    totalVotes?: number;
    sentiment?: SentimentData;
    bestFor?: string;
    steeringFeel?: string;
    positives?: string[];
    negatives?: string[];
    skillRatings?: SkillRatings;
}

/** Partial per-axis adjustment. Magnitudes are in bar points. */
type AxisDelta = Partial<Record<SkillAxis, number>>;

/** One piece of evidence that moved a rating, kept for the bar tooltips. */
export interface RatingEvidence {
    source: string;
    axis: SkillAxis;
    delta: number;
}

export interface SkillRatingsDetail {
    ratings: SkillRatings;
    /** Anchor the six bars started from, before evidence. */
    anchor: number;
    /** Polarity among opinionated votes, after shrinkage (0-100). */
    polarity: number;
    /** How much of the evidence was applied (0-1). */
    confidence: number;
    evidence: RatingEvidence[];
}

// ── Corpus calibration ───────────────────────────────────────────────────────
// Measured over the 87 catalogued models in data/models.json. Re-run
// `npm run ratings:audit` after a sentiment sync to check these still hold.

/** Mean polarity among opinionated votes across the catalogue. */
const CORPUS_POLARITY_MEAN = 59.2;
const CORPUS_POLARITY_SD = 17.3;
/** Mean and spread of the displayed communityScore, used to rescale it. */
const CORPUS_SCORE_MEAN = 54.3;
const CORPUS_SCORE_SD = 11.5;

/**
 * Opinionated votes a model needs before its own polarity outweighs the corpus
 * prior. The median model has ~21, so a handful of votes still moves the bars
 * but cannot pin them to an extreme on its own.
 */
const PRIOR_STRENGTH = 6;

/** Where a corpus-average model sits on the 0-99 bar scale. */
const NEUTRAL_BAR = 63;
/** Bar points per point of polarity above/below the corpus mean. */
const POLARITY_TO_BAR = 0.7;

const MIN_RATING = 35;
const MAX_RATING = 99;

/** Ceiling on how far curated fields alone may move one axis. */
const STRUCTURED_CAP = 18;
/** Ceiling on how far prose alone may move one axis, per direction. */
const PHRASE_CAP = 22;

// ── Text handling ────────────────────────────────────────────────────────────

/**
 * Lowercase, fold hyphens/slashes to spaces and drop punctuation, so that
 * "ping-pong", "ping pong" and "jerky/octagonal" all match the same terms.
 */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[-–—/]/g, ' ')
        .replace(/[^a-z0-9' ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const termPatterns = new Map<string, RegExp>();

function termPattern(term: string): RegExp {
    let re = termPatterns.get(term);
    if (!re) {
        re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        termPatterns.set(term, re);
    }
    re.lastIndex = 0;
    return re;
}

/**
 * Words that flip the meaning of a term that follows them, so that
 * "No low-speed jerkiness" and "no more weaving" read as credits rather than
 * as the defects they name.
 */
const NEGATORS = new Set([
    'no', 'not', 'never', 'without', 'none', 'zero', 'lack', 'lacks', 'free',
    'minimal', 'less', 'fewer', 'avoids', 'avoid', 'eliminates', 'eliminated',
    'removes', 'removed', 'resolves', 'resolved', 'solves', 'solved', 'fixes',
    'fixed', 'reduces', 'reduced', 'cures', 'stops',
]);

/** How many words back from a term we look for a negator. */
const NEGATION_WINDOW = 4;

/**
 * The catalogue qualifies most of its claims, and the qualifier changes what
 * the claim is worth: "minor centering oscillations on curvy roads" and
 * "extreme line-to-line ping-ponging above 50mph" are not the same finding.
 */
const HEDGES = /\b(?:minor|slight|slightly|occasional|occasionally|somewhat|sometimes|may|might|can feel|can still|for some|on some|a bit|lingering|marginal|mild|random|potential|reported)\b/;
const INTENSIFIERS = /\b(?:extreme|extremely|severe|severely|significant|significantly|dramatic|dramatically|pronounced|consistent|consistently|frequently|constantly|unanimously|overwhelmingly|major|highly|very|super|completely|terrible|horrible|excellent|outstanding|phenomenal|exceptional|best)\b/;

/** Weight multiplier for a claim, from how strongly it is stated. */
function intensity(text: string): number {
    let multiplier = 1;
    if (HEDGES.test(text)) multiplier *= 0.6;
    if (INTENSIFIERS.test(text)) multiplier *= 1.35;
    return multiplier;
}

type TermHit = 'none' | 'plain' | 'negated';

/** Finds `term` in already-normalised `text` and reports whether it is negated. */
function findTerm(text: string, term: string): TermHit {
    const re = termPattern(term);
    let match: RegExpExecArray | null;
    let sawPlain = false;
    while ((match = re.exec(text)) !== null) {
        const before = text.slice(0, match.index).split(' ').filter(Boolean);
        const window = before.slice(-NEGATION_WINDOW);
        if (window.some((word) => NEGATORS.has(word))) return 'negated';
        sawPlain = true;
    }
    return sawPlain ? 'plain' : 'none';
}

// ── Lexicons ─────────────────────────────────────────────────────────────────
// Terms are drawn from the feedback actually present in the catalogue. Weights
// are magnitudes: VIRTUES add, DEFECTS subtract.

const VIRTUES: Array<[string[], AxisDelta]> = [
    // Lateral
    [['on rails'], { lat: 12, stability: 6, turns: 4 }],
    [['lateral control', 'lateral holding', 'best lat', 'confident lateral'], { lat: 9 }],
    [['lane centering', 'centering', 'highway centering'], { lat: 9, stability: 4 }],
    [['self correction', 'self correcting', 'self corrects'], { lat: 8, stability: 5 }],
    [['recentering', 'lateral unwind'], { lat: 7 }],
    [['lateral dampening', 'damper steering'], { lat: 8, comfort: 5 }],
    [['lane keeping', 'lane commitment', 'holds the lane', 'maintain lane'], { lat: 7 }],
    [['hugs center', 'hugs center lane'], { lat: 8, stability: 5 }],
    [['good lane changes'], { lat: 6, urban: 4 }],
    // Highway stability
    [['rock solid', 'unshakeable'], { stability: 12, lat: 6 }],
    [['stable', 'stability'], { stability: 9, lat: 4 }],
    [['predictable', 'consistent'], { stability: 7 }],
    [['reliable', 'reliability'], { stability: 8, lat: 3 }],
    [['boring', 'benchmark', 'neutral baseline'], { stability: 6 }],
    [['speed matching'], { stability: 7, long: 6 }],
    [['seamless highway transitions', 'highway transitions', 'merges'], { stability: 7, urban: 3 }],
    // Curves and turning
    [['curve handling', 'cornering', 'turn handling', 'better cornering'], { turns: 10 }],
    [['curves', 'winding', 'switchbacks'], { turns: 6 }],
    [['90 degree turn', 'sharp turns', 'tight curves'], { turns: 8 }],
    [['wider turns', 'away from curbs'], { turns: 5, comfort: 4 }],
    [['slows for curves', 'curve speed'], { turns: 7, long: 4 }],
    // Longitudinal
    [['smooth stops', 'consistent braking', 'smooth braking', 'braking transitions'], { long: 10, comfort: 6 }],
    [['longitudinal', 'longitudinal control'], { long: 8 }],
    [['braking'], { long: 6 }],
    [['acceleration', 'accelerates'], { long: 6 }],
    [['follow distance', 'lead gap', 'following distance'], { long: 5 }],
    [['reaches cruise speed', 'set speeds'], { long: 6 }],
    [['dec level acceleration', 'quick acceleration'], { long: 8 }],
    [['regenerative braking', 'regen'], { long: 5, comfort: 4 }],
    [['stabilizes speed'], { long: 7, stability: 5 }],
    // Urban
    [['stop sign', 'stop signs'], { urban: 8 }],
    [['traffic light', 'red lights', 'stays stopped'], { urban: 8 }],
    [['intersection', 'intersections'], { urban: 8 }],
    [['urban', 'city'], { urban: 8 }],
    [['stop and go'], { urban: 6, long: 5 }],
    [['pedestrian', 'pedestrians', 'road edges'], { urban: 6 }],
    [['e2e', 'end to end', '3d scene understanding'], { urban: 6, turns: 3 }],
    // Comfort
    [['comfort', 'comfortable', 'comfy'], { comfort: 11 }],
    [['smooth', 'smoothness'], { comfort: 9, lat: 4 }],
    [['gentle', 'soft', 'softest'], { comfort: 9 }],
    [['wife approved', 'passenger', 'passengers'], { comfort: 11 }],
    [['natural', 'human like', 'relaxed'], { comfort: 8, lat: 3 }],
    [['butter'], { comfort: 8 }],
];

const DEFECTS: Array<[string[], AxisDelta]> = [
    // Lateral instability
    [['ping pong', 'pingpong', 'ping ponging'], { lat: 13, stability: 11, comfort: 10 }],
    [['oscillation', 'oscillations', 'oscillating'], { lat: 11, stability: 10, comfort: 11 }],
    [['wobble', 'wobbles'], { lat: 10, stability: 10, comfort: 7 }],
    [['weaving', 'weave', 'lane weaving'], { lat: 12, stability: 9 }],
    [['twitchy', 'jittery', 'nervous'], { lat: 12, stability: 10, comfort: 12 }],
    [['unstable'], { lat: 12, stability: 13, comfort: 8 }],
    [['loose', 'wiggly', 'wiggle'], { lat: 7, stability: 8 }],
    [['hugs left', 'left hugging', 'left lane hugging', 'hugs right', 'right hugging'], { lat: 11 }],
    [['crosses lines', 'outside the painted lane', 'drives outside', 'close to line markings'], { lat: 13, stability: 9 }],
    [['late corrections', 'late lane corrections', 'snaps', 'hard snaps'], { lat: 14, stability: 10, comfort: 12 }],
    [['struggles to maintain lane', 'poor low speed lane commitment'], { lat: 12, stability: 8 }],
    [['deadzone', 'steering deadzone'], { lat: 8 }],
    [['slow to straighten', 'slow wheel return', 'sluggish wheel return'], { lat: 9, turns: 8 }],
    // Turning
    [['understeer'], { turns: 11 }],
    [['oversteer', 'oversteering'], { turns: 12, comfort: 7 }],
    [['cuts corners', 'cut urban corners', 'inside line', 'too tight', 'hugs turns tight'], { turns: 9, urban: 5, comfort: 5 }],
    [['lock out', 'locks out', 'locking out'], { turns: 13, lat: 7 }],
    [['poor turn in', 'overshoot', 'overshooting'], { turns: 11 }],
    [['octagonal', 'jerky curve'], { turns: 12, comfort: 9 }],
    // Longitudinal
    [['late braking'], { long: 13, comfort: 8 }],
    [['hard braking', 'brakes hard', 'abrupt'], { long: 11, comfort: 12 }],
    [['rubberbanding', 'yoyo', 'yo yo', 'surging', 'inconsistent gap'], { long: 13, comfort: 9 }],
    [['hesitant', 'hesitation', 'sluggish', 'sluggish launch'], { long: 11, urban: 5 }],
    [['drives too slow', 'slow to follow'], { long: 8 }],
    [['exaggerated follow distances'], { long: 8 }],
    // Urban
    [['creeps', 'creeping', 'creep'], { urban: 13, long: 6 }],
    [['afraid of green'], { urban: 13 }],
    [['fails to stay stopped', 'runs stop signs', 'ignores lights', 'bad at stop signs'], { urban: 15, long: 7 }],
    [['inconsistent city speed'], { urban: 9, long: 7 }],
    [['requires driver interventions', 'driver interventions', 'interventions'], { urban: 8, long: 8, stability: 5 }],
    // Comfort
    [['jerky', 'jerkiness', 'jerk'], { comfort: 12, long: 6, lat: 5 }],
    [['motion sickness'], { comfort: 15, lat: 6 }],
    [['harsh', 'rough', 'notchy'], { comfort: 10 }],
    [['stiff', 'stiffer'], { comfort: 9 }],
    [['robotic'], { comfort: 8 }],
    [['unforgiving', 'aggressive'], { comfort: 9 }],
    [['scary'], { comfort: 12, stability: 8 }],
];

// ── Curated field signals ────────────────────────────────────────────────────

const TAG_SIGNALS: Record<string, AxisDelta> = {
    Highway: { stability: 10, lat: 4, urban: -3 },
    City: { urban: 12, turns: 4, stability: -2 },
    Curves: { turns: 13, lat: 5 },
    Smooth: { comfort: 10, lat: 5, stability: 2 },
    Soft: { comfort: 11, lat: -2 },
    Comfort: { comfort: 12, long: 4 },
    Stiff: { stability: 9, lat: 7, turns: 2, comfort: -8 },
    Aggressive: { turns: 4, long: 5, comfort: -9 },
    'Aggressive Long': { long: 5, comfort: -7 },
    'Fast Long': { long: 5, comfort: -6 },
    Smart: { urban: 10, long: 6, turns: 3 },
    Stable: { stability: 10, lat: 6, comfort: 3 },
    'Stable Benchmark': { stability: 12, lat: 7, comfort: 3 },
    Reliable: { stability: 8, lat: 4 },
    Simple: { stability: 5, urban: -4 },
    Twitchy: { lat: -13, stability: -12, comfort: -13 },
    Unstable: { lat: -14, stability: -14, comfort: -10 },
    Horrible: { lat: -16, stability: -16, turns: -16, long: -16, urban: -16, comfort: -16 },
    'Self-Correcting': { lat: 8, stability: 4 },
    'Right-Hugging(C4)': { lat: -8 },
    Eco: { long: 5, comfort: 5 },
    Rain: { lat: 5, stability: 4 },
    Vision: { lat: 5, stability: 4, urban: 3 },
    Trucks: { stability: 5, comfort: -3 },
    Legendary: { stability: 6, lat: 4 },
    // Pre-E2E generations predate scene understanding, so urban is where they lag.
    Legacy: { urban: -12, stability: 5 },
    Deprecated: { urban: -14, stability: -4 },
    Predecessor: { urban: -8 },
    Classic: { urban: -8, stability: 4 },
    Original: { urban: -6 },
    Early: { urban: -8, stability: -3 },
    'Off-Policy': { comfort: -5 },
    PlanPlus: { lat: 4 },
    Experimental: { comfort: -5, stability: -3 },
    Dev: { comfort: -6, stability: -5 },
    Meme: { comfort: -5, stability: -5 },
};

const FEEL_SIGNALS: Record<string, AxisDelta> = {
    'Ultra-Smooth': { comfort: 12, lat: 7, stability: 3 },
    Smooth: { comfort: 9, lat: 5 },
    Light: { comfort: 8, lat: -4, stability: -3 },
    Soft: { comfort: 9, lat: -3 },
    Natural: { comfort: 9, lat: 5 },
    Balanced: { comfort: 2, stability: 2 },
    Confident: { lat: 8, stability: 6, turns: 5 },
    Solid: { stability: 8, lat: 6 },
    Stiff: { lat: 8, stability: 8, comfort: -8 },
    Heavy: { stability: 7, lat: 5, turns: -4, comfort: -6 },
    Twitchy: { lat: -14, stability: -12, comfort: -14 },
};

const BEST_FOR_SIGNALS: Record<string, AxisDelta> = {
    Highway: { stability: 8 },
    'Towing & Highway': { stability: 8, comfort: -3 },
    'Highway (with supervision)': { stability: 4 },
    'Highway Centering / Testing': { stability: 6, lat: 6 },
    'City Driving': { urban: 10 },
    'Curvy Roads': { turns: 10 },
    'Highway & Winding Roads': { turns: 9, stability: 5 },
    'Highway Curves / Urban Driving': { turns: 8, urban: 7 },
    Comfort: { comfort: 10 },
    'Comfort / Highway': { comfort: 8, stability: 5 },
    'Comfort / Stop-and-Go': { comfort: 9, long: 6 },
    'All-Around / Comfort': { comfort: 8 },
    Passengers: { comfort: 11 },
    'Relaxed Driving': { comfort: 10 },
    'Natural Feel': { comfort: 9 },
    'Heavy Traffic': { long: 8, urban: 6 },
    'Aggressive Driving': { turns: 5, long: 5, comfort: -8 },
    'Sporty Driving': { turns: 7, comfort: -7 },
    Reliability: { stability: 8 },
    'Bad Weather': { lat: 6, stability: 4 },
    'Road Trips': { stability: 6, comfort: 6 },
    'Hybrids/EVs': { long: 5, comfort: 4 },
    Fun: { comfort: -4, stability: -4 },
};

const BADGE_SIGNALS: Record<string, AxisDelta> = {
    LEGENDARY: { stability: 5, lat: 3 },
    STABLE: { stability: 6 },
    FLAGSHIP: { urban: 5, turns: 3 },
    'COMMUNITY CHOICE': { comfort: 3, lat: 3 },
    POPULAR: { stability: 2, lat: 2 },
    'HIDDEN GEM': { stability: 2 },
};

const CATEGORY_SIGNALS: Record<string, AxisDelta> = {
    // Pre-E2E generation: strong lane holders, no scene understanding.
    legacy: { urban: -10, stability: 5 },
    comfort: { comfort: 8 },
    aggressive_exp: { comfort: -6 },
    opm: { comfort: -4 },
    // 2026 world models are the E2E generation, where urban capability lives.
    world_2026: { urban: 6 },
};

/** Fields that report behaviour as unsettled, so evidence is trusted less. */
const VOLATILE_TAGS = ['Mixed Sentiment', 'Vehicle-Dependent', 'Unstable', 'Dev', 'Early Feedback'];
const VOLATILE_FEELS = ['Varies', 'Volatile (Varies by Drop)', 'TBD'];
const IMMATURE_BADGES = ['DEV', 'EXPERIMENTAL'];

// ── Canonical source lookup ──────────────────────────────────────────────────

interface CanonicalRecord extends RatableModel {
    categoryId: string;
}

const canonicalByName: Map<string, CanonicalRecord> = (() => {
    const map = new Map<string, CanonicalRecord>();
    for (const category of modelsEn.categories) {
        for (const model of category.models) {
            const record = model as unknown as RatableModel;
            if (!map.has(record.name)) {
                map.set(record.name, { ...record, categoryId: category.id });
            }
        }
    }
    return map;
})();

// ── Scoring ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Diminishing returns: keeps a pile of small signals from running away. */
function softCap(value: number, cap: number): number {
    return cap * Math.tanh(value / cap);
}

/**
 * Quality estimate on a 0-100 scale: the share of opinionated feedback that is
 * positive, shrunk toward the corpus mean by how many opinionated votes exist.
 * The neutral "ok" bucket is deliberately excluded — see the module header.
 */
function computePolarity(model: RatableModel): { polarity: number; opinionated: number } {
    const sentiment = model.sentiment;
    const votes = model.totalVotes ?? 0;

    if (!sentiment) {
        // No breakdown available: fall back to the displayed score, rescaled onto
        // the polarity distribution, with minimal sample weight.
        const score = model.communityScore ?? CORPUS_SCORE_MEAN;
        const rescaled = CORPUS_POLARITY_MEAN + (score - CORPUS_SCORE_MEAN) * (CORPUS_POLARITY_SD / CORPUS_SCORE_SD);
        const shrunk = (rescaled + CORPUS_POLARITY_MEAN * PRIOR_STRENGTH) / (1 + PRIOR_STRENGTH);
        return { polarity: clamp(shrunk, 0, 100), opinionated: 0 };
    }

    const opinionatedPct = sentiment.great + sentiment.good + sentiment.bad;
    const opinionated = (votes * opinionatedPct) / 100;

    const raw = opinionatedPct > 0
        ? (100 * (sentiment.great + 0.75 * sentiment.good)) / opinionatedPct
        : CORPUS_POLARITY_MEAN;

    // Blend in the displayed communityScore so the bars stay coherent with the
    // headline percentage on the same card, including the handful of records
    // whose score was set by hand rather than by the sentiment sync.
    const scoreAsPolarity = model.communityScore !== undefined
        ? CORPUS_POLARITY_MEAN + (model.communityScore - CORPUS_SCORE_MEAN) * (CORPUS_POLARITY_SD / CORPUS_SCORE_SD)
        : raw;
    const blended = 0.75 * raw + 0.25 * scoreAsPolarity;

    // Shrink toward the prior by sample size.
    const shrunk = (opinionated * blended + PRIOR_STRENGTH * CORPUS_POLARITY_MEAN) / (opinionated + PRIOR_STRENGTH);

    return { polarity: clamp(shrunk, 0, 100), opinionated };
}

/**
 * How much of the evidence to apply. Well-sampled models with explicit
 * pros/cons get the full weight; models flagged as vehicle-dependent or
 * volatile, or with almost no votes, keep their bars near the anchor.
 */
function computeConfidence(model: RatableModel, opinionated: number): number {
    const tags = model.tags ?? [];
    const sample = opinionated / (opinionated + 10);
    let confidence = 0.55 + 0.45 * sample;

    if (model.positives?.length || model.negatives?.length) confidence += 0.1;
    if (tags.some((tag) => VOLATILE_TAGS.includes(tag))) confidence *= 0.75;
    if (VOLATILE_FEELS.includes(model.steeringFeel ?? '')) confidence *= 0.7;
    if (IMMATURE_BADGES.includes(model.badge ?? '')) confidence *= 0.9;

    return clamp(confidence, 0.35, 1);
}

interface Accumulator {
    add(axis: SkillAxis, delta: number, source: string): void;
}

function makeAccumulator(
    sums: Record<SkillAxis, number>,
    evidence: RatingEvidence[],
): Accumulator {
    return {
        add(axis, delta, source) {
            if (!delta) return;
            sums[axis] += delta;
            evidence.push({ source, axis, delta });
        },
    };
}

function applyDelta(acc: Accumulator, delta: AxisDelta, source: string, scale = 1): void {
    for (const axis of SKILL_AXES) {
        const value = delta[axis];
        if (value) acc.add(axis, value * scale, source);
    }
}

/**
 * Scans one text pool for lexicon terms.
 *
 * `polarity` says what the pool is allowed to express: a `positives` entry can
 * only credit, a `negatives` entry can only penalise, and prose clauses are
 * classified before they get here. Negated terms flip: "no ping-pong" in prose
 * is a credit, "not smooth" is a penalty.
 */
function scanText(
    acc: Accumulator,
    text: string,
    polarity: 'positive' | 'negative',
    weight: number,
    label: string,
): void {
    if (!text) return;

    weight *= intensity(text);

    for (const [terms, delta] of VIRTUES) {
        for (const term of terms) {
            const hit = findTerm(text, term);
            if (hit === 'none') continue;
            // A virtue only counts where the surrounding context is positive.
            // "not smooth" in a negative clause becomes a comfort penalty.
            if (hit === 'plain' && polarity === 'positive') {
                applyDelta(acc, delta, `${label}: ${term}`, weight);
            } else if (hit === 'negated' && polarity === 'negative') {
                applyDelta(acc, delta, `${label}: not ${term}`, -weight);
            }
            break;
        }
    }

    for (const [terms, delta] of DEFECTS) {
        for (const term of terms) {
            const hit = findTerm(text, term);
            if (hit === 'none') continue;
            if (hit === 'plain' && polarity === 'negative') {
                applyDelta(acc, delta, `${label}: ${term}`, -weight);
            } else if (hit === 'negated') {
                // "No low-speed jerkiness", "no more weaving" — the absence of a
                // known defect is a genuine credit, at reduced weight.
                applyDelta(acc, delta, `${label}: no ${term}`, weight * 0.6);
            }
            break;
        }
    }
}

const CONTRAST_MARKERS = /\b(?:however|but|though|although|while|whereas|except|downside|drawback|caveat)\b/;
const NEGATIVE_MARKERS = /\b(?:poor|bad|worst|worse|struggle|struggles|fails|failure|issue|issues|problem|problems|regression|drawback|downside|negative|polarizing|complaint|complaints|inconsistent|risk|risky|skip|avoid|not recommended|less refined|lacking|mediocre|sacrifices|persists|penalty|too)\b/;
const POSITIVE_MARKERS = /\b(?:excellent|outstanding|phenomenal|praised|best|great|improved|improvement|solid|love|loved|favorite|favourite|recommended|superior|refined|legendary|confident|impressive|strong|well balanced|highly)\b/;

/**
 * Splits prose into clauses and labels each one, so a sentence like
 * "smooth on highways, however it creeps at red lights" credits comfort and
 * penalises urban rather than doing one or the other to the whole sentence.
 */
function scanProse(acc: Accumulator, raw: string, weight: number, label: string): void {
    if (!raw) return;

    const sentences = raw.split(/[.;!?]+/);
    for (const sentence of sentences) {
        const parts = normalize(sentence)
            .split(/\b(?:however|but|though|although|whereas|except)\b/)
            .map((part) => part.trim())
            .filter(Boolean);

        const leadsNegative = CONTRAST_MARKERS.test(normalize(sentence));

        parts.forEach((part, index) => {
            // After a contrastive marker the clause is the counterpoint, so its
            // default reading flips.
            const contrasted = leadsNegative && index > 0;
            const negative = NEGATIVE_MARKERS.test(part);
            const positive = POSITIVE_MARKERS.test(part);

            let polarity: 'positive' | 'negative';
            if (negative && !positive) polarity = 'negative';
            else if (positive && !negative) polarity = 'positive';
            else polarity = contrasted ? 'negative' : 'positive';

            scanText(acc, part, polarity, weight, label);
        });
    }
}

/**
 * Six bar values for a model.
 *
 * Prefers explicit `skillRatings` when the catalogue provides them; otherwise
 * derives from the canonical English record for the model name so that the
 * bars do not change with the active locale.
 */
export function deriveSkillRatings(model: RatableModel): SkillRatings {
    return deriveSkillRatingsDetail(model).ratings;
}

/** Same derivation, with the anchor and per-axis evidence kept for tooltips. */
export function deriveSkillRatingsDetail(model: RatableModel): SkillRatingsDetail {
    const canonical = canonicalByName.get(model.name);
    const source: RatableModel = canonical ?? model;
    const categoryId = canonical?.categoryId;

    if (model.skillRatings) {
        return {
            ratings: model.skillRatings,
            anchor: NEUTRAL_BAR,
            polarity: CORPUS_POLARITY_MEAN,
            confidence: 1,
            evidence: [{ source: 'catalogue: explicit skillRatings', axis: 'lat', delta: 0 }],
        };
    }

    const { polarity, opinionated } = computePolarity(source);
    const confidence = computeConfidence(source, opinionated);
    const anchor = NEUTRAL_BAR + (polarity - CORPUS_POLARITY_MEAN) * POLARITY_TO_BAR;

    const evidence: RatingEvidence[] = [];
    const structured: Record<SkillAxis, number> = { lat: 0, stability: 0, turns: 0, long: 0, urban: 0, comfort: 0 };
    const structuredAcc = makeAccumulator(structured, evidence);

    for (const tag of source.tags ?? []) {
        const delta = TAG_SIGNALS[tag];
        if (delta) applyDelta(structuredAcc, delta, `tag: ${tag}`);
    }
    const feelDelta = FEEL_SIGNALS[source.steeringFeel ?? ''];
    if (feelDelta) applyDelta(structuredAcc, feelDelta, `feel: ${source.steeringFeel}`);

    const bestForDelta = BEST_FOR_SIGNALS[source.bestFor ?? ''];
    if (bestForDelta) applyDelta(structuredAcc, bestForDelta, `best for: ${source.bestFor}`);

    const badgeDelta = BADGE_SIGNALS[source.badge ?? ''];
    if (badgeDelta) applyDelta(structuredAcc, badgeDelta, `badge: ${source.badge}`);

    const categoryDelta = categoryId ? CATEGORY_SIGNALS[categoryId] : undefined;
    if (categoryDelta) applyDelta(structuredAcc, categoryDelta, `category: ${categoryId}`);

    // Prose is scanned into its own pools so that curated pros/cons, which are
    // the most reliable statements available, outweigh narrative summary text.
    const phrasePos: Record<SkillAxis, number> = { lat: 0, stability: 0, turns: 0, long: 0, urban: 0, comfort: 0 };
    const phraseNeg: Record<SkillAxis, number> = { lat: 0, stability: 0, turns: 0, long: 0, urban: 0, comfort: 0 };
    const phraseEvidence: RatingEvidence[] = [];
    const phraseAcc: Accumulator = {
        add(axis, delta, src) {
            if (!delta) return;
            if (delta > 0) phrasePos[axis] += delta;
            else phraseNeg[axis] += -delta;
            phraseEvidence.push({ source: src, axis, delta });
        },
    };

    for (const entry of source.positives ?? []) {
        scanText(phraseAcc, normalize(entry), 'positive', 1, 'pro');
    }
    for (const entry of source.negatives ?? []) {
        scanText(phraseAcc, normalize(entry), 'negative', 1, 'con');
    }
    scanProse(phraseAcc, source.consensus ?? '', 0.75, 'consensus');
    scanProse(phraseAcc, source.note ?? '', 0.55, 'note');

    evidence.push(...phraseEvidence);

    const ratings = {} as SkillRatings;
    for (const axis of SKILL_AXES) {
        // Each channel is capped on its own, so a long pro list cannot bury a
        // single severe defect and vice versa.
        const structuredPart = softCap(Math.abs(structured[axis]), STRUCTURED_CAP) * Math.sign(structured[axis]);
        const positivePart = softCap(phrasePos[axis], PHRASE_CAP);
        const negativePart = softCap(phraseNeg[axis], PHRASE_CAP);
        const total = (structuredPart + positivePart - negativePart) * confidence;
        ratings[axis] = Math.round(clamp(anchor + total, MIN_RATING, MAX_RATING));
    }

    return { ratings, anchor, polarity, confidence, evidence };
}

/** Top evidence for one axis, phrased for a bar tooltip. */
export function describeAxisEvidence(detail: SkillRatingsDetail, axis: SkillAxis, limit = 4): string {
    const items = detail.evidence
        .filter((item) => item.axis === axis && item.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, limit)
        .map((item) => `${item.delta > 0 ? '+' : '−'} ${item.source}`);

    const header = `Community polarity ${Math.round(detail.polarity)}/100`;
    return items.length ? `${header}\n${items.join('\n')}` : header;
}
