import { prisma } from "@/lib/db";
import { createProgram, deleteProgram, updateProgram } from "@/app/admin/content-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function AdminPrograms() {
  const programs = await prisma.program.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-brand">Programs</h1>
      <p className="mt-2 font-body text-sm text-smoke">
        Edit program details, ordering, and visibility. Age hints are soft
        guidance only — placement still happens by skill at the evaluation.
      </p>

      <div className="mt-8 space-y-5">
        {programs.map((p) => (
          <form key={p.id} action={updateProgram} className="border border-bone/10 bg-steel p-6">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-lg uppercase tracking-brand">{p.name}</p>
              <span className="font-body text-xs text-smoke">{p.slug}</span>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label">Name</label>
                <input name="name" defaultValue={p.name} className="field-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label">Short Blurb</label>
                <input name="blurb" defaultValue={p.blurb} className="field-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label">Details</label>
                <textarea name="details" rows={3} defaultValue={p.details} className="field-input resize-none" />
              </div>
              <div>
                <label className="field-label">Weekly Cadence</label>
                <input name="weeklyCadence" defaultValue={p.weeklyCadence ?? ""} className="field-input" />
              </div>
              <div>
                <label className="field-label">Age Hint</label>
                <input name="ageHint" defaultValue={p.ageHint ?? ""} className="field-input" />
              </div>
              <div>
                <label className="field-label">Sort Order</label>
                <input name="sortOrder" type="number" defaultValue={p.sortOrder} className="field-input" />
              </div>
              <label className="flex items-end gap-3 pb-3">
                <input type="checkbox" name="isActive" defaultChecked={p.isActive} className="h-5 w-5 accent-bone" />
                <span className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-smoke">
                  Show on site
                </span>
              </label>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <SubmitButton>Save</SubmitButton>
              <button
                formAction={deleteProgram}
                className="btn-ghost !border-red-500/40 !text-red-300 hover:!bg-red-500/20 hover:!text-red-100"
              >
                Delete
              </button>
            </div>
          </form>
        ))}
      </div>

      {/* Add a new program */}
      <form action={createProgram} className="mt-8 border border-dashed border-bone/20 bg-steel/50 p-6">
        <p className="field-label">Add a Program</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">Name</label>
            <input name="name" required className="field-input" placeholder="e.g. Skills & Drills" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Short Blurb</label>
            <input name="blurb" className="field-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">Details</label>
            <textarea name="details" rows={2} className="field-input resize-none" />
          </div>
          <div>
            <label className="field-label">Weekly Cadence</label>
            <input name="weeklyCadence" className="field-input" />
          </div>
          <div>
            <label className="field-label">Age Hint</label>
            <input name="ageHint" className="field-input" />
          </div>
        </div>
        <div className="mt-6">
          <SubmitButton pendingLabel="Adding…">Add Program</SubmitButton>
        </div>
      </form>
    </div>
  );
}
