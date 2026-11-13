"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { brand } from "@/lib/brand";
import { TUNNEL } from "@/lib/court";
import { CROSSING, lightsOn, scroll, smoothstep } from "@/lib/scroll";
import { useTextures } from "./assets";

const C = brand.colors;
const LEN = TUNNEL.endX - TUNNEL.mouthX;
const CX = (TUNNEL.endX + TUNNEL.mouthX) / 2;
const Z = TUNNEL.z;
const W = TUNNEL.width;
const H = TUNNEL.height;
const LEFT_Z = Z + W / 2; // camera faces -X, so +Z is on the left
const RIGHT_Z = Z - W / 2;

function Lockers() {
  const t = useTextures();
  const count = t.jerseys.length;
  const cw = 0.92;
  const depth = 0.55;
  const x0 = 37;
  return (
    <group position={[0, 0, RIGHT_Z + depth / 2]}>
      {Array.from({ length: count }).map((_, i) => {
        const x = x0 + i * cw;
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* cubby back + sides */}
            <mesh position={[0, 1.2, -depth / 2 + 0.02]}>
              <boxGeometry args={[cw, 2.4, 0.04]} />
              <meshStandardMaterial color="#141417" roughness={0.8} />
            </mesh>
            <mesh position={[cw / 2 - 0.02, 1.2, 0]}>
              <boxGeometry args={[0.04, 2.4, depth]} />
              <meshStandardMaterial color="#5a3a22" roughness={0.6} />
            </mesh>
            {/* shelf + bench seat */}
            <mesh position={[0, 2.05, 0]}>
              <boxGeometry args={[cw, 0.04, depth]} />
              <meshStandardMaterial color="#5a3a22" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.45, 0.02]}>
              <boxGeometry args={[cw, 0.06, depth]} />
              <meshStandardMaterial color="#5a3a22" roughness={0.6} />
            </mesh>
            {/* jersey on a hanger */}
            <mesh position={[0, 1.42, -0.08]}>
              <planeGeometry args={[0.66, 0.82]} />
              <meshStandardMaterial map={t.jerseys[i]} transparent alphaTest={0.4} roughness={0.85} />
            </mesh>
            {/* nameplate light */}
            <mesh position={[0, 2.22, depth / 2 - 0.02]}>
              <boxGeometry args={[cw * 0.7, 0.05, 0.02]} />
              <meshBasicMaterial color={C.accent} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[x0 - cw / 2 + 0.02, 1.2, 0]}>
        <boxGeometry args={[0.04, 2.4, depth]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Hallway({ reflections }: { reflections: boolean }) {
  const t = useTextures();
  const pointRefs = useRef<THREE.PointLight[]>([]);
  // Shared materials so every strip dims together.
  const stripMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fff", toneMapped: false }), []);
  const coveMat = useMemo(() => new THREE.MeshBasicMaterial({ color: C.primary, toneMapped: false }), []);
  const signMat = useRef<THREE.MeshBasicMaterial>(null);
  const glareMat = useRef<THREE.MeshBasicMaterial>(null);

  const stripXs = useMemo(() => {
    const xs: number[] = [];
    for (let x = TUNNEL.mouthX + 1.6; x < TUNNEL.endX - 0.8; x += 2.3) xs.push(x);
    return xs;
  }, []);
  const lightXs = [47, 41.5, 36, 30.5, 25];

  useFrame(({ camera }) => {
    const on = lightsOn(performance.now());
    pointRefs.current.forEach((l) => l && (l.intensity = 9 * on));
    stripMat.color.setScalar(0.05 + 2.6 * on);
    signMat.current?.color.setScalar(0.08 + 1.5 * on);
    coveMat.color.set(C.primary).multiplyScalar(0.05 + 2.2 * on);
    // Glare at the tunnel mouth: hazy at first, white-hot right at the crossing,
    // gone once the camera is out in the arena.
    if (glareMat.current) {
      const p = scroll.current;
      const approach = 0.28 + 0.72 * smoothstep(CROSSING - 0.2, CROSSING - 0.01, p);
      const past = camera.position.x < TUNNEL.mouthX + 0.3 ? 0 : 1;
      glareMat.current.opacity = Math.min(1, approach * past * (0.45 + 0.75 * Math.max(on, 0.2)));
    }
  });

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0.003, Z]}>
        <planeGeometry args={[LEN, W]} />
        {reflections ? (
          <MeshReflectorMaterial
            color="#2a2a30"
            resolution={512}
            mirror={0.55}
            mixBlur={1}
            mixStrength={2.2}
            blur={[200, 60]}
            roughness={0.7}
            metalness={0.1}
          />
        ) : (
          <meshStandardMaterial color="#26262b" roughness={0.3} metalness={0.1} />
        )}
      </mesh>
      {/* ceiling */}
      <mesh rotation-x={Math.PI / 2} position={[CX, H, Z]}>
        <planeGeometry args={[LEN, W]} />
        <meshStandardMaterial color="#0f0f12" roughness={0.9} />
      </mesh>
      {/* walls */}
      <mesh position={[CX, H / 2, LEFT_Z]} rotation-y={Math.PI}>
        <planeGeometry args={[LEN, H]} />
        <meshStandardMaterial map={t.hallLeft} roughness={0.85} />
      </mesh>
      <mesh position={[CX, H / 2, RIGHT_Z]}>
        <planeGeometry args={[LEN, H]} />
        <meshStandardMaterial map={t.hallRight} roughness={0.85} />
      </mesh>
      <mesh position={[TUNNEL.endX, H / 2, Z]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#141417" roughness={0.9} />
      </mesh>

      {/* sponsor step-and-repeat near the mouth */}
      <mesh position={[25.2, 1.55, RIGHT_Z + 0.02]}>
        <planeGeometry args={[5.6, 2.9]} />
        <meshStandardMaterial map={t.stepRepeat} roughness={0.5} />
      </mesh>

      <Lockers />

      {/* ceiling light strips */}
      {stripXs.map((x) =>
        [-1, 1].map((s) => (
          <mesh key={`${x}${s}`} position={[x, H - 0.03, Z + s * 0.95]} material={stripMat}>
            <boxGeometry args={[1.5, 0.04, 0.1]} />
          </mesh>
        )),
      )}
      {/* red LED cove along the floor */}
      {[LEFT_Z - 0.03, RIGHT_Z + 0.03].map((z) => (
        <mesh key={z} position={[CX, 0.05, z]} material={coveMat}>
          <boxGeometry args={[LEN, 0.035, 0.03]} />
        </mesh>
      ))}
      {lightXs.map((x, i) => (
        <pointLight
          key={x}
          ref={(el) => {
            if (el) pointRefs.current[i] = el;
          }}
          position={[x, H - 0.35, Z]}
          distance={9}
          decay={1.6}
          color="#fff1df"
        />
      ))}

      {/* hanging COURT sign */}
      <group position={[29.5, H - 0.42, Z]}>
        <mesh>
          <boxGeometry args={[0.12, 0.5, 2.0]} />
          <meshStandardMaterial color="#09090b" />
        </mesh>
        <mesh position={[0.07, 0, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[1.9, 0.46]} />
          <meshBasicMaterial ref={signMat} map={t.sign} toneMapped={false} />
        </mesh>
      </group>

      {/* glare at the tunnel mouth */}
      <mesh position={[TUNNEL.mouthX + 0.05, H / 2, Z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial ref={glareMat} color="#fffaf3" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
