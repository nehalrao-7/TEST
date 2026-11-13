"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { BrandAssets } from "@/lib/textures";
import { TUNNEL } from "@/lib/court";
import { CROSSING, scroll, smoothstep } from "@/lib/scroll";
import { TexturesProvider } from "./assets";
import { Arena } from "./Arena";
import { Hallway } from "./Hallway";

export type Quality = "high" | "low";

const Z = TUNNEL.z;

/** Camera keyframes: scroll progress → position + look-at target. */
const KEYS: { p: number; pos: [number, number, number]; look: [number, number, number] }[] = [
  { p: 0.0, pos: [47.5, 1.68, Z], look: [21, 1.55, Z] },
  { p: 0.22, pos: [38, 1.66, Z - 0.25], look: [16, 1.5, Z - 0.6] },
  { p: 0.42, pos: [27, 1.66, Z - 0.1], look: [8, 1.35, 2.5] },
  { p: CROSSING, pos: [20.2, 1.75, Z - 0.35], look: [4, 1.2, 1] },
  { p: 0.66, pos: [16.5, 3.6, 10.5], look: [2, 0.6, 0] },
  { p: 0.83, pos: [9.5, 8.2, 19], look: [-1.5, -0.6, 0.5] },
  { p: 1.0, pos: [-1.5, 12.5, 24.5], look: [-4.5, -2.6, 1.5] },
];

function CameraRig({ onArena }: { onArena: (inArena: boolean) => void }) {
  const { camera, pointer } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const curves = useMemo(
    () => ({
      pos: new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.pos)), false, "centripetal"),
      look: new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.look)), false, "centripetal"),
    }),
    [],
  );
  const tmp = useMemo(
    () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }),
    [],
  );
  const state = useRef({ px: 0, py: 0, orbit: 0, inArena: false });

  useFrame((s, dt) => {
    const d = Math.min(dt, 0.05);
    scroll.current += (scroll.target - scroll.current) * (1 - Math.exp(-d * 3.2));
    const p = scroll.current;

    // Map progress onto the uniform curve parameter between keyframes.
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const local = THREE.MathUtils.clamp((p - KEYS[i].p) / (KEYS[i + 1].p - KEYS[i].p), 0, 1);
    const u = (i + local) / (KEYS.length - 1);
    curves.pos.getPoint(u, tmp.pos);
    curves.look.getPoint(u, tmp.look);

    // Slow orbit once we've arrived at the establishing shot.
    const settle = smoothstep(0.9, 1, p);
    if (!scroll.reducedMotion) state.current.orbit += d * 0.035 * settle;
    else state.current.orbit = 0;
    if (state.current.orbit !== 0) {
      const a = Math.sin(state.current.orbit) * 0.5 * settle;
      tmp.pos.applyAxisAngle(tmp.up, a);
    }

    // Walking bob in the tunnel, pointer parallax everywhere.
    const walking = 1 - smoothstep(CROSSING - 0.05, CROSSING + 0.05, p);
    tmp.pos.y += Math.sin(s.clock.elapsedTime * 1.7) * 0.012 * walking;
    const st = state.current;
    st.px += (pointer.x - st.px) * (1 - Math.exp(-d * 2.5));
    st.py += (pointer.y - st.py) * (1 - Math.exp(-d * 2.5));
    tmp.fwd.subVectors(tmp.look, tmp.pos).normalize();
    tmp.right.crossVectors(tmp.fwd, tmp.up).normalize();
    const par = scroll.reducedMotion ? 0 : 1;
    tmp.look.addScaledVector(tmp.right, st.px * 0.9 * par).addScaledVector(tmp.up, st.py * 0.45 * par);

    cam.position.copy(tmp.pos);
    cam.lookAt(tmp.look);
    const fov = THREE.MathUtils.lerp(60, 44, smoothstep(CROSSING - 0.02, 0.95, p));
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    const inArena = cam.position.x < TUNNEL.mouthX - 0.5 || p > CROSSING + 0.04;
    if (inArena !== st.inArena) {
      st.inArena = inArena;
      onArena(inArena);
    }
  });
  return null;
}

/** Signals readiness after the first few frames have actually rendered. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    frames.current++;
    if (!done.current && frames.current > 3) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function Scene({
  assets,
  quality,
  onReady,
}: {
  assets: BrandAssets;
  quality: Quality;
  onReady: () => void;
}) {
  const [inArena, setInArena] = useState(false);
  const high = quality === "high";

  useEffect(() => {
    scroll.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return (
    <Canvas
      dpr={high ? [1, 1.75] : [1, 1.25]}
      gl={{ antialias: !high, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 60, near: 0.05, far: 220, position: KEYS[0].pos }}
      style={{ position: "fixed", inset: 0 }}
      aria-hidden
    >
      <color attach="background" args={["#050506"]} />
      <fog attach="fog" args={["#050506", 34, 110]} />
      <TexturesProvider assets={assets} quality={quality}>
        <Hallway reflections={high && !inArena} />
        <Arena quality={quality} reflections={high && inArena} />
      </TexturesProvider>
      <CameraRig onArena={setInArena} />
      <ReadySignal onReady={onReady} />
      {high && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.85} />
          <Vignette offset={0.28} darkness={0.75} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
