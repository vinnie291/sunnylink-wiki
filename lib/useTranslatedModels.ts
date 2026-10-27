'use client';

import { useLanguage } from './i18n';

export function useTranslatedModels() {
    return useLanguage().content.models;
}
