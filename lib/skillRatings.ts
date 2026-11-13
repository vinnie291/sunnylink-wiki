/**
 * Skill ratings — the six bars rendered on model cards when sufficient
 * behavioral evidence exists.
 *
 * The catalogue never ships hand-authored per-axis numbers, so these bars are
 * derived. The goal of this module is that every bar is traceable to something
 * actually recorded about the model, that a bar is only as confident as the
 * evidence behind it, and that bars are hidden when there is not enough
 * axis-specific behavioral data instead of falling back to random ~60/99 bars.
 *
 * Three layers, in order:
 *
 *   1. ANCHOR — a quality estimate from the community vote breakdown. This sets
 *      the baseline before axis-specific evidence.
 *   2. EVIDENCE — per-axis adjustments from behavioral curated fields (tags,
 *      steering feel, "best for"), Discourse trait polls, and feedback prose.
 *   3. SUFFICIENCY & CONFIDENCE — only axes backed by specific behavioral
 *      evidence are included in `ratedAxes`, and models without sufficient
 *      multi-axis behavioral evidence set `hasSufficientEvidence = false` so
 *      UI components can hide the bars instead of rendering placeholder ~63s.
 *
 * Design notes worth keeping in mind when editing:
 *
 * - `communityScore` is NOT used as the primary anchor. scripts/analyze_discord_sentiment.ts
 *   computes it as great*1.0 + good*0.75 + ok*0.5, and the "ok" bucket is that
 *   classifier's default for messages with no sentiment keywords. More messages
 *   scanned therefore means more neutral filler: across the catalogue, ok% rises
 *   with vote count (r = +0.52) and models with 150+ votes collapse to a
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
import discoursePolls from '../data/discourse_polls.json';
import englishLocale from '../locales/en.json';

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
    /** Axes backed by specific behavioral evidence on this model. */
    ratedAxes: SkillAxis[];
    /** Whether there is enough behavioral evidence to render skill bars. */
    hasSufficientEvidence: boolean;
}

// ── Corpus calibration ───────────────────────────────────────────────────────
// Measured over the 136 catalogued models in data/models.json. Re-run
// `npm run ratings:audit` after a sentiment sync to check these still hold.

/** Mean polarity among opinionated votes across the catalogue. */
const CORPUS_POLARITY_MEAN = 61.4;
const CORPUS_POLARITY_SD = 19.5;
/** Mean and spread of the displayed communityScore, used to rescale it. */
const CORPUS_SCORE_MEAN = 55.9;
const CORPUS_SCORE_SD = 13.9;

/**
 * Opinionated votes a model needs before its own polarity outweighs the corpus
 * prior. The median model has ~21, so a handful of votes still moves the bars
 * but cannot pin them to an extreme on its own.
 */
const PRIOR_STRENGTH = 6;

/** Where a corpus-average model sits on the 0-99 bar scale. */
const NEUTRAL_BAR = 63;
/** Bar points per point of polarity above/below the corpus mean. */
const POLARITY_TO_BAR = 0.65;

const MIN_RATING = 35;
const MAX_RATING = 98;

/** Ceiling on combined positive signals per axis. */
const POS_CAP = 26;
/** Ceiling on combined negative signals per axis. */
const NEG_CAP = 28;

const translatedSources = new Set<string>(Object.values(englishLocale));

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
 * "No low-speed jerkiness", "resolves ... oscillations", and "non-robotic"
 * read as credits rather than as the defects they name.
 */
const NEGATORS = new Set([
    'no', 'not', 'never', 'without', 'none', 'zero', 'lack', 'lacks', 'lacking', 'free',
    'minimal', 'less', 'fewer', 'avoids', 'avoid', 'eliminates', 'eliminated',
    'removes', 'removed', 'resolves', 'resolved', 'solves', 'solved', 'fixes',
    'fixed', 'reduces', 'reduced', 'cures', 'cured', 'stops', 'non', 'rarely',
    'hardly', 'barely', "doesn't", "don't", "isn't", "aren't", "wasn't", "weren't",
    "can't", 'cannot', "won't", "didn't", "hasn't", "haven't", 'unable', 'inability',
    'trading', 'lubricated', 'instead',
]);

/** How many words back from a term we look for a negator. */
const NEGATION_WINDOW = 8;

/**
 * The catalogue qualifies most of its claims, and the qualifier changes what
 * the claim is worth: "minor centering oscillations on curvy roads" and
 * "extreme line-to-line ping-ponging above 50mph" are not the same finding.
 */
const HEDGES = /\b(?:minor|slight|slightly|occasional|occasionally|somewhat|sometimes|may|might|can feel|can still|for some|on some|a bit|lingering|marginal|mild|random|potential|reported|select|specific|little|small|relatively)\b/;
const INTENSIFIERS = /\b(?:extreme|extremely|severe|severely|significant|significantly|dramatic|dramatically|pronounced|consistent|consistently|frequently|constantly|unanimously|overwhelmingly|major|highly|very|super|completely|terrible|horrible|excellent|outstanding|phenomenal|exceptional|best|every|tops)\b/;

/** Weight multiplier for a claim, from how strongly it is stated. */
function intensity(text: string): number {
    let multiplier = 1;
    if (HEDGES.test(text)) multiplier *= 0.65;
    if (INTENSIFIERS.test(text)) multiplier *= 1.3;
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
    [['on rails', 'locked in', 'planted', 'locks it down', 'firm on center', 'on center feel'], { lat: 12, stability: 6, turns: 4 }],
    [['lateral control', 'lateral holding', 'best lat', 'confident lateral', 'outstanding lateral', 'better lateral', '11 10 lateral', 'leap forward in lateral', 'favorite for lateral', 'works well with nnlc', 'nnlc', 'lateral is praised', 'lateral is the strength'], { lat: 10 }],
    [['lane centering', 'centering', 'highway centering', 'centered in lane', 'stays centered', 'well centered', 'away from centre'], { lat: 9, stability: 4 }],
    [['self correction', 'self correcting', 'self corrects', 'fluid steering', 'active steering engagement'], { lat: 8, stability: 5 }],
    [['recentering', 'lateral unwind'], { lat: 7 }],
    [['lateral dampening', 'damper steering', 'smoother damping', 'filtered feel'], { lat: 8, comfort: 5 }],
    [['lane keeping', 'lane commitment', 'holds the lane', 'maintain lane', 'lanekeeping', 'road markings'], { lat: 8, stability: 3 }],
    [['hugs center', 'hugs center lane'], { lat: 9, stability: 5 }],
    [['good lane changes', 'lane changes'], { lat: 6, urban: 4 }],
    // Highway stability
    [['rock solid', 'unshakeable'], { stability: 12, lat: 6 }],
    [['stable', 'stability', 'straightaways'], { stability: 9, lat: 4 }],
    [['predictable', 'consistent', 'predictive behavior'], { stability: 7 }],
    [['reliable', 'reliability', 'dependable', 'built to last', 'regression free'], { stability: 8, lat: 3 }],
    [['boring', 'benchmark', 'neutral baseline'], { stability: 6, lat: 3 }],
    [['speed matching', 'holds speed'], { stability: 7, long: 6 }],
    [['seamless highway transitions', 'highway transitions', 'merges', 'cut ins', 'cut in'], { stability: 7, long: 5, urban: 3 }],
    // Curves and turning
    [['curve handling', 'cornering', 'turn handling', 'better cornering', 'turn in', 'confident steering torque', 'requested torque', 'torquey through turns', 'torque management', 'path planning'], { turns: 10, lat: 3 }],
    [['curves', 'winding', 'switchbacks', 'windy mountain roads', 'country roads', 'aggressive bends'], { turns: 7 }],
    [['90 degree turn', 'sharp turns', 'tight curves', '90 degree plus turns', 'right and left turns', 'left and right turns', 'mid speed turns'], { turns: 8, urban: 3 }],
    [['wider turns', 'away from curbs', 'appropriately wide'], { turns: 6, comfort: 4, urban: 3 }],
    [['slows for curves', 'curve speed'], { turns: 7, long: 4 }],
    // Longitudinal
    [['smooth stops', 'consistent braking', 'smooth braking', 'braking transitions', 'stopping comfortably', 'stops smoothly', 'decelerating'], { long: 10, comfort: 6 }],
    [['longitudinal', 'longitudinal control', 'better longitudinal', 'smooth highway longitudinal', 'smooth longitudinal', 'scc v'], { long: 8 }],
    [['braking', 'improved stopping'], { long: 6 }],
    [['acceleration', 'accelerates', 'back on the gas'], { long: 6 }],
    [['follow distance', 'lead gap', 'following distance', 'lead car following'], { long: 6 }],
    [['reaches cruise speed', 'set speeds'], { long: 6 }],
    [['dec level acceleration', 'quick acceleration'], { long: 8 }],
    [['regenerative braking', 'regen'], { long: 5, comfort: 4 }],
    [['stabilizes speed'], { long: 7, stability: 5 }],
    // Urban
    [['stop sign', 'stop signs', 'willing to stop at stop signs', 'recognises stop signs'], { urban: 8, long: 3 }],
    [['traffic light', 'red lights', 'stays stopped', 'light detection', 'yellow lights', 'turns green'], { urban: 8, long: 3 }],
    [['intersection', 'intersections', '4 way stop'], { urban: 8, turns: 3 }],
    [['urban', 'city', 'in town', 'pedestrian', 'pedestrians', 'road edges', 'construction barrels', 'object detection'], { urban: 8 }],
    [['stop and go'], { urban: 7, long: 5 }],
    [['e2e', 'end to end', '3d scene understanding'], { urban: 6, turns: 3 }],
    // Comfort
    [['comfort', 'comfortable', 'comfy'], { comfort: 11 }],
    [['smooth', 'smoothness'], { comfort: 9, lat: 4 }],
    [['gentle', 'soft', 'softest'], { comfort: 9 }],
    [['wife approved', 'passenger', 'passengers', 'passenger focused'], { comfort: 11 }],
    [['natural', 'human like', 'relaxed', 'humanlike'], { comfort: 8, lat: 3 }],
    [['butter'], { comfort: 9, lat: 3 }],
];

// Bare topic nouns in VIRTUES that require explicit positive context when matched in prose (consensus/note).
const PROSE_CONTEXT_REQUIRED_TERMS = new Set([
    'longitudinal', 'longitudinal control', 'braking', 'acceleration', 'accelerates',
    'curves', 'winding', 'switchbacks', '90 degree turn', 'sharp turns', 'tight curves',
    'stop sign', 'stop signs', 'traffic light', 'red lights', 'intersection', 'intersections',
    'urban', 'city', 'consistent', 'lane changes', 'road markings', 'pedestrian', 'pedestrians',
]);

// Only adjectives in VIRTUES can be negated as "not <term>".
const NEGATABLE_VIRTUES = new Set(['comfort', 'urban', 'smooth', 'stable']);

const DEFECTS: Array<[string[], AxisDelta]> = [
    // Lateral instability
    [['ping pong', 'pingpong', 'ping ponging', 'ping pongs'], { lat: 14, stability: 12, comfort: 10 }],
    [['oscillation', 'oscillations', 'oscillating', 'see saw'], { lat: 12, stability: 11, comfort: 11 }],
    [['wobble', 'wobbles', 'wander', 'wanders', 'wandering'], { lat: 11, stability: 11, comfort: 7 }],
    [['weaving', 'weave', 'lane weaving'], { lat: 13, stability: 10 }],
    [['twitchy', 'jittery', 'nervous', 'controller sensitivity'], { lat: 13, stability: 11, comfort: 12 }],
    [['unstable', 'big model error', 'scary'], { lat: 13, stability: 14, comfort: 10 }],
    [['loose', 'wiggly', 'wiggle', 'floaty'], { lat: 9, stability: 9 }],
    [['hugs left', 'left hugging', 'left lane hugging', 'hugs right', 'right hugging', 'lane hugging', 'riding the left', 'riding the right', 'left lane line'], { lat: 13, stability: 4 }],
    [['crosses lines', 'outside the painted lane', 'drives outside', 'close to line markings', 'close approaches to lane lines', 'wandering close to the lane line'], { lat: 14, stability: 10 }],
    [['late corrections', 'late lane corrections', 'snaps', 'hard snaps', 'larger steering corrections'], { lat: 14, stability: 10, comfort: 12 }],
    [['struggles to maintain lane', 'poor low speed lane commitment', 'requires fine tuning'], { lat: 13, stability: 8, urban: 6 }],
    [['deadzone', 'steering deadzone'], { lat: 9 }],
    [['slow to straighten', 'slow wheel return', 'sluggish wheel return'], { lat: 10, turns: 9 }],
    // Turning
    [['understeer', 'understeers', 'gives up halfway', 'gives up in the second half', 'gives up on sharp', 'gives up mid turn'], { turns: 14, lat: 5, urban: 5 }],
    [['oversteer', 'oversteering', 'over steers'], { turns: 13, comfort: 7 }],
    [['cuts corners', 'cut urban corners', 'cut corners', 'inside line', 'too tight', 'hugs turns tight', 'less aggressive on sharp urban turns'], { turns: 12, urban: 7, comfort: 5 }],
    [['lock out', 'locks out', 'locking out'], { turns: 14, lat: 8 }],
    [['poor turn in', 'overshoot', 'overshooting', 'sloppy on sharper curves', 'weak turning', 'weak cornering', 'cornering problems', 'hesitates when turning', 'hesitation when turning'], { turns: 13, lat: 5, urban: 6 }],
    [['octagonal', 'jerky curve', 'torque limited turns'], { turns: 13, comfort: 9, lat: 5 }],
    // Longitudinal
    [['late braking', 'brakes somewhat late', 'hard or late braking', 'hard late braking'], { long: 14, stability: 6, comfort: 9 }],
    [['hard braking', 'brakes hard', 'abrupt', 'brake abruptly', 'abrupt deceleration'], { long: 12, comfort: 12 }],
    [['rubberbanding', 'yoyo', 'yo yo', 'surging', 'inconsistent gap', 'gas brake surging'], { long: 14, stability: 5, comfort: 9 }],
    [['hesitant', 'hesitation', 'sluggish', 'sluggish launch', 'slow acceleration', 'conservative acceleration'], { long: 12, urban: 6 }],
    [['drives too slow', 'slow to follow', 'bleeds speed', 'slows so early'], { long: 11, urban: 6, comfort: 5 }],
    [['exaggerated follow distances', 'speeds aggressively'], { long: 10, comfort: 5 }],
    // Urban
    [['creeps', 'creeping', 'creep'], { urban: 13, long: 6 }],
    [['afraid of green'], { urban: 13, long: 5 }],
    [['fails to stay stopped', 'runs stop signs', 'ignores lights', 'bad at stop signs', 'roll stop signs', 'rolling stops', 'california stop', 'california stops', 'misses some stop signs', 'cannot see stop signs', 'too fast to stop', 'inconsistent stopping', 'city stop', 'achilles heel', 'too far forward', 'overshoots the stop line'], { urban: 15, long: 7 }],
    [['inconsistent city speed', 'slows for cross roads', 'bad stop go traffic'], { urban: 11, long: 7 }],
    [['requires driver interventions', 'driver interventions', 'interventions', 'needed intervention', 'manual intervention', 'driver takeover', 'prompting disengagement', 'late reaction', 'caution needed', 'lane markings split'], { urban: 10, long: 8, stability: 6, lat: 8 }],
    // Comfort
    [['jerky', 'jerkiness', 'jerk'], { comfort: 13, long: 7, lat: 6 }],
    [['motion sickness', 'uncomfortable'], { comfort: 15, lat: 6 }],
    [['rough', 'harsh', 'notchy', 'robotic'], { comfort: 10 }],
    [['stiffer', 'stiff'], { comfort: 10 }],
    [['aggressive', 'unforgiving'], { comfort: 9 }],
];

// Descriptive defects that only fire in negative clauses or explicit `negatives`.
const CONTEXT_DEPENDENT_DEFECTS = new Set(['stiff', 'stiffer', 'aggressive', 'loose']);

// ── Curated field signals ────────────────────────────────────────────────────

const TAG_SIGNALS: Record<string, AxisDelta> = {
    Highway: { stability: 10, lat: 5 },
    City: { urban: 11, turns: 4 },
    Urban: { urban: 11, turns: 4 },
    Curves: { turns: 12, lat: 5 },
    Smooth: { comfort: 10, lat: 5, stability: 2 },
    'Smooth Long': { long: 9, comfort: 6 },
    Soft: { comfort: 11 },
    Comfort: { comfort: 12, long: 4 },
    Natural: { comfort: 8, lat: 5 },
    'Natural Steering': { lat: 8, comfort: 7 },
    Stiff: { stability: 9, lat: 7, turns: 2, comfort: -8 },
    Aggressive: { turns: 4, long: 5, comfort: -9 },
    'Aggressive Long': { long: 5, comfort: -7 },
    'Fast Long': { long: 6, comfort: -6 },
    Smart: { urban: 9, long: 6, turns: 3 },
    Stable: { stability: 10, lat: 6, comfort: 3 },
    'Stable Benchmark': { stability: 12, lat: 8, comfort: 3 },
    Reliable: { stability: 9, lat: 5 },
    Recommended: { stability: 5, lat: 4, comfort: 3 },
    Twitchy: { lat: -13, stability: -12, comfort: -13 },
    Oscillating: { lat: -13, stability: -11, comfort: -10 },
    Unstable: { lat: -14, stability: -14, comfort: -10 },
    Horrible: { lat: -16, stability: -16, turns: -16, long: -16, urban: -16, comfort: -16 },
    'Self-Correcting': { lat: 9, stability: 5 },
    'Right-Hugging(C4)': { lat: -9 },
    'Stop Line Tuning': { urban: 9, long: 5 },
    'Cut-in Handling': { long: 7, stability: 5 },
    'Torque-Assist': { turns: 7, lat: 4 },
    Longitudinal: { long: 7 },
    Eco: { long: 6, comfort: 5 },
    Rain: { lat: 6, stability: 5 },
    'Bad Weather': { lat: 6, stability: 5 },
    Vision: { lat: 5, stability: 4, urban: 3 },
    Trucks: { stability: 6, lat: 4, comfort: -3 },
};

const FEEL_SIGNALS: Record<string, AxisDelta> = {
    'Ultra-Smooth': { comfort: 12, lat: 7, stability: 3 },
    Smooth: { comfort: 9, lat: 5, stability: 2 },
    Light: { comfort: 8, turns: 3 },
    Soft: { comfort: 9 },
    Natural: { comfort: 9, lat: 5, turns: 2 },
    Confident: { lat: 8, stability: 6, turns: 5 },
    Solid: { stability: 8, lat: 6 },
    'Solid / On Rails': { lat: 12, stability: 10, turns: 5 },
    Firm: { lat: 7, stability: 7, turns: 3, comfort: -4 },
    Assertive: { turns: 6, lat: 5, long: 4, comfort: -5 },
    Stiff: { lat: 8, stability: 8, comfort: -8 },
    Heavy: { stability: 7, lat: 5, turns: -4, comfort: -6 },
    Twitchy: { lat: -14, stability: -12, comfort: -14 },
    Oscillating: { lat: -13, stability: -11, comfort: -10 },
    'Ping-pongs above ~120 km/h': { lat: -12, stability: -11, comfort: -8 },
};

const BEST_FOR_SIGNALS: Record<string, AxisDelta> = {
    Highway: { stability: 8, lat: 4 },
    'Highway / Cruising': { stability: 8, lat: 4, comfort: 4 },
    'Highway Commutes': { stability: 8, lat: 4, comfort: 4 },
    'Highway Cruising / Cut-in Handling': { stability: 8, long: 7, lat: 4 },
    'Towing & Highway': { stability: 9, lat: 4, comfort: -3 },
    'Highway (with supervision)': { stability: 4 },
    'Highway Centering / Testing': { stability: 6, lat: 7 },
    'City Driving': { urban: 9, turns: 3 },
    'Stop-and-Go / City Driving': { urban: 9, long: 7, comfort: 4 },
    'Urban / Mixed Driving': { urban: 8, turns: 3, long: 4 },
    'Highway / Stop & Go': { stability: 6, long: 7, urban: 5 },
    'Experimental Mode / Daily Driving / Lateral Stability': { lat: 8, stability: 7, urban: 5, long: 4 },
    'Curvy Roads': { turns: 10, lat: 4 },
    'Curved Roads / Assisted Cornering': { turns: 10, lat: 5 },
    'Curves & Experimentation': { turns: 8, lat: 4 },
    'Highway & Winding Roads': { turns: 9, stability: 6, lat: 4 },
    'Highway Curves / Urban Driving': { turns: 8, urban: 7, lat: 4 },
    Comfort: { comfort: 10, long: 3 },
    'Comfort / Highway': { comfort: 8, stability: 6, lat: 3 },
    'Comfort / Stop-and-Go': { comfort: 9, long: 7, urban: 4 },
    'All-Around / Comfort': { comfort: 8, stability: 4, lat: 3 },
    'Natural Steering Feel / Gentle Long Cruising': { comfort: 9, lat: 5, long: 5, stability: 4 },
    'Natural Human-Like Driving': { comfort: 9, lat: 5, long: 4 },
    Passengers: { comfort: 11, long: 3 },
    'Relaxed Driving': { comfort: 10, stability: 3 },
    'Natural Feel': { comfort: 9, lat: 4 },
    'Heavy Traffic': { long: 8, urban: 7 },
    'Aggressive Driving': { turns: 5, long: 5, comfort: -8 },
    'Sporty Driving': { turns: 7, lat: 3, comfort: -7 },
    Reliability: { stability: 9, lat: 4 },
    'Bad Weather': { lat: 7, stability: 5 },
    'Road Trips': { stability: 7, comfort: 7, lat: 3 },
    'Hybrids/EVs': { long: 6, comfort: 5 },
    Fun: { comfort: -4, stability: -4 },
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

interface DiscoursePollOption {
    id: string;
    html: string;
    votes: number;
}

interface DiscoursePoll {
    name: string;
    type: string;
    voters: number;
    title: string;
    options: DiscoursePollOption[];
}

interface DiscoursePollRecord {
    topicId: string;
    title: string;
    polls: DiscoursePoll[];
}

const pollsByModel = discoursePolls as unknown as Record<string, DiscoursePollRecord>;

// ── Scoring ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Diminishing returns: keeps a pile of small signals from running away. */
function softCap(value: number, cap: number): number {
    return cap * Math.tanh(value / cap);
}

/**
 * Resolves a matched term to a localized evidence label present in `locales/*.json`.
 */
function pickSource(label: string, prefix: string, matchedTerm: string, terms: string[]): string {
    const candidate = `${label}: ${prefix}${matchedTerm}`;
    if (translatedSources.has(candidate)) return candidate;
    for (const t of terms) {
        const alt = `${label}: ${prefix}${t}`;
        if (translatedSources.has(alt)) return alt;
    }
    const fallbackLabels = label === 'pro' ? ['pro', 'consensus', 'note']
        : label === 'con' ? ['con', 'consensus', 'note']
        : ['consensus', 'pro', 'con', 'note'];
    for (const fbLabel of fallbackLabels) {
        if (translatedSources.has(`${fbLabel}: ${prefix}${matchedTerm}`)) return `${fbLabel}: ${prefix}${matchedTerm}`;
        for (const t of terms) {
            if (translatedSources.has(`${fbLabel}: ${prefix}${t}`)) return `${fbLabel}: ${prefix}${t}`;
        }
    }
    return `${label}: ${prefix}${terms[0]}`;
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
 * volatile, or with almost no votes, scale down.
 */
function computeConfidence(model: RatableModel, opinionated: number): number {
    const tags = model.tags ?? [];
    const sample = opinionated / (opinionated + 8);
    let confidence = 0.6 + 0.4 * sample;

    if (model.positives?.length || model.negatives?.length) confidence += 0.1;
    if (tags.some((tag) => VOLATILE_TAGS.includes(tag))) confidence *= 0.8;
    if (VOLATILE_FEELS.includes(model.steeringFeel ?? '')) confidence *= 0.75;
    if (IMMATURE_BADGES.includes(model.badge ?? '')) confidence *= 0.9;

    return clamp(confidence, 0.45, 1);
}

interface Accumulator {
    add(axis: SkillAxis, delta: number, source: string, origin?: string): void;
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

function applyDelta(acc: Accumulator, delta: AxisDelta, source: string, scale = 1, origin?: string): void {
    for (const axis of SKILL_AXES) {
        const value = delta[axis];
        if (value) acc.add(axis, value * scale, source, origin);
    }
}

const CONTRAST_SPLIT = /\b(?:however|but|though|although|whereas|except|yet|offset by|aside from|at the cost of|at the expense of)\b/;
const LEADING_CONTRAST = /^(?:however|but|though|although|yet|still|unfortunately|downside|drawback|caveat)\b/;
const NEGATIVE_MARKERS = /\b(?:poor|bad|worst|worse|struggle|struggles|fails|failure|issue|issues|problem|problems|regression|drawback|downside|negative|polarizing|complaint|complaints|inconsistent|risk|risky|skip|avoid|not recommended|less refined|lacking|mediocre|sacrifices|persists|penalty|too|weak point|weakness|inability|unable|drifts|drift|riding the|step backward|step back|unsettled|erratic|floaty|wandering|wanders|overshoots|clunky|abruptly|premature|too close|uncomfortably|distrust|achilles heel|falls apart)\b/;
const POSITIVE_MARKERS = /\b(?:excellent|outstanding|phenomenal|praised|best|great|improved|improvement|solid|love|loved|favorite|favourite|recommended|superior|refined|legendary|confident|impressive|strong|well balanced|highly|good|smooth|clean|capable|natural|reliable|well|excels|accurate|precise|decisive|notably|pleasantly|comfortably|nicely|dependable)\b/;

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

    const scaledWeight = weight * intensity(text);
    const hasPositiveContext = label === 'pro' || POSITIVE_MARKERS.test(text);
    const hasNegativeMarker = NEGATIVE_MARKERS.test(text);

    for (const [terms, delta] of VIRTUES) {
        const needsContext = label !== 'pro' && terms.some((t) => PROSE_CONTEXT_REQUIRED_TERMS.has(t));
        const canNegate = terms.some((t) => NEGATABLE_VIRTUES.has(t));
        for (const term of terms) {
            const hit = findTerm(text, term);
            if (hit === 'none') continue;
            // A virtue only counts where the surrounding context is positive.
            // "not smooth" in a negative clause becomes a comfort penalty.
            if (hit === 'plain' && polarity === 'positive') {
                if (needsContext && (!hasPositiveContext || hasNegativeMarker)) break;
                const src = pickSource(label, '', term, terms);
                applyDelta(acc, delta, src, scaledWeight, label);
            } else if (hit === 'negated' && polarity === 'negative' && canNegate) {
                const src = pickSource(label, 'not ', term, terms);
                applyDelta(acc, delta, src, -scaledWeight, label);
            }
            break;
        }
    }

    for (const [terms, delta] of DEFECTS) {
        const isContextDependent = terms.some((t) => CONTEXT_DEPENDENT_DEFECTS.has(t));
        for (const term of terms) {
            const hit = findTerm(text, term);
            if (hit === 'none') continue;
            if (hit === 'plain' && (polarity === 'negative' || (label !== 'pro' && !isContextDependent))) {
                const src = pickSource(label, '', term, terms);
                applyDelta(acc, delta, src, -scaledWeight, label);
            } else if (hit === 'negated' && (polarity === 'positive' || label !== 'con')) {
                // "No low-speed jerkiness", "no more weaving" — the absence of a
                // known defect is a genuine credit, at reduced weight.
                const src = pickSource(label, 'no ', term, terms);
                if (translatedSources.has(src)) {
                    applyDelta(acc, delta, src, scaledWeight * 0.65, label);
                }
            }
            break;
        }
    }
}

/**
 * Splits prose into clauses and labels each one, so a sentence like
 * "smooth on highways, however it creeps at red lights" credits comfort and
 * penalises urban rather than doing one or the other to the whole sentence.
 */
function scanProse(acc: Accumulator, raw: string, weight: number, label: string): void {
    if (!raw) return;

    // Strip conditional comparisons to other models ("if V12 feels too jittery", "If WMI V12 feels too 'wiggly'")
    const cleaned = raw.replace(/\bif\s+(?:wmi\s+)?v\d+\s+feels\s+[^.,;!?]+/gi, '');
    const sentences = cleaned.split(/[.;!?]+/);
    for (const sentence of sentences) {
        const normSentence = normalize(sentence);
        if (!normSentence) continue;
        if (/\b(?:no driving feedback|no ratings yet|no dedicated maintainer topic|not a broad performance finding|too little for a broad performance conclusion)\b/.test(normSentence)) {
            continue;
        }

        const startsContrasted = LEADING_CONTRAST.test(normSentence);
        const rawParts = normSentence.split(CONTRAST_SPLIT);
        let seenNonEmpty = 0;

        for (let i = 0; i < rawParts.length; i++) {
            const part = rawParts[i].trim();
            if (!part) continue;
            // After a contrastive marker (including at the start of a sentence like "However, ..."),
            // the clause is the counterpoint, so its default reading flips.
            const contrasted = startsContrasted || seenNonEmpty > 0 || i > 0;
            seenNonEmpty++;
            const negative = NEGATIVE_MARKERS.test(part);
            const positive = POSITIVE_MARKERS.test(part);

            let polarity: 'positive' | 'negative';
            if (negative && !positive) polarity = 'negative';
            else if (positive && !negative) polarity = 'positive';
            else polarity = contrasted ? 'negative' : 'positive';

            scanText(acc, part, polarity, weight, label);
        }
    }
}

/**
 * Incorporates multi-choice lateral (`lateral`/`poll3`) and longitudinal
 * (`longitudinal`/`poll5`) trait polls from `data/discourse_polls.json`.
 */
function applyDiscoursePolls(modelName: string, acc: Accumulator): void {
    const entry = pollsByModel[modelName];
    if (!entry || !Array.isArray(entry.polls)) return;

    for (const poll of entry.polls) {
        const voters = poll.voters || 0;
        if (voters < 2) continue;

        if (poll.name === 'lateral' || poll.name === 'poll3') {
            for (const opt of poll.options || []) {
                if (!opt.votes) continue;
                const share = opt.votes / Math.max(voters, 3);
                const text = (opt.html || '').toLowerCase();
                if (text.includes('smooth')) {
                    acc.add('lat', 7 * share, 'pro: smooth', 'poll');
                    acc.add('stability', 6 * share, 'pro: stable', 'poll');
                } else if (text.includes('natural')) {
                    acc.add('comfort', 7 * share, 'pro: human like', 'poll');
                    acc.add('lat', 4 * share, 'pro: natural', 'poll');
                } else if (text.includes('hugging')) {
                    acc.add('lat', -10 * share, 'con: left hugging', 'poll');
                } else if (text.includes('ping-pong') || text.includes('wanders')) {
                    acc.add('lat', -12 * share, 'con: ping pong', 'poll');
                    acc.add('stability', -10 * share, 'con: ping pong', 'poll');
                    acc.add('comfort', -7 * share, 'con: ping pong', 'poll');
                } else if (text.includes('understeer')) {
                    acc.add('turns', -11 * share, 'con: poor turn in', 'poll');
                } else if (text.includes('over-steer') || text.includes('cuts corners')) {
                    acc.add('turns', -10 * share, 'con: cut urban corners', 'poll');
                    acc.add('urban', -5 * share, 'con: cut urban corners', 'poll');
                }
            }
        } else if (poll.name === 'longitudinal' || poll.name === 'poll5') {
            for (const opt of poll.options || []) {
                if (!opt.votes) continue;
                const share = opt.votes / Math.max(voters, 3);
                const text = (opt.html || '').toLowerCase();
                if (text.includes('smooth')) {
                    acc.add('long', 9 * share, 'pro: smooth braking', 'poll');
                    acc.add('comfort', 5 * share, 'pro: smooth stops', 'poll');
                } else if (text.includes('jerky')) {
                    acc.add('long', -8 * share, 'con: jerky', 'poll');
                    acc.add('comfort', -9 * share, 'con: jerky', 'poll');
                } else if (text.includes('hard') || text.includes('late braking')) {
                    acc.add('long', -11 * share, 'con: late braking', 'poll');
                    acc.add('comfort', -7 * share, 'con: abrupt', 'poll');
                } else if (text.includes('overshoots') || text.includes('rolls through')) {
                    acc.add('urban', -10 * share, 'con: fails to stay stopped', 'poll');
                    acc.add('long', -5 * share, 'con: late braking', 'poll');
                } else if (text.includes('stop & go') || text.includes('stop and go')) {
                    acc.add('urban', -8 * share, 'con: sluggish', 'poll');
                    acc.add('long', -7 * share, 'con: sluggish', 'poll');
                }
            }
        }
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

const canonicalDetailCache = new Map<string, SkillRatingsDetail>();

/** Same derivation, with the anchor, evidence, and sufficiency metadata kept for UI and tooltips. */
export function deriveSkillRatingsDetail(model: RatableModel): SkillRatingsDetail {
    const canonical = canonicalByName.get(model.name);
    const source: RatableModel = canonical ?? model;

    if (model.skillRatings) {
        return {
            ratings: model.skillRatings,
            anchor: NEUTRAL_BAR,
            polarity: CORPUS_POLARITY_MEAN,
            confidence: 1,
            evidence: [{ source: 'catalogue: explicit skillRatings', axis: 'lat', delta: 0 }],
            ratedAxes: [...SKILL_AXES],
            hasSufficientEvidence: true,
        };
    }

    if (canonical) {
        const cached = canonicalDetailCache.get(canonical.name);
        if (cached) return cached;
    }

    const { polarity, opinionated } = computePolarity(source);
    const confidence = computeConfidence(source, opinionated);
    const polarityOffset = (polarity - CORPUS_POLARITY_MEAN) * POLARITY_TO_BAR;
    const anchor = NEUTRAL_BAR + polarityOffset;

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

    // Prose and curated pros/cons are scanned into their own pools, tracking
    // explicit `negatives` (`con`) penalties so marketing tags cannot push an
    // axis above neutral when the model's own `negatives` call it out.
    const phrasePos: Record<SkillAxis, number> = { lat: 0, stability: 0, turns: 0, long: 0, urban: 0, comfort: 0 };
    const phraseNeg: Record<SkillAxis, number> = { lat: 0, stability: 0, turns: 0, long: 0, urban: 0, comfort: 0 };
    const explicitConNeg: Record<SkillAxis, number> = { lat: 0, stability: 0, turns: 0, long: 0, urban: 0, comfort: 0 };
    const phraseEvidence: RatingEvidence[] = [];
    const phraseAcc: Accumulator = {
        add(axis, delta, src, origin) {
            if (!delta) return;
            if (delta > 0) phrasePos[axis] += delta;
            else {
                phraseNeg[axis] += -delta;
                if (origin === 'con') explicitConNeg[axis] += -delta;
            }
            phraseEvidence.push({ source: src, axis, delta });
        },
    };

    for (const entry of source.positives ?? []) {
        scanText(phraseAcc, normalize(entry), 'positive', 1.0, 'pro');
    }
    for (const entry of source.negatives ?? []) {
        scanText(phraseAcc, normalize(entry), 'negative', 1.35, 'con');
    }
    scanProse(phraseAcc, source.consensus ?? '', 0.75, 'consensus');
    scanProse(phraseAcc, source.note ?? '', 0.6, 'note');
    applyDiscoursePolls(source.name, phraseAcc);

    evidence.push(...phraseEvidence);

    const ratedAxes: SkillAxis[] = [];
    const ratings = {} as SkillRatings;

    for (const axis of SKILL_AXES) {
        const hasAxisEvidence = evidence.some((e) => e.axis === axis && Math.abs(e.delta) >= 1.5);
        if (hasAxisEvidence) ratedAxes.push(axis);

        const hasDirectProse = (phrasePos[axis] + phraseNeg[axis]) > 0;
        const structScale = explicitConNeg[axis] > 0 && structured[axis] > 0
            ? 0.25
            : hasDirectProse ? 0.65 : 1.0;

        const adjStruct = structured[axis] * structScale;
        const posPool = Math.max(0, adjStruct) + phrasePos[axis];
        const negPool = Math.max(0, -adjStruct) + phraseNeg[axis];

        const positivePart = softCap(posPool, POS_CAP);
        const negativePart = softCap(negPool, NEG_CAP);
        const rawNet = positivePart - negativePart;

        if (!hasAxisEvidence) {
            ratings[axis] = Math.round(clamp(anchor, MIN_RATING, MAX_RATING));
            continue;
        }

        const scaledDelta = rawNet * confidence * 1.15;
        let effectiveOffset = polarityOffset;
        if (rawNet < -1 && polarityOffset > 0) {
            effectiveOffset = polarityOffset * 0.15;
        } else if (rawNet > 1 && polarityOffset < 0) {
            effectiveOffset = polarityOffset * 0.25;
        }

        let score = NEUTRAL_BAR + effectiveOffset + scaledDelta;

        if (explicitConNeg[axis] >= 12) {
            score = Math.min(score, 58 - Math.min(8, (explicitConNeg[axis] - 12) * 0.4));
        } else if (explicitConNeg[axis] >= 4) {
            score = Math.min(score, 62);
        }

        if (rawNet >= 2.5 && score >= 60 && score <= 66 && explicitConNeg[axis] === 0) {
            score = Math.max(score, 67 + Math.min(4, (rawNet - 2.5) * 0.5));
        } else if (rawNet <= -2.5 && score >= 58 && score <= 65) {
            score = Math.min(score, 56 - Math.min(4, (-rawNet - 2.5) * 0.5));
        } else if (Math.round(score) === 63) {
            score = rawNet >= 0 && explicitConNeg[axis] === 0 ? 66 : 58;
        }

        ratings[axis] = Math.round(clamp(score, MIN_RATING, MAX_RATING));
    }

    const votes = source.totalVotes ?? 0;
    const hasProsCons = ((source.positives?.length ?? 0) + (source.negatives?.length ?? 0)) > 0;
    const isUnverifiedStub = (source.tags ?? []).includes('Unverified') || source.steeringFeel === 'TBD' || votes <= 1;
    const hasSufficientEvidence = !isUnverifiedStub && ratedAxes.length >= 2 && (hasProsCons || votes >= 4 || evidence.length >= 3);

    const result: SkillRatingsDetail = {
        ratings,
        anchor,
        polarity,
        confidence,
        evidence,
        ratedAxes,
        hasSufficientEvidence,
    };
    if (canonical) {
        canonicalDetailCache.set(canonical.name, result);
    }
    return result;
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
