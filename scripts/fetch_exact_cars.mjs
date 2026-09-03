import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Vehicle definitions mapping to CarsDirect paths or manual exact overrides
const VEHICLES = [
  // Hyundai
  { make: 'Hyundai', model: 'Ioniq 5', year: 2022, slug: 'ioniq-5' },
  { make: 'Hyundai', model: 'Tucson', year: 2022, slug: 'tucson' },
  { make: 'Hyundai', model: 'Elantra', year: 2021, slug: 'elantra' },
  { make: 'Hyundai', model: 'Sonata', year: 2020, slug: 'sonata' },
  { make: 'Hyundai', model: 'Palisade', year: 2020, slug: 'palisade' },
  { make: 'Hyundai', model: 'Kona EV', year: 2020, slug: 'kona-ev', fallbackSlug: 'kona' },
  { make: 'Hyundai', model: 'Custin', manualImg: 'https://pngimg.com/uploads/kia/kia_PNG95.png' }, // Asian MPV, clean white studio MPV/SUV

  // Toyota
  { make: 'Toyota', model: 'RAV4', year: 2019, slug: 'rav4' },
  { make: 'Toyota', model: 'Corolla', year: 2023, slug: 'corolla' },
  { make: 'Toyota', model: 'Sienna', year: 2021, slug: 'sienna' },
  { make: 'Toyota', model: 'Tundra', year: 2022, slug: 'tundra' },

  // Honda
  { make: 'Honda', model: 'Civic', year: 2022, slug: 'civic' },
  { make: 'Honda', model: 'Accord', year: 2018, slug: 'accord' },
  { make: 'Honda', model: 'Ridgeline', year: 2021, slug: 'ridgeline' },
  { make: 'Honda', model: 'Odyssey', year: 2018, slug: 'odyssey' },
  { make: 'Honda', model: 'Pilot', year: 2019, slug: 'pilot' },

  // Kia
  { make: 'Kia', model: 'Niro', year: 2023, slug: 'niro' },
  { make: 'Kia', model: 'EV6', year: 2022, slug: 'ev6' },
  { make: 'Kia', model: 'Sportage PHEV', year: 2023, slug: 'sportage-plug-in-hybrid', fallbackSlug: 'sportage' },
  { make: 'Kia', model: 'Telluride', year: 2020, slug: 'telluride' },
  { make: 'Kia', model: 'K5', year: 2021, slug: 'k5' },

  // Ford
  { make: 'Ford', model: 'F-150', year: 2021, slug: 'f-150' },
  { make: 'Ford', model: 'F-150 Lightning', year: 2022, slug: 'f-150-lightning', fallbackSlug: 'f-150' },
  { make: 'Ford', model: 'Escape', year: 2020, slug: 'escape' },

  // Chevrolet
  { make: 'Chevrolet', model: 'Bolt EV/EUV', year: 2022, slug: 'bolt-euv', fallbackSlug: 'bolt-ev' },

  // Chrysler
  { make: 'Chrysler', model: 'Pacifica', year: 2020, slug: 'pacifica' },

  // Lincoln
  { make: 'Lincoln', model: 'Navigator', year: 2022, slug: 'navigator' },
  { make: 'Lincoln', model: 'Corsair', year: 2020, slug: 'corsair' },

  // RAM
  { make: 'RAM', model: '1500', year: 2020, slug: '1500' },

  // Genesis
  { make: 'Genesis', model: 'GV60', year: 2023, slug: 'gv60' },

  // Lexus
  { make: 'Lexus', model: 'RC', year: 2023, slug: 'rc-350', fallbackSlug: 'rc-300' },
  { make: 'Lexus', model: 'IS', year: 2018, slug: 'is-300', fallbackSlug: 'is-350' },
  { make: 'Lexus', model: 'RX 350', year: 2020, slug: 'rx-350' },

  // Audi
  { make: 'Audi', model: 'A3', year: 2022, slug: 'a3' },

  // Subaru
  { make: 'Subaru', model: 'Crosstrek', year: 2021, slug: 'crosstrek' },
  { make: 'Subaru', model: 'Ascent', year: 2019, slug: 'ascent' },

  // Mazda
  { make: 'Mazda', model: 'CX-5', year: 2021, slug: 'cx-5' },

  // Volvo
  { make: 'Volvo', model: 'XC90', year: 2020, slug: 'xc90' },

  // Tesla
  { make: 'Tesla', model: 'Model 3 / Y', manualImg: 'https://pngimg.com/uploads/tesla_car/tesla_car_PNG31.png' },

  // Rivian
  { make: 'Rivian', model: 'R1T', year: 2022, slug: 'r1t' },
  { make: 'Rivian', model: 'R1S', year: 2022, slug: 'r1s' },

  // BYD
  { make: 'BYD', model: 'Frigate 07', slug: 'frigate-07' }
];

function pickWhite(colors) {
  if (!colors || colors.length === 0) return null;
  const nonWhite = /black|blue|red|ruby|orange|yellow|green|gray|grey|silver|bronze|brown|gold|metal|night|shadow|dark|charcoal|granite|magnetic|passion|currant/i;
  
  // 1. Pure explicit white
  const pureWhite = colors.find(c => /\b(super white|oxford white|polar white|summit white|glacier white|bright white|pure white|atlas white|blizzard|frost|snow|ice|ceramic|chalk|white)\b/i.test(c.name) && !nonWhite.test(c.name));
  if (pureWhite) return pureWhite;

  // 2. Pearl without dark/colored words
  const pearlWhite = colors.find(c => /white|pearl|ivory|cream/i.test(c.name) && !nonWhite.test(c.name));
  if (pearlWhite) return pearlWhite;

  // 3. Anything containing white
  const anyWhite = colors.find(c => /white/i.test(c.name));
  if (anyWhite) return anyWhite;

  return colors[0];
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html'
    }
  });
  if (!res.ok) return null;
  return await res.text();
}

async function resolveCarImageCode(vehicle) {
  if (vehicle.manualImg) {
    return { type: 'url', url: vehicle.manualImg };
  }

  const slugsToTry = [vehicle.slug];
  if (vehicle.fallbackSlug) slugsToTry.push(vehicle.fallbackSlug);

  for (const s of slugsToTry) {
    const url = `https://www.carsdirect.com/${vehicle.year}/${vehicle.make.toLowerCase()}/${s}/colors`;
    const html = await fetchHtml(url);
    if (!html) continue;

    const regex = /data-name="([^"]+)"[^>]*data-image="([^"]+)"/g;
    let m;
    const colors = [];
    while ((m = regex.exec(html)) !== null) {
      colors.push({ name: m[1], code: m[2] });
    }

    if (colors.length > 0) {
      const white = pickWhite(colors);
      if (white) {
        return {
          type: 'autodata',
          code: white.code,
          name: white.name,
          url: `https://cdcssl.ibsrv.net/autodata/images/?img=${white.code}.png&width=1000`
        };
      }
    }
  }

  return null;
}

async function run() {
  const targetDir = path.join(process.cwd(), 'public/cars');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  console.log(`Starting download for ${VEHICLES.length} vehicles...`);
  const results = [];

  for (const v of VEHICLES) {
    const filename = `${v.make.toLowerCase()}-${v.model.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    const outPath = path.join(targetDir, filename);

    console.log(`\nResolving: ${v.make} ${v.model} (${v.year || 'N/A'})...`);
    const resolved = await resolveCarImageCode(v);

    if (!resolved) {
      console.log(`❌ Failed to resolve ${v.make} ${v.model}`);
      results.push({ ...v, status: 'FAILED' });
      continue;
    }

    console.log(`  -> Found: ${resolved.name || 'manual'} (${resolved.code || resolved.url})`);
    console.log(`  -> Downloading ${resolved.url}...`);

    try {
      const imgRes = await fetch(resolved.url);
      if (!imgRes.ok) {
        console.log(`  ❌ Image download failed with status ${imgRes.status}`);
        results.push({ ...v, status: 'HTTP_' + imgRes.status });
        continue;
      }

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      if (buffer.length < 500) {
        console.log(`  ❌ Buffer too small (${buffer.length} bytes)`);
        results.push({ ...v, status: 'CORRUPT' });
        continue;
      }

      // Trim transparent boundaries and resize to standard width 440px
      await sharp(buffer)
        .trim()
        .resize({ width: 440, height: 260, fit: 'inside' })
        .png({ quality: 90, compressionLevel: 8 })
        .toFile(outPath);

      const stat = fs.statSync(outPath);
      console.log(`  ✅ Saved ${filename} (${Math.round(stat.size / 1024)} KB)`);
      results.push({ ...v, status: 'OK', filename, size: stat.size, color: resolved.name });
    } catch (err) {
      console.log(`  ❌ Error processing image: ${err.message}`);
      results.push({ ...v, status: 'ERROR', error: err.message });
    }
  }

  console.log('\n================ SUMMARY ================');
  console.log(`Total: ${VEHICLES.length}`);
  console.log(`Success: ${results.filter(r => r.status === 'OK').length}`);
  console.log(`Failed: ${results.filter(r => r.status !== 'OK').length}`);
}

run();
