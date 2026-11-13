import * as THREE from "three";
import { brand, sponsors, type Sponsor } from "./brand";
import { COURT, FT } from "./court";

/**
 * Every branded surface in the scene is painted at runtime onto a 2D canvas
 * and uploaded as a texture. No image downloads are needed, and swapping the
 * brand config re-skins everything.
 */

export type BrandAssets = {
  logo: HTMLImageElement | null;
  sponsorLogos: (HTMLImageElement | null)[];
};

const C = brand.colors;
const DISPLAY = `"${brand.fonts.display}", Impact, "Arial Narrow", sans-serif`;
const BODY = `"${brand.fonts.body}", system-ui, sans-serif`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Wait for fonts and any brand/sponsor logo images before painting textures. */
export async function loadBrandAssets(): Promise<BrandAssets> {
  await Promise.all([
    document.fonts.load(`400 100px "${brand.fonts.display}"`),
    document.fonts.load(`700 40px "${brand.fonts.body}"`),
  ]).catch(() => undefined);
  const [logo, ...sponsorLogos] = await Promise.all([
    brand.logo ? loadImage(brand.logo) : Promise.resolve(null),
    ...sponsors.map((s) => (s.logo ? loadImage(s.logo) : Promise.resolve(null))),
  ]);
  return { logo, sponsorLogos };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, opts: { repeatX?: boolean; anisotropy?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.anisotropy ?? 8;
  if (opts.repeatX) t.wrapS = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Small deterministic PRNG so the wood pattern is identical every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Fit text to a max width by shrinking the font size. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  family = DISPLAY,
  weight = "400",
) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 6) {
    s *= 0.94;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Brand marks                                                          */
/* ------------------------------------------------------------------ */

/** Placeholder Muqabla crest (or the real logo image when provided). */
export function drawCrest(
  ctx: CanvasRenderingContext2D,
  assets: BrandAssets,
  cx: number,
  cy: number,
  r: number,
  opts: { ring?: string; fill?: string; alpha?: number } = {},
) {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  if (assets.logo) {
    drawContain(ctx, assets.logo, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = opts.fill ?? C.ink;
  ctx.fill();
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = opts.ring ?? C.primary;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.025;
  ctx.strokeStyle = C.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = C.paper;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${r * 1.0}px ${DISPLAY}`;
  ctx.fillText("M", cx, cy - r * 0.1);
  ctx.fillStyle = C.accent;
  fitText(ctx, brand.name, r * 1.05, r * 0.2);
  ctx.fillText(brand.name, cx, cy + r * 0.5);
  ctx.restore();
}

/** Placeholder sponsor lockup: a simple mark plus the name, or the real logo. */
export function drawSponsor(
  ctx: CanvasRenderingContext2D,
  assets: BrandAssets,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color?: string,
) {
  const s: Sponsor = sponsors[index % sponsors.length];
  const img = assets.sponsorLogos[index % sponsors.length];
  ctx.save();
  if (img) {
    drawContain(ctx, img, x, y, w, h);
    ctx.restore();
    return;
  }
  const col = color ?? s.color;
  const m = h * 0.62; // mark size
  ctx.font = `400 ${h * 0.5}px ${DISPLAY}`;
  const textW = Math.min(ctx.measureText(s.name).width, w - m * 1.3);
  const total = m + h * 0.22 + textW;
  const mx = x + (w - total) / 2;
  const my = y + (h - m) / 2;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = m * 0.14;
  ctx.beginPath();
  switch (s.mark) {
    case "circle":
      ctx.arc(mx + m / 2, my + m / 2, m / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "ring":
      ctx.arc(mx + m / 2, my + m / 2, m / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "triangle":
      ctx.moveTo(mx + m / 2, my);
      ctx.lineTo(mx + m, my + m);
      ctx.lineTo(mx, my + m);
      ctx.closePath();
      ctx.fill();
      break;
    case "square":
      ctx.rect(mx + m * 0.06, my + m * 0.06, m * 0.88, m * 0.88);
      ctx.fill();
      break;
    case "diamond":
      ctx.moveTo(mx + m / 2, my);
      ctx.lineTo(mx + m, my + m / 2);
      ctx.lineTo(mx + m / 2, my + m);
      ctx.lineTo(mx, my + m / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case "bars":
      for (let i = 0; i < 3; i++) ctx.rect(mx + i * m * 0.36, my + m * (0.5 - i * 0.25), m * 0.24, m * (0.5 + i * 0.25));
      ctx.fill();
      break;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  fitText(ctx, s.name, w - m * 1.3, h * 0.5);
  ctx.fillText(s.name, mx + m + h * 0.22, y + h / 2 + h * 0.02);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Court floor                                                          */
/* ------------------------------------------------------------------ */

export function courtTexture(assets: BrandAssets, width = 4096) {
  const L = COURT.floorLength;
  const W = COURT.floorWidth;
  const ppm = width / L;
  const { c, ctx } = canvas(width, (width * W) / L);
  const X = (x: number) => (x + L / 2) * ppm;
  const Z = (z: number) => (z + W / 2) * ppm;
  const M = (m: number) => m * ppm;
  const hl = COURT.length / 2;
  const hw = COURT.width / 2;
  const rand = rng(7);

  // Apron: deep ink with a primary pinstripe.
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, c.width, c.height);

  // Maple planks run the length of the court.
  const plank = 0.057;
  const woodPad = 0.35;
  const wx0 = -hl - woodPad;
  const wx1 = hl + woodPad;
  for (let z = -hw - woodPad; z < hw + woodPad; z += plank) {
    let x = wx0 - rand() * 2;
    while (x < wx1) {
      const len = 1.2 + rand() * 2.6;
      const l = 56 + (rand() - 0.5) * 9;
      const s = 50 + (rand() - 0.5) * 12;
      ctx.fillStyle = `hsl(${30 + (rand() - 0.5) * 4}, ${s}%, ${l}%)`;
      const x0 = Math.max(x, wx0);
      const x1 = Math.min(x + len, wx1);
      ctx.fillRect(X(x0), Z(z), M(x1 - x0) - 0.6, M(plank) - 0.5);
      // grain streaks
      ctx.fillStyle = `rgba(110, 60, 20, ${0.05 + rand() * 0.06})`;
      for (let g = 0; g < 2; g++) {
        ctx.fillRect(X(x0), Z(z + rand() * plank), M(x1 - x0), Math.max(0.6, M(0.004)));
      }
      x += len;
    }
  }
  // Soft sheen variation across the floor.
  const sheen = ctx.createRadialGradient(X(0), Z(0), M(2), X(0), Z(0), M(18));
  sheen.addColorStop(0, "rgba(255, 230, 190, 0.10)");
  sheen.addColorStop(1, "rgba(60, 30, 10, 0.12)");
  ctx.fillStyle = sheen;
  ctx.fillRect(X(wx0), Z(-hw - woodPad), M(wx1 - wx0), M(COURT.width + woodPad * 2));

  // Re-paint the apron so the wood ends cleanly just outside the lines.
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, c.width, Z(-hw - woodPad));
  ctx.fillRect(0, Z(hw + woodPad), c.width, c.height);
  ctx.fillRect(0, 0, X(wx0), c.height);
  ctx.fillRect(X(wx1), 0, c.width, c.height);
  ctx.strokeStyle = C.primary;
  ctx.lineWidth = M(0.12);
  ctx.strokeRect(X(wx0) - M(0.25), Z(-hw - woodPad) - M(0.25), M(wx1 - wx0 + 0.5), M(COURT.width + woodPad * 2 + 0.5));

  // Painted keys.
  const keyLen = 19 * FT;
  const keyHalf = 8 * FT;
  ctx.fillStyle = C.primary;
  ctx.globalAlpha = 0.93;
  ctx.fillRect(X(-hl), Z(-keyHalf), M(keyLen), M(keyHalf * 2));
  ctx.fillRect(X(hl - keyLen), Z(-keyHalf), M(keyLen), M(keyHalf * 2));
  ctx.globalAlpha = 1;
  // Watermark crests in the keys.
  drawCrest(ctx, assets, X(-hl + keyLen * 0.55), Z(0), M(1.25), { fill: "rgba(0,0,0,0)", ring: C.paper, alpha: 0.16 });
  drawCrest(ctx, assets, X(hl - keyLen * 0.55), Z(0), M(1.25), { fill: "rgba(0,0,0,0)", ring: C.paper, alpha: 0.16 });

  // Center court crest, big like an NBA home floor.
  drawCrest(ctx, assets, X(0), Z(0), M(2.65));

  // Sponsor marks on the wood near half court, both sidelines.
  const spW = M(2.7);
  const spH = M(0.75);
  ([
    [-4.4, 5.65, 0],
    [4.4, 5.65, 1],
    [-4.4, -5.65, 2],
    [4.4, -5.65, 3],
  ] as const).forEach(([x, z, i]) => {
    ctx.globalAlpha = 0.85;
    drawSponsor(ctx, assets, i, X(x) - spW / 2, Z(z) - spH / 2, spW, spH, C.ink);
    ctx.globalAlpha = 1;
  });

  // ---- Lines --------------------------------------------------------
  ctx.strokeStyle = C.paper;
  ctx.lineWidth = M(2 / 12 * FT);
  ctx.lineCap = "butt";
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    ctx.beginPath();
    ctx.moveTo(X(x0), Z(z0));
    ctx.lineTo(X(x1), Z(z1));
    ctx.stroke();
  };
  const arc = (x: number, z: number, r: number, a0: number, a1: number, dash: number[] = []) => {
    ctx.setLineDash(dash.map(M));
    ctx.beginPath();
    ctx.arc(X(x), Z(z), M(r), a0, a1);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  ctx.strokeRect(X(-hl), Z(-hw), M(COURT.length), M(COURT.width));
  line(0, -hw, 0, hw);
  arc(0, 0, 6 * FT, 0, Math.PI * 2);
  arc(0, 0, 2 * FT, 0, Math.PI * 2);

  const cornerZ = 22 * FT;
  const arcR = 23.75 * FT;
  const cornerA = Math.acos(Math.sqrt(arcR * arcR - cornerZ * cornerZ) / arcR);
  const straightLen = Math.sqrt(arcR * arcR - cornerZ * cornerZ);

  for (const side of [-1, 1]) {
    const base = side * hl;
    const hoop = side * COURT.hoopX;
    const ft = side * (hl - keyLen);
    // key
    line(base, -keyHalf, ft, -keyHalf);
    line(base, keyHalf, ft, keyHalf);
    line(ft, -keyHalf, ft, keyHalf);
    // free-throw circle: solid toward center court, dashed toward the basket
    const toCenter = side > 0 ? Math.PI : 0;
    arc(ft, 0, 6 * FT, toCenter - Math.PI / 2, toCenter + Math.PI / 2);
    arc(ft, 0, 6 * FT, toCenter + Math.PI / 2, toCenter + Math.PI * 1.5, [0.35, 0.3]);
    // restricted area
    arc(hoop, 0, 4 * FT, toCenter - Math.PI / 2, toCenter + Math.PI / 2);
    line(hoop, -4 * FT, hoop + side * 0.3, -4 * FT);
    line(hoop, 4 * FT, hoop + side * 0.3, 4 * FT);
    // three-point line
    line(base, -cornerZ, hoop - side * straightLen, -cornerZ);
    line(base, cornerZ, hoop - side * straightLen, cornerZ);
    arc(hoop, 0, arcR, toCenter - cornerA, toCenter + cornerA);
    // lane space marks
    for (const d of [7, 8, 11, 14]) {
      const x = base - side * d * FT;
      line(x, -keyHalf, x, -keyHalf - 0.5 * FT);
      line(x, keyHalf, x, keyHalf + 0.5 * FT);
    }
    // coaching box hashes
    const hx = base - side * 28 * FT;
    line(hx, -hw, hx, -hw + 3 * FT);
    line(hx, hw, hx, hw - 3 * FT);
  }

  // ---- Apron branding ----------------------------------------------
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Baselines: wordmark reads facing each basket from center court.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(X(side * (hl + (L / 2 - hl) / 2 + 0.1)), Z(0));
    ctx.rotate((side * Math.PI) / 2);
    ctx.fillStyle = C.paper;
    fitText(ctx, brand.name, M(11), M(1.9));
    ctx.fillText(brand.name, 0, M(0.08));
    ctx.restore();
  }
  // Far sideline: event name between sponsors.
  const farZ = -hw - (W / 2 - hw) / 2 - 0.05;
  ctx.fillStyle = C.accent;
  fitText(ctx, brand.event, M(11), M(1.35));
  ctx.fillText(brand.event, X(0), Z(farZ) + M(0.06));
  drawSponsor(ctx, assets, 4, X(-11.5), Z(farZ) - M(0.55), M(5), M(1.1));
  drawSponsor(ctx, assets, 5, X(6.5), Z(farZ) - M(0.55), M(5), M(1.1));
  // Near sideline (behind the scorer's table): sponsors.
  const nearZ = hw + (W / 2 - hw) / 2 + 0.05;
  drawSponsor(ctx, assets, 0, X(-13), Z(nearZ) - M(0.5), M(5), M(1));
  drawSponsor(ctx, assets, 1, X(8), Z(nearZ) - M(0.5), M(5), M(1));
  ctx.fillStyle = C.paper;
  fitText(ctx, brand.name, M(6), M(1.2));
  ctx.fillText(brand.name, X(0), Z(nearZ) + M(0.05));

  return toTexture(c, { anisotropy: 16 });
}

/* ------------------------------------------------------------------ */
/* LED ribbon boards                                                    */
/* ------------------------------------------------------------------ */

/**
 * A seamless strip of alternating brand / sponsor tiles. The returned texture
 * repeats along X; `metersPerRepeat` tells geometry how to map UVs.
 */
export function ribbonTexture(assets: BrandAssets, heightPx = 128, tileAspect = 6) {
  const tiles = sponsors.length * 2;
  const tileW = heightPx * tileAspect;
  const { c, ctx } = canvas(tileW * tiles, heightPx);
  for (let i = 0; i < tiles; i++) {
    const x = i * tileW;
    const isBrand = i % 2 === 0;
    const g = ctx.createLinearGradient(0, 0, 0, heightPx);
    if (isBrand) {
      g.addColorStop(0, C.primary);
      g.addColorStop(1, "#7a0818");
    } else {
      g.addColorStop(0, "#131318");
      g.addColorStop(1, "#050507");
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, tileW, heightPx);
    if (isBrand) {
      ctx.fillStyle = C.paper;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fitText(ctx, brand.event, tileW * 0.8, heightPx * 0.62);
      ctx.fillText(brand.event, x + tileW / 2, heightPx * 0.54);
    } else {
      drawSponsor(ctx, assets, (i - 1) / 2, x + tileW * 0.1, heightPx * 0.18, tileW * 0.8, heightPx * 0.64);
    }
  }
  // LED pixel grid.
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  const step = Math.max(3, Math.round(heightPx / 40));
  for (let y = 0; y < heightPx; y += step) ctx.fillRect(0, y, c.width, 1);
  for (let x = 0; x < c.width; x += step) ctx.fillRect(x, 0, 1, heightPx);
  const tex = toTexture(c, { repeatX: true });
  return { tex, aspect: c.width / c.height };
}

/* ------------------------------------------------------------------ */
/* Center-hung scoreboard                                               */
/* ------------------------------------------------------------------ */

export function scoreboardTexture(assets: BrandAssets, w = 1600, h = 900, variant = 0) {
  const { c, ctx } = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#14060a");
  g.addColorStop(0.55, "#2a050d");
  g.addColorStop(1, C.primary);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // diagonal speed stripes
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = C.accent;
  for (let i = -4; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(i * w * 0.12, h);
    ctx.lineTo(i * w * 0.12 + w * 0.05, h);
    ctx.lineTo(i * w * 0.12 + w * 0.35, 0);
    ctx.lineTo(i * w * 0.12 + w * 0.3, 0);
    ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (variant === 0) {
    drawCrest(ctx, assets, w * 0.5, h * 0.36, h * 0.24);
    ctx.fillStyle = C.paper;
    fitText(ctx, brand.event, w * 0.86, h * 0.16);
    ctx.fillText(brand.event, w / 2, h * 0.73);
    ctx.fillStyle = C.accent;
    fitText(ctx, "WELCOME TO THE ARENA", w * 0.6, h * 0.07, BODY, "700");
    ctx.fillText("WELCOME TO THE ARENA", w / 2, h * 0.87);
  } else {
    ctx.fillStyle = C.paper;
    fitText(ctx, brand.name, w * 0.9, h * 0.42);
    ctx.fillText(brand.name, w / 2, h * 0.45);
    ctx.fillStyle = C.accent;
    fitText(ctx, "THE TUNNEL IS OPEN", w * 0.7, h * 0.1, BODY, "700");
    ctx.fillText("THE TUNNEL IS OPEN", w / 2, h * 0.78);
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 1.5);
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/* Tunnel / hallway                                                     */
/* ------------------------------------------------------------------ */

/** Long painted wall: concrete, brand stripe, giant wordmark and slogans. */
export function hallWallTexture(assets: BrandAssets, lengthM: number, heightM: number, side: "left" | "right") {
  const ppm = 180;
  const { c, ctx } = canvas(lengthM * ppm, heightM * ppm);
  const rand = rng(side === "left" ? 11 : 23);
  // painted block wall
  ctx.fillStyle = "#1a1a1e";
  ctx.fillRect(0, 0, c.width, c.height);
  const bw = 0.4 * ppm;
  const bh = 0.2 * ppm;
  for (let y = 0; y < c.height; y += bh) {
    const off = (Math.round(y / bh) % 2) * bw * 0.5;
    for (let x = -bw; x < c.width; x += bw) {
      ctx.fillStyle = `rgba(255,255,255,${0.015 + rand() * 0.025})`;
      ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
    }
  }
  // base and stripe
  ctx.fillStyle = "#0c0c0e";
  ctx.fillRect(0, c.height - 0.18 * ppm, c.width, 0.18 * ppm);
  ctx.fillStyle = C.primary;
  ctx.fillRect(0, c.height - 1.15 * ppm, c.width, 0.16 * ppm);
  ctx.fillStyle = C.accent;
  ctx.fillRect(0, c.height - 0.94 * ppm, c.width, 0.03 * ppm);

  ctx.textBaseline = "alphabetic";
  if (side === "left") {
    // Huge wordmark, cropped by the ceiling like a painted super-graphic.
    ctx.fillStyle = "rgba(244, 241, 234, 0.92)";
    ctx.textAlign = "left";
    ctx.font = `400 ${1.72 * ppm}px ${DISPLAY}`;
    ctx.fillText(brand.name, 5 * ppm, c.height - 1.3 * ppm);
    ctx.fillStyle = C.primary;
    ctx.font = `400 ${0.5 * ppm}px ${DISPLAY}`;
    ctx.fillText("EARN YOUR NAME", 15 * ppm, c.height - 1.6 * ppm);
    drawCrest(ctx, assets, 23.5 * ppm, c.height * 0.42, 0.85 * ppm);
  } else {
    ctx.fillStyle = "rgba(244, 241, 234, 0.85)";
    ctx.textAlign = "left";
    ctx.font = `400 ${0.62 * ppm}px ${DISPLAY}`;
    ctx.fillText("NO ONE REMEMBERS THE WARM-UP.", 3 * ppm, c.height - 1.55 * ppm);
    ctx.fillStyle = C.accent;
    ctx.font = `400 ${1.4 * ppm}px ${DISPLAY}`;
    ctx.fillText(brand.name, 19 * ppm, c.height - 1.4 * ppm);
  }
  return toTexture(c);
}

/** Sponsor step-and-repeat backdrop panel. */
export function stepRepeatTexture(assets: BrandAssets, wM: number, hM: number) {
  const ppm = 200;
  const { c, ctx } = canvas(wM * ppm, hM * ppm);
  ctx.fillStyle = "#0d0d10";
  ctx.fillRect(0, 0, c.width, c.height);
  const cellW = 1.3 * ppm;
  const cellH = 0.62 * ppm;
  let i = 0;
  for (let row = 0; row * cellH < c.height; row++) {
    for (let col = -1; col * cellW < c.width; col++) {
      const x = col * cellW + (row % 2) * cellW * 0.5;
      const y = row * cellH;
      if ((row + col) % 2 === 0) {
        drawCrest(ctx, assets, x + cellW / 2, y + cellH / 2, cellH * 0.36);
      } else {
        drawSponsor(ctx, assets, i++, x + cellW * 0.1, y + cellH * 0.3, cellW * 0.8, cellH * 0.4);
      }
    }
  }
  return toTexture(c);
}

/** Jersey on a hanger for the locker cubbies. Transparent background. */
export function jerseyTexture(number: number) {
  const w = 512;
  const h = 640;
  const { c, ctx } = canvas(w, h);
  // hanger
  ctx.strokeStyle = "#9a9aa2";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(w / 2, 70);
  ctx.quadraticCurveTo(w / 2 + 26, 30, w / 2, 14);
  ctx.moveTo(w / 2 - 150, 120);
  ctx.lineTo(w / 2, 70);
  ctx.lineTo(w / 2 + 150, 120);
  ctx.stroke();
  // tank-top body
  const body = new Path2D();
  body.moveTo(w * 0.31, 92);
  body.quadraticCurveTo(w * 0.5, 190, w * 0.69, 92);
  body.lineTo(w * 0.78, 100);
  body.quadraticCurveTo(w * 0.78, 230, w * 0.9, 270);
  body.lineTo(w * 0.88, 620);
  body.lineTo(w * 0.12, 620);
  body.lineTo(w * 0.1, 270);
  body.quadraticCurveTo(w * 0.22, 230, w * 0.22, 100);
  body.closePath();
  ctx.fillStyle = number % 2 ? C.ink : C.primary;
  ctx.fill(body);
  ctx.lineWidth = 14;
  ctx.strokeStyle = number % 2 ? C.primary : C.paper;
  ctx.stroke(body);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = C.paper;
  fitText(ctx, brand.name, w * 0.6, 56);
  ctx.fillText(brand.name, w / 2, 290);
  ctx.fillStyle = C.accent;
  ctx.font = `400 210px ${DISPLAY}`;
  ctx.fillText(String(number), w / 2, 440);
  return toTexture(c);
}

/** Illuminated overhead sign. */
export function signTexture(text: string, sub?: string) {
  const w = 1024;
  const h = 256;
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = "#08080a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = C.paper;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `400 150px ${DISPLAY}`;
  ctx.fillText(text, 60, h / 2 + 8);
  // arrow
  ctx.fillStyle = C.primary;
  ctx.beginPath();
  ctx.moveTo(w - 70, h / 2);
  ctx.lineTo(w - 190, h / 2 - 70);
  ctx.lineTo(w - 190, h / 2 - 28);
  ctx.lineTo(w - 330, h / 2 - 28);
  ctx.lineTo(w - 330, h / 2 + 28);
  ctx.lineTo(w - 190, h / 2 + 28);
  ctx.lineTo(w - 190, h / 2 + 70);
  ctx.closePath();
  ctx.fill();
  if (sub) {
    ctx.fillStyle = C.accent;
    ctx.font = `700 34px ${BODY}`;
    ctx.fillText(sub, 64, h - 34);
  }
  return toTexture(c);
}

/** Scorer's table front panel. */
export function tableTexture(assets: BrandAssets) {
  const w = 2048;
  const h = 160;
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = "#07070a";
  ctx.fillRect(0, 0, w, h);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = (i * w) / n;
    if (i === 2) {
      ctx.fillStyle = C.primary;
      ctx.fillRect(x, 0, w / n, h);
      ctx.fillStyle = C.paper;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fitText(ctx, brand.name, (w / n) * 0.8, h * 0.62);
      ctx.fillText(brand.name, x + w / n / 2, h * 0.54);
    } else {
      drawSponsor(ctx, assets, i, x + 30, h * 0.2, w / n - 60, h * 0.6);
    }
  }
  return toTexture(c);
}
