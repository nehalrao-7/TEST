import * as THREE from '../vendor/three.module.js';
import { ring, loft, ellipsoid } from './geometry.js';

// All values in centimetres.
export const BODY_FIELDS = [
  { key: 'height', label: 'Height', def: 165, help: 'Stand straight, barefoot. Floor to top of head.' },
  { key: 'neck', label: 'Neck', def: 34, help: 'Around the base of the neck, where a collar sits.' },
  { key: 'shoulder', label: 'Shoulder width', def: 38, help: 'Across the back, from one shoulder bone tip to the other.' },
  { key: 'bust', label: 'Bust', def: 90, help: 'Around the fullest part of the bust, tape level across the back.' },
  { key: 'underbust', label: 'Under-bust', def: 76, help: 'Snug around the ribcage directly under the bust.' },
  { key: 'waist', label: 'Waist', def: 74, help: 'Around the natural waist (narrowest part, just above the navel).' },
  { key: 'hip', label: 'Hip', def: 98, help: 'Around the fullest part of the hips/seat.' },
  { key: 'thigh', label: 'Thigh', def: 56, help: 'Around the fullest part of one thigh, just under the crotch.' },
  { key: 'knee', label: 'Knee', def: 37, help: 'Around the knee, leg straight.' },
  { key: 'calf', label: 'Calf', def: 35, help: 'Around the fullest part of the calf.' },
  { key: 'ankle', label: 'Ankle', def: 22, help: 'Around the ankle bone.' },
  { key: 'upperArm', label: 'Upper arm (bicep)', def: 28, help: 'Around the fullest part of the upper arm, arm relaxed.' },
  { key: 'wrist', label: 'Wrist', def: 15.5, help: 'Around the wrist bone.' },
  { key: 'armLength', label: 'Arm length', def: 57, help: 'Shoulder bone tip, over a slightly bent elbow, to wrist bone.' },
  { key: 'backLength', label: 'Nape to waist', def: 40, help: 'Back of neck (prominent bone) straight down to natural waist.' },
  { key: 'waistToHip', label: 'Waist to hip', def: 20, help: 'Side of body, from waist line down to fullest hip line.' },
  { key: 'waistHeight', label: 'Waist to floor', def: 102, help: 'Side of body, from natural waist straight down to the floor.' },
  { key: 'inseam', label: 'Inseam (crotch to floor)', def: 76, help: 'Inside leg, from crotch straight down to the floor.' },
];

export const BODY_DEFAULTS = Object.fromEntries(BODY_FIELDS.map((f) => [f.key, f.def]));

// Builds landmark positions and ring cross-sections from measurements.
export function bodyModel(m) {
  const H = m.height, s = H / 165;
  const waistY = m.waistHeight;
  const napeY = Math.min(waistY + m.backLength, H * 0.9);
  const crotchY = Math.min(m.inseam, waistY - 12);
  const hipY = Math.max(waistY - m.waistToHip, crotchY + 4);
  const shoulderY = napeY - 2 * s;
  const bustY = napeY - 0.5 * m.backLength;
  const underbustY = napeY - 0.7 * m.backLength;
  const chestY = bustY + 0.17 * m.backLength;
  const kneeY = crotchY * 0.6;
  const calfY = kneeY * 0.72;
  const ankleY = 0.05 * H;
  const bustProj = Math.max(0, m.bust - m.underbust) * 0.1;

  const torso = {
    neckTop: ring({ y: napeY + 0.055 * H, C: m.neck * 0.95, k: 0.95, z: 1 * s }),
    neckBase: ring({ y: napeY + 1, C: m.neck * 1.05, k: 0.9, z: 0.5 * s }),
    shoulder: ring({ y: shoulderY, rx: m.shoulder / 2 - 1.5, rz: (m.shoulder / 2) * 0.42 }),
    chest: ring({ y: chestY, C: m.bust * 0.95, k: 0.62, z: bustProj * 0.4 }),
    bust: ring({ y: bustY, C: m.bust, k: 0.74, z: bustProj }),
    underbust: ring({ y: underbustY, C: m.underbust, k: 0.72, z: bustProj * 0.3 }),
    waist: ring({ y: waistY, C: m.waist, k: 0.74 }),
    highHip: ring({ y: (waistY + hipY) / 2, C: (m.waist + m.hip) / 2, k: 0.74, z: -0.3 }),
    hip: ring({ y: hipY, C: m.hip, k: 0.72, z: -0.8 }),
    seat: ring({ y: crotchY + (hipY - crotchY) * 0.35, C: m.hip * 0.93, k: 0.7, z: -0.6 }),
    crotch: ring({ y: crotchY, C: m.hip * 0.7, k: 0.62, z: -0.3 }),
  };
  const legX = torso.hip.rx * 0.47;
  const legRing = (y, C, k, xf) => ring({ y, C, k, x: legX * xf });
  const leg = [
    legRing(crotchY + 6, m.thigh * 1.08, 0.95, 1),
    legRing(crotchY - 3, m.thigh, 0.95, 1),
    legRing((crotchY + kneeY) / 2, (m.thigh + m.knee) / 2 + 2, 0.92, 0.9),
    legRing(kneeY, m.knee, 0.92, 0.78),
    legRing(calfY, m.calf, 0.9, 0.72),
    legRing((calfY + ankleY) / 2, (m.calf + m.ankle) / 2, 0.85, 0.68),
    legRing(ankleY, m.ankle, 0.8, 0.66),
    legRing(ankleY * 0.45, m.ankle * 0.95, 0.85, 0.66),
  ];
  const armR = m.upperArm / (2 * Math.PI);
  const armX0 = Math.max(m.shoulder / 2, torso.chest.rx + armR * 0.8);
  const armTop = shoulderY - 1.5;
  const L = m.armLength;
  const arm = (side) => {
    const ax = (t) => side * (armX0 + t * L * 0.22);
    return [
      ring({ y: armTop + 1, C: m.upperArm * 1.05, k: 1, x: ax(0) - side * 1.2 }),
      ring({ y: armTop - 0.12 * L, C: m.upperArm * 1.08, k: 0.95, x: ax(0.12) }),
      ring({ y: armTop - 0.3 * L, C: m.upperArm, k: 0.95, x: ax(0.3) }),
      ring({ y: armTop - 0.52 * L, C: (m.upperArm + m.wrist) / 2 + 1, k: 0.9, x: ax(0.52) }),
      ring({ y: armTop - 0.7 * L, C: (m.upperArm + m.wrist) / 2 + 1.5, k: 0.85, x: ax(0.7) }),
      ring({ y: armTop - L, C: m.wrist, k: 0.7, x: ax(1) }),
    ];
  };
  return { H, s, waistY, napeY, crotchY, hipY, shoulderY, bustY, underbustY, kneeY, calfY, ankleY,
    torso, leg, legX, armL: arm(-1), armR: arm(1), armTop };
}

export function buildBody(bm, mat) {
  const g = new THREE.Group();
  const t = bm.torso;
  g.add(new THREE.Mesh(loft([t.neckTop, t.neckBase, t.shoulder, t.chest, t.bust, t.underbust, t.waist, t.highHip, t.hip, t.seat, t.crotch], { capBottom: true }), mat));
  for (const side of [-1, 1]) {
    g.add(new THREE.Mesh(loft(bm.leg.map((r) => ({ ...r, x: r.x * side })), { capBottom: true }), mat));
    const last = bm.leg[bm.leg.length - 1];
    g.add(ellipsoid(last.rx * 0.95, bm.ankleY * 0.5, 12 * bm.s, side * last.x, bm.ankleY * 0.45, 5 * bm.s, mat));
    const arm = side < 0 ? bm.armL : bm.armR;
    g.add(new THREE.Mesh(loft(arm, { capTop: true }), mat));
    const w = arm[arm.length - 1];
    g.add(ellipsoid(w.rx * 1.2, 9 * bm.s, w.rz * 1.3, w.x, w.y - 8 * bm.s, w.z, mat));
  }
  const hs = bm.s;
  g.add(ellipsoid(8 * hs, 11 * hs, 9.5 * hs, 0, bm.H - 11 * hs, 1.5 * hs, mat));
  return g;
}

// Guide definitions per measurement: rings or straight lines.
export function bodyGuides(bm, m) {
  const t = bm.torso, s = bm.s;
  const front = (r, d = 4) => r.z + r.rz + d;
  const thigh = { ...bm.leg[1], x: bm.leg[1].x };
  const arm = bm.armR;
  const shoulderPts = [[-m.shoulder / 2, bm.shoulderY + 1, -t.shoulder.rz * 0.6], [m.shoulder / 2, bm.shoulderY + 1, -t.shoulder.rz * 0.6]];
  return {
    height: { line: [[-30 * s, 0, 0], [-30 * s, bm.H, 0]], at: 0.93 },
    neck: { ring: t.neckBase },
    shoulder: { line: shoulderPts, back: true },
    bust: { ring: t.bust },
    underbust: { ring: t.underbust },
    waist: { ring: t.waist },
    hip: { ring: t.hip },
    thigh: { ring: thigh },
    knee: { ring: bm.leg[3] },
    calf: { ring: bm.leg[4] },
    ankle: { ring: bm.leg[6] },
    upperArm: { ring: arm[2] },
    wrist: { ring: arm[5] },
    armLength: { line: [[arm[0].x + 4, bm.armTop + 1, 0], [arm[5].x + 4, arm[5].y, 0]] },
    backLength: { line: [[0, bm.napeY, -t.neckBase.rz - 3], [0, bm.waistY, -t.waist.rz - 3]], back: true },
    waistToHip: { line: [[t.waist.rx + 3, bm.waistY, 0], [t.hip.rx + 3, bm.hipY, 0]] },
    waistHeight: { line: [[t.waist.rx + 12 * s, bm.waistY, 0], [t.waist.rx + 12 * s, 0, 0]], at: 0.3 },
    inseam: { line: [[0, bm.crotchY, front(t.crotch, 6)], [0, 0, front(t.crotch, 6)]] },
  };
}
