// El cuerpo como inventario (docs/diseno-vr.md §3.1-3.3), solo VR; PC sigue con 1-4 / rueda / R.
//   Torso estimado desde la cabeza: 50 cm por debajo, yaw suavizado (solo sigue si giras > 35° o caminas).
//   Ranuras: espalda (X-56D) · cadera (pistola) · pecho (cuchillo) · chaleco ×2 (cargadores) · hombro (linterna).
//   Mano dominante (derecha) a la ranura + grip = sacar el arma; grip con el arma en su ranura = guardarla.
//   Recarga física: A suelta el cargador · mano izq. al chaleco + grip = cargador nuevo · acercarlo al pozo (6 cm,
//   15 cm en «asistida») = entra con clic · si el cerrojo quedó atrás, agarrar la palanca y tirar hacia atrás.
//   LEDs del cargador = balas. Dos manos: mano izq. en el guardamanos + grip = el arma apunta de mano a mano.
import { THREE, V3, G, clamp, scene, camera, dolly, cv2d, toTex } from '../nucleo.js';
import { buzz } from '../fx.js';
import { escombro } from '../combate/fisica.js';
import { mecanico } from './sonido.js';
import { emitirRuido, eventoHistoria } from './ruido.js';
import { usarProp, linternaEncendida, quitarCuerpo } from './objetos.js';

let Vh = null; import('../vehiculos.js').then(m => { Vh = m; }).catch(() => {});
let J = null; const listoJ = import('../jugador.js').then(m => { J = m; preparar(); }).catch(() => {});
const tA = new V3(), tB = new V3(), tC = new V3(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4();

// ---------- Torso ----------
export const torso = new THREE.Group(); torso.name = 'torso'; scene.add(torso);
let yawT = 0, ini = false; const prevD = new V3();
const RANURAS = {
  espalda: { p: new V3(.14, .26, .15), arma: 'x56d', r: .2 },
  cadera: { p: new V3(.27, -.42, -.02), arma: 'pistola', r: .17 },
  pecho: { p: new V3(-.12, .02, -.17), arma: 'cuchillo', r: .15 },
  chaleco1: { p: new V3(-.1, -.26, -.18), r: .13, cargador: true },
  chaleco2: { p: new V3(.08, -.26, -.18), r: .13, cargador: true },
  hombro: { p: new V3(-.2, .2, -.06), r: .13, linterna: true }
};
const posRanura = (k, o) => torso.localToWorld(o.copy(RANURAS[k].p));
function actualizarTorso(dt) {
  camera.getWorldPosition(tA); camera.getWorldDirection(tB);
  const yawH = Math.atan2(-tB.x, -tB.z), d = Math.atan2(Math.sin(yawH - yawT), Math.cos(yawH - yawT));
  dolly.getWorldPosition(tC); const anda = ini && tC.distanceTo(prevD) / Math.max(dt, 1e-3) > .5; prevD.copy(tC);
  if (!ini) { yawT = yawH; ini = true; } else if (Math.abs(d) > .61 || anda) yawT += d * Math.min(1, dt * (anda ? 6 : 3));
  const sentado = G.opciones.sentado ? .1 : 0; // sentado: ranuras más bajas y adelantadas
  torso.position.set(tA.x, tA.y - .5 - sentado, tA.z); torso.rotation.set(0, yawT, 0); torso.translateZ(.04 - sentado * .8);
  torso.updateMatrixWorld(true);
}

// ---------- Fundas visibles (copias de las armas, solo en VR) ----------
const fundas = {}; let ledM = {}, cargVis = [];
function preparar() {
  const { WOBJ } = J;
  const poner = (id, k, rot, off = [0, 0, 0]) => { if (!WOBJ[id]) return; const g = J.clonarArma ? J.clonarArma(id, { sombra: false }) : WOBJ[id].g.clone(); g.traverse(o => { if (o.isMesh) o.castShadow = false; }); g.rotation.set(...rot); g.position.copy(RANURAS[k].p).add(new V3(...off)); g.visible = false; torso.add(g); fundas[id] = g; };
  poner('x56d', 'espalda', [-Math.PI / 2 + .25, 0, .55], [-.05, -.12, .03]);
  poner('pistola', 'cadera', [Math.PI / 2, 0, 0], [0, .05, 0]);
  poner('cuchillo', 'pecho', [Math.PI / 2, 0, .7]);
  // cargadores del chaleco
  const mc = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: .6 }), bolsa = new THREE.MeshStandardMaterial({ color: 0x3a4030, roughness: .9 });
  for (const k of ['chaleco1', 'chaleco2']) { const b = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .04), bolsa); b.position.copy(RANURAS[k].p); torso.add(b); const c = new THREE.Mesh(new THREE.BoxGeometry(.03, .05, .05), mc); c.position.set(0, .07, 0); b.add(c); b.visible = false; cargVis.push(b); }
  // LEDs del cargador puesto (lienzo pequeño pegado al cargador de cada arma de fuego)
  for (const id of ['x56d', 'pistola']) { const car = WOBJ[id]?.g.userData.cargador; if (!car) continue; const [c, x] = cv2d(16, 64), t = toTex(c, false); const p = new THREE.Mesh(new THREE.PlaneGeometry(.01, .045), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); p.position.set(.0165, 0, 0); p.rotation.y = Math.PI / 2; car.add(p); ledM[id] = { c, x, t, n: -1 }; }
  J.P.accionArma = accionArma; J.P.ajusteArma = ajusteArma;
}
function pintarLED(id, n, max) { const L = ledM[id]; if (!L || L.n === n) return; L.n = n; const x = L.x, seg = 6, k = Math.ceil(n / max * seg); x.fillStyle = '#050505'; x.fillRect(0, 0, 16, 64); for (let i = 0; i < seg; i++) { x.fillStyle = i < k ? (k <= 2 ? '#ff4030' : '#39ff7a') : '#1a1a1a'; x.fillRect(3, 60 - (i + 1) * 10 + 2, 10, 7); } L.t.needsUpdate = true; }

// ---------- Estado de recarga por arma ----------
const R = { x56d: { dentro: true, cerrojoAtras: false, pend: 0, prev: 30 }, pistola: { dentro: true, cerrojoAtras: false, pend: 0, prev: 12 } };
const esFuego = id => !!R[id];
const fisica = () => G.mode === 'vr' && G.opciones.recarga !== 'automatica';
const cargadorArma = id => J.WOBJ[id]?.g.userData.cargador;
// A (mano del arma): soltar el cargador
function accionArma() {
  if (!J || !fisica()) return false; const id = J.P.w; if (!esFuego(id)) return false; const r = R[id];
  if (!r.dentro) return true;
  const car = cargadorArma(id); r.dentro = false; car.visible = false; J.P.ammo[id] = 0;
  const caida = mallaCargador(id); car.getWorldPosition(caida.position); car.getWorldQuaternion(caida.quaternion); scene.add(caida);
  escombro(caida, new V3(0, -1.2, 0), { vida: 8, densidad: 1.5, giro: 3 }); mecanico('cargadorFuera', caida.position); buzz(J.rightC(), .4, 40);
  return true;
}
// ---------- Dos manos ----------
const dos = { mano: null };
const _l = new V3(), _r = new V3(), _up = new V3(), _m = new THREE.Matrix4();
function ajusteArma(o) {
  if (!dos.mano || !dos.mano.c?.src) return;
  dolly.worldToLocal(_l.copy(dos.mano.pos)); _r.copy(o.position);
  if (_l.distanceTo(_r) < .08) return;
  _up.set(0, 1, 0).applyQuaternion(o.quaternion);
  _m.lookAt(_r, _l, _up); o.quaternion.setFromRotationMatrix(_m);
}
// X-56D (.glb): guardamanos bajo el cañón entre z -.28 y -.44 (por debajo de y ≈ .05), el cargador ocupa z -.27…-.11
const PUNTOS = { x56d: { guarda: new V3(0, .06, -.36), palanca: new V3(0, .19, .06) }, pistola: { guarda: new V3(0, -.03, .03), palanca: new V3(0, .06, .02) } };
const armaW = (id, k, o) => J.WOBJ[id].g.localToWorld(o.copy(PUNTOS[id][k]));
const armaVisible = id => { const g = J.WOBJ[id]?.g; return !!g?.parent && g.visible !== false; };

// ---------- Ranuras: lo llama index.js en el borde del grip (devuelve true si lo ha usado) ----------
export function agarrarRanura(m) {
  if (!J || G.mode !== 'vr' || !m.c?.src || Vh?.car.occupied || J.P.sentado) return false;
  const P = J.P, w = P.w, dom = m.c.hand !== 'left';
  // mano izquierda sobre el arma: guardamanos (dos manos) o palanca de carga
  if (!dom && esFuego(w) && armaVisible(w)) {
    if (armaW(w, 'palanca', tA).distanceTo(m.pos) < .08 && R[w].dentro) { m.cerrojo = { ini: m.pos.clone() }; m.c.prop = { label: 'cerrojo' }; m.sostiene = null; buzz(m.c, .3, 25); return true; }
    if (armaW(w, 'guarda', tA).distanceTo(m.pos) < .11) { dos.mano = m; P.dosManos = true; m.c.prop = { label: 'guardamanos' }; buzz(m.c, .3, 25); mecanico('funda', m.pos); return true; }
  }
  for (const k in RANURAS) {
    const s = RANURAS[k]; if (posRanura(k, tA).distanceTo(m.pos) > s.r) continue;
    if (s.arma && dom && P.inv.includes(s.arma)) {
      if (w === s.arma) J.setWeapon('punos'); else J.setWeapon(s.arma);
      mecanico('funda', m.pos); buzz(m.c, .5, 40); return true;
    }
    if (s.cargador && !dom && esFuego(w) && fisica()) { cogerCargador(m, w); return true; }
    if (s.linterna && hombro.prop) { const pr = hombro.prop; hombro.prop = null; pr.contenedor = { abierto: () => true }; return pr.agarre.agarrar(m); }
  }
  return false;
}
// ---------- Cargador en la mano ----------
// el cargador por código del arma real es invisible (lo tapa el .glb): en la mano va una copia visible a su tamaño
const matCargMano = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: .55, metalness: .4 });
const geoCargReal = new THREE.BoxGeometry(.028, .16, .065);
function mallaCargador(id) { const car = cargadorArma(id), real = J.WOBJ[id]?.g.userData.real && id === 'x56d'; return new THREE.Mesh(real ? geoCargReal : car.geometry, car.material.visible === false ? matCargMano : car.material); }
function cogerCargador(m, id) {
  const car = cargadorArma(id); if (!car) return;
  const balas = J.tomarCargador ? J.tomarCargador(id) : J.WEAPONS[id].mag;
  if (balas == null) { buzz(m.c, .15, 15); import('../ui.js').then(u => u.say('El chaleco está vacío')).catch(() => {}); return; }
  const mesh = mallaCargador(id); mesh.position.set(0, -.02, -.05); mesh.rotation.x = -.3; m.c.grip.add(mesh);
  m.cargador = { id, mesh, balas }; m.c.prop = { label: 'cargador' }; mecanico('funda', m.pos); buzz(m.c, .4, 30);
}
function soltarCargador(m) {
  const cg = m.cargador; m.cargador = null; if (m.c) m.c.prop = null;
  // soltarlo junto al chaleco lo devuelve a su bolsillo (si no, cae al suelo y se pierde con sus balas)
  if (['chaleco1', 'chaleco2'].some(k => posRanura(k, tA).distanceTo(m.pos) < .2)) { J.cargadoresDe?.(cg.id).push(cg.balas); cg.mesh.removeFromParent(); mecanico('funda', m.pos); return; }
  const p = cg.mesh.getWorldPosition(new V3()), q = cg.mesh.getWorldQuaternion(new THREE.Quaternion()); scene.add(cg.mesh); cg.mesh.position.copy(p); cg.mesh.quaternion.copy(q);
  escombro(cg.mesh, m.vel.clone(), { vida: 10, densidad: 1.5, giro: 2 });
}
// fin del grip (lo llama index.js): soltar cargador / guardamanos / palanca
export function soltarRanura(m) {
  if (m.cargador) { soltarCargador(m); return true; }
  if (dos.mano === m) { dos.mano = null; if (J) J.P.dosManos = false; if (m.c) m.c.prop = null; return true; }
  if (m.cerrojo) { m.cerrojo = null; if (m.c) m.c.prop = null; return true; }
  return false;
}
// guardar en el hombro una linterna que se suelta cerca (lo llama index.js antes de soltar un objeto)
export const hombro = { prop: null };
export function guardarEnHombro(m, pr) {
  if (G.mode !== 'vr' || pr?.tipo !== 'linterna' || hombro.prop) return false;
  if (posRanura('hombro', tA).distanceTo(m.pos) > RANURAS.hombro.r) return false;
  pr.agarre.soltar(m, false); guardarLinterna(pr); return true;
}
export function guardarLinterna(pr) {
  hombro.prop = pr; pr.estado = 'guardado'; pr.contenedor = { abierto: () => false };
  torso.attach(pr.root); pr.root.position.copy(RANURAS.hombro.p); pr.root.rotation.set(0, 0, 0); mecanico('funda', pr.root.getWorldPosition(tA));
  quitarCuerpo(pr);
}

// ---------- Bucle (después de mover al jugador) ----------
let prevGat = {}, chaleco = false;
export function actualizarArmas(dt, manos) {
  if (!J) return; const P = J.P, vr = G.mode === 'vr';
  if (!chaleco && (P.inv.includes('x56d') || P.inv.includes('pistola'))) { chaleco = true; eventoHistoria('chaleco_puesto'); } // las ranuras del chaleco aparecen con el primer arma de fuego
  actualizarTorso(dt);
  // fundas visibles
  for (const id in fundas) fundas[id].visible = vr && P.inv.includes(id) && P.w !== id && !Vh?.car.occupied && !P.sentado;
  const nCarg = (P.cargadores?.[P.w] || []).length; cargVis.forEach((b, i) => { b.visible = vr && (P.inv.includes('x56d') || P.inv.includes('pistola')) && !Vh?.car.occupied; b.children[0].visible = i < nCarg; }); // el bolsillo vacío se ve vacío
  const uS = J.WOBJ.x56d?.g.userData.uSinCarg; if (uS) uS.value = vr && !R.x56d.dentro ? 1 : 0;
  if (hombro.prop) hombro.prop.root.visible = vr || linternaEncendida() === hombro.prop;
  // vaciado: cerrojo atrás al disparar la última bala
  for (const id in R) { const r = R[id], a = P.ammo[id] ?? 0; if (r.dentro && r.prev > 0 && a === 0 && fisica() && G.opciones.recarga === 'fisica') r.cerrojoAtras = true; r.prev = a; const c = cargadorArma(id); if (c && !vr) c.visible = true; pintarLED(id, r.dentro ? a + (r.cerrojoAtras ? r.pend : 0) : 0, J.WEAPONS[id].mag); }
  if (!vr) { for (const id in R) R[id].dentro = true; return; }
  for (const m of manos) {
    if (!m.c?.src) continue;
    // cargador en la mano → al pozo del arma
    if (m.cargador) { const id = P.w; if (id === m.cargador.id && armaVisible(id) && !R[id].dentro) { const pozo = cargadorArma(id).getWorldPosition(tA), d = m.cargador.mesh.getWorldPosition(tB).distanceTo(pozo); if (d < (G.opciones.recarga === 'asistida' ? .16 : .07)) meterCargador(m, id); } }
    // palanca de carga: tirar hacia atrás (eje +Z del arma) más de 4,5 cm
    if (m.cerrojo && esFuego(P.w)) { tB.set(0, 0, 1).applyQuaternion(J.WOBJ[P.w].g.getWorldQuaternion(tQ)); if (tA.subVectors(m.pos, m.cerrojo.ini).dot(tB) > .045) { montar(P.w); m.cerrojo.ini.copy(m.pos).addScaledVector(tB, 10); buzz(m.c, .7, 50); } }
    // gatillo junto al hombro: encender/apagar la linterna guardada
    const gat = (m.c.src.gamepad?.buttons[0]?.value || 0) > .6;
    if (gat && !prevGat[m.id] && hombro.prop && !m.sostiene && posRanura('hombro', tA).distanceTo(m.pos) < .2) usarProp(hombro.prop, true, m);
    prevGat[m.id] = gat;
  }
  if (dos.mano) P.sway = 0;
}
function meterCargador(m, id) {
  const r = R[id], cg = m.cargador; m.cargador = null; m.c.prop = null; cg.mesh.removeFromParent();
  r.dentro = true; cargadorArma(id).visible = true;
  if (r.cerrojoAtras && G.opciones.recarga === 'fisica') { r.pend = cg.balas; J.P.ammo[id] = 0; } else { J.P.ammo[id] = cg.balas; r.cerrojoAtras = false; r.prev = cg.balas; }
  if (J.P.ammo[id] > 0) eventoHistoria('recargado', { arma: id });
  mecanico('cargadorDentro', m.pos); emitirRuido(m.pos, 2, 'recarga'); buzz(m.c, .8, 50); buzz(J.rightC(), .5, 40);
}
function montar(id) { const r = R[id]; if (!r.dentro) return; if (r.cerrojoAtras) { J.P.ammo[id] = r.pend; r.prev = r.pend; r.pend = 0; r.cerrojoAtras = false; eventoHistoria('recargado', { arma: id }); } mecanico('cerrojo', J.WOBJ[id].g.getWorldPosition(tA)); }
// PC: L engancha/desengancha la linterna del hombro o la enciende
export function estadoArmas() { return { torsoYaw: +yawT.toFixed(2), R: JSON.parse(JSON.stringify(R)), dosManos: !!dos.mano, hombro: hombro.prop?.label || null }; }
export { RANURAS, posRanura, R as recarga, listoJ };
