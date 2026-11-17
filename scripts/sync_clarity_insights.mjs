#!/usr/bin/env node
/**
 * Microsoft Clarity Data Export & Autonomous Issue Remediation
 *
 * Fetches live project UX & error insights from Microsoft Clarity:
 *   https://www.clarity.ms/export-data/api/v1/project-live-insights
 *
 * Respects Clarity's 10 requests/project/day quota (max 2 requests per 6h run),
 * normalizes per-URL and per-Device metrics into data/clarity_insights.json,
 * automatically applies safe fixes (e.g. 404/typo/deep-link redirects in
 * data/clarity_redirects.json served by middleware.ts), and emits actionable
 * UX issue diagnostics for GitHub Issue tracking.
 *
 * Usage:
 *   node scripts/sync_clarity_insights.mjs [--force] [--offline]
 */

import fs from 'node:fs';
import path from 'node:path';

export const CLARITY_ENDPOINT = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';
const DEFAULT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DAILY_API_LIMIT = 10;
const SAFE_DAILY_BUDGET = 8; // 4 scheduled runs/day * 2 queries = 8

const ROUTE_ALIASES = {
    '/settings': '/',
    '/toggles': '/',
    '/toggle': '/',
    '/config': '/',
    '/vehicles': '/cars',
    '/vehicle': '/cars',
    '/supported-cars': '/cars',
    '/car': '/cars',
    '/driving-models': '/models',
    '/driving-model': '/models',
    '/model': '/models',
    '/telemetry': '/stats',
    '/analytics': '/stats',
    '/fleet': '/stats',
    '/simulator': '/models',
    '/sim': '/models',
    '/replay': '/model-replay',
    '/setup': '/wizard',
    '/guide': '/features',
    '/docs': '/features',
    '/feature': '/features',
};

const ROUTE_SOURCE_MAP = {
    '/': ['app/page.tsx', 'components/HomeClient.tsx'],
    '/models': ['app/models/page.tsx', 'components/ModelDatabase.tsx'],
    '/cars': ['app/cars/page.tsx', 'components/CarDatabase.tsx'],
    '/features': ['app/features/page.tsx', 'components/FeaturesClient.tsx'],
    '/wizard': ['app/wizard/page.tsx'],
    '/wizard/classic': ['app/wizard/classic/page.tsx'],
    '/quiz': ['app/quiz/page.tsx'],
    '/stats': ['app/stats/page.tsx', 'app/stats/StatsClient.tsx'],
    '/model-replay': ['app/model-replay/page.tsx', 'app/model-replay/ModelReplayClient.tsx'],
    '/new-sim': ['app/new-sim/page.tsx'],
};

function toNumber(val, fallback = 0) {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
        const parsed = Number(val.replace(/,/g, '').trim());
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function normalizeMetricName(name = '') {
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function modelNameToSlug(name) {
    return String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[a.length][b.length];
}

export function extractPathname(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    try {
        if (/^https?:\/\//i.test(trimmed)) {
            const u = new URL(trimmed);
            // Ignore external/preview hosts that aren't the live site or relative paths
            if (u.hostname && !/^(www\.)?sunnylink\.wiki$/i.test(u.hostname) && u.hostname !== 'localhost') {
                return null;
            }
            return u.pathname || '/';
        }
    } catch {
        // Fall back to path normalization below
    }
    const clean = trimmed.split('#')[0].split('?')[0];
    return clean.startsWith('/') ? clean : `/${clean}`;
}

export function normalizeClarityMetrics(rawMetrics, dimensionKey = 'URL') {
    const buckets = new Map();

    function getBucket(dimValue) {
        const key = String(dimValue || 'Unknown').trim() || 'Unknown';
        if (!buckets.has(key)) {
            buckets.set(key, {
                [dimensionKey === 'Device' ? 'device' : 'url']: key,
                sessions: 0,
                botSessions: 0,
                distinctUsers: 0,
                pagesPerSession: 0,
                avgEngagementTimeSec: 0,
                avgScrollDepthPct: 0,
                deadClicks: 0,
                deadClickSessions: 0,
                deadClickRatePct: 0,
                rageClicks: 0,
                rageClickSessions: 0,
                rageClickRatePct: 0,
                errorClicks: 0,
                errorClickSessions: 0,
                errorClickRatePct: 0,
                scriptErrors: 0,
                scriptErrorSessions: 0,
                scriptErrorRatePct: 0,
                quickbackClicks: 0,
                quickbackRatePct: 0,
                excessiveScrolls: 0,
                excessiveScrollRatePct: 0,
                pageViews: 0,
            });
        }
        return buckets.get(key);
    }

    if (!Array.isArray(rawMetrics)) return [];

    for (const metric of rawMetrics) {
        const metricKey = normalizeMetricName(metric?.metricName);
        const rows = Array.isArray(metric?.information) ? metric.information : [];

        for (const row of rows) {
            const dimVal = row[dimensionKey] ?? row[dimensionKey.toLowerCase()] ?? row.Url ?? row.url ?? row.Device ?? row.device ?? 'Unknown';
            const b = getBucket(dimVal);

            const count = toNumber(row.subTotal ?? row.totalCount ?? row.count ?? row.metricCount, 0);
            const sessCount = toNumber(row.sessionsCount, 0);
            const sessPct = toNumber(row.sessionsWithMetricPercentage, 0);
            const views = toNumber(row.pagesViews ?? row.pageViews, 0);
            if (views > b.pageViews) b.pageViews = views;

            switch (metricKey) {
                case 'traffic':
                    b.sessions = Math.max(b.sessions, toNumber(row.totalSessionCount ?? row.sessionsCount, 0));
                    b.botSessions = Math.max(b.botSessions, toNumber(row.totalBotSessionCount, 0));
                    b.distinctUsers = Math.max(b.distinctUsers, toNumber(row.distantUserCount ?? row.distinctUserCount, 0));
                    b.pagesPerSession = toNumber(row.pagesPerSessionPercentage ?? row.PagesPerSessionPercentage, b.pagesPerSession);
                    break;
                case 'engagementtime':
                    b.avgEngagementTimeSec = toNumber(row.activeTime ?? row.totalTime ?? row.averageEngagementTime, b.avgEngagementTimeSec);
                    break;
                case 'scrolldepth':
                    b.avgScrollDepthPct = toNumber(row.averageScrollDepth ?? row.scrollDepth, b.avgScrollDepthPct);
                    break;
                case 'deadclickcount':
                    b.deadClicks = count;
                    b.deadClickSessions = sessCount;
                    b.deadClickRatePct = sessPct;
                    break;
                case 'rageclickcount':
                    b.rageClicks = count;
                    b.rageClickSessions = sessCount;
                    b.rageClickRatePct = sessPct;
                    break;
                case 'errorclickcount':
                    b.errorClicks = count;
                    b.errorClickSessions = sessCount;
                    b.errorClickRatePct = sessPct;
                    break;
                case 'scripterrorcount':
                    b.scriptErrors = count;
                    b.scriptErrorSessions = sessCount;
                    b.scriptErrorRatePct = sessPct;
                    break;
                case 'quickbackclick':
                case 'quickbackclickcount':
                    b.quickbackClicks = count;
                    b.quickbackRatePct = sessPct;
                    break;
                case 'excessivescroll':
                case 'excessivescrollcount':
                    b.excessiveScrolls = count;
                    b.excessiveScrollRatePct = sessPct;
                    break;
                case 'popularpages':
                    b.sessions = Math.max(b.sessions, sessCount);
                    b.pageViews = Math.max(b.pageViews, toNumber(row.visitsCount ?? row.pagesViews ?? count, 0));
                    break;
                default:
                    break;
            }
        }
    }

    const list = Array.from(buckets.values());
    for (const item of list) {
        if (item.sessions > 0) {
            if (!item.deadClickRatePct && item.deadClickSessions > 0) {
                item.deadClickRatePct = Number(((item.deadClickSessions / item.sessions) * 100).toFixed(2));
            }
            if (!item.rageClickRatePct && item.rageClickSessions > 0) {
                item.rageClickRatePct = Number(((item.rageClickSessions / item.sessions) * 100).toFixed(2));
            }
            if (!item.errorClickRatePct && item.errorClickSessions > 0) {
                item.errorClickRatePct = Number(((item.errorClickSessions / item.sessions) * 100).toFixed(2));
            }
            if (!item.scriptErrorRatePct && item.scriptErrorSessions > 0) {
                item.scriptErrorRatePct = Number(((item.scriptErrorSessions / item.sessions) * 100).toFixed(2));
            }
        }
    }
    return list.sort((a, b) => b.sessions - a.sessions || b.pageViews - a.pageViews);
}

export function discoverValidRoutes(rootDir = DEFAULT_ROOT) {
    const routes = new Set(['/', '/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/icon.png']);
    const appDir = path.join(rootDir, 'app');

    function walkApp(dir, prefix = '') {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('_') || entry.name === 'api' || entry.name === '.well-known') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const seg = entry.name.startsWith('(') && entry.name.endsWith(')') ? '' : `/${entry.name}`;
                walkApp(full, `${prefix}${seg}`);
            } else if (entry.name === 'page.tsx' || entry.name === 'page.ts' || entry.name === 'route.ts') {
                routes.add(prefix || '/');
            }
        }
    }
    walkApp(appDir);

    const publicDir = path.join(rootDir, 'public');
    if (fs.existsSync(publicDir)) {
        for (const entry of fs.readdirSync(publicDir, { withFileTypes: true })) {
            if (entry.isFile()) routes.add(`/${entry.name}`);
        }
    }
    return routes;
}

function loadModelAndCarLookup(rootDir = DEFAULT_ROOT) {
    const modelSlugs = new Map();
    const carMakes = new Map();

    try {
        const modelsJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'models.json'), 'utf8'));
        for (const cat of modelsJson.categories || []) {
            for (const m of cat.models || []) {
                const slug = modelNameToSlug(m.name);
                if (slug) modelSlugs.set(slug, slug);
            }
        }
    } catch {
        // ignore if missing in isolated test
    }

    try {
        const carsJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'cars.json'), 'utf8'));
        for (const v of carsJson.vehicles || []) {
            if (v.make) {
                carMakes.set(v.make.toLowerCase(), v.make);
            }
        }
    } catch {
        // ignore if missing
    }

    return { modelSlugs, carMakes };
}

export function resolveBrokenPathTarget(rawPathname, validRoutes, lookup) {
    if (!rawPathname || rawPathname === '/') return null;
    const stripped = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '') : rawPathname;
    if (validRoutes.has(stripped)) {
        return rawPathname !== stripped ? stripped : null;
    }

    const lower = stripped.toLowerCase();
    // 1. Exact case-insensitive match to valid route
    for (const route of validRoutes) {
        if (route.toLowerCase() === lower) return route;
    }

    // 2. Known semantic aliases
    if (ROUTE_ALIASES[lower]) return ROUTE_ALIASES[lower];

    // 3. Model deep-link: /models/<slug> or /model/<slug>
    const modelMatch = lower.match(/^\/models?\/([^/]+)$/);
    if (modelMatch) {
        const candidateSlug = modelNameToSlug(decodeURIComponent(modelMatch[1]));
        if (lookup.modelSlugs.has(candidateSlug)) {
            return `/models?model=${encodeURIComponent(candidateSlug)}`;
        }
        return `/models?search=${encodeURIComponent(decodeURIComponent(modelMatch[1]))}`;
    }

    // 4. Car deep-link: /cars/<make> or /car/<make>
    const carMatch = lower.match(/^\/cars?\/([^/]+)$/);
    if (carMatch) {
        const rawMake = decodeURIComponent(carMatch[1]).toLowerCase();
        const canonicalMake = lookup.carMakes.get(rawMake) || decodeURIComponent(carMatch[1]);
        return `/cars?search=${encodeURIComponent(canonicalMake)}`;
    }

    // 5. Close typo match (Levenshtein distance <= 2 against top-level routes)
    let bestRoute = null;
    let bestDist = Infinity;
    for (const route of validRoutes) {
        if (route.includes('.')) continue;
        const dist = levenshtein(lower, route.toLowerCase());
        if (dist <= 2 && dist < bestDist) {
            bestDist = dist;
            bestRoute = route;
        }
    }
    return bestRoute;
}

export function analyzeClarityIssues(pages = [], devices = [], rootDir = DEFAULT_ROOT) {
    const validRoutes = discoverValidRoutes(rootDir);
    const lookup = loadModelAndCarLookup(rootDir);
    const issues = [];

    for (const page of pages) {
        const pathname = extractPathname(page.url);
        if (!pathname) continue;

        const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
        const isKnown =
            validRoutes.has(cleanPath) ||
            cleanPath.startsWith('/api/') ||
            cleanPath.startsWith('/.well-known/') ||
            cleanPath.startsWith('/_next/');

        const sourceFiles = ROUTE_SOURCE_MAP[cleanPath] || ['app/layout.tsx'];

        // 1. Broken / unknown URL traffic
        if (!isKnown && (page.sessions >= 1 || page.pageViews >= 1)) {
            const suggestedTarget = resolveBrokenPathTarget(pathname, validRoutes, lookup);
            issues.push({
                id: `broken_url:${pathname}`,
                type: 'broken_url',
                severity: suggestedTarget ? 'medium' : 'high',
                route: pathname,
                url: page.url,
                sessions: page.sessions,
                metricValue: page.sessions || page.pageViews,
                ratePct: page.quickbackRatePct || page.deadClickRatePct || 0,
                suggestedTarget,
                autoFixable: Boolean(suggestedTarget),
                sourceFiles: ['middleware.ts', 'data/clarity_redirects.json'],
                summary: suggestedTarget
                    ? `Visitors hit unknown path "${pathname}" (${page.sessions} sessions); can auto-redirect to "${suggestedTarget}".`
                    : `Visitors hit unknown/404 path "${pathname}" (${page.sessions} sessions) with no automatic route match.`,
            });
            continue;
        }

        // 2. JavaScript runtime errors on route
        if (page.scriptErrors >= 3 || (page.sessions >= 20 && page.scriptErrorRatePct >= 2)) {
            issues.push({
                id: `script_error:${cleanPath}`,
                type: 'script_error',
                severity: 'high',
                route: cleanPath,
                url: page.url,
                sessions: page.sessions,
                metricValue: page.scriptErrors,
                ratePct: page.scriptErrorRatePct,
                autoFixable: false,
                sourceFiles,
                summary: `${page.scriptErrors} script errors on ${cleanPath} (${page.scriptErrorRatePct}% of ${page.sessions} sessions).`,
            });
        }

        // 3. Error clicks (clicks triggering JS errors or failed interactions)
        if (page.errorClicks >= 5 || (page.sessions >= 20 && page.errorClickRatePct >= 3)) {
            issues.push({
                id: `error_click:${cleanPath}`,
                type: 'error_click',
                severity: 'high',
                route: cleanPath,
                url: page.url,
                sessions: page.sessions,
                metricValue: page.errorClicks,
                ratePct: page.errorClickRatePct,
                autoFixable: false,
                sourceFiles,
                summary: `${page.errorClicks} error clicks on ${cleanPath} (${page.errorClickRatePct}% of ${page.sessions} sessions).`,
            });
        }

        // 4. Rage clicks (frustrated repeated clicks)
        if (page.rageClicks >= 5 && (page.sessions < 20 || page.rageClickRatePct >= 3)) {
            issues.push({
                id: `rage_click:${cleanPath}`,
                type: 'rage_click',
                severity: page.rageClickRatePct >= 8 ? 'high' : 'medium',
                route: cleanPath,
                url: page.url,
                sessions: page.sessions,
                metricValue: page.rageClicks,
                ratePct: page.rageClickRatePct,
                autoFixable: false,
                sourceFiles,
                summary: `${page.rageClicks} rage clicks on ${cleanPath} (${page.rageClickRatePct}% of ${page.sessions} sessions).`,
            });
        }

        // 5. Dead clicks (clicks on non-interactive elements or broken UI targets)
        if (page.deadClicks >= 8 && page.deadClickRatePct >= 5) {
            issues.push({
                id: `dead_click:${cleanPath}`,
                type: 'dead_click',
                severity: page.deadClickRatePct >= 12 ? 'high' : 'medium',
                route: cleanPath,
                url: page.url,
                sessions: page.sessions,
                metricValue: page.deadClicks,
                ratePct: page.deadClickRatePct,
                autoFixable: false,
                sourceFiles,
                summary: `${page.deadClicks} dead clicks on ${cleanPath} (${page.deadClickRatePct}% of ${page.sessions} sessions).`,
            });
        }

        // 6. Quickback clicks (immediate bounce back)
        if (page.sessions >= 25 && page.quickbackRatePct >= 20) {
            issues.push({
                id: `quickback_click:${cleanPath}`,
                type: 'quickback_click',
                severity: 'medium',
                route: cleanPath,
                url: page.url,
                sessions: page.sessions,
                metricValue: page.quickbackClicks,
                ratePct: page.quickbackRatePct,
                autoFixable: false,
                sourceFiles,
                summary: `High quickback rate (${page.quickbackRatePct}%) on ${cleanPath} across ${page.sessions} sessions.`,
            });
        }
    }

    // 7. Device disparity check (Mobile vs Desktop UX gap)
    const mobile = devices.find(d => /^mobile$/i.test(d.device));
    const desktop = devices.find(d => /^desktop|pc$/i.test(d.device));
    if (mobile && desktop && mobile.sessions >= 20 && desktop.sessions >= 20) {
        const mobileFriction = mobile.deadClickRatePct + mobile.rageClickRatePct + mobile.errorClickRatePct;
        const desktopFriction = desktop.deadClickRatePct + desktop.rageClickRatePct + desktop.errorClickRatePct;
        if (mobileFriction >= 8 && mobileFriction >= Math.max(desktopFriction * 2, 1)) {
            issues.push({
                id: 'mobile_ux_gap:global',
                type: 'mobile_ux_gap',
                severity: 'medium',
                route: '*',
                url: 'Device: Mobile',
                sessions: mobile.sessions,
                metricValue: Number(mobileFriction.toFixed(2)),
                ratePct: Number(mobileFriction.toFixed(2)),
                autoFixable: false,
                sourceFiles: ['components/BottomNav.tsx', 'components/Header.tsx', 'app/globals.css'],
                summary: `Mobile UX friction (${mobileFriction.toFixed(1)}%) is >= 2x Desktop (${desktopFriction.toFixed(1)}%) across ${mobile.sessions} mobile sessions.`,
            });
        }
    }

    return issues;
}

export function remediateClarityIssues(issues, rootDir = DEFAULT_ROOT) {
    const redirectsPath = path.join(rootDir, 'data', 'clarity_redirects.json');
    let redirectData = { lastUpdated: null, redirects: {} };
    if (fs.existsSync(redirectsPath)) {
        try {
            redirectData = JSON.parse(fs.readFileSync(redirectsPath, 'utf8'));
            if (!redirectData.redirects || typeof redirectData.redirects !== 'object') {
                redirectData.redirects = {};
            }
        } catch {
            redirectData = { lastUpdated: null, redirects: {} };
        }
    }

    const fixesApplied = [];
    let redirectsChanged = false;

    for (const issue of issues) {
        if (issue.type === 'broken_url' && issue.suggestedTarget) {
            const fromPath = issue.route;
            const toPath = issue.suggestedTarget;
            if (fromPath && toPath && fromPath !== toPath && redirectData.redirects[fromPath] !== toPath) {
                redirectData.redirects[fromPath] = toPath;
                redirectsChanged = true;
                issue.autoFixed = true;
                issue.fixApplied = `Added 308 redirect rule "${fromPath}" -> "${toPath}" in data/clarity_redirects.json`;
                fixesApplied.push({
                    issueId: issue.id,
                    type: 'redirect_added',
                    from: fromPath,
                    to: toPath,
                    appliedAt: new Date().toISOString(),
                });
            } else if (redirectData.redirects[fromPath] === toPath) {
                issue.autoFixed = true;
                issue.fixApplied = `Redirect rule "${fromPath}" -> "${toPath}" already active`;
            }
        }
    }

    // Also audit internal <Link href="/..."> in app/ and components/ for case-mismatch bugs and auto-fix safely
    const validRoutes = discoverValidRoutes(rootDir);
    const lowerRouteMap = new Map();
    for (const r of validRoutes) {
        lowerRouteMap.set(r.toLowerCase(), r);
    }

    function scanAndFixLinks(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanAndFixLinks(full);
            } else if (/\.tsx?$/.test(entry.name)) {
                const original = fs.readFileSync(full, 'utf8');
                let updated = original;
                updated = updated.replace(/(href=["'])(\/[A-Za-z0-9_-]+)([#?"'])/g, (match, prefix, hrefPath, suffix) => {
                    if (validRoutes.has(hrefPath)) return match;
                    const canonical = lowerRouteMap.get(hrefPath.toLowerCase());
                    if (canonical && canonical !== hrefPath) {
                        const rel = path.relative(rootDir, full);
                        fixesApplied.push({
                            issueId: `internal_link_case:${rel}:${hrefPath}`,
                            type: 'internal_link_fixed',
                            file: rel,
                            from: hrefPath,
                            to: canonical,
                            appliedAt: new Date().toISOString(),
                        });
                        return `${prefix}${canonical}${suffix}`;
                    }
                    return match;
                });
                if (updated !== original) {
                    fs.writeFileSync(full, updated, 'utf8');
                }
            }
        }
    }

    scanAndFixLinks(path.join(rootDir, 'app'));
    scanAndFixLinks(path.join(rootDir, 'components'));

    if (redirectsChanged) {
        redirectData.lastUpdated = new Date().toISOString();
        fs.writeFileSync(redirectsPath, JSON.stringify(redirectData, null, 2) + '\n', 'utf8');
    }

    return { fixesApplied, redirectsChanged };
}

function summarizeTotals(pages = [], devices = []) {
    const source = pages.length > 0 ? pages : devices;
    if (source.length === 0) return null;

    const totalSessions = source.reduce((s, p) => s + (p.sessions || 0), 0);
    const totalBotSessions = source.reduce((s, p) => s + (p.botSessions || 0), 0);
    const totalDeadClicks = source.reduce((s, p) => s + (p.deadClicks || 0), 0);
    const totalRageClicks = source.reduce((s, p) => s + (p.rageClicks || 0), 0);
    const totalErrorClicks = source.reduce((s, p) => s + (p.errorClicks || 0), 0);
    const totalScriptErrors = source.reduce((s, p) => s + (p.scriptErrors || 0), 0);
    const totalQuickbacks = source.reduce((s, p) => s + (p.quickbackClicks || 0), 0);
    const totalExcessiveScrolls = source.reduce((s, p) => s + (p.excessiveScrolls || 0), 0);

    return {
        windowDays: 3,
        totalSessions,
        totalBotSessions,
        totalDeadClicks,
        totalRageClicks,
        totalErrorClicks,
        totalScriptErrors,
        totalQuickbacks,
        totalExcessiveScrolls,
        trackedUrls: pages.length,
        trackedDevices: devices.length,
    };
}

export async function fetchClarityQuery(token, params, fetchImpl = fetch) {
    const url = new URL(CLARITY_ENDPOINT);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const res = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new Error(`Clarity API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
        err.status = res.status;
        throw err;
    }

    return res.json();
}

export async function syncClarityPipeline({
    rootDir = DEFAULT_ROOT,
    token = process.env.CLARITY_API_TOKEN || '',
    force = false,
    offline = false,
    fetchImpl = fetch,
} = {}) {
    const insightsPath = path.join(rootDir, 'data', 'clarity_insights.json');
    let existing = {
        endpoint: CLARITY_ENDPOINT,
        lastFetchedAt: null,
        lastStatus: 'pending_first_sync',
        lastError: null,
        quota: { dateUtc: null, requestsUsedToday: 0, dailyLimit: DAILY_API_LIMIT },
        summary: null,
        pages: [],
        devices: [],
        issues: [],
        autoFixesApplied: [],
    };

    if (fs.existsSync(insightsPath)) {
        try {
            existing = { ...existing, ...JSON.parse(fs.readFileSync(insightsPath, 'utf8')) };
        } catch {
            // start fresh if corrupted
        }
    }

    const todayUtc = new Date().toISOString().slice(0, 10);
    const quota = existing.quota?.dateUtc === todayUtc
        ? { ...existing.quota, dailyLimit: DAILY_API_LIMIT }
        : { dateUtc: todayUtc, requestsUsedToday: 0, dailyLimit: DAILY_API_LIMIT };

    let pages = Array.isArray(existing.pages) ? existing.pages : [];
    let devices = Array.isArray(existing.devices) ? existing.devices : [];
    let lastStatus = existing.lastStatus;
    let lastError = null;
    let lastFetchedAt = existing.lastFetchedAt;

    if (offline) {
        lastStatus = 'skipped_offline';
        console.log('ℹ️  [Clarity] Offline mode enabled; analyzing cached insights only.');
    } else if (!token.trim()) {
        lastStatus = 'skipped_no_token';
        console.log('ℹ️  [Clarity] CLARITY_API_TOKEN not set; skipping live export.');
    } else if (!force && quota.requestsUsedToday >= SAFE_DAILY_BUDGET) {
        lastStatus = 'skipped_quota_guard';
        console.log(`ℹ️  [Clarity] Daily budget guard reached (${quota.requestsUsedToday}/${SAFE_DAILY_BUDGET} used today); using cached insights.`);
    } else {
        try {
            console.log(`▶ [Clarity] Querying ${CLARITY_ENDPOINT}?numOfDays=3&dimension1=URL`);
            quota.requestsUsedToday += 1;
            const urlMetrics = await fetchClarityQuery(token.trim(), { numOfDays: 3, dimension1: 'URL' }, fetchImpl);
            pages = normalizeClarityMetrics(urlMetrics, 'URL');

            console.log(`▶ [Clarity] Querying ${CLARITY_ENDPOINT}?numOfDays=3&dimension1=Device`);
            quota.requestsUsedToday += 1;
            const deviceMetrics = await fetchClarityQuery(token.trim(), { numOfDays: 3, dimension1: 'Device' }, fetchImpl);
            devices = normalizeClarityMetrics(deviceMetrics, 'Device');

            lastFetchedAt = new Date().toISOString();
            lastStatus = 'ok';
            console.log(`✅ [Clarity] Exported ${pages.length} URL rows and ${devices.length} Device rows.`);
        } catch (err) {
            lastStatus = err?.status === 429 ? 'rate_limited' : 'api_error';
            lastError = err?.message || String(err);
            console.warn(`⚠️  [Clarity] Live export failed (${lastStatus}): ${lastError}. Retaining previous snapshot.`);
        }
    }

    const issues = analyzeClarityIssues(pages, devices, rootDir);
    const { fixesApplied, redirectsChanged } = remediateClarityIssues(issues, rootDir);
    const summary = summarizeTotals(pages, devices);

    const updated = {
        endpoint: CLARITY_ENDPOINT,
        lastFetchedAt,
        lastStatus,
        lastError,
        quota,
        summary,
        pages: pages.slice(0, 100),
        devices,
        issues,
        autoFixesApplied: fixesApplied,
    };

    const shouldWriteInsights = !offline || !fs.existsSync(insightsPath) || fixesApplied.length > 0;
    if (shouldWriteInsights) {
        fs.writeFileSync(insightsPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    }

    console.log(`📊 [Clarity] Issues detected: ${issues.length} | Auto-fixes applied: ${fixesApplied.length}`);
    for (const issue of issues) {
        const tag = issue.autoFixed ? 'AUTO-FIXED' : issue.severity.toUpperCase();
        console.log(`   • [${tag}] ${issue.summary}`);
    }

    return {
        insights: updated,
        fixesApplied,
        redirectsChanged,
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const force = process.argv.includes('--force');
    const offline = process.argv.includes('--offline');
    syncClarityPipeline({ force, offline }).catch(err => {
        console.error('❌ Clarity sync crashed:', err);
        process.exit(1);
    });
}
