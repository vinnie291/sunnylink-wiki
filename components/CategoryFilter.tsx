'use client';

import { useState } from 'react';
import { useLanguage } from '../lib/i18n';

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
    vertical?: boolean;
    recommendedCount?: number;
    sunnyTuneCount?: number;
}

export default function CategoryFilter({
    categories,
    activeCategories,
    onToggleCategory,
    onClearAll,
    collapsible = false,
    initialOpen = false,
    vertical = false,
    recommendedCount = 0,
    sunnyTuneCount = 0,
}: CategoryFilterProps) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const { t } = useLanguage();
    const isAllActive = activeCategories.length === 0;
    const totalCount = categories.reduce((sum, cat) => sum + cat.count, 0);

    const toggleOpen = () => setIsOpen(!isOpen);

    const containerClasses = collapsible
        ? `flex gap-2 transition-all duration-300 overflow-hidden overflow-y-auto ${vertical ? 'flex-col items-stretch' : 'flex-wrap'} ${isOpen ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`
        : `flex gap-2 pb-2 scrollbar-hide lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0 ${vertical ? 'flex-col items-stretch mx-0 px-0' : 'overflow-x-auto -mx-4 px-4 lg:flex-wrap'}`;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between" onClick={collapsible ? toggleOpen : undefined}>
                <button
                    className={`flex items-center gap-2 text-sm text-slate-400 uppercase tracking-wider font-medium w-full text-left ${collapsible ? 'cursor-pointer hover:text-slate-300' : ''}`}
                    disabled={!collapsible}
                >
                    <span>{t('filter.categories')}</span>
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
                        className="text-xs text-slate-500 hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
                    >
                        {t('filter.showAll')}
                    </button>
                )}
                {collapsible && !isAllActive && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClearAll();
                        }}
                        className="text-xs text-slate-500 hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
                    >
                        {t('filter.reset')}
                    </button>
                )}
            </div>

            <div className={containerClasses}>
                {/* All Button */}
                <button
                    onClick={onClearAll}
                    type="button"
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium max-w-full flex-shrink-0 text-left
            transition-all duration-200 border
            ${isAllActive
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                        }
          `}
                >
                    <span className="shrink-0">🏠</span>
                    <span className="flex-1 break-words">{t('filter.all')}</span>
                    <span className={`
            shrink-0 px-1.5 py-0.5 rounded-md text-xs
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
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium max-w-full flex-shrink-0 text-left
            transition-all duration-200 border
            ${activeCategories.includes('recommended')
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                        }
          `}
                >
                    <span className="text-emerald-400 shrink-0">★</span>
                    <span className="flex-1 break-words">{t('filter.recommended')}</span>
                    {recommendedCount > 0 && (
                        <span className={`
                shrink-0 px-1.5 py-0.5 rounded-md text-xs
                ${activeCategories.includes('recommended') ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-700/50'}
              `}>
                             {recommendedCount}
                        </span>
                    )}
                </button>

                {/* SunnyTune Filter */}
                {sunnyTuneCount > 0 && (
                    <button
                        onClick={() => onToggleCategory('sunnytune')}
                        type="button"
                        className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium max-w-full flex-shrink-0 text-left
                transition-all duration-200 border
                ${activeCategories.includes('sunnytune')
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-lg shadow-amber-500/10'
                                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                            }
                `}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg>
                        <span className="flex-1 break-words">{t('filter.sunnytune')}</span>
                        <span className={`
                    shrink-0 px-1.5 py-0.5 rounded-md text-xs
                    ${activeCategories.includes('sunnytune') ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-700/50'}
                `}>
                            {sunnyTuneCount}
                        </span>
                    </button>
                )}


                {/* Category Buttons */}
                {categories.map((category) => {
                    const isActive = activeCategories.includes(category.id);
                    return (
                        <button
                            key={category.id}
                            onClick={() => onToggleCategory(category.id)}
                            type="button"
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium max-w-full flex-shrink-0 text-left
                transition-all duration-200 border
                ${isActive
                                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                }
              `}
                        >
                            <span className="shrink-0">{category.icon}</span>
                            <span className="flex-1 break-words">{category.name}</span>
                            <span className={`
                shrink-0 px-1.5 py-0.5 rounded-md text-xs
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
