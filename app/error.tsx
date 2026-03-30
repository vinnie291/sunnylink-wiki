'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { getDeploymentInfo, isProduction } from '@/lib/env';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for the application.
 * Handles errors that occur in the app router pages.
 * Shows debug info in preview/development environments.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const info = getDeploymentInfo();
  const showDebugInfo = !isProduction();

  useEffect(() => {
    // Log error for debugging
    console.error('[app/error] Page error:', error);
    
    // In production, send to error tracking service
    // e.g., Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full">
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
          {/* Error Icon */}
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-slate-100 mb-3">
            Something went wrong
          </h1>

          {/* Error Description */}
          <p className="text-slate-400 mb-6">
            We encountered an unexpected error. This has been logged and we&apos;ll
            look into it. Please try again or return to the home page.
          </p>

          {/* Debug Info (non-production only) */}
          {showDebugInfo && (
            <div className="mb-6 p-4 bg-slate-950/50 rounded-xl text-left border border-slate-800">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
                Debug Information
              </p>
              
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Error: </span>
                  <code className="text-red-400 break-all">
                    {error.message || 'Unknown error'}
                  </code>
                </div>
                
                {error.digest && (
                  <div>
                    <span className="text-slate-500">Digest: </span>
                    <code className="text-slate-400">{error.digest}</code>
                  </div>
                )}
                
                <div>
                  <span className="text-slate-500">Environment: </span>
                  <span className="text-slate-400 capitalize">{info.environment}</span>
                </div>
                
                {info.gitBranch && (
                  <div>
                    <span className="text-slate-500">Branch: </span>
                    <span className="text-slate-400">{info.gitBranch}</span>
                  </div>
                )}
                
                {info.gitCommitSha && (
                  <div>
                    <span className="text-slate-500">Commit: </span>
                    <code className="text-slate-400">{info.gitCommitSha}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              Go Home
            </a>
          </div>
        </div>

        {/* Environment Badge */}
        {showDebugInfo && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-400 capitalize">
              {info.environment} Environment
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
