import type { MetadataRoute } from "next";

const BASE_URL = "https://game6sportsacademy.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The owner-controlled lead API is not a crawlable page.
      disallow: ["/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
