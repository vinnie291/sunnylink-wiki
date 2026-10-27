export interface SearchIdentity {
    id: string;
    type: 'setting' | 'model' | 'car' | 'feature';
    title: string;
    make?: string;
    model?: string;
}

export const searchIdentity = (item: Pick<SearchIdentity, 'id' | 'type'>) => `${item.type}:${item.id}`;

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function isExactSearchMatch(item: SearchIdentity, query: string): boolean {
    const q = normalize(query);
    if (!q) return false;
    const acronym = item.title.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean).map(word => word[0]).join('');
    return [item.title, item.id, item.model, item.make, acronym]
        .some(value => value && normalize(value) === q);
}

/** Keep exact names/acronyms first; resolve server IDs to the current translated items. */
export function mergeSemanticResults<T extends SearchIdentity>(items: T[], local: T[], ids: string[], query: string): T[] {
    const byId = new Map(items.map(item => [searchIdentity(item), item]));
    const ordered = [...local.filter(item => isExactSearchMatch(item, query)),
        ...ids.flatMap(id => byId.has(id) ? [byId.get(id)!] : []), ...local];
    return Array.from(new Map(ordered.map(item => [searchIdentity(item), item])).values());
}
