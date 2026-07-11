/* ======================= ניווט ומקלטים (app5) =======================
   מסלולים אמיתיים ברשת הרחובות (OSRM ציבורי), הוראות בעברית,
   קו מסלול חי על המפה התלת־ממדית, וניווט בלחיצה אחת למקלט הקרוב. */

const NAV = { on: false, mode: 'foot', from: null, to: null, toName: '', route: null, stepIdx: -1, seq: 0, lastGeo: null, offSince: 0, fromLive: false };
const NAV_BASES = {
  foot: ['https://routing.openstreetmap.de/routed-foot/route/v1/foot/'],
  car: ['https://routing.openstreetmap.de/routed-car/route/v1/driving/', 'https://router.project-osrm.org/route/v1/driving/'],
};

/* ---------- הוראות בעברית מתוך צעדי OSRM ---------- */
const NAV_MOD_HE = {
  left: 'שמאלה', right: 'ימינה', 'slight left': 'קלות שמאלה', 'slight right': 'קלות ימינה',
  'sharp left': 'חדות שמאלה', 'sharp right': 'חדות ימינה', straight: 'ישר', uturn: 'פניית פרסה',
};
function navStepInstr(st) {
  const t = st.maneuver.type, m = NAV_MOD_HE[st.maneuver.modifier] || '';
  const nm = st.name ? (' לרחוב ' + st.name) : '';
  if (t === 'depart') return st.name ? 'צאו לדרך ברחוב ' + st.name : 'צאו לדרך';
  if (t === 'arrive') {
    if (st.maneuver.modifier === 'left') return 'הגעתם — היעד משמאלכם';
    if (st.maneuver.modifier === 'right') return 'הגעתם — היעד מימינכם';
    return 'הגעתם ליעד';
  }
  if (t === 'roundabout' || t === 'rotary') return 'בכיכר, צאו ביציאה ה־' + (st.maneuver.exit || 1) + nm;
  if (t === 'on ramp') return 'עלו על הכביש' + nm;
  if (t === 'off ramp') return 'רדו ביציאה' + nm;
  if (t === 'merge') return 'השתלבו ' + (m || 'בנתיב') + nm;
  if (t === 'new name' || (t === 'continue' && (!m || m === 'ישר'))) return 'המשיכו' + (st.name ? ' ברחוב ' + st.name : ' ישר');
  if (m) return 'פנו ' + m + nm;
  return 'המשיכו' + nm;
}
const navFmtDur = s => {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return min + ' דק׳';
  return Math.floor(min / 60) + ' שע׳ ' + (min % 60 ? (min % 60) + ' דק׳' : '');
};

/* ---------- שליפת מסלול ---------- */
async function osrmRoute(from, to, mode) {
  const [flat, flon] = toGeo(from[0], from[1]);
  const [tlat, tlon] = toGeo(to[0], to[1]);
  const pair = flon.toFixed(6) + ',' + flat.toFixed(6) + ';' + tlon.toFixed(6) + ',' + tlat.toFixed(6);
  for (const base of NAV_BASES[mode]) {
    try {
      const r = await fetch(base + pair + '?overview=full&geometries=geojson&steps=true&alternatives=false',
        { signal: AbortSignal.timeout(12000) });
      const d = await r.json();
      if (d.code !== 'Ok' || !d.routes || !d.routes[0]) continue;
      const rt = d.routes[0];
      const coords = rt.geometry.coordinates.map(([lon, lat]) => fromGeo(lat, lon));
      const steps = [];
      for (const leg of rt.legs) for (const st of leg.steps) {
        const [lon, lat] = st.maneuver.location;
        const [x, y] = fromGeo(lat, lon);
        steps.push({ instr: navStepInstr(st), dist: st.distance, x, y });
      }
      return { coords, steps, dist: rt.distance, dur: rt.duration, approx: false };
    } catch (e) { /* המראה הבאה */ }
  }
  // כל השרתים נפלו — קו אוויר גלוי־ביושר במקום כלום
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return {
    coords: [from.slice(), to.slice()],
    steps: [{ instr: 'שירות המסלולים לא זמין — מוצג קו אוויר ליעד', dist, x: from[0], y: from[1] }],
    dist, dur: dist / (mode === 'foot' ? 1.25 : 7), approx: true,
  };
}

/* ---------- ציור המסלול על המפה ---------- */
function navDrawRoute() {
  if (!NAV.on || !NAV.route) return;
  let d = '', pen = false;
  for (const [x, y] of NAV.route.coords) {
    const [sx, sy, vis] = MAP.project(x, y, 0);
    if (!vis) { pen = false; continue; }
    d += (pen ? 'L' : 'M') + sx.toFixed(1) + ' ' + sy.toFixed(1);
    pen = true;
  }
  $('routeCase').setAttribute('d', d);
  $('routeLine').setAttribute('d', d);
  const [dx, dy, dvis] = MAP.project(NAV.to[0], NAV.to[1], 0);
  $('navDest').style.display = dvis ? '' : 'none';
  $('navDest').style.transform = 'translate3d(' + dx + 'px,' + (dy - 13) + 'px,0)';
}

function navFit() {
  const c = NAV.route.coords;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [x, y] of c) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const span = Math.max(maxX - minX, (maxY - minY) * 1.4, 240);
  MAP.flyTo({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 - span * 0.1, dist: Math.min(span * 1.5 + 160, 5200), T: 1100 });
}

/* ---------- רשימת שלבים ---------- */
function navRenderSteps() {
  const box = $('navSteps');
  if (!NAV.route) { box.innerHTML = ''; return; }
  box.innerHTML = NAV.route.steps.map((st, i) =>
    '<button class="ns-row' + (i === NAV.stepIdx ? ' cur' : '') + '" data-i="' + i + '" role="listitem">' +
    '<span class="ns-d">' + (st.dist >= 1 ? fmtDist(st.dist) : '') + '</span>' +
    '<span>' + escapeHtml(st.instr) + '</span></button>').join('');
}
$('navSteps').addEventListener('click', e => {
  const row = e.target.closest('.ns-row');
  if (!row) return;
  const st = NAV.route && NAV.route.steps[+row.dataset.i];
  if (st) MAP.flyTo({ cx: st.x, cy: st.y, dist: 320, T: 800 });
});
$('navStepsBtn').addEventListener('click', () => {
  const open = !$('navSteps').classList.contains('open');
  $('navSteps').classList.toggle('open', open);
  $('navStepsBtn').classList.toggle('open', open);
});

/* ---------- מצב הניווט ---------- */
function navSetMeta(prefixInstr) {
  const r = NAV.route;
  const live = NAV.fromLive ? '' : ' · ממרכז המפה';
  $('navInstr').textContent = prefixInstr;
  $('navMeta').textContent = (r.approx ? '≈ ' : '') + fmtDist(r.dist) + ' · ' + navFmtDur(r.dur) +
    (NAV.mode === 'foot' ? ' הליכה' : ' נסיעה') + (NAV.toName ? ' אל ' + NAV.toName : '') + live;
}
function navApplyRoute(r) {
  NAV.route = r;
  NAV.stepIdx = 0;
  $('routeSvg').classList.add('on');
  $('routeLine').classList.toggle('foot', NAV.mode === 'foot');
  $('navDest').classList.add('on');
  navSetMeta(r.steps[0] ? r.steps[0].instr : 'צאו לדרך');
  navRenderSteps();
  navFit();
  navDrawRoute();
  MAP.requestRender();
}

async function navFetchAndApply() {
  const seq = ++NAV.seq;
  $('navInstr').textContent = 'מחשב מסלול…';
  $('navMeta').textContent = '';
  const r = await osrmRoute(NAV.from, NAV.to, NAV.mode);
  if (seq !== NAV.seq || !NAV.on) return; // בוטל בינתיים
  navApplyRoute(r);
}

function startNav(x, y, name) {
  closePop();
  if (typeof closeAiPanel === 'function') closeAiPanel();
  if (typeof closePanel === 'function') closePanel();
  const live = (typeof geoPos !== 'undefined' && geoPos);
  NAV.from = live ? geoPos.slice() : [MAP.cam.cx, MAP.cam.cy];
  NAV.fromLive = !!live;
  NAV.to = [x, y];
  NAV.toName = name || '';
  if (Math.hypot(x - NAV.from[0], y - NAV.from[1]) < 28) { showToast('אתם כבר ממש כאן 🙂'); return; }
  if (!NAV.on) { NAV.on = true; uiOpened('nav', () => closeNav(true)); }
  $('navBar').classList.add('on');
  $('dock').classList.add('hide');
  navFetchAndApply();
  // אם ההרשאה כבר ניתנה בעבר — נדליק מיקום חי בשקט, לניווט צעד-אחר-צעד
  if (!live && navigator.permissions && navigator.geolocation) {
    navigator.permissions.query({ name: 'geolocation' }).then(st => {
      if (st.state === 'granted' && typeof geoWatch !== 'undefined' && geoWatch == null) $('geoBtn').click();
    }).catch(() => {});
  }
}
window.startNav = startNav;

function closeNav(fromBack) {
  if (!NAV.on) return;
  NAV.on = false; NAV.seq++; NAV.route = null;
  $('navBar').classList.remove('on');
  $('navSteps').classList.remove('open');
  $('navStepsBtn').classList.remove('open');
  $('routeSvg').classList.remove('on');
  $('routeCase').setAttribute('d', '');
  $('routeLine').setAttribute('d', '');
  $('navDest').classList.remove('on');
  $('dock').classList.remove('hide');
  if (fromBack !== true) uiClosed('nav');
}
$('navClose').addEventListener('click', () => closeNav());
$('navWalk').addEventListener('click', () => { if (NAV.mode === 'foot') return; NAV.mode = 'foot'; navSyncModes(); if (NAV.on) navFetchAndApply(); });
$('navDrive').addEventListener('click', () => { if (NAV.mode === 'car') return; NAV.mode = 'car'; navSyncModes(); if (NAV.on) navFetchAndApply(); });
function navSyncModes() {
  $('navWalk').classList.toggle('on', NAV.mode === 'foot');
  $('navDrive').classList.toggle('on', NAV.mode === 'car');
}

// כפתור "מסלול" בכל פופאפ (עסק, אירוע, תחנה, תוכנית)
document.addEventListener('click', e => {
  const b = e.target.closest('.pop-act[data-act="nav"]');
  if (!b) return;
  startNav(+b.dataset.nx, +b.dataset.ny, b.dataset.nn);
});

/* ---------- הכוונה חיה לפי המיקום ---------- */
function navGuide() {
  if (!NAV.on || !NAV.route || NAV.route.approx) return;
  if (typeof geoPos === 'undefined' || !geoPos) return;
  if (NAV.lastGeo && geoPos[0] === NAV.lastGeo[0] && geoPos[1] === NAV.lastGeo[1]) return;
  NAV.lastGeo = geoPos.slice();
  NAV.fromLive = true;
  const c = NAV.route.coords;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < c.length; i++) {
    const d = Math.hypot(c[i][0] - geoPos[0], c[i][1] - geoPos[1]);
    if (d < bd) { bd = d; bi = i; }
  }
  if (bd > 60) { // ירדתם מהמסלול — חישוב מחדש מהמיקום הנוכחי
    if (!NAV.offSince) NAV.offSince = nowMs();
    if (nowMs() - NAV.offSince > 8000) {
      NAV.offSince = 0;
      NAV.from = geoPos.slice();
      navFetchAndApply();
    }
    return;
  }
  NAV.offSince = 0;
  // כמה נשאר מהנקודה הקרובה עד הסוף
  let remain = 0;
  for (let i = bi; i < c.length - 1; i++) remain += Math.hypot(c[i + 1][0] - c[i][0], c[i + 1][1] - c[i][1]);
  // הצעד הנוכחי: הראשון שעדיין לפנינו (נקודת הצעד קרובה ליעד לא יותר מאיתנו)
  const steps = NAV.route.steps;
  let si = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (Math.hypot(steps[i].x - NAV.to[0], steps[i].y - NAV.to[1]) <= remain + 20) { si = i; break; }
  }
  if (si !== NAV.stepIdx) { NAV.stepIdx = si; navRenderSteps(); }
  const st = steps[si];
  const toStep = Math.hypot(st.x - geoPos[0], st.y - geoPos[1]);
  $('navInstr').textContent = (toStep > 25 ? 'בעוד ' + fmtDist(toStep) + ': ' : '') + st.instr;
  $('navMeta').textContent = 'נותרו ' + fmtDist(remain) + ' · ' + navFmtDur(remain / (NAV.mode === 'foot' ? 1.25 : 7)) +
    (NAV.toName ? ' אל ' + NAV.toName : '');
  if (remain < 22) { $('navInstr').textContent = 'הגעתם ליעד 🎉'; $('navMeta').textContent = NAV.toName; }
}
setInterval(navGuide, 1200);

/* ---------- שכבת מקלטים ---------- */
const SHEL = window.SHELTERS || { items: [], types: {}, src: '' };
const SHEL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8 20 6v6c0 5-3.4 8.3-8 9.2C7.4 20.3 4 17 4 12V6Z"/><path d="M12 8v5M12 16h.01"/></svg>';
let shelOn = false, shelEls = null;
function ensureShelEls() {
  if (shelEls) return;
  const root = $('shelterLayer');
  shelEls = SHEL.items.map(s => {
    const el = document.createElement('button');
    el.className = 'shel';
    el.innerHTML = SHEL_SVG;
    const label = (SHEL.types[s[3]] || 'מקלט') + ' · ' + s[2] + (s[4] ? ' (' + s[4] + ')' : '');
    el.title = label;
    el.setAttribute('aria-label', 'ניווט אל ' + label);
    el.addEventListener('click', () => { NAV.mode = 'foot'; navSyncModes(); startNav(M2(s[0]), M2(s[1]), 'מקלט · ' + s[2]); });
    root.appendChild(el);
    return { el, x: M2(s[0]), y: M2(s[1]) };
  });
}
function positionShelters() {
  if (!shelOn) { if (shelEls) for (const s of shelEls) s.el.style.display = 'none'; return; }
  ensureShelEls();
  const far = MAP.cam.dist > 5200;
  for (const s of shelEls) {
    const [sx, sy, vis] = MAP.project(s.x, s.y, 0);
    if (!vis || far) { s.el.style.display = 'none'; continue; }
    s.el.style.display = 'flex';
    s.el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
  }
}
function syncShelBtn() { $('sheltersBtn').classList.toggle('on', shelOn); }
$('sheltersBtn').addEventListener('click', () => {
  if (!SHEL.items.length) { showToast('אין עדיין רשימת מקלטים לעיר הזו'); return; }
  shelOn = !shelOn;
  syncShelBtn();
  positionShelters();
  MAP.requestRender();
  if (shelOn) showToast('מוצגים ' + SHEL.items.length + ' מקלטים — ' + SHEL.src);
});

// המקלט הקרוב — ניווט מיידי
$('shelterBtn').addEventListener('click', () => {
  if (!SHEL.items.length) { showToast('אין עדיין רשימת מקלטים לעיר הזו'); return; }
  const ref = (typeof geoPos !== 'undefined' && geoPos) ? geoPos : [MAP.cam.cx, MAP.cam.cy];
  let best = null, bd = Infinity;
  for (const s of SHEL.items) {
    const d = Math.hypot(M2(s[0]) - ref[0], M2(s[1]) - ref[1]);
    if (d < bd) { bd = d; best = s; }
  }
  shelOn = true; syncShelBtn(); positionShelters();
  NAV.mode = 'foot'; navSyncModes();
  startNav(M2(best[0]), M2(best[1]), 'מקלט · ' + best[2]);
  showToast('המקלט הקרוב: <b>' + escapeHtml(best[2]) + '</b>' + (best[4] ? ' · ' + escapeHtml(best[4]) : ''));
});

/* ---------- חיבור לפריים של המפה ---------- */
window.__navTick = () => { navDrawRoute(); positionShelters(); };

/* ---------- הוקים ל-QA ---------- */
const __qaBase = window.__qaExt;
window.__qaExt = function (qs) {
  if (__qaBase) __qaBase(qs);
  if (/shel/.test(qs)) { shelOn = true; syncShelBtn(); positionShelters(); MAP.drawOnce(); }
  if (/chips/.test(qs)) { $('homeChips').classList.add('show'); MAP.drawOnce(); }
  if (/navui/.test(qs)) { // מסלול סינתטי — צילום דטרמיניסטי בלי רשת
    const c = MAP.cam;
    NAV.on = true; NAV.mode = 'foot'; NAV.to = [c.cx + 260, c.cy + 180]; NAV.toName = 'קפה הדגמה';
    NAV.from = [c.cx - 300, c.cy - 220]; NAV.fromLive = false;
    $('navBar').classList.add('on'); $('dock').classList.add('hide');
    navApplyRoute({
      coords: [[c.cx - 300, c.cy - 220], [c.cx - 300, c.cy - 40], [c.cx - 120, c.cy - 40], [c.cx - 120, c.cy + 180], [c.cx + 260, c.cy + 180]],
      steps: [
        { instr: 'צאו לדרך ברחוב ביאליק', dist: 180, x: c.cx - 300, y: c.cy - 220 },
        { instr: 'פנו ימינה לרחוב הרצל', dist: 180, x: c.cx - 300, y: c.cy - 40 },
        { instr: 'פנו שמאלה לרחוב ז׳בוטינסקי', dist: 220, x: c.cx - 120, y: c.cy - 40 },
        { instr: 'פנו ימינה', dist: 380, x: c.cx - 120, y: c.cy + 180 },
        { instr: 'הגעתם — היעד מימינכם', dist: 0, x: c.cx + 260, y: c.cy + 180 },
      ],
      dist: 960, dur: 770, approx: false,
    });
    $('navSteps').classList.add('open'); $('navStepsBtn').classList.add('open');
    navRenderSteps();
    MAP.drawOnce();
  }
  const nm = qs.match(/nav=(-?\d+),(-?\d+)/);
  if (nm) { startNav(+nm[1], +nm[2], 'יעד בדיקה'); }
};
