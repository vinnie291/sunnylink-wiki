import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * Returns a sentinel ref and an `isSticky` flag.
 * Place the sentinel element right above the search bar.
 *
 * Uses a scroll listener with hysteresis instead of a single
 * IntersectionObserver threshold: the bar sticks once the sentinel scrolls
 * above the viewport, but only un-sticks after the sentinel comes back down
 * past UNSTICK_AT. Without the dead zone, the layout shift caused by the
 * collapsing filter section re-triggers the observer and the bar flickers
 * between stuck/unstuck on every scroll frame.
 */
const UNSTICK_AT = 80;

export function useStickySearch(): {
    sentinelRef: RefObject<HTMLDivElement | null>;
    isSticky: boolean;
} {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [isSticky, setIsSticky] = useState(false);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        let rafId = 0;
        const update = () => {
            rafId = 0;
            const top = sentinel.getBoundingClientRect().top;
            setIsSticky(prev => (prev ? top < UNSTICK_AT : top < 0));
        };
        const onScroll = () => {
            if (!rafId) rafId = requestAnimationFrame(update);
        };

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, []);

    return { sentinelRef, isSticky };
}
