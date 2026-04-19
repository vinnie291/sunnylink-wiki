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

type Model = {
  name: string;
  vibe?: string;
  description?: string;
  bestFor?: string;
  [key: string]: unknown;
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  years?: string;
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

  return results.slice(0, 10);
}

function searchModels(query?: string, vibe?: string) {
  const models = (modelsData as { models?: Model[]; vibeGuide?: Record<string, { title: string; vibe: string; bestFor: string; recommendation?: string }> });
  const vibeGuide = models.vibeGuide ?? {};

  if (vibe) {
    const guide = vibeGuide[vibe];
    if (guide) {
      return {
        vibe,
        title: guide.title,
        description: guide.vibe,
        bestFor: guide.bestFor,
        recommendation: guide.recommendation,
      };
    }
    return { error: `Vibe '${vibe}' not found. Available vibes: ${Object.keys(vibeGuide).join(', ')}` };
  }

  // Return vibe guide summary
  return Object.entries(vibeGuide).map(([id, g]) => ({
    id,
    title: g.title,
    bestFor: g.bestFor,
  }));
}

function searchCars(make?: string, model?: string) {
  const vehicles = (carsData as { vehicles: Vehicle[] }).vehicles;
  const q_make = make?.toLowerCase();
  const q_model = model?.toLowerCase();

  const results = vehicles.filter(v => {
    const makeMatch = !q_make || v.make.toLowerCase().includes(q_make);
    const modelMatch = !q_model || v.model.toLowerCase().includes(q_model);
    return makeMatch && modelMatch;
  });

  return results.slice(0, 5).map(v => ({
    id: v.id,
    make: v.make,
    model: v.model,
    years: v.years,
    bestSettings: v.bestSettings,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') ?? 'settings';
  const query = searchParams.get('search') ?? searchParams.get('query') ?? '';
  const vibe = searchParams.get('vibe') ?? undefined;
  const make = searchParams.get('make') ?? undefined;
  const model = searchParams.get('model') ?? undefined;

  let data;
  switch (type) {
    case 'models':
      data = searchModels(query || undefined, vibe);
      break;
    case 'cars':
      data = searchCars(make, model);
      break;
    default:
      data = query ? searchSettings(query) : { error: 'Provide a search query' };
  }

  return NextResponse.json({ type, results: data }, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
