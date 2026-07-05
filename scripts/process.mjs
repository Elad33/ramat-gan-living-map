// Process raw Overpass JSON into a compact embedded-data JS file for the map.
// Units: decimeters (0.1 m) relative to city center. Rings/lines delta-encoded.
import fs from 'fs';

const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const boundary = read('boundary.json');
const roads = read('roads.json');
const green = fs.existsSync('green.json') && fs.statSync('green.json').size > 2000 ? read('green.json') : { elements: [] };
const addr = read('addr.json');
const poi = read('poi.json');
const buildings = { elements: [] };
for (const f of ['bld0.json', 'bld1.json', 'bld2.json', 'bld3.json']) {
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) buildings.elements.push(...read(f).elements);
}
const bldrel = fs.existsSync('bldrel.json') && fs.statSync('bldrel.json').size > 500 ? read('bldrel.json') : { elements: [] };

// ---- projection ----
const rel = boundary.elements.find(e => e.type === 'relation');
let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
for (const m of rel.members) {
  if (m.type !== 'way' || !m.geometry) continue;
  for (const g of m.geometry) {
    minLat = Math.min(minLat, g.lat); maxLat = Math.max(maxLat, g.lat);
    minLon = Math.min(minLon, g.lon); maxLon = Math.max(maxLon, g.lon);
  }
}
const lat0 = (minLat + maxLat) / 2, lon0 = (minLon + maxLon) / 2;
const kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540; // m/deg
const PX = (lon) => Math.round((lon - lon0) * kx * 10); // dm
const PY = (lat) => Math.round((lat - lat0) * ky * 10);
console.log('center:', lat0.toFixed(6), lon0.toFixed(6), 'extent m:', ((maxLon-minLon)*kx).toFixed(0), 'x', ((maxLat-minLat)*ky).toFixed(0));

const delta = (pts) => { // pts: [[x,y],...] -> [x0,y0,dx1,dy1,...]
  const out = [pts[0][0], pts[0][1]];
  for (let i = 1; i < pts.length; i++) out.push(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
  return out;
};
const projGeom = (geom) => geom.map(g => [PX(g.lon), PY(g.lat)]);
const dedupe = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i-1][0] || p[1] !== pts[i-1][1]);

// ---- boundary rings (outer) ----
// stitch member ways into rings
const outers = rel.members.filter(m => m.type === 'way' && m.role === 'outer' && m.geometry);
const segs = outers.map(m => projGeom(m.geometry));
const rings = [];
while (segs.length) {
  let ring = segs.shift();
  let closed = false, guard = 0;
  while (!closed && guard++ < 500) {
    const end = ring[ring.length - 1];
    if (end[0] === ring[0][0] && end[1] === ring[0][1]) { closed = true; break; }
    let found = -1, rev = false;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s[0][0] === end[0] && s[0][1] === end[1]) { found = i; rev = false; break; }
      const e2 = s[s.length - 1];
      if (e2[0] === end[0] && e2[1] === end[1]) { found = i; rev = true; break; }
    }
    if (found < 0) break;
    let s = segs.splice(found, 1)[0];
    if (rev) s = s.reverse();
    ring = ring.concat(s.slice(1));
  }
  if (ring.length > 3) rings.push(dedupe(ring));
}
console.log('boundary rings:', rings.map(r => r.length).join(','));

// point-in-polygon (ray casting) against boundary rings — buildings were fetched by bbox
const inCity = (x, y) => {
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
};

// ---- buildings ----
// height: prefer height tag, then levels*3.1+1.5, else type default + hash variation
const hash = (id) => { let h = id >>> 0; h = ((h >> 16) ^ h) * 0x45d9f3b; h = ((h >> 16) ^ h) * 0x45d9f3b; return ((h >> 16) ^ h) >>> 0; };
const typeDefault = (t) => {
  if (/^(house|detached|semidetached_house|bungalow|hut|shed|garage|garages|carport|kiosk|service)$/.test(t)) return 45;
  if (/^(apartments|residential|dormitory)$/.test(t)) return 125;
  if (/^(commercial|office|retail|hotel)$/.test(t)) return 160;
  if (/^(industrial|warehouse|hangar)$/.test(t)) return 80;
  if (/^(school|kindergarten|college|university|hospital|civic|public|synagogue|religious)$/.test(t)) return 70;
  return 95; // dm
};
const parseH = (s) => { const v = parseFloat(String(s).replace(',', '.')); return isFinite(v) ? v : null; };
const bld = [];      // [h_dm, x0,y0,dx,dy,...]
const bldNames = []; // [idx, name]
let skipped = 0;
const seenWays = new Set();
const addBuilding = (el, ring) => {
  const t = el.tags || {};
  let hM = parseH(t.height);
  if (hM == null && t['building:levels']) {
    const lv = parseH(t['building:levels']);
    if (lv != null) hM = lv * 3.1 + 1.6;
  }
  let hdm;
  if (hM != null) hdm = Math.round(hM * 10);
  else {
    const base = typeDefault(t.building || 'yes');
    hdm = base + (hash(el.id) % 41) - 20; // ±2m deterministic variation
  }
  hdm = Math.max(25, Math.min(2600, hdm));
  let pts = dedupe(projGeom(ring));
  // drop closing duplicate point
  if (pts.length > 1 && pts[0][0] === pts[pts.length-1][0] && pts[0][1] === pts[pts.length-1][1]) pts = pts.slice(0, -1);
  if (pts.length < 3) { skipped++; return; }
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  if (!inCity(cx / pts.length, cy / pts.length)) { skipped++; return; }
  bld.push([hdm, ...delta(pts)]);
  const name = t['name:he'] || t.name;
  if (name && !/^\d+$/.test(name)) bldNames.push([bld.length - 1, name]);
};
for (const el of buildings.elements) {
  if (el.type !== 'way' || !el.geometry || seenWays.has(el.id)) continue;
  seenWays.add(el.id);
  addBuilding(el, el.geometry);
}
// multipolygon relations: outer rings only (holes rare, cost > value)
for (const el of bldrel.elements) {
  if (el.type !== 'relation' || !el.members) continue;
  for (const m of el.members) {
    if (m.type === 'way' && m.role === 'outer' && m.geometry && !seenWays.has(m.ref)) {
      addBuilding({ id: m.ref, tags: el.tags }, m.geometry);
    }
  }
}
console.log('buildings:', bld.length, 'named:', bldNames.length, 'skipped:', skipped);

// ---- roads ----
const CLS = { trunk:0, trunk_link:0, motorway_link:0, primary:0, primary_link:0,
  secondary:1, secondary_link:1, tertiary:2, tertiary_link:2,
  residential:3, living_street:3, unclassified:3, road:3,
  service:4, pedestrian:5, footway:6, path:6, cycleway:6, track:6, steps:7 };
const rd = [];       // [cls, x0,y0,dx,dy,...]
const rdNames = [];  // [idx, name]
for (const el of roads.elements) {
  const t = el.tags || {};
  const c = CLS[t.highway];
  if (c === undefined || !el.geometry || el.geometry.length < 2) continue;
  if (t.tunnel === 'yes') continue;
  const pts = dedupe(projGeom(el.geometry));
  if (pts.length < 2) continue;
  rd.push([c, ...delta(pts)]);
  const name = t['name:he'] || t.name;
  if (name && c <= 5) rdNames.push([rd.length - 1, name]);
}
console.log('roads:', rd.length, 'named:', rdNames.length);

// ---- green / water ----
const GK = (t) => {
  if (t.natural === 'water' || t.waterway) return 1;
  if (/^(pitch|sports_centre|stadium|playground)$/.test(t.leisure || '')) return 2;
  if (t.landuse === 'cemetery') return 3;
  return 0; // park/grass/wood
};
const grn = [];
for (const el of green.elements) {
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;
  let pts = dedupe(projGeom(el.geometry));
  if (pts.length > 1 && pts[0][0] === pts[pts.length-1][0] && pts[0][1] === pts[pts.length-1][1]) pts = pts.slice(0, -1);
  if (pts.length < 3) continue;
  grn.push([GK(el.tags || {}), ...delta(pts)]);
}
console.log('green:', grn.length);

// ---- addresses ----
// { street: [[num_str, x, y], ...] }
const addrMap = {};
const seenAddr = new Set();
for (const el of addr.elements) {
  const t = el.tags || {};
  const st = t['addr:street'], num = t['addr:housenumber'];
  if (!st || !num) continue;
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null) continue;
  const key = st + '|' + num;
  if (seenAddr.has(key)) continue;
  seenAddr.add(key);
  (addrMap[st] ||= []).push([num, PX(lon), PY(lat)]);
}
let addrCount = 0; for (const k in addrMap) addrCount += addrMap[k].length;
console.log('addresses:', addrCount, 'streets with addresses:', Object.keys(addrMap).length);

// ---- POIs & neighborhoods ----
const PK = (t) => {
  if (t.tourism === 'museum' || t.amenity === 'arts_centre') return ['museum', 'מוזיאון'];
  if (t.tourism === 'zoo' || t.tourism === 'theme_park') return ['zoo', 'אטרקציה'];
  if (t.tourism === 'attraction') return ['attraction', 'אטרקציה'];
  if (t.amenity === 'theatre' || t.amenity === 'cinema') return ['culture', 'תרבות'];
  if (t.amenity === 'library') return ['library', 'ספרייה'];
  if (t.amenity === 'community_centre') return ['community', 'מרכז קהילתי'];
  if (t.amenity === 'university' || t.amenity === 'college') return ['edu', 'השכלה'];
  if (t.amenity === 'hospital') return ['hospital', 'בית חולים'];
  if (t.amenity === 'townhall') return ['city', 'עירייה'];
  if (t.leisure === 'stadium' || t.leisure === 'sports_centre') return ['sport', 'ספורט'];
  if (t.leisure === 'park') return ['park', 'פארק'];
  return null;
};
const pois = [];  // [kind, label, name, x, y]
const hoods = []; // [name, x, y]
for (const el of poi.elements) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null) continue;
  const name = t['name:he'] || t.name;
  if (!name) continue;
  if (t.place) { hoods.push([name, PX(lon), PY(lat)]); continue; }
  const k = PK(t);
  if (!k) continue;
  pois.push([k[0], k[1], name, PX(lon), PY(lat)]);
}
// drop tiny unnamed parks duplicated with green polys is fine; cap park POIs to notable (name length heuristic none) — keep all
console.log('pois:', pois.length, 'hoods:', hoods.length);

// ---- street name list for search (union of road names + addr street names) ----
const streetSet = new Set(Object.keys(addrMap));
for (const [, n] of rdNames) streetSet.add(n);
console.log('unique street names:', streetSet.size);

const data = {
  meta: { name: 'רמת גן', lat0: +lat0.toFixed(7), lon0: +lon0.toFixed(7), unit: 0.1 },
  boundary: rings.map(r => delta(r)),
  bld, bldNames, rd, rdNames, grn,
  addr: addrMap, pois, hoods,
};
const json = JSON.stringify(data);
fs.writeFileSync('data.js', 'window.CITY=' + json + ';');
console.log('data.js size:', (json.length / 1048576).toFixed(2), 'MB');
