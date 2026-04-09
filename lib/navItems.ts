/**
 * Shared navigation items used by both Navigation (desktop) and BottomNav (mobile).
 * Single source of truth for routes, labels, and icons.
 */

export interface NavItem {
    href: string;
    /** i18n key for the label */
    labelKey: string;
    icon: string;
    /** If true, renders as the elevated center item in BottomNav */
    isCenter?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
    { href: '/', labelKey: 'nav.settings', icon: '⚙️' },
    { href: '/models', labelKey: 'nav.models', icon: '🧠' },
    { href: '/cars', labelKey: 'nav.carDatabase', icon: '🚗', isCenter: true },
    { href: '/stats', labelKey: 'nav.stats', icon: '📊' },
    { href: '/features', labelKey: 'nav.features', icon: '📖' },
];
