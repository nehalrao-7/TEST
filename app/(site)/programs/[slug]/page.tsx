import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, programJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function getProgram(slug: string) {
  return prisma.program.findUnique({ where: { slug } });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getProgram(params.slug);
  if (!p) return {};
  return {
    title: `${p.name}, Youth Basketball in Woodbridge`,
    description: `${p.blurb} ${p.details}`.slice(0, 155),
    alternates: { canonical: `/programs/${p.slug}` },
    openGraph: { title: `${p.name} | Game6 Sports Academy`, description: p.blurb },
  };
}

export default async function ProgramPage({ params }: { params: { slug: string } }) {
  const p = await getProgram(params.slug);
  if (!p) notFound();

  return (
    <article className="border-b border-bone/10 py-20">
      <JsonLd data={programJsonLd(p)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Programs", path: "/programs" },
          { name: p.name, path: `/programs/${p.slug}` },
        ])}
      />
      <div className="container-site max-w-4xl">
        <nav className="font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-smoke">
          <Link href="/programs" className="hover:text-bone">Programs</Link> <span className="text-accent">/</span> {p.name}
        </nav>

        <h1 className="mt-5 text-4xl leading-[0.95] text-bone sm:text-6xl">{p.name}</h1>
        <div className="accent-rule" />
        <p className="mt-5 font-heading text-sm font-bold uppercase tracking-[0.12em] text-accent">{p.blurb}</p>

        {p.imagePath ? (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden border border-bone/10 bg-ink">
            <Image src={p.imagePath} alt={`${p.name} at Game6 Sports Academy in Woodbridge`} fill sizes="(max-width:768px) 100vw, 800px" className="object-cover opacity-90 grayscale" />
          </div>
        ) : null}

        <p className="mt-8 max-w-2xl font-body text-lg leading-relaxed text-smoke">{p.details}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {p.weeklyCadence ? (
            <span className="border border-bone/15 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-smoke">{p.weeklyCadence}</span>
          ) : null}
          {p.ageHint ? (
            <span className="border border-bone/15 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-smoke">{p.ageHint}</span>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="/#free-class" className="btn-primary">Claim a Free Drop-In</Link>
          <Link href="/programs" className="btn-ghost">All Programs</Link>
        </div>
      </div>
    </article>
  );
}
