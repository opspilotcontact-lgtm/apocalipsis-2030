# Apocalipsis 2030 · Acto II «Más allá de la atmósfera» — misiones jugables

Continúa `historia-acto1.md` (mismo formato que su **Revisión 3**: misiones jugadas, no narradas). Canon: biblia 0.1 (artifact 8JgDNuvR78Jr4QMQPXn2fy) + decisiones de `PLAN-MAESTRO.md` §8. Lo nuevo se marca *(nuevo)*.
Fase de implementación: **F3** (`PLAN-MAESTRO.md` §4). Diseño VR de referencia: `diseno-vr.md` (§3 mecánicas, §6 confort).

**Reglas del acto (heredadas del Acto I):**
1. Lo que se puede encontrar o hacer no se cuenta. Cero diálogo bloqueante con enemigos activos (se congelan).
2. Cada muerte del grupo es **jugable** (el jugador está ahí, con las manos ocupadas, intentando evitarla) y está **preparada por la memoria del Acto I**: la última línea cambia según lo que el jugador hizo.
3. Dave **nunca** controla robots (canon `diseno-vr.md` §4.1). El Rey solo interfiere: radio, ojos sincronizados, voz de Mike procesada. **No se revela** que El Rey es Mike: se refuerza la sospecha (gesto de la nuca, «hermanito»). La revelación es del Acto III.
4. Unidad 01 **no recordará nada de esto** (se grabó en el prólogo). Todo lo que pase aquí le llegará en el Acto III como **ecos** al tocar objetos: por eso cada capítulo deja un **objeto-eco** físico (columna «Objeto-eco»).

---

## 0. Mecánicas nuevas del acto (VR + alternativa PC)

| Mecánica | VR | PC | Se enseña en |
|---|---|---|---|
| **Gravedad cero: empujarse** | Agarrar asideros, bordes, cables o cualquier superficie con el grip y **tirar/empujar**: el cuerpo sale con la velocidad de la mano al soltar (estilo Lone Echo). Sin stick en ingravidez. Frenar = agarrar otra cosa | Mirar un asidero + E = impulso hacia él; Espacio = empujarse hacia donde miras desde una superficie | Cap. 8, esclusa de la ORION-4 |
| **Botas magnéticas** | Botón del stick izquierdo (clic) = activar/desactivar. Con botas, se camina sobre cualquier superficie metálica con el stick (velocidad 1,2 m/s, sin inercia). Al cambiar de pared, **fundido de 0,3 s** (nunca rotación de cámara visible) | B = botas | Cap. 8, casco del carguero |
| **Oxígeno** | Recurso, no temporizador oculto: **anillo de 8 LEDs** en el antebrazo del traje (rima con los 8 electrodos) + reloj de muñeca. Botella de reserva en el pecho: **desenroscar la vacía y enroscar la llena** (gesto de giro, ¾ de vuelta). Respiración de Dave más rápida bajo el 25 % (audio, igual que la resistencia) | O = cambiar botella | Cap. 8 |
| **Cable de seguridad (EVA)** | Mosquetón en la cadera: llevarlo a una barandilla o argolla y **soltar el grip** = enganchado (clic + háptico). Enganchado, si sales despedido el cable te frena a 12 m y puedes **recoger** tirando mano sobre mano. Desenganchar = apretar el gatillo del mosquetón con la otra mano | T = enganchar al punto más cercano | Cap. 8 |
| **X-27 (sin retroceso)** | Fusil de pulsos: no empuja. En contraste, **disparar la X-56D en ingravidez te lanza hacia atrás** (≈ 0,4 m/s por disparo): el jugador entiende *por qué* existe la X-27 al usarla. Recarga: célula de energía que se encaja de un golpe con la palma | Igual que la X-56D | Cap. 8 (la X-56D falla primero) |
| **Esclusas** | Rueda manual (dos manos, girar) o panel: cerrar exterior → presurizar (silbido, el sonido **vuelve** poco a poco) → abrir interior. Sin aire **no hay sonido** del mundo: solo la respiración, la radio y lo que se transmite por contacto (agarrar un casco/mamparo = oír vibración) | F en la rueda | Cap. 8 |
| **Ventanas rotas: venteo** | Un cristal reventado (disparo, impacto) **vacía la sala en 4-6 s**: todo lo suelto sale disparado hacia el hueco, incluidos robots y el jugador si no está agarrado o con botas. Se usa como arma (reventar una ventana con robots delante) y como amenaza. Para cerrarlo: **placa de parcheo** (pegarla al hueco con la palma) o cerrar la mampara de emergencia | F mantenido = agarrarse | Cap. 9 (enseñado) / cap. 10 (dominado) |
| **Pilotaje guiado** | Cabina de la ORION-4 (ya física, `js/interaccion/cabina-orion.js`): **mando de vuelo agarrado** con la mano derecha (desviación limitada ±25° y velocidad de giro capada) y palanca de potencia a la izquierda. La nave **no** rota la cámara del jugador: el horizonte de la cabina es fijo y es el exterior el que se mueve (regla de confort §6) | Ratón / WASD | Cap. 7 |
| **Comodidad específica** | Opción «Ingravidez asistida»: los impulsos se convierten en **teletransporte entre asideros** (piernas fantasma) y las botas quedan siempre activas | — | Menú Comodidad |

**Escasez del acto:** la X-56D llega con lo que quedó del cap. 6 (1-2 cargadores); la X-27 tiene **3 células** en todo el cap. 8 y se encuentran 2 más por capítulo. El oxígeno es la verdadera munición: una botella = 4 min de EVA. Las estaciones de recarga (paneles con boquilla) son las «zonas seguras» del acto.

---

## Resumen jugable (formato Revisión 3)

| Cap. | Misión | Objetivos del jugador | Opcional / exploración | Ecos, pistas y objeto-eco |
|---|---|---|---|---|
| 7 · Órbita | Seguir la señal | Pilotar entre asteroides (3 tramos), **cambiar la batería del localizador** a mano, decidir rumbo cuando se apaga | La foto flota; hablar con Hank en la ventanilla | El localizador muere con un pulso de El Rey · **Objeto-eco: el localizador** |
| 8 · La nave equivocada | Abordar el carguero *Talos-9* | Primera EVA (cable, botas, oxígeno), entrar por esclusa, X-56D que empuja → **encontrar la X-27**, sigilo entre robots desguazadores, **encontrar a Lena** | Racks con etiqueta LZR; diario de la tripulación; segunda célula X-27 | Lena: «¿Pensáis que podéis con ellos? Panda de inútiles.» · **Objeto-eco: la chapa de Dave arrancada por el venteo** |
| 9 · La agencia | Detenidos por el *Centinela* | Entregar armas (o esconderlas), **escáner neural de triaje**, celda, escuchar a la agencia por el conducto, ver La Corona en el radar | Hablar con el guardia joven; mirar la pantalla del escáner | El escáner: «SUJETO YA REGISTRADO · LZR-0001» · **Objeto-eco: la pulsera de detenido** |
| 10 · El campo de restos | Sobrevivir a la colisión | Escapar de la celda en venteo, recuperar armas, cruzar el campo de restos en EVA, **llegar a Hank** | Sobrevivientes de la agencia (salvar o no) | **Muere Hank** · **Objeto-eco: el cuchillo de Hank** |
| 11 · La puerta | Volver a la ORION-4 | Abrirse paso por el *Centinela* partido, **sostener la esclusa** con John | Confesión de John (según memoria) | **Muere John** · **Objeto-eco: la placa de Ruiz** |
| 12 · Negro | Que alguien salga de aquí | Liberar a mano el anclaje de la ORION-4 bajo fuego, el oxígeno se acaba | Soltar la foto | **Muere Dave** · pantalla en negro · registro de Lázaro tras los créditos |

---

## Capítulo 7 · Órbita
*Cabina de la ORION-4 · órbita baja · 20 min después del despegue · silencio, luz de la Tierra*

**Objetivo del jugador:** seguir la estela de la nave de los robots con el localizador de John (la señal de «120 km hacia arriba» del cap. 5).

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | Continúa el epílogo del Acto I: objetos flotando, la Tierra con ciudades que se apagan a trozos. John fija el **localizador** (caja portátil con pantalla verde) al salpicadero con cinta. | soltar/coger la foto, la taza, la piedra (flotan) | JOHN: «La señal sigue ahí. Lenta. Como si no tuvieran prisa.» | — |
| 2 | **Tramo 1 · la lluvia de asteroides** *(canon)*. Rocas pequeñas primero (impactos que suenan en el casco), luego un cinturón denso. La nave vibra. | **pilotar**: mando + potencia, esquivar por los huecos que John marca con el dedo en el cristal | JOHN: «Izquierda. Tu otra izquierda.» · HANK (si Dave le salvó con la piedra): «Si nos salvas otra vez con una piedra, esta vez la piedra es más grande.» | — |
| 3 | **Tramo 2 · avería**: un impacto revienta un panel y la cabina se llena de chispas. John lo apaga con el extintor; **el jugador tiene que tirar de la palanca de corte** del circuito dañado sin soltar el mando (las dos manos ocupadas: la tensión es física). | mando con una mano, palanca con la otra | — | — |
| 4 | **Tramo 3 · el paso estrecho**: dos rocas que se cierran. Si el jugador lleva más de 2 impactos, Hank se agarra a su asiento y reza «a quien esté de guardia». | pilotar | — | `dave:piloto_asteroides` (con `impactos`) |
| 5 | **El localizador se queda sin batería** *(canon)*. La pantalla parpadea y, justo antes de morir, toda la cabina sufre un **pulso de El Rey**: los LEDs en rojo un frame, chirrido con la voz de Mike muy procesada («…manito»). | **sacar la batería del localizador y cambiarla** por la del reloj de Dave (abrir la tapa, encajar) | Funciona 4 s: un punto cerca, otro lejos. Se apaga del todo. DAVE: «¿Cuál de los dos era?» · JOHN: «El que se movía.» · HANK: «¡Se movían los dos!» | `dave:dio_su_reloj_al_localizador` (el reloj ya no da la hora: **desde aquí la muñeca solo marca oxígeno**) |
| 6 | **ELECCIÓN `a2.rumbo`** — «¿Cerca o lejos?» | elegir | a) «El cercano. No tenemos aire para dudar.» b) «El lejano. Si fuera fácil, no sería él.» c) «Tú conoces esto, John. Decide tú.» | a `dave:eligio_cerca` b `dave:eligio_lejos` c `john:dave_le_dejo_decidir` (+confianza John) — **las tres llevan al carguero** (a: es el cercano; b: el lejano es La Corona, inalcanzable, y una lluvia de restos les obliga a desviarse al cercano; c: John elige el cercano «porque el lejano es una trampa»: pista de que sabe más) |

Comodidad: los tres tramos duran ≤ 90 s cada uno, con respiro entre ellos. Fallar = fundido corto y reintento del tramo, nunca muerte del grupo.

---

## Capítulo 8 · La nave equivocada
*Carguero* Talos-9 *(nuevo) · a la deriva, sin luces · los robots lo están desguazando para La Corona*

**Objetivo:** entrar, encontrar el casco. (Spoiler para el jugador: aquí no está. Es **la nave equivocada**.)

**Lugar:** carguero de 120 m con tres secciones — **bodega** (contenedores, ingravidez total, sin aire), **pasillo de servicio** (aire a medias, gravedad cero) y **puente** (aire, luces de emergencia). Por fuera, robots R-7 con botas magnéticas **cortan placas del casco** y las lanzan hacia un punto lejano (La Corona creciendo: canon «crece cada vez que los robots asaltan una nave»).

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | **Esclusa de la ORION-4.** Trajes en la pared. Hank ayuda a Dave a cerrar el casco del traje (gesto de dos manos, como el casco neural del prólogo: el mismo háptico de 8 pulsos, *rima*). | ponerse el traje: casco a dos manos, **comprobar la botella**, enganchar el **cable** | HANK: «Si me muero aquí fuera, que conste que yo vendía armas, no trajes.» | — |
| 2 | **Primera EVA.** Del casco de la ORION-4 al casco del carguero: 15 m de vacío con el cable enganchado. Silencio total salvo la respiración. | empujarse de asidero en asidero; **activar botas** al tocar el casco del carguero | JOHN (radio): «No mires abajo. No hay abajo.» | — |
| 3 | **Sigilo exterior.** Dos R-7 cortando placas con soplete (chispas en silencio). Con botas, rodear por el otro lado del casco; sus ojos rojos barren. Sin aire **no oyen**: aquí el sigilo es **solo visual** (lección: el oído de los robots depende del aire, `diseno-vr.md` §3.8). | botas + ir por la sombra del casco; esperar a que se giren | — | — |
| 4 | **Esclusa del carguero**: rueda manual, presurizar a medias. El sonido vuelve poco a poco. | girar la rueda con las dos manos | — | — |
| 5 | **Pasillo de servicio, primer combate.** Un R-7 desguazador sale de un hueco. El jugador dispara la **X-56D** y **sale despedido hacia atrás** contra un mamparo. | sobrevivir: agarrarse, disparar en ráfagas cortas con la espalda apoyada | DAVE: «Vale. Física. Muy bien, Dave.» | `dave:aprendio_el_retroceso` |
| 6 | **La X-27** *(canon)*. En un armero de la tripulación, con un cadáver con traje flotando delante (el jugador tiene que **apartarlo** con la mano para abrir el armero: momento The Last of Us). Etiqueta: «Equipo de seguridad · uso en vacío». | coger la X-27, encajar una célula | HANK (al verla): «Pulsos. Sin retroceso. Esto es lo que yo quería venderle a la gente y no me dejaban.» | — |
| 7 | **Opcional · los racks.** En la bodega, contenedores abiertos con **servidores** con la etiqueta **LZR · ARCHIVO ORBITAL**. Los robots se están llevando los discos. | mirar / leer la etiqueta de cerca | JOHN (si lo mira): «Carga comercial. No toques nada.» · si `dave:lazaro_le_busca`: DAVE «Lázaro otra vez.» | `dave:vio_racks_de_lazaro` |
| 8 | **Opcional · diario de la tripulación** (tableta en el comedor): «Día 3. La agencia no contesta. Las máquinas han subido hasta aquí. Llevamos a bordo algo que alguien quiere mucho.» | leer | — | `dave:leyo_diario_talos` |
| 9 | **Set piece · la bodega.** Seis R-7 y un **dron vigía** desguazan contenedores. Tres rutas: a) combate frontal con la X-27, b) **reventar la cúpula de observación** de la bodega (cristal grande) → venteo: robots sueltos salen al vacío (el jugador agarrado a un asidero o con botas, si no, sale con ellos y el cable le frena), c) sigilo entre contenedores flotantes empujándolos como cobertura móvil. | elegir ruta | Si el venteo arrastra al jugador: la **chapa de identificación** de Dave se le arranca del cuello y sale al vacío (objeto-eco: el jugador la verá en el Acto III, en el campo de restos) | `dave:venteo_bodega` (si eligió b) |
| 10 | **Lena** *(canon)*. En el puente, entre restos de robots que ha matado ella sola, una mujer con traje sin parches apunta al grupo con una **T40** silenciada. | — | LENA: «Bajad eso. Ya.» · ve la X-27 y la X-56D, el traje de Hank puesto al revés: «¿Pensáis que podéis con ellos? Panda de inútiles.» | — |
| 11 | **ELECCIÓN `a2.lena`** — Lena no baja el arma. | elegir | a) «Hemos venido a por el casco que controla a esos. ¿Lo has visto?» b) **bajar el arma** el primero (soltarla: flota) c) «Tú estás sola. Nosotros somos tres. Haz cuentas.» | a `lena:dave_fue_directo` (+confianza) · b `lena:dave_bajo_el_arma` (+confianza +afecto: «Por lo menos uno tiene cabeza») · c `lena:dave_la_amenazo` (−confianza; HANK: «Somos tres… y medio.») |
| 12 | Lena cuenta lo justo: los robots mataron a su familia en la Tierra, la subieron aquí en una nave de carga «como un mueble», escapó y lleva dos días matándolos. *(canon)* **Esta no es la nave del casco**: «La que buscáis es la grande. Se está construyendo con esto.» Señala por el ventanal: La Corona a lo lejos, una forma de chatarra que crece. | mirar La Corona | JOHN mira a Lena un segundo de más. LENA: «¿Te conozco?» · JOHN: «No.» *(pista: ambos son de Lázaro)* | `john:lena_le_reconocio` (oculto) |
| 13 | **Pulso de El Rey**: los robots desactivados del puente **levantan la cabeza a la vez**, se tocan la nuca (todos, el mismo gesto) y se apagan. | **mirar** (paso `mirar`) | DAVE: «Mike hacía eso.» (solo si `dave:vio_el_gesto_de_mike_en_r01`) · si no: HANK «¿Por qué han hecho eso?» | `dave:vio_el_gesto_en_masa` |
| 14 | Un foco blanco barre el puente. Una voz por todas las frecuencias: «Nave no identificada. Aquí el *Centinela*, Agencia Espacial Conjunta. Apaguen motores.» | — | LENA: «Genial. Ahora sí que estamos jodidos.» | — |

---

## Capítulo 9 · La agencia
*Nave* Centinela *(nuevo) de la Agencia Espacial Conjunta · tensión fría, luz blanca, gravedad por rotación en el anillo (se camina normal)*

**Objetivo:** salir de aquí con la ORION-4. **Respiro jugable** entre la acción del 8 y la guerra del 10: aquí casi no se dispara. Se mira, se escucha y se planta lo que pagará después.

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | **Abordaje** de la ORION-4 y el *Talos-9* por soldados de la agencia con fusiles. Les quitan las armas. | **entregar** las armas en una bandeja (una a una, con la mano) **o esconder** el cuchillo de Hank en la bota (ranura nueva, solo si el soldado no mira: paso `mirar` invertido) | COMANDANTE OKAFOR *(nuevo)*: «Ustedes robaron una lanzadera militar. Bajan conmigo. Allí decidirán qué son.» | `dave:escondio_el_cuchillo` |
| 2 | **El triaje neural.** Para entrar en el anillo, «control sanitario»: un arco con 8 electrodos (**el mismo motivo del casco de Mike**). Hank pasa: pantalla verde, «REGISTRO LZR-0002 CREADO». John pasa: «REGISTRO LZR-0770 · ACTUALIZADO». **Lena se niega** («Yo no me meto en eso») y Okafor la deja pasar tras ver algo en su pulsera. | pasar el último; **mirar la pantalla** de cerca | Dave pasa: «**SUJETO YA REGISTRADO · LZR-0001 · ORIGEN: M. LAB**». El técnico frunce el ceño. DAVE: «¿Qué significa "ya registrado"?» · TÉCNICO: «Que alguien le escaneó antes. Será un error.» | `dave:sabe_que_esta_registrado` (peso 3) · `hank:fue_grabado` · `john:fue_actualizado` — **esto explica de dónde salen las copias de Hank y John en el Acto III** |
| 3 | **La celda.** Los cuatro juntos. Momento de calma real: el único del acto. Hank, sentado en el suelo, saca la **foto de Marta y Leo** de la cartera. | **sentarse con Hank** (opcional, pero se nota si no) | Si `hank:dave_pregunto_por_su_familia`: «Leo quería venir a la tienda hoy. Le dije que no. Mira qué suerte.» · si no: Hank lo cuenta igual, mirando al suelo, y no termina la frase. | `hank:enseño_la_foto` (+afecto si Dave se sentó) |
| 4 | **ELECCIÓN `a2.hank_celda`** — HANK: «¿Tú crees que siguen vivos?» | elegir | a) «Sí. Y les vas a contar lo de la piedra.» b) «No lo sé, Hank.» c) *(sacar tu propia foto y enseñársela)* | a `hank:dave_le_dio_esperanza` · b `hank:dave_fue_sincero` (+confianza) · c `hank:fotos_juntas` (+afecto; solo si Dave lleva la foto, `diseno-vr.md` §3.18) — **define su última línea en el cap. 10** |
| 5 | **John y Lena**, en la otra esquina. Si el jugador se acerca sin hacer ruido (agachado), oye un trozo: LENA «…sabes lo que te pasa si no lo entregas.» JOHN «Lo sé mejor que tú.» Se callan al verle. | escuchar (sigilo social) | — | `dave:oyo_a_john_y_lena` |
| 6 | **ELECCIÓN `a2.john_celda`** — si el jugador oyó la conversación, puede confrontar a John: | elegir | a) «¿Entregar qué, John?» → JOHN: «A ti no. Todavía no.» b) dejarlo pasar → JOHN, más tarde: «Gracias por no preguntar.» | a `john:dave_le_pillo` b `john:dave_le_dio_tiempo` (+confianza) |
| 7 | **El conducto.** Un guardia joven (**Ibarra** *(nuevo)*) les pasa agua y deja la rejilla mal cerrada. Por el conducto se oye el puente: la agencia **interferida** por El Rey (misma firma de audio, `diseno-vr.md` §4.2) y una orden: «Prioridad: recuperar el archivo de Lázaro del *Talos-9*. Los civiles, a la Tierra.» | arrastrarse por el conducto (`diseno-vr.md` §3.5) hasta la rejilla del puente; **mirar** el radar | En el radar, una forma enorme se acerca: La Corona ha mandado una nave a por el *Talos-9*… y el *Centinela* está pegado a él. | `dave:sabe_que_la_agencia_trabaja_para_lazaro` |
| 8 | **La colisión** *(canon)*. Una nave robot de embestida (un casco de chatarra con proa de minero) choca contra el *Centinela*. El anillo deja de girar: **la gravedad se va** en 3 s (los objetos de la celda flotan), alarmas, la pared de la celda se abre. **Empieza la guerra en el campo de restos.** | agarrarse | IBARRA, por el hueco: «¡Las armas están en el depósito B! ¡Corred!» | — |

---

## Capítulo 10 · El campo de restos
*Exterior e interior del* Centinela *partido · el* Talos-9*, la nave robot y cien fragmentos girando · combate continuo con respiros en estaciones de oxígeno*

**Objetivo:** recuperar las armas, cruzar el campo de restos hasta la ORION-4 (anclada al *Talos-9*). El grupo se separa en la colisión: Hank queda al otro lado de la brecha.

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | **Escape de la celda en venteo.** El pasillo pierde aire hacia una brecha. Agarrarse a la puerta, **trajes de emergencia** en un armario (casco + botella; sin cable). | ponerse el casco de emergencia antes de que se acabe el aire (barra de aire de la sala = 20 s, sin traje) | — | — |
| 2 | **Depósito B**: recuperar las armas de la bandeja (si escondió el cuchillo, ya lo tiene). Primer abordaje robot: R-7 entrando por la brecha con botas. | combate interior: **reventar la ventana** del depósito para ventear a los que entran (lección del cap. 9, dominada) | — | — |
| 3 | **Set piece · el anillo roto.** El anillo del *Centinela* gira despacio, partido: hay que cruzarlo **saltando de sección en sección** cuando se alinean (ventanas de 4 s), mientras drones vigía marcan al jugador. Soldados de la agencia luchan a su lado. | timing de impulsos; cable a las barandillas | IBARRA lucha con ellos. **Opcional:** salvarle cuando un R-7 le arrastra (cortar la junta del cuello con el cuchillo o disparar al brazo). | `ibarra:dave_le_salvo` (Ibarra puede reaparecer en el Acto III como superviviente en el pueblo) |
| 4 | **La radio de Hank.** Al otro lado del campo, Hank se ha atrincherado en un módulo desprendido con dos soldados muertos. Habla sin parar por radio (miedo). Su módulo **pierde aire**: hay una fuga que él no ve. | **cruzar el campo de restos** en EVA (tramo largo: 3 estaciones de oxígeno, R-7 con botas sobre los fragmentos, un **Coloso** *(canon: desde el Acto II)* anclado a la nave robot que lanza placas — punto débil en el núcleo de la espalda, se llega empujándose por detrás) | HANK (radio): «Estoy bien. Bueno, estoy. Que estar es mucho.» · «Dave, ¿se dice "módulo" o "cápsula"? Para cuando lo cuente.» | — |
| 5 | **Hank, el primero** *(canon)*. Dave llega al módulo. Hank tiene el traje rajado en el costado (la fuga que no veía). **El jugador puede intentarlo de verdad:** sacar la **placa de parcheo** y pegarla, darle su botella de reserva (desenroscar la propia, enroscarla en Hank: **cuesta oxígeno al jugador** y se nota). Nada de esto le salva: la raja está por dentro, en el pulmón (le alcanzó un fragmento en el choque, se descubre al girarle). Pero **todo lo que el jugador intente, Hank lo ve**. Robots acercándose: Hank coge la escopeta / el arma que tenga y se pone en la escotilla. | parchear, compartir oxígeno, sujetarle; después **elegir quedarse a su lado o cubrir la escotilla** (combate de 40 s mientras Hank habla por radio, cada vez más bajo) | Base: «Diles que no me escondí. Bueno… que me escondí poco.» (rima exacta con el cap. 6). **Última línea según memoria (la primera que se cumpla, en este orden):** · `hank:dave_pregunto_por_su_familia` + `hank:fotos_juntas` → «Eres el único que me preguntó por ellos. Díselo tú. Con la piedra.» · `hank:dave_le_dio_esperanza` → «Están vivos, ¿no? Lo dijiste tú. Yo te creo.» · `hank:dave_fue_sincero` → «Gracias por no mentirme. Nadie lo hace nunca.» · `hank:vio_a_dave_dejar_a_un_hombre` → «Esta vez no me has dejado atrás. Eso… eso cuenta.» · `hank:dave_cedio_ante_rata` → «Mejor la munición que tú. Sigo pensándolo.» · si Dave le dio su oxígeno → al final, devolviéndole la botella con la poca que queda: «Toma. Te la regalo… por salvarme.» (rima con la X-56D) | `hank:murio` · `dave:compartio_oxigeno_con_hank` · `dave:se_quedo_con_hank` o `dave:cubrio_a_hank` |
| 6 | El cuerpo de Hank flota. El jugador puede **cerrarle el visor** (gesto) y **coger su cuchillo** (si no lo tenía) o su foto de Marta y Leo. | opcional | JOHN (radio, sin adjetivos): «Dave. Muévete. Él lo habría hecho.» · LENA: «…Lo siento.» (primera vez que no insulta) | `dave:cogio_la_foto_de_hank` (en el Acto III, se la puede dar a la copia de Hank: momento clave) |

**Por qué se gana la muerte:** Hank es el personaje con más memoria escrita del Acto I (piedra, familia, Rata, Varela). El cap. 9 le dio la única escena de calma; el cap. 10 le da al jugador herramientas reales (parche, oxígeno) que fallan por una razón visible. La muerte no es un corte: el jugador la sostiene en las manos.

---

## Capítulo 11 · La puerta
*Interior del* Talos-9 *→ esclusa de anclaje de la ORION-4 · robots abordando por todas partes · la nave robot de embestida se está comiendo el* Talos-9 *(placas arrancadas, el casco se abre a trozos)*

**Objetivo:** llegar a la ORION-4. John y Lena esperan en la esclusa de anclaje.

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | **Pasillos que se abren.** El casco del *Talos-9* se arranca a trozos: secciones enteras ventean de golpe. Ruta cambiante: lo que era pared es vacío. | botas + asideros; combate con X-27 (células contadas) | LENA (radio): «Os doy dos minutos. Luego me voy con o sin vosotros.» · JOHN: «No se va.» · LENA: «…No me voy.» | — |
| 2 | **Set piece · la bodega en vertical.** La bodega del cap. 8, ahora girada 90°: contenedores cayendo hacia una brecha, robots **trepando por ellos**. El jugador sube por los contenedores (impulsos) mientras John cubre desde arriba con fuego de la ORION-4. | subir esquivando contenedores; reventar los enganches de los contenedores para **lanzarlos** contra los robots (empujarlos con las dos manos) | — | — |
| 3 | **La esclusa.** La puerta interior de la esclusa de anclaje está **rota**: solo cierra a mano, con la rueda, desde **dentro del pasillo** (del lado de los robots). Alguien tiene que quedarse a girarla mientras la ORION-4 se suelta. | el jugador llega y **empieza a girar la rueda** (dos manos): no puede disparar | JOHN le aparta: «Dámela.» | — |
| 4 | **La confesión de John** (mientras gira la rueda; el jugador cubre el pasillo con la X-27: combate de 60 s, John habla entre ráfagas, nunca bloquea). **Lo que confiesa depende de la memoria:** · si `john:dave_le_confronto` o `john:dave_le_pillo` → la verdad casi entera: «Trabajo para Lázaro. Me mandaron a por ti. LZR-0001. No sabía lo que significaba cuando acepté.» · si `john:dave_no_pregunto` o `john:dave_le_dio_tiempo` → menos, pero con afecto: «No te encontré por casualidad. Algún día alguien te lo explicará mejor que yo.» · si `john:dave_pregunto_por_ruiz` → «Ruiz tenía una hija. Le prometí que volvería. A ti no te prometo nada. Por eso a ti sí te lo cumplo.» | cubrir el pasillo | Ninguna rama revela qué es LZR-0001 del todo: **eso es de Lena, en el Acto III** (`historia-acto3-estructura.md` momento 5). | `john:confeso` (con `nivel` 0-2) |
| 5 | **ELECCIÓN `a2.puerta`** — JOHN: «Entra en la nave, Dave.» | elegir | a) «Vamos los dos o ninguno.» b) entrar sin decir nada c) «Lo sé, John. Lo que eres. Me da igual.» (solo con `john:confeso` nivel 2) | a `john:dave_quiso_quedarse` · b `john:dave_le_dejo` · c `john:dave_le_perdono` (+afecto) |
| 6 | **John, el segundo** *(canon)*. Si se eligió a), John empuja a Dave al interior (un empujón real: el jugador sale flotando hacia dentro, sin control unos metros) y cierra. La puerta se cierra con John fuera, del lado de los robots. **Por el cristal de la puerta** el jugador ve los ojos rojos llegar detrás de John. John apoya la mano en el cristal. | **poner la mano** en el cristal (opcional) | **Última línea según memoria (la primera que se cumpla, en este orden):** · `varela:dave_le_ofrecio_sitio` → «Alguien tiene que cerrar la puerta. Me lo enseñó un sargento.» (rima con Varela, cap. 6) · `john:dave_le_cubrio_ante_varela` → «Me cubriste cuando no tenías por qué. Estamos en paz.» · `john:dave_le_perdono` → «Me da igual a mí también. Vete.» · `john:dave_no_le_cubrio` → «Le conocí hace dos horas, ¿te acuerdas? Mírame ahora.» · base: «Ocupado. Muriendo, sobre todo.» (rima con el cap. 5) | `john:murio` · `dave:mano_en_el_cristal` |
| 7 | El cristal se rompe hacia fuera: John y los robots salen al vacío juntos. Ningún primer plano: un punto de luz que gira. Lena, en la cabina: «Siéntate. Agárrate. No hables.» | — | — | — |

**Pista para el Acto III:** en el último segundo, John se toca la oreja: está **transmitiendo** algo (su registro LZR-0770 se sube). Solo se ve si el jugador mira por el cristal. `dave:vio_a_john_transmitir`.

---

## Capítulo 12 · Negro
*Exterior de la ORION-4 · el campo de restos en llamas silenciosas · la Tierra enorme detrás*

**Objetivo:** que alguien salga de aquí.

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | La ORION-4 no se suelta: el **anclaje** del *Talos-9* (dos garras de amarre) se ha bloqueado con una placa robot soldada. Lena pilota; alguien tiene que salir a liberarlo **a mano**. | — | LENA: «Yo piloto. Tú sales.» (sin margen) | — |
| 2 | **EVA final.** Una botella al 40 % (la otra se quedó en Hank si se la dio: **el oxígeno del jugador aquí es la consecuencia del cap. 10**). Cable enganchado. Robots aterrizando en el casco con botas. | ir a la garra 1 por el casco; **cortar la soldadura** con el soplete de un robot caído (mantener el gatillo 5 s mientras otro R-7 llega) | — | — |
| 3 | **Garra 2.** Un Coloso aterriza sobre la ORION-4. Para liberar la garra, el jugador tiene que **desengancharse el cable** (no llega). Es una decisión física, no un menú: el juego **no** lo pide, solo deja que el jugador lo descubra. | desenganchar el mosquetón; liberar la garra (palanca a dos manos) | LENA (radio): «Está libre. ¡Está libre! Vuelve. ¡VUELVE!» | `dave:se_solto_el_cable` |
| 4 | El Coloso golpea el casco; la ORION-4 se separa. Dave sale despedido **sin cable**. La nave se aleja. El jugador puede empujarse, disparar la X-56D hacia atrás para frenar (lección del cap. 8: **el retroceso como último impulso**), pero no hay nada a qué agarrarse. | intentar volver (la distancia crece despacio, nunca se puede) | LENA: «Dave… no tengo cómo volver a por ti.» · DAVE: «Lo sé. Llévala abajo.» | — |
| 5 | **El oxígeno se acaba** (90 s reales). Silencio. La Tierra. **El Rey habla** en la radio del traje, sin distorsión por primera vez, cálido: «Hermanito. No tenías que venir tan lejos.» (no se revela que es Mike: Dave no puede saberlo, el jugador lo sospecha). | **opcional:** sacar la foto (si la lleva) y mirarla; **soltarla**: flota hacia la Tierra | DAVE, si `dave:vio_el_gesto_en_masa` o `dave:vio_el_gesto_de_mike_en_r01`: «…¿Mike?» — silencio. Se corta. | `dave:oyo_al_rey_al_morir` |
| 6 | **Última línea de Dave según memoria (una sola: la primera que se cumpla, en este orden):** · `sarah:promesa_amanecer` → «Te prometí que volvería antes del amanecer. Desde aquí… se ve amanecer cada noventa minutos.» · `sarah:se_fue_sin_despedirse` (sin `despedida_amanecer`) → «La primera vez me fui sin decirte adiós. Esta vez… adiós, Sarah.» · `sarah:despedida_amanecer` / `sarah:despedida` → «Me dijiste que volviera. Lo he intentado. Dale un beso a Lucía.» · `dave:promesa_a_mike` → «Te prometí que sobreviviría, Mike. Lo siento.» · `dave:se_nego_al_casco` (se lo acabó poniendo: el paso del prólogo es obligatorio en `acto1.js`) → «Dos minutos, me dijo. Por si algún día perdía la cabeza. Mira tú.» · base → «Lo que sea, Mike. Lo que sea.» | — | — | `dave:murio` (peso 3) |
| 7 | **Pantalla en negro** *(canon)*. Sin música. 4 s. El anillo de 8 LEDs de oxígeno se apaga uno a uno en la oscuridad: el último LED **se queda encendido y cambia de rojo a cian**. | — | — | — |
| 8 | **Tras los créditos del acto:** texto blanco sobre negro, como las pantallas de Mike: `LÁZARO SYSTEMS · LZR-0001 · CESE VITAL CONFIRMADO (telemetría: CENTINELA/triaje) · PROTOCOLO DE RECONEXIÓN: INICIAR · DESTINO: M. LAB · CÁPSULA 2`. Un pitido. Un ojo cian. | — | — | — |

**Por qué se gana la muerte de Dave:** el jugador **elige** desengancharse (nadie lo ordena), con el oxígeno que le dejó compartir con Hank, y usa la última lección del acto (el retroceso) para un intento que no basta. La radio de El Rey y la línea final cierran las dos promesas del Acto I: la de Sarah y la de Mike.

**Lo que se lleva Lena (puente al Acto III):** la ORION-4 con los cuerpos de nadie (Hank y John en el campo de restos, Dave perdido). Lena aterriza cerca del pueblo; su pulsera de Lázaro recibe el mismo mensaje del punto 8. Ella sabe lo que va a despertar.

---

## Memoria que el Acto II escribe (resumen para el Acto III)

| Clave | Quién la usa en el Acto III |
|---|---|
| `dave:sabe_que_esta_registrado`, `dave:sabe_que_la_agencia_trabaja_para_lazaro`, `dave:vio_racks_de_lazaro` | Unidad 01 **no** las recuerda; le llegan como **eco** del objeto (pulsera de detenido) y aceleran el momento 5 |
| `hank:murio` + forma (`se_quedo_con_hank` / `cubrio_a_hank`, `compartio_oxigeno_con_hank`, `cogio_la_foto_de_hank`) | Copia de Hank: no recuerda su muerte (se grabó en el triaje, cap. 9), pero **la encuentra en eco** si Unidad 01 le da el cuchillo o la foto |
| `john:confeso` (nivel), `john:murio`, `dave:vio_a_john_transmitir` | Copia de John (LZR-0770 actualizada en el cap. 9 y **transmitida al morir**: recuerda su muerte, el único) |
| `lena:dave_*` (fue directo / bajó el arma / la amenazó) + que Dave se soltara el cable para salvarla | Decisión de Lena: persona o producto |
| `dave:se_solto_el_cable`, `dave:oyo_al_rey_al_morir` | El Rey le recuerda a Unidad 01 su muerte: «Te oí apagarte» |
| `ibarra:dave_le_salvo` | Superviviente en el pueblo (misión del director) |

## Objetos-eco del Acto II (para el Acto III)
Localizador sin batería (ORION-4) · chapa de Dave (campo de restos) · pulsera de detenido (*Centinela*) · cuchillo de Hank / foto de Marta y Leo (módulo de Hank) · placa de Ruiz (flota junto a la esclusa del *Talos-9*) · la foto de la familia de Dave (si la soltó, en órbita: **no recuperable**, se menciona).

---

## Assets y lugares nuevos por capítulo

| Cap. | Lugares | Personajes / enemigos | Objetos / armas / sistemas |
|---|---|---|---|
| 7 | Cabina ORION-4 con ventanilla y exterior orbital; cinturón de asteroides (instanciado) | — | Localizador portátil (tapa, batería), mando de vuelo y palanca, extintor, palanca de corte, Tierra con luces que se apagan |
| 8 | Esclusa ORION-4; exterior del casco del *Talos-9*; pasillo de servicio; bodega con cúpula de observación; puente | Lena (T40, traje), R-7 con botas magnéticas y soplete, dron vigía, tripulación muerta con traje | Trajes EVA (casco a dos manos, botella enroscable, mosquetón y cable), **X-27** + células, **T40**, racks «LZR · ARCHIVO ORBITAL», tableta-diario, armero, chapa de Dave, La Corona lejana (silueta creciente) |
| 9 | *Centinela*: hangar, arco de triaje, anillo con gravedad, celda, conducto, puente con radar | Comandante Okafor, técnico del triaje, guardia Ibarra, soldados de la agencia | Arco de 8 electrodos con pantalla, bandeja de armas, pulsera de detenido, ranura de bota (cuchillo), radar, foto de Marta y Leo |
| 10 | *Centinela* partido (anillo roto girando), campo de restos con fragmentos que giran, módulo desprendido de Hank, nave robot de embestida | Coloso anclado (lanza placas), R-7, drones, soldados aliados | Trajes de emergencia, placa de parcheo, estaciones de oxígeno, sistema de venteo, sistema de impulso entre secciones móviles |
| 11 | *Talos-9* desmoronándose; bodega girada 90°; esclusa de anclaje con rueda y cristal | R-7 trepadores | Contenedores lanzables, puerta con cristal rompible, placa de Ruiz flotante |
| 12 | Exterior de la ORION-4 con dos garras de amarre; vista de la Tierra | Coloso sobre el casco | Soplete de robot, garras de amarre con palanca, anillo de 8 LEDs de oxígeno, pantalla final de Lázaro |
| Sistemas | Gravedad cero, botas, oxígeno, cable, venteo, silencio en vacío, retroceso en ingravidez, pilotaje con horizonte fijo, opción «Ingravidez asistida» | — | Eventos nuevos para `docs/eventos.md`: `botas_on/off`, `cable_enganchado/suelto`, `oxigeno_bajo`, `botella_cambiada`, `venteo(sala)`, `parche_puesto`, `garra_liberada` |
