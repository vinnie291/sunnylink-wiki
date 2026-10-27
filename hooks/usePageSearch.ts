'use client';

import { useLanguage } from '../lib/i18n';
import { mergePageSearch, type PageSearchIdentity } from '../lib/pageSearch';
import { useSemanticSearch } from './useSemanticSearch';

export function usePageSearch<T>(items: T[], local: T[], query: string, identity: (item: T) => PageSearchIdentity, enabled = true): T[] {
    const { locale } = useLanguage();
    const keys = (item: T) => {
        const entry = identity(item);
        return (entry.aliases ?? [entry.id]).map(id => `${entry.type}:${id}`);
    };
    const { ids } = useSemanticSearch(query, local.flatMap(keys), enabled && items.length > 0, locale, items.flatMap(keys));
    return ids.length ? mergePageSearch(items, local, ids, query, identity) : local;
}
