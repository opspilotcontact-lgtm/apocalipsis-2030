"""Optimiza un personaje estático de alta resolución (Tencent HY3D) para WebXR / Quest 3.

Uso (headless):
  blender -b --factory-startup --python tools/optimizar_personaje.py -- \
      --entrada C:/.../Dave.glb --nombre Dave --altura 1.80 \
      [--tris 22000] [--tris-lod 12000] [--tex 2048] [--tex-lod 1024] \
      [--modo bake|reutilizar] [--rot-z 0] [--salida-glb assets_src/derivados/Dave_crudo.glb] \
      [--sin-fbx] [--sin-render] [--extrusion 0.012] [--rayo 0.04]

Pasos:
  1. Importa el GLB, aplica la transformación del nodo (rot +90 X de HY3D), une mallas.
  2. Rota --rot-z grados (para que la cara mire a -Y de Blender = +Z de glTF), escala a la
     altura real, pies en z=0, centrado en XY.
  3. Decima (collapse) a --tris.
  4. modo bake: UV nuevas (smart project) + bake Cycles selected-to-active desde la alta:
     base color (emit), roughness y metallic (emit, Non-Color, empaquetados G/B) y normal
     tangente (incluye el normal map de la alta). modo reutilizar: conserva las UV originales
     y reescala las texturas originales a --tex.
  5. Exporta GLB crudo (PNG; la compresión WebP/KTX2 + meshopt la hace tools/finalizar.mjs),
     LOD1 (--tris-lod, mismas UV, texturas a --tex-lod), FBX para Mixamo (textura incrustada)
     y renders de comparación alta vs baja en assets_src/derivados/renders/.
"""
import bpy
import bmesh
import math
import os
import sys
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb  # noqa: E402
import numpy as np  # noqa: E402

T0 = time.time()


def log(*a):
    print(f"[{time.time() - T0:7.1f}s]", *a, flush=True)


def parse():
    ap = argparse.ArgumentParser()
    ap.add_argument('--entrada', required=True)
    ap.add_argument('--nombre', required=True)
    ap.add_argument('--altura', type=float, required=True)
    ap.add_argument('--tris', type=int, default=22000)
    ap.add_argument('--tris-lod', type=int, default=12000)
    ap.add_argument('--tex', type=int, default=2048)
    ap.add_argument('--tex-lod', type=int, default=1024)
    ap.add_argument('--modo', choices=['bake', 'reutilizar'], default='bake')
    ap.add_argument('--rot-z', type=float, default=0.0)
    ap.add_argument('--uv', choices=['original', 'smart'], default='original',
                    help='original = UV de HY3D conservadas por el decimado (islas grandes); smart = reproyectar')
    ap.add_argument('--angulo-uv', type=float, default=80.0)
    ap.add_argument('--remesh', type=float, default=0.0, help='voxel remesh (m) antes de decimar; exige --uv smart')
    ap.add_argument('--extrusion', type=float, default=0.012, help='cage extrusion (m, a escala real)')
    ap.add_argument('--rayo', type=float, default=0.04, help='max ray distance (m)')
    ap.add_argument('--muestras', type=int, default=4)
    ap.add_argument('--soldar', type=float, default=0.0002,
                    help='merge by distance (m) en la alta: HY3D trae vértices partidos en las costuras UV y los rayos del bake se cuelan')
    ap.add_argument('--derivados', default=os.path.join(cb.RAIZ, 'assets_src', 'derivados'))
    ap.add_argument('--sin-fbx', action='store_true')
    ap.add_argument('--sin-render', action='store_true')
    ap.add_argument('--solo-render-alta', action='store_true', help='solo importa, orienta y renderiza la alta (para decidir --rot-z)')
    return ap.parse_args(cb.args_despues_de_guiones())


def importar_alta(a):
    cb.escena_vacia()
    bpy.ops.import_scene.gltf(filepath=a.entrada)
    mallas = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    cb.seleccionar(mallas, mallas[0])
    for o in mallas:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    if len(mallas) > 1:
        bpy.ops.object.join()
    alta = bpy.context.view_layer.objects.active
    for o in list(bpy.context.scene.objects):
        if o is not alta:
            bpy.data.objects.remove(o, do_unlink=True)
    alta.name = a.nombre + "_alta"
    cb.seleccionar([alta], alta)
    # OJO: el importador glTF deja rotation_mode QUATERNION; rotation_euler se ignoraría
    from mathutils import Matrix
    alta.matrix_world = Matrix.Rotation(math.radians(a.rot_z), 4, 'Z') @ alta.matrix_world
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    n = len(alta.data.vertices)
    co = np.empty(n * 3, np.float32)
    alta.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    mn, mx = co.min(0), co.max(0)
    s = a.altura / float(mx[2] - mn[2])
    cx, cy = float(mn[0] + mx[0]) / 2, float(mn[1] + mx[1]) / 2
    alta.scale = (s, s, s)
    alta.location = (-cx * s, -cy * s, -float(mn[2]) * s)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if a.soldar > 0:
        bm = bmesh.new(); bm.from_mesh(alta.data)
        v0 = len(bm.verts)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=a.soldar)
        bm.to_mesh(alta.data); bm.free()
        log(f"soldado {a.soldar} m: {v0} -> {len(alta.data.vertices)} vértices")
        cb.limpiar_normales_custom(alta)
    log(f"alta: {cb.tris_de(alta)} tris, escala x{s:.4f}, dims {tuple(round(d, 3) for d in alta.dimensions)}")
    return alta


def decimar(obj, objetivo):
    actual = cb.tris_de(obj)
    for intento in range(3):
        ratio = min(1.0, objetivo / actual) if intento == 0 else min(1.0, ratio * objetivo / cb.tris_de(obj))
        mod = obj.modifiers.new('dec', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        cb.seleccionar([obj], obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        t = cb.tris_de(obj)
        log(f"decimado intento {intento}: ratio {ratio:.5f} -> {t} tris")
        if abs(t - objetivo) / objetivo < 0.06 or t < objetivo:
            break
        actual = t
        ratio = 1.0
    return cb.tris_de(obj)


def duplicar(obj, nombre):
    d = obj.copy()
    d.data = obj.data.copy()
    d.name = nombre
    d.data.name = nombre
    bpy.context.scene.collection.objects.link(d)
    return d


def uv_nuevas(obj, a):
    me = obj.data
    if a.uv == 'original':
        # se conserva la primera capa UV (la de HY3D, ya decimada) como UV_bake
        while len(me.uv_layers) > 1:
            me.uv_layers.remove(me.uv_layers[-1])
        me.uv_layers[0].name = "UV_bake"
        return
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="UV_bake")
    uv.active = True
    uv.active_render = True
    cb.seleccionar([obj], obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(a.angulo_uv), island_margin=0.0, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin_method='FRACTION',
                                margin=0.004, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')


def imagen(nombre, tam, no_color):
    img = bpy.data.images.new(nombre, tam, tam, alpha=False, float_buffer=False)
    if no_color:
        img.colorspace_settings.name = 'Non-Color'
    img.generated_color = (0.5, 0.5, 1.0, 1.0) if 'normal' in nombre.lower() else (0, 0, 0, 1)
    return img


def principled_y_salida(mat):
    nt = mat.node_tree
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)
    return nt, p, out


def fuente_de(sock):
    """Socket que alimenta un input (o None + valor por defecto)."""
    if sock.is_linked:
        return sock.links[0].from_socket, None
    v = sock.default_value
    try:
        v = tuple(v)
    except TypeError:
        v = (v, v, v, 1.0)
    return None, v


def bake_emit_de(alta, canal, destino_img, a, mat_baja):
    """Hornea el input `canal` del Principled de la alta como emisión en destino_img."""
    restaurar = []
    for slot in alta.material_slots:
        m = slot.material
        nt, p, out = principled_y_salida(m)
        em = nt.nodes.new('ShaderNodeEmission')
        src, val = fuente_de(p.inputs[canal])
        if src is not None:
            nt.links.new(src, em.inputs['Color'])
        else:
            em.inputs['Color'].default_value = val if len(val) == 4 else (*val[:3], 1)
        prev = out.inputs['Surface'].links[0].from_socket
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        restaurar.append((nt, em, prev, out))
    activar_destino(mat_baja, destino_img)
    sc = bpy.context.scene
    sc.cycles.samples = a.muestras
    bpy.ops.object.bake(type='EMIT', use_selected_to_active=True, cage_extrusion=a.extrusion,
                        max_ray_distance=a.rayo, margin=16, margin_type='EXTEND', use_clear=True)
    for nt, em, prev, out in restaurar:
        nt.links.new(prev, out.inputs['Surface'])
        nt.nodes.remove(em)


def activar_destino(mat, img):
    nt = mat.node_tree
    nodo = nt.nodes.get('DESTINO_BAKE')
    if nodo is None:
        nodo = nt.nodes.new('ShaderNodeTexImage')
        nodo.name = 'DESTINO_BAKE'
    nodo.image = img
    for n in nt.nodes:
        n.select = False
    nodo.select = True
    nt.nodes.active = nodo


def guardar_png(img, ruta):
    img.filepath_raw = ruta
    img.file_format = 'PNG'
    img.save()
    img.filepath = ruta


def material_final(nombre, img_color, img_mr, img_normal):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = img_color
    nt.links.new(tc.outputs['Color'], p.inputs['Base Color'])
    tm = nt.nodes.new('ShaderNodeTexImage'); tm.image = img_mr
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(tm.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], p.inputs['Roughness'])
    nt.links.new(sep.outputs['Blue'], p.inputs['Metallic'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img_normal
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


def hornear(alta, baja, a, dir_tex):
    sc = bpy.context.scene
    cb.activar_gpu_cycles(sc)
    sc.render.bake.use_selected_to_active = True
    uv_nuevas(baja, a)
    baja.data.materials.clear()
    tmp = bpy.data.materials.new("TMP_BAKE"); tmp.use_nodes = True
    baja.data.materials.append(tmp)
    cb.seleccionar([alta, baja], baja)
    T = a.tex
    i_col = imagen(f"{a.nombre}_basecolor", T, False)
    i_rou = imagen(f"{a.nombre}_rough_tmp", T, True)
    i_met = imagen(f"{a.nombre}_metal_tmp", T, True)
    i_nor = imagen(f"{a.nombre}_normal", T, True)
    log("bake base color..."); bake_emit_de(alta, 'Base Color', i_col, a, tmp)
    log("bake roughness..."); bake_emit_de(alta, 'Roughness', i_rou, a, tmp)
    log("bake metallic..."); bake_emit_de(alta, 'Metallic', i_met, a, tmp)
    log("bake normal...")
    activar_destino(tmp, i_nor)
    sc.cycles.samples = max(8, a.muestras)
    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True,
                        cage_extrusion=a.extrusion, max_ray_distance=a.rayo, margin=16,
                        margin_type='EXTEND', use_clear=True)
    log("bake listo")
    # empaquetar metal/rough en G/B (R = oclusión 1.0)
    n = T * T * 4
    r = np.empty(n, np.float32); i_rou.pixels.foreach_get(r)
    mt = np.empty(n, np.float32); i_met.pixels.foreach_get(mt)
    mr = np.ones(n, np.float32).reshape(-1, 4)
    mr[:, 1] = r.reshape(-1, 4)[:, 0]
    mr[:, 2] = mt.reshape(-1, 4)[:, 0]
    i_mr = imagen(f"{a.nombre}_metalrough", T, True)
    i_mr.pixels.foreach_set(mr.ravel())
    stats = dict(rough_medio=float(mr[:, 1].mean()), metal_medio=float(mr[:, 2].mean()))
    log("estadísticas MR:", stats)
    for img in (i_col, i_mr, i_nor):
        guardar_png(img, os.path.join(dir_tex, img.name + ".png"))
    for img in (i_rou, i_met):
        bpy.data.images.remove(img)
    baja.data.materials.clear()
    bpy.data.materials.remove(tmp)
    baja.data.materials.append(material_final(f"M_{a.nombre}", i_col, i_mr, i_nor))
    return [i_col, i_mr, i_nor]


def reutilizar(alta, baja, a, dir_tex):
    imgs = []
    for slot in baja.material_slots:
        for nd in slot.material.node_tree.nodes:
            if nd.type == 'TEX_IMAGE' and nd.image and nd.image not in imgs:
                imgs.append(nd.image)
    for img in imgs:
        if img.size[0] > a.tex:
            img.scale(a.tex, a.tex)
        guardar_png(img, os.path.join(dir_tex, f"{a.nombre}_{img.name}.png"))
    return imgs


def exportar_glb(obj, ruta):
    cb.seleccionar([obj], obj)
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_texcoords=True,
                              export_normals=True, export_tangents=False, export_materials='EXPORT',
                              export_image_format='AUTO', export_animations=False, export_skins=False,
                              export_morph=False, export_extras=False)
    log("GLB ->", ruta)


def exportar_fbx_mixamo(obj, ruta):
    cb.seleccionar([obj], obj)
    bpy.ops.export_scene.fbx(filepath=ruta, use_selection=True, object_types={'MESH'},
                             apply_unit_scale=True, apply_scale_options='FBX_SCALE_ALL',
                             axis_forward='-Z', axis_up='Y', use_mesh_modifiers=True,
                             mesh_smooth_type='FACE', add_leaf_bones=False,
                             path_mode='COPY', embed_textures=True, bake_anim=False)
    log("FBX ->", ruta)


def renders(alta, baja, a, dir_render):
    sc = bpy.context.scene
    cam = cb.preparar_render_eevee(sc, (512, 1024))
    h = a.altura
    paneles = []
    tmp = os.path.join(dir_render, "_tmp.png")
    for vista in ('frente', 'lado', 'espalda'):
        for obj in (alta, baja):
            alta.hide_render = obj is not alta
            baja.hide_render = obj is not baja
            cb.poner_camara(cam, vista, (0, 0, h / 2), max(h, 2 * max(alta.dimensions.x, alta.dimensions.y)) * 1.06)
            paneles.append(cb.render_a_array(tmp))
    comp = np.concatenate(paneles, axis=1)
    ruta = os.path.join(dir_render, f"{a.nombre}_giro_alta_vs_baja.png")
    cb.guardar_array_png(comp, ruta)
    # primer plano de la cabeza
    sc.render.resolution_x, sc.render.resolution_y = 512, 512
    paneles = []
    for vista in ('frente', 'lado'):
        for obj in (alta, baja):
            alta.hide_render = obj is not alta
            baja.hide_render = obj is not baja
            cb.poner_camara(cam, vista, (0, 0, h * 0.90), h * 0.22)
            paneles.append(cb.render_a_array(tmp))
    cb.guardar_array_png(np.concatenate(paneles, axis=1),
                         os.path.join(dir_render, f"{a.nombre}_cabeza_alta_vs_baja.png"))
    os.remove(tmp)
    alta.hide_render = baja.hide_render = False
    log("renders ->", ruta)


def main():
    a = parse()
    dir_tex = os.path.join(a.derivados, f"{a.nombre}_tex")
    dir_render = os.path.join(a.derivados, "renders")
    os.makedirs(dir_tex, exist_ok=True)
    os.makedirs(dir_render, exist_ok=True)
    alta = importar_alta(a)
    if a.solo_render_alta:
        sc = bpy.context.scene
        cam = cb.preparar_render_eevee(sc, (512, 1024))
        paneles = []
        for vista in ('frente', 'lado', 'espalda'):
            cb.poner_camara(cam, vista, (0, 0, a.altura / 2), a.altura * 1.06)
            paneles.append(cb.render_a_array(os.path.join(dir_render, "_tmp.png")))
        cb.guardar_array_png(np.concatenate(paneles, axis=1),
                             os.path.join(dir_render, f"{a.nombre}_orientacion.png"))
        os.remove(os.path.join(dir_render, "_tmp.png"))
        return
    baja = duplicar(alta, a.nombre)
    cb.limpiar_normales_custom(baja)
    if a.uv == 'smart':
        # sin UV el collapse no se frena en las costuras (atlas TRELLIS muy fragmentado: se quedaba en 63k)
        while baja.data.uv_layers:
            baja.data.uv_layers.remove(baja.data.uv_layers[0])
    if a.remesh > 0:
        # mallas IA no-manifold (TRELLIS): el collapse se atasca; voxel remesh la cierra y el bake recupera el detalle
        mod = baja.modifiers.new('rm', 'REMESH')
        mod.mode = 'VOXEL'
        mod.voxel_size = a.remesh
        mod.adaptivity = 0.0
        cb.seleccionar([baja], baja)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        print(f"[remesh] voxel {a.remesh} m -> {cb.tris_de(baja)} tris", flush=True)
    decimar(baja, a.tris)
    cb.limpiar_normales_custom(baja)
    if a.modo == 'bake':
        imgs = hornear(alta, baja, a, dir_tex)
    else:
        imgs = reutilizar(alta, baja, a, dir_tex)
    tris = cb.tris_de(baja)
    exportar_glb(baja, os.path.join(a.derivados, f"{a.nombre}_crudo.glb"))
    if not a.sin_fbx:
        exportar_fbx_mixamo(baja, os.path.join(a.derivados, f"{a.nombre}_mixamo.fbx"))
    if not a.sin_render:
        renders(alta, baja, a, dir_render)
    # LOD1: decimar la baja (UV y texturas compartidas), texturas a tex-lod
    lod = duplicar(baja, f"{a.nombre}_LOD1")
    decimar(lod, a.tris_lod)
    mat_lod = baja.data.materials[0].copy()
    mat_lod.name = f"M_{a.nombre}_LOD1"
    for nd in mat_lod.node_tree.nodes:
        if nd.type == 'TEX_IMAGE' and nd.image:
            im = nd.image.copy()
            im.name = nd.image.name + "_lod"
            im.scale(a.tex_lod, a.tex_lod)
            guardar_png(im, os.path.join(dir_tex, im.name + ".png"))
            nd.image = im
    lod.data.materials.clear()
    lod.data.materials.append(mat_lod)
    exportar_glb(lod, os.path.join(a.derivados, f"{a.nombre}_LOD1_crudo.glb"))
    log(f"FIN {a.nombre}: baja {tris} tris, LOD1 {cb.tris_de(lod)} tris, modo {a.modo}")


main()
