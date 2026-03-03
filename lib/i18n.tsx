'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from 'react';

// Import all locale files statically for bundling
import en from '../locales/en.json';
import ko from '../locales/ko.json';
import zh from '../locales/zh.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import es from '../locales/es.json';

export type Locale = 'en' | 'ko' | 'zh' | 'fr' | 'de' | 'es';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ko', 'zh', 'fr', 'de', 'es'];

export const LOCALE_META: Record<Locale, { flag: string; name: string }> = {
    en: { flag: '🇺🇸', name: 'English' },
    ko: { flag: '🇰🇷', name: '한국어' },
    zh: { flag: '🇨🇳', name: '中文' },
    fr: { flag: '🇫🇷', name: 'Français' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    es: { flag: '🇲🇽', name: 'Español' },
};

type Messages = Record<string, string>;

const messages: Record<Locale, Messages> = {
    en: en as Messages,
    ko: ko as Messages,
    zh: zh as Messages,
    fr: fr as Messages,
    de: de as Messages,
    es: es as Messages,
};

const STORAGE_KEY = 'sunnylink-wiki-locale';

function detectBrowserLocale(): Locale {
    if (typeof navigator === 'undefined') return 'en';
    const lang = navigator.language?.toLowerCase() ?? '';
    // Try exact match first (e.g. "ko", "zh", "fr", "de", "es")
    for (const locale of SUPPORTED_LOCALES) {
        if (lang === locale || lang.startsWith(locale + '-')) return locale;
    }
    return 'en';
}

function getSavedLocale(): Locale | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LOCALES.includes(saved as Locale)) {
            return saved as Locale;
        }
    } catch {
        // localStorage may be blocked
    }
    return null;
}

interface LanguageContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    locale: 'en',
    setLocale: () => { },
    t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');
    const [mounted, setMounted] = useState(false);

    // Initialize locale on mount
    useEffect(() => {
        const saved = getSavedLocale();
        const initial = saved ?? detectBrowserLocale();
        setLocaleState(initial);
        setMounted(true);
    }, []);

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        try {
            localStorage.setItem(STORAGE_KEY, newLocale);
        } catch {
            // ignore
        }
        // Update <html lang> attribute
        document.documentElement.lang = newLocale;
    }, []);

    // Set initial <html lang> on mount
    useEffect(() => {
        if (mounted) {
            document.documentElement.lang = locale;
        }
    }, [mounted, locale]);

    const t = useCallback(
        (key: string, params?: Record<string, string | number>): string => {
            let value = messages[locale]?.[key] ?? messages.en[key] ?? key;
            if (params) {
                Object.entries(params).forEach(([k, v]) => {
                    value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
                });
            }
            return value;
        },
        [locale]
    );

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}
