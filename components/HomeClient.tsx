'use client';
import { vehicleModelLabel } from '@/lib/vehicleDisplay';
import TranslatedText from '@/components/TranslatedText';


import { usePageSearch } from '../hooks/usePageSearch';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from './Header';
import SettingsDatabase from './SettingsDatabase';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { useLanguage } from '../lib/i18n';
import { useTranslatedToggles } from '../lib/useTranslatedToggles';
import { useMyCar } from '../lib/myCar';
import { AUTOMATIC_CAPABILITY_NOTES, SUBARU_MANUAL_BRAKE_DESCRIPTION, isSettingApplicableToMake } from '../lib/vehicleSettings';

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

function safeDecodeURIComponent(raw: string): string {
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

function slugifySetting(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const SETTING_KEY_ALIASES: Record<string, string> = {
    cameraoffset: 'AdjustCameraOffset',
    'camera-offset': 'AdjustCameraOffset',
    adjustcameraoffset: 'AdjustCameraOffset',
    'adjust-camera-offset': 'AdjustCameraOffset',
    'lane-hugging': 'AdjustCameraOffset',
    lanehugging: 'AdjustCameraOffset',
    mads: 'MadsEnabled',
    enablemads: 'MadsEnabled',
    nnlc: 'NeuralNetworkLateralControl',
    dec: 'DynamicExperimentalControl',
    sccv: 'VisionBasedTurnSpeedControl',
    'scc-v': 'VisionBasedTurnSpeedControl',
    sla: 'SpeedLimitAssistMode',
    speedlimitassist: 'SpeedLimitAssistMode',
    model: 'DrivingModel',
    drivingmodel: 'DrivingModel',
    experimental: 'ExperimentalMode',
    experimentalmode: 'ExperimentalMode',
    torquetuning: 'EnableCustomTorqueTuning',
    longitudinal: 'AlphaLongitudinal',
};

export function resolveSettingKey<T extends { key: string; label: string }>(
    settings: T[],
    rawQuery: string | null | undefined
): T | null {
    if (!rawQuery) return null;
    const decoded = safeDecodeURIComponent(rawQuery).trim();
    if (!decoded) return null;

    // 1. Exact key match
    const exact = settings.find((s) => s.key === decoded);
    if (exact) return exact;

    const lower = decoded.toLowerCase();
    const slug = slugifySetting(decoded);
    const compact = lower.replace(/[^a-z0-9]/g, '');

    // 2. Alias lookup (e.g. CameraOffset / camera-offset -> AdjustCameraOffset)
    const aliasKey = SETTING_KEY_ALIASES[lower] || SETTING_KEY_ALIASES[slug] || SETTING_KEY_ALIASES[compact];
    if (aliasKey) {
        const aliased = settings.find((s) => s.key === aliasKey);
        if (aliased) return aliased;
    }

    // 3. Case-insensitive key or label slug match
    const byKeyOrLabel = settings.find((s) => {
        const keyLower = s.key.toLowerCase();
        const keySlug = slugifySetting(s.key);
        const labelSlug = slugifySetting(s.label);
        return (
            keyLower === lower ||
            keySlug === slug ||
            labelSlug === slug ||
            keyLower.replace(/[^a-z0-9]/g, '') === compact ||
            labelSlug.replace(/-/g, '') === compact
        );
    });
    if (byKeyOrLabel) return byKeyOrLabel;

    // 4. Substring match on key/label for multi-char deep links (e.g. "camera-offset")
    if (compact.length >= 5) {
        const partial = settings.find(
            (s) =>
                s.key.toLowerCase().includes(compact) ||
                slugifySetting(s.label).includes(slug)
        );
        if (partial) return partial;
    }

    return null;
}

export default function HomeClient({ discourseSettings }: HomeClientProps) {
    const { t, tx, locale } = useLanguage();
    const togglesData = useTranslatedToggles();
    const myCar = useMyCar();
    const selectedMake = myCar?.vehicle.make ?? null;
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

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
                    ...(AUTOMATIC_CAPABILITY_NOTES[setting.key] ? {
                        type: 'readonly',
                        default: 'Auto-detected',
                        description: AUTOMATIC_CAPABILITY_NOTES[setting.key],
                        userNote: 'The connected device determines availability from its vehicle fingerprint and installed hardware.',
                    } : {}),
                    ...(setting.key === 'SubaruStopAndGoManualParkingBrake' ? {
                        description: SUBARU_MANUAL_BRAKE_DESCRIPTION,
                        userNote: SUBARU_MANUAL_BRAKE_DESCRIPTION,
                    } : {}),
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

    const scrollToSettingElement = useCallback((canonicalKey: string) => {
        let attempts = 0;
        const tryScroll = () => {
            const el = document.getElementById(canonicalKey);
            if (el) {
                requestAnimationFrame(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            } else if (attempts < 15) {
                attempts++;
                setTimeout(tryScroll, 60);
            }
        };
        setTimeout(tryScroll, 120);
    }, []);

    // Watch for URL ?setting=, ?search=, ?category=, and #hash deep links
    useEffect(() => {
        const syncFromLocation = () => {
            if (typeof window === 'undefined') return;
            const params = new URLSearchParams(window.location.search);
            const settingParam = params.get('setting') || params.get('toggle');
            const searchParam = params.get('search') || params.get('q');
            const categoryParam = params.get('category');
            const rawHash = window.location.hash ? safeDecodeURIComponent(window.location.hash.slice(1)) : '';

            const targetRaw = settingParam || rawHash;
            if (targetRaw) {
                const resolved = resolveSettingKey(allSettings, targetRaw);
                const canonicalKey = resolved ? resolved.key : targetRaw;
                setHighlightedKey(canonicalKey);
                if (resolved) {
                    setActiveCategories((prev) => {
                        if (prev.length === 0) return prev;
                        const standard = prev.filter((id) => id !== 'recommended');
                        const recOnly = prev.includes('recommended');
                        if (
                            (standard.length > 0 && !standard.includes(resolved.categoryId)) ||
                            (recOnly && !resolved.recommended)
                        ) {
                            return [];
                        }
                        return prev;
                    });
                    setSearchQuery((prev) => {
                        if (!prev) return prev;
                        const qLower = prev.toLowerCase();
                        if (
                            !resolved.label.toLowerCase().includes(qLower) &&
                            !resolved.key.toLowerCase().includes(qLower)
                        ) {
                            return '';
                        }
                        return prev;
                    });
                }
                scrollToSettingElement(canonicalKey);
                return;
            }

            if (categoryParam && categories.some((c) => c.id === categoryParam)) {
                setActiveCategories([categoryParam]);
            }
            if (searchParam) {
                setSearchQuery(searchParam);
            }
        };

        syncFromLocation();
        window.addEventListener('hashchange', syncFromLocation);
        window.addEventListener('popstate', syncFromLocation);
        return () => {
            window.removeEventListener('hashchange', syncFromLocation);
            window.removeEventListener('popstate', syncFromLocation);
        };
    }, [allSettings, categories, scrollToSettingElement]);

    const handleSelectSetting = useCallback(
        (rawKey: string, shouldScroll = true) => {
            const resolved = resolveSettingKey(allSettings, rawKey);
            const canonicalKey = resolved ? resolved.key : rawKey;
            setHighlightedKey(canonicalKey);
            if (resolved) {
                setActiveCategories((prev) => {
                    if (prev.length === 0) return prev;
                    const standard = prev.filter((id) => id !== 'recommended');
                    const recOnly = prev.includes('recommended');
                    if (
                        (standard.length > 0 && !standard.includes(resolved.categoryId)) ||
                        (recOnly && !resolved.recommended)
                    ) {
                        return [];
                    }
                    return prev;
                });
                setSearchQuery('');
            }
            if (typeof window !== 'undefined') {
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.set('setting', canonicalKey);
                    url.hash = encodeURIComponent(canonicalKey);
                    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
                } catch {
                    // Ignore history state errors in restricted webviews
                }
            }
            if (shouldScroll) {
                scrollToSettingElement(canonicalKey);
            }
        },
        [allSettings, scrollToSettingElement]
    );

    // The saved car controls the entire settings pipeline, including search and counts,
    // while always keeping an explicitly deep-linked setting reachable.
    const applicableSettings = useMemo(
        () =>
            allSettings.filter(
                (setting) =>
                    setting.key === highlightedKey || isSettingApplicableToMake(setting.key, selectedMake)
            ),
        [allSettings, selectedMake, highlightedKey]
    );

    // Category metadata for filter
    const categoryMeta = useMemo(() => {
        return categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            description: cat.description,
            count: applicableSettings.filter(setting => setting.categoryId === cat.id).length,
        }));
    }, [categories, applicableSettings]);

    // Filter settings by category first
    const categoryFiltered = useMemo(() => {
        if (activeCategories.length === 0) return applicableSettings;

        // Check if 'recommended' filter is active
        const showRecommendedOnly = activeCategories.includes('recommended');
        const standardCategories = activeCategories.filter(id => id !== 'recommended');

        let filtered = applicableSettings;

        // Apply standard category filter if any selected
        if (standardCategories.length > 0) {
            filtered = filtered.filter((setting) => standardCategories.includes(setting.categoryId));
        }

        // Apply recommended filter if selected
        if (showRecommendedOnly) {
            filtered = filtered.filter((setting) => !!setting.recommended);
        }

        return filtered;
    }, [applicableSettings, activeCategories]);

    // Fuzzy search over category-filtered settings (with acronym indexing on label)
    const localSettings = useFuzzySearch({
        items: categoryFiltered,
        keys: ['label', 'key', 'description', 'userNote'],
        query: searchQuery,
        threshold: 0.3,
        acronymKey: 'label',
    });

    const filteredSettings = usePageSearch(categoryFiltered, localSettings, searchQuery, item => ({ type: 'setting', id: item.key, title: item.label }));

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
            {/* Decorative background elements (radial gradient avoids full-viewport blur-3xl filter compositing in Firefox) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none ambient-bg" />



            <div className="relative z-10 max-w-7xl mx-auto px-4 pt-32 pb-8 sm:pt-40 sm:pb-12">
                {/* Header */}
                <Header />

                {/* Settings Content */}
                <SettingsDatabase
                    allSettings={applicableSettings}
                    filteredSettings={filteredSettings}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    activeCategories={activeCategories}
                    onToggleCategory={handleToggleCategory}
                    onClearCategories={handleClearAll}
                    categoryMeta={categoryMeta}
                    highlightedKey={highlightedKey}
                    onSelectSetting={handleSelectSetting}
                    selectedVehicle={myCar ? `${myCar.year} ${myCar.vehicle.make} ${vehicleModelLabel(myCar.vehicle.model, tx)}` : null}
                />


                {/* Footer */}
                <footer className="mt-16 text-center text-slate-400 text-sm lg:hidden">
                    <p>
                        {t('footer.builtFor')} •<TranslatedText text={' '} />
                        <a
                            href="https://www.sunnypilot.ai/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-500 hover:text-cyan-400 transition-colors"
                        >
                            {t('footer.terms')}
                        </a>
                        <TranslatedText text={' '} />•<TranslatedText text={' '} />
                        <a
                            href="https://github.com/sunnypilot/sunnypilot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-500 hover:text-cyan-400 transition-colors"
                        >
                            {t('footer.github')}
                        </a>
                        <TranslatedText text={' '} />•<TranslatedText text={' '} />
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
