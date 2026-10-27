// Persist the open request even before the lazy dialog or its subscriber mounts.
let open = false;
const listeners = new Set<() => void>();

export const getSearchOpen = () => open;
export const getServerSearchOpen = () => false;
export function subscribeSearch(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export function setSearchOpen(value: boolean) {
    if (open === value) return;
    open = value;
    listeners.forEach(listener => listener());
}
export const openSearch = () => setSearchOpen(true);
export const closeSearch = () => setSearchOpen(false);
