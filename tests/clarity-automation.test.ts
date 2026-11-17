import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    CLARITY_ENDPOINT,
    normalizeClarityMetrics,
    analyzeClarityIssues,
    remediateClarityIssues,
    syncClarityPipeline,
} from '../scripts/sync_clarity_insights.mjs';
import { syncClarityGithubIssues } from '../scripts/sync_clarity_github_issues.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function makeTempWorkspace() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarity-test-'));
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app', 'models'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app', 'cars'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app', 'features'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app', 'wizard'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app', 'stats'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'components'), { recursive: true });
    for (const r of ['', 'models', 'cars', 'features', 'wizard', 'stats']) {
        fs.writeFileSync(path.join(dir, 'app', r, 'page.tsx'), 'export default function Page() { return null; }\n');
    }
    fs.writeFileSync(
        path.join(dir, 'data', 'models.json'),
        JSON.stringify({ categories: [{ models: [{ name: 'Down to Ride v6' }] }] })
    );
    fs.writeFileSync(
        path.join(dir, 'data', 'cars.json'),
        JSON.stringify({ vehicles: [{ make: 'Toyota' }] })
    );
    fs.writeFileSync(
        path.join(dir, 'data', 'clarity_redirects.json'),
        JSON.stringify({ lastUpdated: null, redirects: {} }, null, 2)
    );
    return dir;
}

test('normalizeClarityMetrics parses Clarity API response fields accurately', () => {
    const raw = [
        {
            metricName: 'Traffic',
            information: [
                {
                    totalSessionCount: '120',
                    totalBotSessionCount: '10',
                    distantUserCount: '95',
                    PagesPerSessionPercentage: 2.4,
                    URL: 'https://sunnylink.wiki/models',
                },
            ],
        },
        {
            metricName: 'Script Error Count',
            information: [
                {
                    subTotal: '6',
                    sessionsCount: '5',
                    sessionsWithMetricPercentage: 4.17,
                    URL: 'https://sunnylink.wiki/models',
                },
            ],
        },
        {
            metricName: 'RageClickCount',
            information: [
                {
                    subTotal: '12',
                    sessionsCount: '9',
                    sessionsWithMetricPercentage: 7.5,
                    URL: 'https://sunnylink.wiki/models',
                },
            ],
        },
    ];

    const normalized = normalizeClarityMetrics(raw, 'URL');
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].url, 'https://sunnylink.wiki/models');
    assert.equal(normalized[0].sessions, 120);
    assert.equal(normalized[0].distinctUsers, 95);
    assert.equal(normalized[0].scriptErrors, 6);
    assert.equal(normalized[0].scriptErrorRatePct, 4.17);
    assert.equal(normalized[0].rageClicks, 12);
    assert.equal(normalized[0].rageClickRatePct, 7.5);
});

test('syncClarityPipeline fetches Clarity insights, auto-fixes broken paths via redirects, and respects daily quota guard', async () => {
    const tmpDir = makeTempWorkspace();
    const seenRequests: Array<{ url: string; auth: string }> = [];

    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        seenRequests.push({ url: String(url), auth: headers.Authorization ?? '' });
        const parsed = new URL(String(url));
        const dim = parsed.searchParams.get('dimension1');

        if (dim === 'URL') {
            return new Response(
                JSON.stringify([
                    {
                        metricName: 'Traffic',
                        information: [
                            { totalSessionCount: '50', URL: 'https://sunnylink.wiki/settings' },
                            { totalSessionCount: '25', URL: 'https://sunnylink.wiki/models/down-to-ride-v6' },
                            { totalSessionCount: '40', URL: 'https://sunnylink.wiki/models' },
                        ],
                    },
                    {
                        metricName: 'ScriptErrorCount',
                        information: [
                            { subTotal: '4', sessionsCount: '4', sessionsWithMetricPercentage: 10, URL: 'https://sunnylink.wiki/models' },
                        ],
                    },
                ]),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify([
                {
                    metricName: 'Traffic',
                    information: [
                        { totalSessionCount: '75', Device: 'Mobile' },
                        { totalSessionCount: '40', Device: 'Desktop' },
                    ],
                },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    };

    try {
        const res = await syncClarityPipeline({
            rootDir: tmpDir,
            token: 'test-clarity-token',
            fetchImpl: mockFetch,
        });

        assert.equal(seenRequests.length, 2);
        assert.ok(seenRequests[0].url.startsWith(CLARITY_ENDPOINT));
        assert.equal(seenRequests[0].auth, 'Bearer test-clarity-token');
        assert.equal(res.insights.lastStatus, 'ok');
        assert.equal(res.insights.quota.requestsUsedToday, 2);
        assert.equal(res.redirectsChanged, true);

        const redirects = JSON.parse(fs.readFileSync(path.join(tmpDir, 'data', 'clarity_redirects.json'), 'utf8'));
        assert.equal(redirects.redirects['/settings'], '/');
        assert.equal(redirects.redirects['/models/down-to-ride-v6'], '/models?model=down-to-ride-v6');

        // Script error on /models should remain unresolved for developer/GitHub issue tracking
        const scriptErrorIssue = res.insights.issues.find(i => i.type === 'script_error' && i.route === '/models') as { autoFixed?: boolean } | undefined;
        assert.ok(scriptErrorIssue);
        assert.equal(Boolean(scriptErrorIssue.autoFixed), false);

        // Quota guard test: simulate 8/10 calls already used today
        const insightsPath = path.join(tmpDir, 'data', 'clarity_insights.json');
        const current = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
        current.quota.requestsUsedToday = 8;
        fs.writeFileSync(insightsPath, JSON.stringify(current, null, 2));

        seenRequests.length = 0;
        const guarded = await syncClarityPipeline({
            rootDir: tmpDir,
            token: 'test-clarity-token',
            fetchImpl: mockFetch,
        });
        assert.equal(seenRequests.length, 0);
        assert.equal(guarded.insights.lastStatus, 'skipped_quota_guard');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('analyzeClarityIssues flags mobile UX gaps and remediateClarityIssues fixes case-mismatched internal links', () => {
    const tmpDir = makeTempWorkspace();
    try {
        fs.writeFileSync(
            path.join(tmpDir, 'components', 'TestNav.tsx'),
            'import Link from "next/link";\nexport function TestNav() { return <Link href="/Models">Models</Link>; }\n'
        );

        const issues = analyzeClarityIssues(
            [],
            [
                { device: 'Mobile', sessions: 60, deadClickRatePct: 9, rageClickRatePct: 3, errorClickRatePct: 0 },
                { device: 'Desktop', sessions: 80, deadClickRatePct: 2, rageClickRatePct: 0.5, errorClickRatePct: 0 },
            ],
            tmpDir
        );

        assert.ok(issues.some(i => i.type === 'mobile_ux_gap'));
        const { fixesApplied } = remediateClarityIssues(issues, tmpDir);
        assert.ok(fixesApplied.some(f => f.type === 'internal_link_fixed' && f.to === '/models'));
        const fixedSrc = fs.readFileSync(path.join(tmpDir, 'components', 'TestNav.tsx'), 'utf8');
        assert.match(fixedSrc, /href="\/models"/);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('syncClarityPipeline preserves cached insights when Clarity returns 429 rate limit', async () => {
    const tmpDir = makeTempWorkspace();
    try {
        fs.writeFileSync(
            path.join(tmpDir, 'data', 'clarity_insights.json'),
            JSON.stringify({
                endpoint: CLARITY_ENDPOINT,
                lastFetchedAt: '2026-11-16T00:00:00.000Z',
                lastStatus: 'ok',
                quota: { dateUtc: new Date().toISOString().slice(0, 10), requestsUsedToday: 2, dailyLimit: 10 },
                pages: [{ url: 'https://sunnylink.wiki/', sessions: 100 }],
                devices: [],
            })
        );

        const res = await syncClarityPipeline({
            rootDir: tmpDir,
            token: 'test-token',
            fetchImpl: async () => new Response('Exceeded daily limit', { status: 429 }),
        });

        assert.equal(res.insights.lastStatus, 'rate_limited');
        assert.equal(res.insights.pages.length, 1);
        assert.equal(res.insights.lastFetchedAt, '2026-11-16T00:00:00.000Z');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('syncClarityGithubIssues opens new issues and auto-closes resolved ones', async () => {
    const tmpDir = makeTempWorkspace();
    const calls: Array<{ method: string; url: string; body: Record<string, unknown> | null }> = [];
    const mockGhFetch = async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        const method = init?.method ?? 'GET';
        calls.push({ method, url: urlStr, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
        if (method === 'GET' && urlStr.includes('/issues?')) {
            return new Response(
                JSON.stringify([
                    {
                        number: 101,
                        title: '[Clarity UX] Rage Clicks on /cars',
                        body: '<!-- clarity-issue-id:rage_click:/cars -->\nOld alert',
                    },
                ]),
                { status: 200 }
            );
        }
        return new Response(JSON.stringify({ number: 102 }), { status: 201 });
    };

    try {
        fs.writeFileSync(
            path.join(tmpDir, 'data', 'clarity_insights.json'),
            JSON.stringify({
                lastFetchedAt: '2026-11-17T01:00:00.000Z',
                issues: [
                    {
                        id: 'script_error:/models',
                        type: 'script_error',
                        severity: 'high',
                        route: '/models',
                        url: 'https://sunnylink.wiki/models',
                        sessions: 50,
                        metricValue: 5,
                        ratePct: 10,
                        autoFixed: false,
                        sourceFiles: ['app/models/page.tsx'],
                        summary: '5 script errors on /models',
                    },
                ],
            })
        );

        const res = await syncClarityGithubIssues({
            rootDir: tmpDir,
            token: 'gh-token',
            repo: 'vinnie291/sunnylink-wiki',
            fetchImpl: mockGhFetch,
        });

        assert.equal(res.created, 1);
        assert.equal(res.closed, 1);
        assert.ok(calls.some(c => c.method === 'POST' && c.url.endsWith('/issues') && String(c.body?.title).includes('/models')));
        assert.ok(calls.some(c => c.method === 'PATCH' && c.url.endsWith('/issues/101') && c.body?.state === 'closed'));
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('autonomous-master.yml wires CLARITY_API_TOKEN and GitHub issue sync', () => {
    const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'autonomous-master.yml'), 'utf8');
    assert.match(workflow, /issues:\s*write/);
    assert.match(workflow, /CLARITY_API_TOKEN:\s*\$\{\{\s*secrets\.CLARITY_API_TOKEN\s*\}\}/);
    assert.match(workflow, /node scripts\/sync_clarity_github_issues\.mjs/);
});
