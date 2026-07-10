// Build data/shelters.js — public bomb shelters for the city.
// Source: miklat.co.il national aggregation of official municipal shelter lists
// (per-record `src` field is 'municipal-web' — the city's own published registry).
// Coordinates come pre-geocoded; we filter by the city name and re-project locally.
// Run: node scripts/fetch-shelters.mjs        (CITY=<slug> for another city)
import fs from 'fs';
import path from 'path';
import { loadCity } from './lib-city.mjs';

const cfg = loadCity();
const LITE_URL = 'https://miklat.co.il/data/shelters-lite.json';     // [[lng,lat,type],…]
const DETAILS_URL = 'https://miklat.co.il/data/shelters-details.json'; // {idx:{a,c,n,…,src}}
const TYPE_HE = { 0: 'מקלט ציבורי', 1: 'מקלט בבניין משותף', 2: 'ממ״ד', 3: 'מקלט במוסד ציבורי', 4: 'מקלט ציבורי' };

const dataJs = fs.readFileSync(path.join(cfg.dataDir, 'data.js'), 'utf8');
const lat0 = +/"lat0":([\d.]+)/.exec(dataJs)[1];
const lon0 = +/"lon0":([\d.]+)/.exec(dataJs)[1];
const PX = lon => Math.round((lon - lon0) * Math.cos(lat0 * Math.PI / 180) * 111320 * 10); // dm
const PY = lat => Math.round((lat - lat0) * 110540 * 10);

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': cfg.ua }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  return r.json();
}

const [lite, details] = await Promise.all([get(LITE_URL), get(DETAILS_URL)]);
const items = [];
lite.forEach(([lng, lat, type], i) => {
  const d = details[i];
  if (!d || d.c !== cfg.nameHe) return;
  const note = String(d.n || '').split(';')[0].trim(); // first clause: venue / neighborhood
  items.push([PX(lng), PY(lat), String(d.a || '').trim(), type, note.slice(0, 60)]);
});
if (items.length < 5) throw new Error('suspiciously few shelters for ' + cfg.nameHe + ': ' + items.length + ' — refusing to overwrite');
items.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const out = 'window.SHELTERS=' + JSON.stringify({
  src: 'הרשימה העירונית הרשמית (באמצעות miklat.co.il)',
  types: TYPE_HE,
  items,
}) + ';';
fs.writeFileSync(path.join(cfg.dataDir, 'shelters.js'), out);
console.log('data/shelters.js:', items.length, 'shelters ·', (out.length / 1024).toFixed(0), 'KB');
