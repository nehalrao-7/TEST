// Game6 wordmark lockup. The mark is a clean placeholder for the real angular
// "6" logo — drop the official SVG into <LogoMark> to swap it everywhere.
export function LogoMark({ className = "h-9 w-9 text-xl" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border-[2.5px] border-current font-display leading-none ${className}`}
      aria-hidden="true"
    >
      6
    </span>
  );
}

export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className={compact ? "h-8 w-8 text-base" : "h-9 w-9 text-xl"} />
      <span className="leading-[0.95]">
        <span className="block font-display text-base uppercase tracking-brand">Game6</span>
        <span className="block font-heading text-[9px] font-bold uppercase tracking-[0.28em] text-smoke">
          Sports Academy
        </span>
      </span>
    </span>
  );
}
