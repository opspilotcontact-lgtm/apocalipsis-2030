"""Turnaround alta vs baja (frente, 3/4, lado, 3/4 trasero, espalda) a 1024 px de alto por panel.

  blender -b --factory-startup --python tools/render_comparativa.py -- \
      --alta C:/.../Dave.glb --altura 1.80 --baja assets_src/derivados/Dave_crudo.glb --nombre Dave

Paneles: por cada ángulo, [alta | baja]. La alta se normaliza igual que en optimizar_personaje.py
(transformación de nodo + escala a la altura real + pies en 0). La baja es el GLB crudo de Blender
(misma geometría y texturas que el final; Blender no importa KTX2 ni meshopt).
"""
import bpy
import math
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb  # noqa: E402
import numpy as np  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--alta', required=True)
ap.add_argument('--baja', required=True)
ap.add_argument('--altura', type=float, required=True)
ap.add_argument('--nombre', required=True)
ap.add_argument('--alto-px', type=int, default=1024)
a = ap.parse_args(cb.args_despues_de_guiones())
dir_render = os.path.join(cb.RAIZ, 'assets_src', 'derivados', 'renders')
os.makedirs(dir_render, exist_ok=True)

cb.escena_vacia()


def importar(ruta):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=ruta)
    nuevos = [o for o in bpy.data.objects if o not in antes]
    malla = [o for o in nuevos if o.type == 'MESH']
    raiz = bpy.data.objects.new("raiz_" + os.path.basename(ruta), None)
    bpy.context.scene.collection.objects.link(raiz)
    for o in nuevos:
        if o.parent is None:
            o.parent = raiz
    return raiz, malla


alta, malla_alta = importar(a.alta)
bpy.context.view_layer.update()
zs = [(m.matrix_world @ v.co).z for m in malla_alta for v in m.data.vertices]
xs = [(m.matrix_world @ v.co).x for m in malla_alta for v in m.data.vertices]
ys = [(m.matrix_world @ v.co).y for m in malla_alta for v in m.data.vertices]
s = a.altura / (max(zs) - min(zs))
alta.scale = (s, s, s)
alta.location = (-(max(xs) + min(xs)) / 2 * s, -(max(ys) + min(ys)) / 2 * s, -min(zs) * s)
baja, malla_baja = importar(a.baja)

sc = bpy.context.scene
cam = cb.preparar_render_eevee(sc, (a.alto_px // 2, a.alto_px))
h = a.altura
paneles = []
tmp = os.path.join(dir_render, "_tmp_cmp.png")
for ang in (0, 45, 90, 135, 180):
    for raiz, mallas in ((alta, malla_alta), (baja, malla_baja)):
        for m in malla_alta:
            m.hide_render = raiz is not alta
        for m in malla_baja:
            m.hide_render = raiz is not baja
        r = 20
        th = math.radians(ang)
        cam.location = (r * math.sin(th), -r * math.cos(th), h / 2)
        cam.rotation_euler = (math.radians(90), 0, th)
        cam.data.ortho_scale = h * 1.06
        paneles.append(cb.render_a_array(tmp))
os.remove(tmp)
ruta = os.path.join(dir_render, f"{a.nombre}_turnaround_alta_vs_baja.png")
cb.guardar_array_png(np.concatenate(paneles, axis=1), ruta)
print("[render] ->", ruta)
