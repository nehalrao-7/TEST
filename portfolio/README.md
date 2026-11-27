# Nehal Rao — Portfolio

A single-page portfolio built around one idea from Nehal's own LinkedIn headline: **connecting the dots**.
A Three.js field of ~4,000 connected particles reshapes as you scroll through the story:

| Section | Shape | Meaning |
|---|---|---|
| Hero | Networked sphere | Everything connected |
| The premise | Spiral galaxy | Collecting dots on purpose |
| The dots (timeline) | Double helix | The career as a strand of lessons |
| Selected work | Torus knot | Engineering complexity, made elegant |
| Toolkit / Voices | Lattice | Structure, systems, process |
| Contact | Ring | The loop closes: you're the next dot |

## Run locally

No build step. Serve the folder with any static server:

```bash
cd portfolio && python3 -m http.server 8000
# open http://localhost:8000
```

Deploys as-is to Vercel, Netlify, GitHub Pages or Cloudflare Pages (set the root to `portfolio/`).

## Stack
- Three.js 0.160 (custom GLSL shaders; all morphing happens on the GPU)
- GSAP 3.12 + ScrollTrigger (scroll choreography, pinned horizontal timeline, stacked case studies)
- Lenis (smooth scroll)
- Instrument Serif, Inter Tight and JetBrains Mono from Google Fonts

Respects `prefers-reduced-motion`, works without WebGL, and is responsive down to 360px.

## ⚠️ Replace before publishing
Facts from public sources and the résumé: Ryerson B.Eng, Elevety, Weston Foods, iBoost, Solus Robots,
VEX Team 356 (2014 Ontario provincial winning alliance), HackPrinceton Best Overall Hack, BOLO in Toronto,
and skills (SolidWorks, CATIA, CNC, body engineering, CSS).

**Everything below is invented to set the tone and must be checked or replaced:**

- [ ] **Email**: `hello@nehalrao.com` (in `index.html`, 3 places)
- [ ] **Résumé PDF**: add `assets/Nehal-Rao-Resume.pdf`
- [ ] **BOLO**: current title and description (timeline card "Now" and case study 04, all marked `[Replace]`)
- [ ] **Case study names and metrics**: "Project Lumen" (−38% parts, −52% assembly, 9 months),
      "Line 4" (−22% downtime, $180K, 3 lines), "Wayfinder" (the HackPrinceton project itself), and the year on each
- [ ] **Testimonials**: all three quotes are placeholders. Use only real quotes, with permission.
- [ ] **Numbers strip**: "10+ years", "7 dots"
- [ ] **Timeline details**: specific responsibilities at Solus Robots, iBoost, Elevety and Weston Foods
- [ ] **Toolkit**: Three.js, Figma, Growth, User Research and the other soft skills (keep only what's true)
