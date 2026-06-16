import { prisma } from "@/lib/db";
import {
  createClassSession,
  createCourt,
  deleteClassSession,
  deleteCourt,
  updateClassSession,
} from "@/app/admin/content-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { WEEKDAYS, WEEKDAY_ORDER, formatTimeRange, weekdayLabel } from "@/lib/schedule";

export const dynamic = "force-dynamic";

function WeekdaySelect({ name, defaultValue }: { name: string; defaultValue?: number }) {
  return (
    <select name={name} defaultValue={defaultValue ?? 1} className="field-input">
      {WEEKDAY_ORDER.map((d) => (
        <option key={d} value={d}>
          {WEEKDAYS[d]}
        </option>
      ))}
    </select>
  );
}

export default async function AdminClasses() {
  const [classes, programs, courts] = await Promise.all([
    prisma.classSession.findMany({
      include: { program: true, court: true },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
    prisma.program.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.court.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-brand">Classes</h1>
      <p className="mt-2 font-body text-sm text-smoke">
        The recurring classes that actually consume court time. Offers map onto
        these, so a public &ldquo;free drop-in&rdquo; resolves to a class already
        on the books, no separate event needed.
      </p>

      {/* Courts (the inventory) */}
      <div className="mt-8 border border-bone/10 bg-steel p-6">
        <p className="field-label">Courts</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {courts.map((c) => (
            <form key={c.id} action={deleteCourt} className="flex items-center gap-2 border border-bone/15 px-3 py-1.5">
              <input type="hidden" name="id" value={c.id} />
              <span className="font-body text-sm text-bone">{c.name}</span>
              <button type="submit" className="text-smoke hover:text-red-300" aria-label={`Delete ${c.name}`}>
                ×
              </button>
            </form>
          ))}
          {courts.length === 0 ? <span className="font-body text-sm text-smoke">No courts yet.</span> : null}
        </div>
        <form action={createCourt} className="mt-4 flex gap-2">
          <input name="name" placeholder="Add a court (e.g. Court 3)" className="field-input max-w-xs" />
          <SubmitButton pendingLabel="Adding…" className="btn-ghost">Add</SubmitButton>
        </form>
      </div>

      {/* Existing classes */}
      <div className="mt-8 space-y-5">
        {classes.map((c) => (
          <form key={c.id} action={updateClassSession} className="border border-bone/10 bg-steel p-6">
            <input type="hidden" name="id" value={c.id} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg uppercase tracking-brand">{c.name}</p>
              <span className="font-body text-xs text-smoke">
                {weekdayLabel(c.weekday)} · {formatTimeRange(c.startTime, c.endTime)}
                {c.court ? ` · ${c.court.name}` : ""}
              </span>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label">Class Name</label>
                <input name="name" defaultValue={c.name} className="field-input" />
              </div>
              <div>
                <label className="field-label">Day</label>
                <WeekdaySelect name="weekday" defaultValue={c.weekday} />
              </div>
              <div>
                <label className="field-label">Court</label>
                <select name="courtId" defaultValue={c.courtId ?? ""} className="field-input">
                  <option value="">None</option>
                  {courts.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Start</label>
                <input name="startTime" type="time" defaultValue={c.startTime} className="field-input" />
              </div>
              <div>
                <label className="field-label">End</label>
                <input name="endTime" type="time" defaultValue={c.endTime} className="field-input" />
              </div>
              <div>
                <label className="field-label">Program</label>
                <select name="programId" defaultValue={c.programId ?? ""} className="field-input">
                  <option value="">None</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Capacity</label>
                <input name="capacity" type="number" defaultValue={c.capacity ?? ""} className="field-input" />
              </div>
              <div>
                <label className="field-label">Age Hint</label>
                <input name="ageHint" defaultValue={c.ageHint ?? ""} className="field-input" />
              </div>
              <label className="flex items-end gap-3 pb-3">
                <input type="checkbox" name="isActive" defaultChecked={c.isActive} className="h-5 w-5 accent-bone" />
                <span className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-smoke">Active</span>
              </label>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <SubmitButton>Save</SubmitButton>
              <button
                formAction={deleteClassSession}
                className="btn-ghost !border-red-500/40 !text-red-300 hover:!bg-red-500/20 hover:!text-red-100"
              >
                Delete
              </button>
            </div>
          </form>
        ))}
      </div>

      {/* Add class */}
      <form action={createClassSession} className="mt-8 border border-dashed border-bone/20 bg-steel/50 p-6">
        <p className="field-label">Add a Class</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">Class Name</label>
            <input name="name" required className="field-input" placeholder="e.g. Junior Ball, Beginners" />
          </div>
          <div>
            <label className="field-label">Day</label>
            <WeekdaySelect name="weekday" />
          </div>
          <div>
            <label className="field-label">Court</label>
            <select name="courtId" defaultValue="" className="field-input">
              <option value="">None</option>
              {courts.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Start</label>
            <input name="startTime" type="time" defaultValue="18:00" className="field-input" />
          </div>
          <div>
            <label className="field-label">End</label>
            <input name="endTime" type="time" defaultValue="19:30" className="field-input" />
          </div>
          <div>
            <label className="field-label">Program</label>
            <select name="programId" defaultValue="" className="field-input">
              <option value="">None</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Capacity</label>
            <input name="capacity" type="number" className="field-input" />
          </div>
        </div>
        <div className="mt-6">
          <SubmitButton pendingLabel="Adding…">Add Class</SubmitButton>
        </div>
      </form>
    </div>
  );
}
