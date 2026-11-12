import { useState, useEffect, useRef } from 'react';

export function useScrollDirection() {
    const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
    const directionRef = useRef<'up' | 'down' | null>(null);

    useEffect(() => {
        let lastScrollY = window.scrollY;
        let rafId = 0;

        const updateScrollDirection = () => {
            rafId = 0;
            const scrollY = window.scrollY;
            const currentDirection = directionRef.current;

            if (scrollY <= 0) {
                if (currentDirection !== 'up') {
                    directionRef.current = 'up';
                    setScrollDirection('up');
                }
                lastScrollY = 0;
                return;
            }

            const direction = scrollY > lastScrollY ? 'down' : 'up';
            if (direction !== currentDirection && Math.abs(scrollY - lastScrollY) > 5) {
                directionRef.current = direction;
                setScrollDirection(direction);
            }

            lastScrollY = scrollY;
        };

        const onScroll = () => {
            if (!rafId) {
                rafId = requestAnimationFrame(updateScrollDirection);
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    return scrollDirection;
}
