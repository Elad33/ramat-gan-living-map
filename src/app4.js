/* ============================================================
   Part 4 — businesses layer, "מה סביבי", AI assistant
   ============================================================ */

// ---------- business data ----------
const BIZ_D = window.BIZ || { cats: [], items: [] };
const BIZ_STYLE = {
  food:     { color: '#e0704a', icon: '<path d="M8.2 3v5.6M5.6 3v3.6a2.6 2.6 0 0 0 5.2 0V3M8.2 8.6V17M16.8 3c-1.9 1.4-2.8 3.6-2.8 6 0 1.6.9 2.6 2.2 2.6V17"/>' },
  cafe:     { color: '#bf8a4e', icon: '<path d="M4.8 9h9.4v4.4a3.8 3.8 0 0 1-3.8 3.8H8.6a3.8 3.8 0 0 1-3.8-3.8ZM14.2 10h1.4a2.3 2.3 0 0 1 0 4.6h-1.4M7 6.4c0-1 .9-1.1.9-2.1M10.5 6.4c0-1 .9-1.1.9-2.1"/>' },
  bar:      { color: '#a678e0', icon: '<path d="M5.5 4h11l-5.5 6.2v5M8 17.6h7M7.6 6.8h6.8"/>' },
  groc:     { color: '#5fae62', icon: '<path d="M4.8 8.6h13.4M6.3 8.6l1.1 7.9a1.8 1.8 0 0 0 1.8 1.5h4.6a1.8 1.8 0 0 0 1.8-1.5l1.1-7.9M9 8.6l2.5-4.4M14 8.6l-2.5-4.4M9.7 11.6v2.8M13.3 11.6v2.8"/>' },
  shop:     { color: '#e06a95', icon: '<path d="M5.8 8h11.4l-.8 9.4a1.7 1.7 0 0 1-1.7 1.6H8.3a1.7 1.7 0 0 1-1.7-1.6ZM8.8 9.8V6.6a3 3 0 0 1 6 0v3.2"/>' },
  beauty:   { color: '#d675b8', icon: '<circle cx="6.8" cy="7.2" r="2.1"/><circle cx="6.8" cy="15.6" r="2.1"/><path d="M8.7 8.4l9 7.5M8.7 14.4l9-7.5"/>' },
  health:   { color: '#3fae87', icon: '<path d="M10 4.2h3.6v5h5v3.6h-5v5H10v-5H5V9.2h5Z"/>' },
  sport:    { color: '#4f9ce0', icon: '<path d="M7.2 8.4v6.6M4.6 9.8v3.8M16.8 8.4v6.6M19.4 9.8v3.8M7.2 11.7h9.6"/>' },
  services: { color: '#8592a8', icon: '<path d="M14.8 6.2a4.1 4.1 0 0 0-5.7 4.7L4 16l3.2 3.2 5.1-5.1a4.1 4.1 0 0 0 4.7-5.7l-2.7 2.7-2.2-2.2Z"/>' },
};
const bizCats = BIZ_D.cats.map((c, i) => ({ ...c, idx: i, ...(BIZ_STYLE[c.id] || BIZ_STYLE.services) }));
const bizCatById = Object.fromEntries(bizCats.map(c => [c.id, c]));
const bizAll = BIZ_D.items.map(r => {
  const e = r[5] || {};
  return {
    id: r[0], name: r[1], ci: r[2], cat: (bizCats[r[2]] || bizCats[0] || { id: 'services' }).id,
    x: M2(r[3]), y: M2(r[4]),
    sub: e.s || '', cuisine: e.c || '', addr: e.a || '', phone: e.p || '', web: e.w || '',
    hours: e.h || '', wa: !!e.wa,
    n: norm(r[1] + ' ' + (e.s || '') + ' ' + (e.c || '')),
  };
});
const bizById = new Map(bizAll.map(b => [b.id, b]));

// ---------- opening hours (tolerant subset; unknown syntax → "unknown", never a wrong claim) ----------
const OH_DAYS = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const OH_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
function ohParseDays(s) {
  const out = new Set();
  for (const tok of s.split(',')) {
    const t = tok.trim();
    const m = t.match(/^([A-Z][a-z])\s*-\s*([A-Z][a-z])$/);
    if (m) {
      const a = OH_DAYS[m[1]], b = OH_DAYS[m[2]];
      if (a == null || b == null) return null;
      for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
    } else if (OH_DAYS[t] != null) out.add(OH_DAYS[t]);
    else return null;
  }
  return out.size ? out : null;
}
function ohParse(str) {
  if (!str) return null;
  if (/24\s*\/\s*7/.test(str)) return { always: true };
  const dayMap = Array.from({ length: 7 }, () => null); // day -> {ruleId, spans:[[from,to]]}
  const parts = String(str).split(';');
  for (let ri = 0; ri < parts.length; ri++) {
    let part = parts[ri].trim();
    if (!part) continue;
    if (/^(PH|SH)\b/.test(part)) continue; // holidays: ignore
    const off = /\b(off|closed)\b/i.test(part);
    part = part.replace(/\b(off|closed)\b/ig, '').trim();
    const dm = part.match(/^([A-Za-z,\- ]+?)(?=$|\d)/);
    const days = dm && dm[1].trim() ? ohParseDays(dm[1].trim()) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    const timesStr = part.slice(dm && dm[1] ? dm[1].length : 0).trim();
    const spans = [];
    if (!off) {
      if (!timesStr) return null;
      for (const t of timesStr.split(',')) {
        const tm = t.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        if (!tm) return null;
        spans.push([+tm[1] * 60 + +tm[2], +tm[3] * 60 + +tm[4]]);
      }
    }
    for (const d of days) {
      if (!dayMap[d] || dayMap[d].ruleId !== ri) dayMap[d] = { ruleId: ri, spans: [] };
      dayMap[d].spans.push(...spans);
    }
  }
  return { dayMap };
}
function bizOpenNow(b) {
  if (b._oh === undefined) { try { b._oh = ohParse(b.hours); } catch (e) { b._oh = null; } }
  const oh = b._oh;
  if (!oh) return null;
  if (oh.always) return true;
  const now = new Date();
  const day = now.getDay(), min = now.getHours() * 60 + now.getMinutes();
  const today = oh.dayMap[day], yest = oh.dayMap[(day + 6) % 7];
  if (today) for (const [f, t] of today.spans) {
    if (t > f ? (min >= f && min < t) : (min >= f)) return true;
  }
  if (yest) for (const [f, t] of yest.spans) {
    if (t <= f && min < t) return true; // overnight spill (e.g. Fr 22:00-02:00)
  }
  return false;
}
function heHours(str) {
  if (!str) return '';
  if (/24\s*\/\s*7/.test(str)) return 'פתוח בכל שעה';
  return String(str)
    .replace(/PH\s*(off|closed)?/g, '').replace(/SH\s*(off|closed)?/g, '')
    .replace(/[A-Z][a-z]/g, d => OH_HE[OH_DAYS[d]] ?? d)
    .replace(/\s*-\s*/g, '–').replace(/\boff\b|\bclosed\b/g, 'סגור')
    .replace(/;/g, ' · ').replace(/\s+/g, ' ').trim();
}

// ---------- map markers (positioned every frame, like bus stops) ----------
const BIZ_POOL_N = 150;
const bizPool = [];
for (let i = 0; i < BIZ_POOL_N; i++) {
  const el = document.createElement('div');
  el.className = 'bz';
  el.innerHTML = '<span class="bz-ic"></span><span class="bz-nm"></span>';
  el.style.display = 'none';
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (el.__biz) showBizPop(el.__biz);
  });
  markersRoot.appendChild(el);
  bizPool.push(el);
}
const BIZ_KEY = 'rg.biz.v1';
let bizLayerOn = store.getItem(BIZ_KEY) !== 'off';
let bizFocus = null;          // Set of cat ids (panel chip / assistant) — extends visibility range
let bizHi = null;             // Set of biz ids highlighted by the assistant
function bizIconHtml(ci) {
  const c = bizCats[ci] || bizCats[0];
  return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + c.icon.replace('<path ', '<path fill="none" ') + '</svg>';
}
function positionBiz() {
  const d = MAP.cam.dist;
  let used = 0;
  const maxD = bizHi ? 7000 : bizFocus ? 3200 : 1500;
  if (bizLayerOn && bizAll.length && d < maxD) {
    const namesOn = d < 720;
    const sc = d < 500 ? 1 : d < 900 ? 0.88 : 0.74;
    const cand = [];
    for (const b of bizAll) {
      const hi = bizHi && bizHi.has(b.id);
      if (bizHi && !hi && d >= 1500) continue;
      if (bizFocus && !bizFocus.has(b.cat) && !hi && d >= 1500) continue;
      if (!hi && d >= 1500 && !bizFocus) continue;
      const [sx, sy, vis] = MAP.project(b.x, b.y, 0);
      if (!vis || sx < -20 || sx > innerWidth + 20 || sy < 90 || sy > innerHeight + 20) continue;
      const pr = hi ? 0 : (bizFocus && bizFocus.has(b.cat)) ? 1 : 2;
      const dc = (sx - innerWidth / 2) ** 2 + (sy - innerHeight / 2) ** 2;
      cand.push({ b, sx, sy, hi, pr, dc });
    }
    cand.sort((a, z) => a.pr - z.pr || a.dc - z.dc);
    // stacked venues (malls, shared buildings): fan overlapping icons out in a stable ring
    const cellUse = new Map();
    const nmCells = new Set();
    for (const c of cand) {
      if (used >= BIZ_POOL_N) break;
      const ck = Math.round(c.sx / 26) + ':' + Math.round(c.sy / 26);
      const n = cellUse.get(ck) || 0;
      cellUse.set(ck, n + 1);
      if (n > 0) {
        let h = 0;
        for (let i = 0; i < c.b.id.length; i++) h = (h * 31 + c.b.id.charCodeAt(i)) >>> 0;
        const ang = (h % 628) / 100 + n * 2.4;
        const rad = 22 + 13 * Math.floor((n - 1) / 6);
        c.sx += Math.cos(ang) * rad;
        c.sy += Math.sin(ang) * rad;
        c.fanned = true; // crowded spot: icon only, the name waits for the popup
      }
      const el = bizPool[used++];
      const b = c.b;
      el.__biz = b;
      if (el.__ci !== b.ci) {
        el.__ci = b.ci;
        el.firstChild.innerHTML = bizIconHtml(b.ci);
        el.style.setProperty('--c', (bizCats[b.ci] || bizCats[0]).color);
      }
      const nm = el.lastChild;
      let showNm = (namesOn && !c.fanned) || c.hi;
      if (showNm) { // one name per label cell — icons stay, crowded names wait for the popup
        const gk = Math.round(c.sx / 95) + ':' + Math.round((c.sy + 24) / 26);
        if (nmCells.has(gk) && !c.hi) showNm = false;
        else nmCells.add(gk);
      }
      const txt = showNm ? b.name : '';
      if (el.__nm !== txt) { el.__nm = txt; nm.textContent = txt; }
      el.classList.toggle('hi', !!c.hi);
      el.style.display = '';
      el.title = b.name + (b.sub ? ' · ' + b.sub : '');
      el.style.transform = 'translate3d(' + c.sx + 'px,' + c.sy + 'px,0) translate(-50%,-50%) scale(' + (c.hi ? Math.max(sc, 1) : sc) + ')';
    }
  }
  for (let i = used; i < BIZ_POOL_N; i++) {
    if (bizPool[i].style.display !== 'none') { bizPool[i].style.display = 'none'; bizPool[i].__biz = null; }
  }
}
window.__bizTick = positionBiz;
$('bizBtn').addEventListener('click', () => {
  bizLayerOn = !bizLayerOn;
  store.setItem(BIZ_KEY, bizLayerOn ? 'on' : 'off');
  $('bizBtn').classList.toggle('on', bizLayerOn);
  positionBiz();
  if (bizLayerOn) showToast('עסקים מוצגים על המפה — התקרבו לרחוב כדי לראות אותם');
});
$('bizBtn').classList.toggle('on', bizLayerOn);

// ---------- business popup ----------
function bizChipHtml(b) {
  const c = bizCatById[b.cat];
  return '<span class="ev-chip" style="background:color-mix(in srgb,' + c.color + ' 20%,transparent);color:' + c.color + '">' + c.label + '</span>';
}
function openBadge(b) {
  const st = bizOpenNow(b);
  if (st === null) return '';
  return st ? '<span class="open-chip open">פתוח עכשיו</span>' : '<span class="open-chip closed">סגור עכשיו</span>';
}
function showBizPop(b) {
  closePop();
  window.__curBiz = b.id;
  popAnchor = { x: b.x, y: b.y, lift: 26 };
  const sub = [b.sub, b.cuisine].filter(Boolean).join(' · ');
  const tel = b.phone.replace(/[^\d+]/g, '');
  const pop = $('pop');
  pop.innerHTML = POP_X +
    '<div class="row1">' + bizChipHtml(b) + openBadge(b) + (b.wa ? '<span class="wa-chip" title="נגיש לכיסאות גלגלים">♿</span>' : '') + '</div>' +
    '<h3>' + escapeHtml(b.name) + '</h3>' +
    (sub ? '<div class="muni-cat" style="margin-top:4px">' + escapeHtml(sub) + '</div>' : '') +
    '<div class="where"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" style="flex:none"><path d="M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>' +
    escapeHtml(b.addr || reverseGeocode(b.x, b.y)) + '</div>' +
    (b.hours ? '<div class="biz-hours"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.8"/></svg>' + escapeHtml(heHours(b.hours)) + '</div>' : '') +
    (b.web ? '<a class="pop-primary" href="' + escapeHtml(b.web) + '" target="_blank" rel="noopener">לאתר העסק<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>' : '') +
    '<div class="acts">' +
    navActsHtml(b.x, b.y) +
    (tel ? '<a class="pop-act" href="tel:' + tel + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4h4l1.8 4.5-2.3 1.4a12 12 0 0 0 5.6 5.6l1.4-2.3L20 15v4a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 3.2 6 1.8 1.8 0 0 1 5 4Z"/></svg>חיוג</a>' : '') +
    '<button class="pop-act" data-act="fly"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>התקרבות</button>' +
    '</div>';
  pop.classList.add('open');
  placePop();
}
$('pop').addEventListener('click', e => {
  const btn = e.target.closest('.pop-act');
  if (btn && btn.dataset.act === 'fly' && window.__curBiz) {
    const b = bizById.get(window.__curBiz);
    if (b) MAP.flyTo({ cx: b.x, cy: b.y, dist: 300 });
  }
});

// ---------- "מה בא לך היום?" panel (assistant + browse) ----------
const aiPanel = $('aiPanel');
function openAiPanel() {
  closePanel();
  renderBizChips();
  renderBizList();
  aiPanel.classList.add('open');
  updateAiRefLine();
}
function closeAiPanel() { aiPanel.classList.remove('open'); }
$('aiToggle').addEventListener('click', openAiPanel);
$('aiClose').addEventListener('click', closeAiPanel);

const fmtDist = m => m < 950 ? Math.max(10, Math.round(m / 10) * 10) + ' מ׳' : (m / 1000).toFixed(1) + ' ק״מ';
function refPoint() { return (typeof geoPos !== 'undefined' && geoPos) ? geoPos : [MAP.cam.cx, MAP.cam.cy]; }
function updateAiRefLine() {
  const el = $('aiRefLine');
  if (typeof geoPos !== 'undefined' && geoPos) el.innerHTML = 'מרחקים לפי המיקום שלכם';
  else el.innerHTML = 'מרחקים ממרכז המפה · <a href="#" id="aiGeoGo">מצאו אותי</a>';
  const go = $('aiGeoGo');
  if (go) go.addEventListener('click', e => { e.preventDefault(); $('geoBtn').click(); setTimeout(() => { updateAiRefLine(); renderBizList(); }, 1500); });
}

// browse chips
let bizChipSel = 'all';
function renderBizChips() {
  const host = $('bizChips');
  if (host.childElementCount) { syncBizChips(); return; }
  host.innerHTML = '<button class="bz-chip" data-cat="all" style="--c:var(--gold)">הכל</button>' +
    bizCats.map(c => '<button class="bz-chip" data-cat="' + c.id + '" style="--c:' + c.color + '"><i></i>' + c.label + '</button>').join('');
  host.addEventListener('click', e => {
    const chip = e.target.closest('.bz-chip');
    if (!chip) return;
    bizChipSel = chip.dataset.cat;
    clearAssist(false);
    bizFocus = bizChipSel === 'all' ? null : new Set([bizChipSel]);
    syncBizChips();
    renderBizList();
    positionBiz();
  });
  syncBizChips();
}
function syncBizChips() {
  for (const el of $('bizChips').children) el.classList.toggle('on', el.dataset.cat === bizChipSel);
}

// list rendering (browse mode: nearest first; assist mode: assistant results)
let assistResults = null; // {reply, src, rows:[{kind:'biz'|'event', ref, dist}]}
function bizRowHtml(b, dist) {
  const c = bizCatById[b.cat];
  const st = bizOpenNow(b);
  const sub = [b.sub, b.cuisine].filter(Boolean).join(' · ');
  return '<button class="bz-row" data-biz="' + b.id + '">' +
    '<span class="bz-badge" style="--c:' + c.color + '">' + bizIconHtml(b.ci) + '</span>' +
    '<span class="bz-tx"><span class="bz-name">' + escapeHtml(b.name) + '</span>' +
    '<span class="bz-sub">' + escapeHtml(sub || c.label) +
    (st !== null ? ' · <b class="' + (st ? 'op' : 'cl') + '">' + (st ? 'פתוח' : 'סגור') + '</b>' : '') + '</span></span>' +
    '<span class="bz-dist">' + fmtDist(dist) + '</span></button>';
}
function evRowHtml(ev, dist) {
  const c = catById[ev.cat] || CATS[0];
  return '<button class="bz-row" data-ev="' + escapeHtml(ev.id) + '">' +
    '<span class="bz-badge" style="--c:' + c.color + '"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M8.5 3.5v4M15.5 3.5v4M4 10h16"/></svg></span>' +
    '<span class="bz-tx"><span class="bz-name">' + escapeHtml(ev.title) + '</span>' +
    '<span class="bz-sub">' + escapeHtml(fmtWhen(ev)) + (ev.locName ? ' · ' + escapeHtml(ev.locName) : '') + '</span></span>' +
    (typeof ev.x === 'number' ? '<span class="bz-dist">' + fmtDist(dist) + '</span>' : '<span class="bz-dist">אונליין</span>') +
    '</button>';
}
function renderBizList() {
  const host = $('bizList');
  const [rx, ry] = refPoint();
  if (assistResults) {
    const r = assistResults;
    host.innerHTML =
      '<div class="ai-reply"><div class="ai-face">✨</div><div class="ai-msg">' + escapeHtml(r.reply) +
      (r.src === 'ai' ? '<span class="ai-src">Gemini</span>' : '') + '</div></div>' +
      (r.rows.length
        ? r.rows.map(row => row.kind === 'biz' ? bizRowHtml(row.ref, row.dist) : evRowHtml(row.ref, row.dist)).join('')
        : '<div class="ev-none">לא מצאתי התאמה ממש טובה הפעם.<br/>נסו לנסח אחרת — או הציצו בקטגוריות למעלה.</div>') +
      '<button class="ai-clear" id="aiClear">ניקוי החיפוש ✕</button>';
    const clr = $('aiClear');
    if (clr) clr.addEventListener('click', () => clearAssist(true));
    return;
  }
  const q = norm($('aiInput').value || '');
  let list = bizAll;
  if (bizChipSel !== 'all') list = list.filter(b => b.cat === bizChipSel);
  const rows = list.map(b => ({ b, d: Math.hypot(b.x - rx, b.y - ry) }))
    .sort((a, z) => a.d - z.d).slice(0, 80);
  host.innerHTML = rows.length
    ? rows.map(r => bizRowHtml(r.b, r.d)).join('') +
      '<div class="bz-foot">מציג את ' + rows.length + ' הקרובים · נתוני הקהילה של OpenStreetMap</div>'
    : '<div class="ev-none">אין עדיין עסקים בקטגוריה הזו במיפוי הפתוח.</div>';
}
$('bizList').addEventListener('click', e => {
  const row = e.target.closest('.bz-row');
  if (!row) return;
  if (row.dataset.biz) {
    const b = bizById.get(row.dataset.biz);
    if (!b) return;
    if (innerWidth <= 640) closeAiPanel();
    MAP.flyTo({ cx: b.x, cy: b.y, dist: 420, done: () => showBizPop(b) });
  } else if (row.dataset.ev) {
    const ev = allEvents().find(x => x.id === row.dataset.ev);
    if (!ev) return;
    if (ev.online || typeof ev.x !== 'number') { if (ev.link) window.open(ev.link, '_blank', 'noopener'); return; }
    if (innerWidth <= 640) closeAiPanel();
    MAP.flyTo({ cx: ev.x, cy: ev.y, dist: 620, done: () => showPop(ev.id) });
  }
});

// ---------- assistant ----------
const AI_API_LOCAL = '/api/assist?q=';
const AI_API_REMOTE = 'https://ramat-gan-living-map.vercel.app/api/assist?q=';
let aiBusy = false, aiLastQ = '', aiLastIntent = null;
async function fetchIntent(q) {
  if (q === aiLastQ && aiLastIntent) return aiLastIntent;
  const urls = location.hostname.includes('vercel.app') || location.hostname === 'localhost'
    ? [AI_API_LOCAL, AI_API_REMOTE] : [AI_API_REMOTE];
  for (const u of urls) {
    try {
      const r = await fetch(u + encodeURIComponent(q), { signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const data = await r.json();
      if (data && data.ok && data.intent) {
        aiLastQ = q; aiLastIntent = { ...data.intent, src: 'ai' };
        return aiLastIntent;
      }
      if (data && data.error) break; // not_configured / ai_unavailable → local engine
    } catch (e) {}
  }
  return null;
}

// local Hebrew intent engine — free, offline, always available
const AI_SYN = [
  [/פיצה/, { biz: ['food'], kw: ['פיצה', 'איטלקי'] }],
  [/סושי|יפני|אסייתי|נודלס|ראמן/, { biz: ['food'], kw: ['סושי', 'יפני', 'אסייתי'] }],
  [/המבורגר|בורגר/, { biz: ['food'], kw: ['בורגר', 'המבורגר'] }],
  [/שווארמה|פלאפל|חומוס|סביח/, { biz: ['food'], kw: ['שווארמה', 'פלאפל', 'חומוס', 'מזרחי'] }],
  [/מסעד|לאכול|אוכל|רעב|ארוחה|צהריים|ערב טוב לאכול|סטייק|בשר|דגים|טבעוני|צמחוני/, { biz: ['food'] }],
  [/קפה|קרואסון|מאפה|עוגה|קינוח|גלידה|מתוק|בראנץ|ארוחת בוקר/, { biz: ['cafe'] }],
  [/בירה|בר\b|פאב|לשתות|קוקטייל|יין|מועדון|לילה|דייט/, { biz: ['bar', 'food'] }],
  [/סופר|מכולת|ירקן|קצב|אטליז|מעדני|יין לקנות|משקאות לקנות/, { biz: ['groc'] }],
  [/קניות|בגדים|אופנה|נעליים|מתנה|תכשיט|צעצוע|ספרים|פרחים|זר\b|רהיט|חנות/, { biz: ['shop'] }],
  [/תספורת|מספרה|שיער|ציפורניים|מניקור|פדיקור|קוסמטיקה|איפור|עיסוי|ספא|יופי/, { biz: ['beauty'] }],
  [/תרופ|מרקחת|רופא|מרפאה|שיניים|משקפיים|אופטיק|וטרינר|חולה|בריאות/, { biz: ['health'] }],
  [/כושר|להתאמן|אימון|יוגה|פילאטיס|שחייה|ספורט|קולנוע|סרט|באולינג|חדר בריחה|לרקוד|ריקוד/, { biz: ['sport'] }],
  [/בנק|כספומט|דואר|דלק|מוסך|מכבסה|ניקוי יבש|ביטוח|עורך דין|רואה חשבון|תיווך/, { biz: ['services'] }],
  [/הופעה|קונצרט|הצגה|תיאטרון|מוזיקה|תרבות/, { ev: ['culture'] }],
  [/ילדים|משפחה|קהילה|בלונים/, { ev: ['community'] }],
  [/מרוץ|ריצה עממית|צעדה/, { ev: ['sport'] }],
  [/סיור|טיול|מורשת/, { ev: ['poi'] }],
  [/אירוע|מה קורה|מה יש|לצאת|פסטיבל|יריד|שוק איכרים/, { ev: [] }],
];
const AI_STOP = new Set(['אני', 'רוצה', 'בא', 'לי', 'לנו', 'איפה', 'אפשר', 'יש', 'מה', 'משהו', 'מקום', 'טוב', 'טובה', 'הכי', 'קרוב', 'קרובה', 'לידי', 'ליד', 'באזור', 'בסביבה', 'סביבי', 'עם', 'של', 'על', 'את', 'עכשיו', 'היום', 'הערב', 'מחר', 'כיף', 'לעשות', 'ללכת', 'היי', 'שלום', 'בעיר', 'ברמת', 'גן']);
function localIntent(qRaw) {
  const q = norm(qRaw);
  const out = { kinds: [], bizCats: [], evCats: [], keywords: [], when: 'any', openNow: false, reply: '', src: 'local' };
  for (const [re, add] of AI_SYN) {
    if (!re.test(q)) continue;
    if (add.biz) { out.kinds.push('biz'); out.bizCats.push(...add.biz); }
    if (add.ev) { out.kinds.push('event'); out.evCats.push(...add.ev); }
    if (add.kw) out.keywords.push(...add.kw);
  }
  if (/הערב|עכשיו|היום/.test(q)) out.when = 'today';
  else if (/מחר/.test(q)) out.when = 'tomorrow';
  else if (/סופ|שישי|שבת/.test(q)) out.when = 'weekend';
  else if (/השבוע/.test(q)) out.when = 'week';
  if (/פתוח|עכשיו/.test(q)) out.openNow = true;
  // leftover words → free keywords (matched against names/cuisines)
  for (const w of q.split(' ')) {
    if (w.length >= 3 && !AI_STOP.has(w) && !out.keywords.includes(w)) out.keywords.push(w);
  }
  out.keywords = out.keywords.slice(0, 6);
  out.kinds = [...new Set(out.kinds)];
  out.bizCats = [...new Set(out.bizCats)].slice(0, 3);
  out.evCats = [...new Set(out.evCats)].slice(0, 3);
  if (!out.kinds.length) out.kinds = ['biz', 'event'];
  const c0 = out.bizCats[0];
  out.reply = out.kinds.includes('event') && !out.kinds.includes('biz')
    ? (out.when === 'today' ? 'זה מה שקורה בעיר היום:' : 'אלה האירועים הקרובים שמצאתי:')
    : c0 === 'food' ? 'הנה מקומות טעימים בסביבה:'
    : c0 === 'cafe' ? 'הנה בתי הקפה והפינוקים שסביבכם:'
    : c0 === 'bar' ? 'יש כמה מקומות טובים לצאת אליהם:'
    : c0 === 'beauty' ? 'ריכזתי את מקומות היופי והטיפוח באזור:'
    : c0 === 'health' ? 'אלה שירותי הבריאות הקרובים:'
    : c0 === 'sport' ? 'הנה איפה אפשר לזוז ולהתאוורר:'
    : 'זה מה שמצאתי בסביבה:';
  return out;
}

function execIntent(intent) {
  const [rx, ry] = refPoint();
  const rows = [];
  const kws = (intent.keywords || []).map(norm).filter(Boolean);
  if (intent.kinds.includes('biz')) {
    const cats = new Set(intent.bizCats || []);
    const scored = [];
    for (const b of bizAll) {
      let s = 0;
      if (cats.has(b.cat)) s += 3;
      for (const k of kws) if (b.n.includes(k)) { s += 4; break; }
      if (!cats.size && !kws.length) s = 1; // plain "around me" browse
      if (!s) continue;
      if (intent.openNow && bizOpenNow(b) === false) continue;
      scored.push({ kind: 'biz', ref: b, dist: Math.hypot(b.x - rx, b.y - ry), s });
    }
    scored.sort((a, z) => z.s - a.s || a.dist - z.dist);
    rows.push(...scored.slice(0, 12));
  }
  if (intent.kinds.includes('event')) {
    const cats = new Set(intent.evCats || []);
    const today = localISO(0), tomorrow = localISO(1);
    let evs = allEvents().filter(e => e.date || e.online);
    if (cats.size) evs = evs.filter(e => cats.has(e.cat));
    if (intent.when === 'today') evs = evs.filter(e => e.date === today);
    else if (intent.when === 'tomorrow') evs = evs.filter(e => e.date === tomorrow);
    else if (intent.when === 'weekend') {
      const wd = new Date().getDay(); // upcoming Fri+Sat
      const fri = localISO((5 - wd + 7) % 7), sat = localISO((6 - wd + 7) % 7);
      evs = evs.filter(e => e.date === fri || e.date === sat);
    } else if (intent.when === 'week') evs = evs.filter(e => e.date <= localISO(7));
    if (kws.length && cats.size === 0 && intent.when === 'any')
      evs = evs.filter(e => kws.some(k => norm(e.title + ' ' + (e.muniCat || '')).includes(k)));
    evs.sort((a, z) => ((a.date || '9999') + (a.time || '')) < ((z.date || '9999') + (z.time || '')) ? -1 : 1);
    rows.push(...evs.slice(0, 8).map(e => ({
      kind: 'event', ref: e,
      dist: typeof e.x === 'number' ? Math.hypot(e.x - rx, e.y - ry) : 1e9,
    })));
  }
  // events first when the user asked about a time ("what's on tonight")
  if (intent.when !== 'any') rows.sort((a, z) => (a.kind === 'event' ? 0 : 1) - (z.kind === 'event' ? 0 : 1));
  return rows;
}
function highlightResults(rows) {
  const bizIds = rows.filter(r => r.kind === 'biz').map(r => r.ref.id);
  bizHi = bizIds.length ? new Set(bizIds) : null;
  // camera: frame the on-map results
  const pts = rows.filter(r => typeof r.ref.x === 'number').map(r => [r.ref.x, r.ref.y]);
  positionBiz();
  if (!pts.length) return;
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
  for (const [x, y] of pts.slice(0, 10)) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
  const ext = Math.max(Math.hypot(mxx - mnx, mxy - mny), 250);
  MAP.flyTo({ cx: (mnx + mxx) / 2, cy: (mny + mxy) / 2, dist: clamp(ext * 1.5, 620, 4600), T: 1100 });
}
function clearAssist(rerender) {
  assistResults = null;
  bizHi = null;
  $('aiInput').value = '';
  if (rerender !== false) { renderBizList(); positionBiz(); }
}
async function runAssist(qRaw, opts = {}) {
  const q = String(qRaw || '').trim().slice(0, 140);
  if (q.length < 2 || aiBusy) return;
  aiBusy = true;
  $('aiGo').classList.add('busy');
  $('bizList').innerHTML = '<div class="ai-reply"><div class="ai-face think">✨</div><div class="ai-msg">רק רגע, בודק מה יש סביבך…</div></div><div class="sk-row"></div><div class="sk-row"></div><div class="sk-row"></div>';
  let intent = null;
  if (!opts.forceLocal && !MAP.QA_MODE) intent = await fetchIntent(q);
  if (!intent) intent = localIntent(q);
  const rows = execIntent(intent);
  assistResults = { reply: intent.reply || 'זה מה שמצאתי:', src: intent.src, rows };
  bizChipSel = 'all';
  bizFocus = intent.bizCats && intent.bizCats.length ? new Set(intent.bizCats) : null;
  syncBizChips();
  renderBizList();
  highlightResults(rows);
  aiBusy = false;
  $('aiGo').classList.remove('busy');
}
$('aiForm').addEventListener('submit', e => {
  e.preventDefault();
  runAssist($('aiInput').value);
});
$('aiSugg').addEventListener('click', e => {
  const chip = e.target.closest('.sug');
  if (!chip) return;
  $('aiInput').value = chip.dataset.q;
  runAssist(chip.dataset.q);
});
$('aiInput').addEventListener('input', () => {
  if (!$('aiInput').value.trim() && assistResults) clearAssist(true);
  else if (!assistResults) renderBizList();
});

// ---------- deep-link + share support (biz=id) ----------
window.BIZAPI = {
  byId: id => bizById.get(id),
  open: b => showBizPop(b),
  count: bizAll.length,
};

// first-visit hint
if (!MAP.QA_MODE && !(typeof PICK_MODE !== 'undefined' && PICK_MODE) && bizAll.length && !store.getItem('rg.aiSeen')) {
  setTimeout(() => {
    store.setItem('rg.aiSeen', '1');
    showToast('✨ חדש: «מה בא לך היום?» — ספרו לעוזר ותקבלו עסקים ואירועים סביבכם');
  }, 15000);
}

// ---------- QA hooks ----------
window.__qaExt = function (qs) {
  if (/aipanel/.test(qs)) { openAiPanel(); }
  const am = qs.match(/ai=([^&]+)/);
  if (am) {
    openAiPanel();
    const q = decodeURIComponent(am[1]);
    $('aiInput').value = q;
    const intent = localIntent(q);
    const rows = execIntent(intent);
    assistResults = { reply: intent.reply, src: intent.src, rows };
    bizFocus = intent.bizCats.length ? new Set(intent.bizCats) : null;
    renderBizList();
    const bizIds = rows.filter(r => r.kind === 'biz').map(r => r.ref.id);
    bizHi = bizIds.length ? new Set(bizIds) : null;
    positionBiz();
    MAP.drawOnce();
  }
  if (/bizpop/.test(qs)) {
    const b = bizAll.find(x => x.hours && x.phone && x.cat === 'food') || bizAll.find(x => x.hours) || bizAll[0];
    if (b) {
      Object.assign(MAP.cam, { cx: b.x, cy: b.y + 40, dist: 460, tilt: 0.6, bearing: 0 });
      MAP.drawOnce();
      showBizPop(b);
      MAP.drawOnce();
    }
  }
  if (/bizmk/.test(qs)) { positionBiz(); MAP.drawOnce(); }
};
