// 2D flat pattern drafting (cm). Produces pieces + a 1:1 scale SVG.
const quad = (p0, c, p1, n = 12) => Array.from({ length: n }, (_, i) => {
  const t = (i + 1) / n, u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
});
const cubic = (p0, c1, c2, p1, n = 16) => Array.from({ length: n }, (_, i) => {
  const t = (i + 1) / n, u = 1 - t;
  const f = (k) => u ** 3 * p0[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t ** 3 * p1[k];
  return [f(0), f(1)];
});

function offsetPolygon(pts, d) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? -1 : 1;
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const e1 = norm([p[0] - a[0], p[1] - a[1]]), e2 = norm([b[0] - p[0], b[1] - p[1]]);
    const n1 = [e1[1] * sgn, -e1[0] * sgn], n2 = [e2[1] * sgn, -e2[0] * sgn];
    const nm = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    const cos = Math.max(0.35, nm[0] * n1[0] + nm[1] * n1[1]);
    return [p[0] + (nm[0] * d) / cos, p[1] + (nm[1] * d) / cos];
  });
}
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const dedupe = (pts) => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.01);

export function draftPattern(m, g) {
  const pieces = [];
  const B = m.bust + g.bustEase, W = m.waist + g.waistEase, Hp = m.hip + g.hipEase;
  const neckW = m.neck / 6 + 1.5;
  const shX = m.shoulder / 2, shDrop = 4;
  const ah = B / 8 + 6.5; // armhole depth from shoulder line
  const wY = m.backLength, hY = m.backLength + m.waistToHip, L = g.kameezLength;
  const hemX = (Hp + g.hemFlare) / 4;
  const slitY = Math.max(hY, L - g.slitLength);

  const bodice = (name, neckDepth, scoop) => {
    const pts = [[0, neckDepth]];
    pts.push(...quad([0, neckDepth], [neckW * 0.95, neckDepth * 0.95], [neckW, 0]));
    pts.push([shX, shDrop]);
    pts.push(...cubic([shX, shDrop], [shX - scoop * 0.6, shDrop + (ah - shDrop) * 0.55], [shX - scoop, ah], [B / 4, ah]));
    pts.push([W / 4, wY], ...quad([W / 4, wY], [Hp / 4, wY + (hY - wY) * 0.4], [Hp / 4, hY], 8));
    pts.push([Hp / 4 + (hemX - Hp / 4) * ((slitY - hY) / Math.max(1, L - hY)), slitY]);
    pts.push([hemX, L], [0, L]);
    pieces.push({ name, note: `Cut 1 on fold · slit ${g.slitLength} cm from hem`, pts: dedupe(pts), fold: true,
      marks: [{ y: wY, label: 'waist' }, { y: hY, label: 'hip' }, { y: slitY, label: 'slit ▸' }] });
  };
  bodice('Kameez FRONT', g.frontNeckDepth, 2.5);
  bodice('Kameez BACK', g.backNeckDepth, 1.2);

  // Sleeve
  const sw = m.upperArm + g.sleeveEase, capH = Math.max(6, (ah - shDrop) * 0.62), sL = g.sleeveLength, op = g.sleeveOpening;
  const sp = [[-sw / 2, capH]];
  sp.push(...cubic([-sw / 2, capH], [-sw / 4, capH * 0.85], [-sw / 6, 0], [0, 0]));
  sp.push(...cubic([0, 0], [sw / 6, 0], [sw / 4, capH * 0.75], [sw / 2, capH]));
  sp.push([op / 2, sL], [-op / 2, sL]);
  pieces.push({ name: 'SLEEVE', note: 'Cut 2 (mirror pair)', pts: dedupe(sp), marks: [] });

  // Patiala salwar leg panel (cut 2): wide top pleated into half the waist.
  const rise = m.waistHeight - m.inseam + g.crotchDrop;
  const legLen = g.salwarLength - g.cuffHeight + 4; // +4 for drawstring casing
  const topW = (m.hip / 2) * g.fullness;
  const botW = g.mohri * 1.8;
  const pp = [[0, 4], [topW * 0.5, 0], [topW, 4], [topW, rise * 0.6]];
  pp.push(...quad([topW, rise * 0.6], [topW - 2, rise], [topW - 8, rise + 4], 8));
  pp.push([topW / 2 + botW / 2, legLen], [topW / 2 - botW / 2, legLen], [8, rise + 4]);
  pp.push(...quad([8, rise + 4], [2, rise], [0, rise * 0.6], 8).slice(0, -1));
  pieces.push({ name: 'SALWAR LEG PANEL', note: `Cut 2 · pleat top into ${(g.salwarWaist / 2).toFixed(1)} cm with ${g.pleats} pleats · fold 4 cm casing`, pts: dedupe(pp), marks: [] });

  // Kali (crotch gusset)
  const kw = m.thigh * 0.45, kh = rise * 1.2;
  pieces.push({ name: 'KALI (gusset)', note: 'Cut 2 · join between panels from crotch', pts: [[kw / 2, 0], [kw, kh], [0, kh]], marks: [] });

  // Cuff band
  pieces.push({ name: 'CUFF (mohri)', note: 'Cut 2 · fold lengthwise · gather leg into it', pts: [[0, 0], [g.mohri + 1, 0], [g.mohri + 1, g.cuffHeight * 2], [0, g.cuffHeight * 2]], marks: [{ y: g.cuffHeight, label: 'fold' }] });

  pieces.forEach((p) => { p.cut = offsetPolygon(p.pts, g.seamAllowance); });
  return pieces;
}

const PART = (name) => (/^(Kameez|SLEEVE)/.test(name) ? 'kameez' : /^CUFF/.test(name) ? 'cuff' : 'salwar');

/**
 * opts.dark: CLO-style 2D window rendering; opts.fills: {part: {url, scale}} fabric images
 * placed at true scale inside each piece.
 */
export function patternSVG(pieces, { title = 'Patiala dress pattern', dark = false, fills = null } = {}) {
  const C = dark ? { bg: '#2a2c30', cut: '#c9ced6', sew: '#ffd166', ink: '#e8eaed', mute: '#9aa0a6', fold: '#6fb3ff', grain: '#e8eaed' }
                 : { bg: '#fff', cut: '#111', sew: '#c2185b', ink: '#111', mute: '#666', fold: '#1565c0', grain: '#333' };
  const gap = 6;
  let x = gap, y = 14, rowH = 0, maxW = 0;
  const W = 150; // layout width in cm (approx fabric width)
  const placed = pieces.map((p) => {
    const all = p.cut.concat(p.pts);
    const minX = Math.min(...all.map((q) => q[0])), maxX = Math.max(...all.map((q) => q[0]));
    const minY = Math.min(...all.map((q) => q[1])), maxY = Math.max(...all.map((q) => q[1]));
    const w = maxX - minX, h = maxY - minY;
    if (x + w > W && x > gap) { x = gap; y += rowH + gap + 6; rowH = 0; }
    const tx = x - minX, ty = y - minY;
    x += w + gap; rowH = Math.max(rowH, h); maxW = Math.max(maxW, x);
    return { p, tx, ty, w, h, minX, minY };
  });
  const totalH = y + rowH + gap;
  const path = (pts, tx, ty) => 'M' + pts.map((q) => `${(q[0] + tx).toFixed(2)},${(q[1] + ty).toFixed(2)}`).join('L') + 'Z';
  let body = '', defs = '';
  if (fills) for (const [part, f] of Object.entries(fills))
    defs += `<pattern id="fab-${part}" patternUnits="userSpaceOnUse" width="${f.scale}" height="${f.scale}"><image href="${f.url}" width="${f.scale}" height="${f.scale}" preserveAspectRatio="none"/></pattern>`;
  for (const { p, tx, ty, w, h, minX, minY } of placed) {
    const part = PART(p.name);
    body += `<g class="piece" data-part="${part}" data-name="${p.name}">`;
    body += `<path d="${path(p.cut, tx, ty)}" fill="${fills ? `url(#fab-${part})` : 'none'}" stroke="${C.cut}" stroke-width="0.14"/>`;
    body += `<path d="${path(p.pts, tx, ty)}" fill="${fills ? 'none' : '#fbe9ef'}" fill-opacity="0.5" stroke="${C.sew}" stroke-width="0.1" stroke-dasharray="0.8 0.5"/>`;
    const cx = tx + minX + w / 2, cy = ty + minY + h / 2;
    if (p.fold) body += `<line x1="${tx}" y1="${ty + minY + 3}" x2="${tx}" y2="${ty + minY + h - 3}" stroke="${C.fold}" stroke-width="0.3"/><text x="${tx + 0.8}" y="${ty + minY + h / 2}" font-size="1.6" fill="${C.fold}" transform="rotate(90 ${tx + 0.8} ${ty + minY + h / 2})">PLACE ON FOLD</text>`;
    body += `<line x1="${cx}" y1="${cy - h * 0.25}" x2="${cx}" y2="${cy + h * 0.25}" stroke="${C.grain}" stroke-width="0.12" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
    for (const mk of p.marks || []) body += `<text x="${tx + minX + 1}" y="${ty + mk.y - 0.4}" font-size="1.4" fill="${C.mute}">— ${mk.label}</text>`;
    const halo = fills ? ` paint-order="stroke" stroke="${C.bg}" stroke-width="0.5"` : '';
    body += `<text x="${cx + 1}" y="${cy - 2}" font-size="2.4" font-weight="bold" fill="${C.ink}"${halo}>${p.name}</text>`;
    body += `<text x="${cx + 1}" y="${cy + 1}" font-size="1.5" fill="${C.ink}"${halo}>${p.note}</text>`;
    body += `<text x="${cx + 1}" y="${cy + 3.2}" font-size="1.4" fill="${C.mute}"${halo}>${w.toFixed(1)} × ${h.toFixed(1)} cm</text></g>`;
  }
  const Wt = Math.max(maxW, 60);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Wt.toFixed(1)}cm" height="${totalH.toFixed(1)}cm" viewBox="0 0 ${Wt.toFixed(1)} ${totalH.toFixed(1)}" font-family="sans-serif">
<defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${C.grain}"/></marker>${defs}</defs>
<rect width="100%" height="100%" fill="${C.bg}"/>
<text x="${gap}" y="6" font-size="3" font-weight="bold" fill="${C.ink}">${title}</text>
<text x="${gap}" y="9.5" font-size="1.6" fill="${C.mute}">1:1 scale (units = cm). Solid = cutting line incl. seam allowance · dashed = stitching line · arrow = grainline.</text>
<rect x="${Wt - 16}" y="2" width="10" height="10" fill="none" stroke="${C.ink}" stroke-width="0.1"/><text x="${Wt - 15.5}" y="7.5" font-size="1.3" fill="${C.ink}">10 cm check</text>
${body}
</svg>`;
}
