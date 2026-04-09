'use client';

import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import SearchButton from './SearchButton';
import ExitWizardButton from './ExitWizardButton';
import { useLanguage } from '../lib/i18n';

export default function GlobalControls() {
    const { t } = useLanguage();
    const pathname = usePathname();
    const isWizard = pathname === '/wizard';

    return (
        <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
            {/* Top-Left: Language Switcher, Search, and optional Exit Wizard */}
            <div className="absolute top-4 left-4 sm:top-8 sm:left-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 pointer-events-auto">
                <div className="flex items-center gap-3">
                    <LanguageSwitcher />
                    <SearchButton />
                </div>
                {isWizard && <ExitWizardButton />}
            </div>

            {/* Top-Right: Dashboard Button */}
            <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex items-center gap-4 pointer-events-auto">
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
        </div>
    );
}
