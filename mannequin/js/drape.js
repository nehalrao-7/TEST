// Surface-following garment geometry built from cross-sections of the fitted body mesh.
import * as THREE from '../vendor/three.module.js';

export const N = 96; // samples around each ring
const TAU = Math.PI * 2;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
export const V3 = { sub, add, mul, dot, cross, nrm };

export function frame(axis) {
  const a = nrm(axis);
  let fwd = [0, 0, 1];
  if (Math.abs(dot(fwd, a)) > 0.9) fwd = [1, 0, 0];
  const v = nrm(sub(fwd, mul(a, dot(fwd, a))));
  const u = cross(v, a); // for a = +y (downward slices use -y) u ends up ±x
  return { a, u, v };
}

function hull(pts) {
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * Cross-section of a vertex subset in the plane through c with normal axis.
 * Returns ring {c, u, v, r: Float32Array(N)} sampled on the convex hull, or null.
 */
export function section(P, idx, c, axis, slab = 1.2, fr = null, fixedCenter = false) {
  const { u, v } = fr || frame(axis);
  const a = nrm(axis);
  const pts = [];
  for (const i of idx) {
    const p = [P[i * 3] - c[0], P[i * 3 + 1] - c[1], P[i * 3 + 2] - c[2]];
    if (Math.abs(dot(p, a)) < slab) pts.push([dot(p, u), dot(p, v)]);
  }
  if (pts.length < 6) return null;
  const h = hull(pts);
  let cx = 0, cy = 0;
  if (!fixedCenter) { for (const p of h) { cx += p[0]; cy += p[1]; } cx /= h.length; cy /= h.length; }
  const r = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const th = (k / N) * TAU, dx = Math.cos(th), dy = Math.sin(th);
    let best = 0;
    for (let e = 0; e < h.length; e++) {
      const p = h[e], q = h[(e + 1) % h.length];
      const ex = q[0] - p[0], ey = q[1] - p[1], wx = p[0] - cx, wy = p[1] - cy;
      const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
      const t = (wx * ey - wy * ex) / den, s = (wx * dy - wy * dx) / den;
      if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.max(best, t);
    }
    r[k] = best;
  }
  return { c: add(c, add(mul(u, cx), mul(v, cy))), u, v, a, r };
}

export function perimeter(r) {
  let s = 0;
  for (let k = 0; k < N; k++) {
    const t0 = (k / N) * TAU, t1 = ((k + 1) / N) * TAU, r1 = r[(k + 1) % N];
    s += Math.hypot(r1 * Math.cos(t1) - r[k] * Math.cos(t0), r1 * Math.sin(t1) - r[k] * Math.sin(t0));
  }
  return s;
}

/** Offset ring outward so its perimeter is C (never closer than gap to the body). */
export function inflate(ring, C, gap = 0.4) {
  const Pm = perimeter(ring.r);
  const d = Math.max(gap, (C - Pm) / TAU);
  return { ...ring, r: ring.r.map((x) => x + d) };
}

export function scaleTo(ring, C) {
  const s = C / perimeter(ring.r);
  return { ...ring, r: ring.r.map((x) => x * s) };
}

export const lerpRing = (A, B, t) => ({
  ...A, c: add(mul(A.c, 1 - t), mul(B.c, t)), r: A.r.map((x, k) => x * (1 - t) + B.r[k] * t),
});

/** Smooth radii around the ring (circular box blur). */
export function smooth(ring, w = 2) {
  const r = ring.r, o = new Float32Array(N);
  for (let k = 0; k < N; k++) { let s = 0; for (let j = -w; j <= w; j++) s += r[(k + j + N) % N]; o[k] = s / (2 * w + 1); }
  return { ...ring, r: o };
}

/**
 * Loft rings into a mesh. opts.folds(ringIndex, theta) → radial multiplier offset;
 * opts.cut(ringIndex, theta, point) → true to drop faces (slits, necklines).
 */
export function loftRings(rings, { folds, cut, clampY, uvScale = [1, 1] } = {}) {
  const pos = [], uv = [], idx = [];
  let vacc = 0;
  rings.forEach((R, i) => {
    if (i > 0) vacc += Math.hypot(...sub(R.c, rings[i - 1].c));
    for (let k = 0; k <= N; k++) {
      const th = (k / N) * TAU, kk = k % N;
      const m = 1 + (folds ? folds(i, th) : 0);
      const d = add(mul(R.u, Math.cos(th) * R.r[kk] * m), mul(R.v, Math.sin(th) * R.r[kk] * m));
      let py = R.c[1] + d[1];
      if (clampY) py = Math.min(py, clampY(th, R.c[0] + d[0], R.c[2] + d[2]));
      pos.push(R.c[0] + d[0], py, R.c[2] + d[2]);
      uv.push((k / N) * uvScale[0], (vacc / 100) * uvScale[1]);
    }
  });
  const row = N + 1;
  for (let i = 0; i < rings.length - 1; i++)
    for (let k = 0; k < N; k++) {
      if (cut) {
        const a = (i * row + k) * 3;
        const mid = [(pos[a] + pos[a + row * 3 + 3]) / 2, (pos[a + 1] + pos[a + row * 3 + 4]) / 2, (pos[a + 2] + pos[a + row * 3 + 5]) / 2];
        if (cut(i + 0.5, ((k + 0.5) / N) * TAU, mid)) continue;
      }
      const a = i * row + k, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Deterministic pseudo-random for fold placement.
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Smooth ring radii and centres along the tube (keeps first/last ring). */
export function smoothAlong(rings, passes = 2) {
  let rs = rings;
  for (let p = 0; p < passes; p++) {
    rs = rs.map((R, i) => {
      if (i === 0 || i === rs.length - 1) return R;
      const A = rs[i - 1], C = rs[i + 1];
      return { ...R, c: R.c.map((v, k) => (A.c[k] + 2 * v + C.c[k]) / 4), r: R.r.map((v, k) => Math.max(v, (A.r[k] + 2 * v + C.r[k]) / 4)) };
    });
  }
  return rs;
}
