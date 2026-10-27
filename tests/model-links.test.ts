import assert from 'node:assert/strict';
import { test } from 'node:test';
import data from '../data/models.json';
import { findModelBySlugOrName, modelNameToSlug } from '../lib/modelSlug';

const models = Array.from(new Map((data.categories as { models: { name: string }[] }[]).flatMap(category => category.models).map(model => [model.name, model])).values());

test('every driving model has a unique shareable slug that resolves to itself', () => {
    const slugs = new Set<string>();
    for (const model of models) {
        const slug = modelNameToSlug(model.name);
        assert.ok(slug, model.name);
        assert.ok(!slugs.has(slug), `Duplicate slug: ${slug}`);
        slugs.add(slug);
        const url = new URL(`/models?model=${slug}`, 'http://localhost');
        assert.equal(findModelBySlugOrName(models, url.searchParams.get('model'))?.name, model.name);
    }
});
