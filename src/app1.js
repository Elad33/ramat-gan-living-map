'use strict';
/* ============================================================
   רמת גן · המפה החיה — 3D city engine
   Data © OpenStreetMap contributors (ODbL)
   ============================================================ */

// ---------- error surface (also read by headless QA) ----------
const ERRLOG = [];
window.addEventListener('error', e => { ERRLOG.push(String(e.message)); reportFatal(e.message); });
window.addEventListener('unhandledrejection', e => { ERRLOG.push(String(e.reason)); });
function reportFatal(msg) {
  const st = document.getElementById('ldrStep');
  const loader = document.getElementById('loader');
  if (loader && !loader.classList.contains('done')) {
    st.className = 'ldr-step err';
    st.textContent = 'שגיאה בטעינת המפה: ' + msg;
  }
}

// the artifact host wraps this page without dir/lang on <html> — set them here
document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'he');

// ---------- tiny helpers ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const nowMs = () => performance.now();
let store;
try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); store = localStorage; }
catch (e) { const m = new Map(); store = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }

// ---------- ear clipping triangulation (simple polygons) ----------
function triangulate(pts) { // pts: flat [x,y,...] CCW; returns index array
  const n = pts.length / 2;
  if (n < 3) return [];
  const idx = []; for (let i = 0; i < n; i++) idx.push(i);
  const out = [];
  const X = i => pts[2 * i], Y = i => pts[2 * i + 1];
  let guard = 0;
  while (idx.length > 3 && guard++ < 4000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      const ax = X(a), ay = Y(a), bx = X(b), by = Y(b), cx = X(c), cy = Y(c);
      const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (cross <= 1e-9) continue; // reflex or degenerate
      let inside = false;
      for (let j = 0; j < idx.length; j++) {
        const p = idx[j];
        if (p === a || p === b || p === c) continue;
        const px = X(p), py = Y(p);
        const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
        const d2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
        const d3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
        if (d1 >= -1e-9 && d2 >= -1e-9 && d3 >= -1e-9) { inside = true; break; }
      }
      if (inside) continue;
      out.push(a, b, c);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // fallback below
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  else if (idx.length > 3) { for (let i = 1; i < idx.length - 1; i++) out.push(idx[0], idx[i], idx[i + 1]); }
  return out;
}
function signedArea(pts) { // flat [x,y,...]
  let s = 0;
  for (let i = 0, n = pts.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    s += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1];
  }
  return s / 2;
}

// ---------- mat4 ----------
function mat4Mul(a, b) {
  const o = new Float64Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function mat4Persp(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float64Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function mat4LookAt(eye, ctr, up) {
  let zx = eye[0] - ctr[0], zy = eye[1] - ctr[1], zz = eye[2] - ctr[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float64Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
}
function mat4Inv(m) {
  const inv = new Float64Array(16);
  inv[0] = m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
  inv[4] = -m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
  inv[8] = m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
  inv[12] = -m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
  inv[1] = -m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
  inv[5] = m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
  inv[9] = -m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
  inv[13] = m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
  inv[2] = m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
  inv[6] = -m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
  inv[10] = m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
  inv[14] = -m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
  inv[3] = -m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
  inv[7] = m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
  inv[11] = -m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
  inv[15] = m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
  let det = m[0]*inv[0]+m[1]*inv[4]+m[2]*inv[8]+m[3]*inv[12];
  if (!det) return inv;
  det = 1 / det;
  for (let i = 0; i < 16; i++) inv[i] *= det;
  return inv;
}

// ---------- decode city data ----------
const CITY_D = window.CITY;
const UNIT = CITY_D.meta.unit; // dm -> m
function decodeLine(arr, from) { // delta ints (dm) -> Float32 pairs (m)
  const n = (arr.length - from) / 2;
  const out = new Float32Array(n * 2);
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) {
    x += arr[from + 2 * i]; y += arr[from + 2 * i + 1];
    if (i === 0) { x = arr[from]; y = arr[from + 1]; }
    out[2 * i] = x * UNIT; out[2 * i + 1] = y * UNIT;
  }
  return out;
}

// ---------- GL setup ----------
const QA_MODE = /\bqa\b/.test(location.search + location.hash);
const canvas = $('gl');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: QA_MODE });
if (!gl) reportFatal('הדפדפן אינו תומך ב-WebGL2');

function makeShader(vsSrc, fsSrc) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSrc); gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error('VS: ' + gl.getShaderInfoLog(vs));
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error('FS: ' + gl.getShaderInfoLog(fs));
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const nU = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nU; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, inf.name); }
  return { p, u };
}

const V3 = `#version 300 es
precision highp float;`;
const F3 = `#version 300 es
precision highp float;`;

// building shader
const bldProg = makeShader(`${V3}
layout(location=0) in vec3 aPos;
layout(location=1) in float aShade;
layout(location=2) in float aU;
layout(location=3) in float aH;
layout(location=4) in float aRnd;
layout(location=5) in float aWall;
uniform mat4 uVP;
out float vShade; out float vU; out float vZ; out float vH; out float vRnd; out float vWall; out float vW;
void main(){
  gl_Position = uVP * vec4(aPos, 1.0);
  vShade = aShade; vU = aU; vZ = aPos.z; vH = aH; vRnd = aRnd; vWall = aWall;
  vW = gl_Position.w;
}`, `${F3}
in float vShade; in float vU; in float vZ; in float vH; in float vRnd; in float vWall; in float vW;
uniform vec3 uBase, uTop, uWin, uFog;
uniform float uNight, uFogD, uFogAmt;
out vec4 frag;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  float hMix = clamp(vZ / max(vH, 1.0), 0.0, 1.0);
  float tallBoost = 0.45 + 0.55 * smoothstep(10.0, 130.0, vH);
  vec3 col = mix(uBase, uTop, hMix * tallBoost);
  col *= 0.90 + 0.20 * vRnd;
  col *= vShade;
  // soft ambient occlusion at street level, grounds the buildings
  if (vWall > 0.5) col *= 0.86 + 0.14 * smoothstep(0.0, 5.5, vZ);
  // windows on walls (dusk)
  if (vWall > 0.5 && uNight > 0.01) {
    float wx = vU / 3.4;
    float wz = (vZ - 0.8) / 3.1;
    vec2 cell = floor(vec2(wx, wz));
    vec2 f = fract(vec2(wx, wz));
    float body = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8);
    float lit = step(0.62, hash12(cell + vec2(vRnd * 517.0, vRnd * 131.0)));
    float aa = clamp(1.6 - fwidth(wx) * 5.0, 0.0, 1.0) * clamp(1.6 - fwidth(wz) * 5.0, 0.0, 1.0);
    float glow = body * lit * aa * step(0.8, vZ) * step(vZ, vH - 0.4);
    col += uWin * glow * uNight * (0.55 + 0.45 * hash12(cell * 1.7 + vec2(vRnd)));
  }
  // luminous crown on towers (subtle)
  float crown = smoothstep(75.0, 235.0, vH) * smoothstep(vH - 5.0, vH, vZ);
  col += uWin * crown * (0.08 + 0.28 * uNight);
  // distance fog
  float f = 1.0 - exp(-vW / uFogD);
  col = mix(col, uFog, f * uFogAmt);
  frag = vec4(col, 1.0);
}`);

// flat colored geometry (green / water / boundary / roads) — color per draw range
const flatProg = makeShader(`${V3}
layout(location=0) in vec3 aPos;
layout(location=1) in float aSide;
uniform mat4 uVP;
out float vSide; out float vW;
void main(){ gl_Position = uVP * vec4(aPos, 1.0); vSide = aSide; vW = gl_Position.w; }`,
`${F3}
in float vSide; in float vW;
uniform vec4 uColor;
uniform vec3 uFog; uniform float uFogD, uFogAmt;
out vec4 frag;
void main(){
  float edge = 1.0 - smoothstep(0.45, 1.0, abs(vSide));
  float f = 1.0 - exp(-vW / uFogD);
  vec3 col = mix(uColor.rgb, uFog, f * uFogAmt);
  frag = vec4(col, uColor.a * edge);
}`);

// ground plane
const groundProg = makeShader(`${V3}
layout(location=0) in vec2 aPos;
uniform mat4 uVP;
out vec2 vXY; out float vW;
void main(){ gl_Position = uVP * vec4(aPos, 0.0, 1.0); vXY = aPos; vW = gl_Position.w; }`,
`${F3}
in vec2 vXY; in float vW;
uniform vec3 uG0, uG1, uFog;
uniform float uFogD, uFogAmt;
out vec4 frag;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  float r = length(vXY) / 5200.0;
  vec3 col = mix(uG0, uG1, smoothstep(0.15, 1.1, r));
  col += (hash12(floor(vXY * 0.5)) - 0.5) * 0.012; // paper grain
  float f = 1.0 - exp(-vW / uFogD);
  col = mix(col, uFog, f * uFogAmt);
  frag = vec4(col, 1.0);
}`);

// sky background
const skyProg = makeShader(`${V3}
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ gl_Position = vec4(aPos, 0.9999, 1.0); vUV = aPos * 0.5 + 0.5; }`,
`${F3}
in vec2 vUV;
uniform vec3 uSkyTop, uSkyHor;
out vec4 frag;
void main(){
  float t = smoothstep(0.0, 0.9, vUV.y);
  frag = vec4(mix(uSkyHor, uSkyTop, t), 1.0);
}`);

// gaussian dust particles
const dustProg = makeShader(`${V3}
layout(location=0) in vec4 aSeed; // x,y,z,phase
uniform mat4 uVP; uniform float uTime;
out float vTw;
void main(){
  vec3 p = aSeed.xyz;
  p.z += sin(uTime * 0.25 + aSeed.w * 6.2831) * 5.0;
  p.x += sin(uTime * 0.11 + aSeed.w * 12.0) * 6.0;
  p.y += cos(uTime * 0.13 + aSeed.w * 9.0) * 6.0;
  gl_Position = uVP * vec4(p, 1.0);
  float sz = 2600.0 / max(gl_Position.w, 1.0);
  gl_PointSize = clamp(sz, 1.2, 7.0);
  vTw = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed.w) + aSeed.w * 40.0);
}`,
`${F3}
in float vTw;
uniform vec3 uCol; uniform float uAmt;
out vec4 frag;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float g = exp(-dot(d, d) * 9.0);
  frag = vec4(uCol, 1.0) * (g * uAmt * (0.35 + 0.65 * vTw));
}`);

// post: bright pass / blur / composite
const quadVS = `${V3}
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); vUV = aPos * 0.5 + 0.5; }`;
const brightProg = makeShader(quadVS, `${F3}
in vec2 vUV; uniform sampler2D uTex; uniform float uThresh;
out vec4 frag;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  frag = vec4(c * smoothstep(uThresh, uThresh + 0.35, l), 1.0);
}`);
const blurProg = makeShader(quadVS, `${F3}
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir;
out vec4 frag;
void main(){
  vec3 c = texture(uTex, vUV).rgb * 0.227027;
  vec2 o1 = uDir * 1.3846153, o2 = uDir * 3.2307692;
  c += (texture(uTex, vUV + o1).rgb + texture(uTex, vUV - o1).rgb) * 0.3162162;
  c += (texture(uTex, vUV + o2).rgb + texture(uTex, vUV - o2).rgb) * 0.0702702;
  frag = vec4(c, 1.0);
}`);
const compProg = makeShader(quadVS, `${F3}
in vec2 vUV; uniform sampler2D uScene, uBloom;
uniform float uBloomK, uVig;
out vec4 frag;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 c = texture(uScene, vUV).rgb + texture(uBloom, vUV).rgb * uBloomK;
  c = c * (1.0 + 0.12 * c) / (1.0 + c * 0.14); // gentle filmic lift
  vec2 d = vUV - 0.5;
  c *= 1.0 - dot(d, d) * uVig;
  c += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  frag = vec4(c, 1.0);
}`);

// ---------- geometry stores ----------
const meshes = {}; // {name: {vao, count, mode, indexed}}
function makeVAO(attribs, indices) {
  // attribs: [{data, size, loc, type?}]
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const a of attribs) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, a.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(a.loc);
    gl.vertexAttribPointer(a.loc, a.size, a.type || gl.FLOAT, !!a.norm, 0, 0);
  }
  let count;
  if (indices) {
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    count = indices.length;
  }
  gl.bindVertexArray(null);
  return { vao, count };
}

// interleaved-free builders accumulate into growing arrays
class Acc {
  constructor() { this.chunks = []; this.len = 0; }
  push(arr) { this.chunks.push(arr); this.len += arr.length; }
  concat(Type) {
    const out = new Type(this.len); let o = 0;
    for (const c of this.chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}

// ---------- build buildings mesh (chunked) ----------
const B = {
  pos: new Acc(), shade: new Acc(), u: new Acc(), h: new Acc(), rnd: new Acc(), wall: new Acc(),
  idx: new Acc(), vcount: 0,
  centroids: [], heights: [], // per building, for search/landmarks
};
const SUN = [Math.SQRT1_2 * 0.9, Math.SQRT1_2, 0]; // from north-west-ish
function buildBuilding(rec) {
  const h = rec[0] * UNIT;
  const zb = rec[1] * UNIT; // vertical base (building:part min_level)
  let pts = decodeLine(rec, 2);
  let area = signedArea(pts);
  if (Math.abs(area) < 4) { B.centroids.push(null); B.heights.push(h); return; } // degenerate
  if (area < 0) { // enforce CCW
    const n = pts.length / 2, r = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { r[2 * i] = pts[2 * (n - 1 - i)]; r[2 * i + 1] = pts[2 * (n - 1 - i) + 1]; }
    pts = r;
  }
  const n = pts.length / 2;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += pts[2 * i]; cy += pts[2 * i + 1]; }
  cx /= n; cy /= n;
  B.centroids.push([cx, cy]); B.heights.push(h);
  const rnd = (Math.abs((cx * 12.9898 + cy * 78.233) % 1) + 1) % 1;
  const base = B.vcount;

  // roof
  const roofIdx = triangulate(pts);
  const rp = new Float32Array(n * 3), rs = new Float32Array(n), ru = new Float32Array(n),
        rh = new Float32Array(n), rr = new Float32Array(n), rw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rp[3 * i] = pts[2 * i]; rp[3 * i + 1] = pts[2 * i + 1]; rp[3 * i + 2] = h;
    rs[i] = 1.06; ru[i] = 0; rh[i] = h; rr[i] = rnd; rw[i] = 0;
  }
  B.pos.push(rp); B.shade.push(rs); B.u.push(ru); B.h.push(rh); B.rnd.push(rr); B.wall.push(rw);
  const ri = new Uint32Array(roofIdx.length);
  for (let i = 0; i < roofIdx.length; i++) ri[i] = roofIdx[i] + base;
  B.idx.push(ri);
  B.vcount += n;

  // walls
  const wp = new Float32Array(n * 4 * 3), ws = new Float32Array(n * 4), wu = new Float32Array(n * 4),
        wh = new Float32Array(n * 4), wr = new Float32Array(n * 4), ww = new Float32Array(n * 4);
  const wi = new Uint32Array(n * 6);
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = pts[2 * i], y0 = pts[2 * i + 1], x1 = pts[2 * j], y1 = pts[2 * j + 1];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    // outward normal for CCW ring
    const nx = dy / len, ny = -dx / len;
    const shade = 0.62 + 0.44 * Math.max(0, nx * SUN[0] + ny * SUN[1]) + 0.06 * (ny < 0 ? 1 : 0);
    const vb = B.vcount + i * 4;
    const d0 = dist, d1 = dist + len; dist = d1;
    // v0 bottom-left, v1 bottom-right, v2 top-right, v3 top-left
    wp.set([x0, y0, zb, x1, y1, zb, x1, y1, h, x0, y0, h], i * 12);
    ws[i * 4] = ws[i * 4 + 1] = ws[i * 4 + 2] = ws[i * 4 + 3] = shade;
    wu[i * 4] = d0; wu[i * 4 + 1] = d1; wu[i * 4 + 2] = d1; wu[i * 4 + 3] = d0;
    wh[i * 4] = wh[i * 4 + 1] = wh[i * 4 + 2] = wh[i * 4 + 3] = h;
    wr[i * 4] = wr[i * 4 + 1] = wr[i * 4 + 2] = wr[i * 4 + 3] = rnd;
    ww[i * 4] = ww[i * 4 + 1] = ww[i * 4 + 2] = ww[i * 4 + 3] = 1;
    wi.set([vb, vb + 1, vb + 2, vb, vb + 2, vb + 3], i * 6);
  }
  B.pos.push(wp); B.shade.push(ws); B.u.push(wu); B.h.push(wh); B.rnd.push(wr); B.wall.push(ww);
  B.idx.push(wi);
  B.vcount += n * 4;
}

// ---------- roads mesh ----------
// class: 0 major,1 secondary,2 tertiary,3 residential,4 service,5 pedestrian,6 path,7 steps
const ROAD_W = [17, 13, 10, 7.5, 4.5, 5.5, 2.4, 2.6];
const ROAD_Z = [1.35, 1.25, 1.15, 1.0, 0.85, 0.75, 0.65, 0.6];
function buildRibbon(acc, pts, width, z) {
  const n = pts.length / 2;
  if (n < 2) return;
  const half = width / 2;
  const base = acc.vcount;
  const P = new Float32Array(n * 2 * 3), S = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = pts[2 * i], y = pts[2 * i + 1];
    let dx0 = 0, dy0 = 0, dx1 = 0, dy1 = 0;
    if (i > 0) { dx0 = x - pts[2 * i - 2]; dy0 = y - pts[2 * i - 1]; const l = Math.hypot(dx0, dy0) || 1; dx0 /= l; dy0 /= l; }
    if (i < n - 1) { dx1 = pts[2 * i + 2] - x; dy1 = pts[2 * i + 3] - y; const l = Math.hypot(dx1, dy1) || 1; dx1 /= l; dy1 /= l; }
    let tx = dx0 + dx1, ty = dy0 + dy1;
    const tl = Math.hypot(tx, ty);
    if (tl < 1e-6) { tx = dx1 || dx0 || 1; ty = dy1 || dy0; } else { tx /= tl; ty /= tl; }
    const nx = -ty, ny = tx;
    // clamped miter widening at bends
    const cosH = clamp(tx * dx1 + ty * dy1, 0.5, 1);
    const m = (i > 0 && i < n - 1) ? Math.min(1 / cosH, 1.8) : 1;
    P[6 * i] = x + nx * half * m; P[6 * i + 1] = y + ny * half * m; P[6 * i + 2] = z;
    P[6 * i + 3] = x - nx * half * m; P[6 * i + 4] = y - ny * half * m; P[6 * i + 5] = z;
    S[2 * i] = 1; S[2 * i + 1] = -1;
  }
  const I = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n - 1; i++) {
    const v = base + i * 2;
    I.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
  }
  acc.pos.push(P); acc.side.push(S); acc.idx.push(I);
  acc.vcount += n * 2;
}

// ---------- flat polygon mesh (green/water) ----------
function buildFlatPoly(acc, pts, z) {
  const n = pts.length / 2;
  let area = signedArea(pts);
  let p = pts;
  if (area < 0) {
    const r = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { r[2 * i] = pts[2 * (n - 1 - i)]; r[2 * i + 1] = pts[2 * (n - 1 - i) + 1]; }
    p = r;
  }
  const tri = triangulate(p);
  if (!tri.length) return;
  const base = acc.vcount;
  const P = new Float32Array(n * 3), S = new Float32Array(n);
  for (let i = 0; i < n; i++) { P[3 * i] = p[2 * i]; P[3 * i + 1] = p[2 * i + 1]; P[3 * i + 2] = z; S[i] = 0; }
  const I = new Uint32Array(tri.length);
  for (let i = 0; i < tri.length; i++) I[i] = tri[i] + base;
  acc.pos.push(P); acc.side.push(S); acc.idx.push(I);
  acc.vcount += n;
}
