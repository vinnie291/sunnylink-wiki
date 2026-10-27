'use client';

import { useLanguage } from './i18n';

export function useTranslatedToggles() {
    return useLanguage().content.toggles;
}
