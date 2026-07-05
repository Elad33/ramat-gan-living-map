// Fetch all OSM raw data for the daily refresh. Run inside a work dir (e.g. raw/):
//   node ../scripts/fetch-osm.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const QDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'queries');
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overpass(queryFile, outFile) {
  const q = fs.readFileSync(path.join(QDIR, queryFile), 'utf8');
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: q,
        signal: AbortSignal.timeout(240000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      JSON.parse(text); // validate
      fs.writeFileSync(outFile, text);
      console.log('✓', outFile, (text.length / 1048576).toFixed(2), 'MB', '(' + url.split('/')[2] + ')');
      return;
    } catch (e) {
      console.log('…retry', outFile, 'attempt', attempt + 1, String(e.message).slice(0, 80));
      await sleep(15000 + attempt * 10000);
    }
  }
  throw new Error('failed to fetch ' + outFile);
}

// order: small ones first, buildings by quadrant last (heaviest)
await overpass('q_boundary.txt', 'boundary.json');
await sleep(3000);
await overpass('q_roads.txt', 'roads.json');
await sleep(3000);
await overpass('q_green.txt', 'green.json');
await sleep(3000);
await overpass('q_addr.txt', 'addr.json');
await sleep(3000);
await overpass('q_poi.txt', 'poi.json');
await sleep(3000);
await overpass('q_transit.txt', 'transit.json');
await sleep(3000);
await overpass('q_bldrel_bbox.txt', 'bldrel.json');
for (const i of [0, 1, 2, 3]) {
  await sleep(5000);
  await overpass('q_bld' + i + '.txt', 'bld' + i + '.json');
}
console.log('OSM fetch complete');
