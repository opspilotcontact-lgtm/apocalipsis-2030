"""Arreglo de alfa de TRELLIS.2: el baseColor trae ALFA bajo (pelo ~55/255) aunque el material es OPAQUE y Blender
lo oscurece al reutilizarlo. Reescribe el baseColor en RGB (alfa 1) y exporta <salida>.glb (mismo mesh y UV).
  blender -b --factory-startup --python tools/trellis_alfa.py -- assets_src/ia3d/John.glb assets_src/ia3d/John_fix.glb
"""
import bpy, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb
ent, sal = [os.path.abspath(p) for p in cb.args_despues_de_guiones()[:2]]
cb.escena_vacia()
bpy.ops.import_scene.gltf(filepath=ent)
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    p = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if p is None:
        continue
    for l in list(p.inputs['Alpha'].links):
        m.node_tree.links.remove(l)
    p.inputs['Alpha'].default_value = 1.0
    try:
        m.blend_method = 'OPAQUE'
    except Exception:
        pass
    for l in p.inputs['Base Color'].links:
        im = getattr(l.from_node, 'image', None)
        if im is None:
            continue
        w, h = im.size
        px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px)
        px = px.reshape(-1, 4); print(f"[alfa] {im.name}: alfa mediana {np.median(px[:, 3]):.2f} -> 1")
        px[:, 3] = 1.0
        im.pixels.foreach_set(px.ravel()); im.alpha_mode = 'NONE'; im.update()
for im in bpy.data.images:
    if im.source in ('FILE', 'GENERATED'):
        im.file_format = 'PNG'
bpy.ops.export_scene.gltf(filepath=sal, export_format='GLB', export_image_format='AUTO')
print("[glb] ->", sal)
