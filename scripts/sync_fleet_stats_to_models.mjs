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

// Aliases
lookup.set(normalize('dtrv6'), lookup.get(normalize('down to ride v6')));
lookup.set(normalize('wmiv12'), lookup.get(normalize('wmi v12')));
lookup.set(normalize('tcpmv3 (the cool peoples model)'), lookup.get(normalize('the cool peoples model v3')));
lookup.set(normalize('tcpmv3'), lookup.get(normalize('the cool peoples model v3')));
lookup.set(normalize('pop model'), lookup.get(normalize('pop model v2')));

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

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated ${matched} models in ${file}`);
});
