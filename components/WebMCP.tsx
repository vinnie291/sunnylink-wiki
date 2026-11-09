'use client';
import { useEffect } from 'react';

// WebMCP API type — experimental browser API (https://webmachinelearning.github.io/webmcp/)
type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, string>) => Promise<unknown>;
};

type ModelContextNavigator = Navigator & {
  modelContext?: {
    provideContext: (options: { tools: WebMCPTool[] }) => void;
  };
};

export default function WebMCP() {
  useEffect(() => {
    const nav = navigator as ModelContextNavigator;
    if (!nav.modelContext?.provideContext) return;

    nav.modelContext.provideContext({
      tools: [
        {
          name: 'search_settings',
          description:
            'Search the Sunnylink Wiki for Sunnypilot settings and toggles. Returns matching settings with descriptions, defaults, use cases, and community tips.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search keyword (e.g. "camera offset", "MADS", "speed limit", "lane change")',
              },
            },
            required: ['query'],
          },
          execute: async ({ query }) => {
            const res = await fetch(`/api/wiki-data?type=settings&search=${encodeURIComponent(query)}`);
            return res.json();
          },
        },
        {
          name: 'browse_models',
          description:
            'Browse Sunnypilot driving models. Filter by vibe category (chestnut_gpu, wmi_2026, aggressive, comfort, tomb_raider, legacy, opm) or search by model name.',
          inputSchema: {
            type: 'object',
            properties: {
              vibe: {
                type: 'string',
                description: 'Vibe category: chestnut_gpu, wmi_2026, aggressive, comfort, tomb_raider, legacy, opm',
              },
              query: {
                type: 'string',
                description: 'Search by model name or vehicle (e.g. "WMI V12", "Light Speed", "Down to Ride", "Dark Souls", "Ioniq 5")',
              },
            },
          },
          execute: async ({ vibe, query }) => {
            const params = new URLSearchParams({ type: 'models' });
            if (vibe) params.set('vibe', vibe);
            if (query) params.set('search', query);
            const res = await fetch(`/api/wiki-data?${params}`);
            return res.json();
          },
        },
        {
          name: 'check_car',
          description:
            'Check if a car make/model is compatible with Sunnypilot. Returns required hardware (device, harness, radar), best settings, and configuration presets.',
          inputSchema: {
            type: 'object',
            properties: {
              make: {
                type: 'string',
                description: 'Car manufacturer (e.g. Toyota, Honda, Hyundai, Kia, Subaru)',
              },
              model: {
                type: 'string',
                description: 'Car model (e.g. Camry, Civic, Ioniq 5, Sonata)',
              },
            },
          },
          execute: async ({ make, model }) => {
            const params = new URLSearchParams({ type: 'cars' });
            if (make) params.set('make', make);
            if (model) params.set('model', model);
            const res = await fetch(`/api/wiki-data?${params}`);
            return res.json();
          },
        },
      ],
    });
  }, []);

  return null;
}
