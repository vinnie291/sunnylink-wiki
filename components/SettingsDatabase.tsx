'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ToggleCard from './ToggleCard';
import SearchFilter from './SearchFilter';
import CategoryFilter from './CategoryFilter';
import EmptyState from './EmptyState';
import ViewToggle from './ViewToggle';
import { useViewMode } from '../hooks/useViewMode';

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
    const [sortBy, setSortBy] = useState<'name' | 'category'>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const sortedSettings = useMemo(() => {
        return [...filteredSettings].sort((a, b) => {
            let diff = 0;
            switch (sortBy) {
                case 'name':
                    diff = a.label.localeCompare(b.label);
                    break;
                case 'category':
                    diff = (a.categoryName || '').localeCompare(b.categoryName || '');
                    break;
                default: diff = 0;
            }
            return sortDirection === 'asc' ? diff : -diff;
        });
    }, [filteredSettings, sortBy, sortDirection]);

    const handleSort = (key: 'name' | 'category') => {
        if (sortBy === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortDirection('asc');
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
                </div>
            </aside>

            {/* Mobile Filters */}
            <div className="lg:hidden space-y-4 mb-6">
                <SearchFilter
                    value={searchQuery}
                    onChange={setSearchQuery}
                    resultCount={sortedSettings.length}
                    totalCount={allSettings.length}
                />
                <CategoryFilter
                    categories={categoryMeta}
                    activeCategories={activeCategories}
                    onToggleCategory={onToggleCategory}
                    onClearAll={onClearCategories}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
                {/* Header Controls */}
                <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
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
                        <ViewToggle viewMode={viewMode} onChange={setViewMode} id="settings-view" />

                        <div className="relative group min-w-[160px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Sort:</span>
                            </div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="
                                    appearance-none w-full bg-slate-800/50 border border-slate-700/50 rounded-xl
                                    pl-14 pr-10 py-2.5 text-sm font-medium text-white
                                    focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50
                                    transition-all cursor-pointer hover:bg-slate-800
                                "
                            >
                                <option value="name">Name</option>
                                <option value="category">Category</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-slate-400 text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {sortedSettings.length > 0 ? (
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
                                                <th className="p-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('name')}>Setting Name</th>
                                                <th className="p-4 font-medium">Default Value</th>
                                                <th className="p-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('category')}>Category</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {sortedSettings.map((setting) => (
                                                <motion.tr
                                                    layout
                                                    layoutId={`setting-${setting.key}`}
                                                    key={setting.key}
                                                    className={`group hover:bg-slate-800/50 transition-colors ${highlightedKey === setting.key ? 'bg-cyan-500/10' : ''}`}
                                                >
                                                    <td className="p-4">
                                                        <div className="font-medium text-white">{setting.label}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{setting.key}</div>
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
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        ) : (
                            <div key="grid-view" className="grid gap-4">
                                {sortedSettings.map((setting) => (
                                    <motion.div
                                        layout
                                        layoutId={`setting-${setting.key}`}
                                        key={setting.key}
                                    >
                                        <ToggleCard
                                            setting={setting}
                                            categoryName={setting.categoryName || ''}
                                            categoryIcon={setting.categoryIcon || ''}
                                            isHighlighted={setting.key === highlightedKey}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                ) : (
                    <EmptyState
                        searchQuery={searchQuery}
                        onClearSearch={onClearCategories}
                    />
                )}
            </div>
        </div>
    );
}
