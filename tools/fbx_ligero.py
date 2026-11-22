"""FBX ligero (solo geometría, sin texturas) para subir a Mixamo: <1 MB.
  blender -b --factory-startup --python tools/fbx_ligero.py -- entrada_crudo.glb salida.fbx
Las UV (UV_bake) se conservan: Mixamo las respeta y el material horneado se reaplica luego con montar_personaje.py."""
import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb
ent, sal = [os.path.abspath(p) for p in cb.args_despues_de_guiones()[:2]]
cb.escena_vacia()
bpy.ops.import_scene.gltf(filepath=ent)
m = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
m.data.materials.clear()
cb.seleccionar([m], m)
bpy.ops.export_scene.fbx(filepath=sal, use_selection=True, object_types={'MESH'}, apply_unit_scale=True,
                         apply_scale_options='FBX_SCALE_ALL', axis_forward='-Z', axis_up='Y',
                         mesh_smooth_type='OFF', add_leaf_bones=False, path_mode='STRIP',
                         embed_textures=False, bake_anim=False)
print("[fbx]", sal, os.path.getsize(sal))
