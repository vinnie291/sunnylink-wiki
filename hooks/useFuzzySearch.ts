'use client';

import { useMemo } from 'react';
import Fuse from 'fuse.js';

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

export interface UseFuzzySearchOptions<T> {
    items: T[];
    keys: string[];
    query: string;
    threshold?: number;
    /** If true, add an 'acronym' field derived from the specified label key */
    acronymKey?: string;
}

/**
 * Perform multi-tier ranking and instant search.
 * Ensures cars, exact matches, prefixes, and acronyms match instantly,
 * while maintaining Fuse.js typo tolerance as a fallback.
 */
export function searchAndRank<T extends Record<string, unknown>>({
    items,
    fuse,
    query,
    keys,
    acronymKey,
}: {
    items: (T & { _acronym?: string })[];
    fuse: Fuse<T & { _acronym?: string }>;
    query: string;
    keys: string[];
    acronymKey?: string;
}): T[] {
    const rawQuery = query.trim();
    if (!rawQuery) return items;

    const q = rawQuery.toLowerCase();
    const qClean = q.replace(/[^a-z0-9]/g, '');

    const scoreMap = new Map<T, number>();

    for (const item of items) {
        let score = 0;

        // Check if item is a car or has vehicle make/model
        const isCar = item.type === 'car' || Boolean(item.make && item.model);
        const titleStr = typeof item.title === 'string'
            ? item.title
            : (typeof item.label === 'string' ? item.label : (typeof item.name === 'string' ? item.name : ''));
        const subtitleStr = typeof item.subtitle === 'string'
            ? item.subtitle
            : (typeof item.description === 'string' ? item.description : (typeof item.userNote === 'string' ? item.userNote : ''));

        const titleLower = titleStr.toLowerCase();
        const titleClean = titleLower.replace(/[^a-z0-9]/g, '');
        const subtitleLower = subtitleStr.toLowerCase();
        const titleWords = titleLower.split(/[\s\-_/()]+/).filter(Boolean);

        if (isCar) {
            const makeLower = typeof item.make === 'string' ? item.make.toLowerCase() : '';
            const modelLower = typeof item.model === 'string' ? item.model.toLowerCase() : '';
            const makeClean = makeLower.replace(/[^a-z0-9]/g, '');
            const modelClean = modelLower.replace(/[^a-z0-9]/g, '');
            const modelWords = modelLower.split(/[\s\-_/()]+/).filter(Boolean);

            // 1. Exact model match (e.g. 'r1s' matches model 'R1S', 'f150' matches 'F-150', 'civic' matches 'Civic')
            if (modelLower === q || (qClean.length > 0 && modelClean === qClean)) {
                score = Math.max(score, 12000);
            }
            // 2. Exact full car title match (e.g. 'rivian r1s', 'toyota rav4')
            else if (titleLower === q || (qClean.length > 0 && titleClean === qClean)) {
                score = Math.max(score, 11000);
            }
            // 3. Model prefix match (e.g. 'r1' matches 'R1S' & 'R1T'; 'rav' matches 'RAV4')
            else if ((qClean.length > 0 && modelClean.startsWith(qClean)) || modelLower.startsWith(q)) {
                score = Math.max(score, 10000);
            }
            // 4. Exact make match (e.g. 'rivian', 'toyota', 'tesla')
            else if (makeLower === q || (qClean.length > 0 && makeClean === qClean)) {
                score = Math.max(score, 9200);
            }
            // 5. Title starts with query (e.g. 'rivian r')
            else if (titleLower.startsWith(q) || (qClean.length > 0 && titleClean.startsWith(qClean))) {
                score = Math.max(score, 8800);
            }
            // 6. Make starts with query (e.g. 'riv' -> Rivian, 'tes' -> Tesla, 'toy' -> Toyota)
            else if (makeLower.startsWith(q) || (qClean.length > 0 && makeClean.startsWith(qClean))) {
                score = Math.max(score, 8400);
            }
            // 7. Model word starts with query (e.g. '150' -> F-150, 'lightning' -> F-150 Lightning)
            else if (modelWords.some(w => w.startsWith(q) || (qClean.length > 0 && w.replace(/[^a-z0-9]/g, '').startsWith(qClean)))) {
                score = Math.max(score, 7800);
            }
            // 8. Model contains query
            else if ((qClean.length >= 2 && modelClean.includes(qClean)) || modelLower.includes(q)) {
                score = Math.max(score, 7200);
            }
            // 9. Full title contains query
            else if ((qClean.length >= 2 && titleClean.includes(qClean)) || titleLower.includes(q)) {
                score = Math.max(score, 6600);
            }
            // 10. Years / Subtitle match
            else if (subtitleLower.includes(q)) {
                score = Math.max(score, 1800);
            }
        } else {
            // General items (settings, models, features)
            const acronym = (item._acronym || '').toLowerCase();
            const keyLower = typeof item.key === 'string' ? item.key.toLowerCase() : '';

            // 1. Exact acronym match (e.g. 'nnlc' -> Neural Network Lateral Control)
            if (acronym && (acronym === q || (qClean.length > 0 && acronym === qClean))) {
                score = Math.max(score, 9500);
            }
            // 2. Exact title or key match
            else if (titleLower === q || keyLower === q || (qClean.length > 0 && titleClean === qClean)) {
                score = Math.max(score, 6500);
            }
            // 3. Title starts with query
            else if (titleLower.startsWith(q) || (qClean.length > 0 && titleClean.startsWith(qClean))) {
                score = Math.max(score, 5500);
            }
            // 4. Any word in title starts with query
            else if (titleWords.some(w => w.startsWith(q))) {
                score = Math.max(score, 4500);
            }
            // 5. Title contains query
            else if ((qClean.length >= 2 && titleClean.includes(qClean)) || titleLower.includes(q)) {
                score = Math.max(score, 3200);
            }
            // 6. Subtitle / description / userNote contains query
            else if (subtitleLower.includes(q)) {
                score = Math.max(score, 1500);
            }
        }

        if (score > 0) {
            scoreMap.set(item, score);
        }
    }

    // Fuzzy search with Fuse.js (typo tolerance fallback for queries of length >= 2)
    // If we already have strong exact/prefix matches, do not dilute them with distant fuzzy noise
    const hasStrongMatches = Array.from(scoreMap.values()).some(s => s >= 5000);
    if (!hasStrongMatches && q.length >= 2) {
        const fuseResults = fuse.search(rawQuery);
        for (const r of fuseResults) {
            const fuseScore = r.score ?? 0.3;
            const item = r.item;
            const existingScore = scoreMap.get(item) || 0;
            // Fuse score: 0 is best, 1 is worst.
            const fuzzyScore = Math.round((1 - fuseScore) * 800);
            if (fuzzyScore > existingScore) {
                scoreMap.set(item, fuzzyScore);
            }
        }
    }

    // Sort items by score descending
    const ranked = Array.from(scoreMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([item]) => item);

    return ranked;
}

/**
 * Client-side fuzzy search hook.
 * Synchronous, instant matching with multi-tier ranking, car prioritization,
 * acronym matching, and Fuse.js typo tolerance fallback.
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

    // Build Fuse index synchronously (keys are memoized)
    const fuse = useMemo(() => {
        const fuseKeys = acronymKey
            ? [...keys, '_acronym', 'make', 'model']
            : [...keys, 'make', 'model'];

        return new Fuse(enrichedItems, {
            keys: fuseKeys,
            threshold,
            includeScore: true,
            ignoreLocation: true,
            minMatchCharLength: 1, // Allow single char search without weird quirks
        });
    }, [enrichedItems, keys, threshold, acronymKey]);

    // Run search with instant multi-tier ranking
    return useMemo(() => {
        return searchAndRank({
            items: enrichedItems,
            fuse,
            query,
            keys,
            acronymKey,
        });
    }, [enrichedItems, fuse, query, keys, acronymKey]);
}
