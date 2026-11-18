# Blender pipeline (work in progress)

Avatar: MB-Lab (open-source Blender character generator; its data is AGPL-3). Garments: built from the web app's pattern.

1. Avatar fitted to measurements: `python avatar_fit.py -- body.json avatar.blend f_as01`
   (MB-Lab statistical fitting plus refinement; girths come out within about 0.5 cm)
2. Dress and simulate: `python dress.py -- avatar.blend pattern.json dressed.blend --frames 45 --relax 30 --pose standing04`
   (kameez sewn from its pattern pieces in the A-pose; patiala legs gathered into the band and cuff; skinned to the pose; then relaxed)
3. Studio render: `python studio.py -- dressed.blend <web texture export> out --samples 96`

Older path: `export_scene.js` + `render.py` (renders the web app's MakeHuman avatar).
MB-Lab is loaded from /tmp/claude-0/mblab (git clone https://github.com/animate1978/MB-Lab).
