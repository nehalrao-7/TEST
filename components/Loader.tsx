"use client";

import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";

/**
 * Full-screen intro: a giant outlined wordmark that fills from the bottom while
 * a counter runs to 100%. The counter eases toward 90% on its own and only
 * completes once the 3D scene reports it has rendered.
 */
export function Loader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let raf = 0;
    let v = 0;
    const start = performance.now();
    let finishedAt = -1;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const finishing = readyRef.current && t > 1.1;
      const goal = finishing ? 100 : Math.min(90, (t / 1.4) * 90);
      v += (goal - v) * 0.12;
      if (finishing && v > 99.5) v = 100;
      setPct(Math.floor(v));
      if (v >= 100 && finishedAt < 0) {
        finishedAt = now;
        setTimeout(() => setLeaving(true), 220);
        setTimeout(() => doneRef.current(), 220 + 750);
      }
      if (finishedAt < 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`loader ${leaving ? "loader--leaving" : ""}`} role="status" aria-live="polite">
      <div className="loader__mark" aria-hidden>
        <span className="loader__outline">{brand.name}</span>
        <span className="loader__fill" style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}>
          {brand.name}
        </span>
      </div>
      <div className="loader__count">
        <span className="sr-only">Loading </span>
        {String(pct).padStart(2, "0")}%
      </div>
      <div className="loader__sub">{brand.event}</div>
    </div>
  );
}
