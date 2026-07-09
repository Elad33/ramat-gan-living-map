// One command → a living map of any Israeli city:
//   node scripts/new-city.mjs <slug>
// Needs cities/<slug>.json (bbox may be null — it is derived from the OSM
// boundary and persisted). Produces a self-contained deployable folder at
// cities/<slug>/ and prints a data-coverage score (will this demo impress?).
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { loadCity, saveCityBbox, renderQuery, ROOT } from './lib-city.mjs';

const slug = process.argv[2];
if (!slug) { console.error('usage: node scripts/new-city.mjs <slug>   (config at cities/<slug>.json)'); process.exit(1); }
const cfg = loadCity(slug);
if (cfg.isDefault) console.log('note: building the default city through new-city works, but the daily Action already covers it');
const RAW = path.join(ROOT, 'cities', slug, 'raw');
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(cfg.dataDir, { recursive: true });

const env = { ...process.env, CITY: slug };
function run(title, cmd, args, opts = {}) {
  console.log('\n━━ ' + title + ' ━━');
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32', ...opts });
  if (r.status !== 0 && !opts.soft) { console.error('✗ failed: ' + title); process.exit(1); }
  return r.status === 0;
}

// ---- 1. bbox: derive from the OSM boundary when the config has none ----
if (!cfg.bbox) {
  console.log('━━ גוזר bbox מגבול העיר (OSM) ━━');
  const q = renderQuery(cfg, 'q_boundary.txt');
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let data = null;
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': cfg.ua }, body: q, signal: AbortSignal.timeout(120000) });
      if (r.ok) { data = await r.json(); break; }
    } catch (e) {}
  }
  const rel = data && (data.elements || []).find(e => e.type === 'relation');
  if (!rel) { console.error('✗ לא נמצא גבול עירוני "' + cfg.osmAreaName + '" (admin_level=8) ב-OSM'); process.exit(1); }
  let s = 90, w = 180, n = -90, e = -180;
  for (const m of rel.members || []) for (const g of m.geometry || []) {
    s = Math.min(s, g.lat); n = Math.max(n, g.lat);
    w = Math.min(w, g.lon); e = Math.max(e, g.lon);
  }
  const mLat = 0.004, mLon = 0.005; // ~450m margin so edge buildings/stops aren't clipped
  const bbox = { s: +(s - mLat).toFixed(6), w: +(w - mLon).toFixed(6), n: +(n + mLat).toFixed(6), e: +(e + mLon).toFixed(6) };
  saveCityBbox(cfg, bbox);
  console.log('✓ bbox:', JSON.stringify(bbox), '(נשמר ב-cities/' + slug + '.json)');
}

// ---- 2-5. pipeline ----
run('OSM (מבנים, רחובות, כתובות, POI, תחבורה)', 'node', [path.join(ROOT, 'scripts', 'fetch-osm.mjs')], { cwd: RAW });
run('iplan (תוכניות בנייה — שירות ארצי)', 'node', [path.join(ROOT, 'scripts', 'fetch-plans.mjs')], { cwd: RAW, soft: true });
run('עיבוד העיר לתלת-ממד', 'node', [path.join(ROOT, 'scripts', 'process.mjs')], { cwd: RAW });
run('עיבוד תכנון + תחבורה', 'node', [path.join(ROOT, 'scripts', 'process2.mjs')], { cwd: RAW, soft: true });
for (const f of ['data.js', 'data2.js']) {
  const src = path.join(RAW, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(cfg.dataDir, f));
}
run('עסקים (OSM + Overture Places)', 'node', [path.join(ROOT, 'scripts', 'fetch-businesses.mjs')], { cwd: RAW, soft: true });
run('אירועי עירייה (אם מוגדר פיד)', 'node', [path.join(ROOT, 'scripts', 'fetch-muni-events.mjs')], { soft: true });
run('בניית האתר', 'node', ['build.mjs'], { cwd: path.join(ROOT, 'src') });

// ---- 6. coverage score ----
console.log('\n━━ ציון כיסוי נתונים ━━');
const g = f => fs.existsSync(path.join(cfg.dataDir, f)) ? fs.readFileSync(path.join(cfg.dataDir, f), 'utf8') : '';
const cityJs = g('data.js');
const count = (src, re) => (src.match(re) || []).length;
const buildings = count(cityJs, /\],\[/g); // rough: bld record separators
const cityObj = JSON.parse(cityJs.replace(/^window\.CITY=/, '').replace(/;$/, ''));
let addrCount = 0; for (const k in cityObj.addr) addrCount += cityObj.addr[k].length;
const bizJs = g('biz.js');
const bizCount = bizJs ? JSON.parse(bizJs.replace(/^window\.BIZ=/, '').replace(/;$/, '')).items.length : 0;
const stats = {
  'מבנים': cityObj.bld.length,
  'רחובות בעלי שם': cityObj.rdNames.length,
  'כתובות': addrCount,
  'עסקים': bizCount,
  'נקודות עניין': cityObj.pois.length,
  'שכונות': cityObj.hoods.length,
};
for (const [k, v] of Object.entries(stats)) console.log('  ' + k + ':', v.toLocaleString('he-IL'));
const score = Math.min(100, Math.round(
  Math.min(1, cityObj.bld.length / 5000) * 40 +
  Math.min(1, bizCount / 800) * 30 +
  Math.min(1, addrCount / 3000) * 20 +
  Math.min(1, cityObj.pois.length / 40) * 10));
console.log('  ─────');
console.log('  ציון דמו: ' + score + '/100 ' + (score >= 75 ? '🟢 ירשים' : score >= 50 ? '🟡 סביר — לבדוק ויזואלית' : '🔴 מיפוי דליל — לשקול עיר אחרת'));

console.log('\n━━ הצעד הבא ━━');
console.log('  תצוגה מקומית: cities/' + slug + '/index.html');
console.log('  דיפלוי: cd cities/' + slug + ' && vercel --prod   (פרויקט livemap-' + slug + ', env: GEMINI_API_KEY + CITY_NAME=' + cfg.nameHe + ')');
