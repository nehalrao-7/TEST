// =========================================================
// Nehal's World — a seeded, procedural archipelago.
// Islands are grown from a seed; landmarks are assembled
// from primitives; nothing is imported.
// =========================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const C = {
  bg: 0x0a0a0b, ink: 0xecebe6, accent: 0xff5a1f,
  top: 0x2c2c30, rock: 0x151517, bone: 0xe6e3dc, dark: 0x101012, metal: 0x9a9993,
};

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

export function createWorld(canvas, { places, notes, labelsEl, onSelect, onNote, onHover, reduced = false }) {
  const isSmall = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  const PR = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.bg, 45, 150);
  const camera = new THREE.PerspectiveCamera(isSmall ? 50 : 38, innerWidth / innerHeight, 0.1, 700);
  camera.position.set(0, isSmall ? 60 : 38, isSmall ? 120 : 82);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.47; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.7;
  controls.autoRotate = !reduced; controls.autoRotateSpeed = 0.35;

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xe8e6df, 0x0a0a0b, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(25, 40, 18); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff8a5c, 0.6); rim.position.set(-30, 10, -25); scene.add(rim);

  // ---------- materials (registry so the whole world can change style) ----------
  const solids = [], edgeMats = [];
  const std = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, transparent: true, ...o }); solids.push(m); return m; };
  const M = {
    top: std(C.top), rock: std(C.rock, { roughness: 1 }), bone: std(C.bone, { roughness: 0.55 }),
    dark: std(C.dark, { roughness: 0.4, metalness: 0.3 }), metal: std(C.metal, { roughness: 0.35, metalness: 0.4 }),
    accent: std(C.accent, { emissive: C.accent, emissiveIntensity: 0.55, roughness: 0.5 }),
    glow: std(C.accent, { emissive: C.accent, emissiveIntensity: 1.6 }),
  };
  const terrainEdge = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.16 });
  const landEdge = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0 });
  edgeMats.push(terrainEdge, landEdge);

  // ---------- blueprint floor + stars ----------
  const grid = new THREE.GridHelper(400, 100, C.accent, C.ink);
  grid.position.y = -16;
  grid.material.transparent = true; grid.material.opacity = 0.05;
  scene.add(grid);

  const starGeo = new THREE.BufferGeometry();
  const SN = 2600, sp = new Float32Array(SN * 3), sc = new Float32Array(SN * 3);
  const srng = mulberry32(42), ink = new THREE.Color(C.ink), acc = new THREE.Color(C.accent);
  for (let i = 0; i < SN; i++) {
    const r = 120 + srng() * 160, th = srng() * Math.PI * 2, ph = Math.acos(srng() * 1.6 - 0.6);
    sp.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    const c = srng() > 0.9 ? acc : ink; sc.set([c.r, c.g, c.b], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 0.8, fog: false, sizeAttenuation: true }));
  scene.add(stars);

  // ---------- helpers ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
  function addEdges(group, mat = landEdge) {
    const list = [];
    group.traverse((o) => { if (o.isMesh && !o.userData.noEdge) list.push(o); });
    list.forEach((o) => o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), mat)));
  }

  // ---------- terrain (seeded) ----------
  function growTerrain(place, seed) {
    const rng = mulberry32(seed ^ hash(place.key));
    const g = new THREE.Group();
    const R = place.r, seg = 7 + Math.floor(rng() * 5);
    const a = 1 + rng() * 2, b = rng() * 6, c = 1 + rng() * 2, d = rng() * 6;
    const n = (x, z) => Math.sin(x * a + b) * Math.cos(z * c + d);

    const top = new THREE.CylinderGeometry(R, R * 0.95, 0.7, seg, 1);
    const tp = top.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i), k = 1 + n(x, z) * 0.06;
      tp.setXYZ(i, x * k, tp.getY(i), z * k);
    }
    top.computeVertexNormals();
    const topMesh = mesh(top, M.top);
    topMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(top, 20), terrainEdge));
    g.add(topMesh);

    const depth = R * (1.1 + rng() * 0.9);
    const cone = new THREE.ConeGeometry(R * 0.95, depth, seg, 4);
    cone.rotateX(Math.PI);
    cone.translate(0, -depth / 2 - 0.35, 0);
    const cp = cone.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
      if (y > -0.4) continue;
      const k = 1 + n(x * 1.7, z * 1.7 + y) * 0.22;
      cp.setXYZ(i, x * k + n(y, x) * 0.15, y + n(x, z) * 0.2, z * k);
    }
    cone.computeVertexNormals();
    const rock = mesh(cone, M.rock);
    rock.add(new THREE.LineSegments(new THREE.EdgesGeometry(cone, 30), terrainEdge));
    g.add(rock);

    // scatter
    const count = Math.round(R * R * (0.7 + rng() * 0.6));
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2, rad = R * (0.55 + rng() * 0.38);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, t = rng();
      let o;
      if (t < 0.45) { const s = 0.12 + rng() * 0.22; o = mesh(new THREE.DodecahedronGeometry(s, 0), M.rock, x, 0.35 + s * 0.5, z); }
      else if (t < 0.8) { const h = 0.4 + rng() * 0.9; o = mesh(new THREE.ConeGeometry(0.14 + rng() * 0.1, h, 5), M.bone, x, 0.35 + h / 2, z); }
      else if (t < 0.95) { const h = 0.3 + rng() * 0.5; o = mesh(new THREE.BoxGeometry(0.12, h, 0.12), M.metal, x, 0.35 + h / 2, z); }
      else { o = mesh(new THREE.OctahedronGeometry(0.16, 0), M.accent, x, 0.55, z); }
      o.rotation.y = rng() * Math.PI;
      g.add(o);
    }
    // hanging crystals under the rock
    for (let i = 0; i < 3; i++) {
      const s = 0.2 + rng() * 0.3;
      const o = mesh(new THREE.OctahedronGeometry(s, 0), rng() > 0.6 ? M.accent : M.rock, (rng() - 0.5) * R, -depth * (0.4 + rng() * 0.4), (rng() - 0.5) * R);
      o.scale.y = 1.8; g.add(o);
    }
    return g;
  }

  // ---------- landmarks (each returns { group, tick }) ----------
  const L = {
    origin() {
      const g = new THREE.Group();
      const core = mesh(new THREE.IcosahedronGeometry(1.1, 2), M.glow, 0, 2.6, 0);
      core.userData.noEdge = true;
      g.add(core);
      const light = new THREE.PointLight(C.accent, 30, 18, 2); light.position.y = 2.6; g.add(light);
      const rings = [];
      [[1.9, 0.025, 0.5], [2.5, 0.018, -0.35], [3.1, 0.012, 0.9]].forEach(([r, t, tilt]) => {
        const ring = mesh(new THREE.TorusGeometry(r, t, 6, 120), M.bone, 0, 2.6, 0);
        ring.rotation.x = Math.PI / 2 + tilt; ring.userData.noEdge = true; rings.push(ring); g.add(ring);
      });
      const orbit = new THREE.Group(); orbit.position.y = 2.6; g.add(orbit);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const d = mesh(new THREE.SphereGeometry(i === 6 ? 0.2 : 0.13, 12, 8), i === 6 ? M.accent : M.bone, Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5);
        d.userData.noEdge = true; orbit.add(d);
      }
      orbit.rotation.x = Math.PI / 2 - 0.35 - Math.PI / 2;
      g.add(mesh(new THREE.CylinderGeometry(0.5, 0.8, 1.2, 8), M.dark, 0, 0.95, 0));
      return { group: g, tick: (t) => {
        core.rotation.y = t * 0.3; core.scale.setScalar(1 + Math.sin(t * 2) * 0.04);
        rings.forEach((r, i) => (r.rotation.z = t * (0.15 + i * 0.08) * (i % 2 ? -1 : 1)));
        orbit.rotation.y = t * 0.25;
      } };
    },
    workshop() {
      const g = new THREE.Group();
      const puck = new THREE.Group();
      puck.add(mesh(new THREE.CylinderGeometry(1, 1.02, 0.75, 40), M.metal, 0, 0, 0));
      const dome = new THREE.SphereGeometry(0.98, 40, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.45, 1);
      puck.add(mesh(dome, M.bone, 0, 0.42, 0));
      const bez = mesh(new THREE.TorusGeometry(1.02, 0.07, 8, 60), M.accent, 0, 0.4, 0); bez.rotation.x = Math.PI / 2; puck.add(bez);
      puck.position.set(-0.6, 1.0, 0.6); g.add(puck);
      const gear = new THREE.Group();
      gear.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.28, 24), M.dark));
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const tth = mesh(new THREE.BoxGeometry(0.32, 0.28, 0.34), M.dark, Math.cos(a) * 1.38, 0, Math.sin(a) * 1.38); tth.rotation.y = -a; gear.add(tth); }
      gear.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12), M.accent));
      gear.rotation.x = Math.PI / 2; gear.position.set(1.1, 1.95, -1.2); g.add(gear);
      g.add(mesh(new THREE.BoxGeometry(2.6, 0.12, 1.1), M.bone, 0.9, 0.9, 1.0));
      [[-0.3, 0.55], [2.1, 0.55], [-0.3, 1.45], [2.1, 1.45]].forEach(([x, z]) => g.add(mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), M.metal, x, 0.62, z)));
      return { group: g, tick: (t) => { gear.rotation.y = t * 0.6; puck.rotation.y = t * 0.4; puck.position.y = 1.0 + Math.sin(t * 1.4) * 0.12; } };
    },
    line() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(5.2, 0.22, 1.1), M.dark, 0, 1.0, 0));
      for (let x = -2.4; x <= 2.41; x += 0.6) { const r = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.15, 8), M.metal, x, 1.1, 0); r.rotation.x = Math.PI / 2; g.add(r); }
      [[-2.3, -0.4], [2.3, -0.4], [-2.3, 0.4], [2.3, 0.4]].forEach(([x, z]) => g.add(mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), M.metal, x, 0.6, z)));
      const hopper = mesh(new THREE.CylinderGeometry(0.75, 0.25, 0.9, 8, 1, true), M.bone, -2.4, 2.0, 0); hopper.material = M.bone; g.add(hopper);
      const boxes = [];
      for (let i = 0; i < 6; i++) { const b = mesh(new THREE.BoxGeometry(0.46, 0.36, 0.6), i === 2 ? M.accent : M.bone, 0, 1.3, 0); boxes.push(b); g.add(b); }
      const arm = new THREE.Group();
      arm.add(mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), M.accent, 0, 0.8, 0));
      const fore = mesh(new THREE.BoxGeometry(1.1, 0.14, 0.14), M.metal, 0.5, 1.6, 0); arm.add(fore);
      arm.position.set(1.2, 0.35, -1.1); g.add(arm);
      return { group: g, tick: (t) => {
        boxes.forEach((b, i) => { const u = ((t * 0.18 + i / boxes.length) % 1); b.position.x = -2.3 + u * 4.6; b.position.y = 1.3 + (u < 0.05 ? (0.05 - u) * 8 : 0); });
        arm.rotation.y = Math.sin(t * 1.2) * 0.9;
      } };
    },
    arena() {
      const g = new THREE.Group();
      [[0, -1.9, 4, 0.12], [0, 1.9, 4, 0.12], [-1.9, 0, 0.12, 4], [1.9, 0, 0.12, 4]].forEach(([x, z, w, d]) => g.add(mesh(new THREE.BoxGeometry(w, 0.3, d), M.bone, x, 0.5, z)));
      const bot = new THREE.Group();
      bot.add(mesh(new THREE.BoxGeometry(0.8, 0.32, 0.95), M.dark, 0, 0.32, 0));
      [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.32], [0.45, 0.32]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), M.metal, x, 0.2, z); w.rotation.z = Math.PI / 2; bot.add(w); });
      const arm = mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), M.accent, 0, 0.55, 0.35); bot.add(arm);
      bot.position.y = 0.35; g.add(bot);
      const trophy = new THREE.Group();
      trophy.add(mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.25, 8), M.dark, 0, 0.12, 0));
      trophy.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), M.metal, 0, 0.45, 0));
      trophy.add(mesh(new THREE.CylinderGeometry(0.35, 0.12, 0.45, 12), M.accent, 0, 0.85, 0));
      trophy.position.set(1.2, 0.35, -1.2); g.add(trophy);
      return { group: g, tick: (t) => {
        const a = t * 0.6; bot.position.x = Math.cos(a) * 1.0; bot.position.z = Math.sin(a) * 1.0; bot.rotation.y = -a;
        arm.rotation.x = Math.sin(t * 3) * 0.35; trophy.rotation.y = t * 0.8;
      } };
    },
    hack() {
      const g = new THREE.Group();
      const leds = [];
      for (let s = 0; s < 3; s++) {
        g.add(mesh(new THREE.BoxGeometry(1.1, 0.55, 0.8), M.dark, -0.7, 0.65 + s * 0.6, -0.3));
        for (let k = 0; k < 4; k++) { const l = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), M.glow, -1.1 + k * 0.18, 0.65 + s * 0.6, 0.11); l.userData.noEdge = true; leds.push(l); g.add(l); }
      }
      const band = mesh(new THREE.TorusGeometry(0.75, 0.14, 10, 40), M.bone, 1.0, 2.3, 0.2);
      const module = mesh(new THREE.BoxGeometry(0.45, 0.18, 0.32), M.accent, 0, 0.75, 0); band.add(module);
      g.add(band);
      const laptop = new THREE.Group();
      laptop.add(mesh(new THREE.BoxGeometry(1, 0.05, 0.7), M.metal, 0, 0, 0));
      const screen = mesh(new THREE.BoxGeometry(1, 0.65, 0.04), M.metal, 0, 0.32, -0.34); screen.rotation.x = -0.25; laptop.add(screen);
      laptop.position.set(0.9, 0.4, 1.1); laptop.rotation.y = -0.5; g.add(laptop);
      return { group: g, tick: (t) => {
        band.rotation.y = t * 0.8; band.rotation.x = 0.5 + Math.sin(t) * 0.2; band.position.y = 2.3 + Math.sin(t * 1.3) * 0.15;
        leds.forEach((l, i) => (l.visible = Math.sin(t * 6 + i * 2.3) > -0.2));
      } };
    },
    studio() {
      const g = new THREE.Group();
      const ico = mesh(new THREE.IcosahedronGeometry(1.35, 1), new THREE.MeshBasicMaterial({ color: C.accent, wireframe: true, transparent: true, opacity: 0.9 }), 0, 2.4, 0);
      ico.userData.noEdge = true; g.add(ico);
      const pg = new THREE.BufferGeometry(); const pr = mulberry32(7); const pts = [];
      for (let i = 0; i < 420; i++) { const u = pr() * 2 - 1, th = pr() * Math.PI * 2, r = 0.85; const s = Math.sqrt(1 - u * u); pts.push(Math.cos(th) * s * r, u * r, Math.sin(th) * s * r); }
      pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const cloud = new THREE.Points(pg, new THREE.PointsMaterial({ color: C.ink, size: 0.06, transparent: true }));
      cloud.position.y = 2.4; g.add(cloud);
      [-1.6, 0, 1.6].forEach((x, i) => {
        const f = new THREE.Group();
        f.add(mesh(new THREE.BoxGeometry(0.9, 0.62, 0.05), i === 1 ? M.accent : M.dark));
        f.add(mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), M.metal, 0, -0.55, 0));
        f.position.set(x, 1.0, 1.5); f.rotation.y = -x * 0.25; g.add(f);
      });
      return { group: g, tick: (t) => { ico.rotation.y = t * 0.3; ico.rotation.x = t * 0.17; cloud.rotation.y = -t * 0.5; const s = 1 + Math.sin(t * 1.7) * 0.08; cloud.scale.setScalar(s); } };
    },
    observatory() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.9, 16), M.bone, 0, 0.8, 0));
      const head = new THREE.Group(); head.position.y = 1.25;
      head.add(mesh(new THREE.SphereGeometry(1.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.bone));
      const scope = mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 12), M.dark, 0, 1.2, 0.5); scope.rotation.x = -0.7; head.add(scope);
      head.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 16), M.accent, 0, 1.95, 1.3));
      g.add(head);
      return { group: g, tick: (t) => { head.rotation.y = Math.sin(t * 0.2) * 1.4; } };
    },
    lighthouse() {
      const g = new THREE.Group();
      [[0.75, 0.62, M.bone], [0.62, 0.5, M.accent], [0.5, 0.4, M.bone]].forEach(([rb, rt, m], i) => g.add(mesh(new THREE.CylinderGeometry(rt, rb, 1.2, 12), m, 0, 0.95 + i * 1.2, 0)));
      const lamp = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 12), M.glow, 0, 4.15, 0); lamp.userData.noEdge = true; g.add(lamp);
      g.add(mesh(new THREE.ConeGeometry(0.55, 0.5, 12), M.dark, 0, 4.65, 0));
      const beam = new THREE.Group(); beam.position.y = 4.15;
      const cone = new THREE.ConeGeometry(1.6, 12, 24, 1, true); cone.translate(0, -6, 0); cone.rotateZ(Math.PI / 2);
      const bm = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      bm.userData.noEdge = true; beam.add(bm); g.add(beam);
      const light = new THREE.PointLight(C.accent, 12, 10, 2); light.position.y = 4.2; g.add(light);
      return { group: g, tick: (t) => { beam.rotation.y = t * 0.8; } };
    },
  };

  // ---------- islands ----------
  const islands = {};
  const pickables = [];
  let seed = 1997;
  for (const p of places) {
    const root = new THREE.Group();
    root.position.set(...p.pos);
    const terrain = growTerrain(p, seed);
    root.add(terrain);
    const lm = L[p.key]();
    lm.group.position.y = 0.35;
    addEdges(lm.group);
    root.add(lm.group);
    const halo = mesh(new THREE.TorusGeometry(p.r + 0.35, 0.04, 6, 90), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0 }), 0, 0.38, 0);
    halo.rotation.x = Math.PI / 2; root.add(halo);
    // generous invisible hit volume
    const hit = mesh(new THREE.CylinderGeometry(p.r + 0.4, p.r * 0.5, 6, 12), new THREE.MeshBasicMaterial({ visible: false }), 0, 0.6, 0);
    hit.userData.place = p.key; root.add(hit); pickables.push(hit);
    scene.add(root);
    const label = document.createElement("button");
    label.className = "wlabel"; label.type = "button";
    label.innerHTML = `<span class="wlabel__dot"></span><span class="wlabel__txt"><span class="wlabel__name">${p.name}</span><span class="wlabel__kick">${p.kicker}</span></span>`;
    label.addEventListener("click", () => onSelect?.(p.key));
    label.addEventListener("pointerenter", () => setHover(p.key));
    label.addEventListener("pointerleave", () => setHover(null));
    labelsEl.appendChild(label);
    islands[p.key] = { p, root, terrain, lm, halo, label, phase: Math.random() * 6, lift: 0, liftTo: 0, base: V(...p.pos) };
  }

  // ---------- paths ----------
  const pathDefs = [];
  places.forEach((p) => { if (p.key !== "origin") pathDefs.push(["origin", p.key]); });
  [["workshop", "line"], ["workshop", "arena"], ["arena", "hack"], ["hack", "studio"], ["studio", "observatory"], ["observatory", "workshop"], ["lighthouse", "workshop"]].forEach((d) => pathDefs.push(d));
  const paths = pathDefs.map(([a, b]) => {
    const A = islands[a].base.clone().add(V(0, 0.5, 0)), B = islands[b].base.clone().add(V(0, 0.5, 0));
    const mid = A.clone().lerp(B, 0.5).add(V(0, 2.5 + A.distanceTo(B) * 0.08, 0));
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
    const mat = new THREE.LineDashedMaterial({ color: C.ink, dashSize: 0.35, gapSize: 0.3, transparent: true, opacity: 0.22 });
    const line = new THREE.Line(geo, mat); line.computeLineDistances(); scene.add(line);
    const pulse = mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.9 }));
    scene.add(pulse);
    return { a, b, curve, mat, pulse, speed: 0.06 + Math.random() * 0.05, off: Math.random(), on: false };
  });

  // ---------- field notes ----------
  const noteObjs = notes.map((_, i) => {
    const pairs = [["origin", "workshop"], ["line", "arena"], ["hack", "arena"], ["studio", "observatory"], ["lighthouse", "observatory"], ["origin", "studio"]];
    const [a, b] = pairs[i % pairs.length];
    const pos = islands[a].base.clone().lerp(islands[b].base, 0.5).add(V((i % 2 ? 1.5 : -1.5), 5.5 + (i % 3), (i % 2 ? -1 : 1)));
    const g = new THREE.Group(); g.position.copy(pos);
    const paper = mesh(new THREE.PlaneGeometry(0.9, 1.15), new THREE.MeshBasicMaterial({ color: C.bone, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    paper.userData.note = i; g.add(paper); pickables.push(paper);
    for (let k = 0; k < 3; k++) g.add(mesh(new THREE.PlaneGeometry(0.6 - k * 0.12, 0.035), new THREE.MeshBasicMaterial({ color: 0x777570, side: THREE.DoubleSide }), -0.05, 0.25 - k * 0.16, 0.005));
    const pin = mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshBasicMaterial({ color: C.accent, side: THREE.DoubleSide }), 0, 0.46, 0.01); g.add(pin);
    const glow = mesh(new THREE.RingGeometry(0.75, 0.8, 40), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    g.add(glow);
    scene.add(g);
    return { g, paper, glow, phase: i * 1.3, found: false };
  });

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let hovered = null, hoveredNote = null, downAt = null;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData : null;
  }
  function setHover(key) {
    if (hovered === key) return;
    if (hovered) { islands[hovered].liftTo = 0; islands[hovered].label.classList.remove("is-hover"); }
    hovered = key;
    if (key) { islands[key].liftTo = 0.5; islands[key].label.classList.add("is-hover"); }
    onHover?.(key ? "place" : hoveredNote !== null ? "note" : null);
  }
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const d = pick(e);
    hoveredNote = d && d.note !== undefined ? d.note : null;
    setHover(d && d.place ? d.place : null);
    if (hoveredNote !== null) onHover?.("note");
  });
  canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const d = pick(e);
    if (!d) return;
    if (d.place) onSelect?.(d.place);
    else if (d.note !== undefined) onNote?.(d.note);
  });

  // ---------- camera flight ----------
  let flying = null;
  function flyTo(posTo, targetTo, dur = 1.8) {
    flying?.kill();
    controls.enabled = false; controls.autoRotate = false;
    const p0 = camera.position.clone(), t0 = controls.target.clone(), s = { t: 0 };
    // arc the flight upward so it feels like travel, not a zoom
    const lift = Math.min(18, p0.distanceTo(posTo) * 0.25);
    flying = window.gsap.to(s, {
      t: 1, duration: reduced ? 0.01 : dur, ease: "power3.inOut",
      onUpdate: () => {
        camera.position.lerpVectors(p0, posTo, s.t); camera.position.y += Math.sin(s.t * Math.PI) * lift;
        controls.target.lerpVectors(t0, targetTo, s.t);
      },
      onComplete: () => { controls.enabled = true; flying = null; },
    });
  }
  function viewFor(key) {
    const isl = islands[key];
    const target = isl.base.clone().add(V(0, 1.4, 0));
    const out = key === "origin" ? V(0.35, 0, 1) : V(isl.base.x, 0, isl.base.z).normalize();
    const side = V(-out.z, 0, out.x).multiplyScalar(0.35);
    const dir = out.add(side).add(V(0, 0.62, 0)).normalize();
    const dist = isl.p.r * 3.1 + (isSmall ? 17 : 9);
    return [target.clone().addScaledVector(dir, dist), target];
  }

  // panel offset: keep the island centred in the space left by the panel
  const offset = { x: 0, y: 0 };
  let offTween = null;
  function applyOffset() {
    if (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(innerWidth, innerHeight, offset.x, offset.y, innerWidth, innerHeight);
  }

  // ---------- lens / route ----------
  let routeKeys = null;
  function setRoute(keys) {
    routeKeys = keys;
    const onPairs = new Set();
    if (keys) for (let i = 0; i < keys.length - 1; i++) { onPairs.add(keys[i] + ">" + keys[i + 1]); onPairs.add(keys[i + 1] + ">" + keys[i]); }
    paths.forEach((p) => {
      p.on = onPairs.has(p.a + ">" + p.b);
      p.mat.color.set(p.on ? C.accent : C.ink);
      p.mat.opacity = keys ? (p.on ? 0.95 : 0.08) : 0.22;
    });
    Object.values(islands).forEach((isl) => {
      const inRoute = !keys || keys.includes(isl.p.key);
      isl.label.classList.toggle("is-dim", !inRoute);
      isl.label.classList.toggle("is-route", !!keys && inRoute);
      const idx = keys ? keys.indexOf(isl.p.key) : -1;
      isl.label.dataset.step = idx >= 0 ? idx + 1 : "";
    });
  }

  // ---------- style + regrow ----------
  let style = "solid";
  function setStyle(s) {
    style = s;
    const bp = s === "blueprint";
    solids.forEach((m) => { m.opacity = bp ? 0.05 : 1; m.depthWrite = !bp; });
    terrainEdge.opacity = bp ? 0.75 : 0.16;
    terrainEdge.color.set(bp ? C.accent : C.ink);
    landEdge.opacity = bp ? 0.9 : 0;
    grid.material.opacity = bp ? 0.14 : 0.05;
  }
  function regrow(newSeed) {
    seed = newSeed;
    Object.values(islands).forEach((isl, i) => {
      isl.root.remove(isl.terrain);
      isl.terrain.traverse((o) => { o.geometry?.dispose(); });
      isl.terrain = growTerrain(isl.p, seed);
      isl.root.add(isl.terrain);
      window.gsap?.fromTo(isl.terrain.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 1.4, delay: i * 0.06, ease: "elastic.out(1, 0.6)" });
    });
    return seed;
  }

  // ---------- resize / loop ----------
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyOffset();
  });

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  let frames = 0, running = true;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) { clock.getDelta(); loop(); } });

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const tt = reduced ? 0 : t;
    Object.values(islands).forEach((isl) => {
      isl.lift += (isl.liftTo - isl.lift) * Math.min(1, dt * 6);
      isl.root.position.y = isl.base.y + (reduced ? 0 : Math.sin(t * 0.5 + isl.phase) * 0.25) + isl.lift;
      isl.lm.tick(tt);
      const routeGlow = routeKeys && routeKeys.includes(isl.p.key) ? 0.35 + Math.sin(t * 2.5) * 0.25 : 0;
      isl.halo.material.opacity += ((isl.p.key === hovered ? 0.95 : routeGlow) - isl.halo.material.opacity) * Math.min(1, dt * 8);
    });
    paths.forEach((p) => {
      const u = (p.off + t * p.speed * (p.on ? 2.2 : 1)) % 1;
      p.pulse.position.copy(p.curve.getPointAt(u));
      p.pulse.material.opacity = routeKeys ? (p.on ? 1 : 0.1) : 0.75;
      p.pulse.scale.setScalar(p.on ? 1.6 : 1);
    });
    noteObjs.forEach((n) => {
      n.g.position.y += Math.sin(t * 0.9 + n.phase) * 0.004;
      n.g.rotation.y = t * 0.4 + n.phase;
      n.g.rotation.z = Math.sin(t * 0.7 + n.phase) * 0.15;
      n.glow.material.opacity = n.found ? 0 : 0.25 + Math.sin(t * 3 + n.phase) * 0.2;
    });
    stars.rotation.y = t * 0.004;
    controls.update();

    // labels
    const W = innerWidth, H = innerHeight;
    Object.values(islands).forEach((isl) => {
      tmp.copy(isl.root.position).add(V(0, isl.p.key === "lighthouse" ? 5.2 : isl.p.key === "origin" ? 4.6 : 3.4, 0));
      tmp.project(camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      const d = camera.position.distanceTo(isl.root.position);
      isl.label.style.transform = `translate(${((tmp.x + 1) / 2 * W).toFixed(1)}px, ${((1 - tmp.y) / 2 * H).toFixed(1)}px)`;
      isl.label.style.opacity = vis ? String(Math.max(0, Math.min(1, (130 - d) / 40))) : "0";
      isl.label.classList.toggle("is-near", d < 26);
    });

    renderer.render(scene, camera);
    frames++;
  }
  loop();

  return {
    enter() { const [p, t] = [V(0, isSmall ? 46 : 26, isSmall ? 84 : 50), V(0, 0, 0)]; flyTo(p, t, 2.6); setTimeout(() => (controls.autoRotate = false), 0); },
    home() { flyTo(V(0, isSmall ? 46 : 26, isSmall ? 84 : 50), V(0, 0, 0), 1.8); },
    focus(key) { const [p, t] = viewFor(key); flyTo(p, t); },
    setPanelOffset(x, y) {
      offTween?.kill();
      offTween = window.gsap.to(offset, { x, y, duration: reduced ? 0.01 : 1.1, ease: "power3.inOut", onUpdate: applyOffset, onComplete: applyOffset });
    },
    setRoute, setStyle, regrow,
    get seed() { return seed; },
    get style() { return style; },
    markNote(i) { const n = noteObjs[i]; if (!n || n.found) return; n.found = true; n.paper.material.color.set(C.accent); },
    stats() {
      let objects = 0; scene.traverse(() => objects++);
      return { objects, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, frames };
    },
  };
}
