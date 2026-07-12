/* ============================================================
   Part 3 — themes, overlay labels, search, events, boot
   ============================================================ */

// per-city runtime config, injected by build.mjs from cities/<slug>.json
const CFG = window.CITY_CFG || {
  slug: 'ramat-gan', nameHe: 'רמת גן', title: 'רמת גן · המפה החיה',
  deployUrl: 'https://ramat-gan-living-map.vercel.app',
  muni: null, contentRawBase: null, venueAliases: {}, features: {},
};

// ---------- theme palettes ----------
const THEMES = {
  dark: {
    css: '#070b16',
    sky0: [0.014, 0.022, 0.048], sky1: [0.06, 0.085, 0.15],
    ground0: [0.05, 0.07, 0.128], ground1: [0.028, 0.04, 0.078],
    fog: [0.05, 0.07, 0.128], fogD: 10500, fogAmt: 0.6,
    bldBase: [0.095, 0.13, 0.225], bldTop: [0.32, 0.40, 0.58],
    win: [1.08, 0.84, 0.45], night: 1,
    flat: {
      park: [0.052, 0.148, 0.112, 0.92], cemetery: [0.058, 0.115, 0.098, 0.85],
      pitch: [0.06, 0.165, 0.14, 0.8], water: [0.055, 0.135, 0.23, 0.95],
      bndWide: [0.89, 0.76, 0.49, 0.055], bndLine: [0.89, 0.76, 0.49, 0.5],
      road0: [0.61, 0.50, 0.31, 0.95], road1: [0.42, 0.38, 0.30, 0.92],
      road2: [0.335, 0.345, 0.42, 0.92], road3: [0.225, 0.255, 0.345, 0.88],
      road4: [0.165, 0.195, 0.275, 0.8], road5: [0.16, 0.19, 0.27, 0.72],
      road6: [0.135, 0.165, 0.235, 0.55], road7: [0.15, 0.18, 0.25, 0.6],
      planA: [0.66, 0.50, 0.92, 0.16], planALine: [0.76, 0.62, 0.98, 0.75],
      planP: [0.22, 0.72, 0.66, 0.14], planPLine: [0.30, 0.82, 0.75, 0.7],
      planR: [0.93, 0.52, 0.34, 0.18], planRLine: [0.97, 0.60, 0.42, 0.8],
      rail: [0.88, 0.34, 0.30, 0.95], railTunnel: [0.88, 0.34, 0.30, 0.34],
    },
    dust: [0.8, 0.62, 0.30], dustAmt: 0.55,
    bloomThresh: 0.30, bloomK: 0.8, vig: 0.34,
    // cinematic night: cool moon fill, mixed windows, street haze, stars, sodium lamps
    sunDir: [0.62, 0.70, 0.62], sunWarm: [0.75, 0.82, 1.10], sunK: 0.10, // moon higher — shorter night shadows
    rimK: 0.35, rimCol: [0.55, 0.70, 1.0], specK: 0.18,
    winCool: [0.62, 0.80, 1.0], winLit: 0.40, floorDark: 0.18, penthouse: 0.7, winBleed: 1,
    fogH: 0.55, starAmt: 0.9, milky: 0.35, skyGlowCol: [0.42, 0.24, 0.09], skyGlowAmt: 0.38, sunDiscAmt: 0,
    lampCol: [1.0, 0.72, 0.38], lampAmt: 0.8, beaconAmt: 1,
    expo: 1.15, sat: 1.12, tint: [1.02, 1.0, 0.99], sheenK: 0.5, rippleK: 0.35, animK: 1,
    bloomPasses: 3, anamK: 1.6,
    shadowK: 0.34, // moon shadows — soft, cool
    treeAmt: 1, treeCol0: [0.045, 0.085, 0.065], treeCol1: [0.11, 0.20, 0.13],
    trailAmt: 0.9, trailColW: [1.0, 0.93, 0.72], trailColR: [1.0, 0.16, 0.10],
    wetK: 0.5, // wet-asphalt lamp streaks
    aoK: 0.7, rayK: 0, grainK: 0.7,
  },
  light: {
    css: '#e9ecef',
    sky0: [0.80, 0.845, 0.90], sky1: [0.965, 0.925, 0.865],
    ground0: [0.912, 0.898, 0.872], ground1: [0.852, 0.838, 0.812],
    fog: [0.94, 0.90, 0.845], fogD: 11500, fogAmt: 0.55, // haze glows warm at golden hour
    bldBase: [0.742, 0.726, 0.695], bldTop: [0.99, 0.976, 0.948],
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
    // golden hour: low western sun, warm sun-facing facades, cool shade, sun disc
    sunDir: [0.85, 0.35, 0.30], sunWarm: [1.12, 1.02, 0.86], sunK: 0.40,
    rimK: 0.30, rimCol: [1.0, 0.93, 0.80], specK: 0.10, // warm edge light on backlit towers
    winCool: [1.0, 0.9, 0.6], winLit: 0.38, floorDark: 0, penthouse: 0, winBleed: 0,
    fogH: 0.35, starAmt: 0, milky: 0, skyGlowCol: [0.42, 0.28, 0.13], skyGlowAmt: 0.3, sunDiscAmt: 0.8,
    lampCol: [1.0, 0.72, 0.38], lampAmt: 0, beaconAmt: 0,
    expo: 1.05, sat: 1.05, tint: [1.04, 1.0, 0.95], sheenK: 0, rippleK: 0, animK: 0,
    bloomPasses: 2, anamK: 1,
    shadowK: 0.55, // long golden-hour shadows
    treeAmt: 1, treeCol0: [0.24, 0.36, 0.19], treeCol1: [0.47, 0.62, 0.33],
    trailAmt: 0, wetK: 0, // headlights/wet glow read as noise in daylight
    aoK: 0.8, rayK: 0.55, rayCol: [1.0, 0.83, 0.58], grainK: 0.5,
  },
};
let themeName = null;
function applyTheme(name, persist) {
  themeName = name;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== (name === 'light' ? 'light' : 'dark'))
    root.setAttribute('data-theme', name === 'light' ? 'light' : 'dark');
  MAP.setPalette(THEMES[name]);
  const light = name === 'light';
  $('icMoon').style.display = light ? '' : 'none';
  $('icSun').style.display = light ? 'none' : '';
  // the About row shows the CURRENT mode (state, not action): sun+יום / moon+דמדומים
  const mMoon = $('icMoonM'), mSun = $('icSunM'), mName = $('themeName');
  if (mMoon) mMoon.style.display = light ? 'none' : '';
  if (mSun) mSun.style.display = light ? '' : 'none';
  if (mName) mName.textContent = light ? 'יום' : 'דמדומים';
  if (persist) store.setItem('rg.theme', name);
}
// host theme toggle sync (artifact viewer stamps data-theme on root)
new MutationObserver(() => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t && t !== themeName && THEMES[t]) applyTheme(t, false);
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// local-timezone ISO date (toISOString is UTC and mislabels evening/midnight)
const localISO = (offsetDays = 0) => {
  const t = new Date(Date.now() + offsetDays * 864e5);
  const p = n => String(n).padStart(2, '0');
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
};

// ---------- toast ----------
let toastT = 0;
function showToast(html) {
  const el = $('toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---------- mobile back button closes UI surfaces (history sentinels) ----------
const UI_BACK = { stack: [], silent: 0 };
function uiOpened(key, closeFn) {
  if (/[?&#]pick\b/.test(location.search + location.hash)) return; // CMS iframe
  if (UI_BACK.stack.some(s => s.key === key)) return;
  UI_BACK.stack.push({ key, closeFn });
  try { history.pushState({ rgui: key }, ''); } catch (e) {}
}
function uiClosed(key) {
  const i = UI_BACK.stack.findIndex(s => s.key === key);
  if (i < 0) return;
  UI_BACK.stack.splice(i, 1);
  UI_BACK.silent++;
  try { history.back(); } catch (e) { UI_BACK.silent--; }
}
window.addEventListener('popstate', () => {
  if (UI_BACK.silent > 0) { UI_BACK.silent--; return; }
  const top = UI_BACK.stack.pop();
  if (top) top.closeFn(); // the closer got fromBack=true baked in
});

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
    const sc = clamp(1.12 - d * 0.0004, 0.7, 1); // continuous — no size steps while zooming
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
const BUS_API_REMOTE = CFG.deployUrl + '/api/bus?stop=';
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
  pop.innerHTML = POP_X +
    '<div class="bus-head"><span class="bus-sign">' + BUS_SIGN_SVG + '</span>' +
    '<div><div class="nm">' + escapeHtml(stop.name || 'תחנת אוטובוס') + '</div>' +
    '<div class="cd">תחנה ' + (stop.code || '—') + '</div></div></div>' +
    '<div id="busBody"><div class="sk-row"></div><div class="sk-row"></div><div class="sk-row"></div></div>' +
    '<div class="acts">' + navActsHtml(stop.x, stop.y, stop.name) + '</div>';
  pop.classList.add('open');
  popOpened();
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
  if (window.__navTick) window.__navTick();
  updateRing(t);
  if (t - lastLayoutT < 90 && !force) { return; }
  lastLayoutT = t; lastLayoutV = vpVersion;
  layoutLabels();
  // compass + tilt button state
  $('compassN').style.transform = 'rotate(' + (-MAP.cam.bearing * 180 / Math.PI) + 'deg)';
  $('compassBtn').classList.toggle('hide', Math.abs(MAP.cam.bearing) < 0.02); // only shown off-north
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
// word-aware relevance: whole match > name prefix > any-word prefix > mid-substring.
// mid-substring is deliberately weak (and gated on length) so it stops surfacing noise.
function scoreItem(n, nh, q, qh) {
  if (n === q || nh === qh) return 100;
  if (n.startsWith(q) || nh.startsWith(qh)) return 84;
  if ((' ' + n).includes(' ' + q) || (' ' + nh).includes(' ' + qh)) return 66; // a word starts with q
  if (q.length >= 3 && (n.includes(q) || nh.includes(qh))) return 30;           // buried substring
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
  biz: { group: 'עסקים', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4.5 9.5 6 4.5h12l1.5 5M4.5 9.5a2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.6 0M5.5 12v7.5h13V12M9.5 19.5v-5h5v5"/></svg>' },
  event: { group: 'אירועים', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>' },
};
// events are dynamic (loaded async, user-added) — kept in their own list, rebuilt on change
let evSearchItems = [];
function syncEventSearch() {
  evSearchItems = allEvents().map(ev => {
    const it = { type: 'event', name: ev.title, ev,
      sub: [fmtWhen(ev), ev.locName || (typeof ev.x === 'number' ? '' : 'אונליין')].filter(Boolean).join(' · '),
      x: ev.x, y: ev.y };
    it.n = norm(it.name); it.nh = stripHe(it.n);
    return it;
  });
}
window.syncEventSearch = syncEventSearch;
// per-type nudges: what a searcher most likely means, and the floor each must clear.
// businesses & buildings must clear a word-boundary match (66) — no buried-substring noise.
const TYPE_BONUS = { street: 8, addr: 0, event: 7, poi: 5, hood: 4, biz: 3, bld: -8 };
const TYPE_FLOOR = { biz: 60, bld: 60, event: 40 };
function runSearch(qRaw) {
  const { text, num } = parseQuery(qRaw);
  if (!text && !num) return [];
  const q = text, qh = stripHe(text);
  const res = [];
  const consider = it => {
    const s = scoreItem(it.n, it.nh, q, qh);
    if (s < (TYPE_FLOOR[it.type] || 1)) return;
    res.push({ ...it, score: s + (TYPE_BONUS[it.type] || 0) });
  };
  if (q) {
    for (const it of searchItems) consider(it);
    for (const it of evSearchItems) consider(it);
  }
  res.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  const out = [];
  if (num) {
    for (const st of res.filter(r => r.type === 'street').slice(0, 4)) {
      const loc = resolveAddress(st.entry, num);
      if (loc) out.push({ type: 'addr', name: st.name + ' ' + num, sub: loc.approx ? 'כתובת · מיקום משוער' : 'כתובת', x: loc.x, y: loc.y, score: 120 + st.score });
    }
  }
  const capPer = { street: 5, poi: 5, hood: 3, bld: 3, biz: 6, event: 6 };
  const counts = {};
  for (const r of res) {
    counts[r.type] = (counts[r.type] || 0) + 1;
    if (counts[r.type] <= capPer[r.type]) out.push(r);
    if (out.length > 22) break;
  }
  return out;
}
function goToResult(r) {
  if (r.type === 'event') {
    const ev = r.ev;
    if (ev && typeof ev.x === 'number') { MAP.flyTo({ cx: ev.x, cy: ev.y, dist: 620, done: () => showPop(ev.id) }); return; }
    if (ev && ev.link) window.open(ev.link, '_blank', 'noopener'); // online event
    else { renderEvList(); openPanel(); }
    return;
  }
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
// the dropdown lists the top few businesses, but the MAP highlights EVERY business
// whose name matches the query — so a search paints the whole relevant set as pins.
function bizMatchesForQuery(qRaw) {
  if (!qRaw || !qRaw.trim()) return null;
  const { text } = parseQuery(qRaw);
  if (!text) return null;
  const q = text, qh = stripHe(text);
  const ids = [];
  for (const it of searchItems) {
    if (it.type !== 'biz' || !it.biz) continue;
    if (scoreItem(it.n, it.nh, q, qh) >= (TYPE_FLOOR.biz || 60)) ids.push(it.biz.id);
    if (ids.length >= 120) break;
  }
  return ids.length ? new Set(ids) : null;
}
function syncSearchBizHighlight() {
  if (window.setBizSearchHighlight) setBizSearchHighlight(bizMatchesForQuery(sInput.value));
}
function renderResults(list) {
  sItems = list; sActive = -1;
  syncSearchBizHighlight();
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
function clearSearch() {
  sInput.value = ''; sBox.classList.remove('hasText'); closeResults();
  if (window.setBizSearchHighlight) setBizSearchHighlight(null); // restore all businesses
}
$('searchClear').addEventListener('click', () => { clearSearch(); sInput.focus(); });
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
  return CFG.nameHe;
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
  const before = events.length;
  events = events.filter(e => !String(e.id).startsWith('smp-')); // remove old demo seeds
  if (events.length !== before) saveEvents();
}
function saveEvents() { store.setItem(EV_KEY, JSON.stringify(events)); }
const hiddenCats = new Set();
let cityEvents = [];   // official content from the CMS file
let muniEvents = [];   // scraped from the municipality event lobby
let cityNotices = [];
const allEvents = () => cityEvents.concat(muniEvents, events);
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
// map markers: user + CMS events individually; muni events grouped by venue
let markerList = [];
function rebuildMarkerList() {
  const out = [];
  for (const ev of cityEvents.concat(events)) {
    if (typeof ev.x !== 'number') continue;
    out.push({ id: ev.id, x: ev.x, y: ev.y, cat: ev.cat, anim: ev.anim, official: ev.official, count: 1, events: [ev] });
  }
  const venues = new Map();
  for (const ev of muniEvents) {
    if (ev.x == null) continue;
    const k = Math.round(ev.x / 30) + ':' + Math.round(ev.y / 30);
    if (!venues.has(k)) venues.set(k, { id: 'venue-' + k, x: ev.x, y: ev.y, cat: ev.cat, anim: ev.anim, official: true, count: 0, events: [], locName: ev.locName });
    const v = venues.get(k);
    v.count++;
    v.events.push(ev);
  }
  out.push(...venues.values());
  markerList = out;
  syncEventSearch(); // keep the search index in step with the events on the map
}
function ensureMarker(mk) {
  if (evMarkers.has(mk.id)) return evMarkers.get(mk.id);
  const c = (catById[mk.cat] || CATS[0]).color;
  const el = document.createElement('div');
  el.className = 'mk';
  el.style.setProperty('--c', c);
  el.innerHTML = '<div class="pulse"></div><div class="pin">' + pinSVG(c, mk.official) +
    (mk.count > 1 ? '<span class="mk-count">' + mk.count + '</span>' : '') + '</div>';
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (mk.count > 1) showVenuePop(mk);
    else showPop(mk.events[0].id);
  });
  markersRoot.appendChild(el);
  evMarkers.set(mk.id, el);
  return el;
}

// ---------- ambient event scenes ----------
const CAT_ANIM = { culture: 'concert', city: 'market', sport: 'sport', community: 'community', poi: 'landmark' };
const SC_INK = 'style="fill:var(--ink)"', SC_GOLD = 'style="fill:var(--gold)"';
function sceneSVG(type, color) {
  const C = color || '#e3c27e';
  const INK = 'var(--ink)';
  const person = (x, y, cl, fill) =>
    '<g class="' + cl + '"><circle cx="' + x + '" cy="' + y + '" r="3.6" style="fill:' + (fill || INK) + '"/>' +
    '<path d="M' + x + ' ' + (y + 4) + 'c-4 0-5.5 5.5-5.5 15h11c0-9.5-1.5-15-5.5-15Z" style="fill:' + (fill || INK) + ';opacity:.9"/></g>';

  if (type === 'concert') return '<svg viewBox="0 0 132 88">' +
    '<polygon class="sc-beam" points="40,4 62,80 22,80" style="fill:' + C + ';opacity:.14"/>' +
    '<polygon class="sc-beam bm2" points="92,4 110,80 70,80" style="fill:' + C + ';opacity:.14"/>' +
    '<ellipse cx="66" cy="82" rx="44" ry="5.5" style="fill:' + C + ';opacity:.22"/>' +
    '<ellipse class="sc-ring" cx="66" cy="82" rx="30" ry="4.5" style="fill:none;stroke:' + C + ';stroke-width:1.6"/>' +
    '<ellipse class="sc-ring r2" cx="66" cy="82" rx="30" ry="4.5" style="fill:none;stroke:' + C + ';stroke-width:1.6"/>' +
    '<g><rect x="30" y="60" width="7" height="16" rx="1.5" style="fill:' + INK + ';opacity:.75"/><circle class="sc-glow" cx="33.5" cy="65" r="1.8" style="fill:' + C + '"/></g>' +
    '<g><rect x="95" y="60" width="7" height="16" rx="1.5" style="fill:' + INK + ';opacity:.75"/><circle class="sc-glow" cx="98.5" cy="65" r="1.8" style="fill:' + C + '"/></g>' +
    '<g class="sc-sway"><circle cx="66" cy="49" r="4.8" style="fill:' + INK + '"/>' +
    '<path d="M66 54c-4.2 0-6.2 5.5-6.2 15h12.4c0-9.5-2-15-6.2-15Z" style="fill:' + INK + '"/>' +
    '<path d="M70 57l5.5-3" style="stroke:' + INK + ';stroke-width:2;stroke-linecap:round"/>' +
    '<circle cx="76.5" cy="53.4" r="1.9" style="fill:' + C + '"/>' +
    '<path d="M76.5 55.3v12" style="stroke:' + C + ';stroke-width:1.1;opacity:.75"/></g>' +
    '<g class="sc-note"><path d="M56 48v-9l5.5-1.6v8.6a2.7 2.7 0 1 1-1.7-2.5" style="fill:none;stroke:' + C + ';stroke-width:1.7"/></g>' +
    '<g class="sc-note n2"><circle cx="80" cy="42" r="2.3" style="fill:' + C + '"/><rect x="81.8" y="29" width="1.5" height="13" style="fill:' + C + '"/></g>' +
    '<g class="sc-note n3"><circle cx="70" cy="36" r="2" style="fill:' + C + ';opacity:.85"/><rect x="71.5" y="25" width="1.4" height="11" style="fill:' + C + ';opacity:.85"/></g>' +
    ['40,79,', '51,81,b2', '66,82,b3', '81,81,b4', '92,79,b2'].map(p => {
      const [x, y, d] = p.split(',');
      return '<g class="sc-bob ' + d + '"><circle cx="' + x + '" cy="' + y + '" r="2.8" style="fill:' + INK + ';opacity:.6"/>' +
        '<path d="M' + (x - 3) + ' ' + (y - 3) + 'l-2-3M' + (+x + 3) + ' ' + (y - 3) + 'l2-3" style="stroke:' + INK + ';stroke-width:1.3;opacity:.45;stroke-linecap:round"/></g>';
    }).join('') +
    '</svg>';

  if (type === 'market') return '<svg viewBox="0 0 132 88">' +
    '<path class="sc-wave" d="M12 30 Q66 46 120 30" style="fill:none;stroke:' + C + ';stroke-width:1.2;opacity:.7"/>' +
    [18, 35, 52, 69, 86, 103].map((x, i) =>
      '<polygon class="sc-wave" style="animation-delay:' + (i * .33) + 's" points="' + x + ',' + (32 + (i % 3)) + ' ' + (x + 9) + ',' + (32 + (i % 3)) + ' ' + (x + 4.5) + ',' + (41 + (i % 3)) + '" fill="' + (i % 2 ? C : 'var(--rose)') + '" opacity=".9"/>').join('') +
    '<g><rect x="20" y="58" width="3" height="24" style="fill:' + INK + ';opacity:.65"/><rect x="52" y="58" width="3" height="24" style="fill:' + INK + ';opacity:.65"/>' +
    [0, 1, 2, 3].map(i => '<rect x="' + (16 + i * 11) + '" y="51" width="11" height="9" rx="1.5" style="fill:' + (i % 2 ? C : '#f5efe0') + ';opacity:.95"/>').join('') +
    '<rect x="22" y="68" width="28" height="5" rx="1" style="fill:' + INK + ';opacity:.35"/></g>' +
    '<g><rect x="80" y="60" width="3" height="22" style="fill:' + INK + ';opacity:.65"/><rect x="108" y="60" width="3" height="22" style="fill:' + INK + ';opacity:.65"/>' +
    [0, 1, 2].map(i => '<rect x="' + (78 + i * 12) + '" y="53" width="12" height="9" rx="1.5" style="fill:' + (i % 2 ? '#f5efe0' : C) + ';opacity:.95"/>').join('') + '</g>' +
    '<path class="sc-steam" d="M92 56c-2-3 2-4 0-7" style="fill:none;stroke:#f5efe0;stroke-width:1.6;stroke-linecap:round"/>' +
    '<path class="sc-steam s2" d="M98 56c-2-3 2-4 0-7" style="fill:none;stroke:#f5efe0;stroke-width:1.6;stroke-linecap:round"/>' +
    '<path class="sc-steam s3" d="M95 57c-2-3 2-4 0-7" style="fill:none;stroke:' + C + ';stroke-width:1.4;stroke-linecap:round"/>' +
    '<g class="sc-walk">' + person(66, 64, 'sc-bob') + '</g>' +
    '<g class="sc-walk w2"><g class="sc-bob b2"><circle cx="66" cy="66" r="3" style="fill:' + INK + ';opacity:.7"/>' +
    '<path d="M66 69.5c-3.2 0-4.5 4.5-4.5 12h9c0-7.5-1.3-12-4.5-12Z" style="fill:' + INK + ';opacity:.6"/></g></g>' +
    '<circle class="sc-glow" cx="66" cy="26" r="3.4" style="fill:' + C + '"/>' +
    '<circle class="sc-spark s2" cx="60" cy="22" r="1.3" style="fill:' + C + '"/>' +
    '</svg>';

  if (type === 'sport') return '<svg viewBox="0 0 132 88">' +
    '<path d="M8 82h116" style="stroke:' + C + ';stroke-width:1.4;stroke-dasharray:7 6;opacity:.55"/>' +
    '<g><rect x="107" y="46" width="2.2" height="36" style="fill:' + INK + ';opacity:.8"/>' +
    '<g class="sc-flag"><rect x="109" y="46" width="13" height="4.5" style="fill:' + C + '"/><rect x="109" y="50.5" width="13" height="4.5" style="fill:' + INK + ';opacity:.7"/></g></g>' +
    [0, 1, 2].map(i => '<g class="sc-run' + (i ? ' r' + (i + 1) : '') + '"><g transform="translate(60,56)">' +
      '<circle cx="0" cy="0" r="3.6" style="fill:' + INK + '"/>' +
      '<path d="M0 3.5 L-1 13" style="stroke:' + INK + ';stroke-width:2.6;stroke-linecap:round"/>' +
      '<path class="sc-arm" d="M-.5 6 L-6 11" style="stroke:' + INK + ';stroke-width:2.1;stroke-linecap:round"/>' +
      '<path class="sc-arm a2" d="M-.5 6 L5 10" style="stroke:' + INK + ';stroke-width:2.1;stroke-linecap:round"/>' +
      '<path class="sc-leg" d="M-1 13 L-5.5 22" style="stroke:' + INK + ';stroke-width:2.3;stroke-linecap:round"/>' +
      '<path class="sc-leg l2" d="M-1 13 L4.5 21.5" style="stroke:' + INK + ';stroke-width:2.3;stroke-linecap:round"/>' +
      '<path d="M-9 15h-8M-9 8h-5" style="stroke:' + C + ';stroke-width:1.4;opacity:.55"/>' +
      '</g></g>').join('') +
    '<circle class="sc-ball" cx="34" cy="76" r="3.2" style="fill:' + C + '"/>' +
    '</svg>';

  if (type === 'community') return '<svg viewBox="0 0 132 88">' +
    '<g class="sc-bln"><circle cx="40" cy="26" r="6" style="fill:var(--rose);opacity:.95"/><path d="M40 32q2.5 9 0 16" style="fill:none;stroke:' + INK + ';stroke-width:.9;opacity:.5"/></g>' +
    '<g class="sc-bln b2"><circle cx="92" cy="22" r="5.4" style="fill:var(--sky);opacity:.95"/><path d="M92 27.5q-2.5 9 0 16" style="fill:none;stroke:' + INK + ';stroke-width:.9;opacity:.5"/></g>' +
    '<g class="sc-bln b3"><circle cx="66" cy="16" r="4.8" style="fill:' + C + ';opacity:.95"/><path d="M66 21q2 8 0 14" style="fill:none;stroke:' + INK + ';stroke-width:.9;opacity:.5"/></g>' +
    '<rect class="sc-conf" x="46" y="34" width="3.2" height="2" style="fill:' + C + '"/>' +
    '<rect class="sc-conf c2" x="58" y="30" width="3.2" height="2" style="fill:var(--rose)"/>' +
    '<rect class="sc-conf c3" x="74" y="33" width="3.2" height="2" style="fill:var(--sky)"/>' +
    '<rect class="sc-conf c4" x="86" y="30" width="3.2" height="2" style="fill:var(--gold)"/>' +
    person(50, 58, 'sc-bob') + person(66, 54, 'sc-bob b2', C) + person(82, 58, 'sc-bob b3') +
    '<path d="M55.5 68h7M76.5 68h-7" style="stroke:' + INK + ';stroke-width:1.7;opacity:.5;stroke-linecap:round"/>' +
    '<path class="sc-glow" d="M66 36c-1.6-2.6-5.4-1.4-5.4 1.3 0 2 2.7 3.9 5.4 5.9 2.7-2 5.4-3.9 5.4-5.9 0-2.7-3.8-3.9-5.4-1.3Z" style="fill:var(--rose)"/>' +
    '</svg>';

  if (type === 'landmark') return '<svg viewBox="0 0 132 88">' +
    '<g class="sc-ray"><g style="opacity:.3">' +
    [0, 45, 90, 135].map(a => '<rect x="65" y="34" width="2" height="52" rx="1" transform="rotate(' + a + ' 66 60)" style="fill:' + C + '"/>').join('') +
    '</g></g>' +
    '<circle cx="66" cy="60" r="16" style="fill:none;stroke:' + C + ';stroke-width:1;opacity:.4"/>' +
    '<path class="sc-spark" d="M66 44l3.4 12.4L82 60l-12.6 3.6L66 76l-3.4-12.4L50 60l12.6-3.6Z" style="fill:' + C + '"/>' +
    '<path class="sc-flash" d="M42 38l1.8 4.6 4.6 1.8-4.6 1.8-1.8 4.6-1.8-4.6-4.6-1.8 4.6-1.8Z" style="fill:#f5efe0"/>' +
    '<path class="sc-flash f2" d="M92 32l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" style="fill:#f5efe0"/>' +
    '<path class="sc-flash f3" d="M86 68l1.3 3.4 3.4 1.3-3.4 1.3-1.3 3.4-1.3-3.4-3.4-1.3 3.4-1.3Z" style="fill:' + C + '"/>' +
    '<g class="sc-orbit"><circle cx="66" cy="38" r="1.8" style="fill:' + C + '"/></g>' +
    '<g class="sc-orbit o2"><circle cx="66" cy="82" r="1.4" style="fill:#f5efe0;opacity:.85"/></g>' +
    '</svg>';

  return '<svg viewBox="0 0 132 88">' +
    ['', 'p2', 'p3'].map(cl => '<circle class="sc-rip ' + cl + '" cx="66" cy="74" r="26" style="fill:none;stroke:' + C + ';stroke-width:1.6"/>').join('') +
    '<g class="sc-orbit"><circle cx="66" cy="48" r="2" style="fill:' + C + '"/></g>' +
    '<g class="sc-orbit o2"><circle cx="66" cy="96" r="1.5" style="fill:' + C + ';opacity:.8"/></g>' +
    '<circle class="sc-spark" cx="46" cy="58" r="1.8" style="fill:' + C + '"/>' +
    '<circle class="sc-spark s2" cx="88" cy="54" r="1.8" style="fill:' + C + '"/>' +
    '<circle class="sc-spark s3" cx="62" cy="42" r="1.8" style="fill:' + C + '"/>' +
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
  for (const mk of markerList) {
    const el = ensureMarker(mk);
    if (hiddenCats.has(mk.cat) && !(mk.count > 1 && mk.events.some(e => !hiddenCats.has(e.cat)))) {
      el.style.display = 'none'; hideScene(mk.id); continue;
    }
    const [sx, sy, vis] = MAP.project(mk.x, mk.y, 0);
    el.style.display = vis ? '' : 'none';
    el.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0)';
    // ambient scene when close
    const s = ppm ? clamp(54 * ppm / 132, 0.3, 2.6) : 0;
    if (vis && s >= 0.4 && sx > -90 && sx < innerWidth + 90 && sy > 50 && sy < innerHeight + 150) {
      const sc = ensureScene({ id: mk.id, cat: mk.cat, anim: mk.events[0].anim || '' });
      sc.style.display = '';
      sc.style.transform = 'translate3d(' + sx + 'px,' + (sy + 2) + 'px,0) translate(-50%,-100%) scale(' + s.toFixed(3) + ')';
    } else hideScene(mk.id);
  }
  // drop markers that no longer exist
  for (const [id, el] of evMarkers) if (!markerList.some(m => m.id === id)) { el.remove(); evMarkers.delete(id); hideScene(id, true); }
  if (popAnchor) placePop();
  positionTransit();
  if (window.__bizTick) window.__bizTick();
  if (typeof positionGeoDot === 'function') positionGeoDot();
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
function evCardHtml(ev) {
  return '<div class="ev-card" data-id="' + ev.id + '">' +
    (ev.img ? '<img class="ev-thumb" loading="lazy" src="' + escapeHtml(ev.img) + '" alt="" onerror="this.remove()"/>' : '') +
    '<div class="card-tx">' +
    '<div class="row1">' + chipHtml(ev.cat) + (ev.official ? '<span class="official-chip">עירייה</span>' : '') +
    (ev.featured ? '<span class="ev-chip" style="background:color-mix(in srgb,var(--gold) 20%,transparent);color:var(--gold)">מומלץ ⭐</span>' : '') +
    '<span class="when">' + fmtWhen(ev) + '</span></div>' +
    '<h3>' + escapeHtml(ev.title) + '</h3>' +
    (ev.muniCat ? '<div class="muni-cat">' + escapeHtml(ev.muniCat) + '</div>' : '') +
    '<div class="where">' + (ev.online
      ? '<span class="ev-online">🌐 אונליין / ללא מיקום — לפרטים באתר העירייה</span>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/></svg>' + escapeHtml(ev.addr || CFG.nameHe)) + '</div>' +
    (ev.desc ? '<div class="desc">' + escapeHtml(ev.desc) + '</div>' : '') +
    '</div></div>';
}
function renderEvList() {
  const list = $('evList');
  const vis = allEvents().filter(e => !hiddenCats.has(e.cat))
    .sort((a, b) => ((a.date || '9999') + (a.time || '')) < ((b.date || '9999') + (b.time || '')) ? -1 : 1);
  if (!vis.length) {
    list.innerHTML = '<div class="ev-none">אין עדיין אירועים על המפה.<br/>לחצו על «הוספת אירוע» וסמנו נקודה בעיר.</div>';
    return;
  }
  // date sections: today / tomorrow / this week / later
  const today = localISO(0), tomorrow = localISO(1), week = localISO(7);
  const secOf = ev => !ev.date ? 'בהמשך' : ev.date === today ? 'היום' : ev.date === tomorrow ? 'מחר' : ev.date <= week ? 'השבוע' : 'בהמשך';
  let html = '', lastSec = '';
  for (const ev of vis) {
    const sec = secOf(ev);
    if (sec !== lastSec) { html += '<div class="ev-sec">' + sec + '</div>'; lastSec = sec; }
    html += evCardHtml(ev);
  }
  list.innerHTML = html;
}
$('evList').addEventListener('click', e => {
  const card = e.target.closest('.ev-card');
  if (!card) return;
  const ev = allEvents().find(x => x.id === card.dataset.id);
  if (!ev) return;
  if (ev.online || typeof ev.x !== 'number') {
    if (ev.link) window.open(ev.link, '_blank', 'noopener');
    return;
  }
  closePanel();
  MAP.flyTo({ cx: ev.x, cy: ev.y, dist: 620, done: () => showPop(ev.id) });
});

// popup (shared between events and plans)
let popFor = null, popAnchor = null;
const POP_X = '<button class="pop-x" data-act="close" aria-label="סגירה"><svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
function showPop(id) {
  const ev = allEvents().find(e => e.id === id);
  if (!ev) return;
  busPopStop = null; clearInterval(busTimer);
  popFor = id;
  popAnchor = { x: ev.x, y: ev.y, lift: 62 };
  const pop = $('pop');
  pop.innerHTML =
    (ev.img ? '<img class="pop-hero" loading="lazy" src="' + escapeHtml(ev.img) + '" alt="" onerror="this.remove()"/>' : '') +
    POP_X +
    '<div class="row1">' + chipHtml(ev.cat) + (ev.official ? '<span class="official-chip">עירייה</span>' : '') +
    '<span class="when">' + fmtWhen(ev) + '</span></div>' +
    '<h3>' + escapeHtml(ev.title) + '</h3>' +
    (ev.muniCat ? '<div class="muni-cat" style="margin-top:4px">' + escapeHtml(ev.muniCat) +
      (ev.audience && ev.audience.length ? ' · ' + escapeHtml(ev.audience.join(', ')) : '') + '</div>' : '') +
    '<div class="where"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" style="flex:none"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>' + escapeHtml(ev.addr || CFG.nameHe) + '</div>' +
    (ev.desc ? '<div class="desc">' + escapeHtml(ev.desc) + '</div>' : '') +
    (ev.link ? '<a class="pop-primary" href="' + escapeHtml(ev.link) + '" target="_blank" rel="noopener">לפרטים והרשמה<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>' : '') +
    '<div class="acts">' +
    navActsHtml(ev.x, ev.y, ev.title) +
    '<button class="pop-act" data-act="fly"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>התקרבות</button>' +
    (ev.official ? '' : '<button class="pop-act del" data-act="del"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h8l1-13"/></svg>הסרה</button>') +
    '</div>';
  pop.classList.add('open');
  popOpened();
  placePop();
}
const DOW = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
function shortWhen(ev) {
  if (!ev.date) return '';
  const dt = new Date(ev.date + 'T12:00');
  return DOW[dt.getDay()] + ' ' + dt.getDate() + '.' + (dt.getMonth() + 1) + (ev.time ? '\n' + ev.time : '');
}
function showVenuePop(mk) {
  closePop();
  popAnchor = { x: mk.x, y: mk.y, lift: 62 };
  const evs = mk.events.slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1).slice(0, 9);
  const pop = $('pop');
  pop.innerHTML = POP_X +
    '<div class="row1"><span class="official-chip">עירייה</span><span class="when">' + mk.count + ' אירועים קרובים</span></div>' +
    '<h3>' + escapeHtml(mk.locName || evs[0].locName || 'מוקד אירועים עירוני') + '</h3>' +
    '<div class="where"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" style="flex:none"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>' + escapeHtml(evs[0].addr || '') + '</div>' +
    '<div class="ven-list">' + evs.map(ev =>
      '<a class="ven-row" href="' + escapeHtml(ev.link || '#') + '" target="_blank" rel="noopener">' +
      '<span class="vw">' + escapeHtml(shortWhen(ev)).replace('\n', '<br/>') + '</span>' +
      '<span class="vt">' + escapeHtml(ev.title) + '</span>' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>').join('') +
    '</div>' +
    (mk.count > 9 ? '<div class="bus-note">ועוד ' + (mk.count - 9) + ' אירועים במקום הזה, ברשימה המלאה</div>' : '') +
    '<div class="acts">' + navActsHtml(mk.x, mk.y, mk.locName || 'מוקד אירועים') + '</div>';
  pop.classList.add('open');
  popOpened();
  placePop();
}
function placePop() {
  const pop = $('pop');
  if (!popAnchor) return;
  const [sx, sy, vis] = MAP.project(popAnchor.x, popAnchor.y, 0);
  if (!vis) { closePop(); return; }
  const w = pop.offsetWidth || 300, h = pop.offsetHeight || 180;
  const left = clamp(sx - w / 2, 10, innerWidth - w - 10);
  const top = clamp(sy - h - (popAnchor.lift || 20), 10, innerHeight - h - 10);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  // the tail points at the anchor; hide it when clamping pushed the card off the point
  const tailX = sx - left;
  if (Math.abs(top + h - sy) < 96 && tailX > 22 && tailX < w - 22) {
    pop.style.setProperty('--tail-x', tailX.toFixed(0) + 'px');
    pop.classList.remove('no-tail');
  } else pop.classList.add('no-tail');
}
// plan details popup
const PLAN_KIND = {
  a: { label: 'בהליך תכנון', color: '#a186e0' },
  p: { label: 'אושרה לאחרונה', color: '#2fb3a8' },
  r: { label: 'תמ״א 38 / התחדשות עירונית', color: '#e8845a' },
};
function showPlanPop(plan, x, y) {
  popFor = null;
  curPlanNum = plan.n;
  popAnchor = { x, y, lift: 16 };
  const k = PLAN_KIND[plan.k];
  const meta = [];
  if (plan.n) meta.push('תוכנית <b>' + escapeHtml(plan.n) + '</b>');
  if (plan.y) meta.push('<b>' + plan.y + '</b>');
  if (plan.d) meta.push('<b>' + plan.d.toLocaleString('he-IL') + '</b> דונם');
  if (plan.u) meta.push('<b>' + (plan.u > 0 ? '+' : '') + plan.u.toLocaleString('he-IL') + '</b> יח״ד');
  const pop = $('pop');
  pop.innerHTML = POP_X +
    '<div class="row1"><span class="ev-chip" style="background:color-mix(in srgb,' + k.color + ' 18%,transparent);color:' + k.color + '">' + k.label + '</span>' +
    '<span class="when">' + escapeHtml(plan.s) + '</span></div>' +
    '<h3>' + escapeHtml(plan.t || 'תוכנית ' + plan.n) + '</h3>' +
    '<div class="pop-meta">' + meta.join('<span>·</span>') + '</div>' +
    (plan.o ? '<div class="desc">' + escapeHtml(plan.o) + '</div>' : '') +
    (plan.url ? '<a class="pop-primary" href="' + escapeHtml(plan.url) + '" target="_blank" rel="noopener">לתיק התכנון הרשמי<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>' : '') +
    '<div class="acts">' + navActsHtml(x, y, plan.t || ('תוכנית ' + plan.n)) + '</div>';
  pop.classList.add('open');
  popOpened();
  placePop();
}
$('pop').addEventListener('click', e => {
  const btn = e.target.closest('.pop-act,.pop-x');
  if (!btn) return;
  const ev = allEvents().find(x => x.id === popFor);
  if (btn.dataset.act === 'close') { closePop(); }
  else if (btn.dataset.act === 'fly' && ev) MAP.flyTo({ cx: ev.x, cy: ev.y, dist: 320 });
  else if (btn.dataset.act === 'del' && ev && !ev.official) {
    events = events.filter(x => x.id !== ev.id);
    const el = evMarkers.get(ev.id);
    if (el) { el.remove(); evMarkers.delete(ev.id); }
    saveEvents(); rebuildMarkerList(); renderEvList(); closePop(); positionMarkers();
    showToast('האירוע הוסר מהמפה');
  }
});
function closePop(fromBack) {
  $('pop').classList.remove('open');
  popFor = null; popAnchor = null;
  busPopStop = null;
  curPlanNum = null;
  window.__curBiz = null;
  clearInterval(busTimer);
  if (fromBack !== true) uiClosed('pop');
}
function popOpened() { uiOpened('pop', () => closePop(true)); }
window.popOpened = popOpened;
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
function openPanel() { $('evPanel').classList.add('open'); uiOpened('evPanel', () => closePanel(true)); }
function closePanel(fromBack) {
  $('evPanel').classList.remove('open');
  if (fromBack !== true) uiClosed('evPanel');
}
$('eventsRowBtn').addEventListener('click', () => { closeLayersPop(); renderEvList(); openPanel(); });
$('evClose').addEventListener('click', () => closePanel());

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
  uiOpened('evModal', () => closeEvModal(true));
  setTimeout(() => $('fTitle').focus(), 60);
}
function closeEvModal(fromBack) {
  $('evModalBg').classList.remove('open');
  if (fromBack !== true) uiClosed('evModal');
}
$('fCancel').addEventListener('click', () => closeEvModal());
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
  rebuildMarkerList();
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
  $('layersDot').classList.toggle('on', MAP.LAYERS.plans || MAP.LAYERS.transit || !!window.__bizOn);
}
window.syncLayerButtons = syncLayerButtons;
// layers popover (anchored beside the rail button)
function closeLayersPop() { $('layersPop').classList.remove('show'); }
$('layersBtn').addEventListener('click', () => {
  const pop = $('layersPop');
  if (pop.classList.contains('show')) { closeLayersPop(); return; }
  const r = $('layersBtn').getBoundingClientRect();
  pop.style.left = Math.round(r.right + 12) + 'px';
  pop.classList.add('show');
  const h = pop.offsetHeight || 220;
  pop.style.top = Math.round(clamp(r.top + r.height / 2 - h / 2, 12, innerHeight - h - 12)) + 'px';
});
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#layersPop') && !e.target.closest('#layersBtn')) closeLayersPop();
});
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
  const payload = { app: CFG.slug + '-living-map', version: 1, exported: new Date().toISOString(), events: events.filter(e => !hiddenCats.has(e.cat)) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'אירועים-' + CFG.nameHe.replace(/ /g, '-') + '.json';
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
    saveEvents(); rebuildMarkerList(); renderEvList(); positionMarkers();
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
const toggleTheme = () => applyTheme(themeName === 'light' ? 'dark' : 'light', true);
$('themeBtn').addEventListener('click', toggleTheme);
$('themeBtnM').addEventListener('click', toggleTheme);
function closeAbout(fromBack) {
  $('aboutBg').classList.remove('open');
  if (fromBack !== true) uiClosed('about');
}
$('aboutBtn').addEventListener('click', () => { $('aboutBg').classList.add('open'); uiOpened('about', () => closeAbout(true)); });
$('aboutClose').addEventListener('click', () => closeAbout());
$('aboutBg').addEventListener('pointerdown', e => { if (e.target === e.currentTarget) closeAbout(); });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('layersPop').classList.contains('show')) closeLayersPop();
    else if ($('evModalBg').classList.contains('open')) closeEvModal();
    else if ($('aboutBg').classList.contains('open')) closeAbout();
    else if ($('noticesBg').classList.contains('open')) closeNotices();
    else if (placing) setPlacing(false);
    else if (popFor || window.__curBiz || busPopStop) closePop();
    else if ($('evPanel').classList.contains('open')) closePanel();
    else if (typeof closeAiPanel === 'function' && $('aiPanel').classList.contains('open')) closeAiPanel();
    else closeResults();
  }
});

// ---------- official city content (published from the CMS) ----------
const CITY_CONTENT_URLS = [
  ...(CFG.contentRawBase ? [CFG.contentRawBase + '/data/city-events.json'] : []),
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
const MUNI_EVENTS_URLS = [
  ...(CFG.contentRawBase ? [CFG.contentRawBase + '/data/muni-events.json'] : []),
  'data/muni-events.json',
];
async function fetchFirst(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (r.ok) return await r.json();
    } catch (e) {}
  }
  return null;
}
function normalizeMuniEvent(ev) {
  if (!ev || typeof ev.title !== 'string') return null;
  return {
    id: String(ev.id || 'muni-' + Math.random().toString(36).slice(2)),
    title: ev.title, cat: catById[ev.cat] ? ev.cat : 'city',
    anim: ev.anim || '', muniCat: ev.muniCat || '',
    audience: Array.isArray(ev.audience) ? ev.audience : [],
    date: ev.date || '', time: ev.time || '',
    desc: '', link: typeof ev.link === 'string' && /^https:/.test(ev.link) ? ev.link : '',
    img: typeof ev.img === 'string' && /^https:/.test(ev.img) ? ev.img : '',
    x: typeof ev.x === 'number' ? ev.x : null,
    y: typeof ev.y === 'number' ? ev.y : null,
    addr: [ev.locName, ev.address].filter(Boolean).join(' · ') + (ev.approx ? ' (משוער)' : ''),
    locName: ev.locName || '', online: ev.x == null,
    featured: !!ev.featured,
    official: true, muni: true,
  };
}
// ---- live fetch straight from the municipality API (CORS-open; users browse from local IPs) ----
const MUNI_API = CFG.muni ? CFG.muni.api : null;
const MUNI_SITE = CFG.muni ? CFG.muni.site : '';
const canonName = s => norm(s).replace(/^(רחוב|שדרות|דרך|שד)\s+/, '')
  .split(' ').map(w => w.replace(/י+/g, 'י')).sort().join(' ').replace(/י/g, '');
const MUNI_STOPWORDS = new Set(['בית', 'מרכז', 'רחוב', 'תיאטרון', 'מועדון', 'ספריית', 'ספריה', 'הספריה', 'אולם', 'מתחם', 'גן', 'פארק', 'תרבות', 'קהילתי', 'עירוני', 'העירוני', 'שם', 'על']);
let streetCanonIdx = null, roadCentIdx = null;
function buildMuniGeoIdx() {
  if (streetCanonIdx) return;
  streetCanonIdx = new Map();
  for (const e of streetIndex.values()) streetCanonIdx.set(canonName(e.name), e);
  roadCentIdx = new Map();
  for (const r of namedRoads) {
    const k = canonName(r.name);
    const c = roadCentIdx.get(k) || { x: 0, y: 0, n: 0 };
    c.x += r.x; c.y += r.y; c.n++;
    roadCentIdx.set(k, c);
  }
}
function roadCentroid(name) {
  const c = roadCentIdx.get(canonName(name));
  return c ? { x: c.x / c.n, y: c.y / c.n, approx: true } : null;
}
function muniGeocode(address, locName) {
  buildMuniGeoIdx();
  if (address) {
    const a = norm(address);
    const m = a.match(/^(.*?)[\s,]+(\d+)/);
    const stName = (m ? m[1] : a).replace(/^(רחוב|שדרות|דרך)\s+/, '');
    const st = streetIndex.get(stName) || streetIndex.get(stripHe(stName)) || streetCanonIdx.get(canonName(stName));
    if (st) {
      if (m) {
        const loc = resolveAddress(st, m[2]);
        if (loc) return { x: loc.x, y: loc.y, approx: !!loc.approx };
      }
      if (st.cx) return { x: st.cx, y: st.cy, approx: true };
    }
    const rc = roadCentroid(stName);
    if (rc) return rc;
  }
  const q = norm(locName || '');
  if (q.length >= 3) {
    for (const alias in CFG.venueAliases) {
      if (q.includes(alias)) { const rc = roadCentroid(CFG.venueAliases[alias]); if (rc) return rc; }
    }
    const qh = stripHe(q);
    const poisIdx = searchItems.filter(it => it.type === 'poi');
    for (const p of poisIdx) if (p.n === q || p.n === qh) return { x: p.x, y: p.y, approx: false };
    for (const p of poisIdx) if ((p.n.includes(q) || q.includes(p.n)) && p.n.length > 4) return { x: p.x, y: p.y, approx: true };
    const words = q.split(' ').filter(w => w.length >= 4 && !MUNI_STOPWORDS.has(w));
    for (const p of poisIdx) if (words.some(w => p.n.split(' ').includes(w))) return { x: p.x, y: p.y, approx: true };
  }
  return null;
}
function muniCatMap(muniCat, title) {
  const s = (muniCat || '') + ' ' + (title || '');
  if (/ספורט|ריצה|מרוץ|צעדה|אופניים|יוגה|התעמלות/.test(s)) return ['sport', 'sport'];
  if (/תיאטרון|מוזיקה|הופע|קונצרט|מחול|אמנות|סרט|קולנוע|הצגה/.test(s)) return ['culture', 'concert'];
  if (/יריד|שוק|פסטיבל/.test(s)) return ['city', 'market'];
  if (/סיור|טיול|מורשת/.test(s)) return ['poi', 'landmark'];
  return ['community', 'community'];
}
async function fetchMuniLive() {
  if (!MUNI_API) return null; // city without a municipal events feed
  try {
    const r = await fetch(MUNI_API, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const data = await r.json();
    const today = localISO(0);
    const featured = new Set((data.content.sliderEvents || []).map(e => e.detailsLink?.url).filter(Boolean));
    const seen = new Set();
    const out = [];
    for (const e of [...(data.content.sliderEvents || []), ...(data.content.closeEvents || [])]) {
      const key = e.detailsLink?.url || (e.title || '') + '|' + (e.date || '');
      if (seen.has(key)) continue;
      seen.add(key);
      const date = (e.date || '').slice(0, 10);
      if (!date || date < today) continue;
      let time = /T(\d{2}:\d{2})/.exec(e.hour || '')?.[1] || '';
      if (time === '00:00') time = '';
      const locName = e.eventLocation?.name || e.location || '';
      const address = e.eventLocation?.address || '';
      const geo = muniGeocode(address, locName) || (e.location ? muniGeocode('', e.location) : null);
      const [cat, anim] = muniCatMap(e.category?.name, e.title);
      out.push(normalizeMuniEvent({
        id: 'muni-' + key.replace(/[^a-z0-9-]/gi, '').slice(-60),
        title: (e.title || '').trim().slice(0, 90),
        cat, anim, muniCat: e.category?.name || '',
        audience: (e.audienceType || []).map(a => a.name).slice(0, 3),
        date, time,
        locName: locName.slice(0, 60), address: address.slice(0, 60),
        x: geo ? geo.x : null, y: geo ? geo.y : null,
        approx: geo ? !!geo.approx : undefined,
        link: e.detailsLink?.url ? MUNI_SITE + e.detailsLink.url : MUNI_SITE + '/event-lobby',
        img: e.linkMobilePreview ? MUNI_SITE + e.linkMobilePreview : null,
        featured: featured.has(e.detailsLink?.url),
      }));
    }
    const list = out.filter(Boolean);
    return list.length ? list : null;
  } catch (e) { return null; }
}
async function loadCityContent() {
  const today = localISO(0);
  const [data, muniLive] = await Promise.all([fetchFirst(CITY_CONTENT_URLS), fetchMuniLive()]);
  if (data) {
    cityEvents = (data.events || []).map(normalizeCityEvent).filter(Boolean)
      .filter(ev => !ev.endDate || ev.endDate >= today)
      .filter(ev => !(ev.date && !data.keepPast && ev.date < today));
    cityNotices = (data.notices || []).filter(n => n && typeof n.title === 'string')
      .filter(n => (!n.from || n.from <= today) && (!n.to || n.to >= today));
  }
  if (muniLive) {
    muniEvents = muniLive; // freshest: straight from the municipality, seconds old
  } else {
    const muni = await fetchFirst(MUNI_EVENTS_URLS) || window.MUNI_FALLBACK; // committed / embedded snapshot
    if (muni) muniEvents = (muni.events || []).map(normalizeMuniEvent).filter(Boolean)
      .filter(ev => ev.date >= today);
  }
  rebuildMarkerList();
  renderNotices();
  renderEvList();
  positionMarkers();
  MAP.requestRender();
}
// long-open tabs keep themselves fresh
setInterval(loadCityContent, 30 * 60 * 1000);
function renderNotices() {
  const badge = $('bellBadge');
  badge.textContent = cityNotices.length;
  badge.classList.toggle('on', cityNotices.length > 0);
  $('noticesList').innerHTML = (cityNotices.length
    ? cityNotices.map(n =>
      '<div class="notice"><h4>' + escapeHtml(n.title) + '</h4>' +
      (n.body ? '<div class="nb">' + escapeHtml(n.body) + '</div>' : '') +
      (n.link && /^https?:/.test(n.link) ? '<div class="nd"><a href="' + escapeHtml(n.link) + '" target="_blank" rel="noopener">לפרטים נוספים ←</a></div>' : '') +
      (n.to ? '<div class="nd">בתוקף עד ' + escapeHtml(n.to) + '</div>' : '') +
      '</div>').join('')
    : '<div class="ev-none">אין הודעות חדשות מהעירייה.</div>');
}
function closeNotices(fromBack) {
  $('noticesBg').classList.remove('open');
  if (fromBack !== true) uiClosed('notices');
}
$('bellBtn').addEventListener('click', () => { $('noticesBg').classList.add('open'); uiOpened('notices', () => closeNotices(true)); });
$('noticesClose').addEventListener('click', () => closeNotices());
$('noticesBg').addEventListener('pointerdown', e => { if (e.target === e.currentTarget) closeNotices(); });

// ---------- geo helpers, deep links, share, locate, navigation ----------
const GEO = CITY_D.meta;
const toGeo = (x, y) => [GEO.lat0 + y / 110540, GEO.lon0 + x / (Math.cos(GEO.lat0 * Math.PI / 180) * 111320)];
const fromGeo = (lat, lon) => [(lon - GEO.lon0) * Math.cos(GEO.lat0 * Math.PI / 180) * 111320, (lat - GEO.lat0) * 110540];
function wazeLink(x, y) {
  const [lat, lon] = toGeo(x, y);
  return 'https://waze.com/ul?ll=' + lat.toFixed(6) + ',' + lon.toFixed(6) + '&navigate=yes';
}
function navActsHtml(x, y, name) {
  return '<button class="pop-act" data-act="nav" data-nx="' + x + '" data-ny="' + y + '" data-nn="' + escapeHtml(String(name || '')) + '">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20.5V9.4a2.4 2.4 0 0 1 2.4-2.4h4.8M13.5 4.5 16.7 7l-3.2 2.5M9 20.5h6"/></svg>מסלול</button>' +
    '<a class="pop-act" href="' + wazeLink(x, y) + '" target="_blank" rel="noopener">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 21 3l-8 18-2.5-7.5Z"/></svg>Waze</a>';
}

// deep links: #v=x,y,dist,tilt,bearing&ev=id / &stop=code / &plan=number
let pendingDeepLink = null;
function parseDeepLink() {
  const h = location.hash.slice(1);
  if (!h) return null;
  const p = new URLSearchParams(h);
  const out = {};
  if (p.get('v')) {
    const v = p.get('v').split(',').map(Number);
    if (v.length >= 3 && v.every(isFinite)) out.cam = { cx: v[0], cy: v[1], dist: v[2], tilt: v[3] ?? 0.8, bearing: v[4] ?? 0 };
  }
  if (p.get('ev')) out.ev = p.get('ev');
  if (p.get('stop')) out.stop = +p.get('stop');
  if (p.get('plan')) out.plan = p.get('plan');
  if (p.get('biz')) out.biz = p.get('biz');
  if (p.get('layers')) out.layers = p.get('layers');
  return (out.cam || out.ev || out.stop || out.plan || out.biz) ? out : null;
}
let curPlanNum = null; // tracked for sharing
function buildShareUrl() {
  const c = MAP.cam;
  let h = '#v=' + [c.cx.toFixed(0), c.cy.toFixed(0), c.dist.toFixed(0), c.tilt.toFixed(2), c.bearing.toFixed(2)].join(',');
  const lay = [MAP.LAYERS.plans ? 'p' : '', MAP.LAYERS.transit ? 't' : ''].join('');
  if (lay) h += '&layers=' + lay;
  if (busPopStop) h += '&stop=' + busPopStop.code;
  else if (popFor) h += '&ev=' + encodeURIComponent(popFor);
  else if (window.__curBiz) h += '&biz=' + encodeURIComponent(window.__curBiz);
  else if (curPlanNum) h += '&plan=' + encodeURIComponent(curPlanNum);
  return CFG.deployUrl + '/' + h;
}
$('shareBtn').addEventListener('click', async () => {
  const url = buildShareUrl();
  const title = CFG.title;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(url);
    showToast('הקישור הועתק — שלחו למי שתרצו 🔗');
  } catch (e) { prompt('העתיקו את הקישור:', url); }
});
function applyDeepLink(dl) {
  if (dl.layers) {
    MAP.setLayer('plans', dl.layers.includes('p'));
    MAP.setLayer('transit', dl.layers.includes('t'));
    syncLayerButtons();
  }
  if (dl.cam) Object.assign(MAP.cam, {
    cx: clamp(dl.cam.cx, MAP.camLimits.minX, MAP.camLimits.maxX),
    cy: clamp(dl.cam.cy, MAP.camLimits.minY, MAP.camLimits.maxY),
    dist: clamp(dl.cam.dist, MAP.camLimits.minDist, MAP.camLimits.maxDist),
    tilt: clamp(dl.cam.tilt, MAP.camLimits.minTilt, MAP.camLimits.maxTilt),
    bearing: dl.cam.bearing || 0,
  });
  MAP.computeVP(); MAP.requestRender();
  // move the camera onto the entity, then open its popup (popups close off-screen)
  const goAndOpen = (x, y, open) => {
    const dist = Math.min(MAP.cam.dist, 800);
    if (MAP.QA_MODE) {
      Object.assign(MAP.cam, { cx: x, cy: y, dist });
      MAP.drawOnce();
      open();
      MAP.drawOnce();
    } else MAP.flyTo({ cx: x, cy: y, dist, T: 700, done: open });
  };
  const tryEntity = () => {
    if (dl.stop) {
      const s = busStops.find(x => x.code === dl.stop);
      if (!s) return false;
      MAP.setLayer('transit', true); syncLayerButtons();
      goAndOpen(s.x, s.y, () => showBusPop(s));
      return true;
    }
    if (dl.ev) {
      const e = allEvents().find(x => x.id === dl.ev);
      if (!e) return false;
      if (typeof e.x === 'number') goAndOpen(e.x, e.y, () => showPop(e.id));
      else if (e.link) window.open(e.link, '_blank', 'noopener');
      return true;
    }
    if (dl.biz) {
      if (!window.BIZAPI) return false;
      const b = BIZAPI.byId(dl.biz);
      if (!b) return true; // unknown id — nothing to open
      goAndOpen(b.x, b.y, () => BIZAPI.open(b));
      return true;
    }
    if (dl.plan) {
      const p = (CITY_D.plans || []).find(x => x.n === dl.plan);
      if (!p) return false;
      MAP.setLayer('plans', true); syncLayerButtons();
      const r = p.r[0];
      goAndOpen(r[0] * UNIT, r[1] * UNIT, () => showPlanPop(p, r[0] * UNIT, r[1] * UNIT));
      return true;
    }
    return true;
  };
  // shared content loads async; retry until the entity exists
  setTimeout(() => {
    if (tryEntity()) return;
    setTimeout(() => {
      if (tryEntity()) return;
      setTimeout(tryEntity, 3200);
    }, 1900);
  }, 600);
}

// my location
let geoWatch = null, geoPos = null;
function positionGeoDot() {
  const el = $('geoDot');
  if (!geoPos) { el.style.display = 'none'; return; }
  const [sx, sy, vis] = MAP.project(geoPos[0], geoPos[1], 0);
  el.style.display = vis ? '' : 'none';
  el.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0)';
}
$('geoBtn').addEventListener('click', () => {
  if (geoWatch != null) {
    navigator.geolocation.clearWatch(geoWatch);
    geoWatch = null; geoPos = null;
    positionGeoDot();
    $('geoBtn').classList.remove('on');
    return;
  }
  if (!navigator.geolocation) { showToast('הדפדפן אינו תומך באיתור מיקום'); return; }
  showToast('מאתר אתכם…');
  let first = true;
  geoWatch = navigator.geolocation.watchPosition(pos => {
    const [x, y] = fromGeo(pos.coords.latitude, pos.coords.longitude);
    const B = MAP.bbox;
    if (x < B.minX - 4000 || x > B.maxX + 4000 || y < B.minY - 4000 || y > B.maxY + 4000) {
      showToast('נראה שאתם מחוץ ל' + CFG.nameHe + ' — המפה מכסה את העיר בלבד');
      navigator.geolocation.clearWatch(geoWatch); geoWatch = null;
      return;
    }
    geoPos = [x, y];
    $('geoBtn').classList.add('on');
    positionGeoDot();
    if (first) { first = false; MAP.flyTo({ cx: x, cy: y, dist: 520 }); showToast('הנה אתם 📍'); }
  }, err => {
    showToast(err.code === 1 ? 'כדי למצוא אתכם, אשרו גישה למיקום' : 'איתור המיקום נכשל');
    geoWatch = null;
  }, { enableHighAccuracy: true, maximumAge: 5000 });
});

// PWA install — the button lives in the About dialog so the rail never reflows
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  $('installBtn').style.display = '';
  if (!store.getItem('rg.installHint') && !MAP.QA_MODE) {
    store.setItem('rg.installHint', '1');
    setTimeout(() => showToast('📲 אפשר להתקין את המפה כאפליקציה — דרך כפתור המידע ⓘ'), 22000);
  }
});
$('installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const res = await installPrompt.userChoice.catch(() => null);
  if (res && res.outcome === 'accepted') { showToast('המפה מותקנת אצלכם 🎉'); $('installBtn').style.display = 'none'; }
  installPrompt = null;
});
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.includes('claude') && !MAP.QA_MODE) {
  try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
}

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
    // theme: stored → host stamp → time of day (dusk look after sunset)
    const hostTheme = document.documentElement.getAttribute('data-theme');
    const stored = store.getItem('rg.theme');
    const hour = new Date().getHours();
    const byTime = (hour >= 7 && hour < 18) ? 'light' : 'dark';
    applyTheme(stored && THEMES[stored] ? stored : (hostTheme && THEMES[hostTheme] ? hostTheme : byTime), false);
    loadEvents();
    rebuildMarkerList();
    renderEvList();
    try {
      const saved = JSON.parse(store.getItem(LAYER_KEY) || 'null');
      if (saved) { MAP.LAYERS.plans = !!saved.plans; MAP.LAYERS.transit = !!saved.transit; layerToastShown = { plans: true, transit: true }; }
    } catch (e) {}
    syncLayerButtons();
    loadCityContent(); // async; merges official events when it lands
    if (PICK_MODE) {
      for (const id of ['dock', 'legend', 'bellBtn', 'aboutBtn', 'brand']) { const el = $(id); if (el) el.style.display = 'none'; }
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
      if (/dark/.test(location.search + location.hash)) applyTheme('dark', false);
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
        const rm = qs.match(/results(?:=([^&]+))?/);
        if (rm) {
          const term = rm[1] ? decodeURIComponent(rm[1]) : 'ביאליק 12';
          sInput.value = term; sBox.classList.add('hasText'); renderResults(runSearch(term));
          setTimeout(() => { renderResults(runSearch(term)); MAP.drawOnce(); }, 1600); // catch async-loaded events
        }
        const dlq = parseDeepLink();
        if (dlq) {
          applyDeepLink(dlq);
          MAP.drawOnce();
          setTimeout(() => MAP.drawOnce(), 1400);
        }
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
        if (window.__qaExt) window.__qaExt(qs);
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
      const dl = parseDeepLink();
      if (dl) {
        Object.assign(MAP.cam, { cx: tgt.cx, cy: tgt.cy, dist: 2600, tilt: 0.8, bearing: -0.35 });
        applyDeepLink(dl);
      } else {
        MAP.flyTo({ ...tgt, dist: 2600, tilt: 0.8, bearing: -0.35, T: 3400 });
      }
      // "happening today" badge on the events button
      setTimeout(() => {
        const today = localISO(0);
        if (allEvents().some(e => e.date === today && !hiddenCats.has(e.cat))) {
          if (!store.getItem('rg.todayToast.' + today)) {
            store.setItem('rg.todayToast.' + today, '1');
            showToast('🎉 יש אירועים בעיר היום — הציצו ברשימה');
          }
        }
      }, 2500);
    }
  } catch (err) {
    ERRLOG.push(String(err && err.stack || err));
    reportFatal(err && err.message || String(err));
    throw err;
  }
}
boot();
