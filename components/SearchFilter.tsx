'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface SearchFilterProps {
    value: string;
    onChange: (value: string) => void;
    resultCount: number;
    totalCount: number;
}

export default function SearchFilter({ value, onChange, resultCount, totalCount }: SearchFilterProps) {
    const [localValue, setLocalValue] = useState(value);
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

    // Keyboard Shortcut (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                // Only focus if the element is visible (offsetParent is not null)
                if (inputRef.current && inputRef.current.offsetParent !== null) {
                    inputRef.current.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
                    {/* Search Icon */}
                    <div className="absolute left-4 text-slate-400 group-focus-within:text-cyan-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        placeholder="Search... (Cmd+K)"
                        className="
              w-full py-4 pl-12 pr-12 
              bg-slate-800/80 backdrop-blur-sm
              border border-slate-700/50 
              rounded-2xl
              text-white placeholder-slate-500
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

            {/* Results Counter */}
            <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                    {value ? (
                        <>
                            Found <span className="text-cyan-400 font-medium">{resultCount}</span> of {totalCount} toggles
                        </>
                    ) : (
                        <>
                            <span className="text-slate-400 font-medium">{totalCount}</span> toggles available
                        </>
                    )}
                </span>

                {value && (
                    <button
                        onClick={handleClear}
                        className="text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                        Clear search
                    </button>
                )}
            </div>
        </div>
    );
}
