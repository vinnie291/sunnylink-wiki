/**
 * Environment utilities for preview and deployment detection.
 * Provides type-safe access to environment variables and deployment context.
 */

type DeploymentEnvironment = 'development' | 'preview' | 'production';

/**
 * Detect the current deployment environment.
 * Works across local dev, Vercel preview, and production.
 */
export function getDeploymentEnvironment(): DeploymentEnvironment {
  // Vercel sets VERCEL_ENV automatically
  const vercelEnv = process.env.VERCEL_ENV;
  
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  if (vercelEnv === 'development') return 'development';
  
  // Fallback to NODE_ENV
  if (process.env.NODE_ENV === 'production') return 'production';
  
  return 'development';
}

/**
 * Check if running in a preview deployment.
 */
export function isPreviewDeployment(): boolean {
  return getDeploymentEnvironment() === 'preview';
}

/**
 * Check if running in production.
 */
export function isProduction(): boolean {
  return getDeploymentEnvironment() === 'production';
}

/**
 * Check if running in development (local).
 */
export function isDevelopment(): boolean {
  return getDeploymentEnvironment() === 'development';
}

/**
 * Get the base URL for the current deployment.
 * Handles Vercel preview URLs, custom domains, and localhost.
 */
export function getBaseUrl(): string {
  // Client-side: use window.location
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side: check environment variables
  // 1. Explicit app URL (production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Vercel branch URL (preview deployments)
  if (process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`;
  }

  // 3. Vercel URL (preview deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Fallback to localhost
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Get deployment metadata for debugging and analytics.
 */
export function getDeploymentInfo() {
  return {
    environment: getDeploymentEnvironment(),
    baseUrl: getBaseUrl(),
    vercelUrl: process.env.VERCEL_URL || null,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL || null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || null,
  };
}

/**
 * Conditionally enable features based on environment.
 * Useful for beta features in preview or development.
 */
export function isFeatureEnabled(featureKey: string): boolean {
  const env = getDeploymentEnvironment();
  
  // Check explicit feature flag first
  const flagKey = `NEXT_PUBLIC_ENABLE_${featureKey.toUpperCase()}`;
  const explicitFlag = process.env[flagKey];
  
  if (explicitFlag !== undefined) {
    return explicitFlag === 'true';
  }
  
  // Default: enable all features in development and preview
  return env !== 'production';
}

/**
 * Get ISR revalidation time based on environment.
 * Shorter revalidation in preview for faster feedback.
 */
export function getRevalidateTime(
  options: { production?: number; preview?: number; development?: number } = {}
): number | false {
  const env = getDeploymentEnvironment();
  
  const defaults = {
    production: 3600,    // 1 hour
    preview: 60,         // 1 minute for faster preview feedback
    development: false,  // No caching in development
  };
  
  const times = { ...defaults, ...options };
  
  if (env === 'development') {
    return times.development;
  }
  
  return times[env];
}

/**
 * Safe JSON parse with fallback.
 * Useful for parsing environment variables that contain JSON.
 */
export function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
