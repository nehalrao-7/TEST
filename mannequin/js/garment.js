import * as THREE from '../vendor/three.module.js';
import { ring, loft, clipRings } from './geometry.js';

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

// Make garment ring that never renders inside the body ring.
function over(bodyRing, C, k, gap = 0.6) {
  const r = ring({ y: bodyRing.y, C, k, x: bodyRing.x, z: bodyRing.z });
  r.rx = Math.max(r.rx, bodyRing.rx + gap);
  r.rz = Math.max(r.rz, bodyRing.rz + gap);
  return r;
}

export function buildGarment(bm, m, g, mats) {
  const group = new THREE.Group();
  const t = bm.torso;

  // ---------- Salwar ----------
  const fold = (n, a, ph = 0) => ({ n, a, phase: ph });
  const cuffTop = bm.ankleY + g.cuffHeight;
  const salwarTop = Math.min(bm.waistY + 1, bm.waistY + 1);
  const crY = bm.crotchY - g.crotchDrop;
  const upper = [
    { ...over(t.waist, m.waist, 0.74, 0.25), y: salwarTop - 1 },
    over(t.hip, m.hip + 1, 0.72, 0.3),
    over(t.seat, m.hip, 0.7, 0.4),
    ring({ y: crY, C: m.hip * 0.9, k: 0.66, z: -0.3 }),
  ];
  group.add(new THREE.Mesh(loft(upper), mats.salwar));
  const fullness = Math.max(1, g.fullness);
  const legTop = Math.min(crY + 10, bm.hipY);
  const hemBodyY = Math.max(bm.shoulderY - g.kameezLength, 0);
  for (const side of [-1, 1]) {
    const lx = (f) => side * bm.legX * f;
    // Volume blooms only below the kameez hem so the salwar never pokes through it.
    const bloom = (y) => { const t = Math.min(1, Math.max(0, (hemBodyY + 2 - y) / 18)); return t * t * (3 - 2 * t); };
    const pts = [
      { y: legTop, C: m.thigh * 1.04, x: 1 },
      { y: bm.crotchY - 4, C: m.thigh * (1.1 + 0.12 * fullness), x: 1.0 },
      { y: (bm.crotchY + bm.kneeY) / 2, C: m.thigh * (1 + 0.2 * fullness), x: 0.95 },
      { y: bm.kneeY + 2, C: m.knee * (0.9 + 0.4 * fullness), x: 0.9 },
      { y: bm.calfY, C: m.calf * (1 + 0.45 * fullness), x: 0.84 },
      { y: cuffTop + 5, C: m.calf * (0.8 + 0.4 * fullness), x: 0.75 },
      { y: cuffTop + 0.5, C: g.mohri * 1.1, x: 0.68 },
    ];
    const legRings = pts.map((p, i) => {
      const b = i === pts.length - 1 ? 1 : bloom(p.y);
      const base = m.thigh * 1.04 * (1 - i / pts.length) + m.calf * (i / pts.length);
      const C = Math.max(base + (p.C - base) * b, 1);
      return { ...ring({ y: p.y, C, k: 0.92, x: lx(p.x) }),
        wave: [fold(g.pleats + 3, (0.02 + 0.025 * fullness) * b, i * 0.5), fold(5, 0.04 * b, side * i)] };
    });
    group.add(new THREE.Mesh(loft(legRings), mats.salwar));
    const cr = (y) => ring({ y, C: Math.max(g.mohri, m.ankle + 1), k: 0.85, x: lx(0.66) });
    group.add(new THREE.Mesh(loft([cr(cuffTop), cr(bm.ankleY - 1)], { seg: 40 }), mats.cuff));
  }

  // ---------- Kameez ----------
  const k = [
    ring({ y: bm.shoulderY + 1.6, C: m.neck + 6, k: 0.85, z: 0.5 }),
    { ...t.shoulder, rx: t.shoulder.rx + 1.4, rz: t.shoulder.rz + 1.2, y: t.shoulder.y - 0.5 },
    over(t.chest, m.bust * 0.95 + g.bustEase, 0.66, 1),
    over(t.bust, m.bust + g.bustEase, 0.76),
    over(t.underbust, (m.underbust + m.waist) / 2 + (g.bustEase + g.waistEase) / 2 + 2, 0.74),
    over(t.waist, m.waist + g.waistEase, 0.76),
    over(t.hip, m.hip + g.hipEase, 0.76),
    over(t.seat, m.hip + g.hipEase + g.hemFlare * 0.25, 0.76, 1.5),
  ];
  const hipC = m.hip + g.hipEase;
  for (let i = 1; i <= 6; i++) {
    const y = bm.hipY - (i / 6) * (bm.hipY - 0);
    k.push(ring({ y, C: hipC + g.hemFlare * Math.min(1, (bm.hipY - y) / Math.max(1, bm.hipY - hemBodyY)) + 8 * (y < bm.crotchY), k: 0.8, z: -0.5 }));
  }
  const kRings = clipRings(k, hemBodyY);
  group.add(new THREE.Mesh(loft(kRings), mats.kameez));
  // neckline trim
  const nk = kRings[0];
  group.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 48).scale(nk.rx, nk.rz, 1).rotateX(Math.PI / 2).translate(0, nk.y, nk.z), mats.trim));
  // hem trim
  const hm = kRings[kRings.length - 1];
  group.add(new THREE.Mesh(loft([{ ...hm, rx: hm.rx + 0.2, rz: hm.rz + 0.2 }, { ...hm, y: hm.y + 3, rx: hm.rx + 0.25, rz: hm.rz + 0.25 }]), mats.trim));

  // Sleeves
  for (const arm of [bm.armL, bm.armR]) {
    const len = Math.min(g.sleeveLength, m.armLength);
    const endY = bm.armTop - len;
    const sl = arm.map((r, i) => {
      const C = i < 3 ? m.upperArm + g.sleeveEase + (i === 0 ? 4 : 0) : (m.upperArm + g.sleeveEase + g.sleeveOpening) / 2;
      return over(r, C, 0.95, 0.5);
    });
    const tail = clipRings(sl, endY);
    const last = tail[tail.length - 1];
    const op = ring({ y: last.y, C: g.sleeveOpening, k: 0.95, x: last.x, z: last.z });
    tail[tail.length - 1] = { ...last, rx: Math.max(op.rx, arm[0].rx * 0 + last.rx * 0.6), rz: Math.max(op.rz, last.rz * 0.6) };
    group.add(new THREE.Mesh(loft(tail), mats.kameez));
  }
  return group;
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
