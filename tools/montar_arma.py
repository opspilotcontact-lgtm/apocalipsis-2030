"""Coloca un arma horneada (salida de optimizar_personaje.py) con la empuñadura en el origen y empties de anclaje.

  blender -b --factory-startup --python tools/montar_arma.py -- \
      --entrada assets_src/derivados/X56D_crudo.glb --salida assets_src/derivados/X56D_montado_crudo.glb \
      --empunadura Y,Z --boca-z Z [--render assets_src/derivados/renders/X56D_montado.png]

Convenciones (glTF): cañón hacia -Z (= +Y en Blender), empuñadura en el origen, Y arriba.
- --empunadura Y,Z: punto de agarre de la mano (coordenadas Blender del crudo, x=0).
- --boca-z Z: altura del eje del cañón; la boca se pone en la punta (máx. Y de los vértices cerca del eje).
- Empties: "Empunadura" (origen) y "Boca". Sin --empunadura solo renderiza la vista lateral con rejilla de 5 cm.
"""
import bpy
import os
import sys
import math
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb  # noqa: E402
import numpy as np  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--entrada', required=True)
ap.add_argument('--salida', default=None)
ap.add_argument('--empunadura', default=None)
ap.add_argument('--boca-z', type=float, default=None)
ap.add_argument('--render', default=None)
a = ap.parse_args(cb.args_despues_de_guiones())

cb.escena_vacia()
bpy.ops.import_scene.gltf(filepath=os.path.abspath(a.entrada))
m = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
co = np.array([m.matrix_world @ v.co for v in m.data.vertices])
print("[arma] bounds", co.min(0).round(3), co.max(0).round(3))

if a.empunadura:
    gy, gz = [float(x) for x in a.empunadura.split(',')]
    cerca = co[np.hypot(co[:, 0], co[:, 2] - a.boca_z) < 0.02]
    boca = (0.0, float(cerca[:, 1].max()), a.boca_z)
    m.location = (0, -gy, -gz)
    cb.seleccionar([m], m)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    for nombre, p in (("Empunadura", (0, 0, 0)), ("Boca", (0, boca[1] - gy, boca[2] - gz))):
        e = bpy.data.objects.new(nombre, None)
        e.empty_display_size = 0.03
        e.location = p
        bpy.context.scene.collection.objects.link(e)
        print(f"[ancla] {nombre} blender {tuple(round(x, 3) for x in p)} -> glTF {(round(p[0], 3), round(p[2], 3), round(-p[1], 3))}")

if a.render:
    sc = bpy.context.scene
    co = np.array([m.matrix_world @ v.co for v in m.data.vertices])
    mn, mx = co.min(0), co.max(0)
    for i in range(-30, 31):  # rejilla 5 cm en el plano YZ, detrás del arma
        for eje in (1, 2):
            bpy.ops.mesh.primitive_cube_add(size=1)
            c = bpy.context.object
            grueso = 0.0012 if i else 0.003
            c.scale = (0.001, 3, grueso) if eje == 2 else (0.001, grueso, 3)
            c.location = (-0.15, 0, i * 0.05) if eje == 2 else (-0.15, i * 0.05, 0)
    for e in [o for o in sc.objects if o.type == 'EMPTY']:  # marcar anclas con esferas rojas
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.008, location=e.location)
        s = bpy.context.object
        mat = bpy.data.materials.new("rojo"); mat.use_nodes = True
        mat.node_tree.nodes["Principled BSDF"].inputs['Emission Color'].default_value = (1, 0, 0, 1)
        mat.node_tree.nodes["Principled BSDF"].inputs['Emission Strength'].default_value = 5
        s.data.materials.append(mat)
        s.location.x = 0.08
    cam = cb.preparar_render_eevee(sc, (1536, 768))
    cb.poner_camara(cam, 'lado', ((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2), (mx[1] - mn[1]) * 1.15)
    arr = cb.render_a_array(os.path.abspath(a.render) + "_t.png")
    os.remove(os.path.abspath(a.render) + "_t.png")
    cb.guardar_array_png(arr, os.path.abspath(a.render))
    for o in [o for o in sc.objects if o.type == 'MESH' and o is not m]:
        bpy.data.objects.remove(o, do_unlink=True)

if a.salida and a.empunadura:
    objs = [m] + [o for o in bpy.context.scene.objects if o.type == 'EMPTY']
    cb.seleccionar(objs, m)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(a.salida), export_format='GLB', use_selection=True,
                              export_yup=True, export_materials='EXPORT', export_image_format='AUTO',
                              export_animations=False, export_extras=True)
    print("[glb] ->", a.salida)
