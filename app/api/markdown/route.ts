import { NextRequest, NextResponse } from 'next/server';
import modelsData from '@/data/models.json';
import togglesData from '@/data/toggles.json';
import carsData from '@/data/cars.json';
import featuresData from '@/data/features.json';

const MODEL_COUNT = modelsData.totalModels ?? 136;
const CAR_COUNT = (carsData as { vehicles?: unknown[] }).vehicles?.length ?? 334;

function generateSettingsMarkdown(): string {
  const categories = (togglesData as { categories: Array<{ id: string; name: string; settings: Array<{ key: string; label: string; description?: string; default?: unknown; type?: string }> }> }).categories ?? [];

  let md = `# Sunnylink Wiki — Sunnypilot Settings & Configuration Database

> The complete, searchable reference for Sunnypilot ADAS settings, toggles, parameters, defaults, and community guidance. Base URL: https://www.sunnylink.wiki

## Overview
Sunnypilot is an open-source driving assistance system built on comma.ai's openpilot. It adds customizable controls, expanded vehicle compatibility, and community driving models.

## Settings & Toggles by Category\n\n`;

  for (const cat of categories) {
    md += `### ${cat.name}\n\n`;
    for (const s of cat.settings) {
      const defVal = s.default !== undefined && s.default !== '' ? String(s.default) : 'N/A';
      md += `#### \`${s.key}\` — ${s.label}\n`;
      md += `- **Type:** ${s.type ?? 'toggle'}\n`;
      md += `- **Default:** \`${defVal}\`\n`;
      if (s.description) {
        md += `- **Description:** ${s.description}\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

function generateModelsMarkdown(): string {
  const categories = (modelsData as { categories: Array<{ id: string; name: string; models: Array<{ name: string; communityScore?: number; bestFor?: string; steeringFeel?: string; tags?: string[]; testedOn?: string[]; consensus?: string; positives?: string[]; negatives?: string[] }> }> }).categories ?? [];

  let md = `# Sunnylink Model Library — openpilot & Sunnypilot Driving Models

> Comprehensive comparison of ${MODEL_COUNT}+ neural network driving models from comma.ai and sunnypilot with community ratings, steering profiles, and vehicle reports. Base URL: https://www.sunnylink.wiki/models\n\n`;

  for (const cat of categories) {
    md += `## Category: ${cat.name}\n\n`;
    for (const m of cat.models) {
      md += `### ${m.name}\n`;
      if (m.communityScore !== undefined) md += `- **Community Score:** ${m.communityScore}/100\n`;
      if (m.bestFor) md += `- **Best For:** ${m.bestFor}\n`;
      if (m.steeringFeel) md += `- **Steering Feel:** ${m.steeringFeel}\n`;
      if (m.tags?.length) md += `- **Tags:** ${m.tags.join(', ')}\n`;
      if (m.testedOn?.length) md += `- **Tested On:** ${m.testedOn.join(', ')}\n`;
      if (m.consensus) md += `- **Consensus:** ${m.consensus}\n`;
      if (m.positives?.length) md += `- **Positives:** ${m.positives.join('; ')}\n`;
      if (m.negatives?.length) md += `- **Quirks/Negatives:** ${m.negatives.join('; ')}\n`;
      md += `\n`;
    }
  }

  return md;
}

function generateCarsMarkdown(): string {
  const vehicles = (carsData as { vehicles: Array<{ make: string; model: string; years?: string; package?: string; harness?: string; bestSettings?: Record<string, string> }> }).vehicles ?? [];

  let md = `# Sunnylink Car Database — Supported Vehicles & Hardware Compatibility

> Compatibility list of ${CAR_COUNT}+ vehicles supported by Sunnypilot with required harnesses and recommended settings. Base URL: https://www.sunnylink.wiki/cars\n\n`;

  const byMake = new Map<string, typeof vehicles>();
  for (const v of vehicles) {
    const list = byMake.get(v.make) ?? [];
    list.push(v);
    byMake.set(v.make, list);
  }

  for (const [make, cars] of byMake.entries()) {
    md += `## ${make}\n\n`;
    for (const car of cars) {
      md += `### ${car.make} ${car.model} (${car.years ?? 'All'})\n`;
      if (car.package) md += `- **Package/Trim:** ${car.package}\n`;
      if (car.harness) md += `- **Required Harness:** ${car.harness}\n`;
      if (car.bestSettings && Object.keys(car.bestSettings).length > 0) {
        md += `- **Recommended Settings:**\n`;
        for (const [k, v] of Object.entries(car.bestSettings)) {
          md += `  - \`${k}\`: ${v}\n`;
        }
      }
      md += `\n`;
    }
  }

  return md;
}

function generateFeaturesMarkdown(): string {
  const features = (featuresData as { features: Array<{ name: string; fullName: string; officialDefinition?: string; userTranslation?: string; category?: string }> }).features ?? [];

  let md = `# Sunnylink Feature Guide — Sunnypilot ADAS Architecture

> In-depth architectural and user reference for core Sunnypilot features (MADS, NNLC, Speed Limit Assist, Dynamic Lane Profile). Base URL: https://www.sunnylink.wiki/features\n\n`;

  for (const f of features) {
    md += `## ${f.name} (${f.fullName})\n`;
    if (f.category) md += `- **Category:** ${f.category}\n`;
    if (f.officialDefinition) md += `- **Official Definition:** ${f.officialDefinition}\n`;
    if (f.userTranslation) md += `- **User Translation / Plain English:** ${f.userTranslation}\n`;
    md += `\n`;
  }

  return md;
}

function generateFullLlmsMarkdown(): string {
  return `# Sunnylink Wiki — Complete Knowledge Base (LLMs Full Reference)

> Complete concatenated documentation for Sunnypilot ADAS, settings, ${MODEL_COUNT}+ driving models, ${CAR_COUNT}+ compatible vehicles, and features.
> Canonical base URL: https://www.sunnylink.wiki

---

${generateSettingsMarkdown()}

---

${generateModelsMarkdown()}

---

${generateCarsMarkdown()}

---

${generateFeaturesMarkdown()}
`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? '/';

  let content: string;
  switch (path) {
    case '/models':
      content = generateModelsMarkdown();
      break;
    case '/cars':
      content = generateCarsMarkdown();
      break;
    case '/features':
      content = generateFeaturesMarkdown();
      break;
    case '/llms-full.txt':
    case '/full':
      content = generateFullLlmsMarkdown();
      break;
    case '/wizard':
      content = `# Sunnylink Config Wizard Reference\n\nInteractive vehicle config builder: https://www.sunnylink.wiki/wizard\n\nGuides users through choosing the ideal model, longitudinal mode, and lateral controls for their specific car.`;
      break;
    case '/stats':
      content = `# Sunnylink Live Fleet Telemetry\n\nLive fleet stats: https://www.sunnylink.wiki/stats\n\nTracks real-time device counts, active driving models, and fleet miles across the global Sunnypilot community.`;
      break;
    case '/':
    default:
      content = generateSettingsMarkdown();
      break;
  }

  const tokens = estimateTokens(content);

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      'x-markdown-tokens': String(tokens),
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
