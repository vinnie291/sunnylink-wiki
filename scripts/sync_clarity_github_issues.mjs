#!/usr/bin/env node
/**
 * Syncs unresolved Microsoft Clarity UX issues from data/clarity_insights.json
 * into deduplicated GitHub Issues (labeled `clarity-ux`), and automatically
 * closes resolved issues when Clarity metrics return to healthy.
 *
 * Designed to run inside .github/workflows/autonomous-master.yml using GITHUB_TOKEN.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function buildIssueTitle(issue) {
    const typeLabel = {
        broken_url: '404 / Broken URL',
        script_error: 'Script Error',
        error_click: 'Error Clicks',
        rage_click: 'Rage Clicks',
        dead_click: 'Dead Clicks',
        quickback_click: 'High Quickback Rate',
        mobile_ux_gap: 'Mobile UX Friction Gap',
    }[issue.type] || issue.type;

    return `[Clarity UX] ${typeLabel} on ${issue.route}`;
}

function buildRemediationHints(issue) {
    switch (issue.type) {
        case 'script_error':
            return [
                '- Reproduce on the affected route with browser DevTools Console open.',
                '- Check recent client component changes and null-checks for optional dataset fields.',
                '- Inspect `app/layout.tsx` and the route components listed below for hydration or runtime exceptions.',
            ];
        case 'error_click':
            return [
                '- Inspect click handlers, API fetch calls, and interactive controls on the affected route.',
                '- Check browser Console & Network tabs for failed client actions or unhandled promise rejections.',
            ];
        case 'rage_click':
            return [
                '- Check Microsoft Clarity session recordings & heatmaps for repeated clicks on slow/unresponsive UI elements.',
                '- Verify buttons/cards give immediate visual feedback and do not have overlapping invisible overlays.',
            ];
        case 'dead_click':
            return [
                '- Check Microsoft Clarity click maps for non-interactive elements styled like buttons/links.',
                '- Ensure clickable cards/rows wrap the full interactive area or clarify visual affordances.',
            ];
        case 'broken_url':
            return [
                '- Add a permanent redirect in `data/clarity_redirects.json` or create the missing route.',
                '- Verify external links/backlinks or sitemap entries pointing to this path.',
            ];
        case 'mobile_ux_gap':
            return [
                '- Review mobile layout, touch target sizes (>= 44px), and sticky header/BottomNav overlap.',
                '- Compare Clarity Mobile vs Desktop session recordings.',
            ];
        default:
            return ['- Review Microsoft Clarity dashboard for this route over the past 3 days.'];
    }
}

export function buildIssueBody(issue, fetchedAt) {
    const files = (issue.sourceFiles || []).map(f => `- \`${f}\``).join('\n') || '- _N/A_';
    const hints = buildRemediationHints(issue).join('\n');
    return [
        `<!-- clarity-issue-id:${issue.id} -->`,
        `## Automated Microsoft Clarity UX Alert`,
        '',
        `**Severity:** \`${issue.severity.toUpperCase()}\``,
        `**Route / Target:** \`${issue.route}\``,
        `**Affected URL:** ${issue.url}`,
        `**Clarity Window:** Last 3 days (synced \`${fetchedAt || 'N/A'}\`)`,
        `**Sessions:** ${issue.sessions ?? 0} | **Metric Count:** ${issue.metricValue ?? 0} | **Rate:** ${issue.ratePct ?? 0}%`,
        '',
        `### Summary`,
        issue.summary,
        '',
        `### Likely Source Files`,
        files,
        '',
        `### Recommended Investigation`,
        hints,
        '',
        `_This issue is managed automatically by \`autonomous-master.yml\` and will close automatically once Clarity metrics return to healthy._`,
    ].join('\n');
}

async function ghRequest(repo, token, endpoint, { method = 'GET', body } = {}, fetchImpl = fetch) {
    const url = `https://api.github.com/repos/${repo}${endpoint}`;
    const res = await fetchImpl(url, {
        method,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'sunnylink-wiki-clarity-bot',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`GitHub API ${method} ${endpoint} -> ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.status === 204 ? null : res.json();
}

export async function syncClarityGithubIssues({
    rootDir = DEFAULT_ROOT,
    token = process.env.GITHUB_TOKEN || '',
    repo = process.env.GITHUB_REPOSITORY || '',
    fetchImpl = fetch,
} = {}) {
    const insightsPath = path.join(rootDir, 'data', 'clarity_insights.json');
    if (!fs.existsSync(insightsPath)) {
        console.log('ℹ️  [Clarity Issues] No data/clarity_insights.json found; skipping.');
        return { created: 0, updated: 0, closed: 0 };
    }

    const insights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
    if (!insights.lastFetchedAt) {
        console.log('ℹ️  [Clarity Issues] Clarity has not completed a live fetch yet; skipping GitHub issue sync.');
        return { created: 0, updated: 0, closed: 0 };
    }

    if (!token || !repo) {
        console.log('ℹ️  [Clarity Issues] GITHUB_TOKEN or GITHUB_REPOSITORY not set; skipping GitHub issue sync.');
        return { created: 0, updated: 0, closed: 0 };
    }

    // Ensure `clarity-ux` label exists
    try {
        await ghRequest(repo, token, '/labels', {
            method: 'POST',
            body: {
                name: 'clarity-ux',
                color: '0ea5e9',
                description: 'Automated UX & error alerts detected by Microsoft Clarity export',
            },
        }, fetchImpl);
    } catch {
        // 422 if label already exists — safe to ignore
    }

    const openIssues = await ghRequest(
        repo,
        token,
        '/issues?state=open&labels=clarity-ux&per_page=100',
        { method: 'GET' },
        fetchImpl
    );

    const existingByMarker = new Map();
    for (const ghIssue of openIssues) {
        const m = String(ghIssue.body || '').match(/<!--\s*clarity-issue-id:([^\s>]+)\s*-->/);
        if (m) existingByMarker.set(m[1], ghIssue);
    }

    const unresolved = (insights.issues || []).filter(i => !i.autoFixed);
    const activeIds = new Set(unresolved.map(i => i.id));

    let created = 0;
    let updated = 0;
    let closed = 0;

    for (const issue of unresolved) {
        const existing = existingByMarker.get(issue.id);
        const body = buildIssueBody(issue, insights.lastFetchedAt);
        const title = buildIssueTitle(issue);

        if (!existing) {
            await ghRequest(repo, token, '/issues', {
                method: 'POST',
                body: { title, body, labels: ['clarity-ux'] },
            }, fetchImpl);
            created++;
            console.log(`🆕 [Clarity Issues] Created issue: ${title}`);
        } else if (existing.title !== title || existing.body !== body) {
            await ghRequest(repo, token, `/issues/${existing.number}`, {
                method: 'PATCH',
                body: { title, body },
            }, fetchImpl);
            updated++;
            console.log(`🔄 [Clarity Issues] Updated issue #${existing.number}: ${title}`);
        }
    }

    // Close open clarity-ux issues that are now resolved or auto-fixed
    for (const [markerId, ghIssue] of existingByMarker.entries()) {
        if (!activeIds.has(markerId)) {
            await ghRequest(repo, token, `/issues/${ghIssue.number}/comments`, {
                method: 'POST',
                body: {
                    body: `✅ Resolved in latest Microsoft Clarity 3-day export (\`${insights.lastFetchedAt}\`). Closing automatically.`,
                },
            }, fetchImpl);
            await ghRequest(repo, token, `/issues/${ghIssue.number}`, {
                method: 'PATCH',
                body: { state: 'closed' },
            }, fetchImpl);
            closed++;
            console.log(`✅ [Clarity Issues] Auto-closed resolved issue #${ghIssue.number} (${markerId})`);
        }
    }

    return { created, updated, closed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    syncClarityGithubIssues().catch(err => {
        console.warn('⚠️  [Clarity Issues] GitHub issue sync failed (non-fatal):', err.message);
        process.exit(0);
    });
}
