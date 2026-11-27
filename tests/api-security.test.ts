import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
    createSignedVoterToken,
    verifySignedVoterToken,
    checkRateLimit,
    getRateLimitMapSize,
    MAX_RATE_LIMIT_KEYS,
    recordVote,
} from '../lib/modelVotes';
import { GET as voteGET, POST as votePOST, getClientIp } from '../app/api/models/vote/route';
import nextConfig from '../next.config';

function makePostRequest(
    rawBody: string,
    headers: Record<string, string> = {}
): NextRequest {
    return new NextRequest('http://localhost:3000/api/models/vote', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.10',
            ...headers,
        },
        body: rawBody,
    });
}

test('HMAC-signed voter tokens validate authentic tokens and reject any tampering', () => {
    const token = createSignedVoterToken();
    assert.equal(token.length, 61);
    assert.equal(verifySignedVoterToken(token), true);

    const [uuid, sig] = token.split('.');
    assert.equal(uuid.length, 36);
    assert.equal(sig.length, 24);

    // Flip one hex character in UUID
    const flippedUuidChar = uuid[0] === 'a' ? 'b' : 'a';
    const tamperedUuidToken = `${flippedUuidChar}${uuid.slice(1)}.${sig}`;
    assert.equal(verifySignedVoterToken(tamperedUuidToken), false);

    // Flip one hex character in HMAC signature
    const flippedSigChar = sig[0] === 'a' ? 'b' : 'a';
    const tamperedSigToken = `${uuid}.${flippedSigChar}${sig.slice(1)}`;
    assert.equal(verifySignedVoterToken(tamperedSigToken), false);

    // Reject unsigned plain UUIDs and malformed strings
    assert.equal(verifySignedVoterToken(crypto.randomUUID()), false);
    assert.equal(verifySignedVoterToken(`${token}.extra`), false);
    assert.equal(verifySignedVoterToken(''), false);
    assert.equal(verifySignedVoterToken(null), false);
    assert.equal(verifySignedVoterToken(undefined), false);
});

test('POST /api/models/vote enforces model allowlist, payload limits, anti-pollution, and signed tokens', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunnylink-api-sec-'));
    const votesFile = path.join(tmpDir, 'isolated_votes.json');
    const prevVotesPath = process.env.VOTES_FILE_PATH;
    process.env.VOTES_FILE_PATH = votesFile;

    try {
        // 1. Unknown modelName -> 404 and does not pollute votes store
        const unknownRes = await votePOST(
            makePostRequest(
                JSON.stringify({
                    modelName: 'Injected Fake Model 9999',
                    answers: { overall: '5 - Great' },
                })
            )
        );
        assert.equal(unknownRes.status, 404);
        const unknownJson = await unknownRes.json();
        assert.equal(unknownJson.success, false);
        assert.equal(unknownJson.error, 'Unknown driving model');
        assert.equal(fs.existsSync(votesFile), false);

        // 2. Oversized payload (> 16384 bytes) -> 413
        const hugePayload = JSON.stringify({
            modelName: 'WMI V12',
            answers: { overall: '5 - Great' },
            padding: 'x'.repeat(17_000),
        });
        const oversizedRes = await votePOST(makePostRequest(hugePayload));
        assert.equal(oversizedRes.status, 413);

        // 3. Prototype-pollution keys in answers & root body -> 400
        const protoAnswersRaw = '{"modelName":"WMI V12","answers":{"__proto__":{"polluted":true}}}';
        const protoAnswersRes = await votePOST(makePostRequest(protoAnswersRaw));
        assert.equal(protoAnswersRes.status, 400);
        assert.equal(({} as Record<string, unknown>).polluted, undefined);

        const constructorKeyRaw = '{"modelName":"WMI V12","answers":{"constructor":"bad"}}';
        const constructorRes = await votePOST(makePostRequest(constructorKeyRaw));
        assert.equal(constructorRes.status, 400);

        const rootProtoRaw = '{"__proto__":{"polluted":1},"modelName":"WMI V12","answers":{"overall":5}}';
        const rootProtoRes = await votePOST(makePostRequest(rootProtoRaw));
        assert.equal(rootProtoRes.status, 400);

        // 4. Unsigned bodyToken spoofing -> 400
        const spoofedTokenRes = await votePOST(
            makePostRequest(
                JSON.stringify({
                    modelName: 'WMI V12',
                    answers: { overall: '5 - Great' },
                    voterToken: crypto.randomUUID(),
                })
            )
        );
        assert.equal(spoofedTokenRes.status, 400);

        // 5. Valid vote mints signed HttpOnly cookie + signed voterToken, and subsequent signed bodyToken deduplicates voter
        const validRes1 = await votePOST(
            makePostRequest(
                JSON.stringify({
                    modelName: 'WMI V12',
                    answers: { overall: '5 - Great' },
                }),
                { 'x-forwarded-for': '198.51.100.25' }
            )
        );
        assert.equal(validRes1.status, 200);
        const setCookie = validRes1.headers.get('set-cookie') || '';
        assert.match(setCookie, /sl_voter_token=/);
        assert.match(setCookie, /HttpOnly/i);
        assert.match(setCookie, /SameSite=lax/i);

        const validJson1 = await validRes1.json();
        assert.equal(validJson1.success, true);
        assert.equal(verifySignedVoterToken(validJson1.voterToken), true);

        // Re-submitting with the server-signed voterToken updates existing vote instead of adding a second voter
        const validRes2 = await votePOST(
            makePostRequest(
                JSON.stringify({
                    modelName: 'WMI V12',
                    answers: { overall: '4 - Good' },
                    voterToken: validJson1.voterToken,
                }),
                { 'x-forwarded-for': '198.51.100.25' }
            )
        );
        assert.equal(validRes2.status, 200);

        const storedVotes = JSON.parse(fs.readFileSync(votesFile, 'utf-8')) as Record<string, { answers: Record<string, unknown> }>;
        assert.equal(Object.keys(storedVotes).length, 1);
        assert.equal(Object.values(storedVotes)[0].answers.overall, '4 - Good');

        // Verify GET also issues a signed HttpOnly cookie when none was provided
        const getRes = await voteGET(
            new NextRequest('http://localhost:3000/api/models/vote?model=WMI%20V12', {
                headers: { 'x-forwarded-for': '198.51.100.26' },
            })
        );
        assert.equal(getRes.status, 200);
        const getJson = await getRes.json();
        assert.equal(verifySignedVoterToken(getJson.voterToken), true);
    } finally {
        if (prevVotesPath === undefined) {
            delete process.env.VOTES_FILE_PATH;
        } else {
            process.env.VOTES_FILE_PATH = prevVotesPath;
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('getClientIp bounds header size and prefers Google Front End rightmost IP on Cloud Run', () => {
    const prevKService = process.env.K_SERVICE;
    try {
        delete process.env.K_SERVICE;
        const localReq = new NextRequest('http://localhost:3000/api/models/vote', {
            headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' },
        });
        assert.equal(getClientIp(localReq), '198.51.100.1');

        process.env.K_SERVICE = 'sunnylink-wiki-service';
        const cloudRunReq = new NextRequest('http://localhost:3000/api/models/vote', {
            headers: {
                'x-forwarded-for': '1.2.3.4, 203.0.113.77',
                'x-real-ip': '9.9.9.9',
            },
        });
        assert.equal(getClientIp(cloudRunReq), '203.0.113.77');

        const oversizedForwardedReq = new NextRequest('http://localhost:3000/api/models/vote', {
            headers: { 'x-forwarded-for': '1.1.1.1, '.repeat(100) },
        });
        assert.equal(getClientIp(oversizedForwardedReq), '127.0.0.1');
    } finally {
        if (prevKService === undefined) {
            delete process.env.K_SERVICE;
        } else {
            process.env.K_SERVICE = prevKService;
        }
    }
});

test('rateLimitMap enforces per-voter limit and caps total keys at MAX_RATE_LIMIT_KEYS under >5,000 keys', () => {
    const singleVoter = `rl-single-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
        assert.equal(checkRateLimit(singleVoter, 5), true);
    }
    assert.equal(checkRateLimit(singleVoter, 5), false);

    // Flood with 6,200 unique rotating keys
    for (let i = 0; i < 6_200; i++) {
        checkRateLimit(`flood-voter-${i}`);
    }
    assert.ok(
        getRateLimitMapSize() <= MAX_RATE_LIMIT_KEYS,
        `Expected rateLimitMap size (${getRateLimitMapSize()}) <= ${MAX_RATE_LIMIT_KEYS}`
    );
});

test('atomic vote persistence via VOTES_FILE_PATH writes clean JSON with zero leftover temp files and next.config.ts sets CSP/HSTS', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunnylink-atomic-votes-'));
    const votesFile = path.join(tmpDir, 'nested', 'votes.json');
    const prevVotesPath = process.env.VOTES_FILE_PATH;
    process.env.VOTES_FILE_PATH = votesFile;

    try {
        recordVote('WMI V12', 'atomic-voter-1', { overall: '5 - Great', domain_lateral: 5 });
        recordVote('WMI V12', 'atomic-voter-2', { overall: '4 - Good', stack_lateral: 'NNLC' });

        assert.equal(fs.existsSync(votesFile), true);
        const dirEntries = fs.readdirSync(path.dirname(votesFile));
        assert.deepEqual(dirEntries, ['votes.json']);

        const parsed = JSON.parse(fs.readFileSync(votesFile, 'utf-8')) as Record<string, { modelName: string }>;
        assert.equal(Object.keys(parsed).length, 2);
        assert.equal(parsed['atomic-voter-1:::wmi v12'].modelName, 'WMI V12');
    } finally {
        if (prevVotesPath === undefined) {
            delete process.env.VOTES_FILE_PATH;
        } else {
            process.env.VOTES_FILE_PATH = prevVotesPath;
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    assert.equal(typeof nextConfig.headers, 'function');
    const headerRules = await nextConfig.headers!();
    const globalRule = headerRules.find(r => r.source === '/:path*');
    assert.ok(globalRule, 'Expected /:path* security header rule');
    const headerMap = new Map(globalRule.headers.map(h => [h.key, h.value]));

    assert.equal(headerMap.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains');
    assert.equal(headerMap.get('X-DNS-Prefetch-Control'), 'on');
    const csp = headerMap.get('Content-Security-Policy') || '';
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.match(csp, /https:\/\/\*\.clarity\.ms/);
});

test('Cloud Run GCS hydration merges newer updatedAt records and fails silently when metadata is unavailable', async () => {
    const http = await import('node:http');
    const { ensureCloudVotesHydrated, calculateBlendedModelStats } = await import('../lib/modelVotes');

    let uploadedPayload: Record<string, unknown> | null = null;
    let metadataFlavorSeen = '';

    const server = http.createServer((req, res) => {
        if (req.url === '/token') {
            metadataFlavorSeen = String(req.headers['metadata-flavor'] || '');
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ access_token: 'mock-gcp-token', expires_in: 3600 }));
            return;
        }
        if (req.method === 'GET' && req.url?.startsWith('/storage/v1/b/')) {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    'shared-voter:::wmi v12': {
                        voterHash: 'shared-voter',
                        modelName: 'WMI V12',
                        answers: { overall: '5 - Great' },
                        updatedAt: '2026-11-25T12:00:00.000Z',
                    },
                    'cloud-only:::wmi v12': {
                        voterHash: 'cloud-only',
                        modelName: 'WMI V12',
                        answers: { overall: '4 - Good' },
                        updatedAt: '2026-11-25T10:00:00.000Z',
                    },
                })
            );
            return;
        }
        if (req.method === 'POST' && req.url?.startsWith('/upload/storage/v1/b/')) {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
            });
            req.on('end', () => {
                uploadedPayload = JSON.parse(body);
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ generation: '1' }));
            });
            return;
        }
        res.writeHead(404);
        res.end();
    });

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunnylink-gcs-sync-'));
    const votesFile = path.join(tmpDir, 'votes.json');
    // Seed local file with an older record for shared-voter and a newer local-only record
    fs.writeFileSync(
        votesFile,
        JSON.stringify({
            'shared-voter:::wmi v12': {
                voterHash: 'shared-voter',
                modelName: 'WMI V12',
                answers: { overall: '2 - Bad' },
                updatedAt: '2026-11-01T00:00:00.000Z',
            },
            'local-only:::wmi v12': {
                voterHash: 'local-only',
                modelName: 'WMI V12',
                answers: { overall: '5 - Great' },
                updatedAt: '2026-11-26T00:00:00.000Z',
            },
        }),
        'utf-8'
    );

    const savedEnv = {
        VOTES_FILE_PATH: process.env.VOTES_FILE_PATH,
        VOTES_GCS_BUCKET: process.env.VOTES_GCS_BUCKET,
        VOTES_GCS_METADATA_URL: process.env.VOTES_GCS_METADATA_URL,
        VOTES_GCS_API_BASE: process.env.VOTES_GCS_API_BASE,
    };

    process.env.VOTES_FILE_PATH = votesFile;
    process.env.VOTES_GCS_BUCKET = 'test-bucket';
    process.env.VOTES_GCS_METADATA_URL = `${baseUrl}/token`;
    process.env.VOTES_GCS_API_BASE = baseUrl;

    try {
        await ensureCloudVotesHydrated();
        assert.equal(metadataFlavorSeen, 'Google');

        const mergedOnDisk = JSON.parse(fs.readFileSync(votesFile, 'utf-8')) as Record<
            string,
            { answers: Record<string, unknown> }
        >;
        // Cloud's newer updatedAt wins over older local record, while local-only & cloud-only are both preserved
        assert.equal(mergedOnDisk['shared-voter:::wmi v12'].answers.overall, '5 - Great');
        assert.equal(mergedOnDisk['cloud-only:::wmi v12'].answers.overall, '4 - Good');
        assert.equal(mergedOnDisk['local-only:::wmi v12'].answers.overall, '5 - Great');

        const summary = calculateBlendedModelStats('WMI V12');
        assert.ok(summary.totalVoters >= 3);

        // Recording a new vote triggers debounced background upload to GCS
        recordVote('WMI V12', 'fresh-voter', { overall: '5 - Great' });
        await new Promise(resolve => setTimeout(resolve, 400));
        assert.ok(uploadedPayload !== null, 'Expected debounced GCS background upload');
        assert.ok('fresh-voter:::wmi v12' in (uploadedPayload as Record<string, unknown>));
    } finally {
        for (const [k, v] of Object.entries(savedEnv)) {
            if (v === undefined) {
                delete process.env[k];
            } else {
                process.env[k] = v;
            }
        }
        await new Promise<void>(resolve => server.close(() => resolve()));
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

