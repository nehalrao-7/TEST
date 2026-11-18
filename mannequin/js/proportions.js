// Body proportion modes. The avatar (and the garment drafted on it) uses the "effective" body.
export const PROPORTIONS = {
  balanced: 'Balanced hourglass (her size)',
  model: 'Model hourglass (same height)',
  measured: 'Her exact measurements',
};

/** Model canon as fractions of height (balanced female proportions). */
const CANON = { shoulder: 0.238, backLength: 0.245, waistToHip: 0.124, inseam: 0.48, armLength: 0.346, waistHeight: 0.625 };

export function effectiveBody(m, mode) {
  const H = m.height, out = { ...m };
  if (mode === 'measured') return out;
  for (const [k, f] of Object.entries(CANON)) out[k] = +(H * f).toFixed(1);
  if (mode === 'model') {
    // a classic hourglass model, scaled to this height (reference 165 cm)
    const s = H / 165;
    Object.assign(out, {
      bust: 90 * s, underbust: 75 * s, waist: 66 * s, hip: 94 * s, thigh: 54 * s, knee: 35 * s, calf: 34 * s, ankle: 21 * s,
      neck: 32 * s, upperArm: 26.5 * s, wrist: 15 * s,
    });
    for (const k of Object.keys(out)) if (typeof out[k] === 'number') out[k] = +out[k].toFixed(1);
    return out;
  }
  // balanced: keep her size, sculpt an hourglass (defined waist, bust ≈ hip)
  out.waist = +Math.min(m.waist, 0.72 * m.hip).toFixed(1);
  out.bust = +Math.max(m.bust, 0.97 * m.hip).toFixed(1);
  out.thigh = +Math.max(m.thigh, 0.57 * m.hip).toFixed(1);
  out.underbust = +Math.max(out.waist + 4, Math.min(m.underbust, out.bust - 13)).toFixed(1);
  return out;
}
