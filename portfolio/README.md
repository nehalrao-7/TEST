# Nehal Rao — Portfolio

A single-page portfolio built around one idea from Nehal's own LinkedIn headline: **connecting the dots**.
A Three.js field of ~4,000 connected particles reshapes as you scroll through the story:

## Nehal's World

The portfolio is an **explorable 3D world** instead of a scrolling page. One screen says what it is and asks what the visitor is looking for. Then they wander.

- **Lenses** (Industrial design, Engineering, Creative tech, Product) light up a route through the most relevant places.
- **Eight islands**, each a facet of the work, with a panel holding the story and something to play with:

| Place | About | Interactive |
|---|---|---|
| The Dot | Who Nehal is, the career timeline | Clickable career dots |
| The Workshop | Industrial design (Elevety) | Lumen: sketch → blueprint → exploded → solid |
| The Line | Production engineering (Weston Foods) | Tolerance / fit toy |
| The Arena | Robotics (VEX, Solus Robots) | Gear-ratio toy |
| The Hack Lab | iBoost, HackPrinceton | Process frames + prototype→final wipe |
| The Studio | Creative technology, this world | Regrow the world from a new seed, blueprint render, live stats |
| The Observatory | How Nehal thinks | Connect-the-dots |
| The Lighthouse | Now (BOLO) and contact | Copy email, LinkedIn, résumé |

- **Ask anything** (`/`): a question box that answers from a local knowledge base (`js/places.js`) and flies you to the right place.
- **Six hidden field notes** float between islands. A counter tracks places explored and notes found.
- **Index**: the whole world as plain text, for hurried readers (and the fallback without WebGL).
- Keys: `/` ask · `H` home · `I` index · `[` `]` previous/next place · `Esc` close.

## Files
- `js/places.js`: **all content**: places, lenses, timeline, notes, ask knowledge base (edit here)
- `js/world.js`: the procedural world (seeded islands, landmarks, paths, notes, camera)
- `js/app.js`: UI: intro, lenses/routes, panels, ask, notes, index, keyboard
- `js/product.js`: the Lumen exploded-view object
- `js/toys.js`: tolerance, gears, connect-the-dots, wipe
- `js/art.js`: hand-drawn/clean drawing engine for toys and frames
- `css/world.css`: all styles

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
- [ ] **Email** `hello@nehalrao.com` (`EMAIL` in js/app.js) and **résumé PDF** at `assets/Nehal-Rao-Resume.pdf`
- [ ] **Place copy** in `js/places.js`: Lumen, Line 4 and Wayfinder specifics, plus the BOLO role at the Lighthouse
- [ ] **Field notes** and **ask answers** in `js/places.js`. Make sure they sound like you.
- [ ] **Process frames** are generated illustrations. Swap in real sketches, CAD and photos where possible.
- [ ] **Lumen** (the exploded object) is an illustrative concept. Rename it, or tie it to a real project.
- [ ] **Timeline one-liners** (`DOTS` in js/places.js)
- [ ] **Toolkit**: keep only what's true (Three.js, GLSL, Figma etc.)
