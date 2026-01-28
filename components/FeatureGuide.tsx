'use client';

import { useState } from 'react';
import featuresData from '../data/features.json';
import FlagFeedback from './FlagFeedback';

interface Feature {
    id: string;
    name: string;
    fullName: string;
    category: string;
    officialDefinition: string;
    userSummary: string;
    userTranslation: string;
    settingsKeys: string[];
}

export default function FeatureGuide() {
    const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
    const [showGlossary, setShowGlossary] = useState(false);
    const [feedbackFeature, setFeedbackFeature] = useState<Feature | null>(null);

    const features = featuresData.features as Feature[];
    const glossary = featuresData.glossary as Record<string, string>;

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
                <h2 className="text-2xl font-bold text-white mb-2">
                    📖 Feature Guide
                </h2>
                <p className="text-slate-400 text-sm">
                    Official definitions from Sunnypilot documentation • v{featuresData.version}
                </p>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3">
                {features.map((feature) => (
                    <div
                        key={feature.id}
                        className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
                    >
                        {/* Header - Always visible */}
                        <button
                            onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                            className="w-full p-4 text-left flex items-start gap-4 hover:bg-slate-700/30 transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-lg font-bold text-white">{feature.name}</span>
                                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${getCategoryColor(feature.category)}`}>
                                        {feature.category}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 mb-2">{feature.fullName}</p>
                                <p className="text-sm text-slate-300">{feature.userSummary}</p>
                            </div>
                            <svg
                                className={`w-5 h-5 text-slate-500 transition-transform shrink-0 mt-1 ${expandedFeature === feature.id ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setFeedbackFeature(feature);
                            }}
                            className="absolute top-4 right-12 p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Flag this feature"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                        </button>

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
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Official Definition</p>
                                    <p className="text-sm text-slate-300 font-mono leading-relaxed">
                                        {feature.officialDefinition}
                                    </p>
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
                <span className="text-white font-medium">📚 Glossary of Terms</span>
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

            {/* Feedback Modal */}
            {feedbackFeature && (
                <FlagFeedback
                    settingKey={`feature_${feedbackFeature.id}`}
                    settingLabel={`Feature: ${feedbackFeature.name}`}
                    onClose={() => setFeedbackFeature(null)}
                />
            )}
        </div>
    );
}
