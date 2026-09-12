import modelsData from '../../data/models.json';
import { deriveFeedbackPhysics, type FeedbackPhysics } from './feedback';

export interface ModelSimProfile extends FeedbackPhysics {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  categoryIcon?: string;
  categoryDesc?: string;
  badge?: string;
  steeringFeel: string;
  communityScore: number;
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
}

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
  categoryDesc?: string
): ModelSimProfile {
  const id = slugify(rawModel.name);
  const tags = rawModel.tags || [];
  const feel = rawModel.steeringFeel || 'Balanced';
  const score = rawModel.communityScore ?? 50;
  const consensus = rawModel.consensus || '';
  const physics = deriveFeedbackPhysics(rawModel);
  const laneWobble = physics.laneWobble;

  // 9. Signature Color for Planned Path Ribbon
  let pathColor = '#22c55e'; // default vibrant green
  if (tags.includes('Aggressive') || rawModel.name.includes('Dark Souls')) {
    pathColor = '#f43f5e'; // rose/crimson
  } else if (tags.includes('Comfort') || rawModel.name.includes('Down to Ride')) {
    pathColor = '#06b6d4'; // cyan
  } else if (categoryId === 'chestnut_gpu') {
    pathColor = '#8b5cf6'; // violet
  } else if (rawModel.name.includes('Tomb Raider')) {
    pathColor = '#f59e0b'; // amber
  } else if (feel === 'Ultra-Smooth' || rawModel.name.includes('TCPm')) {
    pathColor = '#10b981'; // emerald
  } else if (score < 45 || laneWobble > 0.25) {
    pathColor = '#eab308'; // yellow
  }

  const vibeSummary = rawModel.bestFor
    ? `${rawModel.bestFor} · ${feel}`
    : `${feel} feel with ${score}/100 score`;

  return {
    id,
    name: rawModel.name,
    category: categoryId,
    categoryName,
    categoryIcon,
    categoryDesc,
    badge: rawModel.badge,
    steeringFeel: feel,
    communityScore: score,
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
  };
}

// Build list of all model profiles and categories
export const ALL_MODEL_PROFILES: ModelSimProfile[] = [];
export const MODEL_CATEGORIES: ModelCategoryGroup[] = [];
const PROFILE_MAP = new Map<string, ModelSimProfile>();

type RawModel = Parameters<typeof deriveModelSimProfile>[0];
type RawCategory = { id: string; name: string; icon?: string; description?: string; models?: RawModel[] };

for (const cat of (modelsData.categories as RawCategory[]) || []) {
  const group: ModelCategoryGroup = {
    id: cat.id,
    name: cat.name,
    icon: cat.icon || '🚗',
    description: cat.description || '',
    models: [],
  };

  for (const m of cat.models ?? []) {
    const profile = deriveModelSimProfile(m, cat.id, cat.name, cat.icon, cat.description);
    group.models.push(profile);
    // deduplicate in ALL_MODEL_PROFILES
    if (!PROFILE_MAP.has(profile.id)) {
      ALL_MODEL_PROFILES.push(profile);
      PROFILE_MAP.set(profile.id, profile);
      PROFILE_MAP.set(profile.name.toLowerCase(), profile);
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
