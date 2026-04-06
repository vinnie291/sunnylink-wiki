'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Header from './Header';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../lib/i18n';

const ScrollToTop = dynamic(() => import('./ScrollToTop'), { ssr: false });

interface PageShellProps {
    children: ReactNode;
    showFooter?: boolean;
    showHeader?: boolean;
    extraTopLeftContent?: ReactNode;
}

export default function PageShell({ children, showFooter = true, showHeader = true, extraTopLeftContent }: PageShellProps) {
    const { t } = useLanguage();

    return (
        <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Decorative background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
            </div>

            {/* Language Switcher and Extra Content */}
            <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-30 flex items-center gap-3">
                <LanguageSwitcher />
                {extraTopLeftContent}
            </div>

            {/* Dashboard Button */}
            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-30">
                <a
                    href="https://www.sunnylink.ai/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
            flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3
            bg-indigo-600 hover:bg-indigo-500 text-white
            rounded-xl font-semibold text-sm sm:text-base
            shadow-lg shadow-indigo-600/30
            transition-all duration-200 hover:scale-105 active:scale-95
          "
                >
                    <span>{t('dashboard.button')}</span>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </a>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 pt-20 pb-8 sm:py-12">
                {showHeader && <Header />}
                {children}

                {showFooter && (
                    <footer className="mt-16 text-center text-slate-600 text-sm">
                        <p>
                            {t('footer.builtFor')} •{' '}
                            <a href="https://www.sunnypilot.ai/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">{t('footer.terms')}</a>
                            {' '}•{' '}
                            <a href="https://github.com/sunnypilot/sunnypilot" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">{t('footer.github')}</a>
                            {' '}•{' '}
                            <a href="https://buymeacoffee.com/vinhle.co" target="_blank" rel="noopener noreferrer" className="text-[#FFDD00] hover:text-[#ffe84d] transition-colors">☕ {t('footer.buyMeCoffee')}</a>
                        </p>
                    </footer>
                )}
            </div>
            <ScrollToTop />
        </main>
    );
}
