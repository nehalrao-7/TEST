import { prisma } from "@/lib/db";
import { updateSeason } from "@/app/admin/content-actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "CLOSED", "WAITLIST"];

export default async function AdminSeason() {
  const season = await prisma.season.findFirst({ where: { isActive: true } });

  if (!season) {
    return (
      <div>
        <h1 className="font-display text-3xl uppercase tracking-brand">Season</h1>
        <p className="mt-4 font-body text-sm text-smoke">
          No active season found. Run <code>npm run db:seed</code> to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl uppercase tracking-brand">Season</h1>
      <p className="mt-2 font-body text-sm text-smoke">
        Controls the banner across the site. This replaces the old hardcoded
        &ldquo;Spring Season&rdquo; banner, change it any time.
      </p>

      <form action={updateSeason} className="mt-8 border border-bone/10 bg-steel p-6">
        <input type="hidden" name="id" value={season.id} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="label" className="field-label">Season Label</label>
            <input id="label" name="label" defaultValue={season.label} className="field-input" />
          </div>
          <div>
            <label htmlFor="year" className="field-label">Year</label>
            <input id="year" name="year" type="number" defaultValue={season.year} className="field-input" />
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="registrationStatus" className="field-label">Registration Status</label>
          <select id="registrationStatus" name="registrationStatus" defaultValue={season.registrationStatus} className="field-input">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <label htmlFor="headline" className="field-label">Custom Banner Text (optional)</label>
          <input
            id="headline"
            name="headline"
            defaultValue={season.headline ?? ""}
            placeholder="Leave blank to auto-generate from the fields above"
            className="field-input"
          />
        </div>

        <div className="mt-7">
          <SubmitButton>Save Season</SubmitButton>
        </div>
      </form>
    </div>
  );
}
