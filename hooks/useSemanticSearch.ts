'use client';

import { useEffect, useState } from 'react';

export function useSemanticSearch(query: string, candidateIds: string[], enabled: boolean, locale: string, allowedIds?: string[]) {
    const trimmed = query.trim();
    const requestKey = JSON.stringify([trimmed, candidateIds.slice(0, 12), locale, allowedIds]);
    const [result, setResult] = useState<{ key: string; ids: string[] } | null>(null);

    useEffect(() => {
        if (!enabled || trimmed.length < 3 || trimmed.length > 200) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            let ids: string[] = [];
            try {
                const [searchQuery, candidates, , scope] = JSON.parse(requestKey) as [string, string[], string, string[] | null];
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: searchQuery, candidateIds: candidates, ...(scope ? { allowedIds: scope } : {}) }),
                    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
                });
                if (!response.ok) return;
                const data = await response.json();
                if (!controller.signal.aborted && data.source === 'jev' && Array.isArray(data.ids) && data.ids.every((id: unknown) => typeof id === 'string')) {
                    ids = data.ids;
                }
            } catch {
                // Instant local results remain available after cancellations or failures.
            } finally {
                // Settle fallbacks and errors too; cancelled queries must not replace newer results.
                if (!controller.signal.aborted) setResult({ key: requestKey, ids });
            }
        }, 350);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [enabled, trimmed, requestKey]);

    const eligible = enabled && trimmed.length >= 3 && trimmed.length <= 200;
    const settled = result?.key === requestKey;
    return {
        ids: eligible && settled ? result.ids : [],
        // Include the debounce period so an empty-state message never flashes first.
        isLoading: eligible && !settled,
    };
}
