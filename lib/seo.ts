// Central SEO config + JSON-LD builders for Game6 Sports Academy.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://game6sportsacademy.com").replace(/\/$/, "");

export const SITE = {
  name: "Game6 Sports Academy",
  legalName: "Game6 Sports Academy",
  tagline: "Where Passion Meets Discipline",
  description:
    "Youth basketball in Woodbridge, ON. Game6 Sports Academy runs the G6 Basketball League, junior & advanced training, rep teams, camps and girls programs for kids across Vaughan and the GTA. Start with a free league drop-in.",
  url: SITE_URL,
  phone: "+1-905-856-3223",
  phoneDisplay: "(905) 856-3223",
  email: "",
  instagram: "https://instagram.com/game6sportsacademy",
  sport: "Basketball",
  address: {
    street: "241 Trade Valley Dr",
    locality: "Woodbridge",
    region: "ON",
    country: "CA",
  },
  // Communities to surface for local search.
  areaServed: [
    "Woodbridge",
    "Vaughan",
    "Maple",
    "Kleinburg",
    "Concord",
    "Thornhill",
    "Richmond Hill",
    "Brampton",
    "Greater Toronto Area",
  ],
};

const sameAs = [SITE.instagram];

// SportsActivityLocation is a LocalBusiness subtype, ideal for a facility.
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": `${SITE_URL}/#localbusiness`,
    name: SITE.name,
    description: SITE.description,
    url: SITE_URL,
    telephone: SITE.phone,
    image: `${SITE_URL}/opengraph-image`,
    logo: `${SITE_URL}/icon.svg`,
    sport: SITE.sport,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.street,
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.country,
    },
    areaServed: SITE.areaServed.map((name) => ({ "@type": "City", name })),
    sameAs,
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    sport: SITE.sport,
    telephone: SITE.phone,
    sameAs,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE.name,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

// A program presented as a Service offered by the academy (good for local intent).
export function programJsonLd(program: {
  name: string;
  blurb: string;
  details: string;
  slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: `Youth basketball, ${program.name}`,
    name: program.name,
    description: program.details || program.blurb,
    url: `${SITE_URL}/programs/${program.slug}`,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: SITE.areaServed.map((name) => ({ "@type": "City", name })),
    audience: { "@type": "Audience", audienceType: "Youth basketball players and their parents" },
  };
}
