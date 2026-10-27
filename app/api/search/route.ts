import { NextResponse } from 'next/server';
import { rankWithJev, selectSearchCandidates } from '../../../lib/jevSearch';

export const runtime = 'nodejs';

const cache = new Map<string, { ids: string[]; expires: number }>();
let windowStart = 0;
let requests = 0;
let active = 0;
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
    let body: unknown;
    try {
        // Bound input before parsing, even for chunked requests.
        const reader = request.body?.getReader();
        if (!reader) return json({ error: 'Missing query' }, 400);
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 65536) {
                await reader.cancel();
                return json({ error: 'Request too large' }, 413);
            }
            chunks.push(value);
        }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        return json({ error: 'Invalid JSON' }, 400);
    }
    if (!body || typeof body !== 'object' || !('query' in body) || typeof body.query !== 'string' ||
        body.query.trim().length < 3 || body.query.length > 200) {
        return json({ error: 'Query must contain 3–200 characters' }, 400);
    }
    const query = body.query.trim();
    const ids = 'candidateIds' in body ? body.candidateIds : [];
    if (!Array.isArray(ids) || ids.length > 24 || ids.some(id => typeof id !== 'string' || id.length > 250)) {
        return json({ error: 'Invalid candidate IDs' }, 400);
    }
    const allowedIds = 'allowedIds' in body ? body.allowedIds : undefined;
    if (allowedIds !== undefined && (!Array.isArray(allowedIds) || allowedIds.length > 1000 ||
        allowedIds.some(id => typeof id !== 'string' || id.length > 250))) {
        return json({ error: 'Invalid allowed IDs' }, 400);
    }
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) return json({ ids: [], source: 'local' });
    const candidates = selectSearchCandidates(query, ids, allowedIds as string[] | undefined);
    if (!candidates.length) return json({ ids: [], source: 'local' });
    const key = JSON.stringify([process.env.TYPESAFE_MODEL, query, candidates.map(item => item.id)]);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return json({ ids: cached.ids, source: 'jev' });
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requests = 0; }
    // Per-process budget; use a shared rate limiter for multiple production instances.
    if (requests >= 60 || active >= 4) return json({ ids: [], source: 'local' }, 429);
    requests++;
    active++;
    try {
        const ranked = await rankWithJev(query, candidates, apiKey, request.signal);
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { ids: ranked, expires: Date.now() + 300_000 });
        return json({ ids: ranked, source: 'jev' });
    } catch {
        // Do not leak credentials, queries, or provider response bodies.
        return json({ ids: [], source: 'local' });
    } finally {
        active--;
    }
}
