# Sarav Accounting Services (SAS) — One-Page Website

Single-page marketing site for Sarav Accounting Services, built as a static HTML file (`index.html`) with Tailwind CDN, vanilla JS, and GSAP/Lenis for motion. No build step required — open `index.html` in a browser or deploy the folder as-is.

## Files

- `index.html` — the complete site
- `robots.txt` — search engine crawl rules
- `sitemap.xml` — sitemap for search engines
- `README.md` — this file

## Business details already filled in

| Field | Value |
|---|---|
| Business name | Sarav Accounting Services (SAS) |
| Phone | (647) 300-1790 / `tel:+16473001790` |
| WhatsApp | `https://wa.me/16473001790` |
| Email | saravseehra@gmail.com |
| Address | 45-1B Karachi Dr, Markham, ON L3S 0B6 |
| Years of experience | 15+ |

These appear in the header logo, hero, contact section, footer, sticky mobile bar, and the JSON-LD `AccountingService` schema in `<head>`.

## Remaining placeholders to replace before launch

| Placeholder | Where it appears | Replace with |
|---|---|---|
| `Mon to Fri, 9:00 AM to 6:00 PM` | Contact section, footer | Real business hours |
| `Mo-Fr 09:00-18:00` | JSON-LD `AccountingService` schema `openingHours` (`<head>`) | Real hours in schema.org format |
| `https://www.example.com/` | `<link rel="canonical">`, Open Graph `og:url`, `sitemap.xml` `<loc>`, `robots.txt` sitemap line | Real production domain |
| `https://www.example.com/og-image.jpg` | Open Graph `og:image`, Twitter Card `twitter:image` (`<head>`) | Real social share image URL (1200×630px recommended) |

## Other integration points

- **Logo**: the header/footer currently use an inline SVG monogram badge ("SAS" in gold on navy) plus the wordmark. Swap the `<svg class="logo-mark">` in the header for a real logo file if one becomes available.
- **Contact form backend**: `index.html`, `<form id="contact-form" action="#" ...>` — the form currently has no live submit endpoint. Replace `action="#"` with your backend URL or a Formspree endpoint (see the HTML comment directly above the form and inside the JS `initForm()` function for exact placement).
- **Google Map embed**: `index.html`, contact section — a bordered placeholder `<div>` labeled "Google Map Embed" stands in for the map. Replace it with a real `<iframe src="https://www.google.com/maps/embed?pb=...">` from the Google Maps Embed API, centered on 45-1B Karachi Dr, Markham, ON L3S 0B6. See the HTML comment directly above the placeholder div.
- **Open Graph / Twitter image**: no image file is included. Add a real image asset and update the two `og:image` / `twitter:image` meta tags to point to it.

## Notes

- Respects `prefers-reduced-motion: reduce` — all scroll/parallax animation and Lenis smooth scroll are disabled and content renders in its final state when the user has this preference set.
- All content is readable and functional if JavaScript fails to load; GSAP/Lenis only enhance an already-usable page.
- Copy in the Results section is explicitly framed as illustrative client scenarios, not guarantees — see the disclaimer line under those cards.
