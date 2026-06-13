import Link from "next/link";

// Programs-forward nav. Rentals is present but deliberately quiet (last item),
// matching how Game6 wants it: secondary, for people who already know to look.
const navLinks = [
  { href: "/#programs", label: "Programs" },
  { href: "/#free-class", label: "Free Class" },
  { href: "/#about", label: "About" },
  { href: "/rentals", label: "Rentals" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-bone/10 bg-ink/90 backdrop-blur">
      <div className="container-site flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl uppercase tracking-brand text-bone">
          Game<span className="text-smoke">6</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-smoke transition-colors hover:text-bone"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/#free-class" className="hidden md:inline-flex btn-primary !px-5 !py-2.5">
          Free Drop-In
        </Link>

        {/* Mobile: single primary action keeps the funnel front-and-center. */}
        <Link href="/#free-class" className="md:hidden btn-primary !px-4 !py-2 text-xs">
          Free Drop-In
        </Link>
      </div>
    </header>
  );
}
