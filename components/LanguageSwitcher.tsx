'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage, SUPPORTED_LOCALES } from '../lib/i18n';
import type { Locale } from '../lib/i18n';

export default function LanguageSwitcher() {
    const { locale, setLocale, t, getLocaleMeta } = useLanguage();
    const localeMeta = getLocaleMeta();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setIsOpen(false);
        }
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen]);

    const handleSelect = (newLocale: Locale) => {
        if (newLocale !== locale) {
            // Track language switch in Google Analytics
            const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
            if (typeof window !== 'undefined' && typeof gtag === 'function') {
                gtag('event', 'language_switch', {
                    previous_language: locale,
                    new_language: newLocale,
                    language_name: localeMeta[newLocale].name,
                });
            }
        }
        setLocale(newLocale);
        setIsOpen(false);
    };

    const currentMeta = localeMeta[locale];

    return (
        <div ref={containerRef} className="relative z-30">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center justify-center
          w-10 h-10 sm:w-12 sm:h-12
          rounded-xl
          bg-slate-800/50 backdrop-blur-sm
          border border-slate-700/50
          hover:bg-slate-700/50 hover:border-slate-600/50
          focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50
          transition-all duration-200
          text-lg sm:text-xl
          cursor-pointer
          ${isOpen ? 'border-cyan-500/50 bg-slate-800/80 ring-1 ring-cyan-500/30' : ''}
        `}
                aria-label={t('language.switchTo')}
                title={t('language.switchTo')}
            >
                {currentMeta.flag}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="
              absolute top-full left-0 mt-2
              w-44
              bg-slate-900/95 backdrop-blur-xl
              border border-slate-700/70
              rounded-xl
              shadow-2xl shadow-black/80
              overflow-hidden
              z-50
            "
                    >
                        {SUPPORTED_LOCALES.map((loc) => {
                            const meta = localeMeta[loc];
                            const isActive = loc === locale;
                            return (
                                <button
                                    key={loc}
                                    onClick={() => handleSelect(loc)}
                                    className={`
                    w-full flex items-center gap-3 px-4 py-2.5
                    text-sm font-medium transition-all duration-150
                    cursor-pointer
                    ${isActive
                                            ? 'bg-cyan-500/20 text-cyan-300'
                                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                                        }
                  `}
                                >
                                    <span className="text-lg">{meta.flag}</span>
                                    <span>{meta.name}</span>
                                    {isActive && (
                                        <svg className="w-4 h-4 ml-auto text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
