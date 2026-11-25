import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('consolidated autonomous master workflow replaces fragmented workflows and gates deploy on changes', () => {
    const workflowDir = path.join(ROOT, '.github', 'workflows');
    const masterWorkflowPath = path.join(workflowDir, 'autonomous-master.yml');
    assert.ok(fs.existsSync(masterWorkflowPath), 'autonomous-master.yml must exist');

    // Legacy fragmented workflows should be removed
    for (const legacy of ['sync-upstream-docs.yml', 'weekly-models-sync.yml', 'sync-sunnytune.yml']) {
        assert.equal(fs.existsSync(path.join(workflowDir, legacy)), false, `${legacy} should be consolidated into autonomous-master.yml`);
    }

    const content = fs.readFileSync(masterWorkflowPath, 'utf8');
    assert.match(content, /cron:\s*'0 \*\/6 \* \* \*'/, 'should run on 6-hour schedule');
    assert.match(content, /workflow_dispatch:/, 'should support manual trigger');
    assert.match(content, /node scripts\/autonomous_sync\.mjs/, 'should invoke autonomous_sync.mjs orchestrator');
    assert.match(content, /node scripts\/check-i18n\.mjs --data-only/, 'should verify dataset localization parity');
    assert.match(content, /steps\.sync\.outputs\.deploy_needed == 'true'/, 'should gate Cloud Run deploy on deploy_needed');
});

test('data-only i18n check passes across all 6 locales and 4 datasets', () => {
    const out = execFileSync(process.execPath, ['scripts/check-i18n.mjs', '--data-only'], {
        cwd: ROOT,
        encoding: 'utf8',
    });
    assert.match(out, /UI placeholders, translation calls, data structures, and canonical values match in every locale/);
});

test('autonomous_sync.mjs --offline runs end-to-end and writes GITHUB_OUTPUT and GITHUB_STEP_SUMMARY', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonomy-test-'));
    const outputFile = path.join(tmpDir, 'github_output.txt');
    const summaryFile = path.join(tmpDir, 'step_summary.md');

    try {
        execFileSync(process.execPath, ['scripts/autonomous_sync.mjs', '--offline'], {
            cwd: ROOT,
            env: {
                ...process.env,
                GITHUB_OUTPUT: outputFile,
                GITHUB_STEP_SUMMARY: summaryFile,
            },
            stdio: 'pipe',
        });

        const ghOutput = fs.readFileSync(outputFile, 'utf8');
        assert.match(ghOutput, /^changed=(true|false)$/m);
        assert.match(ghOutput, /^deploy_needed=(true|false)$/m);

        const summary = fs.readFileSync(summaryFile, 'utf8');
        assert.match(summary, /Autonomous Website Sync Summary/);
        assert.match(summary, /Refresh Discourse Polls & Community Scores/);
        assert.match(summary, /Auto-Translate & Synchronize All Locale Catalogs/);
        assert.match(summary, /Audit Model Skill Ratings Calibration/);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('model scanner does not conflate distinct models sharing the same shortName and auto-ingests curated Deep RL drops', async () => {
    const { matchesLocalModel, isCuratedQualcommDrop } = await import('../scripts/scan_models');

    // "Shredded cheddar" (SC) and "Sharp Cheddar" (SC) have different names and refs -> must NOT match
    assert.equal(
        matchesLocalModel(
            'Shredded cheddar',
            'Sharp Cheddar',
            '2a63be39e4a243a53f6bacf3b0bee27a4eb7b973',
            'da491579b8ea8be37c8f14e79beb1d87ead5dbb6',
            'SC',
            'SC'
        ),
        false,
        'distinct models with colliding short_name must not be treated as duplicates'
    );

    // Same modelRef always matches even if display_name changed
    assert.equal(
        matchesLocalModel(
            'Cheddar Model',
            'CH Driving',
            '875a6b7e1e59a76e1c5d9972371564a4feb1deb9',
            '875a6b7e1e59a76e1c5d9972371564a4feb1deb9',
            'CHEDDAR',
            'CHD'
        ),
        true,
        'identical modelRef should match across renames'
    );

    // Curated Qualcomm folders (like 2026 Deep RL Models) should auto-ingest immediately on push
    assert.equal(
        isCuratedQualcommDrop({ folder: '2026 Deep RL Models' } as never),
        true,
        '2026 Deep RL Models folder should auto-ingest on manifest push'
    );
    assert.equal(
        isCuratedQualcommDrop({ folder: 'custom' } as never),
        false,
        'custom folder should not auto-ingest without community thread'
    );
});

