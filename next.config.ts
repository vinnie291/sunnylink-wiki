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
};

export default nextConfig;
