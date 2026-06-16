"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ScribbleLink } from "@/components/brand/Scribble";

const EASE = [0.22, 1, 0.36, 1] as const;

// Game6 intro reel (Vimeo).
const REEL_ID = "800980564";

// Hero leads with the brand line and drives straight to the free-class funnel.
// The backdrop is theme-aware (see .hero-glow / .hero-grid in globals.css).
// Replace the backdrop block with a <video> when the real intro reel is ready.
export function Hero() {
  const reduce = useReducedMotion();
  const [reelOpen, setReelOpen] = useState(false);

  // Lock body scroll + close on Escape while the reel is open.
  useEffect(() => {
    if (!reelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReelOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [reelOpen]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <section className="relative -mt-16 overflow-hidden border-b border-white/10 bg-[#080808]">
      {/* Autoplay, muted, looping background reel. */}
      <div className="hero-video" aria-hidden="true">
        <iframe
          src={`https://player.vimeo.com/video/${REEL_ID}?background=1&autoplay=1&loop=1&muted=1&dnt=1`}
          allow="autoplay; fullscreen"
          title="Game6 Sports Academy reel"
          tabIndex={-1}
        />
      </div>
      <div className="hero-scrim" aria-hidden="true" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="container-site relative flex min-h-[82vh] flex-col justify-center py-20 sm:min-h-[78vh] sm:py-24"
      >
        <motion.p variants={item} className="eyebrow">
          Youth Basketball · Woodbridge, ON
        </motion.p>

        <motion.h1
          variants={item}
          className="mt-5 max-w-4xl text-[3.25rem] leading-[0.92] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)] sm:text-7xl lg:text-8xl"
        >
          Where Passion
          <br />
          Meets Discipline
        </motion.h1>

        <motion.p variants={item} className="mt-7 max-w-xl font-body text-lg leading-relaxed text-white/75">
          This is where players are made. Bring your kid in for a{" "}
          <span className="text-white">free league drop-in</span> — they play, we watch,
          and we find exactly where they belong.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link href="#free-class" className="btn-primary">
            Claim Your Free Drop-In
          </Link>
          <ScribbleLink href="#programs" className="!text-white">
            Explore Programs
          </ScribbleLink>
        </motion.div>

        {/* Intro reel — opens the Vimeo reel with sound in a lightbox. */}
        <motion.button
          variants={item}
          type="button"
          onClick={() => setReelOpen(true)}
          className="group mt-14 inline-flex items-center gap-3 text-white"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/60 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
            <svg width="13" height="13" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
              <path d="M0 0v14l12-7z" />
            </svg>
          </span>
          <span className="font-heading text-xs font-bold uppercase tracking-[0.25em] text-white/75 transition-colors group-hover:text-white">
            Play Reel
          </span>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {reelOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8"
            onClick={() => setReelOpen(false)}
          >
            <button
              type="button"
              onClick={() => setReelOpen(false)}
              aria-label="Close reel"
              className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white hover:text-black"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="relative aspect-video w-full max-w-5xl overflow-hidden bg-black shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`https://player.vimeo.com/video/${REEL_ID}?autoplay=1&title=0&byline=0&portrait=0&dnt=1`}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Game6 Sports Academy — Intro Reel"
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
