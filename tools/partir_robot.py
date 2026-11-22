"""Parte un robot con esqueleto Mixamo (mixamorig:*) en piezas RÍGIDAS para desmembramiento.

Uso (headless):
  blender -b --factory-startup --python tools/partir_robot.py -- \
      --entrada .../Soldado_R7.glb --salida assets_src/derivados/R7_partes_crudo.glb \
      [--tile 0.45] [--sin-pbr] [--render assets_src/derivados/renders/R7_partes.png]

Qué hace:
  1. Importa el GLB (malla skinned + 67 huesos + acciones).
  2. Une las mallas en espacio de mundo (pose de reposo) y asigna cada cara al GRUPO cuyo
     peso total (sumado en los vértices de la cara) es dominante.
  3. Separa una malla por grupo (15 piezas: Cabeza, Torso, Pelvis, BrazoSup/Antebrazo/Mano y
     Muslo/Pierna/Pie _L/_R), cierra los bordes del corte con tapas (holes_fill + poke) con el
     material "M_Corte" y emparenta cada pieza RÍGIDAMENTE a su hueso (parent_type BONE, sin
     skinning: en glTF la pieza queda como nodo hijo del joint, equivale a peso 100 %).
  4. PBR mejorado: carcasa = color plano + rugosidad/normal de rusty_metal_02 (metal 0.8, rough 0.35;\n     metal_plate es chapa lagrimada y se descartó), articulaciones = rusty_metal_02 completo,
     corte = metal quemado con emisión naranja. UV triplanares (cube projection) en mundo.
  5. Exporta GLB con TODAS las acciones (crudo; compresión en tools/finalizar.mjs).
  Cada nodo pieza lleva extras {pieza, hueso} para el código.
"""
import bpy
import bmesh
import math
import os
import sys
import argparse
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb  # noqa: E402
import numpy as np  # noqa: E402

P = "mixamorig:"
GRUPOS = {
    # grupo: (hueso al que se emparenta, [huesos cuyo peso cuenta para el grupo])
    "Cabeza": ("Head", ["Neck", "Head", "HeadTop_End", "LeftEye", "RightEye"]),
    "Torso": ("Spine2", ["Spine1", "Spine2", "LeftShoulder", "RightShoulder"]),
    "Pelvis": ("Hips", ["Hips", "Spine"]),
}
for lado, L in (("L", "Left"), ("R", "Right")):
    dedos = [f"{L}Hand{d}{i}" for d in ("Thumb", "Index", "Middle", "Ring", "Pinky") for i in range(1, 5)]
    GRUPOS[f"BrazoSup_{lado}"] = (f"{L}Arm", [f"{L}Arm"])
    GRUPOS[f"Antebrazo_{lado}"] = (f"{L}ForeArm", [f"{L}ForeArm"])
    GRUPOS[f"Mano_{lado}"] = (f"{L}Hand", [f"{L}Hand"] + dedos)
    GRUPOS[f"Muslo_{lado}"] = (f"{L}UpLeg", [f"{L}UpLeg"])
    GRUPOS[f"Pierna_{lado}"] = (f"{L}Leg", [f"{L}Leg"])
    GRUPOS[f"Pie_{lado}"] = (f"{L}Foot", [f"{L}Foot", f"{L}ToeBase", f"{L}Toe_End"])
HUESO_A_GRUPO = {P + h: g for g, (_, hs) in GRUPOS.items() for h in hs}
NOMBRES_GRUPO = list(GRUPOS.keys())


def parse():
    ap = argparse.ArgumentParser()
    ap.add_argument('--entrada', required=True)
    ap.add_argument('--salida', required=True)
    ap.add_argument('--tile', type=float, default=0.45, help='metros por repetición de textura')
    ap.add_argument('--sin-pbr', action='store_true')
    ap.add_argument('--corte-emision', type=float, default=0.6,
                    help='fuerza emisiva de M_Corte (baja: se ve en el robot entero; el código la sube al desmembrar)')
    ap.add_argument('--tapar-abiertos', action='store_true',
                    help='tapa también los bordes abiertos que ya traía la malla (no solo los del corte)')
    ap.add_argument('--dominio', type=float, default=0.6,
                    help='fracción de peso para asignar una isla entera a un grupo sin cortarla')
    ap.add_argument('--render', default=None)
    return ap.parse_args(cb.args_despues_de_guiones())


def media_canales(ruta):
    img = bpy.data.images.load(ruta, check_existing=True)
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(-1, 4)[:, :3].mean(0)


def material_robot(nombre, color, metal, rough, tex, emision=None, emision_fuerza=1.0, fuerza_normal=1.0, usar_color_tex=True):
    """PBR con textura tileable; ajusta los factores para que la MEDIA dé metal/rough pedidos
    y el color medio se parezca al color plano original."""
    base = os.path.join(cb.POLYHAVEN, tex, tex)
    md = media_canales(base + "_diff_1k.jpg")  # lineal
    ma = media_canales(base + "_arm_1k.jpg")   # Non-Color cargado como sRGB -> aproximación suficiente
    lum = float(md.mean()) if usar_color_tex else 1.0
    col = tuple(min(1.0, c / max(lum, 0.05)) for c in color[:3]) + (1.0,)
    f_rough = min(1.0, rough / max(float(ma[1]), 0.05))
    f_metal = min(1.0, metal / max(float(ma[2]), 0.05)) if ma[2] > 0.2 else metal
    m = cb.material_pbr(nombre, col, f_metal, f_rough, tex_dir=tex, emision=emision,
                        emision_fuerza=emision_fuerza, fuerza_normal=fuerza_normal,
                        usar_color_tex=usar_color_tex)
    if ma[2] <= 0.2:  # el arm no trae metal útil: metal constante
        nt = m.node_tree
        p = nt.nodes.get("Principled BSDF")
        for l in list(p.inputs['Metallic'].links):
            nt.links.remove(l)
        p.inputs['Metallic'].default_value = metal
    print(f"[pbr] {nombre}: color {tuple(round(c, 3) for c in col)} f_metal {f_metal:.2f} f_rough {f_rough:.2f}")
    return m


def main():
    a = parse()
    a.salida = os.path.abspath(a.salida)
    a.render = os.path.abspath(a.render) if a.render else None
    cb.escena_vacia()
    bpy.ops.import_scene.gltf(filepath=a.entrada)
    sc = bpy.context.scene
    arm = next(o for o in sc.objects if o.type == 'ARMATURE')
    mallas = [o for o in sc.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    for o in list(sc.objects):
        if o.type == 'MESH' and o not in mallas:
            bpy.data.objects.remove(o, do_unlink=True)  # Icosphere = forma de hueso del importador
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()

    # --- materiales de origen (se renombran *_orig para que los nuevos hereden el nombre limpio)
    mats_origen = []
    for o in mallas:
        for m in o.data.materials:
            if m not in mats_origen:
                mats_origen.append(m)
    for m in mats_origen:
        if 'Emisivo' not in m.name:
            m.name = m.name + "_orig"
    

    # --- unir en una bmesh en espacio de mundo, con grupo por vértice
    bm = bmesh.new()
    capa_grupo = None
    pesos_por_vert = []
    for o in mallas:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        dl = tmp.verts.layers.deform.verify()
        nombres_vg = [vg.name for vg in o.vertex_groups]
        remap = [mats_origen.index(m) for m in o.data.materials]
        for f in tmp.faces:
            f.material_index = remap[f.material_index]
        me_tmp = bpy.data.meshes.new("tmp")
        for v in tmp.verts:
            w = defaultdict(float)
            for gi, peso in v[dl].items():
                g = HUESO_A_GRUPO.get(nombres_vg[gi])
                if g:
                    w[g] += peso
            pesos_por_vert.append(w)
        tmp.to_mesh(me_tmp)
        tmp.free()
        bm.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    # OJO: tras varios from_mesh los .index quedan repetidos; hay que renumerar
    bm.verts.index_update()
    bm.edges.index_update()
    bm.faces.index_update()
    bm.verts.ensure_lookup_table()
    assert len(bm.verts) == len(pesos_por_vert)
    alto = max(v.co.z for v in bm.verts) - min(v.co.z for v in bm.verts)
    print(f"[robot] {len(bm.verts)} vértices, {len(bm.faces)} caras, alto mundo {alto:.3f} m")

    # --- grupo por cara. Primero por ISLA (pieza suelta): si un grupo domina >= --dominio del
    # peso de la isla, la isla entera va a ese grupo (corte limpio, sin tapa). Si no, se reparte
    # cara a cara (corte dentado + tapa M_Corte).
    bm.faces.ensure_lookup_table()
    islas = []
    vista = set()
    for f0 in bm.faces:
        if f0.index in vista:
            continue
        pila, isla = [f0], []
        vista.add(f0.index)
        while pila:
            f = pila.pop()
            isla.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in vista:
                        vista.add(g.index)
                        pila.append(g)
        islas.append(isla)
    cara_grupo = {}
    n_enteras = n_partidas = 0
    for isla in islas:
        acc = defaultdict(float)
        verts = {v.index for f in isla for v in f.verts}
        bm.verts.ensure_lookup_table()
        for vi in verts:
            for g, w in pesos_por_vert[vi].items():
                acc[g] += w
        tot = sum(acc.values()) or 1.0
        gmax = max(acc, key=acc.get) if acc else "Torso"
        if acc.get(gmax, 0) / tot >= a.dominio:
            n_enteras += 1
            for f in isla:
                cara_grupo[f.index] = gmax
            continue
        n_partidas += 1
        _vs = [bm.verts[i].co for i in verts]
        _mn = [round(min(c[k] for c in _vs), 2) for k in range(3)]
        _mx = [round(max(c[k] for c in _vs), 2) for k in range(3)]
        print(f"[isla partida] bbox {_mn}..{_mx} {len(isla)} caras:", {g: round(w / tot, 2) for g, w in sorted(acc.items(), key=lambda x: -x[1])[:4]})
        for f in isla:
            fa = defaultdict(float)
            for v in f.verts:
                for g, w in pesos_por_vert[v.index].items():
                    fa[g] += w
            cara_grupo[f.index] = max(fa, key=fa.get) if fa else gmax
    print(f"[robot] islas: {len(islas)} ({n_enteras} enteras, {n_partidas} partidas por peso)")
    bm.faces.ensure_lookup_table()
    corte = bm.verts.layers.int.new("corte")
    for v in bm.verts:
        gs = {cara_grupo[f.index] for f in v.link_faces}
        v[corte] = 1 if len(gs) > 1 else 0
    idx_corte = len(mats_origen)

    # --- materiales finales
    if a.sin_pbr:
        mats_final = list(mats_origen)
    else:
        mats_final = []
        for m in mats_origen:
            p = m.node_tree.nodes.get("Principled BSDF")
            col = tuple(p.inputs['Base Color'].default_value)
            ef = p.inputs['Emission Strength'].default_value
            if ef > 0.01 or 'Emisivo' in m.name:
                mats_final.append(m)  # el emisivo se queda igual
            elif 'Articulaciones' in m.name:
                mats_final.append(material_robot(m.name[:-5], col, 0.7, 0.45, 'rusty_metal_02', fuerza_normal=0.6))
            else:
                mats_final.append(material_robot(m.name[:-5], col, 0.8, 0.35, 'rusty_metal_02', usar_color_tex=False, fuerza_normal=0.35))
    if a.sin_pbr:
        m_corte = cb.material_pbr("M_Corte", (0.05, 0.04, 0.035, 1), 0.6, 0.5,
                                  emision=(1.0, 0.35, 0.05, 1), emision_fuerza=2.0)
    else:
        m_corte = material_robot("M_Corte", (0.09, 0.06, 0.045, 1), 0.6, 0.55, 'rusty_metal_02',
                                 emision=(1.0, 0.32, 0.04, 1), emision_fuerza=a.corte_emision)
    mats_final.append(m_corte)

    # --- separar piezas
    piezas = []
    for g in NOMBRES_GRUPO:
        pb = bm.copy()
        pb.faces.index_update()
        pb.faces.ensure_lookup_table()
        borrar = [f for f in pb.faces if cara_grupo[f.index] != g]
        if len(borrar) == len(pb.faces):
            pb.free()
            continue
        bmesh.ops.delete(pb, geom=borrar, context='FACES_ONLY')
        bmesh.ops.delete(pb, geom=[v for v in pb.verts if not v.link_faces], context='VERTS')
        cl = pb.verts.layers.int.get("corte")
        if a.tapar_abiertos:
            bordes = [e for e in pb.edges if e.is_boundary]
        else:
            bordes = [e for e in pb.edges if e.is_boundary and e.verts[0][cl] and e.verts[1][cl]]
        n_tapas = 0
        if bordes:
            res = bmesh.ops.holes_fill(pb, edges=bordes, sides=0)
            nuevas = res['faces']
            if nuevas:
                rp = bmesh.ops.poke(pb, faces=nuevas)
                for f in rp['faces']:
                    f.material_index = idx_corte
                    f.smooth = False
                n_tapas = len(nuevas)
        me = bpy.data.meshes.new(f"Pieza_{g}")
        pb.to_mesh(me)
        pb.free()
        for m in mats_final:
            me.materials.append(m)
        ob = bpy.data.objects.new(f"Pieza_{g}", me)
        sc.collection.objects.link(ob)
        cb.limpiar_normales_custom(ob)
        # las caras planas originales siguen marcadas sharp_face; las tapas también
        if not a.sin_pbr:
            cb.uv_caja(ob, a.tile)
        hueso = P + GRUPOS[g][0]
        ob["pieza"] = g
        ob["hueso"] = hueso
        ob.parent = arm
        ob.parent_type = 'BONE'
        ob.parent_bone = hueso
        bpy.context.view_layer.update()
        from mathutils import Matrix
        ob.matrix_world = Matrix.Identity(4)
        piezas.append((ob, n_tapas))
        print(f"[pieza] {g:12s} -> {hueso:28s} caras {len(me.polygons):6d} tapas {n_tapas}")
    bm.free()
    for o in mallas:
        bpy.data.objects.remove(o, do_unlink=True)
    # quitar slots de material sin usar por pieza (evita primitivas vacías)
    for ob, _ in piezas:
        usados = {p.material_index for p in ob.data.polygons}
        for i in reversed(range(len(ob.data.materials))):
            if i not in usados:
                ob.data.materials.pop(index=i)
    arm.data.pose_position = 'POSE'
    bpy.context.view_layer.update()

    if a.render:
        render(arm, [p for p, _ in piezas], a.render)

    cb.seleccionar([arm] + [p for p, _ in piezas], arm)
    bpy.ops.export_scene.gltf(filepath=a.salida, export_format='GLB', use_selection=True,
                              export_apply=False, export_yup=True, export_texcoords=True,
                              export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
                              export_animations=True, export_animation_mode='ACTIONS',
                              export_skins=True, export_def_bones=False, export_extras=True,
                              export_reset_pose_bones=True, export_force_sampling=True)
    print("[robot] GLB ->", a.salida)


def render(arm, piezas, ruta):
    """Frente en reposo + vista despiezada (piezas separadas del centro) para revisar cortes."""
    sc = bpy.context.scene
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    cam = cb.preparar_render_eevee(sc, (768, 1024))
    cb.poner_camara(cam, 'frente', (0, 0, 0.92), 2.0)
    paneles = [cb.render_a_array(ruta + "_tmp.png")]
    cb.poner_camara(cam, 'lado', (0, 0, 0.92), 2.0)
    paneles.append(cb.render_a_array(ruta + "_tmp.png"))
    # despiece: copias sin padre desplazadas radialmente desde el centro (los originales se ocultan)
    from mathutils import Vector, Matrix
    centro = Vector((0, 0, 0.95))
    copias = []
    for p in piezas:
        mw = p.matrix_world.copy()
        c = sum((mw @ Vector(b) for b in p.bound_box), Vector()) / 8
        cp = bpy.data.objects.new(p.name + "_vista", p.data)
        sc.collection.objects.link(cp)
        cp.matrix_world = Matrix.Translation((c - centro) * 0.45) @ mw
        p.hide_render = True
        copias.append(cp)
    cb.poner_camara(cam, 'frente', (0, 0, 0.92), 2.6)
    paneles.append(cb.render_a_array(ruta + "_tmp.png"))
    for cp in copias:
        bpy.data.objects.remove(cp, do_unlink=True)
    for p in piezas:
        p.hide_render = False
    arm.data.pose_position = 'POSE'
    bpy.context.view_layer.update()
    cb.guardar_array_png(np.concatenate(paneles, axis=1), ruta)
    os.remove(ruta + "_tmp.png")


main()
