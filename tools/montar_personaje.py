"""Monta un personaje riggeado por Mixamo con el material horneado y sus animaciones -> GLB.

  blender -b --factory-startup --python tools/montar_personaje.py -- \
      --rig assets_src/mixamo/Dave_rig.fbx --nombre Dave --altura 1.80 \
      --tex-dir assets_src/derivados/Dave_tex --referencia assets_src/derivados/Dave_crudo.glb \
      --anim Idle=assets_src/mixamo/anim_idle.fbx --anim Walk=assets_src/mixamo/anim_walk.fbx \
      --anim HitHead=assets_src/mixamo/anim_headhit.fbx --en-sitio Walk \
      --salida assets_src/derivados/Dave_animado_crudo.glb --render-dir assets_src/derivados/renders

1. Importa el FBX riggeado (With Skin, T-pose). Comprueba que la malla conserva topología y UV
   comparando con el GLB de referencia (mismo nº de caras; UV por esquina en la misma posición).
   Si no coinciden, transfiere UV con Data Transfer (nearest face interpolated) desde la referencia.
2. Aplica el material PBR horneado (<nombre>_basecolor / _metalrough / _normal .png).
3. Importa cada FBX de animación (Without Skin), renombra la acción y la cuelga como pista NLA
   del armature del rig. --en-sitio quita la deriva lineal de la raíz (Hips) en el plano del suelo y
   guarda la velocidad (m/s) en la custom prop de la acción (-> extras de la animación en glTF).
4. Escala: el armature de Mixamo viene a 0.01 (cm) con rot X 90; se deja así (el exportador glTF
   lo resuelve) y se verifica la altura del mesh evaluado. Frente = -Y Blender = +Z glTF.
5. Exporta GLB (todas las acciones) y renderiza 3 fotogramas por animación.
"""
import bpy
import os
import sys
import math
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_blender as cb  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402


def parse():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rig', required=True)
    ap.add_argument('--nombre', required=True)
    ap.add_argument('--altura', type=float, required=True)
    ap.add_argument('--tex-dir', required=True)
    ap.add_argument('--referencia', default=None)
    ap.add_argument('--anim', action='append', default=[], help='Nombre=ruta.fbx')
    ap.add_argument('--en-sitio', action='append', default=[])
    ap.add_argument('--salida', required=True)
    ap.add_argument('--render-dir', default=None)
    a = ap.parse_args(cb.args_despues_de_guiones())
    a.salida = os.path.abspath(a.salida)
    return a


def material_horneado(nombre, tex_dir):
    def img(sufijo, no_color):
        im = bpy.data.images.load(os.path.join(os.path.abspath(tex_dir), f"{nombre}_{sufijo}.png"))
        if no_color:
            im.colorspace_settings.name = 'Non-Color'
        return im
    m = bpy.data.materials.new(f"M_{nombre}")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = img('basecolor', False)
    nt.links.new(tc.outputs['Color'], p.inputs['Base Color'])
    tm = nt.nodes.new('ShaderNodeTexImage'); tm.image = img('metalrough', True)
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(tm.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], p.inputs['Roughness'])
    nt.links.new(sep.outputs['Blue'], p.inputs['Metallic'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img('normal', True)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m


def coords_mundo(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    n = len(me.vertices)
    co = np.empty(n * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    M = np.array(obj.matrix_world)
    co = co @ M[:3, :3].T + M[:3, 3]
    ev.to_mesh_clear()
    return co


def _uv_por_esquina_no_usado(obj):
    """dict posición redondeada (mm) -> set de UV redondeadas, en espacio de mundo (pose de reposo)."""
    me = obj.data
    co = coords_mundo(obj)
    nl = len(me.loops)
    vi = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', vi)
    uv = np.empty(nl * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    d = {}
    for k in range(nl):
        key = tuple(np.round(co[vi[k]] * 1000).astype(int))
        d.setdefault(key, set()).add(tuple(np.round(uv[k] * 2048).astype(int)))
    return d


def uv_por_cara(obj):
    """multiconjunto de caras descritas por sus UV (redondeadas a texel 2048): independiente de la
    pose (Mixamo devuelve la malla en T-pose, así que las posiciones NO sirven para comparar)."""
    me = obj.data
    nl = len(me.loops)
    uv = np.empty(nl * 2, np.float32)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = np.round(uv.reshape(-1, 2) * 4096).astype(np.int64)
    caras = []
    for p in me.polygons:
        c = sorted(tuple(uv[k]) for k in range(p.loop_start, p.loop_start + p.loop_total))
        caras.append(tuple(c))
    return caras


def comprobar_y_transferir_uv(malla, ref_path):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(ref_path))
    ref = next(o for o in bpy.data.objects if o not in antes and o.type == 'MESH')
    c_rig, c_ref = uv_por_cara(malla), uv_por_cara(ref)
    mismo_orden = sum(1 for x, y in zip(c_rig, c_ref) if x == y)
    set_ref = set(c_ref)
    presentes = sum(1 for x in c_rig if x in set_ref)
    print(f"[uv] caras rig/ref {len(c_rig)}/{len(c_ref)}; mismas UV en el mismo orden {mismo_orden}; "
          f"caras del rig cuyas UV existen en la ref {presentes}")
    coincide = len(c_rig) == len(c_ref) and presentes >= 0.98 * len(c_rig)
    if not coincide:
        # Fallback: transferencia por cercanía. OJO: solo es válida si ambas mallas están en la
        # misma pose; con un rig en T-pose y la ref en A-pose los brazos saldrían mal.
        print("[uv] NO coinciden -> Data Transfer (nearest face interpolated) desde la referencia")
        mod = malla.modifiers.new('uv_ref', 'DATA_TRANSFER')
        mod.object = ref
        mod.use_loop_data = True
        mod.data_types_loops = {'UV'}
        mod.loop_mapping = 'POLYINTERP_NEAREST'
        mod.use_object_transform = True
        cb.seleccionar([malla], malla)
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(ref, do_unlink=True)
    return coincide


def importar_accion(ruta, nombre, arm_destino):
    """Importa un FBX de animación de Mixamo (Without Skin) y la REDIRIGE al rig.

    Ojo: un FBX sin skin no trae bind pose, así que Blender toma como 'reposo' otra pose distinta
    a la del rig (las manos quedan a ~66 cm). Copiar la acción tal cual (rotaciones locales) deja
    los brazos rotos. Se copia la pose ABSOLUTA (espacio armature) hueso a hueso y fotograma a
    fotograma y se recalcula la matrix_basis contra el reposo del rig:
        basis = (rest_p^-1 @ rest_b)^-1 @ pose_p^-1 @ pose_b
    """
    antes_obj = set(bpy.data.objects)
    antes_act = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(ruta), use_anim=True)
    nuevos = [o for o in bpy.data.objects if o not in antes_obj]
    src = next(o for o in nuevos if o.type == 'ARMATURE')
    act_src = [a for a in bpy.data.actions if a not in antes_act][0]
    f0, f1 = int(round(act_src.frame_range[0])), int(round(act_src.frame_range[1]))
    sc = bpy.context.scene
    dst = arm_destino
    act = bpy.data.actions.new(nombre)
    act.use_fake_user = True
    dst.animation_data.action = act
    huesos = [b for b in dst.data.bones if b.name in src.pose.bones]  # orden jerárquico
    for pb in dst.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        objetivo = {}
        for b in huesos:
            pose_b = src.pose.bones[b.name].matrix.copy()
            objetivo[b.name] = pose_b
            if b.parent is None:
                basis = b.matrix_local.inverted() @ pose_b
            else:
                rel = b.parent.matrix_local.inverted() @ b.matrix_local
                pose_p = objetivo.get(b.parent.name, dst.pose.bones[b.parent.name].matrix)
                basis = rel.inverted() @ pose_p.inverted() @ pose_b
            pb = dst.pose.bones[b.name]
            loc, rot, _ = basis.decompose()
            pb.location = loc
            pb.rotation_quaternion = rot
            pb.keyframe_insert('rotation_quaternion', frame=f, group=b.name)
            if b.parent is None:
                pb.keyframe_insert('location', frame=f, group=b.name)
    dst.animation_data.action = None
    for pb in dst.pose.bones:
        pb.matrix_basis.identity()
    for o in nuevos:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.actions.remove(act_src)
    return act


def fcurves_de(act):
    """fcurves de una acción (API por capas/slots de Blender 4.4+ o la clásica)."""
    try:
        return list(act.fcurves)
    except AttributeError:
        pass
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def quitar_deriva_raiz(act, arm, fps):
    """Resta la rampa lineal (inicio->fin) de la location de Hips en los ejes con desplazamiento neto.
    Devuelve la velocidad en m/s en espacio de mundo."""
    fcs = [fc for fc in fcurves_de(act) if fc.data_path == 'pose.bones["mixamorig:Hips"].location']
    f0, f1 = act.frame_range
    durac = (f1 - f0) / fps
    neto = Vector((0, 0, 0))
    for fc in fcs:
        v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
        neto[fc.array_index] = v1 - v0
    # eje "arriba" del hueso en reposo no se toca: solo los ejes cuyo neto es grande frente al rebote
    for fc in fcs:
        v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
        if abs(v1 - v0) < 2.0:  # cm: menos de 2 cm de deriva -> nada
            continue
        for kp in fc.keyframe_points:
            t = (kp.co.x - f0) / (f1 - f0)
            off = (v1 - v0) * t
            kp.co.y -= off
            kp.handle_left.y -= off
            kp.handle_right.y -= off
        fc.update()
    # neto en espacio local del hueso (cm) -> mundo (m): escala del armature y orientación del hueso
    hb = arm.data.bones["mixamorig:Hips"]
    mundo = (arm.matrix_world.to_3x3() @ hb.matrix_local.to_3x3()) @ neto
    vel = mundo.length / durac if durac > 0 else 0.0
    print(f"[raiz] {act.name}: deriva {tuple(round(x, 3) for x in mundo)} m en {durac:.2f} s -> {vel:.3f} m/s (quitada)")
    return vel, tuple(mundo)


def main():
    a = parse()
    cb.escena_vacia()
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(a.rig), use_anim=True)
    sc = bpy.context.scene
    arm = next(o for o in sc.objects if o.type == 'ARMATURE')
    malla = next(o for o in sc.objects if o.type == 'MESH')
    arm.name = f"{a.nombre}_Armature"
    malla.name = a.nombre
    # fuera la acción de T-pose que trae el rig
    if arm.animation_data and arm.animation_data.action:
        viejo = arm.animation_data.action
        arm.animation_data.action = None
        bpy.data.actions.remove(viejo)
    print(f"[rig] {len(arm.data.bones)} huesos, malla {len(malla.data.vertices)} v / {len(malla.data.polygons)} caras, UV {[u.name for u in malla.data.uv_layers]}")

    if a.referencia:
        comprobar_y_transferir_uv(malla, a.referencia)

    malla.data.materials.clear()
    malla.data.materials.append(material_horneado(a.nombre, a.tex_dir))
    cb.limpiar_normales_custom(malla)

    co = coords_mundo(malla)
    alto = float(co[:, 2].max() - co[:, 2].min())
    print(f"[escala] alto en reposo {alto:.3f} m (objetivo {a.altura})")
    if abs(alto - a.altura) > 0.01:
        f = a.altura / alto
        arm.scale = tuple(s * f for s in arm.scale)
        bpy.context.view_layer.update()
        print(f"[escala] corregida x{f:.4f}")

    fps = sc.render.fps / sc.render.fps_base
    if not arm.animation_data:
        arm.animation_data_create()
    acciones = []
    for spec in a.anim:
        nombre, ruta = spec.split('=', 1)
        act = importar_accion(ruta, nombre, arm)
        if nombre in a.en_sitio:
            vel, neto = quitar_deriva_raiz(act, arm, fps)
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
        print(f"[anim] {nombre}: frames {tuple(act.frame_range)} fcurves {len(fcurves_de(act))}")

    if a.render_dir:
        render_anims(a, arm, malla, acciones)

    cb.seleccionar([arm, malla], arm)
    bpy.ops.export_scene.gltf(filepath=a.salida, export_format='GLB', use_selection=True,
                              export_yup=True, export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_image_format='AUTO',
                              export_skins=True, export_def_bones=False, export_animations=True,
                              export_animation_mode='ACTIONS', export_extras=True,
                              export_force_sampling=True, export_optimize_animation_size=True,
                              export_reset_pose_bones=True, export_tangents=False)
    print("[glb] ->", a.salida)


def render_anims(a, arm, malla, acciones):
    sc = bpy.context.scene
    rd = os.path.abspath(a.render_dir)
    os.makedirs(rd, exist_ok=True)
    cam = cb.preparar_render_eevee(sc, (512, 1024))
    tmp = os.path.join(rd, "_tmp_anim.png")
    h = a.altura
    for act in acciones:
        arm.animation_data.action = act
        try:
            if act.slots:
                arm.animation_data.action_slot = act.slots[0]
        except Exception:
            pass
        f0, f1 = act.frame_range
        paneles = []
        for t in (0.0, 0.35, 0.7):
            sc.frame_set(int(round(f0 + (f1 - f0) * t)))
            for ang in (0, 45, 90):
                th = math.radians(ang)
                cam.location = (20 * math.sin(th), -20 * math.cos(th), h * 0.52)
                cam.rotation_euler = (math.radians(90), 0, th)
                cam.data.ortho_scale = h * 1.12
                paneles.append(cb.render_a_array(tmp))
        ruta = os.path.join(rd, f"{a.nombre}_anim_{act.name}.png")
        cb.guardar_array_png(np.concatenate(paneles, axis=1), ruta)
        print("[render] ->", ruta)
    arm.animation_data.action = None
    os.remove(tmp)
    sc.frame_set(1)


main()
