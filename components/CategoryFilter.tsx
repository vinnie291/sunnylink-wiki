'use client';

import { useState } from 'react';

interface Category {
    id: string;
    name: string;
    icon: string;
    count: number;
}

interface CategoryFilterProps {
    categories: Category[];
    activeCategories: string[];
    onToggleCategory: (categoryId: string) => void;
    onClearAll: () => void;
    collapsible?: boolean;
    initialOpen?: boolean;
}

export default function CategoryFilter({
    categories,
    activeCategories,
    onToggleCategory,
    onClearAll,
    collapsible = false,
    initialOpen = false
}: CategoryFilterProps) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const isAllActive = activeCategories.length === 0;
    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);

    const toggleOpen = () => setIsOpen(!isOpen);

    const containerClasses = collapsible
        ? `flex flex-wrap gap-2 transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`
        : 'flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide lg:flex-wrap lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0';

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between" onClick={collapsible ? toggleOpen : undefined}>
                <button
                    className={`flex items-center gap-2 text-sm text-slate-400 uppercase tracking-wider font-medium w-full text-left ${collapsible ? 'cursor-pointer hover:text-slate-300' : ''}`}
                    disabled={!collapsible}
                >
                    <span>Categories</span>
                    {collapsible && (
                        <svg
                            className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </button>

                {!isAllActive && !collapsible && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClearAll();
                        }}
                        className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                        Show all
                    </button>
                )}
                {collapsible && !isAllActive && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClearAll();
                        }}
                        className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>

            <div className={containerClasses}>
                {/* All Button */}
                <button
                    onClick={onClearAll}
                    type="button"
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shrink-0
            transition-all duration-200 border
            ${isAllActive
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                        }
          `}
                >
                    <span>🏠</span>
                    <span>All</span>
                    <span className={`
            px-1.5 py-0.5 rounded-md text-xs
            ${isAllActive ? 'bg-cyan-500/30' : 'bg-slate-700/50'}
          `}>
                        {totalCount}
                    </span>
                </button>

                {/* Recommended Filter */}
                <button
                    onClick={() => onToggleCategory('recommended')}
                    type="button"
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shrink-0
            transition-all duration-200 border
            ${activeCategories.includes('recommended')
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                        }
          `}
                >
                    <span className="text-emerald-400">★</span>
                    <span>Recommended</span>
                </button>

                {/* Category Buttons */}
                {categories.map((category) => {
                    const isActive = activeCategories.includes(category.id);
                    return (
                        <button
                            key={category.id}
                            onClick={() => onToggleCategory(category.id)}
                            type="button"
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shrink-0
                transition-all duration-200 border
                ${isActive
                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                }
              `}
                        >
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                            <span className={`
                px-1.5 py-0.5 rounded-md text-xs
                ${isActive ? 'bg-cyan-500/30' : 'bg-slate-700/50'}
              `}>
                                {category.count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
