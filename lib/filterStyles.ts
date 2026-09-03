/**
 * Shared filter button styling utilities used by CategoryFilter and MobileCategorySidebar.
 * Centralizes the button classes so style changes are made in one place.
 */

export type FilterVariant = 'cyan' | 'emerald' | 'amber';

interface FilterButtonClassesOptions {
    isActive: boolean;
    variant?: FilterVariant;
    /** If true, uses wider padding suitable for sidebar layout */
    wide?: boolean;
}

const VARIANT_ACTIVE: Record<FilterVariant, string> = {
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 shadow-lg shadow-cyan-500/10',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-500/10',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-lg shadow-amber-500/10',
};

const INACTIVE = 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50 hover:text-white';

/**
 * Returns the Tailwind class string for a filter button.
 */
export function getFilterButtonClasses({ isActive, variant = 'cyan', wide = false }: FilterButtonClassesOptions): string {
    const padding = wide ? 'px-4 py-3' : 'px-4 py-2';
    const base = `flex items-center gap-${wide ? '3' : '2'} ${padding} rounded-xl text-sm font-medium max-w-full flex-shrink-0 text-left transition-all duration-200 border`;
    const state = isActive ? VARIANT_ACTIVE[variant] : INACTIVE;
    return `${base} ${state}`;
}

/**
 * Returns the Tailwind class string for a filter count badge.
 */
export function getFilterBadgeClasses(isActive: boolean, variant: FilterVariant = 'cyan'): string {
    const base = 'shrink-0 px-1.5 py-0.5 rounded-md text-xs';
    const badgeActive: Record<FilterVariant, string> = {
        cyan: 'bg-cyan-500/30 text-cyan-200',
        emerald: 'bg-emerald-500/30 text-emerald-300',
        amber: 'bg-amber-500/30 text-amber-300',
    };
    return `${base} ${isActive ? badgeActive[variant] : 'bg-slate-700/60 text-slate-300'}`;
}
