#!/usr/bin/env node
/**
 * Master Autonomous Website Updater Orchestrator
 *
 * Consolidates all upstream data scanners, community sentiment researchers,
 * localization synchronizers, and health checks into a single idempotent pipeline:
 *   1. Upstream sunnypilot/user-docs & sunnylink-frontend settings sync
 *   2. Upstream commaai/openpilot supported vehicles sync
 *   3. GitHub sunnypilot-models discovery + Discourse/Discord research & auto-ingest
 *   4. Discourse live poll voter & score refresh
 *   5. Discord sentiment fallback & 6-locale translation sync
 *   6. Skill ratings calibration audit
 *
 * Usage:
 *   node scripts/autonomous_sync.mjs [--force] [--offline]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FORCE = process.argv.includes('--force');
const OFFLINE = process.argv.includes('--offline');

function runStep(name, cmd, args, { required = false } = {}) {
    const start = Date.now();
    console.log(`\n================================================================`);
    console.log(`▶ [Autonomous Sync] ${name}`);
    console.log(`  Command: ${cmd} ${args.join(' ')}`);
    console.log(`================================================================`);
    try {
        execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`✅ ${name} completed in ${elapsed}s`);
        return { name, status: 'ok', elapsed };
    } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.error(`⚠️  ${name} failed after ${elapsed}s:`, err.message);
        if (required) throw err;
        return { name, status: 'error', elapsed, error: err.message };
    }
}

function getModifiedFiles() {
    try {
        const out = execFileSync('git', ['status', '--porcelain', 'data/', 'locales/'], {
            cwd: ROOT,
            encoding: 'utf8',
        });
        return out
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(l => l.replace(/^[A-Z?]+\s+/, ''));
    } catch {
        return [];
    }
}

async function main() {
    const results = [];

    if (!OFFLINE) {
        // 1. Upstream sunnypilot & sunnylink docs/settings
        results.push(
            runStep(
                '1. Sync Upstream Settings & Docs (user-docs & sunnylink-frontend)',
                'node',
                ['scripts/sync_upstream_docs.mjs', ...(FORCE ? ['--force'] : [])]
            )
        );

        // 2. Supported cars from commaai/openpilot
        results.push(
            runStep(
                '2. Sync Supported Vehicles (commaai/openpilot)',
                'node',
                ['scripts/sync_supported_cars.mjs', ...(FORCE ? ['--force'] : [])]
            )
        );

        // 3. Scan GitHub manifests for new models & research Discourse/Discord
        results.push(
            runStep(
                '3. Scan New Driving Models & Research Discourse/Discord',
                'npx',
                ['tsx', 'scripts/scan_models.ts', '--apply']
            )
        );
    }

    // 4. Refresh Discourse polls (cached-only when --offline is passed)
    results.push(
        runStep(
            '4. Refresh Discourse Polls & Community Scores',
            'node',
            ['scripts/sync_discourse_polls.mjs', ...(OFFLINE ? ['--cached-only'] : [])]
        )
    );

    // 5. Sync Discord sentiment & propagate translations across all 6 locales
    results.push(
        runStep(
            '5a. Analyze Discord Sentiment & Sync Locales',
            'npx',
            ['tsx', 'scripts/analyze_discord_sentiment.ts']
        )
    );
    results.push(
        runStep(
            '5b. Auto-Translate & Synchronize All Locale Catalogs',
            'node',
            ['scripts/i18n/auto-translate-missing.mjs'],
            { required: true }
        )
    );

    // 6. Audit skill ratings calibration
    results.push(
        runStep(
            '6. Audit Model Skill Ratings Calibration',
            'npx',
            ['tsx', 'scripts/audit_skill_ratings.ts'],
            { required: true }
        )
    );

    const modifiedFiles = getModifiedFiles();
    const deployableFiles = modifiedFiles.filter(f => f !== 'data/upstream-docs-state.json');
    const changed = modifiedFiles.length > 0;
    const deployNeeded = deployableFiles.length > 0 || FORCE;

    console.log(`\n================================================================`);
    console.log(`📊 Autonomous Sync Summary`);
    console.log(`================================================================`);
    for (const r of results) {
        console.log(`  • ${r.status === 'ok' ? '✅' : '⚠️'} ${r.name} (${r.elapsed}s)`);
    }
    console.log(`  • Modified files (${modifiedFiles.length}): ${modifiedFiles.join(', ') || 'none'}`);
    console.log(`  • Deploy needed: ${deployNeeded}`);

    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(
            process.env.GITHUB_OUTPUT,
            `changed=${changed ? 'true' : 'false'}\ndeploy_needed=${deployNeeded ? 'true' : 'false'}\n`
        );
    }

    if (process.env.GITHUB_STEP_SUMMARY) {
        const summaryLines = [
            '## 🤖 Autonomous Website Sync Summary',
            '',
            '| Step | Status | Duration |',
            '| :--- | :---: | :---: |',
            ...results.map(r => `| ${r.name} | ${r.status === 'ok' ? '✅ OK' : '⚠️ Warning'} | ${r.elapsed}s |`),
            '',
            `**Modified Files (${modifiedFiles.length}):** ${modifiedFiles.length ? modifiedFiles.map(f => `\`${f}\``).join(', ') : '_None_'}`,
            `**Deploy Triggered:** \`${deployNeeded}\``,
            '',
        ];
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join('\n'));
    }
}

main().catch(err => {
    console.error('❌ Autonomous sync failed:', err);
    process.exit(1);
});
