import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);

test('model ratings require recorded evidence and retain real votes without creating extra baseline votes', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sunnylink-vote-evidence-'));
    try {
        mkdirSync(path.join(dir, 'data'));
        writeFileSync(path.join(dir, 'data/model_votes.json'), JSON.stringify({
            one: { voterHash: 'test-voter', modelName: 'Local Only', answers: { overall: 5 } },
        }));
        writeFileSync(path.join(dir, 'data/discourse_polls.json'), JSON.stringify({
            'Forum Model': { polls: [{ name: 'overall', voters: 2, options: [
                { html: '5 - Great', votes: 1 }, { html: '1 - Poor', votes: 1 },
            ] }] },
        }));
        const modulePath = fileURLToPath(new URL('../lib/modelVotes.ts', import.meta.url));
        const script = `const { calculateBlendedModelStats: stats } = require(${JSON.stringify(modulePath)});
            console.log(JSON.stringify({
                empty: stats('No Evidence'),
                local: stats('Local Only'),
                forum: stats('Forum Model'),
                baseline: stats('Explicit Baseline', 75, 10, {great:45,good:35,ok:15,bad:5}),
                partial: stats('Missing Distribution', undefined, 10),
            }));`;
        const output = execFileSync(process.execPath, ['--import', require.resolve('tsx'), '-e', script], {
            cwd: dir, encoding: 'utf8',
        });
        const results = JSON.parse(output);
        assert.equal(results.empty.live.totalVotes, 0);
        assert.equal(results.empty.totalVoters, 0);
        assert.equal(results.empty.questions[0].options.reduce((sum: number, o: {votes: number}) => sum + o.votes, 0), 0);
        assert.deepEqual(results.empty.live.sentiment, { great: 0, good: 0, ok: 0, bad: 0 });
        assert.equal(results.local.live.totalVotes, 1);
        assert.equal(results.local.live.communityScore, 100);
        assert.equal(results.forum.live.totalVotes, 2);
        assert.equal(results.forum.live.communityScore, 50);
        assert.equal(results.baseline.live.totalVotes, 10);
        assert.equal(results.baseline.questions[0].options.reduce((sum: number, o: {votes: number}) => sum + o.votes, 0), 10);
        assert.equal(results.partial.questions[0].voters, 0);
        assert.equal(results.partial.live.totalVotes, 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
