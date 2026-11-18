import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { BODY_FIELDS, BODY_DEFAULTS } from './body.js';
import { GARMENT_FIELDS, GARMENT_DEFAULTS, buildGarment, bodyContext, fitReport } from './garment.js';
import { draftPattern, patternSVG } from './pattern.js';
import { loadHuman, fitHuman, joints, fitProxy } from './human.js';
import { fabricTextures } from './fabric.js';

const STORE = 'mannequin-fit-studio-v2';
const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } })();
const state = {
  body: { ...BODY_DEFAULTS, ...saved.body },
  garment: { ...GARMENT_DEFAULTS, ...saved.garment },
  look: { sex: 'female', eth: 'asian', hair: 'long01', ...saved.look },
  focus: null, fit: null, x: null,
};
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ body: state.body, garment: state.garment, look: state.look })); } catch {} };

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9e4de');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.4;
const camera = new THREE.PerspectiveCamera(28, 1, 20, 2500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const key = new THREE.DirectionalLight('#fff4ea', 2.2);
key.position.set(120, 260, 200); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -80, right: 80, top: 200, bottom: -10, near: 50, far: 700 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight('#dfe8ff', 0.6); fill.position.set(-220, 120, 120); scene.add(fill);
const rim = new THREE.DirectionalLight('#ffffff', 1.0); rim.position.set(-60, 220, -260); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const texLoader = new THREE.TextureLoader();
const tex = (url, srgb = true) => { const t = texLoader.load(url); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

const skin = new THREE.MeshPhysicalMaterial({ roughness: 0.52, sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ff9a85'), clearcoat: 0.06, clearcoatRoughness: 0.5, specularIntensity: 0.45 });
const fab = fabricTextures();
const mats = {
  kameez: new THREE.MeshPhysicalMaterial({ color: '#b0174f', map: fab.print, normalMap: fab.weave, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.78, sheen: 0.8, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffd0e0'), side: THREE.DoubleSide, transparent: true }),
  salwar: new THREE.MeshPhysicalMaterial({ color: '#f1c232', normalMap: fab.weave, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.6, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#fff2c0'), side: THREE.DoubleSide, transparent: true }),
  cuff: new THREE.MeshPhysicalMaterial({ color: '#b0174f', map: fab.print, normalMap: fab.weave, roughness: 0.7, sheen: 0.8, side: THREE.DoubleSide, transparent: true }),
  trim: new THREE.MeshPhysicalMaterial({ color: '#d4a42a', map: fab.zari, roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide, transparent: true }),
};
const eyeMat = new THREE.MeshPhysicalMaterial({ map: tex('assets/eye_brown.png'), alphaTest: 0.5, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });
const browMat = new THREE.MeshStandardMaterial({ map: tex('assets/eyebrows.png'), transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 0.9, side: THREE.DoubleSide });
const lashMat = new THREE.MeshStandardMaterial({ map: tex('assets/eyelashes.png'), transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 0.9, side: THREE.DoubleSide });
const hairMats = {};
const hairMat = (name) => hairMats[name] ||= new THREE.MeshStandardMaterial({ map: tex(`assets/hair_${name}.png`), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55, color: '#6b5444' });
const skinTex = {};

let H, bodyMesh, proxyGroup, garmentGroup, guideGroup, guides = {}, B;
const labelsEl = document.getElementById('labels');
const labelEls = {};
const status = document.getElementById('status');

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
  // normals accumulated on original vertices so UV seams stay invisible
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

// ---------- fitting + building ----------
let fitTimer = null, lastLookKey = '';
function scheduleFit(immediate = false) {
  clearTimeout(fitTimer);
  status.textContent = 'Fitting body to measurements…';
  fitTimer = setTimeout(() => requestAnimationFrame(() => { refit(); }), immediate ? 0 : 280);
}

function refit() {
  const t0 = performance.now();
  const lookKey = state.look.sex + state.look.eth;
  const fit = fitHuman(H, state.body, { sex: state.look.sex, eth: state.look.eth, x0: lookKey === lastLookKey ? state.x : null });
  lastLookKey = lookKey;
  state.fit = fit; state.x = fit.x;
  const P = fit.P;
  const J = joints(H, P);
  B = bodyContext(H, P, H.labels, J, fit.achieved);

  // body
  dispose(bodyMesh);
  const skey = `${state.look.sex}-${state.look.eth}`;
  skin.map = skinTex[skey] ||= tex('assets/' + H.man.skins[skey]);
  skin.needsUpdate = true;
  bodyMesh = new THREE.Mesh(geometryFrom(P, H.body.orig, H.body.uv, H.body.index), skin);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  scene.add(bodyMesh);

  // eyes, brows, lashes, hair
  dispose(proxyGroup);
  proxyGroup = new THREE.Group();
  const addProxy = (name, mat, shadow = false) => {
    const p = H.proxies[name]; if (!p) return;
    const pos = fitProxy(H, p, fit.rawP, fit.scale, fit.floor);
    const n = p.refs.length / 3, ident = new Uint32Array(n).map((_, i) => i);
    const mesh = new THREE.Mesh(geometryFrom(pos, ident, p.uv, p.index, false), mat);
    mesh.castShadow = shadow; mesh.renderOrder = mat.transparent ? 2 : 0;
    proxyGroup.add(mesh);
  };
  addProxy('eyes', eyeMat); addProxy('eyebrows', browMat); addProxy('eyelashes', lashMat);
  if (state.look.hair !== 'none') addProxy('hair-' + state.look.hair, hairMat(state.look.hair), true);
  scene.add(proxyGroup);

  status.textContent = `Body fitted in ${Math.round(performance.now() - t0)} ms`;
  renderAchieved();
  rebuildGarment();
}

function rebuildGarment() {
  if (!B) return;
  dispose(garmentGroup);
  const m = { ...state.body, waistHeight: B.achieved.waistHeight };
  const { group } = buildGarment(B, m, state.garment, mats);
  garmentGroup = group;
  garmentGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  garmentGroup.visible = document.getElementById('vGarment').checked;
  scene.add(garmentGroup);
  buildGuides();
  renderFit();
  if (document.getElementById('pane-pattern').classList.contains('on')) renderPattern();
  persist();
}

// ---------- measurement guides (tape lines on the skin) ----------
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
  const g = {
    height: line(new THREE.Vector3(-34, 0, 0), new THREE.Vector3(-34, state.body.height, 0)),
    neck: loop('neck-circ'), bust: loop('bust-circ'), underbust: loop('underbust-circ'), waist: loop('waist-circ'),
    hip: loop('hips-circ'), thigh: loop('thigh-circ'), knee: loop('knee-circ'), calf: loop('calf-circ'), ankle: loop('ankle-circ'),
    upperArm: loop('upperarm-circ'), wrist: loop('wrist-circ'),
    shoulder: line(sh[0].clone().add(new THREE.Vector3(0, 1, -3)), sh[1].clone().add(new THREE.Vector3(0, 1, -3))),
    armLength: line(...[R['upperarm-length'][0], R['upperarm-length'][1], R['lowerarm-length'][1]].map(pt).map((p) => p.add(new THREE.Vector3(0, 0, 4)))),
    backLength: line(...R['napetowaist-dist'].map(pt).map((p) => p.add(new THREE.Vector3(0, 0, -1.5)))),
    waistToHip: line(...R['waisttohip-dist'].map(pt).map((p) => p.add(new THREE.Vector3(1.5, 0, 0)))),
    waistHeight: line(waistSide.clone().add(new THREE.Vector3(10, 0, 0)), floorAt(waistSide).add(new THREE.Vector3(10, 0, 0))),
    inseam: line(crotch.clone().add(new THREE.Vector3(0, -0.5, 0)), floorAt(crotch)),
  };
  guides = {};
  for (const [k, gd] of Object.entries(g)) {
    const hi = k === state.focus;
    const curve = new THREE.CatmullRomCurve3(gd.pts, gd.closed, 'centripetal');
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, gd.closed ? 160 : 40, hi ? 0.45 : 0.25, 8, gd.closed),
      new THREE.MeshBasicMaterial({ color: hi ? '#e91e63' : '#1e88e5', depthTest: hi ? false : true, transparent: true, opacity: hi ? 1 : 0.9 }));
    mesh.renderOrder = hi ? 20 : 5;
    guideGroup.add(mesh);
    const back = gd.closed ? null : k === 'backLength' || k === 'shoulder';
    const anchor = gd.closed ? gd.pts.reduce((a, p) => (p.x > a.x ? p : a)).clone().add(new THREE.Vector3(6, 0, 0)) : curve.getPoint(k === 'height' ? 0.92 : 0.5);
    guides[k] = { anchor, back };
  }
  guideGroup.visible = document.getElementById('vGuides').checked;
  scene.add(guideGroup);
  updateLabels(true);
}

function updateLabels(refresh) {
  const show = document.getElementById('vGuides').checked;
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
    const facingBack = camera.position.z < 0;
    el.style.display = p.z < 1 && (hi || !state.focus || false) && (hi || gd.back === null || gd.back === facingBack || !gd.back) ? '' : 'none';
    if (state.focus && !hi) el.style.display = 'none';
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
    el.textContent = f.key === 'waistHeight' ? `model ${a.toFixed(1)}` : Math.abs(off) < 0.6 ? '✓' : `${off > 0 ? '+' : ''}${off.toFixed(1)}`;
    el.className = 'got ' + (f.key === 'waistHeight' ? '' : Math.abs(off) < 0.6 ? 'ok' : Math.abs(off) < 2 ? 'warn' : 'bad');
    el.title = `Model measures ${a.toFixed(1)} cm`;
  }
}

function renderFit() {
  const rows = fitReport(state.body, state.garment);
  document.getElementById('fit').innerHTML = `<b>Fit check</b><table><tr><th></th><th>Body</th><th>Garment</th><th>Ease</th><th></th></tr>${rows
    .map((r) => `<tr><td>${r.label}</td><td>${r.body.toFixed(1)}</td><td>${r.garment.toFixed(1)}</td><td>${r.ease >= 0 ? '+' : ''}${r.ease.toFixed(1)}</td><td class="${r.cls}">${r.status}</td></tr>`)
    .join('')}</table>`;
}

let lastSvg = '';
function renderPattern() {
  const m = { ...state.body, waistHeight: B ? B.achieved.waistHeight : state.body.waistHeight };
  lastSvg = patternSVG(draftPattern(m, state.garment));
  document.getElementById('patPrev').innerHTML = lastSvg.replace(/^<\?xml[^>]*>/, '');
}

// ---------- UI ----------
function buildFields(container, fields, obj, helpEl, isBody) {
  container.innerHTML = '';
  for (const f of fields) {
    if (f.group) { const gEl = document.createElement('div'); gEl.className = 'grp'; gEl.textContent = f.group; container.appendChild(gEl); }
    const row = document.createElement('div'); row.className = 'row'; row.dataset.key = f.key;
    const unit = f.key === 'fullness' ? '×' : f.key === 'pleats' ? '#' : 'cm';
    row.innerHTML = `<label for="f-${f.key}">${f.label}</label><input id="f-${f.key}" type="number" step="${f.step ?? 0.5}" min="0" value="${obj[f.key]}"><span>${unit}</span>${isBody ? '<em class="got"></em>' : ''}`;
    const input = row.querySelector('input');
    input.addEventListener('focus', () => {
      container.querySelectorAll('.row').forEach((r) => r.classList.toggle('focus', r === row));
      helpEl.innerHTML = `<b>${f.label}</b><br>${f.help}`;
      if (isBody) { state.focus = f.key; if (B) buildGuides(); }
    });
    row.addEventListener('click', () => input.focus());
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!isFinite(v) || v <= 0) return;
      obj[f.key] = v;
      isBody ? scheduleFit() : rebuildGarment();
    });
    container.appendChild(row);
  }
  if (isBody) renderAchieved();
}
const renderForms = () => {
  buildFields(document.getElementById('bodyFields'), BODY_FIELDS, state.body, document.getElementById('helpBody'), true);
  buildFields(document.getElementById('garmentFields'), GARMENT_FIELDS, state.garment, document.getElementById('helpGarment'), false);
  for (const k of ['sex', 'eth', 'hair']) document.getElementById('look-' + k).value = state.look[k];
};
for (const k of ['sex', 'eth', 'hair']) document.getElementById('look-' + k).addEventListener('change', (e) => { state.look[k] = e.target.value; k === 'hair' ? refit() : scheduleFit(true); persist(); });

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + b.dataset.tab));
  const tab = b.dataset.tab;
  const vg = document.getElementById('vGarment'), vgu = document.getElementById('vGuides');
  if (tab === 'body') { vg.checked = false; vgu.checked = true; } else { vg.checked = true; vgu.checked = false; state.focus = null; }
  applyVisibility();
  if (tab === 'pattern') renderPattern();
  buildGuides();
}));
function applyVisibility() {
  if (garmentGroup) garmentGroup.visible = document.getElementById('vGarment').checked;
  if (guideGroup) guideGroup.visible = document.getElementById('vGuides').checked;
  updateLabels(true);
}
document.getElementById('vGuides').addEventListener('change', applyVisibility);
document.getElementById('vGarment').addEventListener('change', applyVisibility);
document.getElementById('vOpacity').addEventListener('input', (e) => Object.values(mats).forEach((m) => { m.opacity = +e.target.value; m.depthWrite = +e.target.value > 0.95; }));
document.getElementById('cKameez').addEventListener('input', (e) => { mats.kameez.color.set(e.target.value); mats.cuff.color.set(e.target.value); });
document.getElementById('cSalwar').addEventListener('input', (e) => mats.salwar.color.set(e.target.value));
for (const d of ['Front', 'Side', 'Back']) document.getElementById('v' + d).addEventListener('click', () => setView(d.toLowerCase()));

const download = (name, text, type) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
document.getElementById('resetBody').addEventListener('click', () => { Object.assign(state.body, BODY_DEFAULTS); renderForms(); scheduleFit(true); setView('front'); });
document.getElementById('resetGarment').addEventListener('click', () => { Object.assign(state.garment, GARMENT_DEFAULTS); renderForms(); rebuildGarment(); });
document.getElementById('saveJson').addEventListener('click', () => download('body-profile.json', JSON.stringify({ body: state.body, garment: state.garment, look: state.look }, null, 2), 'application/json'));
document.getElementById('loadJson').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try { const d = JSON.parse(await file.text()); Object.assign(state.body, d.body || {}); Object.assign(state.garment, d.garment || {}); Object.assign(state.look, d.look || {}); renderForms(); scheduleFit(true); }
  catch { alert('Could not read that profile file.'); }
});
document.getElementById('dlSvg').addEventListener('click', () => { renderPattern(); download('patiala-pattern.svg', lastSvg, 'image/svg+xml'); });
document.getElementById('dlSpec').addEventListener('click', () => download('patiala-spec.json', JSON.stringify({ body: state.body, modelMeasured: state.fit?.achieved, garment: state.garment, fit: fitReport(state.body, state.garment), pieces: draftPattern({ ...state.body, waistHeight: B?.achieved.waistHeight ?? state.body.waistHeight }, state.garment) }, null, 2), 'application/json'));
document.getElementById('printPat').addEventListener('click', () => {
  renderPattern();
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Pattern</title><style>@page{margin:0}body{margin:0}</style></head><body>${lastSvg.replace(/^<\?xml[^>]*>/, '')}</body></html>`);
  w.document.close(); w.focus(); w.print();
});

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

renderForms();
resize();
setView('front');
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); updateLabels(false); });
status.textContent = 'Loading realistic body model…';
H = await loadHuman('assets/');
refit();
document.body.classList.add('ready');
window.__studio = { state, refit, setView, get B() { return B; }, get garment() { return garmentGroup; } };
