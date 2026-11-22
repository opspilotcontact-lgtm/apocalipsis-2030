// Heridas del JUGADOR (docs/diseno-vr.md §3.12): brazo/pierna rotos, sangrado, aturdido; y su cura física.
// La interacción (venda, férula, jeringa) es de js/interaccion: aquí está el ESTADO y la API:
//   lesionar(d, zona, tipo)        ← la llama hurtPlayer
//   curarZona(zona, tipo)          → true si había algo que curar ahí (tipo: 'venda' | 'ferula' | 'jeringa')
//   zonaParaCurar(pos, tipo, r)    → la zona herida más cercana a un punto (para aplicar el objeto donde toca)
//   posZona(zona, out)             → dónde está esa parte del cuerpo del jugador en el mundo
//   L (estado)  ·  factorPiernas() · puedeCorrer() · fuerzaMano('left'|'right') · temblorMano('left'|'right')
// Regla de confort: nada de esto mueve la cámara en VR; solo color, audio, háptico y las manos.
import { V3, G, rnd, camera, dolly } from '../nucleo.js';
import { sfx, hurt } from '../fx.js';
import { salpicar } from './particulas.js';

export const ZONAS_JUGADOR = ['brazoI', 'brazoD', 'piernaI', 'piernaD', 'torso'];
const nueva = () => ({ roto: false, entablillado: false, sangra: 0, golpes: 0 });
export const L = { brazoI: nueva(), brazoD: nueva(), piernaI: nueva(), piernaD: nueva(), torso: nueva(), aturdido: 0, curaPendiente: 0 };
let J = null; // { P, ctrl, buzz, morir } lo registra jugador.js
export function registrarJugador(o) { J = o; o.P.lesion = L; }
export function reiniciarLesiones() { for (const z of ZONAS_JUGADOR) Object.assign(L[z], nueva()); L.aturdido = 0; L.curaPendiente = 0; }

// zona de hurtPlayer ('torso','cabeza','brazo','brazoI','brazoD','pierna','piernaI','piernaD') → zona de lesión
function normalizar(z) {
  if (z === 'brazo') return Math.random() < .5 ? 'brazoI' : 'brazoD';
  if (z === 'pierna') return Math.random() < .5 ? 'piernaI' : 'piernaD';
  return z;
}
const mano = z => z === 'brazoI' ? 'left' : 'right';
// tipo: 'contundente' (puñetazo de robot, caída) · 'bala' | 'corte' | 'escopeta' (sangran) · 'caida'
export function lesionar(d, zona = 'torso', tipo = 'contundente') {
  const z = normalizar(zona);
  if (z === 'cabeza') { if (d >= 8) { L.aturdido = Math.max(L.aturdido, 2); hurt.a = 1; } if (tipo !== 'contundente') L.torso.sangra = Math.min(3, L.torso.sangra + 1); return z; }
  const Z = L[z]; if (!Z) return z;
  if (tipo === 'bala' || tipo === 'corte' || tipo === 'escopeta') Z.sangra = Math.min(3, Z.sangra + 1);
  if ((tipo === 'contundente' || tipo === 'caida') && z !== 'torso') {
    Z.golpes += d;
    if (!Z.roto && (Z.golpes >= 28 || d >= 22 || tipo === 'caida' && d >= 15)) {
      Z.roto = true; Z.entablillado = false; sfx('hueso'); sfx('hurt');
      for (const c of J?.ctrl || []) if (z.startsWith('brazo') ? c.hand === mano(z) : true) J.buzz(c, 1, 400);
    }
  }
  return z;
}
// ---------- Efectos ----------
export const piernaRota = () => (L.piernaI.roto && !L.piernaI.entablillado) || (L.piernaD.roto && !L.piernaD.entablillado);
export const factorPiernas = () => piernaRota() ? .55 : (L.piernaI.roto || L.piernaD.roto) ? .8 : 1; // entablillada: cojea menos
export const puedeCorrer = () => !L.piernaI.roto && !L.piernaD.roto;
export const brazoRoto = h => { const Z = L[h === 'left' ? 'brazoI' : 'brazoD']; return Z.roto && !Z.entablillado; };
export const fuerzaMano = h => brazoRoto(h) ? .35 : L[h === 'left' ? 'brazoI' : 'brazoD'].roto ? .7 : 1;
export const temblorMano = h => brazoRoto(h) ? 1 : L[h === 'left' ? 'brazoI' : 'brazoD'].roto ? .35 : 0;
export const sangrado = () => ZONAS_JUGADOR.reduce((n, z) => n + L[z].sangra, 0);

// posición de cada zona del cuerpo del jugador (VR: las manos son los mandos; PC: aproximado desde la cámara)
const _c = new V3(), _f = new V3(), _r = new V3();
export function posZona(z, out = new V3()) {
  camera.getWorldPosition(_c); camera.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); _r.set(-_f.z, 0, _f.x); // derecha
  const suelo = dolly.getWorldPosition(out).y;
  if (z === 'brazoI' || z === 'brazoD') {
    const c = J?.ctrl?.find(k => k.src && k.hand === mano(z));
    if (G.mode === 'vr' && c) return c.grip.localToWorld(out.set(0, 0, .12)); // antebrazo: un poco detrás de la mano
    return out.copy(_c).addScaledVector(_r, z === 'brazoD' ? .22 : -.22).setY(_c.y - .45);
  }
  if (z === 'piernaI' || z === 'piernaD') return out.copy(_c).addScaledVector(_r, z === 'piernaD' ? .12 : -.12).addScaledVector(_f, .05).setY(suelo + .5);
  return out.copy(_c).addScaledVector(_f, .1).setY(_c.y - .4); // torso / costado
}
// la zona herida (que admita esa cura) más cercana a un punto, o null
export function zonaParaCurar(pos, tipo, r = .3) {
  let mejor = null, md = r;
  for (const z of ZONAS_JUGADOR) {
    const Z = L[z], sirve = tipo === 'venda' ? Z.sangra > 0 : tipo === 'ferula' ? Z.roto && !Z.entablillado : tipo === 'jeringa' ? z !== 'torso' : false;
    if (!sirve) continue; const d = posZona(z, _r.clone()).distanceTo(pos); if (d < md) { md = d; mejor = z; }
  }
  return mejor;
}
// aplica una cura en una zona · venda: corta el sangrado · férula: inmoviliza el hueso roto · jeringa: +40 en 3 s
export function curarZona(zona, tipo) {
  const z = normalizar(zona), Z = L[z];
  if (tipo === 'jeringa') { if (!J || J.P.hp >= 100 && !L.aturdido) return false; L.curaPendiente += 40; L.aturdido = 0; sfx('pickup'); return true; }
  if (!Z) return false;
  if (tipo === 'venda' && Z.sangra > 0) { Z.sangra = 0; sfx('pickup'); return true; }
  if (tipo === 'ferula' && Z.roto && !Z.entablillado) { Z.entablillado = true; Z.sangra = 0; sfx('pickup'); return true; }
  return false;
}
// ---------- Cada fotograma (lo llama jugador.js) ----------
let gotaT = 0;
export function actualizarLesiones(dt) {
  if (!J) return; const P = J.P;
  if (L.curaPendiente > 0 && P.dead <= 0) { const k = Math.min(L.curaPendiente, dt * 40 / 3); L.curaPendiente -= k; P.hp = Math.min(100, P.hp + k); }
  if (L.aturdido > 0) L.aturdido = Math.max(0, L.aturdido - dt);
  const s = sangrado(); if (s <= 0 || P.dead > 0 || P.inmune) return;
  P.hp -= s * .5 * dt; P.lastHurt = Math.max(P.lastHurt, G.time - 3.5); // sangrando no se regenera
  gotaT -= dt; if (gotaT <= 0) { gotaT = rnd(.25, .6) / s; const zs = ZONAS_JUGADOR.filter(z => L[z].sangra > 0), z = zs[Math.floor(Math.random() * zs.length)]; salpicar(posZona(z, _r), 1, 'sangre', null, .2); }
  if (P.hp <= 0) J.morir?.(); // desangrado
}
