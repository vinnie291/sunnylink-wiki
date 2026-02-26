'use client';

import { useState, useMemo, useEffect } from 'react';
import ToggleCard from './ToggleCard';
import SearchFilter from './SearchFilter';
import CategoryFilter from './CategoryFilter';
import EmptyState from './EmptyState';
import ViewToggle from './ViewToggle';
import { useViewMode } from '../hooks/useViewMode';
import { useScrollDirection } from '../hooks/useScrollDirection';

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
    categoryId?: string;
    categoryName?: string;
    categoryIcon?: string;
}

interface SettingsDatabaseProps {
    allSettings: ToggleSetting[];
    filteredSettings: ToggleSetting[];
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    activeCategories: string[];
    onToggleCategory: (id: string) => void;
    onClearCategories: () => void;
    categoryMeta: { id: string; name: string; icon: string; description?: string; count: number }[];
    highlightedKey: string | null;
}

const INITIAL_RENDER_COUNT = 20;

export default function SettingsDatabase({
    allSettings,
    filteredSettings,
    searchQuery,
    setSearchQuery,
    activeCategories,
    onToggleCategory,
    onClearCategories,
    categoryMeta,
    highlightedKey
}: SettingsDatabaseProps) {
    const { viewMode, setViewMode } = useViewMode('settings_page', 'grid');
    const scrollDirection = useScrollDirection();
    const [sortBy, setSortBy] = useState<string>('name-asc');
    const [renderCount, setRenderCount] = useState(INITIAL_RENDER_COUNT);

    const sortedSettings = useMemo(() => {
        return [...filteredSettings].sort((a, b) => {
            let diff = 0;
            switch (sortBy) {
                case 'name-asc':
                    diff = a.label.localeCompare(b.label);
                    break;
                case 'name-desc':
                    diff = b.label.localeCompare(a.label);
                    break;
                case 'category-asc':
                    diff = (a.categoryName || '').localeCompare(b.categoryName || '');
                    break;
                case 'category-desc':
                    diff = (b.categoryName || '').localeCompare(a.categoryName || '');
                    break;
                default: diff = 0;
            }
            return diff;
        });
    }, [filteredSettings, sortBy]);

    // Progressive rendering: render first batch immediately, rest after idle
    useEffect(() => {
        setRenderCount(INITIAL_RENDER_COUNT);

        if (sortedSettings.length <= INITIAL_RENDER_COUNT) return;

        const id = requestAnimationFrame(() => {
            setRenderCount(sortedSettings.length);
        });

        return () => cancelAnimationFrame(id);
    }, [sortedSettings.length, sortBy, searchQuery, activeCategories]);

    const visibleSettings = useMemo(() => {
        return sortedSettings.slice(0, renderCount);
    }, [sortedSettings, renderCount]);

    const handleSort = (key: 'name' | 'category') => {
        // Toggle logic for table headers
        if (key === 'name') {
            setSortBy(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc');
        } else if (key === 'category') {
            setSortBy(prev => prev === 'category-asc' ? 'category-desc' : 'category-asc');
        }
    };

    return (
        <div className="lg:flex lg:gap-8">
            {/* Sidebar - Desktop Only */}
            <aside className="hidden lg:block lg:w-72 lg:shrink-0">
                <div className="sticky top-8 space-y-6">
                    {/* Search */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <SearchFilter
                            value={searchQuery}
                            onChange={setSearchQuery}
                            resultCount={sortedSettings.length}
                            totalCount={allSettings.length}
                            itemLabel="toggles"
                        />
                    </div>

                    {/* Categories */}
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4">
                        <CategoryFilter
                            categories={categoryMeta}
                            activeCategories={activeCategories}
                            onToggleCategory={onToggleCategory}
                            onClearAll={onClearCategories}
                        />
                    </div>

                    {/* Help Card */}
                    <div className="bg-gradient-to-br from-cyan-500/10 to-violet-500/10 rounded-2xl border border-cyan-500/20 p-4">
                        <h3 className="text-sm font-medium text-white mb-2">💡 Quick Tip</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Click the flag icon on any setting to report issues or suggest improvements.
                        </p>
                    </div>

                    {/* Buy Me a Coffee */}
                    <a
                        href="https://buymeacoffee.com/vinhle.co"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl border border-[#FFDD00]/50 text-[#FFDD00] font-bold text-sm transition-all duration-200 hover:bg-[#FFDD00]/10 hover:border-[#FFDD00] hover:scale-[1.02]"
                    >
                        <span className="text-lg">☕</span>
                        Buy me a coffee
                    </a>

                    {/* Footer Links */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/50">
                        <a
                            href="https://www.sunnypilot.ai/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                        >
                            sunnypilot Terms of Service
                        </a>
                        <a
                            href="https://github.com/sunnypilot/sunnypilot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                        >
                            GitHub (sunnypilot)
                        </a>
                    </div>
                </div>
            </aside >

            {/* Mobile Filters - Sticky on scroll */}
            <div className={`lg:hidden sticky top-0 z-20 -mx-4 px-4 pt-2 pb-4 bg-slate-950/95 backdrop-blur-sm space-y-4 mb-6 transition-transform duration-300 ${scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'}`}>
                <SearchFilter
                    value={searchQuery}
                    onChange={setSearchQuery}
                    resultCount={sortedSettings.length}
                    totalCount={allSettings.length}
                    itemLabel="toggles"
                />
                <CategoryFilter
                    categories={categoryMeta}
                    activeCategories={activeCategories}
                    onToggleCategory={onToggleCategory}
                    onClearAll={onClearCategories}
                    collapsible={true}
                />
            </div >

            {/* Main Content Area */}
            < div className="flex-1 min-w-0" >
                {/* Header Controls */}
                < div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4" >
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                            {searchQuery ? (
                                <>
                                    <span>🔍</span> Search Results
                                </>
                            ) : activeCategories.length === 1 ? (
                                <>
                                    <span>{categoryMeta.find(c => c.id === activeCategories[0])?.icon}</span>
                                    {categoryMeta.find(c => c.id === activeCategories[0])?.name}
                                </>
                            ) : activeCategories.length > 1 ? (
                                <><span>⚖️</span> Multiple Categories</>
                            ) : (
                                <><span>⚙️</span> All Settings</>
                            )}
                        </h2>
                        <p className="text-slate-400 text-sm">
                            {searchQuery
                                ? `Found ${sortedSettings.length} settings matching "${searchQuery}"`
                                : activeCategories.length === 1
                                    ? categoryMeta.find(c => c.id === activeCategories[0])?.description
                                    : "Browse and configure Sunnypilot settings."
                            }
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="hidden md:block">
                            <ViewToggle viewMode={viewMode} onChange={setViewMode} id="settings-view" />
                        </div>

                        <div className="relative group min-w-[200px]">
                            <label htmlFor="settings-sort" className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Sort:</span>
                            </label>
                            <select
                                id="settings-sort"
                                aria-label="Sort settings by"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="
                                    appearance-none w-full bg-slate-800/50 border border-slate-700/50 rounded-xl
                                    pl-14 pr-10 py-2.5 text-sm font-medium text-white
                                    focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50
                                    transition-all cursor-pointer hover:bg-slate-800
                                "
                            >
                                <option value="name-asc">Name (A-Z)</option>
                                <option value="name-desc">Name (Z-A)</option>
                                <option value="category-asc">Category (A-Z)</option>
                                <option value="category-desc">Category (Z-A)</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div >

                {
                    sortedSettings.length > 0 ? (
                        viewMode === 'list' ? (
                            <>
                                {/* List view - desktop only */}
                                <div className="hidden md:block bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-800/80 text-slate-400 text-sm uppercase tracking-wider">
                                                    <th className="p-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('name')}>Setting Name</th>
                                                    <th className="p-4 font-medium">Default Value</th>
                                                    <th className="p-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('category')}>Category</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {visibleSettings.map((setting) => (
                                                    <tr
                                                        key={setting.key}
                                                        className={`group hover:bg-slate-800/50 transition-colors ${highlightedKey === setting.key ? 'bg-cyan-500/10' : ''}`}
                                                    >
                                                        <td className="p-4">
                                                            <div className="font-medium text-white">{setting.label}</div>
                                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{setting.key}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`text-sm font-medium ${setting.default !== undefined && setting.default !== null ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                                {setting.default !== undefined && setting.default !== null ? setting.default.toString() : 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-1.5 text-sm text-slate-400">
                                                                <span>{setting.categoryIcon}</span>
                                                                <span className="hidden sm:inline">{setting.categoryName}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Card view fallback - mobile only when list mode is selected */}
                                <div className="md:hidden grid gap-4">
                                    {visibleSettings.map((setting) => (
                                        <div key={setting.key}>
                                            <ToggleCard
                                                setting={setting}
                                                categoryName={setting.categoryName || ''}
                                                categoryIcon={setting.categoryIcon || ''}
                                                categoryId={setting.categoryId || ''}
                                                isHighlighted={setting.key === highlightedKey}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="grid gap-4">
                                {visibleSettings.map((setting) => (
                                    <div key={setting.key}>
                                        <ToggleCard
                                            setting={setting}
                                            categoryName={setting.categoryName || ''}
                                            categoryIcon={setting.categoryIcon || ''}
                                            categoryId={setting.categoryId || ''}
                                            isHighlighted={setting.key === highlightedKey}
                                        />
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <EmptyState
                            searchQuery={searchQuery}
                            onClearSearch={onClearCategories}
                        />
                    )
                }
            </div >
        </div >
    );
}
