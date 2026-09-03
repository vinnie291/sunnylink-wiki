/**
 * Converts a driving model name into a clean, human-readable URL slug with dashes.
 * Example: "RDF Model" -> "rdf-model"
 * Example: "WMI V12" -> "wmi-v12"
 * Example: "Down to Ride v6" -> "down-to-ride-v6"
 */
export function modelNameToSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Finds a model by its slug or name in a list of models.
 */
export function findModelBySlugOrName<T extends { name: string }>(
    models: T[],
    query: string | null | undefined
): T | undefined {
    if (!query) return undefined;
    let cleanQuery = query.trim().toLowerCase();
    try {
        cleanQuery = decodeURIComponent(cleanQuery);
    } catch {
        // ignore decode errors
    }
    const querySlug = modelNameToSlug(cleanQuery);

    // 1. Direct match by slug or exact lowercase name
    const exact = models.find(m => {
        const mName = m.name.toLowerCase();
        const mSlug = modelNameToSlug(m.name);
        return mSlug === querySlug || mSlug === cleanQuery || mName === cleanQuery;
    });
    if (exact) return exact;

    // 2. Normalize optional words like "model" (e.g. "Pop Model v2" <-> "Pop v2", "Dark Souls Model v2" <-> "Dark Souls v2")
    const stripModelWords = (slug: string) => slug.replace(/-model-/g, '-').replace(/-model$/g, '').replace(/^model-/g, '');
    const normalizedQuerySlug = stripModelWords(querySlug);

    const matchNormalized = models.find(m => {
        const mSlug = modelNameToSlug(m.name);
        const mNorm = stripModelWords(mSlug);
        return mNorm === normalizedQuerySlug || mSlug === normalizedQuerySlug || mNorm === querySlug;
    });
    if (matchNormalized) return matchNormalized;

    // 3. Prefix/contains match if unique or high confidence
    const prefixMatch = models.find(m => {
        const mSlug = modelNameToSlug(m.name);
        return mSlug.startsWith(querySlug) || querySlug.startsWith(mSlug);
    });
    if (prefixMatch) return prefixMatch;

    return undefined;
}

