import * as THREE from '../vendor/three.module.js';

// Ramanujan ellipse perimeter: solve semi-axis a for circumference C with ratio k = b/a.
export function radiiFromCirc(C, k) {
  const h = ((1 - k) / (1 + k)) ** 2;
  const perUnit = Math.PI * (1 + k) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  const rx = C / perUnit;
  return { rx, rz: rx * k };
}

// Normalise a ring spec: {y, C,k | rx,rz, x?, z?, wave?}
export function ring(spec) {
  const r = { x: 0, z: 0, ...spec };
  if (r.C !== undefined) Object.assign(r, radiiFromCirc(r.C, r.k ?? 1));
  return r;
}

// Clip a top→bottom ring list at yMin, interpolating the final ring.
export function clipRings(rings, yMin) {
  const out = [];
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (r.y >= yMin) { out.push(r); continue; }
    const p = out[out.length - 1];
    if (p) {
      const t = (p.y - yMin) / (p.y - r.y);
      const L = (a, b) => a + (b - a) * t;
      out.push({ ...r, y: yMin, rx: L(p.rx, r.rx), rz: L(p.rz, r.rz), x: L(p.x, r.x), z: L(p.z, r.z) });
    }
    break;
  }
  return out;
}

// Loft a tube through horizontal elliptical rings.
export function loft(rings, { seg = 56, capTop = false, capBottom = false } = {}) {
  const pos = [], idx = [];
  rings.forEach((r) => {
    for (let s = 0; s <= seg; s++) {
      const th = (s / seg) * Math.PI * 2;
      let m = 1;
      if (r.wave) for (const w of [].concat(r.wave)) m += w.a * Math.sin(w.n * th + (w.phase || 0));
      if (r.bulge) m += r.bulge(th);
      pos.push(r.x + r.rx * Math.cos(th) * m, r.y, r.z + r.rz * Math.sin(th) * m);
    }
  });
  const row = seg + 1;
  for (let i = 0; i < rings.length - 1; i++)
    for (let s = 0; s < seg; s++) {
      const a = i * row + s, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const cap = (ri, flip) => {
    const r = rings[ri];
    const ci = pos.length / 3;
    pos.push(r.x, r.y, r.z);
    for (let s = 0; s < seg; s++) {
      const a = ri * row + s, b = a + 1;
      flip ? idx.push(ci, b, a) : idx.push(ci, a, b);
    }
  };
  if (capTop) cap(0, false);
  if (capBottom) cap(rings.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function ellipsoid(rx, ry, rz, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  m.scale.set(rx, ry, rz);
  m.position.set(x, y, z);
  return m;
}

export function ellipseLine(r, color, offset = 0.6) {
  const pts = [];
  for (let s = 0; s <= 72; s++) {
    const th = (s / 72) * Math.PI * 2;
    pts.push(new THREE.Vector3(r.x + (r.rx + offset) * Math.cos(th), r.y, r.z + (r.rz + offset) * Math.sin(th)));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
}
