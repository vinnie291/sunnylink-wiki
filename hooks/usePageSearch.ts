'use client';

import { useLanguage } from '../lib/i18n';
import { mergePageSearch, type PageSearchIdentity } from '../lib/pageSearch';
import { useSemanticSearch } from './useSemanticSearch';

const EMPTY_IDS: string[] = [];

export function usePageSearch<T>(items: T[], local: T[], query: string, identity: (item: T) => PageSearchIdentity, enabled = true): T[] {
    const { locale } = useLanguage();
    const isEligible = enabled && items.length > 0 && query.trim().length >= 3;
    const keys = (item: T) => {
        const entry = identity(item);
        return (entry.aliases ?? [entry.id]).map(id => `${entry.type}:${id}`);
    };
    const candidateIds = isEligible ? local.slice(0, 12).flatMap(keys) : EMPTY_IDS;
    const allowedIds = isEligible ? items.flatMap(keys) : undefined;
    const { ids } = useSemanticSearch(query, candidateIds, isEligible, locale, allowedIds);
    return ids.length ? mergePageSearch(items, local, ids, query, identity) : local;
}
