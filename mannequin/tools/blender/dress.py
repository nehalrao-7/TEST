"""Dress an MB-Lab avatar in a sewn kameez + patiala salwar and simulate it with Blender cloth.

Usage: python dress.py -- <avatar.blend> <pattern.json> <out.blend> [--pose standing04] [--frames 90] [--h 1.4]

pattern.json comes from the web app's draftPattern() (cm). The kameez is built from the real pattern
pieces (front, back, sleeves) placed around the avatar and joined with sewing springs; each patiala leg
carries its full pattern width and is gathered into a waistband and an ankle cuff.
"""
import bpy, bmesh, json, math, sys, time, importlib
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

A = sys.argv[sys.argv.index('--') + 1:]
AVATAR, PATTERN, OUT = A[0], A[1], A[2]
def opt(name, default): return type(default)(A[A.index(name) + 1]) if name in A else default
POSE = opt('--pose', 'standing04'); FRAMES = opt('--frames', 35); RELAX = opt('--relax', 30); H = opt('--h', 1.4) / 100  # mesh resolution (m)
SETTLE, MOVE = 20, 50  # frames: sew + settle in rest pose, then blend into the final pose

bpy.ops.wm.open_mainfile(filepath=AVATAR)
sc = bpy.context.scene
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
body = [o for o in sc.objects if o.type == 'MESH' and 'manuellab_id' in o.keys()][0]
PAT = json.load(open(PATTERN)); G = PAT['garment']; PC = {p['name']: p for p in PAT['pieces']}
cm = 0.01

# ---------------- pose the avatar first: the garment is sewn and draped on the final pose ----------------
sys.path.insert(0, '/tmp/claude-0')
mb = importlib.import_module('mblab'); mb.register()
bpy.context.view_layer.objects.active = arm
if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()

# ---------------- body sampling (posed) ----------------
for m in body.modifiers:
    if m.type == 'DISPLACE': m.show_viewport = False
    if m.type == 'SUBSURF': m.show_viewport = True; m.levels = 1
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg); me = ev.to_mesh()
V = [body.matrix_world @ v.co for v in me.vertices]
gnames = {g.index: g.name for g in body.vertex_groups}
TORSO = ('spine', 'pelvis', 'breast', 'clavicle', 'neck', 'root')
from mathutils.kdtree import KDTree
dom_body = []
for v in body.data.vertices:
    best, w = None, 0
    for g in v.groups:
        if g.weight > w: best, w = gnames.get(g.group, ''), g.weight
    dom_body.append(best or '')
# posed positions of the base (un-subdivided) vertices, to label the subdivided ones
for m in body.modifiers:
    if m.type == 'SUBSURF': m.show_viewport = False
_ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get()); _bm = _ev.to_mesh()
base_pos = [body.matrix_world @ v.co for v in _bm.vertices]; _ev.to_mesh_clear()
for m in body.modifiers:
    if m.type == 'SUBSURF': m.show_viewport = True
kd = KDTree(len(base_pos))
for i, p in enumerate(base_pos): kd.insert(p, i)
kd.balance()
dom = [dom_body[kd.find(p)[1]] for p in V]
torso_idx = [i for i, n in enumerate(dom) if n.startswith(TORSO)]
thigh_idx = [i for i, n in enumerate(dom) if n.startswith(('thigh', 'calf'))]
hip_idx = torso_idx + thigh_idx
ev.to_mesh_clear()
bone = lambda n: (arm.matrix_world @ arm.pose.bones[n].head, arm.matrix_world @ arm.pose.bones[n].tail)

def torso_ellipse(z, idx=None, gap=0.025):
    pts = []
    for w in (0.012, 0.025, 0.05, 0.1):
        pts = [V[i] for i in (idx or torso_idx) if abs(V[i].z - z) < w]
        if len(pts) >= 8: break
    xs = [p.x for p in pts]; ys = [p.y for p in pts]
    return (0.0, (min(ys) + max(ys)) / 2, max(abs(x) for x in xs) + gap, (max(ys) - min(ys)) / 2 + gap)

def ellipse_arc_point(e, s, front=True):
    """point at arc length s (m, signed: +s toward +X) from the front (-Y) or back (+Y) centre."""
    cx, cy, a, b = e
    t0 = -math.pi / 2 if front else math.pi / 2
    sgn = 1 if s >= 0 else -1; d = 0; t = t0; step = 0.002 * sgn
    px, py = cx + a * math.cos(t), cy + b * math.sin(t)
    # +s goes toward +X on both panels
    direction = 1 if front else -1
    for _ in range(4000):
        t2 = t + step * direction
        nx, ny = cx + a * math.cos(t2), cy + b * math.sin(t2)
        seg = math.hypot(nx - px, ny - py)
        if d + seg >= abs(s): f = (abs(s) - d) / max(seg, 1e-9); return px + (nx - px) * f, py + (ny - py) * f
        d += seg; t, px, py = t2, nx, ny
    return px, py

# ---------------- 2D pattern helpers (cm) ----------------
def resample(line, h):
    cum = [0.0]
    for i in range(1, len(line)): cum.append(cum[-1] + math.dist(line[i], line[i - 1]))
    L = cum[-1]; n = max(1, round(L / h)); out = []
    for k in range(n + 1):
        s = k / n * L; i = 1
        while i < len(cum) - 1 and cum[i] < s: i += 1
        t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) or 1)
        out.append((line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t))
    return out

def nearest(pts, q): return min(range(len(pts)), key=lambda i: math.dist(pts[i], q))

def mesh_piece(chains, h):
    """chains: [(name, polyline)], closed loop in order. Returns pts, tris, chain->indices (with end point)."""
    pts, idx = [], {}
    for name, line in chains:
        s = resample(line, h); idx[name] = []
        for k, p in enumerate(s[:-1]): idx[name].append(len(pts)); pts.append(p)
    names = [c[0] for c in chains]
    for i, n in enumerate(names): idx[n].append(idx[names[(i + 1) % len(names)]][0])
    nb = len(pts)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    edges = [(i, (i + 1) % nb) for i in range(nb)]
    dy = h * 0.866; y = min(ys) + dy / 2; r = 0
    poly = pts[:]
    def inside(q):
        c = False; j = nb - 1
        for i in range(nb):
            a, b = poly[i], poly[j]
            if (a[1] > q[1]) != (b[1] > q[1]) and q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]: c = not c
            j = i
        return c
    while y < max(ys):
        x = min(xs) + (h / 2 if r % 2 else 0)
        while x < max(xs):
            q = (x, y)
            if inside(q) and min(math.dist(q, p) for p in poly) > h * 0.55: pts.append(q)
            x += h
        y += dy; r += 1
    res = delaunay_2d_cdt([Vector(p) for p in pts], edges, [], 1, 1e-5)
    out = [tuple(v) for v in res[0]]
    remap = {}
    for new_i, origs in enumerate(res[3]):
        for o in origs: remap[o] = new_i
    idx = {k: [remap[i] for i in v] for k, v in idx.items()}
    return out, [tuple(f) for f in res[2]], idx

# ---------------- kameez pieces ----------------
front, back, sleeve = PC['Kameez FRONT'], PC['Kameez BACK'], PC['SLEEVE']
def bodice_chains(pc):
    P = [tuple(p) for p in pc['pts']]; n = len(P); K = pc['keys']
    iN, iS, iU, iSl = (nearest(P, K[k]) for k in ('neck', 'shoulder', 'underarm', 'slit'))
    R = lambda a, b: P[a:b + 1]
    Lm = lambda line: [(-x, y) for x, y in line][::-1]
    hem = R(iSl, n - 1) + Lm(R(iSl, n - 1))[1:]
    return [('neckR', R(0, iN)), ('shoulderR', R(iN, iS)), ('armholeR', R(iS, iU)), ('sideR', R(iU, iSl)), ('hem', hem),
            ('sideL', Lm(R(iU, iSl))), ('armholeL', Lm(R(iS, iU))), ('shoulderL', Lm(R(iN, iS))), ('neckL', Lm(R(0, iN)))]
def sleeve_chains(pc):
    P = [tuple(p) for p in pc['pts']]; K = pc['keys']
    iT, iRU, iRH, iLH = (nearest(P, K[k]) for k in ('top', 'rightUnder', 'rightHem', 'leftHem'))
    return [('capBack', P[0:iT + 1]), ('capFront', P[iT:iRU + 1]), ('underR', P[iRU:iRH + 1]), ('hem', [P[iRH], P[iLH]]), ('underL', [P[iLH], P[0]])]

verts, uvs, faces, fmat, seams, rest = [], [], [], [], [], []
piece_no = [0]
def add_piece(pts, tris, chains, place, zone):
    base = len(verts)
    off = piece_no[0] * 2.0; piece_no[0] += 1  # flat pieces laid out side by side (rest shape)
    for p in pts: verts.append(place(p)); uvs.append((p[0], -p[1])); rest.append(Vector((off + p[0] * cm, 0, -p[1] * cm)))
    for t in tris:
        c = ((pts[t[0]][0] + pts[t[1]][0] + pts[t[2]][0]) / 3, (pts[t[0]][1] + pts[t[1]][1] + pts[t[2]][1]) / 3)
        faces.append((base + t[0], base + t[1], base + t[2])); fmat.append(zone(c))
    return {k: [base + i for i in v] for k, v in chains.items()}

neck_z = bone('neck')[0].z + 0.035
L = front['dims']['L']; BAND = 9
def halfwidth(pc, py):
    P = pc['pts']; best = 0.0
    for i in range(len(P) - 1):
        (x0, y0), (x1, y1) = P[i], P[i + 1]
        if (y0 - py) * (y1 - py) <= 0 and y0 != y1: best = max(best, x0 + (py - y0) / (y1 - y0) * (x1 - x0))
    return best
ah_y = front['keys']['underarm'][1]
def bodice(pc, is_front):
    pts, tris, ch = mesh_piece(bodice_chains(pc), H / cm)
    neckline = [pts[i] for i in ch['neckR'] + ch['neckL']]
    def place(p):
        z = neck_z - p[1] * cm * 0.985
        zz = min(z, 1.27)
        e = torso_ellipse(zz, idx=None if zz > 0.82 else hip_idx, gap=0.03 if is_front else 0.035)
        if zz < 0.82:  # below the hips the tunic hangs straight-ish over both legs
            e0 = torso_ellipse(0.82, idx=hip_idx, gap=0.03 if is_front else 0.035)
            e = (e[0], e[1], max(e[2], e0[2]), max(e[3], e0[3]))
        # below the armhole, size the wrap so the panel's side edge lands exactly at the side of
        # the body, where the other panel's side edge meets it (no overlap, no gap to close)
        hw = halfwidth(pc, p[1]) * cm
        if p[1] > ah_y and hw > 0.01:
            cx, cy, a, b = e
            Q = math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b))) / 4
            k = hw / Q
            e = (cx, cy, a * k, b * k)
        x, y = ellipse_arc_point(e, p[0] * cm, is_front)
        return Vector((x, y, z))
    def zone(c):
        if c[1] > L - BAND: return 1
        if min(math.dist(c, q) for q in neckline) < 1.1: return 2
        return 0
    return add_piece(pts, tris, ch, place, zone)
F, K = bodice(front, True), bodice(back, False)

def make_sleeve(side):
    pts, tris, ch = mesh_piece(sleeve_chains(sleeve), H / cm * 0.9)
    d = sleeve['dims']; sw, capH = d['sw'], d['capH']
    sh, el = bone(f'upperarm_{side}'); _, wr = bone(f'lowerarm_{side}')
    ax = (el - sh).normalized(); up = (Vector((0, 0, 1)) - ax * ax.z).normalized(); fw = ax.cross(up)
    if fw.y > 0: fw = -fw  # +px -> front of the arm (-Y)
    segA = (el - sh).length; ax2 = (wr - el).normalized()
    R = sw * cm / (2 * math.pi) + 0.015
    def place(p):
        dd = (p[1] - capH * 0.55) * cm
        c = sh + ax * dd if dd <= segA else el + ax2 * (dd - segA)
        phi = 2 * math.pi * p[0] / sw
        return c + up * (math.cos(phi) * R) + fw * (math.sin(phi) * R)
    return add_piece(pts, tris, ch, place, lambda c: 2 if c[1] > d['sL'] - 2.5 else 0)
SL, SR = make_sleeve('L'), make_sleeve('R')

def sew(a, b, reverse=False):
    b = b[::-1] if reverse else b
    def frac(ch):
        u = [0.0]
        for i in range(1, len(ch)): u.append(u[-1] + math.dist(uvs[ch[i]], uvs[ch[i - 1]]))
        return [x / (u[-1] or 1) for x in u]
    fa, fb = frac(a), frac(b); pairs = set()
    pick = lambda fs, f: min(range(len(fs)), key=lambda i: abs(fs[i] - f))
    for i, v in enumerate(a): pairs.add((v, b[pick(fb, fa[i])]))
    for i, v in enumerate(b): pairs.add((a[pick(fa, fb[i])], v))
    seams.extend(pairs)
sew(F['shoulderR'], K['shoulderR']); sew(F['shoulderL'], K['shoulderL'])
sew(F['sideR'], K['sideR']); sew(F['sideL'], K['sideL'])
sew(F['armholeR'], SL['capFront']); sew(K['armholeR'], SL['capBack'], True)
sew(F['armholeL'], SR['capFront'], True); sew(K['armholeL'], SR['capBack'])
sew(SL['underR'], SL['underL'], True); sew(SR['underR'], SR['underL'], True)

def build(name, verts, faces, uvs, fmat, loose=()):
    m = bpy.data.meshes.new(name)
    m.from_pydata([tuple(v) for v in verts], list(loose), faces)
    lay = m.uv_layers.new(name='UVMap')
    for poly in m.polygons:
        for li in poly.loop_indices: lay.data[li].uv = uvs[m.loops[li].vertex_index]
    m.polygons.foreach_set('material_index', fmat)
    for p in m.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, m); sc.collection.objects.link(ob); return ob
kameez = build('Kameez', verts, faces, [(u * cm, v * cm) for u, v in uvs], fmat, loose=seams)
def add_rest(ob, coords):
    ob.shape_key_add(name='Basis'); k = ob.shape_key_add(name='Rest'); k.value = 0.0
    for i, c in enumerate(coords): k.data[i].co = c
    return k

print('kameez verts', len(verts), 'tris', len(faces), 'seam springs', len(seams), flush=True)

# ---------------- patiala salwar ----------------
crotch_z = min(V[i].z for i in torso_idx if abs(V[i].x) < 0.03)
hem_z = neck_z - L * cm * 0.985
_, ankle = bone('calf_L'); ankle_z = ankle.z + 0.02
cuff_h = G['cuffHeight'] * cm; cuff_top = ankle_z + cuff_h
top_z = min(crotch_z - 0.03, hem_z + 0.04)  # gathered band sits just inside the kameez hem
fullness = max(1.0, G['fullness'])
panel_top = PAT['body']['hip'] / 2 * fullness * cm; panel_bot = G['mohri'] * 1.8 * cm
n_pleats = max(12, int(G['pleats']) * 2)
def leg_section(side, z):
    pts = [V[i] for i in thigh_idx if abs(V[i].z - z) < 0.02 and (V[i].x > 0) == (side == 'L')]
    if len(pts) < 5: return None
    cx = sum(p.x for p in pts) / len(pts); cy = sum(p.y for p in pts) / len(pts)
    r = max(math.hypot(p.x - cx, p.y - cy) for p in pts)
    return cx, cy, r
SEG = 72
def pleated_ring(cx, cy, z, r0, C):
    def ring(Amp): return [(cx + (r0 + Amp * 0.5 * (1 - math.cos(n_pleats * th))) * math.cos(th), cy + (r0 + Amp * 0.5 * (1 - math.cos(n_pleats * th))) * math.sin(th)) for th in (k / SEG * 2 * math.pi for k in range(SEG))]
    def per(pts): return sum(math.dist(pts[k], pts[(k + 1) % SEG]) for k in range(SEG))
    lo, hi = 0.0, 0.3
    if per(ring(0)) < C:
        for _ in range(30):
            mid = (lo + hi) / 2
            if per(ring(mid)) < C: lo = mid
            else: hi = mid
    return [Vector((x, y, z)) for x, y in ring(lo)]
salwar_objs = []
waist_z0 = bone('spine01')[0].z if 'spine01' in arm.data.bones else crotch_z + 0.2
# rest length of each leg panel below the band (pattern length minus the part above the band)
length = (G['salwarLength'] - G['cuffHeight']) * cm - max(0.0, waist_z0 - top_z)
def ellipse_ring(cx, cy, z, a, C):
    """front-back elongated ellipse (x half-width a) whose perimeter is C"""
    lo, hi = a, 1.0
    per = lambda b: math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b)))
    for _ in range(40):
        mid = (lo + hi) / 2
        if per(mid) < C: lo = mid
        else: hi = mid
    return [Vector((cx + a * math.cos(k / SEG * 2 * math.pi), cy + lo * math.sin(k / SEG * 2 * math.pi), z)) for k in range(SEG)]
for side in ('L', 'R'):
    rows = max(10, round(length / (H * 1.1)))
    sv, sf, suv, pin, loose = [], [], [], [], []
    ref_top = leg_section(side, top_z) or leg_section(side, top_z - 0.05)
    for r in range(rows + 1):
        t = r / rows; z = top_z - length * t
        s = leg_section(side, max(z, cuff_top + 0.02)) or ref_top
        cx, cy, rr = s
        C = panel_top * (1 - t) + panel_bot * t
        # hidden under the kameez the leg stays slim; the full pattern width opens out just below the hem
        slim = 2 * math.pi * (rr + 0.025)
        u = min(1.0, max(0.0, (top_z - z) / 0.08)); u = u * u * (3 - 2 * u)
        C = slim + (max(C, slim) - slim) * u
        ring = ellipse_ring(cx, cy, z, rr + 0.02, C)

        for k, p in enumerate(ring): sv.append(p); suv.append((k / SEG * C, -t * length))
    for r in range(rows):
        for k in range(SEG):
            a = r * SEG + k; b = r * SEG + (k + 1) % SEG
            sf.append((a, b, b + SEG, a + SEG))
    def band(cx, cy, z, R, row):
        base = len(sv)
        for k in range(SEG // 2):
            th = k / (SEG // 2) * 2 * math.pi
            sv.append(Vector((cx + R * math.cos(th), cy + R * math.sin(th), z))); suv.append((0, 0)); pin.append(len(sv) - 1)
        for k in range(SEG): loose.append((row * SEG + k, base + (k * (SEG // 2)) // SEG))
    tcx, tcy, trr = ref_top
    band(tcx, tcy, top_z, trr + 0.015, 0)                          # gathered into the waistband (hidden)
    cx, cy, rr = leg_section(side, cuff_top) or leg_section(side, cuff_top + 0.04)
    Rc = G['mohri'] * cm / (2 * math.pi)
    band(cx, cy, cuff_top, Rc, rows)                               # gathered into the cuff
    ob = build(f'Salwar_{side}', sv, sf, suv, [0] * len(sf), loose=loose)
    vg = ob.vertex_groups.new(name='pin'); vg.add(pin, 1.0, 'REPLACE')
    ob['cuff'] = [cx, cy, Rc]
    salwar_objs.append(ob)
print('salwar verts', [len(o.data.vertices) for o in salwar_objs], flush=True)

# static parts: cuff bands and the hidden upper salwar (body offset from crotch to waist)
def cuff_band(ob):
    cx, cy, Rc = ob['cuff']
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=Rc + 0.002, depth=cuff_h, location=(cx, cy, cuff_top - cuff_h / 2), end_fill_type='NOTHING')
    c = bpy.context.object; c.name = 'Cuff_' + ob.name[-1]; return c
cuffs = [cuff_band(o) for o in salwar_objs]
bm = bmesh.new(); bm.from_mesh(body.data)
waist_z = bone('spine01')[0].z if 'spine01' in arm.data.bones else crotch_z + 0.2
for v in bm.verts: v.select = False
keep = [f for f in bm.faces if all(top_z - 0.04 < (body.matrix_world @ v.co).z < waist_z + 0.02 for v in f.verts) and all(dom_body[v.index].startswith(TORSO + ('thigh',)) for v in f.verts)]
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in set(keep)], context='FACES')
um = bpy.data.meshes.new('SalwarUpper'); bm.to_mesh(um); bm.free()
upper = bpy.data.objects.new('SalwarUpper', um); sc.collection.objects.link(upper); upper.matrix_world = body.matrix_world
for vg in body.vertex_groups: upper.vertex_groups.new(name=vg.name)
dsp = upper.modifiers.new('Offset', 'DISPLACE'); dsp.strength = 0.005; dsp.mid_level = 0
am = upper.modifiers.new('Armature', 'ARMATURE'); am.object = arm

# ---------------- materials (placeholders; render.py styles them) ----------------
def mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.diffuse_color = rgb + (1,); return m
for o, mats in [(kameez, ['Kameez', 'Border', 'Zari']), *[(o, ['Salwar']) for o in salwar_objs], *[(c, ['Salwar']) for c in cuffs], (upper, ['Salwar'])]:
    for n in mats: o.data.materials.append(mat(n, (0.5, 0.05, 0.08)))

# ---------------- cloth simulation ----------------
body.modifiers.new('Collision', 'COLLISION')
body.collision.thickness_outer = 0.003; body.collision.thickness_inner = 0.004; body.collision.cloth_friction = 1.5
upper.modifiers.new('Collision', 'COLLISION'); upper.collision.thickness_outer = 0.003
def cloth(ob, mass, bend, sew_force=0, pin=False):
    c = ob.modifiers.new('Cloth', 'CLOTH'); s = c.settings
    s.quality = 7; s.mass = mass; s.air_damping = 1.2
    s.tension_stiffness = 30; s.compression_stiffness = 30; s.shear_stiffness = 12; s.bending_stiffness = bend
    s.use_internal_springs = False
    if ob.data.shape_keys: s.rest_shape_key = ob.data.shape_keys.key_blocks['Rest']
    if sew_force: s.use_sewing_springs = True; s.sewing_force_max = sew_force
    if pin: s.vertex_group_mass = 'pin'; s.pin_stiffness = 1
    cs = c.collision_settings; cs.collision_quality = 3; cs.distance_min = 0.003
    cs.use_self_collision = True; cs.self_distance_min = 0.002; cs.self_friction = 5
    c.point_cache.frame_start = 1; c.point_cache.frame_end = FRAMES
    return c
cloth(kameez, 0.15, 0.4, sew_force=30)
for o in salwar_objs:
    cloth(o, 0.12, 0.08, sew_force=10, pin=True)
    c = o.modifiers.new('Collision', 'COLLISION'); o.collision.thickness_outer = 0.002

# ---------------- gravity ramp: sew with little gravity, then let it hang ----------------
sc.use_gravity = True
sc.gravity = (0, 0, -0.5); sc.keyframe_insert('gravity', frame=1); sc.keyframe_insert('gravity', frame=SETTLE)
sc.gravity = (0, 0, -9.81); sc.keyframe_insert('gravity', frame=SETTLE + 10)
sc.frame_start, sc.frame_end = 1, FRAMES
# ground the feet at the end pose
t0 = time.time()
for f in range(1, FRAMES + 1):
    sc.frame_set(f)
    if f % 10 == 0: print(f'frame {f}/{FRAMES}  {time.time() - t0:.0f}s', flush=True)
print('sim done', round(time.time() - t0), 's', flush=True)
def bake(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        ev = o.evaluated_get(dg); nm = bpy.data.meshes.new_from_object(ev)
        o.modifiers.clear(); o.shape_key_clear() if o.data.shape_keys else None; o.data = nm
cloth_objs = [kameez] + salwar_objs
bake(cloth_objs)

# ---------------- skin the draped garment to the skeleton, then pose ----------------
if POSE != 'rest':
    gidx = {g.name: g.index for g in body.vertex_groups}
    base_w = [[(gnames[g.group], g.weight) for g in v.groups] for v in body.data.vertices]
    kd2 = KDTree(len(base_pos))
    for i, p in enumerate(base_pos): kd2.insert(p, i)
    kd2.balance()
    def skin(o, keep_groups=('pin',)):
        names = {}
        for v in o.data.vertices:
            acc = {}
            for (co, i, d) in kd2.find_n(o.matrix_world @ v.co, 8):
                w0 = 1 / (d + 0.01)
                for n, w in base_w[i]: acc[n] = acc.get(n, 0) + w * w0
            tot = sum(acc.values()) or 1
            for n, w in acc.items():
                if w / tot < 0.02: continue
                g = names.get(n) or o.vertex_groups.get(n) or o.vertex_groups.new(name=n); names[n] = g
                g.add([v.index], w / tot, 'REPLACE')
        am = o.modifiers.new('Armature', 'ARMATURE'); am.object = arm
    for o in cloth_objs + cuffs: skin(o)
    bpy.context.view_layer.objects.active = arm
    mb.mblab_retarget.load_pose(f'/tmp/claude-0/mblab/data/poses/female_poses/{POSE}.json', arm, use_retarget=False)
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    # apply the pose to the garments (keep pin groups), then let the cloth relax in the pose
    dg = bpy.context.evaluated_depsgraph_get()
    for o in cloth_objs + cuffs:
        ev = o.evaluated_get(dg); nm = bpy.data.meshes.new_from_object(ev)
        pin_w = {}
        if o.vertex_groups.get('pin'):
            gi = o.vertex_groups['pin'].index
            pin_w = {v.index: g.weight for v in o.data.vertices for g in v.groups if g.group == gi}
        o.modifiers.clear(); o.vertex_groups.clear(); o.data = nm
        if pin_w:
            vg = o.vertex_groups.new(name='pin')
            for i, w in pin_w.items(): vg.add([i], w, 'REPLACE')
    sc.frame_set(1)
    sc.animation_data_clear(); sc.gravity = (0, 0, -9.81)
    cloth(kameez, 0.15, 0.4, sew_force=30)
    for o in salwar_objs:
        cloth(o, 0.12, 0.08, sew_force=10, pin=True)
        c = o.modifiers.new('Collision', 'COLLISION'); o.collision.thickness_outer = 0.002
    for o in cloth_objs: o.modifiers['Cloth'].point_cache.frame_end = RELAX
    t0 = time.time()
    for f in range(1, RELAX + 1):
        sc.frame_set(f)
        if f % 10 == 0: print(f'relax {f}/{RELAX}  {time.time() - t0:.0f}s', flush=True)
    bake(cloth_objs)
for o in cloth_objs: o['baked'] = True
sc.frame_current = 1
if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('saved', OUT)
