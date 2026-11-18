// CLO-style construction: the drafted 2D pattern pieces are triangulated, arranged around the
// avatar on bounding cylinders, and joined by seam constraints during the cloth simulation.
import * as THREE from '../vendor/three.module.js';
import { N, section, perimeter, inflate, smooth, frame, V3 } from './drape.js';
import { draftPattern } from './pattern.js';

const { add, mul, sub, nrm, dot, cross } = V3;
const LBL = { torso: 0, lUpper: 2, lThigh: 5, rUpper: 8, rThigh: 11 };

// ---------- 2D geometry ----------
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearestIdx = (pts, q) => { let b = 0, bd = 1e9; pts.forEach((p, i) => { const d = dist2(p, q); if (d < bd) { bd = d; b = i; } }); return b; };
function inPoly(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function segDist(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t);
}
/** resample polyline (inclusive ends) at ~h spacing */
function resample(line, h) {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + dist2(line[i], line[i - 1]));
  const L = cum[cum.length - 1], n = Math.max(1, Math.round(L / h)), out = [];
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * L; let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    out.push([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t]);
  }
  return out;
}
/** Bowyer–Watson Delaunay triangulation */
function delaunay(pts) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of pts) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
  const d = Math.max(maxX - minX, maxY - minY) * 20, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const P = pts.concat([[mx - d, my - d], [mx + d, my - d], [mx, my + d]]), n = pts.length;
  const circ = (a, b, c) => {
    const [ax, ay] = P[a], [bx, by] = P[b], [cx, cy] = P[c];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
    return [ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2];
  };
  let tris = [[n, n + 1, n + 2, ...circ(n, n + 1, n + 2)]];
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i], bad = [], keep = [];
    for (const t of tris) ((px - t[3]) ** 2 + (py - t[4]) ** 2 < t[5] ? bad : keep).push(t);
    const edges = new Map();
    for (const t of bad) for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(k, edges.has(k) ? null : [a, b]);
    }
    tris = keep;
    for (const e of edges.values()) if (e) tris.push([e[0], e[1], i, ...circ(e[0], e[1], i)]);
  }
  return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n).map((t) => [t[0], t[1], t[2]]);
}

/**
 * Mesh one pattern piece. chains: [{name, line}] in order around the outline (each line's last
 * point = next line's first). Returns {pts, tris, chains: {name: [vertexIndex...]}}.
 */
function meshPiece(chainDefs, h) {
  const pts = [], chains = {};
  for (const { name, line } of chainDefs) {
    const s = resample(line, h), idx = [];
    s.forEach((p, k) => {
      if (k === s.length - 1) return; // shared with next chain
      idx.push(pts.length); pts.push(p);
    });
    chains[name] = idx;
  }
  const names = chainDefs.map((c) => c.name);
  names.forEach((nm, i) => chains[nm].push(chains[names[(i + 1) % names.length]][0])); // close each chain with its end point
  const poly = pts.slice();
  const nb = pts.length;
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of poly) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
  const dy = h * 0.866;
  for (let r = 0, y = minY + dy / 2; y < maxY; y += dy, r++)
    for (let x = minX + (r % 2 ? h / 2 : 0); x < maxX; x += h) {
      const q = [x, y];
      if (!inPoly(q, poly)) continue;
      let near = 1e9;
      for (let i = 0; i < nb; i++) near = Math.min(near, segDist(q, poly[i], poly[(i + 1) % nb]));
      if (near > h * 0.55) pts.push(q);
    }
  const tris = delaunay(pts).filter(([a, b, c]) => inPoly([(pts[a][0] + pts[b][0] + pts[c][0]) / 3, (pts[a][1] + pts[b][1] + pts[c][1]) / 3], poly));
  return { pts, tris, chains, poly };
}

// ---------- arrangement on the avatar ----------
function ringPoint(R, k) {
  const th = (k / N) * Math.PI * 2;
  return add(R.c, add(mul(R.u, Math.cos(th) * R.r[k % N]), mul(R.v, Math.sin(th) * R.r[k % N])));
}
/** point at signed arc length s from ring index k0 (dir +1: increasing k) */
function alongRing(R, k0, dir, s) {
  let k = k0, acc = 0, p = ringPoint(R, k);
  const sgn = Math.sign(s) * dir; let left = Math.abs(s);
  for (let step = 0; step < N; step++) {
    const kn = (k + sgn + N) % N, pn = ringPoint(R, kn), seg = Math.hypot(...sub(pn, p));
    if (seg > 1e-6 && acc + seg >= left) { const t = (left - acc) / seg; return add(p, mul(sub(pn, p), t)); }
    acc += seg; k = kn; p = pn;
  }
  return p;
}

/**
 * Build the sewn kameez as one mesh. Returns a THREE.Mesh whose userData.seams lists vertex pairs.
 */
export function buildSewnKameez(B, m, g, mats, fabric, { h = 1.6 } = {}) {
  const pieces = draftPattern(m, g);
  const front = pieces[0], back = pieces[1], sleeve = pieces[2];
  const topY = B.neckY - 1.5;

  // ---- full bodice outlines (mirror the half pieces across the fold) ----
  const bodiceChains = (pc) => {
    const P = pc.pts, n = P.length, K = pc.keys;
    const iN = nearestIdx(P, K.neck), iS = nearestIdx(P, K.shoulder), iU = nearestIdx(P, K.underarm), iSl = nearestIdx(P, K.slit);
    const R = (a, b) => P.slice(a, b + 1);
    const Lm = (line) => line.map(([x, y]) => [-x, y]).reverse();
    const hem = R(iSl, n - 1).concat(Lm(R(iSl, n - 1)).slice(1));
    return [
      { name: 'neckR', line: R(0, iN) }, { name: 'shoulderR', line: R(iN, iS) }, { name: 'armholeR', line: R(iS, iU) },
      { name: 'sideR', line: R(iU, iSl) }, { name: 'hem', line: hem },
      { name: 'sideL', line: Lm(R(iU, iSl)) }, { name: 'armholeL', line: Lm(R(iS, iU)) }, { name: 'shoulderL', line: Lm(R(iN, iS)) },
      { name: 'neckL', line: Lm(R(0, iN)) },
    ];
  };
  const sleeveChains = (pc) => {
    const P = pc.pts, K = pc.keys, n = P.length;
    const iT = nearestIdx(P, K.top), iRU = nearestIdx(P, K.rightUnder), iRH = nearestIdx(P, K.rightHem), iLH = nearestIdx(P, K.leftHem);
    return [
      { name: 'capBack', line: P.slice(0, iT + 1) }, { name: 'capFront', line: P.slice(iT, iRU + 1) },
      { name: 'underR', line: P.slice(iRU, iRH + 1) }, { name: 'hem', line: [P[iRH], P[iLH]] },
      { name: 'underL', line: [P[iLH], P[0]] },
    ];
    void n;
  };

  // ---- body reference rings for the arrangement ----
  const torsoCap = B.pick(LBL.torso);
  const hipIdx = B.pick(LBL.torso, LBL.lThigh, LBL.rThigh);
  const ringCache = new Map();
  const bodyRing = (y) => {
    const key = Math.round(y);
    if (ringCache.has(key)) return ringCache.get(key);
    const idx = y > B.crotchY + 3 ? (y > B.waistY ? torsoCap : hipIdx) : hipIdx;
    const s = section(B.P, idx, [0, key, 0], [0, 1, 0], 2.2);
    const r = s ? smooth(s, 3) : null;
    ringCache.set(key, r);
    return r;
  };
  const chestY = B.bustY + 8;
  const halfWidthAt = (P, py) => { // max |x| of the half outline at height py
    let best = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      if ((a[1] - py) * (b[1] - py) <= 0 && a[1] !== b[1]) best = Math.max(best, a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    return best;
  };

  const verts = [], uvs = [], index = [], trimIdx = [], seams = [];
  const addPiece = (mesh, place, isTrim) => {
    const base = verts.length;
    mesh.pts.forEach((p) => { verts.push(place(p)); uvs.push([p[0], -p[1]]); });
    for (const t of mesh.tris) {
      const c = [(mesh.pts[t[0]][0] + mesh.pts[t[1]][0] + mesh.pts[t[2]][0]) / 3, (mesh.pts[t[0]][1] + mesh.pts[t[1]][1] + mesh.pts[t[2]][1]) / 3];
      (isTrim(c) ? trimIdx : index).push(base + t[0], base + t[2], base + t[1]);
    }
    const ch = {};
    for (const [k, v] of Object.entries(mesh.chains)) ch[k] = v.map((i) => base + i);
    return ch;
  };

  const bodiceMesh = (pc, isFront) => {
    const mesh = meshPiece(bodiceChains(pc), h);
    const halfP = pc.pts, L = pc.dims.L;
    const neckLine = mesh.chains.neckR.concat(mesh.chains.neckL).map((i) => mesh.pts[i]);
    const place = ([px, py]) => {
      const y = topY - py;
      const ref = bodyRing(Math.min(Math.max(y, B.crotchY + 2), chestY)) || bodyRing(B.waistY);
      const halfW = halfWidthAt(halfP, Math.min(py, L));
      const C = Math.max(perimeter(ref.r) + Math.PI * 2 * 2.0, 4 * halfW + 4);
      const R = { ...inflate(ref, C, 1.5), c: [ref.c[0], y, ref.c[2]] };
      return alongRing(R, isFront ? N / 4 : (3 * N) / 4, isFront ? 1 : -1, px);
    };
    const isTrim = (c) => c[1] > L - 3 || neckLine.some((q, i) => i > 0 && segDist(c, neckLine[i - 1], q) < 1.1);
    return addPiece(mesh, place, isTrim);
  };
  const F = bodiceMesh(front, true), K = bodiceMesh(back, false);

  // sleeves: wrapped around each arm's axis
  const sleeveMesh = (side) => {
    const mesh = meshPiece(sleeveChains(sleeve), h * 0.9);
    const { sw, capH, sL } = sleeve.dims;
    const sh = B.J[`${side}-shoulder`], el = B.J[`${side}-elbow`], wr = B.J[`${side}-hand`];
    const segA = Math.hypot(...sub(el, sh)), segB = Math.hypot(...sub(wr, el));
    const dirA = nrm(sub(el, sh)), dirB = nrm(sub(wr, el));
    const armpitY = topY - front.dims.ah;
    const dArm = Math.max(2, (armpitY - sh[1]) / (dirA[1] || -1));
    const Rs = sw / (2 * Math.PI) + 1.2, sgn = side === 'l' ? 1 : -1;
    const place = ([px, py]) => {
      const d = py - capH + dArm;
      const onA = d <= segA;
      const c = onA ? add(sh, mul(dirA, d)) : add(el, mul(dirB, Math.min(d - segA, segB)));
      const a = onA ? dirA : dirB;
      const f = nrm(sub([0, 0, 1], mul(a, dot([0, 0, 1], a))));
      let o = cross(f, a); if (Math.sign(o[0]) !== sgn) o = mul(o, -1);
      const phi = (2 * Math.PI * px) / sw;
      return add(c, add(mul(o, Math.cos(phi) * Rs), mul(f, Math.sin(phi) * Rs)));
    };
    return addPiece(mesh, place, (c) => c[1] > sL - 2.5);
  };
  const SL = sleeveMesh('l'), SR = sleeveMesh('r');

  // ---- seams: pair two chains by arc-length fraction ----
  const frac = (ch) => {
    const c = [0];
    for (let i = 1; i < ch.length; i++) c.push(c[i - 1] + Math.hypot(...sub(verts[ch[i]], verts[ch[i - 1]])));
    // use pattern (uv) arc length so easing distributes evenly
    const u = [0];
    for (let i = 1; i < ch.length; i++) u.push(u[i - 1] + Math.hypot(uvs[ch[i]][0] - uvs[ch[i - 1]][0], uvs[ch[i]][1] - uvs[ch[i - 1]][1]));
    const L = u[u.length - 1] || 1;
    return u.map((v) => v / L);
  };
  const sew = (a, b, reverse = false) => {
    const bb = reverse ? b.slice().reverse() : b, fa = frac(a), fb = frac(bb);
    const pairs = new Set();
    const pick = (fs, f) => { let k = 0; for (let i = 1; i < fs.length; i++) if (Math.abs(fs[i] - f) < Math.abs(fs[k] - f)) k = i; return k; };
    a.forEach((v, i) => pairs.add(`${v},${bb[pick(fb, fa[i])]}`));
    bb.forEach((v, i) => pairs.add(`${a[pick(fa, fb[i])]},${v}`));
    for (const p of pairs) seams.push(p.split(',').map(Number));
  };
  sew(F.shoulderR, K.shoulderR); sew(F.shoulderL, K.shoulderL);
  sew(F.sideR, K.sideR); sew(F.sideL, K.sideL);
  // armholes: +x side of the bodice (R chains) carries the left ('l') arm
  sew(F.armholeR, SL.capFront); sew(K.armholeR, SL.capBack, true);
  sew(F.armholeL, SR.capFront, true); sew(K.armholeL, SR.capBack);
  sew(SL.underR, SL.underL, true); sew(SR.underR, SR.underL, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts.flat(), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  geo.setIndex(index.concat(trimIdx));
  geo.addGroup(0, index.length, 0); geo.addGroup(index.length, trimIdx.length, 1);
  geo.computeVertexNormals();
  geo.userData.rows = 1;
  const mesh = new THREE.Mesh(geo, [mats.kameez, mats.trim]);
  // neckline: stay-stitched (eased in) and faced, so it lies on the skin instead of standing off it
  const neckEdge = [F.neckR, F.neckL, K.neckR, K.neckL];
  mesh.userData = { part: 'kameez', piece: 'bodice', pinRows: [], seams, sewn: true, fabric, bridge: true,
    stayStitch: neckEdge.map((c) => c.slice()), attach: [...new Set(neckEdge.flat())],
    thickness: (x, y) => (y < B.waistY + 4 ? 1.4 : 0.45) };
  return mesh;
}
