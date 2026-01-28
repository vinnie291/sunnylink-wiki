'use client';

import { useState } from 'react';
import modelsData from '../data/models.json';

interface SentimentData {
    great: number;
    good: number;
    ok: number;
    bad: number;
}

interface Model {
    name: string;
    date: string;
    tags?: string[];
    consensus?: string;
    vibe?: string;
    badge?: string;
    communityScore?: number;
    totalVotes?: number;
    sentiment?: SentimentData;
    bestFor?: string;
    testedOn?: string[];
    steeringFeel?: string;
    note?: string;
    forumUrl?: string;
}

interface ModelCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    models: Model[];
}

interface VibeGuide {
    title: string;
    includes: string;
    vibe: string;
    bestFor: string;
    recommendation?: string;
}

// Sentiment Bar Component
function SentimentBar({ sentiment }: { sentiment: SentimentData }) {
    return (
        <div className="w-full h-1.5 flex rounded-full overflow-hidden" title="Great / Good / OK / Bad">
            <div style={{ width: `${sentiment.great}%` }} className="bg-emerald-500" />
            <div style={{ width: `${sentiment.good}%` }} className="bg-blue-500" />
            <div style={{ width: `${sentiment.ok}%` }} className="bg-yellow-500" />
            <div style={{ width: `${sentiment.bad}%` }} className="bg-red-500" />
        </div>
    );
}

// Model Card Component
function ModelCard({ model }: { model: Model }) {
    const [expanded, setExpanded] = useState(false);

    const getBadgeColor = (badge?: string) => {
        const colors: Record<string, string> = {
            'FLAGSHIP': 'text-emerald-400 bg-emerald-900/40 border-emerald-500/30',
            'POPULAR': 'text-amber-400 bg-amber-900/40 border-amber-500/30',
            'LEGENDARY': 'text-yellow-400 bg-yellow-900/40 border-yellow-500/30',
            'NEW': 'text-cyan-400 bg-cyan-900/40 border-cyan-500/30',
            'EXPERIMENTAL': 'text-orange-400 bg-orange-900/40 border-orange-500/30',
            'DEV': 'text-red-400 bg-red-900/40 border-red-500/30',
            'HIDDEN GEM': 'text-pink-400 bg-pink-900/40 border-pink-500/30',
        };
        return colors[badge || ''] || 'text-slate-400 bg-slate-800/40 border-slate-600/30';
    };

    const getScoreColor = (score?: number) => {
        if (!score) return 'text-slate-400';
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-blue-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getTagIcon = (tag: string) => {
        const icons: Record<string, string> = {
            'Smart': '🧠',
            'Aggressive': '⚡',
            'Comfort': '🛋️',
            'Smooth': '🌊',
            'Stiff': '🔒',
            'Highway': '🛣️',
            'City': '🏙️',
            'Curves': '🔄',
            'Trucks': '🚚',
            'Vision': '👁️',
            'Rain': '🌧️',
        };
        return icons[tag] || '•';
    };

    return (
        <div
            className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer group"
            onClick={() => setExpanded(!expanded)}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white truncate">{model.name}</h3>
                        {model.badge && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getBadgeColor(model.badge)}`}>
                                {model.badge}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-slate-500">{model.date}</span>
                </div>
                {model.communityScore !== undefined && (
                    <div className="flex flex-col items-end ml-3">
                        <span className={`text-2xl font-bold ${getScoreColor(model.communityScore)}`}>
                            {model.communityScore}%
                        </span>
                        {model.totalVotes && (
                            <span className="text-[10px] text-slate-500">{model.totalVotes} votes</span>
                        )}
                    </div>
                )}
            </div>

            {/* Sentiment Bar */}
            {model.sentiment && (
                <div className="mb-4">
                    <SentimentBar sentiment={model.sentiment} />
                    <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                        <span>Great {model.sentiment.great}%</span>
                        <span>Good {model.sentiment.good}%</span>
                        <span>OK {model.sentiment.ok}%</span>
                        <span>Bad {model.sentiment.bad}%</span>
                    </div>
                </div>
            )}

            {/* Tags */}
            {model.tags && model.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {model.tags.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-slate-800/60 text-slate-300 border border-slate-700/50"
                        >
                            <span>{getTagIcon(tag)}</span>
                            <span>{tag}</span>
                        </span>
                    ))}
                </div>
            )}

            {/* Vibe Check / Consensus */}
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
                {model.consensus}
                {model.note && (
                    <span className="text-yellow-300/80 italic"> {model.note}</span>
                )}
            </p>

            {/* Footer Badges */}
            <div className="flex flex-wrap gap-2">
                {model.bestFor && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        <span>🎯</span> Best for: {model.bestFor}
                    </span>
                )}
                {model.steeringFeel && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-slate-700/50 text-slate-300 border border-slate-600/50">
                        <span>🎮</span> {model.steeringFeel}
                    </span>
                )}
                {model.forumUrl && (
                    <a
                        href={model.forumUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                    >
                        <span>💬</span> Discuss
                    </a>
                )}
            </div>

            {/* Expandable: Tested On */}
            {expanded && model.testedOn && model.testedOn.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 animate-in fade-in duration-200">
                    <p className="text-xs text-slate-500 mb-1">🚗 Tested on:</p>
                    <div className="flex flex-wrap gap-1">
                        {model.testedOn.map((car) => (
                            <span key={car} className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400">
                                {car}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Expand hint */}
            {model.testedOn && model.testedOn.length > 0 && (
                <div className="text-center mt-2">
                    <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">
                        {expanded ? '▲ Click to collapse' : '▼ Click for vehicle compatibility'}
                    </span>
                </div>
            )}
        </div>
    );
}

export default function ModelLibrary() {
    const [activeCategory, setActiveCategory] = useState<string>('favorites');
    const [showVibeGuide, setShowVibeGuide] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const categories = modelsData.categories as ModelCategory[];
    const vibeGuide = modelsData.vibeGuide as Record<string, VibeGuide>;

    // Filter models based on search
    const filteredCategories = categories.map(cat => ({
        ...cat,
        models: cat.models.filter(model =>
            model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            model.consensus?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            model.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    })).filter(cat => cat.models.length > 0 || !searchQuery);

    const activeModels = searchQuery
        ? filteredCategories.flatMap(cat => cat.models)
        : categories.find(c => c.id === activeCategory)?.models || [];

    return (
        <div className="lg:flex lg:gap-8">
            {/* Sidebar - Desktop Only */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0">
                <div className="sticky top-8 space-y-6">
                    {/* Search */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search models..."
                                className="w-full px-4 py-3 pl-10 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 text-sm"
                            />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Vibe Guide Toggle */}
                    <button
                        onClick={() => setShowVibeGuide(!showVibeGuide)}
                        className={`
                            w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all
                            ${showVibeGuide
                                ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border-cyan-500/30 text-white'
                                : 'bg-slate-800/30 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }
                        `}
                    >
                        <span className="font-medium text-sm">📖 Vibe Guide</span>
                        <svg className={`w-4 h-4 transition-transform ${showVibeGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Categories */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Categories</h2>
                        <div className="space-y-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setActiveCategory(cat.id);
                                        setSearchQuery('');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left
                                        transition-all duration-200 border
                                        ${activeCategory === cat.id && !searchQuery
                                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                            : 'bg-slate-700/30 text-slate-400 border-transparent hover:bg-slate-700/50 hover:text-white'
                                        }
                                    `}
                                >
                                    <span className="text-lg">{cat.icon}</span>
                                    <span className="flex-1 truncate">{cat.name}</span>
                                    <span className={`px-2 py-0.5 rounded-md text-xs ${activeCategory === cat.id && !searchQuery ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                                        {cat.models.length}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
                {/* Mobile Filters */}
                <div className="lg:hidden space-y-4 mb-6">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search models..."
                            className="w-full px-4 py-3 pl-10 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setSearchQuery('');
                                }}
                                className={`
                                    shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border
                                    ${activeCategory === cat.id && !searchQuery
                                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                        : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                                    }
                                `}
                            >
                                <span className="mr-2">{cat.icon}</span>
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowVibeGuide(!showVibeGuide)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300"
                    >
                        <span className="font-medium text-sm">📖 Vibe Guide</span>
                        <svg className={`w-4 h-4 transition-transform ${showVibeGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* Header (Desktop hidden, kept for mobile if needed, or unify) */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                        {searchQuery ? (
                            <><span>🔍</span> Search Results</>
                        ) : (
                            <>
                                <span>{categories.find(c => c.id === activeCategory)?.icon}</span>
                                {categories.find(c => c.id === activeCategory)?.name}
                            </>
                        )}
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {searchQuery
                            ? `Found ${activeModels.length} models matching "${searchQuery}"`
                            : categories.find(c => c.id === activeCategory)?.description
                        }
                    </p>
                </div>

                {/* Vibe Guide Content (Shows above grid if active) */}
                {showVibeGuide && (
                    <div className="mb-8 grid gap-3 md:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        {Object.entries(vibeGuide).map(([key, guide]) => (
                            <div key={key} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                <h4 className="text-white font-semibold text-sm mb-1">{guide.title}</h4>
                                <p className="text-xs text-slate-500 mb-2">{guide.includes}</p>
                                <p className="text-xs text-slate-400 mb-2">{guide.vibe}</p>
                                <p className="text-xs text-emerald-400">
                                    <span className="font-medium">Best for:</span> {guide.bestFor}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Model Grid */}
                {activeModels.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                        {activeModels.map((model) => (
                            <ModelCard key={model.name} model={model} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                        <span className="text-4xl mb-4 block">🔍</span>
                        <h3 className="text-xl font-medium text-white mb-2">No models found</h3>
                        <p className="text-slate-400">Try adjusting your search terms</p>
                    </div>
                )}
            </div>
        </div>
    );
}

