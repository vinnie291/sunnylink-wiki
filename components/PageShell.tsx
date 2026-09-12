'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Header from './Header';
import { useLanguage } from '../lib/i18n';

const ScrollToTop = dynamic(() => import('./ScrollToTop'), { ssr: false });

interface PageShellProps {
    children: ReactNode;
    showFooter?: boolean;
    showHeader?: boolean;
    extraTopLeftContent?: ReactNode;
    /** Set when the page supplies its own <h1>, so the site title steps down a level. */
    pageHasOwnHeading?: boolean;
}

export default function PageShell({ children, showFooter = true, showHeader = true, extraTopLeftContent, pageHasOwnHeading = false }: PageShellProps) {
    const { t } = useLanguage();

    return (
        <>
        <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Decorative background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
            </div>

            {/* Extra Top Left Content (if any) */}
            {extraTopLeftContent && (
                <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-30 flex items-center gap-3">
                    {extraTopLeftContent}
                </div>
            )}

            <div className="relative z-10 max-w-7xl mx-auto px-4 pt-32 pb-8 sm:pt-40 sm:pb-12">
                {showHeader && <Header asPrimaryHeading={!pageHasOwnHeading} />}
                {children}

            </div>
            <ScrollToTop />
        </main>
            {/* Outside <main> so it is exposed as the page's contentinfo landmark. */}
            {showFooter && (
                <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950">
                    <p className="max-w-7xl mx-auto px-4 py-8 text-center text-slate-500 text-sm">
                        {t('footer.builtFor')} •{' '}
                        <a href="https://www.sunnypilot.ai/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">{t('footer.terms')}</a>
                        {' '}•{' '}
                        <a href="https://github.com/sunnypilot/sunnypilot" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">{t('footer.github')}</a>
                        {' '}•{' '}
                        <a href="https://buymeacoffee.com/vinhle.co" target="_blank" rel="noopener noreferrer" className="link-coffee font-medium">☕ {t('footer.buyMeCoffee')}</a>
                    </p>
                </footer>
            )}
        </>
    );
}
