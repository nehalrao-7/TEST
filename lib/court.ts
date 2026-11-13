/** NBA-spec court dimensions, in meters. The court's long axis runs along world X. */
export const FT = 0.3048;

export const COURT = {
  length: 94 * FT, // 28.65
  width: 50 * FT, // 15.24
  /** Painted floor including the apron around the lines. */
  floorLength: 36,
  floorWidth: 22,
  /** Rim center distance from the court center along X. */
  hoopX: (47 - 5.25) * FT, // 12.73
  rimHeight: 10 * FT, // 3.048
  rimRadius: 0.2286,
  backboardX: 43 * FT, // 13.11
  backboardWidth: 6 * FT,
  backboardHeight: 3.5 * FT,
  backboardBottom: 9.5 * FT - 0.15,
};

/** Lower seating bowl footprint: a rounded rectangle around the floor. */
export const BOWL = {
  ax: 21, // half-length to the front wall at the ends
  az: 14.5, // half-width to the front wall at the sides
  r: 5, // corner radius
  rowDepth: 0.85,
  lowerRows: 20,
  lowerRise: 0.42,
  frontWall: 0.95,
  upperStart: 19.5, // outward offset where the upper bowl begins
  upperBase: 12.2,
  upperRows: 17,
  upperRise: 0.56,
};

/** The player tunnel cuts under the lower bowl at the +X end, offset toward +Z. */
export const TUNNEL = {
  z: 5,
  width: 3.8,
  height: 3.3,
  /** X where the tunnel opens into the arena bowl. */
  mouthX: BOWL.ax,
  /** X of the far (locker room) end. */
  endX: 50,
};

export type PerimeterPoint = { x: number; z: number; nx: number; nz: number; s: number };

/**
 * Evenly spaced samples around a rounded rectangle, with outward normals and
 * arc length `s`. Used to lay out seats, ribbon boards and walls.
 */
export function roundedRect(ax: number, az: number, r: number, spacing: number): PerimeterPoint[] {
  const sx = 2 * (ax - r);
  const sz = 2 * (az - r);
  const q = (Math.PI / 2) * r;
  const segs = [sz, q, sx, q, sz, q, sx, q];
  const total = segs.reduce((a, b) => a + b, 0);
  const n = Math.max(4, Math.round(total / spacing));
  const out: PerimeterPoint[] = [];
  for (let i = 0; i < n; i++) {
    let s = (i / n) * total;
    const sAbs = s;
    let k = 0;
    while (k < 7 && s > segs[k]) {
      s -= segs[k];
      k++;
    }
    const corner = (cx: number, cz: number, a0: number) => {
      const a = a0 + s / r;
      return { x: cx + r * Math.cos(a), z: cz + r * Math.sin(a), nx: Math.cos(a), nz: Math.sin(a) };
    };
    let p: { x: number; z: number; nx: number; nz: number };
    switch (k) {
      case 0: p = { x: ax, z: -(az - r) + s, nx: 1, nz: 0 }; break;
      case 1: p = corner(ax - r, az - r, 0); break;
      case 2: p = { x: ax - r - s, z: az, nx: 0, nz: 1 }; break;
      case 3: p = corner(-(ax - r), az - r, Math.PI / 2); break;
      case 4: p = { x: -ax, z: az - r - s, nx: -1, nz: 0 }; break;
      case 5: p = corner(-(ax - r), -(az - r), Math.PI); break;
      case 6: p = { x: -(ax - r) + s, z: -az, nx: 0, nz: -1 }; break;
      default: p = corner(ax - r, -(az - r), Math.PI * 1.5); break;
    }
    out.push({ ...p, s: sAbs });
  }
  return out;
}

/** True when a point at the +X end sits inside the tunnel's footprint. */
export function inTunnel(x: number, z: number, pad = 0.15) {
  return x > 0 && Math.abs(z - TUNNEL.z) < TUNNEL.width / 2 + pad;
}
