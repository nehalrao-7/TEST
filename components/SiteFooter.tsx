import Link from "next/link";

// Simple court-line icon, nods to the current site's court iconography.
function CourtIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 70" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="1" width="118" height="68" stroke="currentColor" strokeWidth="2" />
      <line x1="60" y1="1" x2="60" y2="69" stroke="currentColor" strokeWidth="2" />
      <circle cx="60" cy="35" r="12" stroke="currentColor" strokeWidth="2" />
      <path d="M1 18 H30 V52 H1" stroke="currentColor" strokeWidth="2" />
      <path d="M119 18 H90 V52 H119" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer id="about" className="border-t border-bone/10 bg-ink">
      <div className="container-site py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl uppercase tracking-brand text-bone">
              Game6 Sports Academy
            </p>
            <p className="mt-3 max-w-sm font-heading text-sm uppercase tracking-[0.18em] text-smoke">
              Where Passion Meets Discipline
            </p>
            <CourtIcon className="mt-6 h-16 w-28 text-bone/40" />
          </div>

          <div>
            <p className="eyebrow mb-4">Contact</p>
            <address className="not-italic font-body text-sm leading-relaxed text-smoke">
              241 Trade Valley Dr
              <br />
              Woodbridge, ON
              <br />
              <a href="tel:+19058563223" className="mt-3 inline-block text-bone transition-colors hover:text-accent">
                (905) 856-3223
              </a>
              <br />
              <a
                href="https://instagram.com/game6sportsacademy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-heading text-xs font-bold uppercase tracking-[0.12em] text-accent transition-opacity hover:opacity-80"
              >
                @game6sportsacademy
              </a>
            </address>
          </div>

          <div>
            <p className="eyebrow mb-4">Explore</p>
            <ul className="space-y-2 font-body text-sm text-smoke">
              <li>
                <Link href="/#programs" className="transition-colors hover:text-bone">
                  Programs
                </Link>
              </li>
              <li>
                <Link href="/#free-class" className="transition-colors hover:text-bone">
                  Free League Drop-In
                </Link>
              </li>
              <li>
                <Link href="/rentals" className="transition-colors hover:text-bone">
                  Court Rentals
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-bone/10 pt-8 sm:flex-row sm:items-center">
          <p className="font-display text-3xl uppercase tracking-brand text-bone">
            We Got Next
          </p>
          <p className="font-body text-xs text-smoke">
            © {new Date().getFullYear()} Game6 Sports Academy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
