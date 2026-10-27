import { mergePageSearch } from '../lib/pageSearch';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { rankWithJev, selectSearchCandidates } from '../lib/jevSearch';
import { mergeSemanticResults, type SearchIdentity } from '../lib/semanticSearch';
import { POST } from '../app/api/search/route';

const originalFetch = globalThis.fetch;
const originalKey = process.env.TYPESAFE_API_KEY;
afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
});

test('natural language candidates include relevant wiki evidence and have a bounded size', () => {
    for (const [query, expected] of [
        ['steering stays on when I brake', 'feature:mads'],
        ['car drives too far right', 'setting:AdjustCameraOffset'],
        ['R1S', 'car:rivian-r1s-2022'],
    ]) {
        const candidates = selectSearchCandidates(query);
        assert.ok(candidates.some(item => item.id === expected), query);
        assert.ok(candidates.length <= 24);
    }
    assert.equal(selectSearchCandidates('asdfqzxv123').length, 0);
    const translated = selectSearchCandidates('제동', ['feature:mads', 'invented:url']);
    assert.equal(translated[0].id, 'feature:mads');
    assert.ok(!translated.some(item => item.id === 'invented:url'));
});

test('Jev batches candidate questions, filters irrelevant entries, and sorts by score', async () => {
    const candidates = selectSearchCandidates('brake').slice(0, 3);
    globalThis.fetch = async (input, init) => {
        assert.equal(input, 'https://api.typesafe.ai/v1/systemone');
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-key');
        const body = JSON.parse(String(init?.body));
        assert.equal(body.state.query, 'brake');
        assert.equal(Object.keys(body.questions).length, 3);
        assert.match(body.questions.candidate_1.instructions, /candidates\[1\]/);
        assert.equal(body.questions.candidate_1.criteria.length, 4);
        return Response.json({ answers: {
            candidate_0: { type: 'score', score: 1.8 },
            candidate_1: { type: 'score', score: 0.4 },
            candidate_2: { type: 'score', score: 2.9 },
            invented: { type: 'score', score: 3 },
        } });
    };
    assert.deepEqual(await rankWithJev('brake', candidates, 'test-key'), [candidates[2].id, candidates[0].id]);
});

test('malformed or missing provider scores reject the ranking', async () => {
    for (const payload of [null, {}, { answers: {} }, { answers: { candidate_0: { type: 'score', score: 30 } } }]) {
        globalThis.fetch = async () => Response.json(payload);
        await assert.rejects(rankWithJev('brake', selectSearchCandidates('brake').slice(0, 1), 'test-key'));
    }
});

test('exact acronyms and vehicle models stay first; unknown IDs are discarded', () => {
    const items: SearchIdentity[] = [
        { id: 'nnlc', type: 'feature', title: 'Neural Network Lateral Control' },
        { id: 'r1s', type: 'car', title: 'Rivian R1S', make: 'Rivian', model: 'R1S' },
        { id: 'offset', type: 'setting', title: 'Adjust Camera Offset' },
    ];
    for (const query of ['NNLC', 'R1S']) {
        const local = query === 'NNLC' ? [items[0], items[2]] : [items[1], items[2]];
        const merged = mergeSemanticResults(items, local, ['setting:offset', 'https://example.com', 'setting:offset'], query);
        assert.equal(merged[0], local[0]);
        assert.equal(merged.length, 2);
    }
    assert.deepEqual(mergeSemanticResults(items, [], ['setting:offset'], 'lane position'), [items[2]]);
});

const request = (body: unknown) => new Request('http://localhost/api/search', { method: 'POST', body: JSON.stringify(body) });

test('route validates input and falls back without credentials without making requests', async () => {
    delete process.env.TYPESAFE_API_KEY;
    globalThis.fetch = async () => { throw new Error('Must not call provider'); };
    for (const body of [null, {}, { query: 'a' }, { query: 'x'.repeat(201) }, { query: 'brake', candidateIds: [42] }]) {
        assert.equal((await POST(request(body))).status, 400);
    }
    assert.equal((await POST(request({ query: 'x'.repeat(70000) }))).status, 413);
    const response = await POST(request({ query: 'brake' }));
    assert.deepEqual(await response.json(), { ids: [], source: 'local' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('provider failures fall back; valid rankings are cached', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    for (const status of [401, 429, 529]) {
        globalThis.fetch = async () => new Response(null, { status });
        const response = await POST(request({ query: 'brake' }));
        assert.deepEqual(await response.json(), { ids: [], source: 'local' });
    }
    globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
    assert.equal((await (await POST(request({ query: 'brake' }))).json()).source, 'local');
    let calls = 0;
    globalThis.fetch = async (_, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        return Response.json({ answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, { type: 'score', score: 2.5 }])) });
    };
    const first = await (await POST(request({ query: 'brake' }))).json();
    assert.equal(first.source, 'jev');
    assert.ok(first.ids.length > 0);
    assert.deepEqual(await (await POST(request({ query: 'brake' }))).json(), first);
    assert.equal(calls, 1);
});

test('page scopes constrain retrieval before shortlisting and cannot be bypassed by local IDs', () => {
    const allowed = ['setting:MadsEnabled', 'setting:MadsSteeringMode'];
    const candidates = selectSearchCandidates('steering stays on when I brake', ['feature:mads'], allowed);
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every(item => allowed.includes(item.id)));
    assert.deepEqual(selectSearchCandidates('brake', ['feature:mads'], []), []);
});

test('route rejects malformed scopes and never calls Jev for an empty scope', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    globalThis.fetch = async () => { throw new Error('Must not call provider'); };
    for (const allowedIds of [null, 'model', [42], Array(1001).fill('feature:mads')]) {
        assert.equal((await POST(request({ query: 'brake', allowedIds }))).status, 400);
    }
    assert.deepEqual(await (await POST(request({ query: 'brake', allowedIds: [] }))).json(), { ids: [], source: 'local' });
});


test('page results preserve exact matches, resolve grouped variants, and exclude out-of-scope IDs', () => {
    const rivian = { id: 'r1s', type: 'car' as const, title: 'Rivian R1S', model: 'R1S', aliases: ['r1s-2022', 'r1s-2024'] };
    const ford = { id: 'ford', type: 'car' as const, title: 'Ford F150', model: 'F150', aliases: ['ford'] };
    assert.deepEqual(mergePageSearch([rivian, ford], [rivian], ['car:ford', 'car:r1s-2024', 'car:r1s-2022', 'setting:MadsEnabled'], 'R1S', item => item), [rivian, ford]);
    assert.deepEqual(mergePageSearch([rivian], [], ['car:ford', 'car:r1s-2024'], 'electric SUV', item => item), [rivian]);
});
