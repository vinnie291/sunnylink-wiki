'use client';

import { useState, useEffect } from 'react';
import { useLanguage, Locale } from './i18n';
import carsEn from '../data/cars.json';

const carsLoaders: Record<Locale, () => Promise<{ default: unknown }>> = {
    en: () => Promise.resolve({ default: carsEn }),
    ko: () => import('../data/cars.ko.json'),
    zh: () => import('../data/cars.zh.json'),
    fr: () => import('../data/cars.fr.json'),
    de: () => import('../data/cars.de.json'),
    es: () => import('../data/cars.es.json'),
};

const carsCache: Partial<Record<Locale, typeof carsEn>> = {
    en: carsEn,
};

export function useTranslatedCars() {
    const { locale } = useLanguage();
    const [data, setData] = useState<typeof carsEn>(() => carsCache[locale] ?? carsEn);

    useEffect(() => {
        if (carsCache[locale]) return;

        let isMounted = true;
        carsLoaders[locale]().then((mod) => {
            const typedData = mod.default as unknown as typeof carsEn;
            carsCache[locale] = typedData;
            if (isMounted) {
                setData(typedData);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [locale]);

    return carsCache[locale] ?? data;
}
