import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    resolveModelMetadata,
    inferTelemetryProfile,
    parseModelDate,
    getModelDisplayName,
    getCanonicalAlias,
    getNamingNotes,
} from '../lib/modelMetadata';

test('resolveModelMetadata handles curated models with overrides', () => {
    const meta = resolveModelMetadata('the-cool-peoples-model-v3');
    assert.equal(meta.aliasOf, 'tcpmv3-the-cool-peoples-model');
    assert.equal(getCanonicalAlias(meta), 'tcpmv3-the-cool-peoples-model');
    assert.ok(meta.trainingParadigm);
    assert.ok(meta.supportedCompute.length > 0);
});

test('resolveModelMetadata falls back to inference for unknown models', () => {
    const meta = resolveModelMetadata({
        name: 'test-experimental-model-2024',
        tags: ['experimental', 'aggressive'],
        date: '2024-08-15',
    });
    assert.ok(meta.trainingParadigm);
    assert.ok(meta.supportedCompute);
    assert.ok(meta.telemetryProfile);
    assert.ok(meta.inferredFields.length > 0);
});

test('parseModelDate parses diverse format strings', () => {
    const d1 = parseModelDate('2024-05-12');
    assert.ok(d1 instanceof Date);
    assert.equal(d1.getFullYear(), 2024);
    assert.equal(d1.getMonth(), 4); // 0-indexed May

    const d2 = parseModelDate('October 2025');
    assert.ok(d2 instanceof Date);
    assert.equal(d2.getFullYear(), 2025);
    assert.equal(d2.getMonth(), 9); // 0-indexed October

    assert.equal(parseModelDate('invalid-date'), null);
    assert.equal(parseModelDate(undefined), null);
});

test('getModelDisplayName and getCanonicalAlias handle aliases properly', () => {
    assert.equal(getModelDisplayName('simple-model'), 'simple-model');
    const meta = resolveModelMetadata('the-cool-peoples-model-v3');
    assert.equal(getCanonicalAlias(meta), 'tcpmv3-the-cool-peoples-model');
});

test('getNamingNotes extracts commentary for known confusing model names', () => {
    const notes = getNamingNotes('the-cool-peoples-model-v3');
    assert.ok(notes.length > 0, 'should have notes for tcpmv3');
    assert.match(notes.join(' '), /tcpm/i);
});

test('inferTelemetryProfile differentiates early apex-cutting from late/lazy turn-in', () => {
    const early = inferTelemetryProfile({
        name: 'apex-cutter',
        negatives: ['Cuts corners and hugs turns tight'],
    });
    const late = inferTelemetryProfile({
        name: 'lazy-understeer',
        negatives: ['Drifts wide on turns and slow wheel return'],
    });
    assert.ok(early.turnInTiming < -0.3, `expected early turn-in, got ${early.turnInTiming}`);
    assert.ok(late.turnInTiming > 0.5, `expected late turn-in, got ${late.turnInTiming}`);
});
