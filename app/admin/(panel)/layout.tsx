import Link from "next/link";
import { logout } from "@/app/admin/auth-actions";

const navLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/programs", label: "Programs" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/season", label: "Season" },
  { href: "/admin/leads", label: "Leads" },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="border-b border-bone/10">
        <div className="container-site flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="font-display text-lg uppercase tracking-brand">
            Game<span className="text-smoke">6</span> Admin
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-smoke transition-colors hover:text-bone"
            >
              View Site ↗
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-smoke transition-colors hover:text-bone"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav className="border-b border-bone/10 bg-steel/40">
        <div className="container-site flex gap-1 overflow-x-auto">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 font-heading text-xs font-bold uppercase tracking-[0.15em] text-smoke transition-colors hover:text-bone"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="container-site py-10">{children}</div>
    </div>
  );
}
