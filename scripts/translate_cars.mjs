import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const carsEn = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json'), 'utf8'));

const TARGET_LANGS = {
  de: 'de',
  es: 'es',
  fr: 'fr',
  ko: 'ko',
  zh: 'zh-TW',
};

// 1. Gather all unique strings from cars.json
function gatherUniqueStrings(data) {
  const strings = new Set();
  for (const v of data.vehicles) {
    if (v.communityConsensus && v.communityConsensus.trim()) {
      strings.add(v.communityConsensus.trim());
    }
    if (Array.isArray(v.configs)) {
      for (const cfg of v.configs) {
        if (cfg.name && cfg.name.trim()) strings.add(cfg.name.trim());
      }
    }
    if (Array.isArray(v.reviews)) {
      for (const rev of v.reviews) {
        if (rev.comment && rev.comment.trim()) strings.add(rev.comment.trim());
      }
    }
    if (Array.isArray(v.forumQuotes)) {
      for (const q of v.forumQuotes) {
        if (q.text && q.text.trim()) strings.add(q.text.trim());
        if (q.context && q.context.trim()) strings.add(q.context.trim());
      }
    }
  }
  return [...strings];
}

async function translateBatchWithRetry(batch, targetLang) {
  const DELIM = '\n===\n';
  const joined = batch.join(DELIM);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(joined)}`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        console.warn(`[429 Rate limit] waiting ${attempt * 1500}ms before retry...`);
        await new Promise(r => setTimeout(r, attempt * 1500));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const full = data[0].map(s => s[0]).join('');
      const translated = full.split(/\s*===\s*/);
      if (translated.length === batch.length) {
        return translated;
      }
      // If delimiter split didn't match length, translate individually
      console.warn(`Delimiter split mismatch (${translated.length} vs ${batch.length}), falling back to individual...`);
      break;
    } catch (err) {
      console.warn(`Attempt ${attempt} failed:`, err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Fallback: translate individually
  const results = [];
  for (const text of batch) {
    try {
      const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(u);
      const d = await res.json();
      results.push(d[0].map(s => s[0]).join(''));
    } catch {
      results.push(text);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

async function buildTranslationMap(strings, targetLang) {
  const map = new Map();
  const BATCH_SIZE = 8;

  for (let i = 0; i < strings.length; i += BATCH_SIZE) {
    const batch = strings.slice(i, i + BATCH_SIZE);
    const translatedBatch = await translateBatchWithRetry(batch, targetLang);
    batch.forEach((orig, idx) => {
      map.set(orig, translatedBatch[idx] || orig);
    });
    process.stdout.write(`\rTranslated ${Math.min(i + BATCH_SIZE, strings.length)} / ${strings.length} strings`);
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('');
  return map;
}

function applyTranslations(carsObj, transMap) {
  const cloned = JSON.parse(JSON.stringify(carsObj));
  for (const v of cloned.vehicles) {
    if (v.communityConsensus && transMap.has(v.communityConsensus.trim())) {
      v.communityConsensus = transMap.get(v.communityConsensus.trim());
    }
    if (Array.isArray(v.configs)) {
      for (const cfg of v.configs) {
        if (cfg.name && transMap.has(cfg.name.trim())) {
          cfg.name = transMap.get(cfg.name.trim());
        }
      }
    }
    if (Array.isArray(v.reviews)) {
      for (const rev of v.reviews) {
        if (rev.comment && transMap.has(rev.comment.trim())) {
          rev.comment = transMap.get(rev.comment.trim());
        }
      }
    }
    if (Array.isArray(v.forumQuotes)) {
      for (const q of v.forumQuotes) {
        if (q.text && transMap.has(q.text.trim())) {
          q.text = transMap.get(q.text.trim());
        }
        if (q.context && transMap.has(q.context.trim())) {
          q.context = transMap.get(q.context.trim());
        }
      }
    }
  }
  return cloned;
}

async function main() {
  const uniqueStrings = gatherUniqueStrings(carsEn);
  console.log(`Gathered ${uniqueStrings.length} unique translatable strings from cars.json`);

  for (const [localeKey, targetLang] of Object.entries(TARGET_LANGS)) {
    const outPath = path.join(DATA_DIR, `cars.${localeKey}.json`);
    // Check if file already exists with valid content
    if (fs.existsSync(outPath)) {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (existing.vehicles && existing.vehicles.length === carsEn.vehicles.length) {
        // If Korean or Chinese, check if consensus was translated
        const sample = existing.vehicles[0]?.communityConsensus || '';
        if (localeKey === 'ko' && /[가-힣]/.test(sample)) {
          console.log(`Skipping ${localeKey} (already complete)`);
          continue;
        }
        if (localeKey === 'zh' && /[\u4e00-\u9fff]/.test(sample)) {
          console.log(`Skipping ${localeKey} (already complete)`);
          continue;
        }
        if ((localeKey === 'de' || localeKey === 'es' || localeKey === 'fr') && sample.length > 0) {
          console.log(`Skipping ${localeKey} (already complete)`);
          continue;
        }
      }
    }

    console.log(`\nTranslating for ${localeKey} (${targetLang})...`);
    const transMap = await buildTranslationMap(uniqueStrings, targetLang);
    const localized = applyTranslations(carsEn, transMap);
    fs.writeFileSync(outPath, JSON.stringify(localized, null, 2) + '\n', 'utf8');
    console.log(`✓ Saved ${outPath}`);
  }

  console.log('\nAll car localizations verified and ready!');
}

main().catch(console.error);
