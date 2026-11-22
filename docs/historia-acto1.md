# Apocalipsis 2030 · Acto I «La Tierra cae» — guion escena a escena

Referencia del guion jugable (`js/historia/acto1.js`). Dirección: **Red Dead Redemption 2** — cerca de las caras, silencios, decisiones pequeñas que los personajes recuerdan después.
Canon: biblia (borrador 0.1) y dossier. Lo nuevo del Acto I respeta el canon y se marca como *(nuevo)*.

**Cómo leer esto:** cada capítulo lista sus *beats* (momentos). En cada uno: lugar, quién está, qué hace el jugador, líneas clave y **memoria** que se escribe (`personaje:evento`, efectos sobre confianza/miedo/afecto).

---

## Los malos humanos *(nuevo)*

El fin del mundo no lo traen solo las máquinas. Esa noche:

- **Sargento Varela** — jefe del cordón del laboratorio. Cuando el capitán deja de contestar, decide que «el capitán soy yo». Monta una **milicia** para quedarse con la tecnología de Mike y venderla. Odia a Dave porque entró en su cordón igual.
- **Los saqueadores de Rata** — banda del pueblo que roba a los supervivientes. **Rata** (cabecilla, motes para todos: a Dave le llama «piedrecitas») y **Chispa** (el más joven, asustado, quiere irse a casa con su madre).
- Si Dave les da la munición en la tienda, **Rata se une a Varela** y aparece en el laboratorio: la decisión vuelve a morderle.

Motivos para pelear contra humanos: defender a Hank (cap. 4), defender el laboratorio y a John (cap. 5), y el clímax en la rampa (cap. 6). Los humanos no revientan como robots: **caen o se rinden**.

---

## Revisión 3 · misiones jugadas, no narradas (22-nov)

Regla: **lo que se puede encontrar o hacer no se cuenta**. Nunca hay diálogo bloqueante con enemigos activos (se congelan); el coche se queda en el cordón (bajas al llegar) y cada paso con dependencia de otro sistema tiene alternativa jugable.

| Cap. | Misión | Objetivos del jugador | Opcional / exploración | Ecos y pistas |
|---|---|---|---|---|
| Prólogo | El casco | Explorar el lab, ponerse el casco (dos manos) | Cinta 1 en la mesa | — |
| 1 · Cena | Volver a casa | Mirar dibujo y foto, **reproducir el contestador**, elegir qué contar | Pizarra de tiza, piano, cuaderno (interacción) | El contestador es la pista («no te fíes de nada que lleve mi cara») |
| 2 · Calle | Llegar al lab | Despedirse (o no), piedra, primer robot, conducir; **bajas en el cordón** | **Nico** en la cancha del parque: hablar, mandarle a casa (robots llegan: protegerle), baloncesto si el sistema lo activa; linterna en el cajón de la entrada | Ola de despertar |
| 3 · Laboratorio | Encontrar a Mike | Sigilo por la valla; **elegir entrada**: cristal de la puerta trasera (ruido → el cordón lo comenta) o **rejilla** al este (silenciosa); esconderse en la taquilla o distraer lanzando objetos; luego pelear | Cinta 2; cajón de Mike | **Eco obligatorio**: R-01 coge el casco y se toca la nuca delante de Mike (sustituye la explicación de Mike moribundo) |
| 4 · Tienda | Salvar a Hank y salir | Salvarle, chaleco + recarga, decidir con Rata, **escoltar a Hank** hasta la pickup bajo ataque | Munición en la caja registradora, botiquín en la taquilla de Hank | **Eco opcional** en la cerradura forzada: Rata planea volver por el callejón → desbloquea la respuesta «Os esperaba» (sin pelea) |
| 5 · La banda | Descubrir qué pasó | Mirar la placa de John, **revisar las cámaras** del lab (elegir la 3; rebobinar a las 22:10), mirar la pizarra, abrir el cajón (pistola + nota), reducir a la milicia, decidir sobre Varela | Cinta 3 | Las dos grabaciones las encuentra el jugador; John ya no narra |
| 6 · Base | Robar la ORION-4 | Sigilo, **dar la señal por el walkie**, arrancar la cabina entre oleadas, defender la rampa, decidir sobre Varela | — | **Eco opcional** de John por radio («LZR-0001… lo traigo mañana») → réplica en la cabina |
| Epílogo | — | — | — | La voz de Mike en la radio |

Exposición convertida en juego: explicación de Mike sobre R-01 → eco; «La cámara tres lo grabó todo» y «Hay otra grabación» → el jugador navega las cámaras; «Se está grabando…» → se lee en pantalla; la ruta de Rata → eco; el pasado de John → eco.

---

## Revisión 2 · diseño VR y giros de guion (22-nov)

Integra `docs/diseno-vr.md` y `docs/backlog-vr.md`. Los momentos físicos que dependen de otros sistemas esperan **eventos** (lista en `docs/eventos.md`) y tienen alternativa jugable mientras tanto.

### Los cuatro giros (de menos a más)
1. **Cap. 5 · Mike se grabó dentro de R-01.** La cámara 3 tiene otra grabación, a las 22:10: Mike con el casco frente a R-01, `grabar_sujeto --MIKE · destino: R-01`. La frase de Mike moribundo «Yo no se lo di. Se lo puso él solo» era verdad… y ocultaba quién iba dentro. DAVE: «No me mintió. Solo no me dijo quién iba dentro.» (`dave:sabe_que_mike_se_grabo_en_r01`). No revela del todo que El Rey *es* Mike: lo deja para el Acto III.
2. **Cap. 5 · Lázaro busca a Dave.** Varela, reducido, confiesa para quién roba: «Lázaro paga… y por ti. Preguntaron por un tal Dave. LZR cero cero cero uno.» (`dave:lazaro_le_busca`).
3. **Cap. 6 · John tiene código de Lázaro.** La ORION-4 pide autorización; John dicta «Lázaro, siete, siete, cero» y la nave responde «Bienvenido, agente». DAVE: «¿Ese código es de Lázaro?» JOHN: «Es un código que funciona.» Si Varela habló: «Y te encontré yo primero.» (`dave:john_uso_codigo_lazaro`).
4. **Epílogo · la voz de Mike.** Tras «lo buscamos a ojo», la radio chirría (`pulsoRey({ radio })`) y suena la voz procesada de Mike: «Hermanito… Estoy terminando lo que empezamos.» Con variantes de memoria («Te fuiste sin despedirte. Como siempre.» / «Me pediste que aguantara. Te he hecho caso.»). DAVE: «¿…Mike?» JOHN: «¡Apágala, Dave!». Cierre del acto.

Además: la **nota del cajón** de Mike (cap. 5) — «Para Dave. Por si algún día tengo que pedirte perdón.» — junto a la **pistola** (`D.arma('pistola')`; si el arma aún no existe, «una caja de balas sin arma»).

### Beats físicos nuevos por capítulo
| Cap. | Beat | Cómo está hecho |
|---|---|---|
| Prólogo | **Casco con las dos manos** | `usar` con `dosManos: true` (lo honra el sistema de agarre) |
| Prólogo | Radio de la pickup: «cortes de luz en la zona industrial» | escena libre (presagio) |
| 2 | **Empieza a llover** (0,3) | `D.clima('lluvia', .3)` |
| 2 | **Ola de despertar** al salir al porche: ojos rojos en cadena desde el laboratorio, lluvia arrecia (0,8). DAVE: «Como si alguien les hubiera dado una orden.» (+ «Y me pica la nuca» si se puso el casco) | `D.pulsoRey({ ola: true })` + paso `mirar` |
| 3 | Lluvia fuerte (1) | `clima` |
| 3 | **Romper la ventana trasera** para entrar; por la radio del cordón: «¿Ha oído eso? Ha sonado a cristal.» | evento `ventana_rota` |
| 3 | **Esconderse en la taquilla**: un R-7 cruza el laboratorio, se para delante, «tápate la boca», se va | eventos `escondido`, `respiracion_contenida`, `descubierto` (→ reintento), `salir_escondite` |
| 3 | Al morir Mike la lluvia baja a llovizna (silencio) | `clima('lluvia', .25, 4)` |
| 4 | Llovizna | `clima` |
| 4 | **Hank da la X-56D sin cargador**, **le pone el chaleco** y le enseña a recargar: «Así se carga. Si lo pierdes, no te doy otro.» | eventos `chaleco_puesto`, `recargado` (condición: munición > 0) |
| 5 | **Escampa al amanecer** (20 s) mientras Sarah habla | `clima('despejado', 0, 20)` |
| 5 | Grabación de las 22:10 (giro 1), cajón de Mike con pistola y nota, confesión de Varela (giro 2) | ver arriba |
| 6 | Viento sin lluvia | `clima('viento', .7)` |
| 6 | **Walkie con John**: «Pulsa para hablar» → el jugador da la señal «¡Ahora!» para volar el depósito | eventos `walkie_hablar`, `walkie_senal` |
| 6 | **Arranque físico de la cabina intercalado con la defensa**: rampa 12 s → batería → rampa 10 s → bombas → rampa 10 s → APU → autorización (giro 3) → Varela → potencia al despegar | eventos `cabina_bateria`, `cabina_bombas`, `cabina_apu`, `cabina_potencia` |
| Epílogo | Voz de Mike en la radio (giro 4) | `pulsoRey({ radio: true })` |

### Decisión: qué recuerda Unidad 01 (Acto III)
La copia se grabó **en el prólogo**, cuando Dave se puso el casco. Por tanto:
- Unidad 01 recuerda **con nitidez todo hasta ese momento** (Mike, el mecano, el laboratorio, la elección del casco).
- Lo que Dave vivió **después** (la cena, Lucía, la noche, Hank, Varela, la base, su muerte en el Acto II) **no es suyo**: le llega como **ecos** al tocar objetos con historia —la foto, el dibujo de Lucía, la piedra, el contestador, la nota del cajón—, reproducidos **tal como los jugó el jugador** (se leen de la memoria: si se fue sin despedirse, el eco es la puerta cerrándose).
- Encaja con su frase canónica: «¿Qué parte de mí es la que se acuerda?». Anotado en `js/personajes/fichas.js` (`unidad01.recuerda`, `unidad01.ecos`).

### Lluvia por capítulos
Cena: despejado → cap. 2: empieza (0,3) y arrecia con la ola (0,8) → cap. 3: tormenta (1), llovizna al morir Mike → cap. 4: llovizna (0,3) → cap. 5: escampa con el amanecer → cap. 6: viento seco.

---

## Prólogo · La noche de los chips
*Laboratorio de Mike · atardecer · calma*

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | Mike en su mesa, de espaldas a las pantallas. Se gira y camina hacia Dave (bandas de cine). | mira | MIKE: «¿Ya te vas? Justo ahora que esto empieza a funcionar.» · DAVE: «Si vuelvo a llegar tarde a cenar, Sarah me cambia la cerradura.» | — |
| 2 | **Cinta 1 · «Día 212»** sobre la mesa de Mike (opcional). | cogerla (E / grip) | «Si puedo guardarlo... nadie tendría que morirse del todo.» · «Lázaro Systems ha vuelto a llamar.» | `dave:grabacion:g1` |
| 3 | La vitrina del casco. Mike explica, encoge los hombros, recuerda el mecano de papá. | ir a la vitrina | MIKE: «Tú querías un camión. Yo quería que el camión obedeciera.» · DAVE: «Y me robabas las piezas.» | — |
| 4 | **ELECCIÓN `p.casco`** — «Venga, hermanito. Por los viejos tiempos.» | elegir | a) «Vale. Por los viejos tiempos.» b) «¿Qué me estás ocultando, Mike?» (Mike jura «por mamá», y se toca la nuca: su tic) c) «No. Me voy a cenar.» | a `mike:dave_acepto_casco` (+afecto +confianza) · b `mike:dave_sospecho`, `dave:sospecha_de_mike` · c `mike:dave_se_resistio`, `dave:se_nego_al_casco` |
| 5 | Ponerse el casco. Destello blanco. Pantallas: `grabar_sujeto --DAVE · destino: LÁZARO SYSTEMS · ref: LZR-0001`. | coger el casco y llevarlo a la cabeza | — | `dave:se_puso_el_casco` (peso 3) |
| 6 | «Me pica la nuca.» Mike: «Una copia de seguridad de tu cabeza. Por si algún día la pierdes.» Silencio. | — | si sospechó: DAVE «Eso no tiene gracia.» | — |
| 7 | Las cápsulas: Unidad 01 dormida. Mike mira la cápsula, luego a Dave. | ir a la cápsula | «Le falta... alguien dentro.» · «Dile a Lucía que el tío Mike le debe un robot que no muerda.» · «Tú y yo vamos a ser los reyes del mundo.» | — |
| 8 | Salir, pickup, conducir a casa. | conducir | — | — |

## Capítulo 1 · La última cena *(nuevo)*
*Casa de Dave · 21:40 · calma. La última noche normal.*

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | Entrar. Sarah en la cocina, se gira. Mesa puesta, vela. | entrar | SARAH: «Llegas tarde. Otra vez.» · varía según `p.casco`: «has conseguido decirle que no a tu hermano. Milagro.» | — |
| 2 | Sarah señala la pared: el **dibujo de Lucía**. | **mirar** el dibujo | DAVE: «Papá, tío Mike... y un robot.» · SARAH: «Un robot bueno. Lo ha escrito ella. Por si había dudas.» | — |
| 3 | **El contestador** (cinta 4, obligatoria). | escuchar | MIKE: «Si algún día pasa algo raro... no te fíes de nada que lleve mi cara. ...¡Es broma! Dale un beso a Lucía.» | `dave:grabacion:g4` |
| 4 | **Mirar la foto**: Mike y Dave, verano 2009. | mirar | DAVE: «Ya entonces quería conquistar el mundo con un mecano.» · SARAH: «Y tú le sujetabas la escalera.» | — |
| 5 | **ELECCIÓN `c0.verdad`** — «¿Qué te ha enseñado esta vez?» | elegir | a) «Un casco que lee la mente. Me lo ha puesto.» (solo si se lo puso) → «¿Que te ha puesto QUÉ?» b) «Robots. Lo de siempre.» → «Lo de siempre. Ya.» c) «Nada que importe. Ven aquí.» → abrazo, «Hueles a laboratorio.» | a `sarah:dave_le_conto_lo_del_casco` (+confianza) · b `sarah:dave_le_oculto_el_casco` (−confianza) · c `sarah:cena_abrazo` (+afecto) |
| 6 | Sarah se va a la cama. «Mañana desayunamos los tres. Sin Mike.» | sentarse en el sofá | — | — |
| 7 | Fundido: **03:12**. | — | — | — |

## Capítulo 2 · Robots en la calle
*Casa de Dave · 03:12 · caos*

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | Sarah le despierta. La tele. Lucía escondida en la bañera «con los cascos: le he dicho que es un juego». | — | DAVE: «Mike.» · SARAH: «No vayas.» | — |
| 2 | **ELECCIÓN `c1.sarah`** — «Dave. No vayas.» | elegir | a) «Es mi hermano. Tengo que ir.» b) «Vuelvo antes de que amanezca. Te lo prometo.» → «No me prometas cosas que dependen de tu hermano.» c) *(no decir nada, coger las llaves)* → «Claro. Las llaves. Siempre las llaves.» | a `sarah:dave_eligio_a_mike` · b `sarah:promesa_amanecer` · c `sarah:silencio_al_irse` (+miedo −afecto) |
| 3 | **Opcional: despedirte de Sarah** (abrazo). Si sales sin hacerlo, ella lo recuerda. | usar a Sarah o salir | SARAH: «Vuelve. No te pido nada más.» | `sarah:despedida` (+afecto) **o** `sarah:se_fue_sin_despedirse` (−afecto) |
| 4 | La piedra. «Una piedra. Muy bien, Dave.» Primer robot. | coger piedra, golpear | — | `dave:primer_robot_con_piedra` |
| 5 | Conducir al laboratorio entre robots. | conducir | — | — |

## Capítulo 3 · El laboratorio acordonado
*Laboratorio · 03:40*

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | El cordón. **Sargento Varela** *(nuevo)* y el soldado Núñez. Se planta la semilla de la milicia. | — | NÚÑEZ: «El capitán sigue sin contestar.» · VARELA: «Entonces el capitán soy yo.» · «Fuera o le pego un tiro, chaval. Esta noche no hay papeleo.» | — |
| 2 | Sigilo: rodear la valla, entrar por detrás. | sigilo | — | — |
| 3 | Mike, herido, sentado contra la pared (bandas de cine). | — | «Uno de ellos se puso el casco. Yo no se lo di.» · «Hay una cinta en mi mesa. Escúchala cuando estés enfadado conmigo.» · «Intenté ser el rey... y mis propias creaciones me han derrotado.» | — |
| 4 | **ELECCIÓN `c2.promesa`** — «Prométemelo, Dave.» | elegir | a) «Te lo prometo.» b) «Prométemelo tú. Que vas a aguantar.» → «Siempre has sido el cabezota de los dos.» | a `dave:promesa_a_mike` · b `dave:no_quiso_despedirse_de_mike` |
| 5 | Muere Mike (fundido lento). | — | DAVE: «Lo que sea. Lo que sea por vengarte.» | `dave:muerte_de_mike` |
| 6 | **Cinta 2 · «El espejo»** en la mesa (opcional). | escuchar | «He firmado con Lázaro.» · «La R cero uno me ha mirado... como me miro yo en el espejo. Será el cansancio.» | `dave:grabacion:g2` |
| 7 | Robots en el laboratorio. Salir, ir a la tienda de Hank. | combatir, conducir | — | — |

## Capítulo 4 · La tienda de armas
*Calle mayor · 04:05*

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | Hank acorralado por robots. | salvarle | HANK: «¡Eh, tú, el de la piedra!» | `hank:salvado` (+confianza +afecto −miedo) con el **arma usada** |
| 2 | Dentro. Si le salvaste con la piedra, lo dice. Hank conocía a Mike (le vendía baterías). | — | «Con una piedra. Esto se lo cuento a mis nietos.» · «Me compraba baterías de litio por cajas. Yo no preguntaba...» | — |
| 3 | La X-56D. | cogerla | «Te la regalo por salvarme.» | — |
| 4 | **La familia de Hank** *(nuevo)*: Marta y Leo (12) en la ciudad, no cogen el teléfono. | — | «Seguro que es la cobertura. Seguro.» | `hank:dave_pregunto_por_su_familia` (+afecto) |
| 5 | **Entran los saqueadores**: Rata, Chispa y otro. | — | RATA: «Vaya, vaya. Hank, el de las armas. Y con cliente.» · «La munición de la trastienda y las escopetas. Ahora.» · CHISPA: «Rata... vámonos.» | — |
| 6 | **ELECCIÓN `c3.saqueadores`** — «¿Y bien, piedrecitas?» | elegir | a) **Dar** la munición → se van; Hank: «Mejor la munición que tú. Supongo.» b) **Echarles** → **pelea contra humanos** c) **Convencer** («si nos matamos entre nosotros, ganan ellos») → Chispa convence a Rata; «Esta te la guardo, piedrecitas.» | a `hank:dave_cedio_ante_rata`, `rata:dave_le_dio_municion`, flag **`saqueadores_armados`** · b `hank:dave_lo_defendio`, `rata:dave_le_echo`, `rata:dave_le_dio_una_paliza` · c `hank:dave_convencio_a_rata`, `chispa:dave_le_dio_una_salida`, flag `saqueadores_ofendidos` |
| 7 | El cuchillo. «Mi mujer hace un café que resucita muertos.» Si la confianza de Hank > 0,5: «Gracias. De verdad.» | — | — | — |
| 8 | Llevar a Hank a casa. | conducir | — | — |

## Capítulo 5 · La banda
*Casa de Dave · amanecer → laboratorio*

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | Sarah sale al encuentro. **Su primera frase depende de la noche**: promesa → «Ha salido el sol hace diez minutos»; se fue sin despedirse → «Ni adiós, Dave. Ni adiós.» | — | DAVE: «Mike ha muerto.» (silencio) · abrazo | `sarah:supo_lo_de_mike` |
| 2 | Hank se presenta; cuenta lo de la piedra y lo de Rata si pasó. | — | — | — |
| 3 | Llega John. | — | «Ocupado. Muriendo, sobre todo.» | — |
| 4 | **Mirar a John**: en el uniforme pone **RUIZ** *(pista del secreto)*. | mirar | JOHN: «Era de un compañero. Ya no lo necesita.» | — |
| 5 | **ELECCIÓN `c4.john`** | elegir | a) «No me lo creo. ¿Quién eres?» b) «Esta noche no es asunto mío.» c) «¿Qué le pasó a tu compañero?» → «Tenía una hija. Como tú, supongo.» | a `john:dave_le_confronto`, `dave:sospecha_de_john` · b `john:dave_no_pregunto` (+confianza) · c `john:dave_pregunto_por_ruiz` |
| 6 | «Esta vez te despides.» Sarah abraza a Dave. Al laboratorio con John. | conducir | — | `sarah:despedida_amanecer` |
| 7 | **Cinta 3 · «LZR-0001»** junto a la cápsula de Unidad 01 (opcional). | escuchar | «He subido la copia de referencia al servidor de Lázaro. LZR cero cero cero uno. Quien sea... que me perdone.» | `dave:grabacion:g3` |
| 8 | **La cámara 3**: holograma de R-01 caminando a la vitrina, se pone el casco... **y se toca la nuca como Mike**. | **mirar** el holograma | DAVE: «Mike hacía eso. Siempre.» · JOHN: «Es una máquina, Dave. Imitan lo que ven.» | `dave:vio_el_gesto_de_mike_en_r01` (peso 3: pista del giro de El Rey) |
| 9 | La señal: 120 km hacia arriba. John ve «Lázaro S.» en la pizarra: «Conozco ese nombre... De nada que importe ahora.» | — | — | — |
| 10 | **Llega la milicia de Varela** (y Rata si le diste la munición: «Gracias por la munición, piedrecitas»). Varela: «Esa placa no es tuya.» | — | — | — |
| 11 | **ELECCIÓN `c4.cubrir`** | elegir | a) «Es de los nuestros. Baja el arma.» b) «Le conozco desde hace dos horas.» | a `john:dave_le_cubrio_ante_varela` (+confianza) · b `john:dave_no_le_cubrio` |
| 12 | **Pelea contra la milicia** (Varela se rinde sentado). | combatir | — | `dave:derroto_varela` (y `derroto_rata`) |
| 13 | **ELECCIÓN `c4.varela`** — «¿Qué hacemos con él?» | elegir | a) «Que se largue.» → JOHN: «Volverá.» b) «Átalo.» → «Los nudos no te van a durar toda la noche.» | a `varela:dave_le_perdono` · b `varela:dave_le_ato` |
| 14 | El plan: Peñas Negras, la ORION-4, la placa. | — | si sospechó: «La placa de Ruiz.» — «La placa que funciona.» | — |

## Capítulo 6 · Asalto a la base
*Base de Peñas Negras · noche*

| # | Beat | Jugador | Líneas clave | Memoria |
|---|---|---|---|---|
| 1 | En la caja del camión. Hank le pide a Dave que, si le pasa algo, se lo diga a Marta y a Leo. | — | «Diles que no me escondí. Bueno, que me escondí poco.» · si le preguntaste por ellos: «Eres el único que me ha preguntado.» | — |
| 2 | Control de la entrada (John y la placa). Sigilo entre barracones; «no todos son Varela». La explosión del depósito. Sigilo a la plataforma. | sigilo | — | — |
| 3 | Defender la ORION-4 mientras arranca (35 s). | resistir | — | — |
| 4 | **Clímax**: Varela aparece en la rampa apuntando. Su frase depende de `c4.varela`. Llegan robots detrás de él. | — | «Esa nave me la llevo yo, chaval.» · JOHN: «Varela. Mira detrás de ti.» · VARELA: «...Joder.» | — |
| 5 | **ELECCIÓN `c5.varela`** — «¡Chaval! ¡Son demasiados!» | elegir | a) «¡Sube! ¡Hay sitio para uno más!» → «No. Alguien tiene que cerrar la puerta. Mata a ese rey de chatarra por mí.» (se queda cubriendo) b) «Te dije que no volvieras.» → «Al final tú y yo no somos tan distintos.» · HANK: «Dave, ¿qué has hecho?» | a `varela:dave_le_ofrecio_sitio` · b `varela:dave_le_dejo_atras`, `hank:vio_a_dave_dejar_a_un_hombre` (+miedo) |
| 6 | Acabar con los robots de la rampa. Subir. Despegue. | combatir, usar | — | — |

## Epílogo · Más allá de la atmósfera
*Órbita baja*

Líneas que cambian con la memoria:
- HANK: «Marta y Leo están ahí abajo. En alguna de esas luces.»
- Si se fue sin despedirse: DAVE «La primera vez me fui sin decirle adiós a Sarah. No pienso hacerlo dos veces.» / si se despidió: «Sarah me dijo que volviera.»
- Si salvó a Varela: JOHN «No sé si eso es valiente o estúpido.» / si le dejó: HANK «No hablemos de Varela.»
- Con **las 4 cintas**: DAVE «Mike lo sabía. Lázaro, las copias...» · JOHN: «...Lázaro.»
- Tarjeta final: «Cintas de Mike: N de 4».

---

## Cintas de Mike (coleccionables)
| Cinta | Dónde | Qué revela |
|---|---|---|
| 1 · Día 212 | Prólogo, mesa de Mike | El casco lee lo que eres; Lázaro quiere comprar copias |
| 4 · Contestador | Cap. 1, casa (obligatoria) | «No te fíes de nada que lleve mi cara» (presagio de El Rey) |
| 2 · El espejo | Cap. 3, mesa de Mike | Firmó con Lázaro; R-01 le miró «como me miro yo en el espejo» |
| 3 · LZR-0001 | Cap. 5, junto a la cápsula de Unidad 01 | Copia de referencia subida a Lázaro: «Quien sea, que me perdone» (presagio del Acto III) |

## Qué recuerdan los personajes (resumen para el Acto II/III)
- **Sarah**: si le contó lo del casco, si se despidió o no, si prometió volver antes del amanecer.
- **Hank**: con qué le salvó, si le defendió de Rata o cedió, si le preguntó por su familia, si vio a Dave abandonar a Varela.
- **John**: si Dave le confrontó por la placa, si le cubrió ante Varela, si le preguntó por Ruiz.
- **Varela**: perdonado o atado; salvado o abandonado.
- **Rata / Chispa**: munición dada, paliza, o salida ofrecida.

## Pasos nuevos del director (para escribir más historia)
- `escena` — líneas con pausas, NPC que caminan a marcas (`{ npc, a:[x,z], esperar }`), miran (`{ npc, mira }`), gestos (`gesto: ['hank','encoger']`), ramas (`{ si, entonces, sino }`), bandas de cine (`cinematica: true`).
- `eleccion` — `{ id, quien, pregunta, ops: [{ k, txt, rec, l, f, si, ir }] }`. Se elige mirando la tarjeta + E / clic / A, o con 1-3.
- `mirar` — espera a que el jugador mire algo (`'npc:john'`, `[x,y,z]`, función).
- `grabacion` — cinta de Mike, opcional o no.
- `opcional` — objeto que se puede usar sin parar la historia (despedirse).
- `cinematica` — bandas negras en PC.
- En cualquier paso: `si` (se salta si es falso), `rec` (memoria al completar), `et` (etiqueta para saltos).

Memoria: `js/personajes/memoria.js` (`__mem` en consola). Fichas: `js/personajes/fichas.js`. Conversación futura con IA: `js/personajes/conversacion.js` (sin red; necesita un proxy propio con la clave en el servidor).
