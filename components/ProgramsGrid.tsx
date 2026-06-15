import { ProgramCard } from "@/components/ProgramCard";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

type Program = {
  id: string;
  name: string;
  blurb: string;
  details: string;
  weeklyCadence?: string | null;
  ageHint?: string | null;
  imagePath?: string | null;
};

export function ProgramsGrid({ programs }: { programs: Program[] }) {
  return (
    <section id="programs" className="border-b border-bone/10 py-24">
      <div className="container-site">
        <Reveal>
          <p className="eyebrow">The League &amp; Programs</p>
          <h2 className="mt-4 max-w-3xl text-4xl leading-[0.95] text-bone sm:text-6xl">
            Find Your Game
          </h2>
          <div className="accent-rule" />
          <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-smoke">
            From first dribble to competitive rep. Placement is by skill, not just
            age — that&apos;s why every player starts with a free drop-in so we can
            see them play.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <RevealItem key={p.id} className="h-full">
              <ProgramCard {...p} />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
