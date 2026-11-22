# Apocalipsis 2030 · Diseño VR — «estar ahí»

Documento de diseño de juego: qué hace que el pueblo, el laboratorio y la base se sientan **vivos, reales y físicos** en Meta Quest 3 (WebXR + three.js 0.170) sin romper el presupuesto, y cómo se mete eso en el Acto I que ya existe (`docs/historia-acto1.md`, `js/historia/acto1.js`).

Referencias de dirección: **Half-Life: Alyx** (interacción y nivel), **The Walking Dead: Saints & Sinners** (cuerpo a cuerpo con consecuencias, tensión), **Boneworks/Bonelab** (cuerpo presente), **Into the Radius** (inventario en el cuerpo), **Arizona Sunshine 2** (mundo lleno de cosas usables), **Red Dead Redemption 2** (atmósfera, rutinas, detalles que reaccionan), **The Last of Us** (contar con el entorno). Fuentes al final.

> Leyenda de prioridad: **P0** = lo que más sube la sensación de «estar vivo en VR» en el Acto I · **P1** = segunda ola · **P2** = deseable / Actos II-III.
> *(nuevo)* = propuesta que no está en la biblia ni en el guion; respeta el canon.

---

## 0. Punto de partida (lo que ya hay en el código)

Antes de diseñar, inventario honesto. Mucho ya existe y **no hay que reinventarlo**, hay que **colocarlo y usarlo**:

| Sistema | Dónde | Estado |
|---|---|---|
| Horas del día (`noche`, `atardecer`, `amanecer`, `dia`, `espacio`) con color de niebla, cielo degradado, luna, estrellas, HDRI y `wet` | `js/nucleo.js` (`TIMES`, `aplicarHora`) | Funciona. Niebla lineal `THREE.Fog` (near/far por hora). `UMundo.uWet` ya oscurece/abrillanta el suelo |
| Conos de luz falsos, halos, charcos de luz de farola | `nucleo.js` `luzExtra` + `tierra.js` (`haloMat`) | Funciona: es exactamente la técnica barata correcta para Quest |
| 6 luces puntuales que se reparten entre las fuentes cercanas + `luzFx` para fogonazos | `nucleo.js` | Funciona. Es el presupuesto de luces: **no subirlo** |
| Foveación | `main.js` `renderer.xr.setFoveation?.(1)` | Activada al máximo |
| Interacción física estilo Alyx: coger/lanzar con la velocidad de la mano, puertas con bisagra, cajones, taquillas, nevera, **cristales que estallan**, piano de 3 octavas, pizarra/cuaderno donde se escribe, linterna, radio, botiquín, caja de munición, «grabadora de Mike» | `js/interaccion/*` | **Escrito pero NO enganchado**: ningún archivo fuera de `interaccion/` lo importa y nada está colocado en el mundo. Es la mayor palanca barata del backlog |
| Daño por zonas, huesos rotos (cojera, brazo colgando), aturdido, marcas de impacto, sangre, ragdoll, desmembramiento de robots | `js/combate/*` | Funciona sobre NPC/robots. **El jugador no tiene huesos rotos todavía** |
| Sigilo por visión (guardias con linterna, focos, medidor) | `js/enemigos.js` `deteccion` | Solo vista. **No hay oído** |
| Audio espacial con muestras + reverb + sintetizado | `js/audio.js`, `js/fx.js` (`ambiente('viento')`) | Ambiente = un solo zumbido filtrado. No hay capas |
| Giro por pasos (30°) en VR | `jugador.js` `snapTurnBy(PI/6)` | Solo snap. Sin viñeta, sin giro suave, sin modo sentado ni agacharse por botón |

Conclusión: el juego tiene **músculo técnico** (física Rapier, roturas, daño por zonas) pero el mundo está **vacío de cosas que se tocan y de vida que pasa**. El diseño de abajo prioriza eso.

---

## 1. Pilares de la sensación de juego

1. **Tus manos son el mando.** Todo lo que Dave hace con las manos en la historia lo hace el jugador con las suyas: coger la cinta, ponerse el casco, romper el cristal, meter el cargador, vendarse. Si un gesto existe en la vida real y cabe en un brazo, no es un botón. (Alyx: los guantes de gravedad nacieron de «problemas concretos», no de un arma nueva; sin botones extra.)
2. **El mundo sigue sin ti.** La noche del 2030 pasa aunque no mires: sirenas que se alejan, un perro que cruza, luces que se apagan en una ventana, un helicóptero que barre el monte, ojos rojos que se encienden a lo lejos. Nada de esto es misión; todo esto es **lugar** (RDR2).
3. **Miedo físico, no numérico.** Te escondes porque te oyen, no porque una barra lo diga. Tapas tu boca con la mano, te agachas de verdad, el cristal te corta si lo rompes con el puño desnudo. Los errores tienen consecuencias que se ven en tu cuerpo (S&S: «al filo de la muerte», el cuchillo que se queda clavado).
4. **La historia se toca.** Las cintas suenan en una grabadora que sostienes junto a la oreja; la foto de los hermanos se coge y se mira; el dibujo de Lucía tiene chinchetas. El entorno cuenta lo que pasó antes de que llegaras (TLOU).
5. **Cómodo para todos, sin rebajar a nadie.** Cada acción tiene forma VR y forma PC (ya es regla de la biblia). Cada opción de confort es un interruptor, no un modo «fácil». El rendimiento es diseño: lo que no cabe a 72-90 fps no entra.

---

## 2. Sistemas de atmósfera

Formato de cada ficha: **qué aporta · cómo hacerlo barato en Quest 3 · prioridad**.

### 2.1 Niebla

| Pieza | Qué aporta | Cómo (three.js / Quest) | Prio |
|---|---|---|---|
| **Niebla de altura** (se acumula en el suelo y en los valles; la cima de los tejados asoma) | Profundidad, escala, «madrugada fría». Esconde el borde del mapa mejor que la niebla lineal | Parchear el fragmento de niebla de los materiales del mundo con `onBeforeCompile` (ya hay `conPosMundo(shader)` en `nucleo.js` que expone la posición de mundo): `f = fogLineal * exp(-max(0, worldY - h0) * k)`. Uniformes `uFogH0`, `uFogK` por hora en `TIMES`. Coste: unas pocas ALU por píxel, cero draw calls | **P0** |
| **Bancos de niebla** (jirones que derivan por la calle, delante de los focos de la base) | Movimiento en el aire; los focos «pintan» la niebla | 6-12 planos grandes con textura de humo (`genSmoke` de la biblia sirve), billboard en Y, aditivos suaves, `depthWrite:false`, **fundido por distancia a la cámara** para que no corten al atravesarlos (soft-fade: alfa = smoothstep(0.5, 3, dist)). Se mueven con el viento | P1 |
| **Conos volumétricos falsos** (farolas, focos de la base, linterna, ventanas del laboratorio) | El «rayo de luz» de RDR2 sin volumétrico real | Ya existe (`luzExtra.cone`). Extender: cono con degradado longitudinal + fresnel en el borde (`pow(1-abs(dot(N,V)),2)`), y que su opacidad sume la densidad de niebla de la hora | **P0** (extender) |
| **Rayos de luna/amanecer entre árboles o lamas** (cap. 5 amanecer en el laboratorio) | Momento «postal» | 3-5 *cards* (planos) aditivos con gradiente, orientados al sol; solo en escenas concretas | P2 |

Regla: **nada de post-procesado a pantalla completa** (ni bloom, ni volumetría en pantalla, ni SSAO): en WebXR multivista un pase extra duplica coste y rompe MSAA/foveación (Meta: escribir directo al *swap chain* para conservar FFR y MSAA).

### 2.2 Tiempo meteorológico

| Pieza | Qué aporta | Cómo | Prio |
|---|---|---|---|
| **Lluvia** (cap. 2-4, la noche del caos) | El sonido de la lluvia y los reflejos son el 50 % del realismo nocturno | `InstancedMesh` de ~1.200-1.800 rayas finas (quad estirado) dentro de un cilindro de 12 m que **sigue a la cabeza** (1 draw call). Velocidad en el vertex shader con `uTime` (sin CPU). Inclinación por `uWind`. Bajo techo: ocultar por un mapa de «cubierto» (cajas AABB de interiores) | **P0** |
| **Superficies mojadas** | Asfalto que refleja farolas y fuegos | Ya existe `uWet`. Subirlo a 1 con lluvia, bajar `roughness` a ~0.15 en zonas de charco (máscara de ruido de mundo ya usada para el barro) y oscurecer albedo ×0.6. El reflejo lo da el HDRI de entorno | **P0** |
| **Charcos con ondas** | Lluvia «que cae en algo» | Decals planos sobre el suelo con normal animada (anillos de onda procedurales en el shader, 6-8 anillos por tile con fase aleatoria). Solo en un radio de 25 m | P1 |
| **Salpicaduras** | Contacto lluvia-mundo | 200 sprites instanciados que se reubican aleatoriamente en el suelo cercano cada ciclo (1 draw call) | P1 |
| **Gotas en la linterna / en el cristal del visor (Acto III)** | Detalle de primera persona | Sprite de gotas en el cono de la linterna; en Unidad 01, gotas en el «ojo» (overlay en el HUD diegético) | P2 |
| **Viento** | El mundo respira | Uniforme global `uWind` (dirección + racha senoidal + ruido). Lo consumen: árboles (balanceo en vertex shader por altura), cables y tendederos (onda), papeles, humo, lluvia, bancos de niebla, banderas de la base. Audio de viento sube con la racha | **P0** |
| **Basura que vuela** | La calle está abandonada «desde hace una hora» | 20-30 hojas de periódico/bolsas como instancias con física barata en CPU (no Rapier): suben con rachas, ruedan por el suelo, se pegan a vallas. Se reciclan alrededor del jugador | P1 |
| **Tendederos y ropa** | Vida doméstica interrumpida (TLOU) | Sábanas = plano subdividido 8×8 con onda en vertex; en el patio vecino de la casa de Dave | P1 |
| **Polvo / ceniza / brasas** | Incendios cercanos; laboratorio tras la pelea | `Points` con 300-500 partículas en caja que sigue a la cámara; brasas aditivas naranjas cerca de fuegos, ceniza gris que cae lenta en el cap. 6 tras la explosión del depósito | P1 |
| **Nieve** | — | **No.** No encaja con el pueblo ni con la paleta | — |

### 2.3 Hora del día por capítulo y guion de color

La hora ya la pone el capítulo (`hora:` en `acto1.js`). Propuesta: **sub-estados de hora y meteorología guionizados por paso** (un paso `fn` o un campo `clima:` en el capítulo) para que la luz cuente la noche:

| Capítulo | Hora / clima | Color dominante | Cambio dentro del capítulo |
|---|---|---|---|
| Prólogo | Atardecer, despejado | Naranja cálido por las ventanas del laboratorio, monitores cian | Al ponerse el casco: destello blanco + las luces del lab bajan un 20 % un segundo (el casco «chupa» corriente) *(nuevo)* |
| 1 · La última cena | Noche 21:40, nubes altas, luna creciente | Ámbar de vela y lámparas dentro, azul frío fuera | La vela se consume poco a poco; al irse Sarah, se apaga la lámpara de la cocina |
| 2 · Robots en la calle | 03:12, **empieza a llover** | Azul-verde frío + rojo de ojos de robot | Las farolas parpadean y se cortan por sectores (apagón en ola) cuando despiertan los robots |
| 3 · Laboratorio acordonado | 03:40, lluvia fuerte | Blanco de focos militares + rojo de girofaros | Al morir Mike, la lluvia baja a llovizna (silencio) |
| 4 · Tienda de armas | 04:05, llovizna, niebla baja | Fluorescente verdoso dentro de la tienda, que parpadea | Si hay pelea con Rata, un disparo revienta el fluorescente: el resto en penumbra de linterna |
| 5 · La banda | Amanecer, escampa, charcos | Rosa-naranja, sombras largas, vaho | El sol sale de verdad mientras Sarah habla («Ha salido el sol hace diez minutos» debe **verse**) |
| 6 · Asalto a la base | Noche siguiente, viento fuerte, sin lluvia | Sodio naranja de la base + focos blancos + incendio del depósito | La explosión del depósito tiñe todo de naranja y levanta ceniza |
| Epílogo | Espacio | Azul de la Tierra, negro | — |

Implementación: interpolar entre dos entradas de `TIMES` (`lerpHora(a, b, t)`) en vez de saltar; un paso `{ t:'fn', fn: D => D.hora('amanecer', 20) }` con duración.

### 2.4 Cielo

- **Luna con fase y halo** (ya hay `moon`): añadir un sprite de halo grande aditivo y que la luna ilumine las nubes cercanas (gradiente en `skyMat` hacia la dirección de la luna). P1.
- **Nubes que pasan delante de la luna**: 2 capas de planos curvos con textura de nubes en el domo, desplazando UV con el viento; cuando cruzan la luna, bajar un 30 % la intensidad de `sun` (la luz de luna) → las sombras se apagan y vuelven. Pocas cosas venden más «noche real». P1.
- **Estrellas con centelleo** y menos estrellas cerca del horizonte con niebla (ya hay `starField`). P2.
- **Resplandor de incendios en el horizonte**: tinte naranja en la parte baja del cielo en la dirección de la ciudad (de donde no vuelven Marta y Leo). P0 (es un cambio de uniforme).
- **Estela de la nave de El Rey** (cap. 5, «120 km hacia arriba»): una raya brillante que sube en el cielo vista desde el laboratorio. Cuenta la historia sin diálogo. P1.

### 2.5 Paisaje sonoro por capas

Tres capas siempre activas, con muestras cortas en bucle o eventos aleatorios posicionados (Web Audio `PannerNode` HRTF; `audio.js` ya tiene reverb y oyente):

| Capa | Distancia | Contenido | Notas |
|---|---|---|---|
| **Lecho** | Todo el mapa | Viento (sube con `uWind`), lluvia (dos bucles: en tejado/al aire libre, se cruzan al entrar bajo techo), zumbido eléctrico de farolas | El cambio de lluvia «fuera» a «dentro» al cruzar una puerta es el mejor truco barato de presencia |
| **Lejana** (80-300 m, eventos cada 8-30 s) | Sirenas que se alejan con Doppler, perros ladrando en cadena, una alarma de coche, disparos sueltos de otra parte del pueblo, un helicóptero, gritos lejanos, el **coro de servos** de robots marchando (eco) | Posicionadas en puntos del borde del mapa; filtro paso bajo por distancia |
| **Cercana** (0-30 m) | Radio militar del cordón (chatter procedural: ruido filtrado + frases grabadas), servos de robot reales, chispas de cables, goteo, crujido de cristales al pisarlos, TV encendida en una casa vecina | Oclusión barata: rayo cada 0,25 s de la fuente a la cabeza; si choca, paso bajo a 800 Hz y −6 dB |

Silencio como herramienta: en la muerte de Mike y en el momento de ponerse el casco, el lecho se baja a −18 dB durante 4 s (RDR2 usa mucho el silencio).

### 2.6 Afluencia: vida ambiental

Todo lo de esta tabla es **decorado con comportamiento**, sin colisión ni IA cara. Se activa por capítulo (lista en el campo `vida:` del capítulo).

| Vida | Qué aporta | Cómo barato | Prio |
|---|---|---|---|
| **Pájaros que huyen** al disparar o al romper algo | El mundo **reacciona a ti** | Bandada de 12-20 pájaros (quad con aleteo en vertex shader, `InstancedMesh`) posada en tejados/cables. Al evento de ruido > X en 25 m, salen en abanico hacia el cielo y se pierden. Un solo draw call | **P0** |
| **Perro callejero** | Vida, y un segundo de susto cuando sale corriendo de detrás de un contenedor | Un cuadrúpedo low-poly con ciclo de carrera procedural; ruta predefinida; ladra a los robots (te avisa de uno que no ves) *(nuevo)* | P1 |
| **Gato** en una ventana o un muro | Calma en la cena; ausencia en el caos | Pose estática + cola animada; en el cap. 2 ya no está | P2 |
| **Insectos en las farolas** | Verano, realismo nocturno | 30 `Points` orbitando cada farola cercana (solo las 4 más próximas) | P1 |
| **Supervivientes en ventanas** | No estás solo; la gente se esconde | Siluetas (plano recortado) detrás de ventanas iluminadas; cuando apuntas el arma o la linterna, cierran la cortina (anim de escala) y la luz se apaga | **P0** |
| **Columnas de humo y fuegos lejanos** | Escala de la catástrofe | 3-4 columnas de humo como pilas de 6-8 sprites grandes que suben y se tuercen con el viento, con base iluminada por un halo naranja (ya hay `haloFuegoMat`) | **P0** |
| **Helicóptero lejano** | Militares desbordados; promesa de la base | Malla simple + cono de foco que barre el monte + audio con Doppler. Pasa 1 vez por capítulo nocturno | P1 |
| **Patrullas de robots a lo lejos** | Amenaza que existe más allá de la pelea | Filas de **ojos rojos** (Points emisivos de 2 px) que avanzan por las laderas siguiendo curvas; sin cuerpo visible por la niebla | **P0** |
| **«Ola» de despertar** *(nuevo)* | El momento exacto en que El Rey toma el control: en el cap. 2 los robots dormidos del pueblo encienden los ojos en cadena, de lejos hacia ti | Mismo sistema de puntos rojos, encendiéndose con retraso por distancia + un pulso de audio grave | **P0** |
| **Luces que parpadean** | Red eléctrica tocada | Curva de parpadeo (ruido) sobre `emissiveIntensity` y sobre la intensidad de la luz del pool asignada; las ventanas de fachada usan el `emissiveMap` ya existente | **P0** |
| **Coches abandonados con alarma/intermitentes** | Huida interrumpida | Intermitentes emisivos que parpadean; uno con la puerta abierta y la radio sonando | P1 |
| **Papeles, hojas** | Ver 2.2 | — | P1 |

### 2.7 Detalles reactivos

| Detalle | Cómo | Prio |
|---|---|---|
| **Agujeros de bala y marcas** | Ya en `combate/marcas.js`. Asegurar pool en el mundo estático (paredes, coches) y que el cristal estalle (`crearCristal`) | ok / P0 colocar cristales |
| **Vaho del aliento** (cap. 5 amanecer y cap. 6 noche con viento) | Sprite blanco pequeño que nace 8 cm delante de la boca (cámara) cada 3-4 s, más frecuente y grande tras correr; también en NPC humanos (Sarah, John). Un pool de 6 sprites | **P0** (muy barato, muy «real») |
| **Motas de polvo en la linterna** | `Points` (150) dentro de un volumen que sigue a la linterna; el shader solo las hace visibles dentro del cono (ángulo respecto al eje). Solo en interiores | P1 |
| **Huellas** | Tras pisar barro o sangre, 6-8 decals de suela que se desvanecen (pool). En el laboratorio, huellas de robot que llevan a la vitrina (TLOU: contar sin hablar) | P2 (huellas del robot P1, son estáticas) |
| **Cristales que crujen al pisarlos** | Al romper un cristal, sus trozos en el suelo emiten un crujido si pasas por encima: delata al jugador a los robots (ver oído) | P1 |
| **Casquillos** que rebotan y suenan | Pool de 20 casquillos con física falsa; sonido metálico | P1 |
| **Humedad en la ropa / pelo de NPC** | Subir `uWet`-equivalente en materiales de personajes tras la lluvia (más oscuros, más brillo) | P2 |

---

## 3. Catálogo de mecánicas VR (con alternativa PC)

Convenciones de mando (Quest Touch): **grip** = agarrar · **gatillo** = usar/disparar · **A/X** = botón de acción del arma (soltar cargador) · **B/Y** = agacharse (toggle) / menú de confort · **stick izquierdo** = moverse · **stick derecho** = girar; abajo mantenido = agacharse alternativo. PC: WASD, ratón, E coger, F usar, R recargar, C/Ctrl agacharse, Espacio saltar/trepar, Q/Z inclinarse *(opcional)*.

### 3.1 Inventario en el cuerpo (holsters)

Sin seguimiento de cuerpo, el **torso virtual** se calcula desde la cabeza: posición = cabeza − 0,55 m en Y (ajustado por altura calibrada), orientación = yaw de la cabeza **suavizado** (solo sigue si giras más de 35° o caminas; así mirar a un lado no mueve el cinturón). Es lo que hacen Alyx/Bonelab/ITR.

| Ranura | Posición (relativa al torso) | Qué va | VR | PC |
|---|---|---|---|---|
| **Espalda sobre el hombro** (dominante) | detrás del hombro, 15 cm por encima | Fusil X-56D (y escopeta de Hank si llega) | Lleva la mano por encima del hombro, grip → coges el fusil. Suelta ahí para guardarlo. Háptico al entrar en la zona | 1 / rueda |
| **Cadera** (dominante) | 25 cm al lado, 40 cm bajo el pecho | Pistola (milicia de Varela, cap. 5) | Baja la mano al costado | 2 |
| **Pecho** (no dominante, funda en diagonal) | centro-izquierda del pecho | **Cuchillo de Hank** | Mano cruzada al pecho | 3 / V (golpe rápido) |
| **Bolsillos del chaleco** (2) | vientre izquierda/derecha | Cargadores (solo uno visible cada vez; el número total va escrito a tinta en el chaleco: «III») | Mano a la tripa, grip → sale un cargador si quedan | automático con R |
| **Bolsillo del pecho** | pecho derecho | **Foto de la familia**, cartera, la piedra (sí: Dave se la guarda, *(nuevo)*), notas | grip | Tab → mostrar |
| **Riñonera / mochila** (detrás de la cadera) | detrás de la cadera no dominante | Botiquín, vendas, jeringa, barritas, botella de agua, mapa de papel | Mano detrás de la cadera → se abre una «bolsa» de 6 huecos flotando junto a la mano (Alyx: hombro → mochila) | I |
| **Muñeca** | reloj en la muñeca no dominante | Reloj 2030 (ver 3.17) | Girar la muñeca hacia la cara | HUD mínimo |
| **Hombrera** | hombro no dominante | Linterna con clip | Tocar = encender/apagar; grip = sacarla a la mano | L |

Reglas: lo que sueltas fuera de una ranura **cae al suelo** (física), salvo el arma principal, que vuelve sola a la espalda a los 2 s (evita perderla: frustración inútil). En la tienda de Hank el jugador **elige** qué lleva: dos manos solo pueden sacar dos cosas a la vez — esa limitación es el diseño.

### 3.2 Recarga física (X-56D)

1. **Soltar cargador**: A/X en la mano del arma, o agarrar el cargador con la otra mano y tirar.
2. **Meter cargador**: mano libre al bolsillo del chaleco → cargador → acercarlo al pozo; a 6 cm se «imanta» y entra con un clic y háptico.
3. **Montar** (solo si el cerrojo quedó atrás al vaciarlo): agarrar la palanca de carga y tirar hacia atrás.
4. **Indicador diegético**: barra de LEDs en el lateral del cargador y contador en la mira holográfica (Alyx usa luces en cada bala y un indicador radial en la base del cargador). Cargador vacío: sin luz.

PC: R (animación de 1,3 s, ya existe). **Escopeta** (si se da en el cap. 4/6): bombear con la otra mano; cartuchos de uno en uno desde el cinturón — «recargar a mano en VR es medio combate» (biblia).

### 3.3 Apuntar con dos manos

- Agarrar el guardamanos con la otra mano: el arma se orienta de mano a mano, **−60 % de balanceo** y retroceso repartido.
- **Culata virtual** *(opcional en confort)*: si el arma está a < 15 cm del hombro, se estabiliza aún más.
- Con un brazo roto (3.12) no puedes sujetar a dos manos: el arma tiembla.
- PC: clic derecho = apuntar (FOV −15 %, menos dispersión).

### 3.4 Cuerpo a cuerpo con impulso

- Daño = f(velocidad de la mano en el impacto) — umbral 1,8 m/s para que cuente; por debajo es un empujón. Ya hay golpes físicos con velocidad (`jugador.js`); llevarlo a **todo objeto agarrado** (piedra, tubería, llave inglesa, martillo, botella que estalla, culata del fusil).
- **Contra robots**: lo contundente tumba y abolla; el cuchillo solo sirve **en las juntas** (cuello, codo, cables de la nuca — la biblia: «cortar cables de robots dormidos»). Clavar el cuchillo en una junta lo deja **clavado**: hay que tirar con fuerza para sacarlo (S&S: el cuchillo atascado crea tensión; quitaron el retraso de medio segundo porque castigaba demasiado — sacarlo es inmediato si tiras fuerte).
- **Resistencia** (ver 3.13): cada golpe fuerte gasta; sin resistencia los golpes salen lentos (la mano virtual se queda atrás de la real con un muelle más blando). S&S lo usa para que la VR no sea un gimnasio y para que no puedas «aletear» para salir de una multitud.
- **Humanos**: empujar (palma abierta rápida) desequilibra; agarrar a un miliciano por el cuello de la ropa desde atrás = derribo silencioso (cap. 6).
- PC: clic = golpe; mantener = golpe cargado.

### 3.5 Agacharse, tumbarse y conductos

- **Agacharse real** siempre funciona (la cabeza baja de verdad). Detección: altura de cabeza < 70 % de la calibrada → «agachado» (menos ruido, menos visible). < 45 % → «tumbado».
- **Agacharse por botón** (B/Y o stick abajo mantenido): baja el mundo 0,6 m. Imprescindible para modo sentado.
- **Conductos de ventilación** (base, cap. 6; laboratorio, alternativa): túneles de 0,8 m. En VR, desplazamiento **tirando de los nervios del conducto con las manos** (mano sobre mano, el cuerpo avanza lo que la mano retrocede) o con el stick lento (1 m/s) y viñeta. Al salir, una rejilla que se **empuja** o se arranca. PC: entrar agachado, velocidad lenta.
- Diseño de nivel: los conductos son cortos (6-12 m), con una rejilla a mitad que deja ver una patrulla pasar por debajo. **Nunca** un laberinto (desorienta en VR).

### 3.6 Escaleras y muros

- **Escalera de mano**: agarrar peldaños, mano sobre mano; el jugador sube lo que baja la mano. Soltar las dos = caes (si son > 2 m, daño en pierna → posible hueso roto). PC: E en la base y W/S.
- **Saltar muro / tapia bajo (≤ 1,3 m)**: agarrar el borde con las dos manos y empujar hacia abajo → la cámara sube y pasa por encima en 0,4 s con viñeta. Alternativa: mirar el borde + botón de saltar. PC: Espacio junto al borde.
- **Nada de escalada libre** tipo The Climb: no encaja y marea.

### 3.7 Romper cristal para entrar

Sistema ya escrito (`crearCristal` en `interaccion/roturas.js`). Diseño:

- Se rompe con **cualquier objeto agarrado** a > 2,5 m/s (piedra, culata, martillo, la tubería), o con **el puño**.
- **Puño desnudo** = rompe pero **te corta**: −10 de vida, mancha de sangre en la mano, y la mano sangra (goteo) hasta que te vendas. **Codo**: no hay seguimiento de codo; se aproxima con «mano cerrada moviéndose hacia atrás con el mando por detrás del pecho» → rompe sin cortarte (el gesto real de los policías). *(nuevo)*
- **Envolver la mano** con la chaqueta/un trapo (agarrar un trapo y frotarlo contra la mano) → puño protegido. *(nuevo, P2)*
- **Quitar los trozos del marco** con el arma o la mano protegida antes de pasar; si pasas sin quitarlos: −5 y ruido. Pasar = agacharse y avanzar por el hueco.
- **Ruido**: romper un cristal es un evento de ruido de radio 15 m (ver 3.8). Los robots cercanos investigan. Por eso el jugador elige: entrar ya o esperar a que pase la patrulla.
- PC: golpear con el arma/objeto en la mano (clic) o F con el puño; quitar trozos = F mantenido.

### 3.8 Esconderse, contener la respiración y el oído de los robots

**Nuevo sistema de ruido** (pieza clave del sigilo, hoy solo hay visión):

| Fuente | Radio de ruido |
|---|---|
| Andar | 3 m · agachado 1 m · correr 9 m |
| Pisar cristales / charcos | +4 m |
| Respiración agitada (tras correr, resistencia < 30 %) | 2,5 m |
| Toser (polvo, humo) | 8 m |
| Lanzar y que impacte un objeto | lata 6 m · botella que estalla 12 m · caja 8 m |
| Romper cristal | 15 m |
| Disparo | 45 m (todo el barrio) |
| Puerta que chirría / portazo | 5 / 12 m |

Los robots R-7 tienen **oído**: un evento dentro de su radio crea un punto de investigación; van, escanean (cono de luz roja de los ojos, 3 s) y vuelven a la ruta. Dos eventos seguidos → alerta.

- **Tapar la boca** *(gesto clave)*: mano no dominante a < 12 cm de la boca + grip → contienes la respiración: anula el ruido de respiración y la tos durante 8-10 s; después ahogo (sonido, viñeta oscura) y bocanada ruidosa (3 m). Precedente directo: en Alyx tapas la boca con la mano para no toser con las esporas (y la máscara deja las manos libres). PC: mantener Mayúsc izq. (sin correr).
- **Escondites**:
  - **Taquillas y armarios** (`crearArmario` tipo `taquilla`): entras, cierras la puerta tirando del tirador **desde dentro**, ves a través de las rendijas (máscara de lamas en un plano delante de la cara). Los robots solo abren una taquilla si te oyeron entrar.
  - **Debajo de un coche**: tumbarse (real o botón) junto a un coche → la cámara entra bajo el chasis. Ves los pies metálicos del robot pasar. La luz roja de escaneo pasa por el suelo a tu lado.
  - **Detrás de cobertura alta / en sombra**: el medidor de visión ya existente reduce la detección en sombra (usar `lampFactor` y distancia a luces del pool).
- **Feedback sin HUD**: la **respiración del jugador** (audio) y el **latido** en háptico suben cuando un robot se acerca a < 6 m sin verte. El medidor de detección actual se puede mantener en PC y como opción en VR.

### 3.9 Distraer lanzando objetos

Botellas, latas, piedras, tuercas (catálogo ya tiene botella, lata, caja, libro, pelota). Lanzar con la velocidad real de la mano (ya implementado en `interaccion`). El impacto genera ruido (3.8). Uso de diseño: en cada zona de sigilo hay **3-5 objetos lanzables visibles** cerca de la entrada (enseñar sin enseñar). PC: G o clic derecho lanza.

### 3.10 Forzar puertas y cerraduras

- **Palanca** *(nuevo objeto: pata de cabra)*: acercar la punta al hueco de la puerta/rejilla → se encaja (socket). Luego **apalancar con las dos manos** (mover el extremo lejos de la puerta). Progreso con crujidos crecientes y háptico. Ruido 6 m. Sirve también para rejillas de conducto y cajas de munición precintadas. PC: F mantenido 2 s.
- **Patada a la puerta**: no hay pies; en VR, **empujón con el hombro** (avanzar con la cabeza contra la puerta a > 1,5 m/s) o golpear la cerradura con un objeto pesado 2-3 veces. Ruido 12 m. PC: F con la puerta cerrada.
- **Ganzúas**: **no** en el Acto I (Dave no es un ladrón; lentitud sin drama). En el Acto III Unidad 01 abre electrónicamente (ver 4).
- **Barricadas**: empujar/arrastrar estanterías y mesas con las dos manos (objeto pesado = se mueve lento, siguiendo un muelle). Cap. 4.

### 3.11 Linterna

- Linterna de mano (catálogo `linterna`) o con clip en la hombrera; tercera opción: montada en el riel del X-56D (encajar). Botón de la propia linterna (gatillo con ella en la mano).
- **Coste de sigilo**: el cono encendido **aumenta tu visibilidad** ×2,5 para robots y milicianos que lo vean. Decisión constante: ver o ser visto.
- **Pilas débiles**: parpadea a veces; **sacudirla** la recupera unos segundos (gesto clásico, satisfactorio).
- Motas de polvo en el haz en interiores (2.7).
- Es una de las 6 luces del pool con prioridad máxima (siempre asignada).

### 3.12 Curarse y huesos rotos del jugador

Ampliar `combate/danio.js` (ya tiene huesos rotos para NPC) al jugador con 4 «miembros»: brazo izq/der, pierna izq/der + torso.

| Estado | Efecto | Cura (VR) | PC |
|---|---|---|---|
| **Herida sangrante** (corte, bala) | −1 vida/2 s, goteo de sangre desde la zona, manchas en la mano | **Venda**: sacarla de la riñonera, ponerla sobre la zona (antebrazo, muslo, costado) y **dar dos vueltas** con la otra mano alrededor del miembro (gesto circular) | H mantenido 2 s |
| **Daño general** | vida baja: viñeta roja lateral, latido | **Jeringa** (estimulante médico 2030): clavarla en el muslo o en el brazo (acercar + gatillo); +40 en 3 s. Botiquín de Hank: varias | H |
| **Brazo roto** (golpe contundente fuerte, caída) | La mano de ese lado tiembla, no sujeta a dos manos, no trepa; golpes con ella sin fuerza | **Férula**: dos palos/tablas (o la regla metálica del laboratorio) + venda: colocar la tabla junto al antebrazo y vendar | H con férula en inventario |
| **Pierna rota** (caída > 3 m, golpe de robot pesado) | Velocidad ×0,55, no corre, cojera (balanceo de cámara **mínimo**, opcional), ruido de arrastre | Férula en la pierna (agacharse para alcanzarla) | H |
| **Aturdido** (golpe en la cabeza) | Pitido, visión doble 2 s (sin mover la cámara: solo un fantasma desplazado), audio apagado | Pasa solo | — |

Regla de confort: **nunca** mover la cámara del jugador por el daño (ni sacudidas de cabeza): solo color, audio, háptico y la mano virtual. El empujón actual `dolly.position.addScaledVector(tA, .12)` en `hurtPlayer` (VR) debería ser opcional/desactivable.

### 3.13 Resistencia y respiración

- Barra **invisible**; se nota por la **respiración** (audio estéreo cercano), el temblor del arma y el vaho.
- Gastan: correr, golpes fuertes, trepar, apalancar, cargar a Hank (si se añade). Recupera parado o agachado.
- **Contener la respiración** (3.8) también **estabiliza la puntería** 4 s (como el francotirador clásico) — mismo gesto, dos usos.
- PC: igual, con la respiración y un leve balanceo de la mira.

### 3.14 Comer y beber

- Barrita, lata de refresco, botella de agua, **el café de la mujer de Hank** (cap. 5: «resucita muertos», *(nuevo)*): llevar a la boca → sonido de morder/beber, +10 resistencia máxima temporal o +5 vida. No hay hambre como sistema de supervivencia (no es ese juego); es **ritual y descanso**.
- Lata: abrirla con el dedo de la otra mano (anilla) antes de beber.

### 3.15 Escribir notas y mapa de papel

- **Cuaderno de Dave** (ya existe `escritura.js` con cuaderno y rotulador): en el bolsillo del pecho. Opcional, sin función de sistema: el jugador puede apuntar lo que quiera. *(Guiño)*: en el cap. 5, John dicta las coordenadas de Peñas Negras; si el jugador las apunta, Dave dice «apuntado» (memoria `dave:apunto_coordenadas`).
- **Mapa de papel del pueblo**: sacarlo de la riñonera y **desplegarlo con las dos manos** (abrir = separar las manos). Sin «estás aquí»: hay que orientarse con los nombres de calles y la torre del laboratorio. Con el rotulador se puede marcar. En PC: M, sin marcar.

### 3.16 Walkie-talkie (John)

- Catálogo `radio`. En el cap. 6, John y Dave se separan (John en la garita con la placa; Dave por los barracones). El walkie vive en la hombrera.
- **Escuchar**: la voz de John sale **del walkie** (fuente de audio pegada al objeto, filtro paso banda 300-3.000 Hz + ruido). Acercarlo a la oreja sube el volumen y quita ruido — el jugador **aprende solo** a llevárselo a la oreja.
- **Hablar**: gatillo con el walkie en la mano = pulsar para hablar. Si hay reconocimiento de voz (opcional, `conversacion.js`), se usa; si no, **pulsar = respuesta corta predefinida** («Recibido», «Espera», «Ahora»). Pulsar con un robot a < 5 m = ruido 3 m.
- **Coordinación**: John avisa de patrullas («dos por tu izquierda, junto al depósito»), pide «dime cuándo» para la distracción del depósito → **el jugador pulsa para dar la señal** (paso de historia).

### 3.17 Reloj de muñeca 2030 (el único HUD de Dave)

Girar la muñeca hacia la cara → la esfera se ilumina:
- **Hora de la historia** (21:40, 03:12, 04:05…): el tiempo pasa de verdad y cuenta la noche.
- **Pulso cardíaco** = vida (número + color). Sin barra en pantalla en VR.
- **Mensajes de Sarah** *(nuevo)*: en el cap. 2-4 llegan mensajes que el jugador decide leer (vibra la muñeca): «¿Has llegado?», «Lucía pregunta por ti», «No me contestes si no puedes». Si la memoria dice `sarah:silencio_al_irse`, los mensajes son más secos. Cero coste de sistema, mucho peso emocional.
- **Batería baja** al final del cap. 6 (el localizador de la biblia se queda sin batería en el Acto II: rima).
- PC: Tab muestra el reloj en una esquina.

### 3.18 La foto de la familia

En el bolsillo del pecho desde el cap. 2 (la coge de la estantería al salir *(nuevo)*: «mirar la foto» del cap. 1 ya existe; ahora además se puede **llevar**). Sacarla y mirarla en un momento de calma dispara una línea de Dave una vez por capítulo («Vuelvo, Lucía. Lo prometo.»). Sin efecto mecánico: es motivo, no buff. En el epílogo, en gravedad cero, la foto **flota** si la sueltas.

---

## 4. El casco neural y la capa futurista (canon por actos)

### 4.1 Reglas de canon que este diseño respeta

- El casco (8 electrodos, chip M-7) **graba la mente** y da el **mando de los robots dormidos** a quien lo lleva.
- **Acto I**: Dave se lo pone en el prólogo → su copia (`LZR-0001`) se sube a Lázaro Systems. **Dave nunca controla robots** en los Actos I-II. Esa noche R-01 se pone el casco y se convierte en **El Rey** (copia de Mike sin freno moral).
- **Acto III**: Dave murió en el Acto II y despierta como **Unidad 01**. Puede **despertar y convertir** robots **tocando su núcleo**. El ojo cian **parpadea cuando duda**.

### 4.2 Actos I-II: el casco como objeto de historia y la interferencia de El Rey

| Momento | Diseño VR | Prio |
|---|---|---|
| **Ponerse el casco** (prólogo, beat 5) | Coger el casco de la vitrina con **las dos manos** (es pesado: se mueve con un muelle lento), llevarlo a la cabeza; al estar a < 20 cm de la cara, el mundo se oscurece desde los bordes, **8 puntos de luz** (los electrodos) se encienden uno a uno alrededor de la visión con un tic háptico cada uno, pitido agudo, destello blanco. Después, «me pica la nuca»: un hormigueo háptico en ambos mandos. Ya existe el paso `usar` con `alCabeza: true` — esto es su puesta en escena | **P0** |
| **El picor en la nuca** | Tic recurrente *(nuevo)*: en momentos de estrés (muerte de Mike, ver el holograma de R-01) Dave se lleva la mano a la nuca (si el jugador lo hace él mismo, Dave lo comenta: «Igual que Mike»). Rima con el tic de Mike y de R-01 | P2 |
| **Interferencia de El Rey** | Cuando El Rey emite órdenes (oleadas, la ola de despertar): **todos los ojos rojos parpadean a la vez**, la radio y el walkie sueltan un chirrido digital con **fragmentos de la voz de Mike** muy procesados (presagio del giro), las farolas cercanas bajan un instante, el reloj de muñeca se reinicia («M-7 SYNC» un frame) *(nuevo)*. Para el jugador no hay control: solo amenaza. Coste: un evento global `pulsoRey()` que consumen luces, audio y enemigos | **P0** |
| **Holograma de la cámara 3** (cap. 5) | Proyector físico sobre la consola: el jugador **lo coge y lo gira** para ver el gesto de R-01 desde otro ángulo; puede pausar con un botón físico. Material holograma con líneas de barrido | P1 |
| **Pantallas de Mike** | Monitores con texto `grabar_sujeto --DAVE · destino: LÁZARO SYSTEMS · ref: LZR-0001` legible de cerca; teclas físicas (ya hay teclas tocables en `interaccion`) para pasar páginas del registro | P1 |
| **Acto II (borrador)** | El localizador de la nave (biblia) se queda sin batería; El Rey interfiere las comunicaciones de la agencia espacial con la misma firma de audio. Nada de poderes | — |

### 4.3 Acto III: Unidad 01 — poderes diseñados para la VR

| Poder | Diseño VR | Alternativa PC | Canon / coste narrativo |
|---|---|---|---|
| **Despertar y convertir** | 1) Derribar o inmovilizar al robot (o encontrarlo dormido). 2) **Arrancar la placa del pecho** (grip + tirar, cede con un crujido). 3) **Meter la mano** en el hueco hasta el núcleo (esfera roja que late). 4) **Mantener el grip** 3-4 s mientras un anillo de **8 luces** (los electrodos del casco, el motivo visual de Mike) pasa de rojo a cian; háptico de latido que se acelera. 5) El robot **forcejea**: su brazo intenta apartarte (la mano virtual recibe tirones); si sueltas, falla y se alarma. 6) Al terminar, **flash de recuerdo ajeno** (1 s de imagen de la vida que tuvo ese chasis / de su copia, si la tiene) | E mantenido 4 s mirando el núcleo + pulsar a ritmo cuando el anillo parpadea | «Cada conversión tiene un precio»: contador de mentes reescritas que los compañeros comentan |
| **Visión de escaneo** (el ojo) | Mirar fijamente un robot/puerta/dron 1 s → marco diegético dentro del «ojo» (overlay curvo pegado a la cara, no plano HUD): estado, núcleo, si es convertible. Activación: dos dedos a la sien (gesto) o botón | Clic central | Ojo cian de la biblia |
| **Anular puertas, drones y torretas** | Tocar el panel con la palma 2 s → abre. Drones: **agarrarlos en el aire** con el grip cuando están cerca y «girarlos» (rotar la muñeca) para reprogramarlos; luego los lanzas como exploradores | E sobre panel / dron | Dron vigía convertible (biblia) |
| **Recuerdos al tocar objetos** | Objetos con historia de Dave (la taza de la cocina, la foto, la piedra, el dibujo de Lucía, el sofá) → al agarrarlos, 3-5 s de flashback: el mundo se vuelve sepia, se superpone el audio de esa escena **del Acto I tal como la jugó el jugador** (usa la memoria: si se fue sin despedirse, el recuerdo es la puerta cerrándose) | E | Unidad 01 tiene los recuerdos de Dave «hasta el día en que le grabaron» — **ojo**: le grabaron en el prólogo; los recuerdos posteriores (la cena, la noche) **no deberían estar**. Propuesta: Unidad 01 recuerda hasta el prólogo con nitidez; lo posterior le llega **solo al tocar objetos** como «ecos que no son suyos» (inquietante y coherente). A validar con la biblia |
| **«Dudar» (parpadeo del ojo)** | En elecciones morales y antes de convertir a un robot con «restos» de persona, el ojo parpadea: la visión se corta un instante y la voz interna de Dave suena distinta. **Mecánica**: si el jugador mantiene la mirada en el robot durante el parpadeo, se desbloquea una opción de diálogo extra («dejarle ir») | Igual, con E | Biblia: «un único ojo cian que parpadea cuando duda» |
| **Interferencia de El Rey (versión robot)** | Ahora El Rey **te habla dentro**: distorsión cromática solo en el overlay del ojo (no en el mundo), voz de Mike en ambos oídos sin espacializar, los convertidos cercanos dudan (ojos cian→rojo intermitente). Resistir = cubrirse el «oído» (manos a los lados de la cabeza) | Mantener Q | El giro: estás haciendo lo mismo que él |
| **Cuerpo robot** | Más fuerza (puede **arrancar puertas**, levantar coches un palmo para sacar a alguien), pero **pierde piezas**: si pierdes el antebrazo, la mano virtual desaparece y debes **recogerla y encajarla** (biblia: «perder piezas en combate») | Tecla de reparar | Biblia |

---

## 5. Integración escena a escena — Acto I

Para cada capítulo: los *beats* de `historia-acto1.md` y lo físico / sigiloso / atmosférico que se les añade. Coordenadas de `js/mundo/tierra.js` (`PUNTOS`). Columna **Nuevo** = geometría o props a crear.

### Prólogo · La noche de los chips (lab, atardecer)

| Beat | Añadir | Nuevo |
|---|---|---|
| 1 Mike se gira | Luz de atardecer por las ventanas altas del lab con **conos de polvo** dorados (2 cards aditivas). Ventilador del techo girando. Zumbido de servidores (capa cercana) | 2 cards de rayo, ventilador |
| 2 Cinta 1 | La cinta es una **grabadora de bolsillo** (catálogo `cinta`) que hay que coger y **apretar el botón de play** con el pulgar (gatillo); el audio sale del objeto. Acercarla a la oreja = más claro | Modelo de grabadora (pendiente en `pendientes-mundo.md`) |
| 3 Vitrina | Abrir la vitrina **tirando de la puerta de cristal** (`crearPuerta` con material vidrio). El mecano de papá en una estantería: coger una pieza (Mike: «Aún la tienes») *(nuevo, opcional)* | Puerta de vitrina, caja de mecano |
| 4-5 Ponerse el casco | Ver 4.2: dos manos, 8 electrodos, destello, luces del lab bajan | Efecto de los 8 puntos |
| 6 «Me pica la nuca» | Hormigueo háptico; si el jugador se toca la nuca → Mike: «Eso es normal. Creo.» | — |
| 7 Cápsulas | Vaho frío al abrir la escotilla de la cápsula; el cristal de la cápsula está **empañado**: pasar la mano lo limpia (pintar en un canvas de máscara, como `escritura.js`) y aparece la cara de Unidad 01 | Máscara de vaho en el cristal |
| 8 Pickup | **Llave en el contacto**: girarla con la mano (VR) para arrancar. Radio del coche con noticias: «...apagones en la zona industrial...» (presagio) | Llave/contacto en la pickup |

### Capítulo 1 · La última cena (casa, 21:40)

| Beat | Añadir | Nuevo |
|---|---|---|
| 1 Entrar | **Quitarse la chaqueta y colgarla** en el perchero (opcional, gesto doméstico). Cambio de audio exterior→interior. Olla en el fuego con vapor (sprite) | Perchero, vapor |
| 2 Dibujo de Lucía | Con chinchetas: se puede **quitar de la pared y mirar de cerca**; en el reverso, «PARA PAPÁ» | Dibujo como prop con reverso |
| 3 Contestador | **Pulsar el botón físico** del contestador (LED parpadeando) — hoy es mirar/usar | Modelo de contestador |
| 4 Foto | Coger la foto (prop), y al salir en el cap. 2 **guardarla en el bolsillo** | — |
| Mesa | **Poner la mesa** *(opcional, nuevo)*: Sarah: «Los vasos, ya que estás». Coger 2 vasos del armario de la cocina y dejarlos en la mesa (snap suave). **Servir vino** inclinando la botella (chorro = cilindro estirado que cae; el nivel sube). **Encender la vela** con un mechero (pulgar en la rueda = gatillo) | Armario con vasos, mechero, chorro |
| Piano *(nuevo, opcional)* | `crearPiano` en el salón. Si el jugador toca, Sarah: «Lucía dice que lo tocas peor que el tío Mike.» Si toca 3+ notas seguidas, Lucía, desde su cuarto: «¡Papá, que duermo!» (puerta cerrada pendiente en `pendientes-mundo.md`) | Piano (ya existe el sistema) |
| 5 Elección | Durante la elección Sarah **te coge la mano** si la acercas (háptico suave) | — |
| 6 Sofá | Sentarse; **manta** sobre las piernas (prop). Apagar la lámpara de pie tirando de la cadenita (gesto) → la habitación queda en luz de luna | Lámpara con cadena |
| 7 Fundido 03:12 | El reloj de muñeca vibra y marca 03:12 antes del fundido | — |

### Capítulo 2 · Robots en la calle (03:12, empieza la lluvia)

| Beat | Añadir | Nuevo |
|---|---|---|
| 1 Sarah despierta | Luz de la tele parpadeando azul (una luz del pool con curva de parpadeo). Ruido de lluvia empezando en el tejado | — |
| 2-3 Elección / despedida | Abrazo real: si acercas las dos manos a la espalda de Sarah, cuenta como despedida (ya es `opcional`); háptico largo | — |
| Salir | **Coger la linterna** del cajón de la entrada (`crearCajon` + `linterna`) *(nuevo)*: el jugador aprende la linterna aquí. **Coger la foto** de la estantería | Cajón de entrada |
| Fuera | **La ola de despertar** (2.6): desde el porche, los ojos rojos de robots dormidos se encienden en cadena por todo el pueblo; las farolas se apagan por sectores; los perros callan de golpe. Pájaros que huyen del cable de la luz. Un vecino en la ventana de enfrente cierra la cortina | Sistema de ojos lejanos, siluetas |
| 4 La piedra | El robot sale de detrás de un coche con alarma sonando. **Esconderse detrás del coche** antes de atacar (enseña la cobertura); golpear con la piedra con fuerza real | — |
| 5 Conducir | Lluvia en el parabrisas, **limpiaparabrisas** (palanca que se puede accionar), robots cruzando la carretera iluminados por los faros. Un perro cruza corriendo | Limpias animados |

### Capítulo 3 · El laboratorio acordonado (03:40, lluvia fuerte)

| Beat | Añadir | Nuevo |
|---|---|---|
| 1 El cordón | Girofaros rojos (luz del pool con rotación), radio militar con chatter, foco de un Humvee barriendo. Núñez fuma: brasa del cigarro + vaho | Girofaro, foco del vehículo |
| 2 Sigilo — rodear la valla | **Ya existe el agujero** en la valla trasera (`lab.agujero`, x −12..−9,5): convertirlo en **gatear bajo la malla levantada** (levantarla con una mano —objeto con bisagra— y pasar agachado). Patrulla de 1 soldado con linterna por el exterior (sistema de guardias existente). Charcos que hacen ruido si corres | Malla levantable |
| 2b Entrar por detrás | La puerta trasera está **cerrada**. Dos caminos: a) **romper la ventana del baño** (`crearCristal`, 0,8×0,6 m a 1,4 m de altura) con la piedra o la culata — ruido 15 m: un soldado del cordón se acerca a mirar («¿Has oído eso?»), el jugador debe **esconderse** detrás de los contenedores y **taparse la boca** hasta que se va; b) **conducto de ventilación** bajo la ventana: rejilla que se arranca a tirones (más lento, silencioso) | Ventana trasera, rejilla, contenedores |
| Dentro | Laboratorio a oscuras salvo monitores y luces de emergencia rojas que parpadean; **cristales rotos crujen** al pisarlos; huellas de robot hacia la vitrina vacía (TLOU). Agua entrando por un ventanal roto con charco | Decals de huellas, charco |
| Taquilla *(nuevo)* | Antes de llegar a Mike, un R-7 patrulla el pasillo: **esconderse en una taquilla** (`crearArmario` tipo taquilla), ver por las rendijas cómo pasa escaneando con luz roja, contener la respiración cuando se para delante | 2-3 taquillas en el pasillo |
| 3-5 Mike muere | Mike herido: el jugador puede **presionar la herida** con la mano (háptico de pulso que se debilita) — sin cambiar el desenlace. Lluvia baja a llovizna, silencio. Mike suelta la mano | — |
| 6 Cinta 2 | Grabadora en la mesa (física) | — |
| 7 Robots en el lab | Pelea con caída de focos, chispas de cables cortados, monitores que estallan al recibir balas (`monitor` del catálogo) | Monitores rompibles |

### Capítulo 4 · La tienda de armas (04:05, llovizna, niebla baja)

| Beat | Añadir | Nuevo |
|---|---|---|
| 1 Salvar a Hank | Fluorescente de la fachada parpadeando; escaparate ya roto (cristales en la acera). Hank dispara desde dentro: fogonazos iluminan la niebla | — |
| 2-3 Dentro / X-56D | **El tutorial de armas de verdad**: Hank pone la X-56D en el mostrador **desmontada del cargador**. El jugador mete el cargador y monta el arma. Hank: «Ahí. Así se carga. Si lo pierdes, no te doy otro.» **Hank le pone a Dave el chaleco** con 2 portacargadores (aparecen las ranuras del cuerpo) | Chaleco/ranuras |
| Probar | Bote de latas en una estantería para probar el disparo *(opcional)*; Hank se queja de los agujeros | — |
| 4 Familia de Hank | Hank intenta llamar con el **teléfono del mostrador** (pendiente en `pendientes-mundo.md`): el jugador oye el tono sin respuesta por el auricular si se acerca | Teléfono |
| 5-6 Saqueadores | Antes de entrar Rata, **barricar la puerta** *(nuevo)*: Hank: «¡La estantería! ¡Empújala!» → arrastrar la estantería con las dos manos. Si se hace, Rata entra por la trastienda (otra puerta) y dice «Bonita barricada, piedrecitas». Elección `echar`: pelea a corta distancia entre estanterías, botes que caen, el fluorescente revienta | Estantería empujable, puerta trasera |
| 7 Cuchillo | Hank lo da **en la mano**; el jugador lo guarda en la funda del pecho (aprende la ranura) | — |
| Botiquín | Hank: «Llévate esto. Vendas, jeringas. Para lo que viene.» → el jugador lo mete en la riñonera (aprende curarse). Si salió herido, Hank le **venda el corte** del cristal | — |

### Capítulo 5 · La banda (amanecer → laboratorio)

| Beat | Añadir | Nuevo |
|---|---|---|
| 1 Sarah | **Sale el sol de verdad** durante el diálogo (interpolación de hora). Vaho en el aire. Charcos reflejando el cielo rosa | Interpolación de hora |
| 3-4 John / RUIZ | Para leer «RUIZ» hay que **acercarse** (la textura del nombre solo es legible a < 1,2 m). Si el jugador **toca la placa**, John le aparta la mano | Textura de nombre |
| Café *(nuevo)* | La mujer de Hank no está; Sarah sirve café: taza caliente con vapor; beberla = +resistencia | Taza con vapor |
| 6 Despedida | Abrazo físico (como en el cap. 2) | — |
| 7 Cinta 3 | Junto a la cápsula: el cristal ahora está **limpio** (lo limpiaste en el prólogo… o no) | — |
| 8 Holograma | Proyector físico que se coge y se gira (4.2) | Proyector |
| 9 La señal | Desde la ventana, la **estela de la nave de El Rey** en el cielo del amanecer | Estela |
| 10-12 Milicia | Antes del ataque, John: «Coge la pistola del cajón de Mike» → pistola a la **cadera** *(nuevo)*. Pelea con cobertura entre mesas; cristales de mamparas que estallan | Pistola |
| 13 Atar a Varela | Si se elige «Átalo»: **atar con bridas** — acercar la brida a las muñecas de Varela y tirar del extremo (gesto de apretar) | Brida |
| 14 Plan | John extiende el **mapa** de Peñas Negras en la mesa; el jugador puede marcar con el rotulador; John señala con el dedo (gesto) el depósito y la plataforma | Mapa de la base (superficie de escritura) |

### Capítulo 6 · Asalto a la base (noche, viento)

| Beat | Añadir | Nuevo |
|---|---|---|
| 1 Caja del camión | Lona que ondea con el viento (vertex), luces de la carretera pasando por los huecos, Hank con vaho. Bache = **agarrarse a la barra** (si no te agarras, el mundo no se mueve —confort— pero Hank se ríe: «Agárrate, piedrecitas… perdón, eso es de Rata») | Barra en la caja |
| 2a Control de la entrada | El jugador **escondido bajo la lona**: tumbarse; el foco del guardia pasa por encima; contener la respiración mientras John habla con el guardia (fallo = el guardia levanta la lona) | Lona como escondite |
| 2b Barracones (sigilo) | **Walkie con John** (3.16). Rutas con 2 alternativas: a) por el suelo entre barracones con focos (ya existe); b) **escalera de mano** al tejado de un barracón + **conducto** de 8 m que baja al callejón (`base.callejon`), viendo a través de la rejilla a dos soldados hablando («no todos son Varela»: uno dice que se quiere ir a casa — humanizar). Latas y botellas junto a un contenedor para distraer | Escalera, conducto, rejilla |
| 2c Explosión del depósito | **El jugador da la señal** por el walkie («¡Ahora!») → John lo vuela. Ceniza que cae, brasas, luz naranja, pájaros (si los hay) y alarmas. Los guardias corren al fuego: ventana de 20 s | Ceniza, brasas |
| 3 Arrancar la ORION-4 | **Cabina física**: John pide la secuencia — 1) batería (interruptor con tapa de seguridad: levantar la tapa, subir el interruptor), 2) bombas de combustible (2 interruptores), 3) APU (botón que hay que mantener 3 s), 4) palanca de potencia. Entre cada paso, **salir a defender** la rampa (35 s totales): ir y volver de la cabina mientras llegan robots = el «resistir» deja de ser esperar | Panel de cabina con 4 controles |
| 4-5 Varela en la rampa | Viento fuerte, ceniza; los robots llegan con los ojos sincronizados (pulso de El Rey). Si se le ofrece sitio, Varela cierra la puerta **a mano** (rueda de la escotilla) desde fuera | — |
| 6 Despegue | Agarrarse al arnés del asiento (2 tiradores sobre los hombros) → vibración háptica creciente; el mundo **no** se mueve bruscamente: se ve por la ventanilla. Fundido al blanco de las nubes | Arnés |

### Epílogo · Órbita

- Gravedad cero suave: objetos sueltos (la foto, una taza, la piedra) **flotan** al soltarlos. El jugador no se mueve (confort); solo los objetos.
- Mirar la Tierra por la ventanilla: luces de ciudades **apagándose** a trozos (El Rey). Hank: «Marta y Leo están ahí abajo. En alguna de esas luces.»
- Reloj de muñeca: **batería baja**.

---

## 6. Confort y accesibilidad (menú «Comodidad»)

Agrupado en una sola sección (Meta: el 40 % no reconoce la palabra «viñeta»; agrupar las opciones de confort juntas y nombrarlas por efecto).

| Opción | Valores | Por defecto |
|---|---|---|
| Movimiento | Suave · Teletransporte (con «piernas fantasma» que muestran dónde quedarás, como Alyx) · Mixto | Suave |
| Velocidad de movimiento suave | 1,5 / 2,2 / 3 m/s | 2,2 |
| Giro | Por pasos (30° / 45° / 90°) · Suave (60-180 °/s) | Pasos 30° |
| **Visión en túnel** (viñeta) al moverse/girar/trepar | No · Suave · Fuerte | Suave |
| Dirección de movimiento | Hacia donde miras · Hacia donde apunta la mano | Mano |
| **Modo sentado** | Sí/No: suma altura virtual, agacharse por botón, ranuras del cuerpo más bajas y adelantadas | No |
| **Calibrar altura** | Botón «Estoy de pie recto» (recalibra en 1 s; accesible desde el menú de pausa) | Al empezar |
| Agacharse | Real · Botón (alternar) · Botón (mantener) | Real + alternar |
| Mano dominante | Derecha / Izquierda (cambia ranuras, gatillo de disparo) | Derecha |
| Retroceso visual | Normal / Reducido | Normal |
| Sacudidas de cámara | Desactivadas en VR siempre; empujón por daño: Sí/No | No |
| Sangre y desmembramiento | Normal / Reducido / Sin sangre | Normal |
| Subtítulos | Tamaño (3), fondo, **color por personaje**, nombre del que habla, indicador de dirección (flecha si el que habla está fuera de la vista) | Medio |
| Ayuda de sigilo | Medidor de detección visible / solo audio y háptico | Visible en PC, solo audio en VR |
| Recarga | Física completa · Asistida (el cargador entra solo al acercarlo a 15 cm; sin montar) · Automática | Física |
| Gestos (tapar la boca, vendar en círculo, apalancar) | Gesto · Botón mantenido | Gesto |
| Interacciones lejanas | Agarre a distancia (rayo + tirón, estilo guantes de gravedad, sin botones extra) Sí/No | Sí |
| Daltonismo | Ojos rojo/cian → rojo/blanco con forma distinta (anillo vs punto) | — |
| Háptica | Intensidad 0-100 % | 70 % |
| Vuelo de la cámara en vehículos | Cabina fija con horizonte (viñeta automática en curvas) | Sí |

Reglas de diseño de confort:
- Nunca mover la cámara sin que el jugador lo cause (salvo vehículos, con cabina de referencia).
- Movimiento suave a **velocidad constante**, con arranque y frenada muy cortos (≤ 0,1 s): la aceleración sostenida es lo que choca con el oído interno; nada de inercias largas ni cambios bruscos de dirección impuestos por el juego.
- Ascensores, escaleras y despegue: **fundido** o cabina con referencia visual.
- Pausar = fundido a negro suave + menú en el mundo, no un panel pegado a la cara.

---

## 7. Presupuesto de rendimiento — Quest 3 (navegador)

Objetivo: **72 Hz estable** (90 Hz si sobra), escena completa del pueblo con lluvia y pelea. Medir con `renderer.info` (añadir `?stats` como overlay en VR) y la herramienta de Meta (OVR Metrics). Las cifras de draw calls de terceros (100-150) son conservadoras; Quest 3 aguanta más, pero el **coste de CPU por draw call en el navegador** es el cuello real (Meta: 1.000 draw calls de un triángulo bajan de 72 fps por CPU).

| Recurso | Presupuesto | Notas / cómo |
|---|---|---|
| Draw calls (por ojo con multivista = 1 vez) | **Objetivo ≤ 150, techo 250** (incluye pase de sombra) | Fusionar estático por material (ya hay fusión de geometría en `nucleo.js`), `InstancedMesh` para lluvia, pájaros, ojos, basura, salpicaduras; catálogo ya usa 4 materiales compartidos |
| Triángulos visibles | ≤ 300 k (techo 500 k) | Personajes .glb ≤ 25 k; LOD de fachadas por distancia |
| Luces dinámicas | **6 puntuales del pool + 1 direccional** (sin subir) | Linterna con prioridad fija; girofaros, tele y velas compiten por el pool por cercanía |
| Sombras | 1 mapa direccional 1024 (2048 solo en interiores pequeños) | Solo personajes y props cercanos proyectan; nada de sombras en luces puntuales (6 mapas cada una) |
| Post-procesado | **Ninguno a pantalla completa** | Fundidos con esfera en cámara (ya se hace así en `fx.js`), viñeta con malla en cámara |
| Transparencias / partículas | ≤ 3.000 partículas vivas; ≤ 4 capas de transparencia superpuestas en pantalla | Niebla falsa y humo con *soft fade* por distancia; ocultar (`visible=false`) lo que esté a opacidad 0 (Meta: lo transparente invisible cuesta igual) |
| Texturas en GPU | ≤ 350-400 MB | **KTX2/Basis** (Meta lo recomienda); máximo 2K para el suelo, 1K para props, 512 para catálogo; menos mapas PBR en lo lejano |
| Materiales/shaders distintos | ≤ 25 programas | Parches de niebla de altura y viento en `onBeforeCompile` con la misma clave de caché |
| Resolución | `framebufferScaleFactor` 1,0 (bajar a 0,9 si cae); foveación 1 (ya) | Escribir directo al swap chain (sin render targets intermedios) para conservar FFR y MSAA |
| Física (Rapier) | ≤ 60 cuerpos dinámicos despiertos | Dormir agresivo; escombros se encogen a los 10 s (ya) |
| Audio | ≤ 24 voces simultáneas, ≤ 8 con HRTF | Capa lejana con `equalpower` (más barato) |
| Animación | Personajes lejanos (> 25 m) a 30 Hz, en grupos alternos | Meta: repartir actualizaciones entre fotogramas |
| Vida ambiental | ≤ 8 draw calls en total para toda la «afluencia» | Ver 2.6: todo instanciado |

---

## 8. Riesgos y decisiones abiertas

1. **Memoria de Unidad 01** (4.3): ¿recuerda la noche del Acto I o solo hasta la grabación del prólogo? El canon («hasta el día en que te grabaron») apunta a lo segundo; este documento lo convierte en mecánica (ecos al tocar objetos). Validar con la biblia.
2. **Pistola en el Acto I**: no está en la biblia (solo X-56D, Arda, cuchillo). Alternativa sin pistola: la ranura de cadera queda para la **escopeta recortada** de Hank o vacía.
3. **Lluvia en los caps. 2-4**: cambia el tono de una noche hasta ahora «seca». Encaja con RDR2, pero hay que validarlo con el director de arte (`direccion-arte`).
4. **Reconocimiento de voz del walkie**: dependerá del proxy de `conversacion.js`; el diseño funciona sin él (respuestas predefinidas).
5. **El módulo `interaccion/` está sin conectar**: antes de cualquier tarea de props hay que engancharlo en `main.js` y probar rendimiento en las gafas.

---

## Fuentes

- Road to VR — *VR Design Unpacked: The Incredible Details of Half-Life: Alyx*: https://www.roadtovr.com/these-details-make-half-life-alyx-unlike-any-other-vr-game-inside-xr-design/
- Engadget — *How Valve brought Half-Life to VR* (guantes de gravedad «sin botones», nacidos de problemas concretos): https://www.engadget.com/2020-03-31-half-life-alyx-valve-interview-vr.html
- Game Developer — *How height, audio cues, and trust sculpted VR locomotion in Half-Life: Alyx* (teletransporte con piernas fantasma, varias opciones de movimiento): https://gamedeveloper.com/design/how-height-audio-cues-and-trust-sculpted-vr-locomotion-in-i-half-life-alyx-i-
- Game Developer — *Designing around panic in The Walking Dead: Saints & Sinners* (resistencia, cuchillo atascado, recuperación simple): https://gamedeveloper.com/design/designing-around-panic-in-i-the-walking-dead-saints-sinners-i-
- Unreal Engine Tech Blog — *Skydance Interactive shows how it injected VR physicality and melee combat in The Walking Dead: Saints & Sinners*: https://www.unrealengine.com/tech-blog/skydance-interactive-shows-how-it-injected-vr-physicality-and-melee-combat-in-the-walking-dead-saints-sinners
- 80 Level — *Technical challenges behind Walking Dead: Saints & Sinners*: https://80.lv/articles/technical-challenges-behind-walking-dead-saints-sinners
- Game Developer — *How classical game mechanics and physics converge in VR hit Boneworks*: https://gamedeveloper.com/design/how-classical-game-mechanics-and-physics-converge-in-vr-hit-i-boneworks-i-
- Road to VR — *Boneworks reveal: physics-based interactions & embodiment*: https://roadtovr.com/boneworks-reveal-stress-level-zero-physics-based-interactions-embodiment/
- Into the Radius 2 (Steam: fundas y bolsillos colocables en el chaleco): https://store.steampowered.com/app/2307350/Into_the_Radius_2/
- Game Developer — *Intuitive inventory systems in VR games*: https://gamedeveloper.com/design/intuitive-inventory-systems-in-vr-games
- Meta Blog — *Arizona Sunshine 2 launch* (Nick Witsel, objetos usables por todo el mundo, recargas distintas): https://www.meta.com/blog/arizona-sunshine-2-launch-vertigo-games-nick-witsel/
- Fabian Bauer, SIGGRAPH 2019 — *Creating the Atmospheric World of Red Dead Redemption 2* (resumen en DTF): https://dtf.ru/id17412/62607-kak-v-red-dead-redemption-2-ustroeny-vizualnye-effekty
- Graphics study RDR2 (imgeself): https://imgeself.github.io/posts/2020-06-19-graphics-study-rdr2
- SIGGRAPH — *Volumetric Effects of The Last of Us Part Two* (Kovalovs): https://history.siggraph.org/learning/volumetric-effects-of-the-last-of-us-part-two-by-kovalovs
- 80 Level — *A deep dive into level design behind The Last of Us Part II*: https://80.lv/articles/a-deep-dive-into-level-design-behind-the-last-of-us-part-ii
- 80 Level — *How level design lighting helped make The Last of Us more immersive*: https://80.lv/articles/see-how-level-design-lighting-helped-make-the-last-of-us-more-immersive
- Game Developer — *Writings on the wall: accessible narratives through environmental design*: https://gamedeveloper.com/design/writings-on-the-wall-sharing-accessible-narratives-through-environmental-design
- Meta — *Locomotion best practices*: https://developers.meta.com/horizon/design/locomotion-best-practices/
- Meta — *Locomotion comfort & usability*: https://developers.meta.com/horizon/design/locomotion-comfort-usability/
- Meta — *Locomotion user preferences* (giro 30/45/90°, elegir snap/suave): https://developers.meta.com/vr/design/locomotion-user-preferences/
- Meta — *Comfort*: https://developers.meta.com/horizon/design/comfort/
- Meta — *Seven design decisions* (la mitad juega sentada; recalibrar altura rápido; 40 % no entiende «viñeta»): https://developers.meta.com/horizon/resources/seven-design-decisions/
- Meta — *Accessibility design*: https://developers.meta.com/horizon/design/accessibility/
- Meta — *Unity ISDK locomotion comfort (tunneling/viñeta)*: https://developers.meta.com/vr/documentation/unity/unity-isdk-locomotion-comfort/
- Meta — *WebXR performance best practices*: https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/
- Meta — *WebXR performance workflow*: https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/
- Meta — *WebXR fixed foveated rendering*: https://developers.meta.com/vr/documentation/web/webxr-ffr/
- Needle Engine — *VR performance* (presupuestos orientativos de terceros): https://engine.needle.tools/docs/how-to-guides/xr/vr-performance
