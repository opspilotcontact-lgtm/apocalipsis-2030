"""Biblioteca de animaciones compartida: FBX de Mixamo -> GLB solo-animación por categoría.

  blender -b --factory-startup --python tools/biblioteca_anim.py -- \
      --rig assets_src/mixamo/Dave_rig.fbx --dir assets_src/mixamo/anims \
      --categoria locomocion --clips Walking,Running,... --en-sitio Walking,... \
      --espejo Left_Strafe_Walking=Right_Strafe_Walking --raiz Dying,... \
      --salida assets_src/derivados/anim_locomocion_crudo.glb

- Esqueleto canónico = armature del rig de Dave (nombres mixamorig:* exactos, 41 huesos). La malla se borra.
- Cada clip se REDIRIGE copiando la pose absoluta (espacio armature) por fotograma (ver montar_personaje.py:
  los FBX sin skin no traen bind pose). Claves: rotación de todos los huesos + location solo de Hips.
  Sin pistas de escala. Muestreo = un key por fotograma a 30 fps.
- --en-sitio: quita la deriva lineal de Hips y guarda extras.velocidad_raiz_mps / direccion_raiz.
- --raiz: conserva el desplazamiento (muertes, levantarse) y marca extras.root_motion = true.
- --espejo Nuevo=Origen: genera el clip espejado (izquierda <-> derecha) en el plano X del armature.
"""
import bpy
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb  # noqa: E402
from mathutils import Matrix  # noqa: E402


def parse():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rig', required=True)
    ap.add_argument('--dir', required=True)
    ap.add_argument('--categoria', required=True)
    ap.add_argument('--clips', required=True)
    ap.add_argument('--en-sitio', default='')
    ap.add_argument('--raiz', default='')
    ap.add_argument('--espejo', action='append', default=[])
    ap.add_argument('--salida', required=True, help='GLB único, o carpeta con --por-clip')
    ap.add_argument('--por-clip', action='store_true', help='un GLB por clip: <salida>/<Nombre>.glb')
    a = ap.parse_args(cb.args_despues_de_guiones())
    a.clips = [c for c in a.clips.split(',') if c]
    a.en_sitio = set(c for c in a.en_sitio.split(',') if c)
    a.raiz = set(c for c in a.raiz.split(',') if c)
    a.salida = os.path.abspath(a.salida)
    return a


def nombre_espejo(n):
    if 'Left' in n:
        return n.replace('Left', 'Right')
    if 'Right' in n:
        return n.replace('Right', 'Left')
    return n


S = Matrix.Diagonal((-1, 1, 1, 1))


def redirigir(ruta, nombre, dst, espejo=False):
    antes_obj = set(bpy.data.objects)
    antes_act = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=ruta, use_anim=True)
    nuevos = [o for o in bpy.data.objects if o not in antes_obj]
    src = next(o for o in nuevos if o.type == 'ARMATURE')
    mallas = [o for o in nuevos if o.type != 'ARMATURE']  # algunos clips vienen "With Skin": fuera la malla
    nuevos = [o for o in nuevos if o.type == 'ARMATURE']
    for o in mallas:
        bpy.data.objects.remove(o, do_unlink=True)
    act_src = [x for x in bpy.data.actions if x not in antes_act][0]
    f0, f1 = int(round(act_src.frame_range[0])), int(round(act_src.frame_range[1]))
    sc = bpy.context.scene
    act = bpy.data.actions.new(nombre)
    act.use_fake_user = True
    dst.animation_data.action = act
    huesos = [b for b in dst.data.bones if b.name in src.pose.bones]
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        objetivo = {}
        for b in huesos:
            if espejo:
                pose_b = S @ src.pose.bones[nombre_espejo(b.name)].matrix @ S
            else:
                pose_b = src.pose.bones[b.name].matrix.copy()
            objetivo[b.name] = pose_b
            if b.parent is None:
                basis = b.matrix_local.inverted() @ pose_b
            else:
                rel = b.parent.matrix_local.inverted() @ b.matrix_local
                basis = rel.inverted() @ objetivo[b.parent.name].inverted() @ pose_b
            pb = dst.pose.bones[b.name]
            loc, rot, _ = basis.decompose()
            pb.rotation_quaternion = rot
            pb.keyframe_insert('rotation_quaternion', frame=f, group=b.name)
            if b.parent is None:
                pb.location = loc
                pb.keyframe_insert('location', frame=f, group=b.name)
    dst.animation_data.action = None
    for pb in dst.pose.bones:
        pb.matrix_basis.identity()
    for o in nuevos:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.actions.remove(act_src)
    return act


def fcurves_de(act):
    try:
        return list(act.fcurves)
    except AttributeError:
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    out.extend(bag.fcurves)
        return out


def deriva(act, arm, fps, quitar):
    fcs = [fc for fc in fcurves_de(act) if fc.data_path == 'pose.bones["mixamorig:Hips"].location']
    f0, f1 = act.frame_range
    hb = arm.data.bones["mixamorig:Hips"]
    rot = arm.matrix_world.to_3x3() @ hb.matrix_local.to_3x3()
    from mathutils import Vector
    neto = Vector((0, 0, 0))
    for fc in fcs:
        neto[fc.array_index] = fc.evaluate(f1) - fc.evaluate(f0)
    mundo = rot @ neto
    plano = Vector((mundo.x, mundo.y, 0))  # Blender Z arriba
    dur = (f1 - f0) / fps
    if quitar:
        for fc in fcs:
            v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
            eje_mundo = rot @ Vector([1 if i == fc.array_index else 0 for i in range(3)])
            if abs(eje_mundo.z) > 0.7 or abs(v1 - v0) < 2.0:  # no tocar el eje vertical ni derivas < 2 cm
                continue
            for kp in fc.keyframe_points:
                off = (v1 - v0) * (kp.co.x - f0) / (f1 - f0)
                kp.co.y -= off
                kp.handle_left.y -= off
                kp.handle_right.y -= off
            fc.update()
    vel = plano.length / dur if dur > 0 else 0.0
    # dirección en ejes glTF (x, z): Blender (x, y) -> glTF (x, -y)
    d = (plano.x / plano.length, -plano.y / plano.length) if plano.length > 1e-4 else (0.0, 0.0)
    return vel, d, mundo


def main():
    a = parse()
    cb.escena_vacia()
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(a.rig), use_anim=True)
    sc = bpy.context.scene
    arm = next(o for o in sc.objects if o.type == 'ARMATURE')
    for o in list(sc.objects):
        if o is not arm:
            bpy.data.objects.remove(o, do_unlink=True)
    arm.name = "Esqueleto_mixamorig"
    if arm.animation_data and arm.animation_data.action:
        v = arm.animation_data.action
        arm.animation_data.action = None
        bpy.data.actions.remove(v)
    if not arm.animation_data:
        arm.animation_data_create()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    fps = 30
    sc.render.fps, sc.render.fps_base = 30, 1.0
    espejos = dict(e.split('=', 1) for e in a.espejo)
    for nombre in a.clips:
        origen = espejos.get(nombre, nombre)
        ruta = os.path.join(os.path.abspath(a.dir), origen + '.fbx')
        act = redirigir(ruta, nombre, arm, espejo=nombre in espejos)
        sc.render.fps, sc.render.fps_base = 30, 1.0  # el importador FBX puede cambiarlo
        vel, d, mundo = deriva(act, arm, fps, quitar=nombre in a.en_sitio)
        act["fps"] = 30
        act["duracion_s"] = round((act.frame_range[1] - act.frame_range[0]) / fps, 3)
        if nombre in a.en_sitio:
            act["en_sitio"] = True
            act["velocidad_raiz_mps"] = round(vel, 4)
            act["direccion_raiz_xz"] = [round(d[0], 3), round(d[1], 3)]
        if nombre in a.raiz:
            act["root_motion"] = True
            act["desplazamiento_raiz_m"] = round(mundo.length, 3)
        if nombre in espejos:
            act["espejo_de"] = espejos[nombre]
        tr = arm.animation_data.nla_tracks.new()
        tr.name = nombre
        st = tr.strips.new(nombre, int(act.frame_range[0]), act)
        try:
            st.action_slot = act.slots[0]
        except Exception:
            pass
        tr.mute = True
        print(f"[clip] {nombre:24s} {act['duracion_s']:6.2f} s  deriva {tuple(round(x, 2) for x in mundo)} m"
              f"{'  EN SITIO %.2f m/s' % vel if nombre in a.en_sitio else ''}{'  ROOT MOTION' if nombre in a.raiz else ''}")
        if a.por_clip:
            os.makedirs(a.salida, exist_ok=True)
            exportar(arm, os.path.join(a.salida, nombre + '.glb'))
            arm.animation_data.nla_tracks.remove(tr)
            act.use_fake_user = False
            bpy.data.actions.remove(act)
    if not a.por_clip:
        exportar(arm, a.salida)


def exportar(arm, ruta):
    cb.seleccionar([arm], arm)
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', use_selection=True,
                              export_yup=True, export_skins=False, export_def_bones=False,
                              export_animations=True, export_animation_mode='ACTIONS',
                              export_force_sampling=False, export_extras=True,
                              export_optimize_animation_size=True, export_reset_pose_bones=True,
                              export_materials='NONE')
    print("[glb] ->", ruta)


main()
