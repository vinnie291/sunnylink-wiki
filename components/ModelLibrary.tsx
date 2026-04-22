'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Fuse from 'fuse.js';

import ViewToggle from './ViewToggle';
import SearchFilter from './SearchFilter';
import MobileCategorySidebar from './MobileCategorySidebar';
import SidebarInlineControls from './SidebarInlineControls';
import { useViewMode } from '../hooks/useViewMode';
import { useStickySearch } from '../hooks/useStickySearch';
import { useDesktopSidebarSticky } from '../hooks/useDesktopSidebarSticky';
import { useLanguage } from '../lib/i18n';
import { useTranslatedModels } from '../lib/useTranslatedData';

const CategorySidebarButton = dynamic(() => import('./CategorySidebarButton'), { ssr: false });

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
    const [copied, setCopied] = useState(false);

    const handleCopyLink = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}?tab=models#${encodeURIComponent(model.name)}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.history.replaceState(null, '', `?tab=models#${encodeURIComponent(model.name)}`);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };


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
            id={model.name}
            className="bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-cyan-500/50 transition-all duration-300 group overflow-hidden"
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white truncate">{model.name}</h3>
                        {model.badge && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getBadgeColor(model.badge)}`}>
                                {model.badge}
                            </span>
                        )}

                        {/* Flag Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const title = encodeURIComponent(`Issue with Model: ${model.name}`);
                                const body = encodeURIComponent(`describe the issue with this model here...`);
                                window.open(`https://github.com/vinnie291/sunnylink-wiki/issues/new?title=${title}&body=${body}`, '_blank');
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Flag this model"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                            </svg>
                        </button>

                        {/* Share Button */}
                        <button
                            onClick={handleCopyLink}
                            className="p-1 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                            title={copied ? 'Copied!' : 'Share this model'}
                        >
                            {copied ? (
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                            )}
                        </button>

                    </div>
                    <span className="text-xs text-slate-500">{model.date}</span>
                </div>
                {model.communityScore !== undefined && (
                    <div className="flex flex-col items-end shrink-0">
                        <span className={`text-2xl font-bold ${getScoreColor(model.communityScore)}`}>
                            {model.communityScore !== null ? `${model.communityScore}%` : '--'}
                        </span>
                        {model.totalVotes ? (
                            <span className="text-[10px] text-slate-500">{model.totalVotes} votes</span>
                        ) : null}
                    </div>
                )}


            </div>

            {/* Sentiment Bar */}
            {model.sentiment && (
                <div className="mb-4">
                    <SentimentBar sentiment={model.sentiment} />
                    <div className="grid grid-cols-4 text-[9px] text-slate-600 mt-1">
                        <span>Great {model.sentiment.great}%</span>
                        <span className="text-center">Good {model.sentiment.good}%</span>
                        <span className="text-center">OK {model.sentiment.ok}%</span>
                        <span className="text-right">Bad {model.sentiment.bad}%</span>
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
            <p className="text-sm text-slate-300 leading-relaxed mb-3 break-words">
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

            {/* Tested On — always visible */}
            {model.testedOn && model.testedOn.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
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
        </div>
    );
}

// Helper for Vibe Icons
const getVibeIcon = (consensus?: string) => {
    switch (consensus?.toLowerCase()) {
        case 'aggressive': return '🚀';
        case 'standard': return '⚖️';
        case 'relaxed': return '🛋️';
        case 'comfort': return '🧸';
        default: return '🤖';
    }
};

export default function ModelLibrary() {
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [showVibeGuide, setShowVibeGuide] = useState(false);
    const [showMobileCategories, setShowMobileCategories] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { t } = useLanguage();


    // Keyboard shortcut handled by SearchFilter component

    // Hash-based scroll anchoring for shared model links
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash) {
                const modelName = decodeURIComponent(hash.slice(1));
                // Switch to "All Models" so the target card is rendered
                setActiveCategory('all');
                // Delay to allow the grid to render
                setTimeout(() => {
                    const el = document.getElementById(modelName);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('ring-2', 'ring-cyan-500/70');
                        setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-500/70'), 3000);
                    }
                }, 300);
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const [sortBy, setSortBy] = useState<string>('date-desc');
    const { viewMode, setViewMode } = useViewMode('models_page', 'grid');
    const { sentinelRef, isSticky } = useStickySearch();
    const { sidebarSentinelRef, isSidebarSticky } = useDesktopSidebarSticky();

    const modelsData = useTranslatedModels();
    const rawCategories = modelsData.categories as ModelCategory[];
    const vibeGuide = modelsData.vibeGuide as Record<string, VibeGuide>;

    const categories = useMemo(() => {
        const uniqueModels = new Map<string, Model>();
        rawCategories.flatMap(c => c.models).forEach(m => {
            if (!uniqueModels.has(m.name)) uniqueModels.set(m.name, m);
        });

        const allCategory: ModelCategory = {
            id: 'all',
            name: t('models.allModels'),
            description: t('models.allModelsDescription'),
            icon: '📚',
            models: Array.from(uniqueModels.values())
        };

        return [allCategory, ...rawCategories];
    }, [rawCategories, t]);

    // Filter models based on search


    const baseModels = searchQuery
        ? categories[0].models // search across 'All Models'
        : categories.find(c => c.id === activeCategory)?.models || [];

    // Fuzzy search using Fuse.js for models (searches name, consensus, tags)
    const modelsToDisplay = useMemo(() => {
        if (!searchQuery || searchQuery.trim().length === 0) return baseModels;

        const fuse = new Fuse(baseModels, {
            keys: ['name', 'consensus', 'tags'],
            threshold: 0.3,
            includeScore: true,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });

        return fuse.search(searchQuery).map(result => result.item);
    }, [baseModels, searchQuery]);

    const activeModels = useMemo(() => {
        const sorted = [...modelsToDisplay].sort((a, b) => {
            let diff = 0;
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();

            switch (sortBy) {
                case 'name-asc':
                    diff = a.name.localeCompare(b.name);
                    break;
                case 'name-desc':
                    diff = b.name.localeCompare(a.name);
                    break;
                case 'score-asc':
                    diff = (a.communityScore || 0) - (b.communityScore || 0);
                    break;
                case 'score-desc':
                    diff = (b.communityScore || 0) - (a.communityScore || 0);
                    break;
                case 'date-asc': // Oldest first
                    diff = dateA - dateB;
                    break;
                case 'date-desc': // Newest first
                    diff = dateB - dateA;
                    break;
                default: diff = 0;
            }
            return diff;
        });
        return sorted;
    }, [modelsToDisplay, sortBy]);

    const handleSort = (key: 'name' | 'score' | 'date') => {
        // Toggle logic for table headers
        if (key === 'name') {
            setSortBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc');
        } else if (key === 'score') {
            setSortBy(prev => prev === 'score-desc' ? 'score-asc' : 'score-desc');
        } else if (key === 'date') {
            setSortBy(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc');
        }
    };

    const [isSearchActive, setIsSearchActive] = useState(false);

    // Watch for data-search-active attribute to force sticky behavior when typing
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsSearchActive(document.documentElement.hasAttribute('data-search-active'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-search-active'] });
        return () => observer.disconnect();
    }, []);

    const effectiveIsSticky = isSticky || isSearchActive;

    return (
        <div className="lg:flex lg:gap-8 overflow-x-hidden">
            {/* Mobile Category Sidebar */}
            <MobileCategorySidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                categories={categories}
                mode="models"
                activeCategory={activeCategory}
                onSelectCategory={(id) => {
                    setActiveCategory(id);
                    setSearchQuery('');
                }}
                searchQuery={searchQuery}
            />
            <CategorySidebarButton
                onClick={() => setSidebarOpen(!sidebarOpen)}
                isSticky={effectiveIsSticky}
                isSidebarOpen={sidebarOpen}
            />

            {/* Sidebar - Desktop Only */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0">
                {/* Sentinel: detects when sidebar becomes sticky */}
                <div ref={sidebarSentinelRef} className="h-0" />
                <div className="sticky top-8 space-y-6">
                    {/* Inline GlobalControls — visible when sidebar is sticky */}
                    <SidebarInlineControls visible={isSidebarSticky} />
                    {/* Search */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <SearchFilter
                            value={searchQuery}
                            onChange={setSearchQuery}
                            resultCount={activeModels.length}
                            totalCount={categories[0].models.length} // All models count
                            itemLabel="models"
                        />
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
                        <span className="font-medium text-sm">📖 {t('models.vibeGuide')}</span>
                        <svg className={`w-4 h-4 transition-transform ${showVibeGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Categories */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">{t('filter.categories')}</h2>
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
                                    <span className="shrink-0 text-lg">{cat.icon}</span>
                                    <span className="flex-1 break-words">{cat.name}</span>
                                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs ${activeCategory === cat.id && !searchQuery ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
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
                {/* Sentinel: marks the search bar's natural position */}
                <div ref={sentinelRef} className="lg:hidden h-0" />

                {/* Mobile Filters - Sticky only after scrolling past natural position */}
                <div className={`lg:hidden -mx-4 px-4 pt-2 pb-4 space-y-4 mb-6 transition-all duration-300 relative ${effectiveIsSticky ? 'sticky top-16 z-20' : ''}`}>
                    <SearchFilter
                        value={searchQuery}
                        onChange={setSearchQuery}
                        resultCount={activeModels.length}
                        totalCount={categories[0].models.length}
                        itemLabel="models"
                    />

                    <div className={`transition-all duration-300 overflow-hidden ${effectiveIsSticky ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="space-y-4 pt-2">
                            <button
                                onClick={() => setShowVibeGuide(!showVibeGuide)}
                                className="flex items-center justify-between w-full text-left"
                            >
                                <span className="text-sm text-slate-500 uppercase tracking-wider font-medium">{t('models.vibeGuide')}</span>
                                <svg
                                    className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${showVibeGuide ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <div className={`grid gap-2 transition-all duration-300 overflow-hidden ${showVibeGuide ? 'max-h-[1000px] opacity-100 mt-2 pb-4' : 'max-h-0 opacity-0 mt-0'}`}>
                                {Object.entries(vibeGuide).map(([key, guide]) => (
                                    <div key={key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                        <h4 className="text-white font-semibold text-xs mb-1">{guide.title}</h4>
                                        <p className="text-[10px] text-slate-500 mb-1">{guide.includes}</p>
                                        <p className="text-[10px] text-slate-400 mb-1">{guide.vibe}</p>
                                        <p className="text-[10px] text-emerald-400">
                                            <span className="font-medium">Best:</span> {guide.bestFor}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowMobileCategories(!showMobileCategories)}
                                    className="flex items-center justify-between w-full text-left"
                                >
                                    <span className="text-sm text-slate-500 uppercase tracking-wider font-medium">{t('filter.categories')}</span>
                                    <svg
                                        className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${showMobileCategories ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div className={`flex flex-wrap gap-2 transition-all duration-300 overflow-hidden ${showMobileCategories ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                setActiveCategory(cat.id);
                                                setSearchQuery('');
                                            }}
                                            className={`
                                                max-w-full flex items-center justify-between shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all text-left border
                                                ${activeCategory === cat.id && !searchQuery
                                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                                                }
                                            `}
                                        >
                                            <span className="shrink-0 mr-2">{cat.icon}</span>
                                            <span className="flex-1 break-words">{cat.name}</span>
                                            <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded-md text-xs ${activeCategory === cat.id && !searchQuery ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                                                {cat.models.length}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Header with Sort */}
                <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                            {searchQuery ? (
                                <><span>🔍</span> {t('models.title')}</>
                            ) : (
                                <>
                                    <span>{categories.find(c => c.id === activeCategory)?.icon || '📚'}</span>
                                    {categories.find(c => c.id === activeCategory)?.name || 'All Models'}
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

                    {/* Sort Dropdown & View Toggle */}
                    <div className="flex flex-wrap items-center gap-4">
                        <ViewToggle viewMode={viewMode} onChange={setViewMode} id="models-view" />

                        <div className="relative group flex items-center bg-slate-800/50 border border-slate-700/50 rounded-xl focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50 transition-all hover:bg-slate-800 cursor-pointer">
                            <div className="pl-3 flex items-center pointer-events-none whitespace-nowrap">
                                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">
                                    {t('settings.sort') || 'Sort:'}
                                </span>
                            </div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="
                                    appearance-none outline-none bg-transparent w-full
                                    pl-2 pr-10 py-2.5 text-sm font-medium text-white
                                    cursor-pointer
                                "
                            >
                                <option value="date-desc">{t('settings.sortDateNewest')}</option>
                                <option value="date-asc">{t('settings.sortDateOldest')}</option>
                                <option value="name-asc">{t('settings.sortNameAZ')}</option>
                                <option value="name-desc">{t('settings.sortNameZA')}</option>
                                <option value="score-desc">{t('settings.sortScoreHighLow')}</option>
                                <option value="score-asc">{t('settings.sortScoreLowHigh')}</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vibe Guide Content (Shows above grid if active) */}
                {showVibeGuide && (
                    <div className="hidden lg:grid mb-8 gap-3 md:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-300">
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

                {/* Model Grid / List */}
                <div className="pr-20 lg:pr-0">
                {activeModels.length > 0 ? (
                    <AnimatePresence mode="wait">
                        {viewMode === 'list' ? (
                            <motion.div
                                key="list-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden"
                            >
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800/80 text-slate-400 text-sm uppercase tracking-wider">
                                                <th className="p-3 md:p-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('name')}>Name</th>
                                                <th className="p-3 md:p-4 font-medium cursor-pointer hover:text-white whitespace-nowrap" onClick={() => handleSort('date')}>Date</th>
                                                <th className="p-3 md:p-4 font-medium cursor-pointer hover:text-white whitespace-nowrap" onClick={() => handleSort('score')}>Score</th>
                                                <th className="hidden md:table-cell p-4 font-medium">Badges</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {activeModels.map((model) => (
                                                <motion.tr
                                                    layout
                                                    key={model.name}
                                                    className="group hover:bg-slate-800/50 cursor-pointer transition-colors"
                                                >
                                                    <td className="p-3 md:p-4 font-medium text-white">
                                                        <div className="flex items-center gap-2 md:gap-3">
                                                            <span className="text-lg md:text-2xl">{getVibeIcon(model.consensus)}</span>
                                                            <span className="text-sm md:text-base">{model.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 md:p-4 text-slate-400 text-xs md:text-sm whitespace-nowrap">{model.date}</td>
                                                    <td className="p-3 md:p-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-cyan-400 font-bold text-sm">{model.communityScore}</span>
                                                            <div className="hidden sm:block w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                                <div className="h-full bg-cyan-500" style={{ width: `${(model.communityScore || 0) * 10}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="hidden md:table-cell p-4">
                                                        {model.badge && (
                                                            <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                                {model.badge}
                                                            </span>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ) : (
                            <div key="grid-view" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
                                {activeModels.map((model) => (
                                    <motion.div
                                        layout
                                        key={model.name}
                                        className="h-full"
                                    >
                                        <ModelCard
                                            model={model}

                                        />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                ) : (
                    <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                        <span className="text-4xl mb-4 block">🔍</span>
                        <h3 className="text-xl font-medium text-white mb-2">No models found</h3>
                        <p className="text-slate-400">Try adjusting your search terms</p>
                    </div>
                )}
                </div>

            </div>


        </div>
    );
}

