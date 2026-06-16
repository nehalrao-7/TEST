"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTheme } from "@/components/theme/ThemeProvider";

// Programs-forward nav. Rentals is present but deliberately quiet (last item).
const navLinks = [
  { href: "/#programs", label: "Programs" },
  { href: "/#free-class", label: "Free Class" },
  { href: "/#faq", label: "FAQ" },
  { href: "/rentals", label: "Rentals" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Float transparently over the hero reel on the home page until scrolled.
  const overlay = pathname === "/" && !scrolled;
  // White logo + light text whenever the header sits on a dark surface.
  const onDark = overlay || theme === "dark";

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        overlay ? "border-b border-transparent bg-transparent" : "border-b border-bone/10 bg-ink/90 backdrop-blur"
      }`}
    >
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Game6 Sports Academy home" className="flex items-center">
          <Image
            src={onDark ? "/images/logo-white.png" : "/images/logo-black.png"}
            alt="Game6 Sports Academy"
            width={966}
            height={328}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-heading text-xs font-bold uppercase tracking-[0.18em] transition-colors ${
                overlay ? "text-white/75 hover:text-white" : "text-smoke hover:text-bone"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle overlay={overlay} />
          <Link href="/#free-class" className="btn-primary !px-4 !py-2.5 text-xs sm:!px-5">
            Free Drop-In
          </Link>
        </div>
      </div>
    </header>
  );
}
