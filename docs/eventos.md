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
