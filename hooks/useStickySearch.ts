import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * Returns a sentinel ref and an `isSticky` flag.
 * Place the sentinel element right above the search bar.
 * `isSticky` becomes true only after the sentinel scrolls above the viewport.
 */
export function useStickySearch(): {
    sentinelRef: RefObject<HTMLDivElement | null>;
    isSticky: boolean;
} {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [isSticky, setIsSticky] = useState(false);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsSticky(!entry.isIntersecting);
            },
            { threshold: 0, rootMargin: '0px' }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    return { sentinelRef, isSticky };
}
