import { useState, useEffect } from 'react';

type ViewMode = 'grid' | 'list';

export function useViewMode(key: string, initialMode: ViewMode = 'grid') {
    const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const saved = localStorage.getItem(`view_mode_${key}`);

        // Check if user has a saved preference
        if (saved === 'grid' || saved === 'list') {
            setViewMode(saved);
        } else {
            // No saved preference: default to grid on mobile for better UX
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                setViewMode('grid');
            }
        }
    }, [key]);

    const toggleView = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem(`view_mode_${key}`, mode);
    };

    return { viewMode, setViewMode: toggleView, isMounted };
}
