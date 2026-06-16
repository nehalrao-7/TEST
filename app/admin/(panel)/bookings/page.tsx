import { prisma } from "@/lib/db";
import { createBooking, deleteBooking } from "@/app/admin/content-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { formatTimeRange } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const TYPES = ["RENTAL", "PROGRAM", "HOLD"];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminBookings() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [courts, upcoming, past] = await Promise.all([
    prisma.court.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.booking.findMany({
      where: { date: { gte: startOfToday } },
      include: { court: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.booking.findMany({
      where: { date: { lt: startOfToday } },
      include: { court: true },
      orderBy: { date: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-brand">Court Bookings</h1>
      <p className="mt-2 font-body text-sm text-smoke">
        Owner-controlled court reservations, rentals, holds, and one-off program
        time. Internal only; there is no public booking surface, by design.
      </p>

      {/* Add booking */}
      <form action={createBooking} className="mt-8 border border-bone/10 bg-steel p-6">
        <p className="field-label">Log a Booking</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">Title</label>
            <input name="title" required className="field-input" placeholder="e.g. Adult Rental, Smith group" />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select name="type" defaultValue="RENTAL" className="field-input">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Court</label>
            <select name="courtId" defaultValue="" className="field-input">
              <option value="">None</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Date</label>
            <input name="date" type="date" defaultValue={isoDate(new Date())} className="field-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Start</label>
              <input name="startTime" type="time" defaultValue="20:00" className="field-input" />
            </div>
            <div>
              <label className="field-label">End</label>
              <input name="endTime" type="time" defaultValue="22:00" className="field-input" />
            </div>
          </div>
          <div>
            <label className="field-label">Contact</label>
            <input name="contact" className="field-input" placeholder="Phone / name" />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <input name="notes" className="field-input" />
          </div>
        </div>
        <div className="mt-6">
          <SubmitButton pendingLabel="Saving…">Add Booking</SubmitButton>
        </div>
      </form>

      <BookingList title="Upcoming" bookings={upcoming} emptyText="No upcoming bookings." />
      <BookingList title="Recent (past)" bookings={past} emptyText="No past bookings." muted />
    </div>
  );
}

type BookingRow = {
  id: string;
  title: string;
  type: string;
  date: Date;
  startTime: string;
  endTime: string;
  contact: string | null;
  notes: string | null;
  court: { name: string } | null;
};

function BookingList({
  title,
  bookings,
  emptyText,
  muted,
}: {
  title: string;
  bookings: BookingRow[];
  emptyText: string;
  muted?: boolean;
}) {
  return (
    <div className="mt-10">
      <p className="field-label">{title}</p>
      {bookings.length === 0 ? (
        <p className="mt-3 font-body text-sm text-smoke">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-bone/10 border border-bone/10">
          {bookings.map((b) => (
            <li key={b.id} className={`flex items-center justify-between gap-4 p-4 ${muted ? "opacity-70" : ""}`}>
              <div>
                <p className="font-body text-sm text-bone">
                  {b.title}
                  <span className="ml-2 border border-bone/20 px-1.5 py-0.5 font-heading text-[10px] uppercase tracking-[0.12em] text-smoke">
                    {b.type}
                  </span>
                </p>
                <p className="mt-1 font-body text-xs text-smoke">
                  {b.date.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                  {" · "}
                  {formatTimeRange(b.startTime, b.endTime)}
                  {b.court ? ` · ${b.court.name}` : ""}
                  {b.contact ? ` · ${b.contact}` : ""}
                </p>
              </div>
              <form action={deleteBooking}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className="text-smoke hover:text-red-300" aria-label="Delete booking">
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
