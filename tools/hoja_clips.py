"""Hoja de contacto: aplica clips de assets_src/derivados/anim_crudo/<Nombre>.glb a un personaje animado y renderiza
3 fotogramas (inicio, 40 %, 80 %) por clip, una fila por clip.
  blender -b --factory-startup --python tools/hoja_clips.py -- --personaje assets_src/derivados/Dave_animado_crudo.glb \
      --clips Walking,Dying --salida assets_src/derivados/renders/anim_hoja1.png"""
import bpy, os, sys, math, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb
import numpy as np
ap = argparse.ArgumentParser()
ap.add_argument('--personaje', required=True); ap.add_argument('--clips', required=True); ap.add_argument('--salida', required=True)
ap.add_argument('--dir', default=os.path.join(cb.RAIZ, 'assets_src', 'derivados', 'anim_crudo'))
a = ap.parse_args(cb.args_despues_de_guiones())
cb.escena_vacia()
bpy.ops.import_scene.gltf(filepath=os.path.abspath(a.personaje))
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
if not arm.animation_data: arm.animation_data_create()
for tr in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(tr)
cam = cb.preparar_render_eevee(sc, (320, 400))
tmp = os.path.abspath(a.salida) + "_t.png"
filas = []
for n in a.clips.split(','):
    antes = set(bpy.data.objects); antes_a = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(a.dir, n + '.glb'))
    act = [x for x in bpy.data.actions if x not in antes_a][0]
    for o in [o for o in bpy.data.objects if o not in antes]: bpy.data.objects.remove(o, do_unlink=True)
    arm.animation_data.action = act
    try: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    f0, f1 = act.frame_range; fila = []
    for t in (0.0, 0.4, 0.8):
        sc.frame_set(int(f0 + (f1 - f0) * t)); bpy.context.view_layer.update()
        hips = arm.matrix_world @ arm.pose.bones['mixamorig:Hips'].head
        th = math.radians(35)
        cam.location = (hips.x + 20 * math.sin(th), hips.y - 20 * math.cos(th), 0.9)
        cam.rotation_euler = (math.radians(90), 0, th); cam.data.ortho_scale = 2.3
        fila.append(cb.render_a_array(tmp))
    filas.append(np.concatenate(fila, 1)); print("[hoja]", n, round((f1 - f0) / 30, 2), "s")
os.remove(tmp)
cb.guardar_array_png(np.concatenate(filas[::-1], 0), os.path.abspath(a.salida))
