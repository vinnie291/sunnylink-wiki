// Refresh with: node scripts/sync_supported_cars.mjs [downloaded CARS.md]
// Source: commaai/openpilot (MIT). Preserve package requirements and source links.
import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = 'https://github.com/commaai/openpilot/blob/master/docs/CARS.md';
const input = process.argv[2];
const markdown = input ? await readFile(input, 'utf8') : await fetch(
    'https://raw.githubusercontent.com/commaai/openpilot/master/docs/CARS.md'
).then(response => {
    if (!response.ok) throw new Error(`Vehicle download failed: ${response.status}`);
    return response.text();
});
const clean = value => value.replace(/\[<sup>.*?<\/sup>\]\(#footnotes\)/g, '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
const vehicles = [];
for (const line of markdown.split('\n')) {
    if (!line.startsWith('|') || line.split('|').length < 11) continue;
    const [make, name, requiredPackage] = line.split('|').slice(1, 4).map(clean);
    if (make === 'Make' || make.startsWith('---')) continue;
    if (make === 'comma' && name === 'body') continue; // Robot platform has no model year.
    const match = name.match(/^(.*?) ((?:19|20)\d{2})(?:-(\d{2,4}))?$/);
    if (!match) throw new Error(`Unrecognized vehicle years: ${make} ${name}`);
    const [, model, start, end] = match;
    const startYear = Number(start);
    const endYear = end ? Number(end.length === 2 ? start.slice(0, 2) + end : end) : startYear;
    if (endYear < startYear || endYear - startYear > 30) throw new Error(`Invalid year range: ${name}`);
    vehicles.push({ id: `${make}|${name}|${requiredPackage}`, make, model, startYear, endYear, requiredPackage });
}
const expected = Number(markdown.match(/# (\d+) Supported Cars/)?.[1]);
if (vehicles.length !== expected - 1) throw new Error(`Incomplete vehicle import: ${vehicles.length}/${expected}`);
if (new Set(vehicles.map(car => car.id)).size !== vehicles.length) throw new Error('Duplicate vehicle entries');
await writeFile(new URL('../data/supported-cars.json', import.meta.url), JSON.stringify({
    sourceUrl, updatedAt: new Date().toISOString().slice(0, 10),
    marketNote: 'US-market vehicles unless otherwise specified. Equipment requirements and source footnotes apply.',
    vehicles,
}, null, 2) + '\n');
console.log(`Imported ${vehicles.length} supported vehicles.`);
