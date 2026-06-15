import Link from "next/link";

// Hand-drawn bronze ellipse around a secondary CTA — a Game6 brand signature.
export function ScribbleLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center justify-center px-8 py-3.5 font-heading text-sm font-bold uppercase tracking-[0.12em] text-bone ${className}`}
    >
      <span className="relative z-10">{children}</span>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-accent transition-transform duration-300 group-hover:rotate-[-1.2deg]"
        viewBox="0 0 240 64"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M26 38 C20 18 78 11 132 12 C192 13 226 24 219 39 C212 55 146 58 92 55 C40 52 14 49 31 35"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}
