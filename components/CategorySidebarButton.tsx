'use client';

import { useState, useEffect } from 'react';

interface CategorySidebarButtonProps {
    onClick: () => void;
    isSticky: boolean;
    isSidebarOpen: boolean;
}

export default function CategorySidebarButton({ onClick, isSticky, isSidebarOpen }: CategorySidebarButtonProps) {
    const [isVisible, setIsVisible] = useState(false);

    // Match ScrollToTop visibility logic (scrollY > 300) AND require sticky search
    useEffect(() => {
        const toggleVisibility = () => {
            setIsVisible(window.scrollY > 300 && isSticky);
        };

        // Re-evaluate when isSticky changes
        toggleVisibility();

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, [isSticky]);

    // Always show when sidebar is open, otherwise use scroll-based visibility
    const shouldShow = isSidebarOpen || isVisible;

    return (
        <button
            onClick={onClick}
            className={`
                fixed bottom-40 md:bottom-20 right-8 p-3 rounded-full shadow-lg border border-slate-700
                bg-slate-800 text-cyan-400 hover:bg-slate-700 hover:text-cyan-300 hover:border-cyan-500/50
                transition-all duration-300 transform
                lg:hidden
                ${isSidebarOpen ? 'z-[80]' : 'z-50'}
                ${shouldShow ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
            `}
            aria-label={isSidebarOpen ? 'Close category sidebar' : 'Open category sidebar'}
        >
            <svg
                className={`w-6 h-6 transition-transform duration-300 ${isSidebarOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                {isSidebarOpen ? (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                    />
                ) : (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                    />
                )}
            </svg>
        </button>
    );
}
