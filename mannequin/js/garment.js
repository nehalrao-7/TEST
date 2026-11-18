import * as THREE from '../vendor/three.module.js';
import { N, section, perimeter, inflate, scaleTo, smooth, smoothAlong, loftRings, lerpRing, frame, rng, V3 } from './drape.js';
const { add, sub, mul } = V3;

// Garment specs (cm). Ease = garment minus body.
export const GARMENT_FIELDS = [
  { group: 'Kameez (tunic)', key: 'kameezLength', label: 'Kameez length', def: 92, help: 'High shoulder point down to hem.' },
  { key: 'bustEase', label: 'Bust ease', def: 6, help: 'Extra room over bust measurement. 4–8 cm is a classic fit.' },
  { key: 'waistEase', label: 'Waist ease', def: 6, help: 'Extra room at the waist.' },
  { key: 'hipEase', label: 'Hip ease', def: 6, help: 'Extra room at the hip. Must be positive to walk/sit.' },
  { key: 'hemFlare', label: 'Hem flare', def: 16, help: 'Extra hem circumference beyond the hip (A-line).' },
  { key: 'slitLength', label: 'Side slit length', def: 20, help: 'Side slit measured up from the hem.' },
  { key: 'frontNeckDepth', label: 'Front neck depth', def: 11, help: 'Drop of the front neckline from the shoulder line.' },
  { key: 'backNeckDepth', label: 'Back neck depth', def: 3, help: 'Drop of the back neckline.' },
  { key: 'sleeveLength', label: 'Sleeve length', def: 40, help: 'Shoulder tip to sleeve hem. Arm length = full sleeve.' },
  { key: 'sleeveEase', label: 'Sleeve (bicep) ease', def: 5, help: 'Extra room around the upper arm.' },
  { key: 'sleeveOpening', label: 'Sleeve opening', def: 26, help: 'Circumference at sleeve hem.' },
  { group: 'Patiala salwar', key: 'salwarLength', label: 'Salwar length', def: 98, help: 'Waist to bottom of cuff.' },
  { key: 'salwarWaist', label: 'Waist (gathered)', def: 76, help: 'Finished waist after the drawstring/elastic is tied.' },
  { key: 'fullness', label: 'Fullness (×hip)', def: 2.5, step: 0.1, help: 'Fabric width per leg relative to half-hip; patiala is 2–3.5×.' },
  { key: 'pleats', label: 'Pleats per leg', def: 8, step: 1, help: 'Number of deep pleats at the top of each leg.' },
  { key: 'crotchDrop', label: 'Crotch drop', def: 8, help: 'How low the crotch sits below the body crotch.' },
  { key: 'mohri', label: 'Cuff (mohri) circumference', def: 34, help: 'Ankle cuff opening; ankle + 10–14 cm to slip on.' },
  { key: 'cuffHeight', label: 'Cuff height', def: 9, help: 'Finished height of the ankle band.' },
  { key: 'seamAllowance', group: 'Pattern', label: 'Seam allowance', def: 1.5, step: 0.5, help: 'Added around every pattern piece.' },
];
export const GARMENT_DEFAULTS = Object.fromEntries(GARMENT_FIELDS.map((f) => [f.key, f.def]));


// ---------------------------------------------------------------------------
// Garment builder on the realistic body. `B` = fitted body context:
// { P (cm), J joints (cm), label index lists, achieved measurements, waistY, crotchY }
// ---------------------------------------------------------------------------
const L = { torso: 0, head: 1, lUpper: 2, lFore: 3, lHand: 4, lThigh: 5, lShin: 6, lFoot: 7, rUpper: 8, rFore: 9, rHand: 10, rThigh: 11, rShin: 12, rFoot: 13 };
const Y = [0, 1, 0];
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function bodyContext(H, P, labels, J, achieved) {
  const byLabel = Array.from({ length: 14 }, () => []);
  const seen = new Uint8Array(P.length / 3);
  for (const i of H.body.orig) if (!seen[i]) { seen[i] = 1; byLabel[labels[i]].push(i); }
  const R = H.man.rulers;
  const avgY = (idx) => idx.reduce((s, i) => s + P[i * 3 + 1], 0) / idx.length;
  const pick = (...ls) => ls.flatMap((l) => byLabel[l]);
  return {
    P, J, byLabel, pick, achieved,
    waistY: avgY(R['waist-circ']), hipY: avgY(R['hips-circ']), bustY: avgY(R['bust-circ']),
    underbustY: avgY(R['underbust-circ']), neckY: avgY(R['neck-circ']), crotchY: achieved.inseam,
    ankleY: J['l-ankle'][1], kneeY: J['l-knee'][1],
  };
}

function hsection(B, idx, y, slab = 2.2) { return section(B.P, idx, [0, y, 0], Y, slab); }

export function buildGarment(B, m, g, mats) {
  const group = new THREE.Group();
  const torsoIdx = B.pick(L.torso), hipIdx = B.pick(L.torso, L.lThigh, L.rThigh);
  const legsIdx = B.pick(L.lThigh, L.rThigh, L.lShin, L.rShin);
  const shoulderY = Math.max(B.J['l-shoulder'][1], B.J['r-shoulder'][1]);
  const topY = B.neckY - 1.5;
  const hemY = Math.max(2, topY - g.kameezLength);
  const rand = rng(7);

  // ---------------- Kameez body ----------------
  const ease = (y) => {
    if (y >= B.bustY) return g.bustEase;
    if (y >= B.waistY) return g.waistEase + (g.bustEase - g.waistEase) * smoothstep(B.waistY, B.bustY, y);
    return g.waistEase + (g.hipEase - g.waistEase) * smoothstep(B.waistY, B.hipY, y);
  };
  const rings = [];
  let hipRing = null;
  for (let y = topY; y > hemY - 0.01; y -= y > B.bustY ? 1 : 2.5) {
    const yy = Math.max(y, hemY);
    if (yy >= B.hipY) {
      const idx = yy > B.crotchY + 4 ? (yy > B.waistY ? torsoIdx : hipIdx) : hipIdx;
      let s = hsection(B, idx, yy);
      if (!s) continue;
      s = smooth(s, 2);
      const P0 = perimeter(s.r);
      s = inflate(s, P0 + ease(yy), yy > shoulderY - 6 ? 0.5 : 1.0);
      rings.push(s);
      hipRing = s;
    } else {
      // skirt: hip shape scaled out with flare, never inside the legs
      const t = smoothstep(B.hipY, hemY, yy);
      const C = perimeter(hipRing.r) + g.hemFlare * Math.min(1, (B.hipY - yy) / Math.max(1, B.hipY - hemY));
      let s = scaleTo({ ...hipRing, c: [hipRing.c[0], yy, hipRing.c[2]] }, C);
      const legs = section(B.P, yy > B.crotchY ? hipIdx : legsIdx, s.c, Y, 1.5, null, true);
      if (legs) s = { ...s, r: s.r.map((r, k) => Math.max(r, legs.r[k] + 3.2)) };
      s = smooth(s, 3 + Math.round(t * 4));
      rings.push(s);
    }
    if (y <= hemY) break;
  }
  const smoothedK = smoothAlong(rings, 6);
  const foldPhase = Array.from({ length: 6 }, () => rand() * 6.28);
  const nRings = rings.length;
  const kFolds = (i, th) => {
    const y = rings[Math.min(nRings - 1, Math.floor(i))].c[1];
    const t = smoothstep(B.hipY, hemY, y);
    return t * (0.035 * Math.sin(5 * th + foldPhase[0]) + 0.02 * Math.sin(9 * th + foldPhase[1]) + 0.012 * Math.sin(14 * th + foldPhase[2]));
  };
  const neckHalfW = m.neck / (2 * Math.PI) + 2.2;
  const slitTop = hemY + g.slitLength;
  const neckZ = B.J['neck'][2];
  const neckCurve = (th, x, z) => {
    const ax = Math.abs(x);
    if (ax >= neckHalfW) return Infinity;
    const depth = z > neckZ ? g.frontNeckDepth : g.backNeckDepth;
    return topY - depth * Math.sqrt(Math.max(0, 1 - (ax / neckHalfW) ** 2));
  };
  const kCut = (i, th, p) => p[1] < slitTop && Math.abs(Math.sin(th)) < 0.045;
  group.add(new THREE.Mesh(loftRings(smoothedK, { folds: kFolds, cut: kCut, clampY: neckCurve, uvScale: [4, 3] }), mats.kameez));
  // hem trim band
  const hem = rings[rings.length - 1];
  const band = [lerpRing(hem, hem, 0), { ...hem, c: add(hem.c, [0, 3, 0]), r: hem.r.map((r) => r * 0.995) }].map((r) => ({ ...r, r: r.r.map((x) => x + 0.25) }));
  group.add(new THREE.Mesh(loftRings(band.reverse(), { folds: (i, th) => kFolds(nRings - 1, th), cut: (i, th, p) => p[1] < slitTop && Math.abs(Math.sin(th)) < 0.045 }), mats.trim));

  // ---------------- Sleeves ----------------
  for (const side of ['l', 'r']) {
    const sh = B.J[`${side}-shoulder`], el = B.J[`${side}-elbow`], wr = B.J[`${side}-hand`];
    const upper = B.pick(side === 'l' ? L.lUpper : L.rUpper), fore = B.pick(side === 'l' ? L.lFore : L.rFore);
    const segA = Math.hypot(...sub(el, sh)), segB = Math.hypot(...sub(wr, el));
    const len = Math.min(g.sleeveLength, segA + segB - 1);
    const sr = [];
    const fr = frame(sub(el, sh)); // keep one frame so rings don't twist
    for (let d = -6; d <= len; d += 1.5) {
      const onA = d <= segA;
      const t = onA ? Math.max(0, d) / segA : (d - segA) / segB;
      const c = onA ? add(sh, mul(sub(el, sh), d / segA)) : add(el, mul(sub(wr, el), t));
      const axis = onA ? sub(el, sh) : sub(wr, el);
      const f2 = frame(axis); const fu = { u: f2.u, v: f2.v };
      let s = section(B.P, onA ? upper : fore, c, axis, 1.0, fu);
      if (!s) continue;
      s = smooth(s, 3);
      const k = d / len;
      const C = (m.upperArm + g.sleeveEase) * (1 - smoothstep(0.35, 1, k)) + g.sleeveOpening * smoothstep(0.35, 1, k) + (d < 0 ? 1.5 : 0);
      sr.push(inflate(s, C, 0.5));
    }
    if (sr.length > 1) group.add(new THREE.Mesh(loftRings(smoothAlong(sr, 3), { uvScale: [2, 3] }), mats.kameez));
    void fr;
  }

  // ---------------- Patiala salwar ----------------
  const crY = B.crotchY - g.crotchDrop;
  const cuffTop = B.ankleY + g.cuffHeight - 2;
  const upperRings = [];
  for (let y = B.waistY; y >= crY; y -= 2) {
    let s = hsection(B, y > B.crotchY + 3 ? hipIdx : legsIdx.concat(hipIdx), y);
    if (!s) continue;
    upperRings.push(inflate(smooth(s, 2), 0, 0.12));
  }
  if (upperRings.length > 1) group.add(new THREE.Mesh(loftRings(smoothAlong(upperRings, 2), { uvScale: [6, 3] }), mats.salwar));
  const fullness = Math.max(1, g.fullness);
  for (const side of ['l', 'r']) {
    const idx = B.pick(side === 'l' ? L.lThigh : L.rThigh, side === 'l' ? L.lShin : L.rShin);
    const lr = [];
    const ph = Array.from({ length: 4 }, () => rand() * 6.28);
    for (let y = crY + 6; y >= cuffTop; y -= 2) {
      let s = hsection(B, idx, y);
      if (!s) continue;
      s = smooth(s, 4);
      const P0 = perimeter(s.r);
      // volume blooms below the kameez hem, deepest over the calf, then gathers into the cuff
      const below = smoothstep(hemY + 4, hemY - 14, y);
      const toCuff = smoothstep(cuffTop + 14, cuffTop, y);
      const extra = (P0 * 0.25 + 10) * (fullness - 1) * below * (1 - 0.7 * toCuff);
      lr.push(y < hemY - 2 ? inflate(s, P0 + 4 + extra, 0.3) : inflate(s, 0, 0.15));
    }
    // gather into cuff
    const cuffRing = (y) => { const s = hsection(B, idx, y) || lr[lr.length - 1]; return inflate(smooth(s, 4), g.mohri, 0.4); };
    lr.push(cuffRing(cuffTop));
    const lrs = smoothAlong(lr, 3);
    const nL = lrs.length;
    const folds = (i, th) => {
      const y = lrs[Math.min(nL - 1, Math.floor(i))].c[1];
      const a = smoothstep(hemY + 4, hemY - 10, y) * (1 - smoothstep(cuffTop + 4, cuffTop, y));
      return a * (0.05 * Math.sin((g.pleats + 1) * th + ph[0] + y * 0.015) + 0.04 * Math.sin(4 * th + ph[1] - y * 0.02) + 0.012 * Math.sin(11 * th + ph[2]));
    };
    group.add(new THREE.Mesh(loftRings(lrs, { folds, uvScale: [6, 3] }), mats.salwar));
    const cuff = [cuffRing(cuffTop + 0.5), cuffRing(B.ankleY - 3.5)];
    group.add(new THREE.Mesh(loftRings(cuff, { uvScale: [3, 1] }), mats.cuff));
  }
  return { group, hemY };
}

// Fit report rows: [label, body, garment]
export function fitReport(m, g) {
  return [
    ['Bust', m.bust, m.bust + g.bustEase],
    ['Waist (kameez)', m.waist, m.waist + g.waistEase],
    ['Hip (kameez)', m.hip, m.hip + g.hipEase],
    ['Upper arm', m.upperArm, m.upperArm + g.sleeveEase],
    ['Sleeve opening', m.wrist, g.sleeveOpening],
    ['Salwar waist', m.waist, g.salwarWaist],
    ['Cuff over ankle', m.ankle, g.mohri],
  ].map(([label, b, gm]) => {
    const e = gm - b;
    let status = 'relaxed', cls = 'ok';
    if (e < 0) { status = 'too tight'; cls = 'bad'; }
    else if (e < 2) { status = 'snug'; cls = 'warn'; }
    else if (e > 20) { status = 'very loose'; cls = 'warn'; }
    if (label === 'Cuff over ankle' && e < 8) { status = 'won’t slip over foot'; cls = 'bad'; }
    if (label === 'Salwar waist' && e < -4) { status = 'too tight'; cls = 'bad'; } else if (label === 'Salwar waist') { status = 'drawstring'; cls = 'ok'; }
    return { label, body: b, garment: gm, ease: e, status, cls };
  });
}
