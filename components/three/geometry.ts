import * as THREE from "three";
import { roundedRect } from "@/lib/court";

/**
 * A vertical strip that follows a rounded rectangle, facing inward. Used for
 * LED ribbon boards, fascia walls and the outer bowl. `skip` drops quads (for
 * the tunnel opening). UV u runs along the strip in units of `uvMeters`.
 */
export function bandGeometry(opts: {
  ax: number;
  az: number;
  r: number;
  y0: number;
  y1: number;
  spacing?: number;
  uvMeters?: number;
  skip?: (x: number, z: number) => boolean;
}) {
  const { ax, az, r, y0, y1, spacing = 0.5, uvMeters = 1, skip } = opts;
  const pts = roundedRect(ax, az, r, spacing);
  const total = pts.length * (pts[1].s - pts[0].s);
  // Make the texture repeat a whole number of times around the loop so it is seamless.
  const repeats = Math.max(1, Math.round(total / uvMeters));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = pts.length;
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n];
    const u = (i / n) * repeats;
    positions.push(p.x, y0, p.z, p.x, y1, p.z);
    uvs.push(u, 0, u, 1);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (skip && (skip(a.x, a.z) || skip(b.x, b.z))) continue;
    const v = i * 2;
    // Winding chosen so the face points inward (toward the court).
    indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
