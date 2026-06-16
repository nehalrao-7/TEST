import { prisma } from "@/lib/db";
import { createOffer, deleteOffer, updateOffer } from "@/app/admin/content-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { formatTimeRange, weekdayLabel } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function AdminOffers() {
  const [offers, classes] = await Promise.all([
    prisma.offer.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.classSession.findMany({
      where: { isActive: true },
      include: { court: true },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const classLabel = (c: (typeof classes)[number]) =>
    `${c.name}, ${weekdayLabel(c.weekday)} ${formatTimeRange(c.startTime, c.endTime)}${c.court ? ` · ${c.court.name}` : ""}`;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-brand">Offers</h1>
      <p className="mt-2 font-body text-sm text-smoke">
        Front-facing &ldquo;free drop-in&rdquo; options shown in the sign-up form.
        Each is a presentation layer over a class already running, use the
        internal note to record which real class it maps to. No new event needed.
      </p>

      <div className="mt-8 space-y-5">
        {offers.map((o) => (
          <form key={o.id} action={updateOffer} className="border border-bone/10 bg-steel p-6">
            <input type="hidden" name="id" value={o.id} />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label">Offer Label (public)</label>
                <input name="label" defaultValue={o.label} className="field-input" />
              </div>
              <div>
                <label className="field-label">Age Range Label</label>
                <input name="ageRangeLabel" defaultValue={o.ageRangeLabel ?? ""} className="field-input" />
              </div>
              <div>
                <label className="field-label">Sort Order</label>
                <input name="sortOrder" type="number" defaultValue={o.sortOrder} className="field-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label">Maps to class (the facade)</label>
                <select name="classSessionId" defaultValue={o.classSessionId ?? ""} className="field-input">
                  <option value="">Not linked</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{classLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label">Internal Note (optional)</label>
                <input name="mappedClassNote" defaultValue={o.mappedClassNote ?? ""} className="field-input" />
              </div>
              <label className="flex items-center gap-3">
                <input type="checkbox" name="isActive" defaultChecked={o.isActive} className="h-5 w-5 accent-bone" />
                <span className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-smoke">
                  Show in form
                </span>
              </label>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <SubmitButton>Save</SubmitButton>
              <button
                formAction={deleteOffer}
                className="btn-ghost !border-red-500/40 !text-red-300 hover:!bg-red-500/20 hover:!text-red-100"
              >
                Delete
              </button>
            </div>
          </form>
        ))}
        {offers.length === 0 ? (
          <p className="font-body text-sm text-smoke">No offers yet, add one below.</p>
        ) : null}
      </div>

      <form action={createOffer} className="mt-8 border border-dashed border-bone/20 bg-steel/50 p-6">
        <p className="field-label">Add an Offer</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">Offer Label (public)</label>
            <input name="label" required className="field-input" placeholder="Free League Drop-In, Ages 9 to 11" />
          </div>
          <div>
            <label className="field-label">Age Range Label</label>
            <input name="ageRangeLabel" className="field-input" placeholder="Ages 9–11" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Maps to class (the facade)</label>
            <select name="classSessionId" defaultValue="" className="field-input">
              <option value="">Not linked</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{classLabel(c)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6">
          <SubmitButton pendingLabel="Adding…">Add Offer</SubmitButton>
        </div>
      </form>
    </div>
  );
}
