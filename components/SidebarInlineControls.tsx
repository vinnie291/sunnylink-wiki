'use client';

import LanguageSwitcher from './LanguageSwitcher';
import SearchButton from './SearchButton';
import ThemeToggle from './ThemeToggle';

/**
 * Inline version of GlobalControls that appears at the top of the desktop sidebar
 * when the user has scrolled past the header. This replaces the fixed GlobalControls
 * to avoid visual overlap with the sidebar's filter search box.
 */
export default function SidebarInlineControls({ visible }: { visible: boolean }) {
    return (
        <div
            className={`
                hidden lg:flex items-center gap-3 w-full
                transition-all duration-200 ease-out overflow-hidden
                ${visible
                    ? 'max-h-16 opacity-100 mb-4'
                    : 'max-h-0 opacity-0 mb-0 pointer-events-none'
                }
            `}
        >
            <div className="shrink-0">
                <LanguageSwitcher />
            </div>
            <div className="flex-1 min-w-0">
                <SearchButton stretch />
            </div>
            <div className="shrink-0">
                <ThemeToggle />
            </div>
        </div>
    );
}
