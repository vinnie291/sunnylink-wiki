import { NextRequest, NextResponse } from 'next/server';
import modelsData from '@/data/models.json';

const MODEL_COUNT = modelsData.totalModels;

const PAGE_MARKDOWN: Record<string, string> = {
  '/': `# Sunnylink Wiki

> The complete reference for Sunnypilot — searchable settings, driving models, car compatibility, and features.

## What is Sunnypilot?

Sunnypilot is an open-source advanced driver assistance system (ADAS) built on top of comma.ai's openpilot platform. It adds community-driven features, expanded vehicle support, and additional driving models.

## Main Sections

- **[Settings Database](/)** — 100+ configurable toggles and parameters with descriptions, defaults, and community tips
- **[Model Library](/models)** — Browse ${MODEL_COUNT} driving models, filterable by vibe (comfort, aggressive, WMI 2026, experimental)
- **[Car Database](/cars)** — Vehicle-specific compatibility, recommended settings, and harness information
- **[Feature Guide](/features)** — Detailed documentation for major Sunnypilot features (MADS, NNLC, Speed Limit Assist, etc.)
- **[Config Wizard](/wizard)** — Interactive tool to build a personalized Sunnypilot configuration
- **[Live Stats](/stats)** — Real-time fleet statistics and model usage data

## Key Features of Sunnypilot

- **MADS (Modular Assistive Driving System)** — Decouples lateral and longitudinal control; keep ACC off while steering assist is active
- **NNLC (Neural Network Lateral Control)** — Vehicle-trained steering controller; requires a compatible torque-steering vehicle
- **Speed Limit Assist** — Displays, warns about, or assists with speed limits using map or vehicle-provided data, subject to configuration and confirmation rules
- **Driving Models** — Explore ${MODEL_COUNT} catalogued models; availability depends on hardware and the installed branch

## Agent Discovery

- API Catalog: \`/.well-known/api-catalog\`
- MCP Server Card: \`/.well-known/mcp/server-card.json\`
- Agent Skills: \`/.well-known/agent-skills/index.json\`
`,
  '/models': `# Sunnylink Model Library

> Browse ${MODEL_COUNT} Sunnypilot driving models, each with a unique personality and tuning.

## Model Vibes

### WMI & 2026 World Series (Modern Standard)
End-to-End intelligence. WMI V12 is the flagship for 2026. Best for daily driving including city streets, stop signs, and intersections.

### Aggressive Series
High-performance for heavy traffic. Dark Souls v2 excels with trucks and SUVs. Firehose is the bleeding-edge SOTA development feed.

### Comfort & Smooth Series
Passenger-friendly. Down to Ride (DTR) v6 is "wife-approved" — gentle braking, slow turns. Ideal for road trips.

### Precision & Sport Series
Tight, responsive steering. Perfect for drivers who want the car planted firmly in the center of the lane.

### Experimental & Research
Cutting-edge research models. May be unstable; for advanced testers only.

## How to Choose

1. **Daily city driving** → WMI V12
2. **Truck/SUV in traffic** → Dark Souls v2
3. **Passengers or road trips** → Down to Ride v6
4. **Highway precision** → Precision Sport series
5. **Testing latest tech** → Firehose

Visit [sunnylink.wiki/models](/models) for the full interactive library with filtering.
`,
  '/features': `# Sunnylink Feature Guide

> Detailed documentation for Sunnypilot's major features, enriched with community knowledge.

## Major Features

### MADS — Modular Assistive Driving System
Decouples steering assist from adaptive cruise control. Lane keep active even when ACC is off.

### NNLC — Neural Network Lateral Control
Vehicle-trained neural network that calculates steering commands. Requires a compatible torque-steering vehicle and an available trained model; configure while parked.

### Speed Limit Assist (SLA)
Off, Information, Warning, and Assist modes use map or vehicle-provided speed limits. Assist requires longitudinal control or ICBM and follows vehicle-specific confirmation rules. The separate Honda City 7G Auto SET mode in [PR #2042](https://github.com/sunnypilot/sunnypilot/pull/2042) remains an open proposal.

### Dynamic Experimental Mode
Switches between openpilot's experimental E2E mode and classic mode based on road conditions.

### Personality Profiles
Quick-switch between preset driving personalities (Relaxed, Standard, Aggressive) that adjust following distance and acceleration.

### Custom Alerts
Configurable driver alerts for various conditions — speed, lane departure, following distance.

Visit [sunnylink.wiki/features](/features) for the full feature guide.
`,
  '/cars': `# Sunnylink Car Database

> Vehicle compatibility and recommended settings for Sunnypilot.

## Supported Vehicles

The Sunnylink Car Database covers vehicles compatible with Sunnypilot across major manufacturers including:

- **Hyundai / Kia / Genesis** — Extensive support via HKG harnesses
- **Toyota / Lexus** — Wide coverage with Toyota-specific harnesses
- **Honda / Acura** — Supported via Honda Nidec/Bosch harnesses
- **GM (Chevrolet, GMC, Cadillac, Buick)** — OBD-II based support
- **Subaru** — Global-B harness
- **Volkswagen / Audi / Seat / Skoda** — J533 harness
- **Nissan / Infiniti** — Nissan harness variants

## What the Database Provides

For each vehicle:
- Required hardware (device type, harness, radar)
- Best settings (recommended driving model, torque tuning, lateral/longitudinal control)
- Multiple configuration presets (smooth highway, performance, comfort)
- Community consensus ratings

Visit [sunnylink.wiki/cars](/cars) to search the full database.
`,
  '/wizard': `# Sunnylink Config Wizard

> Interactive tool to build a personalized Sunnypilot configuration.

## What the Wizard Does

The Config Wizard guides you through selecting the optimal Sunnypilot settings for your vehicle, driving style, and use case. It asks questions about:

1. **Your vehicle** — Make, model, year
2. **Driving environment** — Mostly highway, city, or mixed
3. **Passenger considerations** — Solo driving or passengers who get motion sick
4. **Experience level** — New to sunnypilot or experienced user
5. **Preferences** — Tight lane centering vs. relaxed, aggressive vs. gentle

At the end, it recommends a specific driving model, key toggle settings, and tuning parameters.

Visit [sunnylink.wiki/wizard](/wizard) to start the wizard.
`,
  '/stats': `# Sunnylink Live Stats

> Real-time fleet statistics for the Sunnypilot community.

## What Stats Are Tracked

- Active fleet size (number of devices running Sunnypilot)
- Most popular driving models in use
- Model distribution by geography
- Recent model adoption trends

Stats are updated in real-time and reflect the global Sunnypilot community.

Visit [sunnylink.wiki/stats](/stats) for live data.
`,
};

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token (GPT-style BPE approximation)
  return Math.ceil(text.length / 4);
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? '/';
  const content = PAGE_MARKDOWN[path] ?? PAGE_MARKDOWN['/'];
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
