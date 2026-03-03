'use client';

import { useLanguage, Locale } from './i18n';

// Static imports for all locale-specific data files
import togglesEn from '../data/toggles.json';
import togglesKo from '../data/toggles.ko.json';
import togglesZh from '../data/toggles.zh.json';
import togglesFr from '../data/toggles.fr.json';
import togglesDe from '../data/toggles.de.json';
import togglesEs from '../data/toggles.es.json';

import modelsEn from '../data/models.json';
import modelsKo from '../data/models.ko.json';
import modelsZh from '../data/models.zh.json';
import modelsFr from '../data/models.fr.json';
import modelsDe from '../data/models.de.json';
import modelsEs from '../data/models.es.json';

import featuresEn from '../data/features.json';
import featuresKo from '../data/features.ko.json';
import featuresZh from '../data/features.zh.json';
import featuresFr from '../data/features.fr.json';
import featuresDe from '../data/features.de.json';
import featuresEs from '../data/features.es.json';

const togglesMap: Record<Locale, typeof togglesEn> = {
    en: togglesEn,
    ko: togglesKo as typeof togglesEn,
    zh: togglesZh as typeof togglesEn,
    fr: togglesFr as typeof togglesEn,
    de: togglesDe as typeof togglesEn,
    es: togglesEs as typeof togglesEn,
};

const modelsMap: Record<Locale, typeof modelsEn> = {
    en: modelsEn,
    ko: modelsKo as typeof modelsEn,
    zh: modelsZh as typeof modelsEn,
    fr: modelsFr as typeof modelsEn,
    de: modelsDe as typeof modelsEn,
    es: modelsEs as typeof modelsEn,
};

const featuresMap: Record<Locale, typeof featuresEn> = {
    en: featuresEn,
    ko: featuresKo as typeof featuresEn,
    zh: featuresZh as typeof featuresEn,
    fr: featuresFr as typeof featuresEn,
    de: featuresDe as typeof featuresEn,
    es: featuresEs as typeof featuresEn,
};

export function useTranslatedToggles() {
    const { locale } = useLanguage();
    return togglesMap[locale] ?? togglesEn;
}

export function useTranslatedModels() {
    const { locale } = useLanguage();
    return modelsMap[locale] ?? modelsEn;
}

export function useTranslatedFeatures() {
    const { locale } = useLanguage();
    return featuresMap[locale] ?? featuresEn;
}
