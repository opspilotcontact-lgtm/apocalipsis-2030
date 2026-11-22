# Pendientes para el agente del mundo (y otros) · Acto I cinemático

Lo que la historia necesita y hoy está **provisional** dentro de `js/historia/acto1.js` (mallas simples creadas por el guion) o no existe.
Cuando el mundo lo tenga, avisad y quito el relleno del guion.

## Casa de Dave (`casas()` en `js/mundo/tierra.js`) — prioridad alta (capítulo «La última cena»)

| Objeto | Dónde (mundo) | Hoy | Qué hace falta |
|---|---|---|---|
| Mesa de comedor con 2 platos y vela | centro en (21.4, 85.6), 1,4 × 0,85 m, altura 0,75 | malla provisional sin colisión (`mesaCena()`) | mesa con colisión, 2-3 sillas, mantel, platos tapados, vela con `fuenteLuz` cálida tenue |
| Foto enmarcada de los hermanos | sobre el mueble de la tele, (16.6, 0.7, 80.42), mirando al sur | marco + lámina pintada en canvas (`foto()`) | marco mejor; idealmente textura pintada (estilo RDR2) de Mike y Dave niños, «verano 2009» |
| Dibujo de Lucía | pared sur, (22.6, 1.45, 89.32), mirando al norte | lámina en canvas (`dibujo()`) | papel con chinchetas/imán; dibujo infantil «PAPÁ · TÍO MIKE · ROBOT BUENO» |
| Contestador automático | mueble de la tele, (18.5, 0.63, 80.35) | cinta genérica (caja negra con LED rojo) | modelo de contestador con LED parpadeante |
| Sofá usable | `casa.sofa` (17.5, 88.5) | ya existe | — (si se puede, cojín y manta) |
| Puerta del baño / cuarto de Lucía | cualquier pared interior | no existe | una puerta cerrada (no hace falta interior). Sarah dice que Lucía está «en la bañera con los cascos» |
| Lámparas de pie / luz de la cocina | interior | 1 `fuenteLuz` | 2 luces cálidas más para la escena íntima de la cena |

## Laboratorio

| Objeto | Dónde | Hoy | Qué hace falta |
|---|---|---|---|
| Grabadora de cintas de Mike | mesa de Mike (6.9, 0.81, -146.2) y (4, 0.81, -146.2); cápsula (9.1, 0.04, -141.7) | caja con LED (director, `mallaCinta`) | modelo de grabadora de bolsillo / casete |
| Entrada por la puerta principal para la milicia | puerta sur (0, -130.2) | ok | si hay puerta física, que esté abierta en el capítulo 5 |

## Tienda de Hank

| Objeto | Dónde | Qué hace falta |
|---|---|---|
| Trastienda / caja de munición | estantería (-19.5, -55) | una caja de munición distinguible que los saqueadores se puedan llevar (hoy solo se dice) |
| Teléfono en el mostrador | (-17.2, 1.0, -51.5) | Hank intenta llamar a Marta |

## Base de Peñas Negras
- Nada nuevo obligatorio. Opcional: cuerpo/rastro de la milicia en la rampa tras el clímax con Varela.

## Personajes (modelos)
- **Sargento Varela, milicianos, Rata, Chispa, saqueador**: hoy son humanos por código (`npcs.js`, defs `varela`, `milicia`, `rata`, `chispa`, `saqueador`). Conceptos y modelos al estilo del dossier cuando haya cupo.
- **Sarah**: humana por código; falta modelo del dossier.
- **R-01 holograma** (cámara 3): hoy es el robot por código con material de holograma (para que pueda hacer el gesto de la nuca). Si se hace el modelo de El Rey con esqueleto, sustituir.

## Para otros agentes (no son del mundo)
- **combate** (`js/enemigos.js`): tipo de enemigo `'humano'` propio con armas de fuego, cobertura y rendición. Hoy el director los fabrica cambiando el cuerpo de un R-7 (`crearHumano` en `director.js`): pegan cuerpo a cuerpo, salpican chispas como robots y al «morir» caen al suelo o se rinden (no revientan). Sustituir las chispas por polvo/sangre discreta.
- ~~ui: colores de subtítulo~~ HECHO (VARELA, NÚÑEZ, RATA, CHISPA, cintas, EL REY, RADIO · JOHN, ORION).
- ~~main: «Borrar progreso» + memoria~~ HECHO. El índice guardado se migra solo (`director.progreso()`, clave `apoc2030.capv`).

## Revisión 2 (diseño VR) — lo que la historia ya llama
- **Mundo**: `W.clima(tipo, i, dur)` y `W.pulsoRey({ ola, origen, radio })` (ver `docs/eventos.md`). Taquilla en el laboratorio en (-10.9, -144.5). Ventana rompible en la trasera (`lab.trasera`). Panel de cabina de la ORION-4 junto a (150, 1, 25.5). Cajón en la mesa de Mike (5.5, -146.1).
- **Interacción**: emitir los eventos de `docs/eventos.md` (ventana, taquilla, chaleco, walkie, cabina).
