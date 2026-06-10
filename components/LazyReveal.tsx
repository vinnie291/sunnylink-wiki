'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Defers rendering its children until the wrapper scrolls near the
 * viewport, then reveals them with the global fade-in-up animation.
 * A lightweight skeleton keeps layout stable while offscreen.
 */
export default function LazyReveal({
    children,
    placeholder,
    placeholderClassName = 'min-h-[140px] rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse',
}: {
    children: React.ReactNode;
    placeholder?: React.ReactNode;
    placeholderClassName?: string;
}) {
    const [shown, setShown] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (shown) return;
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
            setShown(true);
            return;
        }
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShown(true);
                    io.disconnect();
                }
            },
            { rootMargin: '300px 0px', threshold: 0 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [shown]);

    return (
        <div ref={ref} className="h-full">
            {shown ? (
                <div className="h-full animate-fade-in">{children}</div>
            ) : (
                placeholder ?? <div className={placeholderClassName} />
            )}
        </div>
    );
}
