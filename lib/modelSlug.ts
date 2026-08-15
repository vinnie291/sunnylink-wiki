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
    const cleanQuery = query.trim().toLowerCase();
    const querySlug = modelNameToSlug(query);

    return models.find(m => {
        const mName = m.name.toLowerCase();
        const mSlug = modelNameToSlug(m.name);
        return mSlug === querySlug || mSlug === cleanQuery || mName === cleanQuery;
    });
}
