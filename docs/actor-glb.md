# ActorGLB — personajes .glb con esqueleto mixamorig (`js/combate/actor.js`)

## Uso
```js
import { precargarActor, crearActor, cargarClips } from './combate/actor.js';
await precargarActor('Dave_animado');            // assets/personajes/Dave_animado.glb (KTX2 + meshopt)
await cargarClips(['Running', 'Injured Walk']);  // opcional: assets/personajes/anim/<Nombre>.glb (los que falten se ignoran)
const a = crearActor('Dave_animado', { altura: 1.78 });   // clon con SkeletonUtils
scene.add(a.root); a.root.position.set(x, 0, z);
// cada fotograma:
a.actualizar(dt, { vel, mirar: V3|null, ataque: 0..1|-1, cojera, cojeraLado, aturdido, dolor, rotos: { legL, armR… } });
```
- `a.reproducir(nombre)` bucle con fundido · `a.unDisparo(nombre)` golpe/gesto encima.
- `a.reaccion(zona)` clip de golpe por zona si existe (tabla `ALIAS`), si no, capa procedural (`dolor`).
- `a.herida(punto, dir, tipo, dmg, swing, hueso)` pinta la herida en su textura de daño (se deforma con la malla).
- `a.desmembrar('head'|'armL'|'foreArmR'|'legL'|'shinR', dir)` · `a.morir({ dir, fuerza, zona, punto })` → ragdoll.
- `a.hit` hitboxes invisibles por hueso con `userData.zona` (para rayos y golpes VR) · `a.H` huesos por nombre.

## Enemigos
`spawn('villano', x, z, { modelo: 'Dave_animado', ruta, arma, hp })` — hay que precargar antes; si no, cae al humano por código.

## Clips (biblioteca)
Un clip por archivo en `assets/personajes/anim/<Nombre>.glb`, esqueleto mixamorig, «en el sitio»; velocidad de raíz en
`animations[0].extras.velocidad_raiz_mps`. Sustitutos en `ALIAS` (idle, walk, run, cojo, punch, golpeCabeza, golpeTorso, golpeLado, morir…).
Sin clip: locomoción con Idle/Walk acelerado, puñetazo y brazo roto por huesos, cojera procedural.

## NPC (para la historia)
Mismo `crearActor` + `actualizar(dt, { vel, mirar })`; no hace falta el combate.
