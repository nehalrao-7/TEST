import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
import { BODY_FIELDS, BODY_DEFAULTS } from './body.js';
import { GARMENT_FIELDS, GARMENT_DEFAULTS, buildGarment, bodyContext, fitReport } from './garment.js';
import { draftPattern, patternSVG } from './pattern.js';
import { loadHuman, fitHuman, joints, fitProxy } from './human.js';
import { FABRICS, PRINTS, applyFabric, zariMaterial, swatch, printCanvas, installWrinkles, computeWrinkles } from './fabric.js';
import { ClothSim, BodyCollider, LEGEND, simState } from './sim.js';
import { poseMesh, POSES } from './pose.js';
import { PROFILE } from './profile.js';

const $ = (id) => document.getElementById(id);
const STORE = 'fit-studio-3d-v4';
const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })();
const FABRIC_DEFAULTS = { dupatta: { type: 'georgette', print: 'phulkari', ground: '#d4a537', accent: '#b3122a', accent2: '#3fa66b', scale: 16 }, ...PROFILE.fabrics };
const BODY_START = { ...BODY_DEFAULTS, ...PROFILE.body }, GARMENT_START = { ...GARMENT_DEFAULTS, ...PROFILE.garment };
const state = {
  body: { ...BODY_START, ...saved.body },
  garment: { ...GARMENT_START, ...saved.garment },
  look: { ...PROFILE.look, ...saved.look },
  fabrics: JSON.parse(JSON.stringify({ ...FABRIC_DEFAULTS, ...saved.fabrics })),
  zari: saved.zari ?? true, dupatta: saved.dupatta ?? true, construction: saved.construction ?? 'sewn',
  part: 'kameez', shading: 'fabric', avatar: 'real', showGarment: true,
  focus: null, fit: null, x: null,
};
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ body: state.body, garment: state.garment, look: state.look, fabrics: state.fabrics, zari: state.zari, dupatta: state.dupatta, construction: state.construction })); } catch {} };

// ---------------- renderer / studio ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
{ // studio gradient backdrop
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#62666e'); grd.addColorStop(0.55, '#3d4046'); grd.addColorStop(1, '#232428');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
  scene.background = new THREE.CanvasTexture(c); scene.background.colorSpace = THREE.SRGBColorSpace;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(28, 1, 20, 2500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.autoRotateSpeed = 2.2;
const key = new THREE.DirectionalLight('#fff3e6', 2.4);
key.position.set(140, 280, 220); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -90, right: 90, top: 210, bottom: -10, near: 50, far: 800 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 5;
scene.add(key);
const fillL = new THREE.DirectionalLight('#d9e6ff', 0.7); fillL.position.set(-240, 140, 140); scene.add(fillL);
const rim = new THREE.DirectionalLight('#ffffff', 1.3); rim.position.set(-80, 240, -280); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(200, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(400, 40, '#6a6e76', '#4a4d54'); grid.position.y = 0.05;
grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);

// post-processing: ground-truth ambient occlusion for contact shadows in folds
let composer = null, gtao = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, 800, 600);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({ radius: 7, distanceExponent: 1.4, thickness: 4, scale: 1, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
} catch (e) { console.warn('AO disabled', e); composer = null; }

const texLoader = new THREE.TextureLoader();
const tex = (url, srgb = true) => { const t = texLoader.load(url); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const skin = new THREE.MeshPhysicalMaterial({ roughness: 0.5, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ff9a85'), clearcoat: 0.08, clearcoatRoughness: 0.45, specularIntensity: 0.5 });
const formMat = new THREE.MeshStandardMaterial({ color: '#bdb8b0', roughness: 0.75, metalness: 0 });
const eyeMat = new THREE.MeshPhysicalMaterial({ map: tex('assets/eye_brown.png'), alphaTest: 0.5, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });
const browMat = new THREE.MeshStandardMaterial({ map: tex('assets/eyebrows.png'), transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 0.9, side: THREE.DoubleSide });
const lashMat = new THREE.MeshStandardMaterial({ map: tex('assets/eyelashes.png'), transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 0.9, side: THREE.DoubleSide });
const hairMats = {};
const hairMat = (name) => hairMats[name] ||= new THREE.MeshStandardMaterial({ map: tex(`assets/hair_${name}.png`), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, color: '#6b5444' });
const skinTex = {};
const zari = zariMaterial(); installWrinkles(zari);
const heatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
const hiMat = new THREE.MeshStandardMaterial({ color: '#3d9cf0', emissive: '#12406e', roughness: 0.6, side: THREE.DoubleSide });
const mats = {};
function updateMaterials() {
  for (const part of ['kameez', 'salwar', 'cuff', 'dupatta']) mats[part] = applyFabric(mats[part], { ...state.fabrics[part], layer: part === 'salwar' || part === 'cuff' ? 'inner' : 'outer' });
  mats.trim = state.zari ? zari : mats.kameez;
}
updateMaterials();
const physFor = (part) => (FABRICS[state.fabrics[part].type] || FABRICS.cotton).phys;

let H, bodyMesh, proxyGroup, garmentGroup, guideGroup, guides = {}, B, collider, sim = null, simRunning = false;
const labelsEl = $('labels'), labelEls = {}, status = $('status');

function setView(dir) {
  const h = state.body.height;
  controls.target.set(0, h * 0.53, 0);
  const d = h * 2.55;
  const p = { front: [0, d], side: [d, 0], back: [0, -d], three: [d * 0.6, d * 0.8] }[dir];
  camera.position.set(p[0], h * 0.62, p[1]);
  controls.update();
}
const dispose = (g) => { if (!g) return; g.parent?.remove(g); g.traverse((o) => o.geometry?.dispose()); };

function geometryFrom(P, orig, uv, index, smoothNormals = true) {
  const n = orig.length, pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { const i = orig[k] * 3; pos[k * 3] = P[i]; pos[k * 3 + 1] = P[i + 1]; pos[k * 3 + 2] = P[i + 2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  if (!smoothNormals) { g.computeVertexNormals(); return g; }
  const acc = new Float32Array(P.length);
  for (let t = 0; t < index.length; t += 3) {
    const a = orig[index[t]] * 3, b = orig[index[t + 1]] * 3, c = orig[index[t + 2]] * 3;
    const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    for (const v of [a, b, c]) { acc[v] += nx; acc[v + 1] += ny; acc[v + 2] += nz; }
  }
  const nor = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const i = orig[k] * 3, l = Math.hypot(acc[i], acc[i + 1], acc[i + 2]) || 1;
    nor[k * 3] = acc[i] / l; nor[k * 3 + 1] = acc[i + 1] / l; nor[k * 3 + 2] = acc[i + 2] / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

// ---------------- body fitting ----------------
let fitTimer = null, lastLookKey = '';
function scheduleFit(immediate = false) {
  clearTimeout(fitTimer);
  status.textContent = 'Fitting avatar to measurements…';
  fitTimer = setTimeout(() => requestAnimationFrame(refit), immediate ? 0 : 280);
}

function refit() {
  const t0 = performance.now();
  const lookKey = state.look.sex + state.look.eth + state.look.shape;
  const fit = fitHuman(H, state.body, { sex: state.look.sex, eth: state.look.eth, shape: state.look.shape, x0: lookKey === lastLookKey ? state.x : null });
  lastLookKey = lookKey; state.fit = fit; state.x = fit.x;
  // measurements are fitted in the rest pose; then the rig poses the avatar
  const P = poseMesh(H, fit.P, state.look.pose, H.rig);
  const rawPosed = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { rawPosed[i] = P[i] / fit.scale; rawPosed[i + 1] = P[i + 1] / fit.scale + fit.floor; rawPosed[i + 2] = P[i + 2] / fit.scale; }
  B = bodyContext(H, P, H.labels, joints(H, P), fit.achieved);

  dispose(bodyMesh);
  const SKIN = { southasian: ['asian', '#f7dcc8'], asian: ['asian', '#ffffff'], caucasian: ['caucasian', '#ffffff'], african: ['african', '#ffffff'] };
  const [texEth, tint] = SKIN[state.look.eth] || SKIN.asian;
  const skey = `${state.look.sex}-${texEth}`;
  skin.map = skinTex[skey] ||= tex('assets/' + H.man.skins[skey]);
  skin.color.set(tint);
  skin.needsUpdate = true;
  bodyMesh = new THREE.Mesh(geometryFrom(P, H.body.orig, H.body.uv, H.body.index), skin);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  scene.add(bodyMesh);

  // collider: unique skin vertices + smooth normals
  const g = bodyMesh.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array;
  const seen = new Set(), cp = [], cn = [];
  H.body.orig.forEach((o, k) => { if (seen.has(o)) return; seen.add(o); cp.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); cn.push(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]); });
  collider = new BodyCollider(new Float32Array(cp), new Float32Array(cn));

  dispose(proxyGroup);
  proxyGroup = new THREE.Group();
  const addProxy = (name, mat, shadow = false) => {
    const p = H.proxies[name]; if (!p) return;
    const ppos = fitProxy(H, p, rawPosed, fit.scale, fit.floor);
    const n = p.refs.length / 3, ident = new Uint32Array(n).map((_, i) => i);
    const mesh = new THREE.Mesh(geometryFrom(ppos, ident, p.uv, p.index, false), mat);
    mesh.castShadow = shadow; mesh.renderOrder = mat.transparent ? 2 : 0;
    proxyGroup.add(mesh);
  };
  addProxy('eyes', eyeMat); addProxy('eyebrows', browMat); addProxy('eyelashes', lashMat);
  if (state.look.hair !== 'none') addProxy('hair-' + state.look.hair, hairMat(state.look.hair), true);
  scene.add(proxyGroup);
  applyAvatarMode();

  status.textContent = `Avatar fitted in ${Math.round(performance.now() - t0)} ms`;
  renderAchieved();
  rebuildGarment();
}

function applyAvatarMode() {
  if (!bodyMesh) return;
  bodyMesh.visible = state.avatar !== 'hide';
  bodyMesh.material = state.avatar === 'form' ? formMat : skin;
  if (proxyGroup) proxyGroup.visible = state.avatar === 'real';
}

// ---------------- garment + cloth simulation ----------------
function rebuildGarment({ drape = true } = {}) {
  if (!B) return;
  dispose(garmentGroup);
  const m = { ...state.body, waistHeight: B.achieved.waistHeight };
  const { group } = buildGarment(B, m, state.garment, mats, { kameez: physFor('kameez'), salwar: physFor('salwar'), dupatta: state.dupatta ? physFor('dupatta') : null, sewn: state.construction === 'sewn' });
  garmentGroup = group;
  garmentGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.fabricMat = o.material; } });
  garmentGroup.visible = state.showGarment;
  scene.add(garmentGroup);
  simRunning = false; worker?.postMessage({ type: 'stop' }); simToken++; simStarted = false;
  sim = new ClothSim(garmentGroup.children, collider);
  if (drape) startSim(); else applyShading();
  buildGuides();
  renderFit();
  renderPattern();
  persist();
}

// The solver runs in a Web Worker so orbiting stays smooth while the cloth drapes.
const SIM_PARAMS = { substeps: 4, iterations: 10, omega: 1.5, maxFrames: 150, rest: 0.09 };
const MAX_FRAMES = SIM_PARAMS.maxFrames;
let worker = null, simToken = 0, workerFailed = false;
function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL('./simworker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.token !== simToken || !sim) return;
      sim.X.set(m.X); sim.frame = m.frame; sim.motion = m.motion;
      sim.sync();
      if (m.frame % 6 === 0 || m.done) garmentGroup?.children.forEach((g) => computeWrinkles(g.geometry));
      if (state.shading !== 'fabric' && (m.frame % 6 === 0 || m.done)) applyShading();
      $('simbar').firstElementChild.style.width = Math.min(100, (m.frame / MAX_FRAMES) * 100) + '%';
      status.textContent = `Simulating · frame ${m.frame} · ${sim.n.toLocaleString()} particles`;
      if (m.done) { simRunning = false; updateSimBtn(); $('simbar').firstElementChild.style.width = '0'; applyShading(); status.textContent = `Draped · ${sim.n.toLocaleString()} particles · ${m.frame} frames`; }
    };
    worker.onerror = () => { workerFailed = true; worker = null; };
  } catch { workerFailed = true; }
  return worker;
}
let simStarted = false;
function startSim() {
  if (!sim) return;
  simRunning = true; updateSimBtn();
  const w = getWorker();
  if (!w) return; // fallback: main-thread ticks in simTick()
  if (!simStarted) { simToken++; simStarted = true; w.postMessage({ type: 'init', token: simToken, state: simState(sim), params: SIM_PARAMS }); }
  else w.postMessage({ type: 'resume' });
}
function stopSim() { simRunning = false; worker?.postMessage({ type: 'stop' }); updateSimBtn(); $('simbar').firstElementChild.style.width = '0'; applyShading(); }
function updateSimBtn() { const b = $('simBtn'); b.classList.toggle('on', simRunning); b.textContent = simRunning ? '❚❚ Pause' : '▶ Simulate'; }
function simTick() {
  if (!simRunning || !sim || (worker && !workerFailed)) return;
  const t0 = performance.now();
  do { sim.step(SIM_PARAMS); } while (performance.now() - t0 < 14 && sim.frame < MAX_FRAMES);
  sim.sync();
  if (state.shading !== 'fabric' && sim.frame % 6 === 0) applyShading();
  $('simbar').firstElementChild.style.width = Math.min(100, (sim.frame / MAX_FRAMES) * 100) + '%';
  status.textContent = `Simulating · frame ${sim.frame} · ${sim.n.toLocaleString()} particles`;
  if (sim.frame >= MAX_FRAMES || (sim.frame > 40 && sim.motion < SIM_PARAMS.rest)) { stopSim(); status.textContent = `Draped · ${sim.n.toLocaleString()} particles · ${sim.frame} frames`; }
}

function applyShading() {
  if (!garmentGroup) return;
  const mode = state.shading;
  if (mode !== 'fabric' && sim) sim.colorize(mode);
  garmentGroup.children.forEach((m) => { m.material = mode === 'fabric' ? m.userData.fabricMat : heatMat; });
  const lg = $('legend');
  if (mode === 'fabric') { lg.style.display = 'none'; return; }
  const L = LEGEND[mode], stops = L.stops, lo = stops[0][0], hi = stops[stops.length - 1][0];
  lg.style.display = 'block';
  lg.innerHTML = `<b>${L.title}</b><div class="bar" style="background:linear-gradient(90deg,${stops.map(([v, c]) => `${c} ${((v - lo) / (hi - lo)) * 100}%`).join(',')})"></div><div class="ticks">${L.labels.map((t) => `<span>${t}</span>`).join('')}</div>`;
}

function highlightPart(name) {
  if (!garmentGroup) return;
  const piece = !name ? null : /SLEEVE/.test(name) ? 'sleeve' : /^Kameez/.test(name) ? 'bodice' : /DUPATTA/.test(name) ? 'dupatta' : 'salwar';
  garmentGroup.children.forEach((m) => {
    const p = m.userData.part === 'salwar' ? 'salwar' : m.userData.piece;
    m.material = piece && p === piece ? hiMat : state.shading === 'fabric' ? m.userData.fabricMat : heatMat;
  });
}

// ---------------- measurement guides ----------------
function buildGuides() {
  dispose(guideGroup);
  guideGroup = new THREE.Group();
  const P = B.P, R = H.man.rulers;
  const pt = (i) => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const loop = (name) => {
    const pts = R[name].slice(0, -1).map(pt);
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    return { pts: pts.map((p) => p.clone().sub(c).multiplyScalar(1.025).add(c)), closed: true };
  };
  const line = (...ps) => ({ pts: ps, closed: false });
  const sh = H.shoulderPair.map(pt);
  const floorAt = (p) => new THREE.Vector3(p.x, 0, p.z);
  const waistSide = R['waist-circ'].map(pt).reduce((a, p) => (p.x > a.x ? p : a));
  const crotch = new THREE.Vector3(0, B.crotchY, B.J['pelvis'][2]);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const g = {
    height: line(V(-34, 0, 0), V(-34, state.body.height, 0)),
    neck: loop('neck-circ'), bust: loop('bust-circ'), underbust: loop('underbust-circ'), waist: loop('waist-circ'),
    hip: loop('hips-circ'), thigh: loop('thigh-circ'), knee: loop('knee-circ'), calf: loop('calf-circ'), ankle: loop('ankle-circ'),
    upperArm: loop('upperarm-circ'), wrist: loop('wrist-circ'),
    shoulder: line(sh[0].clone().add(V(0, 1, -3)), sh[1].clone().add(V(0, 1, -3))),
    armLength: line(...[R['upperarm-length'][0], R['upperarm-length'][1], R['lowerarm-length'][1]].map(pt).map((p) => p.add(V(0, 0, 4)))),
    backLength: line(...R['napetowaist-dist'].map(pt).map((p) => p.add(V(0, 0, -1.5)))),
    waistToHip: line(...R['waisttohip-dist'].map(pt).map((p) => p.add(V(1.5, 0, 0)))),
    waistHeight: line(waistSide.clone().add(V(10, 0, 0)), floorAt(waistSide).add(V(10, 0, 0))),
    inseam: line(crotch.clone().add(V(0, -0.5, 0)), floorAt(crotch)),
  };
  guides = {};
  for (const [k, gd] of Object.entries(g)) {
    const hi = k === state.focus;
    const curve = new THREE.CatmullRomCurve3(gd.pts, gd.closed, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, gd.closed ? 160 : 40, hi ? 0.45 : 0.25, 8, gd.closed),
      new THREE.MeshBasicMaterial({ color: hi ? '#ff2d78' : '#3d9cf0', depthTest: !hi, transparent: true, opacity: hi ? 1 : 0.9 }));
    mesh.renderOrder = hi ? 20 : 5;
    guideGroup.add(mesh);
    const anchor = gd.closed ? gd.pts.reduce((a, p) => (p.x > a.x ? p : a)).clone().add(V(6, 0, 0)) : curve.getPoint(k === 'height' ? 0.92 : 0.5);
    guides[k] = { anchor, back: !gd.closed && (k === 'backLength' || k === 'shoulder') };
  }
  guideGroup.visible = $('vGuides').checked && activeTab === 'body';
  scene.add(guideGroup);
  updateLabels(true);
}

function updateLabels(refresh) {
  const show = guideGroup?.visible;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const f of BODY_FIELDS) {
    let el = labelEls[f.key];
    if (!el) { el = labelEls[f.key] = document.createElement('div'); el.className = 'lbl'; labelsEl.appendChild(el); }
    const gd = guides[f.key];
    if (!show || !gd) { el.style.display = 'none'; continue; }
    if (refresh) el.textContent = `${f.label}: ${state.body[f.key]}`;
    const hi = f.key === state.focus;
    el.classList.toggle('hi', hi);
    const p = gd.anchor.clone().project(camera);
    const visible = p.z < 1 && (hi || (!state.focus && (!gd.back || camera.position.z < 0)));
    el.style.display = visible ? '' : 'none';
    el.style.left = ((p.x + 1) / 2) * w + 'px';
    el.style.top = ((1 - p.y) / 2) * h + 'px';
  }
}

function renderAchieved() {
  for (const f of BODY_FIELDS) {
    const el = document.querySelector(`.row[data-key="${f.key}"] .got`);
    if (!el || !state.fit) continue;
    const a = state.fit.achieved[f.key];
    if (a === undefined) { el.textContent = ''; continue; }
    const off = a - state.body[f.key];
    el.textContent = f.key === 'waistHeight' ? a.toFixed(1) : Math.abs(off) < 0.6 ? '✓' : `${off > 0 ? '+' : ''}${off.toFixed(1)}`;
    el.className = 'got ' + (f.key === 'waistHeight' ? '' : Math.abs(off) < 0.6 ? 'ok' : Math.abs(off) < 2 ? 'warn' : 'bad');
    el.title = `Avatar measures ${a.toFixed(1)} cm`;
  }
}

function renderFit() {
  const rows = fitReport(state.body, state.garment);
  $('fit').innerHTML = `<b>Fit check</b><table><tr><th></th><th>Body</th><th>Garment</th><th>Ease</th><th></th></tr>${rows
    .map((r) => `<tr><td>${r.label}</td><td>${r.body.toFixed(1)}</td><td>${r.garment.toFixed(1)}</td><td>${r.ease >= 0 ? '+' : ''}${r.ease.toFixed(1)}</td><td class="${r.cls}">${r.status}</td></tr>`)
    .join('')}</table>`;
}

// ---------------- 2D pattern window ----------------
let lastSvg = '', patTimer = null;
const patternInputs = () => draftPattern({ ...state.body, waistHeight: B ? B.achieved.waistHeight : state.body.waistHeight }, state.garment);
function fabricFills() {
  const fills = {};
  for (const part of ['kameez', 'salwar', 'cuff', 'dupatta']) {
    const f = state.fabrics[part], src = printCanvas(f.print, f.ground, f.accent, f.accent2), c = document.createElement('canvas');
    c.width = c.height = 256; c.getContext('2d').drawImage(src, 0, 0, 256, 256);
    fills[part] = { url: c.toDataURL('image/jpeg', 0.85), scale: f.print === 'solid' ? 50 : f.scale };
  }
  return fills;
}
function renderPattern() {
  clearTimeout(patTimer);
  patTimer = setTimeout(() => {
    const pieces = patternInputs();
    $('patPrev').innerHTML = patternSVG(pieces, { dark: true, fills: fabricFills() }).replace(/^<\?xml[^>]*>/, '');
    $('pieces').innerHTML = `<table>${pieces.map((p) => {
      const xs = p.cut.map((q) => q[0]), ys = p.cut.map((q) => q[1]);
      return `<tr data-name="${p.name}"><td>${p.name}</td><td>${(Math.max(...xs) - Math.min(...xs)).toFixed(1)} × ${(Math.max(...ys) - Math.min(...ys)).toFixed(1)} cm</td></tr>`;
    }).join('')}</table>`;
    for (const el of document.querySelectorAll('#patPrev .piece, #pieces tr')) {
      el.addEventListener('mouseenter', () => highlightPart(el.dataset.name));
      el.addEventListener('mouseleave', () => highlightPart(null));
    }
  }, 60);
}

// ---------------- UI: fields ----------------
let activeTab = 'body';
function buildFields(container, fields, obj, helpEl, isBody) {
  container.innerHTML = '';
  for (const f of fields) {
    if (f.group) { const gEl = document.createElement('div'); gEl.className = 'grp'; gEl.textContent = f.group; container.appendChild(gEl); }
    const row = document.createElement('div'); row.className = 'row' + (isBody ? '' : ' g'); row.dataset.key = f.key;
    const unit = f.key === 'fullness' ? '×' : f.key === 'pleats' ? '#' : 'cm';
    row.innerHTML = `<label for="f-${f.key}">${f.label}</label><input id="f-${f.key}" type="number" step="${f.step ?? 0.5}" min="0" value="${obj[f.key]}"><span>${unit}</span>${isBody ? '<em class="got"></em>' : ''}`;
    const input = row.querySelector('input');
    input.addEventListener('focus', () => {
      container.querySelectorAll('.row').forEach((r) => r.classList.toggle('focus', r === row));
      helpEl.innerHTML = `<b>${f.label}</b><br>${f.help}`;
      if (isBody) { state.focus = f.key; if (B) buildGuides(); }
    });
    row.addEventListener('click', () => input.focus());
    let t = null;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!isFinite(v) || v <= 0) return;
      obj[f.key] = v;
      if (isBody) scheduleFit();
      else { clearTimeout(t); t = setTimeout(() => rebuildGarment(), 200); }
    });
    container.appendChild(row);
  }
  if (isBody) renderAchieved();
}

// ---------------- UI: fabric library ----------------
function renderFabricPanel() {
  const spec = state.fabrics[state.part];
  $('partChips').innerHTML = '';
  for (const part of ['kameez', 'salwar', 'cuff', 'dupatta']) {
    const b = document.createElement('button');
    b.className = part === state.part ? 'on' : '';
    b.append(swatch(state.fabrics[part], 36), part === 'cuff' ? 'Cuffs' : part[0].toUpperCase() + part.slice(1));
    b.onclick = () => { state.part = part; renderFabricPanel(); };
    $('partChips').appendChild(b);
  }
  const lib = $('fabricLib'); lib.innerHTML = '';
  for (const [k, F] of Object.entries(FABRICS)) {
    const c = document.createElement('div'); c.className = 'card' + (spec.type === k ? ' on' : '');
    c.append(swatch({ ...spec, type: k, print: 'solid' }, 96));
    c.insertAdjacentHTML('beforeend', `${F.name}<small>${F.gsm} g/m²</small>`);
    c.onclick = () => { spec.type = k; fabricChanged(true); };
    lib.appendChild(c);
  }
  const F = FABRICS[spec.type];
  $('fabricProps').innerHTML = `<span>Weight</span><b>${F.gsm} g/m²</b><span>Bending stiffness</span><b>${Math.round(F.phys.bend * 100)}</b><span>Friction</span><b>${F.phys.friction}</b><span>Thread count</span><b>${F.threadsPerCm}/cm</b>`;
  const pl = $('printLib'); pl.innerHTML = '';
  for (const [k, name] of Object.entries(PRINTS)) {
    const c = document.createElement('div'); c.className = 'card' + (spec.print === k ? ' on' : '');
    c.append(swatch({ ...spec, print: k }, 96)); c.insertAdjacentHTML('beforeend', name);
    c.onclick = () => { spec.print = k; fabricChanged(false); };
    pl.appendChild(c);
  }
  $('colGround').value = spec.ground; $('colAccent').value = spec.accent; $('colAccent2').value = spec.accent2;
  $('printScale').value = spec.scale; $('printScaleVal').textContent = spec.scale + ' cm';
  $('zari').checked = state.zari; $('dupattaOn').checked = state.dupatta;
}
let colorTimer = null;
function fabricChanged(physics) {
  updateMaterials();
  if (garmentGroup) garmentGroup.children.forEach((m) => {
    m.userData.fabricMat = m.userData.part === 'salwar' ? [mats.salwar, mats.cuff] : m.userData.part === 'dupatta' ? [mats.dupatta, mats.trim] : [mats.kameez, mats.trim];
  });
  applyShading();
  renderFabricPanel();
  renderPattern();
  persist();
  if (physics) rebuildGarment();
}
for (const [id, keyName] of [['colGround', 'ground'], ['colAccent', 'accent'], ['colAccent2', 'accent2']])
  $(id).addEventListener('input', (e) => { state.fabrics[state.part][keyName] = e.target.value; clearTimeout(colorTimer); colorTimer = setTimeout(() => fabricChanged(false), 60); });
$('printScale').addEventListener('input', (e) => { state.fabrics[state.part].scale = +e.target.value; $('printScaleVal').textContent = e.target.value + ' cm'; updateMaterials(); renderPattern(); persist(); });
$('construction').addEventListener('change', (e) => { state.construction = e.target.value; rebuildGarment(); persist(); });
$('dupattaOn').addEventListener('change', (e) => { state.dupatta = e.target.checked; rebuildGarment(); persist(); });
$('zari').addEventListener('change', (e) => { state.zari = e.target.checked; updateMaterials(); rebuildGarment({ drape: false }); persist(); });

// ---------------- UI: wiring ----------------
const renderForms = () => {
  buildFields($('bodyFields'), BODY_FIELDS, state.body, $('helpBody'), true);
  buildFields($('garmentFields'), GARMENT_FIELDS, state.garment, $('helpGarment'), false);
  for (const k of ['sex', 'eth', 'hair', 'shape', 'pose']) $('look-' + k).value = state.look[k];
  $('construction').value = state.construction;
  renderFabricPanel();
};
for (const k of ['sex', 'eth', 'hair', 'shape', 'pose']) $('look-' + k).addEventListener('change', (e) => { state.look[k] = e.target.value; k === 'hair' || k === 'pose' ? refit() : scheduleFit(true); persist(); });

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + b.dataset.tab));
  activeTab = b.dataset.tab;
  if (activeTab !== 'body') state.focus = null;
  if (B) buildGuides();
}));
$('vGuides').addEventListener('change', () => B && buildGuides());
document.querySelectorAll('#shading button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#shading button').forEach((x) => x.classList.toggle('on', x === b));
  state.shading = b.dataset.v; applyShading();
}));
$('avatarMode').addEventListener('change', (e) => { state.avatar = e.target.value; applyAvatarMode(); });
$('vGarmentBtn').addEventListener('click', () => {
  state.showGarment = !state.showGarment;
  if (garmentGroup) garmentGroup.visible = state.showGarment;
  $('vGarmentBtn').textContent = 'Garment ' + (state.showGarment ? '✓' : '✗');
});
document.querySelectorAll('#views button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
$('turn').addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; $('turn').classList.toggle('on', controls.autoRotate); });
$('simBtn').addEventListener('click', () => (simRunning ? stopSim() : (sim && !worker && sim.frame >= MAX_FRAMES && (sim.frame = 0), startSim())));
$('resetDrape').addEventListener('click', () => rebuildGarment());
$('toggle2d').addEventListener('click', () => { document.body.classList.toggle('no2d'); $('toggle2d').classList.toggle('on'); setTimeout(resize, 0); });
addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); $('simBtn').click(); } });

// Downloads: inside a claude.ai Artifact use the platform's save dialog; otherwise a normal browser download.
let artifactDownloads = null;
if (window.claude?.use) window.claude.use('downloads').then((d) => { artifactDownloads = d; if (d) $('printPat').hidden = true; }).catch(() => {});
async function download(name, data, type) {
  if (artifactDownloads) {
    try { await artifactDownloads.save({ filename: name, data: data instanceof Blob ? data : new Blob([data], { type }) }); status.textContent = `Saved ${name}`; }
    catch (e) { status.textContent = e?.code === 'declined' ? 'Save cancelled' : `Could not save ${name}`; }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  a.download = name; a.click();
}
$('snap').addEventListener('click', () => { render(); canvas.toBlob((b) => b && download('fit-studio-render.png', b, 'image/png'), 'image/png'); });
$('resetBody').addEventListener('click', () => { Object.assign(state.body, BODY_START); renderForms(); scheduleFit(true); setView('front'); });
$('resetGarment').addEventListener('click', () => { Object.assign(state.garment, GARMENT_START); renderForms(); rebuildGarment(); });
$('saveJson').addEventListener('click', () => download('body-profile.json', JSON.stringify({ body: state.body, garment: state.garment, look: state.look, fabrics: state.fabrics }, null, 2), 'application/json'));
$('loadJson').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    Object.assign(state.body, d.body || {}); Object.assign(state.garment, d.garment || {}); Object.assign(state.look, d.look || {});
    if (d.fabrics) Object.assign(state.fabrics, d.fabrics);
    updateMaterials(); renderForms(); scheduleFit(true);
  } catch { alert('Could not read that profile file.'); }
});
$('dlSvg').addEventListener('click', () => { lastSvg = patternSVG(patternInputs()); download('patiala-pattern.svg', lastSvg, 'image/svg+xml'); });
$('dlSpec').addEventListener('click', () => download('patiala-spec.json', JSON.stringify({ body: state.body, avatarMeasured: state.fit?.achieved, garment: state.garment, fabrics: state.fabrics, fit: fitReport(state.body, state.garment), pieces: patternInputs() }, null, 2), 'application/json'));
$('printPat').addEventListener('click', () => {
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Pattern</title><style>@page{margin:0}body{margin:0}</style></head><body>${patternSVG(patternInputs()).replace(/^<\?xml[^>]*>/, '')}</body></html>`);
  w.document.close(); w.focus(); w.print();
});

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) composer.setSize(w, h);
}
addEventListener('resize', resize);
function render() { composer ? composer.render() : renderer.render(scene, camera); }

renderForms();
resize();
setView('front');
renderer.setAnimationLoop(() => { controls.update(); simTick(); render(); updateLabels(false); });
H = await loadHuman('assets/');
refit();
document.body.classList.add('ready');
window.__studio = { state, refit, setView, zoom: (tx, ty, tz, px, py, pz) => { controls.target.set(tx, ty, tz); camera.position.set(px, py, pz); controls.update(); }, get B() { return B; }, get garment() { return garmentGroup; }, get sim() { return sim; }, get simRunning() { return simRunning; } };
