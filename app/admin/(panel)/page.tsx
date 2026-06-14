import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [season, programCount, offerCount, classCount, bookingCount, leadCount, recentLeads] =
    await Promise.all([
      prisma.season.findFirst({ where: { isActive: true } }),
      prisma.program.count(),
      prisma.offer.count({ where: { isActive: true } }),
      prisma.classSession.count({ where: { isActive: true } }),
      prisma.booking.count({ where: { date: { gte: startOfToday } } }),
      prisma.lead.count(),
      prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const stats = [
    { label: "Active Season", value: season ? `${season.label} ${season.year}` : "—", href: "/admin/season" },
    { label: "Registration", value: season?.registrationStatus ?? "—", href: "/admin/season" },
    { label: "Programs", value: String(programCount), href: "/admin/programs" },
    { label: "Classes", value: String(classCount), href: "/admin/schedule" },
    { label: "Active Offers", value: String(offerCount), href: "/admin/offers" },
    { label: "Upcoming Bookings", value: String(bookingCount), href: "/admin/bookings" },
    { label: "Total Leads", value: String(leadCount), href: "/admin/leads" },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl uppercase tracking-brand">Overview</h1>
      <p className="mt-2 font-body text-sm text-smoke">
        Everything here is live — changes publish to the site instantly.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="border border-bone/10 bg-steel p-6 transition-colors hover:border-bone/30"
          >
            <p className="field-label">{s.label}</p>
            <p className="mt-1 font-display text-2xl uppercase tracking-brand">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 border border-bone/10 bg-steel p-6">
        <div className="flex items-center justify-between">
          <p className="field-label">Latest Leads</p>
          <Link href="/admin/leads" className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-smoke hover:text-bone">
            View all →
          </Link>
        </div>
        {recentLeads.length === 0 ? (
          <p className="mt-4 font-body text-sm text-smoke">No leads yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-bone/10">
            {recentLeads.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-3">
                <span className="font-body text-sm text-bone">
                  {l.kidName} <span className="text-smoke">· {l.parentPhone}</span>
                </span>
                <span className="font-body text-xs text-smoke">
                  {l.createdAt.toLocaleDateString("en-CA")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
