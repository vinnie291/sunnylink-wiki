import assert from 'node:assert/strict';
import { test } from 'node:test';
import modelsData from '../data/models.json';
import carsData from '../data/cars.json';
import { findModelBySlugOrName, modelNameToSlug } from '../lib/modelSlug';

const models = Array.from(
    new Map(
        (modelsData.categories as { models: { name: string }[] }[])
            .flatMap(category => category.models)
            .map(model => [model.name, model])
    ).values()
);

test('driving models generate clean slugs and resolve via search params', () => {
    const slugs = new Set<string>();
    for (const model of models) {
        const slug = modelNameToSlug(model.name);
        assert.ok(slug, `Model ${model.name} must have a valid slug`);
        assert.ok(!slugs.has(slug), `Duplicate slug detected: ${slug}`);
        slugs.add(slug);

        // URL parsing simulation
        const url = new URL(`/models?model=${slug}`, 'http://localhost');
        const queryParam = url.searchParams.get('model');
        const resolved = findModelBySlugOrName(models, queryParam);
        assert.equal(resolved?.name, model.name, `Failed to resolve ${model.name} from slug ${slug}`);
    }
});

test('cars have valid IDs and can be queried via vehicle search params', () => {
    const vehicles = carsData.vehicles as { id: string; make: string; model: string }[];
    assert.ok(vehicles.length > 0, 'Cars database must not be empty');

    const carIds = new Set<string>();
    for (const car of vehicles) {
        assert.ok(car.id, `Car ${car.make} ${car.model} must have an ID`);
        assert.ok(!carIds.has(car.id), `Duplicate car ID: ${car.id}`);
        carIds.add(car.id);

        const url = new URL(`/cars?vehicle=${car.id}&search=${encodeURIComponent(car.model)}`, 'http://localhost');
        assert.equal(url.searchParams.get('vehicle'), car.id);
        const resolved = vehicles.find(v => v.id === url.searchParams.get('vehicle'));
        assert.equal(resolved?.id, car.id);
    }
});
