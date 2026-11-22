// Sistemas de juego (docs/eventos.md · «Sistemas de juego»): ecos del pasado, cámaras de seguridad, linterna,
// actividades secundarias, IA de PNJ, guía visual y música adaptativa. Un punto de construcción y uno de actualización.
// La historia los usa con encadenamiento opcional: import('../juego/index.js').then(j => j.juego.ecos?.activo('base_john', true))
// o desde la consola: __juego.ecos.reproducir('lab_casco').
import { G } from '../nucleo.js';
import { ecos, actualizarEcos } from './ecos.js';
import { camaras, actualizarCamaras } from './camaras.js';
import { linterna, actualizarLinterna } from './linterna.js';
import { actividades, construirActividades, actualizarActividades } from './actividades.js';
import { npcIA, actualizarNpcIA } from './npcIA.js';
import { guia, actualizarGuia, montarOpcion } from './guia.js';
import { musica, actualizarMusica } from './musica.js';
import { avatar, actualizarAvatar } from './avatar.js';
import { variabilidad, construirVariabilidad, actualizarVariabilidad } from './variabilidad.js';
import { minijuegos, construirMinijuegos, actualizarMinijuegos } from './minijuegos.js';

export const juego = { ecos, camaras, linterna, actividades, npcIA, guia, musica, avatar, variabilidad, minijuegos };
const paso = (n, f) => { try { f(); } catch (e) { if (!paso[n]) { paso[n] = 1; console.warn('[juego] ' + n, e); } } };
// main.js: después de construirInteraccion (el panel de Comodidad ya existe) y antes de hornear
export function construirJuego() {
  paso('actividades', construirActividades);
  paso('linterna', () => linterna.dar());
  paso('opcion', montarOpcion);
  paso('variabilidad', construirVariabilidad); // semilla, botín, coleccionables
  paso('minijuegos', construirMinijuegos);     // antes de hornear: la puerta de la valla parte el tramo fijo
}
// main.js: una vez por fotograma, justo antes de renderizar
export function actualizarJuego(dt) {
  const activo = G.mode === 'vr' || G.playing;
  paso('musica', () => actualizarMusica(dt));
  if (!activo) return;
  paso('npcIA', () => actualizarNpcIA(dt));
  paso('avatar', () => actualizarAvatar(dt)); // antes de las cámaras: el cuerpo de Dave sale en ellas
  paso('ecos', () => actualizarEcos(dt));
  paso('camaras', () => actualizarCamaras(dt));
  paso('linterna', () => actualizarLinterna(dt));
  paso('actividades', () => actualizarActividades(dt));
  paso('guia', () => actualizarGuia(dt));
  paso('variabilidad', () => actualizarVariabilidad(dt));
  paso('minijuegos', () => actualizarMinijuegos(dt));
}
if (typeof window !== 'undefined') window.__juego = juego;
