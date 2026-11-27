import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://www.clarity.ms https://*.clarity.ms https://c.bing.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://community.sunnypilot.ai https://raw.githubusercontent.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' blob: data: https://www.clarity.ms https://*.clarity.ms https://c.bing.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://community.sunnypilot.ai https://raw.githubusercontent.com https://api.comma.ai https://metabase.sunnypilot.ai",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "frame-src 'self' https://metabase.sunnypilot.ai",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join('; ');

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
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
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
