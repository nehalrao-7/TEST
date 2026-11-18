# Photoreal renders (Blender / Cycles)

1. Serve the app: `cd mannequin && python3 -m http.server 8765`
2. Export the current avatar and draped outfit: `node tools/blender/export_scene.js <scene_dir>`
   (uses Playwright; this writes scene.json plus textures)
3. Render: `python tools/blender/render.py <scene_dir> <out_dir> --sim --frames 60 --samples 64 --views front,three,close`
   (needs `pip install bpy`. `--sim` re-drapes the salwar with Blender cloth, using self-collision and a finer mesh.)
