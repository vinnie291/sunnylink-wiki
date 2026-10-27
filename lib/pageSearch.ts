import { isExactSearchMatch, type SearchIdentity } from './semanticSearch';

export interface PageSearchIdentity extends SearchIdentity { aliases?: string[] }

/** Scope retrieval and result resolution to the items allowed by the page's filters. */
export function mergePageSearch<T>(items: T[], local: T[], ids: string[], query: string, identity: (item: T) => PageSearchIdentity): T[] {
    const byId = new Map<string, T>();
    for (const item of items) {
        const entry = identity(item);
        for (const id of entry.aliases ?? [entry.id]) byId.set(`${entry.type}:${id}`, item);
    }
    return Array.from(new Set([
        ...local.filter(item => isExactSearchMatch(identity(item), query)),
        ...ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []),
        ...local,
    ]));
}

