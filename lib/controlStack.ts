/**
 * Control-stack tagging and per-domain rating schema (Phase 3).
 *
 * Reviewers often conflate lateral control, radar/Chill longitudinal and E2E
 * longitudinal behaviour. These helpers keep them separate. This module is
 * client-safe (no fs) so both the vote API and the UI can import it.
 */
import type { PollQuestionDef } from './modelVotes';

export const LATERAL_CONTROLLERS = ['Torque', 'NNLC', 'PID', 'Angle'] as const;
export type LateralController = (typeof LATERAL_CONTROLLERS)[number];

export const LONGITUDINAL_MODES = ['Chill', 'OEM Radar', 'Experimental', 'DEC'] as const;
export type LongitudinalMode = (typeof LONGITUDINAL_MODES)[number];

export const HARDWARE_TIERS = ['C3X', 'C4'] as const;
export type HardwareTier = (typeof HARDWARE_TIERS)[number];

export const LONGITUDINAL_MODE_LABELS: Record<LongitudinalMode, string> = {
    Chill: 'Chill (OP Long)',
    'OEM Radar': 'OEM Radar',
    Experimental: 'Experimental (E2E)',
    DEC: 'DEC (Dynamic Experimental)',
};

export const HARDWARE_LABELS: Record<HardwareTier, string> = { C3X: 'Comma 3X', C4: 'Comma 4' };

export interface ControlStackFilters {
    lateral: LateralController | null;
    longitudinal: LongitudinalMode | null;
    hardware: HardwareTier | null;
}

export const EMPTY_STACK_FILTERS: ControlStackFilters = { lateral: null, longitudinal: null, hardware: null };

export function hasActiveStackFilter(f: ControlStackFilters): boolean {
    return Boolean(f.lateral || f.longitudinal || f.hardware);
}

// ─── Domain sub-scores ────────────────────────────────────────────────────

export const DOMAIN_KEYS = ['lateral', 'longChill', 'e2e'] as const;
export type DomainKey = (typeof DOMAIN_KEYS)[number];

export const DOMAIN_INFO: Record<DomainKey, { label: string; hint: string; answerKey: string; bar: string }> = {
    lateral: {
        label: 'Lateral',
        hint: 'Lane centering, curve handling and stability.',
        answerKey: 'domain_lateral',
        bar: 'from-cyan-400 to-blue-500',
    },
    longChill: {
        label: 'Longitudinal (Chill / Radar)',
        hint: 'Lead following, gap management and highway smoothness.',
        answerKey: 'domain_long_chill',
        bar: 'from-amber-400 to-orange-500',
    },
    e2e: {
        label: 'E2E Longitudinal (DEC / Experimental)',
        hint: 'Red-light stopping, stop signs and city acceleration.',
        answerKey: 'domain_long_e2e',
        bar: 'from-rose-400 to-pink-500',
    },
};

export interface DomainRatingStat {
    /** Number of reviewers who rated this domain. */
    count: number;
    /** Mean of reviewer ratings on a 1-5 scale, or null when nobody has rated. */
    average: number | null;
}

export type DomainRatingTally = Record<DomainKey, DomainRatingStat>;

export interface ControlStackTally {
    lateral: Partial<Record<LateralController, number>>;
    longitudinal: Partial<Record<LongitudinalMode, number>>;
    hardware: Partial<Record<HardwareTier, number>>;
}

export const EMPTY_STACK_TALLY: ControlStackTally = { lateral: {}, longitudinal: {}, hardware: {} };

export const STACK_ANSWER_KEYS = {
    lateral: 'stack_lateral',
    longitudinal: 'stack_long',
    hardware: 'stack_hardware',
} as const;

/** Drops malformed domain / stack answers so stored votes stay queryable. */
export function sanitizeStackAnswers(answers: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const domainKeys = new Set(DOMAIN_KEYS.map(k => DOMAIN_INFO[k].answerKey));
    const allowed: Record<string, readonly string[]> = {
        [STACK_ANSWER_KEYS.lateral]: LATERAL_CONTROLLERS,
        [STACK_ANSWER_KEYS.longitudinal]: LONGITUDINAL_MODES,
        [STACK_ANSWER_KEYS.hardware]: HARDWARE_TIERS,
    };
    for (const [key, value] of Object.entries(answers)) {
        if (domainKeys.has(key)) {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 1 && n <= 5) out[key] = n;
        } else if (key in allowed) {
            if (typeof value === 'string' && allowed[key].includes(value)) out[key] = value;
        } else {
            out[key] = value;
        }
    }
    return out;
}

// ─── Aggregation from polls + local answers ───────────────────────────────

const STEERING_POLL_TAGS: [RegExp, LateralController][] = [
    [/torque/i, 'Torque'],
    [/angle/i, 'Angle'],
    [/pid/i, 'PID'],
];

const LONG_MODE_POLL_TAGS: [RegExp, LongitudinalMode][] = [
    [/experimental/i, 'Experimental'],
    [/chill/i, 'Chill'],
    [/stock acc|stock radar|stock only/i, 'OEM Radar'],
];

/**
 * Builds control-stack tallies from the existing Discourse "Steering control"
 * and "Longitudinal used" polls (already blended with local votes) plus the
 * explicit stack_* answers that only the wiki collects (NNLC, DEC, hardware).
 */
export function tallyControlStack(
    questions: PollQuestionDef[],
    localAnswers: Record<string, unknown>[],
): ControlStackTally {
    const tally: ControlStackTally = { lateral: {}, longitudinal: {}, hardware: {} };
    const bump = <K extends string>(bucket: Partial<Record<K, number>>, key: K, n: number) => {
        if (n > 0) bucket[key] = (bucket[key] ?? 0) + n;
    };

    for (const q of questions) {
        if (q.id === 'steering') {
            for (const o of q.options) {
                const hit = STEERING_POLL_TAGS.find(([re]) => re.test(o.label));
                if (hit) bump(tally.lateral, hit[1], o.votes);
            }
        } else if (q.id === 'long_mode') {
            for (const o of q.options) {
                const hit = LONG_MODE_POLL_TAGS.find(([re]) => re.test(o.label));
                if (hit) bump(tally.longitudinal, hit[1], o.votes);
            }
        }
    }

    for (const a of localAnswers) {
        const lat = a[STACK_ANSWER_KEYS.lateral];
        const lon = a[STACK_ANSWER_KEYS.longitudinal];
        const hw = a[STACK_ANSWER_KEYS.hardware];
        if (typeof lat === 'string' && (LATERAL_CONTROLLERS as readonly string[]).includes(lat)) bump(tally.lateral, lat as LateralController, 1);
        if (typeof lon === 'string' && (LONGITUDINAL_MODES as readonly string[]).includes(lon)) bump(tally.longitudinal, lon as LongitudinalMode, 1);
        if (typeof hw === 'string' && (HARDWARE_TIERS as readonly string[]).includes(hw)) bump(tally.hardware, hw as HardwareTier, 1);
    }
    return tally;
}

export function tallyDomainRatings(localAnswers: Record<string, unknown>[]): DomainRatingTally {
    const result = {} as DomainRatingTally;
    for (const key of DOMAIN_KEYS) {
        const values = localAnswers
            .map(a => Number(a[DOMAIN_INFO[key].answerKey]))
            .filter(n => Number.isInteger(n) && n >= 1 && n <= 5);
        result[key] = {
            count: values.length,
            average: values.length ? values.reduce((s, n) => s + n, 0) / values.length : null,
        };
    }
    return result;
}

/** Minimum votes before a model is treated as "used with" a stack tag. */
export const MIN_STACK_VOTES = 2;

export function tallyMatchesFilters(tally: ControlStackTally | undefined, f: ControlStackFilters): boolean {
    if (!hasActiveStackFilter(f)) return true;
    if (!tally) return false;
    if (f.lateral && (tally.lateral[f.lateral] ?? 0) < MIN_STACK_VOTES) return false;
    if (f.longitudinal && (tally.longitudinal[f.longitudinal] ?? 0) < MIN_STACK_VOTES) return false;
    if (f.hardware && (tally.hardware[f.hardware] ?? 0) < MIN_STACK_VOTES) return false;
    return true;
}

// ─── Derived domain scores (fallback until reviewers rate each domain) ─────

/** Skill-bar inputs (0-99) used to derive a prior for each control domain. */
export interface DomainSkillInput {
    lat: number;
    stability: number;
    turns: number;
    long: number;
    urban: number;
    comfort: number;
}

const barToStars = (bar: number) => 1 + (Math.min(99, Math.max(0, bar)) / 99) * 4;

/** Prior star rating (1-5) per domain from the existing skill bars. */
export function deriveDomainPriors(s: DomainSkillInput): Record<DomainKey, number> {
    return {
        lateral: barToStars((s.lat * 0.4 + s.stability * 0.3 + s.turns * 0.3)),
        longChill: barToStars((s.long * 0.6 + s.comfort * 0.25 + s.stability * 0.15)),
        e2e: barToStars((s.urban * 0.65 + s.long * 0.35)),
    };
}

/** Prior pseudo-count when blending reviewer ratings with the derived prior. */
export const DOMAIN_PRIOR_WEIGHT = 5;

export function blendDomainRating(prior: number, stat: DomainRatingStat): number {
    if (!stat.count || stat.average === null) return prior;
    return (stat.average * stat.count + prior * DOMAIN_PRIOR_WEIGHT) / (stat.count + DOMAIN_PRIOR_WEIGHT);
}

// ─── Car-side classification (cars.json free-text → tags) ─────────────────

interface CarSettingsLike {
    torqueTuning?: string;
    lateralControl?: string;
    longitudinalControl?: string;
    experimentalMode?: string;
}

export function classifyCarLateral(s?: CarSettingsLike): LateralController[] {
    const text = `${s?.lateralControl ?? ''} ${s?.torqueTuning ?? ''}`.toLowerCase();
    const tags = new Set<LateralController>();
    if (/nnlc/.test(text) && !/nnlc\s*(off|disabled)|\(nnlc off\)/.test(text)) tags.add('NNLC');
    if (/angle/.test(text)) tags.add('Angle');
    if (/\bpid\b/.test(text)) tags.add('PID');
    if (/torque/.test(text)) tags.add('Torque');
    return Array.from(tags);
}

export function classifyCarLongitudinal(s?: CarSettingsLike): LongitudinalMode[] {
    const long = (s?.longitudinalControl ?? '').toLowerCase();
    const exp = (s?.experimentalMode ?? '').toLowerCase();
    const tags = new Set<LongitudinalMode>();
    if (/stock|radar|nidec/.test(long) && !/op long|alpha/.test(long)) tags.add('OEM Radar');
    if (/op long|alpha|chill/.test(long)) tags.add('Chill');
    if (/dynamic/.test(exp)) tags.add('DEC');
    else if (/always on|enabled|smart cruise/.test(exp)) tags.add('Experimental');
    return Array.from(tags);
}

export function classifyCarHardware(device?: string): HardwareTier[] {
    const d = (device ?? '').toLowerCase();
    const tags = new Set<HardwareTier>();
    if (/3x|comma 3\b|3 \//.test(d)) tags.add('C3X');
    if (/comma 4|\/ ?4\b|\bfour\b/.test(d)) tags.add('C4');
    return Array.from(tags);
}
