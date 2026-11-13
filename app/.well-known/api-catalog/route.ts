import { NextResponse } from 'next/server';

// RFC 9727 API Catalog — application/linkset+json
// Describes the Sunnylink Wiki's content sections and discovery endpoints
const catalog = {
  linkset: [
    {
      anchor: 'https://sunnylink.wiki/',
      'service-doc': [
        { href: 'https://sunnylink.wiki/features', type: 'text/html' },
        { href: 'https://sunnylink.wiki/api/markdown?path=/', type: 'text/markdown' },
      ],
      describedby: [
        { href: 'https://sunnylink.wiki/.well-known/api-catalog', type: 'application/linkset+json' },
        { href: 'https://sunnylink.wiki/.well-known/agent-skills/index.json', type: 'application/json' },
      ],
    },
    {
      anchor: 'https://sunnylink.wiki/api/wiki-data',
      'service-desc': [
        { href: 'https://sunnylink.wiki/.well-known/api-catalog', type: 'application/linkset+json' },
      ],
      'service-doc': [
        { href: 'https://sunnylink.wiki/features', type: 'text/html' },
      ],
      // Query parameters: type=(settings|models|cars), search=<query>, vibe=<vibe>, make=<make>, model=<model>
    },
    {
      anchor: 'https://sunnylink.wiki/models',
      'service-doc': [
        { href: 'https://sunnylink.wiki/models', type: 'text/html' },
        { href: 'https://sunnylink.wiki/api/markdown?path=/models', type: 'text/markdown' },
      ],
    },
    {
      anchor: 'https://sunnylink.wiki/cars',
      'service-doc': [
        { href: 'https://sunnylink.wiki/cars', type: 'text/html' },
        { href: 'https://sunnylink.wiki/api/markdown?path=/cars', type: 'text/markdown' },
      ],
    },
    {
      anchor: 'https://sunnylink.wiki/features',
      'service-doc': [
        { href: 'https://sunnylink.wiki/features', type: 'text/html' },
        { href: 'https://sunnylink.wiki/api/markdown?path=/features', type: 'text/markdown' },
      ],
    },
  ],
};

export async function GET() {
  return NextResponse.json(catalog, {
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
