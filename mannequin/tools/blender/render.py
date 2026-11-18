"""Offline photoreal renderer for Fit Studio scenes (Blender / Cycles).

Usage: python render.py <scene_dir> <out_dir> [--sim] [--samples N] [--views front,three,close]
<scene_dir> holds scene.json + textures exported by the web app (window.__studio.exportScene()).
"""
import bpy, bmesh, json, math, os, sys, time
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SCENE_DIR, OUT_DIR = args[0], args[1]
SIM = '--sim' in args
SAMPLES = int(args[args.index('--samples') + 1]) if '--samples' in args else 96
VIEWS = (args[args.index('--views') + 1] if '--views' in args else 'front,three,close').split(',')
SUBDIV = int(args[args.index('--subdiv') + 1]) if '--subdiv' in args else 1
SIM_FRAMES = int(args[args.index('--frames') + 1]) if '--frames' in args else 40
os.makedirs(OUT_DIR, exist_ok=True)
S = json.load(open(os.path.join(SCENE_DIR, 'scene.json')))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def P(x, y, z):  # three.js cm, Y-up  ->  Blender metres, Z-up
    return (x * 0.01, -z * 0.01, y * 0.01)

def hex_rgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1.0]

def build_mesh(name, g, materials, smooth=True):
    pos, idx, uv = g['pos'], g['index'], g.get('uv')
    verts = [P(pos[i], pos[i + 1], pos[i + 2]) for i in range(0, len(pos), 3)]
    faces = [(idx[i], idx[i + 1], idx[i + 2]) for i in range(0, len(idx), 3)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if uv:
        layer = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                layer.data[li].uv = (uv[vi * 2], uv[vi * 2 + 1])
    for m in materials: me.materials.append(m)
    groups = g.get('groups') or []
    if groups:
        mi = [0] * len(faces)
        for gr in groups:
            for f in range(gr['start'] // 3, (gr['start'] + gr['count']) // 3): mi[f] = gr['mat']
        me.polygons.foreach_set('material_index', mi)
    if smooth: me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob

def img(name, colorspace='sRGB'):
    if not name: return None
    im = bpy.data.images.load(os.path.join(SCENE_DIR, name), check_existing=True)
    im.colorspace_settings.name = colorspace
    return im

def principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    return m, nt, nt.nodes['Principled BSDF']

def tex_node(nt, image, rep=None, extension='REPEAT'):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = image; t.extension = extension; t.interpolation = 'Cubic'
    if rep:
        uvn = nt.nodes.new('ShaderNodeUVMap'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (rep[0], rep[1], 1)
        if len(rep) > 2: mp.inputs['Location'].default_value = (rep[2], rep[3], 0)
        nt.links.new(uvn.outputs['UV'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    return t

# ---------------- materials ----------------
def skin_material():
    m, nt, bs = principled('Skin')
    t = tex_node(nt, img(S['skinTexture']))
    # even out the stock texture toward a chosen warm tone, keeping ~15% of its detail
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(t.outputs['Color'], bw.inputs['Color'])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY_ADD'; mul.inputs[1].default_value = 0.6; mul.inputs[2].default_value = 0.55
    nt.links.new(bw.outputs['Val'], mul.inputs[0])
    tone = nt.nodes.new('ShaderNodeMix'); tone.data_type = 'RGBA'; tone.blend_type = 'MULTIPLY'; tone.inputs['Factor'].default_value = 1
    tone.inputs['A'].default_value = hex_rgb(S['skinTone'])
    cmb = nt.nodes.new('ShaderNodeCombineColor')
    for k in ('Red', 'Green', 'Blue'): nt.links.new(mul.outputs[0], cmb.inputs[k])
    nt.links.new(cmb.outputs['Color'], tone.inputs['B'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['Factor'].default_value = 0.85
    nt.links.new(t.outputs['Color'], mix.inputs['A']); nt.links.new(tone.outputs['Result'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.48
    bs.inputs['Subsurface Weight'].default_value = 0.35
    bs.inputs['Subsurface Radius'].default_value = (1.0, 0.45, 0.25)
    bs.inputs['Subsurface Scale'].default_value = 0.006
    bs.inputs['Specular IOR Level'].default_value = 0.4
    bs.inputs['Coat Weight'].default_value = 0.04
    return m

def fabric_material(name, spec, extension='REPEAT', normal_strength=0.35, metallic=None):
    m, nt, bs = principled(name)
    if spec.get('map'):
        t = tex_node(nt, img(spec['map']), spec.get('mapRepeat'), extension)
        nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
    else:
        bs.inputs['Base Color'].default_value = hex_rgb(spec.get('color', '#888888'))
    if spec.get('normal'):
        rep = spec.get('normalRepeat') or [1, 1]
        tn = tex_node(nt, img(spec['normal'], 'Non-Color'), [rep[0], rep[1]])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal_strength
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = max(0.3, spec.get('roughness', 0.6))
    bs.inputs['Metallic'].default_value = metallic if metallic is not None else spec.get('metalness', 0) or 0
    bs.inputs['Sheen Weight'].default_value = min(1, (spec.get('sheen') or 0) * 0.9)
    bs.inputs['Sheen Roughness'].default_value = 0.35
    bs.inputs['Specular IOR Level'].default_value = 0.45
    m.use_backface_culling = False
    return m

def alpha_material(name, image_name, tint=None, roughness=0.5, eye=False):
    m, nt, bs = principled(name)
    t = tex_node(nt, img(image_name))
    if tint:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
        nt.links.new(t.outputs['Color'], mix.inputs['A']); mix.inputs['B'].default_value = hex_rgb(tint)
        nt.links.new(mix.outputs['Result'], bs.inputs['Base Color'])
    else:
        nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(t.outputs['Alpha'], bs.inputs['Alpha'])
    bs.inputs['Roughness'].default_value = roughness
    if eye: bs.inputs['Coat Weight'].default_value = 1.0; bs.inputs['Coat Roughness'].default_value = 0.02
    return m

skin = skin_material()
M = S['materials']
mk = fabric_material('Kameez', M['kameez'])
mborder = fabric_material('Border', M['border'] or M['kameez'], extension='EXTEND', normal_strength=0.25)
mtrim = fabric_material('Zari', M['trim'], metallic=0.8)
msal = fabric_material('Salwar', M['salwar'])
mcuff = fabric_material('Cuff', M['cuff'])

# ---------------- avatar ----------------
body = build_mesh('Body', S['body'], [skin])
sub = body.modifiers.new('Smooth', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
for pr in S['proxies']:
    kind = pr['kind']
    if kind == 'eyes': mat = alpha_material('Eyes', pr['texture'], roughness=0.1, eye=True)
    elif kind == 'hair': mat = alpha_material('Hair', pr['texture'], tint=pr.get('color'), roughness=0.38)
    else: mat = alpha_material(kind, pr['texture'], tint=pr.get('color'), roughness=0.8)
    ob = build_mesh(kind, pr, [mat])
    if kind in ('eyes',): ob.modifiers.new('Smooth', 'SUBSURF').render_levels = 1

# ---------------- garments ----------------
garments = []
for i, g in enumerate(S['garments']):
    if g['part'] == 'kameez': mats = [mk, mborder, mtrim] if g.get('sewn') else [mk, mtrim]
    elif g['part'] == 'salwar': mats = [msal, mcuff]
    else: continue
    ob = build_mesh(f"{g['part']}_{i}", g, mats)
    ob['pin'] = g['pin']; ob['part'] = g['part']; ob['half'] = g.get('half', 0)
    garments.append(ob)

def weld(ob, dist=0.0004):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(ob.data); bm.free()

for ob in garments:
    weld(ob, 0.005 if ob['part'] == 'kameez' else 0.0004)  # close sewn seams

# ---------------- optional Blender cloth refinement ----------------
if SIM:
    t0 = time.time()
    coll = body.modifiers.new('Collision', 'COLLISION')
    body.collision.thickness_outer = 0.004; body.collision.cloth_friction = 6
    for ob in garments:
        if ob['part'] == 'kameez':
            c2 = ob.modifiers.new('Collision', 'COLLISION'); ob.collision.thickness_outer = 0.003
    for ob in [g for g in garments if g['part'] != 'kameez']:
        bpy.context.view_layer.objects.active = ob
        # subdivide for finer folds, keep pin weights
        pin = ob['pin']; vg = ob.vertex_groups.new(name='pin')
        idxs = [v for v in range(len(ob.data.vertices)) if v < len(pin) and pin[v]]
        if idxs: vg.add(idxs, 1.0, 'REPLACE')
        s2 = ob.modifiers.new('Sub', 'SUBSURF'); s2.levels = SUBDIV; s2.render_levels = SUBDIV; s2.subdivision_type = 'SIMPLE'
        cl = ob.modifiers.new('Cloth', 'CLOTH')
        st = cl.settings
        st.quality = 6; st.mass = 0.12 if ob['part'] == 'kameez' else 0.15
        st.tension_stiffness = 40; st.compression_stiffness = 40; st.shear_stiffness = 20; st.bending_stiffness = 0.3
        st.air_damping = 1.5
        if idxs: st.vertex_group_mass = 'pin'
        cs = cl.collision_settings
        cs.use_self_collision = True; cs.self_distance_min = 0.003; cs.distance_min = 0.004; cs.collision_quality = 3
        cl.point_cache.frame_start = 1; cl.point_cache.frame_end = SIM_FRAMES
    scene.frame_start = 1; scene.frame_end = SIM_FRAMES
    for f in range(1, SIM_FRAMES + 1):
        scene.frame_set(f)
        if f % 10 == 0: print(f'cloth frame {f}/{SIM_FRAMES} {time.time() - t0:.0f}s', flush=True)
    print(f'cloth sim {time.time() - t0:.0f}s', flush=True)

for ob in garments:
    so = ob.modifiers.new('Thickness', 'SOLIDIFY'); so.thickness = 0.0012; so.offset = 1
    simmed = SIM and ob['part'] != 'kameez'
    sd = ob.modifiers.new('Smooth', 'SUBSURF'); sd.levels = 0 if simmed else 1; sd.render_levels = 1 if simmed else 2

# ---------------- studio ----------------
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
floor = bpy.context.object; fm, nt, bs = principled('Floor'); bs.inputs['Base Color'].default_value = (0.30, 0.24, 0.19, 1); bs.inputs['Roughness'].default_value = 0.6
floor.data.materials.append(fm)
# curved backdrop (cyclorama)
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=6, depth=12, location=(0, 6, 0), rotation=(0, math.pi / 2, 0))
cyc = bpy.context.object; cm, nt, bs = principled('Backdrop'); bs.inputs['Base Color'].default_value = (0.36, 0.30, 0.24, 1); bs.inputs['Roughness'].default_value = 0.9
cyc.data.materials.append(cm)

world = bpy.data.worlds.new('World'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.5, 0.52, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25

def area(name, loc, energy, size, color=(1, 1, 1)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    L = bpy.context.object; L.name = name; L.data.energy = energy; L.data.size = size; L.data.color = color
    d = Vector((0, 0, 0.95)) - Vector(loc); L.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return L
area('Key', (-2.2, -3.0, 3.0), 520, 2.4, (1.0, 0.95, 0.88))
area('Fill', (2.8, -2.2, 1.6), 140, 3.0, (0.92, 0.95, 1.0))
area('Rim', (0.8, 2.5, 2.8), 300, 1.5)

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8; scene.cycles.transparent_max_bounces = 16
scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'; scene.view_settings.exposure = -0.35
scene.render.resolution_x = 1080; scene.render.resolution_y = 1620

def shoot(name, cam_loc, target, lens=85):
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object; cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT_DIR, name + '.png')
    t = time.time(); bpy.ops.render.render(write_still=True)
    print(f'rendered {name} in {time.time() - t:.0f}s', flush=True)

if '--norender' in args: sys.exit(0)
H = S['body_measurements']['height'] * 0.01
if 'front' in VIEWS: shoot('front', (0, -6.2, H * 0.55), (0, 0, H * 0.5))
if 'three' in VIEWS: shoot('three', (3.6, -5.0, H * 0.58), (0, 0, H * 0.5))
if 'close' in VIEWS: shoot('close', (0.9, -2.6, H * 0.8), (0, 0, H * 0.72), lens=85)
