"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadBrandAssets, type BrandAssets } from "@/lib/textures";
import { scroll } from "@/lib/scroll";
import { Loader } from "./Loader";
import { Overlay } from "./Overlay";
import type { Quality } from "./three/Scene";

const Scene = dynamic(() => import("./three/Scene"), { ssr: false });

function detectQuality(): Quality {
  const params = new URLSearchParams(window.location.search);
  if (params.get("quality") === "low" || params.get("quality") === "high") return params.get("quality") as Quality;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = window.innerWidth < 900;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return coarse || small || mem < 4 ? "low" : "high";
}

/**
 * The scroll-driven intro: the 3D canvas is fixed behind a tall spacer and
 * window scroll position becomes the camera's progress through the walk-out.
 */
export function Experience() {
  const [assets, setAssets] = useState<BrandAssets | null>(null);
  const [quality, setQuality] = useState<Quality>("high");
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const spacer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuality(detectQuality());
    loadBrandAssets().then(setAssets);
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("is-loading", !revealed);
  }, [revealed]);

  useEffect(() => {
    const onScroll = () => {
      const el = spacer.current;
      if (!el) return;
      const max = el.offsetHeight - window.innerHeight;
      scroll.target = Math.min(1, Math.max(0, window.scrollY / Math.max(1, max)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const handleReady = useCallback(() => setSceneReady(true), []);
  const handleDone = useCallback(() => {
    scroll.revealedAt = performance.now();
    setRevealed(true);
  }, []);

  return (
    <>
      {assets && <Scene assets={assets} quality={quality} onReady={handleReady} />}
      <Overlay revealed={revealed} />
      {!revealed && <Loader ready={sceneReady} onDone={handleDone} />}
      <div ref={spacer} className="spacer" aria-hidden />
    </>
  );
}
