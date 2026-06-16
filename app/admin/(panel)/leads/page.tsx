import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminLeads() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 500 });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-brand">Leads</h1>
          <p className="mt-2 font-body text-sm text-smoke">
            Free-class sign-ups, newest first. Call the parent, ask about the
            kid&apos;s experience, and tell them which class to come to.
          </p>
        </div>
        <span className="font-body text-sm text-smoke">{leads.length} total</span>
      </div>

      {leads.length === 0 ? (
        <p className="mt-8 border border-bone/10 bg-steel p-6 font-body text-sm text-smoke">
          No leads yet. They&apos;ll appear here the moment a parent submits the form.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto border border-bone/10">
          <table className="w-full border-collapse text-left">
            <thead className="bg-steel">
              <tr className="font-heading text-[11px] uppercase tracking-[0.15em] text-smoke">
                <th className="p-3">Date</th>
                <th className="p-3">Player</th>
                <th className="p-3">Parent</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Birth Yr</th>
                <th className="p-3">Offer</th>
                <th className="p-3">Experience</th>
              </tr>
            </thead>
            <tbody className="font-body text-sm">
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-bone/10 align-top">
                  <td className="whitespace-nowrap p-3 text-smoke">{l.createdAt.toLocaleDateString("en-CA")}</td>
                  <td className="p-3 text-bone">{l.kidName}</td>
                  <td className="p-3 text-bone">{l.parentName}</td>
                  <td className="whitespace-nowrap p-3 text-bone">
                    <a href={`tel:${l.parentPhone.replace(/[^0-9+]/g, "")}`} className="underline-offset-2 hover:underline">
                      {l.parentPhone}
                    </a>
                  </td>
                  <td className="p-3 text-smoke">{l.birthYear ?? "-"}</td>
                  <td className="p-3 text-smoke">{l.offerLabel ?? "-"}</td>
                  <td className="max-w-xs p-3 text-smoke">{l.experience ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
