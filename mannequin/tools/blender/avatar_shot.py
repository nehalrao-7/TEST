import bpy, math, sys
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=args[0])
sc = bpy.context.scene
body = [o for o in sc.objects if o.type == 'MESH' and 'manuellab_id' in o.keys()][0]
bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
zmin, zmax = min(v.z for v in bb), max(v.z for v in bb); H = zmax - zmin; cz = (zmin + zmax) / 2
print('height m', round(H, 3), 'zmin', round(zmin, 3))
for o in list(sc.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
def area(loc, e, size, col=(1, 1, 1)):
    bpy.ops.object.light_add(type='AREA', location=loc); L = bpy.context.object; L.data.energy = e; L.data.size = size; L.data.color = col
    L.rotation_euler = (Vector((0, 0, cz)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
area((-2.2, -3.0, cz + 1.4), 520, 2.4, (1, .95, .88)); area((2.8, -2.2, cz + 0.6), 140, 3); area((0.8, 2.5, cz + 1.8), 300, 1.5)
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (.35, .3, .26, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
sc.render.engine = 'CYCLES'; sc.cycles.samples = int(args[2]) if len(args) > 2 else 48; sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = -0.2
sc.render.resolution_x = 900; sc.render.resolution_y = 1350
def shot(name, loc, target, lens):
    bpy.ops.object.camera_add(location=loc); c = bpy.context.object; c.data.lens = lens
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.camera = c
    sc.render.filepath = args[1] + '_' + name + '.png'; bpy.ops.render.render(write_still=True)
if 'face' not in args: shot('full', (1.2, -5.5, cz + 0.1), (0, 0, cz), 70)
shot('face', (0.25, -1.4, zmax - 0.12), (0, 0, zmax - 0.13), 85)
