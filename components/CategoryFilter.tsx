'use client';

import { useState, ReactNode } from 'react';
import { useLanguage } from '../lib/i18n';
import { getFilterButtonClasses, getFilterBadgeClasses } from '../lib/filterStyles';

interface Category {
    id: string;
    name: string;
    icon: ReactNode;
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
    hideSunnyTune?: boolean;
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
    hideSunnyTune = false,
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
                    className={getFilterButtonClasses({ isActive: isAllActive })}
                >
                    <span className="shrink-0">🏠</span>
                    <span className="flex-1 break-words">{t('filter.all')}</span>
                    <span className={getFilterBadgeClasses(isAllActive)}>
                        {totalCount}
                    </span>
                </button>

                {/* Recommended Filter */}
                <button
                    onClick={() => onToggleCategory('recommended')}
                    type="button"
                    className={getFilterButtonClasses({ isActive: activeCategories.includes('recommended'), variant: 'emerald' })}
                >
                    <span className="text-emerald-400 shrink-0">★</span>
                    <span className="flex-1 break-words">{t('filter.recommended')}</span>
                    {recommendedCount > 0 && (
                        <span className={getFilterBadgeClasses(activeCategories.includes('recommended'), 'emerald')}>
                             {recommendedCount}
                        </span>
                    )}
                </button>

                {/* SunnyTune Filter */}
                {sunnyTuneCount > 0 && !hideSunnyTune && (
                    <button
                        onClick={() => onToggleCategory('sunnytune')}
                        type="button"
                        className={getFilterButtonClasses({ isActive: activeCategories.includes('sunnytune'), variant: 'amber' })}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg>
                        <span className="flex-1 break-words">{t('filter.sunnytune')}</span>
                        <span className={getFilterBadgeClasses(activeCategories.includes('sunnytune'), 'amber')}>
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
                            className={getFilterButtonClasses({ isActive })}
                        >
                            <span className="shrink-0">{category.icon}</span>
                            <span className="flex-1 break-words">{category.name}</span>
                            <span className={getFilterBadgeClasses(isActive)}>
                                {category.count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
