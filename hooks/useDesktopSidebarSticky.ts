import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * Enhanced sticky search hook that also sets a global `data-sidebar-sticky` attribute
 * on the <html> element so GlobalControls can hide on desktop when the sidebar is stuck.
 * 
 * Uses an IntersectionObserver on a sentinel element placed at the top of the sidebar
 * on desktop to detect when the sidebar transitions to/from sticky positioning.
 */
export function useDesktopSidebarSticky(): {
    sidebarSentinelRef: RefObject<HTMLDivElement | null>;
    isSidebarSticky: boolean;
} {
    const sidebarSentinelRef = useRef<HTMLDivElement | null>(null);
    const [isSidebarSticky, setIsSidebarSticky] = useState(false);

    useEffect(() => {
        const sentinel = sidebarSentinelRef.current;
        if (!sentinel) return;

        // Only observe on desktop (lg: 1024px+)
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        if (!mediaQuery.matches) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                const isStuck = !entry.isIntersecting;
                setIsSidebarSticky(isStuck);

                if (isStuck) {
                    document.documentElement.setAttribute('data-sidebar-sticky', 'true');
                } else {
                    document.documentElement.removeAttribute('data-sidebar-sticky');
                }
            },
            // Trigger 80px before sentinel exits viewport so the transition
            // completes before the fixed GlobalControls would overlap
            { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
        );

        observer.observe(sentinel);

        // Also re-check on resize
        const handleResize = () => {
            if (!mediaQuery.matches) {
                document.documentElement.removeAttribute('data-sidebar-sticky');
                setIsSidebarSticky(false);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
            document.documentElement.removeAttribute('data-sidebar-sticky');
        };
    }, []);

    return { sidebarSentinelRef, isSidebarSticky };
}
