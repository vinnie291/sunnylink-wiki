'use client';

import { useState, useEffect } from 'react';

export default function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false);

    // Toggle visibility based on scroll position
    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);

        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    // Smooth scroll to top
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    const handleFeedback = () => {
        window.open(
            'https://github.com/vinnie291/sunnylink-wiki/issues/new?title=Feedback&body=Describe%20your%20feedback%20here...',
            '_blank'
        );
    };

    return (
        <div
            className={`
                fixed bottom-24 md:bottom-8 right-8 z-50 flex flex-col items-center gap-4
                transition-all duration-300 transform
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
            `}
        >
            {/* Scroll to Top */}
            <button
                onClick={scrollToTop}
                className="p-3 rounded-full shadow-lg border border-slate-700 bg-slate-800 text-cyan-400 hover:bg-slate-700 hover:text-cyan-300 hover:border-cyan-500/50 transition-all duration-300"
                aria-label="Scroll to top"
            >
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                </svg>
            </button>

            {/* Feedback */}
            <button
                onClick={handleFeedback}
                className="p-3 rounded-full shadow-lg border border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700 hover:text-amber-300 hover:border-amber-500/50 transition-all duration-300"
                aria-label="Send feedback"
                title="Send feedback"
            >
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                    />
                </svg>
            </button>
        </div>
    );
}

