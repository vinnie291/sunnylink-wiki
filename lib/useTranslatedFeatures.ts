'use client';

import { useState, useEffect } from 'react';
import { useLanguage, Locale } from './i18n';
import featuresEn from '../data/features.json';

const featuresLoaders: Record<Locale, () => Promise<{ default: unknown }>> = {
    en: () => Promise.resolve({ default: featuresEn }),
    ko: () => import('../data/features.ko.json'),
    zh: () => import('../data/features.zh.json'),
    fr: () => import('../data/features.fr.json'),
    de: () => import('../data/features.de.json'),
    es: () => import('../data/features.es.json'),
};

const featuresCache: Partial<Record<Locale, typeof featuresEn>> = {
    en: featuresEn,
};

export function useTranslatedFeatures() {
    const { locale } = useLanguage();
    const [data, setData] = useState<typeof featuresEn>(() => featuresCache[locale] ?? featuresEn);

    useEffect(() => {
        if (featuresCache[locale]) return;

        let isMounted = true;
        featuresLoaders[locale]().then((mod) => {
            const typedData = mod.default as unknown as typeof featuresEn;
            featuresCache[locale] = typedData;
            if (isMounted) {
                setData(typedData);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [locale]);

    return featuresCache[locale] ?? data;
}
