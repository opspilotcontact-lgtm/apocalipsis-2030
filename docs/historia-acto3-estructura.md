# Apocalipsis 2030 · Acto III «Lo que queda de nosotros» — estructura

Estructura, no guion: define la columna fija, las condiciones, el director de misiones, la conversión, los ecos y los finales. El guion escena a escena se escribirá encima (como `historia-acto1.md`). Fase **F4** de `PLAN-MAESTRO.md`.
Canon: biblia 0.1 (seis momentos, director, conversión con precio, tres finales, gancho Lázaro) + `historia-acto1.md` (Unidad 01 recuerda hasta el prólogo; lo demás, ecos) + `historia-acto2.md` (de dónde salen las copias de Hank y John; objetos-eco).

**Giros que este acto cierra (no adelantar):**
- **Mike dentro de R-01 / El Rey**: pista en el Acto I (gesto de la nuca, grabación de las 22:10), refuerzo en el II (gesto en masa, «hermanito» al morir Dave). Revelación completa: **momento 4**.
- **El código de John**: agente de Lázaro (LZR-0770, «Lázaro, siete, siete, cero»), enviado a por LZR-0001. Su copia es la única que recuerda su muerte (se transmitió). Lo confiesa entero en una misión del director (condición: estar despierto).
- **Lázaro / Lena / «tú solo eres una de ellas»**: **momento 5**.

---

## 1. Despertar · el Laboratorio del Despertar (escena de apertura, jugable)

*Laboratorio de Mike, sala de cápsulas · días después · luz de emergencia, polvo, lluvia fina entrando por un techo roto. El mismo sitio del prólogo: el jugador lo conoce.*

**Las 6 cápsulas** (la «cápsula dos» de la cinta de Mike es la de Unidad 01):

| Nº | Etiqueta | Estado | Para qué sirve |
|---|---|---|---|
| 1 | R-01 | **Vacía, reventada desde dentro** | Donde dormía El Rey. Primer objeto-eco: tocarla da 2 s de la grabación de las 22:10 (Mike con el casco frente a R-01) |
| 2 | LZR-0001 · UNIDAD 01 | **Se abre** | Tú |
| 3 | LZR-0002 | Cerrada, chasis verde oliva sin núcleo | Hank. Se despierta con su **fragmento** (momento 3) |
| 4 | LZR-0770 | Cerrada, chasis color arena, **ya cargado** («recibido por telemetría») | John. El único que se puede despertar ya; dice cosas que no debería saber |
| 5 | SOREL | **Vacía y sin chasis**, etiqueta rascada | Lena se negó al triaje (Acto II, cap. 9): su hueco reservado nunca se llenó. Pista del momento 5 |
| 6 | LZR-0001 · B | **Sellada**, cristal opaco, sin interacción | El gancho de la secuela: otra copia de Dave. Nadie la menciona hasta el final |

**Secuencia (reutiliza mecánicas ya diseñadas):**
1. Negro. El LED cian que cerró el Acto II es ahora **el ojo** de Unidad 01. Vaho dentro de la cápsula.
2. El cristal está **empañado**: limpiarlo con la mano (máscara de vaho, `diseno-vr.md` §5 prólogo / T-62). Al otro lado: tu propio reflejo, **un robot**.
3. Empujar la escotilla. Las manos virtuales son ahora **manos de robot** (el modelo de manos cambia; primera vez que el jugador lo ve).
4. Primer paso: el cuerpo pesa (sonido metálico, háptico más grave). Visión de escaneo enseñada sin texto: mirar fijamente la cápsula 1 → marco diegético en el ojo.
5. **Primer eco obligatorio:** sobre la mesa de Mike, la taza / el destornillador del prólogo. Unidad 01 **sí lo recuerda** (nítido, en color): es antes de la grabación. Contraste inmediato con el segundo eco (§5), que llega en sepia y ajeno.
6. Línea canónica en el primer espejo/monitor: «¿Qué parte de mí es la que se acuerda?»
7. Pantallas de Mike: `RECONEXIÓN COMPLETA · LZR-0001 · ÚLTIMO REGISTRO: PRÓLOGO · 21:12`. Unidad 01 **no sabe** que Dave murió: lo descubre por ecos y por Lena.
8. **Despertar a John (opcional pero recomendado):** cápsula 4. JOHN-copia: «Me acuerdo de la puerta. ¿Tú no te acuerdas de la puerta?» (él recuerda el cap. 11; tú no). Inquietud desde el minuto uno.

---

## 2. La columna: seis momentos clave (orden fijo, desbloqueo por condición)

Siempre en este orden. Entre uno y otro, el **director de misiones** (§3) genera trabajo. Ninguno se desbloquea con «la misión X»: se desbloquean con **estado del mundo**.

| # | Momento (canon) | Condición de desbloqueo | Qué pasa (jugable) | Escribe |
|---|---|---|---|---|
| 1 | **Despertar** | Inicio | §1 | `u01:desperto`, `john_copia:despierto` |
| 2 | **Volver a casa** | Haber salido del laboratorio + **≥ 2 ecos de Dave** reunidos (la foto, el dibujo, el contestador… §5): Unidad 01 necesita saber que hay una casa a la que volver | Cruzar el pueblo de día, con humanos que huyen. Llamar a la puerta. **Sarah abre** (§6) | `sarah:vio_a_unidad01` + reacción |
| 3 | **Reclutar y convertir** | Haber visto a Sarah (pase lo que pase) | Se abre el mapa entero (pueblo + campo de restos vía ORION-4). Despertar a Hank (fragmento LZR-0002 en el *Centinela*), conversión de robots, zonas | `hank_copia:despierto`, contador `mentes_reescritas` |
| 4 | **La verdad sobre El Rey** | **≥ 6 de 9 grabaciones de Mike** (las 4 del Acto I, reencontradas como ecos, + 5 nuevas repartidas por los dos mundos) **y** controlar ≥ 1 zona del campo de restos | La grabación completa de las 22:10 y la **última cinta** de Mike, sacada de la memoria de un robot convertido: Mike se graba en R-01 «para que uno de los dos sea rey aunque yo me muera». El Rey te habla y se toca la nuca, en directo, por primera vez | `u01:sabe_que_el_rey_es_mike` |
| 5 | **La verdad sobre ti** | Momento 4 + **confianza de Lena ≥ umbral** o **haber convertido ≥ 10 robots** (Lázaro te vigila de cerca) | Lena entra en el lab con un equipo de Lázaro. Revela: Dave murió (pone la **telemetría** de su muerte: el jugador ve el cap. 12 desde fuera, el punto que se aleja). Lázaro vende «reconexión tras la muerte»; Unidad 01 es su producto piloto. Enseña la **cápsula 6**: «Tú no eres el único. Solo eres el primero que ha salido bien.» | `u01:sabe_que_es_una_copia`, `u01:vio_la_capsula_6` |
| 6 | **La Corona** | Momento 5 + **una** de: (a) controlar 3 de 4 zonas del campo de restos, (b) **mentes_reescritas ≥ 25**, (c) confianza del pueblo ≥ umbral (los humanos te prestan la ORION-4 reparada y a Ibarra/supervivientes) | Asalto final (§8) | — |

Diseño: (a), (b) y (c) son **tres estilos de jugar** (táctico, conquistador, humano) y cada uno empuja a un final distinto sin cerrarlo.

---

## 3. El director de misiones (entre momentos)

Genera misiones a partir de **cuatro fuentes de estado** (biblia) y las ofrece **en el mundo** (radio, compañeros que te hablan, humanos en la ventana, pulsos de El Rey), nunca en un menú de lista.

| Fuente | Estado que lee | Misiones que genera (plantillas) |
|---|---|---|
| **Recuerdos de los compañeros** | `memoria.js` de las copias + lo que el Acto II dejó (`hank:murio` y cómo, `john:confeso` nivel) | Hank-copia quiere ver a Marta y Leo (que le tienen pánico): escoltarle, convencerles, **darle la foto** si Dave la cogió en el cap. 10. John-copia quiere confesar entero (LZR-0770) y **borrar su registro** de Lázaro: infiltración en una oficina de Lázaro. Variantes según memoria |
| **Control de zonas** del campo de restos (4: *Talos-9*, *Centinela* partido, astillero robot, anillo de chatarra) | dueño y fuerza de cada zona | Recuperar zona (asalto), defender zona (El Rey contraataca), sabotaje de astillero (frena el crecimiento de La Corona) |
| **Confianza del pueblo** | `pueblo.confianza` (0-1), supervivientes con nombre (Ibarra, Chispa, Nico, la familia de Hank) | Proteger, abastecer, **convencer**: entrar desarmado, dejar que te registren, reparar el generador. Si hay Rata/Varela vivos en la memoria: la milicia vuelve como facción humana anti-robot |
| **Planes de El Rey** | `rey.plan` (crecer, cazar a Unidad 01, reconvertir a tus convertidos, golpear el pueblo) | Reacciona a lo que haces: si conviertes mucho → **reconversión** (tus convertidos dudan, ojos cian→rojo); si ayudas al pueblo → ataque al pueblo; si recuperas zonas → embestida |

**Reglas del director:**
1. Máximo **3 misiones vivas** a la vez; una siempre «de compañero» (personal), una «de mundo», una «de El Rey» (reactiva).
2. Cada misión tiene **objetivo físico** y **alternativa** (patrón de `eventos.md`): ninguna depende de la IA conversacional para completarse; la IA solo cambia lo que se dice.
3. Ritmo Resident Evil: tras una misión de combate, la siguiente ofrecida es de respiro (casa, tienda de Hank como zona segura, ORION-4).
4. Los compañeros convertidos y las copias **pueden negarse** (biblia): una misión que contradice su memoria («Hank, vigila la puerta mientras convierto a ese» tras `hank_copia:vio_conversion_dolorosa`) se rechaza con una línea y una alternativa.
5. El director también **cierra** misiones: si tardas, el pueblo sufre el ataque sin ti (consecuencia visible al volver, no fallo).

---

## 4. La conversión (mecánica central)

Diseño VR completo en `diseno-vr.md` §4.3 (derribar → arrancar placa → mano al núcleo → anillo de 8 luces rojo→cian → forcejeo → flash de recuerdo ajeno). Lo que añade este documento: **el precio**.

| Capa | Regla |
|---|---|
| **Contador `mentes_reescritas`** | Cada conversión suma 1. No se muestra como número: se ve en el **anillo del pecho** de Unidad 01 (una muesca cian por cada 5) y lo **comentan** Hank-copia, John-copia, Lena y El Rey |
| **Restos** | 1 de cada 4 robots convertibles tiene **restos de persona** (una copia barata de Lázaro sin cuerpo): el ojo de Unidad 01 **parpadea** (duda) antes de convertir. Mantener la mirada en el parpadeo desbloquea **«dejarle ir»** (`diseno-vr.md` §4.3): no se convierte, se apaga libre. Cuenta en `mentes_liberadas` |
| **Lo que ven los demás** | Humanos del pueblo: cada conversión presenciada −confianza. Hank-copia: «¿Eso me hicieron a mí?». John-copia: «Es lo mismo que hace él. Más despacio.» |
| **El espejo** | A partir del momento 4, El Rey te lo echa en cara con cifras: «Llevas veinte. Yo empecé con veinte.» Es **el giro jugable** de la biblia: el jugador descubre que lleva horas haciendo lo mismo que combate |
| **Coloso** | Resiste la conversión (canon): hay que destruirlo. Evita que convertir sea siempre la respuesta |
| **Pesa en el final** | `mentes_reescritas` vs `mentes_liberadas` decide qué finales están disponibles y cómo se ve cada uno (§9) |

---

## 5. Los ecos de Dave (según cómo se jugó el Acto I y II)

Unidad 01 recuerda nítido **hasta el prólogo**. Todo lo posterior es un **eco ajeno** al tocar un objeto: 3-5 s, sepia, audio de la escena **tal como la jugó el jugador** (lee la memoria). Implementación: `fichas.js → unidad01.ecos` (ampliar con las claves de abajo).

| Objeto (dónde) | Memoria que lee | Variantes del eco |
|---|---|---|
| **Foto de la familia** (casa) | `sarah:cena_abrazo` / `dave_le_conto_lo_del_casco` / `dave_le_oculto_el_casco` | Abrazo («Hueles a laboratorio») · la cara de Sarah al oír lo del casco · «Lo de siempre. Ya.» |
| **Dibujo de Lucía** (casa) | cap. 1 | Siempre igual: «Un robot bueno. Lo ha escrito ella.» — y ahora el robot eres tú |
| **Contestador** (casa) | `dave:grabacion:g4` | «No te fíes de nada que lleve mi cara.» (pesa distinto tras el momento 4) |
| **Puerta de casa** | `sarah:despedida` / `se_fue_sin_despedirse` / `silencio_al_irse` / `promesa_amanecer` | Abrazo en el umbral · **la puerta cerrándose** sin una palabra · las llaves · «Vuelvo antes de que amanezca» |
| **La piedra** (jardín) | `dave:primer_robot_con_piedra` | El golpe al primer robot… visto ahora desde el lado del robot (Unidad 01 se toca la cabeza) |
| **Nota del cajón de Mike** (lab) | `dave:grabacion:g3`, nota | «Para Dave. Por si algún día tengo que pedirte perdón.» |
| **Mostrador de Hank** (tienda) | `hank:salvado` (arma), `c3.saqueadores` | La X-56D regalada · Rata llevándose la munición / la paliza / Chispa convenciendo a Rata |
| **Placa de Ruiz** (campo de restos) | `john:dave_le_confronto` / `dave_le_cubrio_ante_varela` / `john:confeso` | «Era de un compañero» · «Es de los nuestros» · la confesión en la esclusa |
| **Localizador** (ORION-4) | `dave:dio_su_reloj_al_localizador`, `a2.rumbo` | «¿Cuál de los dos era?» |
| **Chapa de Dave** (campo de restos, si se perdió en el venteo) | `dave:venteo_bodega` | La bodega vaciándose, Dave agarrado |
| **Pulsera de detenido** (*Centinela*) | `dave:sabe_que_esta_registrado` | «SUJETO YA REGISTRADO» — acelera el momento 5 (cuenta como pista) |
| **Cuchillo de Hank / foto de Marta y Leo** | `hank:murio` + forma, última línea | **Eco de la muerte de Hank** con su última línea exacta. Darlo a Hank-copia = misión clave |
| **El cable suelto** (exterior de la ORION-4) | `dave:se_solto_el_cable`, línea final | **La muerte de Dave**, en primera persona, con su última línea. Solo disponible tras el momento 5 (antes, el objeto no responde) |

Regla: los ecos del Acto I son **memoria de Dave** que Unidad 01 siente ajena; los del Acto II son **lo que Dave hizo para morir**: el jugador vuelve a ver sus propias decisiones desde el cuerpo que las heredó.

---

## 6. La reacción de Sarah (momento 2)

Sarah abre la puerta y ve una máquina con la voz de su marido. Su primera reacción depende del Acto I; lo que pase después, de cómo se comporte Unidad 01 **en esa escena** (física: no acercarse, quitarse el arma, arrodillarse a su altura, enseñar la foto).

| Memoria (prioridad) | Primera reacción |
|---|---|
| `sarah:dave_le_conto_lo_del_casco` | Lo entiende al instante y eso es lo peor: «Te puso QUÉ… y esto es lo que ha salido.» No grita. Cierra la puerta despacio. Se puede volver |
| `sarah:se_fue_sin_despedirse` / `silencio_al_irse` | Rabia: «Ni adiós, Dave. Y ahora vuelves así.» Le tira las llaves (rima con «siempre las llaves») |
| `sarah:promesa_amanecer` | «Prometiste volver antes del amanecer.» Silencio. «Llegas tarde. Otra vez.» (rima con la cena) |
| `sarah:despedida` / `despedida_amanecer` | Miedo puro, el más difícil: no puede mirarle. Lucía, detrás, sí mira |
| `sarah:dave_le_oculto_el_casco` | Desconfianza: «¿Qué te enseñó Mike esa noche? Lo de siempre, ¿no?» |

**Lucía** (7 años) es la llave: si Unidad 01 se agacha a su altura, Lucía le reconoce por el **dibujo** («un robot bueno»). Sarah no acepta a Unidad 01 en este momento; la aceptación es una **línea de misiones del director** (confianza de Sarah) y decide en el final si Sarah está en el pueblo o se ha ido.

---

## 7. La decisión de Lena (persona o producto)

Lena es la única humana del grupo y trabaja para Lázaro. Desde el momento 5, decide si Unidad 01 (y las copias) son **personas** o **producto**. No es una elección del jugador: es una **conclusión de Lena** a partir de lo que ha visto.

| Suma a «persona» | Suma a «producto» |
|---|---|
| Acto II: `lena:dave_bajo_el_arma` (+2), `lena:dave_fue_directo` (+1), `dave:se_solto_el_cable` (+3: murió por ella) | Acto II: `lena:dave_la_amenazo` (−2) |
| `mentes_liberadas` alto; «dejarle ir» delante de ella | `mentes_reescritas` alto, sobre todo con restos |
| Cumplir lo que Hank-copia y John-copia piden | Usar a los convertidos como carne de cañón |
| Aceptación de Sarah | Mentirle a Lena (el director registra promesas) |

Resultado en La Corona: **persona** → Lena borra el servidor de Lázaro o te da la llave para hacerlo; **producto** → Lena activa la **cápsula 6** como seguro de Lázaro («si fallas, tenemos otro»); **dudosa** → se queda fuera y su decisión se ve en el epílogo.

---

## 8. La Corona (asalto final)

Nave de chatarra que ha crecido con todo lo que los robots asaltaron (se reconocen trozos del *Talos-9* y del *Centinela*: el Acto II construyó el último nivel).

1. **Aproximación** en la ORION-4 (pilotaje del cap. 7, dominado) con apoyo según condición del momento 6: zonas → fuego de cobertura de tus zonas; convertidos → oleada propia de robots cian; pueblo → Ibarra y supervivientes en la cabina.
2. **Abordaje en EVA** por el casco (sistemas del Acto II: botas, cable, venteo, oxígeno… ahora Unidad 01 **no respira**: el oxígeno se sustituye por **energía**, rima mecánica).
3. **Tres anillos interiores** (combate + conversión en masa; El Rey reconvierte a los tuyos en directo).
4. **El trono**: El Rey, sentado, con el casco. Se toca la nuca. Copia contra copia, hermano contra hermano. Diálogo con IA si está activa; frases fijas si no. Usa contra el jugador **sus propios recuerdos**: los ecos del §5, retorcidos («Te fuiste sin despedirte. Como siempre.»).
5. **El casco**: al derrotarle, el casco queda al alcance. Coger con dos manos (rima del prólogo). **Aquí se elige el final.**

---

## 9. Los tres finales (+ gancho de secuela)

| Final (canon) | Disponible si | Qué pasa | Variantes por memoria |
|---|---|---|---|
| **Apagarlo todo** (blanco) | Siempre | Destruyes el casco y todas las copias, incluida la tuya. Nadie vuelve a jugar a ser dios. El pueblo sobrevive sin saber a quién se lo debe | Si Sarah aceptó: Lucía guarda el dibujo y añade una cruz. Si Lena = persona: ella borra Lázaro detrás de ti |
| **Larga vida al rey** (rojo) | Siempre (más tentador con `mentes_reescritas` alto: El Rey te lo ofrece) | Te pones el casco para «salvar» el mundo. Todos los robots te obedecen. Te has convertido en lo que era Mike | Hank-copia y John-copia te obedecen… con ojos rojos. Última línea de Unidad 01: «Tú y yo vamos a ser los reyes del mundo» (la del prólogo), sin nadie a quien decírsela |
| **Libres** (cian) | `mentes_liberadas` ≥ 1/3 de las reescritas **o** Lena = persona | Devuelves la mente a los convertidos para que decidan. Algunos se quedan; otros se vuelven contra ti | Quién se queda depende de los recuerdos: Hank-copia se queda si le diste la foto; John-copia se va «a devolver la placa a la hija de Ruiz» si confesó entero |

**Gancho de secuela (en los tres):** la **cápsula 6 · LZR-0001 · B** del Laboratorio del Despertar. Plano final: la luz del cristal opaco pasa de rojo a cian. Si Lena = producto, es ella quien pulsa; si = persona, la pulsa un técnico de Lázaro que no hemos visto; si dudosa, nadie: se enciende sola. Texto: `LÁZARO SYSTEMS · RECONEXIÓN · LZR-0001-B · INICIAR`.

---

## 10. Assets y lugares nuevos por bloque

| Bloque | Lugares | Personajes | Objetos / sistemas |
|---|---|---|---|
| Despertar | Laboratorio del Despertar: sala de cápsulas con **6 cápsulas** (estados: reventada, abierta, cerrada con chasis, cerrada cargada, vacía, sellada opaca), techo roto con lluvia | Unidad 01 (ya rigueado, `Unidad01_animado`), chasis de Hank (verde oliva) y John (arena) | **Manos de robot** para el jugador, ojo/overlay de escaneo, vaho del cristal (T-62), pantallas de reconexión |
| Volver a casa | Pueblo de día (re-visita 3: amanecer después), casa de Dave cambiada (cerrada, tablones) | **Sarah** (pendiente, Meshy), **Lucía** (nuevo modelo), humanos que huyen | Objetos-eco con estado sepia (foto, dibujo, contestador, puerta) |
| Reclutar y convertir | Tienda de Hank como zona segura; las 4 zonas del campo de restos (*Talos-9*, *Centinela* partido, astillero robot, anillo de chatarra) | Hank-copia, John-copia, R-7 convertibles con placa arrancable y núcleo, drones convertibles, Coloso, **Despertado** (ojos cian), Marta y Leo, Ibarra, Chispa/Nico | Placa del pecho arrancable, núcleo, anillo de 8 luces, fragmento LZR-0002, contador en el pecho de Unidad 01 |
| Verdad sobre El Rey | Oficina/archivo de Mike, memoria de un robot convertido (espacio de eco) | El Rey en directo (holograma/radio) | 5 grabaciones nuevas de Mike, proyector de la cámara 3 |
| Verdad sobre ti | Laboratorio con el equipo de Lázaro | Lena con equipo de Lázaro, técnicos | Telemetría de la muerte de Dave (vista exterior del cap. 12), cápsula 6 iluminada |
| La Corona | Exterior de La Corona (chatarra del *Talos-9*/*Centinela*), 3 anillos interiores, sala del trono | El Rey (`El_Rey_animado`), oleadas reconvertidas | Casco neural (final), energía de Unidad 01 en vez de oxígeno, 3 epílogos |
| Sistemas | — | — | Director de misiones (4 fuentes), `mentes_reescritas`/`mentes_liberadas`, confianza del pueblo, confianza de Sarah, balanza de Lena, eventos nuevos en `docs/eventos.md` (`conversion_*`, `dejar_ir`, `eco_tocado`, `zona_*`, `rey_plan`) |
