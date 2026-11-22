# Apocalipsis 2030 · Plan maestro

> Fuente única de verdad. Antes de empezar cualquier tarea: leer este archivo. Al terminarla: actualizar su estado aquí (sección 9) y en `docs/backlog-vr.md`.
> Documentos hijos: `historia-acto1.md` (guion), `diseno-vr.md` (diseño VR), `backlog-vr.md` (tareas), `eventos.md` (contratos entre sistemas), `actor-glb.md` (personajes con esqueleto), `pendientes-mundo.md`.

---

## 1. Qué es y qué no es

**Shooter narrativo de supervivencia en primera persona para Meta Quest 3 (WebXR) y PC.** Lineal y cerrado como Resident Evil 2/7/Village o Half-Life: Alyx: pocas zonas, densas, que se re-visitan cambiadas. Realismo pintado tipo Red Dead Redemption 2.

**Promesa al jugador:** *"Todo lo que ves se puede tocar, y todo lo que tocas cuenta la historia."*

**No es:** un mundo abierto, un juego de oleadas, una película con pausas para disparar.

### Pilares (cada decisión se justifica contra uno)
1. **La historia se juega, no se escucha.** Las revelaciones se encuentran, se ven en ecos, se reproducen en monitores y cintas.
2. **Tensión con respiro.** Ritmo Resident Evil: exploración tensa → encuentro → zona segura (casa, tienda de Hank) → avance.
3. **Física honesta.** Si parece agarrable, se agarra. Si parece frágil, se rompe. Los robots se desmontan, los humanos sangran.
4. **El pasado vive en el lugar.** Ecos del chip neural: cada zona guarda lo que pasó ahí.
5. **Cómodo en VR.** Nada que maree; 72 fps estables en Quest 3.

---

## 2. Lo que aprendemos de quien lo hace bien (y por qué funciona)

| Referente | Qué hace | Por qué funciona | Cómo lo aplicamos |
|---|---|---|---|
| **Resident Evil 2 Remake** | Comisaría cerrada que se abre poco a poco con llaves/objetos; vuelves a sitios conocidos con otra amenaza | El jugador aprende el espacio y la tensión viene de conocerlo | El pueblo se re-visita 3 veces cambiado (calma → ataque → amanecer). Puertas/cajones que se abren con objetos (llave de Mike, placa de John, cizalla) |
| **RE2/RE7 · guía visual** | Pintura amarilla en lo escalable, brillo en objetos, mapa que marca habitaciones exploradas en rojo/azul | Guía sin flechas: el ojo va solo | Lenguaje visual propio: **ámbar** = interactuable importante (luz suave/reflejo), **cinta amarilla** = ruta física (escalar, romper), **neón cian** = tecnología de Mike, **rojo** = El Rey. Brillo intermitente solo tras X s sin progreso |
| **RE · zonas seguras** | Sala de guardado con música calma y baúl | Respiro emocional y ritmo | La casa de Dave y la tienda de Hank son zonas seguras: guardado (grabadora/diario), banco de trabajo, sin enemigos |
| **RE · escasez** | Pocas balas, decidir cuándo pelear | Tensión constante | Munición escasa en Acto I; sigilo y objetos lanzables como alternativa real |
| **Half-Life: Alyx** | Tutorial dentro del mundo (balcón inicial: tocar, coger, lanzar) | Se aprende jugando, sin carteles | El prólogo enseña TODO sin texto: abrir cajón, coger el casco con dos manos, girar la llave del coche, conducir |
| **Alyx · física narrativa** | Objetos que cuentan historia (notas, fotos, pizarras) | Recompensa la curiosidad | Cintas de Mike, notas, contestador, pizarras con pistas, fotos de la familia |
| **The Last of Us** | Ambiente que narra (cuerpos, mensajes en paredes) | Historia sin diálogo | Mensajes de supervivientes en paredes, coches abandonados con objetos, rastro de los saqueadores |
| **Saints & Sinners** | Combate cuerpo a cuerpo físico, sigilo, ruido | Cada pelea es distinta | Golpe real con piedra/cuchillo, ruido que atrae, distracción con botellas |
| **Red Dead 2** | Mundo que sigue viviendo; momentos pequeños (jugar, charlar) | El jugador se encariña | Básquet con el chico del parque, perro/gato, supervivientes con rutinas |

### Reglas de guía (no "para tontos")
1. **Primero el entorno, después la ayuda.** La luz y la composición guían (camino más iluminado, puerta enmarcada).
2. **Ayuda progresiva:** a los 60 s sin progreso → brillo suave en lo importante; a los 120 s → Dave lo comenta ("La ventana de atrás…"); nunca flechas permanentes.
3. **Objetivo siempre consultable** en el reloj (VR) / Tab (PC), con frase de Dave, no de sistema.
4. **Opción "guía clásica"** (marcador visible) en el panel de comodidad, apagada por defecto.

---

## 3. Introducción a las mecánicas (onboarding dentro de la historia)

| Momento | Mecánica que enseña | Cómo (sin carteles) |
|---|---|---|
| Prólogo · entrar al lab | Moverse, girar, mirar | Mike llama desde el fondo; luz cálida marca el camino |
| Prólogo · cajón de Mike | Abrir cajones, coger objetos | Mike: "Pásame el destornillador del cajón" |
| Prólogo · casco | Agarrar a dos manos, llevar a la cabeza | Mike te lo tiende |
| Prólogo · pizarra | Escribir | Mike te pide firmar el "consentimiento" (broma) |
| Prólogo · coche | Llave, volante, pedales | Llave colgando en el contacto, brilla al acercarte |
| Cena | Interacción social, mirar | Mirar la foto/dibujo |
| Cap. 2 · jardín | Combate cuerpo a cuerpo con objeto | La piedra; el primer robot llega lento y de frente |
| Cap. 2 · calle | Esconderse, distraer | Robot que escanea; botella a mano para lanzarla |
| Cap. 3 · lab | Romper cristal, sigilo, taquilla, ecos | Cinta amarilla en la ventana trasera; primer eco obligatorio |
| Cap. 4 · tienda | Armas, recarga física, fundas | Hank te da el fusil sin cargador y te coloca el chaleco |
| Cap. 6 · base | Walkie, cabina | John te habla por radio paso a paso |

Cada mecánica se enseña una vez, se usa con presión después y se combina más tarde (aprender → aplicar → dominar).

---

## 4. Fases de implementación

Estado: ✅ hecho · 🟡 en curso · ⬜ pendiente

### Fase 0 · Base técnica ✅
Motor WebXR, mundo, director de historia, combate/física, interacción, pipeline de personajes, commit inicial `7609313`, túnel de prueba.

### Fase 1 · Jugable de verdad (Acto I) 🟡 ← AHORA
1. 🟡 Misiones jugables (no narradas), ritmo sin diálogo durante combate, coche bloqueado en el cordón
2. 🟡 Ecos del pasado, cámaras de seguridad, linterna, básquet, IA de PNJ
3. ⬜ Onboarding (sección 3) y lenguaje visual de guía (sección 2)
4. ⬜ Zonas seguras + guardado + mapa/diario en el reloj
5. ⬜ Escasez y economía (munición, botiquines) por capítulo
6. ⬜ **Prueba en Quest** y lista de arreglos (protocolo, sección 7)
**Puerta de calidad F1:** el usuario juega prólogo→cap. 3 en Quest sin atascarse, sin mareo y diciendo "esto es un juego".

### Fase 2 · Que se vea y se sienta (Acto I) ⬜
1. Personajes: Hank animado, Mike/John/Lena/Sarah (fuentes sección 5), Unidad 01/El Rey/Coloso rigueados
2. Biblioteca de 40 animaciones Mixamo integrada en actores y PNJ (🟡 Blender)
3. Objetos realistas (Poly Haven/Smithsonian/NASA) sustituyendo cajas en lo que se agarra
4. Exposición nocturna ✅, memoria de texturas ✅ < 140 MB (peor capítulo 138 MB en PC, 23-nov; < 120 pendiente: personajes 2048), vida ambiental (viento, pájaros, humo)
5. Sonido: música adaptativa (calma/tensión/combate), ambiente por zona
**Puerta F2:** capturas comparables a la referencia RDR2/RE en 5 lugares; 72 fps en Quest.

### Fase 3 · Acto II (espacio) ⬜
Gravedad cero, nave equivocada, Lena, batalla del campo de restos, muerte del grupo.

### Fase 4 · Acto III (Unidad 01) ⬜
Despertar, conversión de robots (mano en el núcleo), misiones abiertas con director, ecos de Dave, finales.

### Fase 5 · Conversación con IA y pulido final ⬜
Proxy servidor para LLM (fichas + memoria ya preparadas), voces, accesibilidad, rendimiento, sustitución de assets no comerciales.

---

## 5. Assets: fuentes por licencia

**Regla:** todo asset nuevo se registra en `assets/MANIFIESTO.json` con `fuente`, `licencia` y `comercial: true|false`. Mientras el juego sea para pruebas personales se permiten no comerciales; **antes de cualquier publicación** se sustituyen todos los `comercial: false`.

| Nivel | Fuentes | Uso |
|---|---|---|
| **A · libre comercial (preferido)** | Poly Haven (texturas, HDRI **y modelos 3D realistas**: muebles, botellas, lámparas, herramientas), ambientCG, Quaternius, Kenney, poly.pizza (CC0/CC-BY), Smithsonian 3D (CC0, escaneos reales), NASA 3D Resources (dominio público: naves, satélites, la Tierra), Mixamo, TRELLIS.2 (MIT), Meshy (CC BY; descarga gratis solo modelo 6 Lite) · Hi3D (CC BY; descarga solo de pago) | Todo lo que se pueda |
| **B · solo pruebas personales** | Modelos HY3D/Hunyuan (Dave, Hank, Unidad 01, El Rey, Coloso actuales), Tripo free, Copilot 3D, Sketchfab CC-BY-NC, Fab "personal" | Para probar ya; marcar `comercial: false` |
| **Descargas** | Las directas (curl) las hacen los agentes; las que piden clic las agrupo y el usuario las baja de una vez | Tope por tanda: 300 MB |

Personajes pendientes y fuente asignada: Mike (TRELLIS arreglado → rig) · John y Lena (TRELLIS.2 gratis + arreglo en Blender; Hi3D NO deja descargar en plan gratis — solo si se paga Pro 9 €/mes, y John ya está generado allí) · Sarah (concepto Gemini → Meshy) · R-7 real (TRELLIS) · armas restantes (TRELLIS, 2/día).

---

## 6. Organización del trabajo (agentes)

- **Un dueño por área**; nadie edita archivos de otro sin releerlos y con cambios mínimos.
  - Historia/misiones: `js/historia/*`, `npcs.js`, `js/personajes/*`
  - Sistemas de juego: `js/juego/*`
  - Interacción física: `js/interaccion/*`
  - Combate/física: `js/combate/*`, daño en `enemigos.js`/`jugador.js`
  - Mundo/atmósfera: `nucleo.js` (materiales/cielo), `js/mundo/*`
  - Pipeline 3D: `tools/*`, `assets/*`
- **Contratos** entre sistemas solo vía `docs/eventos.md` (eventos del director y APIs).
- **Modo ahorro siempre:** máx. 4 capturas por tarea, probar solo lo tocado, cerrar pestañas, informes ≤ 30 líneas.
- **Puertas de calidad:** muestra → OK del usuario → producción en serie.
- **Nunca dejar el juego roto.** Antes de cada commit, prueba de humo en http://127.0.0.1:8740: el menú carga sin errores de consola y `__cap(0..7)` carga cada capítulo sin excepciones (y la página de prueba afectada, si la hay). Si falla y no se arregla rápido, se revierte el cambio (`git checkout -- <archivo>`). Los assets nuevos se añaden con nombre nuevo o con respaldo; nunca se sustituye un asset en uso sin probar que carga.
- **Commits** al cerrar cada bloque (conventional commits, sin atribución a IA). Nunca subir `assets_src/`.

---

## 7. Protocolo de prueba en Quest

1. Servidor `servir_juego.py` (puerto 8740) + túnel `cloudflared` → URL temporal.
2. Recorrido: prólogo → cap. 3; anotar fps (opción `?stats`), mareo, atascos, escala, manos.
3. El usuario cuenta lo que siente; se convierte en tareas aquí (sección 9) con prioridad.

---

## 8. Decisiones tomadas (no re-discutir sin motivo)

- WebXR + three.js (no Unreal) · Quest 3 objetivo · solo VR (no realidad mixta por ahora)
- Entorno por código + modelos .glb para personajes/objetos clave
- Historia: añadidos aceptados (Lucía, Marta y Leo, Varela, Rata, Chispa, John "Ruiz"); Unidad 01 recuerda hasta el prólogo y lo demás le llega en ecos
- Lluvia donde dramáticamente pegue; pistola en el cajón de Mike
- Ecos del pasado = el chip que Mike puso a Dave en el prólogo
- Publicación: solo túnel privado hasta sustituir assets de nivel B

---

## 9. Estado y próximos pasos (actualizar siempre)

### Cola autónoma (22-nov noche, usuario ausente) — se ejecuta en orden, cada bloque cierra con commit
- **A1 · Integración — HECHO 22-nov** (probado en PC, falta Quest): X-56D real (`assets/armas/X56D.glb`) en mano/visor PC/mostrador de Hank/funda vía `clonarArma(id)` en `jugador.js` (modelo por código hasta que carga; «Boca» = origen de balas y fogonazo; el cargador por código queda invisible para LEDs y recarga física). Hank = `Hank_animado` con ActorGLB en `npcs.js` (tipo `actor`: respira/mira nervioso/discute al hablar/señala/llora/sentado en el camión; herible por fuego amigo y robots a < 1,25 m, nunca baja de 1 hp). Cuerpo de Dave en `js/juego/avatar.js` (capa 6: invisible para la cámara principal y los ojos VR, visible en cámaras del lab y en 3.ª persona PC con **T** — la V ya era contener la respiración). Arreglado en `actor.js`: con `altura` la escala salía ×400 (piel sin matrices al medir) y la biblioteca con guiones bajos ahora casa con `ALIAS`. Pendiente: sombra propia del cuerpo, cuerpo en los ecos, cargador del .glb no se separa al recargar en VR, comprobar ángulo de la X-56D en el grip de Quest.
- ~~**A1 · Integración** (código)~~: Dave como cuerpo del jugador (visible en cámaras de seguridad, ecos y 3ª persona PC), Hank animado con ActorGLB y clips sociales, X-56D real con anclas Empunadura/Boca en mano, funda y entrega de Hank.
- **A2 · Assets** (Blender, en paralelo): auto-rig propio transfiriendo el esqueleto y los pesos de Dave (sin Mixamo) → Mike, Unidad 01, El Rey, Coloso; TRELLIS.2 con reintentos cuando haya cupo → John, Lena, R-7, escopeta Arda (y arreglo de pelo/cara).
  - **A2.1 HECHO (commit 7c26b3e):** `tools/autorig.py` (esqueleto de Dave ajustado, reposo idéntico → valen los 41 clips de `assets/personajes/anim`) → `assets/personajes/{Mike,Unidad01,El_Rey,Coloso}_animado(.glb|_webp.glb)` con Idle/Walk/HitHead; verificados en three r170 con `tools/verificar_rig_three.mjs` (Walking/Running/Head_Hit OK). Coloso imperfecto (talón se hunde ~8 cm al andar); Mike con manchas negras del horneado en los costados de la bata (se ven al andar). Licencias en el manifiesto: HY3D `comercial:false`, TRELLIS `true`. Archivos NUEVOS: el juego no los usa aún (→ bloque C).
  - **A2.2 PENDIENTE (sin cupo ZeroGPU: «exceeded your ZeroGPU runs limit», se reintenta cada 30 min hasta ~02:00):** John, Lena, R-7, escopeta Arda. Siguiente comando cuando haya cupo: `cd <scratchpad>/ia3d && python cola.py 6 30` (salta los ya generados); luego `tools/trellis_alfa.py` → `optimizar_personaje.py` (flags de Mike en tools/README) → `autorig.py`; R-7 además `partir_robot.py`; escopeta con `montar_arma.py` (anclas a ojo).
- **B · Pulido** (tras A1): exposición nocturna, memoria de texturas < 140 MB, cabina física de la ORION-4, enseñar esconderse/distraer en cap. 2, miembro arrancado con malla real, escasez de munición/botiquines por capítulo (F1.5).
  - **B HECHO 22-nov** (probado en PC con `__cap(0..7)` sin errores; falta Quest): **exposición** noche (`exp` 1,38, hemi ,42, env ,62, ventanas 1,5; farolas 40/18 m; lab: plafones 33/17 m, alarma 42, fluorescente que parpadea en el pasillo de la taquilla + piloto rojo sobre la puerta trasera). **Cabina ORION-4** (`js/interaccion/cabina-orion.js`): pedestal con panel al pie de la rampa (148,3, 25,6) — tapa roja → BATERÍA → BOMBA 1/2 → APU mantener 3 s (VR: dedo; PC: clic/E mantenido mirándolo) — y palanca de POTENCIA colgada de `W.orionSeat`; LED y pantalla reaccionan; emite `cabina_*` solo cuando el paso lo espera (hacerlo antes no se pierde); las alternativas usables siguen. **Cap. 2 esconderse/distraer**: R-7 `r7s` que barre la calle tras el primer robot; bajo la pickup (tumbado) o lanzar algo a > 4 m (el ruido lo desvía) → `escondido`; si te ve de frente < 6,5 m → `descubierto` y reintento. **Escasez F1.5**: `P.cargadores[id]` = balas de cada cargador del chaleco; R / recarga física consumen cargadores (sin recarga infinita); cada «cargador de X-56D» encontrado = 1 cargador; presupuesto: cap. 4 Hank mete 2 + 2 en la tienda; cap. 5 empieza con 1; cap. 6 con 2 (+1 pistola) y 1 en la taquilla de intendencia (barracón oeste) con botiquín y venda; vendas nuevas (+20, cortan el sangrado) en casa, lab y tienda; HUD/muñeca «balas · N carg.»; bolsillos del chaleco vacíos en VR; soltar el cargador junto al chaleco lo devuelve. **X-56D**: guardamanos (0, ,06, -,36) y palanca en el .glb; el cargador del .glb se recorta (discard por caja) mientras está fuera en VR y en la mano va uno visible. **Desmembramiento**: el miembro suelto es la malla real (triángulos pesados a la cadena del hueso, en la pose actual, con el material del personaje) + tapa de muñón; ~40 ms la primera vez por personaje (calentado ~0,7 s la 1.ª del juego: precalentar si se nota). Pendiente B: memoria de texturas < 140 MB; probar en Quest cabina/agarres, ruido de botella y recorte del cargador; ajustar a ojo la exposición del lab en gafas.
- **B.2 · Memoria de texturas — HECHO 23-nov** (PC, `__cap(0..7)` sin errores; falta Quest). Medición: `?stats` espía WebGL (bytes reales por textura con mipmaps y formato, `js/perf.js`) + contador en pantalla; `window.__perf({subir:true})` imprime tabla/llamadas/triángulos (subir = sube todo lo visible: peor caso del capítulo). Peor caso por capítulo (MB, antes→después; incluye sombra PC 2048 = 16 MB, en Quest 4): P 265→124 · 1 165→103 · 2 170→121 · 3 155→107 · 4 167→119 · **5 187→138** · 6 159→110 · 7 135→92. Causas y arreglos: casco del prólogo (DamagedHelmet, 5 JPEG 2048 = 106 MB) → `assets/modelos/Casco_Neural_ktx.glb` (KTX2 1024, `tools/finalizar.mjs --tam 1024`, ~7 MB; `cuerpos.js` lo carga con respaldo al original); atlas de rótulos y fachadas horneados a KTX2 (`assets/texturas/lienzos/`, `hornearLienzo()` en nucleo; 10,7→2,7 MB el atlas; `?lienzos=0` = lienzos de antes); casas a 512; HDRI reducido a 512×256 antes del PMREM (6→1,5 MB) y sala de reserva liberada; capas ocultas liberan sus texturas de la GPU a los 5 s (se re-suben solas al verse); piel de daño de actores 1024→512 y atlas de heridas 1024→768; Coloso estático libera sus texturas al cambiarse por el animado. Rehornear lienzos (si cambian sus dibujos): servir receptor POST local en :8799 → abrir `/?lienzos=0` → `await __exportarLienzos()` (PNG volteados) → `toktx --t2 --encode etc1s --clevel 4 --qlevel 200 --genmipmap --target_type RGB --assign_oetf srgb|linear` (map/em srgb, rm linear), normales `--encode uastc --uastc_quality 2 --uastc_rdo_l 2 --zcmp 18 --genmipmap --assign_oetf linear`, atlas `--encode uastc --uastc_quality 2 --uastc_rdo_l 1 --zcmp 18 --genmipmap --assign_oetf srgb`. Pendiente: personajes `*_animado` con color y metal/rugosidad 2048 (10,6 MB cada uno; normales ya 1024) → 1024 los dejaría < 120 (área del agente de assets); el patrón de ventanas encendidas queda fijo (horneado); comprobar en gafas tirón al re-subir capas (cambio calma/caos a mitad de cap.).
- **E · Escritura Actos II-III — HECHO 22-nov** (solo docs): `docs/historia-acto2.md` (caps. 7-12 jugables: asteroides, *Talos-9* y Lena, agencia con triaje neural que graba a Hank/John, guerra del campo de restos; muertes de Hank → John → Dave con última línea según memoria; mecánicas de ingravidez/botas/oxígeno/cable/venteo/X-27; assets por capítulo) y `docs/historia-acto3-estructura.md` (Laboratorio del Despertar con 6 cápsulas, 6 momentos por condición, director, precio de la conversión, ecos, Sarah, Lena, La Corona, 3 finales + cápsula 6 como gancho). Pendiente: validar con el usuario los añadidos (*Talos-9*, *Centinela*, Okafor, Ibarra, LZR-0002/0770, cápsula 6) y añadir los eventos nuevos a `eventos.md` cuando empiece F3.
- **D · Props realistas — HECHO 22-nov** (probado en PC, `__cap(0..7)` sin errores; falta Quest): 21 modelos CC0 de Poly Haven (40 MB crudos en `assets_src/polyhaven/models`) → `assets/props/<id>.glb` (KTX2 512 los de mano / 1024 los muebles + meshopt; 12 MB en total; en el manifiesto y CREDITOS). `catalogo.js`: 19 tipos con `modelo` {id, nodos por variante, rot}; `vistaDe()` encaja el .glb DENTRO de la caja de la malla por código (= forma física), que sigue invisible como forma de balas/agarre y vuelve a verse lejos (`CFG.radioModelo` 6 m) o si el .glb falla; roturas y fragmentos igual. Vidrio sin transmisión (Physical → Standard). Casa de Dave (`decorado.js` `cambiar()` + `modelosCasa()` antes de `hornear`): sofá, sillón, mesa baja y las 4 sillas del comedor (fusionadas en 1 llamada), colisiones intactas. `?sinModelos` = todo por código para comparar. Llamadas en la casa (21; 86,3 mirando al comedor, frame completo): 174 → 174; triángulos 75 k → 90 k. Pendiente: mirar en gafas la orientación de herramientas (martillo/llave/linterna/extintor) y la escala de la caja de madera (el modelo es más bajo que su colisión cúbica); hervidor descargado sin usar.
- **C · Integrar A2** (tras A2): Mike/John en sus escenas, Unidad 01 en su cápsula con esqueleto, R-7 real como enemigo con piezas rompibles, escopeta.
  - **C.1 HECHO 22-nov** (probado en PC, `__cap(0..7)` sin errores; falta Quest): nuevo `js/historia/actores.js` (carga con respaldo, holograma sobre la piel, ojos, casco, capa procedural: `nuca`/`coger`/`cabizbajo`/`rendirse` y herido en el suelo sobre «Sitting»). `npcs.js`: **Mike** = `Mike_animado` (habla con Standing_Arguing/Pointing, anda, tic de la nuca; herido del cap. 3 sentado en el suelo, rodilla arriba, mano en el vientre); **mikeholo**, **r01**, **r01casco** = holograma con esqueleto (R-01 = `El_Rey_animado` y hace la nuca de Mike); **unidad01** = `Unidad01_animado` en la cápsula (Idle ×0,3, ojos cian); **elrey** = `El_Rey_animado`. Respaldo si el .glb no carga: humano/robot por código o el .glb estático anterior. Eco `lab_casco` y grabación de la cámara 3 con actores (holograma, capa 5). **Coloso** dormido: sustituye en caliente a `W.colosoBase` (el estático queda invisible con su colisión), Idle ×0,25, solo se anima a < 45 m. Carga: Mike/Unidad01 al arrancar, El Rey/Coloso a los 12 s. Pendiente: ajustar a ojo la pose de herido y los ojos de Unidad 01 en gafas; John/R-7/escopeta esperan a A2.2; memoria de texturas sube ~10 MB por personaje.
- **F3 · Acto II — EMPEZADA 22-nov** (prototipo, probado en PC sin errores; falta Quest): `tools/prueba-gravedad.html` + `js/espacio/*` (nuevo, no toca el juego): pasillo + esclusa + hangar con escombros y ventana; mundo Rapier propio a gravedad 0; agarrar/empujar en VR (momento conservado) y chorros WASD/Espacio/C + E/F en PC; «gravedad cero asistida» (amortiguación); botas magnéticas con cambio de pared por fundido de 0,3 s; anillo de 8 LEDs de O2 + botella de reserva (¾ de vuelta en VR / O); cable EVA de 12 m; ciclo de esclusa con siseo y sonido que vuelve con la presión; venteo en ~4-5 s + mampara; X-27 sin retroceso frente a X-56D que empuja 0,4 m/s. `__eva.simular(s)` para probar sin rAF. Pendiente: probar agarres/giro de botella/botas en gafas, X-56D real (.glb), teletransporte entre asideros como variante de comodidad, eventos en `eventos.md`.
- **QA de jugabilidad del Acto I — HECHO 23-nov** (agente historia; partida completa por código en PC, `__cap(0..7)` sin errores; falta Quest): tabla en `docs/qa-acto1.md`. Arreglados: `cajon_abierto`/`pizarra_escrita` ahora los emiten `muebles.js`/`escritura.js`; la alternativa de esconderse bajo la pickup (cap. 2) ya no da fallo seguro; `chaleco_puesto` llegaba antes de su paso (cap. 4) y `recargado` podía bloquear sin cargadores (`max` 120); robots del camino congelados en las escenas del lab (cap. 5, `D.despejar()`); el cuaderno ya no rebobina el capítulo si vuelves a casa; objetivos cumplidos se borran en escenas; la pista de 60 s ahora usa `juego.guia`; sigilo más justo (el medidor escala con distancia y postura, escondido = invisible). Pendiente: taquilla del cap. 3 por alternativa no te mete dentro, `dosManos` del casco, mirada/cabina/walkie reales en gafas.
- **Esperando al usuario**: prueba en Quest (túnel), decisión Hi3D de pago.


**22-nov-2026, noche**
- **Sistemas de juego (22-nov, agente sistemas)** HECHO en `js/juego/*` y probado en PC: ecos (3 de serie), cámaras del lab (render a textura + grabación R-01), linterna en el hombro con batería, básquet con el chaval + triples, gato y superviviente en ventana, IA de PNJ (rutina/seguir/huir/reaccionar/ayudar), guía visual (ámbar/cinta/cian/rojo + pista 60/120 s + guía clásica) y música adaptativa. APIs en `docs/eventos.md` §«Sistemas de juego». Sin probar en Quest: entrada VR de ecos, botones con el dedo, pases con la mano, coste del render a textura.
- En curso: misiones jugables (agente historia) · ecos/cámaras/básquet/IA PNJ (agente sistemas) · Hank animado + 40 animaciones (agente Blender)
- Esperando al usuario: prueba en Quest con el túnel; descargar John de Hi3D
- Siguiente al cerrar lo en curso: commit → onboarding + guía visual (F1.3) → zonas seguras/guardado (F1.4) → escasez (F1.5) → prueba Quest (F1.6)
- **Historia (agente historia) — hecho:** misiones jugadas (Revisión 3 en `historia-acto1.md`); onboarding del prólogo (cajón → pizarra «consentimiento» → casco a dos manos → llave); ayuda progresiva (60 s → `guia.resaltar(id|pos)` o el marcador; 120 s → pista de Dave; marcador permanente solo con `G.opciones.guiaClasica` o conduciendo); objetivo en `G.objetivoDave`; paso `guardar` (cuaderno de casa ×2, grabadora de Hank); enemigos congelados en diálogos; coche se para en el cordón; ecos/cámaras/IA PNJ/baloncesto por ganchos opcionales (`docs/eventos.md` §5). Pendiente historia: enseñar esconderse/distraer en el cap. 2 (hoy se enseña en el cap. 3), reanudar a mitad de capítulo desde `apoc2030.guardado` (menú), escribir los objetivos como frases de Dave en todos los pasos
- Deuda conocida: exposición nocturna baja; ~~texturas 199 MB (> 120)~~ (23-nov: peor capítulo 138 MB, ver B.2); el miembro arrancado es una cápsula; fundas/recarga sin probar en gafas; cabina ORION sin hacer; token HF a rotar
