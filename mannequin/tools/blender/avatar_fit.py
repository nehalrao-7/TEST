"""Create an MB-Lab character fitted to a body profile (cm). Usage: mbfit.py -- <profile.json> <out.blend> [character]"""
import bpy, sys, importlib, json, time
args = sys.argv[sys.argv.index('--') + 1:]
prof = json.load(open(args[0])); OUT = args[1]; CHAR = args[2] if len(args) > 2 else 'f_as01'
bpy.ops.wm.read_factory_settings(use_empty=True)
sys.path.insert(0, '/tmp/claude-0'); mb = importlib.import_module('mblab'); mb.register()
import mblab.algorithms as alg; alg.remove_censors = lambda *a, **k: None
sc = bpy.context.scene; sc.mblab_character_name = CHAR
bpy.ops.mbast.init_character()
hum = mb.mblab_humanoid; me = hum.morph_engine
cur = me.calculate_measures()
m = prof  # cm
want = dict(cur)
scale_h = (m['height'] / 100) / cur['body_height_Z']
for k in me.body_height_Z_parts: want[k] = cur[k] * scale_h
# legs a little longer, torso shorter -> model proportions (keeps total height)
want['upperleg_length'] *= 1.03; want['lowerleg_length'] *= 1.03
extra = (cur['upperleg_length'] * 0.03 + cur['lowerleg_length'] * 0.03) * scale_h
want['torso_height_Z'] -= extra
want['body_height_Z'] = sum(want[k] for k in me.body_height_Z_parts)
MAP = {'chest_girth': 'bust', 'waist_girth': 'waist', 'buttock_girth': 'hip', 'neck_girth': 'neck', 'upperarm_axillary_girth': 'upperArm',
       'wrist_girth': 'wrist', 'upperleg_top_girth': 'thigh', 'lowerleg_calf_girth': 'calf', 'lowerleg_bottom_girth': 'ankle', 'shoulders_width': 'shoulder'}
for k, src in MAP.items():
    if src in m: want[k] = m[src] / 100
t = time.time()
hum.automodelling(use_measures_from_dict=want, mix=True)
# refine: a few rounds of measure fitting on what's still off
for it in range(3):
    got = me.calculate_measures()
    adj = {k: want[k] + (want[k] - got[k]) * 0.8 for k in MAP}
    hum.measure_fitting(adj); hum.update_character(mode='update_directly_verts')
got = me.calculate_measures()
print('fit s', round(time.time() - t, 1))
for k, src in MAP.items(): print(f'{src:10s} want {want[k]*100:6.1f}  got {got[k]*100:6.1f}')
print(f"height     want {m['height']:6.1f}  got {got['body_height_Z']*100:6.1f}")
json.dump({k: v * 100 for k, v in got.items()}, open(OUT.replace('.blend', '_measures.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
