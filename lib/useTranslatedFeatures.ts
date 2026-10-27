'use client';

import { useLanguage } from './i18n';

export function useTranslatedFeatures() {
    return useLanguage().content.features;
}
