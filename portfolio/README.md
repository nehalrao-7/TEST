# Nehal Rao — Exploded View

A scroll-driven portfolio built around one machine: an **electric drive unit** (motor, 9:1 planetary gearbox, cast housing, inverter) generated entirely in code and rendered live in the browser, in the style of an automotive exploded-view launch film.

Each chapter takes one subsystem apart and pairs it with a part of Nehal's career:

| # | Chapter | What comes apart | Career |
|---|---|---|---|
| 00 | Intro | Assembled, studio-lit | Engineer · industrial designer · creative technologist |
| 01 | Form | Cast housing: fins, flanges, ports, nameplate | Industrial design — Elevety |
| 02 | Motion | Gearbox: sun, 3 planets, 96-tooth ring gear (they really mesh) | Robotics — VEX Team 356, Solus Robots |
| 03 | Core | Stator laminations, hairpin copper windings, magnet rotor, shaft | Production engineering — Weston Foods |
| 04 | Electronics | Inverter: power stage, DC-link capacitor, controller, HV harness | Hardware + software — iBoost, HackPrinceton |
| 05 | System | Everything exploded, live part count | Systems & creative technology |
| 06 | Next | Reassembled, contact | Now: BOLO, Toronto |

A **scroll guide** on the right shows progress and jumps to any chapter. Callouts carry engineering specs; parts outside each chapter's focus turn to see-through ghosts with edge lines.

## Run locally

```bash
cd portfolio && python3 -m http.server 8000
# open http://localhost:8000
```

No build step. Deploys as-is to Vercel, Netlify, GitHub Pages or Cloudflare Pages (root: `portfolio/`).

## Files
- `index.html`: all chapter copy (edit the words here)
- `js/machine.js`: the procedural machine: geometry, materials, lighting, explode/ghost system
- `js/journey.js`: scroll → machine state per chapter, camera keyframes, callouts, scroll guide
- `css/journey.css`: layout and type
- `interview/`: the refinement interview (published separately)

## Stack
Three.js 0.160 (physical materials, environment reflections, soft shadows, bloom), Lenis smooth scroll, and Inter Tight, Instrument Serif and JetBrains Mono. It scales quality down automatically on slower machines and respects `prefers-reduced-motion`.

## ⚠️ Replace before publishing
Facts from public sources and the résumé: Ryerson B.Eng, Elevety, Weston Foods, iBoost, Solus Robots, VEX Team 356 (2014 Ontario provincial winning alliance), HackPrinceton Best Overall Hack, BOLO in Toronto, SolidWorks, CATIA, CNC and body engineering.

Still to confirm or replace (the interview covers all of these):
- [ ] **Email** `hello@nehalrao.com` and **résumé PDF** at `assets/Nehal-Rao-Resume.pdf`
- [ ] **BOLO role** (chapter 06)
- [ ] **Chapter specifics**: what you actually did at Elevety, Weston Foods and HackPrinceton, plus the skill chips per chapter
- [ ] **Skills list**: keep only what's true (Python, embedded, GLSL etc.)
- [ ] The machine is an illustrative design, not a real product. Keep that framing.
