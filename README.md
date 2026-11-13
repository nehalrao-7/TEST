# Muqabla Tournament

The Muqabla Tournament website. It opens in the locker room tunnel, and as you scroll you
walk out, the lights flare, and you land on a branded 3D arena floor.

Built with Next.js, React Three Fiber (three.js), drei and postprocessing.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Add `?quality=low` or `?quality=high` to the URL to force a render quality. By default,
phones, tablets and small screens get `low`: no reflections or bloom, lighter textures
and fewer seats.

## How it's put together

| Path | What it does |
| --- | --- |
| `lib/brand.ts` | **Brand config.** Name, colours, fonts, logo and sponsors. Edit this to re-skin everything. |
| `lib/textures.ts` | Paints every branded surface on a 2D canvas at runtime: court floor, LED ribbons, scoreboard, hallway walls, sponsor wall, jerseys. |
| `lib/court.ts` | NBA court dimensions, seating bowl layout and tunnel position. |
| `lib/scroll.ts` | Scroll progress store, the tunnel-crossing point and the light flicker. |
| `components/three/Scene.tsx` | Canvas, camera keyframes along the walk-out, bloom and tone mapping. |
| `components/three/Hallway.tsx` | Locker room tunnel: lockers, sponsor wall, light strips, COURT sign, glare at the mouth. |
| `components/three/Arena.tsx` | Court, hoops, seating bowl, LED ribbons, centre-hung scoreboard, scorer's table, lights. |
| `components/Loader.tsx` | Wordmark loader with the percentage counter. |
| `components/Overlay.tsx` | Scroll-synced headline copy, the white flash and the progress rail. |

## Swapping in real branding

1. Put the logo in `public/brand/` (transparent PNG or SVG; a light version reads best on
   the dark arena) and set `brand.logo` in `lib/brand.ts`. It replaces the placeholder
   "M" crest at centre court, in the keys, on the scoreboard and on the sponsor wall.
2. Set `brand.colors`. The primary colour paints the keys, stripes and LED accents.
3. For each sponsor, drop a logo in `public/sponsors/` and fill in `name` and `logo` in
   the `sponsors` list. Sponsors show up on the court near half court, the aprons, the LED
   ribbon boards, the scorer's table, the tunnel sponsor wall and the Partners section.
4. Update the matching CSS variables at the top of `app/globals.css`.
