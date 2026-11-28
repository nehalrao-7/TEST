# Nehal Rao

An immersive scroll story about one object, told in seven screens, one idea each.

| # | Scene | What you see | Line |
|---|---|---|---|
| 00 | NEHAL RAO | A gloss porcelain object, name behind it | Beautiful things. Brilliantly made. |
| 01 | "LINE" | The object as a contour drawing that draws itself | It starts with a line. |
| 02 | "FORM" | Matte clay | Then, a form. |
| 03 | "FINISH" | Dark room; gloss, seam, orange button, tagged zip tie | Then it becomes beautiful. |
| 04 | PRODUCTION | Camera rises over ~1,600 copies; one is orange; counter to 10,000 | Then we make ten thousand. |
| 05 | BOLO | Client list: Microsoft, Amazon Prime at TIFF, TIFF, Billboard, Women in Music, Pizza Depot | Then the world opens it. |
| 06 | "RECORD" | Career as a tracklist | Ten years. One standard. |
| 07 | NEXT | The object turns orange | One more thing. I'm available. |

Voice: short, declarative, one idea per screen.
Design: off-white, black and one zip-tie orange, with condensed type (Archivo), mono labels in "quotation marks", diagonal stripes and a tag. These are inspired devices only, with no third-party marks.

A scroll guide on the right shows the scenes and jumps between them.

## Run locally
```bash
cd portfolio && python3 -m http.server 8000
```
No build step; deploy the `portfolio/` folder anywhere static.

## Files
- `index.html`: all words (edit copy here)
- `js/object.js`: the 3D object, its four materials, and the production field
- `js/story.js`: scroll → scene state, background colour, guide
- `css/studio.css`: type and layout
- `interview/`: the refinement interview

## ⚠️ Replace before publishing
- [ ] Email `hello@nehalrao.com` and résumé PDF at `assets/Nehal-Rao-Resume.pdf`
- [ ] VEX: the site says "Worlds, twice" (back-to-back World Championships). Confirm.
- [ ] Client names are text only; confirm you're comfortable listing them publicly.
- [ ] The object is a concept piece. If you have a real product you designed, it can replace it.
