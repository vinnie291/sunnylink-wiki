import { useState, useEffect } from 'react';

type ViewMode = 'grid' | 'list';

export function useViewMode(key: string, initialMode: ViewMode = 'grid') {
    const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const saved = localStorage.getItem(`view_mode_${key}`);
        if (saved === 'grid' || saved === 'list') {
            setViewMode(saved);
        }
    }, [key]);

    const toggleView = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem(`view_mode_${key}`, mode);
    };

    return { viewMode, setViewMode: toggleView, isMounted };
}
