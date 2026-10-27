import type { Locale } from './i18n';
import en from '../locales/en.json';
import cars from '../data/cars.json';
import features from '../data/features.json';
import models from '../data/models.json';
import toggles from '../data/toggles.json';

export type Messages = Record<string, string>;
export interface LocalizedContent {
    locale: Locale;
    messages: Messages;
    cars: typeof cars;
    features: typeof features;
    models: typeof models;
    toggles: typeof toggles;
}

export const ENGLISH_CONTENT: LocalizedContent = { locale: 'en', messages: en, cars, features, models, toggles };
const cache = new Map<Locale, Promise<LocalizedContent>>([['en', Promise.resolve(ENGLISH_CONTENT)]]);
const loaders = {
    ko: () => Promise.all([import('../locales/ko.json'), import('../data/cars.ko.json'), import('../data/features.ko.json'), import('../data/models.ko.json'), import('../data/toggles.ko.json')]),
    zh: () => Promise.all([import('../locales/zh.json'), import('../data/cars.zh.json'), import('../data/features.zh.json'), import('../data/models.zh.json'), import('../data/toggles.zh.json')]),
    fr: () => Promise.all([import('../locales/fr.json'), import('../data/cars.fr.json'), import('../data/features.fr.json'), import('../data/models.fr.json'), import('../data/toggles.fr.json')]),
    de: () => Promise.all([import('../locales/de.json'), import('../data/cars.de.json'), import('../data/features.de.json'), import('../data/models.de.json'), import('../data/toggles.de.json')]),
    es: () => Promise.all([import('../locales/es.json'), import('../data/cars.es.json'), import('../data/features.es.json'), import('../data/models.es.json'), import('../data/toggles.es.json')]),
};

/** Commit a language only after its UI and all four datasets are available. */
export function loadLocalizedContent(locale: Locale): Promise<LocalizedContent> {
    const pending = cache.get(locale);
    if (pending) return pending;
    const request = loaders[locale as Exclude<Locale, 'en'>]().then(([messages, cars, features, models, toggles]) => ({
        locale, messages: messages.default, cars: cars.default, features: features.default,
        models: models.default, toggles: toggles.default,
    }) as unknown as LocalizedContent).catch(error => {
        cache.delete(locale);
        throw error;
    });
    cache.set(locale, request);
    return request;
}
