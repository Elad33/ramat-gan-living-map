/* ============================================================
   Part 3 — themes, overlay labels, search, events, boot
   ============================================================ */

// ---------- theme palettes ----------
const THEMES = {
  dark: {
    css: '#070b16',
    sky0: [0.014, 0.022, 0.048], sky1: [0.06, 0.085, 0.15],
    ground0: [0.05, 0.07, 0.128], ground1: [0.028, 0.04, 0.078],
    fog: [0.05, 0.07, 0.128], fogD: 10500, fogAmt: 0.6,
    bldBase: [0.095, 0.13, 0.225], bldTop: [0.29, 0.36, 0.53],
    win: [1.0, 0.77, 0.40], night: 1,
    flat: {
      park: [0.052, 0.148, 0.112, 0.92], cemetery: [0.058, 0.115, 0.098, 0.85],
      pitch: [0.06, 0.165, 0.14, 0.8], water: [0.055, 0.135, 0.23, 0.95],
      bndWide: [0.89, 0.76, 0.49, 0.055], bndLine: [0.89, 0.76, 0.49, 0.5],
      road0: [0.70, 0.575, 0.355, 0.95], road1: [0.47, 0.425, 0.335, 0.92],
      road2: [0.335, 0.345, 0.42, 0.92], road3: [0.225, 0.255, 0.345, 0.88],
      road4: [0.165, 0.195, 0.275, 0.8], road5: [0.16, 0.19, 0.27, 0.72],
      road6: [0.135, 0.165, 0.235, 0.55], road7: [0.15, 0.18, 0.25, 0.6],
      planA: [0.66, 0.50, 0.92, 0.16], planALine: [0.76, 0.62, 0.98, 0.75],
      planP: [0.22, 0.72, 0.66, 0.14], planPLine: [0.30, 0.82, 0.75, 0.7],
      planR: [0.93, 0.52, 0.34, 0.18], planRLine: [0.97, 0.60, 0.42, 0.8],
      rail: [0.88, 0.34, 0.30, 0.95], railTunnel: [0.88, 0.34, 0.30, 0.34],
    },
    dust: [0.8, 0.62, 0.30], dustAmt: 0.55,
    bloomThresh: 0.36, bloomK: 0.8, vig: 0.34,
  },
  light: {
    css: '#e9ecef',
    sky0: [0.845, 0.878, 0.905], sky1: [0.925, 0.94, 0.952],
    ground0: [0.898, 0.909, 0.919], ground1: [0.838, 0.855, 0.872],
    fog: [0.895, 0.915, 0.933], fogD: 11500, fogAmt: 0.55,
    bldBase: [0.735, 0.725, 0.70], bldTop: [0.985, 0.978, 0.962],
    win: [1.0, 0.9, 0.6], night: 0,
    flat: {
      park: [0.695, 0.83, 0.695, 1], cemetery: [0.73, 0.81, 0.73, 1],
      pitch: [0.63, 0.80, 0.71, 1], water: [0.655, 0.79, 0.878, 1],
      bndWide: [0.66, 0.53, 0.24, 0.07], bndLine: [0.66, 0.53, 0.24, 0.42],
      road0: [1.0, 0.99, 0.965, 1], road1: [0.985, 0.975, 0.945, 1],
      road2: [0.965, 0.955, 0.93, 1], road3: [0.945, 0.938, 0.918, 1],
      road4: [0.915, 0.91, 0.895, 0.95], road5: [0.90, 0.90, 0.885, 0.9],
      road6: [0.875, 0.875, 0.862, 0.8], road7: [0.885, 0.882, 0.868, 0.85],
      planA: [0.48, 0.34, 0.78, 0.15], planALine: [0.44, 0.30, 0.74, 0.8],
      planP: [0.10, 0.52, 0.47, 0.13], planPLine: [0.08, 0.55, 0.49, 0.75],
      planR: [0.80, 0.35, 0.18, 0.16], planRLine: [0.74, 0.30, 0.14, 0.85],
      rail: [0.78, 0.22, 0.19, 0.95], railTunnel: [0.78, 0.22, 0.19, 0.3],
    },
    dust: [1, 1, 1], dustAmt: 0,
    bloomThresh: 0.78, bloomK: 0.22, vig: 0.15,
  },
};
let themeName = null;
function applyTheme(name, persist) {
  themeName = name;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== (name === 'light' ? 'light' : 'dark'))
    root.setAttribute('data-theme', name === 'light' ? 'light' : 'dark');
  MAP.setPalette(THEMES[name]);
  $('icMoon').style.display = name === 'light' ? '' : 'none';
  $('icSun').style.display = name === 'light' ? 'none' : '';
  if (persist) store.setItem('rg.theme', name);
}
// host theme toggle sync (artifact viewer stamps data-theme on root)
new MutationObserver(() => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t && t !== themeName && THEMES[t]) applyTheme(t, false);
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- toast ----------
let toastT = 0;
function showToast(html) {
  const el = $('toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---------- overlay: labels, markers, highlight ring ----------
const M2 = v => v * UNIT; // dm int -> meters
const labelsRoot = $('labels');
const markersRoot = $('markers');
let vpVersion = 0;
window.addEventListener('mapmove', () => { vpVersion++; });

const hoodEls = CITY_D.hoods.map(h => {
  const el = document.createElement('div');
  el.className = 'lbl lbl-hood';
  el.textContent = h[0];
  el.style.display = 'none';
  labelsRoot.appendChild(el);
  return { el, x: M2(h[1]), y: M2(h[2]) };
});

const POI_MAJOR = new Set(['museum', 'zoo', 'city', 'sport', 'hospital', 'edu', 'attraction', 'culture']);
const poiEls = CITY_D.pois.map(p => {
  const el = document.createElement('div');
  el.className = 'lbl lbl-poi';
  el.innerHTML = '<span class="dot"></span><span></span>';
  el.lastChild.textContent = p[2];
  el.style.display = 'none';
  labelsRoot.appendChild(el);
  const rec = { el, kind: p[0], label: p[1], name: p[2], x: M2(p[3]), y: M2(p[4]) };
  el.addEventListener('click', () => {
    MAP.flyTo({ cx: rec.x, cy: rec.y, dist: 520 });
    setRing(rec.x, rec.y);
    showToast('<b>' + rec.name + '</b> · ' + rec.label);
  });
  return rec;
});

// street label pool
const STREET_POOL = 46;
const streetPool = [];
for (let i = 0; i < STREET_POOL; i++) {
  const el = document.createElement('div');
  el.className = 'lbl lbl-street';
  el.style.display = 'none';
  labelsRoot.appendChild(el);
  streetPool.push(el);
}
// precompute named road midpoints + directions
const namedRoads = CITY_D.rdNames.map(([idx, name]) => {
  const pts = MAP.roadPts[idx];
  const n = pts.length / 2;
  const mi = Math.floor(n / 2);
  const a = Math.max(0, mi - 1), b = Math.min(n - 1, mi);
  const mx = (pts[2 * a] + pts[2 * b]) / 2, my = (pts[2 * a + 1] + pts[2 * b + 1]) / 2;
  let dx = pts[2 * b] - pts[2 * a], dy = pts[2 * b + 1] - pts[2 * a + 1];
  const l = Math.hypot(dx, dy) || 1;
  return { name, cls: CITY_D.rd[idx][0], x: mx, y: my, dx: dx / l, dy: dy / l };
}).sort((a, b) => a.cls - b.cls);

// highlight ring
let ringPt = null, ringUntil = 0;
function setRing(x, y) { ringPt = [x, y]; ringUntil = nowMs() + 7000; }

// ---------- transit overlay (rail stations + bus stops) ----------
const railStopEls = (CITY_D.railStops || []).map(s => {
  const el = document.createElement('div');
  el.className = 'lbl lbl-rail';
  el.innerHTML = '<span class="rs"></span><span></span>';
  el.lastChild.textContent = s[0];
  el.style.display = 'none';
  labelsRoot.appendChild(el);
  return { el, name: s[0], x: M2(s[1]), y: M2(s[2]) };
});
const BUS_SIGN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect x="1" y="1" width="22" height="22" rx="6.5" fill="#2b8fd6" stroke="rgba(255,255,255,.85)" stroke-width="1.6"/>' +
  '<path d="M7 6.2h10c.9 0 1.5.6 1.5 1.5v7.1c0 .7-.4 1.2-1 1.4v1.3a.9.9 0 0 1-1.8 0v-1.1H8.3v1.1a.9.9 0 0 1-1.8 0v-1.3c-.6-.2-1-.7-1-1.4V7.7c0-.9.6-1.5 1.5-1.5Z" fill="#fff"/>' +
  '<rect x="6.6" y="8" width="10.8" height="4" rx=".8" fill="#2b8fd6"/>' +
  '<circle cx="8.6" cy="14.4" r="1.05" fill="#2b8fd6"/><circle cx="15.4" cy="14.4" r="1.05" fill="#2b8fd6"/></svg>';
const BUS_POOL = 90;
const busPool = [];
for (let i = 0; i < BUS_POOL; i++) {
  const el = document.createElement('div');
  el.className = 'lbl lbl-bus';
  el.innerHTML = BUS_SIGN_SVG;
  el.style.display = 'none';
  el.addEventListener('click', e => {
    e.stopPropagation();
    const s = busPool[i].__stop;
    if (s) showBusPop(s);
  });
  labelsRoot.appendChild(el);
  busPool.push(el);
}
const busStops = (CITY_D.busStops || []).map(s => ({ name: s[0], code: s[1], x: M2(s[2]), y: M2(s[3]) }));
function positionTransit() {
  const on = MAP.LAYERS.transit;
  const d = MAP.cam.dist;
  for (const s of railStopEls) {
    if (!on || d > 8000) { s.el.style.display = 'none'; continue; }
    const [sx, sy, vis] = MAP.project(s.x, s.y, 0);
    if (!vis || sy < 96) { s.el.style.display = 'none'; continue; }
    s.el.style.display = '';
    s.el.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0) translate(-50%,-50%)';
  }
  let used = 0;
  if (on && d < 1500) {
    const sc = d < 500 ? 1 : d < 900 ? 0.85 : 0.7;
    for (const s of busStops) {
      if (used >= BUS_POOL) break;
      const [sx, sy, vis] = MAP.project(s.x, s.y, 0);
      if (!vis || sx < -14 || sx > innerWidth + 14 || sy < 96 || sy > innerHeight + 14) continue;
      const el = busPool[used++];
      el.__stop = s;
      el.style.display = '';
      el.title = 'תחנת אוטובוס' + (s.name ? ' · ' + s.name : '') + (s.code ? ' (' + s.code + ')' : '') + ' — לחצו לזמני הגעה';
      el.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0) translate(-50%,-50%) scale(' + sc + ')';
    }
  }
  for (let i = used; i < BUS_POOL; i++) { busPool[i].style.display = 'none'; busPool[i].__stop = null; }
}

// ---------- real-time bus arrivals ----------
const BUS_API_LOCAL = '/api/bus?stop=';
const BUS_API_REMOTE = 'https://ramat-gan-living-map.vercel.app/api/bus?stop=';
const OPERATORS = { 2: 'רכבת ישראל', 3: 'אגד', 5: 'דן', 6: 'דן בדרום', 7: 'דן באר שבע', 15: 'מטרופולין', 16: 'סופרבוס', 18: 'קווים', 25: 'אלקטרה אפיקים', 34: 'תנופה' };
let busTimer = 0, busPopStop = null;
async function fetchArrivals(code) {
  const urls = location.protocol === 'https:' && !location.hostname.includes('claude')
    ? [BUS_API_LOCAL + code, BUS_API_REMOTE + code] : [BUS_API_REMOTE + code];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) continue;
      const data = await r.json();
      if (data && data.ok) return data;
    } catch (e) {}
  }
  return null;
}
function busRowsHtml(data) {
  const now = Date.now();
  const rows = (data.arrivals || [])
    .map(a => ({ ...a, t: new Date(a.eta.replace(' ', 'T')).getTime() }))
    .filter(a => isFinite(a.t) && a.t > now - 60000)
    .sort((a, b) => a.t - b.t)
    .slice(0, 9);
  if (!rows.length) return '<div class="bus-wait">אין הגעות צפויות כרגע בתחנה זו.</div>';
  return '<div class="bus-list">' + rows.map(a => {
    const mins = Math.max(0, Math.round((a.t - now) / 60000));
    const clock = new Date(a.t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return '<div class="bus-row"><span class="bus-line">' + escapeHtml(a.line || '?') + '</span>' +
      '<span class="bus-op">' + (OPERATORS[a.operator] || '') + '</span>' +
      '<span class="bus-eta">' + (mins <= 0 ? 'עכשיו' : mins + ' דק׳') + '<small>' + clock + '</small></span></div>';
  }).join('') + '</div>';
}
async function refreshBusPop() {
  if (!busPopStop) return;
  const body = $('busBody');
  if (!body) return;
  const data = await fetchArrivals(busPopStop.code);
  if (!busPopStop || !$('busBody')) return; // closed meanwhile
  if (!data) {
    $('busBody').innerHTML = '<div class="bus-wait">נתוני הזמן האמת אינם זמינים כרגע.<br/>נסו שוב בעוד רגע, או בקרו באתר החי של המפה.</div>';
    return;
  }
  const day = new Date().getDay(); // 5=שישי 6=שבת
  const wk = (day === 5 || day === 6) ? '<span class="wk-chip">סופ״ש — כולל את קווי הסבבוס ורשת «נעים בסופ״ש»</span>' : '';
  $('busBody').innerHTML = busRowsHtml(data) + wk +
    '<div class="bus-note">מתעדכן כל 30 שניות · זמן אמת (SIRI) · משרד התחבורה</div>';
}
function showBusPop(stop) {
  closePop();
  busPopStop = stop;
  popFor = null;
  popAnchor = { x: stop.x, y: stop.y, lift: 20 };
  const pop = $('pop');
  pop.innerHTML =
    '<div class="bus-head"><span class="bus-sign">' + BUS_SIGN_SVG + '</span>' +
    '<div><div class="nm">' + escapeHtml(stop.name || 'תחנת אוטובוס') + '</div>' +
    '<div class="cd">תחנה ' + (stop.code || '—') + '</div></div></div>' +
    '<div id="busBody"><div class="bus-wait"><span class="spin"></span>טוען זמני הגעה…</div></div>' +
    '<div class="acts"><button class="pop-act" data-act="close">סגירה</button></div>';
  pop.classList.add('open');
  placePop();
  refreshBusPop();
  clearInterval(busTimer);
  busTimer = setInterval(refreshBusPop, 30000);
}

// collision grid for label layout
function makeGrid() {
  const cells = new Set();
  return {
    tryPlace(x, y, w, h) {
      const c0x = Math.floor((x - w / 2) / 85), c1x = Math.floor((x + w / 2) / 85);
      const c0y = Math.floor((y - h / 2) / 42), c1y = Math.floor((y + h / 2) / 42);
      for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++)
        if (cells.has(cx + ':' + cy)) return false;
      for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++)
        cells.add(cx + ':' + cy);
      return true;
    }
  };
}

let lastLayoutV = -1, lastLayoutT = 0;
function overlayTick(animating, force) {
  const t = nowMs();
  if (vpVersion === lastLayoutV && !force) { updateRing(t); return; }
  // markers reposition every frame while moving; full label re-layout throttled
  positionMarkers();
  updateRing(t);
  if (t - lastLayoutT < 90 && !force) { return; }
  lastLayoutT = t; lastLayoutV = vpVersion;
  layoutLabels();
  // compass + tilt button state
  $('compassN').style.transform = 'rotate(' + (-MAP.cam.bearing * 180 / Math.PI) + 'deg)';
  $('tiltTxt').textContent = MAP.cam.tilt > 0.22 ? '2D' : '3D';
}
function layoutLabels() {
  const d = MAP.cam.dist;
  const grid = makeGrid();
  const topBand = 96; // keep labels out of the brand/search strip
  const inUI = sy => sy < topBand;
  // neighborhoods
  const hoodVis = d > 1250 && d < 9500;
  const hoodOp = hoodVis ? Math.min(1, (d - 1250) / 500, (9500 - d) / 1800) : 0;
  for (const h of hoodEls) {
    if (!hoodVis) { h.el.style.display = 'none'; continue; }
    const [sx, sy, vis] = MAP.project(h.x, h.y, 0);
    if (!vis || inUI(sy) || !grid.tryPlace(sx, sy, h.el.offsetWidth || 130, 26)) { h.el.style.display = 'none'; continue; }
    h.el.style.display = '';
    h.el.style.opacity = hoodOp * 0.95;
    h.el.style.transform = 'translate3d(' + (sx) + 'px,' + (sy) + 'px,0) translate(-50%,-50%)';
  }
  // POIs
  for (const p of poiEls) {
    const show = d < 2800 && (POI_MAJOR.has(p.kind) || d < 950);
    if (!show) { p.el.style.display = 'none'; continue; }
    const [sx, sy, vis] = MAP.project(p.x, p.y, 0);
    if (!vis || inUI(sy) || !grid.tryPlace(sx, sy, p.name.length * 7 + 26, 24)) { p.el.style.display = 'none'; continue; }
    p.el.style.display = '';
    p.el.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0) translate(-50%,-50%)';
  }
  // street names
  let used = 0;
  if (d < 1150) {
    const seen = new Set();
    for (const r of namedRoads) {
      if (used >= STREET_POOL) break;
      const [sx, sy, vis] = MAP.project(r.x, r.y, 0);
      if (!vis || inUI(sy) || sx < -40 || sx > innerWidth + 40 || sy < -20 || sy > innerHeight + 20) continue;
      const dupKey = r.name + '|' + Math.round(sx / 420) + '|' + Math.round(sy / 420);
      if (seen.has(dupKey)) continue;
      const w = r.name.length * 7.4 + 14;
      // screen-space angle of the road
      const [ax, ay] = MAP.project(r.x - r.dx * 30, r.y - r.dy * 30, 0);
      const [bx, by] = MAP.project(r.x + r.dx * 30, r.y + r.dy * 30, 0);
      let ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      if (!grid.tryPlace(sx, sy, Math.abs(w * Math.cos(ang * Math.PI / 180)) + 20, Math.abs(w * Math.sin(ang * Math.PI / 180)) + 18)) continue;
      seen.add(dupKey);
      const el = streetPool[used++];
      el.textContent = r.name;
      el.style.display = '';
      el.style.opacity = Math.min(1, (1150 - d) / 260);
      el.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0) translate(-50%,-50%) rotate(' + ang.toFixed(1) + 'deg)';
    }
  }
  for (let i = used; i < STREET_POOL; i++) streetPool[i].style.display = 'none';
}
function updateRing(t) {
  const ring = $('hiRing');
  if (!ringPt || t > ringUntil) { ring.style.display = 'none'; return; }
  const [sx, sy, vis] = MAP.project(ringPt[0], ringPt[1], 0);
  ring.style.display = vis ? '' : 'none';
  ring.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0)';
}

// ---------- search ----------
const norm = s => String(s).replace(/["'`’׳״]/g, '').replace(/[־–\-]/g, ' ').replace(/\s+/g, ' ').trim();
const stripHe = s => s.startsWith('ה') ? s.slice(1) : s;

// street entries: name -> {name, addrs:[[numStr,x,y]], cx, cy, ext}
const streetIndex = new Map();
function streetEntry(name) {
  const k = norm(name);
  if (!streetIndex.has(k)) streetIndex.set(k, { name, addrs: [], pts: [], cx: 0, cy: 0, ext: 400 });
  return streetIndex.get(k);
}
for (const [name, list] of Object.entries(CITY_D.addr)) {
  const e = streetEntry(name);
  for (const [num, x, y] of list) e.addrs.push([String(num), M2(x), M2(y)]);
}
for (const [idx, name] of CITY_D.rdNames) {
  const e = streetEntry(name);
  const pts = MAP.roadPts[idx];
  for (let i = 0; i < pts.length / 2; i += 2) e.pts.push([pts[2 * i], pts[2 * i + 1]]);
}
for (const e of streetIndex.values()) {
  const all = e.pts.length ? e.pts : e.addrs.map(a => [a[1], a[2]]);
  if (!all.length) continue;
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
  for (const [x, y] of all) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
  e.cx = (mnx + mxx) / 2; e.cy = (mny + mxy) / 2;
  e.ext = Math.max(220, Math.hypot(mxx - mnx, mxy - mny));
}

// flat searchable items
const searchItems = [];
for (const e of streetIndex.values()) searchItems.push({ type: 'street', name: e.name, entry: e });
for (const h of CITY_D.hoods) searchItems.push({ type: 'hood', name: h[0], x: M2(h[1]), y: M2(h[2]) });
for (const p of CITY_D.pois) searchItems.push({ type: 'poi', name: p[2], sub: p[1], x: M2(p[3]), y: M2(p[4]) });
{
  const cents = MAP.buildingCentroids();
  for (const [i, name] of CITY_D.bldNames) {
    const c = cents[i];
    if (c) searchItems.push({ type: 'bld', name, x: c[0], y: c[1] });
  }
}
for (const it of searchItems) { it.n = norm(it.name); it.nh = stripHe(it.n); }

function parseQuery(q) {
  q = norm(q).replace(/^רחוב\s+/, '').replace(/^שדרות\s+/, '');
  let num = null;
  let m = q.match(/^(.*?)[\s,]+(\d+\s*[א-ת]?)$/);
  if (m) { q = m[1]; num = m[2].replace(/\s/g, ''); }
  else { m = q.match(/^(\d+[א-ת]?)\s+(.+)$/); if (m) { num = m[1]; q = m[2]; } }
  return { text: q, num };
}
function scoreItem(n, nh, q, qh) {
  if (n === q || nh === qh) return 100;
  if (n.startsWith(q) || nh.startsWith(qh)) return 80;
  if (n.includes(' ' + q) || nh.includes(' ' + qh)) return 62;
  if (n.includes(q)) return 40;
  return 0;
}
const numVal = s => parseInt(String(s).match(/\d+/)?.[0] ?? 'NaN', 10);
function resolveAddress(entry, numStr) {
  // exact
  const exact = entry.addrs.find(a => a[0].replace(/\s/g, '') === numStr);
  if (exact) return { x: exact[1], y: exact[2], approx: false };
  const n = numVal(numStr);
  if (!isFinite(n) || entry.addrs.length === 0) return null;
  const withN = entry.addrs.map(a => ({ v: numVal(a[0]), x: a[1], y: a[2] })).filter(a => isFinite(a.v)).sort((a, b) => a.v - b.v);
  if (!withN.length) return null;
  // prefer same parity (odd/even sides of israeli streets)
  const parity = withN.filter(a => a.v % 2 === n % 2);
  const cand = parity.length >= 2 ? parity : withN;
  // bracketing pair
  let lo = null, hi = null;
  for (const a of cand) { if (a.v <= n && (!lo || a.v > lo.v)) lo = a; if (a.v >= n && (!hi || a.v < hi.v)) hi = a; }
  if (lo && hi && lo !== hi) {
    const t = (n - lo.v) / (hi.v - lo.v);
    return { x: lerp(lo.x, hi.x, t), y: lerp(lo.y, hi.y, t), approx: true };
  }
  // extrapolate from the two nearest
  if (cand.length >= 2) {
    const sorted = [...cand].sort((a, b) => Math.abs(a.v - n) - Math.abs(b.v - n));
    const a = sorted[0], b = sorted[1];
    if (a.v !== b.v) {
      const t = (n - a.v) / (b.v - a.v);
      const cap = 140 / Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)); // extend at most ~140m
      const tc = clamp(t, -cap, 1 + cap);
      return { x: lerp(a.x, b.x, tc), y: lerp(a.y, b.y, tc), approx: true };
    }
  }
  return { x: cand[0].x, y: cand[0].y, approx: true };
}

const TYPE_META = {
  addr: { group: 'כתובות', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>' },
  street: { group: 'רחובות', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 21 9 3M19 21 15 3M12 7v2.5M12 13v2.5M12 19v1"/></svg>' },
  hood: { group: 'שכונות', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 10 12 4l8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/></svg>' },
  poi: { group: 'מקומות', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.4 5.2L20 9l-4 4.1.9 5.9L12 16.6 7.1 19l.9-5.9L4 9l5.6-.8Z"/></svg>' },
  bld: { group: 'מבנים', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 21V5l6-2v18M12 21h6V9l-6-2M9 8h.01M9 12h.01M9 16h.01M15 12h.01M15 16h.01"/></svg>' },
};
function runSearch(qRaw) {
  const { text, num } = parseQuery(qRaw);
  if (!text && !num) return [];
  const q = text, qh = stripHe(text);
  const res = [];
  if (q) {
    for (const it of searchItems) {
      const s = scoreItem(it.n, it.nh, q, qh);
      if (s > 0) res.push({ ...it, score: s + (it.type === 'street' ? 6 : it.type === 'poi' ? 3 : 0) });
    }
  }
  res.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  const out = [];
  if (num) {
    for (const st of res.filter(r => r.type === 'street').slice(0, 4)) {
      const loc = resolveAddress(st.entry, num);
      if (loc) out.push({ type: 'addr', name: st.name + ' ' + num, sub: loc.approx ? 'כתובת · מיקום משוער' : 'כתובת', x: loc.x, y: loc.y, score: 120 + st.score });
    }
  }
  const capPer = { street: 5, poi: 5, hood: 3, bld: 4 };
  const counts = {};
  for (const r of res) {
    counts[r.type] = (counts[r.type] || 0) + 1;
    if (counts[r.type] <= capPer[r.type]) out.push(r);
    if (out.length > 22) break;
  }
  return out;
}
function goToResult(r) {
  let dist = 480;
  if (r.type === 'street') {
    dist = clamp(r.entry.ext * 1.35, 480, 3200);
    r.x = r.entry.cx; r.y = r.entry.cy;
  }
  else if (r.type === 'hood') dist = 1900;
  else if (r.type === 'poi') dist = 560;
  else if (r.type === 'addr') dist = 420;
  MAP.flyTo({ cx: r.x, cy: r.y, dist });
  if (r.type !== 'street' && r.type !== 'hood') setRing(r.x, r.y);
  showToast('<b>' + r.name + '</b>' + (r.sub ? ' · ' + r.sub : ''));
}

// search UI
const sInput = $('searchInput'), sResults = $('results'), sBox = $('searchBox');
let sItems = [], sActive = -1, sDebounce = 0;
function renderResults(list) {
  sItems = list; sActive = -1;
  if (!list.length) {
    sResults.innerHTML = sInput.value.trim() ? '<div class="res-empty">לא נמצאו תוצאות — נסו שם רחוב או מקום אחר</div>' : '';
    sResults.classList.toggle('open', !!sInput.value.trim());
    return;
  }
  let html = '', lastGroup = '';
  list.forEach((r, i) => {
    const meta = TYPE_META[r.type];
    if (meta.group !== lastGroup) { html += '<div class="res-group">' + meta.group + '</div>'; lastGroup = meta.group; }
    html += '<button class="res-item" role="option" data-i="' + i + '"><span class="ic">' + meta.icon + '</span><span class="tx"><span class="nm">' + escapeHtml(r.name) + '</span>' + (r.sub ? '<span class="sb">' + escapeHtml(r.sub) + '</span>' : '') + '</span></button>';
  });
  sResults.innerHTML = html;
  sResults.classList.add('open');
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
sInput.addEventListener('input', () => {
  sBox.classList.toggle('hasText', !!sInput.value);
  clearTimeout(sDebounce);
  sDebounce = setTimeout(() => renderResults(runSearch(sInput.value)), 90);
});
sInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!sItems.length) return;
    sActive = (sActive + (e.key === 'ArrowDown' ? 1 : -1) + sItems.length) % sItems.length;
    [...sResults.querySelectorAll('.res-item')].forEach((el, i) => el.classList.toggle('active', +el.dataset.i === sActive));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const pick = sItems[sActive >= 0 ? sActive : 0];
    if (pick) { goToResult(pick); closeResults(); }
  } else if (e.key === 'Escape') { closeResults(); sInput.blur(); }
});
sResults.addEventListener('click', e => {
  const btn = e.target.closest('.res-item');
  if (btn) { goToResult(sItems[+btn.dataset.i]); closeResults(); }
});
function closeResults() { sResults.classList.remove('open'); }
$('searchClear').addEventListener('click', () => { sInput.value = ''; sBox.classList.remove('hasText'); closeResults(); sInput.focus(); });
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#searchWrap')) closeResults();
});

// ---------- reverse geocode ----------
const allAddrPts = [];
for (const [name, list] of Object.entries(CITY_D.addr))
  for (const [nm, x, y] of list) allAddrPts.push({ street: name, num: String(nm), x: M2(x), y: M2(y) });
function reverseGeocode(x, y) {
  let best = null, bd = 1e12;
  for (const a of allAddrPts) {
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d < bd) { bd = d; best = a; }
  }
  if (best && bd < 220 * 220) return 'ליד ' + best.street + ' ' + best.num;
  // nearest named road midpoint
  let br = null; bd = 1e12;
  for (const r of namedRoads) {
    const d = (r.x - x) ** 2 + (r.y - y) ** 2;
    if (d < bd) { bd = d; br = r; }
  }
  if (br && bd < 400 * 400) return 'באזור רחוב ' + br.name;
  return 'רמת גן';
}

// ---------- events ----------
const CATS = [
  { id: 'city', label: 'אירוע עירוני', color: '#e3c27e' },
  { id: 'culture', label: 'תרבות ובמה', color: '#e86a8a' },
  { id: 'sport', label: 'ספורט ותנועה', color: '#46c08a' },
  { id: 'community', label: 'קהילה ומשפחה', color: '#5ba8e8' },
  { id: 'poi', label: 'נקודת ציון', color: '#e8a44c' },
];
const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
const EV_KEY = 'rg.events.v1';
let events = [];
function loadEvents() {
  try { events = JSON.parse(store.getItem(EV_KEY) || 'null') || []; }
  catch (e) { events = []; }
  if (!store.getItem(EV_KEY)) { seedEvents(); saveEvents(); }
}
function saveEvents() { store.setItem(EV_KEY, JSON.stringify(events)); }
function findPoi(substr) {
  const p = CITY_D.pois.find(p => p[2].includes(substr));
  return p ? [M2(p[3]), M2(p[4])] : null;
}
function seedEvents() {
  const day = 86400e3;
  const d = off => new Date(Date.now() + off * day).toISOString().slice(0, 10);
  const cents = MAP.buildingCentroids(), hs = MAP.buildingHeights();
  let tallest = 0;
  for (let i = 1; i < hs.length; i++) if (cents[i] && hs[i] > hs[tallest]) tallest = i;
  const bursa = cents[tallest] || MAP.center0;
  const park = findPoi('הפארק הלאומי') || findPoi('פארק לאומי') || MAP.center0;
  const stad = findPoi('אצטדיון') || findPoi('ספורט') || MAP.center0;
  const safari = findPoi('ספארי') || park;
  const museum = findPoi('מוזיאון') || bursa;
  const mk = (title, cat, date, time, xy, desc) =>
    ({ id: 'smp-' + Math.random().toString(36).slice(2, 9), title, cat, date, time, desc, x: xy[0], y: xy[1], addr: reverseGeocode(xy[0], xy[1]), sample: true });
  events = [
    mk('ערב אורות בפארק הלאומי', 'culture', d(6), '20:30', park, 'מופע אור־קולי בין העצים סביב האגם. הכניסה חופשית לתושבי העיר.'),
    mk('שוק אומנים במתחם הבורסה', 'city', d(4), '18:00', bursa, 'דוכני יוצרים, מוזיקה חיה ואוכל רחוב בין המגדלים.'),
    mk('בוקר קהילתי בספארי', 'community', d(9), '10:00', safari, 'כניסה מוזלת לתושבי רמת גן, סיורים מודרכים למשפחות.'),
    mk('מרוץ רמת גן', 'sport', d(13), '07:00', stad, 'מקצי 5 ו־10 ק״מ. הזינוק והסיום באצטדיון. ההרשמה באתר העירייה.'),
    mk('סיור מוזיאון פתוח', 'poi', d(11), '17:00', museum, 'סיור מודרך חינם באוספי הקבע. מספר המקומות מוגבל.'),
  ];
}
const hiddenCats = new Set();
let cityEvents = [];   // official content from the CMS file
let cityNotices = [];
const allEvents = () => cityEvents.concat(events);
const evMarkers = new Map(); // id -> el
function pinSVG(color, official) {
  if (official) {
    return '<svg viewBox="0 0 38 48" width="38" height="48" fill="none">' +
      '<path d="M19 2C10.9 2 4.5 8.4 4.5 16.3 4.5 27 19 45 19 45S33.5 27 33.5 16.3C33.5 8.4 27.1 2 19 2Z" fill="' + color + '" stroke="rgba(255,255,255,.75)" stroke-width="1.6"/>' +
      '<path d="M19 8.5l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7Z" fill="rgba(255,255,255,.95)"/></svg>';
  }
  return '<svg viewBox="0 0 34 44" width="34" height="44" fill="none">' +
    '<path d="M17 2C9.8 2 4 7.7 4 14.8 4 24.5 17 41 17 41S30 24.5 30 14.8C30 7.7 24.2 2 17 2Z" fill="' + color + '" stroke="rgba(0,0,0,.28)" stroke-width="1.2"/>' +
    '<circle cx="17" cy="14.5" r="5" fill="rgba(255,255,255,.92)"/>' +
    '<circle cx="17" cy="14.5" r="2.1" fill="' + color + '"/></svg>';
}
function ensureMarker(ev) {
  if (evMarkers.has(ev.id)) return evMarkers.get(ev.id);
  const c = (catById[ev.cat] || CATS[0]).color;
  const el = document.createElement('div');
  el.className = 'mk';
  el.style.setProperty('--c', c);
  el.innerHTML = '<div class="pulse"></div><div class="pin">' + pinSVG(c, ev.official) + '</div>';
  el.addEventListener('click', e => { e.stopPropagation(); showPop(ev.id); });
  markersRoot.appendChild(el);
  evMarkers.set(ev.id, el);
  return el;
}

// ---------- ambient event scenes ----------
const CAT_ANIM = { culture: 'concert', city: 'market', sport: 'sport', community: 'community', poi: 'landmark' };
const SC_INK = 'style="fill:var(--ink)"', SC_GOLD = 'style="fill:var(--gold)"';
function sceneSVG(type, color) {
  const C = color || '#e3c27e';
  if (type === 'concert') return '<svg viewBox="0 0 132 88">' +
    '<polygon points="46,10 66,80 26,80" style="fill:' + C + ';opacity:.08"/>' +
    '<polygon points="86,10 106,80 66,80" style="fill:' + C + ';opacity:.08"/>' +
    '<ellipse cx="66" cy="82" rx="42" ry="5.5" style="fill:' + C + ';opacity:.22"/>' +
    '<g class="sc-bob"><circle cx="66" cy="52" r="4.6" ' + SC_INK + '/><path d="M66 57c-4 0-6 5-6 12h12c0-7-2-12-6-12Z" ' + SC_INK + '/><rect x="71" y="56" width="1.6" height="13" rx=".8" ' + SC_GOLD + '/><circle cx="71.8" cy="55" r="1.7" ' + SC_GOLD + '/></g>' +
    '<g class="sc-note"><path d="M56 50v-8l5-1.4V48a2.6 2.6 0 1 1-1.6-2.4" style="fill:none;stroke:' + C + ';stroke-width:1.6"/></g>' +
    '<g class="sc-note n2"><circle cx="79" cy="44" r="2.2" style="fill:' + C + '"/><rect x="80.7" y="32" width="1.5" height="12" style="fill:' + C + '"/></g>' +
    '<g class="sc-note n3"><circle cx="70" cy="38" r="1.9" style="fill:' + C + ';opacity:.8"/><rect x="71.4" y="28" width="1.3" height="10" style="fill:' + C + ';opacity:.8"/></g>' +
    ['40,78', '52,80', '66,81', '80,80', '92,78'].map((p, i) =>
      '<circle cx="' + p.split(',')[0] + '" cy="' + p.split(',')[1] + '" r="2.6" class="sc-bob' + (i % 3 ? i % 3 + 1 : '') + '" style="fill:var(--ink);opacity:.55"/>').join('') +
    '</svg>';
  if (type === 'market') return '<svg viewBox="0 0 132 88">' +
    '<path class="sc-wave" d="M14 34 Q66 48 118 34" style="fill:none;stroke:' + C + ';stroke-width:1.2;opacity:.7"/>' +
    [20, 36, 52, 68, 84, 100].map((x, i) =>
      '<polygon class="sc-wave" style="animation-delay:' + (i * .3) + 's" points="' + x + ',' + (36 + Math.sin(i) * 3) + ' ' + (x + 8) + ',' + (36 + Math.sin(i) * 3) + ' ' + (x + 4) + ',' + (44 + Math.sin(i) * 3) + '" fill="' + (i % 2 ? C : 'var(--rose)') + '" opacity=".85"/>').join('') +
    '<g><rect x="24" y="58" width="3" height="24" ' + SC_INK + ' opacity=".6"/><rect x="55" y="58" width="3" height="24" ' + SC_INK + ' opacity=".6"/>' +
    [0, 1, 2, 3].map(i => '<rect x="' + (20 + i * 11) + '" y="52" width="11" height="8" rx="1.5" style="fill:' + (i % 2 ? C : '#fff') + ';opacity:.9"/>').join('') + '</g>' +
    '<g><rect x="78" y="60" width="3" height="22" ' + SC_INK + ' opacity=".6"/><rect x="106" y="60" width="3" height="22" ' + SC_INK + ' opacity=".6"/>' +
    [0, 1, 2].map(i => '<rect x="' + (76 + i * 12) + '" y="54" width="12" height="8" rx="1.5" style="fill:' + (i % 2 ? '#fff' : C) + ';opacity:.9"/>').join('') + '</g>' +
    '<circle class="sc-glow" cx="66" cy="28" r="3.2" style="fill:' + C + '"/>' +
    '</svg>';
  if (type === 'sport') return '<svg viewBox="0 0 132 88">' +
    '<ellipse cx="66" cy="82" rx="46" ry="5" style="fill:none;stroke:' + C + ';stroke-width:1.2;stroke-dasharray:6 5;opacity:.55"/>' +
    [0, 1, 2].map(i => '<g class="sc-run' + (i ? ' r' + (i + 1) : '') + '"><g transform="translate(60,58)">' +
      '<circle cx="0" cy="0" r="3.4" ' + SC_INK + '/>' +
      '<path d="M0 3 L-1 12" style="stroke:var(--ink);stroke-width:2.4;stroke-linecap:round"/>' +
      '<path class="sc-leg" d="M-1 12 L-5 21" style="stroke:var(--ink);stroke-width:2.2;stroke-linecap:round"/>' +
      '<path class="sc-leg l2" d="M-1 12 L4 20" style="stroke:var(--ink);stroke-width:2.2;stroke-linecap:round"/>' +
      '<path d="M-8 16 h-9" style="stroke:' + C + ';stroke-width:1.4;opacity:.6"/><path d="M-8 9 h-6" style="stroke:' + C + ';stroke-width:1.2;opacity:.4"/>' +
      '</g></g>').join('') +
    '</svg>';
  if (type === 'community') return '<svg viewBox="0 0 132 88">' +
    '<g class="sc-bln"><circle cx="46" cy="30" r="5.5" style="fill:var(--rose);opacity:.9"/><path d="M46 35.5 q2 8 0 14" style="fill:none;stroke:var(--ink);stroke-width:.9;opacity:.5"/></g>' +
    '<g class="sc-bln b2"><circle cx="88" cy="26" r="5" style="fill:var(--sky);opacity:.9"/><path d="M88 31 q-2 8 0 14" style="fill:none;stroke:var(--ink);stroke-width:.9;opacity:.5"/></g>' +
    [[52, 'sc-bob'], [66, 'sc-bob2'], [80, 'sc-bob3']].map(([x, cl], i) =>
      '<g class="' + cl + '"><circle cx="' + x + '" cy="' + (60 - (i === 1 ? 4 : 0)) + '" r="4" ' + SC_INK + '/>' +
      '<path d="M' + x + ' ' + (64 - (i === 1 ? 4 : 0)) + ' c-4.5 0-6.5 6-6.5 18h13c0-12-2-18-6.5-18Z" style="fill:' + (i === 1 ? C : 'var(--ink)') + ';opacity:.85"/></g>').join('') +
    '<path d="M58 72 h16 M72 72 h14" style="stroke:var(--ink);stroke-width:1.6;opacity:.4"/>' +
    '</svg>';
  if (type === 'landmark') return '<svg viewBox="0 0 132 88">' +
    '<circle cx="66" cy="60" r="17" style="fill:none;stroke:' + C + ';stroke-width:1;opacity:.4"/>' +
    '<path class="sc-spark" d="M66 44l3.2 12.2L82 60l-12.8 3.8L66 76l-3.2-12.2L50 60l12.8-3.8Z" style="fill:' + C + '"/>' +
    '<path class="sc-spark s2" d="M46 40l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6Z" style="fill:' + C + ';opacity:.8"/>' +
    '<path class="sc-spark s3" d="M88 34l1.4 4.2 4.2 1.4-4.2 1.4-1.4 4.2-1.4-4.2-4.2-1.4 4.2-1.4Z" style="fill:' + C + ';opacity:.8"/>' +
    '</svg>';
  return '<svg viewBox="0 0 132 88">' + // default: golden ripples
    ['', 'p2', 'p3'].map(cl => '<circle class="sc-rip ' + cl + '" cx="66" cy="74" r="26" style="fill:none;stroke:' + C + ';stroke-width:1.6"/>').join('') +
    [[44, 58], [88, 54], [60, 42], [78, 66]].map(([x, y], i) =>
      '<circle class="sc-spark' + (i % 3 ? ' s' + (i % 3 + 1) : '') + '" cx="' + x + '" cy="' + y + '" r="1.8" style="fill:' + C + '"/>').join('') +
    '</svg>';
}
const sceneEls = new Map(); // ev.id -> el
function ensureScene(ev) {
  if (sceneEls.has(ev.id)) return sceneEls.get(ev.id);
  const el = document.createElement('div');
  el.className = 'scene';
  const type = ev.anim || CAT_ANIM[ev.cat] || 'default';
  el.innerHTML = sceneSVG(type, (catById[ev.cat] || CATS[0]).color);
  markersRoot.appendChild(el);
  sceneEls.set(ev.id, el);
  return el;
}

function positionMarkers() {
  const d = MAP.cam.dist;
  // meters-per-pixel at screen centre, for scene scaling
  let ppm = 0;
  if (d < 900) {
    const [ax, ay] = MAP.project(MAP.cam.cx, MAP.cam.cy, 0);
    const [bx, by] = MAP.project(MAP.cam.cx + 10, MAP.cam.cy, 0);
    ppm = Math.hypot(bx - ax, by - ay) / 10;
  }
  const list = allEvents();
  for (const ev of list) {
    const el = ensureMarker(ev);
    if (hiddenCats.has(ev.cat)) { el.style.display = 'none'; hideScene(ev.id); continue; }
    const [sx, sy, vis] = MAP.project(ev.x, ev.y, 0);
    el.style.display = vis ? '' : 'none';
    el.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0)';
    // ambient scene when close
    const s = ppm ? clamp(46 * ppm / 132, 0.3, 2.4) : 0;
    if (vis && s >= 0.42) {
      const sc = ensureScene(ev);
      sc.style.display = '';
      sc.style.transform = 'translate3d(' + sx + 'px,' + (sy + 2) + 'px,0) translate(-50%,-100%) scale(' + s.toFixed(3) + ')';
    } else hideScene(ev.id);
  }
  // drop markers for deleted events
  for (const [id, el] of evMarkers) if (!list.some(e => e.id === id)) { el.remove(); evMarkers.delete(id); hideScene(id, true); }
  if (popAnchor) placePop();
  positionTransit();
}
function hideScene(id, remove) {
  const el = sceneEls.get(id);
  if (!el) return;
  if (remove) { el.remove(); sceneEls.delete(id); }
  else el.style.display = 'none';
}
function fmtWhen(ev) {
  if (!ev.date) return 'בקרוב';
  try {
    const dt = new Date(ev.date + 'T' + (ev.time || '12:00'));
    const ds = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'long' }).format(dt);
    return ds + (ev.time ? ' · ' + ev.time : '');
  } catch (e) { return ev.date; }
}
function chipHtml(cat) {
  const c = catById[cat] || CATS[0];
  return '<span class="ev-chip" style="background:color-mix(in srgb,' + c.color + ' 18%,transparent);color:' + c.color + '">' + c.label + '</span>';
}
function renderEvList() {
  const list = $('evList');
  const vis = allEvents().filter(e => !hiddenCats.has(e.cat))
    .sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0) || ((a.date || '9999') < (b.date || '9999') ? -1 : 1));
  $('evCount').textContent = allEvents().length || '';
  if (!vis.length) {
    list.innerHTML = '<div class="ev-none">אין עדיין אירועים על המפה.<br/>לחצו על «הוספת אירוע» וסמנו נקודה בעיר.</div>';
    return;
  }
  list.innerHTML = vis.map(ev =>
    '<div class="ev-card" data-id="' + ev.id + '">' +
    '<div class="row1">' + chipHtml(ev.cat) + (ev.official ? '<span class="official-chip">עירייה</span>' : '') +
    '<span class="when">' + fmtWhen(ev) + '</span></div>' +
    '<h3>' + escapeHtml(ev.title) + '</h3>' +
    '<div class="where"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/></svg>' + escapeHtml(ev.addr || 'רמת גן') + '</div>' +
    (ev.desc ? '<div class="desc">' + escapeHtml(ev.desc) + '</div>' : '') +
    '</div>').join('');
}
$('evList').addEventListener('click', e => {
  const card = e.target.closest('.ev-card');
  if (!card) return;
  const ev = allEvents().find(x => x.id === card.dataset.id);
  if (!ev) return;
  closePanel();
  MAP.flyTo({ cx: ev.x, cy: ev.y, dist: 620, done: () => showPop(ev.id) });
});

// popup (shared between events and plans)
let popFor = null, popAnchor = null;
function showPop(id) {
  const ev = allEvents().find(e => e.id === id);
  if (!ev) return;
  busPopStop = null; clearInterval(busTimer);
  popFor = id;
  popAnchor = { x: ev.x, y: ev.y, lift: 62 };
  const pop = $('pop');
  pop.innerHTML =
    '<div class="row1">' + chipHtml(ev.cat) + (ev.official ? '<span class="official-chip">עירייה</span>' : '') +
    '<span class="when">' + fmtWhen(ev) + '</span></div>' +
    '<h3>' + escapeHtml(ev.title) + '</h3>' +
    '<div class="where"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" style="flex:none"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>' + escapeHtml(ev.addr || 'רמת גן') + '</div>' +
    (ev.desc ? '<div class="desc">' + escapeHtml(ev.desc) + '</div>' : '') +
    (ev.link ? '<a class="pop-link" href="' + escapeHtml(ev.link) + '" target="_blank" rel="noopener">לפרטים והרשמה<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>' : '') +
    '<div class="acts">' +
    '<button class="pop-act" data-act="fly"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>התקרבות</button>' +
    (ev.official ? '' : '<button class="pop-act del" data-act="del"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h8l1-13"/></svg>הסרה</button>') +
    '<button class="pop-act" data-act="close">סגירה</button></div>';
  pop.classList.add('open');
  placePop();
}
function placePop() {
  const pop = $('pop');
  if (!popAnchor) return;
  const [sx, sy, vis] = MAP.project(popAnchor.x, popAnchor.y, 0);
  if (!vis) { closePop(); return; }
  const w = pop.offsetWidth || 300, h = pop.offsetHeight || 180;
  pop.style.left = clamp(sx - w / 2, 10, innerWidth - w - 10) + 'px';
  pop.style.top = clamp(sy - h - (popAnchor.lift || 20), 10, innerHeight - h - 10) + 'px';
}
// plan details popup
const PLAN_KIND = {
  a: { label: 'בהליך תכנון', color: '#a186e0' },
  p: { label: 'אושרה לאחרונה', color: '#2fb3a8' },
  r: { label: 'תמ״א 38 / התחדשות עירונית', color: '#e8845a' },
};
function showPlanPop(plan, x, y) {
  popFor = null;
  popAnchor = { x, y, lift: 16 };
  const k = PLAN_KIND[plan.k];
  const meta = [];
  if (plan.n) meta.push('תוכנית <b>' + escapeHtml(plan.n) + '</b>');
  if (plan.y) meta.push('<b>' + plan.y + '</b>');
  if (plan.d) meta.push('<b>' + plan.d.toLocaleString('he-IL') + '</b> דונם');
  if (plan.u) meta.push('<b>' + (plan.u > 0 ? '+' : '') + plan.u.toLocaleString('he-IL') + '</b> יח״ד');
  const pop = $('pop');
  pop.innerHTML =
    '<div class="row1"><span class="ev-chip" style="background:color-mix(in srgb,' + k.color + ' 18%,transparent);color:' + k.color + '">' + k.label + '</span>' +
    '<span class="when">' + escapeHtml(plan.s) + '</span></div>' +
    '<h3>' + escapeHtml(plan.t || 'תוכנית ' + plan.n) + '</h3>' +
    '<div class="pop-meta">' + meta.join('<span>·</span>') + '</div>' +
    (plan.o ? '<div class="desc">' + escapeHtml(plan.o) + '</div>' : '') +
    (plan.url ? '<a class="pop-link" href="' + escapeHtml(plan.url) + '" target="_blank" rel="noopener">לתיק התכנון הרשמי<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>' : '') +
    '<div class="acts"><button class="pop-act" data-act="close">סגירה</button></div>';
  pop.classList.add('open');
  placePop();
}
$('pop').addEventListener('click', e => {
  const btn = e.target.closest('.pop-act');
  if (!btn) return;
  const ev = allEvents().find(x => x.id === popFor);
  if (btn.dataset.act === 'close') { closePop(); }
  else if (btn.dataset.act === 'fly' && ev) MAP.flyTo({ cx: ev.x, cy: ev.y, dist: 320 });
  else if (btn.dataset.act === 'del' && ev && !ev.official) {
    events = events.filter(x => x.id !== ev.id);
    const el = evMarkers.get(ev.id);
    if (el) { el.remove(); evMarkers.delete(ev.id); }
    saveEvents(); renderEvList(); closePop();
    showToast('האירוע הוסר מהמפה');
  }
});
function closePop() {
  $('pop').classList.remove('open');
  popFor = null; popAnchor = null;
  busPopStop = null;
  clearInterval(busTimer);
}
window.addEventListener('mapclick', e => {
  if (placing) return;
  closePop();
  // planning layer hit-test
  if (MAP.LAYERS.plans) {
    const plan = MAP.planAtPoint(e.detail.x, e.detail.y);
    if (plan) showPlanPop(plan, e.detail.x, e.detail.y);
  }
});

// panel open/close
function openPanel() { $('evPanel').classList.add('open'); }
function closePanel() { $('evPanel').classList.remove('open'); }
$('evToggle').addEventListener('click', () => { renderEvList(); openPanel(); });
$('evClose').addEventListener('click', closePanel);

// legend chips
{
  const lg = $('legend');
  lg.innerHTML = CATS.map(c =>
    '<button class="lg-chip on" data-cat="' + c.id + '" style="--c:' + c.color + '"><i></i>' + c.label + '</button>').join('');
  lg.addEventListener('click', e => {
    const chip = e.target.closest('.lg-chip');
    if (!chip) return;
    const id = chip.dataset.cat;
    if (hiddenCats.has(id)) hiddenCats.delete(id); else hiddenCats.add(id);
    chip.classList.toggle('on', !hiddenCats.has(id));
    positionMarkers(); renderEvList();
    MAP.requestRender();
  });
}

// add-event flow
let placing = false, pendingLoc = null, selCat = 'city';
function setPlacing(on) {
  placing = on;
  canvas.classList.toggle('placing', on);
  $('placeHint').classList.toggle('show', on);
}
$('evAddBtn').addEventListener('click', () => { closePanel(); closePop(); setPlacing(true); });
$('placeCancel').addEventListener('click', () => setPlacing(false));
window.addEventListener('mapclick', e => {
  if (!placing) return;
  setPlacing(false);
  pendingLoc = { x: e.detail.x, y: e.detail.y };
  openEvModal();
});
function buildCatGrid() {
  $('fCats').innerHTML = CATS.map(c =>
    '<button class="cat-opt' + (c.id === selCat ? ' sel' : '') + '" data-id="' + c.id + '" style="--c:' + c.color + '"><i></i>' + c.label + '</button>').join('');
}
$('fCats').addEventListener('click', e => {
  const b = e.target.closest('.cat-opt');
  if (!b) return;
  selCat = b.dataset.id;
  buildCatGrid();
});
function openEvModal() {
  selCat = 'city';
  buildCatGrid();
  $('fTitle').value = ''; $('fDesc').value = ''; $('fTime').value = ''; $('fAnim').value = '';
  const today = new Date().toISOString().slice(0, 10);
  $('fDate').value = ''; $('fDate').min = today;
  $('fLoc').innerHTML = '<b>' + escapeHtml(reverseGeocode(pendingLoc.x, pendingLoc.y)) + '</b>';
  $('evModalBg').classList.add('open');
  setTimeout(() => $('fTitle').focus(), 60);
}
function closeEvModal() { $('evModalBg').classList.remove('open'); }
$('fCancel').addEventListener('click', closeEvModal);
$('evModalBg').addEventListener('pointerdown', e => { if (e.target === e.currentTarget) closeEvModal(); });
$('fSave').addEventListener('click', () => {
  const title = $('fTitle').value.trim();
  if (!title) { $('fTitle').focus(); $('fTitle').style.borderColor = 'var(--danger)'; setTimeout(() => $('fTitle').style.borderColor = '', 1200); return; }
  const ev = {
    id: 'ev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title, cat: selCat,
    anim: $('fAnim').value || '',
    date: $('fDate').value || '', time: $('fTime').value || '',
    desc: $('fDesc').value.trim(),
    x: pendingLoc.x, y: pendingLoc.y,
    addr: reverseGeocode(pendingLoc.x, pendingLoc.y),
  };
  events.push(ev);
  saveEvents();
  closeEvModal();
  renderEvList();
  positionMarkers();
  showToast('<b>' + escapeHtml(ev.title) + '</b> נוסף למפה ✨');
  MAP.flyTo({ cx: ev.x, cy: ev.y, dist: Math.min(MAP.cam.dist, 700) });
});

// ---------- optional layers wiring ----------
const LAYER_KEY = 'rg.layers.v1';
let layerToastShown = { plans: false, transit: false };
function syncLayerButtons() {
  $('plansBtn').classList.toggle('on', MAP.LAYERS.plans);
  $('transitBtn').classList.toggle('on', MAP.LAYERS.transit);
}
function toggleLayer(name) {
  MAP.setLayer(name, !MAP.LAYERS[name]);
  syncLayerButtons();
  positionTransit();
  try { store.setItem(LAYER_KEY, JSON.stringify(MAP.LAYERS)); } catch (e) {}
  if (MAP.LAYERS[name] && !layerToastShown[name]) {
    layerToastShown[name] = true;
    showToast(name === 'plans'
      ? 'שכבת תכנון פעילה — לחצו על שטח מסומן לפרטי התוכנית'
      : 'הקו האדום ותחנות האוטובוס מוצגים על המפה');
  }
  if (!MAP.LAYERS.plans && popAnchor && !popFor) closePop();
}
$('plansBtn').addEventListener('click', () => toggleLayer('plans'));
$('transitBtn').addEventListener('click', () => toggleLayer('transit'));

// events export / import
$('evExport').addEventListener('click', () => {
  const payload = { app: 'ramat-gan-living-map', version: 1, exported: new Date().toISOString(), events: events.filter(e => !hiddenCats.has(e.cat)) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'אירועים-רמת-גן.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  showToast('קובץ האירועים ירד — שתפו אותו עם השכנים');
});
$('evImport').addEventListener('click', () => $('evImportFile').click());
$('evImportFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.events;
    if (!Array.isArray(list)) throw new Error('פורמט לא מוכר');
    let added = 0;
    for (const ev of list) {
      if (!ev || typeof ev.title !== 'string' || typeof ev.x !== 'number' || typeof ev.y !== 'number') continue;
      if (events.some(x => x.id === ev.id)) continue;
      events.push({
        id: String(ev.id || 'im-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
        title: ev.title.slice(0, 60), cat: catById[ev.cat] ? ev.cat : 'city',
        anim: typeof ev.anim === 'string' ? ev.anim : '',
        date: typeof ev.date === 'string' ? ev.date.slice(0, 10) : '',
        time: typeof ev.time === 'string' ? ev.time.slice(0, 5) : '',
        desc: typeof ev.desc === 'string' ? ev.desc.slice(0, 300) : '',
        x: clamp(ev.x, MAP.bbox.minX - 2000, MAP.bbox.maxX + 2000),
        y: clamp(ev.y, MAP.bbox.minY - 2000, MAP.bbox.maxY + 2000),
        addr: typeof ev.addr === 'string' ? ev.addr.slice(0, 80) : reverseGeocode(ev.x, ev.y),
      });
      added++;
    }
    saveEvents(); renderEvList(); positionMarkers();
    showToast(added ? added.toLocaleString('he-IL') + ' אירועים נוספו מהקובץ ✨' : 'לא נמצאו אירועים חדשים בקובץ');
  } catch (err) {
    showToast('לא הצלחנו לקרוא את הקובץ — ודאו שזהו קובץ אירועים שיוצא מהמפה');
  }
});

// ---------- controls wiring ----------
$('zoomIn').addEventListener('click', () => MAP.flyTo({ dist: MAP.cam.dist * 0.55, T: 500 }));
$('zoomOut').addEventListener('click', () => MAP.flyTo({ dist: MAP.cam.dist * 1.8, T: 500 }));
$('compassBtn').addEventListener('click', () => MAP.flyTo({ bearing: 0, T: 600 }));
$('tiltBtn').addEventListener('click', () => {
  const flat = MAP.cam.tilt > 0.22;
  MAP.flyTo({ tilt: flat ? 0.02 : 0.82, T: 700 });
});
$('themeBtn').addEventListener('click', () => applyTheme(themeName === 'light' ? 'dark' : 'light', true));
$('aboutBtn').addEventListener('click', () => $('aboutBg').classList.add('open'));
$('aboutClose').addEventListener('click', () => $('aboutBg').classList.remove('open'));
$('aboutBg').addEventListener('pointerdown', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('evModalBg').classList.contains('open')) closeEvModal();
    else if ($('aboutBg').classList.contains('open')) $('aboutBg').classList.remove('open');
    else if (placing) setPlacing(false);
    else if (popFor) closePop();
    else if ($('evPanel').classList.contains('open')) closePanel();
    else closeResults();
  }
});

// ---------- official city content (published from the CMS) ----------
const CITY_CONTENT_URLS = [
  'https://raw.githubusercontent.com/Elad33/ramat-gan-living-map/main/data/city-events.json',
  'data/city-events.json',
];
function normalizeCityEvent(ev, i) {
  if (!ev || typeof ev.title !== 'string' || typeof ev.x !== 'number' || typeof ev.y !== 'number') return null;
  return {
    id: 'city-' + String(ev.id || i),
    title: ev.title.slice(0, 70), cat: catById[ev.cat] ? ev.cat : 'city',
    anim: typeof ev.anim === 'string' ? ev.anim : '',
    date: typeof ev.date === 'string' ? ev.date.slice(0, 10) : '',
    time: typeof ev.time === 'string' ? ev.time.slice(0, 5) : '',
    desc: typeof ev.desc === 'string' ? ev.desc.slice(0, 400) : '',
    link: typeof ev.link === 'string' && /^https?:/.test(ev.link) ? ev.link : '',
    x: ev.x, y: ev.y,
    addr: typeof ev.addr === 'string' ? ev.addr.slice(0, 80) : reverseGeocode(ev.x, ev.y),
    official: true,
  };
}
async function loadCityContent() {
  let data = null;
  for (const u of CITY_CONTENT_URLS) {
    try {
      const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (r.ok) { data = await r.json(); break; }
    } catch (e) {}
  }
  if (!data) return;
  const today = new Date().toISOString().slice(0, 10);
  cityEvents = (data.events || []).map(normalizeCityEvent).filter(Boolean)
    .filter(ev => !ev.endDate || ev.endDate >= today)
    .filter(ev => !(ev.date && !data.keepPast && ev.date < today));
  cityNotices = (data.notices || []).filter(n => n && typeof n.title === 'string')
    .filter(n => (!n.from || n.from <= today) && (!n.to || n.to >= today));
  renderNotices();
  renderEvList();
  positionMarkers();
  MAP.requestRender();
}
function renderNotices() {
  const badge = $('bellBadge');
  badge.textContent = cityNotices.length;
  badge.classList.toggle('on', cityNotices.length > 0);
  $('noticesList').innerHTML = cityNotices.length
    ? cityNotices.map(n =>
      '<div class="notice"><h4>' + escapeHtml(n.title) + '</h4>' +
      (n.body ? '<div class="nb">' + escapeHtml(n.body) + '</div>' : '') +
      (n.link && /^https?:/.test(n.link) ? '<div class="nd"><a href="' + escapeHtml(n.link) + '" target="_blank" rel="noopener">לפרטים נוספים ←</a></div>' : '') +
      (n.to ? '<div class="nd">בתוקף עד ' + escapeHtml(n.to) + '</div>' : '') +
      '</div>').join('')
    : '<div class="ev-none">אין הודעות חדשות מהעירייה.</div>';
}
$('bellBtn').addEventListener('click', () => $('noticesBg').classList.add('open'));
$('noticesClose').addEventListener('click', () => $('noticesBg').classList.remove('open'));
$('noticesBg').addEventListener('pointerdown', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });

// ---------- CMS pick mode (map embedded in admin as an iframe) ----------
const PICK_MODE = /[?&#]pick\b/.test(location.search + location.hash);
if (PICK_MODE) {
  window.addEventListener('mapclick', e => {
    const addr = reverseGeocode(e.detail.x, e.detail.y);
    try { parent.postMessage({ type: 'rg-pick', x: e.detail.x, y: e.detail.y, addr }, '*'); } catch (err) {}
    showToast('<b>' + escapeHtml(addr) + '</b> נבחר ✓');
  });
}

// ---------- boot ----------
const raf = () => new Promise(r => {
  let done = false;
  const fin = () => { if (!done) { done = true; r(); } };
  const t = setTimeout(fin, 28);
  requestAnimationFrame(() => { clearTimeout(t); fin(); });
});
async function boot() {
  const fill = $('ldrFill'), step = $('ldrStep');
  const setP = (p, t) => { fill.style.width = (p * 100).toFixed(1) + '%'; if (t) step.textContent = t; };
  try {
    setP(0.04, 'קורא את נתוני העיר…');
    await raf();
    // buildings (chunked)
    const total = CITY_D.bld.length;
    step.textContent = 'בונה ' + total.toLocaleString('he-IL') + ' מבנים…';
    const CHUNK = 1500;
    for (let i = 0; i < total; i += CHUNK) {
      const end = Math.min(total, i + CHUNK);
      for (let j = i; j < end; j++) buildBuilding(CITY_D.bld[j]);
      setP(0.05 + 0.5 * (end / total));
      await raf();
    }
    setP(0.55, 'סולל ' + CITY_D.rd.length.toLocaleString('he-IL') + ' רחובות…');
    await raf();
    assembleFlat();
    setP(0.66, 'מסמן ' + (CITY_D.plans || []).length.toLocaleString('he-IL') + ' תוכניות בנייה ואת הקו האדום…');
    await raf();
    assemblePlans();
    assembleRail();
    setP(0.74, 'מעלה את העיר למאיץ הגרפי…');
    await raf();
    uploadMeshes();
    setP(0.86, 'מלטש את הזוהר…');
    await raf();
    // theme: stored → host stamp → OS preference
    const hostTheme = document.documentElement.getAttribute('data-theme');
    const stored = store.getItem('rg.theme');
    applyTheme(stored && THEMES[stored] ? stored : (hostTheme && THEMES[hostTheme] ? hostTheme : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')), false);
    loadEvents();
    renderEvList();
    try {
      const saved = JSON.parse(store.getItem(LAYER_KEY) || 'null');
      if (saved) { MAP.LAYERS.plans = !!saved.plans; MAP.LAYERS.transit = !!saved.transit; layerToastShown = { plans: true, transit: true }; }
    } catch (e) {}
    syncLayerButtons();
    loadCityContent(); // async; merges official events when it lands
    if (PICK_MODE) {
      for (const id of ['evToggle', 'legend', 'bellBtn', 'aboutBtn', 'brand']) { const el = $(id); if (el) el.style.display = 'none'; }
      $('markers').style.display = 'none';
      canvas.classList.add('placing');
      $('placeHint').firstChild.textContent = 'לחצו על המפה לבחירת מיקום ';
      $('placeCancel').style.display = 'none';
      $('placeHint').classList.add('show');
    }
    window.__overlayTick = overlayTick;
    MAP.start();
    setP(1, '');
    await raf();
    // intro flight toward the diamond district skyline
    const hs = MAP.buildingHeights(), cents = MAP.buildingCentroids();
    let tallest = 0;
    for (let i = 1; i < hs.length; i++) if (cents[i] && hs[i] > hs[tallest]) tallest = i;
    const bursa = cents[tallest] || MAP.center0;
    const tgt = { cx: lerp(bursa[0], MAP.center0[0], 0.3), cy: lerp(bursa[1], MAP.center0[1], 0.3) };
    $('loader').classList.add('done');
    setTimeout(() => $('loader').remove(), 1100);
    if (MAP.QA_MODE) {
      if (/light/.test(location.search + location.hash)) applyTheme('light', false);
      Object.assign(MAP.cam, { cx: tgt.cx, cy: tgt.cy, dist: 2600, tilt: 0.8, bearing: -0.35 });
      const m = (location.search + location.hash).match(/qa=([\d.,-]+)/);
      if (m) { // qa=cx,cy,dist,tilt,bearing overrides for targeted shots
        const v = m[1].split(',').map(Number);
        if (v.length >= 3) Object.assign(MAP.cam, { cx: v[0], cy: v[1], dist: v[2], tilt: v[3] ?? 0.82, bearing: v[4] ?? 0 });
      }
      requestAnimationFrame(() => {
        MAP.drawOnce();
        const qs = location.search + location.hash;
        if (/panel/.test(qs)) { renderEvList(); openPanel(); }
        if (/modal/.test(qs)) { pendingLoc = { x: MAP.cam.cx, y: MAP.cam.cy }; openEvModal(); }
        if (/results/.test(qs)) { sInput.value = 'ביאליק 12'; sBox.classList.add('hasText'); renderResults(runSearch('ביאליק 12')); }
        if (/buspop/.test(qs)) {
          // open the arrivals popup for a busy stop (aba hillel) for QA
          const stop = busStops.find(s => s.code === 21644) || busStops[0];
          if (stop) {
            MAP.setLayer('transit', true); syncLayerButtons();
            Object.assign(MAP.cam, { cx: stop.x, cy: stop.y + 60, dist: 500, tilt: 0.6, bearing: 0 });
            MAP.drawOnce();
            showBusPop(stop);
            setTimeout(() => MAP.drawOnce(), 2500); // re-snapshot after arrivals land
          }
        }
        if (/plans/.test(qs)) { MAP.setLayer('plans', true); syncLayerButtons(); MAP.drawOnce(); }
        if (/transit/.test(qs)) { MAP.setLayer('transit', true); syncLayerButtons(); positionTransit(); MAP.drawOnce(); }
        if (/planpop/.test(qs)) {
          // fly to the largest in-process plan and open its popup for QA
          let best = null;
          for (const p of (CITY_D.plans || [])) if (p.k === 'a' && (!best || (p.d || 0) > (best.d || 0))) best = p;
          if (best) {
            const r = best.r[0];
            const px = r[0] * UNIT, py = r[1] * UNIT;
            Object.assign(MAP.cam, { cx: px, cy: py, dist: 1400, tilt: 0.5, bearing: 0 });
            MAP.drawOnce();
            showPlanPop(best, px, py);
          }
        }
        // headless compositor omits WebGL layers; snapshot to a plain <img> for QA screenshots
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
        document.body.insertBefore(img, canvas.nextSibling);
      });
    } else {
      MAP.flyTo({ ...tgt, dist: 2600, tilt: 0.8, bearing: -0.35, T: 3400 });
    }
  } catch (err) {
    ERRLOG.push(String(err && err.stack || err));
    reportFatal(err && err.message || String(err));
    throw err;
  }
}
boot();
