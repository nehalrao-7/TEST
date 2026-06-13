import Image from "next/image";

type ProgramCardProps = {
  name: string;
  blurb: string;
  details: string;
  weeklyCadence?: string | null;
  ageHint?: string | null;
  imagePath?: string | null;
};

export function ProgramCard({ name, blurb, details, weeklyCadence, ageHint, imagePath }: ProgramCardProps) {
  return (
    <article className="group flex flex-col border border-bone/10 bg-steel transition-colors hover:border-bone/30">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink">
        {imagePath ? (
          <Image
            src={imagePath}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover opacity-90 grayscale transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-3xl uppercase text-bone/15">
            Game6
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl leading-tight text-bone">{name}</h3>
        <p className="mt-3 font-body text-sm leading-relaxed text-smoke">{details}</p>

        <div className="mt-5 flex flex-wrap gap-2 pt-2">
          {weeklyCadence ? (
            <span className="border border-bone/15 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-smoke">
              {weeklyCadence}
            </span>
          ) : null}
          {ageHint ? (
            <span className="border border-bone/15 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-smoke">
              {ageHint}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
