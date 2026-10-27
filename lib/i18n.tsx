'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    ReactNode,
} from 'react';

import { ENGLISH_CONTENT, loadLocalizedContent, type LocalizedContent } from './localizedContent';
import { interpolate, translateText } from './textTranslation';

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

const STORAGE_KEY = 'sunnylink-wiki-locale';

function detectZhFlag(): string {
    if (typeof navigator === 'undefined') return '🇨🇳';
    const lang = navigator.language?.toLowerCase() ?? '';
    // Taiwanese locales use zh-TW or zh-Hant
    if (lang === 'zh-tw' || lang.startsWith('zh-hant')) return '🇹🇼';
    return '🇨🇳';
}

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
    content: LocalizedContent;
    tx: { (text: string): string; (text: string | undefined): string | undefined };
    getLocaleMeta: () => Record<Locale, { flag: string; name: string }>;
}

const LanguageContext = createContext<LanguageContextType>({
    locale: 'en',
    content: ENGLISH_CONTENT,
    tx: ((text: string | undefined) => text) as LanguageContextType['tx'],
    setLocale: () => { },
    t: (key: string) => key,
    getLocaleMeta: () => LOCALE_META,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    // Match the server's English render, then restore the saved/browser language.
    const [content, setContent] = useState<LocalizedContent>(ENGLISH_CONTENT);
    const locale = content.locale;
    const [zhFlag] = useState<string>(() => detectZhFlag());
    const requestVersion = useRef(0);

    const setLocale = useCallback((newLocale: Locale) => {
        if (!SUPPORTED_LOCALES.includes(newLocale)) return;
        const version = ++requestVersion.current;
        void loadLocalizedContent(newLocale).then(next => {
            if (version !== requestVersion.current) return;
            setContent(next);
            try { localStorage.setItem(STORAGE_KEY, newLocale); } catch { /* blocked storage */ }
        }).catch(error => {
            // Keep the current complete language; a subsequent selection can retry.
            console.error(`[i18n] Failed to load ${newLocale}`, error);
        });
    }, []);

    const cancelPendingLocale = useCallback(() => { requestVersion.current++; }, []);

    useEffect(() => {
        setLocale(getSavedLocale() ?? detectBrowserLocale());
        return cancelPendingLocale;
    }, [setLocale, cancelPendingLocale]);

    useEffect(() => { document.documentElement.lang = locale; }, [locale]);

    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        const value = content.messages[key] ?? ENGLISH_CONTENT.messages[key];
        if (value === undefined && process.env.NODE_ENV !== 'production') {
            console.warn(`[i18n] Missing translation for "${key}" (locale: ${locale})`);
        }
        return interpolate(value ?? key, params);
    }, [content, locale]);

    const tx = useCallback((text: string | undefined) => text === undefined ? undefined : translateText(text, content.messages, locale), [content, locale]) as LanguageContextType['tx'];

    const getLocaleMeta = useCallback(
        (): Record<Locale, { flag: string; name: string }> => ({
            ...LOCALE_META,
            zh: { ...LOCALE_META.zh, flag: zhFlag },
        }),
        [zhFlag]
    );

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t, tx, content, getLocaleMeta }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}

export const useTranslation = useLanguage;

export function useTextTranslation() {
    return useLanguage().tx;
}
