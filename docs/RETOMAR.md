# Apocalipsis 2030 · Documento de traspaso (23-nov-2026)

> Para retomar el proyecto en una sesión nueva sin contexto previo. Léelo entero antes de tocar nada.
> Fuente de verdad viva: `docs/PLAN-MAESTRO.md` (fases, reglas, §9 estado). Este documento resume y prioriza.

---

## 0. Prompt para pegar en una sesión nueva

```
Retoma el proyecto Apocalipsis 2030 (juego WebXR para Meta Quest 3 y PC).
Repo: C:\Users\NIBI\Documents\GitHub\apocalipsis-2030 (público en GitHub: opspilotcontact-lgtm/apocalipsis-2030, rama master, publicado en https://opspilotcontact-lgtm.github.io/apocalipsis-2030/).

Antes de nada lee, en este orden: docs/RETOMAR.md (este traspaso), docs/PLAN-MAESTRO.md (§1-2 pilares, §6 reglas, §9 estado), y solo después el documento de la tarea concreta (historia-acto1.md, diseno-vr.md, eventos.md, actor-glb.md, qa-acto1.md…).

Reglas obligatorias:
- Nunca dejar el juego roto: antes de cada commit, prueba de humo en un servidor local (menú sin errores de consola y window.__cap(i) para i=0..7 carga sin excepciones). Si falla y no se arregla rápido, revertir ese cambio.
- Modo ahorro de tokens: lee solo lo necesario, máximo 3-4 capturas por tarea, una pestaña de navegador que cierras al acabar, informes cortos.
- Commits convencionales en español, SIN atribución a IA ni Co-Authored-By. Nunca subir assets_src/. Tras cada commit sano: git push (actualiza GitHub Pages).
- Un dueño por área si usas agentes en paralelo (ver PLAN §6) y contratos en docs/eventos.md.
- Puertas de calidad: muestra pequeña → OK del usuario → producción en serie.
- Responde al usuario en español rioplatense, directo y cálido.

Tarea de hoy: [ELEGIR DE LA SECCIÓN 6 DE RETOMAR.md, por defecto "Bloque 1 · La receta de la farola" + la lista de pulido que traiga el usuario].
Al terminar cada bloque: actualiza PLAN §9 y la sección 5 de RETOMAR.md.
```

---

## 1. Qué es

Shooter narrativo de supervivencia en primera persona para **Meta Quest 3 (WebXR) y PC**, lineal y cerrado como Resident Evil / Half-Life: Alyx, realismo pintado tipo Red Dead Redemption 2. Promesa: *"Todo lo que ves se puede tocar, y todo lo que tocas cuenta la historia."*

Historia en 3 actos (biblia original: artifact claude.ai `8JgDNuvR78Jr4QMQPXn2fy`): Acto I en la Tierra (Dave, su hermano Mike y el casco neural; robots despiertan; robo de la ORION-4), Acto II en el espacio (gravedad cero; mueren Hank, John y Dave), Acto III como Unidad 01 (la copia robótica de Dave). 3 finales.

## 2. Cómo se ejecuta y prueba

| Para | Cómo |
|---|---|
| Jugar online (Quest o PC) | https://opspilotcontact-lgtm.github.io/apocalipsis-2030/ — en Quest: navegador → «Entrar en VR». `?stats` muestra fps/llamadas/memoria |
| Páginas de prueba | `/tools/ver-dave.html` (personaje animado), `/tools/prueba-combate.html`, `/tools/prueba-interaccion.html`, `/tools/prueba-gravedad.html` (Acto II) |
| Servidor local de desarrollo | `python -m http.server 8737` en la raíz del repo → http://127.0.0.1:8737 |
| Servidor local restringido (sin listar assets_src) | `scratchpad/servir_juego.py` (puerto 8740) — los scripts de servidor están en la carpeta temporal de la sesión anterior; si no existen, basta `http.server` |
| Quest por WiFi sin internet | servidor HTTPS en LAN con certificado autofirmado (`servir_lan.py`, puerto 8743, IP del PC 192.168.1.149) — aceptar el aviso de certificado en Quest |
| Consola de depuración | `__cap(n)` capítulo · `__paso(n)` paso · `__dbg()` estado · `__tp(x,z,yaw)` · `__inmune()` · `__evento(nombre)` · `__perf({subir:true})` · `__juego` · `__inter` · `__mem` |

Capítulos (`__cap`): 0 Prólogo · 1 La última cena · 2 Robots en la calle · 3 El laboratorio acordonado · 4 La tienda de armas · 5 La banda · 6 Asalto a la base · 7 Epílogo (órbita).

Herramientas instaladas en el PC: Blender 5.3, KTX-Software 4.4.2 (toktx), 7-Zip, cloudflared, Node 24, Python 3.11, gh CLI (cuenta opspilotcontact-lgtm). GPU: RTX 5060 Laptop 8 GB.

## 3. Arquitectura (archivos clave)

| Área | Archivos |
|---|---|
| Núcleo (render, materiales PBR/KTX2, cielo, capas, colisiones, luces, horneado, recorte por niebla) | `js/nucleo.js`, `js/perf.js`, `js/main.js` |
| Mundo | `js/mundo/tierra.js` (mapa + `PUNTOS` de la historia), `decorado.js` (interiores), `fachadas.js` (edificios y escaparates), `atmosfera.js` (lluvia, niebla, ola de El Rey), `espacio.js` |
| Historia | `js/historia/director.js` (motor de pasos), `acto1.js` (guion jugable), `actores.js`; `js/personajes/` (fichas, memoria, conversación-stub) |
| Jugador | `js/jugador.js` (armas, movimiento PC/VR), `js/ui.js` |
| Combate | `js/combate/*` (Rapier, ragdoll, daño por zonas, heridas/atlas, lesiones, oído, `actor.js` = personajes GLB con esqueleto) , `js/enemigos.js` |
| Interacción física | `js/interaccion/*` (objetos agarrables, roturas, escritura, piano, muebles, sigilo, fundas/recarga, pickup, cabina ORION, ruido, opciones de comodidad, reloj) |
| Sistemas de juego | `js/juego/*` (ecos del pasado, cámaras de seguridad, linterna, baloncesto, IA de PNJ, guía visual, música adaptativa, avatar de Dave, variabilidad, minijuegos) |
| Acto II prototipo | `js/espacio/*` + `tools/prueba-gravedad.html` |
| Pipeline 3D | `tools/*.py|mjs` (optimizar/hornear personajes, auto-rig propio con esqueleto de Dave, partir robots, finalizar KTX2, verificar clips) — ver `tools/README.md` |
| Assets | `assets/personajes/*_animado.glb` + `anim/*.glb` (41 clips Mixamo), `assets/armas/X56D.glb`, `assets/props/*` (21 Poly Haven), `assets/texturas/*.ktx2`, `assets/hdri`, `assets/sonido`. Licencias en `assets/MANIFIESTO.json` y `assets_src/CREDITOS.md` |

## 4. Lo hecho (resumen por bloques, ver `git log`)

- **Base WebXR**: mundo (pueblo, casa de Dave, tienda de Hank, laboratorio, base militar, órbita), director de historia, combate, interacción, rendimiento.
- **Acto I jugable** (8 capítulos, QA completo sin atascos — `docs/qa-acto1.md`): misiones con rutas alternativas, sigilo, escolta, cámaras de seguridad que revisa el jugador, ecos del pasado (chip neural), elecciones con memoria de personajes, 4 giros de guion, onboarding sin carteles en el prólogo, guía visual progresiva estilo RE, zonas seguras con guardado, escasez de munición.
- **Combate**: Rapier, ragdolls, 16 zonas de daño, heridas variadas que envejecen (bala, corte, moratón, salpicaduras direccionales), desmembramiento con malla real, huesos rotos (NPC y jugador), robots que oyen e investigan, escopeta, curas físicas.
- **Interacción VR**: objetos que se agarran/lanzan/rompen, escribir en pizarras, piano, puertas/cajones, taquillas para esconderse, romper cristales, fundas en el cuerpo, recarga física, interior de la pickup, cabina física de la ORION-4, reloj de muñeca, opciones de comodidad.
- **Personajes 3D**: Dave y Hank (HY3D → 22k tris, KTX2, Mixamo), Mike (TRELLIS), Unidad 01, El Rey y Coloso con auto-rig propio; 41 animaciones compartidas; X-56D real.
- **Mundo**: texturas PBR Poly Haven en KTX2, HDRI por hora, lluvia/charcos, niebla de altura, ola de El Rey, decorado de interiores, fachadas variadas con escaparates de interior falso (fotos Gemini), 21 objetos realistas.
- **Variedad**: semilla por partida (botín, eventos de calle, patrullas), minijuegos (galería de tiro, dardos, piano de Lucía, HORSE con Nico, valla de la base, radio oculta), coleccionables.
- **Rendimiento**: texturas < 140 MB en el peor capítulo; llamadas de dibujo < 250 en todos (recorte por niebla).
- **Guiones**: `docs/historia-acto1.md`, `historia-acto2.md` (jugable), `historia-acto3-estructura.md`; prototipo de gravedad cero.

## 5. Estado y deuda conocida (actualizar)

- **Probado por el usuario en VR (23-nov)**: «no va mal, falta pulir mucho»; lo mejor: la carretera mojada de noche con farola («calidad triple A»). El usuario traerá una lista de pulido.
- **Pendiente A2.2**: John, Lena, R-7 real y escopeta Arda con TRELLIS.2 (cupo gratis ≈ 2 generaciones/día con su token HF), luego integrarlos.
- **Sin probar en VR**: fundas/recarga física, agarre a dos manos, cabina, gesto de ecos, botones de cámaras con el dedo, dardos, cables de la valla, orientación de herramientas en la mano, «pop-in» del recorte por niebla al girar rápido.
- **Deuda**: luz plana en interiores y de día (ver Bloque 1), personajes por código de ~25 piezas (enemigos), sombras caras en lab/prólogo, cap. 3 justo en 247 llamadas, la taquilla del cap. 3 por vía alternativa no mete al jugador dentro, agarre a dos manos del casco no forzado en VR, reacciones de PNJ a minijuegos solo subtítulos, la valla de la base solo es ruta real a pie.
- **Licencias**: Dave, Hank, Unidad 01, El Rey, Coloso salen de HY3D (licencia que excluye la UE) y las fotos de escaparates de Gemini → `comercial:false` en el manifiesto. El usuario aceptó publicarlo así para pruebas; antes de cualquier venta hay que sustituirlos.
- **Seguridad**: el token de HuggingFace del usuario quedó pegado en un chat → recordarle rotarlo (Settings → Access Tokens) y volver a `setx HF_TOKEN`.
- **Limitaciones del entorno**: el Chrome automatizado NO descarga archivos (las descargas las hace el usuario o se usan APIs/curl); Meshy solo descarga gratis el modelo «6 Lite»; Hi3D solo descarga de pago (no saltarse muros de pago); Mixamo requiere que el usuario pulse descargar.

## 6. Propuestas para continuar (en orden de prioridad)

### Bloque 1 · «La receta de la farola» (calidad visual triple A en todo)
**Por qué la carretera mojada se ve AAA**: material fotográfico de alta calidad en lo que más se mira (suelo), superficies que reflejan (mojado = rugosidad baja), una luz fuerte con caída real y contraste, oscuridad y niebla que esconden la geometría simple, movimiento (lluvia en estéreo da profundidad), sonido envolvente.
**Por qué lo demás no**: luz ambiente plana sin sombras de contacto ni esquinas oscuras, materiales sin variación de rugosidad, casi nada refleja, de día se ve todo, mundo quieto.
**Plan** (empezar por laboratorio y casa de Dave, puerta de calidad con el usuario, después tienda, base y calles de día):
1. **Iluminación horneada (lightmaps) en Blender** con rebotes, sombras suaves y oclusión ambiental (Cycles en la RTX 5060), segundo canal UV, aplicada como `lightMap`/`aoMap` en three.js. Mayor impacto y casi gratis en Quest.
2. Luces locales con charcos de luz en cada interior (estilo RE: rincones oscuros, caminos iluminados) en lugar de luz ambiente.
3. Sondas de reflejo por zona (cubemaps estáticos) para metales, cristales y suelos.
4. Capa de suciedad/desgaste/humedad: variación de rugosidad y color por posición, bordes gastados, zonas húmedas.
5. Partículas baratas: polvo en haces de luz, vapor, hojas, insectos en farolas.
6. Corrección de color por escena (paleta y contraste propios).
Medir siempre `?stats` (llamadas < 250, texturas < 140 MB en Quest).

### Bloque 2 · Lista de pulido del usuario
Convertirla en tareas con prioridad (P0 bloqueante en VR, P1 sensación, P2 detalle), agruparlas por dueño de área y ejecutarlas con puertas de calidad.

### Bloque 3 · Personajes que faltan
Completar A2.2 (John, Lena, R-7, Arda) e integrarlos; sustituir enemigos humanos/robots por código por actores GLB (menos piezas, mejor aspecto); Sarah necesita concepto (Gemini en el Chrome del usuario + captura con save_to_disk) → TRELLIS/Meshy Lite → auto-rig.

### Bloque 4 · Acto II jugable (Fase 3)
Integrar el prototipo de gravedad cero en el juego: ORION-4 en órbita, nave *Talos-9*, Lena, agencia *Centinela*, batalla del campo de restos y las tres muertes (ver `historia-acto2.md`; aprobar con el usuario los añadidos: Talos-9, Centinela, comandante Okafor, guarda Ibarra, códigos LZR-0002/0770, cápsula 6).

### Bloque 5 · Más adelante
Acto III (Unidad 01, conversión de robots, director de misiones, finales), conversación con IA por voz (proxy servidor + fichas/memoria ya preparadas), sustitución de assets no comerciales antes de cualquier venta.

## 7. Preferencias del usuario (importante)

- Jugable > narrado; referentes: Resident Evil (cerrado, lineal, vivo), Half-Life: Alyx (física e interacción), RDR2/GTA (detalle y cariño), The Last of Us (ambiente que cuenta).
- Quiere ver una muestra de calidad antes de producir en serie.
- Preocupado por el gasto de tokens: agentes en modo ahorro, informes cortos, no rehacer trabajo.
- Le gusta que se trabaje de forma autónoma durante horas, con commits sanos y avisos al terminar.
- Valora mucho la sensación en VR: comodidad, manos, que todo se pueda tocar.
