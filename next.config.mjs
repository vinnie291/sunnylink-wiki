/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Core Configuration ───
  reactStrictMode: true,

  // ─── Performance Optimizations ───
  // Enable React Compiler for automatic optimizations (Next.js 16 stable feature)
  reactCompiler: true,

  // ─── Image Optimization ───
  images: {
    // Enable modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Allow images from Discourse and common CDNs
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'community.sunnypilot.ai',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.sunnypilot.ai',
        pathname: '/**',
      },
    ],
    // Optimize device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // ─── Preview & Development Optimizations ───
  // Turbopack is now stable and default in Next.js 16
  // No explicit configuration needed

  // ─── Build Optimizations ───
  // Minimize CSS in production
  experimental: {
    // Enable optimized package imports for commonly used packages
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
  },

  // ─── Headers for Better Caching & Security ───
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // ─── Redirects ───
  async redirects() {
    return [
      // Example: redirect old routes to new ones if needed
      // {
      //   source: '/old-route',
      //   destination: '/new-route',
      //   permanent: true,
      // },
    ];
  },

  // ─── Logging Configuration ───
  logging: {
    fetches: {
      // Show full URLs in fetch logs during development for easier debugging
      fullUrl: true,
    },
  },

  // ─── TypeScript & ESLint ───
  typescript: {
    // Don't fail build on type errors in development previews
    // Set to true for production builds to catch errors
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    // Don't fail build on lint errors in development previews
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },

  // ─── Webpack Configuration (for edge cases) ───
  webpack: (config, { isServer }) => {
    // Handle better-sqlite3 for server-side only
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
