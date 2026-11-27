# Nehal Rao — Portfolio

A single-page portfolio built around one idea from Nehal's own LinkedIn headline: **connecting the dots**.
A Three.js field of ~4,000 connected particles reshapes as you scroll through the story:

The site is built to show **how Nehal thinks and works**, not to re-list the résumé:

| Section | What it does |
|---|---|
| Hero | Particle network; lines reach from the cursor to the nearest dots |
| How I think | Pinned scroll: a procedural product (Lumen) goes sketch → blueprint → exploded view → finished solid |
| Working style | Three playable habits: connect-the-dots (vision), tolerance slider (precision), prototype→final wipe (iteration) |
| The dots | Horizontal timeline over a particle helix, with lessons as the headlines |
| Work, unfolded | Project list → drawer with sketch / model / prototype / shipped frames and question / approach / lesson |
| Spec mode (press **S**) | The page shows its own working drawings: grid, type specs, design notes, live render stats |

## Files
- `js/scene.js`: background particle field (GLSL morphing across six shapes) and cursor links
- `js/product.js`: the procedural exploded-view object
- `js/toys.js`: the three habit toys
- `js/work.js`: project data, list, preview and drawer (**edit project stories here**)
- `js/art.js`: tiny drawing engine (hand-drawn and clean renderers) for toys and project frames
- `js/main.js`: scroll choreography, spec mode, cursor

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

**Invented to set the tone. Check or replace:**
- [ ] **Email** `hello@nehalrao.com` (index.html) and **résumé PDF** at `assets/Nehal-Rao-Resume.pdf`
- [ ] **Project stories** in `js/work.js`: Lumen, Line 4 and Wayfinder details, plus the BOLO entry (marked `[Replace]`)
- [ ] **Process frames** are generated illustrations. Swap in real sketches, CAD and photos where possible.
- [ ] **Lumen** (the exploded object) is an illustrative concept. Rename it, or tie it to a real project.
- [ ] **Timeline one-liners** for each role
- [ ] **Toolkit**: keep only what's true (Three.js, GLSL, Figma etc.)
