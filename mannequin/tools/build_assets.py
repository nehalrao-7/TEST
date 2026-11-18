"""Compile MakeHuman CC0 assets into a compact binary bundle for the web viewer.

Sources (all CC0, released by the MakeHuman project in 2020):
  MH_DATA   = makehuman repo  makehuman/data          (base mesh, targets, eyes)
  MH_ASSETS = asset server     download.tuxfamily.org/makehuman/assets/1.1/base  (skins, hair, brows, lashes)

Usage: python3 tools/build_assets.py MH_DATA MH_ASSETS OUT_DIR
Output: OUT_DIR/human.json (manifest), OUT_DIR/human.bin (buffers), textures.
"""
import sys, os, json, numpy as np
from PIL import Image

MH, AS, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
blob = bytearray(); manifest = {"buffers": {}}

def put(name, arr):
    global blob
    arr = np.ascontiguousarray(arr)
    while len(blob) % 4: blob.append(0)
    manifest["buffers"][name] = {"offset": len(blob), "length": int(arr.size), "type": arr.dtype.name}
    blob += arr.tobytes()

def parse_obj(path, group=None):
    v, vt, faces, groups, cur = [], [], [], {}, None
    for line in open(path):
        if line.startswith('v '): v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): vt.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): cur = line.split()[1]
        elif line.startswith('f '):
            f = [tuple(int(p) - 1 if p else -1 for p in (c.split('/') + [''])[:2]) for c in line.split()[1:]]
            groups.setdefault(cur, []).append(f)
    return np.array(v, np.float32), np.array(vt, np.float32), groups

def expand(faces):
    """Split (v,vt) corners into unique render vertices; triangulate."""
    key = {}; orig = []; uvi = []; tris = []
    for f in faces:
        ids = []
        for (vi, ti) in f:
            k = (vi, ti)
            if k not in key: key[k] = len(orig); orig.append(vi); uvi.append(ti)
            ids.append(key[k])
        for i in range(1, len(ids) - 1): tris += [ids[0], ids[i], ids[i + 1]]
    return np.array(orig, np.uint32), np.array(uvi), np.array(tris, np.uint32)

# ---------------- base mesh ----------------
V, VT, G = parse_obj(f'{MH}/3dobjs/base.obj')
put('base', V)
orig, uvi, tris = expand(G['body'])
put('body.orig', orig); put('body.uv', VT[uvi]); put('body.index', tris)
manifest['nverts'] = len(V)
joints = {}
for g, fs in G.items():
    if g.startswith('joint-'):
        joints[g[6:]] = sorted({vi for f in fs for vi, _ in f})
manifest['joints'] = joints

# ---------------- targets ----------------
def load_target(path):
    idx, d = [], []
    for line in open(path):
        if line[0] in '#\n': continue
        p = line.split(); idx.append(int(p[0])); d.append([float(x) for x in p[1:4]])
    return np.array(idx, np.uint16), np.array(d, np.float32)

T = f'{MH}/targets'
targets = {}
def add_target(name, path):
    i, d = load_target(path)
    put(f't.{name}.i', i); put(f't.{name}.d', d); targets[name] = len(i)
for sex in ('female', 'male'):
    for w in ('minweight', 'averageweight', 'maxweight'):
        add_target(f'{sex}-{w}', f'{T}/macrodetails/universal-{sex}-young-averagemuscle-{w}.target')
    for eth in ('african', 'asian', 'caucasian'):
        add_target(f'{sex}-{eth}', f'{T}/macrodetails/{eth}-{sex}-young.target')
    for h in ('minheight', 'maxheight'):
        add_target(f'{sex}-{h}', f'{T}/macrodetails/height/{sex}-young-averagemuscle-averageweight-{h}.target')
    add_target(f'{sex}-idealproportions', f'{T}/macrodetails/proportions/{sex}-young-averagemuscle-averageweight-idealproportions.target')
for f in sorted(os.listdir(f'{T}/measure')):
    add_target(f[:-7], f'{T}/measure/{f}')
for f in ('stomach/stomach-pregnant-decr.target', 'stomach/stomach-pregnant-incr.target', 'torso/torso-scale-depth-decr.target', 'torso/torso-scale-depth-incr.target'):
    add_target(os.path.basename(f)[:-7], f'{T}/{f}')
for f in ('breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness.target',
          'breast/female-young-averagemuscle-averageweight-mincup-averagefirmness.target'):
    if os.path.exists(f'{T}/{f}'): add_target(os.path.basename(f)[:-7].replace('female-young-averagemuscle-averageweight-', 'breast-'), f'{T}/{f}')
manifest['targets'] = targets

# ---------------- body-part labels (nearest bone, base pose) ----------------
J = {k: V[v].mean(0) for k, v in joints.items()}
bones = [('torso', 'pelvis', 'neck', 1.2), ('head', 'neck', 'head-2', 0.8)]
for s in 'lr':
    bones += [(f'{s}-upperarm', f'{s}-shoulder', f'{s}-elbow', 0.45), (f'{s}-forearm', f'{s}-elbow', f'{s}-hand', 0.35),
              (f'{s}-hand', f'{s}-hand', f'{s}-finger-3-4', 0.45), (f'{s}-thigh', f'{s}-upper-leg', f'{s}-knee', 0.65),
              (f'{s}-shin', f'{s}-knee', f'{s}-ankle', 0.45), (f'{s}-foot', f'{s}-ankle', f'{s}-foot-2', 0.35)]
def segdist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
D = np.stack([segdist(V, J[a], J[b]) / r for _, a, b, r in bones], 1)
put('labels', D.argmin(1).astype(np.uint8))
manifest['bones'] = [[n, a, b] for n, a, b, _ in bones]

# ---------------- proxies (eyes, brows, lashes, hair) ----------------
def proxy(name, mhclo, objpath, tex):
    refs, ws, offs, scales = [], [], [], {}
    in_verts = False
    for line in open(mhclo):
        p = line.split()
        if not p or p[0].startswith('#'): continue
        if p[0] in ('x_scale', 'y_scale', 'z_scale'): scales[p[0][0]] = [int(p[1]), int(p[2]), float(p[3])]
        elif p[0] == 'verts': in_verts = True; continue
        elif in_verts and len(p) == 9:
            refs.append([int(x) for x in p[:3]]); ws.append([float(x) for x in p[3:6]]); offs.append([float(x) for x in p[6:9]])
        elif in_verts and len(p) == 1 and p[0].isdigit():
            refs.append([int(p[0])] * 3); ws.append([1, 0, 0]); offs.append([0, 0, 0])
        elif in_verts and p[0].isalpha() and refs: in_verts = False
    pv, pvt, pg = parse_obj(objpath)
    o, u, t = expand([f for fs in pg.values() for f in fs])
    put(f'p.{name}.refs', np.array(refs, np.uint16)[o]); put(f'p.{name}.w', np.array(ws, np.float32)[o])
    put(f'p.{name}.off', np.array(offs, np.float32)[o]); put(f'p.{name}.uv', pvt[u]); put(f'p.{name}.index', t)
    manifest.setdefault('proxies', {})[name] = {'scales': scales, 'texture': tex}

def tex(src, dst, size, fmt):
    im = Image.open(src)
    im = im.convert('RGBA' if fmt == 'PNG' else 'RGB')
    if max(im.size) > size: im = im.resize((size, size), Image.LANCZOS)
    im.save(f'{OUT}/{dst}', fmt, **({'quality': 88} if fmt == 'JPEG' else {'optimize': True}))
    return dst

proxy('eyes', f'{MH}/eyes/high-poly/high-poly.mhclo', f'{MH}/eyes/high-poly/high-poly.obj', tex(f'{MH}/eyes/materials/brown_eye.png', 'eye_brown.png', 512, 'PNG'))
proxy('eyebrows', f'{AS}/eyebrows/eyebrow001/eyebrow001.mhclo', f'{AS}/eyebrows/eyebrow001/eyebrow001.obj', tex(f'{AS}/eyebrows/eyebrow001/eyebrow001.png', 'eyebrows.png', 512, 'PNG'))
proxy('eyelashes', f'{AS}/eyelashes/eyelashes01/eyelashes01.mhclo', f'{AS}/eyelashes/eyelashes01/eyelashes01.obj', tex(f'{AS}/eyelashes/eyelashes01/eyelashes01.png', 'eyelashes.png', 512, 'PNG'))
for h in ('long01', 'ponytail01', 'bob02'):
    proxy(f'hair-{h}', f'{AS}/hair/{h}/{h}.mhclo', f'{AS}/hair/{h}/{h}.obj', tex(f'{AS}/hair/{h}/{h}_diffuse.png', f'hair_{h}.png', 1024, 'PNG'))

skins = {}
for key, f in [('female-asian', 'young_lightskinned_female_diffuse3'), ('female-caucasian', 'young_lightskinned_female_diffuse'),
               ('female-african', 'young_darkskinned_female_diffuse'), ('male-asian', 'young_lightskinned_male_diffuse3'),
               ('male-caucasian', 'young_lightskinned_male_diffuse'), ('male-african', 'young_darkskinned_male_diffuse')]:
    skins[key] = tex(f'{AS}/skins/textures/{f}.png', f'skin_{key}.jpg', 2048, 'JPEG')
manifest['skins'] = skins

# Skeleton + skin weights (MakeHuman default rig, CC0): top-4 influences per vertex
RIG = f'{MH}/rigs'
if os.path.exists(f'{RIG}/default.mhskel'):
    sk = json.load(open(f'{RIG}/default.mhskel'))
    names = list(sk['bones'].keys())
    bones = [{'name': n, 'head': sk['bones'][n]['head'], 'tail': sk['bones'][n]['tail'], 'parent': sk['bones'][n]['parent']} for n in names]
    manifest['rig'] = {'bones': bones, 'joints': sk['joints']}
    W = json.load(open(f'{RIG}/default_weights.mhw'))['weights']
    inf = [[] for _ in range(len(V))]
    for bi, n in enumerate(names):
        for v, w in W.get(n, []): inf[v].append((w, bi))
    bi4 = np.zeros((len(V), 4), np.uint16); w4 = np.zeros((len(V), 4), np.float32)
    for v, lst in enumerate(inf):
        lst.sort(reverse=True); lst = lst[:4]; tot = sum(w for w, _ in lst) or 1
        for k, (w, b) in enumerate(lst): bi4[v, k] = b; w4[v, k] = w / tot
    put('skin.bones', bi4); put('skin.weights', w4)

# Measurement rulers: vertex polylines from MakeHuman's measurement plugin.
manifest['rulers'] = json.load(open(os.path.join(os.path.dirname(__file__), 'rulers.json')))
open(f'{OUT}/human.bin', 'wb').write(blob)
json.dump(manifest, open(f'{OUT}/human.json', 'w'))
print('bin', len(blob) // 1024, 'KB;', len(targets), 'targets')

# sanity: no torso-labelled vertex should be far from the body midline
lab = D.argmin(1)
far = ((lab == 0) & (np.abs(V[:, 0]) > 2.4)).sum()
print('torso verts with |x|>24cm:', int(far))
