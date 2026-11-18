"""Studio render of a dressed avatar (output of dress.py).

Usage: python studio.py -- <dressed.blend> <textures_dir> <out_prefix> [--samples 96] [--views front,three,close] [--res 1080]
<textures_dir>: scene export from the web app (tex_kameez.png, tex_border.png, ... + scene.json with the repeats).
"""
import bpy, json, math, os, sys, time
from mathutils import Vector

A = sys.argv[sys.argv.index('--') + 1:]
BLEND, TEX, OUT = A[0], A[1], A[2]
def opt(n, d): return type(d)(A[A.index(n) + 1]) if n in A else d
SAMPLES = opt('--samples', 96); VIEWS = opt('--views', 'front,three,close').split(','); RES = opt('--res', 1080)
TONE = opt('--tone', '#d4a083')
bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
body = [o for o in sc.objects if o.type == 'MESH' and 'manuellab_id' in o.keys()][0]
SPEC = json.load(open(os.path.join(TEX, 'scene.json')))['materials']
MB = '/tmp/claude-0/mblab/data/textures/'

def rgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1]
def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links.new, m.node_tree.nodes['Principled BSDF']
def img(path, cs='sRGB'):
    i = bpy.data.images.load(path, check_existing=True); i.colorspace_settings.name = cs; return i
def tex(N, Lk, image, scale=None, loc=None, ext='REPEAT'):
    t = N.new('ShaderNodeTexImage'); t.image = image; t.extension = ext; t.interpolation = 'Cubic'
    if scale:
        uv = N.new('ShaderNodeUVMap'); mp = N.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (scale[0], scale[1], 1)
        if loc: mp.inputs['Location'].default_value = (loc[0], loc[1], 0)
        Lk(uv.outputs['UV'], mp.inputs['Vector']); Lk(mp.outputs['Vector'], t.inputs['Vector'])
    return t

# ---------------- skin (MB-Lab maps, Blender 5 principled) ----------------
def skin_material():
    m, N, Lk, bs = new_mat('Skin_Studio')
    alb = tex(N, Lk, img(MB + 'hum_f_asian_albedo.png')); lip = tex(N, Lk, img(MB + 'human_female_lipmap.png', 'Non-Color'))
    oil = tex(N, Lk, img(MB + 'human_female_sebum.png', 'Non-Color')); bmp = tex(N, Lk, img(MB + 'human_female_bump.png', 'Non-Color'))
    hsv = N.new('ShaderNodeSeparateColor'); hsv.mode = 'HSV'; Lk(alb.outputs['Color'], hsv.inputs['Color'])
    val = N.new('ShaderNodeMath'); val.operation = 'MULTIPLY_ADD'; val.inputs[1].default_value = 0.9; val.inputs[2].default_value = 0.3
    Lk(hsv.outputs['Blue'], val.inputs[0])
    cmb = N.new('ShaderNodeCombineColor')
    for k in ('Red', 'Green', 'Blue'): Lk(val.outputs[0], cmb.inputs[k])
    tone = N.new('ShaderNodeMix'); tone.data_type = 'RGBA'; tone.blend_type = 'MULTIPLY'; tone.inputs['Factor'].default_value = 1
    tone.inputs['B'].default_value = rgb(TONE); Lk(cmb.outputs['Color'], tone.inputs['A'])
    keep = N.new('ShaderNodeMix'); keep.data_type = 'RGBA'; keep.inputs['Factor'].default_value = 0.5
    Lk(alb.outputs['Color'], keep.inputs['A']); Lk(tone.outputs['Result'], keep.inputs['B'])
    lips = N.new('ShaderNodeMix'); lips.data_type = 'RGBA'; lips.blend_type = 'MULTIPLY'
    lf = N.new('ShaderNodeMath'); lf.operation = 'MULTIPLY'; lf.inputs[1].default_value = 0.7; Lk(lip.outputs['Color'], lf.inputs[0])
    Lk(lf.outputs[0], lips.inputs['Factor']); Lk(keep.outputs['Result'], lips.inputs['A']); lips.inputs['B'].default_value = rgb('#a8323e')
    Lk(lips.outputs['Result'], bs.inputs['Base Color'])
    r = N.new('ShaderNodeMath'); r.operation = 'MULTIPLY_ADD'; r.inputs[1].default_value = -0.12; r.inputs[2].default_value = 0.6
    Lk(oil.outputs['Color'], r.inputs[0]); Lk(r.outputs[0], bs.inputs['Roughness'])
    bu = N.new('ShaderNodeBump'); bu.inputs['Strength'].default_value = 0.12; bu.inputs['Distance'].default_value = 0.001
    Lk(bmp.outputs['Color'], bu.inputs['Height']); Lk(bu.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Subsurface Weight'].default_value = 0.22; bs.inputs['Subsurface Radius'].default_value = (1.0, 0.42, 0.22)
    bs.inputs['Subsurface Scale'].default_value = 0.005; bs.inputs['Specular IOR Level'].default_value = 0.32
    return m
skin = skin_material()
for i, m in enumerate(body.data.materials):
    if m and m.name.startswith(('MBLab_skin', 'MBlab_generic', 'Skin_Studio')): body.data.materials[i] = skin
TEXD = '/tmp/claude-0/mblab/data/textures/'
for im in bpy.data.images:
    b = os.path.basename(im.filepath or im.name)
    if os.path.exists(TEXD + b): im.filepath = TEXD + b

# ---------------- fabrics ----------------
def fabric(name, spec, ext='REPEAT', normal=0.3, metal=None, rough=None, sheen=None):
    m, N, Lk, bs = new_mat('F_' + name)
    rep = spec['mapRepeat']
    t = tex(N, Lk, img(os.path.join(TEX, spec['map'])), (rep[0] * 100, rep[1] * 100), (rep[2], rep[3]), ext)
    Lk(t.outputs['Color'], bs.inputs['Base Color'])
    if spec.get('normal'):
        nr = spec['normalRepeat']
        tn = tex(N, Lk, img(os.path.join(TEX, spec['normal']), 'Non-Color'), (nr[0] * 100, nr[1] * 100))
        nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal
        Lk(tn.outputs['Color'], nm.inputs['Color']); Lk(nm.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = rough if rough is not None else max(0.35, spec['roughness'])
    bs.inputs['Metallic'].default_value = metal if metal is not None else spec.get('metalness', 0)
    bs.inputs['Sheen Weight'].default_value = sheen if sheen is not None else min(1, spec.get('sheen', 0) * 1.2)
    bs.inputs['Sheen Roughness'].default_value = 0.3
    bs.inputs['Specular IOR Level'].default_value = 0.5
    return m
F = {'Kameez': fabric('kameez', SPEC['kameez'], rough=0.38),
     'Border': fabric('border', SPEC['border'], ext='EXTEND', rough=0.45, metal=0.15),
     'Zari': fabric('zari', SPEC['trim'], metal=0.8, rough=0.3, sheen=0),
     'Salwar': fabric('salwar', SPEC['salwar'], rough=0.38)}
for o in sc.objects:
    if o.type != 'MESH' or o is body: continue
    for i, m in enumerate(o.data.materials):
        if m and m.name in F: o.data.materials[i] = F[m.name]
    if o.name.startswith(('Kameez', 'Salwar_')):
        so = o.modifiers.new('Thick', 'SOLIDIFY'); so.thickness = 0.0015; so.offset = 1
        sd = o.modifiers.new('Smooth', 'SUBSURF'); sd.levels = 0; sd.render_levels = 2
        for p in o.data.polygons: p.use_smooth = True
    for md in o.modifiers:
        if md.type in ('CLOTH', 'COLLISION'): o.modifiers.remove(md)

# ---------------- studio ----------------
for o in list(sc.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
def plane_mat(name, col, rough):
    m, N, Lk, bs = new_mat(name); bs.inputs['Base Color'].default_value = col; bs.inputs['Roughness'].default_value = rough; return m
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); bpy.context.object.data.materials.append(plane_mat('Floor', (0.28, 0.22, 0.17, 1), 0.55))
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=7, depth=14, location=(0, 7, 0), rotation=(0, math.pi / 2, 0))
bpy.context.object.data.materials.append(plane_mat('Backdrop', (0.42, 0.35, 0.28, 1), 0.9))
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.5, 0.45, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.3
bb = [body.matrix_world @ Vector(c) for c in body.bound_box]; top = max(v.z for v in bb); cz = top * 0.5
def area(loc, e, size, col=(1, 1, 1)):
    ld = bpy.data.lights.new('L', 'AREA'); ld.energy = e; ld.size = size; ld.color = col
    lo = bpy.data.objects.new('L', ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (Vector((0, 0, cz + 0.2)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
area((-2.4, -3.2, 3.0), 650, 2.6, (1, 0.95, 0.88)); area((3.0, -2.4, 1.6), 180, 3.2, (0.92, 0.95, 1)); area((1.0, 3.0, 3.0), 380, 1.6)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'; sc.view_settings.exposure = 0.0
sc.render.resolution_x = RES; sc.render.resolution_y = int(RES * 1.5)
def shot(name, loc, target, lens):
    cd = bpy.data.cameras.new(name); cd.lens = lens; c = bpy.data.objects.new(name, cd); sc.collection.objects.link(c)
    c.location = loc; c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.camera = c
    sc.render.filepath = f'{OUT}_{name}.png'; t = time.time(); bpy.ops.render.render(write_still=True)
    print(f'rendered {name} {time.time() - t:.0f}s', flush=True)
if 'front' in VIEWS: shot('front', (0, -6.0, cz + 0.05), (0, 0, cz), 70)
if 'three' in VIEWS: shot('three', (3.2, -5.0, cz + 0.15), (0, 0, cz), 70)
if 'close' in VIEWS: shot('close', (0.6, -2.3, top - 0.32), (0, 0, top - 0.42), 70)
