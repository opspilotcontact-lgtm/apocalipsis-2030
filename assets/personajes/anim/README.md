# Biblioteca de clips (Mixamo → esqueleto mixamorig canónico)

Un clip por archivo: `assets/personajes/anim/<Nombre>.glb` (solo esqueleto + 1 animación, meshopt). 30 fps, pistas de rotación de los 41 huesos + traslación de Hips, sin escala.
Generado con `tools/biblioteca_anim.py` (redirección por pose absoluta sobre el rig de Dave) y verificado en three r170 con `tools/verificar_clips_three.mjs` (41/41 OK; Walking idéntico al Walk de Dave_animado, Δ 0,0000 m).

- **en_sitio**: deriva de raíz quitada; `extras.velocidad_raiz_mps` y `extras.direccion_raiz_xz` (ejes glTF; +Z = hacia delante del personaje).
- **root_motion**: desplazamiento conservado (muertes, levantarse); `extras.desplazamiento_raiz_m`.
- Left_Strafe_Walking = espejo de Right_Strafe_Walking.
- Gunplay dura 0,2 s en el FBX original (es casi una pose).
- three sanea los nombres: `mixamorig:Hips` → `mixamorigHips` (igual en personaje y clip, así que encajan).

| Clip | Duración (s) | Tipo | Velocidad (m/s) | KB |
|---|---|---|---|---|
| Big_Side_Hit | 1.467 | — |  | 98 |
| Big_Stomach_Hit | 1.4 | — |  | 94 |
| Breathing_Idle | 9.933 | — |  | 554 |
| Cross_Punch | 2 | — |  | 127 |
| Crouched_Walking | 1.033 | en sitio [0,1] | 1.2894 | 75 |
| Crying | 6.267 | — |  | 357 |
| Dying | 4.4 | root motion 0.846 m |  | 258 |
| Dying_v1 | 6.833 | root motion 0 m |  | 389 |
| Dying_v2 | 3.7 | root motion 1.284 m |  | 220 |
| Falling_Back_Death | 2.6 | root motion 1.108 m |  | 160 |
| Falling_Back_Death_v1 | 2.6 | root motion 1.108 m |  | 160 |
| Firing_Rifle | 1 | — |  | 74 |
| Getting_Up | 2.7 | root motion 0.762 m |  | 165 |
| Getting_Up_v1 | 7.6 | root motion 0.995 m |  | 430 |
| Gunplay | 0.2 | — |  | 30 |
| Head_Hit | 1.533 | — |  | 102 |
| Hit_Reaction | 2.733 | — |  | 166 |
| Injured_Idle | 9.333 | — |  | 517 |
| Injured_Walk | 1.633 | en sitio [0,1] | 1.1573 | 109 |
| Kicking | 2.167 | — |  | 136 |
| Left_Strafe_Walking | 1.033 | en sitio [1,0] | 1.5675 | 76 |
| Mutant_Punch | 1.1 | — |  | 79 |
| Mutant_Walking | 1.433 | en sitio [0,1] | 1.1853 | 97 |
| Nervously_Look_Around | 6.267 | — |  | 358 |
| Pistol_Idle | 8.3 | — |  | 471 |
| Pointing | 3.6 | — |  | 213 |
| Punching | 1 | — |  | 73 |
| Reloading | 3.3 | — |  | 198 |
| Rifle_Aiming_Idle | 3.1 | — |  | 186 |
| Rifle_Idle | 2.833 | — |  | 172 |
| Right_Strafe_Walking | 1.033 | en sitio [-1,0] | 1.5675 | 76 |
| Running | 0.633 | en sitio [0,1] | 5.3581 | 55 |
| Sad_Idle | 2.667 | — |  | 162 |
| Sitting | 1.167 | — |  | 83 |
| Sitting_Talking | 44.067 | — |  | 2400 |
| Standing_Arguing | 20.8 | — |  | 1146 |
| Talking_On_Phone | 38.833 | — |  | 2115 |
| Walking | 1.033 | en sitio [0,1] | 1.6166 | 75 |
| Walking_Backwards | 1.2 | en sitio [0,-1] | 1.0255 | 85 |
| Waving | 4.733 | — |  | 276 |
| Zombie_Walk | 4.033 | en sitio [0,1] | 0.3095 | 235 |
