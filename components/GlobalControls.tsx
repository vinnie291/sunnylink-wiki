'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import SearchButton from './SearchButton';
import ThemeToggle from './ThemeToggle';
import ExitWizardButton from './ExitWizardButton';
import { useLanguage } from '../lib/i18n';

export default function GlobalControls() {
    const { t } = useLanguage();
    const pathname = usePathname();
    const isWizard = pathname === '/wizard';
    const [sidebarSticky, setSidebarSticky] = useState(false);
    const [scrolledPastHeader, setScrolledPastHeader] = useState(false);

    // Listen for the sidebar-sticky attribute that database pages set (Desktop)
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setSidebarSticky(document.documentElement.hasAttribute('data-sidebar-sticky'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-sidebar-sticky'] });
        return () => observer.disconnect();
    }, []);

    // Listen to scroll to determine if user passed the main header (Both Mobile & Desktop)
    useEffect(() => {
        const handleScroll = () => {
            setScrolledPastHeader(window.scrollY > 300);
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
            {/* Top-Left: Language Switcher, Search, and optional Exit Wizard */}
            {/* On lg+ screens, hide when sidebar is sticky (inline version takes over) */}
            <div className={`
                absolute top-4 left-4 sm:top-8 sm:left-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 pointer-events-auto
                transition-opacity duration-200 ease-out
                ${sidebarSticky ? 'lg:opacity-0 lg:pointer-events-none' : 'lg:opacity-100'}
            `}>
                <div className="flex items-center gap-3">
                    <LanguageSwitcher />
                    <SearchButton />
                    <ThemeToggle />
                </div>
                {isWizard && <ExitWizardButton />}
            </div>

            {/* Top-Right: Dashboard Button */}
            <div className={`
                absolute top-4 right-4 sm:top-8 sm:right-8 flex items-center gap-4 pointer-events-auto
                transition-opacity duration-200 ease-out
                ${scrolledPastHeader ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            `}>
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
