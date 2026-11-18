// Procedural fabric textures: woven normal map, block-print motif, zari (gold) border.
import * as THREE from '../vendor/three.module.js';

function canvas(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export function fabricTextures() {
  // Plain-weave height field → normal map
  const weave = canvas(256, (g, S) => {
    const img = g.createImageData(S, S), h = (x, y) => {
      const n = 32, u = (x / S) * n, v = (y / S) * n;
      const warp = Math.sin(u * Math.PI * 2) * 0.5 + 0.5, weft = Math.sin(v * Math.PI * 2) * 0.5 + 0.5;
      const over = (Math.floor(u) + Math.floor(v)) % 2 ? warp : weft;
      return over + 0.08 * Math.sin(x * 1.7 + y * 0.3);
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * 1.2, ny = -dy * 1.2, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * S + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255; img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255; img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  weave.repeat.set(10, 10);

  // Subtle buti (small floral) print, white base so material.color tints it
  const print = canvas(512, (g, S) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    const motif = (x, y, s) => {
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(255,236,190,0.85)';
      for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.ellipse(0, s * 0.55, s * 0.22, s * 0.45, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(120,20,40,0.6)'; g.beginPath(); g.arc(0, 0, s * 0.18, 0, Math.PI * 2); g.fill();
      g.restore();
    };
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) motif((i + (j % 2) * 0.5) * (S / 4) + S / 8, j * (S / 4) + S / 8, 18);
  });

  // Zari border: gold with embossed pattern
  const zari = canvas(256, (g, S) => {
    g.fillStyle = '#e6c15a'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#8a6514'; g.lineWidth = 3;
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 32 + 16, S / 2, 12, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#fff1b8'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 32 + 16, S / 2, 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#8a6514'; g.fillRect(0, 6, S, 4); g.fillRect(0, S - 10, S, 4);
  });
  zari.repeat.set(12, 1);
  for (const t of [print, zari]) t.colorSpace = THREE.SRGBColorSpace;
  return { weave, print, zari };
}
