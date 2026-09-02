import fs from 'fs';
import path from 'path';

const rawStats = [
  {"ModelManager ActiveBundle DisplayName":"","Distinct values of CurrentRoute":"128,298"},
  {"ModelManager ActiveBundle DisplayName":"Aggressive TR (June 28, 2025)","Distinct values of CurrentRoute":"9"},
  {"ModelManager ActiveBundle DisplayName":"BMRLNAP Model (August 20, 2026)","Distinct values of CurrentRoute":"15"},
  {"ModelManager ActiveBundle DisplayName":"BMRLNAP Model v2 (August 24, 2026)","Distinct values of CurrentRoute":"19"},
  {"ModelManager ActiveBundle DisplayName":"BMRLNAP Model v3 (August 26, 2026)","Distinct values of CurrentRoute":"54"},
  {"ModelManager ActiveBundle DisplayName":"CD210 Model (February 03, 2026)","Distinct values of CurrentRoute":"383"},
  {"ModelManager ActiveBundle DisplayName":"CD210 Model (January 31, 2026)","Distinct values of CurrentRoute":"4,650"},
  {"ModelManager ActiveBundle DisplayName":"Certified Herbalist v2 (February 19, 2024)","Distinct values of CurrentRoute":"203"},
  {"ModelManager ActiveBundle DisplayName":"Cool GWM  (October 24, 2025)","Distinct values of CurrentRoute":"533"},
  {"ModelManager ActiveBundle DisplayName":"Dark Souls Model (December 03, 2025)","Distinct values of CurrentRoute":"10"},
  {"ModelManager ActiveBundle DisplayName":"Dark Souls Model v2 (December 11, 2025)","Distinct values of CurrentRoute":"2,844"},
  {"ModelManager ActiveBundle DisplayName":"Down to Ride v5 (July 08, 2025)","Distinct values of CurrentRoute":"23"},
  {"ModelManager ActiveBundle DisplayName":"Down to Ride v6 (August 12, 2025)","Distinct values of CurrentRoute":"7,268"},
  {"ModelManager ActiveBundle DisplayName":"Duck Amigo (March 18, 2024)","Distinct values of CurrentRoute":"148"},
  {"ModelManager ActiveBundle DisplayName":"Falling Phoenix (August 14, 2025)","Distinct values of CurrentRoute":"123"},
  {"ModelManager ActiveBundle DisplayName":"Falling Phoenix (August 14, 2026)","Distinct values of CurrentRoute":"1,359"},
  {"ModelManager ActiveBundle DisplayName":"Filet o Fish (March 07, 2025)","Distinct values of CurrentRoute":"1,015"},
  {"ModelManager ActiveBundle DisplayName":"Firehose Model (August 31, 2025)","Distinct values of CurrentRoute":"1,667"},
  {"ModelManager ActiveBundle DisplayName":"Fly By Wire (September 04, 2025)","Distinct values of CurrentRoute":"29"},
  {"ModelManager ActiveBundle DisplayName":"GWM V9 (October 21, 2025)","Distinct values of CurrentRoute":"478"},
  {"ModelManager ActiveBundle DisplayName":"Get Your Hopes Up Model (July 25, 2026)","Distinct values of CurrentRoute":"207"},
  {"ModelManager ActiveBundle DisplayName":"Happy Birthday Model (August 24, 2026)","Distinct values of CurrentRoute":"39"},
  {"ModelManager ActiveBundle DisplayName":"I Desire Model (August 21, 2026)","Distinct values of CurrentRoute":"20"},
  {"ModelManager ActiveBundle DisplayName":"Kerrygold Driving (June 08, 2025)","Distinct values of CurrentRoute":"116"},
  {"ModelManager ActiveBundle DisplayName":"Kumars Vibe  (August 14, 2026)","Distinct values of CurrentRoute":"32"},
  {"ModelManager ActiveBundle DisplayName":"Kumars Vibe (August 16, 2025)","Distinct values of CurrentRoute":"290"},
  {"ModelManager ActiveBundle DisplayName":"LAv2 (January 24, 2024)","Distinct values of CurrentRoute":"6"},
  {"ModelManager ActiveBundle DisplayName":"Lebowski Model (July 01, 2026)","Distinct values of CurrentRoute":"19"},
  {"ModelManager ActiveBundle DisplayName":"Liquid Crystal Driving (June 21, 2025)","Distinct values of CurrentRoute":"1,533"},
  {"ModelManager ActiveBundle DisplayName":"Macrostiff (January 01, 2026)","Distinct values of CurrentRoute":"215"},
  {"ModelManager ActiveBundle DisplayName":"Macrostiff Model (January 01, 2026)","Distinct values of CurrentRoute":"1,977"},
  {"ModelManager ActiveBundle DisplayName":"Michael RL V2 (July 18, 2026)","Distinct values of CurrentRoute":"361"},
  {"ModelManager ActiveBundle DisplayName":"Neurips Driving Model v1 (November 12, 2025)","Distinct values of CurrentRoute":"97"},
  {"ModelManager ActiveBundle DisplayName":"Neurips Driving Model v2 (November 12, 2025)","Distinct values of CurrentRoute":"382"},
  {"ModelManager ActiveBundle DisplayName":"Nevada Model (September 07, 2025)","Distinct values of CurrentRoute":"604"},
  {"ModelManager ActiveBundle DisplayName":"North Dakota (April 29, 2024)","Distinct values of CurrentRoute":"195"},
  {"ModelManager ActiveBundle DisplayName":"North Dakota v2 (April 29, 2024)","Distinct values of CurrentRoute":"1,498"},
  {"ModelManager ActiveBundle DisplayName":"North Nevada Model V2 (October 08, 2025)","Distinct values of CurrentRoute":"2,310"},
  {"ModelManager ActiveBundle DisplayName":"Notre Dame  (July 01, 2024)","Distinct values of CurrentRoute":"6"},
  {"ModelManager ActiveBundle DisplayName":"Notre Dame (July 01, 2024)","Distinct values of CurrentRoute":"874"},
  {"ModelManager ActiveBundle DisplayName":"Nuggets in Digon (October 09, 2025)","Distinct values of CurrentRoute":"5"},
  {"ModelManager ActiveBundle DisplayName":"OP Model (April 01, 2026)","Distinct values of CurrentRoute":"75"},
  {"ModelManager ActiveBundle DisplayName":"OP Model 10 V3 (April 19, 2026)","Distinct values of CurrentRoute":"7,463"},
  {"ModelManager ActiveBundle DisplayName":"OP Model 10 v2 (April 18, 2026)","Distinct values of CurrentRoute":"7"},
  {"ModelManager ActiveBundle DisplayName":"OP Model 16 Deep (June 03, 2026)","Distinct values of CurrentRoute":"468"},
  {"ModelManager ActiveBundle DisplayName":"OP Model 16 Deep (\u7d20, c4 compile 08-21)","Distinct values of CurrentRoute":"6"},
  {"ModelManager ActiveBundle DisplayName":"OP Model 7 (April 03, 2026)","Distinct values of CurrentRoute":"1,867"},
  {"ModelManager ActiveBundle DisplayName":"OP Model 8 (April 07, 2026)","Distinct values of CurrentRoute":"81"},
  {"ModelManager ActiveBundle DisplayName":"OP Model v10 (April 17, 2026)","Distinct values of CurrentRoute":"8"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT LAT-30 (LON-3_2 + enter-trim)","Distinct values of CurrentRoute":"5"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT LAT-31 (LON-3_2 + enter-trim R-gate)","Distinct values of CurrentRoute":"13"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT LON-2_5 (run29 + JP stop/launch)","Distinct values of CurrentRoute":"6"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT LON-3_2 (run29 + JP stop, smooth)","Distinct values of CurrentRoute":"3"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT LON-4c (LAT-31 + JP stop/hold \u524d\u50be)","Distinct values of CurrentRoute":"5"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT run14 (JP lane-left + curve)","Distinct values of CurrentRoute":"3"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT run19 (JP feedback-kappa w1.5)","Distinct values of CurrentRoute":"1"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT run28 (JP fb-kappa smooth + fade8-14 + vy_hp)","Distinct values of CurrentRoute":"2"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT run29 (JP fb-kappa + sign-balance W27)","Distinct values of CurrentRoute":"5"},
  {"ModelManager ActiveBundle DisplayName":"OPM10v3 FT run4 (JP curve fine-tune)","Distinct values of CurrentRoute":"9"},
  {"ModelManager ActiveBundle DisplayName":"Off Policy Model v3 (February 26, 2026)","Distinct values of CurrentRoute":"6"},
  {"ModelManager ActiveBundle DisplayName":"Off-Policy Model v5 (March 14, 2026)","Distinct values of CurrentRoute":"330"},
  {"ModelManager ActiveBundle DisplayName":"Off-policy Model v2 (February 20, 2026)","Distinct values of CurrentRoute":"219"},
  {"ModelManager ActiveBundle DisplayName":"Planplus Model (November 28, 2025)","Distinct values of CurrentRoute":"4"},
  {"ModelManager ActiveBundle DisplayName":"Planplus v2 (December 11, 2025)","Distinct values of CurrentRoute":"49"},
  {"ModelManager ActiveBundle DisplayName":"Pop Model (March 20, 2026)","Distinct values of CurrentRoute":"398"},
  {"ModelManager ActiveBundle DisplayName":"Pop Model v2 (March 24, 2026)","Distinct values of CurrentRoute":"7,902"},
  {"ModelManager ActiveBundle DisplayName":"RDF Driving (August 6, 2026)","Distinct values of CurrentRoute":"52"},
  {"ModelManager ActiveBundle DisplayName":"RDF Model (August 05, 2026)","Distinct values of CurrentRoute":"3,248"},
  {"ModelManager ActiveBundle DisplayName":"RDF Model V2 (August 11, 2026)","Distinct values of CurrentRoute":"788"},
  {"ModelManager ActiveBundle DisplayName":"Rebel Legion Model (July 22, 2026)","Distinct values of CurrentRoute":"35"},
  {"ModelManager ActiveBundle DisplayName":"Rebellious Hope (July 27, 2026)","Distinct values of CurrentRoute":"259"},
  {"ModelManager ActiveBundle DisplayName":"Rebellious Hope Model (July 27, 2026)","Distinct values of CurrentRoute":"893"},
  {"ModelManager ActiveBundle DisplayName":"Recertified Herbalist (March 01, 2024)","Distinct values of CurrentRoute":"489"},
  {"ModelManager ActiveBundle DisplayName":"SC Model (January 08, 2026)","Distinct values of CurrentRoute":"2,732"},
  {"ModelManager ActiveBundle DisplayName":"SP Vikander Model (May 03, 2025)","Distinct values of CurrentRoute":"228"},
  {"ModelManager ActiveBundle DisplayName":"Secret Good Openpilot (May 16, 2025)","Distinct values of CurrentRoute":"7"},
  {"ModelManager ActiveBundle DisplayName":"Space Lab 2 (July 26, 2025)","Distinct values of CurrentRoute":"194"},
  {"ModelManager ActiveBundle DisplayName":"Space Lab 3 (August 08, 2025)","Distinct values of CurrentRoute":"2,029"},
  {"ModelManager ActiveBundle DisplayName":"Steam Powered Model (August 16, 2025)","Distinct values of CurrentRoute":"159"},
  {"ModelManager ActiveBundle DisplayName":"TT Model (August 18, 2026)","Distinct values of CurrentRoute":"8"},
  {"ModelManager ActiveBundle DisplayName":"TTTTFBRLM (August 18, 2026)","Distinct values of CurrentRoute":"1"},
  {"ModelManager ActiveBundle DisplayName":"Tee Time (August 18, 2026)","Distinct values of CurrentRoute":"40"},
  {"ModelManager ActiveBundle DisplayName":"Terrible Super Fantastic Do Over Model (August 15, 2026)","Distinct values of CurrentRoute":"1,644"},
  {"ModelManager ActiveBundle DisplayName":"Terrible Super Fantastic Model  (August 12, 2026)","Distinct values of CurrentRoute":"29"},
  {"ModelManager ActiveBundle DisplayName":"Terrible Super Fantastic Model (August 12, 2026)","Distinct values of CurrentRoute":"3"},
  {"ModelManager ActiveBundle DisplayName":"Terrible super fantastic do over model (August 15, 2026)","Distinct values of CurrentRoute":"3"},
  {"ModelManager ActiveBundle DisplayName":"Test split  (August 11, 2026)","Distinct values of CurrentRoute":"1"},
  {"ModelManager ActiveBundle DisplayName":"The Cool Peoples Model v2 (October 09, 2025)","Distinct values of CurrentRoute":"14"},
  {"ModelManager ActiveBundle DisplayName":"The Cool Peoples Model v3 (October 10, 2025)","Distinct values of CurrentRoute":"1,690"},
  {"ModelManager ActiveBundle DisplayName":"Tomb Raider 16 (July 21, 2025)","Distinct values of CurrentRoute":"1,437"},
  {"ModelManager ActiveBundle DisplayName":"UV + DTR Model (August 13, 2025)","Distinct values of CurrentRoute":"14"},
  {"ModelManager ActiveBundle DisplayName":"Vegetarian Filet o Fish (June 21, 2025)","Distinct values of CurrentRoute":"462"},
  {"ModelManager ActiveBundle DisplayName":"WD40 (April 09, 2024)","Distinct values of CurrentRoute":"8,357"},
  {"ModelManager ActiveBundle DisplayName":"WMI  V11 (January 12, 2026)","Distinct values of CurrentRoute":"5"},
  {"ModelManager ActiveBundle DisplayName":"WMI V12 (January 13, 2026)","Distinct values of CurrentRoute":"6,407"},
  {"ModelManager ActiveBundle DisplayName":"WMI V9 (January 07, 2026)","Distinct values of CurrentRoute":"173"},
  {"ModelManager ActiveBundle DisplayName":"gWM v6 (September 20, 2025)","Distinct values of CurrentRoute":"13"},
  {"ModelManager ActiveBundle DisplayName":"gWM v7 (September 27, 2025)","Distinct values of CurrentRoute":"3"},
  {"ModelManager ActiveBundle DisplayName":"gWM v8 (September 28, 2025)","Distinct values of CurrentRoute":"768"},
  {"ModelManager ActiveBundle DisplayName":"off policy model (February 04, 2026)","Distinct values of CurrentRoute":"67"}
];

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Clean model names and consolidate versions
const stockEntry = rawStats.find(r => !r["ModelManager ActiveBundle DisplayName"] || r["ModelManager ActiveBundle DisplayName"].trim() === "");
const stockRoutes = stockEntry ? parseInt(stockEntry["Distinct values of CurrentRoute"].replace(/,/g, ""), 10) : 128298;

const nonStock = rawStats
  .filter(r => r["ModelManager ActiveBundle DisplayName"] && r["ModelManager ActiveBundle DisplayName"].trim() !== "")
  .map(r => {
    const rawName = r["ModelManager ActiveBundle DisplayName"].trim();
    const routes = parseInt(r["Distinct values of CurrentRoute"].replace(/,/g, ""), 10);
    const cleanName = rawName.replace(/\s*\([A-Za-z]+ \d{1,2},? \d{4}\)/g, "").trim();
    return {
      rawName,
      cleanName,
      routes,
      slug: slugify(cleanName)
    };
  })
  .sort((a, b) => b.routes - a.routes);

// Consolidate entries with same cleanName (e.g., if there are minor duplicate date tags)
const consolidatedMap = new Map();
nonStock.forEach(item => {
  const existing = consolidatedMap.get(item.cleanName);
  if (!existing) {
    consolidatedMap.set(item.cleanName, { ...item });
  } else {
    existing.routes += item.routes;
    if (item.routes > existing.routes) {
      existing.rawName = item.rawName;
    }
  }
});

const consolidatedModels = Array.from(consolidatedMap.values()).sort((a, b) => b.routes - a.routes);
consolidatedModels.forEach((m, idx) => {
  m.rank = idx + 1;
});

const totalCustomRoutes = consolidatedModels.reduce((sum, m) => sum + m.routes, 0);

// Create alias lookup map for flexible matching
const aliasMap = {
  "wmi v12": "WMI V12",
  "wmiv12": "WMI V12",
  "pop model": "Pop Model v2",
  "pop model v2": "Pop Model v2",
  "pop model (v1)": "Pop Model",
  "op model 10 v3": "OP Model 10 V3",
  "opm10v3": "OP Model 10 V3",
  "down to ride v6": "Down to Ride v6",
  "dtrv6": "Down to Ride v6",
  "dtr v6": "Down to Ride v6",
  "cd210": "CD210 Model",
  "cd210 model": "CD210 Model",
  "dark souls v2": "Dark Souls Model v2",
  "dark souls model v2": "Dark Souls Model v2",
  "sc model": "SC Model",
  "wd40": "WD40",
  "north dakota": "North Dakota",
  "north dakota v2": "North Dakota v2",
  "the cool peoples model v3": "The Cool Peoples Model v3",
  "tcpmv3": "The Cool Peoples Model v3",
  "tcpmv3 (the cool peoples model)": "The Cool Peoples Model v3",
  "tcpmv3 (the cool peoples model v3)": "The Cool Peoples Model v3",
  "space lab 3": "Space Lab 3",
  "macrostiff": "Macrostiff Model",
  "macrostiff model": "Macrostiff Model",
  "rdf model": "RDF Model",
  "rdf model v2": "RDF Model V2",
  "firehose model": "Firehose Model",
  "kumar's vibe": "Kumars Vibe",
  "kumars vibe": "Kumars Vibe",
  "off-policy model v5": "Off-Policy Model v5",
  "off policy model v5": "Off-Policy Model v5",
  "recertified herbalist": "Recertified Herbalist"
};

const statsExport = {
  lastUpdated: "2026-09-02",
  source: "Sunnypilot Live Stats (Metabase)",
  stockRoutes,
  totalCustomRoutes,
  models: consolidatedModels,
  aliasMap
};

fs.writeFileSync(path.resolve("data/fleet_model_stats.json"), JSON.stringify(statsExport, null, 2), "utf8");
console.log(`Saved data/fleet_model_stats.json with ${consolidatedModels.length} models and ${totalCustomRoutes} custom routes.`);
