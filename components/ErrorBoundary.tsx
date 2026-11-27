'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import TranslatedText from '@/components/TranslatedText';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallbackTitle?: string;
    fallbackMessage?: string;
    onReset?: () => void;
    compact?: boolean;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false });
        this.props.onReset?.();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            const {
                fallbackTitle = 'Something went wrong loading this view',
                fallbackMessage = 'A temporary display error occurred. You can retry without reloading the page.',
                compact = false,
            } = this.props;

            return (
                <div
                    role="alert"
                    className={`rounded-2xl border border-amber-500/30 bg-slate-900/90 text-slate-200 shadow-lg ${
                        compact ? 'p-4' : 'p-6 sm:p-8 my-4'
                    }`}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-amber-300 mb-1">
                                <span aria-hidden="true">⚠️ </span>
                                <TranslatedText text={fallbackTitle} />
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                <TranslatedText text={fallbackMessage} />
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={this.handleReset}
                            className="shrink-0 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                        >
                            <TranslatedText text="Reset" />
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
