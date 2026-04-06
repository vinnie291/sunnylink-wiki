'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from '../lib/i18n';

interface Category {
    id: string;
    name: string;
    icon: string;
    count?: number;
    description?: string;
}

interface MobileCategorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    categories: Category[];
    // Settings mode: multi-select with activeCategories[]
    // Models mode: single-select with activeCategory string
    mode: 'settings' | 'models';
    // Settings mode props
    activeCategories?: string[];
    onToggleCategory?: (id: string) => void;
    onClearAll?: () => void;
    // Models mode props
    activeCategory?: string;
    onSelectCategory?: (id: string) => void;
    searchQuery?: string;
}

export default function MobileCategorySidebar({
    isOpen,
    onClose,
    categories,
    mode,
    activeCategories = [],
    onToggleCategory,
    onClearAll,
    activeCategory = '',
    onSelectCategory,
    searchQuery = '',
}: MobileCategorySidebarProps) {
    const { t } = useLanguage();
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Lock body scroll when sidebar is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const isAllActive = mode === 'settings'
        ? activeCategories.length === 0
        : activeCategory === 'all' || activeCategory === 'favorites';

    const totalCount = categories.reduce((sum, cat) => sum + (cat.count || 0), 0);

    return (
        <div className="lg:hidden" aria-hidden={!isOpen}>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Sidebar drawer */}
            <div
                ref={sidebarRef}
                className={`
                    fixed top-0 left-0 bottom-0 z-[70] w-72 flex flex-col
                    bg-slate-950/95 backdrop-blur-xl border-r border-slate-700/50
                    shadow-2xl shadow-black/50
                    transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 pt-16 border-b border-slate-800/50">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                        {t('filter.categories')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                        aria-label="Close sidebar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Category list */}
                <div className="overflow-y-auto flex-1 p-4 pb-24 space-y-2">
                    {mode === 'settings' ? (
                        /* Settings: multi-select category pills */
                        <>
                            {/* All button */}
                            <button
                                onClick={() => {
                                    onClearAll?.();
                                    onClose();
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left
                                    transition-all duration-200 border
                                    ${isAllActive
                                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                        : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                    }
                                `}
                            >
                                <span className="shrink-0 text-lg">🏠</span>
                                <span className="flex-1">{t('filter.all')}</span>
                                <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs ${isAllActive ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                                    {totalCount}
                                </span>
                            </button>

                            {/* Recommended filter */}
                            <button
                                onClick={() => {
                                    onToggleCategory?.('recommended');
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left
                                    transition-all duration-200 border
                                    ${activeCategories.includes('recommended')
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                                        : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                    }
                                `}
                            >
                                <span className="text-emerald-400 shrink-0 text-lg">★</span>
                                <span className="flex-1">{t('filter.recommended')}</span>
                            </button>

                            {/* SunnyTune filter */}
                            <button
                                onClick={() => {
                                    onToggleCategory?.('sunnytune');
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left
                                    transition-all duration-200 border
                                    ${activeCategories.includes('sunnytune')
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-lg shadow-amber-500/10'
                                        : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                    }
                                `}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg>
                                <span className="flex-1">{t('filter.sunnytune')}</span>
                            </button>


                            {/* Category buttons */}
                            {categories.map((category) => {
                                const isActive = activeCategories.includes(category.id);
                                return (
                                    <button
                                        key={category.id}
                                        onClick={() => {
                                            onToggleCategory?.(category.id);
                                        }}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left
                                            transition-all duration-200 border
                                            ${isActive
                                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                                                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white'
                                            }
                                        `}
                                    >
                                        <span className="shrink-0 text-lg">{category.icon}</span>
                                        <span className="flex-1">{category.name}</span>
                                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs ${isActive ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                                            {category.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </>
                    ) : (
                        /* Models: single-select category list */
                        <>


                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        onSelectCategory?.(cat.id);
                                        onClose();
                                    }}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left
                                        transition-all duration-200 border
                                        ${activeCategory === cat.id && !searchQuery
                                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                            : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700/50 hover:text-white'
                                        }
                                    `}
                                >
                                    <span className="shrink-0 text-lg">{cat.icon}</span>
                                    <span className="flex-1">{cat.name}</span>
                                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs ${activeCategory === cat.id && !searchQuery ? 'bg-cyan-500/30' : 'bg-slate-700/50'}`}>
                                        {cat.count ?? (cat as any).models?.length ?? 0}
                                    </span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
