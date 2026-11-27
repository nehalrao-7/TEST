// =========================================================
// Nehal's World — a seeded, procedural archipelago above a
// sea of clouds. Islands grow from a seed; landmarks are
// assembled from primitives; nothing is imported.
// =========================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const C = { bg: 0x0a0a0b, ink: 0xecebe6, accent: 0xff5a1f };

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

// seeded 3D value-noise fbm
function makeNoise(rng) {
  const P = new Uint8Array(512), perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const V = new Float32Array(256).map(() => rng() * 2 - 1);
  const f = (t) => t * t * (3 - 2 * t);
  const n3 = (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const u = f(x - X), v = f(y - Y), w = f(z - Z);
    const h = (i, j, k) => V[P[(P[(P[(X + i) & 255] + Y + j) & 255] + Z + k) & 255]];
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
  };
  return (x, y, z, oct = 3) => { let a = 0, amp = 1, fr = 1, s = 0; for (let o = 0; o < oct; o++) { a += n3(x * fr, y * fr, z * fr) * amp; s += amp; amp *= 0.5; fr *= 2.03; } return a / s; };
}

// soft round sprite texture
function softTexture(size = 128) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.35, "rgba(255,255,255,.45)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const GLSL_NOISE = /* glsl */ `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=0., m=.5; for(int i=0;i<4;i++){ a+=vn(p)*m; p=p*2.03+vec2(17.1,9.2); m*=.5; } return a; }
`;

export function createWorld(canvas, { places, notes, labelsEl, onSelect, onNote, onHover, reduced = false }) {
  const isSmall = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const PR = Math.min(devicePixelRatio, isSmall ? 1.75 : 1.5);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(C.bg, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d0b0b, 0.0105);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(isSmall ? 52 : 40, innerWidth / innerHeight, 0.1, 900);
  camera.position.set(isSmall ? 10 : 16, 2.5, isSmall ? 92 : 70);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.5, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.53; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.7;
  controls.autoRotate = !reduced; controls.autoRotateSpeed = 0.3;

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.62, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight(0xb8c0cc, 0x2a1206, 0.45));
  const sun = new THREE.DirectionalLight(0xffe4cc, 1.7);
  sun.position.set(28, 42, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 5, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const under = new THREE.DirectionalLight(0xff6a2a, 0.8); under.position.set(-6, -30, 8); scene.add(under); // glow from the clouds
  const rim = new THREE.DirectionalLight(0x8fa6ff, 0.5); rim.position.set(-30, 12, -30); scene.add(rim);

  // ---------- materials ----------
  const solids = [], edgeMats = [];
  const std = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, envMapIntensity: 0.7, transparent: true, ...o }); solids.push(m); return m; };
  const M = {
    stoneTop: std(0xffffff, { vertexColors: true, roughness: 0.92 }),
    stone: std(0xffffff, { vertexColors: true, roughness: 0.95 }),
    rock: std(0x2a2725, { roughness: 1, flatShading: true }),
    bone: std(0xd8d3c9, { roughness: 0.55 }),
    frost: std(0xc9ced2, { roughness: 0.75, flatShading: true }),
    dark: std(0x141416, { roughness: 0.35, metalness: 0.5 }),
    metal: std(0xb8b6b0, { roughness: 0.25, metalness: 0.9 }),
    accent: std(C.accent, { emissive: C.accent, emissiveIntensity: 0.35, roughness: 0.4 }),
    glow: std(0xff7a3c, { emissive: 0xff5a1f, emissiveIntensity: 3.2 }),
    crystal: std(0xff8a50, { emissive: 0xff4a10, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, flatShading: true }),
    root: std(0x1a1715, { roughness: 1 }),
  };
  const edgeMat = new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0 });
  edgeMats.push(edgeMat);

  // ---------- sky dome ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `${GLSL_NOISE} varying vec3 vP; uniform float uTime;
      void main(){
        float y = vP.y;
        vec3 top = vec3(.018,.018,.024), mid = vec3(.05,.035,.035), hor = vec3(.20,.085,.045);
        vec3 col = mix(hor, mid, smoothstep(-.12,.18,y)); col = mix(col, top, smoothstep(.15,.75,y));
        vec2 q = vec2(atan(vP.z,vP.x)*1.6, y*3.);
        float neb = fbm(q*1.4 + vec2(uTime*.004,0.)) * fbm(q*3.1 - 4.);
        col += vec3(.55,.18,.06) * pow(neb, 2.2) * 1.6 * smoothstep(.65,.05,abs(y-.18));
        col += vec3(.12,.14,.22) * pow(fbm(q*2.+11.),3.) * .6 * smoothstep(0.,.6,y);
        gl_FragColor = vec4(col,1.);
      }`,
  }));
  scene.add(sky);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const SN = 2200, sp = new Float32Array(SN * 3), srng = mulberry32(42);
  for (let i = 0; i < SN; i++) {
    const r = 380, th = srng() * Math.PI * 2, u = 0.05 + srng() * 0.95, s = Math.sqrt(1 - u * u);
    sp.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const sprite = softTexture();
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2.2, map: sprite, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  scene.add(stars);

  // ---------- cloud sea (two shader layers for depth) ----------
  const cloudMats = [];
  [[-13, 0.0, 1], [-18, 7.3, 0.85]].forEach(([y, off, k]) => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uOff: { value: off }, uK: { value: k }, uDim: { value: 1 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${GLSL_NOISE} varying vec3 vW; uniform float uTime, uOff, uK, uDim;
        void main(){
          vec2 p = vW.xz * .02 + uOff + vec2(uTime*.012, uTime*.007);
          float n = fbm(p) * .65 + fbm(p*2.7 - uTime*.01) * .45;
          float d = smoothstep(.42, .82, n);
          float r = length(vW.xz);
          float fade = smoothstep(330., 90., r);
          vec3 shadow = vec3(.07,.055,.05), lit = vec3(.42,.36,.33), ember = vec3(1.,.36,.12);
          vec3 col = mix(shadow, lit, smoothstep(.45,.95,n));
          col += ember * smoothstep(55., 0., r) * .22 * (1.-d*.6);
          col += ember * .12 * pow(1.-n, 3.);
          gl_FragColor = vec4(col, d * fade * .92 * uK * uDim);
        }`,
    });
    cloudMats.push(mat);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), mat);
    plane.rotation.x = -Math.PI / 2; plane.position.y = y; plane.renderOrder = -1;
    scene.add(plane);
  });
  const grid = new THREE.GridHelper(400, 100, C.accent, C.ink);
  grid.position.y = -12; grid.material.transparent = true; grid.material.opacity = 0;
  scene.add(grid);

  // ---------- dust + embers ----------
  function particles(n, spread, yMin, yMax, color, size, opacity) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), r = mulberry32(n);
    for (let i = 0; i < n; i++) p.set([(r() - 0.5) * spread, yMin + r() * (yMax - yMin), (r() - 0.5) * spread], i * 3);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: sprite, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.userData = { yMin, yMax, speed: [] }; for (let i = 0; i < n; i++) pts.userData.speed.push(0.2 + r() * 0.8);
    scene.add(pts); return pts;
  }
  const dust = particles(isSmall ? 500 : 1100, 90, -10, 16, 0xf3e9dc, 0.2, 0.3);
  const embers = particles(isSmall ? 120 : 260, 60, -14, 10, 0xff6a2a, 0.3, 0.9);

  // ---------- helpers ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
  function addEdges(group) {
    const list = []; group.traverse((o) => { if (o.isMesh && !o.userData.noEdge) list.push(o); });
    list.forEach((o) => o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), edgeMat)));
  }
  const cTop = new THREE.Color(0x57524c), cTopDark = new THREE.Color(0x2e2b28), cRim = new THREE.Color(0x8a8278);
  const cRockHi = new THREE.Color(0x3a3532), cRockLo = new THREE.Color(0x0b0a0a), cEmber = new THREE.Color(0xff5a1f);

  // ---------- terrain (seeded) ----------
  const TOP = 0.5;
  function growTerrain(place, seed) {
    const rng = mulberry32(seed ^ hash(place.key));
    const noise = makeNoise(rng);
    const g = new THREE.Group();
    const R = place.r, depth = R * (1.2 + rng() * 0.8), wob = 0.06 + rng() * 0.08;

    // plateau
    const prof = [[0, TOP], [R * 0.35, TOP], [R * 0.7, TOP - 0.03], [R * 0.9, TOP - 0.08], [R * 0.98, TOP - 0.2], [R, TOP - 0.38], [R * 0.97, TOP - 0.55]];
    const top = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 72);
    const tp = top.attributes.position, tcol = new Float32Array(tp.count * 3), c = new THREE.Color();
    for (let i = 0; i < tp.count; i++) {
      let x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
      const r = Math.hypot(x, z) / R;
      const k = 1 + noise(x * 0.35, 3, z * 0.35) * wob * 2;
      x *= k; z *= k;
      y += noise(x * 0.9, 9, z * 0.9) * 0.1 * r;
      tp.setXYZ(i, x, y, z);
      const n = noise(x * 1.3, 1, z * 1.3) * 0.5 + 0.5;
      c.copy(cTopDark).lerp(cTop, n);
      if (r > 0.92) c.lerp(cRim, (r - 0.92) * 6);
      tcol.set([c.r, c.g, c.b], i * 3);
    }
    top.setAttribute("color", new THREE.BufferAttribute(tcol, 3));
    top.computeVertexNormals();
    g.add(mesh(top, M.stoneTop));

    // hanging rock
    const rp = [[0.97, -0.05], [0.93, -0.18], [0.82, -0.38], [0.66, -0.58], [0.48, -0.75], [0.3, -0.88], [0.14, -0.97], [0.02, -1]];
    const under = new THREE.LatheGeometry(rp.map(([x, y]) => new THREE.Vector2(x * R, TOP - 0.55 + y * depth)), 56, 0, Math.PI * 2);
    const up = under.attributes.position, ucol = new Float32Array(up.count * 3);
    for (let i = 0; i < up.count; i++) {
      let x = up.getX(i), y = up.getY(i), z = up.getZ(i);
      const t = (TOP - 0.55 - y) / depth; // 0 top → 1 tip
      const k = 1 + noise(x * 0.45, y * 0.6, z * 0.45, 4) * (0.35 + t * 0.5);
      x *= k; z *= k;
      y += noise(x * 0.8, 2, z * 0.8) * 0.4 * t;
      x += noise(y * 0.5, 7, 0) * t * R * 0.25;
      up.setXYZ(i, x, y, z);
      c.copy(cRockHi).lerp(cRockLo, Math.min(1, t * 1.3));
      const vein = Math.abs(noise(x * 1.7, y * 1.1, z * 1.7, 2));
      if (vein < 0.014 && t > 0.2) c.lerp(cEmber, 0.7);
      ucol.set([c.r, c.g, c.b], i * 3);
    }
    under.setAttribute("color", new THREE.BufferAttribute(ucol, 3));
    under.computeVertexNormals();
    g.add(mesh(under, M.stone));

    // scatter
    const count = Math.round(R * R * (0.9 + rng() * 0.6));
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2, rad = R * (0.55 + rng() * 0.36);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, t = rng();
      if (t < 0.35) { const s = 0.1 + rng() * 0.22; const o = mesh(new THREE.DodecahedronGeometry(s, 0), M.rock, x, TOP + s * 0.4, z); o.rotation.set(rng() * 3, rng() * 3, 0); g.add(o); }
      else if (t < 0.72) { // frosted pine
        const h = 0.5 + rng() * 0.8, pine = new THREE.Group();
        pine.add(mesh(new THREE.ConeGeometry(0.2 + rng() * 0.08, h, 7), M.frost, 0, h / 2 + 0.12, 0));
        pine.add(mesh(new THREE.ConeGeometry(0.16, h * 0.7, 7), M.frost, 0, h * 0.85 + 0.12, 0));
        pine.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5), M.root, 0, 0.1, 0));
        pine.position.set(x, TOP, z); g.add(pine);
      } else if (t < 0.84) { // lamp post
        const post = new THREE.Group();
        post.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6), M.dark, 0, 0.35, 0));
        const bulb = mesh(new THREE.SphereGeometry(0.06, 10, 8), M.glow, 0, 0.74, 0); bulb.userData.noEdge = true; post.add(bulb);
        post.position.set(x, TOP, z); g.add(post);
      } else { const s = 0.12 + rng() * 0.1; const o = mesh(new THREE.OctahedronGeometry(s, 0), M.crystal, x, TOP + s, z); o.scale.y = 1.8; o.userData.noEdge = true; g.add(o); }
    }
    // roots + crystal clusters under the rock
    for (let i = 0; i < 4 + Math.floor(rng() * 4); i++) {
      const a = rng() * Math.PI * 2, r0 = R * (0.3 + rng() * 0.45);
      const start = V(Math.cos(a) * r0, TOP - 0.7 - rng() * depth * 0.3, Math.sin(a) * r0);
      const len = 1.5 + rng() * 3;
      const curve = new THREE.CatmullRomCurve3([start, start.clone().add(V((rng() - 0.5), -len * 0.4, (rng() - 0.5))), start.clone().add(V((rng() - 0.5) * 1.5, -len, (rng() - 0.5) * 1.5))]);
      const root = mesh(new THREE.TubeGeometry(curve, 16, 0.035 + rng() * 0.03, 5), M.root); root.userData.noEdge = true; g.add(root);
    }
    for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
      const s = 0.14 + rng() * 0.26, a = rng() * Math.PI * 2, r0 = R * (0.15 + rng() * 0.4);
      const o = mesh(new THREE.OctahedronGeometry(s, 0), M.crystal, Math.cos(a) * r0, TOP - 0.55 - depth * (0.35 + rng() * 0.45), Math.sin(a) * r0);
      o.scale.y = 2.2; o.rotation.z = (rng() - 0.5) * 0.6; o.userData.noEdge = true; g.add(o);
    }
    // cloud wisps hugging the underside
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0x6a625c, transparent: true, opacity: 0.16, depthWrite: false }));
      const a = rng() * Math.PI * 2;
      s.position.set(Math.cos(a) * R * 0.8, TOP - depth * (0.3 + rng() * 0.5), Math.sin(a) * R * 0.8);
      const sc = R * (1.6 + rng() * 1.4); s.scale.set(sc * 1.6, sc, 1);
      s.userData.wisp = true; g.add(s);
    }
    return g;
  }

  // ---------- landmarks ----------
  const L = {
    origin() {
      const g = new THREE.Group();
      const core = mesh(new THREE.IcosahedronGeometry(1.05, 5), M.glow, 0, 2.7, 0); core.userData.noEdge = true; g.add(core);
      const shell = mesh(new THREE.IcosahedronGeometry(1.45, 1), new THREE.MeshBasicMaterial({ color: 0xffb08a, wireframe: true, transparent: true, opacity: 0.25 }), 0, 2.7, 0);
      shell.userData.noEdge = true; shell.castShadow = false; g.add(shell);
      const light = new THREE.PointLight(0xff6a2a, 22, 16, 2); light.position.y = 2.7; g.add(light);
      const rings = [];
      [[2.0, 0.03, 0.5], [2.6, 0.022, -0.35], [3.2, 0.015, 0.9]].forEach(([r, t, tilt]) => {
        const ring = mesh(new THREE.TorusGeometry(r, t, 8, 160), M.metal, 0, 2.7, 0); ring.rotation.x = Math.PI / 2 + tilt; ring.userData.noEdge = true; rings.push(ring); g.add(ring);
      });
      const orbit = new THREE.Group(); orbit.position.y = 2.7; orbit.rotation.x = -0.35; g.add(orbit);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const d = mesh(new THREE.SphereGeometry(i === 6 ? 0.2 : 0.13, 20, 14), i === 6 ? M.glow : M.bone, Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6); d.userData.noEdge = true; orbit.add(d);
      }
      const pedestal = new THREE.LatheGeometry([[0, 0], [0.95, 0], [0.9, 0.15], [0.55, 0.35], [0.45, 1.2], [0.7, 1.4], [0, 1.4]].map(([x, y]) => new THREE.Vector2(x, y)), 48);
      g.add(mesh(pedestal, M.dark));
      return { group: g, tick: (t) => {
        core.scale.setScalar(1 + Math.sin(t * 2) * 0.05); shell.rotation.y = t * 0.2; shell.rotation.x = t * 0.13;
        rings.forEach((r, i) => (r.rotation.z = t * (0.15 + i * 0.08) * (i % 2 ? -1 : 1)));
        orbit.rotation.y = t * 0.25; light.intensity = 20 + Math.sin(t * 2) * 5;
      } };
    },
    workshop() {
      const g = new THREE.Group();
      const puck = new THREE.Group();
      puck.add(mesh(new THREE.CylinderGeometry(1, 1.02, 0.75, 64), M.metal));
      const dome = new THREE.SphereGeometry(0.98, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.45, 1);
      puck.add(mesh(dome, M.bone, 0, 0.38, 0));
      const bez = mesh(new THREE.TorusGeometry(1.02, 0.07, 16, 96), M.accent, 0, 0.38, 0); bez.rotation.x = Math.PI / 2; puck.add(bez);
      const halo = mesh(new THREE.TorusGeometry(0.75, 0.025, 8, 64), M.glow, 0, 0.4, 0); halo.rotation.x = Math.PI / 2; halo.userData.noEdge = true; puck.add(halo);
      puck.position.set(-0.6, 1.2, 0.6); g.add(puck);
      const gear = new THREE.Group();
      gear.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.28, 48), M.dark));
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const tth = mesh(new THREE.BoxGeometry(0.3, 0.28, 0.32), M.dark, Math.cos(a) * 1.36, 0, Math.sin(a) * 1.36); tth.rotation.y = -a; gear.add(tth); }
      gear.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 24), M.accent));
      gear.rotation.x = Math.PI / 2; gear.position.set(1.2, 2.0, -1.2); g.add(gear);
      g.add(mesh(new THREE.BoxGeometry(2.6, 0.1, 1.1), M.bone, 0.9, 0.9, 1.0));
      [[-0.3, 0.55], [2.1, 0.55], [-0.3, 1.45], [2.1, 1.45]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8), M.metal, x, 0.45, z)));
      return { group: g, tick: (t) => { gear.rotation.y = t * 0.6; puck.rotation.y = t * 0.4; puck.position.y = 1.2 + Math.sin(t * 1.4) * 0.14; } };
    },
    line() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(5.2, 0.2, 1.1), M.dark, 0, 1.0, 0));
      for (let x = -2.4; x <= 2.41; x += 0.4) { const r = mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.15, 12), M.metal, x, 1.12, 0); r.rotation.x = Math.PI / 2; g.add(r); }
      [[-2.3, -0.4], [2.3, -0.4], [-2.3, 0.4], [2.3, 0.4]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), M.metal, x, 0.5, z)));
      g.add(mesh(new THREE.CylinderGeometry(0.75, 0.25, 0.9, 24, 1, true), M.metal, -2.4, 2.0, 0));
      const boxes = [];
      for (let i = 0; i < 6; i++) { const b = mesh(new THREE.BoxGeometry(0.46, 0.34, 0.6), i === 2 ? M.accent : M.bone, 0, 1.3, 0); boxes.push(b); g.add(b); }
      const arm = new THREE.Group();
      arm.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 12), M.accent, 0, 0.8, 0));
      const fore = mesh(new THREE.BoxGeometry(1.1, 0.12, 0.12), M.metal, 0.5, 1.6, 0); arm.add(fore);
      const tip = mesh(new THREE.SphereGeometry(0.07, 10, 8), M.glow, 1.05, 1.6, 0); tip.userData.noEdge = true; arm.add(tip);
      arm.position.set(1.2, 0, -1.1); g.add(arm);
      return { group: g, tick: (t) => {
        boxes.forEach((b, i) => { const u = (t * 0.18 + i / boxes.length) % 1; b.position.x = -2.3 + u * 4.6; b.position.y = 1.3 + (u < 0.05 ? (0.05 - u) * 8 : 0); });
        arm.rotation.y = Math.sin(t * 1.2) * 0.9;
      } };
    },
    arena() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(3.9, 0.04, 3.9), M.dark, 0, 0.03, 0));
      [[0, -1.9, 4, 0.1], [0, 1.9, 4, 0.1], [-1.9, 0, 0.1, 4], [1.9, 0, 0.1, 4]].forEach(([x, z, w, d]) => g.add(mesh(new THREE.BoxGeometry(w, 0.3, d), M.bone, x, 0.18, z)));
      [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]].forEach(([x, z]) => { g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), M.metal, x, 0.5, z)); const b = mesh(new THREE.SphereGeometry(0.06, 8, 6), M.glow, x, 1.02, z); b.userData.noEdge = true; g.add(b); });
      const bot = new THREE.Group();
      bot.add(mesh(new THREE.BoxGeometry(0.8, 0.3, 0.95), M.dark, 0, 0.3, 0));
      [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.32], [0.45, 0.32]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 20), M.metal, x, 0.18, z); w.rotation.z = Math.PI / 2; bot.add(w); });
      const arm = mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), M.accent, 0, 0.52, 0.35); bot.add(arm);
      const eye = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.02), M.glow, 0, 0.36, 0.48); eye.userData.noEdge = true; bot.add(eye);
      bot.position.y = 0.05; g.add(bot);
      const trophy = new THREE.Group();
      trophy.add(mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.25, 16), M.dark, 0, 0.12, 0));
      trophy.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), M.metal, 0, 0.45, 0));
      trophy.add(mesh(new THREE.LatheGeometry([[0.05, 0], [0.12, 0.05], [0.34, 0.35], [0.38, 0.5], [0.34, 0.5], [0.3, 0.38], [0.05, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)), 32), M.metal, 0, 0.62, 0));
      trophy.position.set(1.25, 0, -1.25); g.add(trophy);
      return { group: g, tick: (t) => {
        const a = t * 0.6; bot.position.x = Math.cos(a) * 1.0; bot.position.z = Math.sin(a) * 1.0; bot.rotation.y = -a;
        arm.rotation.x = Math.sin(t * 3) * 0.35; trophy.rotation.y = t * 0.8;
      } };
    },
    hack() {
      const g = new THREE.Group();
      const leds = [];
      for (let s = 0; s < 3; s++) {
        g.add(mesh(new THREE.BoxGeometry(1.1, 0.55, 0.8), M.dark, -0.7, 0.3 + s * 0.6, -0.3));
        for (let k = 0; k < 5; k++) { const l = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), M.glow, -1.12 + k * 0.15, 0.3 + s * 0.6, 0.11); l.userData.noEdge = true; leds.push(l); g.add(l); }
      }
      const band = mesh(new THREE.TorusGeometry(0.75, 0.14, 20, 64), M.bone, 1.0, 2.2, 0.2);
      band.add(mesh(new THREE.BoxGeometry(0.45, 0.18, 0.32), M.accent, 0, 0.75, 0));
      [0.9, 2.2, 4.0, 5.4].forEach((a) => { const m = mesh(new THREE.SphereGeometry(0.06, 10, 8), M.glow, Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0.12); m.userData.noEdge = true; band.add(m); });
      g.add(band);
      const laptop = new THREE.Group();
      laptop.add(mesh(new THREE.BoxGeometry(1, 0.04, 0.7), M.metal));
      const screen = mesh(new THREE.BoxGeometry(1, 0.65, 0.03), M.metal, 0, 0.32, -0.34); screen.rotation.x = -0.25; laptop.add(screen);
      const glowScr = mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: 0xff8a50 }), 0, 0.32, -0.32); glowScr.rotation.x = -0.25; glowScr.userData.noEdge = true; laptop.add(glowScr);
      laptop.position.set(0.9, 0.04, 1.1); laptop.rotation.y = -0.5; g.add(laptop);
      return { group: g, tick: (t) => {
        band.rotation.y = t * 0.8; band.rotation.x = 0.5 + Math.sin(t) * 0.2; band.position.y = 2.2 + Math.sin(t * 1.3) * 0.15;
        leds.forEach((l, i) => (l.visible = Math.sin(t * 6 + i * 2.3) > -0.2));
      } };
    },
    studio() {
      const g = new THREE.Group();
      const ico = mesh(new THREE.IcosahedronGeometry(1.35, 1), new THREE.MeshBasicMaterial({ color: 0xff7a3c, wireframe: true, transparent: true, opacity: 0.9 }), 0, 2.4, 0);
      ico.userData.noEdge = true; ico.castShadow = false; g.add(ico);
      const pg = new THREE.BufferGeometry(); const pr = mulberry32(7); const pts = [];
      for (let i = 0; i < 600; i++) { const u = pr() * 2 - 1, th = pr() * Math.PI * 2, r = 0.85; const s = Math.sqrt(1 - u * u); pts.push(Math.cos(th) * s * r, u * r, Math.sin(th) * s * r); }
      pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const cloud = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff1e6, size: 0.12, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      cloud.position.y = 2.4; g.add(cloud);
      [-1.6, 0, 1.6].forEach((x, i) => {
        const f = new THREE.Group();
        f.add(mesh(new THREE.BoxGeometry(0.9, 0.62, 0.04), M.dark));
        const scr = mesh(new THREE.PlaneGeometry(0.82, 0.54), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xff7a3c : 0x2a2a30 }), 0, 0, 0.025); scr.userData.noEdge = true; f.add(scr);
        f.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), M.metal, 0, -0.55, 0));
        f.position.set(x, 0.85, 1.5); f.rotation.y = -x * 0.25; g.add(f);
      });
      return { group: g, tick: (t) => { ico.rotation.y = t * 0.3; ico.rotation.x = t * 0.17; cloud.rotation.y = -t * 0.5; cloud.scale.setScalar(1 + Math.sin(t * 1.7) * 0.08); } };
    },
    observatory() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.9, 48), M.bone, 0, 0.45, 0));
      const head = new THREE.Group(); head.position.y = 0.9;
      head.add(mesh(new THREE.SphereGeometry(1.3, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.bone));
      const slit = mesh(new THREE.BoxGeometry(0.32, 1.45, 0.1), M.dark, 0, 0.6, 0.95); slit.rotation.x = -0.75; head.add(slit);
      const scope = mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 24), M.metal, 0, 1.2, 0.5); scope.rotation.x = -0.7; head.add(scope);
      const lens = mesh(new THREE.CircleGeometry(0.15, 20), M.glow, 0, 2.03, 1.37); lens.rotation.x = -0.7 - Math.PI / 2 + Math.PI; lens.userData.noEdge = true; head.add(lens);
      g.add(head);
      return { group: g, tick: (t) => { head.rotation.y = Math.sin(t * 0.2) * 1.4; } };
    },
    lighthouse() {
      const g = new THREE.Group();
      [[0.75, 0.62, M.bone], [0.62, 0.5, M.accent], [0.5, 0.4, M.bone]].forEach(([rb, rt, m], i) => g.add(mesh(new THREE.CylinderGeometry(rt, rb, 1.2, 32), m, 0, 0.6 + i * 1.2, 0)));
      g.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 32), M.dark, 0, 3.6, 0));
      const lamp = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 24), M.glow, 0, 3.9, 0); lamp.userData.noEdge = true; g.add(lamp);
      g.add(mesh(new THREE.ConeGeometry(0.55, 0.55, 24), M.dark, 0, 4.42, 0));
      const beam = new THREE.Group(); beam.position.y = 3.9;
      const cone = new THREE.ConeGeometry(1.8, 16, 32, 1, true); cone.translate(0, -8, 0); cone.rotateZ(Math.PI / 2);
      const bm = new THREE.Mesh(cone, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
        vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
        fragmentShader: `varying vec2 vU; void main(){ float a = pow(vU.y, 2.2) * .35; gl_FragColor = vec4(1., .45, .2, a); }`,
      }));
      bm.userData.noEdge = true; bm.castShadow = false; beam.add(bm); g.add(beam);
      const light = new THREE.PointLight(0xff6a2a, 10, 10, 2); light.position.y = 3.9; g.add(light);
      return { group: g, tick: (t) => { beam.rotation.y = t * 0.7; } };
    },
  };

  // ---------- islands ----------
  const islands = {}, pickables = [];
  let seed = 1997;
  for (const p of places) {
    const root = new THREE.Group();
    root.position.set(...p.pos);
    const terrain = growTerrain(p, seed);
    root.add(terrain);
    const lm = L[p.key]();
    lm.group.position.y = TOP;
    addEdges(lm.group);
    root.add(lm.group);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.3, 0.035, 8, 120), new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0 }));
    halo.rotation.x = Math.PI / 2; halo.position.y = TOP - 0.2; root.add(halo);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(p.r + 0.4, p.r * 0.5, 7, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.4; hit.userData.place = p.key; root.add(hit); pickables.push(hit);
    scene.add(root);
    const label = document.createElement("button");
    label.className = "wlabel"; label.type = "button";
    label.innerHTML = `<span class="wlabel__dot"></span><span class="wlabel__txt"><span class="wlabel__name">${p.name}</span><span class="wlabel__kick">${p.kicker}</span></span>`;
    label.addEventListener("click", () => onSelect?.(p.key));
    label.addEventListener("pointerenter", () => setHover(p.key));
    label.addEventListener("pointerleave", () => setHover(null));
    labelsEl.appendChild(label);
    islands[p.key] = { p, root, terrain, lm, halo, label, phase: (hash(p.key) % 100) / 16, lift: 0, liftTo: 0, base: V(...p.pos) };
  }

  // ---------- light bridges ----------
  const pathDefs = [];
  places.forEach((p) => { if (p.key !== "origin") pathDefs.push(["origin", p.key]); });
  [["workshop", "line"], ["workshop", "arena"], ["arena", "hack"], ["hack", "studio"], ["studio", "observatory"], ["observatory", "workshop"], ["lighthouse", "workshop"]].forEach((d) => pathDefs.push(d));
  const bridgeVS = `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
  const bridgeFS = `varying vec2 vU; uniform float uTime, uOn, uDim, uLen;
    void main(){
      float f = fract(vU.x * uLen * .25 - uTime * (.35 + uOn * .5));
      float pulse = smoothstep(0., .08, f) * smoothstep(.35, .08, f);
      float ends = smoothstep(0., .04, vU.x) * smoothstep(1., .96, vU.x);
      vec3 col = mix(vec3(.95,.9,.85), vec3(1.,.42,.15), max(uOn, pulse * .7));
      float a = (.07 + pulse * (.45 + uOn * .9) + uOn * .25) * ends * uDim;
      gl_FragColor = vec4(col * (1. + uOn * 1.6 + pulse * 1.2), a);
    }`;
  const paths = pathDefs.map(([a, b]) => {
    const A = islands[a].base.clone().add(V(0, TOP + 0.1, 0)), B = islands[b].base.clone().add(V(0, TOP + 0.1, 0));
    const mid = A.clone().lerp(B, 0.5).add(V(0, 2.5 + A.distanceTo(B) * 0.08, 0));
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uDim: { value: 1 }, uLen: { value: curve.getLength() } }, vertexShader: bridgeVS, fragmentShader: bridgeFS });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.045, 6), mat);
    scene.add(tube);
    return { a, b, curve, mat, on: 0, onTo: 0 };
  });

  // ---------- field notes ----------
  const noteObjs = notes.map((_, i) => {
    const pairs = [["origin", "workshop"], ["line", "arena"], ["hack", "arena"], ["studio", "observatory"], ["lighthouse", "observatory"], ["origin", "studio"]];
    const [a, b] = pairs[i % pairs.length];
    const pos = islands[a].base.clone().lerp(islands[b].base, 0.5).add(V(i % 2 ? 1.5 : -1.5, 5.5 + (i % 3), i % 2 ? -1 : 1));
    const g = new THREE.Group(); g.position.copy(pos);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.15), new THREE.MeshStandardMaterial({ color: 0xefe9df, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x3a2a20, emissiveIntensity: 0.4 }));
    paper.userData.note = i; g.add(paper); pickables.push(paper);
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.6 - k * 0.12, 0.035), new THREE.MeshBasicMaterial({ color: 0x77736c, side: THREE.DoubleSide })); l.position.set(-0.05, 0.25 - k * 0.16, 0.005); g.add(l); }
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.glow); pin.position.set(0, 0.47, 0.02); g.add(pin);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0xff6a2a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(3, 3, 1); g.add(glow);
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
    onHover?.(key ? "place" : hoveredNote !== null ? "note" : null, key);
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
  function flyTo(posTo, targetTo, dur = 1.8, arc = true) {
    flying?.kill();
    controls.enabled = false; controls.autoRotate = false;
    const p0 = camera.position.clone(), t0 = controls.target.clone(), s = { t: 0 };
    const lift = arc ? Math.min(16, p0.distanceTo(posTo) * 0.22) : 0;
    flying = window.gsap.to(s, {
      t: 1, duration: reduced ? 0.01 : dur, ease: "power3.inOut",
      onUpdate: () => {
        camera.position.lerpVectors(p0, posTo, s.t); camera.position.y += Math.sin(s.t * Math.PI) * lift;
        controls.target.lerpVectors(t0, targetTo, s.t);
      },
      onComplete: () => { controls.enabled = true; flying = null; },
    });
  }
  const HOME = () => [V(0, isSmall ? 46 : 24, isSmall ? 84 : 48), V(0, 0, 0)];
  function viewFor(key) {
    const isl = islands[key];
    const target = isl.base.clone().add(V(0, 1.4, 0));
    const out = key === "origin" ? V(0.35, 0, 1) : V(isl.base.x, 0, isl.base.z).normalize();
    const side = V(-out.z, 0, out.x).multiplyScalar(0.35);
    const dir = out.add(side).add(V(0, 0.5, 0)).normalize();
    const dist = isl.p.r * 3.1 + (isSmall ? 17 : 9);
    return [target.clone().addScaledVector(dir, dist), target];
  }

  const offset = { x: 0, y: 0 };
  let offTween = null;
  function applyOffset() {
    if (Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(innerWidth, innerHeight, offset.x, offset.y, innerWidth, innerHeight);
  }

  // ---------- route ----------
  let routeKeys = null;
  function setRoute(keys) {
    routeKeys = keys;
    const on = new Set();
    if (keys) for (let i = 0; i < keys.length - 1; i++) { on.add(keys[i] + ">" + keys[i + 1]); on.add(keys[i + 1] + ">" + keys[i]); }
    paths.forEach((p) => { p.onTo = on.has(p.a + ">" + p.b) ? 1 : 0; p.mat.uniforms.uDim.value = keys ? (p.onTo ? 1 : 0.35) : 1; });
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
    solids.forEach((m) => { m.opacity = bp ? 0.04 : 1; m.depthWrite = !bp; });
    edgeMat.opacity = bp ? 0.9 : 0;
    grid.material.opacity = bp ? 0.16 : 0;
    cloudMats.forEach((m) => (m.uniforms.uDim.value = bp ? 0.15 : 1));
    Object.values(islands).forEach((isl) => isl.terrain.traverse((o) => { if (o.userData.edge) o.visible = bp; }));
    if (bp) Object.values(islands).forEach((isl) => addTerrainEdges(isl.terrain));
  }
  function addTerrainEdges(t) {
    if (t.userData.hasEdges) return; t.userData.hasEdges = true;
    const meshes = []; t.traverse((o) => { if (o.isMesh && !o.userData.noEdge) meshes.push(o); });
    meshes.forEach((o) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), edgeMat); e.userData.edge = true; o.add(e); });
  }
  function regrow(newSeed) {
    seed = newSeed;
    Object.values(islands).forEach((isl, i) => {
      isl.root.remove(isl.terrain);
      isl.terrain.traverse((o) => o.geometry?.dispose());
      isl.terrain = growTerrain(isl.p, seed);
      if (style === "blueprint") addTerrainEdges(isl.terrain);
      isl.root.add(isl.terrain);
      window.gsap?.fromTo(isl.terrain.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 1.4, delay: i * 0.06, ease: "elastic.out(1, 0.6)" });
    });
    return seed;
  }

  // ---------- resize / loop ----------
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyOffset();
  });

  const clock = new THREE.Clock(), tmp = new THREE.Vector3();
  let frames = 0, running = true;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) { clock.getDelta(); loop(); } });

  function drift(pts, dt, speed) {
    const a = pts.geometry.attributes.position, { yMin, yMax, speed: sp } = pts.userData;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + dt * speed * sp[i];
      if (y > yMax) y = yMin;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const tt = reduced ? 0 : t;
    sky.material.uniforms.uTime.value = tt;
    cloudMats.forEach((m) => (m.uniforms.uTime.value = tt));
    if (!reduced) { drift(dust, dt, 0.25); drift(embers, dt, 1.1); dust.rotation.y = t * 0.01; }
    Object.values(islands).forEach((isl) => {
      isl.lift += (isl.liftTo - isl.lift) * Math.min(1, dt * 6);
      isl.root.position.y = isl.base.y + (reduced ? 0 : Math.sin(t * 0.5 + isl.phase) * 0.28) + isl.lift;
      isl.lm.tick(tt);
      const routeGlow = routeKeys && routeKeys.includes(isl.p.key) ? 0.4 + Math.sin(t * 2.5) * 0.3 : 0;
      isl.halo.material.opacity += ((isl.p.key === hovered ? 1 : routeGlow) - isl.halo.material.opacity) * Math.min(1, dt * 8);
    });
    paths.forEach((p) => { p.on += (p.onTo - p.on) * Math.min(1, dt * 4); p.mat.uniforms.uOn.value = p.on; p.mat.uniforms.uTime.value = tt; });
    noteObjs.forEach((n) => {
      n.g.position.y += Math.sin(t * 0.9 + n.phase) * 0.004;
      n.paper.rotation.y = t * 0.4 + n.phase;
      n.paper.rotation.z = Math.sin(t * 0.7 + n.phase) * 0.15;
      n.g.children.forEach((ch) => { if (ch !== n.paper && ch !== n.glow) { ch.rotation.y = n.paper.rotation.y; ch.rotation.z = n.paper.rotation.z; } });
      n.glow.material.opacity = n.found ? 0.12 : 0.35 + Math.sin(t * 3 + n.phase) * 0.2;
    });
    controls.update();

    const W = innerWidth, H = innerHeight;
    Object.values(islands).forEach((isl) => {
      tmp.copy(isl.root.position).add(V(0, isl.p.key === "lighthouse" ? 5.2 : isl.p.key === "origin" ? 4.8 : 3.6, 0));
      tmp.project(camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      const d = camera.position.distanceTo(isl.root.position);
      isl.label.style.transform = `translate(${((tmp.x + 1) / 2 * W).toFixed(1)}px, ${((1 - tmp.y) / 2 * H).toFixed(1)}px)`;
      isl.label.style.opacity = vis ? String(Math.max(0, Math.min(1, (130 - d) / 40))) : "0";
      isl.label.classList.toggle("is-near", d < 26);
    });

    composer.render();
    frames++;
    adapt(t);
  }

  // adaptive quality: protect the frame rate on slower machines
  let qT = 0, qF = 0, tier = 0;
  function adapt(t) {
    if (!qT) { qT = t; qF = frames; return; }
    if (t - qT < 2.5) return;
    const fps = (frames - qF) / (t - qT); qT = t; qF = frames;
    if (fps < 34 && tier === 0) { tier = 1; renderer.setPixelRatio(1); composer.setPixelRatio(1); composer.setSize(innerWidth, innerHeight); }
    else if (fps < 26 && tier === 1) { tier = 2; bloom.enabled = false; renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  }
  loop();

  return {
    enter() { const [p, t] = HOME(); flyTo(p, t, 3.2); },
    home() { const [p, t] = HOME(); flyTo(p, t, 1.8); },
    focus(key) { const [p, t] = viewFor(key); flyTo(p, t); },
    setPanelOffset(x, y) {
      offTween?.kill();
      offTween = window.gsap.to(offset, { x, y, duration: reduced ? 0.01 : 1.1, ease: "power3.inOut", onUpdate: applyOffset, onComplete: applyOffset });
    },
    setRoute, setStyle, regrow,
    get seed() { return seed; },
    get style() { return style; },
    markNote(i) { const n = noteObjs[i]; if (!n || n.found) return; n.found = true; n.paper.material.color.set(0xff8a50); },
    stats() {
      let objects = 0; scene.traverse(() => objects++);
      return { objects, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, frames };
    },
  };
}
