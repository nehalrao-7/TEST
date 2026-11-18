// Linear-blend skinning with MakeHuman's default rig (163 bones, CC0 weights).
// Poses are rotations about bone heads, defined in the rest frame and chained down the hierarchy.
import * as THREE from '../vendor/three.module.js';

export const POSES = {
  scurve: { label: 'Natural S-curve', armFromVertical: 10, armR: 19, elbow: 12, clavicle: 6, body: 'scurve' },
  ccurve: { label: 'Soft C-curve', armFromVertical: 10, armR: 14, elbow: 10, clavicle: 5, body: 'ccurve' },
  apose: { label: 'A-pose (MakeHuman rest)' },
  relaxed: { label: 'Relaxed, arms down', armFromVertical: 21, elbow: 8, clavicle: 5 },
  model: { label: 'Model stance', armFromVertical: 26, elbow: 24, clavicle: 4 },
  clasped: { label: 'Hands clasped at waist', armFromVertical: 10, armForward: 9, elbow: 74, inward: 46, clavicle: 5 },
};

function jointPositions(H, P) {
  const J = {};
  for (const [name, idx] of Object.entries(H.man.rig.joints)) {
    let x = 0, y = 0, z = 0;
    for (const i of idx) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; }
    J[name] = new THREE.Vector3(x / idx.length, y / idx.length, z / idx.length);
  }
  return J;
}

/** Returns a new posed copy of P (cm). Body-wide: also valid for proxy-reference vertices. */
export function poseMesh(H, P, poseName, rig) {
  const pose = POSES[poseName];
  if (!pose || !pose.armFromVertical || !H.man.rig) return P;
  const deg = THREE.MathUtils.degToRad;
  const bones = H.man.rig.bones, J = jointPositions(H, P);
  const index = new Map(bones.map((b, i) => [b.name, i]));
  const local = bones.map(() => null);
  const down = new THREE.Vector3(0, -1, 0);
  for (const side of ['L', 'R']) {
    // lower the upper arm to the target angle from vertical
    const ua = index.get(`upperarm01.${side}`), b = bones[ua];
    const head = J[b.head], dir = J[b.tail].clone().sub(head).normalize();
    const now = Math.acos(THREE.MathUtils.clamp(dir.dot(down), -1, 1));
    const axis = dir.clone().cross(down).normalize();
    const qa = new THREE.Quaternion().setFromAxisAngle(axis, now - THREE.MathUtils.degToRad(side === 'R' && pose.armR ? pose.armR : pose.armFromVertical));
    // swing the upper arm forward (about the body's left-right axis)
    if (pose.armForward) qa.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -THREE.MathUtils.degToRad(pose.armForward)));
    local[ua] = { head, q: qa };
    // relax the shoulder girdle a little
    const cl = index.get(`clavicle.${side}`), cb = bones[cl];
    const cdir = J[cb.tail].clone().sub(J[cb.head]).normalize();
    local[cl] = { head: J[cb.head], q: new THREE.Quaternion().setFromAxisAngle(cdir.clone().cross(down).normalize(), THREE.MathUtils.degToRad(pose.clavicle)) };
    // elbow: bend forward and turn inward, defined in the already-posed frame (applied in build())
    const la = index.get(`lowerarm01.${side}`), lb = bones[la];
    local[la] = { head: J[lb.head], tail: J[lb.tail], shoulder: J[bones[ua].head], posed: true, elbow: pose.elbow, inward: pose.inward || 0 };
  }
  // whole-body stance: rotations about posed joints (axis in world space), applied after the parent
  const turn = (name, axis, d, pivot) => {
    const i = index.get(name); if (i === undefined || !d) return;
    (local[i] ||= { head: J[bones[i].head] }).world = (local[i].world || []).concat([{ axis: new THREE.Vector3(...axis), a: deg(d), pivot }]);
  };
  if (pose.body === 'scurve' || pose.body === 'ccurve') {
    const s = pose.body === 'scurve';
    const hipR = J[bones[index.get('upperleg01.R')].head];
    // weight on the right leg: pelvis tilts about the standing hip (free hip drops)
    turn('root', [0, 0, 1], s ? -8 : -3, hipR);
    turn('upperleg01.R', [0, 0, 1], s ? 8 : 3);                      // standing leg back to vertical
    turn('upperleg01.L', [0, 0, 1], (s ? 8 : 3) - 4);                 // free leg slightly in
    turn('upperleg01.L', [1, 0, 0], -12);                              // ...and forward
    turn('lowerleg01.L', [1, 0, 0], 26);                               // soft knee, heel lifts
    turn('spine03', [0, 0, 1], s ? 7 : -1);                            // ribcage counter-tilts (S) or follows (C)
    turn('spine01', [0, 0, 1], s ? 5 : -2);
    if (!s) turn('spine03', [1, 0, 0], -3);                            // C: gentle forward curve
    turn('head', [0, 0, 1], s ? -5 : 3);
    turn('head', [0, 1, 0], 6);
  }
  // world matrices, parents first
  const world = bones.map(() => null);
  const T = new THREE.Matrix4(), R = new THREE.Matrix4(), Ti = new THREE.Matrix4();
  const build = (i) => {
    if (world[i]) return world[i];
    const b = bones[i], parent = b.parent != null && index.has(b.parent) ? build(index.get(b.parent)) : new THREE.Matrix4();
    let m = parent.clone();
    const L = local[i];
    if (L && L.world) {
      for (const r of L.world) {
        const h = (r.pivot || L.head).clone().applyMatrix4(i === index.get('root') ? new THREE.Matrix4() : parent);
        m = new THREE.Matrix4().makeTranslation(h.x, h.y, h.z).multiply(new THREE.Matrix4().makeRotationAxis(r.axis, r.a)).multiply(Ti.makeTranslation(-h.x, -h.y, -h.z)).multiply(m);
      }
      if (!L.q && !L.posed) return (world[i] = m);
    }
    if (L && L.posed) {
      // rotate about the posed joint, with axes measured on the posed limb
      const h = L.head.clone().applyMatrix4(parent), t = L.tail.clone().applyMatrix4(parent);
      const f = t.sub(h).normalize(), z = new THREE.Vector3(0, 0, 1);
      // target: continue the upper arm's line, bend it forward by the elbow angle, then turn it inward
      const u = h.clone().sub(L.shoulder.clone().applyMatrix4(parent)).normalize();
      const target = u.clone().applyAxisAngle(u.clone().cross(z).normalize(), THREE.MathUtils.degToRad(L.elbow));
      if (L.inward) target.applyAxisAngle(new THREE.Vector3(0, 1, 0), -(Math.sign(h.x) || 1) * THREE.MathUtils.degToRad(L.inward));
      const q = new THREE.Quaternion().setFromUnitVectors(f, target.normalize());
      m = new THREE.Matrix4().makeTranslation(h.x, h.y, h.z).multiply(R.makeRotationFromQuaternion(q)).multiply(Ti.makeTranslation(-h.x, -h.y, -h.z)).multiply(parent);
    } else if (L && L.q) {
      const h = L.head;
      m.multiply(T.makeTranslation(h.x, h.y, h.z)).multiply(R.makeRotationFromQuaternion(L.q)).multiply(Ti.makeTranslation(-h.x, -h.y, -h.z));
    }
    return (world[i] = m);
  };
  bones.forEach((_, i) => build(i));
  const els = world.map((m) => m.elements);
  const out = new Float32Array(P.length), bi = rig.bones, bw = rig.weights;
  for (let v = 0; v < P.length / 3; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let ox = 0, oy = 0, oz = 0, wsum = 0;
    for (let k = 0; k < 4; k++) {
      const w = bw[v * 4 + k]; if (!w) continue;
      const e = els[bi[v * 4 + k]];
      ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12]);
      oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13]);
      oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14]);
      wsum += w;
    }
    if (wsum < 1e-6) { out[v * 3] = x; out[v * 3 + 1] = y; out[v * 3 + 2] = z; }
    else { out[v * 3] = ox / wsum; out[v * 3 + 1] = oy / wsum; out[v * 3 + 2] = oz / wsum; }
  }
  // keep the feet on the floor after the stance change
  if (pose.body) {
    // ground on the standing (right) foot
    let lo = Infinity, lo0 = Infinity;
    for (let v = 0; v < P.length / 3; v++) if (H.labels[v] === 13) { lo = Math.min(lo, out[v * 3 + 1]); lo0 = Math.min(lo0, P[v * 3 + 1]); }
    if (!isFinite(lo)) { lo = 0; lo0 = 0; }
    for (let v = 1; v < out.length; v += 3) out[v] += lo0 - lo;
  }
  return out;
}
