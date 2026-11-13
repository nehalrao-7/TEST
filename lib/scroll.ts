/**
 * Tiny mutable store for scroll progress. Read every frame by the 3D scene and
 * the DOM overlays without causing React re-renders.
 */
export const scroll = {
  /** Raw progress through the intro, 0..1, straight from window scroll. */
  target: 0,
  /** Smoothed progress, eased toward `target` each frame by the camera rig. */
  current: 0,
  /** performance.now() when the loader finished and the hallway lights switch on. */
  revealedAt: -1,
  reducedMotion: false,
};

/** Hallway lights stutter on after the loader, like fluorescent tubes. */
export function lightsOn(now: number) {
  if (scroll.revealedAt < 0) return 0;
  if (scroll.reducedMotion) return 1;
  const t = (now - scroll.revealedAt) / 1000;
  const steps: [number, number][] = [
    [0, 0], [0.15, 0.9], [0.22, 0.05], [0.4, 1], [0.48, 0.25], [0.6, 0.8], [0.66, 0.3], [0.85, 1],
  ];
  let v = 0;
  for (const [at, val] of steps) if (t >= at) v = val;
  return v;
}

/** Where in the scroll the camera crosses the tunnel mouth into the arena. */
export const CROSSING = 0.52;

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 0 → 1 → 0 bump centered on `center`, `width` either side. */
export function pulse(center: number, width: number, x: number) {
  return 1 - smoothstep(0, width, Math.abs(x - center));
}
