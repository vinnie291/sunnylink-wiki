/**
 * Driving model technical metadata (Phase 1 of the model-representation plan).
 *
 * Metadata is resolved in three layers, highest priority first:
 *   1. An inline `metadata` object on the model entry in data/models*.json
 *   2. Curated overrides in data/model_metadata.json (keyed by model slug)
 *   3. Inference from existing fields (category, tags, date, community feedback)
 *
 * Layer 3 guarantees every existing entry renders without schema changes. Any
 * field that came from inference is flagged so the UI can label it as an
 * estimate rather than a verified fact.
 */
import modelsData from '../data/models.json';
import curatedData from '../data/model_metadata.json';
import { deriveFeedbackPhysics, type FeedbackModel } from './new-sim/feedback';
import { modelNameToSlug } from './modelSlug';

// ─── Schema (matches the architecture plan) ───────────────────────────────

export type TrainingParadigm =
    | 'world_model_rl'      // Trained via policy rollouts in comma's World Model simulator (e.g., WMI series, OP 0.11+)
    | 'reprojective_sim'    // Classical reprojective simulator / hybrid E2E
    | 'behavior_cloning'    // Standard supervised behavior cloning
    | 'community_finetune'; // Custom community/branch weights

export type ComputeTier = 'C3X' | 'C4' | 'external_gpu' | 'legacy_C3';

export interface ModelTelemetryProfile {
    /** Normalized lateral path bias (-1.0 = hug left, 0.0 = dead center, +1.0 = hug right) */
    lateralBias: number;
    /** Turn-in initiation timing (-1.0 = early/dive apex, 0.0 = neutral, +1.0 = late/wide entry) */
    turnInTiming: number;
    /** Longitudinal braking/acceleration curve aggressiveness (0.0 = chill/early decel, 1.0 = aggressive/late braking) */
    longitudinalAggressiveness: number;
    /** Stop-line / red-light creep tendency (0.0 = full hold, 1.0 = noticeable creep) */
    stopLineCreep: number;
    /** Recommended baseline camera offset in meters (separated by device mounting geometry) */
    recommendedCameraOffset?: {
        c3x?: number;
        c4?: number;
    };
}

export interface DrivingModelMetadata {
    weightsSha256?: string;       // Optional hash to detect duplicate/alias model builds
    aliasOf?: string;             // ID (slug) of the canonical model if weights are identical
    upstreamPrUrl?: string;       // e.g. a commaai/openpilot or sunnypilot PR URL
    trainingParadigm: TrainingParadigm;
    supportedCompute: ComputeTier[];
    telemetryProfile: ModelTelemetryProfile;
}

/** Shape accepted inline on a model entry or in data/model_metadata.json. */
export type DrivingModelMetadataInput = Partial<Omit<DrivingModelMetadata, 'telemetryProfile'>> & {
    telemetryProfile?: Partial<ModelTelemetryProfile>;
    /** Free-text note shown in the alias tooltip. */
    aliasNote?: string;
};

export type MetadataField = 'trainingParadigm' | 'supportedCompute' | 'telemetryProfile' | 'aliasOf' | 'weightsSha256' | 'upstreamPrUrl';

export interface ResolvedModelMetadata extends DrivingModelMetadata {
    id: string;
    /** Which fields were filled by heuristics rather than curated data. */
    inferredFields: MetadataField[];
    /** Short human-readable reasons for each inferred value. */
    inferenceNotes: string[];
    aliasNote?: string;
    /** Slugs of other models that are aliases of this one (or share its weights hash). */
    aliases: string[];
}

/** Minimal model shape the resolver needs. Matches entries in data/models.json. */
export interface MetadataSourceModel extends FeedbackModel {
    name: string;
    date?: string;
    tags?: string[];
    metadata?: DrivingModelMetadataInput;
}

// ─── Display helpers ──────────────────────────────────────────────────────

export const TRAINING_PARADIGM_INFO: Record<TrainingParadigm, { label: string; short: string; description: string; className: string }> = {
    world_model_rl: {
        label: 'World Model RL',
        short: 'World Model',
        description: 'Policy trained with on-policy rollouts inside a learned world-model simulator (the 2025+ comma training pipeline).',
        className: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
    },
    reprojective_sim: {
        label: 'Reprojective E2E',
        short: 'Reprojective',
        description: 'End-to-end policy trained in the classical reprojective simulator (re-rendered camera frames from recorded drives).',
        className: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
    },
    behavior_cloning: {
        label: 'Behavior Cloning',
        short: 'BC',
        description: 'Supervised imitation of recorded human driving, without simulator rollouts.',
        className: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
    },
    community_finetune: {
        label: 'Community Fine-tune',
        short: 'Community',
        description: 'Custom community or fork-specific weights, typically fine-tuned from an official release.',
        className: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    },
};

export const COMPUTE_TIER_INFO: Record<ComputeTier, { label: string; description: string }> = {
    C3X: { label: 'C3X', description: 'Runs on the comma 3X.' },
    C4: { label: 'C4', description: 'Runs on the comma four.' },
    external_gpu: { label: 'Ext. GPU', description: "Requires comma's external GPU add-on (Chestnut-class big models)." },
    legacy_C3: { label: 'C3', description: 'Released while the original comma three was still supported.' },
};

/**
 * Naming collisions the community trips over. Returned as tooltip text so a
 * release codename isn't mistaken for an architecture description.
 */
export function getNamingNotes(name: string): string[] {
    const n = name.toLowerCase();
    const notes: string[] = [];
    if (/\bwmi\b|\bwmi\s?v?\d/.test(n)) {
        notes.push('"WMI" is a release codename that follows the Watermelon (WM) → Green Watermelon (gWM) naming lineage. It is often expanded as "World Model Iteration", but the name does not describe the architecture — see the training paradigm badge for that.');
    }
    if (/\bgwm\b|green watermelon/.test(n)) {
        notes.push('"gWM" stands for Green Watermelon (a codename), not "generic World Model".');
    }
    if (/^op model|\bopm\b|off-policy/.test(n)) {
        notes.push('"OP" here means Off-Policy, not openpilot.');
    }
    if (/deep_rl/.test(n)) {
        notes.push('Deep_RL is a fork-specific model series, separate from official models tagged "Deep RL".');
    }
    if (/tcpm|cool[\s\-_]?peoples/.test(n)) {
        notes.push('TCPm = The Cool Peoples Model (a community release name).');
    }
    if (/bmrlnap/.test(n)) {
        notes.push('BMRLNAP models are Chestnut-class "big models" for the external GPU add-on.');
    }
    return notes;
}

// ─── Internals ────────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

type RawCategory = { id: string; models: MetadataSourceModel[] };

const CATEGORY_BY_NAME = new Map<string, string>();
const RAW_BY_SLUG = new Map<string, MetadataSourceModel>();
for (const cat of (modelsData.categories as unknown as RawCategory[])) {
    for (const m of cat.models) {
        const slug = modelNameToSlug(m.name);
        // The "favorites" category re-lists models; keep the more specific home category.
        if (!CATEGORY_BY_NAME.has(slug) || CATEGORY_BY_NAME.get(slug) === 'favorites') {
            CATEGORY_BY_NAME.set(slug, cat.id);
        }
        if (!RAW_BY_SLUG.has(slug)) RAW_BY_SLUG.set(slug, m);
    }
}

const CURATED: Record<string, DrivingModelMetadataInput> = Object.fromEntries(
    Object.entries(curatedData as Record<string, unknown>).filter(([k]) => !k.startsWith('$'))
) as Record<string, DrivingModelMetadataInput>;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Parses dates like "October 10, 2025", "December 2025" or "Late 2025". */
export function parseModelDate(value?: string): Date | null {
    if (!value) return null;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;
    const lower = value.toLowerCase();
    const year = lower.match(/\b(20\d{2})\b/)?.[1];
    if (!year) return null;
    const monthIdx = MONTHS.findIndex(m => lower.includes(m));
    if (monthIdx >= 0) return new Date(Number(year), monthIdx, 15);
    if (lower.includes('late')) return new Date(Number(year), 9, 1);
    if (lower.includes('early')) return new Date(Number(year), 1, 1);
    if (lower.includes('mid')) return new Date(Number(year), 5, 1);
    return new Date(Number(year), 6, 1);
}

const WORLD_MODEL_ERA = new Date(2025, 7, 1);   // Aug 2025: world-model training pipeline
const C4_ERA = new Date(2025, 10, 1);           // Nov 2025: comma four availability
const C3_SUPPORT_END = new Date(2025, 7, 1);    // Original comma three dropped around the same release

function inferParadigm(m: MetadataSourceModel, categoryId: string, date: Date | null): { value: TrainingParadigm; note: string } {
    const tags = (m.tags ?? []).map(t => t.toLowerCase());
    const has = (...needles: string[]) => needles.some(n => tags.some(t => t.includes(n)));
    const name = m.name.toLowerCase();

    if (categoryId === 'specialty_forks' || has('custom', 'community', 'fork')
        || /tcpm|cool peoples|down to ride|kerrygold|vibe|\bgwm\b|cool gwm/.test(name)) {
        return { value: 'community_finetune', note: 'Custom/community/fork tags or category' };
    }
    if (has('academic')) {
        return { value: 'behavior_cloning', note: 'Academic research model (no simulator rollouts documented)' };
    }
    if (categoryId === 'chestnut_gpu' || categoryId === 'opm' || has('deep rl', 'off-policy', 'reinforcement learning')) {
        return { value: 'world_model_rl', note: 'RL / off-policy / big-model release line' };
    }
    if (categoryId === 'world_2026') {
        return { value: 'world_model_rl', note: '2026 world-model release line' };
    }
    if (date && date >= WORLD_MODEL_ERA) {
        return { value: 'world_model_rl', note: 'Released after the world-model training pipeline shipped (Aug 2025)' };
    }
    return { value: 'reprojective_sim', note: 'Released before Aug 2025, during the reprojective-simulator era' };
}

function inferCompute(m: MetadataSourceModel, categoryId: string, date: Date | null): { value: ComputeTier[]; note: string } {
    const tags = (m.tags ?? []).join(' ').toLowerCase();
    if (categoryId === 'chestnut_gpu' || /big model|chestnut/.test(tags)) {
        return { value: ['external_gpu'], note: 'Chestnut big model — needs the external GPU add-on' };
    }
    const tiers: ComputeTier[] = ['C3X'];
    if ((date && date >= C4_ERA) || /\bc4\b/.test(tags)) tiers.push('C4');
    if (date && date < C3_SUPPORT_END) tiers.push('legacy_C3');
    return { value: tiers, note: 'Estimated from release date relative to device availability' };
}

/**
 * Converts the existing feedback→physics mapping into the normalized telemetry
 * profile. These are feedback-derived estimates, not measured model outputs.
 */
export function inferTelemetryProfile(m: MetadataSourceModel): ModelTelemetryProfile {
    const p = deriveFeedbackPhysics(m);
    const tags = (m.tags ?? []).join(' ').toLowerCase();

    // laneOffset is ±0.28 m when hugging is reported (negative = left).
    let lateralBias = clamp(p.laneOffset / 0.28 * 0.55, -1, 1);
    // Night-only left hug is a weaker, conditional bias.
    if (p.laneBiasContext === 'night-without-lead') lateralBias *= 0.6;

    // curveLineBias: +0.3 = cuts inside (early turn-in), -0.25 = wide/understeer (late).
    const turnInTiming = clamp(
        -p.curveLineBias * 2
        + (p.steeringDelay - 0.14) * 5
        + (p.steeringTimeConstant - 0.20) * 2.5,
        -1, 1,
    );

    const decel = -p.comfortDecel; // 1.8 (gentle) … 3.5 (late/hard)
    const longitudinalAggressiveness = clamp(
        ((decel - 1.6) / 2.2) * 0.6
        + ((2.2 - p.headway) / 1.0) * 0.25
        + ((p.accelerationMax - 1.3) / 1.2) * 0.15,
        0, 1,
    );

    const stopLineCreep = p.creepTendency ? 0.75
        : p.rollingStop ? 0.55
        : p.stopOffset > 0 ? clamp(p.stopOffset * 0.4, 0, 0.5)
        : 0.05;

    const profile: ModelTelemetryProfile = {
        lateralBias: round2(lateralBias),
        turnInTiming: round2(turnInTiming),
        longitudinalAggressiveness: round2(longitudinalAggressiveness),
        stopLineCreep: round2(stopLineCreep),
    };

    if (Math.abs(lateralBias) >= 0.15) {
        // Community guidance: +0.05…+0.10 m for left-hugging models. Positive offset counters a left bias.
        const magnitude = round2(clamp(-lateralBias * 0.12, -0.12, 0.12));
        const c4Only = /\(c4\)|c4\)/.test(tags);
        profile.recommendedCameraOffset = c4Only ? { c4: magnitude } : { c3x: magnitude, c4: magnitude };
    }
    return profile;
}

function mergeInput(target: DrivingModelMetadataInput, src?: DrivingModelMetadataInput): DrivingModelMetadataInput {
    if (!src) return target;
    return {
        ...target,
        ...src,
        telemetryProfile: { ...(target.telemetryProfile ?? {}), ...(src.telemetryProfile ?? {}) },
    };
}

const CACHE = new Map<string, ResolvedModelMetadata>();

/**
 * Resolves full metadata for a model. Accepts a model object (possibly a
 * translated copy) or just a name; always looks up the canonical English
 * entry by slug so inference never parses translated prose.
 */
export function resolveModelMetadata(modelOrName: MetadataSourceModel | string): ResolvedModelMetadata {
    const name = typeof modelOrName === 'string' ? modelOrName : modelOrName.name;
    const id = modelNameToSlug(name);
    const cached = CACHE.get(id);
    if (cached) return cached;

    const raw: MetadataSourceModel = RAW_BY_SLUG.get(id) ?? (typeof modelOrName === 'string' ? { name } : modelOrName);
    const categoryId = CATEGORY_BY_NAME.get(id) ?? 'general';
    const date = parseModelDate(raw.date);

    const explicit = mergeInput(mergeInput({}, CURATED[id]), raw.metadata);
    const inferredFields: MetadataField[] = [];
    const inferenceNotes: string[] = [];

    let trainingParadigm = explicit.trainingParadigm;
    if (!trainingParadigm) {
        const r = inferParadigm(raw, categoryId, date);
        trainingParadigm = r.value;
        inferredFields.push('trainingParadigm');
        inferenceNotes.push(`Training paradigm: ${r.note}`);
    }

    let supportedCompute = explicit.supportedCompute;
    if (!supportedCompute || supportedCompute.length === 0) {
        const r = inferCompute(raw, categoryId, date);
        supportedCompute = r.value;
        inferredFields.push('supportedCompute');
        inferenceNotes.push(`Compute: ${r.note}`);
    }

    const inferredProfile = inferTelemetryProfile(raw);
    const explicitProfile = explicit.telemetryProfile ?? {};
    const profileKeys: (keyof ModelTelemetryProfile)[] = ['lateralBias', 'turnInTiming', 'longitudinalAggressiveness', 'stopLineCreep'];
    if (profileKeys.some(k => explicitProfile[k] === undefined)) {
        inferredFields.push('telemetryProfile');
        inferenceNotes.push('Telemetry profile: estimated from community feedback text, tags and polls');
    }
    const telemetryProfile: ModelTelemetryProfile = { ...inferredProfile, ...explicitProfile } as ModelTelemetryProfile;

    const resolved: ResolvedModelMetadata = {
        id,
        weightsSha256: explicit.weightsSha256,
        aliasOf: explicit.aliasOf,
        aliasNote: explicit.aliasNote,
        upstreamPrUrl: explicit.upstreamPrUrl,
        trainingParadigm,
        supportedCompute,
        telemetryProfile,
        inferredFields,
        inferenceNotes,
        aliases: ALIAS_INDEX.get(id) ?? [],
    };
    CACHE.set(id, resolved);
    return resolved;
}

// ─── Alias / duplicate-weights detection ──────────────────────────────────

const ALIAS_INDEX = new Map<string, string[]>();
(() => {
    const byHash = new Map<string, string[]>();
    const allSlugs = new Set<string>([...RAW_BY_SLUG.keys(), ...Object.keys(CURATED)]);
    for (const slug of allSlugs) {
        const meta = mergeInput(mergeInput({}, CURATED[slug]), RAW_BY_SLUG.get(slug)?.metadata);
        if (meta.aliasOf) {
            const list = ALIAS_INDEX.get(meta.aliasOf) ?? [];
            list.push(slug);
            ALIAS_INDEX.set(meta.aliasOf, list);
        }
        if (meta.weightsSha256) {
            const list = byHash.get(meta.weightsSha256) ?? [];
            list.push(slug);
            byHash.set(meta.weightsSha256, list);
        }
    }
    for (const group of byHash.values()) {
        if (group.length < 2) continue;
        for (const slug of group) {
            const others = group.filter(s => s !== slug);
            ALIAS_INDEX.set(slug, Array.from(new Set([...(ALIAS_INDEX.get(slug) ?? []), ...others])));
        }
    }
})();

/** Display name for a model slug (falls back to the slug). */
export function getModelDisplayName(slug: string): string {
    return RAW_BY_SLUG.get(slug)?.name ?? slug;
}

/**
 * Returns the canonical model slug a model duplicates, if any — either via an
 * explicit aliasOf or an identical weightsSha256 on an earlier entry.
 */
export function getCanonicalAlias(meta: ResolvedModelMetadata): string | undefined {
    if (meta.aliasOf) return meta.aliasOf;
    if (!meta.weightsSha256) return undefined;
    return meta.aliases.find(s => resolveModelMetadata(getModelDisplayName(s)).aliasOf === undefined && s < meta.id);
}
