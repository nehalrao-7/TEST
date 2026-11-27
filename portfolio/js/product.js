// =========================================================
// "Lumen" — a lamp + speaker concept, built procedurally.
// One scroll value (0..1) walks it through four states:
//   sketch → blueprint (dimensions) → exploded (labels) → solid
// =========================================================
import * as THREE from "three";

const INK = new THREE.Color("#ecebe6");
const ACCENT = new THREE.Color("#ff5a1f");

function matcap(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(96, 84, 8, 128, 128, 140);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const MAT = {
  alu: matcap([[0, "#ffffff"], [0.3, "#c9c8c2"], [0.75, "#4a4a4d"], [1, "#0b0b0c"]]),
  dark: matcap([[0, "#8a8a8e"], [0.3, "#3a3a3e"], [0.8, "#151517"], [1, "#050505"]]),
  orange: matcap([[0, "#ffd2bd"], [0.3, "#ff6a30"], [0.8, "#8a2a06"], [1, "#2a0a02"]]),
  frost: matcap([[0, "#ffffff"], [0.4, "#ece9e2"], [0.85, "#9a978f"], [1, "#4a4844"]]),
  pcb: matcap([[0, "#9fb59f"], [0.35, "#2f4a35"], [0.85, "#0e1a11"], [1, "#030503"]]),
};

const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function initProduct(canvas, { reduced = false, labelsEl, dimsEl } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.set(7.2, 4.6, 8.4);
  camera.lookAt(0, 0.1, 0);

  const root = new THREE.Group();
  scene.add(root);

  // ---------- part builders ----------
  const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  function cyl(rt, rb, h, seg = 64, open = false) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); }
  function ring(R, r, seg = 96) { const g = new THREE.TorusGeometry(R, r, 10, seg); g.rotateX(Math.PI / 2); return g; }
  function at(g, x, y, z) { g.translate(x, y, z); return g; }

  const parts = [
    { key: "diffuser", name: "Diffuser", spec: "Frosted PC, 1.2 mm — no hotspots", mat: MAT.frost, y: 0.5, ey: 3.15, r: 1.25,
      geos: () => { const g = new THREE.SphereGeometry(1.26, 64, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.42, 1); return [g]; } },
    { key: "bezel", name: "Touch bezel", spec: "Turn for volume, tap for light", mat: MAT.orange, y: 0.48, ey: 2.4, r: 1.38, accent: true,
      geos: () => [ring(1.3, 0.085)] },
    { key: "led", name: "LED ring", spec: "24 × 2700 K — warm on purpose", mat: MAT.frost, y: 0.42, ey: 1.75, r: 1.05,
      geos: () => { const g = [ring(1.0, 0.04, 64)]; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.push(at(new THREE.BoxGeometry(0.09, 0.05, 0.09), Math.cos(a) * 1.0, 0.04, Math.sin(a) * 1.0)); } return g; } },
    { key: "pcb", name: "Main board", spec: "One 4-layer board instead of three", mat: MAT.pcb, y: 0.32, ey: 1.12, r: 1.1,
      geos: () => [cyl(1.08, 1.08, 0.05), at(new THREE.BoxGeometry(0.34, 0.07, 0.34), 0.25, 0.05, -0.1), at(new THREE.BoxGeometry(0.18, 0.06, 0.42), -0.45, 0.05, 0.25), at(new THREE.BoxGeometry(0.22, 0.06, 0.16), -0.2, 0.05, -0.55), at(cyl(0.08, 0.08, 0.14, 16), 0.6, 0.08, 0.35)] },
    { key: "driver", name: "Driver", spec: "40 mm full-range, sealed rear volume", mat: MAT.dark, y: 0.05, ey: 0.3, r: 0.9,
      geos: () => [cyl(0.86, 0.3, 0.32, 48, true), at(ring(0.86, 0.035, 64), 0, 0.16, 0), at(cyl(0.32, 0.32, 0.18, 32), 0, -0.24, 0)] },
    { key: "battery", name: "Battery", spec: "3,400 mAh — about 18 hours", mat: MAT.dark, y: -0.3, ey: -0.6, r: 0.78,
      geos: () => [cyl(0.76, 0.76, 0.28, 48)] },
    { key: "chassis", name: "Chassis", spec: "One CNC aluminium core: structure + heatsink", mat: MAT.alu, y: 0.0, ey: -1.55, r: 1.36,
      geos: () => { const pts = [[1.24, -0.5], [1.32, -0.46], [1.34, -0.3], [1.33, 0.44], [1.26, 0.46], [1.26, -0.4], [1.2, -0.46]].map(([x, y]) => new THREE.Vector2(x, y)); return [new THREE.LatheGeometry(pts, 96)]; } },
    { key: "foot", name: "Foot", spec: "Silicone — won't walk at full volume", mat: MAT.dark, y: -0.55, ey: -2.45, r: 1.1,
      geos: () => [cyl(1.08, 1.02, 0.08)] },
    { key: "screws", name: "3 screws", spec: "Down from 14. Fewer screws, fewer failures.", mat: MAT.alu, y: -0.4, ey: -3.25, r: 0.95,
      geos: () => { const g = []; for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; g.push(at(cyl(0.035, 0.035, 0.32, 10), Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9), at(cyl(0.08, 0.08, 0.05, 16), Math.cos(a) * 0.9, -0.17, Math.sin(a) * 0.9)); } return g; } },
  ];

  const solidMats = [], edgeMats = [], sketchMats = [];
  for (const p of parts) {
    const grp = new THREE.Group();
    const geos = p.geos();
    const sketchPos = [];
    for (const g of geos) {
      const m = new THREE.MeshMatcapMaterial({ matcap: p.mat, transparent: true, opacity: 0, depthWrite: false });
      solidMats.push(m);
      grp.add(new THREE.Mesh(g, m));

      const eg = new THREE.EdgesGeometry(g, 24);
      const em = new THREE.LineBasicMaterial({ color: p.accent ? ACCENT : INK, transparent: true, opacity: 0, depthWrite: false });
      edgeMats.push(em);
      grp.add(new THREE.LineSegments(eg, em));

      // sketch: two wobbly passes with overshoot
      const a = eg.attributes.position.array;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < a.length; i += 6) {
          const ax = a[i], ay = a[i + 1], az = a[i + 2], bx = a[i + 3], by = a[i + 4], bz = a[i + 5];
          const len = Math.hypot(bx - ax, by - ay, bz - az);
          if (pass === 1 && len < 0.12 && rand() < 0.6) continue; // lighter second pass on fine curves
          const ext = len > 0.25 ? 0.12 + rand() * 0.3 : 0.05 + rand() * 0.12, j = () => (rand() - 0.5) * 0.022;
          const dx = bx - ax, dy = by - ay, dz = bz - az;
          sketchPos.push(ax - dx * ext + j(), ay - dy * ext + j(), az - dz * ext + j(), bx + dx * ext + j(), by + dy * ext + j(), bz + dz * ext + j());
        }
      }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sketchPos, 3));
    const smat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0, depthWrite: false });
    sketchMats.push(smat);
    grp.add(new THREE.LineSegments(sg, smat));

    grp.position.y = p.y;
    p.group = grp;
    root.add(grp);
  }

  // construction axis (sketch + blueprint)
  const axisMat = new THREE.LineDashedMaterial({ color: ACCENT, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0 });
  const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -3.6, 0), new THREE.Vector3(0, 3.8, 0)]), axisMat);
  axis.computeLineDistances();
  root.add(axis);

  // ---------- labels (HTML) ----------
  const labelEls = parts.map((p, i) => {
    const el = document.createElement("div");
    el.className = "plabel" + (i % 2 ? " plabel--l" : "");
    el.innerHTML = `<span class="plabel__name">${p.name}</span><span class="plabel__spec">${p.spec}</span>`;
    labelsEl?.appendChild(el);
    return el;
  });

  // ---------- sizing / visibility ----------
  let W = 1, H = 1;
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // keep the whole exploded stack in frame on tall/narrow stages
    camera.zoom = Math.min(1, camera.aspect / 0.95);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { rootMargin: "100px" }).observe(canvas);

  // ---------- state ----------
  let target = 0, prog = 0;
  const pointer = { x: 0, y: 0 };
  canvas.parentElement.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });

  const v = new THREE.Vector3(), right = new THREE.Vector3();
  const clock = new THREE.Clock();
  let spin = 0.6, raf = 0;

  function project(x, y, z) {
    v.set(x, y, z).applyMatrix4(root.matrixWorld).project(camera);
    return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
  }

  function loop() {
    cancelAnimationFrame(raf);
    if (!visible) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    prog += (target - prog) * (1 - Math.pow(0.002, dt));
    const p = prog;

    const sketch = 1 - sm(0.2, 0.32, p);
    const blue = sm(0.2, 0.32, p);
    const explode = sm(0.44, 0.6, p) * (1 - sm(0.74, 0.86, p));
    const solid = sm(0.76, 0.9, p);

    sketchMats.forEach((m) => (m.opacity = 0.55 * sketch));
    edgeMats.forEach((m) => (m.opacity = blue * (1 - 0.82 * solid)));
    solidMats.forEach((m) => { m.opacity = solid; m.depthWrite = solid > 0.6; });
    axisMat.opacity = Math.max(sketch * 0.6, blue * (1 - solid) * 0.8);

    parts.forEach((pt) => { pt.group.position.y = pt.y + (pt.ey - pt.y) * explode; });
    root.scale.setScalar(1 - 0.26 * explode);
    root.position.y = 0.15 * explode;

    if (!reduced) spin += dt * (0.18 + 0.25 * solid);
    root.rotation.y = spin + pointer.x * 0.35;
    root.rotation.x = pointer.y * 0.08;
    root.updateMatrixWorld();

    // labels follow parts while exploded
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    const showLabels = explode > 0.55;
    parts.forEach((pt, i) => {
      const el = labelEls[i];
      el.classList.toggle("is-on", showLabels);
      if (!showLabels) return;
      const side = i % 2 ? -1 : 1;
      v.set(0, pt.group.position.y, 0).applyMatrix4(root.matrixWorld);
      v.addScaledVector(right, side * pt.r * root.scale.x);
      v.project(camera);
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });

    // dimensions while in blueprint
    if (dimsEl) {
      const dimA = blue * (1 - explode) * (1 - solid);
      dimsEl.style.opacity = dimA.toFixed(3);
      if (dimA > 0.01) {
        const [tx, ty] = project(0, 1.05, 0);
        const [bx, by] = project(0, -0.6, 0);
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        const off = right.clone().multiplyScalar(1.9);
        const [rx1, ry1] = (() => { v.set(off.x, 1.05, off.z).applyMatrix4(root.matrixWorld).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; })();
        const [rx2, ry2] = (() => { v.set(off.x, -0.6, off.z).applyMatrix4(root.matrixWorld).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; })();
        const L = right.clone().multiplyScalar(-1.36), R = right.clone().multiplyScalar(1.36);
        const [lx, ly] = (() => { v.set(L.x, -0.9, L.z).applyMatrix4(root.matrixWorld).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; })();
        const [qx, qy] = (() => { v.set(R.x, -0.9, R.z).applyMatrix4(root.matrixWorld).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; })();
        dimsEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
        dimsEl.innerHTML =
          `<path class="d-line" d="M${rx1} ${ry1} L${rx2} ${ry2} M${rx1 - 7} ${ry1} H${rx1 + 7} M${rx2 - 7} ${ry2} H${rx2 + 7}"/>` +
          `<path class="d-ext" d="M${tx} ${ty} L${rx1} ${ry1} M${bx} ${by} L${rx2} ${ry2}"/>` +
          `<text x="${rx1 + 12}" y="${(ry1 + ry2) / 2}">H 64.0</text>` +
          `<path class="d-line" d="M${lx} ${ly} L${qx} ${qy} M${lx} ${ly - 7} V${ly + 7} M${qx} ${qy - 7} V${qy + 7}"/>` +
          `<text x="${(lx + qx) / 2 - 22}" y="${(ly + qy) / 2 + 22}">Ø 108.0</text>` +
          `<text class="d-note" x="${rx1 + 12}" y="${ry1 - 10}">±0.05</text>`;
      }
    }

    renderer.render(scene, camera);
  }

  return {
    setProgress(p) { target = p; if (reduced) prog = p; },
    get info() { return renderer.info.render; },
  };
}
