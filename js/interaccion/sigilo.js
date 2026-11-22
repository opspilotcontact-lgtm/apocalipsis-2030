// Sigilo del jugador: postura (de pie / agachado / tumbado), pasos que hacen ruido, contener la respiración
// tapándose la boca, esconderse en taquillas (con rendijas) y debajo de la pickup.
// Estado público en G.sigilo: { postura, ruidoMult, visibilidad, escondido, donde, conteniendo, ahogo }
//   visibilidad: 1 de pie · .6 agachado · .35 tumbado · 0 escondido (×2,5 con la linterna encendida) → para el combate.
// VR: Y = agacharse · stick dcho. abajo mantenido = tumbarse · mano izq. en la boca + grip = contener la respiración ·
//     los dos grips + los dos gatillos 2 s = calibrar altura (modo sentado). La postura real (cabeza baja) también cuenta.
// PC: C agacharse · Z tumbarse · V contener la respiración (mantener) · E en una taquilla = entrar/salir.
import { THREE, V3, G, clamp, camera, head, dolly, cv2d, toTex } from '../nucleo.js';
import { buzz } from '../fx.js';
import { say } from '../ui.js';
import { emitirRuido, eventoHistoria } from './ruido.js';
import { vinetaExtra, guardar } from './opciones.js';
import { crearArmario } from './muebles.js';
import { registrar } from './objetos.js';
import { respirar } from './sonido.js';

const S = G.sigilo = { postura: 'pie', ruidoMult: 1, visibilidad: 1, escondido: false, donde: null, conteniendo: false, ahogo: 0, linterna: false };
const OFF = { pie: 0, agachado: .6, tumbado: 1.35 };
let pedida = 'pie', offset = 0, aplicado = 0, ext = 0; // ext: altura extra del modo sentado aplicada al dolly
const tA = new V3(), tB = new V3();
let J = null; import('../jugador.js').then(m => { J = m; m.P.agacharVR = () => alternar('agachado'); }).catch(() => {});
let V = null; import('../vehiculos.js').then(m => { V = m; }).catch(() => {});
export function alternar(p) { pedida = pedida === p ? 'pie' : p; buzz(manoIzq(), .2, 30); }
const manoIzq = () => J?.leftC?.();

// ---------- Entrada de PC ----------
const teclas = {};
addEventListener('keydown', e => { if (!G.playing || G.mode !== 'pc' || e.repeat) return; teclas[e.code] = true; if (e.code === 'KeyC' || e.code === 'ControlLeft') alternar('agachado'); if (e.code === 'KeyZ') alternar('tumbado'); });
addEventListener('keyup', e => { teclas[e.code] = false; });

// ---------- Rendijas de la taquilla (máscara pegada a la cámara) ----------
const [rc, rx] = cv2d(128, 256); rx.fillStyle = '#050505'; rx.fillRect(0, 0, 128, 256); for (let y = 18; y < 256; y += 30) rx.clearRect(0, y, 128, 7);
const rendijas = new THREE.Mesh(new THREE.PlaneGeometry(.5, .6), new THREE.MeshBasicMaterial({ map: toTex(rc, false), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
rendijas.position.z = -.11; rendijas.renderOrder = 997; rendijas.visible = false; camera.add(rendijas);

// ---------- Taquillas para esconderse ----------
export const taquillas = [];
// x, z (centro de la base), ry (el frente mira a +Z local)
export function crearTaquilla(x, z, ry = 0, o = {}) {
  const a = crearArmario({ x, y: 0, z, ry, w: .62, h: 1.95, d: .58, tipo: 'taquilla', max: 1.7, label: 'taquilla', padre: o.padre });
  // rejilla de lamas en la puerta (decoración)
  const lam = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: .6 });
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.4, .012, .005), lam); l.position.set(.31, 1.55 + i * .045, .025); a.puerta.piv.add(l); }
  const t = { a, dentro: false, label: 'taquilla' };
  // PC: E en la puerta = entrar y cerrar / salir
  a.puerta.pulsarE = () => { if (t.dentro) salir(t); else entrar(t); return true; };
  a.puerta.label = 'taquilla (esconderse)';
  taquillas.push(t); return t;
}
function entrar(t) {
  if (!J) return; const g = t.a.g; g.updateMatrixWorld(true); const p = g.localToWorld(tA.set(0, 0, -.02));
  if (G.mode === 'pc') { dolly.position.set(p.x, 0, p.z); const f = tB.set(0, 0, 1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion())); J.P.yaw = Math.atan2(-f.x, -f.z); J.P.pitch = 0; J.P.vel.set(0, 0, 0); } // mirando hacia fuera, a las rendijas
  t.a.puerta.obj = 0; emitirRuido(p, 'portazo'); say('Escondido · E para salir');
}
function salir(t) {
  if (!J) return; const g = t.a.g; t.a.puerta.obj = t.a.puerta.max * .9;
  if (G.mode === 'pc') { const p = g.localToWorld(tA.set(0, 0, .9)); dolly.position.set(p.x, 0, p.z); }
}

// ---------- Contener la respiración ----------
const MAXRESP = 9;
let resp = 0, recup = 0, prevCont = false;
function boca(o) { camera.getWorldPosition(o); camera.getWorldDirection(tB); o.addScaledVector(tB, .06); o.y -= .08; return o; }
function actualizarRespiracion(dt, manos) {
  let quiere = false;
  if (G.mode === 'pc') quiere = !!teclas.KeyV;
  else { const izq = manos.find(m => m.c?.hand === 'left' && m.c.src); if (izq && !izq.sostiene && izq.c.src.gamepad?.buttons[1]?.pressed && izq.pos.distanceTo(boca(tA)) < .16) quiere = true; }
  if (recup > 0) { recup -= dt; quiere = false; }
  S.conteniendo = quiere;
  if (quiere) { resp += dt; if (!prevCont) { respirar('contener', boca(tA)); eventoHistoria('respiracion_contenida'); } if (resp > MAXRESP) { recup = 3; S.conteniendo = false; respirar('bocanada', boca(tA)); emitirRuido(boca(tA), 'bocanada'); say('¡Aire!'); vinetaExtra.v = .7; } }
  else { if (prevCont && resp > 1.5 && recup <= 0) respirar('soltar', boca(tA)); resp = Math.max(0, resp - dt * 2); }
  prevCont = S.conteniendo;
  S.ahogo = clamp((resp - (MAXRESP - 3)) / 3, 0, 1);
  if (S.conteniendo) vinetaExtra.v = Math.max(vinetaExtra.v, S.ahogo * .55); else vinetaExtra.v = Math.max(0, vinetaExtra.v - dt * .5);
  if (J) { J.P.pulsoFirme = S.conteniendo; if (S.conteniendo) J.P.sway = 0; }
  if (S.conteniendo && S.ahogo > 0 && Math.random() < dt * 2) for (const m of manos) if (m.c) buzz(m.c, .15 + S.ahogo * .3, 25);
}

// ---------- Pasos (ruido) ----------
let paso = 0; const prevPie = new V3(); let hayPrev = false;
function actualizarPasos(dt, pies) {
  if (!hayPrev) { prevPie.copy(pies); hayPrev = true; return; }
  const d = Math.hypot(pies.x - prevPie.x, pies.z - prevPie.z); prevPie.copy(pies);
  if (d > 1.5 || J?.P.sentado || V?.car.occupied) return; // teletransporte / vehículos
  const v = d / Math.max(dt, 1e-3); if (v < .4) return;
  paso += d;
  const corre = v > 4.2, largo = corre ? 1.05 : .75;
  if (paso >= largo) { paso = 0; emitirRuido(pies, S.postura === 'tumbado' ? 'tumbado' : S.postura === 'agachado' ? 'agachado' : corre ? 'correr' : 'andar'); }
}

// ---------- Calibrar altura (VR): dos grips + dos gatillos 2 s ----------
let calT = 0;
function actualizarCalibracion(dt, manos) {
  const vr = manos.filter(m => m.c?.src); if (vr.length < 2) { calT = 0; return; }
  const todo = vr.every(m => m.c.src.gamepad?.buttons[1]?.pressed && (m.c.src.gamepad?.buttons[0]?.value || 0) > .8);
  calT = todo ? calT + dt : 0;
  if (calT > 2) { calT = -99; const real = camera.position.y; G.opciones.alturaExtra = G.opciones.sentado ? clamp(1.62 - real, 0, 1.2) : 0; G.opciones.alturaReal = real; guardar(); say(G.opciones.sentado ? 'Altura calibrada (sentado)' : 'Altura calibrada'); for (const m of vr) buzz(m.c, .8, 120); }
}

// ---------- Ganchos ----------
let stickT = 0, ultHead = -99, ultOff = 0;
// antes de updateVR/updatePC: quitar el desplazamiento del fotograma anterior (jugador.js trabaja con el suelo real)
export function antesSigilo(dt) {
  if (G.mode === 'vr') { dolly.position.y -= aplicado; aplicado = 0; }
  // stick derecho abajo mantenido = tumbarse (VR)
  if (G.mode === 'vr' && J) { const Rg = J.rightC()?.src?.gamepad, y = Rg?.axes[3] || 0; if (y > .8) { stickT += dt; if (stickT > .35 && stickT < 10) { alternar('tumbado'); stickT = 10; } } else stickT = 0; }
}
// después de mover al jugador
export function actualizarSigilo(dt, pies, manos) {
  const enVehiculo = !!(V?.car.occupied || J?.P.sentado);
  if (enVehiculo) pedida = 'pie';
  // bajo la pickup: tumbado y junto a ella → se puede meter debajo (jugador.js no empuja fuera del coche)
  let bajo = false;
  if (V && V.car.g.visible && !enVehiculo) { const l = V.car.g.worldToLocal(tA.copy(pies)); G.bajoCoche = pedida === 'tumbado' && Math.abs(l.x) < 2.4 && Math.abs(l.z) < 3.4; bajo = G.bajoCoche && Math.abs(l.x) < .85 && Math.abs(l.z) < 2.0; } else G.bajoCoche = false;
  // la altura: botón + real (VR)
  const objetivo = OFF[pedida];
  offset += (objetivo - offset) * Math.min(1, dt * 7);
  if (G.mode === 'vr') {
    const extra = (G.opciones.sentado ? G.opciones.alturaExtra || 0 : 0);
    aplicado = enVehiculo ? 0 : extra - offset; dolly.position.y += aplicado;
    const real = camera.position.y + extra - offset, ref = G.opciones.alturaReal || 1.65;
    S.postura = real < ref * .45 ? 'tumbado' : real < ref * .72 ? 'agachado' : 'pie';
  } else {
    // si updatePC no ha corrido este fotograma (muerto, pausa) la cabeza aún lleva el desplazamiento anterior
    if (Math.abs(head.position.y - ultHead) < 1e-7) head.position.y += ultOff;
    const off = enVehiculo ? 0 : offset; head.position.y -= off; ultHead = head.position.y; ultOff = off;
    if (off > .05 && J) J.P.lento = Math.max(J.P.lento || 0, .06);
    S.postura = enVehiculo ? 'pie' : offset > 1 ? 'tumbado' : offset > .3 ? 'agachado' : 'pie';
  }
  // ¿escondido en una taquilla cerrada?
  let enTaq = null; camera.getWorldPosition(tB);
  for (const t of taquillas) { const l = t.a.g.worldToLocal(tA.copy(tB)); t.dentro = Math.abs(l.x) < .32 && l.z > -.3 && l.z < .32 && l.y < 2.0; if (t.dentro) enTaq = t; }
  const cerrada = enTaq && enTaq.a.puerta.ang < .12;
  rendijas.visible = !!cerrada; for (const t of taquillas) t.a.puerta.panel.visible = !(t === enTaq && cerrada);
  const antes = S.escondido; S.escondido = !!(cerrada || bajo); S.donde = cerrada ? 'taquilla' : bajo ? 'coche' : null;
  if (S.escondido && !antes) eventoHistoria('escondido', { donde: S.donde }); else if (!S.escondido && antes) eventoHistoria('salir_escondite');
  actualizarRespiracion(dt, manos);
  actualizarPasos(dt, pies);
  actualizarCalibracion(dt, manos);
  S.ruidoMult = (S.conteniendo ? .5 : 1) * (S.escondido ? .3 : 1);
  S.visibilidad = (S.escondido ? 0 : S.postura === 'tumbado' ? .35 : S.postura === 'agachado' ? .6 : 1) * (S.linterna ? 2.5 : 1);
}
export const estadoSigilo = () => ({ ...S, pedida, offset: +offset.toFixed(2), bajoCoche: !!G.bajoCoche });
