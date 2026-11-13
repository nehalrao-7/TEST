"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { brand } from "@/lib/brand";
import { BOWL, COURT, TUNNEL, inTunnel, roundedRect } from "@/lib/court";
import { CROSSING, scroll, smoothstep } from "@/lib/scroll";
import { useTextures } from "./assets";
import { bandGeometry } from "./geometry";

const C = brand.colors;

/** 0.22 while we're in the tunnel, ramping to 1 as we walk out. */
export function arenaLevel(p: number) {
  return 0.22 + 0.78 * smoothstep(CROSSING - 0.1, CROSSING + 0.06, p);
}

/* ------------------------------------------------------------------ */

function Court({ reflections }: { reflections: boolean }) {
  const t = useTextures();
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} receiveShadow>
        <planeGeometry args={[COURT.floorLength, COURT.floorWidth]} />
        {reflections ? (
          <MeshReflectorMaterial
            map={t.court}
            resolution={1024}
            mirror={0.6}
            mixBlur={1.2}
            mixStrength={1.6}
            blur={[400, 120]}
            roughness={0.55}
            metalness={0}
            depthScale={0.4}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.2}
          />
        ) : (
          <meshStandardMaterial map={t.court} roughness={0.38} metalness={0} />
        )}
      </mesh>
      {/* arena floor beyond the painted court */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.004}>
        <planeGeometry args={[BOWL.ax * 2 + 4, BOWL.az * 2 + 4]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.6} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */

function Hoop({ side }: { side: 1 | -1 }) {
  const baseX = side * (COURT.length / 2 + 1.55);
  const boardX = side * COURT.backboardX;
  const boardY = COURT.backboardBottom + COURT.backboardHeight / 2;
  const rimX = side * COURT.hoopX;
  const netGeo = useMemo(() => new THREE.CylinderGeometry(0.23, 0.15, 0.45, 12, 4, true), []);
  return (
    <group>
      {/* padded stanchion base */}
      <mesh position={[baseX + side * 0.35, 0.55, 0]}>
        <boxGeometry args={[1.5, 1.1, 1.1]} />
        <meshStandardMaterial color={C.primary} roughness={0.7} />
      </mesh>
      {/* sponsor pad face */}
      <mesh position={[baseX - side * 0.41, 0.55, 0]} rotation-y={side > 0 ? -Math.PI / 2 : Math.PI / 2}>
        <planeGeometry args={[1.08, 0.6]} />
        <meshStandardMaterial color={C.ink} roughness={0.8} />
      </mesh>
      {/* angled post and arm */}
      <mesh position={[baseX, 2.2, 0]} rotation-z={side * 0.18}>
        <boxGeometry args={[0.3, 3.4, 0.3]} />
        <meshStandardMaterial color="#1a1a1d" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[(baseX + boardX) / 2 - side * 0.1, boardY + 0.05, 0]}>
        <boxGeometry args={[Math.abs(baseX - boardX) - 0.1, 0.22, 0.22]} />
        <meshStandardMaterial color="#1a1a1d" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* glass backboard with white border and target square */}
      <mesh position={[boardX, boardY, 0]}>
        <boxGeometry args={[0.03, COURT.backboardHeight, COURT.backboardWidth]} />
        <meshStandardMaterial color="#cfe6ff" transparent opacity={0.18} roughness={0.05} metalness={0.2} />
      </mesh>
      {[
        [0, COURT.backboardHeight / 2, COURT.backboardWidth, 0.05],
        [0, -COURT.backboardHeight / 2, COURT.backboardWidth, 0.05],
      ].map(([, y, w, h], i) => (
        <mesh key={`h${i}`} position={[boardX - side * 0.02, boardY + y, 0]}>
          <boxGeometry args={[0.02, h, w]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`v${s}`} position={[boardX - side * 0.02, boardY, (s * COURT.backboardWidth) / 2]}>
          <boxGeometry args={[0.02, COURT.backboardHeight, 0.05]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      <group position={[boardX - side * 0.022, COURT.rimHeight + 0.15 + 0.23, 0]}>
        {[
          [0, 0.23, 0.6, 0.04],
          [0, -0.23, 0.6, 0.04],
          [0.29, 0, 0.04, 0.46],
          [-0.29, 0, 0.04, 0.46],
        ].map(([z, y, w, h], i) => (
          <mesh key={i} position={[0, y, z]}>
            <boxGeometry args={[0.015, h, w]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
      {/* shot clock */}
      <mesh position={[boardX + side * 0.05, boardY + COURT.backboardHeight / 2 + 0.2, 0]}>
        <boxGeometry args={[0.25, 0.32, 0.7]} />
        <meshStandardMaterial color="#111" emissive={C.primary} emissiveIntensity={1.4} />
      </mesh>
      {/* rim + net */}
      <mesh position={[rimX, COURT.rimHeight, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[COURT.rimRadius, 0.011, 8, 32]} />
        <meshStandardMaterial color="#ff5a1f" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[(rimX + boardX) / 2, COURT.rimHeight, 0]}>
        <boxGeometry args={[Math.abs(boardX - rimX) - COURT.rimRadius, 0.03, 0.1]} />
        <meshStandardMaterial color="#ff5a1f" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[rimX, COURT.rimHeight - 0.23, 0]} geometry={netGeo}>
        <meshBasicMaterial color="#f2f2f2" wireframe transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */

type SeatTier = { start: number; base: number; rows: number; rise: number; firstHeight: number };

function Bowl({ quality }: { quality: "high" | "low" }) {
  const treadRef = useRef<THREE.InstancedMesh>(null);
  const seatRef = useRef<THREE.InstancedMesh>(null);
  const spacing = quality === "high" ? 0.56 : 0.85;

  const layout = useMemo(() => {
    const tiers: SeatTier[] = [
      { start: 0, base: BOWL.frontWall, rows: BOWL.lowerRows, rise: BOWL.lowerRise, firstHeight: BOWL.frontWall },
      { start: BOWL.upperStart, base: BOWL.upperBase, rows: BOWL.upperRows, rise: BOWL.upperRise, firstHeight: 1.3 },
    ];
    const treads: THREE.Matrix4[] = [];
    const seats: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const rand = (() => {
      let s = 99;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    for (const tier of tiers) {
      for (let k = 0; k < tier.rows; k++) {
        const o = tier.start + k * BOWL.rowDepth;
        const y = tier.base + k * tier.rise;
        const pts = roundedRect(BOWL.ax + o, BOWL.az + o, BOWL.r + o, spacing);
        for (const p of pts) {
          const tunnelHit = tier.start === 0 && inTunnel(p.x, p.z, 0.2);
          if (tunnelHit && y < TUNNEL.height + 0.4) continue;
          q.setFromAxisAngle(up, Math.atan2(p.nx, p.nz));
          // riser / tread block: extends down to hide the gap under each row
          const h = k === 0 ? tier.firstHeight : tunnelHit ? tier.rise : tier.rise + 1.2;
          const cx = p.x + p.nx * (BOWL.rowDepth / 2);
          const cz = p.z + p.nz * (BOWL.rowDepth / 2);
          treads.push(
            new THREE.Matrix4().compose(
              new THREE.Vector3(cx, y - h / 2, cz),
              q.clone(),
              new THREE.Vector3(spacing * 1.02, h, BOWL.rowDepth),
            ),
          );
          const sx = p.x + p.nx * (BOWL.rowDepth * 0.55);
          const sz = p.z + p.nz * (BOWL.rowDepth * 0.55);
          const m = new THREE.Matrix4().compose(new THREE.Vector3(sx, y, sz), q.clone(), new THREE.Vector3(spacing / 0.56, 1, 1));
          // Mostly deep red seats with darker aisles every so often.
          const aisle = Math.abs(((p.s / 9) % 1) - 0.5) < 0.04;
          const tone = aisle ? 0.25 : 0.75 + rand() * 0.25;
          const c = new THREE.Color("#7c1420").multiplyScalar(tone);
          seats.push({ m, c });
        }
      }
    }
    return { treads, seats };
  }, [spacing]);

  const seatGeo = useMemo(() => {
    const pan = new THREE.BoxGeometry(0.46, 0.06, 0.42).translate(0, 0.42, -0.02);
    const back = new THREE.BoxGeometry(0.46, 0.5, 0.06).translate(0, 0.66, 0.2);
    return mergeGeometries([pan, back])!;
  }, []);

  useLayoutEffect(() => {
    const t = treadRef.current;
    const s = seatRef.current;
    if (!t || !s) return;
    layout.treads.forEach((m, i) => t.setMatrixAt(i, m));
    t.instanceMatrix.needsUpdate = true;
    layout.seats.forEach(({ m, c }, i) => {
      s.setMatrixAt(i, m);
      s.setColorAt(i, c);
    });
    s.instanceMatrix.needsUpdate = true;
    if (s.instanceColor) s.instanceColor.needsUpdate = true;
  }, [layout]);

  useEffect(() => () => seatGeo.dispose(), [seatGeo]);

  return (
    <group>
      <instancedMesh ref={treadRef} args={[undefined, undefined, layout.treads.length]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#1b1b20" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={seatRef} args={[seatGeo, undefined, layout.seats.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */

/** LED ribbon boards: courtside front wall and the upper-bowl fascia. Scrolls. */
function Ribbons() {
  const { ribbon } = useTextures();
  const lowerTex = useMemo(() => ribbon.tex.clone(), [ribbon]);
  const upperTex = useMemo(() => ribbon.tex.clone(), [ribbon]);
  const ribbonH = BOWL.frontWall * 0.82;
  const lower = useMemo(
    () =>
      bandGeometry({
        ax: BOWL.ax - 0.02,
        az: BOWL.az - 0.02,
        r: BOWL.r - 0.02,
        y0: 0.06,
        y1: 0.06 + ribbonH,
        uvMeters: ribbonH * ribbon.aspect,
        skip: (x, z) => inTunnel(x, z, 0.05),
      }),
    [ribbon, ribbonH],
  );
  const upperH = 1.0;
  const upperO = BOWL.upperStart - 0.04;
  const upper = useMemo(
    () =>
      bandGeometry({
        ax: BOWL.ax + upperO,
        az: BOWL.az + upperO,
        r: BOWL.r + upperO,
        y0: BOWL.upperBase - 1.2,
        y1: BOWL.upperBase - 1.2 + upperH,
        spacing: 0.8,
        uvMeters: upperH * ribbon.aspect,
      }),
    [ribbon, upperO],
  );
  useEffect(
    () => () => {
      lower.dispose();
      upper.dispose();
      lowerTex.dispose();
      upperTex.dispose();
    },
    [lower, upper, lowerTex, upperTex],
  );
  useFrame((_, dt) => {
    lowerTex.offset.x = (lowerTex.offset.x + dt * 0.02) % 1;
    upperTex.offset.x = (upperTex.offset.x - dt * 0.012) % 1;
  });
  const lvl = useRef(0);
  const lowerMat = useRef<THREE.MeshBasicMaterial>(null);
  const upperMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    lvl.current = arenaLevel(scroll.current);
    const v = 0.35 + 0.85 * lvl.current;
    lowerMat.current?.color.setScalar(v);
    upperMat.current?.color.setScalar(v);
  });
  return (
    <group>
      <mesh geometry={lower}>
        <meshBasicMaterial ref={lowerMat} map={lowerTex} toneMapped={false} />
      </mesh>
      <mesh geometry={upper}>
        <meshBasicMaterial ref={upperMat} map={upperTex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Fascia walls, suite level glass and the outer shell of the bowl. */
function Shell() {
  const lowerTopO = BOWL.lowerRows * BOWL.rowDepth;
  const lowerTopY = BOWL.frontWall + (BOWL.lowerRows - 1) * BOWL.lowerRise;
  const upperTopO = BOWL.upperStart + BOWL.upperRows * BOWL.rowDepth;
  const upperTopY = BOWL.upperBase + (BOWL.upperRows - 1) * BOWL.upperRise;
  const geos = useMemo(() => {
    const at = (o: number, y0: number, y1: number, spacing = 1) =>
      bandGeometry({ ax: BOWL.ax + o, az: BOWL.az + o, r: BOWL.r + o, y0, y1, spacing });
    return {
      suiteWall: at(lowerTopO + 0.3, lowerTopY - 0.2, BOWL.upperBase - 1.2),
      suiteGlass: at(lowerTopO + 0.25, lowerTopY + 0.5, lowerTopY + 1.6),
      upperFascia: at(BOWL.upperStart - 0.05, BOWL.upperBase - 1.6, BOWL.upperBase),
      outer: at(upperTopO + 0.3, upperTopY - 0.5, 27.5, 1.5),
    };
  }, [lowerTopO, lowerTopY, upperTopO, upperTopY]);
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
  return (
    <group>
      <mesh geometry={geos.suiteWall}>
        <meshStandardMaterial color="#121216" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.suiteGlass}>
        <meshStandardMaterial color="#000" emissive="#ffb36b" emissiveIntensity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.upperFascia}>
        <meshStandardMaterial color="#0c0c0f" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.outer}>
        <meshStandardMaterial color="#09090b" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* roof */}
      <mesh rotation-x={Math.PI / 2} position-y={27.5}>
        <planeGeometry args={[(BOWL.ax + upperTopO) * 2 + 4, (BOWL.az + upperTopO) * 2 + 4]} />
        <meshStandardMaterial color="#060608" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */

function Scoreboard() {
  const t = useTextures();
  const ring = useMemo(() => {
    const tex = t.ribbon.tex.clone();
    tex.repeat.set(1, 1);
    return tex;
  }, [t]);
  useFrame((_, dt) => {
    ring.offset.x = (ring.offset.x + dt * 0.03) % 1;
  });
  useEffect(() => () => ring.dispose(), [ring]);
  const W = 8;
  const D = 5.2;
  const H = 4.4;
  const faces: [number, number, number, number, number, THREE.Texture][] = [
    [0, 0, D / 2 + 0.03, 0, W - 0.3, t.scoreboardFront],
    [0, 0, -D / 2 - 0.03, Math.PI, W - 0.3, t.scoreboardFront],
    [W / 2 + 0.03, 0, 0, Math.PI / 2, D - 0.3, t.scoreboardSide],
    [-W / 2 - 0.03, 0, 0, -Math.PI / 2, D - 0.3, t.scoreboardSide],
  ];
  return (
    <group position={[0, 17.5, 0]}>
      <mesh>
        <boxGeometry args={[W, H + 0.4, D]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.6} metalness={0.3} />
      </mesh>
      {faces.map(([x, y, z, ry, w, tex], i) => (
        <mesh key={i} position={[x, y, z]} rotation-y={ry}>
          <planeGeometry args={[w, H - 0.3]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ))}
      {/* lower LED ring */}
      <group position-y={-H / 2 - 0.55}>
        <mesh>
          <boxGeometry args={[W - 1.6, 0.7, D - 1.2]} />
          <meshStandardMaterial color="#0a0a0c" />
        </mesh>
        {[
          [0, (D - 1.2) / 2 + 0.01, 0, W - 1.6],
          [0, -(D - 1.2) / 2 - 0.01, Math.PI, W - 1.6],
          [(W - 1.6) / 2 + 0.01, 0, Math.PI / 2, D - 1.2],
          [-(W - 1.6) / 2 - 0.01, 0, -Math.PI / 2, D - 1.2],
        ].map(([x, z, ry, w], i) => (
          <mesh key={i} position={[x, 0, z]} rotation-y={ry}>
            <planeGeometry args={[w, 0.6]} />
            <meshBasicMaterial map={ring} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* cables to the roof */}
      {[
        [-3, -2],
        [3, -2],
        [-3, 2],
        [3, 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 5.5, z]}>
          <cylinderGeometry args={[0.03, 0.03, 8.5]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */

function Courtside() {
  const t = useTextures();
  const chairRef = useRef<THREE.InstancedMesh>(null);
  const tableZ = COURT.width / 2 + 1.7;
  const chairs = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const add = (x: number, z: number, ry: number) =>
      out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
    // team benches either side of the scorer's table
    for (let x = 5.5; x < 12.5; x += 0.62) {
      add(x, tableZ, Math.PI);
      add(-x, tableZ, Math.PI);
    }
    // courtside row behind the table side, and along the far side
    for (let x = -13; x <= 13; x += 0.62) {
      add(x, BOWL.az - 0.8, Math.PI);
      add(x, -BOWL.az + 0.8, 0);
      add(x, -BOWL.az + 1.7, 0);
    }
    // baseline rows (skipping the tunnel)
    for (let z = -9; z <= 9; z += 0.62) {
      for (const side of [-1, 1]) {
        const x = side * (BOWL.ax - 0.9);
        if (inTunnel(x, z, 0.6)) continue;
        add(x, z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    }
    return out;
  }, [tableZ]);
  const chairGeo = useMemo(() => {
    const pan = new THREE.BoxGeometry(0.48, 0.06, 0.46).translate(0, 0.46, 0);
    const back = new THREE.BoxGeometry(0.48, 0.5, 0.05).translate(0, 0.74, -0.22);
    return mergeGeometries([pan, back])!;
  }, []);
  useLayoutEffect(() => {
    const m = chairRef.current;
    if (!m) return;
    chairs.forEach((c, i) => m.setMatrixAt(i, c));
    m.instanceMatrix.needsUpdate = true;
  }, [chairs]);
  useEffect(() => () => chairGeo.dispose(), [chairGeo]);
  return (
    <group>
      {/* scorer's table */}
      <mesh position={[0, 0.42, tableZ + 0.15]}>
        <boxGeometry args={[9, 0.84, 0.9]} />
        <meshStandardMaterial color="#0b0b0e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.42, tableZ - 0.31]} rotation-y={Math.PI}>
        <planeGeometry args={[9, 0.72]} />
        <meshBasicMaterial map={t.table} toneMapped={false} />
      </mesh>
      <instancedMesh ref={chairRef} args={[chairGeo, undefined, chairs.length]} frustumCulled={false}>
        <meshStandardMaterial color="#111114" roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */

function Lights() {
  const key = useRef<THREE.SpotLight[]>([]);
  const amb = useRef<THREE.AmbientLight>(null);
  const dir = useRef<THREE.DirectionalLight>(null);
  const spots = useMemo(
    () =>
      [
        [-9, 22, 7],
        [9, 22, 7],
        [-9, 22, -7],
        [9, 22, -7],
        [0, 24, 0],
      ].map(([x, y, z]) => {
        const target = new THREE.Object3D();
        target.position.set(x * 0.35, 0, z * 0.35);
        return { pos: [x, y, z] as [number, number, number], target };
      }),
    [],
  );
  useFrame(() => {
    const l = arenaLevel(scroll.current);
    key.current.forEach((s) => s && (s.intensity = 2.4 * l));
    if (amb.current) amb.current.intensity = 0.05 + 0.25 * l;
    if (dir.current) dir.current.intensity = 0.15 + 0.5 * l;
  });
  return (
    <group>
      <ambientLight ref={amb} color="#b9c2ff" />
      <directionalLight ref={dir} position={[4, 20, 10]} color="#ffe9d0" />
      {spots.map((s, i) => (
        <group key={i}>
          <primitive object={s.target} />
          <spotLight
            ref={(el) => {
              if (el) key.current[i] = el;
            }}
            position={s.pos}
            target={s.target}
            angle={0.62}
            penumbra={0.85}
            decay={0}
            color="#fff4e6"
          />
        </group>
      ))}
      {/* light rig glow points above the floor */}
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 13, 25.5, Math.sin(a) * 8]}>
            <boxGeometry args={[0.6, 0.15, 0.6]} />
            <meshBasicMaterial color="#fff6e8" toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */

/** Vomitory walls where the tunnel cuts through the lower bowl. */
function TunnelCut() {
  const depth = 7 * BOWL.rowDepth;
  const top = BOWL.frontWall + 7 * BOWL.lowerRise;
  const x = TUNNEL.mouthX + depth / 2;
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x, top / 2, TUNNEL.z + s * (TUNNEL.width / 2 + 0.2)]}>
          <boxGeometry args={[depth, top, 0.4]} />
          <meshStandardMaterial color="#141418" roughness={0.9} />
        </mesh>
      ))}
      {/* slab over the tunnel */}
      <mesh position={[x, TUNNEL.height + 0.15, TUNNEL.z]}>
        <boxGeometry args={[depth, 0.3, TUNNEL.width + 0.8]} />
        <meshStandardMaterial color="#141418" roughness={0.9} />
      </mesh>
      {/* branded portal header */}
      <mesh position={[TUNNEL.mouthX - 0.02, TUNNEL.height + 0.18, TUNNEL.z]}>
        <boxGeometry args={[0.1, 0.36, TUNNEL.width + 0.8]} />
        <meshStandardMaterial color={C.primary} emissive={C.primary} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

export function Arena({ quality, reflections }: { quality: "high" | "low"; reflections: boolean }) {
  return (
    <group>
      <Court reflections={reflections} />
      <Hoop side={1} />
      <Hoop side={-1} />
      <Bowl quality={quality} />
      <TunnelCut />
      <Ribbons />
      <Shell />
      <Scoreboard />
      <Courtside />
      <Lights />
    </group>
  );
}

