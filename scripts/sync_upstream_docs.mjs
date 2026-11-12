#!/usr/bin/env node
/**
 * Syncs wiki settings/feature metadata with upstream sunnypilot/user-docs
 * and sunnypilot/sunnylink-frontend repositories when new commits are pushed.
 *
 * Usage:
 *   node scripts/sync_upstream_docs.mjs [--force]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE_FILE = path.join(ROOT, 'data', 'upstream-docs-state.json');
const LOCALES = ['en', 'de', 'es', 'fr', 'ko', 'zh'];
const FORCE = process.argv.includes('--force');

const REPOS = [
  { name: 'sunnypilot/user-docs', branch: 'master' },
  { name: 'sunnypilot/sunnylink-frontend', branch: 'main' },
];

async function getLatestSha(repo, branch) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'sunnylink-wiki-upstream-sync',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const url = `https://api.github.com/repos/${repo}/commits/${branch}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${url} returned ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.sha;
}

function walkMarkdown(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(walkMarkdown(full));
    else if (entry.name.endsWith('.md')) results.push(full);
  }
  return results.sort();
}

function parsePlatformDifferences(userDocsDir) {
  const file = path.join(userDocsDir, 'docs', 'settings', 'platform-differences.md');
  if (!fs.existsSync(file)) return { comma3xOnlyTitles: new Set() };
  const content = fs.readFileSync(file, 'utf8');
  const sectionMatch = content.match(/## Onroad Visual Features Not Available on comma four([\s\S]*?)(\n## |$)/);
  const comma3xOnlyTitles = new Set();
  if (sectionMatch) {
    for (const line of sectionMatch[1].split('\n')) {
      const m = line.match(/^-\s+(.+?)(?:\s+\(|$)/);
      if (m) comma3xOnlyTitles.add(m[1].trim().toLowerCase());
    }
  }
  return { comma3xOnlyTitles };
}

function parseUserDocsSettings(userDocsDir) {
  const settingsDir = path.join(userDocsDir, 'docs', 'settings');
  const files = walkMarkdown(settingsDir);
  const { comma3xOnlyTitles } = parsePlatformDifferences(userDocsDir);

  const availabilityByTitle = new Map();
  const documentedHeadings = [];

  for (const file of files) {
    const rel = path.relative(settingsDir, file);
    if (rel === 'index.md' || rel === 'platform-differences.md' || rel.startsWith('vehicle/')) {
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    // Extract page-level availability callout
    const pageAvailMatch = content.match(/!!! info "Toggle & Device Availability"\s*\n\s*(.+)/);
    let pageAvail = 'config-hidden';
    if (pageAvailMatch) {
      const line = pageAvailMatch[1].toLowerCase();
      if (line.includes('available and configurable on all devices')) pageAvail = 'full';
      else if (line.includes('comma 3x/3 only') && line.includes('cannot be activated on comma four')) pageAvail = 'comma-3x-only';
    }

    // Parse ## sections
    const sections = content.split(/\n---\s*\n|\n(?=## )/);
    for (const sec of sections) {
      const headingMatch = sec.match(/^##\s+(.+)/m);
      if (!headingMatch) continue;
      const heading = headingMatch[1].trim();
      if (['Related Features', 'Related', 'Sub-Panels', 'Platform Differences', 'How It Works', 'Status Display', 'Requirements', 'Optional: Mobile Upload'].includes(heading)) {
        continue;
      }
      documentedHeadings.push({ rel, heading });

      const secAvailMatch = sec.match(/!!! info "Toggle & Device Availability"\s*\n\s*(.+)/);
      let avail = pageAvail;
      if (secAvailMatch) {
        const line = secAvailMatch[1].toLowerCase();
        if (line.includes('available and configurable on all devices')) avail = 'full';
        else if (line.includes('comma four users must use sunnylink')) avail = 'config-hidden';
        else if (line.includes('comma 3x/3 only')) avail = 'comma-3x-only';
      } else if (comma3xOnlyTitles.has(heading.toLowerCase())) {
        avail = 'comma-3x-only';
      }
      availabilityByTitle.set(heading.toLowerCase(), avail);
    }
  }

  return { availabilityByTitle, documentedHeadings };
}

function parseSunnylinkKeys(frontendDir) {
  const settingsTs = path.join(frontendDir, 'src', 'lib', 'types', 'settings.ts');
  if (!fs.existsSync(settingsTs)) return [];
  const content = fs.readFileSync(settingsTs, 'utf8');
  return [...content.matchAll(/key:\s*'([^']+)'/g)]
    .map(m => m[1])
    .filter(k => !k.startsWith('_sec_'));
}

async function main() {
  const state = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    : { lastSyncedAt: null, repos: {} };

  const latestShas = {};
  let hasUpdates = false;

  for (const { name, branch } of REPOS) {
    const sha = await getLatestSha(name, branch);
    latestShas[name] = { branch, sha };
    const prevSha = state.repos?.[name]?.sha;
    if (sha !== prevSha) {
      console.log(`[upstream-sync] Update detected in ${name} (${branch}): ${prevSha || 'none'} -> ${sha}`);
      hasUpdates = true;
    } else {
      console.log(`[upstream-sync] ${name} (${branch}) is up-to-date at ${sha.slice(0, 7)}`);
    }
  }

  if (!hasUpdates && !FORCE) {
    console.log('[upstream-sync] No upstream updates detected. Exiting.');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-upstream-'));
  try {
    const userDocsDir = path.join(tmpDir, 'user-docs');
    const frontendDir = path.join(tmpDir, 'sunnylink-frontend');

    execFileSync('git', ['clone', '--depth', '1', '--branch', 'master', 'https://github.com/sunnypilot/user-docs.git', userDocsDir], { stdio: 'inherit' });
    execFileSync('git', ['clone', '--depth', '1', '--branch', 'main', 'https://github.com/sunnypilot/sunnylink-frontend.git', frontendDir], { stdio: 'inherit' });

    const { availabilityByTitle, documentedHeadings } = parseUserDocsSettings(userDocsDir);
    const sunnylinkKeys = parseSunnylinkKeys(frontendDir);

    const today = new Date().toISOString().slice(0, 10);
    const enTogglesPath = path.join(ROOT, 'data', 'toggles.json');
    const enToggles = JSON.parse(fs.readFileSync(enTogglesPath, 'utf8'));

    // Build key -> availability updates from English labels
    const availabilityUpdates = new Map();
    const knownKeys = new Set();
    const knownLabels = new Set();

    for (const cat of enToggles.categories) {
      for (const s of cat.settings) {
        knownKeys.add(s.key);
        knownLabels.add(s.label.toLowerCase());
        const matchedAvail = availabilityByTitle.get(s.label.toLowerCase());
        if (matchedAvail && s.deviceAvailability && s.deviceAvailability !== matchedAvail) {
          availabilityUpdates.set(s.key, matchedAvail);
        }
      }
    }

    // Apply availability & lastUpdated across all locales
    let changedCount = 0;
    for (const loc of LOCALES) {
      const file = path.join(ROOT, 'data', loc === 'en' ? 'toggles.json' : `toggles.${loc}.json`);
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      let fileChanged = false;

      for (const cat of data.categories) {
        for (const s of cat.settings) {
          const nextAvail = availabilityUpdates.get(s.key);
          if (nextAvail && s.deviceAvailability !== nextAvail) {
            s.deviceAvailability = nextAvail;
            fileChanged = true;
            if (loc === 'en') changedCount++;
          }
        }
      }

      if (fileChanged || FORCE) {
        data.lastUpdated = today;
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
      }
    }

    const unmappedHeadings = documentedHeadings
      .filter(h => !knownLabels.has(h.heading.toLowerCase()))
      .map(h => `${h.rel}: ${h.heading}`);

    const nextState = {
      lastSyncedAt: new Date().toISOString(),
      repos: latestShas,
      availabilityUpdatesApplied: changedCount,
      unmappedUpstreamHeadings: unmappedHeadings,
      sunnylinkKeysCount: sunnylinkKeys.length,
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2) + '\n');
    console.log(`[upstream-sync] Sync complete. Availability updates: ${changedCount}, unmapped headings: ${unmappedHeadings.length}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[upstream-sync] Error:', err);
  process.exit(1);
});
