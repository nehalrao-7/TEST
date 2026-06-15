import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
        <Link href="/" aria-label="Game6 Sports Academy home" className="flex items-center">
          {/* Black logo: blends on light header, auto-inverts to white on dark. */}
          <Image
            src="/images/game6-logo.jpg"
            alt="Game6 Sports Academy"
            width={483}
            height={164}
            priority
            className="h-9 w-auto mix-blend-multiply dark:mix-blend-normal dark:invert"
          />
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

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {/* Single primary action keeps the funnel front-and-center on every size. */}
          <Link href="/#free-class" className="btn-primary !px-4 !py-2.5 text-xs sm:!px-5">
            Free Drop-In
          </Link>
        </div>
      </div>
    </header>
  );
}
