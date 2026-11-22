# Apocalipsis 2030 · WebXR

Shooter narrativo en primera persona para **PC y Meta Quest** en el navegador (three.js 0.170 + WebXR, sin build).
Historia: biblia del juego (artifact «Apocalipsis 2030», borrador 0.1). Esta base contiene el **Acto I completo** (prólogo + 5 capítulos + epílogo en órbita).

## Cómo arrancarlo

```bash
python -m http.server 8737     # en la carpeta del proyecto
# PC: http://127.0.0.1:8737
```

En las Quest, WebXR exige **HTTPS**. Opciones: publicar la carpeta en GitHub Pages, o servirla con un túnel HTTPS (cloudflared / ngrok) y abrir esa URL en el navegador de las gafas.

## Estructura

| Archivo | Qué hace |
|---|---|
| `js/nucleo.js` | render, materiales, cielo y hora, **capas** del mundo (tierra / calma / caos / espacio), construcción, colisiones, fusión de geometría y grupo de 6 luces que se reparte entre las fuentes cercanas |
| `js/fx.js` | chispas, trazadoras, escombros, fundidos (funcionan dentro de VR) y sonido procedural |
| `js/cuerpos.js` | robots y humanos por código (mismo esqueleto y animación) y carga de `.glb` |
| `js/jugador.js` | movimiento PC/VR, armas, disparo, golpes físicos, objetos que se usan o se agarran |
| `js/enemigos.js` | robots R-7 y sigilo (guardias con linterna, focos, medidor de detección) |
| `js/vehiculos.js` | pickup conducible y viajes guiados (camión, ORION-4) |
| `js/npcs.js` | personajes de la historia |
| `js/mundo/tierra.js` | el mapa (pueblo, casa, tienda, laboratorio, base) y `PUNTOS` de la historia |
| `js/mundo/espacio.js` | órbita: Tierra, asteroides, campo de restos, La Corona |
| `js/historia/director.js` | motor de historia con puntos de control |
| `js/historia/acto1.js` | **el guion**: cada capítulo es una lista de pasos |

## Escribir historia

Un capítulo es un objeto con `prep()` y `pasos`. Tipos de paso: `dialogo`, `ir`, `usar`, `subir`, `conducir`, `oleada`, `resistir`, `sigilo`, `viaje`, `fundido`, `fn`, `esperar`, `fin`. Un paso con `cp: { punto }` es punto de control (al morir o ser visto se vuelve ahí).

Consola de depuración: `__cap(n)` capítulo, `__paso(n)` paso, `__dbg()` estado, `__tp(x,z,yaw)` teletransporte, `__inmune()`.

## Créditos

Casco neural: «Damaged Helmet» de theblueturtle_, CC BY 4.0. Personajes, camión y ORION-4: modelos del dossier (Tencent HY 3D a partir de los conceptos) y del pack de blockout propio.
