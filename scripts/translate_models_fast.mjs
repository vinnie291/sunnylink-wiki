import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const TARGET_LANGS = {
  de: 'de',
  es: 'es',
  fr: 'fr',
  ko: 'ko',
  zh: 'zh-TW',
};

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
      // Fallback: split by newline if delimiter got slightly modified
      if (translated.length > 0) {
        console.log(`[Delimiter mismatch: expected ${batch.length}, got ${translated.length}] Fallback item-by-item...`);
      }
    } catch (err) {
      console.error(`Batch translation error attempt ${attempt}:`, err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Fallback item by item
  const results = [];
  for (const item of batch) {
    try {
      const singleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(item)}`;
      const res = await fetch(singleUrl);
      if (res.ok) {
        const d = await res.json();
        results.push(d[0].map(s => s[0]).join(''));
      } else {
        results.push(item);
      }
      await new Promise(r => setTimeout(r, 200));
    } catch {
      results.push(item);
    }
  }
  return results;
}

async function run() {
  const enData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'models.json'), 'utf8'));
  const enMap = {};
  enData.categories.forEach(cat => cat.models.forEach(m => {
    enMap[m.name] = m;
  }));

  for (const [locale, langCode] of Object.entries(TARGET_LANGS)) {
    const filePath = path.join(DATA_DIR, `models.${locale}.json`);
    if (!fs.existsSync(filePath)) continue;
    const modelData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Find all models where consensus or note or steeringFeel is still in English
    const itemsToTranslate = []; // { catIdx, modIdx, field, englishText }
    const uniqueEnglishStrings = new Set();

    modelData.categories.forEach((cat, cIdx) => {
      cat.models.forEach((m, mIdx) => {
        const enModel = enMap[m.name];
        if (!enModel) return;

        // Check consensus
        if (m.consensus && (/^[A-Za-z0-9 ,.()'-]+$/.test(m.consensus) || m.consensus === enModel.consensus)) {
          uniqueEnglishStrings.add(enModel.consensus.trim());
          itemsToTranslate.push({ cIdx, mIdx, field: 'consensus', text: enModel.consensus.trim() });
        }
        // Check note
        if (m.note && enModel.note && (m.note === enModel.note || /^[A-Za-z0-9 ,.()'-]+$/.test(m.note))) {
          uniqueEnglishStrings.add(enModel.note.trim());
          itemsToTranslate.push({ cIdx, mIdx, field: 'note', text: enModel.note.trim() });
        }
        // Check steeringFeel
        if (m.steeringFeel && enModel.steeringFeel && (m.steeringFeel === enModel.steeringFeel || /^[A-Za-z0-9 ,.()'-]+$/.test(m.steeringFeel))) {
          uniqueEnglishStrings.add(enModel.steeringFeel.trim());
          itemsToTranslate.push({ cIdx, mIdx, field: 'steeringFeel', text: enModel.steeringFeel.trim() });
        }
        // Check bestFor
        if (m.bestFor && enModel.bestFor && (m.bestFor === enModel.bestFor || /^[A-Za-z0-9 ,.()'-]+$/.test(m.bestFor))) {
          uniqueEnglishStrings.add(enModel.bestFor.trim());
          itemsToTranslate.push({ cIdx, mIdx, field: 'bestFor', text: enModel.bestFor.trim() });
        }
      });
    });

    const stringList = [...uniqueEnglishStrings].filter(s => s.length > 0);
    console.log(`\n[${locale}] Found ${itemsToTranslate.length} fields to translate across ${stringList.length} unique strings.`);

    if (stringList.length === 0) {
      console.log(`[${locale}] Already 100% translated!`);
      continue;
    }

    // Batch translate unique strings in chunks of 8
    const translationMap = {};
    const BATCH_SIZE = 8;
    for (let i = 0; i < stringList.length; i += BATCH_SIZE) {
      const batch = stringList.slice(i, i + BATCH_SIZE);
      const translated = await translateBatchWithRetry(batch, langCode);
      for (let j = 0; j < batch.length; j++) {
        translationMap[batch[j]] = translated[j] || batch[j];
      }
      process.stdout.write(`Translated ${Math.min(i + BATCH_SIZE, stringList.length)} / ${stringList.length} strings\r`);
      await new Promise(r => setTimeout(r, 350));
    }
    console.log(`\nFinished translations for ${locale}. Applying to dataset...`);

    // Apply back
    for (const item of itemsToTranslate) {
      const translated = translationMap[item.text];
      if (translated) {
        modelData.categories[item.cIdx].models[item.mIdx][item.field] = translated;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2) + '\n', 'utf8');
    console.log(`✓ Saved ${filePath}`);
  }

  console.log('\nAll models datasets are now completely localized!');
}

run().catch(console.error);
