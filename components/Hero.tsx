"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

// Hero leads with the brand line and drives straight to the free-class funnel.
// The backdrop is theme-aware (see .hero-glow / .hero-grid in globals.css).
// Replace the backdrop block with a <video> when the real intro reel is ready.
export function Hero() {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.12, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <section className="relative overflow-hidden border-b border-bone/10">
      <div className="hero-glow absolute inset-0" aria-hidden="true" />
      <div className="hero-grid absolute inset-0" aria-hidden="true" />

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
          className="mt-5 max-w-4xl text-[3.25rem] leading-[0.92] text-bone sm:text-7xl lg:text-8xl"
        >
          Where Passion
          <br />
          Meets Discipline
        </motion.h1>

        <motion.p variants={item} className="mt-7 max-w-xl font-body text-lg leading-relaxed text-smoke">
          This is where players are made. Bring your kid in for a{" "}
          <span className="text-bone">free league drop-in</span> — they play, we watch,
          and we find exactly where they belong.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="#free-class" className="btn-primary">
            Claim Your Free Drop-In
          </Link>
          <Link href="#programs" className="btn-ghost">
            Explore Programs
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
