"""Auto-rig propio (sin Mixamo): esqueleto mixamorig de Dave ajustado a un humanoide estático en A-pose.

  blender -b --factory-startup --python tools/autorig.py -- \
      --entrada assets_src/derivados/Mike_crudo.glb --nombre Mike --tex-dir assets_src/derivados/Mike_tex \
      --anim Idle=assets_src/mixamo/anims/Breathing_Idle.fbx --anim Walk=assets_src/mixamo/anims/Walking.fbx \
      --anim HitHead=assets_src/mixamo/anims/Head_Hit.fbx --en-sitio Walk \
      --salida assets_src/derivados/Mike_animado_crudo.glb --render-dir assets_src/derivados/renders

Método
1. Rig de Dave (assets_src/mixamo/Dave_rig.fbx, T-pose, 41 huesos, pesos de Mixamo) + su malla en A-pose
   (Dave_crudo.glb). Las caras están en el mismo orden (mismas UV) -> correspondencia vértice T <-> A ->
   Kabsch ponderado por hueso = la A-pose de Dave como rotaciones locales (basis) sobre su reposo T.
2. Medidas por cortes de silueta en la malla destino y en la de Dave: altura, entrepierna (columna central),
   medio ancho del torso (corte al 70 %), mano (tramo más exterior del corte 25-62 % de la altura, punto más
   bajo) y pies (z < 4 %). Con ellas:
   - escala del objeto armature = altura * (entrepierna relativa) -> las piernas quedan en unidades de Dave,
     así la pista de traslación de Hips de los clips compartidos (en unidades de Dave) sigue pisando el suelo;
   - torso/cuello/cabeza x kU para completar la altura; hombro x kW (ancho); brazo/mano x kA (alcance).
   Las longitudes se cambian SOLO a lo largo de la dirección de cada hueso y se conserva el roll ->
   rotaciones de reposo IDÉNTICAS a Dave (los clips solo llevan rotaciones + traslación de Hips).
3. Se posa el esqueleto ajustado en la A-pose de Dave y se giran brazos/piernas desde su raíz para que la mano
   y el pie previstos caigan en los medidos. Copia con esa pose como reposo -> pesos automáticos (heat) sobre una
   copia soldada de la malla. Si heat deja > 2 % sin peso (o --pesos transferir): Data Transfer (nearest face
   interpolated) desde la malla riggeada de Dave llevada a la pose ajustada (LBS entre los dos esqueletos).
4. La copia A se posa en el reposo T del esqueleto ajustado y se aplica -> malla en T-pose ligada al esqueleto
   final (mismos nombres y rotaciones de reposo que Dave). Clips Mixamo redirigidos como en montar_personaje.py.
"""
import bpy
import bmesh
import os
import sys
import math
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb  # noqa: E402
import montar_personaje as mp  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector, kdtree  # noqa: E402

RAIZ = cb.RAIZ


def parse():
    ap = argparse.ArgumentParser()
    ap.add_argument('--entrada', required=True, help='GLB estático A-pose (pies en z=0, cara a -Y Blender)')
    ap.add_argument('--nombre', required=True)
    ap.add_argument('--tex-dir', default=None, help='si se da, material horneado <nombre>_basecolor/_metalrough/_normal.png')
    ap.add_argument('--rig', default=os.path.join(RAIZ, 'assets_src', 'mixamo', 'Dave_rig.fbx'))
    ap.add_argument('--ref-apose', default=os.path.join(RAIZ, 'assets_src', 'derivados', 'Dave_crudo.glb'))
    ap.add_argument('--anim', action='append', default=[])
    ap.add_argument('--en-sitio', action='append', default=[])
    ap.add_argument('--pesos', choices=['auto', 'transferir'], default='transferir',
                    help='transferir (por defecto: pesos de Dave llevados al esqueleto ajustado; más limpio en ropa ancha) | auto (heat)')
    ap.add_argument('--piernas', choices=['dave', 'medir'], default='dave',
                    help='dave: proporción de pierna de Dave salvo ±12 %% | medir: acepta piernas hasta +25 %% (Coloso)')
    ap.add_argument('--sin-ajuste', action='store_true', help='solo escala uniforme (sin medidas de silueta)')
    ap.add_argument('--salida', required=True)
    ap.add_argument('--render-dir', default=None)
    a = ap.parse_args(cb.args_despues_de_guiones())
    a.salida = os.path.abspath(a.salida)
    return a


# ---------------------------------------------------------------- utilidades
def orden_jerarquico(arm):
    def prof(b):
        n = 0
        while b.parent:
            b, n = b.parent, n + 1
        return n
    return [b.name for b in sorted(arm.data.bones, key=prof)]


def importar_glb_malla(ruta):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(ruta))
    nuevos = [o for o in bpy.data.objects if o not in antes]
    malla = next(o for o in nuevos if o.type == 'MESH')
    for o in nuevos:
        if o is not malla:
            malla.matrix_world = malla.matrix_world.copy()
    if malla.parent:
        mw = malla.matrix_world.copy()
        malla.parent = None
        malla.matrix_world = mw
    for o in nuevos:
        if o is not malla:
            bpy.data.objects.remove(o, do_unlink=True)
    return malla


def co_mundo_datos(obj):
    """coordenadas de mundo de la malla SIN modificadores."""
    n = len(obj.data.vertices)
    co = np.empty(n * 3, np.float32)
    obj.data.vertices.foreach_get('co', co)
    M = np.array(obj.matrix_world)
    return co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]


def pesos_matriz(obj, nombres):
    idx = {g.index: nombres.index(g.name) for g in obj.vertex_groups if g.name in nombres}
    W = np.zeros((len(obj.data.vertices), len(nombres)), np.float32)
    for v in obj.data.vertices:
        for g in v.groups:
            j = idx.get(g.group)
            if j is not None:
                W[v.index, j] = g.weight
    return W


def kabsch(P, Q, w):
    w = w / w.sum()
    pc, qc = (P * w[:, None]).sum(0), (Q * w[:, None]).sum(0)
    H = ((P - pc) * w[:, None]).T @ (Q - qc)
    U, _, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    R = Vt.T @ np.diag([1, 1, d]) @ U.T
    return R, qc - R @ pc


def M4(R3, t):
    m = Matrix.Identity(4)
    for i in range(3):
        for j in range(3):
            m[i][j] = R3[i][j]
        m[i][3] = t[i]
    return m


def es_final(nombre):
    return nombre.endswith('_End') or nombre[-1] == '4' and 'Hand' in nombre


# ---------------------------------------------------------------- 1. A-pose de Dave
def correspondencia_por_uv(rig, ref):
    """vértice del rig -> vértice de la ref, emparejando esquinas por UV cara a cara (mismo orden de caras)."""
    def uvs(o):
        n = len(o.data.loops)
        uv = np.empty(n * 2, np.float32)
        o.data.uv_layers.active.data.foreach_get('uv', uv)
        vi = np.empty(n, np.int32)
        o.data.loops.foreach_get('vertex_index', vi)
        return np.round(uv.reshape(-1, 2) * 4096).astype(np.int64), vi
    uv_r, vi_r = uvs(rig)
    uv_a, vi_a = uvs(ref)
    mapa = -np.ones(len(rig.data.vertices), np.int64)
    ok = 0
    for pr, pa in zip(rig.data.polygons, ref.data.polygons):
        if pr.loop_total != pa.loop_total:
            continue
        la = {tuple(uv_a[k]): vi_a[k] for k in range(pa.loop_start, pa.loop_start + pa.loop_total)}
        hit = 0
        for k in range(pr.loop_start, pr.loop_start + pr.loop_total):
            j = la.get(tuple(uv_r[k]))
            if j is not None:
                mapa[vi_r[k]] = j
                hit += 1
        ok += hit == pr.loop_total
    print(f"[apose] caras emparejadas por UV {ok}/{len(rig.data.polygons)}; vértices con pareja {(mapa >= 0).sum()}/{len(mapa)}")
    return mapa


def apose_de_dave(armD, mallaD, refA):
    nombres = orden_jerarquico(armD)
    mapa = correspondencia_por_uv(mallaD, refA)
    okv = mapa >= 0
    PT = mp.coords_mundo(mallaD)  # reposo T (sin acción)
    PA = co_mundo_datos(refA)[np.maximum(mapa, 0)]
    Ainv = np.array(armD.matrix_world.inverted())
    PTa = PT @ Ainv[:3, :3].T + Ainv[:3, 3]
    PAa = PA @ Ainv[:3, :3].T + Ainv[:3, 3]
    W = pesos_matriz(mallaD, nombres)
    rot = {}
    for j, n in enumerate(nombres):
        m = okv & (W[:, j] > 0.4)
        if m.sum() >= 12:
            rot[n] = kabsch(PTa[m], PAa[m], W[m, j])
    posed, basis = {}, {}
    for n in nombres:
        b = armD.data.bones[n]
        ML = b.matrix_local
        if n in rot:
            R = Matrix([list(r) for r in rot[n][0]])
        elif b.parent:
            p = b.parent
            R = posed[p.name].to_3x3() @ p.matrix_local.to_3x3().inverted()
        else:
            R = Matrix.Identity(3)
        if b.parent is None:
            t = rot[n][1] if n in rot else np.zeros(3)
            head = R @ ML.translation + Vector(t)
            ref_m = ML
        else:
            ref_m = posed[b.parent.name] @ (b.parent.matrix_local.inverted() @ ML)
            head = ref_m.translation
        posed[n] = Matrix.Translation(head) @ (R @ ML.to_3x3()).to_4x4()
        basis[n] = ref_m.inverted() @ posed[n]
    aplicar_basis(armD, basis)
    apose_de_dave.posed = posed
    err = np.linalg.norm(mp.coords_mundo(mallaD)[okv] - PA[okv], axis=1)
    print(f"[apose] error malla Dave posada vs A-pose: media {err.mean()*100:.2f} cm, p95 {np.percentile(err, 95)*100:.2f} cm")
    return basis, PA, okv


def aplicar_basis(arm, basis, con_loc=True):
    for n, B in basis.items():
        pb = arm.pose.bones[n]
        pb.rotation_mode = 'QUATERNION'
        loc, q, _ = B.decompose()
        pb.rotation_quaternion = q
        pb.location = loc if (con_loc and arm.data.bones[n].parent is None) else Vector()
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


# ---------------------------------------------------------------- 2. medidas de silueta
def tramos(vals, paso):
    if len(vals) == 0:
        return []
    b = np.unique(np.floor(vals / paso).astype(int))
    out, ini = [], b[0]
    for i in range(1, len(b)):
        if b[i] != b[i - 1] + 1:
            out.append((ini * paso, (b[i - 1] + 1) * paso))
            ini = b[i]
    out.append((ini * paso, (b[-1] + 1) * paso))
    return out


def muestrear_superficie(obj, n=400000, semilla=3):
    """puntos al azar sobre las caras (por área): los cortes de silueta no dependen de la densidad de vértices."""
    co = co_mundo_datos(obj)
    me = obj.data
    me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, np.int32)
    me.loop_triangles.foreach_get('vertices', t)
    t = t.reshape(-1, 3)
    a, b, c = co[t[:, 0]], co[t[:, 1]], co[t[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    rng = np.random.default_rng(semilla)
    i = rng.choice(len(t), n, p=area / area.sum())
    u, v = rng.random(n), rng.random(n)
    f = u + v > 1
    u[f], v[f] = 1 - u[f], 1 - v[f]
    return a[i] + u[:, None] * (b[i] - a[i]) + v[:, None] * (c[i] - a[i])


def medidas(co):
    H = float(co[:, 2].max())
    x, z = co[:, 0], co[:, 2]
    m = {'H': H}
    col = (np.abs(x) < 0.012 * H) & (z > 0.12 * H)
    m['entrepierna'] = float(z[col].min()) if col.any() else None
    banda = np.abs(z - 0.70 * H) < 0.012 * H
    tr = [t for t in tramos(x[banda], 0.006 * H) if t[0] <= 0 <= t[1]]
    m['torso'] = float(max(-tr[0][0], tr[0][1])) if tr else None
    for lado, s in (('L', 1), ('R', -1)):
        # mano = zona más baja de lo que queda por fuera del 72 % del ancho máximo (antebrazo+mano),
        # vale para brazos en A (Dave) y casi rectos (Coloso, sin hueco con la cadera)
        sel = (z > 0.25 * H) & (z < 0.62 * H) & (x * s > 0)
        mano = None
        if sel.any():
            ext = sel & (np.abs(x) > 0.72 * np.abs(x[sel]).max())
            if ext.sum() > 50:
                baja = ext & (z <= z[ext].min() + 0.03 * H)
                mano = co[baja].mean(0)
        m['mano_' + lado] = mano
        pie = (z < 0.04 * H) & (x * s > 0)
        m['pie_' + lado] = co[pie].mean(0) if pie.sum() > 10 else None
    return m


# ---------------------------------------------------------------- 3. esqueleto ajustado
def factor_arista(nombre, k):
    n = nombre.replace('mixamorig:', '')
    if any(t in n for t in ('UpLeg', 'Leg', 'Foot', 'Toe')):
        return 1.0
    if n in ('LeftArm', 'RightArm'):
        return k['U'] * k['W']
    if 'ForeArm' in n or 'Hand' in n:
        return k['U'] * k['A']
    return k['U']


def construir(armD, k, sp, nombre):
    arm = armD.copy()
    arm.data = armD.data.copy()
    arm.animation_data_clear()
    bpy.context.scene.collection.objects.link(arm)
    arm.name = nombre
    arm.scale = tuple(s * sp for s in armD.scale)
    orden = orden_jerarquico(armD)
    cb.seleccionar([arm], arm)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    old = {b.name: (b.head.copy(), b.tail.copy(), b.roll) for b in eb}
    for b in eb:
        b.use_connect = False
    nh = {}
    for n in orden:
        b = eb[n]
        if b.parent is None:
            nh[n] = old[n][0]
        else:
            nh[n] = nh[b.parent.name] + factor_arista(n, k) * (old[n][0] - old[b.parent.name][0])
    for n in orden:
        b = eb[n]
        hijos = [c.name for c in b.children]
        kt = factor_arista(hijos[0], k) if hijos else factor_arista(n, k)
        b.head = nh[n]
        b.tail = nh[n] + kt * (old[n][1] - old[n][0])
        b.roll = old[n][2]
    bpy.ops.object.mode_set(mode='OBJECT')
    dmax = max(float(np.abs(np.array(arm.data.bones[n].matrix_local.to_3x3())
                            - np.array(armD.data.bones[n].matrix_local.to_3x3())).max()) for n in orden)
    print(f"[esqueleto] k={ {a: round(b, 3) for a, b in k.items()} } escala x{sp:.4f}; dif. máx. de rotación de reposo vs Dave {dmax:.2e}")
    return arm


def mundo_bone(arm, n):
    return arm.matrix_world @ arm.pose.bones[n].matrix


def prever(armD, arm, hueso, Ld):
    local = mundo_bone(armD, hueso).inverted() @ Vector(Ld)
    return mundo_bone(arm, hueso) @ local


def girar_cadena(arm, raiz, pred, objetivo):
    pb = arm.pose.bones[raiz]
    cab = arm.matrix_world @ pb.head
    D = (pred - cab).rotation_difference(Vector(objetivo) - cab).to_matrix().to_4x4()
    Mw = Matrix.Translation(cab) @ D @ Matrix.Translation(-cab) @ (arm.matrix_world @ pb.matrix)
    pb.matrix = arm.matrix_world.inverted() @ Mw
    bpy.context.view_layer.update()
    ang = math.degrees((pred - cab).angle(Vector(objetivo) - cab))
    return ang


# ---------------------------------------------------------------- 4. pesos
def soldar_copia(malla):
    c = malla.copy()
    c.data = malla.data.copy()
    bpy.context.scene.collection.objects.link(c)
    bm = bmesh.new()
    bm.from_mesh(c.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(c.data)
    bm.free()
    c.vertex_groups.clear()
    c.modifiers.clear()
    return c


def proxy_dave(mallaD, armD, armA, nombres):
    """malla de Dave (con sus grupos) llevada a la pose A ajustada: LBS entre esqueleto Dave posado y armA."""
    P = mp.coords_mundo(mallaD)
    W = pesos_matriz(mallaD, nombres)
    out = np.zeros_like(P)
    tot = np.zeros(len(P))
    Ph = np.c_[P, np.ones(len(P))]
    for j, n in enumerate(nombres):
        w = W[:, j]
        if w.max() <= 0:
            continue
        T = np.array(mundo_bone(armA, n) @ mundo_bone(armD, n).inverted())
        out += w[:, None] * (Ph @ T.T)[:, :3]
        tot += w
    out = np.where(tot[:, None] > 0, out / np.maximum(tot, 1e-6)[:, None], P)
    me = bpy.data.meshes.new('proxy')
    me.from_pydata(out.tolist(), [], [tuple(p.vertices) for p in mallaD.data.polygons])
    px = bpy.data.objects.new('proxy_Dave', me)
    bpy.context.scene.collection.objects.link(px)
    for j, n in enumerate(nombres):
        g = px.vertex_groups.new(name=n)
        idx = np.nonzero(W[:, j] > 0)[0]
        for i in idx:
            g.add([int(i)], float(W[i, j]), 'REPLACE')
    return px


def transferir_pesos(dst, src):
    for g in src.vertex_groups:
        if g.name not in dst.vertex_groups:
            dst.vertex_groups.new(name=g.name)
    mod = dst.modifiers.new('pesos', 'DATA_TRANSFER')
    mod.object = src
    mod.use_object_transform = True
    mod.use_vert_data = True
    mod.data_types_verts = {'VGROUP_WEIGHTS'}
    mod.vert_mapping = 'POLYINTERP_NEAREST'
    mod.layers_vgroup_select_src = 'ALL'
    mod.layers_vgroup_select_dst = 'NAME'
    cb.seleccionar([dst], dst)
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def pesos(a, malla, armA, armD, mallaD, nombres):
    sold = soldar_copia(malla)
    print(f"[pesos] copia soldada {len(sold.data.vertices)} v (original {len(malla.data.vertices)})")
    finales = [b for b in armA.data.bones if es_final(b.name)]
    for b in finales:
        b.use_deform = False
    metodo = a.pesos
    if metodo == 'auto':
        cb.seleccionar([sold, armA], armA)
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        W = pesos_matriz(sold, nombres)
        sin = float((W.sum(1) < 1e-4).mean())
        print(f"[pesos] heat: {sin*100:.2f} % de vértices sin peso")
        if sin > 0.02:
            # HY3D/TRELLIS no son variedades cerradas: heat sobre un remallado por vóxeles (cerrado) y
            # de ahí a la malla por Data Transfer
            sold.parent = None
            sold.modifiers.clear()
            sold.vertex_groups.clear()
            vox = sold.copy()
            vox.data = sold.data.copy()
            bpy.context.scene.collection.objects.link(vox)
            H = float(np.ptp(co_mundo_datos(sold)[:, 2]))
            rm = vox.modifiers.new('vox', 'REMESH')
            rm.mode = 'VOXEL'
            rm.voxel_size = H / 160
            cb.seleccionar([vox], vox)
            bpy.ops.object.modifier_apply(modifier=rm.name)
            dec = vox.modifiers.new('dec', 'DECIMATE')
            dec.ratio = min(1.0, 60000 / max(1, len(vox.data.polygons)))
            bpy.ops.object.modifier_apply(modifier=dec.name)
            # heat falla con medidas pequeñas: x10 temporal (ambos en el origen)
            esc_a = armA.scale.copy()
            vox.scale = (10, 10, 10)
            armA.scale = esc_a * 10
            bpy.context.view_layer.update()
            cb.seleccionar([vox, armA], armA)
            bpy.ops.object.parent_set(type='ARMATURE_AUTO')
            armA.scale = esc_a
            vox.parent = None
            vox.scale = (1, 1, 1)
            bpy.context.view_layer.update()
            Wv = pesos_matriz(vox, nombres)
            sinv = float((Wv.sum(1) < 1e-4).mean())
            print(f"[pesos] heat sobre vóxeles ({len(vox.data.vertices)} v): {sinv*100:.2f} % sin peso")
            if sinv <= 0.02:
                vox.parent = None
                vox.modifiers.clear()
                transferir_pesos(sold, vox)
                print("[pesos] heat (vóxeles) -> Data Transfer a la malla")
            else:
                metodo = 'transferir'
            bpy.data.objects.remove(vox, do_unlink=True)
    if metodo == 'transferir':
        sold.parent = None
        sold.modifiers.clear()
        sold.vertex_groups.clear()
        px = proxy_dave(mallaD, armD, armA, nombres)
        transferir_pesos(sold, px)
        bpy.data.objects.remove(px, do_unlink=True)
        print("[pesos] Data Transfer (nearest face interpolated) desde Dave")
    for b in finales:
        b.use_deform = True
    W = pesos_matriz(sold, nombres)
    co = co_mundo_datos(sold)
    vacios = W.sum(1) < 1e-4
    if vacios.any() and (~vacios).any():
        kd = kdtree.KDTree(int((~vacios).sum()))
        llenos = np.nonzero(~vacios)[0]
        for i in llenos:
            kd.insert(co[i], int(i))
        kd.balance()
        for i in np.nonzero(vacios)[0]:
            W[i] = W[kd.find(co[i])[1]]
        print(f"[pesos] {int(vacios.sum())} vértices sin peso rellenados con el vecino")
    # máx. 4 influencias, normalizadas
    orden = np.argsort(-W, axis=1)
    W4 = np.zeros_like(W)
    filas = np.arange(len(W))[:, None]
    W4[filas, orden[:, :4]] = W[filas, orden[:, :4]]
    W4 /= np.maximum(W4.sum(1, keepdims=True), 1e-8)
    # al original por posición (vértices partidos en costuras UV reciben el mismo peso -> sin grietas)
    kd = kdtree.KDTree(len(co))
    for i, c in enumerate(co):
        kd.insert(c, i)
    kd.balance()
    coO = co_mundo_datos(malla)
    idx = np.array([kd.find(c)[1] for c in coO])
    WO = W4[idx]
    malla.vertex_groups.clear()
    for j, n in enumerate(nombres):
        sel = np.nonzero(WO[:, j] > 1e-4)[0]
        if len(sel) == 0:
            continue
        g = malla.vertex_groups.new(name=n)
        for i in sel:
            g.add([int(i)], float(WO[i, j]), 'REPLACE')
    print(f"[pesos] {len(malla.vertex_groups)} grupos en la malla final")
    bpy.data.objects.remove(sold, do_unlink=True)


# ---------------------------------------------------------------- render de control
def render_walk(nombre, arm, malla, act, H, rd):
    sc = bpy.context.scene
    os.makedirs(rd, exist_ok=True)
    cam = cb.preparar_render_eevee(sc, (512, 1024))
    tmp = os.path.join(rd, '_tmp_autorig.png')
    arm.animation_data.action = act
    try:
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    f0, f1 = act.frame_range
    paneles = []
    for t in (0.0, 0.33, 0.66):
        sc.frame_set(int(round(f0 + (f1 - f0) * t)))
        co = mp.coords_mundo(malla)
        print(f"[walk] t={t:.2f}: z min {co[:, 2].min():.3f} max {co[:, 2].max():.3f}")
        th = math.radians(35)
        cam.location = (20 * math.sin(th), -20 * math.cos(th), H * 0.52)
        cam.rotation_euler = (math.radians(90), 0, th)
        cam.data.ortho_scale = H * 1.15
        paneles.append(cb.render_a_array(tmp))
    ruta = os.path.join(rd, f"{nombre}_autorig_Walk.png")
    cb.guardar_array_png(np.concatenate(paneles, axis=1), ruta)
    os.remove(tmp)
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    sc.frame_set(1)
    print('[render] ->', ruta)


# ---------------------------------------------------------------- main
def main():
    a = parse()
    cb.escena_vacia()
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(a.rig), use_anim=True)
    sc = bpy.context.scene
    armD = next(o for o in sc.objects if o.type == 'ARMATURE')
    mallaD = next(o for o in sc.objects if o.type == 'MESH')
    if armD.animation_data and armD.animation_data.action:
        viejo = armD.animation_data.action
        armD.animation_data.action = None
        bpy.data.actions.remove(viejo)
    # OJO: quitar la acción deja la T-pose en los pose bones. El reposo del rig de Mixamo es el bind pose
    # (la A-pose subida), así que se vuelve al reposo de verdad.
    for pb in armD.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    nombres = orden_jerarquico(armD)
    refA = importar_glb_malla(a.ref_apose)
    HD = float(co_mundo_datos(refA)[:, 2].max())
    alto = float(np.ptp(mp.coords_mundo(mallaD)[:, 2]))
    if abs(alto - HD) > 0.005:
        armD.scale = tuple(s * HD / alto for s in armD.scale)
        bpy.context.view_layer.update()
    basis, PA_dave, _ = apose_de_dave(armD, mallaD, refA)
    mD = medidas(muestrear_superficie(refA))

    malla = importar_glb_malla(a.entrada)
    malla.name = a.nombre
    coT = co_mundo_datos(malla)
    mT = medidas(muestrear_superficie(malla))
    s = mT['H'] / mD['H']
    kL = 1.0
    if not a.sin_ajuste and mT['entrepierna'] and mD['entrepierna']:
        rt, rd_ = mT['entrepierna'] / mT['H'], mD['entrepierna'] / mD['H']
        # por debajo de -12 % suele ser bata/faldón tapando la entrepierna -> no fiable; por encima se acepta
        # (piernas largas de robot) hasta +25 %
        lim = (0.88, 1.3, 1.25) if a.piernas == 'medir' else (0.88, 1.12, 1.12)
        if lim[0] <= rt / rd_ <= lim[1]:
            kL = float(np.clip(rt / rd_, lim[0], lim[2]))
    sp = s * kL
    cD = mD['entrepierna'] or 0.45 * mD['H']
    kU = (mT['H'] / sp - cD) / (mD['H'] - cD)
    kW = 1.0
    if not a.sin_ajuste and mT['torso'] and mD['torso']:
        kW = float(np.clip(mT['torso'] / (sp * kU * mD['torso']), 0.7, 2.2))
    k = {'U': kU, 'W': kW, 'A': 1.0}
    print(f"[medidas] Dave {({x: (np.round(v, 3).tolist() if v is not None else None) for x, v in mD.items()})}")
    print(f"[medidas] {a.nombre} {({x: (np.round(v, 3).tolist() if v is not None else None) for x, v in mT.items()})}")

    # pasada 1: alcance del brazo
    arm = construir(armD, k, sp, f"{a.nombre}_tmp")
    aplicar_basis(arm, basis)
    kAs = []
    if not a.sin_ajuste:
        for lado, bn in (('L', 'Left'), ('R', 'Right')):
            if mT['mano_' + lado] is None or mD['mano_' + lado] is None:
                continue
            pred = prever(armD, arm, f"mixamorig:{bn}Hand", mD['mano_' + lado])
            hom = arm.matrix_world @ arm.pose.bones[f"mixamorig:{bn}Arm"].head
            kAs.append((Vector(mT['mano_' + lado]) - hom).length / (pred - hom).length)
    if kAs:
        k['A'] = float(np.clip(np.mean(kAs) * k['U'], 0.75, 1.5) / k['U'])  # límite sobre la longitud total
    bpy.data.objects.remove(arm, do_unlink=True)

    # pasada 2: esqueleto final + giros de brazos/piernas hacia las medidas
    arm = construir(armD, k, sp, f"{a.nombre}_Armature")
    aplicar_basis(arm, basis)
    if not a.sin_ajuste:
        for lado, bn in (('L', 'Left'), ('R', 'Right')):
            for raiz, hueso, clave in ((f"{bn}Arm", f"{bn}Hand", 'mano_'), (f"{bn}UpLeg", f"{bn}Foot", 'pie_')):
                if mT[clave + lado] is None or mD[clave + lado] is None:
                    continue
                pred = prever(armD, arm, 'mixamorig:' + hueso, mD[clave + lado])
                ang = girar_cadena(arm, 'mixamorig:' + raiz, pred, mT[clave + lado])
                err = (prever(armD, arm, 'mixamorig:' + hueso, mD[clave + lado]) - Vector(mT[clave + lado])).length
                print(f"[ajuste] {raiz}: giro {ang:.1f}°, error restante {err*100:.1f} cm")

    # copia con la pose A como reposo
    armA = arm.copy()
    armA.data = arm.data.copy()
    sc.collection.objects.link(armA)
    armA.name = f"{a.nombre}_A"
    for pb in arm.pose.bones:
        q = armA.pose.bones[pb.name]
        q.rotation_mode = 'QUATERNION'
        q.matrix_basis = pb.matrix_basis.copy()
    bpy.context.view_layer.update()
    cb.seleccionar([armA], armA)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    pesos(a, malla, armA, armD, mallaD, nombres)

    # malla A -> T: posar armA en el reposo de arm y aplicar
    mod = malla.modifiers.new('A', 'ARMATURE')
    mod.object = armA
    for n in nombres:
        armA.pose.bones[n].matrix = arm.data.bones[n].matrix_local.copy()
        bpy.context.view_layer.update()
    cb.seleccionar([malla], malla)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(armA, do_unlink=True)
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    mw = malla.matrix_world.copy()
    malla.parent = arm
    malla.matrix_parent_inverse = arm.matrix_world.inverted()
    malla.matrix_world = mw
    m2 = malla.modifiers.new('Armature', 'ARMATURE')
    m2.object = arm
    coR = mp.coords_mundo(malla)
    print(f"[T] malla en reposo T: alto {np.ptp(coR[:, 2]):.3f} m, ancho {np.ptp(coR[:, 0]):.3f} m, z min {coR[:, 2].min():.3f}")

    # limpiar Dave
    for o in (mallaD, armD, refA):
        bpy.data.objects.remove(o, do_unlink=True)

    if a.tex_dir:
        malla.data.materials.clear()
        malla.data.materials.append(mp.material_horneado(a.nombre, a.tex_dir))
    cb.limpiar_normales_custom(malla)

    fps = sc.render.fps / sc.render.fps_base
    if not arm.animation_data:
        arm.animation_data_create()
    acciones = []
    for spec in a.anim:
        nombre, ruta = spec.split('=', 1)
        act = mp.importar_accion(ruta, nombre, arm)
        if nombre in a.en_sitio:
            vel, _ = mp.quitar_deriva_raiz(act, arm, fps)
            act["velocidad_raiz_mps"] = round(vel, 4)
            act["en_sitio"] = True
        act["fps"] = fps
        tr = arm.animation_data.nla_tracks.new()
        tr.name = nombre
        st = tr.strips.new(nombre, int(act.frame_range[0]), act)
        try:
            if act.slots:
                st.action_slot = act.slots[0]
        except Exception:
            pass
        tr.mute = True
        acciones.append(act)
    walk = next((x for x in acciones if x.name.startswith('Walk')), None)
    if a.render_dir and walk:
        render_walk(a.nombre, arm, malla, walk, mT['H'], os.path.abspath(a.render_dir))

    cb.seleccionar([arm, malla], arm)
    bpy.ops.export_scene.gltf(filepath=a.salida, export_format='GLB', use_selection=True,
                              export_yup=True, export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_image_format='AUTO',
                              export_skins=True, export_def_bones=False, export_animations=True,
                              export_animation_mode='ACTIONS', export_extras=True,
                              export_force_sampling=True, export_optimize_animation_size=True,
                              export_reset_pose_bones=True, export_tangents=False)
    print("[glb] ->", a.salida)


if __name__ == '__main__':
    main()
