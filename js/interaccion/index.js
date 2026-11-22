// Interacción física (estilo Half-Life: Alyx): manos VR y mano de PC, agarre/lanzamiento, resaltado del objeto
// que vas a coger (contorno + mano fantasma), mira y entrada de PC, y un único punto de actualización.
//   VR: grip = coger/soltar (lanzar con la velocidad real de la mano) · gatillo = usar lo que sostienes
//       (linterna, radio…) · la punta del dedo toca teclas y la punta del rotulador escribe.
//   PC: E = coger/soltar · clic = lanzar (o usar si es una herramienta: rotulador, linterna, radio…) ·
//       clic derecho o G = lanzar siempre · F = usar · E sobre puertas/cajones = abrir/cerrar · clic en teclas.
// Ganchos: antesJugador(dt) antes de updateVR/updatePC; actualizarInteraccion(dt, posJugador) después.
import { THREE, V3, G, camera, renderer, scene, capOn } from '../nucleo.js';
import { ui } from '../ui.js';
import { FIS, GR, cuerpoCinematico, moverCinematico, alListo } from './fisica-adaptador.js';
import { interactivos, props, actualizarObjetos, soltarProp, usarProp, ponerManoPC, estadoObjetos, raiz, crearProp, quitarProp } from './objetos.js';
import { actualizarEscritura, superficies, trazoPrueba, limpiarSuperficie } from './escritura.js';
import { actualizarInstrumentos, pianos } from './instrumentos.js';
import { actualizarMuebles, muebles } from './muebles.js';
import { actualizarOyente } from './sonido.js';
import { cristales, ventanas } from './roturas.js';
import { antesSigilo, actualizarSigilo, estadoSigilo, taquillas } from './sigilo.js';
import { agarrarRanura, soltarRanura, guardarEnHombro, guardarLinterna, hombro, actualizarArmas, estadoArmas } from './armas.js';
import { actualizarReloj, reloj } from './reloj.js';
import { construirCoche, actualizarCoche, cabina } from './coche.js';
import { repartir } from './repartir.js';
import { montarMenu, actualizarVineta } from './opciones.js';
import { emitirRuido, escucharRuido, recientes as ruidosRecientes } from './ruido.js';
import { linternaEncendida } from './objetos.js';
export { emitirRuido, escucharRuido, ruidosDesde, RADIOS } from './ruido.js';
export { reloj } from './reloj.js';
export { crearVentana } from './roturas.js';
export { crearTaquilla } from './sigilo.js';
let J = null; import('../jugador.js').then(m => { J = m; }).catch(() => {});
// construir todo lo interactivo del mapa (main.js, después de construirTierra y antes de hornear)
export async function construirInteraccion() {
  try { montarMenu(); } catch (e) { console.warn('[interaccion] menú', e); }
  try { construirCoche(); } catch (e) { console.warn('[interaccion] pickup', e); }
  try { const r = repartir(); console.info('[interaccion] repartido', r); } catch (e) { console.warn('[interaccion] reparto', e); }
}
export { crearProp, quitarProp, props, raiz } from './objetos.js';
export { crearSuperficie } from './escritura.js';
export { crearPiano } from './instrumentos.js';
export { crearPuerta, crearCajon, crearArmario } from './muebles.js';
export { crearCristal } from './roturas.js';

const tA = new V3(), tB = new V3(), tQ = new THREE.Quaternion();
// ---------- Manos ----------
function nuevaMano(id, c) {
  const m = { id, c, pc: !c, pos: new V3(), q: new THREE.Quaternion(), tip: new V3(), vel: new V3(), angVel: new V3(), hist: [], sostiene: null, gripPrev: false, trigPrev: false, usando: false, lanzarDir: new V3(), hover: null, prevQ: new THREE.Quaternion(), body: null,
    // velocidad de lanzamiento: el pico de los últimos 100 ms promediado con sus vecinos (quita el temblor del final)
    velLanzar() { const h = m.hist, n = h.length; if (n < 3) return m.vel.clone(); const vs = []; for (let i = 1; i < n; i++) { const dt = Math.max(1e-3, h[i].t - h[i - 1].t); vs.push({ v: h[i].p.clone().sub(h[i - 1].p).divideScalar(dt), t: h[i].t }); }
      const t0 = h[n - 1].t - .1; let k = vs.length - 1, best = 0; for (let i = vs.length - 1; i >= 0 && vs[i].t >= t0; i--) if (vs[i].v.lengthSq() > best) { best = vs[i].v.lengthSq(); k = i; }
      const out = new V3(); let c = 0; for (let i = Math.max(0, k - 1); i <= Math.min(vs.length - 1, k + 1); i++) { out.add(vs[i].v); c++; } return out.divideScalar(c); } };
  return m;
}
// los mandos (ctrl[] de jugador.js) se enganchan en diferido para no arrastrar toda la cadena del juego
export const manosVR = [];
export const manoPC = nuevaMano('pc', null); ponerManoPC(manoPC);
const todas = [manoPC];
import('../jugador.js').then(j => { j.ctrl.forEach((c, i) => { const m = nuevaMano('vr' + i, c); manosVR.push(m); todas.unshift(m); contornos.unshift(nuevoContorno()); }); alListo(() => { for (const m of manosVR) m.body ||= cuerpoCinematico([{ f: 'bola', r: .035 }], new V3(0, -40, 0), null, GR.mano); }); }).catch(() => {});
let prevCam = null;
function actualizarManos(dt) {
  for (const m of manosVR) {
    const c = m.c; if (!c.src || G.mode !== 'vr') { if (m.sostiene) m.sostiene.agarre.soltar(m, false); continue; }
    c.grip.updateWorldMatrix(true, false); c.grip.getWorldPosition(m.pos); c.grip.getWorldQuaternion(m.q); c.grip.localToWorld(m.tip.set(0, -.02, -.085));
    push(m, dt);
  }
  // PC: punto de sujeción delante de la cámara (más lejos si es pesado o largo)
  const pr = manoPC.sostiene, lejos = pr?.def?.dosManos ? .85 : .55;
  camera.updateWorldMatrix(true, false); camera.localToWorld(manoPC.pos.set(pr?.def?.herramienta ? .2 : .12, pr?.def?.herramienta ? -.2 : -.16, -lejos)); camera.getWorldQuaternion(manoPC.q);
  camera.getWorldDirection(manoPC.lanzarDir).add(tA.set(0, .12, 0)).normalize();
  camera.getWorldPosition(tA); if (prevCam) manoPC.vel.subVectors(tA, prevCam).divideScalar(Math.max(dt, 1e-3)); else prevCam = new V3(); prevCam.copy(tA);
}
function push(m, dt) {
  const p = m.hist[m.hist.length - 1]; if (p) m.vel.subVectors(m.pos, p.p).divideScalar(Math.max(dt, 1e-3));
  tQ.copy(m.q).multiply(m.prevQ.clone().invert()); const s = Math.sqrt(Math.max(0, 1 - tQ.w * tQ.w)), ang = 2 * Math.acos(Math.min(1, Math.abs(tQ.w))) * Math.sign(tQ.w || 1);
  if (s > 1e-4) m.angVel.set(tQ.x, tQ.y, tQ.z).multiplyScalar(ang / s / Math.max(dt, 1e-3)); else m.angVel.set(0, 0, 0); m.prevQ.copy(m.q);
  m.hist.push({ p: m.pos.clone(), t: G.time }); if (m.hist.length > 12) m.hist.shift();
}
// mejor candidato para agarrar con la mano VR (distancia a la caja del objeto / al tirador)
function candidato(m, umbral = .06) {
  let best = null, bd = umbral;
  for (const o of interactivos) { if (!o.agarre || (o.activo && !o.activo())) continue; if (o.root) { if (o.root.getWorldPosition(tA).distanceToSquared(m.pos) > 2.5) continue; } else if (o.centro && o.centro(tA).distanceToSquared(m.pos) > 2.5) continue;
    const d = o.agarre.dist(m.pos); if (d < bd) { bd = d; best = o; } }
  return best;
}
// ---------- Resaltado: contorno del objeto + mano fantasma (VR) ----------
const matContorno = new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: .3, side: THREE.BackSide, depthWrite: false, toneMapped: false });
function nuevoContorno() { const o = new THREE.Mesh(new THREE.BufferGeometry(), matContorno); o.visible = false; o.renderOrder = 5; return o; }
const contornos = [nuevoContorno()];
const fantasma = new THREE.Mesh(new THREE.BoxGeometry(.075, .09, .11), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: .22, depthWrite: false, toneMapped: false })); fantasma.visible = false; scene.add(fantasma);
function resaltar(i, obj) {
  const o = contornos[i], malla = obj && obj.mallas?.find(x => !x.isInstancedMesh);
  if (!malla) { o.visible = false; o.removeFromParent(); return; }
  if (o.parent !== malla) { malla.add(o); o.geometry = malla.geometry; if (!malla.geometry.boundingBox) malla.geometry.computeBoundingBox(); const k = 1 + Math.min(.12, .012 / Math.max(.02, malla.geometry.boundingSphere?.radius || .1) + .04); o.scale.setScalar(k); malla.geometry.boundingBox.getCenter(o.position).multiplyScalar(1 - k); }
  o.visible = true;
}
// codo: la mano va por detrás del plano del pecho y se mueve hacia atrás (no hay seguimiento de codo real)
function esCodo(m) { camera.getWorldPosition(tA); camera.getWorldDirection(tB); tB.y = 0; tB.normalize(); return tA.subVectors(m.pos, tA).dot(tB) < .08 && m.vel.dot(tB) < -1.2; }
// ---------- Mira de PC ----------
const ray = new THREE.Raycaster(), centro = new THREE.Vector2(0, 0);
export function rayoPC(mallas, far = 4) { ray.setFromCamera(centro, camera); ray.far = far; return ray.intersectObjects(mallas, false)[0] || null; }
let apuntado = null, mallasCerca = [];
function apuntar() {
  if (G.mode !== 'pc') { apuntado = null; return; }
  camera.getWorldPosition(tA); mallasCerca.length = 0;
  for (const o of interactivos) { if (o.activo && !o.activo()) continue; const c = o.root ? o.root.getWorldPosition(tB) : o.centro ? o.centro(tB) : o.mallas?.[0]?.getWorldPosition(tB); if (c && c.distanceToSquared(tA) > 16) continue; for (const m of o.mallas || []) if (m.visible) mallasCerca.push(m); }
  const h = rayoPC(mallasCerca, 2.4); apuntado = h && h.object.userData.inter !== manoPC.sostiene ? h : null;
}
// ---------- Entrada de PC (se registra antes que la de jugador.js y la intercepta cuando la usa) ----------
let clicActivo = null, miPista = '';
const puedePC = () => G.playing && G.mode === 'pc' && !G.enDialogo;
function lanzarPC() { const pr = manoPC.sostiene; if (!pr) return false; pr.agarre.soltar(manoPC, true); return true; }
function usarPC(on) { const pr = manoPC.sostiene; if (!pr?.def) return false; if (pr.def.escribe || pr.def.borra) { manoPC.usando = on; return true; } if (pr.def.usar) { usarProp(pr, on, manoPC); return true; } return false; }
export function entradaPC(el = renderer.domElement) {
  el.addEventListener('mousedown', e => {
    if (!puedePC()) return;
    if (e.button === 0) {
      if (manoPC.sostiene) { if (!usarPC(true)) lanzarPC(); e.stopImmediatePropagation(); return; }
      const o = apuntado?.object.userData.inter; if (o?.clic && o.clic(true, apuntado)) { clicActivo = o; e.stopImmediatePropagation(); }
    } else if (e.button === 2 && manoPC.sostiene) { lanzarPC(); e.stopImmediatePropagation(); }
  });
  el.addEventListener('contextmenu', e => { if (G.playing) e.preventDefault(); });
  addEventListener('mouseup', e => { if (e.button !== 0) return; if (manoPC.usando || manoPC.sostiene?.def?.usar === 'linterna') usarPC(false); manoPC.usando = false; if (clicActivo) { clicActivo.clic(false); clicActivo = null; } });
  addEventListener('keydown', e => {
    if (!puedePC() || e.repeat) return;
    if (e.code === 'KeyE') { if (manoPC.sostiene) { manoPC.sostiene.agarre.soltar(manoPC, false); e.stopImmediatePropagation(); return; } const o = apuntado?.object.userData.inter; if (o && (o.pulsarE ? o.pulsarE(apuntado) : o.agarre?.agarrar(manoPC))) e.stopImmediatePropagation(); }
    else if (e.code === 'KeyG' && lanzarPC()) e.stopImmediatePropagation();
    else if (e.code === 'KeyF') { // F: golpear un cristal (puño = corte; con algo en la mano o un arma, no) · quitar un trozo · usar lo que sostienes
      const o = apuntado?.object.userData.inter;
      if (o?.ventana && !o.roto && apuntado.distance < 1.8) { const d = new V3(); camera.getWorldDirection(d); o.romper(apuntado.point.clone(), d, { corte: !manoPC.sostiene && (!J || J.P.w === 'punos'), mano: 'right' }); e.stopImmediatePropagation(); }
      else if (o?.label === 'trozo de cristal') { o.pulsarE(); e.stopImmediatePropagation(); }
      else if (manoPC.sostiene?.def?.usar) { usarProp(manoPC.sostiene, true, manoPC); e.stopImmediatePropagation(); } }
    else if (e.code === 'KeyL') { // L: linterna del hombro (engancharla si la llevas en la mano, o encender/apagar)
      const pr = manoPC.sostiene; if (pr?.tipo === 'linterna') { pr.agarre.soltar(manoPC, false); guardarLinterna(pr); if (linternaEncendida() !== pr) usarProp(pr, true, manoPC); }
      else if (hombro.prop) usarProp(hombro.prop, true, manoPC); }
  });
}
// ---------- Cuerpo del jugador y manos en la física (empujan objetos al andar y al tocarlos) ----------
let cuerpoJ = null;
alListo(() => { cuerpoJ = cuerpoCinematico([{ f: 'capsula', r: .26, h: .9, c: [0, .78, 0] }], new V3(0, -40, 0), null, GR.jugador); for (const m of manosVR) m.body = cuerpoCinematico([{ f: 'bola', r: .035 }], new V3(0, -40, 0), null, GR.mano); });
const lejos = new V3(0, -40, 0);

// ---------- Ganchos del bucle ----------
// antes de updateVR/updatePC: grip y gatillo de los mandos (así jugador.js ya ve c.prop y no agarra usables con esa mano)
export function antesJugador(dt) {
  if (!capOn.tierra && !G.banco) return;
  antesSigilo(dt);
  actualizarManos(dt);
  if (G.mode !== 'vr') return;
  for (const m of manosVR) {
    const gp = m.c.src?.gamepad; if (!gp) continue;
    const grip = !!gp.buttons[1]?.pressed, trig = (gp.buttons[0]?.value || 0) > .6;
    if (grip && !m.gripPrev && !m.sostiene && !m.cargador && !agarrarRanura(m)) { const o = candidato(m); if (o) o.agarre.agarrar(m); }
    if (!grip && m.gripPrev && !soltarRanura(m) && m.sostiene) { if (!guardarEnHombro(m, m.sostiene)) m.sostiene.agarre.soltar(m, true); }
    if (m.sostiene?.def?.usar && trig !== m.trigPrev) usarProp(m.sostiene, trig, m);
    m.gripPrev = grip; m.trigPrev = trig;
  }
}
// después de mover al jugador: física de objetos, muebles, escritura, piano, resaltado y pista de PC
// o: { cuerpoJugador (false en el coche/sentado) }
export function actualizarInteraccion(dt, jugador, o = {}) {
  const on = capOn.tierra || G.banco; raiz.visible = on; if (!on) return;
  actualizarOyente();
  for (const m of todas) if (m.sostiene && m.sostiene.agarre) m.sostiene.agarre.seguir(m, dt);
  actualizarObjetos(dt, jugador);
  actualizarMuebles(dt);
  apuntar();
  actualizarEscritura(dt, todas.filter(m => m.sostiene), rayoPC);
  const dedos = [];
  if (G.mode === 'vr') for (const m of manosVR) if (m.c.src && !m.sostiene) dedos.push({ clave: m.id, p: m.tip, c: m.c });
  actualizarInstrumentos(dt, dedos);
  actualizarCoche(dt, G.mode === 'vr' ? manosVR.filter(m => m.c.src && !m.sostiene).map(m => ({ clave: m.id, p: m.tip, c: m.c })) : []);
  actualizarSigilo(dt, jugador, todas); G.sigilo.linterna = !!linternaEncendida();
  actualizarArmas(dt, manosVR); actualizarReloj(dt); actualizarVineta(dt);
  // física: cápsula del jugador y bolas de las manos (cinemáticas)
  if (cuerpoJ) { // un salto grande (teletransporte, cambio de capítulo) se coloca sin barrer: si no, la cápsula arrasa lo que hay en medio
    const dst = o.cuerpoJugador === false ? lejos : jugador, t = cuerpoJ.translation();
    if (Math.hypot(t.x - dst.x, t.y - dst.y, t.z - dst.z) > 1) cuerpoJ.setTranslation({ x: dst.x, y: dst.y, z: dst.z }, true); else moverCinematico(cuerpoJ, dst); }
  for (const m of manosVR) if (m.body) moverCinematico(m.body, G.mode === 'vr' && m.c.src && !m.sostiene && (m.c.src.gamepad?.buttons[1]?.value || 0) < .2 ? m.tip : lejos);
  // puños contra cristales
  // puño desnudo = corte; codo (mano por detrás del pecho yendo hacia atrás), arma o algo en la mano = sin corte
  if (G.mode === 'vr') for (const m of manosVR) if (m.c.src && m.vel.length() > 2.6) for (const c of cristales) if (c.toca(m.tip, .05)) c.romper(m.tip.clone(), m.vel.clone(), { corte: !m.sostiene && !m.cargador && !esCodo(m) && !(m.c.hand !== 'left' && J && J.P.w !== 'punos'), mano: m.c.hand });
  // resaltado
  manosVR.forEach((m, i) => { const c = G.mode === 'vr' && m.c.src && !m.sostiene ? candidato(m, .1) : null; resaltar(i, c); if (i === 0 || !fantasma.userData.on) { fantasma.visible = !!c; if (c) { (c.centro ? c.centro(tA) : tA.copy(c.root.position)); fantasma.position.lerpVectors(m.pos, tA, .55); fantasma.quaternion.copy(m.q); } fantasma.userData.on = !!c; } });
  fantasma.userData.on = false;
  const ap = apuntado?.object.userData.inter; resaltar(todas.length - 1, !manoPC.sostiene && ap?.agarre ? ap : null);
  if (G.mode === 'pc' && G.playing && !G.enDialogo) {
    const el = document.getElementById('hint'), pr = manoPC.sostiene;
    let t = '';
    if (pr) t = (pr.def?.escribe ? 'Mantén clic sobre la pizarra · E soltar · G lanzar' : pr.def?.borra ? 'Mantén clic para borrar · E soltar · G lanzar' : pr.def?.usar ? 'Clic · usar · G lanzar · E soltar' : pr.def ? 'Clic · lanzar · E soltar' : '');
    else if (ap && el && (!el.textContent || el.textContent === miPista)) t = (ap.ventana ? 'F · romper el cristal (con el puño te cortas)' : ap.label === 'trozo de cristal' ? 'F · quitar el trozo' : ap.clic && !ap.agarre && !ap.pulsarE ? 'Clic · tocar ' + ap.label : ap.pulsarE && !ap.def ? 'E · abrir / cerrar ' + ap.label : ap.agarre ? 'E · coger ' + ap.label : '');
    // solo pisamos la pista si está vacía o es nuestra (la de jugador.js manda: usables y coche)
    if (t) { ui.hint(t); miPista = t; } else if (el && miPista && el.textContent === miPista) { ui.hint(''); miPista = ''; }
  }
}
// ---------- Depuración: window.__inter ----------
export function estado() { return { sigilo: estadoSigilo(), ruidos: ruidosRecientes.length, ...estadoObjetos(), muebles: muebles.length, superficies: superficies.length, pianos: pianos.length, cristales: cristales.filter(c => !c.roto).length, fisica: FIS.listo, sostiene: manoPC.sostiene?.label || null, apuntado: apuntado?.object.userData.inter?.label || null, llamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles }; }
export const depuracion = {
  estado, props, muebles, superficies, pianos, cristales, ventanas, taquillas, manoPC, manosVR, reloj, cabina, armas: estadoArmas, ruidos: ruidosRecientes, emitirRuido,
  coger(i) { const pr = typeof i === 'number' ? props[i] : props.find(p => p.tipo === i && p.activo() && p.estado !== 'sostenido'); if (!pr) return false; if (manoPC.sostiene) manoPC.sostiene.agarre.soltar(manoPC, false); actualizarManos(1 / 60); return pr.agarre.agarrar(manoPC); },
  soltar() { if (!manoPC.sostiene) return false; manoPC.sostiene.agarre.soltar(manoPC, false); return true; },
  lanzar() { return lanzarPC(); },
  usar(on = true) { return usarPC(on); },
  // pulsa E/clic sobre lo que hay en la mira
  e() { const o = apuntado?.object.userData.inter; return !!(o && (o.pulsarE ? o.pulsarE(apuntado) : o.agarre?.agarrar(manoPC))); },
  clic(down = true) { const o = apuntado?.object.userData.inter; return !!o?.clic?.(down, apuntado); },
  disparar(dmg = 17) { const h = rayoPC([...props.flatMap(p => p.root.visible && p.estado !== 'roto' ? p.mallas : []), ...cristales.filter(c => !c.roto).map(c => c.mesh), ...mallasCerca], 60); if (!h) return null; const u = h.object.userData; const d = new V3(); camera.getWorldDirection(d); (u.prop || u.inter)?.golpe?.(h.point, d, dmg, 'bala'); return u.inter?.label || u.prop?.label; },
  trazo(id, pts, tipo = 'rotulador') { const herr = props.find(p => p.tipo === tipo) || { def: { escribe: { ancho: 4, alfa: 1 } }, color: 0x111111 }; return trazoPrueba(id, pts, herr); },
  limpiar: limpiarSuperficie,
  tecla(midi, ms = 400) { const pi = pianos[0]; const t = pi?.teclas.find(k => k.midi === midi); if (!t) return false; pi.pulsar(t, .8); setTimeout(() => pi.soltar(t), ms); return true; },
  apuntado: () => apuntado
};
if (typeof window !== 'undefined') window.__inter = depuracion;
