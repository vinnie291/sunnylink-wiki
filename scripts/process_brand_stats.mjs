import fs from 'fs';
import path from 'path';

const rawBrandData = [
  {"Brand":"toyota","Branch":"staging","Distinct values of Sunnylink Dongle ID":"677"},
  {"Brand":"toyota","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"623"},
  {"Brand":"hyundai","Branch":"staging","Distinct values of Sunnylink Dongle ID":"552"},
  {"Brand":"hyundai","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"497"},
  {"Brand":"hyundai","Branch":"dev","Distinct values of Sunnylink Dongle ID":"391"},
  {"Brand":"toyota","Branch":"dev","Distinct values of Sunnylink Dongle ID":"324"},
  {"Brand":"honda","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"276"},
  {"Brand":"honda","Branch":"staging","Distinct values of Sunnylink Dongle ID":"228"},
  {"Brand":"chrysler","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"158"},
  {"Brand":"rivian","Branch":"staging","Distinct values of Sunnylink Dongle ID":"155"},
  {"Brand":"honda","Branch":"dev","Distinct values of Sunnylink Dongle ID":"141"},
  {"Brand":"rivian","Branch":"dev","Distinct values of Sunnylink Dongle ID":"126"},
  {"Brand":"subaru","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"95"},
  {"Brand":"chrysler","Branch":"staging","Distinct values of Sunnylink Dongle ID":"91"},
  {"Brand":"chrysler","Branch":"dev","Distinct values of Sunnylink Dongle ID":"90"},
  {"Brand":"volkswagen","Branch":"staging","Distinct values of Sunnylink Dongle ID":"89"},
  {"Brand":"subaru","Branch":"staging","Distinct values of Sunnylink Dongle ID":"83"},
  {"Brand":"rivian","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"72"},
  {"Brand":"gm","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"68"},
  {"Brand":"volkswagen","Branch":"master","Distinct values of Sunnylink Dongle ID":"68"},
  {"Brand":"volkswagen","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"68"},
  {"Brand":"mazda","Branch":"staging","Distinct values of Sunnylink Dongle ID":"59"},
  {"Brand":"gm","Branch":"staging","Distinct values of Sunnylink Dongle ID":"57"},
  {"Brand":"subaru","Branch":"dev","Distinct values of Sunnylink Dongle ID":"55"},
  {"Brand":"tesla","Branch":"dev","Distinct values of Sunnylink Dongle ID":"53"},
  {"Brand":"tesla","Branch":"staging","Distinct values of Sunnylink Dongle ID":"51"},
  {"Brand":"volkswagen","Branch":"dev","Distinct values of Sunnylink Dongle ID":"49"},
  {"Brand":"tesla","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"45"},
  {"Brand":"ford","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"44"},
  {"Brand":"mazda","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"42"},
  {"Brand":"gm","Branch":"dev","Distinct values of Sunnylink Dongle ID":"35"},
  {"Brand":"ford","Branch":"staging","Distinct values of Sunnylink Dongle ID":"30"},
  {"Brand":"hyundai","Branch":"master","Distinct values of Sunnylink Dongle ID":"28"},
  {"Brand":"ford","Branch":"dev","Distinct values of Sunnylink Dongle ID":"26"},
  {"Brand":"nissan","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"24"},
  {"Brand":"toyota","Branch":"master","Distinct values of Sunnylink Dongle ID":"20"},
  {"Brand":"nissan","Branch":"staging","Distinct values of Sunnylink Dongle ID":"18"},
  {"Brand":"mazda","Branch":"dev","Distinct values of Sunnylink Dongle ID":"16"},
  {"Brand":"tesla","Branch":"master","Distinct values of Sunnylink Dongle ID":"16"},
  {"Brand":"honda","Branch":"master","Distinct values of Sunnylink Dongle ID":"8"},
  {"Brand":"nissan","Branch":"dev","Distinct values of Sunnylink Dongle ID":"6"},
  {"Brand":"subaru","Branch":"master","Distinct values of Sunnylink Dongle ID":"5"},
  {"Brand":"toyota","Branch":"master-dev","Distinct values of Sunnylink Dongle ID":"4"},
  {"Brand":"chrysler","Branch":"master","Distinct values of Sunnylink Dongle ID":"2"},
  {"Brand":"ford","Branch":"master","Distinct values of Sunnylink Dongle ID":"2"},
  {"Brand":"geely","Branch":"dev","Distinct values of Sunnylink Dongle ID":"2"},
  {"Brand":"mazda","Branch":"master","Distinct values of Sunnylink Dongle ID":"2"},
  {"Brand":"rivian","Branch":"master","Distinct values of Sunnylink Dongle ID":"2"},
  {"Brand":"gac","Branch":"dev","Distinct values of Sunnylink Dongle ID":"1"},
  {"Brand":"tesla","Branch":"master-dev","Distinct values of Sunnylink Dongle ID":"1"},
  {"Brand":"vinfast","Branch":"release-tizi","Distinct values of Sunnylink Dongle ID":"1"}
];

const brandGroupMap = {
  // Brand family mapping
  'toyota': ['toyota', 'lexus'],
  'hyundai': ['hyundai', 'kia', 'genesis'],
  'honda': ['honda', 'acura'],
  'chrysler': ['chrysler', 'jeep', 'ram', 'dodge'],
  'gm': ['gm', 'chevrolet', 'chevy', 'cadillac', 'gmc', 'buick'],
  'volkswagen': ['volkswagen', 'vw', 'audi', 'skoda', 'škoda', 'seat'],
  'ford': ['ford', 'lincoln'],
  'rivian': ['rivian'],
  'subaru': ['subaru'],
  'tesla': ['tesla'],
  'mazda': ['mazda'],
  'nissan': ['nissan', 'infiniti'],
  'geely': ['geely', 'volvo', 'polestar'],
  'gac': ['gac'],
  'vinfast': ['vinfast']
};

let grandTotal = 0;
const brandMap = {};
const branchTotals = {};

rawBrandData.forEach(item => {
  const brand = item.Brand.toLowerCase();
  const branch = item.Branch;
  const count = parseInt(item["Distinct values of Sunnylink Dongle ID"], 10);

  grandTotal += count;
  branchTotals[branch] = (branchTotals[branch] || 0) + count;

  if (!brandMap[brand]) {
    brandMap[brand] = {
      brand,
      totalDevices: 0,
      branches: {}
    };
  }

  brandMap[brand].totalDevices += count;
  brandMap[brand].branches[branch] = (brandMap[brand].branches[branch] || 0) + count;
});

const sortedBrands = Object.values(brandMap)
  .sort((a, b) => b.totalDevices - a.totalDevices)
  .map((b, idx) => ({
    ...b,
    rank: idx + 1,
    sharePercent: Number(((b.totalDevices / grandTotal) * 100).toFixed(1))
  }));

// Create inverted map from vehicle make to brand stat
const makeToBrand = {};
sortedBrands.forEach(b => {
  const aliases = brandGroupMap[b.brand] || [b.brand];
  aliases.forEach(alias => {
    makeToBrand[alias.toLowerCase()] = b.brand;
  });
});

const output = {
  lastUpdated: "2026-09-02",
  source: "Sunnylink Metabase (Brand x Branch Split)",
  totalDevices: grandTotal,
  brands: sortedBrands,
  branchTotals,
  makeToBrand
};

const targetPath = path.resolve('data/fleet_brand_branch_stats.json');
fs.writeFileSync(targetPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`Saved ${targetPath} with ${sortedBrands.length} brands and ${grandTotal} total devices.`);
