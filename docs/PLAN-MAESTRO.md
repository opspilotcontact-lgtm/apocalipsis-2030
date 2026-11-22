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
4. Exposición nocturna, memoria de texturas < 120 MB, vida ambiental (viento, pájaros, humo)
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
- **B · Pulido** (tras A1): exposición nocturna, memoria de texturas < 140 MB, cabina física de la ORION-4, enseñar esconderse/distraer en cap. 2, miembro arrancado con malla real, escasez de munición/botiquines por capítulo (F1.5).
- **C · Integrar A2** (tras A2): Mike/John en sus escenas, Unidad 01 en su cápsula con esqueleto, R-7 real como enemigo con piezas rompibles, escopeta.
- **Esperando al usuario**: prueba en Quest (túnel), decisión Hi3D de pago.


**22-nov-2026, noche**
- **Sistemas de juego (22-nov, agente sistemas)** HECHO en `js/juego/*` y probado en PC: ecos (3 de serie), cámaras del lab (render a textura + grabación R-01), linterna en el hombro con batería, básquet con el chaval + triples, gato y superviviente en ventana, IA de PNJ (rutina/seguir/huir/reaccionar/ayudar), guía visual (ámbar/cinta/cian/rojo + pista 60/120 s + guía clásica) y música adaptativa. APIs en `docs/eventos.md` §«Sistemas de juego». Sin probar en Quest: entrada VR de ecos, botones con el dedo, pases con la mano, coste del render a textura.
- En curso: misiones jugables (agente historia) · ecos/cámaras/básquet/IA PNJ (agente sistemas) · Hank animado + 40 animaciones (agente Blender)
- Esperando al usuario: prueba en Quest con el túnel; descargar John de Hi3D
- Siguiente al cerrar lo en curso: commit → onboarding + guía visual (F1.3) → zonas seguras/guardado (F1.4) → escasez (F1.5) → prueba Quest (F1.6)
- **Historia (agente historia) — hecho:** misiones jugadas (Revisión 3 en `historia-acto1.md`); onboarding del prólogo (cajón → pizarra «consentimiento» → casco a dos manos → llave); ayuda progresiva (60 s → `guia.resaltar(id|pos)` o el marcador; 120 s → pista de Dave; marcador permanente solo con `G.opciones.guiaClasica` o conduciendo); objetivo en `G.objetivoDave`; paso `guardar` (cuaderno de casa ×2, grabadora de Hank); enemigos congelados en diálogos; coche se para en el cordón; ecos/cámaras/IA PNJ/baloncesto por ganchos opcionales (`docs/eventos.md` §5). Pendiente historia: enseñar esconderse/distraer en el cap. 2 (hoy se enseña en el cap. 3), reanudar a mitad de capítulo desde `apoc2030.guardado` (menú), escribir los objetivos como frases de Dave en todos los pasos
- Deuda conocida: exposición nocturna baja; texturas 199 MB (> 120); el miembro arrancado es una cápsula; fundas/recarga sin probar en gafas; cabina ORION sin hacer; token HF a rotar
