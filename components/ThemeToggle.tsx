'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Theme = 'dark' | 'light';

function getCurrentTheme(): Theme {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export default function ThemeToggle() {
    // Render the dark icon on the server, then sync after mount to avoid hydration mismatch
    const [theme, setTheme] = useState<Theme>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setTheme(getCurrentTheme());
        setMounted(true);
    }, []);

    const toggle = () => {
        const next: Theme = getCurrentTheme() === 'light' ? 'dark' : 'light';
        document.documentElement.classList.toggle('light', next === 'light');
        try {
            localStorage.setItem('theme', next);
        } catch {
            /* storage unavailable (private mode etc.) — theme still toggles for this page */
        }
        setTheme(next);
        // Track theme switch in Google Analytics
        if (typeof window !== 'undefined' && typeof (window as unknown as { gtag?: unknown }).gtag === 'function') {
            (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', 'theme_switch', { new_theme: next });
        }
    };

    const isLight = mounted && theme === 'light';

    return (
        <button
            onClick={toggle}
            className="
                flex items-center justify-center shrink-0
                w-10 h-10 sm:w-12 sm:h-12
                rounded-xl
                bg-slate-800/50 backdrop-blur-sm
                border border-slate-700/50
                hover:bg-slate-700/50 hover:border-slate-600/50
                focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
                transition-all duration-200
                cursor-pointer
                text-slate-400 hover:text-cyan-400
            "
            aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        >
            <AnimatePresence mode="wait" initial={false}>
                {isLight ? (
                    <motion.svg
                        key="sun"
                        initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                        animate={{ rotate: 0, opacity: 1, scale: 1 }}
                        exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                    >
                        <circle cx="12" cy="12" r="4" />
                        <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                    </motion.svg>
                ) : (
                    <motion.svg
                        key="moon"
                        initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                        animate={{ rotate: 0, opacity: 1, scale: 1 }}
                        exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </motion.svg>
                )}
            </AnimatePresence>
        </button>
    );
}
