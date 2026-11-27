// =========================================================
// The machine: an electric drive unit, generated in code.
// Motor (stator, hairpin windings, IPM rotor), 9:1 planetary
// gearbox, cast housing, inverter. Axis along X. 1 unit = 50 mm.
// Every tooth, bolt and copper bar is procedural.
// =========================================================
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const BASE = {
  cast:   { color: 0x9b9ea3, metalness: 0.9, roughness: 0.56 },
  alu:    { color: 0xb4b7bc, metalness: 1, roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.35 },
  dark:   { color: 0x2a2c30, metalness: 0.8, roughness: 0.38 },
  coat:   { color: 0x131416, metalness: 0.3, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 },
  steel:  { color: 0xbcc0c4, metalness: 1, roughness: 0.18 },
  copper: { color: 0xd27b45, metalness: 1, roughness: 0.26 },
  lam:    { color: 0x70747a, metalness: 0.92, roughness: 0.4 },
  magnet: { color: 0x9a9ea4, metalness: 1, roughness: 0.22 },
  pcb:    { color: 0x0e1813, metalness: 0.1, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.2 },
  gold:   { color: 0xd8ae58, metalness: 1, roughness: 0.25 },
  ic:     { color: 0x0b0b0c, metalness: 0.1, roughness: 0.6 },
  smd:    { color: 0x4a3a2c, metalness: 0.2, roughness: 0.6 },
  orange: { color: 0xff5a1f, metalness: 0, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.3 },
  rubber: { color: 0x0f0f10, metalness: 0, roughness: 0.85 },
  trace:  { color: 0x5a3a22, metalness: 0.6, roughness: 0.35, emissive: 0xff5a1f, emissiveIntensity: 0 },
};

export function createMachine(canvas, { reduced = false } = {}) {
  const small = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  let PR = Math.min(devicePixelRatio, small ? 1.6 : 1.5);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.02).texture;

  const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(8, 3.5, 10);

  // studio light
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(6, 10, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8d6ff, 0.55); fill.position.set(-8, 3, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(-3, 5, -9); scene.add(rim);
  const warm = new THREE.DirectionalLight(0xff8a50, 0.35); warm.position.set(4, -3, -6); scene.add(warm);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x101012, 0.25));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.38 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.55; floor.receiveShadow = true;
  scene.add(floor);

  // post
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.4, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const machine = new THREE.Group();
  scene.add(machine);

  // ---------- groups (each explodes / ghosts independently) ----------
  const groups = {};
  const markers = {};
  let parts = 0;
  function group(name, base, ex) {
    const obj = new THREE.Group(); obj.position.copy(base); machine.add(obj);
    const g = { name, obj, base: base.clone(), ex: ex.clone(), mats: {}, edges: [], exAmt: 0, ghost: 0 };
    groups[name] = g; return g;
  }
  function mat(g, kind) {
    if (!g.mats[kind]) g.mats[kind] = new THREE.MeshPhysicalMaterial({ ...BASE[kind], transparent: true, envMapIntensity: 1.15, side: kind === "cast" ? THREE.DoubleSide : THREE.FrontSide });
    return g.mats[kind];
  }
  const ghostEdgeMats = {};
  function add(g, geo, kind, { pos, rot, edges = true, count = 1 } = {}) {
    const m = new THREE.Mesh(geo, mat(g, kind));
    if (pos) m.position.copy(pos);
    if (rot) m.rotation.copy(rot);
    m.castShadow = true; m.receiveShadow = true;
    g.obj.add(m); parts += count;
    if (edges) {
      ghostEdgeMats[g.name] ||= new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 35), ghostEdgeMats[g.name]);
      e.visible = false; m.add(e); g.edges.push(e);
    }
    return m;
  }
  // instanced helper: list of {p:Vector3, r:Euler, s?:Vector3}
  const dummy = new THREE.Object3D();
  function inst(g, geo, kind, list) {
    const im = new THREE.InstancedMesh(geo, mat(g, kind), list.length);
    list.forEach((t, i) => {
      dummy.position.copy(t.p); dummy.rotation.copy(t.r || new THREE.Euler()); dummy.scale.copy(t.s || V3(1, 1, 1));
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = true; im.receiveShadow = true;
    g.obj.add(im); parts += list.length;
    return im;
  }
  function marker(g, key, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); g.obj.add(o); markers[key] = o; }

  // geometry helpers
  const alongX = (geo) => { geo.rotateZ(-Math.PI / 2); return geo; };       // cylinder/lathe Y-axis → X-axis
  const extrudeX = (shape, depth, bevel = 0) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2); return g;      // shape XY → YZ plane, thickness along X
  };
  const lathe = (pts, seg = 96) => alongX(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
  const polar = (r, a) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  const circlePath = (r, cx = 0, cy = 0) => new THREE.Path().absarc(cx, cy, r, 0, TAU, true);
  // shape angle a → yz position (see extrudeX mapping: (x,y) → (0, y, -x))
  const yz = (r, a) => [Math.sin(a) * r, -Math.cos(a) * r];

  function hexBolt(len = 0.12, r = 0.055) {
    const head = new THREE.CylinderGeometry(r, r, r * 1.1, 6); head.translate(0, len / 2 + r * 0.55, 0);
    return head; // head only reads as the bolt from outside
  }

  function gearShape(z, m, { internal = false, bore = 0, outer = 0, holes = [] } = {}) {
    const r = (m * z) / 2;
    const ra = internal ? r - m : r + m, rr = internal ? r + 1.25 * m : r - 1.25 * m;
    const p = TAU / z, pts = [];
    const prof = [[rr, -0.5], [rr, -0.27], [ra * 0.35 + rr * 0.65, -0.2], [ra, -0.12], [ra, -0.04], [ra, 0.04], [ra, 0.12], [ra * 0.35 + rr * 0.65, 0.2], [rr, 0.27]];
    for (let k = 0; k < z; k++) for (const [rad, f] of prof) pts.push(polar(rad, k * p + f * p));
    let s;
    if (internal) { s = new THREE.Shape(); s.absarc(0, 0, outer, 0, TAU, false); s.holes.push(new THREE.Path(pts)); }
    else { s = new THREE.Shape(pts); if (bore) s.holes.push(circlePath(bore)); }
    holes.forEach(([hr, hx, hy]) => s.holes.push(circlePath(hr, hx, hy)));
    return s;
  }

  // =====================================================
  // HOUSING (cast aluminium sleeve with fins, feet, bosses)
  // =====================================================
  const housing = group("housing", V3(), V3(0, 0.5, -3.8));
  {
    const g = housing;
    add(g, lathe([[1.66, -1.25], [1.92, -1.25], [1.92, -1.13], [1.76, -1.07], [1.76, 1.07], [1.92, 1.13], [1.92, 1.25], [1.66, 1.25], [1.66, -1.25]], 128), "cast");
    // fins (skip top for the inverter, front window for nameplate + ports, bottom for feet)
    const fins = [];
    for (let i = 0; i < 64; i++) {
      const b = (i / 64) * TAU;
      const d = (x) => Math.abs(Math.atan2(Math.sin(b - x), Math.cos(b - x)));
      if (d(Math.PI / 2) < 0.55 || d(-Math.PI / 2) < 0.42 || (b > -0.05 && b < 0.42)) continue;
      fins.push({ p: V3(0, Math.sin(b) * 1.86, Math.cos(b) * 1.86), r: new THREE.Euler(Math.PI / 2 - b, 0, 0) });
    }
    inst(g, new THREE.BoxGeometry(2.0, 0.22, 0.035), "cast", fins);
    // circumferential stiffening rings
    [-0.55, 0.55].forEach((x) => add(g, alongX(new THREE.TorusGeometry(1.88, 0.025, 6, 128).rotateX(Math.PI / 2)), "cast", { pos: V3(x, 0, 0), edges: false }));
    // feet
    [-0.75, 0.75].forEach((x) => {
      add(g, new THREE.BoxGeometry(0.5, 0.55, 2.7), "cast", { pos: V3(x, -2.0, 0) });
      [-1.1, 1.1].forEach((z) => add(g, new THREE.CylinderGeometry(0.09, 0.09, 0.08, 6), "steel", { pos: V3(x, -1.7, z), edges: false }));
    });
    // flange bolts (both ends)
    const bolts = [];
    [-1.27, 1.27].forEach((x) => { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.13; bolts.push({ p: V3(x + Math.sign(x) * 0.02, Math.sin(a) * 1.82, Math.cos(a) * 1.82), r: new THREE.Euler(0, 0, -Math.sign(x) * Math.PI / 2) }); } });
    inst(g, hexBolt(0.05, 0.06), "steel", bolts);
    // nameplate + coolant ports in the front window
    const np = add(g, new THREE.BoxGeometry(0.9, 0.36, 0.015), "dark", { pos: V3(0.2, Math.sin(0.18) * 1.77, Math.cos(0.18) * 1.77), rot: new THREE.Euler(-0.18, 0, 0) });
    for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(0.6 - i * 0.1, 0.018, 0.005), "steel", { pos: V3(0.1, Math.sin(0.18) * 1.785 + 0.1 - i * 0.06, Math.cos(0.18) * 1.785 + 0.01), rot: new THREE.Euler(-0.18, 0, 0), edges: false, count: 0 });
    [-0.75, 0.85].forEach((x) => {
      const port = new THREE.Group(); port.position.set(x, Math.sin(0.0) * 1.8 - 0.05, 1.8);
      g.obj.add(port);
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 24), mat(g, "cast")); c1.rotation.x = Math.PI / 2; port.add(c1);
      const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 6), mat(g, "steel")); c2.rotation.x = Math.PI / 2; c2.position.z = 0.11; port.add(c2);
      const c3 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 20), mat(g, "rubber")); c3.rotation.x = Math.PI / 2; c3.position.z = 0.2; port.add(c3);
      [c1, c2, c3].forEach((c) => { c.castShadow = true; }); parts += 3;
    });
    // HV terminal box on top-front
    add(g, new THREE.BoxGeometry(0.7, 0.32, 0.6), "cast", { pos: V3(-0.55, 1.86, 0.75) });
    const glands = [];
    for (let i = 0; i < 3; i++) glands.push({ p: V3(-0.78 + i * 0.22, 1.86, 1.08), r: new THREE.Euler(Math.PI / 2, 0, 0) });
    inst(g, new THREE.CylinderGeometry(0.065, 0.065, 0.1, 6), "steel", glands);
    // lifting eye
    add(g, new THREE.TorusGeometry(0.14, 0.04, 10, 28), "steel", { pos: V3(0.75, 2.05, -0.9) });
    marker(g, "fins", 0.2, Math.sin(-0.5) * 1.98, Math.cos(-0.5) * 1.98);
    marker(g, "nameplate", 0.55, Math.sin(0.18) * 1.79, Math.cos(0.18) * 1.79);
    marker(g, "port", 0.85, -0.05, 2.0);
    marker(g, "flange", 1.27, Math.sin(0.65) * 1.82, Math.cos(0.65) * 1.82);
    marker(g, "housingName", 0, 1.3, 1.3);
  }

  // =====================================================
  // END CAP (non-drive end) + resolver
  // =====================================================
  const capL = group("capL", V3(-1.36, 0, 0), V3(-4.6, 0, 0));
  {
    const g = capL;
    add(g, lathe([[0.22, -0.08], [1.92, -0.08], [1.92, 0.06], [1.6, 0.08], [0.62, 0.16], [0.55, 0.28], [0.22, 0.28], [0.22, -0.08]], 128), "cast");
    const ribs = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.31; ribs.push({ p: V3(-0.12, Math.sin(a) * 1.15, Math.cos(a) * 1.15), r: new THREE.Euler(Math.PI / 2 - a, 0, 0) }); }
    inst(g, new THREE.BoxGeometry(0.12, 0.9, 0.06), "cast", ribs);
    const b = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.13; b.push({ p: V3(-0.14, Math.sin(a) * 1.8, Math.cos(a) * 1.8), r: new THREE.Euler(0, 0, Math.PI / 2) }); }
    inst(g, hexBolt(0.05, 0.06), "steel", b);
    add(g, alongX(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 48)), "coat", { pos: V3(-0.32, 0, 0) });
    add(g, alongX(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 6)), "orange", { pos: V3(-0.44, 0, 0), edges: false });
    marker(g, "capL", -0.3, 0.9, 1.0);
  }

  // =====================================================
  // BEARINGS
  // =====================================================
  function bearing(name, x, ex, rIn, rOut, w) {
    const g = group(name, V3(x, 0, 0), ex);
    add(g, lathe([[rOut - 0.06, -w / 2], [rOut, -w / 2], [rOut, w / 2], [rOut - 0.06, w / 2], [rOut - 0.08, 0], [rOut - 0.06, -w / 2]], 64), "steel");
    add(g, lathe([[rIn, -w / 2], [rIn + 0.06, -w / 2], [rIn + 0.08, 0], [rIn + 0.06, w / 2], [rIn, w / 2], [rIn, -w / 2]], 64), "steel");
    const rm = (rIn + rOut) / 2, br = (rOut - rIn) * 0.26, balls = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; balls.push({ p: V3(0, Math.sin(a) * rm, Math.cos(a) * rm) }); }
    inst(g, new THREE.SphereGeometry(br, 16, 12), "steel", balls);
    add(g, alongX(new THREE.TorusGeometry(rm, 0.012, 6, 64).rotateX(Math.PI / 2)), "orange", { edges: false });
    return g;
  }
  const bearingL = bearing("bearingL", -1.3, V3(-3.5, 0, 1.5), 0.16, 0.42, 0.18);
  const bearingR = bearing("bearingR", 1.32, V3(1.7, 0, 0), 0.17, 0.44, 0.18);

  // =====================================================
  // STATOR — laminated stack + hairpin windings
  // =====================================================
  const stator = group("stator", V3(), V3());
  const ZS = 36, Rb = 1.04, Rs = 1.38, Ro = 1.64;
  {
    const g = stator, p = TAU / ZS, ws = p * 0.11, wd = p * 0.25;
    const s = new THREE.Shape(); s.absarc(0, 0, Ro, 0, TAU, false);
    const pts = [];
    for (let k = 0; k < ZS; k++) {
      const a = k * p;
      pts.push(polar(Rb, a - ws), polar(Rb + 0.05, a - ws), polar(Rs, a - wd), polar(Rs + 0.02, a), polar(Rs, a + wd), polar(Rb + 0.05, a + ws), polar(Rb, a + ws), polar(Rb, a + p / 2));
    }
    s.holes.push(new THREE.Path(pts));
    // 4 through-bolt holes in the yoke
    [0.4, 0.4 + Math.PI / 2, 0.4 + Math.PI, 0.4 + 1.5 * Math.PI].forEach((a) => s.holes.push(circlePath(0.05, Math.cos(a) * 1.52, Math.sin(a) * 1.52)));
    const lamGeo = extrudeX(s, 0.058);
    const N = 28, L = N * 0.064, lams = [];
    for (let i = 0; i < N; i++) lams.push({ p: V3(-L / 2 + 0.032 + i * 0.064, 0, 0) });
    inst(g, lamGeo, "lam", lams);
    // hairpin bars: 2 layers per slot, longer than the stack
    const bars = [];
    for (let k = 0; k < ZS; k++) {
      const a = k * p;
      [Rb + 0.12, Rb + 0.25].forEach((r) => { const [y, z] = yz(r, a); bars.push({ p: V3(0, y, z), r: new THREE.Euler(a - Math.PI / 2, 0, 0) }); });
    }
    inst(g, new THREE.BoxGeometry(L + 0.34, 0.11, 0.05), "copper", bars);
    // end turns: crowns of copper arcs, two staggered layers each end
    const arc = new THREE.TorusGeometry(Rb + 0.18, 0.04, 6, 14, p * 3);
    arc.rotateY(Math.PI / 2);
    const crowns = [];
    [-1, 1].forEach((side) => { for (let k = 0; k < ZS; k++) [0, 1].forEach((layer) => {
      crowns.push({ p: V3(side * (L / 2 + 0.18 + layer * 0.06), 0, 0), r: new THREE.Euler(k * p + layer * p * 1.5, 0, 0), s: V3(1, 1 + layer * 0.07, 1 + layer * 0.07) });
    }); });
    inst(g, arc, "copper", crowns);
    // phase leads
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 - 0.35 + i * 0.12;
      const [y, z] = yz(Rb + 0.25, a + Math.PI / 2);
      add(g, new THREE.BoxGeometry(0.06, 0.55, 0.05), "copper", { pos: V3(-L / 2 - 0.3, y + 0.25, z), edges: false });
    }
    // through bolts
    const tb = [];
    [0.4, 0.4 + Math.PI / 2, 0.4 + Math.PI, 0.4 + 1.5 * Math.PI].forEach((a) => { const [y, z] = yz(1.52, a); tb.push({ p: V3(0, y, z), r: new THREE.Euler(0, 0, Math.PI / 2) }); });
    inst(g, new THREE.CylinderGeometry(0.045, 0.045, L + 0.12, 10), "steel", tb);
    marker(g, "lams", 0.3, Math.sin(-0.3) * Ro, Math.cos(-0.3) * Ro);
    marker(g, "windings", -L / 2 - 0.22, 0.6, 1.05);
    marker(g, "statorName", 0, 1.2, 1.1);
  }

  // =====================================================
  // ROTOR — laminated IPM core, V magnets, shaft, sun gear
  // =====================================================
  const rotor = group("rotor", V3(), V3(-2.3, 0, 1.5));
  const spinners = { rotor: new THREE.Group() };
  rotor.obj.add(spinners.rotor);
  {
    const g = rotor, R = 0.98, poles = 8;
    const s = new THREE.Shape(); s.absarc(0, 0, R, 0, TAU, false);
    s.holes.push(circlePath(0.2));
    const magnets = [];
    for (let k = 0; k < poles; k++) {
      const a = (k / poles) * TAU;
      [-1, 1].forEach((sd) => {
        const c = polar(0.72, a + sd * 0.17), ang = a + sd * 0.17 + Math.PI / 2 - sd * 0.55;
        const u = polar(0.14, ang), v = polar(0.04, ang + Math.PI / 2);
        s.holes.push(new THREE.Path([c.clone().add(u).add(v), c.clone().sub(u).add(v), c.clone().sub(u).sub(v), c.clone().add(u).sub(v)].reverse()));
        const [y, z] = [c.y, -c.x];
        magnets.push({ ang, y, z });
      });
      const h = polar(0.42, a + Math.PI / poles); s.holes.push(circlePath(0.075, h.x, h.y));
    }
    const lamGeo = extrudeX(s, 0.058);
    const N = 27, L = N * 0.064, list = [];
    for (let i = 0; i < N; i++) list.push({ p: V3(-L / 2 + 0.032 + i * 0.064, 0, 0) });
    const core = new THREE.InstancedMesh(lamGeo, mat(g, "lam"), N);
    list.forEach((t, i) => { dummy.position.copy(t.p); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); core.setMatrixAt(i, dummy.matrix); });
    core.castShadow = true; core.receiveShadow = true; spinners.rotor.add(core); parts += N;
    const mg = new THREE.InstancedMesh(new THREE.BoxGeometry(L, 0.07, 0.27), mat(g, "magnet"), magnets.length);
    magnets.forEach((m, i) => { dummy.position.set(0, m.y, m.z); dummy.rotation.set(m.ang - Math.PI, 0, 0); dummy.updateMatrix(); mg.setMatrixAt(i, dummy.matrix); });
    mg.castShadow = true; spinners.rotor.add(mg); parts += magnets.length;
    // balancing end rings with drilled holes
    [-1, 1].forEach((sd) => {
      const ring = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 64)), mat(g, "steel"));
      ring.position.x = sd * (L / 2 + 0.03); ring.castShadow = true; spinners.rotor.add(ring); parts++;
      for (let i = 0; i < 5; i++) { const a = i * 0.9 + sd; const d = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12)), mat(g, "dark")); d.position.set(sd * (L / 2 + 0.035), Math.sin(a) * 0.6, Math.cos(a) * 0.6); spinners.rotor.add(d); }
    });
    // shaft
    const shaft = new THREE.Mesh(lathe([[0, -2.05], [0.12, -2.05], [0.13, -1.95], [0.13, -1.62], [0.16, -1.56], [0.16, -1.15], [0.2, -1.1], [0.2, 1.1], [0.17, 1.16], [0.17, 1.5], [0.145, 1.56], [0.145, 2.2], [0.12, 2.25], [0, 2.25]], 48), mat(g, "steel"));
    shaft.castShadow = true; spinners.rotor.add(shaft); parts++;
    // sun gear (12T, module 0.03) on the shaft end
    const sun = new THREE.Mesh(extrudeX(gearShape(12, 0.03, { bore: 0.12 }), 0.34, 0.012), mat(g, "steel"));
    sun.position.x = 1.98; sun.castShadow = true; spinners.rotor.add(sun); parts++;
    marker(g, "magnets", 0.2, Math.sin(0.9) * 0.99, Math.cos(0.9) * 0.99);
    marker(g, "shaft", -1.7, 0.16, 0.1);
    marker(g, "rotorName", 0, 1.0, 0.4);
  }

  // =====================================================
  // GEARBOX — ring gear, planet carrier, bell housing, output
  // =====================================================
  const MOD = 0.03, ZSUN = 12, ZPL = 42, ZRING = 96, PL_R = (MOD * (ZSUN + ZPL)) / 2;
  const ring = group("ring", V3(1.98, 0, 0), V3(2.2, 0, -1.3));
  {
    add(ring, extrudeX(gearShape(ZRING, MOD, { internal: true, outer: 1.62 }), 0.36, 0.01), "steel");
    const b = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; b.push({ p: V3(0.2, Math.sin(a) * 1.54, Math.cos(a) * 1.54), r: new THREE.Euler(0, 0, -Math.PI / 2) }); }
    inst(ring, hexBolt(0.03, 0.04), "steel", b);
    marker(ring, "ring", 0, Math.sin(0.4) * 1.6, Math.cos(0.4) * 1.6);
  }
  const carrier = group("carrier", V3(1.98, 0, 0), V3(2.0, 0, 1.4));
  const planets = [];
  {
    const g = carrier;
    spinners.carrier = new THREE.Group(); g.obj.add(spinners.carrier);
    const plate = (x) => {
      const s = new THREE.Shape(); s.absarc(0, 0, PL_R + 0.18, 0, TAU, false); s.holes.push(circlePath(0.16));
      for (let i = 0; i < 3; i++) { const c = polar(PL_R, (i / 3) * TAU + Math.PI / 2); s.holes.push(circlePath(0.06, c.x, c.y)); const w = polar(PL_R * 0.72, (i / 3) * TAU + Math.PI / 2 + Math.PI / 3); s.holes.push(circlePath(0.1, w.x, w.y)); }
      const m = new THREE.Mesh(extrudeX(s, 0.06, 0.008), mat(g, "dark")); m.position.x = x; m.castShadow = true; spinners.carrier.add(m); parts++;
    };
    plate(-0.24); plate(0.24);
    const planetGeo = extrudeX(gearShape(ZPL, MOD, { bore: 0.07, holes: [0, 1, 2, 3].map((i) => [0.1, Math.cos(i * Math.PI / 2 + 0.4) * 0.38, Math.sin(i * Math.PI / 2 + 0.4) * 0.38]) }), 0.34, 0.012);
    for (let i = 0; i < 3; i++) {
      const th = (i / 3) * TAU + Math.PI / 2;
      const holder = new THREE.Group(); const [y, z] = yz(PL_R, th); holder.position.set(0, y, z); spinners.carrier.add(holder);
      const pg = new THREE.Mesh(planetGeo, mat(g, "steel")); pg.castShadow = true; holder.add(pg); parts++;
      const pin = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 16)), mat(g, "gold")); holder.add(pin); parts++;
      planets.push({ holder, mesh: pg, th, phase: th + Math.PI - Math.PI / ZPL });
    }
    // output spline stub
    const stub = new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 24)), mat(g, "steel")); stub.position.x = 0.5; spinners.carrier.add(stub); parts++;
    const spl = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; spl.push({ p: V3(0.55, Math.sin(a) * 0.165, Math.cos(a) * 0.165), r: new THREE.Euler(Math.PI / 2 - a, 0, 0) }); }
    const splines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.02, 0.025), mat(g, "steel"), spl.length);
    spl.forEach((t, i) => { dummy.position.copy(t.p); dummy.rotation.copy(t.r); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); splines.setMatrixAt(i, dummy.matrix); });
    spinners.carrier.add(splines); parts += spl.length;
    marker(g, "planet", 0, Math.sin(0.5) * (PL_R + 0.3), Math.cos(0.5) * (PL_R + 0.3));
    marker(g, "sun", 0, 0.05, 0.25);
  }
  const bell = group("bell", V3(1.36, 0, 0), V3(3.2, 0, 0));
  {
    const g = bell;
    add(g, lathe([[1.62, 0], [1.92, 0], [1.92, 0.12], [1.8, 0.16], [1.72, 0.7], [1.48, 1.1], [1.1, 1.22], [0.42, 1.26], [0.42, 1.18], [1.04, 1.14], [1.4, 1.02], [1.62, 0.66], [1.62, 0]], 128), "cast");
    const ribs = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.26; ribs.push({ p: V3(0.75, Math.sin(a) * 1.62, Math.cos(a) * 1.62), r: new THREE.Euler(Math.PI / 2 - a, 0, -0.45 * 0) }); }
    inst(g, new THREE.BoxGeometry(0.9, 0.18, 0.05), "cast", ribs);
    const b = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; b.push({ p: V3(0.14, Math.sin(a) * 1.83, Math.cos(a) * 1.83), r: new THREE.Euler(0, 0, -Math.PI / 2) }); }
    inst(g, hexBolt(0.05, 0.06), "steel", b);
    add(g, alongX(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 6)), "dark", { pos: V3(1.28, 0, 0) }); // seal retainer
    add(g, alongX(new THREE.TorusGeometry(0.43, 0.03, 8, 48).rotateX(Math.PI / 2)), "rubber", { pos: V3(1.32, 0, 0), edges: false });
    marker(g, "bell", 0.8, 1.35, 0.9);
  }
  const flange = group("flange", V3(2.78, 0, 0), V3(4.6, 0, 0));
  {
    const g = flange;
    const s = new THREE.Shape(); s.absarc(0, 0, 0.78, 0, TAU, false); s.holes.push(circlePath(0.16));
    for (let i = 0; i < 6; i++) { const c = polar(0.56, (i / 6) * TAU); s.holes.push(circlePath(0.075, c.x, c.y)); }
    add(g, extrudeX(s, 0.12, 0.02), "steel");
    add(g, alongX(new THREE.CylinderGeometry(0.3, 0.34, 0.3, 48)), "steel", { pos: V3(-0.2, 0, 0) });
    const b = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.52; b.push({ p: V3(0.08, Math.sin(a) * 0.56, Math.cos(a) * 0.56), r: new THREE.Euler(0, 0, -Math.PI / 2) }); }
    inst(g, hexBolt(0.03, 0.06), "dark", b);
    marker(g, "flange", 0.06, 0.5, 0.55);
  }

  // =====================================================
  // INVERTER — cold plate, PCB + power stage, lid, HV harness
  // =====================================================
  const IY = 2.02;
  const cold = group("cold", V3(0, IY, -0.05), V3(0, 1.2, -1.0));
  {
    const g = cold;
    add(g, new THREE.BoxGeometry(2.6, 0.1, 1.86), "alu");
    const pts = [];
    for (let i = 0; i < 7; i++) { const z = -0.75 + i * 0.25; pts.push(V3(i % 2 ? 1.05 : -1.05, 0.06, z)); pts.push(V3(i % 2 ? -1.05 : 1.05, 0.06, z)); }
    const path = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.05);
    add(g, new THREE.TubeGeometry(path, 260, 0.03, 8), "copper", { edges: false });
  }
  const pcb = group("pcb", V3(0, IY + 0.12, -0.05), V3(0, 2.6, -1.0));
  const traceMats = [];
  {
    const g = pcb;
    add(g, new THREE.BoxGeometry(2.46, 0.035, 1.72), "pcb");
    const T = 0.02;
    // power modules with copper tabs
    const mods = [-0.72, 0, 0.72];
    mods.forEach((x) => {
      add(g, new THREE.BoxGeometry(0.44, 0.1, 0.56), "ic", { pos: V3(x, T + 0.05, -0.38) });
      add(g, new THREE.BoxGeometry(0.4, 0.012, 0.5), "gold", { pos: V3(x, T + 0.106, -0.38), edges: false });
    });
    const tabs = [];
    mods.forEach((x) => [-0.13, 0, 0.13].forEach((dx) => tabs.push({ p: V3(x + dx, T + 0.09, -0.72) })));
    inst(g, new THREE.BoxGeometry(0.07, 0.03, 0.18), "copper", tabs);
    // busbars to the HV terminal
    add(g, new THREE.BoxGeometry(1.7, 0.03, 0.08), "copper", { pos: V3(0, T + 0.16, -0.8) });
    add(g, new THREE.BoxGeometry(1.7, 0.03, 0.08), "copper", { pos: V3(0, T + 0.2, -0.68) });
    // DC-link film capacitor block
    add(g, new THREE.BoxGeometry(1.9, 0.34, 0.4), "coat", { pos: V3(0, T + 0.17, 0.32) });
    add(g, new THREE.BoxGeometry(1.92, 0.04, 0.02), "orange", { pos: V3(0, T + 0.26, 0.525), edges: false });
    // controller MCU with pins
    add(g, new THREE.BoxGeometry(0.26, 0.03, 0.26), "ic", { pos: V3(0.86, T + 0.015, 0.72) });
    const pins = [];
    for (let i = 0; i < 16; i++) { const o = -0.11 + i * 0.0147; pins.push({ p: V3(0.86 + o, T + 0.008, 0.72 - 0.145) }, { p: V3(0.86 + o, T + 0.008, 0.72 + 0.145) }, { p: V3(0.86 - 0.145, T + 0.008, 0.72 + o) }, { p: V3(0.86 + 0.145, T + 0.008, 0.72 + o) }); }
    inst(g, new THREE.BoxGeometry(0.012, 0.006, 0.012), "gold", pins);
    // gate drivers + SMD field
    const drv = [];
    mods.forEach((x) => [-0.16, 0.16].forEach((dx) => drv.push({ p: V3(x + dx, T + 0.012, 0.0) })));
    inst(g, new THREE.BoxGeometry(0.12, 0.025, 0.09), "ic", drv);
    const rng = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const smd = [];
    for (let i = 0; i < 220; i++) {
      const x = -1.15 + rng() * 2.3, z = 0.58 + rng() * 0.25;
      if (x > 0.65 && x < 1.05) continue;
      smd.push({ p: V3(x, T + 0.006, z), r: new THREE.Euler(0, rng() > 0.5 ? Math.PI / 2 : 0, 0) });
    }
    for (let i = 0; i < 80; i++) smd.push({ p: V3(-1.15 + rng() * 2.3, T + 0.006, -0.06 + rng() * 0.12), r: new THREE.Euler(0, rng() > 0.5 ? Math.PI / 2 : 0, 0) });
    inst(g, new THREE.BoxGeometry(0.04, 0.012, 0.02), "smd", smd);
    // signal connector
    add(g, new THREE.BoxGeometry(0.4, 0.14, 0.16), "ic", { pos: V3(-0.9, T + 0.07, 0.76) });
    // copper traces (glow in the electronics chapter)
    const tm = mat(g, "trace"); traceMats.push(tm);
    const traces = [];
    for (let i = 0; i < 70; i++) {
      let x = -1.1 + rng() * 2.2, z = -0.1 + rng() * 0.8; const len = 0.1 + rng() * 0.5;
      const horiz = rng() > 0.5;
      traces.push({ p: V3(horiz ? x + len / 2 : x, T + 0.001, horiz ? z : z + len / 2), s: V3(horiz ? len / 0.1 : 1, 1, horiz ? 1 : len / 0.1) });
    }
    inst(g, new THREE.BoxGeometry(0.1, 0.004, 0.018), "trace", traces);
    // HV harness — three orange cables down to the terminal box
    [-0.22, 0, 0.22].forEach((dz, i) => {
      const curve = new THREE.CatmullRomCurve3([V3(-0.95 + i * 0.22, T + 0.1, -0.86), V3(-0.95 + i * 0.22, T + 0.25, -1.15), V3(-0.78 + i * 0.22, -0.15, 1.15 - 0.05), V3(-0.78 + i * 0.22, -0.2, 0.95)]);
      add(g, new THREE.TubeGeometry(curve, 60, 0.045, 12), "orange", { edges: false });
      add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.1, 16).rotateX(Math.PI / 2), "rubber", { pos: V3(-0.95 + i * 0.22, T + 0.12, -0.92), edges: false });
    });
    marker(g, "modules", 0.72, T + 0.1, -0.1);
    marker(g, "dclink", -0.5, T + 0.34, 0.52);
    marker(g, "mcu", 0.86, T + 0.03, 0.85);
    marker(g, "cables", -0.75, 0.1, -1.2);
    marker(g, "pcbName", 0, 0.4, 0.7);
  }
  const lid = group("lid", V3(0, IY + 0.42, -0.05), V3(0, 4.6, -1.0));
  {
    const g = lid;
    add(g, new THREE.BoxGeometry(2.64, 0.1, 1.9), "alu");
    add(g, new THREE.BoxGeometry(2.64, 0.24, 0.05), "alu", { pos: V3(0, -0.12, 0.925) });
    add(g, new THREE.BoxGeometry(2.64, 0.24, 0.05), "alu", { pos: V3(0, -0.12, -0.925) });
    add(g, new THREE.BoxGeometry(0.05, 0.24, 1.9), "alu", { pos: V3(1.3, -0.12, 0) });
    add(g, new THREE.BoxGeometry(0.05, 0.24, 1.9), "alu", { pos: V3(-1.3, -0.12, 0) });
    const ribs = [];
    for (let i = 0; i < 22; i++) ribs.push({ p: V3(-1.1 + i * 0.105, 0.09, 0) });
    inst(g, new THREE.BoxGeometry(0.028, 0.08, 1.6), "alu", ribs);
    const sc = [];
    [[-1.24, -0.86], [1.24, -0.86], [-1.24, 0.86], [1.24, 0.86], [0, -0.86], [0, 0.86], [-1.24, 0], [1.24, 0]].forEach(([x, z]) => sc.push({ p: V3(x, 0.07, z) }));
    inst(g, new THREE.CylinderGeometry(0.04, 0.04, 0.04, 6), "steel", sc);
    add(g, new THREE.BoxGeometry(0.5, 0.01, 0.16), "orange", { pos: V3(-0.9, 0.06, 0.7), edges: false }); // HV warning label
    marker(g, "lid", 0.6, 0.15, 0.7);
  }

  // ---------- framing ----------
  machine.position.set(-0.4, 0, 0);
  const box = new THREE.Box3().setFromObject(machine);
  floor.position.y = box.min.y - 0.02;

  // ---------- state ----------
  const cur = { cam: V3(8, 3.5, 10), target: V3(0.4, 0.4, 0), spin: 0, gear: 0, glow: 0, offX: 0 };
  const tgt = { cam: cur.cam.clone(), target: cur.target.clone(), spin: 0, gear: 0, glow: 0, offX: 0 };
  let yaw = 0, gearAngle = 0, pointerX = 0, pointerY = 0;
  addEventListener("pointermove", (e) => { pointerX = e.clientX / innerWidth - 0.5; pointerY = e.clientY / innerHeight - 0.5; }, { passive: true });

  function setState(s) {
    tgt.cam.set(...s.cam); tgt.target.set(...s.target);
    tgt.spin = s.spin || 0; tgt.gear = s.gear || 0; tgt.glow = s.glow || 0; tgt.offX = s.offX || 0;
    Object.values(groups).forEach((g) => { g.exTo = s.ex?.[g.name] ?? 0; g.ghostTo = s.ghost?.[g.name] ?? 0; });
  }
  setState({ cam: [8, 3.5, 10], target: [0.4, 0.4, 0] });
  Object.values(groups).forEach((g) => { g.exAmt = g.exTo; g.ghost = g.ghostTo; });

  function applyGhost(g) {
    const k = g.ghost;
    Object.values(g.mats).forEach((m) => { m.opacity = 1 - 0.965 * k; m.depthWrite = k < 0.5; });
    const em = ghostEdgeMats[g.name];
    if (em) { em.opacity = 0.22 * k; g.edges.forEach((e) => (e.visible = k > 0.02)); }
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  let frames = 0, running = true;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) { clock.getDelta(); loop(); } });

  function aspectFit() { const a = innerWidth / innerHeight; return 1.3 * (a < 1 ? Math.min(2.3, 1.3 / a) : a < 1.3 ? 1.12 : 1); }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const k = 1 - Math.pow(0.0008, dt), kg = 1 - Math.pow(0.002, dt);
    cur.cam.lerp(tgt.cam, k); cur.target.lerp(tgt.target, k);
    cur.spin += (tgt.spin - cur.spin) * k; cur.gear += (tgt.gear - cur.gear) * k; cur.glow += (tgt.glow - cur.glow) * k;
    cur.offX += (tgt.offX - cur.offX) * k;

    Object.values(groups).forEach((g) => {
      g.exAmt += (g.exTo - g.exAmt) * kg;
      g.ghost += (g.ghostTo - g.ghost) * kg;
      const e = g.exAmt * g.exAmt * (3 - 2 * g.exAmt);
      g.obj.position.copy(g.base).addScaledVector(g.ex, e);
      applyGhost(g);
    });

    if (!reduced) { yaw += dt * cur.spin; gearAngle += dt * cur.gear * 2.2; }
    machine.rotation.y = yaw + pointerX * 0.12;
    machine.rotation.x = pointerY * 0.04;

    // planetary kinematics: ring fixed, sun drives, carrier follows
    const aSun = gearAngle, aCar = aSun * ZSUN / (ZSUN + ZRING);
    spinners.rotor.rotation.x = aSun;
    spinners.carrier.rotation.x = aCar;
    planets.forEach((p) => { p.mesh.rotation.x = p.phase - (aSun - aCar) * ZSUN / ZPL; });

    traceMats.forEach((m) => (m.emissiveIntensity = cur.glow * 2.2));

    const fit = aspectFit();
    tmp.copy(cur.cam).sub(cur.target).multiplyScalar(fit).add(cur.target);
    camera.position.copy(tmp);
    camera.lookAt(cur.target);
    // shift the render so the machine sits right of the copy (desktop) or above the copy (phone)
    const ox = small ? 0 : -cur.offX * innerWidth, oy = small ? innerHeight * 0.2 : 0;
    if (Math.abs(ox) > 0.5 || oy) camera.setViewOffset(innerWidth, innerHeight, ox, oy, innerWidth, innerHeight); else camera.clearViewOffset();

    composer.render();
    frames++;
    adapt();
  }

  // adaptive quality
  let qT = performance.now(), qF = 0, tier = 0;
  function adapt() {
    const now = performance.now();
    if (now - qT < 2500) return;
    const fps = ((frames - qF) * 1000) / (now - qT); qT = now; qF = frames;
    if (fps < 34 && tier === 0) { tier = 1; PR = 1; renderer.setPixelRatio(1); composer.setPixelRatio(1); composer.setSize(innerWidth, innerHeight); }
    else if (fps < 24 && tier === 1) { tier = 2; bloom.enabled = false; key.castShadow = false; }
  }

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
  loop();

  return {
    setState,
    get parts() { return parts; },
    project(name) {
      const o = markers[name]; if (!o) return null;
      o.getWorldPosition(tmp); tmp.project(camera);
      return { x: (tmp.x + 1) / 2 * innerWidth, y: (1 - tmp.y) / 2 * innerHeight, visible: tmp.z < 1 };
    },
    stats() { return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, frames }; },
  };
}
