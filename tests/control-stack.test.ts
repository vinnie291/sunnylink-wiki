import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    classifyCarLateral,
    classifyCarLongitudinal,
    classifyCarHardware,
    sanitizeStackAnswers,
    tallyMatchesFilters,
    deriveDomainPriors,
    blendDomainRating,
    EMPTY_STACK_FILTERS,
    hasActiveStackFilter,
} from '../lib/controlStack';

test('classifyCarLateral recognizes torque, nnlc, pid, angle', () => {
    assert.deepEqual(classifyCarLateral({ lateralControl: 'Torque Tuning' }), ['Torque']);
    assert.deepEqual(classifyCarLateral({ torqueTuning: 'NNLC' }), ['NNLC']);
    assert.deepEqual(classifyCarLateral({ lateralControl: 'PID' }), ['PID']);
    assert.deepEqual(classifyCarLateral({ lateralControl: 'Angle' }), ['Angle']);
    assert.deepEqual(classifyCarLateral(undefined), []);
});

test('classifyCarLongitudinal identifies Chill, OEM Radar, Experimental, DEC', () => {
    assert.deepEqual(
        classifyCarLongitudinal({ longitudinalControl: 'openpilot (Stock Radar)' }),
        ['OEM Radar']
    );
    assert.deepEqual(
        classifyCarLongitudinal({ longitudinalControl: 'openpilot (OP Long)' }),
        ['Chill']
    );
    assert.deepEqual(
        classifyCarLongitudinal({ longitudinalControl: 'openpilot', experimentalMode: 'Always On' }),
        ['Experimental']
    );
    assert.deepEqual(
        classifyCarLongitudinal({ longitudinalControl: 'Dynamic Experimental Control (DEC)', experimentalMode: 'Dynamic' }),
        ['DEC']
    );
});

test('classifyCarHardware detects comma 3X and comma 4', () => {
    assert.deepEqual(classifyCarHardware('comma 3X'), ['C3X']);
    assert.deepEqual(classifyCarHardware('comma 4 / 3X'), ['C3X', 'C4']);
    assert.deepEqual(classifyCarHardware('comma 3 / 2'), ['C3X']); // matches comma 3
    assert.deepEqual(classifyCarHardware(undefined), []);
});

test('sanitizeStackAnswers enforces allowed enum values and bounds domain ratings', () => {
    const raw = {
        stack_lateral: 'Torque',
        stack_long: 'InvalidMode',
        stack_hardware: 'C4',
        domain_lateral: 4,
        domain_long_chill: 99, // out of 1-5 range -> dropped
        domain_long_e2e: '3', // string number coerced to 3
    };
    const sanitized = sanitizeStackAnswers(raw);
    assert.equal(sanitized.stack_lateral, 'Torque');
    assert.equal(sanitized.stack_long, undefined);
    assert.equal(sanitized.stack_hardware, 'C4');
    assert.equal(sanitized.domain_lateral, 4);
    assert.equal(sanitized.domain_long_chill, undefined);
    assert.equal(sanitized.domain_long_e2e, 3);
});

test('tallyMatchesFilters checks vote counts against MIN_STACK_VOTES', () => {
    const tally = {
        lateral: { Torque: 5, NNLC: 1 },
        longitudinal: { Chill: 3, Experimental: 0 },
        hardware: { C3X: 10, C4: 1 },
    };

    assert.ok(tallyMatchesFilters(tally, EMPTY_STACK_FILTERS));
    assert.ok(!hasActiveStackFilter(EMPTY_STACK_FILTERS));

    // Torque has 5 votes (>= 2)
    assert.ok(tallyMatchesFilters(tally, { lateral: 'Torque', longitudinal: null, hardware: null }));
    // NNLC only has 1 vote (< 2)
    assert.ok(!tallyMatchesFilters(tally, { lateral: 'NNLC', longitudinal: null, hardware: null }));
    // C4 only has 1 vote (< 2)
    assert.ok(!tallyMatchesFilters(tally, { lateral: 'Torque', longitudinal: 'Chill', hardware: 'C4' }));
    // C3X has 10 votes (>= 2)
    assert.ok(tallyMatchesFilters(tally, { lateral: 'Torque', longitudinal: 'Chill', hardware: 'C3X' }));
});

test('deriveDomainPriors and blendDomainRating produce calibrated domain scores', () => {
    const priors = deriveDomainPriors({
        lat: 80,
        long: 70,
        stability: 85,
        comfort: 60,
        turns: 75,
        urban: 65,
    });
    assert.ok(priors.lateral >= 1 && priors.lateral <= 5);
    assert.ok(priors.longChill >= 1 && priors.longChill <= 5);
    assert.ok(priors.e2e >= 1 && priors.e2e <= 5);

    // Blending with 0 votes yields the prior
    const emptyStat = { average: 0, count: 0 };
    assert.equal(blendDomainRating(priors.lateral, emptyStat), priors.lateral);

    // Blending with 5 reviews of 5.0 averages with prior
    const blended = blendDomainRating(3.0, { average: 5.0, count: 5 });
    // (5*5.0 + 3.0*5) / (5 + 5) = 4.0
    assert.equal(blended, 4.0);
});
