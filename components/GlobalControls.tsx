'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import SearchButton from './SearchButton';
import ThemeToggle from './ThemeToggle';
import ExitWizardButton from './ExitWizardButton';
import { useLanguage } from '../lib/i18n';
import { COMMA_REFERRAL_URL, trackReferralClick } from '../lib/analytics';

export default function GlobalControls() {
    const { t } = useLanguage();
    const pathname = usePathname();
    const isWizard = pathname === '/wizard';
    const [sidebarSticky, setSidebarSticky] = useState(false);
    const [scrolledPastHeader, setScrolledPastHeader] = useState(false);
    const [searchActive, setSearchActive] = useState(false);

    // Listen for the sidebar-sticky and data-search-active attributes
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setSidebarSticky(document.documentElement.hasAttribute('data-sidebar-sticky'));
            setSearchActive(document.documentElement.hasAttribute('data-search-active'));
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-sidebar-sticky', 'data-search-active'],
        });
        return () => observer.disconnect();
    }, []);

    // Listen to scroll to determine if user passed the header
    // On mobile (<1024px), fade out earlier (60px) before the filter bar reaches its sticky position (top-16 = 64px)
    // On desktop, fade out once past the header (300px)
    useEffect(() => {
        const handleScroll = () => {
            const isMobile = window.innerWidth < 1024;
            setScrolledPastHeader(window.scrollY > (isMobile ? 60 : 300));
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, []);

    const hideRightControls = scrolledPastHeader || searchActive;

    return (
        <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
            {/* Top-Left: Language Switcher, Search, and optional Exit Wizard */}
            {/* Below lg: always visible — floats above the sticky filter bar (top-16)
                so the controls stay reachable while scrolling.
                On lg+: hide when scrolled past the header or when the sidebar is
                sticky (inline version takes over). */}
            <div className={`
                absolute top-3 left-3 sm:top-8 sm:left-8 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 pointer-events-auto
                transition-opacity duration-200 ease-out
                ${scrolledPastHeader || sidebarSticky ? 'lg:opacity-0 lg:pointer-events-none' : ''}
            `}>
                <div className="flex items-center gap-2 sm:gap-3">
                    <LanguageSwitcher />
                    <SearchButton />
                    <ThemeToggle />
                </div>
                {isWizard && <ExitWizardButton />}
            </div>

            {/* Top-Right: Dashboard Button & Referral Link */}
            {/* Fades out on scroll (60px on mobile, 300px on desktop) or when search is active
                to prevent overlapping sticky filter bars and page content. */}
            <div className={`
                absolute top-3 right-3 sm:top-8 sm:right-8 flex flex-col items-end pointer-events-auto
                transition-opacity duration-200 ease-out
                ${hideRightControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            `}>
                <div className="flex flex-col gap-1.5 sm:gap-2 w-44 sm:w-60">
                    <a
                        href="https://www.sunnylink.ai/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
                            flex items-center justify-center gap-1.5 sm:gap-2 w-full px-3 py-1.5 sm:px-4 sm:py-2.5
                            bg-indigo-600 hover:bg-indigo-500 text-white
                            rounded-xl font-semibold text-[11px] sm:text-sm
                            shadow-lg shadow-indigo-600/30
                            transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                        "
                    >
                        <span className="truncate">{t('dashboard.button')}</span>
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </a>
                    <a
                        href={COMMA_REFERRAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackReferralClick('dashboard')}
                        className="
                            flex items-center justify-center gap-1.5 sm:gap-2 w-full px-3 py-1.5 sm:px-4 sm:py-2.5
                            bg-emerald-700 hover:bg-emerald-600 text-white
                            rounded-xl font-bold text-xs sm:text-sm
                            shadow-md shadow-emerald-600/30
                            transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
                        "
                    >
                        <span className="truncate">Save $50 on comma four</span>
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
