import modelsData from '../../data/models.json';
import fleetStatsData from '../../data/fleet_model_stats.json';
import curatedMetadata from '../../data/model_metadata.json';
import replayData from '../../data/model_replays.json';
import { deriveFeedbackPhysics, type FeedbackPhysics, type TraitEvidence } from './feedback';
import { applyTraitVotes } from './traitVotes';
import type { ModelVoteSummary } from '../modelVotes';

export type CalibrationTier =
  | 'measured-replay'
  | 'multi-source'
  | 'community-feedback'
  | 'heuristic-default';

export interface CalibrationProvenance {
  tier: CalibrationTier;
  label: string;
  summary: string;
  sources: string[];
  voteCount: number;
  traitPollVoters: number;
  traitQuoteCount: number;
  fleetRoutes: number;
  hasCuratedOverrides: boolean;
  hasReplaySnapshot: boolean;
  isSyntheticApproximation: boolean;
}

export interface ModelSimProfile extends FeedbackPhysics {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  architectureEra: string;
  categoryIcon?: string;
  categoryDesc?: string;
  badge?: string;
  steeringFeel: string;
  communityScore: number;
  hasScore: boolean;
  tags: string[];
  bestFor: string;
  consensus: string;
  vibeSummary: string;
  date?: string;
  forumUrl?: string;
  testedOn?: string[];
  positives?: string[];
  negatives?: string[];
  pathColor: string;        // signature planned route ribbon hex
  provenance: CalibrationProvenance;
}

export type SimModelProfile = ModelSimProfile;

export interface ModelCategoryGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: ModelSimProfile[];
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

type FleetEntry = { slug: string; cleanName: string; routes: number; rank: number };
const FLEET_BY_SLUG = new Map<string, FleetEntry>();
for (const entry of ((fleetStatsData as { models?: FleetEntry[] }).models ?? [])) {
  FLEET_BY_SLUG.set(entry.slug, entry);
  const compact = entry.slug.replace(/-model(?=-|$)/, '');
  if (!FLEET_BY_SLUG.has(compact)) FLEET_BY_SLUG.set(compact, entry);
}

const CURATED_BY_SLUG = new Map<string, { aliasOf?: string; telemetryProfile?: Record<string, unknown> }>();
const ALIAS_TO_CANONICAL = new Map<string, string[]>();
for (const [key, val] of Object.entries(curatedMetadata as Record<string, unknown>)) {
  if (key.startsWith('$') || !val || typeof val !== 'object') continue;
  const record = val as { aliasOf?: string; telemetryProfile?: Record<string, unknown> };
  CURATED_BY_SLUG.set(key, record);
  if (record.aliasOf) {
    const existing = ALIAS_TO_CANONICAL.get(record.aliasOf) ?? [];
    existing.push(key);
    ALIAS_TO_CANONICAL.set(record.aliasOf, existing);
  }
}

const REPLAY_SLUGS = new Set<string>(
  Object.entries(replayData as Record<string, unknown>)
    .filter(([k, v]) => !k.startsWith('$') && Boolean(v) && typeof v === 'object' && Object.keys(v as object).length > 0)
    .map(([k]) => k),
);

function lookupFleetRoutes(slug: string): number {
  const direct = FLEET_BY_SLUG.get(slug) ?? FLEET_BY_SLUG.get(slug.replace(/-model(?=-|$)/, ''));
  let routes = direct?.routes ?? 0;
  for (const aliasSlug of ALIAS_TO_CANONICAL.get(slug) ?? []) {
    routes = Math.max(routes, FLEET_BY_SLUG.get(aliasSlug)?.routes ?? 0);
  }
  const canonical = CURATED_BY_SLUG.get(slug)?.aliasOf;
  if (canonical) {
    routes = Math.max(routes, FLEET_BY_SLUG.get(canonical)?.routes ?? 0);
  }
  return routes;
}

export function buildCalibrationProvenance(params: {
  id: string;
  evidence: TraitEvidence[];
  voteCount: number;
  traitPollVoters?: number;
  architectureEra: string;
}): CalibrationProvenance {
  const { id, evidence, voteCount, traitPollVoters = 0, architectureEra } = params;
  const traitQuoteCount = evidence.filter(e => !['steering feel', 'model tags', 'trait poll'].includes(e.source)).length;
  const pollEntryCount = evidence.filter(e => e.source === 'trait poll').length;
  const fleetRoutes = lookupFleetRoutes(id);
  const curated = CURATED_BY_SLUG.get(id);
  const hasCuratedOverrides = Boolean(curated?.telemetryProfile && Object.keys(curated.telemetryProfile).length > 0);
  const hasReplaySnapshot = REPLAY_SLUGS.has(id);

  const sources: string[] = [];
  if (hasReplaySnapshot) sources.push('Recorded ModelDataV2 replay');
  if (hasCuratedOverrides) sources.push('Curated telemetry overrides');
  if (traitPollVoters > 0 || pollEntryCount > 0) {
    sources.push(traitPollVoters > 0 ? `Trait polls (${traitPollVoters} voters)` : 'Trait poll responses');
  } else if (voteCount > 0) {
    sources.push(`Discourse poll (${voteCount} votes)`);
  }
  if (traitQuoteCount > 0) {
    sources.push(`${traitQuoteCount} community trait ${traitQuoteCount === 1 ? 'report' : 'reports'}`);
  }
  if (fleetRoutes > 0) {
    sources.push(`Fleet usage (${fleetRoutes.toLocaleString('en-US')} routes)`);
  }
  if (sources.length === 0) {
    sources.push(architectureEra !== 'general' ? `${architectureEra.replace(/_/g, ' ')} era prior` : 'Neutral baseline defaults');
  }

  let tier: CalibrationTier;
  let label: string;
  let summary: string;

  if (hasReplaySnapshot) {
    tier = 'measured-replay';
    label = 'Recorded ModelDataV2 Replay';
    summary = 'Driven by a recorded openpilot ModelDataV2 log stream.';
  } else if ((voteCount >= 5 || traitPollVoters > 0 || hasCuratedOverrides) && (traitQuoteCount >= 1 || pollEntryCount >= 1 || hasCuratedOverrides)) {
    tier = 'multi-source';
    label = traitPollVoters > 0 ? 'Poll + Feedback Calibrated' : 'Community + Poll Calibrated';
    summary = 'Synthetic kinematics tuned from community trait reports and Discourse poll data (not live neural-network inference).';
  } else if (traitQuoteCount >= 1) {
    tier = 'community-feedback';
    label = 'Feedback-Derived Approximation';
    summary = 'Synthetic kinematics tuned from reported driving traits in community reviews (missing traits use neutral defaults).';
  } else {
    tier = 'heuristic-default';
    label = 'Baseline Era Defaults';
    summary = 'Sparse trait reports; simulated behavior uses architecture-era priors and neutral openpilot defaults.';
  }

  return {
    tier,
    label,
    summary,
    sources,
    voteCount,
    traitPollVoters,
    traitQuoteCount,
    fleetRoutes,
    hasCuratedOverrides,
    hasReplaySnapshot,
    isSyntheticApproximation: !hasReplaySnapshot,
  };
}

export function deriveModelSimProfile(
  rawModel: {
    name: string;
    badge?: string;
    tags?: string[];
    steeringFeel?: string;
    communityScore?: number;
    totalVotes?: number;
    bestFor?: string;
    consensus?: string;
    positives?: string[];
    negatives?: string[];
    sentiment?: { great?: number; good?: number; ok?: number; bad?: number };
    note?: string;
    date?: string;
    forumUrl?: string;
    testedOn?: string[];
  },
  categoryId = 'general',
  categoryName = 'Models',
  categoryIcon?: string,
  categoryDesc?: string,
  architectureEraOverride?: string,
): ModelSimProfile {
  const id = slugify(rawModel.name);
  const architectureEra = architectureEraOverride ?? categoryId;
  const tags = rawModel.tags || [];
  const feel = rawModel.steeringFeel || 'Balanced';
  const totalVotes = Math.max(0, rawModel.totalVotes ?? 0);
  const hasScore = typeof rawModel.communityScore === 'number' && totalVotes > 0;
  const score = hasScore ? rawModel.communityScore! : 50;
  const consensus = rawModel.consensus || '';
  const physics = deriveFeedbackPhysics(rawModel, architectureEra);
  const laneWobble = physics.laneWobble;

  // Signature Color for Planned Path Ribbon
  let pathColor = '#22c55e'; // default vibrant green
  if (tags.includes('Aggressive') || rawModel.name.includes('Dark Souls')) {
    pathColor = '#f43f5e'; // rose/crimson
  } else if (tags.includes('Comfort') || rawModel.name.includes('Down to Ride')) {
    pathColor = '#06b6d4'; // cyan
  } else if (architectureEra === 'chestnut_gpu' || categoryId === 'chestnut_gpu') {
    pathColor = '#8b5cf6'; // violet
  } else if (rawModel.name.includes('Tomb Raider')) {
    pathColor = '#f59e0b'; // amber
  } else if (feel === 'Ultra-Smooth' || rawModel.name.includes('TCPm')) {
    pathColor = '#10b981'; // emerald
  } else if ((hasScore && score < 45) || laneWobble > 0.12) {
    pathColor = '#eab308'; // yellow
  }

  const vibeSummary = rawModel.bestFor
    ? `${rawModel.bestFor} · ${feel}`
    : hasScore ? `${feel} feel with ${score}/100 score` : `${feel} feel`;

  const provenance = buildCalibrationProvenance({
    id,
    evidence: physics.evidence,
    voteCount: totalVotes,
    architectureEra,
  });

  return {
    id,
    name: rawModel.name,
    category: categoryId,
    categoryName,
    architectureEra,
    categoryIcon,
    categoryDesc,
    badge: rawModel.badge,
    steeringFeel: feel,
    communityScore: score,
    hasScore,
    tags,
    bestFor: rawModel.bestFor || 'General driving',
    consensus: consensus || 'Limited descriptive feedback; unspecified traits use neutral defaults.',
    vibeSummary,
    date: rawModel.date,
    forumUrl: rawModel.forumUrl,
    testedOn: rawModel.testedOn,
    positives: rawModel.positives,
    negatives: rawModel.negatives,
    ...physics,
    pathColor,
    provenance,
  };
}

// Build list of all model profiles and categories
export const ALL_MODEL_PROFILES: ModelSimProfile[] = [];
export const MODEL_CATEGORIES: ModelCategoryGroup[] = [];
const PROFILE_MAP = new Map<string, ModelSimProfile>();
const RAW_PROFILE_MAP = new Map<string, RawModel>();
const HOME_CATEGORY_MAP = new Map<string, string>();

type RawModel = Parameters<typeof deriveModelSimProfile>[0];
type RawCategory = { id: string; name: string; icon?: string; description?: string; models?: RawModel[] };

for (const cat of (modelsData.categories as RawCategory[]) || []) {
  for (const m of cat.models ?? []) {
    const slug = slugify(m.name);
    if (!HOME_CATEGORY_MAP.has(slug) || HOME_CATEGORY_MAP.get(slug) === 'favorites') {
      HOME_CATEGORY_MAP.set(slug, cat.id);
    }
  }
}

for (const cat of (modelsData.categories as RawCategory[]) || []) {
  const group: ModelCategoryGroup = {
    id: cat.id,
    name: cat.name,
    icon: cat.icon || '🚗',
    description: cat.description || '',
    models: [],
  };

  for (const m of cat.models ?? []) {
    const slug = slugify(m.name);
    const homeEra = HOME_CATEGORY_MAP.get(slug) ?? cat.id;
    const profile = deriveModelSimProfile(m, cat.id, cat.name, cat.icon, cat.description, homeEra);
    group.models.push(profile);
    // deduplicate in ALL_MODEL_PROFILES
    if (!PROFILE_MAP.has(profile.id)) {
      ALL_MODEL_PROFILES.push(profile);
      PROFILE_MAP.set(profile.id, profile);
      PROFILE_MAP.set(profile.name.toLowerCase(), profile);
      RAW_PROFILE_MAP.set(profile.id, m);
    }
  }

  MODEL_CATEGORIES.push(group);
}

// Curated spotlights representing the primary archetypes
export const SPOTLIGHT_MODEL_IDS = [
  'tcpmv3-the-cool-peoples-model',
  'wmi-v12',
  'dark-souls-model-v2',
  'down-to-ride-v6',
  'sad-model',
  'bmrlnap-model-v3',
  'tomb-raider-16',
  'recertified-herbalist',
];

export const SPOTLIGHT_MODELS: ModelSimProfile[] = SPOTLIGHT_MODEL_IDS
  .map(id => PROFILE_MAP.get(id))
  .filter((p): p is ModelSimProfile => Boolean(p));

export const DEFAULT_MODEL_ID = 'tcpmv3-the-cool-peoples-model';

export function getModelProfile(idOrName?: string): ModelSimProfile {
  if (!idOrName) return PROFILE_MAP.get(DEFAULT_MODEL_ID) || ALL_MODEL_PROFILES[0];
  const query = idOrName.toLowerCase();
  if (PROFILE_MAP.has(query)) return PROFILE_MAP.get(query)!;
  const slug = slugify(idOrName);
  if (PROFILE_MAP.has(slug)) return PROFILE_MAP.get(slug)!;
  const found = ALL_MODEL_PROFILES.find(p => p.id.includes(slug) || p.name.toLowerCase().includes(query));
  return found || PROFILE_MAP.get(DEFAULT_MODEL_ID) || ALL_MODEL_PROFILES[0];
}

export function withModelVotes(profile: ModelSimProfile, votes?: ModelVoteSummary): ModelSimProfile {
  if (!votes || votes.modelName.toLowerCase() !== profile.name.toLowerCase()) return profile;
  const raw = RAW_PROFILE_MAP.get(profile.id);
  if (!raw) return profile;
  const hasLiveVotes = votes.live.totalVotes > 0;
  const mergedRaw = hasLiveVotes ? { ...raw, ...votes.live } : raw;
  const updated = applyTraitVotes(
    {
      ...profile,
      ...(hasLiveVotes ? { communityScore: votes.live.communityScore, hasScore: true } : {}),
      ...deriveFeedbackPhysics(mergedRaw, profile.architectureEra),
    },
    votes.questions,
  );
  const traitPollVoters = votes.questions.reduce((max, q) => Math.max(max, q.voters || 0), 0);
  const totalVoteCount = Math.max(mergedRaw.totalVotes ?? 0, traitPollVoters);
  updated.provenance = buildCalibrationProvenance({
    id: profile.id,
    evidence: updated.evidence,
    voteCount: totalVoteCount,
    traitPollVoters,
    architectureEra: profile.architectureEra,
  });
  if (
    updated.headway === profile.headway &&
    updated.departureLag === profile.departureLag &&
    updated.jerkLimit === profile.jerkLimit &&
    updated.comfortDecel === profile.comfortDecel &&
    updated.cruiseFactor === profile.cruiseFactor &&
    updated.stopOffset === profile.stopOffset &&
    updated.laneWobble === profile.laneWobble &&
    updated.wobbleSpeedBias === profile.wobbleSpeedBias &&
    updated.curveLineBias === profile.curveLineBias &&
    updated.rollingStop === profile.rollingStop &&
    updated.creepTendency === profile.creepTendency &&
    updated.communityScore === profile.communityScore &&
    updated.hasScore === profile.hasScore &&
    updated.evidence.length === profile.evidence.length &&
    (updated.sentiment?.votes ?? 0) === (profile.sentiment?.votes ?? 0) &&
    updated.provenance.tier === profile.provenance.tier &&
    updated.provenance.voteCount === profile.provenance.voteCount &&
    updated.provenance.traitPollVoters === profile.provenance.traitPollVoters
  ) {
    return profile;
  }
  return updated;
}
