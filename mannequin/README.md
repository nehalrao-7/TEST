# Mannequin Fit Studio

A small browser tool that builds a 3D mannequin from real body measurements, puts a patiala dress on it (kameez + patiala salwar), and exports a 1:1 sewing pattern.

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
