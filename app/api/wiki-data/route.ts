import { NextRequest, NextResponse } from 'next/server';
import togglesData from '@/data/toggles.json';
import modelsData from '@/data/models.json';
import carsData from '@/data/cars.json';

type Toggle = {
  key: string;
  label: string;
  description?: string;
  type?: string;
  default?: unknown;
  useCase?: string;
};

type Category = {
  id: string;
  name: string;
  settings: Toggle[];
};

type RawModel = {
  name: string;
  date?: string;
  badge?: string;
  tags?: string[];
  communityScore?: number;
  totalVotes?: number;
  sentiment?: { great?: number; good?: number; ok?: number; bad?: number };
  consensus?: string;
  note?: string;
  bestFor?: string;
  steeringFeel?: string;
  forumUrl?: string;
  testedOn?: string[];
  positives?: string[];
  negatives?: string[];
  routesDriven?: number;
  fleetRank?: number;
  [key: string]: unknown;
};

type ModelCategory = {
  id: string;
  name: string;
  description?: string;
  models: RawModel[];
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  years?: string;
  package?: string;
  harness?: string;
  bestSettings?: Record<string, string>;
  [key: string]: unknown;
};

function searchSettings(query: string) {
  const q = query.toLowerCase();
  const results: Array<{ key: string; label: string; description: string; category: string; type: string; default: unknown }> = [];

  for (const category of (togglesData as { categories: Category[] }).categories) {
    for (const setting of category.settings) {
      const matchesLabel = setting.label?.toLowerCase().includes(q);
      const matchesKey = setting.key?.toLowerCase().includes(q);
      const matchesDesc = setting.description?.toLowerCase().includes(q);
      const matchesUseCase = setting.useCase?.toLowerCase().includes(q);

      if (matchesLabel || matchesKey || matchesDesc || matchesUseCase) {
        results.push({
          key: setting.key,
          label: setting.label,
          description: setting.description ?? '',
          category: category.name,
          type: setting.type ?? 'toggle',
          default: setting.default,
        });
      }
    }
  }

  return results.slice(0, 15);
}

function searchModels(query?: string, vibe?: string) {
  const data = modelsData as {
    totalModels?: number;
    categories?: ModelCategory[];
    vibeGuide?: Record<string, { title: string; vibe: string; bestFor: string; recommendation?: string }>;
  };
  const categories = data.categories ?? [];
  const vibeGuide = data.vibeGuide ?? {};

  // If vibe is provided, determine matching category IDs
  const vibeKey = vibe?.toLowerCase().trim();
  const categoryFilter = vibeKey
    ? categories.filter(c => c.id.toLowerCase() === vibeKey || c.name.toLowerCase().includes(vibeKey))
    : categories;

  // 1. If query is provided, search across models
  if (query) {
    const q = query.toLowerCase().trim();
    const matches: Array<{ model: RawModel; category: string; score: number }> = [];
    const seen = new Set<string>();

    for (const cat of categoryFilter) {
      for (const m of cat.models ?? []) {
        if (seen.has(m.name)) continue;

        let score = 0;
        const nameLower = m.name.toLowerCase();
        if (nameLower === q) score += 100;
        else if (nameLower.startsWith(q)) score += 50;
        else if (nameLower.includes(q)) score += 30;

        if (m.bestFor?.toLowerCase().includes(q)) score += 15;
        if (m.steeringFeel?.toLowerCase().includes(q)) score += 15;
        if (m.tags?.some(t => t.toLowerCase().includes(q))) score += 20;
        if (m.testedOn?.some(car => car.toLowerCase().includes(q))) score += 25;
        if (m.consensus?.toLowerCase().includes(q)) score += 10;
        if (m.positives?.some(p => p.toLowerCase().includes(q))) score += 10;
        if (m.negatives?.some(n => n.toLowerCase().includes(q))) score += 10;

        if (score > 0) {
          seen.add(m.name);
          matches.push({ model: m, category: cat.id, score });
        }
      }
    }

    matches.sort((a, b) => b.score - a.score || (b.model.communityScore ?? 0) - (a.model.communityScore ?? 0));
    return matches.slice(0, 15).map(({ model, category }) => ({
      name: model.name,
      category,
      badge: model.badge,
      communityScore: model.communityScore,
      totalVotes: model.totalVotes,
      sentiment: model.sentiment,
      bestFor: model.bestFor,
      steeringFeel: model.steeringFeel,
      tags: model.tags,
      testedOn: model.testedOn,
      consensus: model.consensus,
      positives: model.positives,
      negatives: model.negatives,
      forumUrl: model.forumUrl,
    }));
  }

  // 2. If vibe is provided (without query), return that vibe's info and all its models
  if (vibeKey) {
    const guide = vibeGuide[vibeKey];
    const catModels = categoryFilter.flatMap(c => c.models ?? []);
    if (guide || catModels.length > 0) {
      return {
        vibe: vibeKey,
        title: guide?.title ?? vibeKey,
        description: guide?.vibe ?? '',
        bestFor: guide?.bestFor ?? '',
        recommendation: guide?.recommendation,
        totalModelsInVibe: catModels.length,
        models: catModels.slice(0, 20).map(m => ({
          name: m.name,
          badge: m.badge,
          communityScore: m.communityScore,
          bestFor: m.bestFor,
          steeringFeel: m.steeringFeel,
          tags: m.tags,
          testedOn: m.testedOn,
          forumUrl: m.forumUrl,
        })),
      };
    }
    return {
      error: `Vibe '${vibe}' not found. Available vibes: ${Object.keys(vibeGuide).join(', ')}`,
      availableVibes: Object.keys(vibeGuide),
    };
  }

  // 3. If neither query nor vibe: return summary of catalog and top models
  const allModels: Array<RawModel & { category: string }> = [];
  const seen = new Set<string>();
  for (const cat of categories) {
    for (const m of cat.models ?? []) {
      if (!seen.has(m.name)) {
        seen.add(m.name);
        allModels.push({ ...m, category: cat.id });
      }
    }
  }

  allModels.sort((a, b) => (b.communityScore ?? 0) - (a.communityScore ?? 0));

  return {
    totalModels: data.totalModels ?? allModels.length,
    availableVibes: Object.keys(vibeGuide),
    vibeGuide,
    featuredModels: allModels.slice(0, 10).map(m => ({
      name: m.name,
      category: m.category,
      badge: m.badge,
      communityScore: m.communityScore,
      bestFor: m.bestFor,
      steeringFeel: m.steeringFeel,
      tags: m.tags,
      testedOn: m.testedOn,
    })),
  };
}

function searchCars(make?: string, model?: string, query?: string) {
  const vehicles = (carsData as { vehicles: Vehicle[] }).vehicles ?? [];
  const q_make = make?.toLowerCase().trim();
  const q_model = model?.toLowerCase().trim();
  const q_general = query?.toLowerCase().trim();

  const results = vehicles.filter(v => {
    if (q_general) {
      const full = `${v.make} ${v.model} ${v.years ?? ''}`.toLowerCase();
      if (full.includes(q_general)) return true;
    }
    const makeMatch = !q_make || v.make.toLowerCase().includes(q_make);
    const modelMatch = !q_model || v.model.toLowerCase().includes(q_model);
    return makeMatch && modelMatch;
  });

  return results.slice(0, 10).map(v => ({
    id: v.id,
    make: v.make,
    model: v.model,
    years: v.years,
    package: v.package,
    harness: v.harness,
    bestSettings: v.bestSettings,
  }));
}

const ALLOWED_TYPES = new Set(['settings', 'models', 'cars']);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawType = searchParams.get('type') ?? 'settings';
  const type = ALLOWED_TYPES.has(rawType) ? rawType : 'settings';
  const query = (searchParams.get('search') ?? searchParams.get('query') ?? '').slice(0, 200);
  const vibe = searchParams.get('vibe')?.slice(0, 50) ?? undefined;
  const make = searchParams.get('make')?.slice(0, 100) ?? undefined;
  const model = searchParams.get('model')?.slice(0, 100) ?? undefined;

  let data;
  switch (type) {
    case 'models':
      data = searchModels(query || undefined, vibe);
      break;
    case 'cars':
      data = searchCars(make, model, query || undefined);
      break;
    default:
      data = query ? searchSettings(query) : { error: 'Provide a search query or set type=models / type=cars' };
  }

  return NextResponse.json({ type, results: data }, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
