import fs from 'fs';
import path from 'path';

const fleetStatsPath = path.resolve('data/fleet_model_stats.json');
const stats = JSON.parse(fs.readFileSync(fleetStatsPath, 'utf8'));

// Build lookup
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s*\([A-Za-z]+ \d{1,2},? \d{4}\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const lookup = new Map();
stats.models.forEach(m => {
  lookup.set(normalize(m.cleanName), m);
  lookup.set(normalize(m.displayName), m);
  lookup.set(normalize(m.slug), m);
});

// Aliases (never overwrite an exact fleet entry key)
const aliases = {
  'dtrv6': 'down to ride v6',
  'dtr v6': 'down to ride v6',
  'wmiv12': 'wmi v12',
  'pop v2': 'pop model v2',
  'pop model (v1)': 'pop model',
  'pop model v1': 'pop model',
  'cd210': 'cd210 model',
  'dark souls v2': 'dark souls model v2',
  'opm10v3': 'op model 10 v3',
  'op model 10': 'op model 10 v3',
  'tcpmv3': 'the cool peoples model v3',
  'tcpmv3 (the cool peoples model)': 'the cool peoples model v3',
  'tcp v3': 'the cool peoples model v3',
  'gwm v9 (gwm9)': 'gwm v9',
  'neurips driving model': 'neurips driving model v1',
  'tee time model': 'tee time',
  'los angeles v2 (la2)': 'lav2',
  'gwm7': 'gwm v7',
  'off-policy model v5 (angle)': 'off-policy model v5',
  'off policy v3': 'op model 10 v3',
};

const directKeys = new Set(lookup.keys());
for (const [alias, target] of Object.entries(aliases)) {
  const aliasKey = normalize(alias);
  if (directKeys.has(aliasKey)) continue;
  const targetStat = lookup.get(normalize(target));
  if (targetStat) lookup.set(aliasKey, targetStat);
}

const modelFiles = [
  'data/models.json',
  'data/models.ko.json',
  'data/models.zh.json',
  'data/models.de.json',
  'data/models.fr.json',
  'data/models.es.json'
];

modelFiles.forEach(file => {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) return;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let matched = 0;

  if (Array.isArray(data.categories)) {
    data.categories.forEach(cat => {
      if (Array.isArray(cat.models)) {
        cat.models.forEach(m => {
          const stat = lookup.get(normalize(m.name));
          if (stat) {
            m.routesDriven = stat.routes;
            m.fleetRank = stat.rank;
            matched++;
          }
        });
      }
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${matched} models in ${file}`);
});
