'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';

const pageKeys: Record<string, string> = {
    '/': 'settings.database',
    '/cars': 'cars.title',
    '/features': 'features.title',
    '/models': 'models.title',
    '/stats': 'stats.title',
    '/wizard': 'cw.welcome.title',
    '/wizard/classic': 'wizard.title',
    '/quiz': 'quiz.title',
};
const pageTitles: Record<string, string> = {
    '/new-sim': 'Driving Lab',
    '/model-replay': 'Synthetic vs. Real Model Vision',
    '/sim-test': 'Simulator comparison',
};

export default function LocalizedDocumentTitle() {
    const pathname = usePathname();
    const { t, tx } = useLanguage();
    useEffect(() => {
        const title = pageKeys[pathname] ? t(pageKeys[pathname]) : tx(pageTitles[pathname] ?? 'Sunnylink Wiki');
        const localized = `${title} | Sunnylink Wiki`;
        const update = () => { if (document.title !== localized) document.title = localized; };
        // Next can stream route metadata after the language effect has run.
        const observer = new MutationObserver(update);
        observer.observe(document.head, { childList: true, subtree: true, characterData: true });
        update();
        return () => observer.disconnect();
    }, [pathname, t, tx]);
    return null;
}
