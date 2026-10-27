'use client';

import { useLanguage } from './i18n';

export function useTranslatedCars() {
    return useLanguage().content.cars;
}
