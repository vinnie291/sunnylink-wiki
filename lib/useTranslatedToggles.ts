'use client';

import { useState, useEffect } from 'react';
import { useLanguage, Locale } from './i18n';
import togglesEn from '../data/toggles.json';

const togglesLoaders: Record<Locale, () => Promise<{ default: unknown }>> = {
    en: () => Promise.resolve({ default: togglesEn }),
    ko: () => import('../data/toggles.ko.json'),
    zh: () => import('../data/toggles.zh.json'),
    fr: () => import('../data/toggles.fr.json'),
    de: () => import('../data/toggles.de.json'),
    es: () => import('../data/toggles.es.json'),
};

const togglesCache: Partial<Record<Locale, typeof togglesEn>> = {
    en: togglesEn,
};

export function useTranslatedToggles() {
    const { locale } = useLanguage();
    const [data, setData] = useState<typeof togglesEn>(() => togglesCache[locale] ?? togglesEn);

    useEffect(() => {
        if (togglesCache[locale]) return;

        let isMounted = true;
        togglesLoaders[locale]().then((mod) => {
            const typedData = mod.default as unknown as typeof togglesEn;
            togglesCache[locale] = typedData;
            if (isMounted) {
                setData(typedData);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [locale]);

    return togglesCache[locale] ?? data;
}
