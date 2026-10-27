import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    calculateConfidenceScore,
    computeGlobalMean,
    getConfidenceInfo,
    scoreToStars,
} from '../lib/ranking';

test('a single 5-star review does not outrank a well-tested 4.6', () => {
    const single = calculateConfidenceScore(5, 1, 20);
    const proven = calculateConfidenceScore(4.6, 25, 8400);
    assert.ok(proven > single, `${proven} should exceed ${single}`);
});

test('items with no evidence fall back to the global mean', () => {
    assert.equal(calculateConfidenceScore(5, 0, 0, 3.5), 3.5);
    assert.equal(calculateConfidenceScore(1, 0, 0, 4.1), 4.1);
});

test('more evidence moves the score toward the item rating', () => {
    const few = calculateConfidenceScore(4.9, 2, 10);
    const many = calculateConfidenceScore(4.9, 200, 10);
    assert.ok(many > few);
    assert.ok(many < 4.9);
});

test('route volume contributes log-scaled supplementary weight', () => {
    const quiet = calculateConfidenceScore(4.8, 3, 1);
    const busy = calculateConfidenceScore(4.8, 3, 100000);
    assert.ok(busy > quiet);
});

test('global mean is review-weighted and ignores unreviewed items', () => {
    const mean = computeGlobalMean([
        { rating: 5, reviewCount: 1 },
        { rating: 3, reviewCount: 3 },
        { rating: 1, reviewCount: 0 },
    ]);
    assert.equal(mean, 3.5);
    assert.equal(computeGlobalMean([], 4.1), 4.1);
});

test('confidence pill reflects sample size', () => {
    assert.equal(getConfidenceInfo(1, 0).level, 'low');
    assert.match(getConfidenceInfo(1, 0).label, /Low Sample/);
    const high = getConfidenceInfo(25, 8400);
    assert.equal(high.level, 'high');
    assert.match(high.label, /High Confidence/);
    assert.match(high.label, /8\.4k routes/);
});

test('score to stars stays within 1-5', () => {
    assert.equal(scoreToStars(0), 1);
    assert.equal(scoreToStars(100), 5);
    assert.equal(scoreToStars(150), 5);
});
