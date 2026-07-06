// Pull the official events feed from the Ramat Gan municipality site,
// geocode venues against our own address/POI index, and write data/muni-events.json.
// Run from repo root: node scripts/fetch-muni-events.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api-m.ramat-gan.muni.il/api/EventLobby/he/event-lobby';
const SITE = 'https://www.ramat-gan.muni.il';
const UA = 'ramat-gan-living-map/1.0 (+https://github.com/Elad33/ramat-gan-living-map)';

// ---------- geocoder over our processed city data ----------
const CITY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'data.js'), 'utf8')
  .replace(/^window\.CITY=/, '').replace(/;$/, ''));
const U = CITY.meta.unit; // dm -> m
const norm = s => String(s || '').replace(/["'`’׳״]/g, '').replace(/[־–\-]/g, ' ')
  .replace(/\s+/g, ' ').trim();
const stripHe = s => s.startsWith('ה') ? s.slice(1) : s;
const streets = new Map(); // norm name -> [[numStr,x,y],...]
for (const [name, list] of Object.entries(CITY.addr))
  streets.set(norm(name), list.map(([n, x, y]) => [String(n), x * U, y * U]));
const pois = CITY.pois.map(p => ({ n: norm(p[2]), x: p[3] * U, y: p[4] * U }));
for (const h of CITY.hoods) pois.push({ n: norm(h[0]), x: h[1] * U, y: h[2] * U, weak: true });
const numVal = s => parseInt(String(s).match(/\d+/)?.[0] ?? 'NaN', 10);
// road-name centroids for streets that have no address points
const roadCent = new Map();
for (const [idx, name] of CITY.rdNames) {
  const rec = CITY.rd[idx];
  let x = rec[1], y = rec[2], sx = x, sy = y, n = (rec.length - 1) / 2;
  for (let i = 1; i < n; i++) { x += rec[1 + 2 * i]; y += rec[2 + 2 * i]; sx += x; sy += y; }
  const k = norm(name);
  const cur = roadCent.get(k) || { sx: 0, sy: 0, n: 0 };
  cur.sx += (sx / n) * U; cur.sy += (sy / n) * U; cur.n++;
  roadCent.set(k, cur);
}

// canonical form: drop street prefixes, sort words, collapse yud spelling variants
const canon = s => norm(s).replace(/^(רחוב|שדרות|דרך|שד)\s+/, '')
  .split(' ').map(w => w.replace(/י+/g, 'י')).sort().join(' ').replace(/י/g, '');
const streetsCanon = new Map();
for (const [k, v] of streets) streetsCanon.set(canon(k), v);
const roadCanon = new Map();
for (const [k, c] of roadCent) roadCanon.set(canon(k), c);

function findStreet(q) {
  q = norm(q).replace(/^(רחוב|שדרות|דרך)\s+/, '');
  if (streets.has(q)) return streets.get(q);
  const qh = stripHe(q);
  for (const [k, v] of streets) if (k === qh || stripHe(k) === q || stripHe(k) === qh) return v;
  const qc = canon(q);
  if (streetsCanon.has(qc)) return streetsCanon.get(qc);
  for (const [k, v] of streets) if (k.includes(q) || q.includes(k)) return v;
  return null;
}
function findRoadCentroid(q) {
  q = norm(q).replace(/^(רחוב|שדרות|דרך)\s+/, '');
  const qh = stripHe(q), qc = canon(q);
  for (const [k, c] of roadCent)
    if (k === q || k === qh || stripHe(k) === q)
      return { x: c.sx / c.n, y: c.sy / c.n, approx: true };
  const c = roadCanon.get(qc);
  return c ? { x: c.sx / c.n, y: c.sy / c.n, approx: true } : null;
}
function geocodeAddress(addr) {
  if (!addr) return null;
  const m = norm(addr).match(/^(.*?)[\s,]+(\d+)\s*[א-ת]?(?:\s|,|$)/);
  const streetName = m ? m[1] : norm(addr);
  const num = m ? +m[2] : null;
  const list = findStreet(streetName);
  if (!list || !list.length) return findRoadCentroid(streetName);
  if (num != null) {
    const exact = list.find(a => numVal(a[0]) === num);
    if (exact) return { x: exact[1], y: exact[2], approx: false };
    const sorted = list.map(a => ({ v: numVal(a[0]), x: a[1], y: a[2] }))
      .filter(a => isFinite(a.v)).sort((a, b) => a.v - b.v);
    if (sorted.length >= 2) {
      let lo = null, hi = null;
      for (const a of sorted) { if (a.v <= num) lo = a; if (a.v >= num && !hi) hi = a; }
      if (lo && hi && lo.v !== hi.v) {
        const t = (num - lo.v) / (hi.v - lo.v);
        return { x: lo.x + (hi.x - lo.x) * t, y: lo.y + (hi.y - lo.y) * t, approx: true };
      }
      const nearest = sorted.reduce((b, a) => Math.abs(a.v - num) < Math.abs(b.v - num) ? a : b);
      return { x: nearest.x, y: nearest.y, approx: true };
    }
    return { x: sorted[0]?.x ?? list[0][1], y: sorted[0]?.y ?? list[0][2], approx: true };
  }
  // street only — centroid
  let sx = 0, sy = 0;
  for (const a of list) { sx += a[1]; sy += a[2]; }
  return { x: sx / list.length, y: sy / list.length, approx: true };
}
const VENUE_STOPWORDS = new Set(['בית', 'מרכז', 'רחוב', 'תיאטרון', 'מועדון', 'ספריית', 'ספריה', 'הספריה', 'אולם', 'מתחם', 'גן', 'פארק', 'תרבות', 'קהילתי', 'עירוני', 'העירוני', 'שם', 'על']);
// venues the feed names differently than the map data (resolved from our own data at runtime)
const KNOWN_VENUES = { 'מייקרס': () => findRoadCentroid('משטרת מסובים'), 'בית קריניצי': () => findRoadCentroid('קריניצי') };
function geocodeVenueName(name) {
  const q = norm(name);
  if (!q || q.length < 3) return null;
  for (const [k, fn] of Object.entries(KNOWN_VENUES))
    if (q.includes(k)) { const c = fn(); if (c) return c; }
  const qh = stripHe(q);
  let best = null;
  for (const p of pois) {
    if (p.n === q || p.n === qh) return { x: p.x, y: p.y, approx: false };
    if ((p.n.includes(q) || q.includes(p.n)) && p.n.length > 4) best = best || { x: p.x, y: p.y, approx: true };
  }
  if (best) return best;
  // shared distinctive word (e.g. "תיאטרון ראסל" ↔ "בית ראסל")
  const words = q.split(' ').filter(w => w.length >= 4 && !VENUE_STOPWORDS.has(w));
  for (const p of pois) {
    if (p.weak) continue;
    const pw = p.n.split(' ');
    if (words.some(w => pw.includes(w))) return { x: p.x, y: p.y, approx: true };
  }
  return null;
}

// ---------- category mapping (map pin color + scene animation) ----------
function mapCat(muniCat, title) {
  const s = (muniCat || '') + ' ' + (title || '');
  if (/ספורט|ריצה|מרוץ|צעדה|אופניים|יוגה|התעמלות/.test(s)) return ['sport', 'sport'];
  if (/תיאטרון|מוזיקה|הופע|קונצרט|מחול|אמנות|סרט|קולנוע|הצגה/.test(s)) return ['culture', 'concert'];
  if (/יריד|שוק|פסטיבל/.test(s)) return ['city', 'market'];
  if (/סיור|טיול|מורשת/.test(s)) return ['poi', 'landmark'];
  return ['community', 'community'];
}

// ---------- fetch & normalize ----------
async function main() {
  const r = await fetch(API, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('API HTTP ' + r.status);
  const data = await r.json();
  const raw = [];
  const seen = new Set();
  const featured = new Set((data.content.sliderEvents || []).map(e => e.detailsLink?.url).filter(Boolean));
  for (const e of [...(data.content.sliderEvents || []), ...(data.content.closeEvents || [])]) {
    const key = e.detailsLink?.url || e.title + '|' + e.date;
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push(e);
  }
  const today = new Date().toISOString().slice(0, 10);
  const events = [];
  let located = 0;
  for (const e of raw) {
    const date = (e.date || '').slice(0, 10);
    if (!date || date < today) continue;
    let time = /T(\d{2}:\d{2})/.exec(e.hour || '')?.[1] || '';
    if (time === '00:00') time = ''; // midnight = no published time
    const locName = e.eventLocation?.name || e.location || '';
    const address = e.eventLocation?.address || '';
    const geo = geocodeAddress(address) || geocodeVenueName(locName) || geocodeVenueName(e.location);
    const [cat, anim] = mapCat(e.category?.name, e.title);
    if (geo) located++;
    events.push({
      id: 'muni-' + (e.detailsLink?.url || key(e)).replace(/[^a-z0-9-]/gi, '').slice(-60),
      title: (e.title || '').trim().slice(0, 90),
      cat, anim,
      muniCat: e.category?.name || '',
      audience: (e.audienceType || []).map(a => a.name).slice(0, 3),
      date, time,
      locName: locName.slice(0, 60),
      address: address.slice(0, 60),
      x: geo ? Math.round(geo.x * 10) / 10 : null,
      y: geo ? Math.round(geo.y * 10) / 10 : null,
      approx: geo ? !!geo.approx : undefined,
      link: e.detailsLink?.url ? SITE + e.detailsLink.url : SITE + '/event-lobby',
      img: e.linkMobilePreview ? SITE + e.linkMobilePreview : null,
      featured: featured.has(e.detailsLink?.url),
      free: e.priceType === 1 || undefined,
    });
  }
  events.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
  const out = { updated: new Date().toISOString(), source: SITE + '/event-lobby', events };
  const file = path.join(ROOT, 'data', 'muni-events.json');
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const next = JSON.stringify(out, null, 1);
  // avoid churn commits when only the timestamp moved
  const strip = s => s.replace(/"updated":[^,]+,/, '');
  if (strip(prev) === strip(next)) {
    console.log('muni events unchanged (' + events.length + ' events)');
    return;
  }
  fs.writeFileSync(file, next);
  console.log('muni-events.json written:', events.length, 'events,', located, 'geocoded,',
    events.filter(e => e.featured).length, 'featured');
}
function key(e) { return (e.title || '') + '|' + (e.date || ''); }
await main();
