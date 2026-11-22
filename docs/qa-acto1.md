# QA de jugabilidad · Acto I (23-nov)

Partida completa por código en PC (http://127.0.0.1:8740): cada paso del director avanzado con un arnés que llama a `director.actualizar`, enemigos, sigilo, coche, viaje, PNJ y fx con dt fijo (la pestaña va a ~1 fps). En cada paso se probó la **alternativa** (usable `alt-*`, cinta, `max`) y, donde el sistema existe, la **acción prevista** (cajón, pizarra, recarga con R, sigilo/detección). Ramas jugadas: casco aceptar · verdad · promesa (sin abrazo) · aguanta · echar y dar · confrontar/aceptar · cubrir/dudar · atar/soltar · salvar. Muerte y reintento probados en el cap. 5 (inicio y oleada de la milicia).

| Cap. | Estado | Bugs encontrados | Arreglados | Pendientes |
|---|---|---|---|---|
| Prólogo | OK de punta a punta | `cajon_abierto` y `pizarra_escrita` no los emitía ningún sistema (solo valía la alternativa); objetivo ya cumplido seguía en pantalla durante las escenas | `muebles.js` emite `cajon_abierto` al abrir un cajón (y el paso acepta un cajón de la mesa ya abierto); `escritura.js` emite `pizarra_escrita` con ~60 px de tinta; el director borra el objetivo en escenas/diálogos/elecciones | Casco a dos manos (`dosManos`) sigue sin exigirse en VR |
| 1 · Cena | OK | — | — | Pasos `mirar` probados por su `max` (15-20 s); la mirada real no se pudo probar sin render |
| 2 · Calle | OK | La alternativa «Meterte debajo de la pickup» emitía `escondido` pero el R-7 te seguía viendo → `descubierto` y reintento seguro | La alternativa marca al jugador como oculto para el escaneo | Distraer con la botella solo probado por lectura de código |
| 3 · Laboratorio | OK (ventana y rejilla) | — | — | La alternativa de la taquilla no te mete dentro (el R-7 no puede fallarte: en el cap. 3 nadie emite `descubierto`) |
| 4 · Tienda | OK (echar y dar) | `chaleco_puesto` lo emite `armas.js` una sola vez al coger la X-56D (paso anterior) → el paso esperaba un evento ya pasado; si en VR se pierden todos los cargadores, `recargado` no se cumplía nunca (bloqueo) | El paso del chaleco acepta el evento ya llegado; `recargado` tiene `max: 120` y, si no hay balas, Hank te carga 30 | — |
| 5 · La banda | OK; con «dar» Rata aparece en la milicia | Los 2 robots del camino seguían vivos en el lab y se quedaban congelados al lado durante las escenas de las cámaras; el cuaderno de casa seguía usable tras irte y guardar allí rebobinaba el capítulo | `D.despejar()` al llegar al lab; el guardado no actúa si la historia ya condujo/viajó después | — |
| 6 · Base | OK (camión, walkie, 3 resistir, cabina, Varela, ORION) | — | — | Cabina física y walkie solo por alternativa en esta prueba (la cabina emite sus eventos, ver `cabina-orion.js`) |
| Epílogo | OK; líneas según memoria correctas; tarjeta final | — | — | — |

## Sistemas transversales
- **Muerte / reintento:** vuelve al último `cp` con armas, munición y cargadores del punto de control; PNJ restaurados por `rehacer` (John en la milicia, Hank en la tienda y la escolta). Sin `cp` reinicia el capítulo.
- **Diálogo con hostiles:** el director congela a los enemigos en diálogos y elecciones; único caso con robots presentes durante escenas (cap. 5) → arreglado.
- **Sigilo (justicia):** antes el medidor se llenaba en 0,9 s a cualquier distancia e ignoraba la postura. Ahora escala con la distancia y `G.sigilo.visibilidad`: medido 0,7 s a 3 m, 1,25 s a 8 m de pie, 3,15 s a 8 m tumbado; escondido = invisible (también a < 1,4 m). Cono 10 m / 57° sin cambios.
- **Munición:** cap. 4 60 balas + 2 cargadores de la tienda frente a ~6 enemigos; cap. 5 60 frente a ~360 hp humanos (~22 impactos); cap. 6 90 X-56D + 24 de pistola + 1 cargador en la taquilla frente a ~15 robots, pero los `resistir` son por tiempo y siempre quedan armas cuerpo a cuerpo: ningún capítulo es imposible.
- **Escolta de Hank:** no puede fallar (los robots solo persiguen al jugador y Hank nunca baja de 1 hp); la oleada acaba al morir los robots.
- **Pistas:** a los 60 s el director no encontraba la guía (`juego.guia`) y le pasaba un id que no entiende → siempre caía al rombo. Ahora usa `window.__juego.guia` con el punto del marcador/mirada y quita el resaltado al cambiar de paso; a los 120 s sale la línea de Dave (probado).
