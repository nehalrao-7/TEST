"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type * as THREE from "three";
import {
  courtTexture,
  hallWallTexture,
  jerseyTexture,
  ribbonTexture,
  scoreboardTexture,
  signTexture,
  stepRepeatTexture,
  tableTexture,
  type BrandAssets,
} from "@/lib/textures";
import { TUNNEL } from "@/lib/court";

export type SceneTextures = ReturnType<typeof buildTextures>;

function buildTextures(assets: BrandAssets, quality: "high" | "low") {
  const hallLen = TUNNEL.endX - TUNNEL.mouthX;
  return {
    court: courtTexture(assets, quality === "high" ? 4096 : 2048),
    ribbon: ribbonTexture(assets, quality === "high" ? 128 : 96),
    scoreboardFront: scoreboardTexture(assets, 1600, 900, 0),
    scoreboardSide: scoreboardTexture(assets, 1000, 900, 1),
    table: tableTexture(assets),
    hallLeft: hallWallTexture(assets, hallLen, TUNNEL.height, "left"),
    hallRight: hallWallTexture(assets, hallLen, TUNNEL.height, "right"),
    stepRepeat: stepRepeatTexture(assets, 5.6, 2.9),
    sign: signTexture("COURT", "MUQABLA TOURNAMENT"),
    jerseys: [0, 1, 3, 7, 10, 11, 23, 33].map((n) => jerseyTexture(n)),
  };
}

const Ctx = createContext<SceneTextures | null>(null);

export function TexturesProvider({
  assets,
  quality,
  children,
}: {
  assets: BrandAssets;
  quality: "high" | "low";
  children: React.ReactNode;
}) {
  const textures = useMemo(() => buildTextures(assets, quality), [assets, quality]);
  useEffect(
    () => () => {
      const all: THREE.Texture[] = [];
      Object.values(textures).forEach((v) => {
        if (Array.isArray(v)) all.push(...v);
        else if ("tex" in v) all.push(v.tex);
        else all.push(v as THREE.Texture);
      });
      all.forEach((t) => t.dispose());
    },
    [textures],
  );
  return <Ctx.Provider value={textures}>{children}</Ctx.Provider>;
}

export function useTextures() {
  const t = useContext(Ctx);
  if (!t) throw new Error("useTextures must be used inside <TexturesProvider>");
  return t;
}
