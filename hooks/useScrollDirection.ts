import { useState, useEffect } from 'react';

export function useScrollDirection() {
    const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);

    useEffect(() => {
        let lastScrollY = window.scrollY;

        const updateScrollDirection = () => {
            const scrollY = window.scrollY;
            const direction = scrollY > lastScrollY ? 'down' : 'up';

            // Allow direction change if scroll difference > 5px or if at the top
            if (direction !== scrollDirection && (Math.abs(scrollY - lastScrollY) > 5 || scrollY <= 0)) {
                setScrollDirection(direction);
            }

            // Force "up" state if scrolled near the top edge
            if (scrollY <= 0 && scrollDirection !== 'up') {
                setScrollDirection('up');
            }

            lastScrollY = scrollY > 0 ? scrollY : 0;
        };

        window.addEventListener('scroll', updateScrollDirection, { passive: true });
        return () => window.removeEventListener('scroll', updateScrollDirection);
    }, [scrollDirection]);

    return scrollDirection;
}
