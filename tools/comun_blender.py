"""Utilidades compartidas por los scripts de Blender del pipeline de assets.

Se importan añadiendo tools/ al sys.path (los scripts lo hacen solos).
Probado con Blender 5.3 (headless: blender -b --factory-startup --python script.py -- args).
"""
import bpy
import bmesh
import math
import os
import sys

import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POLYHAVEN = os.path.join(RAIZ, "assets_src", "polyhaven", "textures")


def args_despues_de_guiones():
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def escena_vacia():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    return sc


def seleccionar(objs, activo=None):
    for o in bpy.context.view_layer.objects:
        if o is not None:
            o.select_set(False)
    for o in objs:
        o.select_set(True)
    if activo is not None:
        bpy.context.view_layer.objects.active = activo


def tris_de(obj):
    me = obj.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def activar_gpu_cycles(sc):
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for tipo in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
            try:
                prefs.compute_device_type = tipo
                prefs.get_devices()
                gpus = [d for d in prefs.devices if d.type == tipo]
                if gpus:
                    for d in prefs.devices:
                        d.use = (d.type == tipo)
                    sc.cycles.device = 'GPU'
                    print(f"[gpu] Cycles en {tipo}: {[g.name for g in gpus]}")
                    return tipo
            except Exception:
                continue
    except Exception as e:
        print("[gpu] sin GPU:", e)
    sc.cycles.device = 'CPU'
    return 'CPU'


def limpiar_normales_custom(obj):
    try:
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj],
                                       selected_editable_objects=[obj]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as e:
        print("[aviso] no se pudieron limpiar normales custom:", e)
    try:
        obj.data.shade_smooth()
    except Exception:
        for p in obj.data.polygons:
            p.use_smooth = True


# ---------------------------------------------------------------- materiales

def cargar_imagen(ruta, no_color=False):
    img = bpy.data.images.load(ruta, check_existing=True)
    if no_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def material_pbr(nombre, color=(0.5, 0.5, 0.5, 1.0), metal=0.0, rugosidad=0.5,
                 tex_dir=None, tex_prefijo=None, usar_color_tex=True, fuerza_normal=1.0,
                 emision=None, emision_fuerza=1.0):
    """Principled con (opcional) texturas Poly Haven diff/nor_gl/arm.

    Montaje compatible con el exportador glTF de Blender:
      - baseColorFactor  = Mix MULTIPLY (tex x color)
      - metallicRoughness = arm (G=rough, B=metal) via Separate Color, factores via Math MULTIPLY
      - normalTexture    = nor_gl via Normal Map
    """
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    nt = m.node_tree
    n = nt.nodes
    l = nt.links
    p = n.get("Principled BSDF")
    p.inputs['Base Color'].default_value = color
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rugosidad
    if emision is not None:
        p.inputs['Emission Color'].default_value = emision
        p.inputs['Emission Strength'].default_value = emision_fuerza
    if tex_dir:
        base = os.path.join(POLYHAVEN, tex_dir, tex_prefijo or tex_dir)
        uv = n.new('ShaderNodeUVMap')
        if usar_color_tex and os.path.exists(base + "_diff_1k.jpg"):
            td = n.new('ShaderNodeTexImage')
            td.image = cargar_imagen(base + "_diff_1k.jpg")
            l.new(uv.outputs['UV'], td.inputs['Vector'])
            mix = n.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            l.new(td.outputs['Color'], mix.inputs[6])
            mix.inputs[7].default_value = color
            l.new(mix.outputs[2], p.inputs['Base Color'])
        if os.path.exists(base + "_arm_1k.jpg"):
            ta = n.new('ShaderNodeTexImage')
            ta.image = cargar_imagen(base + "_arm_1k.jpg", no_color=True)
            l.new(uv.outputs['UV'], ta.inputs['Vector'])
            sep = n.new('ShaderNodeSeparateColor')
            l.new(ta.outputs['Color'], sep.inputs['Color'])
            mr = n.new('ShaderNodeMath'); mr.operation = 'MULTIPLY'
            mr.inputs[1].default_value = rugosidad
            l.new(sep.outputs['Green'], mr.inputs[0])
            l.new(mr.outputs[0], p.inputs['Roughness'])
            mm = n.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'
            mm.inputs[1].default_value = metal
            l.new(sep.outputs['Blue'], mm.inputs[0])
            l.new(mm.outputs[0], p.inputs['Metallic'])
        if os.path.exists(base + "_nor_gl_1k.jpg"):
            tn = n.new('ShaderNodeTexImage')
            tn.image = cargar_imagen(base + "_nor_gl_1k.jpg", no_color=True)
            l.new(uv.outputs['UV'], tn.inputs['Vector'])
            nm = n.new('ShaderNodeNormalMap')
            nm.inputs['Strength'].default_value = fuerza_normal
            l.new(tn.outputs['Color'], nm.inputs['Color'])
            l.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


def uv_caja(obj, tam_tile=0.5, nombre_uv="UV_caja"):
    """Proyección triplanar por cara (cube projection) en coordenadas de mundo.

    tam_tile = metros que ocupa una repetición de la textura. Crea/reemplaza una capa UV y
    la deja como única (glTF TEXCOORD_0)."""
    me = obj.data
    mw = obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(me)
    for lay in list(bm.loops.layers.uv.values()):
        bm.loops.layers.uv.remove(lay)
    uvl = bm.loops.layers.uv.new(nombre_uv)
    rot = mw.to_3x3()
    for f in bm.faces:
        nw = (rot @ f.normal)
        ax = max(range(3), key=lambda i: abs(nw[i]))
        for lp in f.loops:
            c = mw @ lp.vert.co
            if ax == 0:
                u, v = c.y * (1 if nw.x > 0 else -1), c.z
            elif ax == 1:
                u, v = c.x * (-1 if nw.y > 0 else 1), c.z
            else:
                u, v = c.x, c.y * (1 if nw.z > 0 else -1)
            lp[uvl].uv = (u / tam_tile, v / tam_tile)
    bm.to_mesh(me)
    bm.free()


# ---------------------------------------------------------------- render

def preparar_render_eevee(sc, res=(512, 1024)):
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = 'Standard'
    except Exception:
        pass
    world = bpy.data.worlds.new("W") if not sc.world else sc.world
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.32, 0.33, 0.36, 1)
    bg.inputs[1].default_value = 1.0
    if "Sol" not in bpy.data.objects:
        sol = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", 'SUN'))
        sol.data.energy = 3.5
        sol.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-35))
        sc.collection.objects.link(sol)
        rel = bpy.data.objects.new("Relleno", bpy.data.lights.new("Relleno", 'SUN'))
        rel.data.energy = 1.2
        rel.rotation_euler = (math.radians(70), 0, math.radians(140))
        sc.collection.objects.link(rel)
    if "CamRender" not in bpy.data.objects:
        cam = bpy.data.objects.new("CamRender", bpy.data.cameras.new("CamRender"))
        cam.data.type = 'ORTHO'
        sc.collection.objects.link(cam)
    sc.camera = bpy.data.objects["CamRender"]
    return sc.camera


def poner_camara(cam, vista, centro, escala):
    """vista: 'frente' (cámara en -Y mirando +Y), 'lado' (en +X mirando -X), 'espalda', 'arriba'."""
    cx, cy, cz = centro
    cam.data.ortho_scale = escala
    cam.data.clip_end = 100
    d = 20
    if vista == 'frente':
        cam.location = (cx, cy - d, cz); cam.rotation_euler = (math.radians(90), 0, 0)
    elif vista == 'espalda':
        cam.location = (cx, cy + d, cz); cam.rotation_euler = (math.radians(90), 0, math.radians(180))
    elif vista == 'lado':
        cam.location = (cx + d, cy, cz); cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    elif vista == 'lado_izq':
        cam.location = (cx - d, cy, cz); cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    elif vista == 'arriba':
        cam.location = (cx, cy, cz + d); cam.rotation_euler = (0, 0, 0)


def render_a_array(ruta_tmp):
    sc = bpy.context.scene
    sc.render.filepath = ruta_tmp
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(ruta_tmp)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)


def guardar_array_png(arr, ruta):
    h, w, _ = arr.shape
    img = bpy.data.images.new("comp_tmp", w, h, alpha=True)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.filepath_raw = ruta
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
