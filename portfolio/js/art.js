// =========================================================
// Tiny drawing engine: one shape description, two renderers.
//   clean() → precise SVG (the "shipped" look)
//   rough() → wobbly multi-pass strokes (the "sketchbook" look)
// Used by the habit toys and the project process frames.
// =========================================================

export function rng(seed = 1) {
  let a = seed * 9973;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- shape → points (for rough rendering) ----
export function toPoints(s) {
  switch (s.t) {
    case "rect": {
      const { x, y, w, h } = s;
      return { pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true };
    }
    case "ellipse":
    case "circle": {
      const rx = s.rx ?? s.r, ry = s.ry ?? s.r, n = Math.max(14, Math.round((rx + ry) / 3));
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([s.cx + Math.cos(a) * rx, s.cy + Math.sin(a) * ry]);
      }
      return { pts, closed: true };
    }
    case "quad": {
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, u = 1 - t;
        pts.push([
          u * u * s.p0[0] + 2 * u * t * s.c[0] + t * t * s.p1[0],
          u * u * s.p0[1] + 2 * u * t * s.c[1] + t * t * s.p1[1],
        ]);
      }
      return { pts, closed: false };
    }
    case "line":
    default:
      return { pts: s.pts, closed: !!s.closed };
  }
}

// ---- rough: jittered polyline with overshoot, drawn in N passes ----
export function roughD(shape, seed = 1, jitter = 2.2, passes = 2) {
  const { pts, closed } = toPoints(shape);
  const r = rng(seed);
  let d = "";
  for (let p = 0; p < passes; p++) {
    const list = closed ? [...pts, pts[0], pts[1] || pts[0]] : pts;
    const j = () => (r() - 0.5) * jitter * 2;
    const q = list.map(([x, y]) => [x + j(), y + j()]);
    // overshoot the ends a little, like a real pen stroke
    if (q.length > 1) {
      const [a, b] = [q[0], q[1]];
      const ext = 0.12 + r() * 0.12;
      q[0] = [a[0] - (b[0] - a[0]) * ext, a[1] - (b[1] - a[1]) * ext];
      const [y1, z1] = [q[q.length - 2], q[q.length - 1]];
      q[q.length - 1] = [z1[0] + (z1[0] - y1[0]) * ext, z1[1] + (z1[1] - y1[1]) * ext];
    }
    d += "M" + q.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  }
  return d;
}

export function rough(shapes, { seed = 1, jitter = 2.2, passes = 2, cls = "r-ink" } = {}) {
  return shapes.map((s, i) =>
    `<path class="${s.accent ? "r-accent" : cls}" d="${roughD(s, seed + i * 7, s.jitter ?? jitter, passes)}"/>`
  ).join("");
}

export function clean(shapes, { fill = false } = {}) {
  return shapes.map((s) => {
    const c = s.accent ? "c-accent" : "c-ink";
    const f = fill && s.fill ? ` fill="${s.fill}"` : ' fill="none"';
    switch (s.t) {
      case "rect": return `<rect class="${c}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r || 0}"${f}/>`;
      case "circle": return `<circle class="${c}" cx="${s.cx}" cy="${s.cy}" r="${s.r}"${f}/>`;
      case "ellipse": return `<ellipse class="${c}" cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}"${f}/>`;
      case "quad": return `<path class="${c}" d="M${s.p0} Q${s.c} ${s.p1}"${f}/>`;
      default: return `<polyline class="${c}" points="${s.pts.map((p) => p.join(",")).join(" ")}"${s.closed ? "" : ""} fill="none"/>`;
    }
  }).join("");
}

// ---------------------------------------------------------
// Motifs (400 × 300 canvas)
// ---------------------------------------------------------
const lumen = [
  { t: "quad", p0: [112, 150], c: [200, 58], p1: [288, 150], fill: "#e8e5de" },
  { t: "rect", x: 106, y: 146, w: 188, h: 10, r: 5, accent: true, fill: "#ff5a1f" },
  { t: "rect", x: 112, y: 156, w: 176, h: 66, r: 16, fill: "#2a2a2d" },
  { t: "rect", x: 132, y: 222, w: 136, h: 8, r: 4, fill: "#141416" },
];

export const motifs = {
  lumen,
  line: [
    { t: "line", pts: [[30, 200], [370, 200]] },
    { t: "line", pts: [[30, 232], [370, 232]] },
    ...[62, 116, 170, 224, 278, 332].map((x) => ({ t: "circle", cx: x, cy: 216, r: 13, fill: "#1d1d20" })),
    ...[78, 176, 274].map((x, i) => ({ t: "rect", x, y: 160, w: 56, h: 38, r: 10, accent: i === 1, fill: i === 1 ? "#ff5a1f" : "#d9c6a5" })),
  ],
  wayfinder: [
    { t: "ellipse", cx: 200, cy: 165, rx: 136, ry: 62, fill: "#26262a" },
    { t: "ellipse", cx: 200, cy: 165, rx: 110, ry: 44, fill: "#0e0e10" },
    { t: "rect", x: 172, y: 146, w: 56, h: 38, r: 8, accent: true, fill: "#ff5a1f" },
    ...[[96, 140], [304, 140], [96, 190], [304, 190]].map(([cx, cy]) => ({ t: "circle", cx, cy, r: 9, fill: "#ecebe6" })),
    { t: "quad", p0: [166, 78], c: [200, 58], p1: [234, 78] },
    { t: "quad", p0: [150, 62], c: [200, 34], p1: [250, 62] },
  ],
  site: [
    { t: "rect", x: 60, y: 56, w: 280, h: 196, r: 10, fill: "#151517" },
    { t: "line", pts: [[60, 84], [340, 84]] },
    ...[78, 94, 110].map((cx) => ({ t: "circle", cx, cy: 70, r: 4, fill: "#ecebe6" })),
    { t: "circle", cx: 236, cy: 168, r: 58, fill: "none" },
    { t: "ellipse", cx: 236, cy: 168, rx: 58, ry: 20, accent: true },
    { t: "ellipse", cx: 236, cy: 168, rx: 20, ry: 58 },
    { t: "line", pts: [[86, 130], [152, 130]] },
    { t: "line", pts: [[86, 146], [140, 146]] },
    { t: "rect", x: 86, y: 196, w: 64, h: 18, r: 9, accent: true, fill: "#ff5a1f" },
  ],
  bolo: [
    { t: "line", pts: [[50, 240], [130, 196], [210, 212], [290, 122], [352, 84]] },
    ...[[50, 240], [130, 196], [210, 212], [290, 122]].map(([cx, cy]) => ({ t: "circle", cx, cy, r: 8, fill: "#ecebe6" })),
    { t: "circle", cx: 352, cy: 84, r: 12, accent: true, fill: "#ff5a1f" },
    { t: "quad", p0: [40, 120], c: [120, 90], p1: [200, 120] },
    { t: "quad", p0: [60, 150], c: [150, 120], p1: [240, 150] },
  ],
};

// ---------------------------------------------------------
// Process frames: sketch → model → prototype → shipped
// ---------------------------------------------------------
export function frame(key, stage, note = "") {
  const m = motifs[key];
  const open = `<svg viewBox="0 0 400 300" class="art art--${stage}" aria-hidden="true">`;
  if (stage === "sketch") {
    return open + rough(m, { seed: 3, jitter: 2.6 }) +
      `<text class="hand" x="28" y="276">${note}</text></svg>`;
  }
  if (stage === "model") {
    return open + clean(m) +
      `<path class="dim" d="M40 268 H360 M40 262 V274 M360 262 V274"/><text class="dimtxt" x="178" y="262">320.0</text>` +
      `<path class="dim" d="M376 40 V250 M370 40 H382 M370 250 H382"/><text class="dimtxt" x="366" y="30">REV B</text></svg>`;
  }
  if (stage === "proto") {
    return open + rough(m, { seed: 11, jitter: 3.4, passes: 3 }) +
      `<rect class="tape" x="20" y="18" width="70" height="20" transform="rotate(-8 55 28)"/>` +
      `<rect class="tape" x="310" y="250" width="70" height="20" transform="rotate(6 345 260)"/>` +
      `<text class="hand" x="250" y="40">v0.${(key.length % 7) + 2} ✓</text></svg>`;
  }
  return open + `<defs><radialGradient id="glow-${key}" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#ff5a1f" stop-opacity=".28"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="400" height="300" fill="url(#glow-${key})"/>` + clean(m, { fill: true }) + `</svg>`;
}
