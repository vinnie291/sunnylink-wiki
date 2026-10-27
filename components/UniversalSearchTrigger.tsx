'use client';

import { useEffect, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { closeSearch, getSearchOpen, getServerSearchOpen, openSearch, setSearchOpen, subscribeSearch } from '../lib/searchDialog';

const UniversalSearch = dynamic(() => import('./UniversalSearch'), { ssr: false });

export default function UniversalSearchTrigger() {
    const isOpen = useSyncExternalStore(subscribeSearch, getSearchOpen, getServerSearchOpen);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (!event.repeat) setSearchOpen(!getSearchOpen());
            } else if (event.key === 'Escape') {
                closeSearch();
            }
        };
        window.addEventListener('open-universal-search', openSearch);
        window.addEventListener('close-universal-search', closeSearch);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('open-universal-search', openSearch);
            window.removeEventListener('close-universal-search', closeSearch);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return isOpen ? <UniversalSearch onClose={closeSearch} /> : null;
}
