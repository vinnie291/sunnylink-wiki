import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Values are ordered Korean, Traditional Chinese, French, German, Spanish.
const locales = ['ko', 'zh', 'fr', 'de', 'es'];
const reviewed = JSON.parse(readFileSync(new URL('./reviewed-translations.json', import.meta.url)));
const english = JSON.parse(readFileSync('locales/en.json'));
for (const source of Object.keys(reviewed)) {
    if (!Object.values(english).includes(source)) {
        const key = `content.${createHash('sha256').update(source).digest('hex').slice(0, 12)}`;
        english[key] = source;
    }
}
// Repair a damaged emoji without changing its stable key.
english['wizard.recipe.category.model'] = '🧠 Model';
writeFileSync('locales/en.json', JSON.stringify(english, null, 2) + '\n');

for (const [index, locale] of locales.entries()) {
    const messages = JSON.parse(readFileSync(`locales/${locale}.json`));
    for (const [key, source] of Object.entries(english)) {
        if (reviewed[source]) messages[key] = reviewed[source][index];
    }
    messages['wizard.recipe.category.model'] = ['🧠 모델', '🧠 模型', '🧠 Modèle', '🧠 Modell', '🧠 Modelo'][index];
    writeFileSync(`locales/${locale}.json`, JSON.stringify(messages, null, 2) + '\n');
}
console.log('Applied reviewed terminology to all five translations.');
