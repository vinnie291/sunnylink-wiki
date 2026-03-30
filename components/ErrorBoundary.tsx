'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getDeploymentInfo, isProduction } from '@/lib/env';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Provides a user-friendly error UI with retry functionality.
 * Shows additional debug info in non-production environments.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    // In production, you could send this to an error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const info = getDeploymentInfo();
      const showDebugInfo = !isProduction();

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            
            <h2 className="text-lg font-semibold text-slate-200 mb-2">
              Something went wrong
            </h2>
            
            <p className="text-sm text-slate-400 mb-4">
              An error occurred while rendering this component.
              Please try again or refresh the page.
            </p>

            {showDebugInfo && this.state.error && (
              <div className="mb-4 p-3 bg-slate-950 rounded-lg text-left">
                <p className="text-xs text-slate-500 mb-1">Error Details:</p>
                <code className="text-xs text-red-400 break-all">
                  {this.state.error.message}
                </code>
                {info.environment && (
                  <p className="text-xs text-slate-600 mt-2">
                    Environment: {info.environment}
                    {info.gitBranch && ` | Branch: ${info.gitBranch}`}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap any component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
