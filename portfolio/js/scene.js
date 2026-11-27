// =========================================================
// "Connecting the dots" — a particle field that morphs
// between six shapes as the story scrolls:
//   0 sphere (network)  1 galaxy (premise)  2 helix (journey)
//   3 torus knot (work) 4 lattice (toolkit) 5 ring (contact)
// All morphing happens on the GPU; lines between neighbours
// fade out automatically when a morph stretches them apart.
// =========================================================
import * as THREE from "three";

const ACCENT = new THREE.Color("#ff5a1f");
const INK = new THREE.Color("#ecebe6");
const SHAPES = 6;

// ---------- deterministic random ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1997);
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

// ---------- shape generators (each returns Float32Array N*3) ----------
function sphere(N) {
  const out = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const R = 2.2 + gauss() * 0.05;
    out.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
  }
  return out;
}

function galaxy(N) {
  const out = new Float32Array(N * 3);
  const arms = 3;
  for (let i = 0; i < N; i++) {
    const r = Math.pow(rand(), 0.7) * 4.2;
    const arm = (i % arms) / arms * Math.PI * 2;
    const ang = arm + r * 1.15 + gauss() * 0.35;
    const y = gauss() * 0.18 * (1 - r / 5);
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    // tilt the disc toward the viewer
    const tilt = 0.9;
    out.set([x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)], i * 3);
  }
  return out;
}

function helix(N) {
  const out = new Float32Array(N * 3);
  const len = 11, R = 1.15, turns = 4.5;
  for (let i = 0; i < N; i++) {
    const t = rand();
    const x = (t - 0.5) * len;
    const a = t * turns * Math.PI * 2;
    let y, z;
    const k = rand();
    if (k < 0.78) {
      const strand = k < 0.39 ? 0 : Math.PI;
      const j = 0.06;
      y = Math.cos(a + strand) * R + gauss() * j;
      z = Math.sin(a + strand) * R + gauss() * j;
    } else {
      // rungs between the strands
      const rungT = Math.round(t * 60) / 60;
      const aa = rungT * turns * Math.PI * 2;
      const s = rand() * 2 - 1;
      y = Math.cos(aa) * R * s;
      z = Math.sin(aa) * R * s;
      out.set([(rungT - 0.5) * len, y, z], i * 3);
      continue;
    }
    out.set([x, y, z], i * 3);
  }
  return out;
}

function torusKnot(N) {
  const out = new Float32Array(N * 3);
  const p = 2, q = 3, R = 1.55, r = 0.6;
  for (let i = 0; i < N; i++) {
    const t = rand() * Math.PI * 2;
    const cx = (R + r * Math.cos(q * t)) * Math.cos(p * t);
    const cy = (R + r * Math.cos(q * t)) * Math.sin(p * t);
    const cz = r * Math.sin(q * t);
    const tube = 0.28 * Math.sqrt(rand());
    const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1);
    out.set([
      cx + tube * Math.sin(v) * Math.cos(u),
      cy + tube * Math.sin(v) * Math.sin(u),
      cz + tube * Math.cos(v),
    ], i * 3);
  }
  return out;
}

function lattice(N) {
  const out = new Float32Array(N * 3);
  const cells = 4, size = 3.4, step = size / cells, h = size / 2;
  for (let i = 0; i < N; i++) {
    const axis = i % 3;
    const a = Math.floor(rand() * (cells + 1)) * step - h;
    const b = Math.floor(rand() * (cells + 1)) * step - h;
    const c = rand() * size - h;
    const p = axis === 0 ? [c, a, b] : axis === 1 ? [a, c, b] : [a, b, c];
    out.set(p, i * 3);
  }
  return out;
}

function ring(N) {
  const out = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const inner = rand() < 0.12;
    const a = rand() * Math.PI * 2;
    if (inner) {
      const r = Math.pow(rand(), 2) * 0.5;
      out.set([Math.cos(a) * r, Math.sin(a) * r, gauss() * 0.15], i * 3);
    } else {
      const R = 2.6 + gauss() * 0.12;
      out.set([Math.cos(a) * R, Math.sin(a) * R, gauss() * 0.14], i * 3);
    }
  }
  return out;
}

// ---------- shaders ----------
const morphChunk = /* glsl */ `
  uniform float uMorph;
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uMouseForce;
  uniform float uAspect;

  float easeIO(float x) { return x < 0.5 ? 4.0*x*x*x : 1.0 - pow(-2.0*x + 2.0, 3.0) / 2.0; }
  float stepK(float k, float r) { return easeIO(clamp((uMorph - k) * 1.35 - r * 0.35, 0.0, 1.0)); }

  vec3 morph(vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, vec3 f, float r) {
    vec3 p = a;
    p = mix(p, b, stepK(0.0, r));
    p = mix(p, c, stepK(1.0, r));
    p = mix(p, d, stepK(2.0, r));
    p = mix(p, e, stepK(3.0, r));
    p = mix(p, f, stepK(4.0, r));
    p += 0.035 * vec3(sin(uTime*0.7 + r*31.0), cos(uTime*0.6 + r*17.0), sin(uTime*0.5 + r*11.0));
    return p;
  }

  // push away from the cursor in view space; returns force (0..1)
  float repel(inout vec4 mv) {
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 d = ndc - uMouse; d.x *= uAspect;
    float dist = length(d);
    float f = smoothstep(0.38, 0.0, dist) * uMouseForce;
    mv.xy += normalize(d + 1e-5) * f * 0.12;
    return f;
  }
`;

const pointsVert = /* glsl */ `
  attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4; attribute vec3 p5;
  attribute float aRand; attribute float aSize;
  uniform float uSize; uniform float uPR;
  varying float vAccent; varying float vGlow; varying float vDepth;
  ${morphChunk}
  void main() {
    vec3 p = morph(position, p1, p2, p3, p4, p5, aRand);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vGlow = repel(mv);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + aRand * 60.0);
    gl_PointSize = uSize * aSize * uPR * twinkle * (1.0 + vGlow) / -mv.z;
    vAccent = step(0.88, aRand);
    vDepth = smoothstep(12.0, 3.0, -mv.z);
  }
`;

const pointsFrag = /* glsl */ `
  uniform vec3 uInk; uniform vec3 uAccent; uniform float uOpacity;
  varying float vAccent; varying float vGlow; varying float vDepth;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    core = pow(core, 1.6);
    vec3 col = mix(uInk, uAccent, max(vAccent, vGlow));
    gl_FragColor = vec4(col, core * uOpacity * (0.35 + 0.65 * vDepth));
  }
`;

const linesVert = /* glsl */ `
  attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4; attribute vec3 p5;
  attribute vec3 q0; attribute vec3 q1; attribute vec3 q2; attribute vec3 q3; attribute vec3 q4; attribute vec3 q5;
  attribute float aRand; attribute float aRandB;
  varying float vAlpha;
  ${morphChunk}
  void main() {
    vec3 p = morph(position, p1, p2, p3, p4, p5, aRand);
    vec3 q = morph(q0, q1, q2, q3, q4, q5, aRandB);
    float len = distance(p, q);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float f = repel(mv);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.55, 0.12, len) * (0.4 + f) * smoothstep(12.0, 3.0, -mv.z);
  }
`;

const linesFrag = /* glsl */ `
  uniform vec3 uAccent; uniform vec3 uInk; uniform float uLineAlpha; uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(mix(uInk, uAccent, 0.55), vAlpha * uLineAlpha * uOpacity);
  }
`;

// ---------- main ----------
export function initScene(canvas, { reducedMotion = false } = {}) {
  const isSmall = window.matchMedia("(max-width: 760px)").matches;
  const N = isSmall ? 2200 : 4200;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  const PR = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(PR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, isSmall ? 9.5 : 7.4);

  const group = new THREE.Group();
  scene.add(group);

  // build shapes
  const shapes = [sphere(N), galaxy(N), helix(N), torusKnot(N), lattice(N), ring(N)];
  const rnd = new Float32Array(N);
  const size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    rnd[i] = rand();
    size[i] = 0.6 + Math.pow(rand(), 3) * 2.2;
  }

  const uniforms = {
    uMorph: { value: 0 },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uMouseForce: { value: 0 },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uSize: { value: isSmall ? 30 : 34 },
    uPR: { value: PR },
    uInk: { value: INK },
    uAccent: { value: ACCENT },
    uOpacity: { value: 0 },
    uLineAlpha: { value: 0 },
  };

  // --- points
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(shapes[0], 3));
  for (let s = 1; s < SHAPES; s++) pg.setAttribute("p" + s, new THREE.BufferAttribute(shapes[s], 3));
  pg.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
  pg.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

  const points = new THREE.Points(pg, new THREE.ShaderMaterial({
    vertexShader: pointsVert, fragmentShader: pointsFrag, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  group.add(points);

  // --- lines: K nearest neighbours (measured on the sphere) for a subset of points
  const M = isSmall ? 700 : 1600, K = 2;
  const S0 = shapes[0];
  const pairs = [];
  for (let m = 0; m < M; m++) {
    const i = Math.floor((m * N) / M); // spread sources evenly over the sphere
    const ix = S0[i * 3], iy = S0[i * 3 + 1], iz = S0[i * 3 + 2];
    const best = [[Infinity, -1], [Infinity, -1]];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dx = S0[j * 3] - ix, dy = S0[j * 3 + 1] - iy, dz = S0[j * 3 + 2] - iz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best[1][0]) {
        if (d < best[0][0]) { best[1] = best[0]; best[0] = [d, j]; }
        else best[1] = [d, j];
      }
    }
    for (let k = 0; k < K; k++) if (best[k][1] >= 0) pairs.push(i, best[k][1]);
  }
  const L = pairs.length; // vertices (2 per segment)
  const lg = new THREE.BufferGeometry();
  const self = Array.from({ length: SHAPES }, () => new Float32Array(L * 3));
  const other = Array.from({ length: SHAPES }, () => new Float32Array(L * 3));
  const lr = new Float32Array(L), lrB = new Float32Array(L);
  for (let v = 0; v < L; v++) {
    const a = pairs[v];
    const b = pairs[v % 2 === 0 ? v + 1 : v - 1];
    for (let s = 0; s < SHAPES; s++) {
      self[s].set(shapes[s].subarray(a * 3, a * 3 + 3), v * 3);
      other[s].set(shapes[s].subarray(b * 3, b * 3 + 3), v * 3);
    }
    lr[v] = rnd[a]; lrB[v] = rnd[b];
  }
  lg.setAttribute("position", new THREE.BufferAttribute(self[0], 3));
  for (let s = 1; s < SHAPES; s++) lg.setAttribute("p" + s, new THREE.BufferAttribute(self[s], 3));
  for (let s = 0; s < SHAPES; s++) lg.setAttribute("q" + s, new THREE.BufferAttribute(other[s], 3));
  lg.setAttribute("aRand", new THREE.BufferAttribute(lr, 1));
  lg.setAttribute("aRandB", new THREE.BufferAttribute(lrB, 1));
  lg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

  const lines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({
    vertexShader: linesVert, fragmentShader: linesFrag, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  group.add(lines);

  // ---------- per-shape staging (position offset, line strength) ----------
  const stage = isSmall
    ? [{ x: 0, y: 0.6 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0.4 }]
    : [{ x: 1.7, y: 0.15 }, { x: 1.2, y: 0 }, { x: 0, y: 0.6 }, { x: 2.0, y: 0 }, { x: 1.6, y: 0 }, { x: 2.1, y: 0 }];
  const lineStrength = [1, 0.55, 0.8, 0.9, 1, 1];
  const target = { x: stage[0].x, y: stage[0].y, morph: 0, line: lineStrength[0] };

  // ---------- input ----------
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -999, py: -999, active: false };
  window.addEventListener("pointermove", (e) => {
    mouse.px = e.clientX; mouse.py = e.clientY;
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
    mouse.active = e.pointerType === "mouse";
  }, { passive: true });
  document.addEventListener("pointerleave", () => (mouse.active = false));

  let scrollVel = 0;
  let opacityTarget = 0, dim = 1, frames = 0;

  // ---------- cursor → dots overlay ----------
  const linkCanvas = document.getElementById("links");
  const lctx = linkCanvas?.getContext("2d");
  const SAMPLE = Array.from({ length: isSmall ? 0 : 900 }, (_, k) => Math.floor((k * N) / 900));
  const pv = new THREE.Vector3();
  function sizeLinks() {
    if (!linkCanvas) return;
    linkCanvas.width = window.innerWidth * PR; linkCanvas.height = window.innerHeight * PR;
    lctx.setTransform(PR, 0, 0, PR, 0, 0);
  }
  sizeLinks();
  let linksDrawn = false;
  function drawLinks() {
    if (!lctx) return;
    const m = uniforms.uMorph.value, k = Math.round(m);
    const ready = mouse.active && !reducedMotion && Math.abs(m - k) < 0.03 && uniforms.uOpacity.value > 0.45 && SAMPLE.length;
    if (!ready) { if (linksDrawn) { lctx.clearRect(0, 0, window.innerWidth, window.innerHeight); linksDrawn = false; } return; }
    const w = window.innerWidth, h = window.innerHeight, R = 150;
    const src = shapes[k], hits = [];
    for (const i of SAMPLE) {
      pv.set(src[i * 3], src[i * 3 + 1], src[i * 3 + 2]).applyMatrix4(group.matrixWorld).project(camera);
      if (pv.z > 1) continue;
      const sx = (pv.x + 1) / 2 * w, sy = (1 - pv.y) / 2 * h;
      const d = Math.hypot(sx - mouse.px, sy - mouse.py);
      if (d < R) hits.push([d, sx, sy]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    lctx.clearRect(0, 0, w, h);
    const top = hits.slice(0, 10);
    lctx.lineWidth = 1;
    for (let a = 0; a < top.length; a++) {
      const [d, x, y] = top[a];
      const al = (1 - d / R) * 0.75 * uniforms.uOpacity.value;
      lctx.strokeStyle = `rgba(255,90,31,${al})`;
      lctx.beginPath(); lctx.moveTo(mouse.px, mouse.py); lctx.lineTo(x, y); lctx.stroke();
      lctx.fillStyle = `rgba(236,235,230,${al})`;
      lctx.beginPath(); lctx.arc(x, y, 2.2, 0, Math.PI * 2); lctx.fill();
      if (a > 0) { // chain neighbours so it reads as a constellation, not a starburst
        const [, px, py] = top[a - 1];
        lctx.strokeStyle = `rgba(236,235,230,${al * 0.35})`;
        lctx.beginPath(); lctx.moveTo(px, py); lctx.lineTo(x, y); lctx.stroke();
      }
    }
    linksDrawn = true;
  }

  function resize() {
    sizeLinks();
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = w / h;
  }
  window.addEventListener("resize", resize);

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let spin = 0;
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); tick(); }
  });

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uniforms.uTime.value = reducedMotion ? 0 : t;

    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    uniforms.uMouse.value.set(mouse.tx, mouse.ty);
    uniforms.uMouseForce.value += ((mouse.active && !reducedMotion ? 1 : 0) - uniforms.uMouseForce.value) * 0.06;

    // ease toward the staged morph/position
    const k = 1 - Math.pow(0.0015, dt);
    uniforms.uMorph.value += (target.morph - uniforms.uMorph.value) * k * 0.55;
    uniforms.uLineAlpha.value += (target.line - uniforms.uLineAlpha.value) * k;
    group.position.x += (target.x - group.position.x) * k * 0.6;
    group.position.y += (target.y - group.position.y) * k * 0.6;

    scrollVel *= 0.92;
    const faceViewer = target.morph === 2; // the helix reads best side-on, like a timeline
    if (faceViewer) {
      const home = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
      spin += (home - spin) * k * 0.4;
    } else if (!reducedMotion) {
      spin += dt * (0.06 + Math.min(Math.abs(scrollVel) * 0.002, 0.6));
    }
    const sway = faceViewer && !reducedMotion ? Math.sin(t * 0.25) * 0.2 : 0;
    group.rotation.y = spin + mouse.x * 0.25 + sway;
    group.rotation.x = -mouse.y * 0.15 + (reducedMotion ? 0 : Math.sin(t * 0.2) * 0.05);

    uniforms.uOpacity.value += (opacityTarget * dim - uniforms.uOpacity.value) * k * 0.35;
    group.updateMatrixWorld();
    drawLinks();
    renderer.render(scene, camera);
    frames++;
    requestAnimationFrame(tick);
  }
  tick();

  return {
    uniforms,
    setShape(i) {
      i = Math.max(0, Math.min(SHAPES - 1, i));
      target.morph = i;
      target.x = stage[i].x;
      target.y = stage[i].y;
      target.line = lineStrength[i];
    },
    setVelocity(v) { scrollVel = v; },
    fadeIn() { opacityTarget = 1; },
    setDim(v) { dim = v; },
    get stats() { return { particles: N, lines: L / 2, calls: renderer.info.render.calls, frames }; },
  };
}
