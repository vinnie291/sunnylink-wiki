'use client';

import { useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';

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
    keys: IFuseOptions<T>['keys'];
    query: string;
    threshold?: number;
    /** If true, add an 'acronym' field derived from the specified label key */
    acronymKey?: string;
}

/**
 * Client-side fuzzy search hook using Fuse.js.
 * Supports typo tolerance and optional acronym indexing.
 */
export function useFuzzySearch<T extends Record<string, unknown>>({
    items,
    keys,
    query,
    threshold = 0.3,
    acronymKey,
}: UseFuzzySearchOptions<T>): T[] {
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

    // Build Fuse index
    const fuse = useMemo(() => {
        const fuseKeys = acronymKey
            ? [...(keys as string[]), '_acronym']
            : (keys as string[]);

        return new Fuse(enrichedItems, {
            keys: fuseKeys,
            threshold,
            includeScore: true,
            ignoreLocation: true,   // Don't penalise matches appearing later in the string
            minMatchCharLength: 2,  // Require at least 2 chars to start fuzzy matching
        });
    }, [enrichedItems, keys, threshold, acronymKey]);

    // Run search
    return useMemo(() => {
        if (!query || query.trim().length === 0) return items;
        return fuse.search(query).map(result => result.item as unknown as T);
    }, [fuse, query, items]);
}
