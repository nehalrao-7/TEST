import Image from "next/image";
import Link from "next/link";

type ProgramCardProps = {
  slug?: string;
  name: string;
  blurb: string;
  details: string;
  weeklyCadence?: string | null;
  ageHint?: string | null;
  imagePath?: string | null;
};

export function ProgramCard({ slug, name, blurb, details, weeklyCadence, ageHint, imagePath }: ProgramCardProps) {
  const Wrapper = (slug ? Link : "div") as React.ElementType;
  return (
    <Wrapper
      {...(slug ? { href: `/programs/${slug}` } : {})}
      className="group flex h-full flex-col border border-bone/10 bg-steel transition-all duration-300 hover:-translate-y-1 hover:border-bone/30 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]"
    >
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
        <div className="accent-rule" />
        {blurb ? (
          <p className="mt-4 font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            {blurb}
          </p>
        ) : null}
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
        {slug ? (
          <span className="mt-5 inline-block font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-accent">
            View Program →
          </span>
        ) : null}
      </div>
    </Wrapper>
  );
}
