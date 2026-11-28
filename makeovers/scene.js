import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('scene');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0xfff1ee, 0.5));
  const key = new THREE.DirectionalLight(0xffe7e0, 1.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf3b8c4, 1.2);
  rim.position.set(-6, -2, -4);
  scene.add(rim);

  // ---------- Materials ----------
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b08a, metalness: 1, roughness: 0.22 });
  const roseGold = new THREE.MeshStandardMaterial({ color: 0xe6b3a8, metalness: 1, roughness: 0.28 });
  const plum = new THREE.MeshPhysicalMaterial({ color: 0x4a2a30, metalness: 0.4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  const lipstick = new THREE.MeshPhysicalMaterial({ color: 0xb4475e, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.3 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xfff4ef, roughness: 0.18, metalness: 0, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 500] });
  const handle = new THREE.MeshPhysicalMaterial({ color: 0xf2d3c4, roughness: 0.35, clearcoat: 1 });
  const bristle = new THREE.MeshStandardMaterial({ color: 0xe7a7a8, roughness: 0.95 });
  const bristleTip = new THREE.MeshStandardMaterial({ color: 0x8a5a4e, roughness: 0.95 });
  const mirror = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.03 });
  const blush = new THREE.MeshStandardMaterial({ color: 0xeaa3a5, roughness: 0.9 });

  // ---------- Objects ----------
  const makeLipstick = () => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 1.5, 48), plum);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 48), gold);
    ring.position.y = 0.8;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.6, 48), gold);
    sleeve.position.y = 1.15;
    const bulletGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.9, 48, 8);
    const p = bulletGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0) p.setY(i, y - (p.getX(i) + 0.29) * 0.55 * (y / 0.45));
    }
    bulletGeo.computeVertexNormals();
    const bullet = new THREE.Mesh(bulletGeo, lipstick);
    bullet.position.y = 1.75;
    g.add(base, ring, sleeve, bullet);
    g.children.forEach((c) => (c.position.y -= 0.7));
    return g;
  };

  const makeBrush = (headScale = 1, color = bristle) => {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 2.6, 32), handle);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.55, 32), roseGold);
    ferrule.position.y = 1.55;
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(new THREE.Vector2(Math.sin(t * Math.PI) ** 0.7 * 0.34 * headScale + (1 - t) * 0.12, t * 1.1 * headScale));
    }
    const head = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), color);
    head.position.y = 1.8;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08 * headScale, 16, 16), bristleTip);
    tip.position.y = 1.8 + 1.08 * headScale;
    g.add(h, ferrule, head, tip);
    return g;
  };

  const makeCompact = () => {
    const g = new THREE.Group();
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.22, 64), roseGold);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 64), blush);
    pan.position.y = 0.12;
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.11, -1);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 64), roseGold);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.86, 64), mirror);
    glass.rotation.x = Math.PI / 2;
    glass.position.y = -0.085;
    lid.add(glass);
    lid.position.z = 1;
    lidPivot.add(lid);
    lidPivot.rotation.x = -1.95;
    g.add(bottom, pan, lidPivot);
    return g;
  };

  const makePearls = () => {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = 0.17 + 0.04 * Math.sin(a * 3);
      const m = new THREE.Mesh(geo, pearl);
      m.scale.setScalar(s);
      m.position.set(Math.cos(a) * 1.25, Math.sin(a * 2) * 0.12, Math.sin(a) * 0.9);
      g.add(m);
    }
    return g;
  };

  const makeLoosePearl = (r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32), pearl);
    return m;
  };

  // Cluster arranged as a floating vanity
  const cluster = new THREE.Group();
  scene.add(cluster);

  const items = [];
  const add = (obj, pos, rot, scale = 1, float = 1) => {
    const wrap = new THREE.Group();
    wrap.position.set(...pos);
    obj.rotation.set(...rot);
    obj.scale.setScalar(scale);
    wrap.add(obj);
    cluster.add(wrap);
    items.push({ wrap, obj, base: new THREE.Vector3(...pos), baseRot: obj.rotation.clone(), seed: Math.random() * 10, float });
    return wrap;
  };

  add(makeLipstick(), [0.2, 0.2, 0.6], [0.25, 0.4, -0.35], 1.25, 1);
  add(makeCompact(), [-1.5, -1.2, -0.6], [0.9, 0.5, 0.15], 1.05, 0.7);
  add(makeBrush(1), [1.9, 0.6, -0.8], [0.1, 0, -0.75], 1, 1.2);
  add(makeBrush(0.7, new THREE.MeshStandardMaterial({ color: 0xd99aa4, roughness: 0.95 })), [1.3, -1.6, 0.5], [0.4, 0, 0.95], 0.95, 0.9);
  add(makePearls(), [-0.9, 1.8, -1.2], [0.6, 0, 0.3], 0.9, 0.6);
  add(makeLoosePearl(0.28), [2.6, -0.5, 1.2], [0, 0, 0], 1, 1.5);
  add(makeLoosePearl(0.18), [-2.4, 0.6, 1], [0, 0, 0], 1, 1.8);
  add(makeLoosePearl(0.22), [0.8, 2.4, 0.4], [0, 0, 0], 1, 1.4);

  // ---------- Glitter ----------
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const COUNT = window.innerWidth < 760 ? 260 : 520;
  const gPos = new Float32Array(COUNT * 3);
  const gCol = new Float32Array(COUNT * 3);
  const palette = [new THREE.Color(0xd8b08a), new THREE.Color(0xc98a97), new THREE.Color(0xe8c7b0), new THREE.Color(0xa8657a)];
  for (let i = 0; i < COUNT; i++) {
    gPos[i * 3] = (Math.random() - 0.5) * 22;
    gPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
    gPos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    const c = palette[i % palette.length];
    gCol.set([c.r, c.g, c.b], i * 3);
  }
  const glitterGeo = new THREE.BufferGeometry();
  glitterGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  glitterGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  const glitter = new THREE.Points(glitterGeo, new THREE.PointsMaterial({
    size: 0.09, map: sprite, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  scene.add(glitter);

  // ---------- Layout / interaction ----------
  let mobile = false;
  const layout = { x: 3, y: 0, s: 1 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    mobile = w < 760;
    if (mobile) Object.assign(layout, { x: 0, y: 2.6, s: 0.68 });
    else if (w < 1020) Object.assign(layout, { x: 2.6, y: 0, s: 0.8 });
    else Object.assign(layout, { x: 3.5, y: 0, s: 0.95 });
  }
  resize();
  window.addEventListener('resize', resize);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let scroll = 0, scrollT = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollT = max > 0 ? window.scrollY / max : 0;
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  const clock = new THREE.Clock();
  function frame() {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    const ease = reduceMotion ? 1 : 0.06;
    scroll += (scrollT - scroll) * ease;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    // Hero: cluster sits beside the copy. As you scroll it drifts to the edge,
    // opens up and turns, staying as a soft backdrop behind the content.
    const p = Math.min(scroll * 3.2, 1);
    cluster.position.set(
      layout.x + p * (mobile ? 0 : 1.4),
      layout.y + p * (mobile ? 6 : 0.6) - scroll * (mobile ? 0 : 1.5),
      -p * 3.5
    );
    cluster.scale.setScalar(layout.s * (1 + p * 0.15));
    cluster.rotation.y = scroll * Math.PI * 1.4 + pointer.x * 0.25;
    cluster.rotation.x = pointer.y * 0.12 + scroll * 0.3;

    items.forEach((it, i) => {
      const k = it.float;
      it.wrap.position.set(
        it.base.x * (1 + p * 0.35),
        it.base.y * (1 + p * 0.35) + Math.sin(t * 0.7 * k + it.seed) * 0.14,
        it.base.z + Math.cos(t * 0.5 * k + it.seed) * 0.1
      );
      it.obj.rotation.set(
        it.baseRot.x + Math.sin(t * 0.4 + i) * 0.08,
        it.baseRot.y + t * 0.18 * k,
        it.baseRot.z + Math.cos(t * 0.35 + i) * 0.06
      );
    });

    glitter.rotation.y = t * 0.02 + pointer.x * 0.05;
    glitter.position.y = scroll * 14 + Math.sin(t * 0.2) * 0.2;

    camera.position.x = pointer.x * 0.4;
    camera.position.y = -pointer.y * 0.3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  if (reduceMotion) {
    frame();
    window.addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true });
    window.addEventListener('resize', () => requestAnimationFrame(frame));
  } else {
    requestAnimationFrame(frame);
  }
}

init();
