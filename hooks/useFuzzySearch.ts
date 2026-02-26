'use client';

import { useMemo, useRef, useState, useEffect } from 'react';

/**
 * Generate an acronym from a label string.
 * e.g. "Dynamic Experimental Control" → "dec"
 * e.g. "Smart Cruise Control - Vision" → "sccv"
 */
export function generateAcronym(label: string): string {
    return label
        .replace(/[^\w\s]/g, '') // Remove punctuation (hyphens, parens, etc.)
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word[0])
        .join('')
        .toLowerCase();
}

interface UseFuzzySearchOptions<T> {
    items: T[];
    keys: string[];
    query: string;
    threshold?: number;
    /** If true, add an 'acronym' field derived from the specified label key */
    acronymKey?: string;
}

/**
 * Client-side fuzzy search hook using Fuse.js (lazy-loaded).
 * Supports typo tolerance and optional acronym indexing.
 * Fuse.js is only loaded on the first non-empty query.
 */
export function useFuzzySearch<T extends Record<string, unknown>>({
    items,
    keys,
    query,
    threshold = 0.3,
    acronymKey,
}: UseFuzzySearchOptions<T>): T[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fuseRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FuseClassRef = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Enrich items with acronyms if requested
    const enrichedItems = useMemo(() => {
        if (!acronymKey) return items;
        return items.map(item => ({
            ...item,
            _acronym: typeof item[acronymKey] === 'string'
                ? generateAcronym(item[acronymKey] as string)
                : '',
        }));
    }, [items, acronymKey]);

    // Lazy-load Fuse.js only when user starts typing
    useEffect(() => {
        if (!query || query.trim().length === 0) return;
        if (FuseClassRef.current) return; // Already loaded

        let cancelled = false;
        import('fuse.js').then(mod => {
            if (cancelled) return;
            FuseClassRef.current = mod.default;
            setIsLoaded(true);
        });

        return () => { cancelled = true; };
    }, [query]);

    // Build Fuse index (only after Fuse is loaded)
    useMemo(() => {
        if (!FuseClassRef.current) return;

        const fuseKeys = acronymKey
            ? [...keys, '_acronym']
            : keys;

        fuseRef.current = new FuseClassRef.current(enrichedItems, {
            keys: fuseKeys,
            threshold,
            includeScore: true,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });
    }, [enrichedItems, keys, threshold, acronymKey, isLoaded]);

    // Run search
    return useMemo(() => {
        if (!query || query.trim().length === 0) return items;
        if (!fuseRef.current) return items; // Fuse not loaded yet, return all
        return fuseRef.current.search(query).map((result: { item: T }) => result.item);
    }, [query, items, isLoaded, enrichedItems]);
}
