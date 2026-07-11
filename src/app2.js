/* ============================================================
   Part 2 — scene assembly, camera, render pipeline, controls
   ============================================================ */

// ---------- flat geometry accumulator with color ranges ----------
const F_ACC = { pos: new Acc(), side: new Acc(), idx: new Acc(), vcount: 0 };
const flatRanges = []; // {key, start, count} in index units, drawn in order
function markRange(key, fn) {
  const start = F_ACC.idx.len;
  fn();
  const count = F_ACC.idx.len - start;
  if (count > 0) flatRanges.push({ key, start, count });
}

// city bbox (for ground quad, particles, clamping)
const BBOX = { minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9 };
const boundaryRings = CITY_D.boundary.map(r => decodeLine(r, 0));
for (const r of boundaryRings) for (let i = 0; i < r.length / 2; i++) {
  BBOX.minX = Math.min(BBOX.minX, r[2 * i]); BBOX.maxX = Math.max(BBOX.maxX, r[2 * i]);
  BBOX.minY = Math.min(BBOX.minY, r[2 * i + 1]); BBOX.maxY = Math.max(BBOX.maxY, r[2 * i + 1]);
}

// green polygons grouped by kind (0 park/grass, 1 water, 2 pitch, 3 cemetery)
const greenByKind = [[], [], [], []];
for (const g of CITY_D.grn) greenByKind[g[0]].push(decodeLine(g, 1));
// park polygons kept for particle spawning
const parkPolys = greenByKind[0];

// roads grouped by class, plus per-road decoded pts for labels/search
const roadsByCls = [[], [], [], [], [], [], [], []];
const roadPts = []; // idx-aligned with CITY_D.rd
for (const r of CITY_D.rd) {
  const pts = decodeLine(r, 1);
  roadPts.push(pts);
  roadsByCls[r[0]].push(pts);
}

function assembleFlat() {
  // greens under everything
  markRange('park', () => { for (const p of greenByKind[0]) buildFlatPoly(F_ACC, p, 0.12); });
  markRange('cemetery', () => { for (const p of greenByKind[3]) buildFlatPoly(F_ACC, p, 0.13); });
  markRange('pitch', () => { for (const p of greenByKind[2]) buildFlatPoly(F_ACC, p, 0.14); });
  markRange('water', () => { for (const p of greenByKind[1]) buildFlatPoly(F_ACC, p, 0.15); });
  // boundary glow (closed rings)
  const closed = boundaryRings.map(r => {
    const out = new Float32Array(r.length + 2);
    out.set(r); out[r.length] = r[0]; out[r.length + 1] = r[1];
    return out;
  });
  markRange('bndWide', () => { for (const r of closed) buildRibbon(F_ACC, r, 90, 0.3); });
  markRange('bndLine', () => { for (const r of closed) buildRibbon(F_ACC, r, 10, 0.35); });
  // roads: minor first, majors on top
  for (let c = 7; c >= 0; c--) {
    markRange('road' + c, () => { for (const pts of roadsByCls[c]) buildRibbon(F_ACC, pts, ROAD_W[c], ROAD_Z[c]); });
  }
}

// ---------- optional layers: planning polygons + light rail ----------
const LAYERS = { plans: false, transit: false };
const PL_ACC = { pos: new Acc(), side: new Acc(), idx: new Acc(), vcount: 0 };
const planRanges = [];
const PLANS_RT = []; // runtime hit-test list: {rings:[Float32Array], bbox, area, ref}
function markPlanRange(key, fn) {
  const start = PL_ACC.idx.len;
  fn();
  const count = PL_ACC.idx.len - start;
  if (count > 0) planRanges.push({ key, start, count });
}
function assemblePlans() {
  if (!CITY_D.plans) return;
  const byKind = { a: [], p: [], r: [] };
  for (const p of CITY_D.plans) {
    const rings = p.r.map(r => decodeLine(r, 0));
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9, area = 0;
    for (const ring of rings) for (let i = 0; i < ring.length / 2; i++) {
      mnx = Math.min(mnx, ring[2 * i]); mxx = Math.max(mxx, ring[2 * i]);
      mny = Math.min(mny, ring[2 * i + 1]); mxy = Math.max(mxy, ring[2 * i + 1]);
    }
    for (const ring of rings) area += Math.abs(signedArea(ring));
    PLANS_RT.push({ rings, bbox: [mnx, mny, mxx, mxy], area, ref: p });
    byKind[p.k].push(rings);
  }
  const closeRing = (r) => {
    const out = new Float32Array(r.length + 2);
    out.set(r); out[r.length] = r[0]; out[r.length + 1] = r[1];
    return out;
  };
  markPlanRange('planP', () => { for (const rs of byKind.p) for (const r of rs) buildFlatPoly(PL_ACC, r, 1.6); });
  markPlanRange('planA', () => { for (const rs of byKind.a) for (const r of rs) buildFlatPoly(PL_ACC, r, 1.7); });
  markPlanRange('planR', () => { for (const rs of byKind.r) for (const r of rs) buildFlatPoly(PL_ACC, r, 1.75); });
  markPlanRange('planPLine', () => { for (const rs of byKind.p) for (const r of rs) buildRibbon(PL_ACC, closeRing(r), 5, 1.8); });
  markPlanRange('planALine', () => { for (const rs of byKind.a) for (const r of rs) buildRibbon(PL_ACC, closeRing(r), 5, 1.9); });
  markPlanRange('planRLine', () => { for (const rs of byKind.r) for (const r of rs) buildRibbon(PL_ACC, closeRing(r), 5, 1.95); });
}
function planAtPoint(x, y) {
  let best = null;
  for (const p of PLANS_RT) {
    const b = p.bbox;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    let inside = false;
    for (const ring of p.rings) {
      const n = ring.length / 2;
      let ins = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = ring[2 * i], yi = ring[2 * i + 1], xj = ring[2 * j], yj = ring[2 * j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
      }
      if (ins) { inside = true; break; }
    }
    if (inside && (!best || p.area < best.area)) best = p;
  }
  return best ? best.ref : null;
}
const RL_ACC = { pos: new Acc(), side: new Acc(), idx: new Acc(), vcount: 0 };
const railRanges = [];
function assembleRail() {
  if (!CITY_D.rail) return;
  const surf = [], tun = [];
  for (const r of CITY_D.rail) (r[0] === 1 ? tun : surf).push(decodeLine(r, 1));
  const mark = (key, fn) => {
    const start = RL_ACC.idx.len;
    fn();
    const count = RL_ACC.idx.len - start;
    if (count > 0) railRanges.push({ key, start, count });
  };
  mark('railTunnel', () => { for (const pts of tun) buildRibbon(RL_ACC, pts, 6, 1.42) });
  mark('rail', () => { for (const pts of surf) buildRibbon(RL_ACC, pts, 6, 1.44) });
}

// ---------- particles ("אבקת יהלומים") ----------
// seeded LCG so QA screenshots are diff-able (Math.random broke determinism)
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function makePointsVAO(seeds) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count: seeds.length / 4 };
}
function buildDust() {
  const N = 1500;
  const rnd = makeRng(0x5eed);
  const seeds = new Float32Array(N * 4);
  // sample: 55% over parks, rest across city
  const pb = parkPolys.map(p => {
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (let i = 0; i < p.length / 2; i++) { mnx = Math.min(mnx, p[2*i]); mxx = Math.max(mxx, p[2*i]); mny = Math.min(mny, p[2*i+1]); mxy = Math.max(mxy, p[2*i+1]); }
    return { p, mnx, mny, mxx, mxy, w: Math.max(1, (mxx - mnx) * (mxy - mny)) };
  }).filter(b => b.w > 3000);
  const totW = pb.reduce((s, b) => s + b.w, 0);
  for (let i = 0; i < N; i++) {
    let x, y;
    if (pb.length && rnd() < 0.55) {
      let t = rnd() * totW, bi = 0;
      while (bi < pb.length - 1 && t > pb[bi].w) { t -= pb[bi].w; bi++; }
      const b = pb[bi];
      x = b.mnx + rnd() * (b.mxx - b.mnx);
      y = b.mny + rnd() * (b.mxy - b.mny);
    } else {
      x = BBOX.minX + rnd() * (BBOX.maxX - BBOX.minX);
      y = BBOX.minY + rnd() * (BBOX.maxY - BBOX.minY);
    }
    seeds[4 * i] = x; seeds[4 * i + 1] = y;
    seeds[4 * i + 2] = 4 + rnd() * 55;
    seeds[4 * i + 3] = rnd();
  }
  meshes.dust = makePointsVAO(seeds);
}

// warm sodium halos every ~65m along the arterial roads (static, hash-thinned)
function buildLamps() {
  const cap = window.IS_MOBILE ? 800 : 2200;
  const pts = [];
  outer: for (let cls = 0; cls <= 2; cls++) {
    for (const road of roadsByCls[cls]) {
      let acc = 0;
      for (let i = 0; i < road.length / 2 - 1; i++) {
        const x0 = road[2 * i], y0 = road[2 * i + 1], x1 = road[2 * i + 2], y1 = road[2 * i + 3];
        const seg = Math.hypot(x1 - x0, y1 - y0);
        acc += seg;
        if (acc < 65) continue;
        acc = 0;
        const hx = Math.abs((x1 * 12.9898 + y1 * 78.233) % 1);
        if (hx < 0.15) continue; // thin out, breaks mechanical repetition
        pts.push(x1, y1, 6, hx);
        if (pts.length / 4 >= cap) break outer;
      }
    }
  }
  meshes.lamps = pts.length ? makePointsVAO(new Float32Array(pts)) : null;
  meshes.lampSeeds = pts.length ? new Float32Array(pts) : null;
}

// wet-street reflection streaks share the lamp seeds, drawn as instanced quads
function buildStreaks() {
  if (!meshes.lampSeeds) { meshes.streaks = null; return; }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ib);
  gl.bufferData(gl.ARRAY_BUFFER, meshes.lampSeeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);
  meshes.streaks = { vao, count: meshes.lampSeeds.length / 4 };
}

// blinking red aviation beacons on the tallest towers
function buildBeacons() {
  const cands = [];
  B.centroids.forEach((c, i) => { if (c && B.heights[i] >= 90) cands.push({ x: c[0], y: c[1], h: B.heights[i] }); });
  cands.sort((a, b) => b.h - a.h);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= 16) break;
    if (picked.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 40)) continue; // multi-part towers
    picked.push(c);
  }
  if (!picked.length) { meshes.beacons = null; return; }
  const seeds = new Float32Array(picked.length * 4);
  picked.forEach((p, i) => {
    seeds.set([p.x, p.y, p.h + 2.5, Math.abs((p.x * 12.9898 + p.y * 78.233) % 1)], i * 4);
  });
  meshes.beacons = makePointsVAO(seeds);
}

// procedural greenery — no OSM tree data exists for these cities, so trees are
// scattered deterministically: park interiors (1/~450m²) + sidewalk rows along
// tertiary/residential streets, kept off building footprints via a centroid grid
function buildTrees() {
  const cap = window.IS_MOBILE ? 1600 : 4000;
  const rnd = makeRng(0x7ee5);
  const inst = [];
  const inPoly = (p, x, y) => {
    const n = p.length / 2; let ins = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = p[2 * i], yi = p[2 * i + 1], xj = p[2 * j], yj = p[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  for (const p of parkPolys) {
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (let i = 0; i < p.length / 2; i++) {
      mnx = Math.min(mnx, p[2 * i]); mxx = Math.max(mxx, p[2 * i]);
      mny = Math.min(mny, p[2 * i + 1]); mxy = Math.max(mxy, p[2 * i + 1]);
    }
    let want = Math.min(Math.floor(Math.abs(signedArea(p)) / 450), 260);
    let tries = want * 8;
    while (want > 0 && tries-- > 0 && inst.length / 4 < cap * 0.7) {
      const x = mnx + rnd() * (mxx - mnx), y = mny + rnd() * (mxy - mny);
      if (!inPoly(p, x, y)) continue;
      inst.push(x, y, 2.3 + rnd() * 2.2, rnd());
      want--;
    }
    if (inst.length / 4 >= cap * 0.7) break;
  }
  const grid = new Map();
  B.centroids.forEach(c => {
    if (!c) return;
    const k = Math.floor(c[0] / 16) + ':' + Math.floor(c[1] / 16);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(c);
  });
  const nearBld = (x, y) => {
    const gx = Math.floor(x / 16), gy = Math.floor(y / 16);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cell = grid.get((gx + i) + ':' + (gy + j));
      if (cell) for (const c of cell) if (Math.hypot(c[0] - x, c[1] - y) < 11) return true;
    }
    return false;
  };
  outer: for (let cls = 2; cls <= 3; cls++) {
    const off = ROAD_W[cls] / 2 + 2.6;
    for (const road of roadsByCls[cls]) {
      let acc = 30, side = 1;
      for (let i = 0; i < road.length / 2 - 1; i++) {
        const x0 = road[2 * i], y0 = road[2 * i + 1], x1 = road[2 * i + 2], y1 = road[2 * i + 3];
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
        acc += len;
        if (acc < 48) continue;
        acc = 0; side = -side;
        if (rnd() < 0.4) continue; // organic gaps
        const x = x1 - dy / len * off * side, y = y1 + dx / len * off * side;
        if (nearBld(x, y)) continue;
        inst.push(x, y, 1.9 + rnd() * 1.5, rnd());
        if (inst.length / 4 >= cap) break outer;
      }
    }
  }
  if (!inst.length) { meshes.trees = null; return; }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ib);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inst), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);
  meshes.trees = { vao, count: inst.length / 4 };
}

// static lane geometry for the traffic trails: two offset strips per arterial
// road (one per direction), length + phase baked per vertex — animation is GPU-only
function buildTrails() {
  const maxCls = window.IS_MOBILE ? 1 : 2;
  const P = [], D = [], I = [];
  let vc = 0;
  const rndH = (x, y) => Math.abs((x * 12.9898 + y * 78.233) % 1);
  for (let cls = 0; cls <= maxCls; cls++) {
    const z = ROAD_Z[cls] + 0.15;
    const lane = ROAD_W[cls] * 0.22;
    for (const road of roadsByCls[cls]) {
      const n = road.length / 2;
      if (n < 2) continue;
      const ph = rndH(road[0], road[1]);
      for (const dir of [1, -1]) {
        const base = vc;
        let acc = 0;
        for (let i = 0; i < n; i++) {
          const x = road[2 * i], y = road[2 * i + 1];
          let dx0 = 0, dy0 = 0, dx1 = 0, dy1 = 0;
          if (i > 0) { dx0 = x - road[2 * i - 2]; dy0 = y - road[2 * i - 1]; const l = Math.hypot(dx0, dy0) || 1; dx0 /= l; dy0 /= l; }
          if (i < n - 1) { dx1 = road[2 * i + 2] - x; dy1 = road[2 * i + 3] - y; const l = Math.hypot(dx1, dy1) || 1; dx1 /= l; dy1 /= l; }
          let tx = dx0 + dx1, ty = dy0 + dy1;
          const tl = Math.hypot(tx, ty);
          if (tl < 1e-6) { tx = dx1 || dx0 || 1; ty = dy1 || dy0; } else { tx /= tl; ty /= tl; }
          const nx = -ty, ny = tx;
          if (i > 0) acc += Math.hypot(x - road[2 * i - 2], y - road[2 * i - 1]);
          const cx = x + nx * lane * dir, cy = y + ny * lane * dir;
          P.push(cx + nx * 1.4, cy + ny * 1.4, z, cx - nx * 1.4, cy - ny * 1.4, z); // 2.8m strip
          D.push(acc, dir, ph, 1, acc, dir, ph, -1);
          vc += 2;
        }
        for (let i = 0; i < n - 1; i++) { const v = base + i * 2; I.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      }
    }
  }
  meshes.trails = I.length
    ? makeVAO([{ data: new Float32Array(P), size: 3, loc: 0 }, { data: new Float32Array(D), size: 4, loc: 1 }], new Uint32Array(I))
    : null;
}

// ---------- finalize meshes ----------
function uploadMeshes() {
  meshes.bld = makeVAO([
    { data: B.pos.concat(Float32Array), size: 3, loc: 0 },
    { data: B.shade.concat(Float32Array), size: 1, loc: 1 },
    { data: B.u.concat(Float32Array), size: 1, loc: 2 },
    { data: B.h.concat(Float32Array), size: 1, loc: 3 },
    { data: B.rnd.concat(Float32Array), size: 1, loc: 4 },
    { data: B.wall.concat(Float32Array), size: 1, loc: 5 },
    { data: B.n.concat(Float32Array), size: 2, loc: 6 },
  ], B.idx.concat(Uint32Array));
  meshes.flat = makeVAO([
    { data: F_ACC.pos.concat(Float32Array), size: 3, loc: 0 },
    { data: F_ACC.side.concat(Float32Array), size: 1, loc: 1 },
  ], F_ACC.idx.concat(Uint32Array));
  if (PL_ACC.idx.len) meshes.plans = makeVAO([
    { data: PL_ACC.pos.concat(Float32Array), size: 3, loc: 0 },
    { data: PL_ACC.side.concat(Float32Array), size: 1, loc: 1 },
  ], PL_ACC.idx.concat(Uint32Array));
  if (RL_ACC.idx.len) meshes.rail = makeVAO([
    { data: RL_ACC.pos.concat(Float32Array), size: 3, loc: 0 },
    { data: RL_ACC.side.concat(Float32Array), size: 1, loc: 1 },
  ], RL_ACC.idx.concat(Uint32Array));
  const gx = (BBOX.minX + BBOX.maxX) / 2, gy = (BBOX.minY + BBOX.maxY) / 2;
  const gw = (BBOX.maxX - BBOX.minX) * 6, gh = (BBOX.maxY - BBOX.minY) * 6; // far past the fog — no visible plane edge at high tilt
  meshes.ground = makeVAO([
    { data: new Float32Array([gx - gw, gy - gh, gx + gw, gy - gh, gx - gw, gy + gh, gx + gw, gy + gh]), size: 2, loc: 0 },
  ], new Uint32Array([0, 1, 2, 1, 3, 2]));
  meshes.quad = makeVAO([
    { data: new Float32Array([-1, -1, 3, -1, -1, 3]), size: 2, loc: 0 },
  ], null);
  meshes.quad.count = 3;
  buildDust();
  buildLamps();
  buildBeacons();
  buildTrees();
  buildTrails();
  buildStreaks();
}

// ---------- framebuffers ----------
const FB = { w: 0, h: 0 };
function makeTexFBO(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}
function setupFBOs(w, h) {
  if (FB.w === w && FB.h === h) return;
  FB.w = w; FB.h = h;
  for (const k of ['msaaFbo', 'msaaColor', 'msaaDepth']) if (FB[k]) { /* recreated below */ }
  // MSAA render target
  const samples = Math.min(window.IS_MOBILE ? 2 : 4, gl.getParameter(gl.MAX_SAMPLES) || 0);
  FB.samples = samples;
  if (FB.msaaFbo) { gl.deleteFramebuffer(FB.msaaFbo); gl.deleteRenderbuffer(FB.msaaColor); gl.deleteRenderbuffer(FB.msaaDepth); }
  if (FB.scene) { gl.deleteFramebuffer(FB.scene.fbo); gl.deleteTexture(FB.scene.tex); }
  if (FB.bloomA) { gl.deleteFramebuffer(FB.bloomA.fbo); gl.deleteTexture(FB.bloomA.tex); gl.deleteFramebuffer(FB.bloomB.fbo); gl.deleteTexture(FB.bloomB.tex); }
  if (samples > 0) {
    FB.msaaColor = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, FB.msaaColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    FB.msaaDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, FB.msaaDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    FB.msaaFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.msaaFbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, FB.msaaColor);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, FB.msaaDepth);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(FB.msaaFbo); gl.deleteRenderbuffer(FB.msaaColor); gl.deleteRenderbuffer(FB.msaaDepth);
      FB.msaaFbo = FB.msaaColor = FB.msaaDepth = null;
      FB.samples = 0;
    }
  }
  // full-res depth as a TEXTURE so SSAO can read it: the MSAA path resolves depth
  // into it via blit; the non-MSAA path renders straight into it
  if (FB.depthFbo) { gl.deleteFramebuffer(FB.depthFbo); gl.deleteTexture(FB.depthT); }
  FB.depthT = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, FB.depthT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  FB.depthFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.depthFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, FB.depthT, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    ERRLOG.push('depth FBO incomplete');
    gl.deleteFramebuffer(FB.depthFbo); gl.deleteTexture(FB.depthT);
    FB.depthFbo = FB.depthT = null;
  }
  FB.scene = makeTexFBO(w, h);
  if (FB.samples === 0) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.scene.fbo);
    if (FB.depthT) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, FB.depthT, 0);
    } else {
      FB.msaaDepth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, FB.msaaDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, FB.msaaDepth);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ERRLOG.push('scene FBO incomplete');
  }
  const bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
  FB.bloomA = makeTexFBO(bw, bh);
  FB.bloomB = makeTexFBO(bw, bh);
  if (FB.ao) { gl.deleteFramebuffer(FB.ao.fbo); gl.deleteTexture(FB.ao.tex); }
  FB.ao = makeTexFBO(bw, bh);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// ---------- shadow map (screen-size independent; created lazily, once) ----------
const IDENT32 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function ensureShadow() {
  if (FB.shadow !== undefined) return;
  const size = window.IS_MOBILE ? 1024 : 2048;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // hardware 2x2 PCF
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    ERRLOG.push('shadow FBO incomplete');
    gl.deleteFramebuffer(fbo); gl.deleteTexture(tex);
    FB.shadow = null; // shaders branch out on uShadowK=0 — soft degrade
  } else {
    gl.viewport(0, 0, size, size);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT); // all-lit baseline for frames that skip the pass
    FB.shadow = { fbo, tex, size };
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
// orthographic sun/moon frustum: follows the camera target, snapped to shadow
// texels so panning doesn't shimmer, sized to the visible slab (z 0..260m)
function computeLightVP() {
  const sd = PAL.sunDir || [0.62, 0.7, 0.35];
  const sl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
  const sn = [sd[0] / sl, sd[1] / sl, Math.max(sd[2] / sl, 0.12)];
  const R = clamp(cam.dist * 1.6, 260, 4200);
  const view = mat4LookAt([cam.cx + sn[0] * 5000, cam.cy + sn[1] * 5000, sn[2] * 5000], [cam.cx, cam.cy, 0], [0, 0, 1]);
  let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
  for (let i = 0; i < 8; i++) {
    const wx = cam.cx + ((i & 1) ? R : -R), wy = cam.cy + ((i & 2) ? R : -R), wz = (i & 4) ? 260 : 0;
    const lx = view[0] * wx + view[4] * wy + view[8] * wz + view[12];
    const ly = view[1] * wx + view[5] * wy + view[9] * wz + view[13];
    const lz = view[2] * wx + view[6] * wy + view[10] * wz + view[14];
    mnx = Math.min(mnx, lx); mxx = Math.max(mxx, lx);
    mny = Math.min(mny, ly); mxy = Math.max(mxy, ly);
    mnz = Math.min(mnz, lz); mxz = Math.max(mxz, lz);
  }
  const tx = (mxx - mnx) / FB.shadow.size, ty = (mxy - mny) / FB.shadow.size;
  mnx = Math.floor(mnx / tx) * tx; mny = Math.floor(mny / ty) * ty;
  const proj = mat4Ortho(mnx, mnx + Math.ceil((mxx - mnx) / tx) * tx,
                         mny, mny + Math.ceil((mxy - mny) / ty) * ty,
                         -mxz - 400, -mnz + 400);
  return mat4Mul(proj, view);
}

// ---------- camera ----------
const CENTER0 = [(BBOX.minX + BBOX.maxX) / 2, (BBOX.minY + BBOX.maxY) / 2];
const cam = { cx: CENTER0[0], cy: CENTER0[1], dist: 9500, bearing: 0, tilt: 0.03 };
const camLim = {
  minDist: 130, maxDist: 15000, minTilt: 0.015, maxTilt: 1.12,
  minX: BBOX.minX - 1800, maxX: BBOX.maxX + 1800, minY: BBOX.minY - 1800, maxY: BBOX.maxY + 1800,
};
let VP = null, INV_VP = null, ASPECT = 1;
let EYE = [0, 0, 0], NEAR = 2, FAR = 20000;
function clampCam() {
  cam.dist = clamp(cam.dist, camLim.minDist, camLim.maxDist);
  cam.tilt = clamp(cam.tilt, camLim.minTilt, camLim.maxTilt);
  cam.cx = clamp(cam.cx, camLim.minX, camLim.maxX);
  cam.cy = clamp(cam.cy, camLim.minY, camLim.maxY);
}
function computeVP() {
  clampCam();
  const st = Math.sin(cam.tilt), ct = Math.cos(cam.tilt);
  const sb = Math.sin(cam.bearing), cb = Math.cos(cam.bearing);
  const eye = [cam.cx + cam.dist * st * sb, cam.cy - cam.dist * st * cb, cam.dist * ct];
  EYE = eye;
  const view = mat4LookAt(eye, [cam.cx, cam.cy, 0], [0, 0, 1]);
  const near = Math.max(2, cam.dist * 0.04);
  const far = cam.dist * 6 + 6000;
  NEAR = near; FAR = far;
  const proj = mat4Persp(48 * Math.PI / 180, ASPECT, near, far);
  VP = mat4Mul(proj, view);
  INV_VP = mat4Inv(VP);
  window.dispatchEvent(new CustomEvent('mapmove'));
}
function project(x, y, z) { // world -> css px; returns [sx, sy, visible]
  const w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
  if (w <= 0.001) return [0, 0, false];
  const sx = (VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w;
  const sy = (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w;
  return [(sx * 0.5 + 0.5) * innerWidth, (0.5 - sy * 0.5) * innerHeight, sx > -1.25 && sx < 1.25 && sy > -1.25 && sy < 1.25];
}
function unprojectGround(px, py) { // css px -> world point on z=0 plane
  const nx = (px / innerWidth) * 2 - 1, ny = 1 - (py / innerHeight) * 2;
  const p = INV_VP;
  const ax = p[0] * nx + p[4] * ny + p[8] * -1 + p[12], ay = p[1] * nx + p[5] * ny + p[9] * -1 + p[13],
        az = p[2] * nx + p[6] * ny + p[10] * -1 + p[14], aw = p[3] * nx + p[7] * ny + p[11] * -1 + p[15];
  const bx = p[0] * nx + p[4] * ny + p[8] * 1 + p[12], by = p[1] * nx + p[5] * ny + p[9] * 1 + p[13],
        bz = p[2] * nx + p[6] * ny + p[10] * 1 + p[14], bw = p[3] * nx + p[7] * ny + p[11] * 1 + p[15];
  const x0 = ax / aw, y0 = ay / aw, z0 = az / aw;
  const x1 = bx / bw, y1 = by / bw, z1 = bz / bw;
  const dz = z1 - z0;
  if (Math.abs(dz) < 1e-9) return null;
  const t = -z0 / dz;
  if (t < 0) return null;
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

// ---------- theme palette (engine side; UI sets it) ----------
let PAL = null;
function setPalette(p) { PAL = p; document.documentElement.style.background = p.css; needRender = true; }

// ---------- render ----------
let needRender = true;
let timeSec = 0;
function draw() {
  const w = FB.w, h = FB.h;
  const vp32 = new Float32Array(VP);

  // --- shadow depth pass (fades out toward city-wide zoom, then skipped) ---
  ensureShadow();
  const shFade = clamp(1 - (cam.dist - 3800) / 3200, 0, 1);
  const shK = FB.shadow ? (PAL.shadowK ?? 0) * shFade : 0;
  let lvp32 = IDENT32;
  if (shK > 0.01) {
    lvp32 = new Float32Array(computeLightVP());
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.shadow.fbo);
    gl.viewport(0, 0, FB.shadow.size, FB.shadow.size);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2.0, 4.0);
    gl.useProgram(depthProg.p);
    gl.uniformMatrix4fv(depthProg.u.uVP, false, lvp32);
    gl.bindVertexArray(meshes.bld.vao);
    gl.drawElements(gl.TRIANGLES, meshes.bld.count, gl.UNSIGNED_INT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.DEPTH_TEST);
  }
  if (FB.shadow) {
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, FB.shadow.tex);
    gl.activeTexture(gl.TEXTURE0);
  }
  const shTexel = FB.shadow ? 1 / FB.shadow.size : 1;
  const setShadow = prog => {
    gl.uniform1i(prog.u.uShadow, 7);
    gl.uniform1f(prog.u.uShadowK, shK);
    gl.uniform1f(prog.u.uShTexel, shTexel);
    gl.uniformMatrix4fv(prog.u.uLightVP, false, lvp32);
  };

  const target = FB.samples > 0 ? FB.msaaFbo : FB.scene.fbo;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  gl.viewport(0, 0, w, h);
  gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
  gl.clearColor(PAL.sky1[0], PAL.sky1[1], PAL.sky1[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.BLEND);

  // sky
  gl.depthMask(false);
  gl.useProgram(skyProg.p);
  gl.uniform3fv(skyProg.u.uSkyTop, PAL.sky0);
  gl.uniform3fv(skyProg.u.uSkyHor, PAL.sky1);
  gl.uniformMatrix4fv(skyProg.u.uInvVP, false, new Float32Array(INV_VP));
  gl.uniform3fv(skyProg.u.uEye, EYE);
  const sd = PAL.sunDir || [0.62, 0.7, 0.35];
  const sdl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
  gl.uniform3fv(skyProg.u.uSunDir3, [sd[0] / sdl, sd[1] / sdl, sd[2] / sdl]);
  gl.uniform3fv(skyProg.u.uSkyGlowCol, PAL.skyGlowCol || [0.3, 0.2, 0.12]);
  gl.uniform1f(skyProg.u.uSkyGlowAmt, PAL.skyGlowAmt ?? 0);
  gl.uniform1f(skyProg.u.uStarAmt, PAL.starAmt ?? 0);
  gl.uniform1f(skyProg.u.uMilky, PAL.milky ?? 0);
  gl.uniform1f(skyProg.u.uSunDiscAmt, PAL.sunDiscAmt ?? 0);
  gl.bindVertexArray(meshes.quad.vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // ground
  gl.useProgram(groundProg.p);
  gl.uniformMatrix4fv(groundProg.u.uVP, false, vp32);
  gl.uniform3fv(groundProg.u.uG0, PAL.ground0);
  gl.uniform3fv(groundProg.u.uG1, PAL.ground1);
  gl.uniform3fv(groundProg.u.uFog, PAL.fog);
  gl.uniform1f(groundProg.u.uFogD, PAL.fogD);
  gl.uniform1f(groundProg.u.uFogAmt, PAL.fogAmt);
  gl.uniform1f(groundProg.u.uFogH, PAL.fogH ?? 0);
  setShadow(groundProg);
  gl.bindVertexArray(meshes.ground.vao);
  gl.drawElements(gl.TRIANGLES, meshes.ground.count, gl.UNSIGNED_INT, 0);

  // flat ranges (greens, boundary, roads)
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(flatProg.p);
  gl.uniformMatrix4fv(flatProg.u.uVP, false, vp32);
  gl.uniform3fv(flatProg.u.uFog, PAL.fog);
  gl.uniform1f(flatProg.u.uFogD, PAL.fogD);
  gl.uniform1f(flatProg.u.uFogAmt, PAL.fogAmt);
  gl.uniform1f(flatProg.u.uFogH, PAL.fogH ?? 0);
  gl.uniform1f(flatProg.u.uTime, timeSec);
  gl.uniform1f(flatProg.u.uRipple, 0);
  setShadow(flatProg);
  gl.bindVertexArray(meshes.flat.vao);
  for (const r of flatRanges) {
    const col = PAL.flat[r.key];
    if (!col || col[3] === 0) continue;
    gl.uniform4fv(flatProg.u.uColor, col);
    if (r.key === 'water') gl.uniform1f(flatProg.u.uRipple, PAL.rippleK ?? 0);
    gl.drawElements(gl.TRIANGLES, r.count, gl.UNSIGNED_INT, r.start * 4);
    if (r.key === 'water') gl.uniform1f(flatProg.u.uRipple, 0);
  }
  // optional layers (same program/state)
  if (LAYERS.transit && meshes.rail) {
    gl.bindVertexArray(meshes.rail.vao);
    for (const r of railRanges) {
      const col = PAL.flat[r.key];
      if (!col) continue;
      gl.uniform4fv(flatProg.u.uColor, col);
      gl.drawElements(gl.TRIANGLES, r.count, gl.UNSIGNED_INT, r.start * 4);
    }
  }
  if (LAYERS.plans && meshes.plans) {
    gl.bindVertexArray(meshes.plans.vao);
    for (const r of planRanges) {
      const col = PAL.flat[r.key];
      if (!col) continue;
      gl.uniform4fv(flatProg.u.uColor, col);
      gl.drawElements(gl.TRIANGLES, r.count, gl.UNSIGNED_INT, r.start * 4);
    }
  }

  // buildings
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.useProgram(bldProg.p);
  gl.uniformMatrix4fv(bldProg.u.uVP, false, vp32);
  gl.uniform3fv(bldProg.u.uBase, PAL.bldBase);
  gl.uniform3fv(bldProg.u.uTop, PAL.bldTop);
  gl.uniform3fv(bldProg.u.uWin, PAL.win);
  gl.uniform1f(bldProg.u.uNight, PAL.night);
  gl.uniform3fv(bldProg.u.uFog, PAL.fog);
  gl.uniform1f(bldProg.u.uFogD, PAL.fogD);
  gl.uniform1f(bldProg.u.uFogAmt, PAL.fogAmt);
  gl.uniform3fv(bldProg.u.uEye, EYE);
  gl.uniform1f(bldProg.u.uTime, timeSec);
  gl.uniform3fv(bldProg.u.uSunDir, PAL.sunDir || [0.62, 0.7, 0.35]);
  gl.uniform3fv(bldProg.u.uRimCol, PAL.rimCol || [0.55, 0.7, 1]);
  gl.uniform1f(bldProg.u.uRimK, PAL.rimK ?? 0);
  gl.uniform1f(bldProg.u.uSpecK, PAL.specK ?? 0);
  gl.uniform3fv(bldProg.u.uWinCool, PAL.winCool || PAL.win);
  gl.uniform1f(bldProg.u.uWinLit, PAL.winLit ?? 0.38);
  gl.uniform1f(bldProg.u.uFloorDark, PAL.floorDark ?? 0);
  gl.uniform1f(bldProg.u.uPenthouse, PAL.penthouse ?? 0);
  gl.uniform1f(bldProg.u.uWinBleed, PAL.winBleed ?? 0);
  gl.uniform1f(bldProg.u.uFogH, PAL.fogH ?? 0);
  gl.uniform3fv(bldProg.u.uSunWarm, PAL.sunWarm || [1, 1, 1]);
  gl.uniform1f(bldProg.u.uSunK, PAL.sunK ?? 0);
  gl.uniform1f(bldProg.u.uSheenK, PAL.sheenK ?? 0);
  setShadow(bldProg);
  gl.bindVertexArray(meshes.bld.vao);
  gl.drawElements(gl.TRIANGLES, meshes.bld.count, gl.UNSIGNED_INT, 0);

  // trees (opaque alpha-test billboards; same depth state as buildings)
  if ((PAL.treeAmt ?? 0) > 0.01 && meshes.trees) {
    gl.useProgram(treeProg.p);
    gl.uniformMatrix4fv(treeProg.u.uVP, false, vp32);
    gl.uniform3fv(treeProg.u.uEye, EYE);
    gl.uniform3fv(treeProg.u.uCol0, PAL.treeCol0 || [0.10, 0.16, 0.10]);
    gl.uniform3fv(treeProg.u.uCol1, PAL.treeCol1 || [0.2, 0.3, 0.16]);
    gl.uniform3fv(treeProg.u.uFog, PAL.fog);
    gl.uniform1f(treeProg.u.uFogD, PAL.fogD);
    gl.uniform1f(treeProg.u.uFogAmt, PAL.fogAmt);
    gl.uniform1f(treeProg.u.uFogH, PAL.fogH ?? 0);
    setShadow(treeProg);
    gl.bindVertexArray(meshes.trees.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, meshes.trees.count);
  }

  // street lamps + tower beacons (additive, depth-tested so buildings occlude them)
  if ((PAL.lampAmt ?? 0) > 0.01 && meshes.lamps) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(lampProg.p);
    gl.uniformMatrix4fv(lampProg.u.uVP, false, vp32);
    gl.uniform3fv(lampProg.u.uCol, PAL.lampCol || [1, 0.72, 0.38]);
    gl.uniform1f(lampProg.u.uAmt, PAL.lampAmt);
    gl.bindVertexArray(meshes.lamps.vao);
    gl.drawArrays(gl.POINTS, 0, meshes.lamps.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  if ((PAL.beaconAmt ?? 0) > 0.01 && meshes.beacons) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(beaconProg.p);
    gl.uniformMatrix4fv(beaconProg.u.uVP, false, vp32);
    gl.uniform1f(beaconProg.u.uTime, timeSec);
    gl.uniform1f(beaconProg.u.uAmt, PAL.beaconAmt);
    gl.bindVertexArray(meshes.beacons.vao);
    gl.drawArrays(gl.POINTS, 0, meshes.beacons.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // traffic trails (additive, depth-tested so buildings occlude them)
  if ((PAL.trailAmt ?? 0) > 0.01 && meshes.trails) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(trailProg.p);
    gl.uniformMatrix4fv(trailProg.u.uVP, false, vp32);
    gl.uniform1f(trailProg.u.uTime, timeSec);
    gl.uniform1f(trailProg.u.uAmt, PAL.trailAmt);
    gl.uniform1f(trailProg.u.uFogD, PAL.fogD);
    gl.uniform1f(trailProg.u.uFogAmt, PAL.fogAmt);
    gl.uniform3fv(trailProg.u.uColW, PAL.trailColW || [1.0, 0.93, 0.72]);
    gl.uniform3fv(trailProg.u.uColR, PAL.trailColR || [1.0, 0.16, 0.10]);
    gl.bindVertexArray(meshes.trails.vao);
    gl.drawElements(gl.TRIANGLES, meshes.trails.count, gl.UNSIGNED_INT, 0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // wet-asphalt lamp reflections (additive, view-dependent stretch done in the VS)
  if ((PAL.wetK ?? 0) > 0.01 && meshes.streaks) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(streakProg.p);
    gl.uniformMatrix4fv(streakProg.u.uVP, false, vp32);
    gl.uniform3fv(streakProg.u.uEye, EYE);
    gl.uniform3fv(streakProg.u.uCol, PAL.lampCol || [1, 0.72, 0.38]);
    gl.uniform1f(streakProg.u.uAmt, PAL.wetK);
    gl.bindVertexArray(meshes.streaks.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, meshes.streaks.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // gaussian dust
  if (PAL.dustAmt > 0.01) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(dustProg.p);
    gl.uniformMatrix4fv(dustProg.u.uVP, false, vp32);
    gl.uniform1f(dustProg.u.uTime, timeSec);
    gl.uniform3fv(dustProg.u.uCol, PAL.dust);
    gl.uniform1f(dustProg.u.uAmt, PAL.dustAmt);
    gl.bindVertexArray(meshes.dust.vao);
    gl.drawArrays(gl.POINTS, 0, meshes.dust.count);
    gl.depthMask(true);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.disable(gl.DEPTH_TEST);

  // resolve MSAA (color to the scene texture, depth to the SSAO depth texture)
  if (FB.samples > 0) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, FB.msaaFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, FB.scene.fbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    if (FB.depthFbo) {
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, FB.depthFbo);
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    }
  }

  // SSAO at half resolution (skipped entirely at aoK=0)
  const aoK = FB.depthT ? (PAL.aoK ?? 0) : 0;
  if (aoK > 0.01) {
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.ao.fbo);
    gl.viewport(0, 0, FB.ao.w, FB.ao.h);
    gl.useProgram(ssaoProg.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, FB.depthT);
    gl.uniform1i(ssaoProg.u.uDepth, 0);
    gl.uniform2f(ssaoProg.u.uNF, NEAR, FAR);
    gl.uniform2f(ssaoProg.u.uPx, 1 / FB.ao.w, 1 / FB.ao.h);
    gl.uniform1f(ssaoProg.u.uProjScale, FB.ao.h / (2 * Math.tan(24 * Math.PI / 180)));
    gl.bindVertexArray(meshes.quad.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // bloom: bright pass
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, FB.bloomA.fbo);
  gl.viewport(0, 0, FB.bloomA.w, FB.bloomA.h);
  gl.useProgram(brightProg.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, FB.scene.tex);
  gl.uniform1i(brightProg.u.uTex, 0);
  gl.uniform1f(brightProg.u.uThresh, PAL.bloomThresh);
  gl.bindVertexArray(meshes.quad.vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // blur ping-pong (extra pass + anamorphic horizontal stretch are theme knobs)
  gl.useProgram(blurProg.p);
  gl.uniform1i(blurProg.u.uTex, 0);
  const passes = PAL.bloomPasses ?? 2, anamK = PAL.anamK ?? 1;
  for (let i = 0; i < passes; i++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.bloomB.fbo);
    gl.bindTexture(gl.TEXTURE_2D, FB.bloomA.tex);
    gl.uniform2f(blurProg.u.uDir, anamK * 1.35 / FB.bloomA.w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.bloomA.fbo);
    gl.bindTexture(gl.TEXTURE_2D, FB.bloomB.tex);
    gl.uniform2f(blurProg.u.uDir, 0, 1.35 / FB.bloomA.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // sun screen position for crepuscular rays (fades as the sun leaves the frame)
  let rayK = PAL.rayK ?? 0;
  let sunUV = [0.5, 1.2];
  if (rayK > 0.001) {
    const sd = PAL.sunDir || [0.62, 0.7, 0.35];
    const px = EYE[0] + sd[0] * 50000, py = EYE[1] + sd[1] * 50000, pz = EYE[2] + sd[2] * 50000;
    const wc = VP[3] * px + VP[7] * py + VP[11] * pz + VP[15];
    if (wc <= 0) rayK = 0;
    else {
      sunUV = [(VP[0] * px + VP[4] * py + VP[8] * pz + VP[12]) / wc * 0.5 + 0.5,
               (VP[1] * px + VP[5] * py + VP[9] * pz + VP[13]) / wc * 0.5 + 0.5];
      const ox = Math.max(0, Math.abs(sunUV[0] - 0.5) - 0.5), oy = Math.max(0, Math.abs(sunUV[1] - 0.5) - 0.5);
      rayK *= clamp(1 - Math.hypot(ox, oy) * 1.8, 0, 1);
    }
  }

  // composite to screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.useProgram(compProg.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, FB.scene.tex);
  gl.uniform1i(compProg.u.uScene, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, FB.bloomA.tex);
  gl.uniform1i(compProg.u.uBloom, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, FB.ao.tex);
  gl.uniform1i(compProg.u.uAO, 2);
  gl.uniform1f(compProg.u.uAoK, aoK);
  gl.uniform1f(compProg.u.uRayK, rayK);
  gl.uniform3fv(compProg.u.uRayCol, PAL.rayCol || [1, 0.85, 0.6]);
  gl.uniform2f(compProg.u.uSunUV, sunUV[0], sunUV[1]);
  gl.uniform1f(compProg.u.uGrainK, PAL.grainK ?? 0);
  gl.uniform1f(compProg.u.uTime, timeSec);
  gl.uniform1f(compProg.u.uBloomK, PAL.bloomK);
  gl.uniform1f(compProg.u.uVig, PAL.vig);
  gl.uniform1f(compProg.u.uExpo, PAL.expo ?? 1);
  gl.uniform1f(compProg.u.uSat, PAL.sat ?? 1);
  gl.uniform3fv(compProg.u.uTint, PAL.tint || [1, 1, 1]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ---------- resize ----------
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    ASPECT = w / h;
    setupFBOs(w, h);
    computeVP();
    needRender = true;
  }
}
window.addEventListener('resize', resize);

/* mobile resilience — a page-level pinch/auto-zoom or a keyboard scroll can leave the
   layout viewport scaled or offset: the fixed chrome sits off-screen and the canvas
   stretches blurry ("רואים רק את המפה"). Detect and snap back. */
if (window.visualViewport) {
  let vvT = 0;
  const vvFix = () => {
    clearTimeout(vvT);
    vvT = setTimeout(() => {
      const ae = document.activeElement;
      const typing = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
      // once the keyboard is gone and the page isn't zoomed, undo any stuck scroll
      if (!typing && visualViewport.scale <= 1.02 && (scrollX || scrollY)) scrollTo(0, 0);
      resize();
      needRender = true;
    }, 120);
  };
  visualViewport.addEventListener('resize', vvFix);
  visualViewport.addEventListener('scroll', vvFix);
}
window.addEventListener('orientationchange', () => { setTimeout(resize, 250); setTimeout(resize, 700); });
// iOS: two-finger pinch anywhere outside the canvas zooms the PAGE — swallow it.
// (map pinch runs on pointer events over the canvas and is unaffected)
for (const ev of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(ev, e => e.preventDefault());
// GPU pressure / backgrounding can kill the WebGL context — recover instead of freezing
canvas.addEventListener('webglcontextlost', e => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => location.reload());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  canvas.classList.remove('dragging'); // never leave the chrome dimmed
  if (gl.isContextLost && gl.isContextLost()) { location.reload(); return; }
  resize();
  needRender = true;
});

// ---------- animation: flyTo ----------
let fly = null;
function flyTo(opts) {
  const from = { ...cam };
  const to = {
    cx: opts.cx ?? cam.cx, cy: opts.cy ?? cam.cy, dist: opts.dist ?? cam.dist,
    bearing: opts.bearing ?? cam.bearing, tilt: opts.tilt ?? cam.tilt,
  };
  // shortest bearing path
  while (to.bearing - from.bearing > Math.PI) to.bearing -= 2 * Math.PI;
  while (to.bearing - from.bearing < -Math.PI) to.bearing += 2 * Math.PI;
  const travel = Math.hypot(to.cx - from.cx, to.cy - from.cy);
  const bump = travel > 900 ? Math.min(3600, travel * 0.55) : 0;
  const T = opts.T ?? clamp(600 + travel * 0.35, 700, 2600);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && !opts.force) {
    Object.assign(cam, to); computeVP(); needRender = true;
    if (opts.done) opts.done();
    return;
  }
  fly = { from, to, bump, T, t0: nowMs(), done: opts.done };
}
function tickFly() {
  if (!fly) return false;
  const t = clamp((nowMs() - fly.t0) / fly.T, 0, 1);
  const e = easeIO(t);
  cam.cx = lerp(fly.from.cx, fly.to.cx, e);
  cam.cy = lerp(fly.from.cy, fly.to.cy, e);
  cam.dist = lerp(fly.from.dist, fly.to.dist, e) + fly.bump * Math.sin(Math.PI * e);
  cam.bearing = lerp(fly.from.bearing, fly.to.bearing, e);
  cam.tilt = lerp(fly.from.tilt, fly.to.tilt, e);
  if (t >= 1) { const d = fly.done; fly = null; if (d) d(); }
  computeVP();
  return true;
}

// ---------- pointer controls ----------
const pointers = new Map();
let dragMode = null; // 'pan' | 'orbit' | 'pinch'
let panAnchor = null, lastPinch = null, moveVel = [0, 0], lastMoveT = 0, lastCenter = null;
let inertia = null;
let downInfo = null; // for click detection
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  fly = null; inertia = null;
  downInfo = { x: e.clientX, y: e.clientY, t: nowMs(), moved: false };
  if (pointers.size === 1) {
    if (e.button === 2 || e.ctrlKey) { dragMode = 'orbit'; }
    else {
      dragMode = 'pan';
      panAnchor = unprojectGround(e.clientX, e.clientY);
      lastCenter = [cam.cx, cam.cy]; lastMoveT = nowMs(); moveVel = [0, 0];
    }
  } else if (pointers.size === 2) {
    dragMode = 'pinch';
    const ps = [...pointers.values()];
    lastPinch = pinchState(ps);
  }
  canvas.classList.add('dragging');
});
function pinchState(ps) {
  const dx = ps[1].x - ps[0].x, dy = ps[1].y - ps[0].y;
  return { d: Math.hypot(dx, dy) || 1, a: Math.atan2(dy, dx), mx: (ps[0].x + ps[1].x) / 2, my: (ps[0].y + ps[1].y) / 2 };
}
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const px = p.x, py = p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (downInfo && Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 6) downInfo.moved = true;
  if (dragMode === 'pan' && pointers.size === 1 && panAnchor) {
    const g = unprojectGround(e.clientX, e.clientY);
    if (g) {
      cam.cx += panAnchor[0] - g[0];
      cam.cy += panAnchor[1] - g[1];
      computeVP();
      const t = nowMs(), dt = Math.max(1, t - lastMoveT);
      moveVel = [(cam.cx - lastCenter[0]) / dt * 16, (cam.cy - lastCenter[1]) / dt * 16];
      lastCenter = [cam.cx, cam.cy]; lastMoveT = t;
      needRender = true;
    }
  } else if (dragMode === 'orbit' && pointers.size === 1) {
    cam.bearing -= (e.clientX - px) * 0.005;
    cam.tilt = clamp(cam.tilt - (e.clientY - py) * 0.005, camLim.minTilt, camLim.maxTilt);
    computeVP(); needRender = true;
  } else if (dragMode === 'pinch' && pointers.size === 2) {
    const ps = [...pointers.values()];
    const cur = pinchState(ps);
    const before = unprojectGround(cur.mx, cur.my);
    cam.dist = clamp(cam.dist * lastPinch.d / cur.d, camLim.minDist, camLim.maxDist);
    let da = cur.a - lastPinch.a;
    if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    cam.bearing += da;
    cam.tilt = clamp(cam.tilt - (cur.my - lastPinch.my) * 0.004, camLim.minTilt, camLim.maxTilt);
    computeVP();
    const after = unprojectGround(cur.mx, cur.my);
    if (before && after) { cam.cx += before[0] - after[0]; cam.cy += before[1] - after[1]; computeVP(); }
    lastPinch = cur;
    needRender = true;
  }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (dragMode === 'pan' && pointers.size === 0) {
    if (Math.hypot(moveVel[0], moveVel[1]) > 2) inertia = { vx: moveVel[0], vy: moveVel[1] };
  }
  if (pointers.size === 1) { dragMode = 'pan'; const ps = [...pointers.values()][0]; panAnchor = unprojectGround(ps.x, ps.y); lastCenter = [cam.cx, cam.cy]; moveVel = [0,0]; }
  else if (pointers.size === 0) { dragMode = null; canvas.classList.remove('dragging'); }
  // click?
  if (downInfo && !downInfo.moved && nowMs() - downInfo.t < 450 && pointers.size === 0 && e.button !== 2) {
    const g = unprojectGround(e.clientX, e.clientY);
    if (g) window.dispatchEvent(new CustomEvent('mapclick', { detail: { x: g[0], y: g[1], px: e.clientX, py: e.clientY } }));
  }
  downInfo = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  fly = null; inertia = null;
  const k = Math.exp(clamp(e.deltaY, -180, 180) * 0.0016);
  const before = unprojectGround(e.clientX, e.clientY);
  cam.dist = clamp(cam.dist * k, camLim.minDist, camLim.maxDist);
  computeVP();
  const after = unprojectGround(e.clientX, e.clientY);
  if (before && after) { cam.cx += before[0] - after[0]; cam.cy += before[1] - after[1]; computeVP(); }
  needRender = true;
}, { passive: false });
canvas.addEventListener('dblclick', e => {
  const g = unprojectGround(e.clientX, e.clientY);
  if (g) flyTo({ cx: g[0], cy: g[1], dist: cam.dist * 0.5 });
});
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const pan = cam.dist * 0.08;
  const sb = Math.sin(cam.bearing), cb = Math.cos(cam.bearing);
  let used = true;
  switch (e.key) {
    case 'ArrowUp': cam.cx -= pan * sb; cam.cy += pan * cb; break;
    case 'ArrowDown': cam.cx += pan * sb; cam.cy -= pan * cb; break;
    case 'ArrowLeft': cam.cx -= pan * cb; cam.cy -= pan * sb; break;
    case 'ArrowRight': cam.cx += pan * cb; cam.cy += pan * sb; break;
    case '+': case '=': cam.dist = clamp(cam.dist * 0.8, camLim.minDist, camLim.maxDist); break;
    case '-': cam.dist = clamp(cam.dist * 1.25, camLim.minDist, camLim.maxDist); break;
    default: used = false;
  }
  if (used) { e.preventDefault(); fly = null; computeVP(); needRender = true; }
});

// ---------- main loop ----------
let rafId = 0;
function frame(tms) {
  rafId = requestAnimationFrame(frame);
  if (document.hidden) return;
  timeSec = tms / 1000;
  let animating = tickFly();
  if (inertia) {
    cam.cx += inertia.vx; cam.cy += inertia.vy;
    inertia.vx *= 0.915; inertia.vy *= 0.915;
    if (Math.hypot(inertia.vx, inertia.vy) < 0.5) inertia = null;
    computeVP();
    animating = true;
  }
  // continuous rendering: dust (legacy) or any uTime effect — desktop only; mobile renders on interaction
  const continuous = PAL && (PAL.dustAmt > 0.01 || (!window.IS_MOBILE && (PAL.animK ?? 0) > 0));
  if (needRender || animating || continuous) {
    draw();
    needRender = false;
  }
  if (window.__overlayTick) window.__overlayTick(animating);
}

window.MAP = {
  cam, flyTo, project, unprojectGround, computeVP, setPalette,
  requestRender: () => { needRender = true; },
  camLimits: camLim, center0: CENTER0, bbox: BBOX,
  buildingCentroids: () => B.centroids, buildingHeights: () => B.heights,
  roadPts, QA_MODE, LAYERS, planAtPoint,
  setLayer(name, on) { LAYERS[name] = on; needRender = true; },
  drawOnce() {
    resize(); computeVP(); draw();
    if (window.__overlayTick) window.__overlayTick(false, true);
    if (QA_MODE) {
      const px = new Uint8Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      console.log('QA: glErr=' + gl.getError() + ' samples=' + FB.samples + ' centerPx=' + [...px].join(',') + ' errlog=' + JSON.stringify(ERRLOG));
    }
  },
  start() {
    resize(); computeVP();
    if (QA_MODE) { draw(); if (window.__overlayTick) window.__overlayTick(false); return; }
    rafId = requestAnimationFrame(frame);
  },
};
