'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const UniversalSearch = dynamic(() => import('./UniversalSearch'), { ssr: false });

export default function UniversalSearchTrigger() {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const handleOpen = () => setShouldRender(true);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                setShouldRender(true);
            }
        };

        window.addEventListener('open-universal-search', handleOpen);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('open-universal-search', handleOpen);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    if (!shouldRender) return null;

    return <UniversalSearch initialOpen={true} />;
}
