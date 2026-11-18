import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { BODY_FIELDS, BODY_DEFAULTS, bodyModel, buildBody, bodyGuides } from './body.js';
import { GARMENT_FIELDS, GARMENT_DEFAULTS, buildGarment, fitReport } from './garment.js';
import { draftPattern, patternSVG } from './pattern.js';
import { ellipseLine } from './geometry.js';

const STORE = 'mannequin-fit-studio-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const saved = load();
const state = {
  body: { ...BODY_DEFAULTS, ...saved.body },
  garment: { ...GARMENT_DEFAULTS, ...saved.garment },
  focus: null,
};
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ body: state.body, garment: state.garment })); } catch {} };

// ---------- Three setup ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ece7e1');
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight('#ffffff', '#b9a99a', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.8); sun.position.set(150, 300, 250); scene.add(sun);
const rim = new THREE.DirectionalLight('#ffe6d0', 0.8); rim.position.set(-200, 150, -200); scene.add(rim);
const grid = new THREE.GridHelper(200, 20, '#c9bfb4', '#ddd5cc'); scene.add(grid);

const skin = new THREE.MeshStandardMaterial({ color: '#d8b49a', roughness: 0.75 });
const mats = {
  kameez: new THREE.MeshStandardMaterial({ color: '#c2185b', roughness: 0.85, side: THREE.DoubleSide, transparent: true }),
  salwar: new THREE.MeshStandardMaterial({ color: '#f3c623', roughness: 0.9, side: THREE.DoubleSide, transparent: true }),
  cuff: new THREE.MeshStandardMaterial({ color: '#c2185b', roughness: 0.8, transparent: true }),
  trim: new THREE.MeshStandardMaterial({ color: '#d4a017', roughness: 0.4, metalness: 0.5, transparent: true }),
};

let bodyGroup, garmentGroup, guideGroup, guides = {}, bm;
const labelsEl = document.getElementById('labels');
const labelEls = {};

function setView(dir) {
  const H = state.body.height;
  controls.target.set(0, H * 0.52, 0);
  const d = H * 2.3;
  const p = { front: [0, 0, d], side: [d, 0, 0], back: [0, 0, -d] }[dir];
  camera.position.set(p[0], H * 0.6, p[2]);
  controls.update();
}

function disposeGroup(g) { if (!g) return; scene.remove(g); g.traverse((o) => o.geometry && o.geometry.dispose()); }

function rebuild() {
  const m = state.body, g = state.garment;
  bm = bodyModel(m);
  disposeGroup(bodyGroup); disposeGroup(garmentGroup); disposeGroup(guideGroup);
  bodyGroup = buildBody(bm, skin); scene.add(bodyGroup);
  garmentGroup = buildGarment(bm, m, g, mats); scene.add(garmentGroup);
  garmentGroup.visible = document.getElementById('vGarment').checked;

  guideGroup = new THREE.Group(); guideGroup.renderOrder = 10;
  guides = bodyGuides(bm, m);
  for (const [key, gd] of Object.entries(guides)) {
    const hi = key === state.focus;
    const color = hi ? '#c2185b' : '#1565c0';
    let obj, anchor;
    if (gd.ring) {
      obj = ellipseLine(gd.ring, color, garmentGroup.visible ? 3 : 0.6);
      anchor = new THREE.Vector3(gd.ring.x + (gd.ring.x >= 0 ? 1 : -1) * (gd.ring.rx + 4) + (gd.ring.x === 0 ? gd.ring.rx * 0 : 0), gd.ring.y, gd.ring.z + gd.ring.rz);
      if (gd.ring.x === 0) anchor.set(-(gd.ring.rx + 8), gd.ring.y, 0);
    } else {
      const [a, b] = gd.line.map((p) => new THREE.Vector3(...p));
      obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
      anchor = a.clone().lerp(b, gd.at ?? 0.5);
    }
    obj.material.opacity = hi ? 1 : 0.7;
    obj.renderOrder = 10;
    guideGroup.add(obj);
    gd.anchor = anchor;
  }
  guideGroup.visible = document.getElementById('vGuides').checked;
  scene.add(guideGroup);
  updateLabels(true);
  renderFit();
  if (document.getElementById('pane-pattern').classList.contains('on')) renderPattern();
  persist();
}

function updateLabels(rebuildEls) {
  const show = document.getElementById('vGuides').checked;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const f of BODY_FIELDS) {
    let el = labelEls[f.key];
    if (!el) { el = labelEls[f.key] = document.createElement('div'); el.className = 'lbl'; labelsEl.appendChild(el); }
    const gd = guides[f.key];
    if (!show || !gd) { el.style.display = 'none'; continue; }
    if (rebuildEls) el.textContent = `${f.label}: ${state.body[f.key]}`;
    el.classList.toggle('hi', f.key === state.focus);
    const p = gd.anchor.clone().project(camera);
    const visible = p.z < 1 && (state.focus ? true : !gd.back || camera.position.z < 0);
    el.style.display = visible ? '' : 'none';
    el.style.left = ((p.x + 1) / 2) * w + 'px';
    el.style.top = ((1 - p.y) / 2) * h + 'px';
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
  lastSvg = patternSVG(draftPattern(state.body, state.garment));
  document.getElementById('patPrev').innerHTML = lastSvg.replace(/^<\?xml[^>]*>/, '');
}

// ---------- UI ----------
function buildFields(container, fields, obj, helpEl, isBody) {
  container.innerHTML = '';
  for (const f of fields) {
    if (f.group) { const gEl = document.createElement('div'); gEl.className = 'grp'; gEl.textContent = f.group; container.appendChild(gEl); }
    const row = document.createElement('div'); row.className = 'row'; row.dataset.key = f.key;
    const unit = f.key === 'fullness' ? '×' : f.key === 'pleats' ? '#' : 'cm';
    row.innerHTML = `<label for="f-${f.key}">${f.label}</label><input id="f-${f.key}" type="number" step="${f.step ?? 0.5}" min="0" value="${obj[f.key]}"><span>${unit}</span>`;
    const input = row.querySelector('input');
    const onFocus = () => {
      container.querySelectorAll('.row').forEach((r) => r.classList.toggle('focus', r === row));
      helpEl.innerHTML = `<b>${f.label}</b><br>${f.help}`;
      if (isBody) { state.focus = f.key; rebuild(); }
    };
    input.addEventListener('focus', onFocus);
    row.addEventListener('click', () => input.focus());
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!isFinite(v) || v <= 0) return;
      obj[f.key] = v; rebuild();
    });
    container.appendChild(row);
  }
}
const renderForms = () => {
  buildFields(document.getElementById('bodyFields'), BODY_FIELDS, state.body, document.getElementById('helpBody'), true);
  buildFields(document.getElementById('garmentFields'), GARMENT_FIELDS, state.garment, document.getElementById('helpGarment'), false);
};

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + b.dataset.tab));
  const tab = b.dataset.tab;
  const vg = document.getElementById('vGarment'), vgu = document.getElementById('vGuides');
  if (tab === 'body') { vg.checked = false; vgu.checked = true; }
  else { vg.checked = true; vgu.checked = false; state.focus = null; }
  if (tab === 'pattern') renderPattern();
  rebuild();
}));
document.getElementById('vGuides').addEventListener('change', rebuild);
document.getElementById('vGarment').addEventListener('change', rebuild);
document.getElementById('vOpacity').addEventListener('input', (e) => Object.values(mats).forEach((m) => { m.opacity = +e.target.value; m.depthWrite = +e.target.value > 0.95; }));
document.getElementById('cKameez').addEventListener('input', (e) => { mats.kameez.color.set(e.target.value); mats.cuff.color.set(e.target.value); });
document.getElementById('cSalwar').addEventListener('input', (e) => mats.salwar.color.set(e.target.value));
for (const d of ['Front', 'Side', 'Back']) document.getElementById('v' + d).addEventListener('click', () => setView(d.toLowerCase()));

const download = (name, text, type) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
document.getElementById('resetBody').addEventListener('click', () => { Object.assign(state.body, BODY_DEFAULTS); renderForms(); rebuild(); setView('front'); });
document.getElementById('resetGarment').addEventListener('click', () => { Object.assign(state.garment, GARMENT_DEFAULTS); renderForms(); rebuild(); });
document.getElementById('saveJson').addEventListener('click', () => download('body-profile.json', JSON.stringify({ body: state.body, garment: state.garment }, null, 2), 'application/json'));
document.getElementById('loadJson').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try { const d = JSON.parse(await file.text()); Object.assign(state.body, d.body || {}); Object.assign(state.garment, d.garment || {}); renderForms(); rebuild(); }
  catch { alert('Could not read that profile file.'); }
});
document.getElementById('dlSvg').addEventListener('click', () => { renderPattern(); download('patiala-pattern.svg', lastSvg, 'image/svg+xml'); });
document.getElementById('dlSpec').addEventListener('click', () => download('patiala-spec.json', JSON.stringify({ body: state.body, garment: state.garment, fit: fitReport(state.body, state.garment), pieces: draftPattern(state.body, state.garment) }, null, 2), 'application/json'));
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
rebuild();
setView('front');
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); updateLabels(false); });
window.__studio = { state, rebuild, setView };
