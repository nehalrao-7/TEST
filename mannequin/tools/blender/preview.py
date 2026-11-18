import bpy, math, sys
args = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=args[0])
sc = bpy.context.scene
cols = {'Kameez': (0.55, 0.05, 0.08), 'Border': (0.8, 0.6, 0.2), 'Zari': (0.9, 0.7, 0.2), 'Salwar': (0.6, 0.08, 0.1)}
for m in bpy.data.materials:
    if m.name in cols:
        m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = cols[m.name] + (1,)
for o in sc.objects:
    if o.type == 'MESH':
        for md in o.modifiers:
            if md.type == 'CLOTH': md.show_render = False
ld = bpy.data.lights.new('sun', 'SUN'); ld.energy = 3; lo = bpy.data.objects.new('sun', ld); lo.rotation_euler = (0.7, 0.2, -0.6); sc.collection.objects.link(lo)
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.use_denoising = True
sc.render.resolution_x = 500; sc.render.resolution_y = 750
for name, loc, rot in [('front', (0, -4.6, 0.85), (90, 0, 0)), ('side', (4.6, 0, 0.85), (90, 0, 90))]:
    cd = bpy.data.cameras.new(name); cd.lens = 50; c = bpy.data.objects.new(name, cd); sc.collection.objects.link(c)
    c.location = loc; c.rotation_euler = [math.radians(r) for r in rot]; sc.camera = c
    sc.render.filepath = args[1] + '_' + name + '.png'; bpy.ops.render.render(write_still=True)
