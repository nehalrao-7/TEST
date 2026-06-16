import Link from "next/link";
import { prisma } from "@/lib/db";
import { WEEKDAY_ORDER, formatTimeRange, weekdayLabel } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function AdminSchedule() {
  const classes = await prisma.classSession.findMany({
    where: { isActive: true },
    include: { program: true, court: true },
    orderBy: [{ startTime: "asc" }],
  });

  const byDay = new Map<number, typeof classes>();
  for (const c of classes) {
    const list = byDay.get(c.weekday) ?? [];
    list.push(c);
    byDay.set(c.weekday, list);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-brand">Weekly Schedule</h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-smoke">
            The base inventory layer, the courts are the inventory, and these
            classes reserve court time. Internal only; this is never shown to the
            public as an availability calendar.
          </p>
        </div>
        <Link href="/admin/classes" className="btn-ghost shrink-0">Edit Classes</Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WEEKDAY_ORDER.map((day) => {
          const items = byDay.get(day) ?? [];
          return (
            <div key={day} className="border border-bone/10 bg-steel p-5">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-bone">
                {weekdayLabel(day)}
              </p>
              {items.length === 0 ? (
                <p className="mt-3 font-body text-sm text-smoke/70">No classes</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {items.map((c) => (
                    <li key={c.id} className="border-l-2 border-bone/30 pl-3">
                      <p className="font-body text-sm text-bone">{c.name}</p>
                      <p className="font-body text-xs text-smoke">
                        {formatTimeRange(c.startTime, c.endTime)}
                        {c.court ? ` · ${c.court.name}` : ""}
                      </p>
                      {c.program ? (
                        <p className="font-heading text-[10px] uppercase tracking-[0.15em] text-smoke/80">
                          {c.program.name}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
