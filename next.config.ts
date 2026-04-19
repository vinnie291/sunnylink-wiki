import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  staticPageGenerationTimeout: 180,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Target modern browsers only — eliminates legacy polyfills
  // (Array.prototype.at, Object.hasOwn, String.prototype.trimEnd, etc.)
  // saving ~13.4 KiB
  transpilePackages: [],
  async headers() {
    return [
      {
        // Security headers on all routes
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // RFC 8288 Link headers on the homepage for agent discovery
        source: '/',
        headers: [
          {
            key: 'Link',
            value: [
              '</.well-known/api-catalog>; rel="api-catalog"',
              '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
              '</.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"',
              '</api/markdown>; rel="alternate"; type="text/markdown"',
            ].join(', '),
          },
        ],
      },
      {
        // Advertise content negotiation support on all main pages
        source: '/(|models|features|cars|wizard|stats)',
        headers: [
          { key: 'Vary', value: 'Accept' },
        ],
      },
    ];
  },
};

export default nextConfig;
