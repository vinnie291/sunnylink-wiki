#!/usr/bin/env node
/**
 * Locale parity check: every locale must carry exactly the English key set.
 * Missing keys silently fall back to English at runtime, and stray keys are
 * usually a rename that was only half applied.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve('locales');
const read = (file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8'));

const english = read('en.json');
const englishKeys = new Set(Object.keys(english));
let failed = false;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const locale = path.basename(file, '.json');
  const keys = new Set(Object.keys(read(file)));
  const missing = [...englishKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !englishKeys.has(key));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n${locale}: ${missing.length} missing, ${extra.length} unexpected`);
    for (const key of missing) console.error(`  missing: ${key}`);
    for (const key of extra) console.error(`  unexpected: ${key}`);
  } else {
    console.log(`${locale}: ${keys.size} keys, in sync with English`);
  }
}

if (failed) {
  console.error('\nLocale files are out of sync with locales/en.json.');
  process.exit(1);
}
console.log('\nAll locales match English.');
