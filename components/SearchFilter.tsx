'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../lib/i18n';

interface SearchFilterProps {
    value: string;
    onChange: (value: string) => void;
    resultCount: number;
    totalCount: number;
    itemLabel?: string;
    placeholder?: string;
}

export default function SearchFilter({
    value,
    onChange,
    resultCount,
    totalCount,
    itemLabel = "toggles",
    placeholder,
}: SearchFilterProps) {
    const [localValue, setLocalValue] = useState(value);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile/touch device for placeholder text (touch OR narrow viewport)
    useEffect(() => {
        const checkMobile = () => {
            const isTouch = window.matchMedia('(pointer: coarse)').matches;
            const isNarrow = window.matchMedia('(max-width: 768px)').matches;
            setIsMobile(isTouch || isNarrow);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const { t } = useLanguage();
    const resolvedPlaceholder = placeholder ?? (isMobile ? t('search.placeholderShort') : t('search.placeholderDesktop'));
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            onChange(localValue);
        }, 300);

        return () => clearTimeout(timer);
    }, [localValue, onChange]);

    // Sync external value changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleClear = useCallback(() => {
        setLocalValue('');
        onChange('');
        inputRef.current?.focus();
    }, [onChange]);

    return (
        <div className="relative">
            {/* Search Input */}
            <div className="relative group">
                {/* Glow effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />

                <div className="relative flex items-center">
                    {/* Filter Icon */}
                    <div className="absolute left-4 text-slate-400 group-focus-within:text-cyan-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onFocus={() => document.documentElement.setAttribute('data-search-active', 'true')}
                        onBlur={() => document.documentElement.removeAttribute('data-search-active')}
                        placeholder={resolvedPlaceholder}
                        aria-label="Search settings"
                        className="
              w-full py-4 pl-12 pr-12 
              bg-slate-800/80 backdrop-blur-sm
              border border-slate-700/50 
              rounded-2xl
              text-white placeholder-slate-400
              focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
              transition-all duration-200
              text-base
            "
                    />

                    {/* Clear Button */}
                    {localValue && (
                        <button
                            onClick={handleClear}
                            className="
                absolute right-4 
                p-1.5 rounded-lg
                bg-slate-700/50 text-slate-400 
                hover:bg-slate-600 hover:text-white
                transition-all duration-200
              "
                            aria-label="Clear search"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Results Counter - Fixed height to prevent layout shift */}
            <div className="mt-4 sm:mt-2 flex items-center text-[11px] sm:text-sm h-5">
                <span className="text-slate-500 whitespace-nowrap">
                    {value ? (
                        <>
                            Found <span className="text-cyan-400 font-medium">{resultCount}</span> of {totalCount} {itemLabel}
                        </>
                    ) : (
                        null
                    )}
                </span>
            </div>
        </div>
    );
}
