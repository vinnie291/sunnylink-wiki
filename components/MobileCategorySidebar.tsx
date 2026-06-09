'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useLanguage } from '../lib/i18n';
import { getFilterButtonClasses, getFilterBadgeClasses, type FilterVariant } from '../lib/filterStyles';

interface Category {
    id: string;
    name: string;
    icon: ReactNode;
    count?: number;
    description?: string;
    models?: unknown[];
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

/** SunnyTune SVG icon used in the sidebar filter buttons */
function SunnyTuneIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0"><circle cx="12" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"></path><path d="M12 12v3"></path></svg>
    );
}

/** Reusable sidebar filter button */
function SidebarButton({
    isActive,
    variant = 'cyan',
    icon,
    label,
    count,
    onClick,
}: {
    isActive: boolean;
    variant?: FilterVariant;
    icon: React.ReactNode;
    label: string;
    count?: number;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full ${getFilterButtonClasses({ isActive, variant, wide: true })}`}
        >
            <span className={`shrink-0 text-lg ${variant === 'emerald' ? 'text-emerald-400' : ''}`}>{icon}</span>
            <span className="flex-1">{label}</span>
            {count !== undefined && (
                <span className={getFilterBadgeClasses(isActive, variant)}>
                    {count}
                </span>
            )}
        </button>
    );
}

/** Resolves the item count from the Category object */
function getCategoryCount(cat: Category): number {
    return cat.count ?? cat.models?.length ?? 0;
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

    const totalCount = categories.reduce((sum, cat) => sum + getCategoryCount(cat), 0);

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
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
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
                            <SidebarButton
                                isActive={isAllActive}
                                icon="🏠"
                                label={t('filter.all')}
                                count={totalCount}
                                onClick={() => {
                                    onClearAll?.();
                                    onClose();
                                }}
                            />

                            {/* Recommended filter */}
                            <SidebarButton
                                isActive={activeCategories.includes('recommended')}
                                variant="emerald"
                                icon="★"
                                label={t('filter.recommended')}
                                onClick={() => onToggleCategory?.('recommended')}
                            />

                            {/* Category buttons */}
                            {categories.map((category) => (
                                <SidebarButton
                                    key={category.id}
                                    isActive={activeCategories.includes(category.id)}
                                    icon={category.icon}
                                    label={category.name}
                                    count={getCategoryCount(category)}
                                    onClick={() => onToggleCategory?.(category.id)}
                                />
                            ))}
                        </>
                    ) : (
                        /* Models: single-select category list */
                        <>
                            {/* Recommended filter */}
                            <SidebarButton
                                isActive={activeCategories.includes('recommended')}
                                variant="emerald"
                                icon="★"
                                label={t('filter.recommended')}
                                onClick={() => {
                                    onToggleCategory?.('recommended');
                                    onClose();
                                }}
                            />



                            {categories.map((cat) => (
                                <SidebarButton
                                    key={cat.id}
                                    isActive={activeCategory === cat.id && !searchQuery}
                                    icon={cat.icon}
                                    label={cat.name}
                                    count={getCategoryCount(cat)}
                                    onClick={() => {
                                        onSelectCategory?.(cat.id);
                                        onClose();
                                    }}
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
