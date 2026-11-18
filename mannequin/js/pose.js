// Linear-blend skinning with MakeHuman's default rig (163 bones, CC0 weights).
// Poses are rotations about bone heads, defined in the rest frame and chained down the hierarchy.
import * as THREE from '../vendor/three.module.js';

export const POSES = {
  apose: { label: 'A-pose (MakeHuman rest)' },
  relaxed: { label: 'Relaxed, arms down', armFromVertical: 21, elbow: 8, clavicle: 5 },
  model: { label: 'Model stance', armFromVertical: 26, elbow: 24, clavicle: 4 },
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
    local[ua] = { head, q: new THREE.Quaternion().setFromAxisAngle(axis, now - THREE.MathUtils.degToRad(pose.armFromVertical)) };
    // relax the shoulder girdle a little
    const cl = index.get(`clavicle.${side}`), cb = bones[cl];
    const cdir = J[cb.tail].clone().sub(J[cb.head]).normalize();
    local[cl] = { head: J[cb.head], q: new THREE.Quaternion().setFromAxisAngle(cdir.clone().cross(down).normalize(), THREE.MathUtils.degToRad(pose.clavicle)) };
    // soft elbow bend, forearm swinging forward
    const la = index.get(`lowerarm01.${side}`), lb = bones[la];
    const fdir = J[lb.tail].clone().sub(J[lb.head]).normalize();
    const bendAxis = fdir.clone().cross(new THREE.Vector3(0, 0, 1)).normalize();
    local[la] = { head: J[lb.head], q: new THREE.Quaternion().setFromAxisAngle(bendAxis, THREE.MathUtils.degToRad(pose.elbow)) };
  }
  // world matrices, parents first
  const world = bones.map(() => null);
  const T = new THREE.Matrix4(), R = new THREE.Matrix4(), Ti = new THREE.Matrix4();
  const build = (i) => {
    if (world[i]) return world[i];
    const b = bones[i], parent = b.parent != null && index.has(b.parent) ? build(index.get(b.parent)) : new THREE.Matrix4();
    const m = parent.clone();
    if (local[i]) {
      const h = local[i].head;
      m.multiply(T.makeTranslation(h.x, h.y, h.z)).multiply(R.makeRotationFromQuaternion(local[i].q)).multiply(Ti.makeTranslation(-h.x, -h.y, -h.z));
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
  return out;
}
