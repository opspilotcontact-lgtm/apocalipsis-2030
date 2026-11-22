# tools/ — pipeline de assets 3D (Apocalipsis 2030, Quest 3 / three r170)

Requisitos: Blender 5.3 (`C:\Program Files\Blender Foundation\Blender 5.3\blender.exe`), Node 24,
`npx @gltf-transform/cli@4.5.1`, KTX-Software 4.4.2 (`C:\Program Files\KTX-Software\bin`, lo añade `finalizar.mjs` al PATH solo).

| Script | Qué hace |
|---|---|
| `comun_blender.py` | utilidades compartidas (GPU Cycles, materiales PBR Poly Haven, UV triplanar, render Eevee) |
| `optimizar_personaje.py` | HY3D alta → baja con bake (base color, metal/rough, normal) + LOD1 + FBX Mixamo + renders |
| `montar_personaje.py` | rig de Mixamo (FBX With Skin) + material horneado + animaciones Mixamo redirigidas → GLB animado + renders por animación |
| `render_comparativa.py` | turnaround alta vs baja (0/45/90/135/180°) a 1024 px de alto por panel |
| `partir_robot.py` | robot Mixamo skinned → 15 piezas rígidas emparentadas a huesos + tapas `M_Corte` + PBR |
| `finalizar.mjs` | dedup → weld → prune → resize → KTX2 (o WebP) → meshopt |
| `inspeccionar_glb.mjs` | lee el JSON de un GLB: tris, skins, animaciones, bounds reales (descuantizados), texturas por slot, empties |

## Cargar en three r170 (IMPORTANTE)

Los GLB finales usan `EXT_meshopt_compression` + `KHR_mesh_quantization` y texturas `KHR_texture_basisu` (KTX2).
Sin estos decoders el GLTFLoader falla:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ktx2 = new KTX2Loader()
  .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/')
  .detectSupport(renderer);            // renderer = WebGLRenderer ya creado
const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
```

Cada GLB KTX2 tiene una copia `*_webp.glb` (EXT_texture_webp) como fallback; esa solo necesita `MeshoptDecoder`.
Recomendado en Quest: KTX2 (menos VRAM, subida a GPU sin decodificar). WebP pesa menos en descarga pero ocupa RGBA completo en VRAM.

## Convenciones de salida
- Personajes: metros reales, pies en y=0, centrados en XZ, cara mirando a **+Z** glTF.
- Robots partidos: ver `partir_robot.py`. Cada pieza es un `Mesh` normal (NO SkinnedMesh) hijo del hueso `mixamorig:*`;
  `userData` (extras) = `{pieza, hueso}`. Para desmembrar: `scene.attach(pieza)` y física. `M_Corte` es compartido:
  clonarlo por pieza antes de subirle la emisión (sale con emisión 0.6 para que no brille con el robot entero).
- No hay skin en los robots partidos (gltf-transform `prune` quita la skin vacía); las 7 animaciones mueven los huesos.

## Registro de comandos (22-nov-2026)

```bash
B="/c/Program Files/Blender Foundation/Blender 5.3/blender.exe"
M=C:/Users/NIBI/Downloads/Apoc2030_Modelos3D
R=C:/Users/NIBI/Downloads/Apocalipsis2030_AssetPack_v0.1/Apocalipsis2030_AssetPack/Personajes_Robots

# 1) orientación (todos los HY3D ya miran a +Z glTF: --rot-z 0)
"$B" -b --factory-startup --python tools/optimizar_personaje.py -- --entrada $M/Dave.glb --nombre Dave --altura 1.80 --solo-render-alta

# 2) personaje: decimado 22k + bake 2048 + LOD1 12k (1024) + FBX Mixamo + renders  (~30-60 s cada uno con OptiX)
"$B" -b --factory-startup --python tools/optimizar_personaje.py -- --entrada $M/Dave.glb --nombre Dave --altura 1.80
#   (Hank 1.78, Unidad01 1.85, El_Rey 2.05, Coloso 2.60: YA HORNEADOS en assets_src/derivados/*_crudo.glb, sin finalizar
#    a la espera del visto bueno de la muestra Dave)
"$B" -b --factory-startup --python tools/render_comparativa.py -- --alta $M/Dave.glb --altura 1.80 --baja assets_src/derivados/Dave_crudo.glb --nombre Dave

# 3) robots
"$B" -b --factory-startup --python tools/partir_robot.py -- --entrada $R/Soldado_R7.glb --salida assets_src/derivados/R7_partes_crudo.glb --render assets_src/derivados/renders/R7_partes.png --tapar-abiertos
"$B" -b --factory-startup --python tools/partir_robot.py -- --entrada $R/Unidad01_Dave.glb --salida assets_src/derivados/Unidad01_partes_crudo.glb --render assets_src/derivados/renders/Unidad01_partes.png --tapar-abiertos

# 4) finalizar (KTX2 + copia WebP)
node tools/finalizar.mjs assets_src/derivados/Dave_crudo.glb assets/personajes/Dave.glb --tex ktx2 --tam 2048 --fallback-webp
node tools/finalizar.mjs assets_src/derivados/Dave_LOD1_crudo.glb assets/personajes/Dave_LOD1.glb --tex ktx2 --tam 1024 --fallback-webp
node tools/finalizar.mjs assets_src/derivados/R7_partes_crudo.glb assets/robots/R7_partes.glb --tex ktx2 --tam 1024 --fallback-webp

# 5) verificar
node tools/inspeccionar_glb.mjs assets/personajes/Dave.glb assets/robots/R7_partes.glb
```

`finalizar.mjs` ejecuta por dentro:
```
gltf-transform dedup | weld | prune | resize --width T --height T
gltf-transform etc1s --slots "{baseColorTexture,emissiveTexture,metallicRoughnessTexture,occlusionTexture}" --quality 160
gltf-transform uastc --slots normalTexture --level 2 --rdo --rdo-lambda 2 --zstd 18
gltf-transform meshopt --level medium
# fallback: ... resize -> webp --quality 88 -> meshopt
```

## Personaje animado (Mixamo) — 22-nov

```bash
# FBX copiados de Downloads: Dave_mixamo_ligero.fbx -> assets_src/mixamo/Dave_rig.fbx,
#   Breathing Idle -> anim_idle.fbx, Walking -> anim_walk.fbx, Head Hit -> anim_headhit.fbx
"$B" -b --factory-startup --python tools/montar_personaje.py -- --rig assets_src/mixamo/Dave_rig.fbx --nombre Dave --altura 1.80   --tex-dir assets_src/derivados/Dave_tex --referencia assets_src/derivados/Dave_crudo.glb   --anim Idle=assets_src/mixamo/anim_idle.fbx --anim Walk=assets_src/mixamo/anim_walk.fbx --anim HitHead=assets_src/mixamo/anim_headhit.fbx   --en-sitio Walk --salida assets_src/derivados/Dave_animado_crudo.glb --render-dir assets_src/derivados/renders
node tools/finalizar.mjs assets_src/derivados/Dave_animado_crudo.glb assets/personajes/Dave_animado.glb --tex ktx2 --tam 2048 --tam-normal 1024 --fallback-webp
```
- La velocidad de raíz del Walk (quitada para dejarlo en el sitio) va en `gltf.animations[i].extras.velocidad_raiz_mps`
  (three: `clip.userData` no lo recibe; leerla de `gltf.parser.json.animations[i].extras`). Walk = 1.617 m/s.

## Lecciones / trampas
- **FBX de animación de Mixamo "Without Skin" NO trae bind pose**: Blender toma otra pose como reposo (manos a 66 cm
  de las del rig). Asignar la acción tal cual rompe los brazos. `montar_personaje.py` copia la pose ABSOLUTA
  hueso a hueso y recalcula la basis contra el reposo del rig.
- Mixamo devuelve la malla en T-pose: para comprobar UV no sirven las posiciones; se comparan las UV por cara
  (21.998/22.000 idénticas y en el mismo orden → no hace falta Data Transfer, que con poses distintas rompería los brazos).
- **HY3D trae vértices partidos en las costuras UV**: sin soldar (`--soldar 0.0002`, merge by distance) los rayos
  del bake se cuelan por las grietas y salen rayas negras en cara y ropa. Soldado: 295k → 250k vértices en Dave.
- **UV**: conservar las UV originales de HY3D (decimadas) da islas grandes; `smart_project` sobre la malla decimada
  generaba miles de islas diminutas (`--uv smart` sigue disponible).
- **bmesh**: tras varios `from_mesh` en la misma bmesh los `.index` quedan repetidos → hay que `index_update()`
  (si no, los pesos se cruzan entre extremidades).
- Los robots del pack son conchas separadas por segmento: el reparto por isla (`--dominio 0.6`) da cortes limpios;
  las tapas `M_Corte` cierran los bordes abiertos de cada concha (`--tapar-abiertos`).
- `metal_plate` de Poly Haven es chapa lagrimada (diamantes): se descartó para la carcasa; se usa rugosidad + normal
  de `rusty_metal_02` (normal 0.35) sobre el color plano.
- La normal UASTC 2048 pesa ~4.2 MB (ruido de alta frecuencia; zstd apenas comprime). Si pesa demasiado: normal a 1024.
- Blender no importa KTX2/meshopt: las comparativas se renderizan con el `*_crudo.glb` (misma geometría y texturas).

## Producción 22-nov (tarde)
```bash
# Hank animado (mismo arreglo de redirección)
"$B" -b --factory-startup --python tools/montar_personaje.py -- --rig assets_src/mixamo/Hank_rig.fbx --nombre Hank --altura 1.78 --tex-dir assets_src/derivados/Hank_tex --referencia assets_src/derivados/Hank_crudo.glb --anim Idle=assets_src/mixamo/anims/Breathing_Idle.fbx --anim Walk=assets_src/mixamo/anims/Walking.fbx --anim HitHead=assets_src/mixamo/anims/Head_Hit.fbx --en-sitio Walk --salida assets_src/derivados/Hank_animado_crudo.glb --render-dir assets_src/derivados/renders
node tools/finalizar.mjs assets_src/derivados/Hank_animado_crudo.glb assets/personajes/Hank_animado.glb --tex ktx2 --tam 2048 --tam-normal 1024 --fallback-webp
# biblioteca: un GLB por clip (41 = 40 FBX + Left_Strafe_Walking espejado)
"$B" -b --factory-startup --python tools/biblioteca_anim.py -- --rig assets_src/mixamo/Dave_rig.fbx --dir assets_src/mixamo/anims --categoria todas --clips <lista> --en-sitio Walking,Running,Walking_Backwards,Right_Strafe_Walking,Left_Strafe_Walking,Crouched_Walking,Injured_Walk,Mutant_Walking,Zombie_Walk --raiz Getting_Up,Getting_Up_v1,Dying,Dying_v1,Dying_v2,Falling_Back_Death,Falling_Back_Death_v1 --espejo Left_Strafe_Walking=Right_Strafe_Walking --por-clip --salida assets_src/derivados/anim_crudo
for f in assets_src/derivados/anim_crudo/*.glb; do gltf-transform resample $f tmp.glb; gltf-transform meshopt tmp.glb assets/personajes/anim/$(basename $f) --level medium; done
# verificación con three r170 real (npm i three@0.170.0 en una carpeta temporal y copiar ahí el script)
node verificar_clips_three.mjs <raiz del repo>
# Mike (TRELLIS no-manifold: el collapse se atascaba en 63k) y fusil X56D
"$B" -b --factory-startup --python tools/optimizar_personaje.py -- --entrada assets_src/ia3d/Mike_fix.glb --nombre Mike --altura 1.75 --sin-fbx --uv smart --angulo-uv 66 --remesh 0.003 --extrusion 0.005 --rayo 0.012
"$B" -b --factory-startup --python tools/fbx_ligero.py -- assets_src/derivados/Mike_crudo.glb assets_src/derivados/Mike_mixamo_ligero.fbx
"$B" -b --factory-startup --python tools/optimizar_personaje.py -- --entrada assets_src/ia3d/Fusil_X56D.glb --nombre X56D --altura 0.429 --rot-z 180 --tris 10000 --tris-lod 5000 --tex 1024 --tex-lod 512 --uv smart --angulo-uv 66 --remesh 0.0015 --extrusion 0.003 --rayo 0.008 --sin-fbx --sin-render
"$B" -b --factory-startup --python tools/montar_arma.py -- --entrada assets_src/derivados/X56D_crudo.glb --salida assets_src/derivados/X56D_montado_crudo.glb --empunadura=-0.167,0.160 --boca-z 0.309 --render assets_src/derivados/renders/X56D_anclas.png
node tools/finalizar.mjs assets_src/derivados/X56D_montado_crudo.glb assets/armas/X56D.glb --tex ktx2 --tam 1024 --fallback-webp
```
Trampas nuevas: el importador glTF deja `rotation_mode = QUATERNION` (rotation_euler no hace nada → ahora `--rot-z` usa matrix_world);
`gltf-transform prune` borraba los empties de anclaje (ahora `--keep-leaves true`); renderizar en Blender clips de OTRO GLB sobre
un personaje GLB no sirve (cada importación inventa su reposo) → se verifica en three.

## Auto-rig propio (sin Mixamo) — 22-nov noche
| Script | Qué hace |
|---|---|
| `autorig.py` | estático A-pose → esqueleto `mixamorig` de Dave ajustado (longitudes a lo largo de cada hueso, roll intacto → rotaciones de reposo idénticas a Dave) + pesos + Idle/Walk/HitHead |
| `verificar_rig_three.mjs` | three r170: carga cada GLB riggeado y aplica sus clips + Walking/Running/Head_Hit de la biblioteca (cadera/cabeza/pies) |

```bash
"$B" -b --factory-startup --python tools/autorig.py -- --entrada assets_src/derivados/Mike_crudo.glb --nombre Mike --tex-dir assets_src/derivados/Mike_tex --anim Idle=assets_src/mixamo/anims/Breathing_Idle.fbx --anim Walk=assets_src/mixamo/anims/Walking.fbx --anim HitHead=assets_src/mixamo/anims/Head_Hit.fbx --en-sitio Walk --salida assets_src/derivados/Mike_animado_crudo.glb --render-dir assets_src/derivados/renders
#   igual Unidad01, El_Rey; Coloso además: --piernas medir --pesos auto
node tools/finalizar.mjs assets_src/derivados/Mike_animado_crudo.glb assets/personajes/Mike_animado.glb --tex ktx2 --tam 2048 --tam-normal 1024 --fallback-webp
node verificar_rig_three.mjs <raiz> assets/personajes/Mike_animado_webp.glb ...   # desde una carpeta con three@0.170.0
```
- **Trampa**: el reposo del rig de Mixamo (Dave_rig.fbx) es el bind pose = la A-pose que se subió; la T-pose es solo la
  acción importada. Quitar la acción NO resetea los pose bones (se quedan en T): hay que `matrix_basis.identity()`.
- Los clips compartidos solo llevan rotaciones + traslación de Hips (en unidades de Dave). Por eso la escala va en el
  objeto armature (= altura × proporción de pierna) y las piernas no se estiran en unidades de hueso: la cadera del clip pisa el suelo.
- Pesos: por defecto `transferir` (pesos de Dave llevados al esqueleto ajustado por LBS y Data Transfer nearest-face-interpolated):
  más limpio en ropa ancha (bata de Mike). `auto` (heat) falla en HY3D/TRELLIS sin soldar; se intenta sobre copia soldada y,
  si falla, sobre remallado por vóxeles a ×10 de escala (heat falla en medidas pequeñas). Heat va mejor en robots (Coloso).
- Los vértices partidos por costuras UV reciben el peso del vértice soldado (sin grietas al deformar).
