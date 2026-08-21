# SS Accounting — One-Page Website

Single-page marketing site for SS Accounting, built as a static HTML file (`index.html`) with Tailwind CDN, vanilla JS, and GSAP/Lenis for motion. No build step required — open `index.html` in a browser or deploy the folder as-is.

## Files

- `index.html` — the complete site
- `robots.txt` — search engine crawl rules
- `sitemap.xml` — sitemap for search engines
- `README.md` — this file

## Placeholders to replace before launch

All placeholder values below appear as exact strings in `index.html` (and some in `robots.txt` / `sitemap.xml`). Use find-and-replace across the file(s).

| Placeholder | Where it appears | Replace with |
|---|---|---|
| `(000) 000-0000` | Header CTA area, hero secondary CTA, contact section, sticky mobile CTA bar, footer | Real business phone number, formatted for display |
| `+10000000000` | `tel:` links (hero CTA, contact section, sticky mobile CTA bar, footer) | Real phone number in E.164 format (e.g. `+19055551234`) |
| `info@example.com` | Contact section, footer | Real business email address |
| `mailto:info@example.com` | `mailto:` links (contact section, footer) | Real email address |
| `123 Placeholder Street, Suite 000, Markham, ON L0L 0L0` | Contact section, footer, JSON-LD `AccountingService` schema (`<head>`) | Real business street address |
| `Mon to Fri, 9:00 AM to 6:00 PM` | Contact section, footer | Real business hours |
| `Mo-Fr 09:00-18:00` | JSON-LD `AccountingService` schema `openingHours` (`<head>`) | Real hours in schema.org format |
| `https://www.example.com/` | `<link rel="canonical">`, Open Graph `og:url`, `sitemap.xml` `<loc>`, `robots.txt` sitemap line | Real production domain |
| `https://www.example.com/og-image.jpg` | Open Graph `og:image`, Twitter Card `twitter:image` (`<head>`) | Real social share image URL (1200×630px recommended) |

## Other integration points

- **Contact form backend**: `index.html`, `<form id="contact-form" action="#" ...>` — the form currently has no live submit endpoint. Replace `action="#"` with your backend URL or a Formspree endpoint (see the HTML comment directly above the form and inside the JS `initForm()` function for exact placement).
- **Google Map embed**: `index.html`, contact section — a bordered placeholder `<div>` labeled "Google Map Embed" stands in for the map. Replace it with a real `<iframe src="https://www.google.com/maps/embed?pb=...">` from the Google Maps Embed API. See the HTML comment directly above the placeholder div.
- **Open Graph / Twitter image**: no image file is included. Add a real image asset and update the two `og:image` / `twitter:image` meta tags to point to it.

## Notes

- Respects `prefers-reduced-motion: reduce` — all scroll/parallax animation and Lenis smooth scroll are disabled and content renders in its final state when the user has this preference set.
- All content is readable and functional if JavaScript fails to load; GSAP/Lenis only enhance an already-usable page.
- Copy in the Results section is explicitly framed as illustrative client scenarios, not guarantees — see the disclaimer line under those cards.
