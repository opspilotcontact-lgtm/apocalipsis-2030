// Eventos de ruido (sigilo): cualquier sistema emite un ruido con posición, radio y tipo; el oído de los robots
// (sistema de combate) se suscribe con escucharRuido(fn) o consulta ruidosDesde(t).
// Radios de docs/diseno-vr.md §3.8. Módulo sin dependencias del juego (lo importa jugador.js sin ciclos).
import { G } from '../nucleo.js';

export const RADIOS = {
  andar: 3, agachado: 1, correr: 9, tumbado: .5, cristalPisado: 4, respiracion: 2.5, bocanada: 3, tos: 8,
  lata: 6, botella: 12, caja: 8, objeto: 5, cristal: 15, disparo: 45, chirrido: 5, portazo: 12, cajon: 4, palanca: 6, claxon: 35, motor: 20
};
const oyentes = new Set();
export const recientes = []; // los últimos 32 eventos (depuración y consulta)
// fn(ev) con ev = { pos: {x,y,z}, radio, tipo, fuente, t }
export function escucharRuido(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
export function ruidosDesde(t) { return recientes.filter(e => e.t > t); }
// emitirRuido(pos, radio, tipo) o emitirRuido(pos, 'tipo') con el radio de la tabla
export function emitirRuido(pos, radio, tipo = 'ruido', fuente = 'jugador') {
  if (typeof radio === 'string') { tipo = radio; radio = RADIOS[tipo] ?? 5; }
  // agachado, conteniendo la respiración o escondido, lo que hace el propio cuerpo del jugador suena menos
  if (fuente === 'jugador' && G.sigilo) radio *= G.sigilo.ruidoMult ?? 1;
  if (!(radio > .05)) return null;
  const ev = { pos: { x: pos.x, y: pos.y, z: pos.z }, radio, tipo, fuente, t: G.time };
  recientes.push(ev); if (recientes.length > 32) recientes.shift();
  for (const f of oyentes) { try { f(ev); } catch (e) { console.warn('[ruido] oyente', e); } }
  return ev;
}
if (typeof window !== 'undefined') window.__ruidos = recientes;
// Eventos para la historia (docs/eventos.md): director.evento(nombre, datos), cargado en diferido (sin ciclos)
let dir = null; const cola = [];
import('../historia/director.js').then(m => { dir = m.director; for (const [n, d] of cola.splice(0)) dir.evento?.(n, d); }).catch(() => {});
export function eventoHistoria(nombre, datos) { if (dir) { try { dir.evento?.(nombre, datos); } catch (e) { console.warn('[evento]', nombre, e); } } else cola.push([nombre, datos]); }
