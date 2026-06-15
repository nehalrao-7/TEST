import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ProgramsGrid } from "@/components/ProgramsGrid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Youth Basketball Programs in Woodbridge & Vaughan",
  description:
    "Explore Game6 Sports Academy's youth basketball programs in Woodbridge, ON — house league, junior ball, advanced training, rep teams, camps and a girls program.",
  alternates: { canonical: "/programs" },
};

export default async function ProgramsPage() {
  const programs = await prisma.program.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return (
    <div className="pt-10">
      <ProgramsGrid programs={programs} />
    </div>
  );
}
