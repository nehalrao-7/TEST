// Position-based-dynamics cloth solver with body collision, plus fit/strain maps.
import * as THREE from '../vendor/three.module.js';

// ---------- spatial hash over the body surface ----------
export class BodyCollider {
  constructor(P, N, cell = 2.5) {
    this.P = P; this.N = N; this.h = cell;
    const n = P.length / 3, size = 1 << 17;
    this.mask = size - 1;
    const keys = new Int32Array(n), count = new Int32Array(size + 1);
    for (let i = 0; i < n; i++) { keys[i] = this.key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); count[keys[i] + 1]++; }
    for (let i = 0; i < size; i++) count[i + 1] += count[i];
    this.start = count.slice();
    const fill = count.slice(), ent = new Int32Array(n);
    for (let i = 0; i < n; i++) ent[fill[keys[i]]++] = i;
    this.ent = ent;
  }
  hash(ix, iy, iz) { return ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & this.mask; }
  key(x, y, z) { return this.hash(Math.floor(x / this.h), Math.floor(y / this.h), Math.floor(z / this.h)); }
  /** nearest body vertex within ~1.5 cells; returns index or -1 */
  nearest(x, y, z) {
    const h = this.h, ix = Math.floor(x / h), iy = Math.floor(y / h), iz = Math.floor(z / h);
    let best = -1, bd = 1e9;
    const P = this.P, st = this.start, ent = this.ent;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const k = this.hash(ix + a, iy + b, iz + c);
      for (let e = st[k]; e < st[k + 1]; e++) {
        const i = ent[e], dx = P[i * 3] - x, dy = P[i * 3 + 1] - y, dz = P[i * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }
  /** signed distance along the nearest vertex normal (Infinity if far) */
  gap(x, y, z) {
    const i = this.nearest(x, y, z);
    if (i < 0) return Infinity;
    const P = this.P, N = this.N;
    return (x - P[i * 3]) * N[i * 3] + (y - P[i * 3 + 1]) * N[i * 3 + 1] + (z - P[i * 3 + 2]) * N[i * 3 + 2];
  }
}

// ---------- cloth ----------
export class ClothSim {
  /**
   * meshes: garment meshes; each mesh.userData = { pinRows:[], thickness, fabric:{bend, friction, damping, gravity} }
   */
  constructor(meshes, collider) {
    this.meshes = meshes; this.collider = collider;
    const X = [], inv = [], thick = [], fric = [], damp = [], grav = [];
    const ca = [], cb = [], rest = [], stiff = [], kind = [];
    const ta = [], tb = [], tl = [];
    this.maps = [];
    for (const mesh of meshes) {
      const geo = mesh.geometry, pos = geo.attributes.position.array, nv = pos.length / 3;
      const ud = mesh.userData, fab = ud.fabric;
      const row = nv / (geo.userData.rows || 1);
      // weld coincident vertices (seam column, collapsed neckline points)
      const key = new Map(), map = new Int32Array(nv);
      for (let v = 0; v < nv; v++) {
        const k = `${Math.round(pos[v * 3] * 50)},${Math.round(pos[v * 3 + 1] * 50)},${Math.round(pos[v * 3 + 2] * 50)}`;
        let p = key.get(k);
        if (p === undefined) {
          p = X.length / 3; key.set(k, p);
          X.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
          const r = Math.floor(v / row);
          inv.push((ud.pinRows || []).includes(r) ? 0 : 1);
          thick.push(typeof ud.thickness === 'function' ? ud.thickness(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) : ud.thickness ?? 0.4); fric.push(fab.friction); damp.push(fab.damping); grav.push(fab.gravity);
        } else if ((ud.pinRows || []).includes(Math.floor(v / row))) inv[p] = 0;
        map[v] = p;
      }
      this.maps.push(map);
      // long-range attachments: each particle may not drift further from the pinned ring
      // above it (same column) than its rest path length → no rubbery sagging
      const pins = ud.pinRows || [], rows = geo.userData.rows || 1;
      if (pins.length) {
        const pr = Math.max(...pins);
        for (let k = 0; k < row; k++) {
          let path = 0;
          for (let r = pr + 1; r < rows; r++) {
            const v = r * row + k, u = (r - 1) * row + k;
            path += Math.hypot(pos[v * 3] - pos[u * 3], pos[v * 3 + 1] - pos[u * 3 + 1], pos[v * 3 + 2] - pos[u * 3 + 2]);
            ta.push(map[pr * row + k]); tb.push(map[v]); tl.push(path * 1.01);
          }
        }
      }
      // stretch + bend constraints from triangle topology
      const idx = geo.index.array, edges = new Map();
      const addC = (a, b, k, t) => {
        if (a === b) return;
        const d = Math.hypot(X[a * 3] - X[b * 3], X[a * 3 + 1] - X[b * 3 + 1], X[a * 3 + 2] - X[b * 3 + 2]);
        if (d < 1e-3) return;
        ca.push(a); cb.push(b); rest.push(d); stiff.push(k); kind.push(t);
      };
      for (let t = 0; t < idx.length; t += 3) {
        const tri = [map[idx[t]], map[idx[t + 1]], map[idx[t + 2]]];
        for (let e = 0; e < 3; e++) {
          const a = tri[e], b = tri[(e + 1) % 3], opp = tri[(e + 2) % 3];
          const k = a < b ? a * 4194304 + b : b * 4194304 + a;
          const ex = edges.get(k);
          if (!ex) { edges.set(k, opp); addC(a, b, 1, 0); }
          else if (ex >= 0) { addC(ex, opp, fab.bend, 1); edges.set(k, -1); }
        }
      }
    }
    this.X = new Float32Array(X); this.prev = new Float32Array(X); this.inv = new Float32Array(inv);
    this.thick = new Float32Array(thick); this.fric = new Float32Array(fric); this.damp = new Float32Array(damp); this.grav = new Float32Array(grav);
    this.ca = new Int32Array(ca); this.cb = new Int32Array(cb); this.rest = new Float32Array(rest); this.stiff = new Float32Array(stiff); this.kind = new Uint8Array(kind);
    this.ta = new Int32Array(ta); this.tb = new Int32Array(tb); this.tl = new Float32Array(tl);
    this.n = this.X.length / 3; this.frame = 0; this.motion = Infinity;
    // particles with no cloth constraints (slit edges, unused seam points) stay put
    const used = new Uint8Array(this.n);
    for (let c = 0; c < this.ca.length; c++) { used[this.ca[c]] = 1; used[this.cb[c]] = 1; }
    for (let i = 0; i < this.n; i++) if (!used[i]) this.inv[i] = 0;
  }

  collide() {
    const { X, prev, n, inv, thick, fric, collider } = this;
    const P = collider.P, Nn = collider.N;
    for (let i = 0; i < n; i++) {
      if (!inv[i]) continue;
      const x = X[i * 3], y = X[i * 3 + 1], z = X[i * 3 + 2];
      const b = collider.nearest(x, y, z);
      if (b < 0) continue;
      const nx = Nn[b * 3], ny = Nn[b * 3 + 1], nz = Nn[b * 3 + 2];
      const d = (x - P[b * 3]) * nx + (y - P[b * 3 + 1]) * ny + (z - P[b * 3 + 2]) * nz;
      // Deep 'penetrations' are usually a wrong-surface match (arm vs torso) — unless the
      // particle was outside last step (then it tunnelled and must come back).
      const dp = (prev[i * 3] - P[b * 3]) * nx + (prev[i * 3 + 1] - P[b * 3 + 1]) * ny + (prev[i * 3 + 2] - P[b * 3 + 2]) * nz;
      const tunnelled = dp > -0.2 && d > -6;
      if (d < thick[i] && (d > -1.5 || tunnelled)) {
        const push = tunnelled ? thick[i] - d : Math.min(thick[i] - d, 0.6);
        let px = x + nx * push, py = y + ny * push, pz = z + nz * push;
        // friction: remove part of the tangential motion this step
        const mx = px - prev[i * 3], my = py - prev[i * 3 + 1], mz = pz - prev[i * 3 + 2];
        const mn = mx * nx + my * ny + mz * nz, f = fric[i];
        px -= (mx - mn * nx) * f; py -= (my - mn * ny) * f; pz -= (mz - mn * nz) * f;
        X[i * 3] = px; X[i * 3 + 1] = py; X[i * 3 + 2] = pz;
      }
    }
  }

  tether() {
    const { X, inv, ta, tb, tl } = this;
    for (let c = 0; c < ta.length; c++) {
      const b = tb[c]; if (!inv[b]) continue;
      const a = ta[c] * 3, j = b * 3;
      const dx = X[j] - X[a], dy = X[j + 1] - X[a + 1], dz = X[j + 2] - X[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > tl[c]) { const f = tl[c] / d; X[j] = X[a] + dx * f; X[j + 1] = X[a + 1] + dy * f; X[j + 2] = X[a + 2] + dz * f; }
    }
  }

  step({ substeps = this.substeps ?? 1, iterations = this.iterations ?? 10, dt = 1 / 60, omega = this.omega ?? 1 } = {}) {
    const { X, prev, inv, n, ca, cb, rest, stiff, damp, grav } = this;
    const h = dt / substeps, g = -981 * h * h;
    let motion = 0;
    for (let s = 0; s < substeps; s++) {
      for (let i = 0; i < n; i++) {
        if (!inv[i]) continue;
        const j = i * 3, d = damp[i];
        const vx = (X[j] - prev[j]) * d, vy = (X[j + 1] - prev[j + 1]) * d, vz = (X[j + 2] - prev[j + 2]) * d;
        prev[j] = X[j]; prev[j + 1] = X[j + 1]; prev[j + 2] = X[j + 2];
        X[j] += vx; X[j + 1] += vy + g * grav[i]; X[j + 2] += vz;
      }
      const m = ca.length;
      for (let it = 0; it < iterations; it++) {
        for (let c = 0; c < m; c++) {
          const a = ca[c] * 3, b = cb[c] * 3, wa = inv[ca[c]], wb = inv[cb[c]], w = wa + wb;
          if (!w) continue;
          const dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2];
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const r = rest[c];
          const k = stiff[c];
          const corr = ((len - r) / len / w) * k * (this.kind[c] ? 1 : omega);
          X[a] += dx * corr * wa; X[a + 1] += dy * corr * wa; X[a + 2] += dz * corr * wa;
          X[b] -= dx * corr * wb; X[b + 1] -= dy * corr * wb; X[b + 2] -= dz * corr * wb;
        }
        this.tether();
        if (it === iterations >> 1 || it === iterations - 1) this.collide();
      }
      for (let i = 0; i < n * 3; i++) { const d = Math.abs(X[i] - prev[i]); if (d > motion) motion = d; }
    }
    this.frame++; this.motion = motion;
    return motion;
  }

  /** write particle positions back into the meshes */
  sync() {
    this.meshes.forEach((mesh, k) => {
      const map = this.maps[k], pos = mesh.geometry.attributes.position.array;
      for (let v = 0; v < map.length; v++) { const p = map[v] * 3; pos[v * 3] = this.X[p]; pos[v * 3 + 1] = this.X[p + 1]; pos[v * 3 + 2] = this.X[p + 2]; }
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    });
  }

  /** per-particle scalar → vertex colours. mode: 'fit' (cm of ease to skin) | 'strain' (%) */
  colorize(mode) {
    const vals = new Float32Array(this.n);
    if (mode === 'fit') {
      for (let i = 0; i < this.n; i++) vals[i] = Math.max(0, this.collider.gap(this.X[i * 3], this.X[i * 3 + 1], this.X[i * 3 + 2]));
    } else {
      const cnt = new Float32Array(this.n);
      for (let c = 0; c < this.ca.length; c++) {
        if (this.kind[c]) continue;
        const a = this.ca[c] * 3, b = this.cb[c] * 3;
        const len = Math.hypot(this.X[b] - this.X[a], this.X[b + 1] - this.X[a + 1], this.X[b + 2] - this.X[a + 2]);
        const e = (len / this.rest[c] - 1) * 100;
        vals[this.ca[c]] += e; vals[this.cb[c]] += e; cnt[this.ca[c]]++; cnt[this.cb[c]]++;
      }
      for (let i = 0; i < this.n; i++) vals[i] /= cnt[i] || 1;
    }
    const col = new THREE.Color();
    this.meshes.forEach((mesh, k) => {
      const map = this.maps[k], nv = map.length, arr = new Float32Array(nv * 3);
      for (let v = 0; v < nv; v++) {
        rampColor(mode, vals[map[v]], col);
        arr[v * 3] = col.r; arr[v * 3 + 1] = col.g; arr[v * 3 + 2] = col.b;
      }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    });
  }
}

// Fit map: red = touching/tight, yellow = snug, green = comfortable, blue = loose.
// Strain map: blue = slack/compressed, green = relaxed, yellow → red = stretched.
const STOPS = {
  fit: [[0, '#d7191c'], [0.6, '#fdae61'], [1.5, '#a6d96a'], [3, '#1a9641'], [6, '#2c7bb6']],
  strain: [[-3, '#2c7bb6'], [0, '#1a9641'], [1, '#a6d96a'], [3, '#fdae61'], [6, '#d7191c']],
};
export const LEGEND = {
  fit: { title: 'Fit map · ease to skin', stops: STOPS.fit, labels: ['touching', '0.6 cm', '1.5 cm', '3 cm', '6+ cm loose'] },
  strain: { title: 'Strain map · fabric stretch', stops: STOPS.strain, labels: ['−3% slack', '0%', '1%', '3%', '6%+ stretched'] },
};
const ca = new THREE.Color(), cb = new THREE.Color();
function rampColor(mode, v, out) {
  const s = STOPS[mode];
  if (v <= s[0][0]) return out.set(s[0][1]);
  for (let i = 1; i < s.length; i++) if (v <= s[i][0]) {
    const t = (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
    return out.copy(ca.set(s[i - 1][1])).lerp(cb.set(s[i][1]), t);
  }
  return out.set(s[s.length - 1][1]);
}

// ---------- Web Worker transport ----------
const SIM_FIELDS = ['X', 'prev', 'inv', 'thick', 'fric', 'damp', 'grav', 'ca', 'cb', 'rest', 'stiff', 'kind', 'ta', 'tb', 'tl', 'n'];
/** Plain-data snapshot of a sim (and its collider) for a worker. */
export function simState(sim) {
  const st = {}; for (const f of SIM_FIELDS) st[f] = sim[f];
  const c = sim.collider;
  st.collider = { P: c.P, N: c.N, h: c.h, mask: c.mask, start: c.start, ent: c.ent };
  return st;
}
export function simFromState(st) {
  const sim = Object.create(ClothSim.prototype);
  for (const f of SIM_FIELDS) sim[f] = st[f];
  sim.collider = Object.assign(Object.create(BodyCollider.prototype), st.collider);
  sim.frame = 0; sim.motion = Infinity;
  return sim;
}
