// =========================================================
// One object, four lives: line → form → finish → production.
// A superellipsoid "pebble" with a seam, a button and a tag.
// =========================================================
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const TAU = Math.PI * 2;
const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
const DIM = { a: 1.3, b: 0.84, c: 1.0, e1: 0.55, e2: 0.62 };
function pebblePoint(lat, lon, s = 1) {
  const cl = Math.cos(lat), sl = Math.sin(lat);
  return new THREE.Vector3(
    DIM.a * sp(cl, DIM.e1) * sp(Math.cos(lon), DIM.e2) * s,
    DIM.b * sp(sl, DIM.e1) * s,
    DIM.c * sp(cl, DIM.e1) * sp(Math.sin(lon), DIM.e2) * s,
  );
}
function pebbleGeometry(w, h) {
  const g = new THREE.SphereGeometry(1, w, h);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(z, x);
    const q = pebblePoint(lat, lon);
    p.setXYZ(i, q.x, q.y, q.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createObject(canvas, { reduced = false } = {}) {
  const small = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  let PR = Math.min(devicePixelRatio, 1.75);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.035).texture;

  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 400);

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(1.6, 8, 2.4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2); rim.position.set(-5, 3, -6); scene.add(rim);
  const warm = new THREE.DirectionalLight(0xff8a50, 0.0); warm.position.set(-3, -2, 4); scene.add(warm);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.35));

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.16 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.35; shadow.receiveShadow = true;
  scene.add(shadow);

  // ---------- the object ----------
  const obj = new THREE.Group();
  scene.add(obj);
  const geo = pebbleGeometry(160, 110);

  // 1. line — contour drawing that draws itself
  const linePts = [];
  for (let i = 1; i < 16; i++) {
    const lat = -Math.PI / 2 + (i / 16) * Math.PI;
    for (let k = 0; k < 120; k++) linePts.push(pebblePoint(lat, (k / 120) * TAU, 1.002), pebblePoint(lat, ((k + 1) / 120) * TAU, 1.002));
  }
  for (let j = 0; j < 20; j++) {
    const lon = (j / 20) * TAU;
    for (let k = 0; k < 60; k++) linePts.push(pebblePoint(-Math.PI / 2 + (k / 60) * Math.PI, lon, 1.002), pebblePoint(-Math.PI / 2 + ((k + 1) / 60) * Math.PI, lon, 1.002));
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 1 });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  obj.add(lines);
  const LINE_COUNT = linePts.length;

  // 2. form — matte clay
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.92, metalness: 0, transparent: true, opacity: 0 });
  const clay = new THREE.Mesh(geo, clayMat); clay.castShadow = true; obj.add(clay);

  // 3. finish — gloss porcelain, seam, button, tag
  const glossMat = new THREE.MeshPhysicalMaterial({ color: 0xf3f1ec, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.2, transparent: true, opacity: 0, envMapIntensity: 1.2 });
  const gloss = new THREE.Mesh(geo, glossMat); gloss.castShadow = true; obj.add(gloss);
  const detail = new THREE.Group(); obj.add(detail);
  const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x0d0d0d, roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0 });
  const orangeMat = new THREE.MeshPhysicalMaterial({ color: 0xff5a14, roughness: 0.32, clearcoat: 0.8, transparent: true, opacity: 0 });
  const seamPts = []; for (let k = 0; k <= 200; k++) seamPts.push(pebblePoint(-0.12, (k / 200) * TAU, 1.004));
  detail.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts, true), 400, 0.008, 6, true), darkMat));
  const bp = pebblePoint(0.62, Math.PI / 2 - 0.0, 1.0);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 48), orangeMat);
  button.position.copy(bp); button.lookAt(bp.clone().multiplyScalar(2)); button.rotateX(Math.PI / 2); detail.add(button);
  // zip tie + tag
  const tieAnchor = pebblePoint(0.05, 0.12, 1.0);
  const tag = new THREE.Group(); tag.position.copy(tieAnchor).add(new THREE.Vector3(0.05, 0, 0)); detail.add(tag);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 40), orangeMat); tie.rotation.y = Math.PI / 2; tag.add(tie);
  const swing = new THREE.Group(); swing.position.set(0.02, -0.1, 0); tag.add(swing);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.36, 0.006), orangeMat); strap.position.y = -0.18; swing.add(strap);
  const tc = document.createElement("canvas"); tc.width = 512; tc.height = 300;
  const t2 = tc.getContext("2d");
  t2.fillStyle = "#f3f1ec"; t2.fillRect(0, 0, 512, 300);
  t2.fillStyle = "#111"; t2.font = "700 54px Archivo, Helvetica, Arial, sans-serif"; t2.fillText('"OBJECT"', 34, 92);
  t2.font = "500 24px 'IBM Plex Mono', monospace"; t2.fillText("c/o NEHAL RAO", 36, 150); t2.fillText("FOR THE PURPOSE OF", 36, 186); t2.fillText("BEING MADE", 36, 218);
  for (let i = 0; i < 14; i++) { t2.save(); t2.translate(36 + i * 32, 252); t2.transform(1, 0, -0.9, 1, 0, 0); t2.fillRect(0, 0, 14, 28); t2.restore(); }
  t2.fillStyle = "#ff5a14"; t2.beginPath(); t2.arc(470, 46, 14, 0, TAU); t2.fill();
  const tagTex = new THREE.CanvasTexture(tc); tagTex.colorSpace = THREE.SRGBColorSpace; tagTex.anisotropy = 8;
  const tagMat = new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36), tagMat); card.position.set(0.0, -0.52, 0); card.rotation.y = Math.PI / 2 - 0.4; card.castShadow = true; swing.add(card);

  // 4. production — the same object, thousands of times
  const N = small ? 27 : 41, GAP = 3.1;
  const instGeo = pebbleGeometry(40, 28);
  const instMat = new THREE.MeshPhysicalMaterial({ color: 0xf3f1ec, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 });
  const army = new THREE.InstancedMesh(instGeo, instMat, N * N - 1);
  const cells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i - (N - 1) / 2) * GAP, z = (j - (N - 1) / 2) * GAP;
    if (Math.abs(x) < 0.01 && Math.abs(z) < 0.01) continue;
    cells.push({ x, z, d: Math.hypot(x, z) });
  }
  // N is odd and the centre cell is skipped above — the hero object sits there
  army.count = cells.length;
  const orangeIdx = cells.findIndex((c) => Math.abs(c.x - GAP * 3) < 0.1 && Math.abs(c.z + GAP * 2) < 0.1);
  cells.forEach((c, i) => army.setColorAt(i, i === orangeIdx ? new THREE.Color(0xff5a14) : new THREE.Color(1, 1, 1)));
  army.instanceColor.needsUpdate = true;
  army.visible = false;
  scene.add(army);
  const maxD = Math.max(...cells.map((c) => c.d));
  const dummy = new THREE.Object3D();
  function layoutArmy(t, time) {
    army.visible = t > 0.001;
    if (!army.visible) return;
    cells.forEach((c, i) => {
      const k = Math.min(1, Math.max(0, t * 1.6 - (c.d / maxD) * 0.6));
      const e = k * k * (3 - 2 * k);
      dummy.position.set(c.x, -1.35 + DIM.b * e + (1 - e) * -1.5, c.z);
      dummy.rotation.set(0, time * 0.15 + c.d * 0.05, 0);
      dummy.scale.setScalar(Math.max(0.0001, e));
      dummy.updateMatrix(); army.setMatrixAt(i, dummy.matrix);
    });
    army.instanceMatrix.needsUpdate = true;
  }

  // ---------- state ----------
  const S = { cam: new THREE.Vector3(0, 0.6, 7.5), look: new THREE.Vector3(0, 0, 0), line: 0, lineDraw: 0, clay: 0, gloss: 1, detail: 1, army: 0, orange: 0, offX: 0, offY: 0, objX: 0, objY: 0, scale: 1, spin: 0.25, dark: 0 };
  const T = { ...S, cam: S.cam.clone(), look: S.look.clone() };
  function setState(s) {
    T.cam.set(...s.cam); T.look.set(...s.look);
    for (const k of ["line", "lineDraw", "clay", "gloss", "detail", "army", "orange", "offX", "offY", "objX", "objY", "scale", "spin", "dark"]) T[k] = s[k] ?? 0;
  }

  let yaw = 0.6, px = 0, py = 0;
  addEventListener("pointermove", (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });
  const white = new THREE.Color(0xf3f1ec), orange = new THREE.Color(0xff5a14);

  const clock = new THREE.Clock();
  let frames = 0, running = true;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) { clock.getDelta(); loop(); } });
  function fit() { const a = innerWidth / innerHeight; return a < 1 ? Math.min(2.2, 1.35 / a) : a < 1.3 ? 1.12 : 1; }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    const k = 1 - Math.pow(0.0012, dt);
    S.cam.lerp(T.cam, k); S.look.lerp(T.look, k);
    for (const key of ["line", "lineDraw", "clay", "gloss", "detail", "army", "orange", "offX", "offY", "objX", "objY", "scale", "spin", "dark"]) S[key] += (T[key] - S[key]) * k;

    lineMat.opacity = S.line;
    lineMat.color.setScalar(S.dark > 0.5 ? 0.92 : 0.07);
    lines.visible = S.line > 0.01;
    lineGeo.setDrawRange(0, Math.floor(LINE_COUNT * Math.min(1, S.lineDraw) / 2) * 2);
    clayMat.opacity = S.clay; clay.visible = S.clay > 0.01; clayMat.depthWrite = S.clay > 0.5;
    glossMat.opacity = S.gloss; gloss.visible = S.gloss > 0.01; glossMat.depthWrite = S.gloss > 0.5;
    glossMat.color.copy(white).lerp(orange, S.orange);
    darkMat.opacity = S.detail; orangeMat.opacity = S.detail; tagMat.opacity = S.detail; detail.visible = S.detail > 0.01;
    warm.intensity = S.orange * 1.4;
    shadow.material.opacity = 0.16 * (1 - S.dark * 0.6) * (1 - S.army);

    if (!reduced) yaw += dt * S.spin;
    obj.rotation.y = yaw + px * 0.5;
    obj.rotation.x = py * 0.18 + (reduced ? 0 : Math.sin(time * 0.6) * 0.03);
    obj.position.set(S.objX, S.objY + (reduced ? 0 : Math.sin(time * 0.9) * 0.05), 0);
    obj.scale.setScalar(S.scale);
    swing.rotation.x = reduced ? 0 : Math.sin(time * 1.3) * 0.12;
    swing.rotation.z = reduced ? 0 : Math.sin(time * 0.9 + 1) * 0.08;

    layoutArmy(S.army, reduced ? 0 : time);

    const f = fit();
    camera.position.copy(S.cam).sub(S.look).multiplyScalar(f).add(S.look);
    camera.lookAt(S.look);
    const ox = small ? 0 : -S.offX * innerWidth, oy = (small ? -0.03 : 0) * innerHeight + S.offY * innerHeight;
    if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) camera.setViewOffset(innerWidth, innerHeight, ox, oy, innerWidth, innerHeight); else camera.clearViewOffset();

    renderer.render(scene, camera);
    frames++; adapt();
  }
  let qT = performance.now(), qF = 0, tier = 0;
  function adapt() {
    const now = performance.now(); if (now - qT < 2500) return;
    const fps = ((frames - qF) * 1000) / (now - qT); qT = now; qF = frames;
    if (fps < 34 && tier === 0) { tier = 1; PR = 1; renderer.setPixelRatio(1); }
    else if (fps < 24 && tier === 1) { tier = 2; key.castShadow = false; }
  }
  addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  loop();
  return { setState, count: cells.length + 1 };
}
