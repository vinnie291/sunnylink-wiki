'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../lib/i18n';
import { useTranslatedFeatures } from '../lib/useTranslatedData';


interface Feature {
    id: string;
    name: string;
    fullName: string;
    category: string;
    officialDefinition: string;
    userSummary: string;
    userTranslation: string;
    settingsKeys: string[];
    docUrl?: string;
    discourseHtml?: string;
}

interface FeatureGuideProps {
    discourseFeatures?: Record<string, string>;
}

export default function FeatureGuide({ discourseFeatures }: FeatureGuideProps) {
    const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
    const [showGlossary, setShowGlossary] = useState(false);
    const { t, locale } = useLanguage();
    const featuresData = useTranslatedFeatures();

    // Enrich features with Discourse data (English only)
    const features = useMemo(() => {
        const rawFeatures = featuresData.features as Feature[];
        return rawFeatures.map((feature) => {
            if (locale === 'en' && discourseFeatures) {
                const normalizedName = feature.name.toLowerCase().trim();
                const normalizedFullName = feature.fullName.toLowerCase().trim();
                const html = discourseFeatures[normalizedName] ?? discourseFeatures[normalizedFullName];
                if (html) {
                    return { ...feature, discourseHtml: html };
                }
            }
            return feature;
        });
    }, [featuresData.features, locale, discourseFeatures]);
    const glossary = featuresData.glossary as Record<string, string>;
    
    // Hash anchoring
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash) {
                const featureId = decodeURIComponent(hash.slice(1));
                // Check if it's a feature ID
                const targetFeature = features.find((f: Feature) => f.id === featureId);
                if (targetFeature) {
                    setExpandedFeature(featureId);
                    setTimeout(() => {
                        const el = document.getElementById(featureId);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            el.classList.add('ring-2', 'ring-cyan-500/70', 'bg-cyan-500/10');
                            setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-500/70', 'bg-cyan-500/10'), 3000);
                        }
                    }, 300);
                }
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [features]);

    // Scroll to top of expanded feature (only when opening, not closing)
    useEffect(() => {
        if (expandedFeature) {
            // Skip if this was triggered by hash navigation (already handled above)
            const hash = window.location.hash;
            if (hash && decodeURIComponent(hash.slice(1)) === expandedFeature) return;

            // Small delay to allow DOM update before scrolling
            setTimeout(() => {
                const el = document.getElementById(expandedFeature);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }, [expandedFeature]);

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            'Core Control': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            'Compatibility': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            'Speed Control': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            'Navigation': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
            'Vehicle Specific': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        };
        return colors[category] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-100 mb-2">
                    📖 {t('features.title')}
                </h2>
                <p className="text-slate-400 text-sm">
                    Official definitions from Sunnypilot documentation • v{featuresData.version}
                </p>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3">
                {features.map((feature: Feature) => (
                    <div
                        key={feature.id}
                        id={feature.id}
                        className="relative rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden scroll-mt-32"
                    >
                        {/* Header - Always visible */}
                        <div
                            role="button"
                            onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                            className="w-full p-4 text-left flex items-start gap-4 hover:bg-slate-700/30 transition-colors cursor-pointer"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-lg font-bold text-slate-100">{feature.name}</span>
                                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${getCategoryColor(feature.category)}`}>
                                        {feature.category}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 mb-2">{feature.fullName}</p>
                                <p className="text-sm text-slate-300">{feature.userSummary}</p>
                            </div>

                            {/* Flag Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const title = encodeURIComponent(`Issue with Feature: ${feature.name}`);
                                    const body = encodeURIComponent(`describe the issue with this feature here...`);
                                    window.open(`https://github.com/vinnie291/sunnylink-wiki/issues/new?title=${title}&body=${body}`, '_blank');
                                }}
                                className="mt-1 p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Flag this feature"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                            </button>

                            <svg
                                className={`w-5 h-5 text-slate-500 transition-transform shrink-0 mt-1 ${expandedFeature === feature.id ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>



                        {/* Expanded Content */}
                        {expandedFeature === feature.id && (
                            <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
                                {/* User Translation */}
                                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                    <p className="text-emerald-400 text-sm">
                                        <span className="font-semibold">🗣️ In Plain English:</span> {feature.userTranslation}
                                    </p>
                                </div>

                                {/* Official Definition */}
                                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-xs text-slate-500 uppercase tracking-wide">Official Definition</p>
                                        {feature.docUrl && (
                                            <a
                                                href={feature.docUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span>Read More</span>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-300 font-mono leading-relaxed">
                                        {feature.officialDefinition}
                                    </p>
                                    {feature.discourseHtml && (
                                        <div className="mt-3 pt-3 border-t border-slate-700/30">
                                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Official Docs (Full)</p>
                                            <div
                                                className="discourse-content text-sm text-slate-300 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: feature.discourseHtml }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Related Settings */}
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Related Settings</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {feature.settingsKeys.map((key) => (
                                            <a
                                                key={key}
                                                href={`#${key}`}
                                                className="px-2 py-1 text-xs rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
                                            >
                                                {key}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Glossary Toggle */}
            <button
                onClick={() => setShowGlossary(!showGlossary)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/30 border border-slate-700/50 text-left hover:bg-slate-700/30 transition-colors"
            >
                <span className="text-slate-100 font-medium">📚 Glossary of Terms</span>
                <svg className={`w-5 h-5 text-slate-500 transition-transform ${showGlossary ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Glossary Content */}
            {showGlossary && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(glossary).map(([term, definition]) => (
                        <div key={term} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                            <span className="text-cyan-400 font-mono font-bold text-sm">{term}</span>
                            <span className="text-slate-500 mx-2">—</span>
                            <span className="text-slate-400 text-sm">{definition}</span>
                        </div>
                    ))}
                </div>
            )}


        </div>
    );
}
