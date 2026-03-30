'use client';

import { useState } from 'react';
import { getDeploymentInfo, isProduction } from '@/lib/env';
import { X, GitBranch, Globe, Server } from 'lucide-react';

/**
 * Shows a preview deployment indicator in non-production environments.
 * Displays branch name, commit SHA, and environment info.
 * Can be dismissed by the user.
 */
export default function PreviewIndicator() {
  const [dismissed, setDismissed] = useState(false);
  
  // Don't show in production or if dismissed
  if (isProduction() || dismissed) {
    return null;
  }

  const info = getDeploymentInfo();

  return (
    <div className="fixed bottom-24 md:bottom-4 left-4 z-50 max-w-xs">
      <div className="bg-amber-500/90 backdrop-blur-sm text-amber-950 px-4 py-3 rounded-lg shadow-lg text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <Server className="w-4 h-4 flex-shrink-0" />
              <span className="capitalize">{info.environment} Preview</span>
            </div>
            
            <div className="space-y-1 text-xs text-amber-900">
              {info.gitBranch && (
                <div className="flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate" title={info.gitBranch}>
                    {info.gitBranch}
                  </span>
                </div>
              )}
              
              {info.gitCommitSha && (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono">SHA:</span>
                  <code className="bg-amber-400/30 px-1 rounded">
                    {info.gitCommitSha}
                  </code>
                </div>
              )}
              
              {info.vercelUrl && (
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate text-[10px]" title={info.vercelUrl}>
                    {info.vercelUrl}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-amber-600/20 rounded transition-colors flex-shrink-0"
            aria-label="Dismiss preview indicator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
