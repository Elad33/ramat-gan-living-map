// Process iplan planning polygons + OSM transit into data2.js (appended to CITY)
import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('data.js', 'utf8').replace(/^window\.CITY=/, '').replace(/;$/, '')).meta;
const lat0 = meta.lat0, lon0 = meta.lon0;
const kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540;
const PX = lon => Math.round((lon - lon0) * kx * 10);
const PY = lat => Math.round((lat - lat0) * ky * 10);
const delta = pts => {
  const out = [pts[0][0], pts[0][1]];
  for (let i = 1; i < pts.length; i++) out.push(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return out;
};

// Douglas-Peucker on [[x,y],...] (dm units)
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, maxI = -1;
    const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2));
      const px = ax + t * dx - pts[i][0], py = ay + t * dy - pts[i][1];
      const d = px * px + py * py;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tol * tol) { keep[maxI] = 1; stack.push([a, maxI], [maxI, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const ringArea = pts => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return s / 2; // dm² signed
};

// ---------- plans ----------
const feats = [];
const planFiles = fs.readdirSync('.').filter(f => /^plans_\d+\.json$/.test(f));
if (!planFiles.length && fs.existsSync('../plans/plans_0.json')) planFiles.push('../plans/plans_0.json', '../plans/plans_1000.json');
for (const f of planFiles)
  feats.push(...JSON.parse(fs.readFileSync(f, 'utf8')).features);
console.log('plan pages:', planFiles.length, 'features:', feats.length);

const ACTIVE = ['קבלת תכנית', 'קיום תנאי סף', 'בתהליך הפקדה', 'פרסום הפקדה', 'רישום התנגדויות', 'החלטה בדיון', 'בתהליך אישור', 'בתהליך פרסום', 'פרסום הכנה', 'פרסום הבקשה', 'תיקון תכנית', 'הועברה לו'];
const APPROVED = ['פרסום אישור', 'התכנית אושרה', 'סיום טיפול'];
const CUTOFF = Date.UTC(2019, 0, 1);
const RENEWAL_CUTOFF = Date.UTC(2014, 0, 1);
// urban renewal / TAMA-38 instruments, identified by plan name
const RENEWAL_RE = /תמ.?["']?א.?\s*\/?\s*38|פינוי[\s-]*בינוי|התחדשות עירונית|הריסה ובני|עיבוי/;

const plans = [];
const seen = new Set();
let statActive = 0, statApproved = 0, statSkip = 0;
for (const f of feats) {
  const a = f.attributes;
  const county = a.plan_county_name || '';
  const jur = a.jurstiction_area_name || '';
  const isRG = county.includes('רמת גן') || ((county === '' || county === '-') && jur.includes('רמת גן'));
  if (!isRG) { statSkip++; continue; }
  const st = (a.internet_short_status || '').trim();
  const isRenewal = RENEWAL_RE.test(a.pl_name || '');
  const dt = a.pl_date_8 || a.last_update_date || 0;
  let kind = null;
  if (isRenewal && (ACTIVE.some(s => st.startsWith(s)) || (APPROVED.some(s => st.startsWith(s)) && dt >= RENEWAL_CUTOFF))) kind = 'r';
  else if (ACTIVE.some(s => st.startsWith(s))) kind = 'a';
  else if (APPROVED.some(s => st.startsWith(s)) && dt >= CUTOFF) kind = 'p';
  if (!kind) { statSkip++; continue; }
  if ((a.pl_area_dunam || 0) > 2500) { statSkip++; continue; }
  if ((a.entity_subtype_desc || '').includes('כוללנית')) { statSkip++; continue; }
  if (seen.has(a.pl_number)) continue;
  seen.add(a.pl_number);
  const rings = (f.geometry && f.geometry.rings) || [];
  if (!rings.length) { statSkip++; continue; }
  // project, simplify, keep outer rings (orientation of the largest ring)
  const proj = rings.map(r => {
    let p = r.map(([lon, lat]) => [PX(lon), PY(lat)]);
    p = p.filter((q, i) => i === 0 || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]);
    if (p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p = p.slice(0, -1);
    return dp(p, 12); // 1.2m tolerance
  }).filter(p => p.length >= 3 && Math.abs(ringArea(p)) > 40000); // > 400 m²
  if (!proj.length) { statSkip++; continue; }
  const mainSign = Math.sign(ringArea(proj.reduce((m, p) => Math.abs(ringArea(p)) > Math.abs(ringArea(m)) ? p : m)));
  const outers = proj.filter(p => Math.sign(ringArea(p)) === mainSign);
  const year = a.pl_date_8 ? new Date(a.pl_date_8).getFullYear() : (a.last_update_date ? new Date(a.last_update_date).getFullYear() : null);
  const obj = (a.pl_objectives || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  // geometric area (dm² -> dunam); the registered pl_area_dunam is unreliable (sometimes m²)
  const geomDunam = outers.reduce((s, p) => s + Math.abs(ringArea(p)), 0) / 100000;
  if (geomDunam > 2500) { statSkip++; continue; } // citywide overlays flood the map
  plans.push({
    n: a.pl_number || '',
    t: (a.pl_name || '').trim().slice(0, 90),
    s: st, k: kind,
    d: geomDunam >= 0.3 ? Math.round(geomDunam * 10) / 10 : null,
    u: a.quantity_delta_120 ? Math.round(a.quantity_delta_120) : null,
    y: year,
    url: a.pl_url || null,
    o: obj || null,
    r: outers.map(delta),
  });
  if (kind === 'a') statActive++; else statApproved++;
}
const statRenewal = plans.filter(p => p.k === 'r').length;
console.log('plans kept:', plans.length, '(active:', statActive, 'approved-recent:', statApproved, 'renewal/tama38:', statRenewal, 'skipped:', statSkip + ')');

// ---------- transit ----------
const tr = JSON.parse(fs.readFileSync('transit.json', 'utf8'));
// city boundary for bus-stop filtering
const city = JSON.parse(fs.readFileSync('data.js', 'utf8').replace(/^window\.CITY=/, '').replace(/;$/, ''));
const rings2 = city.boundary.map(d => {
  const out = []; let x = 0, y = 0;
  for (let i = 0; i < d.length; i += 2) {
    if (i === 0) { x = d[0]; y = d[1]; } else { x += d[i]; y += d[i + 1]; }
    out.push([x, y]);
  }
  return out;
});
const inCity = (x, y) => {
  for (const ring of rings2) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
};

const rail = [];   // [tunnelFlag, x0,y0,dx,dy...]
const railStops = []; // [name, x, y]
const busStops = [];  // [name, x, y]
const seenStop = new Set();
for (const e of tr.elements) {
  const t = e.tags || {};
  if (e.type === 'way' && t.railway) {
    if (t.railway === 'subway' && t.construction) continue;
    const pts = e.geometry.map(g => [PX(g.lon), PY(g.lat)]);
    rail.push([t.tunnel === 'yes' ? 1 : 0, ...delta(pts)]);
  } else if (e.type === 'node') {
    const x = PX(e.lon), y = PY(e.lat);
    if (t.railway === 'station' || t.railway === 'halt') {
      const nm = t['name:he'] || t.name || 'תחנה';
      railStops.push([nm, x, y]);
    } else if (t.highway === 'bus_stop') {
      if (!inCity(x, y)) continue;
      const nm = t['name:he'] || t.name || '';
      const code = parseInt(t.ref, 10) || 0;
      const key = code || (Math.round(x / 300) + ':' + Math.round(y / 300) + ':' + nm);
      if (seenStop.has(key)) continue;
      seenStop.add(key);
      busStops.push([nm, code, x, y]);
    }
  }
}
console.log('rail ways:', rail.length, 'rail stops:', railStops.length, 'bus stops:', busStops.length);

const data2 = { plans, rail, railStops, busStops };
const json = JSON.stringify(data2);
fs.writeFileSync('data2.js', 'Object.assign(window.CITY,' + json + ');');
console.log('data2.js size:', (json.length / 1024).toFixed(0), 'KB');
