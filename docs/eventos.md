# Eventos y ganchos entre la historia y los demás sistemas

La historia (`js/historia/director.js`) **espera** eventos con el paso `evento` y **llama** a ganchos opcionales.
Mientras un sistema no exista, cada paso tiene una **alternativa jugable** (un objeto usable con E / A) o un tiempo máximo: el juego nunca se queda atascado.

## 1. Cómo emitir un evento (para interacción, combate, audio…)

```js
import { director } from './historia/director.js';
director.evento('escondido');                 // con datos opcionales: director.evento('recargado', { arma: 'x56d' })
```
En consola: `__evento('escondido')`.

Al llegar el evento que el paso actual espera, el director quita la alternativa, escribe la memoria del paso y avanza.
Si el evento llega antes de tiempo, queda anotado en `director.eventos[nombre]` (no hace avanzar pasos futuros).

## 2. Eventos que la historia espera

| Evento | Quién lo emite | Capítulo · momento | Cuándo emitirlo | Alternativa hoy |
|---|---|---|---|---|
| `ventana_rota` | interacción (`crearCristal`) | Cap. 3 · entrada trasera del laboratorio (`lab.trasera`, -8.5, -150.5) | Al estallar el cristal de la ventana trasera (con piedra, culata o puño) | usable «Romper la ventana con la piedra» |
| `escondido` | interacción (taquilla `crearArmario` / debajo de coche) | Cap. 3 · pasillo del lab, taquilla en (-10.9, -144.5) | Cuando el jugador está dentro de la taquilla con la puerta cerrada | usable «Esconderte en la taquilla» |
| `respiracion_contenida` | interacción / jugador (mano a la boca + grip, o Mayús izq. en PC) | Cap. 3 · el R-7 se para delante de la taquilla | Al empezar a contener la respiración | sigue solo a los 4 s |
| `descubierto` | combate / sigilo (oído de los robots) | Cap. 3 · mientras dura la escena del escondite | Si el robot detecta al jugador (ruido, no estar escondido) → el director reintenta desde `lab.dentroTrasera` | — (no hay fallo hoy) |
| `salir_escondite` | interacción | Cap. 3 · tras pasar el robot | Al abrir la taquilla desde dentro | sigue solo a los 1,5 s |
| `chaleco_puesto` | interacción (ranuras del cuerpo) | Cap. 4 · tienda, Hank pone el chaleco | Al aparecer las ranuras del chaleco en el jugador | usable «Ponerte el chaleco» junto a Hank |
| `recargado` | jugador / armas | Cap. 4 · primer cargador | Al meter el cargador en la X-56D (VR) | **condición**: `P.ammo.x56d > 0` (la tecla R ya funciona) |
| `walkie_hablar` | interacción (`radio`) | Cap. 6 · John pide «pulsa para hablar» | Al pulsar el walkie por primera vez | sigue solo a los 6 s |
| `walkie_senal` | interacción (`radio`) | Cap. 6 · dar la señal de la explosión | Al pulsar para hablar mientras el paso lo espera | usable «Walkie: «¡Ahora!»» junto al jugador |
| `cabina_bateria` | interacción (panel de la ORION-4) | Cap. 6 · arranque, paso 1 | Tapa levantada + interruptor arriba | usable en la rampa (150, 25.5) |
| `cabina_bombas` | ídem | paso 2 | Las dos bombas encendidas | ídem |
| `cabina_apu` | ídem | paso 3 | Botón APU mantenido 3 s | ídem |
| `cabina_potencia` | ídem | ya sentado | Palanca de potencia empujada | usable junto al jugador |
| `robotCaido` | enemigos (ya existe) | oleadas | Al destruir un robot | — |

## 3. Ganchos que la historia llama (opcionales)

Se llaman con encadenamiento opcional: si nadie los implementa, no pasa nada. Implementarlos en `W` (`js/mundo/tierra.js`) o en `G` (`js/nucleo.js`):

| Gancho | Firma | Llamadas desde el guion |
|---|---|---|
| `W.clima` | `(tipo: 'lluvia'\|'despejado'\|'viento', intensidad 0..1, duracionTransicion s?)` | Cena: despejado · cap. 2: lluvia 0,3 → 0,8 en la ola · cap. 3: lluvia 1 → 0,25 al morir Mike · cap. 4: 0,3 · cap. 5: despejado en 20 s (amanecer) · cap. 6: viento 0,7 |
| `W.pulsoRey` | `({ ola?: bool, origen?: [x,z], radio?: bool })` | Cap. 2: `ola` (ojos rojos en cadena desde el laboratorio, farolas por sectores) · epílogo: `radio` (chirrido con voz de Mike) |

Desde el guion: `D.clima(...)`, `D.pulsoRey(...)`, `D.evento(...)`, `await D.esperarEvento(nombre, maxSegundos)`.

## 4. Campos de paso para los sistemas de interacción

- `usar` admite `dosManos: true` (el casco del prólogo: el sistema de agarre debería exigir las dos manos en VR). Hoy se ignora.
- Paso `evento`: `{ nombre, a (marca), alt: { label, a|pos|aqui, r, f }, cond: D => bool, max: s, escondite: true }`.
- Las armas se dan con `D.arma('pistola')`: si `WEAPONS.pistola` aún no existe, devuelve `false` y el guion usa la línea alternativa («una caja de balas sin arma»). Los capítulos filtran sus `armas:` por las que existan.

## 5. Atmósfera y mundo (implementado en `js/mundo/atmosfera.js`)

- `W.clima(tipo, intensidad 0..1, transición s = 3)` → `D.clima(...)`. Tipos: `'lluvia'` (rayas instanciadas que siguen a la cabeza, suelo mojado con charcos y ondas, sonido fuera/bajo techo), `'niebla'` (acorta la niebla de altura), `'viento'`, `'despejado'`. El estado persiste entre pasos y capítulos hasta la siguiente llamada.
- `W.pulsoRey({ ola = true, origen = [0, -139], radio = true })` → `D.pulsoRey(...)`. Con `ola`, los ojos rojos de los robots dormidos del pueblo se encienden en cadena desde `origen` (~38 m/s), las farolas exteriores se apagan por sectores y halos y conos bajan al 18 %. Con `radio`, chirrido digital con un pulso grave. Al cambiar de hora o capítulo (`aplicarHora`) se restaura todo.
- Consola: `__clima('lluvia', 1)` · `__pulsoRey({ origen: [0, 40] })`.
- Superficies libres para objetos: `W.superficies = [{ zona, x, y, z, w, d, ry }]` (encimeras, mesas, estantes, carros). La interacción puede colocar props encima.

## 5. Revisión 3 · ganchos del agente de sistemas (todos opcionales, con alternativa)

| Gancho (historia llama) | Dónde se busca | Uso en el guion |
|---|---|---|
| `D.eco(id, { pos, radio, escena })` → `ecos.registrar(id, …)` | `W.ecos` · `G.ecos` · `window.__ecos` | `eco_casco` (cap. 3, vitrina, **obligatorio**), `eco_saqueadores` (cap. 4, puerta de la tienda, opcional), `eco_john` (cap. 6, radio junto a los barracones (131.5, -36.5), opcional) |
| `D.camara(id)` → `camaras.ver(id)` | `W.camaras` · `G.camaras` · `window.__camaras` | cap. 5: abre el visor en la cámara 1 al llegar a la consola |
| `D.npcIA(accion, id, …)` → `npcIA[accion](id, …)` | `W.npcIA` · `G.npcIA` · `window.__npcIA` | `rutina('nico','baloncesto')`, `huir('nico', [-36, 80])` |
| `D.lateral(id, datos)` | `W.lateral` · `G.lateral` · `window.__lateral` | `lateral('baloncesto', { npc: 'nico', pos: [-38, 40] })` (cap. 2) |

| Evento (sistemas emiten) | Datos esperados | Dónde |
|---|---|---|
| `eco_visto` | `{ id: 'eco_casco' \| 'eco_saqueadores' \| 'eco_john' }` | el de la vitrina hace avanzar; los otros dos cuentan como el objeto opcional |
| `camara_vista` | `{ id: 3 }` y luego `{ id: '3-2210' }` (el registro de la cámara 3 rebobinado a las 22:10) | cap. 5, consola de Mike |

Paso `evento` admite ahora `filtro: datos => bool`, `lugar: { a, r, datos, f }` (llegar a un sitio también lo cumple: la rejilla del lab), `eco: {…}` y `alAcabar(D, m, datos)`. Paso `opcional` admite `evento` + `filtro` + `eco`.
Los enemigos se **congelan solos** mientras hay diálogo bloqueante o elección con enemigos vivos (`G.pausaEnemigos` lo gestiona el director cada fotograma; el guion usa `D.congelar(on)`).

## Sistemas de juego (`js/juego/*`)

Un punto de entrada: `js/juego/index.js` → `construirJuego()` (main.js, tras `construirInteraccion`) y `actualizarJuego(dt)` (main.js, justo antes de `renderer.render`). Todo cuelga de `juego` (y de `window.__juego` en consola). Desde la historia, con encadenamiento opcional: `import('../juego/index.js').then(({ juego }) => juego.ecos?.activo('base_john', true))`.

### Eventos que emiten (vía `director.evento`)
| Evento | Datos | Cuándo |
|---|---|---|
| `eco_visto` | `{ id }` | Al terminar de reproducirse un eco |
| `camara_vista` | `{ id: 1..4, grabacion }` | Al cambiar de cámara (o encenderse el monitor) |
| `canasta` | `{ quien: 'jugador'\|'chaval', triple }` | Canasta en el parque |
| `triples_fin` | `{ puntos }` | Fin del minijuego de triples (60 s) |
| `encuentro_gato` | — | El gato salta del coche (te acercas a < 4,5 m) |
| `encuentro_ventana` | — | La superviviente te lanza el botiquín (tras tumbar al robot) |

### APIs
- **Ecos** (`juego.ecos`, `ecos.js`): `registrar(id, { pos:[x,z], radio, duracion, titulo, activo, actores:{ clave:{ nombre, robot, o, color } }, guion:[{ t, actor, accion:'aparecer'|'caminar'|'gesto'|'linea'|'sonido'|'desaparecer', datos }] })` · `activo(id, bool)` · `reproducir(id)` · `parar()` · `cerca()` · `actual` · `lista`. Datos: aparecer `{ pos, yaw }`, caminar `{ a:[x,z], vel }`, gesto `{ tipo:'telefono'|'coger'|'senalar'|'manos'|'correr', dur, objeto:'casco'|'telefono' }`, linea `{ texto }`, sonido `{ sfx }`. Entrada: VR clic del stick izquierdo o las dos manos con grip junto a la cabeza · PC **Q**. De serie: `lab_casco` (vitrina, activo), `calle_familia` (cruce este, activo), `base_john` (hangar, **inactivo**: lo enciende la historia).
- **Cámaras** (`juego.camaras`, `camaras.js`): `ver(id 1..4, grabacion?)` · `grabacion(on)` (cámara 3, robo del casco por R-01 en bucle, holograma solo visible en la cámara, capa 5) · `actual` · `lista`. Monitor derecho de la mesa de Mike + botonera 1·2·3·4·▶ (VR: dedo · PC: E/clic). Render 256×144 a 10 fps solo mientras se mira.
- **Linterna** (`juego.linterna`, `linterna.js`): el jugador empieza con una en el hombro (VR: mano al hombro + grip; gatillo junto al hombro; PC: **L**). `bateria` 0..1 (≈4 min encendida, parpadea < 30 %, recarga apagada o agitándola en VR) · `recargar(v)` · `dar()`.
- **Actividades** (`juego.actividades`, `actividades.js`): `activar('baloncesto'|'gato'|'ventana', on)` · `triples()` · `estado()` · `CANASTA` ([-35, 46.5]). El chaval (`npcIA` id `chaval`) recoge rebotes, pasa o tira; en PC la pelota lanzada mirando al aro se corrige a parábola (ayuda de puntería).
- **IA de PNJ** (`juego.npcIA`, `npcIA.js`): `crear(id, { pos, yaw, aspecto, robot })` · `adoptar(id[, cuerpo])` (sin cuerpo = el PNJ de `npcs.js`; o un ActorGLB) · `rutina(id, puntos, { vel, pausa, gestos, bucle })` · `seguir(id, { dist, vel })` · `huir(id, { radio, oido, refugio })` · `reaccionar(id, on, { radio })` · `ayudar(id, { dano, cadencia, alcance, arma:'pistola'|'piedra', seguir })` · `gesto(id, tipo)` · `parar(id)` · `quitar(id)`.
- **Guía visual** (`juego.guia`, `guia.js`): `resaltar(idPUNTOS|[x,z]|[x,y,z]|V3|Object3D, nivel 'ambar'|'cian'|'rojo'|'cinta'|1|2, o)` → asa · `cinta('lab.trasera' | pos, { ancho, alto, ry })` · `quitar(asa)` · `limpiar()` · `pista({ objetivo, nivel, linea, t1 = 60, t2 = 120, alDecir })` (al empezar un paso: a t1 brillo, a t2 subtítulo de Dave) · `progreso()` (reinicia el reloj). Opción `G.opciones.guiaClasica` (rombo; botón en el panel Comodidad, apagada por defecto).
- **Música** (`juego.musica`, `musica.js`): pads procedurales calma/tensión/combate según robots cercanos y la detección. `forzar(estado|null)` · `zonaSegura(on)` · `volumen(0..1)` · `estado`.

### Variabilidad (`juego.variabilidad`, `variabilidad.js`)
Semilla por partida en `localStorage['apoc2030.variabilidad']` (empezar el prólogo = partida nueva y nueva semilla; reanudar = la misma). Decide: botín extra de cajones/taquillas (vendas, latas, botiquín, coleccionables; munición como mucho 1 por partida), 2-3 sucesos de calle por capítulo nocturno (`c1`, `c2`, `c3`), variantes de ronda de `guardias` y de enemigos con `ruta` (puntos ±1,2 m, sentido, velocidad, pausas), clima ±0,15 alrededor del objetivo del guion (sin lluvia si el guion no la pide), vecinos asomados a ventanas y la colocación de coleccionables.
API: `estado()` · `forzar('superviviente'|'saqueadores'|'perro'|'cocheArdiendo'|'radioCasa'|'robotArrastra'|'bici')` (a 6 m del jugador) · `coger(i)` · `rehacer()` · `run` (`col.foto/nota`, `perro`, `lucia`, `minijuegos`) · `azar(clave)` (generador reproducible).

| Evento | Datos | Cuándo |
|---|---|---|
| `calle_superviviente` | `{ salvado }` | Tumbas al robot que acorrala a un superviviente (o te vas sin ayudar) |
| `calle_saqueadores` | `{ huyeron: true }` | Dos saqueadores que se pelean por un coche huyen al verte o al oír un disparo |
| `perro_alimentado` · `perro_aviso` | — · `{ dist }` | Le acercas una lata a la perra (Trufa): te sigue entre capítulos y ladra si hay un robot a < 14 m |
| `coche_explota` | `{ dist }` | Un coche ardiendo explota a los ~6-11 s de acercarte a < 12 m (chasquidos de aviso) |
| `radio_casa` | — | Te acercas a < 7 m de una radio que suena dentro de una casa |
| `robot_arrastra` | `{ interrumpido }` | Un R-7 arrastra un cuerpo; si te acercas o disparas, lo suelta y ataca |
| `bici_nota` | — | Coges la nota de la bici del crío |
| `coleccionable` | `{ tipo: 'foto'\|'nota', id, titulo, n, total }` | Coges una foto del pueblo (8) o una nota de superviviente (9); contador en la muñeca (VR) / Tab (PC) |
| `vecino_ventana` | `{ dist }` | Miras > 1 s a un vecino asomado y se esconde |

### Minijuegos (`juego.minijuegos`, `minijuegos.js`)
Galería de tiro detrás de la tienda de Hank (campana en (-24,5, -48,8); 6 botellas/latas, 40 s; las balas gastadas se devuelven) · dardos delante de la fachada oeste de la casa (13, 82,6; raya en x ≈ 10,6; dardos físicos) · «la canción de Lucía» en el piano de casa (partitura en el atril y tecla siguiente marcada; la 1.ª vez: `memoria.recordar('dave','cancion_lucia',2,{afecto:.25})`) · HORSE con el chaval (pizarra junto a la canasta; usa la pelota y el marcador de `actividades.js`) · puerta de servicio en la valla oeste de la base (115, -36,5): caja de alarma con 3 cables, el bueno lo dice la nota (nunca el rojo); uno malo abre igual pero salta la sirena (ruido 40 m) · emisoras ocultas en el dial de las radios (2 de 3 por partida: anuncio de Lázaro, entrevista a Mike de 2028, estación de números).
API: `estado()` · `empezarGaleria()` · `empezarHorse()` · `recogerDardos()` · `cortar('rojo'|'azul'|'amarillo')` · `tocar(midi)`.
Ganchos para la historia: comentarios de Hank/Lucía/Nico vía estos eventos (hoy hay líneas propias solo si la historia no está hablando).

| Evento | Datos | Cuándo |
|---|---|---|
| `galeria_inicio` · `galeria_fin` | — · `{ puntos, total: 6, limpio }` | Campana / fin de la ronda (bonus 1 punto cada 5 s sobrantes) |
| `dardos_ronda` · `dardo_diana` | `{ puntos, dardos: ['T20','D5','0'] }` · — | Tras los 3 dardos / diana de 50 |
| `piano_melodia` | `{ cancion: 'lucia', primera }` | Tocas la canción completa |
| `horse_fin` | `{ gana: 'jugador'\|'chaval', letrasJugador, letrasChaval }` | Alguien completa HORSE |
| `valla_cortada` · `valla_alarma` | `{ id: 'base_oeste', alarma }` · `{ id, cable }` | Se abre la puerta de servicio / cable equivocado |
| `radio_oculta` | `{ id: 'lazaro'\|'mike'\|'numeros' }` | Primera vez que sintonizas una emisora oculta |
