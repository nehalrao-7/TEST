import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const programs = await prisma.program
    .findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } })
    .catch(() => []);

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/programs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/rentals`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...programs.map((p) => ({
      url: `${SITE_URL}/programs/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
