import Link from "next/link";
import { prisma } from "@/lib/db";
import { Hero } from "@/components/Hero";
import { SeasonBanner } from "@/components/SeasonBanner";
import { ProgramsGrid } from "@/components/ProgramsGrid";
import { FreeClassForm } from "@/components/FreeClassForm";
import { Reveal } from "@/components/motion/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqJsonLd, localBusinessJsonLd } from "@/lib/seo";

// Always render fresh so seeded/admin-edited content shows immediately.
export const dynamic = "force-dynamic";

// Parent-intent FAQ — also emitted as FAQPage structured data for rich results.
const FAQS = [
  {
    q: "How do I get my child started at Game6 Sports Academy?",
    a: "Claim a free league drop-in on this page. Your child comes in for one class, our coaches watch them play, and we place them in the right program by skill. A coach calls you to confirm which class to attend.",
  },
  {
    q: "What ages do you coach?",
    a: "We coach youth from beginners through high school across our programs. Placement is by skill, not just age, which is why every new player starts with a free evaluation drop-in.",
  },
  {
    q: "Where is Game6 Sports Academy located?",
    a: "We're at 241 Trade Valley Dr in Woodbridge, ON, serving Vaughan, Maple, Kleinburg and the Greater Toronto Area.",
  },
  {
    q: "What basketball programs do you offer?",
    a: "The G6 Basketball League (house league), Junior Ball for beginners, the Training Academy for advanced players, the Lions competitive rep program, seasonal Camps & Clinics, and a dedicated Girls Program.",
  },
  {
    q: "Do you run basketball camps?",
    a: "Yes — three times a year (summer, winter break and March break), in partnership with Nike Sports Camp Canada, with full-day and half-day options.",
  },
  {
    q: "How much does it cost?",
    a: "Pricing varies by program and season. Your first league drop-in is free, so your child can try Game6 before you commit.",
  },
];

export default async function HomePage() {
  const [season, programs, offers] = await Promise.all([
    prisma.season.findFirst({ where: { isActive: true } }),
    prisma.program.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.offer.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      {season ? (
        <SeasonBanner
          label={season.label}
          year={season.year}
          registrationStatus={season.registrationStatus}
          headline={season.headline}
        />
      ) : null}

      <JsonLd data={localBusinessJsonLd()} />
      <JsonLd data={faqJsonLd(FAQS)} />
      <Hero />

      {/* The free-class offer is the primary conversion block — front and center,
          immediately after the hero. */}
      <section id="free-class" className="border-b border-bone/10 bg-ink py-24">
        <div className="container-site grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <p className="eyebrow">Start Here</p>
            <h2 className="mt-4 text-4xl leading-[0.95] text-bone sm:text-6xl">
              Free League
              <br />
              Drop-In
            </h2>
            <div className="accent-rule" />
            <p className="mt-6 max-w-md font-body text-lg leading-relaxed text-smoke">
              One class, on us. Your kid drops into a real session, plays live, and
              our coaches see exactly where they fit. No tryout pressure, no
              commitment — just basketball.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                "Bring your player in for a live session",
                "Coaches evaluate and place them by skill",
                "We call you to lock in the right class",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-accent-solid font-display text-sm text-white">
                    {i + 1}
                  </span>
                  <span className="font-body text-base leading-relaxed text-bone">{step}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15} className="lg:sticky lg:top-24">
            <FreeClassForm offers={offers.map((o) => ({ id: o.id, label: o.label }))} />
          </Reveal>
        </div>
      </section>

      <ProgramsGrid programs={programs} />

      <section id="faq" className="border-b border-bone/10 py-24">
        <div className="container-site max-w-3xl">
          <Reveal>
            <p className="eyebrow">Parent Questions</p>
            <h2 className="mt-4 text-4xl leading-[0.95] text-bone sm:text-5xl">FAQ</h2>
            <div className="accent-rule" />
          </Reveal>
          <dl className="mt-10 divide-y divide-bone/10 border-y border-bone/10">
            {FAQS.map((f) => (
              <div key={f.q} className="py-6">
                <dt className="font-heading text-base font-bold uppercase tracking-[0.04em] text-bone">{f.q}</dt>
                <dd className="mt-2 font-body text-sm leading-relaxed text-smoke">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Quiet, secondary rentals path — present for those who know to look,
          never competing with the programs funnel. */}
      <section className="bg-ink py-16">
        <Reveal className="container-site flex flex-col items-start justify-between gap-6 border border-bone/10 p-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Our Courts</p>
            <p className="mt-2 max-w-xl font-body text-base leading-relaxed text-smoke">
              Game6 also offers court rentals at our Woodbridge facility. Availability
              is limited and handled directly with our team.
            </p>
          </div>
          <Link href="/rentals" className="btn-ghost shrink-0">
            Court Rentals
          </Link>
        </Reveal>
      </section>
    </>
  );
}
