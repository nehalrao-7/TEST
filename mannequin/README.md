# Fit Studio 3D

A small browser tool that builds a realistic 3D human from real body measurements, puts a patiala dress on it (kameez + patiala salwar), and exports a 1:1 sewing pattern.

## Run
Static files with no build step. Serve this folder and open it:

    cd mannequin && python3 -m http.server 8000   # → http://localhost:8000

(Three.js is vendored in `vendor/`, so it works offline.)

## Workflow
1. **Body**: click any measurement and it's highlighted on the mannequin, with instructions for taking it. Type exact values (cm) and the body updates live. Save/load profiles as JSON. The last profile is also remembered in the browser.
2. **Garment**: kameez (length, bust/waist/hip ease, flare, slit, necklines, sleeves) and salwar (waist, fullness, pleats, crotch drop, mohri, cuff height). The **Fit check** table shows the ease against the body and flags tight spots.
3. **Pattern**: drafted pieces (kameez front/back on fold, sleeve, salwar leg panel, kali, cuff), each with seam allowance. Export a true-scale SVG, print it to PDF, or download a JSON spec.

## Code
- `js/body.js`: measurement definitions, body landmarks and cross-sections, guides
- `js/garment.js`: garment parameters, 3D garment, fit report
- `js/pattern.js`: flat pattern drafting and SVG export
- `js/geometry.js`: ellipse/loft helpers

## Realistic body model
The body is the MakeHuman base mesh (CC0, ~19k vertices) with photographic skin, eyes, brows, lashes and hair.
On every change, a Levenberg–Marquardt solver blends 60+ MakeHuman morph targets until the mesh's own tape-line
measurements (MakeHuman's measurement rulers) match your inputs. Each field shows ✓ or the remaining difference.
Garments are built from cross-sections of the fitted body, so they follow its actual shape.

Assets are prebuilt in `assets/`. To rebuild them: `python3 tools/build_assets.py <makehuman/data> <assets-1.1/base> assets`
(see the header of that script for the sources).

## Studio features (CLO-style)
- **Cloth simulation**: position-based dynamics (stretch + bending constraints, long-range tethers, gravity,
  friction, continuous body collision via a spatial hash). Garments re-drape on every change; press
  **Simulate** or Space to run or pause, and **Re-drape** to start again from the pattern.
- **Fit map / Strain map**: heatmaps of ease to the skin (cm) and fabric stretch (%).
- **Fabric library**: cotton lawn, silk satin, georgette, chanderi, linen and velvet. Each has a woven normal map,
  sheen and roughness, and drape physics (bend stiffness, weight, friction).
- **Prints**: phulkari, paisley, bandhani, buti, block print, ikat and leheriya, plus a colourway and print size in cm.
  UVs are in real centimetres, so a 14 cm repeat is 14 cm on the garment and on the pattern.
- **2D window**: the live pattern, filled with the chosen fabric at true scale. Hover a piece to highlight it in 3D.
- **Rendering**: ambient occlusion (GTAO), soft shadows, a studio backdrop, a turntable, and a PNG render button.
