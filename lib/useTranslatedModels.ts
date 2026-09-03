'use client';

import { useState, useEffect } from 'react';
import { useLanguage, Locale } from './i18n';
import modelsEn from '../data/models.json';

const modelsLoaders: Record<Locale, () => Promise<{ default: unknown }>> = {
    en: () => Promise.resolve({ default: modelsEn }),
    ko: () => import('../data/models.ko.json'),
    zh: () => import('../data/models.zh.json'),
    fr: () => import('../data/models.fr.json'),
    de: () => import('../data/models.de.json'),
    es: () => import('../data/models.es.json'),
};

const modelsCache: Partial<Record<Locale, typeof modelsEn>> = {
    en: modelsEn,
};

export function useTranslatedModels() {
    const { locale } = useLanguage();
    const [data, setData] = useState<typeof modelsEn>(() => modelsCache[locale] ?? modelsEn);

    useEffect(() => {
        if (modelsCache[locale]) return;

        let isMounted = true;
        modelsLoaders[locale]().then((mod) => {
            const typedData = mod.default as unknown as typeof modelsEn;
            modelsCache[locale] = typedData;
            if (isMounted) {
                setData(typedData);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [locale]);

    return modelsCache[locale] ?? data;
}
