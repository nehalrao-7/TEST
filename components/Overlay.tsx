"use client";

import { useEffect, useRef } from "react";
import { brand } from "@/lib/brand";
import { CROSSING, pulse, scroll, smoothstep } from "@/lib/scroll";

/**
 * Text layers on top of the canvas. Opacity and position are driven straight
 * from the scroll store each animation frame, without React re-renders.
 */
export function Overlay({ revealed }: { revealed: boolean }) {
  const intro = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const final = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const set = (el: HTMLElement | null, o: number, y = 0) => {
      if (!el) return;
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      el.style.visibility = o < 0.01 ? "hidden" : "visible";
    };
    const tick = () => {
      const p = scroll.current;
      const shown = revealed ? 1 : 0;
      const introO = (1 - smoothstep(0.02, 0.1, p)) * shown;
      set(intro.current, introO, -p * 400);
      set(cue.current, (1 - smoothstep(0.0, 0.04, p)) * shown);
      set(mid.current, pulse(0.28, 0.09, p), (0.28 - p) * 300);
      if (flash.current) flash.current.style.opacity = (pulse(CROSSING, 0.055, p) * 0.92).toFixed(3);
      const f = smoothstep(0.86, 0.97, p);
      set(final.current, f, (1 - f) * 30);
      if (rail.current) rail.current.style.transform = `scaleY(${p.toFixed(4)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [revealed]);

  return (
    <div className="overlay">
      <div ref={flash} className="flash" aria-hidden />

      <div ref={intro} className="block block--intro">
        <p className="eyebrow">
          <span className="dot" /> {brand.event}
        </p>
        <h1 className="display">
          The tunnel
          <br />
          is open.
        </h1>
        <p className="lede">Walk out with us. Scroll to hit the floor.</p>
      </div>

      <div ref={mid} className="block block--mid">
        <p className="display display--md">{brand.tagline}</p>
      </div>

      <div ref={final} className="block block--final">
        <p className="eyebrow">
          <span className="dot" /> Welcome to the arena
        </p>
        <h2 className="display display--xl">{brand.name}</h2>
        <p className="lede">The tournament, the court and the gear. Merch rack drops on this floor soon.</p>
        <div className="ctas">
          <a className="btn btn--primary" href="#partners">
            Meet the partners
          </a>
          <span className="btn btn--ghost" aria-disabled>
            Shop the rack <em>Soon</em>
          </span>
        </div>
      </div>

      <div ref={cue} className="cue" aria-hidden>
        <span>Scroll</span>
        <i />
      </div>
      <div className="rail" aria-hidden>
        <div ref={rail} className="rail__fill" />
      </div>
    </div>
  );
}
