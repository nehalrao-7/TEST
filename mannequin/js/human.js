// Realistic parametric human: MakeHuman CC0 base mesh + morph targets,
// fitted to tape measurements with a damped Gauss-Newton solver.
const DM = 10; // MakeHuman units are decimetres → cm

export async function loadHuman(base = 'assets/') {
  const [man, buf] = await Promise.all([
    fetch(base + 'human.json').then((r) => r.json()),
    fetch(base + 'human.bin').then((r) => r.arrayBuffer()),
  ]);
  const T = { float32: Float32Array, uint32: Uint32Array, uint16: Uint16Array, uint8: Uint8Array };
  const get = (n) => { const b = man.buffers[n]; return new T[b.type](buf, b.offset, b.length); };
  const targets = {};
  for (const name of Object.keys(man.targets)) if (man.targets[name]) targets[name] = { i: get(`t.${name}.i`), d: get(`t.${name}.d`) };
  const proxies = {};
  for (const [name, p] of Object.entries(man.proxies))
    proxies[name] = { ...p, refs: get(`p.${name}.refs`), w: get(`p.${name}.w`), off: get(`p.${name}.off`), uv: get(`p.${name}.uv`), index: get(`p.${name}.index`) };
  const H = {
    man, base: get('base'), n: man.nverts, targets, proxies, labels: get('labels'),
    body: { orig: get('body.orig'), uv: get('body.uv'), index: get('body.index') },
  };
  // Mirror of the right shoulder-tip vertex for shoulder width.
  const sv = man.rulers['shoulder-dist'][1], b = H.base;
  let best = -1, bd = 1e9;
  for (let i = 0; i < H.n; i++) {
    const d = (b[i * 3] + b[sv * 3]) ** 2 + (b[i * 3 + 1] - b[sv * 3 + 1]) ** 2 + (b[i * 3 + 2] - b[sv * 3 + 2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  H.shoulderPair = [sv, best];
  // Crotch candidates: torso vertices near the mid-sagittal plane.
  H.bodySet = new Uint8Array(H.n); for (const i of H.body.orig) H.bodySet[i] = 1;
  return H;
}

// ---------- morphing ----------
export function morph(H, w) {
  const P = new Float32Array(H.base);
  for (const [name, v] of Object.entries(w)) {
    const t = H.targets[name];
    if (!t || !v) continue;
    const { i, d } = t;
    for (let k = 0; k < i.length; k++) {
      const j = i[k] * 3;
      P[j] += v * d[k * 3]; P[j + 1] += v * d[k * 3 + 1]; P[j + 2] += v * d[k * 3 + 2];
    }
  }
  return P;
}

const dist = (P, a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
const poly = (P, idx) => { let s = 0; for (let k = 1; k < idx.length; k++) s += dist(P, idx[k - 1], idx[k]); return s; };

function bounds(H, P) {
  let lo = 1e9, hi = -1e9;
  for (const i of H.body.orig) { const y = P[i * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
  return [lo, hi];
}

// Raw measurements of a morphed mesh, in cm (before final uniform scale).
export function measure(H, P) {
  const R = H.man.rulers;
  const [lo, hi] = bounds(H, P);
  // crotch: lowest torso-labelled vertex close to x = 0
  let crotch = 1e9;
  for (let i = 0; i < H.n; i++) if (H.bodySet[i] && H.labels[i] === 0 && Math.abs(P[i * 3]) < 0.12 && P[i * 3 + 1] < crotch) crotch = P[i * 3 + 1];
  const waistY = R['waist-circ'].reduce((s, i) => s + P[i * 3 + 1], 0) / R['waist-circ'].length;
  return {
    height: (hi - lo) * DM,
    neck: poly(P, R['neck-circ']) * DM,
    shoulder: dist(P, ...H.shoulderPair) * DM,
    bust: poly(P, R['bust-circ']) * DM,
    underbust: poly(P, R['underbust-circ']) * DM,
    waist: poly(P, R['waist-circ']) * DM,
    hip: poly(P, R['hips-circ']) * DM,
    thigh: poly(P, R['thigh-circ']) * DM,
    knee: poly(P, R['knee-circ']) * DM,
    calf: poly(P, R['calf-circ']) * DM,
    ankle: poly(P, R['ankle-circ']) * DM,
    upperArm: poly(P, R['upperarm-circ']) * DM,
    wrist: poly(P, R['wrist-circ']) * DM,
    armLength: (poly(P, R['upperarm-length']) + poly(P, R['lowerarm-length'])) * DM,
    backLength: poly(P, R['napetowaist-dist']) * DM,
    waistToHip: poly(P, R['waisttohip-dist']) * DM,
    waistHeight: (waistY - lo) * DM,
    inseam: (crotch - lo) * DM,
  };
}

// Variables the solver drives (MakeHuman modifier names, range [-1, 1]).
const VARS = ['weight', 'breast', 'stomach-pregnant', 'torso-scale-depth', 'neck-circ', 'shoulder-dist', 'bust-circ', 'underbust-circ', 'waist-circ', 'hips-circ', 'thigh-circ',
  'knee-circ', 'calf-circ', 'ankle-circ', 'upperarm-circ', 'wrist-circ', 'upperarm-length', 'lowerarm-length', 'napetowaist-dist',
  'waisttohip-dist', 'upperleg-height', 'lowerleg-height'];
// Bounds: macro sliders stay in range; measure targets may extrapolate a little.
const MACRO = new Set(['weight', 'breast', 'stomach-pregnant', 'torso-scale-depth']);
const LO = VARS.map((v) => (MACRO.has(v) ? -1 : -1.8));
const HI = VARS.map((v) => (MACRO.has(v) ? 1 : 1.8));
const FIT_KEYS = ['neck', 'shoulder', 'bust', 'underbust', 'waist', 'hip', 'thigh', 'knee', 'calf', 'ankle', 'upperArm', 'wrist',
  'armLength', 'backLength', 'waistToHip', 'inseam'];

function weightsFor(sex, eth, height, x) {
  const w = {};
  w[`${sex}-${eth}`] = 1;
  w[`${sex}-idealproportions`] = 0.5;
  const ref = sex === 'female' ? 166 : 177;
  const h = Math.max(-1, Math.min(1, (height - ref) / 22));
  w[`${sex}-${h < 0 ? 'min' : 'max'}height`] = Math.abs(h);
  VARS.forEach((v, k) => {
    const val = x[k];
    if (v === 'weight') w[`${sex}-${val < 0 ? 'min' : 'max'}weight`] = Math.abs(val);
    else if (v === 'breast') { if (sex === 'female') w[`breast-${val < 0 ? 'min' : 'max'}cup-averagefirmness`] = Math.abs(val); }
    else if (v.startsWith('stomach') || v.startsWith('torso')) w[`${v}-${val < 0 ? 'decr' : 'incr'}`] = Math.abs(val);
    else w[`measure-${v}-${val < 0 ? 'decr' : 'incr'}`] = Math.abs(val);
  });
  return w;
}

// Solve a small dense linear system (Gaussian elimination with pivoting).
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-9;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-9));
}

/** Fit the mesh to measurements. Returns {P (cm, feet at y=0), scale, achieved, x}. */
export function fitHuman(H, m, { sex = 'female', eth = 'asian', x0 = null, iters = 30 } = {}) {
  let x = x0 ? [...x0] : VARS.map(() => 0);
  const evalAt = (xv) => {
    const P = morph(H, weightsFor(sex, eth, m.height, xv));
    const raw = measure(H, P);
    const s = m.height / raw.height; // final uniform scale makes height exact
    return { P, raw, s, r: FIT_KEYS.map((k) => (m[k] - raw[k] * s) / (k === 'inseam' || k === 'shoulder' ? 2 : 1)) };
  };
  let cur = evalAt(x);
  const err = (e) => e.r.reduce((s, v) => s + v * v, 0);
  let lam = 0.05, J = null;
  for (let it = 0; it < iters; it++) {
    if (!J) {
      J = FIT_KEYS.map(() => new Array(VARS.length).fill(0));
      const h = 0.1;
      VARS.forEach((_, k) => {
        const xp = [...x]; xp[k] += x[k] + h > HI[k] ? -h : h;
        const e = evalAt(xp);
        FIT_KEYS.forEach((_, j) => { J[j][k] = -(e.r[j] - cur.r[j]) / (xp[k] - x[k]); });
      });
    }
    const n = VARS.length;
    const JtJ = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, c) => FIT_KEYS.reduce((s, _, j) => s + J[j][a] * J[j][c], 0)));
    const A = JtJ.map((row, a) => row.map((v, c) => v + (a === c ? lam * (1 + JtJ[a][a]) : 0)));
    const g = Array.from({ length: n }, (_, a) => FIT_KEYS.reduce((s, _, j) => s + J[j][a] * cur.r[j], 0));
    const dx = solve(A, g);
    const nx = x.map((v, k) => Math.max(LO[k], Math.min(HI[k], v + dx[k])));
    const ne = evalAt(nx);
    if (err(ne) < err(cur)) {
      const gain = err(cur) - err(ne);
      x = nx; cur = ne; lam = Math.max(1e-4, lam / 3); J = null;
      if (gain < 1e-3) break;
    } else lam *= 4;
  }
  // final positions in cm, feet on floor
  const { P, s } = cur;
  const [lo] = bounds(H, P);
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { out[i] = P[i] * s * DM; out[i + 1] = (P[i + 1] - lo) * s * DM; out[i + 2] = P[i + 2] * s * DM; }
  const achieved = Object.fromEntries(Object.entries(cur.raw).map(([k, v]) => [k, v * s]));
  return { P: out, rawP: P, scale: s * DM, floor: lo, achieved, x };
}

export function joints(H, P) {
  const J = {};
  for (const [name, idx] of Object.entries(H.man.joints)) {
    let x = 0, y = 0, z = 0;
    for (const i of idx) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; }
    J[name] = [x / idx.length, y / idx.length, z / idx.length];
  }
  return J;
}

// Proxy (eyes/hair/...) vertex fitting, MakeHuman .mhclo semantics, on raw (dm) positions.
export function fitProxy(H, p, rawP, scale, floor) {
  const sc = {};
  for (const [ax, [a, b, ref]] of Object.entries(p.scales)) {
    const k = { x: 0, y: 1, z: 2 }[ax];
    sc[ax] = Math.abs(rawP[a * 3 + k] - rawP[b * 3 + k]) / ref;
  }
  const n = p.refs.length / 3, out = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    for (let k = 0; k < 3; k++) {
      let s = 0;
      for (let r = 0; r < 3; r++) s += p.w[v * 3 + r] * rawP[p.refs[v * 3 + r] * 3 + k];
      s += p.off[v * 3 + k] * (sc['xyz'[k]] ?? 1);
      out[v * 3 + k] = k === 1 ? (s - floor) * scale : s * scale;
    }
  }
  return out;
}

export const MEASURE_KEYS = FIT_KEYS;
