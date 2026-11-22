# Apocalipsis 2030 · Backlog VR («estar ahí»)

Tareas que salen de `docs/diseno-vr.md` (las secciones se citan como §). Prioridad:
- **P0** — lo que más sube la sensación de «estar vivo en VR» en el **Acto I**. Hacer primero.
- **P1** — segunda ola: profundidad de mecánicas y atmósfera.
- **P2** — pulido y Actos II-III.

Áreas: **mundo/ambientación** · **interacción** · **combate** · **historia** · **personajes/animación** · **UI/HUD** · **audio**.
Esfuerzo: **S** ≤ 1 día · **M** 2-4 días · **L** ≥ 1 semana.
Regla para todas: cada tarea se prueba **en las Quest 3** a 72 Hz con `renderer.info` visible (ver T-00) y respeta el presupuesto de §7.

---

## P0 — Acto I vivo

| ID | Tarea | Área | Criterios de aceptación | Esf. | Depende de |
|---|---|---|---|---|---|
| T-00 | **Medidor de rendimiento en VR**: overlay `?stats` (fps, draw calls, triángulos, texturas) como panel en el mundo pegado a la muñeca | UI/HUD | Con `?stats` en la URL se ve el panel dentro de las gafas; sin el parámetro no existe | S | — |
| T-01 | **Conectar `js/interaccion/`** al bucle del juego (`antesJugador`, `actualizarInteraccion`) y a `main.js` | interacción | Se puede coger, lanzar y soltar un prop del catálogo en PC y VR; las puertas/cajones/cristales funcionan; sin caída de fps > 3 con 20 props | M | — |
| T-02 | **Niebla de altura** en los materiales del mundo (§2.1) con `uFogH0`/`uFogK` por hora en `TIMES` | mundo/ambientación | La niebla se acumula en el suelo y los tejados asoman; valores distintos por hora; 0 draw calls nuevas | S | — |
| T-03 | **Lluvia instanciada** que sigue a la cabeza + oculta bajo techo + `uWet` a 1 (§2.2) | mundo/ambientación | Llueve en caps. 2-4 (campo `clima:'lluvia'` del capítulo); 1 draw call; no llueve dentro de casa/lab/tienda; asfalto brillante con reflejos de farolas | M | T-07 (viento opcional) |
| T-04 | **Audio de lluvia y lecho por capas** con cruce exterior/interior (§2.5) | audio | Al cruzar una puerta el sonido de lluvia cambia (tejado ↔ aire libre) en < 0,5 s; viento sube con las rachas | M | T-03 |
| T-05 | **Eventos de sonido lejanos** (sirenas con Doppler, perros, alarma de coche, helicóptero, coro de servos) en puntos del borde del mapa (§2.5) | audio | En la calle de noche se oye un evento lejano cada 8-30 s, espacializado; lista configurable por capítulo | M | — |
| T-06 | **Ola de despertar + ojos rojos lejanos + pulso de El Rey** (`pulsoRey()`: ojos sincronizados, farolas bajan, radio chirría con voz de Mike procesada) (§2.6, §4.2) | mundo/ambientación + historia | En el cap. 2 al salir al porche los ojos se encienden en cadena de lejos hacia el jugador; las farolas se apagan por sectores; 1 draw call para todos los ojos; `pulsoRey()` llamable desde el director | M | T-05 |
| T-07 | **Viento global `uWind`** consumido por árboles, cables y lona/sábanas (§2.2) | mundo/ambientación | Árboles se balancean según altura; ráfagas visibles; parámetro por capítulo (cap. 6 fuerte) | S | — |
| T-08 | **Columnas de humo + resplandor de incendios en el horizonte** (§2.4, §2.6) | mundo/ambientación | 3-4 columnas visibles desde el pueblo, inclinadas por el viento; tinte naranja bajo en el cielo hacia la ciudad; ≤ 4 draw calls | S | T-07 |
| T-09 | **Luces que parpadean** (curva de ruido para farolas, fluorescente de la tienda, tele, luces de emergencia del lab) (§2.6) | mundo/ambientación | Cada fuente tiene un perfil (`estable`, `parpadeo`, `muriendo`, `tele`); el pool de 6 luces lo respeta | S | — |
| T-10 | **Pájaros que huyen** con ruido (instanciados) (§2.6) | mundo/ambientación | Bandada posada en cables/tejados; un disparo o cristal a < 25 m la hace volar; 1 draw call | S | T-12 |
| T-11 | **Siluetas de supervivientes en ventanas** que cierran la cortina al apuntarlas (§2.6) | mundo/ambientación | 4-6 ventanas del pueblo con silueta; apuntar arma/linterna 1 s → cortina y luz apagada | S | — |
| T-12 | **Sistema de ruido + oído de los robots** (tabla de radios §3.8, investigar → escanear → volver; doble evento = alerta) | combate | Lanzar una lata a 5 m de un R-7 lo hace ir a mirar; disparar alerta a todo el barrio; correr cerca delata; agachado no | M | — |
| T-13 | **Tapar la boca / contener la respiración** (mano a < 12 cm de la boca + grip; PC Mayúsc) con ahogo y bocanada (§3.8) | interacción | Anula ruido de respiración 8-10 s; después viñeta oscura y bocanada audible; también estabiliza la puntería 4 s | S | T-12 |
| T-14 | **Escondites**: taquilla (cerrar desde dentro, ver por rendijas) y bajo coche (tumbarse) (§3.8) | interacción + combate | Dentro de una taquilla cerrada un robot que no te oyó entrar pasa de largo; bajo el coche la cámara entra bajo el chasis | M | T-01, T-12 |
| T-15 | **Agacharse por botón + estados de postura** (de pie / agachado / tumbado por altura de cabeza) (§3.5) | interacción | B/Y alterna agachado (−0,6 m); la postura afecta a ruido y visibilidad; funciona en modo sentado | S | T-30 |
| T-16 | **Romper cristal para entrar** (objeto, puño con corte, codo; quitar trozos del marco; ruido 15 m) (§3.7) | interacción + combate | Ventana trasera del lab rompible con piedra/culata; el puño desnudo resta 10 y deja la mano sangrando; pasar sin quitar trozos resta 5 | M | T-01, T-12 |
| T-17 | **Lab, cap. 3 — nueva entrada trasera**: malla levantable en el agujero de la valla, ventana del baño (cristal), rejilla alternativa, contenedores para esconderse, soldado que se acerca al oír el cristal (§5 cap. 3) | historia + mundo | El jugador puede entrar por cristal (ruidoso) o rejilla (lenta); el soldado reacciona al ruido; checkpoint en `cordon` sigue funcionando | M | T-12, T-13, T-16 |
| T-18 | **Lab, cap. 3 — patrulla en el pasillo + taquillas** (§5 cap. 3) | historia + combate | Un R-7 patrulla el pasillo antes de Mike; esconderse en taquilla es la forma «limpia» de pasar | S | T-14 |
| T-19 | **Ranuras del cuerpo** (espalda, pecho, chaleco ×2, bolsillo del pecho, riñonera de 6 huecos, hombrera) con torso suavizado por la cabeza (§3.1) | interacción | Coger/guardar fusil por encima del hombro, cuchillo del pecho, cargador del chaleco; háptico al entrar en la zona; el fusil vuelve solo a la espalda a los 2 s si se suelta | L | T-01, T-30 |
| T-20 | **Recarga física del X-56D** (soltar con A/X, meter desde el chaleco con imán a 6 cm, montar si el cerrojo quedó atrás, LEDs en el cargador) (§3.2) | combate + interacción | Recarga completa en VR sin botones salvo soltar; PC sigue con R; opción «asistida» del menú funciona | M | T-19 |
| T-21 | **Cap. 4 — tutorial de la X-56D desmontada y el chaleco de Hank** (§5 cap. 4) | historia | Hank da el arma sin cargador; el jugador la carga; aparecen las ranuras; líneas nuevas de Hank | S | T-19, T-20 |
| T-22 | **Ponerse el casco con dos manos + 8 electrodos + luces del lab bajan** (§4.2) | historia + UI/HUD | El paso `usar` del prólogo exige las dos manos en VR; aparecen 8 puntos que se encienden uno a uno con tic háptico; destello | S | — |
| T-23 | **Grabadora de Mike física** (play con el pulgar, audio sale del objeto, más claro junto a la oreja) para las 4 cintas | interacción + audio | Las cintas 1-3 y el contestador se reproducen desde el objeto en la mano; PC: E coge y F reproduce | S | T-01 |
| T-24 | **Reloj de muñeca 2030**: hora de la historia, pulso = vida, mensajes de Sarah según memoria (§3.17) | UI/HUD + historia | Girar la muñeca hacia la cara muestra la esfera; los mensajes de los caps. 2-4 cambian si `sarah:silencio_al_irse`; PC: Tab | M | — |
| T-25 | **Vaho del aliento** jugador y NPC (cap. 5 y 6), más intenso tras correr (§2.7) | mundo/ambientación + personajes | Puff cada 3-4 s delante de la cámara y de Sarah/John/Hank; pool de 6 sprites | S | — |
| T-26 | **Interpolación de hora por paso** (`D.hora('amanecer', 20)`) y amanecer real durante el diálogo de Sarah (§2.3) | mundo/ambientación + historia | El sol sale en 20 s mientras Sarah habla; también sirve para la vela de la cena y la lluvia que amaina tras la muerte de Mike | M | — |
| T-27 | **Linterna** (mano, clip de hombrera, riel del fusil) con coste de visibilidad ×2,5 y sacudir para recuperar pilas (§3.11) | interacción + combate | Linterna encendida aumenta la detección; prioridad fija en el pool de luces; cogida en el cajón de la entrada en el cap. 2 | M | T-01, T-19 |
| T-28 | **Distraer lanzando** — colocar 3-5 lanzables en cada zona de sigilo del Acto I (§3.9) | mundo + historia | Lab trasera, pasillo, barracones de la base tienen latas/botellas visibles junto a la entrada | S | T-01, T-12 |
| T-29 | **Walkie con John** en el cap. 6: voz desde el objeto con filtro, pulsar para hablar con respuestas cortas, dar la señal de la explosión (§3.16) | historia + audio + interacción | John avisa de patrullas por el walkie; el jugador pulsa «¡Ahora!» para volar el depósito (sustituye al disparador actual) | M | T-01 |
| T-30 | **Menú «Comodidad»** mínimo: movimiento suave/teletransporte, giro pasos/suave (30/45/90), viñeta, modo sentado, calibrar altura, mano dominante (§6) | UI/HUD | Opciones agrupadas en un panel; persisten en localStorage (con try/catch); la viñeta se activa al moverse/girar/trepar | M | — |
| T-31 | **Quitar el empujón de cámara al recibir daño en VR** (opción) (§3.12) | combate | `hurtPlayer` no mueve el `dolly` si la opción está desactivada (por defecto, desactivada) | S | T-30 |

---

## P1 — Profundidad

| ID | Tarea | Área | Criterios de aceptación | Esf. | Depende de |
|---|---|---|---|---|---|
| T-40 | **Charcos con ondas** y salpicaduras instanciadas (§2.2) | mundo/ambientación | Ondas en un radio de 25 m; 2 draw calls en total | M | T-03 |
| T-41 | **Basura y papeles que vuelan** con el viento (§2.2) | mundo/ambientación | 20-30 instancias recicladas cerca del jugador; se pegan a vallas | S | T-07 |
| T-42 | **Bancos de niebla** con *soft fade* por distancia (§2.1) | mundo/ambientación | No se ve el corte al atravesarlos; ≤ 12 planos | S | T-07 |
| T-43 | **Nubes que tapan la luna** y bajan la luz direccional (§2.4) | mundo/ambientación | Cada ~40 s una nube cruza y las sombras se apagan/encienden suavemente | M | — |
| T-44 | **Perro callejero** con ruta y ladrido que avisa de robots (§2.6) | personajes/animación | Cruza la calle en los caps. 2 y 4; ladra a un robot fuera de vista | M | T-12 |
| T-45 | **Insectos en farolas**, intermitentes de coches abandonados, coche con radio encendida (§2.6) | mundo/ambientación | Solo las 4 farolas más cercanas tienen insectos | S | — |
| T-46 | **Helicóptero lejano** con foco que barre y Doppler (§2.6) | mundo + audio | Una pasada por capítulo nocturno | S | T-05 |
| T-47 | **Estela de la nave de El Rey** en el cielo (cap. 5) (§2.4) | mundo/ambientación + historia | Visible desde la ventana del lab durante el beat 9 | S | T-26 |
| T-48 | **Oclusión de audio** barata (rayo cada 0,25 s) (§2.5) | audio | Una fuente detrás de una pared suena apagada (paso bajo 800 Hz, −6 dB) | S | — |
| T-49 | **Cuerpo a cuerpo por velocidad con cualquier objeto** + cuchillo que se clava en juntas de robot y se arranca (§3.4) | combate | Daño proporcional a la velocidad (umbral 1,8 m/s); cuchillo solo hiere a robots en juntas; queda clavado hasta tirar fuerte | M | T-01 |
| T-50 | **Resistencia invisible** (respiración audible, temblor de arma, vaho) (§3.13) | combate + audio | Correr 8 s seguidos → respiración agitada (ruido 2,5 m) y arma temblando | S | T-12 |
| T-51 | **Huesos rotos y heridas del jugador** (sangrado, brazo, pierna, aturdido) (§3.12) | combate | Caída > 3 m rompe pierna (×0,55); brazo roto impide dos manos; sangrado −1/2 s | M | T-19 |
| T-52 | **Curarse físicamente**: venda con gesto circular, jeringa en el muslo, férula (§3.12) | interacción + combate | Cada cura funciona solo aplicada sobre la zona herida; PC: H mantenido | M | T-51, T-19 |
| T-53 | **Botiquín de Hank** en la riñonera (cap. 4) y Hank venda el corte si lo hay (§5 cap. 4) | historia | Línea y entrega nuevas; si `corte_cristal`, Hank venda | S | T-52 |
| T-54 | **Barricada en la tienda**: estantería empujable a dos manos + Rata entra por la trastienda (§3.10, §5 cap. 4) | historia + interacción | Si se hace la barricada cambia la entrada y la línea de Rata | M | T-01 |
| T-55 | **Palanca** (encajar + apalancar a dos manos) para rejillas y puertas (§3.10) | interacción | Rejilla del lab y de la base se abren con palanca; ruido 6 m | M | T-01, T-12 |
| T-56 | **Escalera de mano** mano sobre mano + **conducto** de la base con tirón de nervios (§3.5, §3.6, §5 cap. 6) | interacción + mundo | Ruta alternativa por el tejado del barracón y conducto de 8 m al callejón; viñeta al trepar | L | T-30 |
| T-57 | **Cabina física de la ORION-4** (tapa + interruptor, 2 bombas, APU mantenido, palanca) intercalada con la defensa (§5 cap. 6) | historia + interacción | El `resistir` de 35 s se convierte en 4 pasos de cabina con salidas a defender la rampa | M | T-01 |
| T-58 | **Escondido bajo la lona del camión** en el control de entrada (§5 cap. 6) | historia + combate | Foco del guardia pasa; si el jugador no se tumba o no contiene la respiración, se falla | S | T-13, T-15 |
| T-59 | **Cena interactiva**: vasos del armario, servir vino, encender la vela con mechero, lámpara con cadenita, manta (§5 cap. 1) | historia + interacción | Todo opcional; Sarah comenta 2-3 de estas acciones | M | T-01 |
| T-60 | **Piano en el salón** con líneas de Sarah y Lucía (§5 cap. 1) | historia | Tocar 3+ notas dispara la línea de Lucía desde su cuarto | S | T-01 |
| T-61 | **Foto y dibujo de Lucía como props** (reverso del dibujo; guardar la foto en el bolsillo; línea al mirarla una vez por capítulo) (§3.18) | historia + interacción | La foto viaja en el bolsillo del pecho hasta el epílogo | S | T-19 |
| T-62 | **Cristal empañado de la cápsula** que se limpia con la mano (§5 prólogo) | interacción + mundo | Pasar la mano revela la cara de Unidad 01 | S | T-01 |
| T-63 | **Proyector del holograma** que se coge y se gira (cap. 5) (§4.2) | historia + interacción | El gesto de la nuca de R-01 se ve desde cualquier ángulo; pausa con botón | M | T-01 |
| T-64 | **Bridas para atar a Varela** (gesto de apretar) (§5 cap. 5) | historia + interacción | La opción «Átalo» requiere atar físicamente en VR; PC: E | S | T-01 |
| T-65 | **Mapa de Peñas Negras en la mesa** con rotulador y John señalando (§5 cap. 5) | historia + personajes | Superficie de escritura con el plano; gesto de señalar de John | S | T-01 |
| T-66 | **Motas de polvo en el haz de la linterna** en interiores (§2.7) | mundo/ambientación | Solo visibles dentro del cono; ≤ 150 puntos | S | T-27 |
| T-67 | **Cristales que crujen al pisarlos** y casquillos con sonido (§2.7) | audio + combate | Pisar cristal roto suma 4 m de ruido | S | T-12, T-16 |
| T-68 | **Huellas de robot** hacia la vitrina vacía (decals estáticos) (§5 cap. 3) | mundo/ambientación | Visibles con la linterna en el suelo del lab | S | — |
| T-69 | **Subtítulos**: colores por personaje (VARELA, NÚÑEZ, RATA, CHISPA, MIKE · CINTA…), flecha de dirección, tamaño (§6) | UI/HUD | Ya pedido en `pendientes-mundo.md`; añadir flecha si el hablante está fuera de vista | S | T-30 |
| T-70 | **Cap. 2 — limpiaparabrisas, llave de contacto, radio del coche con noticias** (§5 prólogo/cap. 2) | historia + interacción | Girar la llave arranca; la radio da el presagio de los apagones | S | T-01 |

---

## P2 — Pulido y Actos II-III

| ID | Tarea | Área | Criterios de aceptación | Esf. | Depende de |
|---|---|---|---|---|---|
| T-80 | **Conversión de robots** (arrancar placa, mano en el núcleo, anillo de 8 luces, forcejeo, flash de recuerdo) (§4.3) | combate + interacción | Convertir en VR sin botones salvo grip; PC: E mantenido con ritmo; fallo si sueltas | L | T-49 |
| T-81 | **Ojo de Unidad 01**: escaneo por mirada, overlay curvo diegético, gotas de lluvia en el ojo (§4.3) | UI/HUD | Mirar 1 s un objetivo muestra su estado; nada pegado como HUD plano | M | — |
| T-82 | **«Dudar»**: parpadeo del ojo con opción de diálogo extra si mantienes la mirada (§4.3) | historia + UI/HUD | Opción «dejarle ir» desbloqueable | M | T-81 |
| T-83 | **Ecos de recuerdos al tocar objetos** según la memoria del Acto I (§4.3) | historia + audio | La foto/taza/piedra disparan el audio de la escena tal como se jugó | M | — |
| T-84 | **Agarrar y reprogramar drones** en el aire (§4.3) | combate + interacción | Rotar la muñeca con el dron agarrado lo convierte | M | T-80 |
| T-85 | **Perder y reencajar piezas** del cuerpo robot (§4.3) | combate + personajes | Perder el antebrazo oculta la mano; recogerla y encajarla la devuelve | L | — |
| T-86 | **Interferencia de El Rey en el ojo** (aberración solo en overlay, voz de Mike en ambos oídos, convertidos dudan) | audio + UI/HUD | Taparse los «oídos» con las manos reduce el efecto | M | T-81 |
| T-87 | **Gravedad cero de objetos** en el epílogo (la foto flota) | interacción | Objetos soltados en la cabina flotan con giro lento | S | T-01 |
| T-88 | **Comer y beber** (café con vapor, lata con anilla) (§3.14) | interacción | Llevar a la boca reproduce el sonido y da el efecto | S | T-01 |
| T-89 | **Cuaderno y mapa de papel** desplegable (§3.15) | interacción | Desplegar con dos manos; marcar con rotulador; línea de Dave si apunta las coordenadas | M | T-01, T-19 |
| T-90 | **Puño protegido con trapo** (§3.7) | interacción | Frotar el trapo contra la mano la envuelve; ya no corta el cristal | S | T-16 |
| T-91 | **Tic de la nuca de Dave** (detectar mano en la nuca en momentos de estrés) (§4.2) | historia | Línea «Igual que Mike» una vez | S | — |
| T-92 | **Rayos de luz entre árboles/lamas** en el amanecer del cap. 5 (§2.1) | mundo/ambientación | 3-5 cards aditivas orientadas al sol | S | T-26 |
| T-93 | **Gato, tendedero con sábanas** en la casa vecina (§2.2, §2.6) | mundo/ambientación | Presentes en el cap. 1, ausentes/caídos en el cap. 2 | S | T-07 |
| T-94 | **Ropa y pelo mojados en NPC** tras la lluvia (§2.7) | personajes/animación | Materiales de Sarah/Hank/John más oscuros y brillantes en caps. 2-5 | S | T-03 |
| T-95 | **Texturas a KTX2/Basis** y auditoría de memoria (§7) | mundo/ambientación | Texturas en GPU ≤ 400 MB medidas en las gafas | M | T-00 |
| T-96 | **Menú «Comodidad» completo** (resto de opciones de §6: sangre, recarga asistida, gestos→botón, daltonismo, háptica) | UI/HUD | Todas las opciones de la tabla de §6 existen y persisten | M | T-30 |

---

## Orden sugerido (primeras dos semanas)

1. T-00, T-01, T-30 (medir, conectar interacción, confort base) → sin esto no se puede probar nada en las gafas.
2. Atmósfera barata de golpe grande: T-02, T-07, T-09, T-08, T-25, T-03, T-04.
3. Sigilo que se siente: T-12, T-13, T-15, T-14, T-16, T-17, T-18.
4. El cuerpo como inventario: T-19, T-20, T-21, T-27, T-23.
5. Momentos de historia: T-06, T-22, T-24, T-26, T-29, T-10, T-11, T-05, T-28.
