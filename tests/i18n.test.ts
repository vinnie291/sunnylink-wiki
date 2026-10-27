import assert from 'node:assert/strict';
import test from 'node:test';
import { interpolate, translateText } from '../lib/textTranslation';
import { ENGLISH_CONTENT, loadLocalizedContent } from '../lib/localizedContent';
import { deriveDrivingProfile } from '../components/DriveSimulation';
import type { Locale } from '../lib/i18n';
import { deriveFeedbackPhysics } from '../lib/new-sim/feedback';
import { normalizePublicFleetCard } from '../lib/metabase';
import { deriveSkillRatingsDetail } from '../lib/skillRatings';

const locales: Locale[] = ['en', 'ko', 'zh', 'fr', 'de', 'es'];

test('interpolation preserves replacement characters and repeated parameters', () => {
    assert.equal(interpolate('{{name}} / {{name}} / {{count}}', { name: '$& $1', count: 0 }), '$& $1 / $& $1 / 0');
});

test('each locale loads the matching UI and complete datasets together', async () => {
    const bundles = await Promise.all(locales.map(loadLocalizedContent));
    for (const content of bundles) {
        assert.ok(content.messages['models.title']);
        assert.deepEqual(content.cars.vehicles.map(car => car.id), ENGLISH_CONTENT.cars.vehicles.map(car => car.id));
        assert.deepEqual(content.features.features.map(feature => feature.id), ENGLISH_CONTENT.features.features.map(feature => feature.id));
        assert.deepEqual(content.models.categories.map(category => category.models.map(model => model.name)), ENGLISH_CONTENT.models.categories.map(category => category.models.map(model => model.name)));
        assert.deepEqual(content.toggles.categories.map(category => category.settings.map(setting => setting.key)), ENGLISH_CONTENT.toggles.categories.map(category => category.settings.map(setting => setting.key)));
        if (content.locale !== 'en') {
            assert.notEqual(content.features.features[0].userTranslation, ENGLISH_CONTENT.features.features[0].userTranslation);
            assert.notEqual(translateText('SYSTEM ACTIVE', content.messages, content.locale), 'SYSTEM ACTIVE');
            assert.notEqual(translateText('🛑 STOPPED AT RED LIGHT', content.messages, content.locale), '🛑 STOPPED AT RED LIGHT');
        }
    }
});

test('template text translates counts without leaking placeholders', async () => {
    for (const locale of locales.filter(locale => locale !== 'en')) {
        const content = await loadLocalizedContent(locale);
        const label = translateText('Bad: 17%', content.messages, locale);
        assert.notEqual(label, 'Bad: 17%');
        assert.ok(label.includes('17'));
        assert.ok(!label.includes('{{'));
        assert.equal(translateText('WMI V12', content.messages, locale), 'WMI V12');
    }
});

test('model behavior stays identical when evidence is translated', async () => {
    const english = ENGLISH_CONTENT.models.categories[0].models[0];
    for (const locale of locales.filter(locale => locale !== 'en')) {
        const content = await loadLocalizedContent(locale);
        const localized = content.models.categories[0].models[0];
        assert.deepEqual(deriveDrivingProfile(localized), deriveDrivingProfile(english));
    }
});

test('generated simulator evidence quotes and multiline tooltips translate', async () => {
    const quotes = new Set(ENGLISH_CONTENT.models.categories.flatMap(category => category.models.flatMap(model =>
        deriveFeedbackPhysics(model).evidence.map(evidence => evidence.quote))));
    for (const locale of locales.filter(locale => locale !== 'en')) {
        const content = await loadLocalizedContent(locale);
        for (const quote of quotes) {
            if (quote.split(/\s+/).length < 5) continue;
            assert.notEqual(translateText(quote, content.messages, locale), quote, `${locale}: ${quote}`);
        }
        assert.notEqual(translateText('Community polarity 90/100\n+ Smooth braking', content.messages, locale), 'Community polarity 90/100\n+ Smooth braking');
        assert.notEqual(translateText('2026-10-02', content.messages, locale), '2026-10-02');
    }
});

test('native fleet tables exclude pivot subtotals and localize every column', async () => {
    const pivot = normalizePublicFleetCard(45, [['toyota', 'staging', 0, 12], ['toyota', null, 1, 12]]);
    assert.deepEqual(pivot?.rows, [['toyota', 'staging', 12]]);
    for (const id of [39, 40, 42, 43, 45, 46]) {
        const chart = normalizePublicFleetCard(id, []);
        assert.ok(chart);
        for (const locale of locales.filter(locale => locale !== 'en')) {
            const content = await loadLocalizedContent(locale);
            for (const label of [chart.title, ...chart.columns].filter(label => label !== 'MADS')) {
                assert.notEqual(translateText(label, content.messages, locale), label, `${locale}: ${label}`);
            }
        }
    }
});

test('rating evidence localizes its source and matched signal without changing ratings', async () => {
    const models = ENGLISH_CONTENT.models.categories.flatMap<{ name: string }>(category => category.models);
    const sources = new Set(models.flatMap(model => deriveSkillRatingsDetail(model).evidence.filter(evidence => evidence.delta !== 0).map(evidence => evidence.source)));
    for (const locale of locales.filter(locale => locale !== 'en')) {
        const content = await loadLocalizedContent(locale);
        for (const source of sources) assert.notEqual(translateText(source, content.messages, locale), source, `${locale}: ${source}`);
        for (const model of content.models.categories.flatMap<{ name: string }>(category => category.models)) {
            const canonical = models.find(original => original.name === model.name)!;
            assert.deepEqual(deriveSkillRatingsDetail(model).ratings, deriveSkillRatingsDetail(canonical).ratings);
        }
    }
});
