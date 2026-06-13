import type { MetadataRoute } from "next";

const BASE_URL = "https://game6sportsacademy.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/rentals`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
