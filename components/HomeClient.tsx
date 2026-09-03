'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from './Header';
import SettingsDatabase from './SettingsDatabase';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { useLanguage } from '../lib/i18n';
import { useTranslatedToggles } from '../lib/useTranslatedToggles';

const ScrollToTop = dynamic(() => import('./ScrollToTop'), { ssr: false });

interface ToggleSetting {
    key: string;
    label: string;
    type: string;
    options?: string[];
    default: boolean | string | number;
    description: string;
    recommended?: boolean | string;
    warning?: string;
    userNote?: string;
    safetyLevel?: 'safe' | 'critical';
    helpText?: string;
    dependencies?: { key: string; label: string }[];
    discourseHtml?: string;
}

interface Category {
    id: string;
    name: string;
    icon: string;
    description: string;
    settings: ToggleSetting[];
}

interface HomeClientProps {
    discourseSettings?: Record<string, string>;
}

export default function HomeClient({ discourseSettings }: HomeClientProps) {
    const { t, locale } = useLanguage();
    const togglesData = useTranslatedToggles();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

    // Watch for URL hash to highlight specific settings
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash) {
                const key = decodeURIComponent(hash.slice(1));
                setHighlightedKey(key);

                // Scroll to the anchored setting card.
                // LazyReveal is disabled when highlightedKey is set, so all cards
                // render at full height and layout is stable.
                let attempts = 0;
                const tryScroll = () => {
                    const el = document.getElementById(key);
                    if (el) {
                        // Wait for progressive rendering to finish, then scroll
                        requestAnimationFrame(() => {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                    } else if (attempts < 10) {
                        attempts++;
                        setTimeout(tryScroll, 60);
                    }
                };
                // Wait for hydration + progressive render expansion
                setTimeout(tryScroll, 150);
            }
        };
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const categories = togglesData.categories as Category[];

    // Flatten all settings with their category info, and enrich with Discourse data (English only)
    const allSettings = useMemo(() => {
        return categories.flatMap((category) =>
            category.settings.map((setting) => {
                const enriched = {
                    ...setting,
                    categoryId: category.id,
                    categoryName: category.name,
                    categoryIcon: category.icon,
                };

                // Only apply Discourse enrichment for English locale
                if (locale === 'en' && discourseSettings) {
                    const normalizedLabel = setting.label.toLowerCase().trim();
                    const html = discourseSettings[normalizedLabel];
                    if (html) {
                        return { ...enriched, discourseHtml: html };
                    }
                }

                return enriched;
            })
        );
    }, [categories, discourseSettings, locale]);

    // Category metadata for filter
    const categoryMeta = useMemo(() => {
        return categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            description: cat.description,
            count: cat.settings.length,
        }));
    }, [categories]);

    // Filter settings by category first
    const categoryFiltered = useMemo(() => {
        if (activeCategories.length === 0) return allSettings;

        // Check if 'recommended' filter is active
        const showRecommendedOnly = activeCategories.includes('recommended');
        const standardCategories = activeCategories.filter(id => id !== 'recommended');

        let filtered = allSettings;

        // Apply standard category filter if any selected
        if (standardCategories.length > 0) {
            filtered = filtered.filter((setting) => standardCategories.includes(setting.categoryId));
        }

        // Apply recommended filter if selected
        if (showRecommendedOnly) {
            filtered = filtered.filter((setting) => !!setting.recommended);
        }

        return filtered;
    }, [allSettings, activeCategories]);

    // Fuzzy search over category-filtered settings (with acronym indexing on label)
    const filteredSettings = useFuzzySearch({
        items: categoryFiltered,
        keys: ['label', 'key', 'description', 'userNote'],
        query: searchQuery,
        threshold: 0.3,
        acronymKey: 'label',
    });

    // Toggle category in filter
    const handleToggleCategory = useCallback((categoryId: string) => {
        setActiveCategories((prev) => {
            if (prev.includes(categoryId)) {
                return prev.filter((id) => id !== categoryId);
            }
            return [...prev, categoryId];
        });
    }, []);

    // Clear all filters
    const handleClearAll = useCallback(() => {
        setActiveCategories([]);
        setSearchQuery('');
    }, []);

    return (
        <main className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Decorative background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
            </div>



            <div className="relative z-10 max-w-7xl mx-auto px-4 pt-32 pb-8 sm:pt-40 sm:pb-12">
                {/* Header */}
                <Header />

                {/* Settings Content */}
                <SettingsDatabase
                    allSettings={allSettings}
                    filteredSettings={filteredSettings}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    activeCategories={activeCategories}
                    onToggleCategory={handleToggleCategory}
                    onClearCategories={handleClearAll}
                    categoryMeta={categoryMeta}
                    highlightedKey={highlightedKey}
                />


                {/* Footer */}
                <footer className="mt-16 text-center text-slate-400 text-sm lg:hidden">
                    <p>
                        {t('footer.builtFor')} •{' '}
                        <a
                            href="https://www.sunnypilot.ai/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-500 hover:text-cyan-400 transition-colors"
                        >
                            {t('footer.terms')}
                        </a>
                        {' '}•{' '}
                        <a
                            href="https://github.com/sunnypilot/sunnypilot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-500 hover:text-cyan-400 transition-colors"
                        >
                            {t('footer.github')}
                        </a>
                        {' '}•{' '}
                        <a
                            href="https://buymeacoffee.com/vinhle.co"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-coffee font-medium"
                        >
                            ☕ {t('footer.buyMeCoffee')}
                        </a>
                    </p>
                </footer>
            </div>
            <ScrollToTop />
        </main >
    );
}
