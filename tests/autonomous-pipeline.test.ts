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
