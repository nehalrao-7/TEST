// Fabric library: physically-based fabric types (weave normal maps + sheen/roughness +
// drape physics) and procedurally drawn Indian prints at real-world scale (cm).
import * as THREE from '../vendor/three.module.js';

export const FABRICS = {
  cotton: { name: 'Cotton lawn', gsm: 90, weave: 'plain', threadsPerCm: 28, roughness: 0.82, sheen: 0.35, sheenRoughness: 0.7, normalScale: 0.6, anisotropy: 0,
    phys: { bend: 0.35, friction: 0.45, damping: 0.96, gravity: 1.0 } },
  silk: { name: 'Silk satin', gsm: 75, weave: 'satin', threadsPerCm: 40, roughness: 0.3, sheen: 1, sheenRoughness: 0.22, normalScale: 0.2, anisotropy: 0.75, clearcoat: 0.08,
    phys: { bend: 0.12, friction: 0.18, damping: 0.985, gravity: 1.0 } },
  georgette: { name: 'Georgette', gsm: 65, weave: 'crepe', threadsPerCm: 30, roughness: 0.92, sheen: 0.55, sheenRoughness: 0.45, normalScale: 0.9, anisotropy: 0,
    phys: { bend: 0.05, friction: 0.35, damping: 0.975, gravity: 0.9 } },
  chanderi: { name: 'Chanderi silk-cotton', gsm: 70, weave: 'plain', threadsPerCm: 36, roughness: 0.55, sheen: 0.8, sheenRoughness: 0.38, normalScale: 0.35, anisotropy: 0.3,
    phys: { bend: 0.2, friction: 0.3, damping: 0.98, gravity: 0.85 } },
  linen: { name: 'Linen', gsm: 160, weave: 'slub', threadsPerCm: 16, roughness: 0.9, sheen: 0.2, sheenRoughness: 0.8, normalScale: 1.0, anisotropy: 0,
    phys: { bend: 0.55, friction: 0.5, damping: 0.95, gravity: 1.1 } },
  velvet: { name: 'Velvet', gsm: 280, weave: 'pile', threadsPerCm: 40, roughness: 1, sheen: 1, sheenRoughness: 0.3, normalScale: 0.25, anisotropy: 0,
    phys: { bend: 0.7, friction: 0.6, damping: 0.95, gravity: 1.25 } },
};

export const PRINTS = {
  solid: 'Solid', phulkari: 'Phulkari', paisley: 'Paisley', bandhani: 'Bandhani', buti: 'Buti floral', block: 'Block print', ikat: 'Ikat', leheriya: 'Leheriya',
};

// ---------- helpers ----------
function makeCanvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
function texFrom(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function shade(hex, f) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f))); return '#' + c.getHexString();
}
// draw repeatedly with wrap so motifs on tile edges tile seamlessly
function wrapDraw(S, x, y, r, fn) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (x + dx > -r && x + dx < S + r && y + dy > -r && y + dy < S + r) fn(x + dx, y + dy);
}

// ---------- weave normal maps ----------
const weaveCache = {};
export function weaveTexture(type) {
  if (weaveCache[type]) return weaveCache[type];
  const S = 512, threads = 32, c = makeCanvas(S), g = c.getContext('2d'), img = g.createImageData(S, S);
  const R = rnd(11), slub = Float32Array.from({ length: threads }, () => 0.7 + R() * 0.6 * (type === 'slub' ? 1 : 0.2));
  const noise = Float32Array.from({ length: 64 * 64 }, () => R());
  const vnoise = (x, y) => {
    const xi = Math.floor(x) & 63, yi = Math.floor(y) & 63, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const n = (a, b) => noise[((b & 63) << 6) | (a & 63)];
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    return (n(xi, yi) * (1 - sx) + n(xi + 1, yi) * sx) * (1 - sy) + (n(xi, yi + 1) * (1 - sx) + n(xi + 1, yi + 1) * sx) * sy;
  };
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x / S) * threads, v = (y / S) * threads, iu = Math.floor(u), iv = Math.floor(v);
    const fu = u - iu, fv = v - iv;
    const warp = Math.sin(fu * Math.PI) * slub[iu % threads], weft = Math.sin(fv * Math.PI) * slub[iv % threads];
    let h;
    if (type === 'satin') h = ((iu * 2 + iv) % 5 === 0 ? weft : warp * 0.6 + 0.4 * Math.sin(fu * Math.PI));
    else if (type === 'crepe') h = 0.5 * ((iu + iv) % 2 ? warp : weft) + 0.9 * vnoise(x / 6, y / 6) + 0.5 * vnoise(x / 2.5 + 9, y / 2.5);
    else if (type === 'pile') h = 0.6 * vnoise(x / 1.7, y / 1.7) + 0.4 * vnoise(x / 5, y / 5);
    else h = (iu + iv) % 2 ? warp : weft;
    H[y * S + x] = h;
  }
  const at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
    const nx = -dx * 2, ny = -dy * 2, l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (weaveCache[type] = { tex: texFrom(c, false), canvas: c, threads });
}

// ---------- prints (one tile; the tile spans `scale` cm of fabric) ----------
const DRAW = {
  solid(g, S, f) { g.fillStyle = f.ground; g.fillRect(0, 0, S, S); },

  // Punjabi phulkari: dense satin-stitch geometric "baghs" in golden silk
  phulkari(g, S, f) {
    g.fillStyle = f.ground; g.fillRect(0, 0, S, S);
    const cells = 4, cs = S / cells;
    const stitch = (cx, cy, r, col, ang) => {
      g.save(); g.translate(cx, cy); g.rotate(ang);
      g.strokeStyle = col; g.lineWidth = S / 380;
      for (let t = -r; t <= r; t += S / 260) { const w = r - Math.abs(t); g.beginPath(); g.moveTo(-w, t); g.lineTo(w, t); g.stroke(); }
      g.restore();
    };
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
      const cx = (i + 0.5) * cs, cy = (j + 0.5) * cs;
      stitch(cx, cy, cs * 0.34, f.accent, 0);
      stitch(cx, cy, cs * 0.17, f.accent2, Math.PI / 4);
      for (const [dx, dy] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) stitch(cx + dx * cs, cy + dy * cs, cs * 0.09, shade(f.accent, 0.8), 0);
    }
    g.globalAlpha = 0.18; g.strokeStyle = '#000'; g.lineWidth = 1;
    for (let k = 0; k < S; k += 3) { g.beginPath(); g.moveTo(0, k); g.lineTo(S, k + 1); g.stroke(); }
    g.globalAlpha = 1;
  },

  paisley(g, S, f) {
    g.fillStyle = f.ground; g.fillRect(0, 0, S, S);
    const R = rnd(5);
    const one = (x, y, s, a) => {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
      const path = () => { g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(-45, 30, -40, -30, 0, -35); g.bezierCurveTo(30, -38, 45, -10, 25, 10); g.bezierCurveTo(10, 25, 30, 45, 0, 40); g.closePath(); };
      path(); g.fillStyle = f.accent; g.fill();
      g.lineWidth = 3; g.strokeStyle = shade(f.accent, 0.55); g.stroke();
      g.save(); g.scale(0.62, 0.62); path(); g.fillStyle = f.accent2; g.fill(); g.restore();
      g.fillStyle = shade(f.accent, 0.5);
      for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(-10 + k * 3, -12 + k * 5, 2.4, 0, 6.3); g.fill(); }
      g.restore();
    };
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const x = (i + (j % 2) * 0.5) * (S / 3) + S / 6, y = j * (S / 3) + S / 6, a = R() * 0.6 - 0.3 + (j % 2 ? Math.PI : 0);
      wrapDraw(S, x, y, S / 5, (px, py) => one(px, py, S / 420, a));
    }
  },

  // Bandhani: tie-dye dots, white ring with dyed centre, slightly irregular
  bandhani(g, S, f) {
    g.fillStyle = f.ground; g.fillRect(0, 0, S, S);
    const R = rnd(9), n = 14, step = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + (j % 2) * 0.5) * step + (R() - 0.5) * step * 0.15, y = (j + 0.5) * step + (R() - 0.5) * step * 0.15;
      const big = (i + j) % 4 === 0;
      wrapDraw(S, x, y, step, (px, py) => {
        const r = step * (big ? 0.24 : 0.17);
        const grd = g.createRadialGradient(px, py, r * 0.2, px, py, r);
        grd.addColorStop(0, big ? f.accent2 : '#fff6e6'); grd.addColorStop(0.55, big ? f.accent : '#f7ead0'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(px, py, r, 0, 6.3); g.fill();
      });
    }
  },

  buti(g, S, f) {
    g.fillStyle = f.ground; g.fillRect(0, 0, S, S);
    const flower = (x, y, s) => {
      g.save(); g.translate(x, y);
      g.fillStyle = f.accent;
      for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.ellipse(0, s * 0.55, s * 0.22, s * 0.45, 0, 0, 6.3); g.fill(); }
      g.fillStyle = f.accent2; g.beginPath(); g.arc(0, 0, s * 0.2, 0, 6.3); g.fill();
      g.strokeStyle = shade(f.accent, 0.6); g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(0, s * 0.9); g.quadraticCurveTo(s * 0.5, s * 1.3, s * 0.9, s * 1.2); g.stroke();
      g.restore();
    };
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const x = (i + (j % 2) * 0.5) * (S / 5) + S / 10, y = j * (S / 5) + S / 10;
      wrapDraw(S, x, y, S / 8, (px, py) => flower(px, py, S / 42));
    }
  },

  // Hand block print: outlined florals in a grid with slight mis-registration
  block(g, S, f) {
    g.fillStyle = f.ground; g.fillRect(0, 0, S, S);
    const n = 4, cs = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * cs, y = (j + 0.5) * cs, r = cs * 0.32;
      g.fillStyle = f.accent2;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55 + 2, y + Math.sin(a) * r * 0.55 + 1, r * 0.32, r * 0.18, a, 0, 6.3); g.fill(); }
      g.strokeStyle = f.accent; g.lineWidth = S / 300;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.32, r * 0.18, a, 0, 6.3); g.stroke(); }
      g.fillStyle = f.accent; g.beginPath(); g.arc(x, y, r * 0.18, 0, 6.3); g.fill();
      g.beginPath(); g.moveTo(i * cs, j * cs + cs * 0.06); g.lineTo((i + 1) * cs, j * cs + cs * 0.06); g.stroke();
    }
    // ink texture
    const R = rnd(3); g.globalAlpha = 0.12; g.fillStyle = f.ground;
    for (let k = 0; k < 900; k++) g.fillRect(R() * S, R() * S, 2 + R() * 4, 1 + R() * 2);
    g.globalAlpha = 1;
  },

  // Ikat: feathered chevron bands
  ikat(g, S, f) {
    g.fillStyle = f.ground; g.fillRect(0, 0, S, S);
    const R = rnd(21), bands = 4, bh = S / bands;
    for (let b = 0; b < bands; b++) {
      const col = b % 2 ? f.accent : f.accent2;
      for (let y = 0; y < bh * 0.6; y += 2) {
        const yy = b * bh + y, jitter = (R() - 0.5) * S * 0.025;
        g.strokeStyle = col; g.globalAlpha = 0.85; g.lineWidth = 2; g.beginPath();
        for (let x = 0; x <= S; x += S / 8) { const zz = yy + (((x / (S / 8)) % 2) ? bh * 0.25 : 0); x === 0 ? g.moveTo(x + jitter, zz) : g.lineTo(x + jitter, zz); }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  },

  // Leheriya: diagonal resist-dyed waves
  leheriya(g, S, f) {
    g.fillStyle = f.ground; g.fillRect(0, 0, S, S);
    const lines = 10;
    g.lineWidth = S / lines * 0.28;
    for (let k = -lines; k < lines * 2; k++) {
      g.strokeStyle = k % 2 ? f.accent : f.accent2; g.globalAlpha = 0.85;
      g.beginPath();
      for (let t = 0; t <= S; t += 8) { const x = t, y = t + k * (S / lines) + Math.sin(t / S * 6.283 * 2) * 6; t === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  },
};

const printCache = new Map();
export function printCanvas(print, ground, accent, accent2, size = 1024) {
  const key = [print, ground, accent, accent2, size].join('|');
  if (printCache.has(key)) return printCache.get(key);
  const c = makeCanvas(size);
  (DRAW[print] || DRAW.solid)(c.getContext('2d'), size, { ground, accent, accent2 });
  printCache.set(key, c);
  if (printCache.size > 40) printCache.delete(printCache.keys().next().value);
  return c;
}

/** Apply fabric settings to (or create) a MeshPhysicalMaterial. spec = {type, print, ground, accent, accent2, scale} */
export function applyFabric(mat, spec) {
  const F = FABRICS[spec.type] || FABRICS.cotton;
  mat = mat || new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const canvas = printCanvas(spec.print, spec.ground, spec.accent, spec.accent2);
  if (!mat.map || mat.map.image !== canvas) { mat.map?.dispose(); mat.map = texFrom(canvas, true); }
  const scale = spec.print === 'solid' ? 50 : spec.scale;
  mat.map.repeat.set(1 / scale, 1 / scale);
  const w = weaveTexture(F.weave);
  mat.normalMap = w.tex.clone(); mat.normalMap.needsUpdate = true;
  const weaveCm = w.threads / F.threadsPerCm;
  mat.normalMap.repeat.set(1 / weaveCm, 1 / weaveCm);
  mat.normalScale = new THREE.Vector2(F.normalScale, F.normalScale);
  mat.color.set('#ffffff');
  Object.assign(mat, { roughness: F.roughness, sheen: F.sheen, sheenRoughness: F.sheenRoughness, anisotropy: F.anisotropy, clearcoat: F.clearcoat || 0, clearcoatRoughness: 0.4 });
  mat.sheenColor = new THREE.Color(spec.print === 'solid' ? shade(spec.ground, 1.35) : '#ffffff').lerp(new THREE.Color('#ffffff'), 0.35);
  if (spec.type === 'velvet') mat.sheenColor.set(shade(spec.ground, 1.8));
  // inner layers lose depth ties against the garment worn over them
  if (spec.layer === 'inner') Object.assign(mat, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 });
  mat.needsUpdate = true;
  return mat;
}

/** Gold zari border (metallic) */
export function zariMaterial() {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d');
  g.fillStyle = '#c9a23a'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#7a5a12'; g.lineWidth = 6;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 64, S / 2); g.lineTo(i * 64, S); g.stroke(); }
  g.fillStyle = '#ffe9a8';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(i * 64 + 32, j * 64 + 32, 7, 0, 6.3); g.fill(); }
  const map = texFrom(c, true); map.repeat.set(1 / 3, 1 / 3);
  const w = weaveTexture('satin').tex.clone(); w.needsUpdate = true; w.repeat.set(1.5, 1.5);
  return new THREE.MeshPhysicalMaterial({ map, normalMap: w, normalScale: new THREE.Vector2(0.6, 0.6), metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide });
}

/** small swatch canvases for the UI */
export function swatch(spec, size = 64) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.drawImage(printCanvas(spec.print, spec.ground, spec.accent, spec.accent2), 0, 0, size, size);
  const w = weaveTexture((FABRICS[spec.type] || FABRICS.cotton).weave).canvas;
  g.globalAlpha = 0.35; g.globalCompositeOperation = 'overlay'; g.drawImage(w, 0, 0, 256, 256, 0, 0, size, size);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  return c;
}
