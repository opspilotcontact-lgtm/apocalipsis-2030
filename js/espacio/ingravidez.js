// Jugador en ingravidez: cuerpo Rapier (bola de 0,3 m y 90 kg en la cabeza) que conserva el momento.
// VR: agarrar asideros/superficies con el grip y tirar/empujar (estilo Lone Echo); al soltar sales con la
// velocidad de la mano. PC: chorros WASD/Espacio/Ctrl, E = ir a un asidero / agarrarse, F mantenido = agarrarse.
// Botas magnéticas (caminar en suelo/paredes, cambio de pared con fundido de 0,3 s) y cable EVA de 12 m.
import * as THREE from 'three';
import { F } from './fisica.js';
import { S, distSuperficie, zonaDe } from './sala.js';
import { aceleracionVenteo } from './aire.js';
import { sonar } from './sonido.js';

const V = THREE.Vector3;
export const MASA = 90, RADIO = .3;
export const J = {
  body: null, vel: new V(), impulso: new V(), asistida: true,
  botas: false, normal: null, cambio: null, fundido: 0,
  agarres: [null, null], historial: [], // VR por mano: {tipo, pos | prop}
  pc: null, rumbo: null, agarreF: false,  // PC: agarre {hold}, asidero hacia el que vas
  cable: { ancla: null, L: 12, tenso: false }, perdido: 0,
  cabeza: new V(), ventAcc: new V(), anclado: false,
};
let cam, dolly;
const ray = new THREE.Raycaster(), tA = new V(), tB = new V(), tC = new V(), tQ = new THREE.Quaternion();
const up = (o = new V()) => o.set(0, 1, 0).applyQuaternion(dolly.quaternion);

export function crearJugador(camera, d, inicio) {
  cam = camera; dolly = d;
  const R = F.R;
  J.body = F.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(inicio.x, inicio.y, inicio.z).lockRotations().setCcdEnabled(true).setLinearDamping(0));
  F.world.createCollider(R.ColliderDesc.ball(RADIO).setDensity(MASA / (4 / 3 * Math.PI * RADIO ** 3)).setFriction(.2).setRestitution(.1), J.body);
  reaparecer(inicio);
}

export function reaparecer(inicio) {
  dolly.quaternion.identity(); dolly.updateMatrixWorld(true);
  const local = cam.position; // PC: (0,1,6,0) · VR: altura real
  dolly.position.set(inicio.x - local.x, inicio.y - local.y, inicio.z - local.z);
  J.cabeza.copy(inicio); J.body.setTranslation(inicio, true); J.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  J.vel.set(0, 0, 0); J.impulso.set(0, 0, 0); J.agarres = [null, null]; J.pc = null; J.rumbo = null;
  J.botas = false; J.normal = null; J.cambio = null; J.cable.ancla = null; J.perdido = 0;
}

// rayo contra las superficies de la sala: {d, punto, normal} o null
export function rayoSuperficie(origen, dir, max) {
  ray.set(origen, dir); ray.far = max;
  const h = ray.intersectObjects(S.superficies, false)[0];
  if (!h || !h.face) return null;
  return { d: h.distance, punto: h.point.clone(), normal: h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize() };
}

const EJES = [new V(1, 0, 0), new V(-1, 0, 0), new V(0, 1, 0), new V(0, -1, 0), new V(0, 0, 1), new V(0, 0, -1)];
function superficieMasCercana(p, max) {
  let mejor = null;
  for (const e of EJES) { const h = rayoSuperficie(p, e, max); if (h && (!mejor || h.d < mejor.d)) mejor = h; }
  return mejor;
}

export function alternarBotas(aviso) {
  J.botas = !J.botas; sonar('clic');
  if (!J.botas) { J.normal = null; J.impulso.addScaledVector(up(tA), .15); aviso('Botas magnéticas: OFF'); return; }
  soltarTodo();
  const h = superficieMasCercana(J.cabeza, 2.6);
  if (h) pegarA(h.normal); else aviso('Botas: ON · sin superficie cerca (acércate a < 2,5 m)');
  if (h) aviso('Botas magnéticas: ON');
}
function pegarA(n) {
  if (up(tA).dot(n) > .97) { J.normal = n.clone(); return; }
  J.cambio = { t: 0, n: n.clone(), hecho: false }; // fundido 0,3 s: nunca se ve rotar la cámara
}
function aplicarCambio(n) {
  const cabeza = cam.getWorldPosition(tB);
  tQ.setFromUnitVectors(up(tA), n); dolly.quaternion.premultiply(tQ); dolly.updateMatrixWorld(true);
  const ahora = cam.getWorldPosition(tC); dolly.position.add(tB.sub(ahora)); dolly.updateMatrixWorld(true);
  J.normal = n.clone();
}

export function soltarTodo() { J.agarres = [null, null]; J.pc = null; J.rumbo = null; }
export const agarrado = () => !!(J.agarres[0]?.tipo && J.agarres[0].tipo !== 'prop') || !!(J.agarres[1]?.tipo && J.agarres[1].tipo !== 'prop') || !!J.pc;

// ---------- VR: grip de una mano ----------
// mano = {grip, pos(V3 mundo)} · devuelve el prop agarrado (si lo hay)
export function vrAgarrar(i, mano) {
  const p = mano.pos;
  let mejor = null, dm = .16;
  for (const a of S.asideros) { const d = a.pos.distanceTo(p); if (d < dm) { dm = d; mejor = a; } }
  if (mejor) { J.agarres[i] = { tipo: 'asidero', pos: p.clone() }; sonar('clic'); return null; }
  for (const pr of F.props) { const t = pr.body.translation(); if (tA.set(t.x, t.y, t.z).distanceTo(p) < pr.radio + .1) { J.agarres[i] = { tipo: 'prop', prop: pr }; pr.agarrado = true; return pr; } }
  if (distSuperficie(p) < .08) { J.agarres[i] = { tipo: 'superficie', pos: p.clone() }; sonar('clic'); }
  return null;
}
export function vrSoltar(i, velMano) {
  const g = J.agarres[i]; J.agarres[i] = null; if (!g) return;
  if (g.tipo === 'prop') { // lanzar: el objeto sale con la velocidad de la mano y tú, al revés (momento)
    const pr = g.prop; pr.agarrado = false;
    pr.body.setLinvel({ x: velMano.x, y: velMano.y, z: velMano.z }, true);
    if (!agarrado() && !(J.botas && J.normal)) J.impulso.addScaledVector(velMano, -pr.masa / MASA);
    return;
  }
  if (agarrado()) return; // la otra mano sigue sujeta
  // empuje: media de los últimos fotogramas (más estable que el último)
  tA.set(0, 0, 0); for (const v of J.historial) tA.add(v); if (J.historial.length) tA.divideScalar(J.historial.length);
  if (tA.length() > 4.5) tA.setLength(4.5);
  J.vel.copy(tA); J.historial.length = 0;
}

// ---------- PC ----------
export function pcE(apuntado, aviso) {
  if (J.pc || J.rumbo) { soltarTodo(); aviso('Soltado'); return; }
  if (J.botas && J.normal) return;
  if (apuntado) {
    if (apuntado.pos.distanceTo(J.cabeza) < 1.1) { J.pc = { hold: J.cabeza.clone() }; sonar('clic'); aviso('Agarrado · WASD = impulsarte desde aquí'); }
    else { J.rumbo = apuntado; aviso('Impulso hacia el asidero'); }
    return;
  }
  if (distSuperficie(J.cabeza) < 1.2) { J.pc = { hold: J.cabeza.clone() }; sonar('clic'); aviso('Agarrado a la superficie'); }
  else aviso('Nada a mano · mira un asidero amarillo');
}
export function pcF(abajo) {
  if (abajo) {
    let cerca = distSuperficie(J.cabeza) < 1.4;
    for (const a of S.asideros) if (a.pos.distanceTo(J.cabeza) < 1.6) cerca = true;
    if (cerca && !J.pc) { J.pc = { hold: J.cabeza.clone(), f: true }; sonar('clic'); }
  } else if (J.pc?.f) J.pc = null;
}

export function engancharCable(manoPos, aviso) {
  if (J.cable.ancla) { J.cable.ancla = null; sonar('clic'); aviso('Cable desenganchado'); return; }
  const p = manoPos || J.cabeza; let mejor = null, dm = manoPos ? .3 : 3;
  for (const a of S.anclas) { const d = a.pos.distanceTo(p); if (d < dm) { dm = d; mejor = a; } }
  if (!mejor) { aviso(manoPos ? 'Lleva la mano a una argolla naranja' : 'No hay argolla a < 3 m'); return; }
  J.cable.ancla = mejor; sonar('clic'); aviso('Cable enganchado (12 m)');
}

// ---------- paso del jugador (antes de la física) ----------
// ent = { dt, chorro: V3 en mundo (PC) | null, andar: {x,y} (stick/WASD con botas), recoger, manos: [{pos}|null], vr }
export function antesFisica(ent) {
  const dt = ent.dt;
  dolly.updateMatrixWorld(true);
  cam.getWorldPosition(J.cabeza);
  J.body.setTranslation(J.cabeza, true);
  const v = tC.copy(J.vel);
  J.anclado = false;

  // fundido del cambio de pared (0,15 s a negro → girar → 0,15 s de vuelta)
  if (J.cambio) { J.cambio.t += dt; if (!J.cambio.hecho && J.cambio.t >= .15) { aplicarCambio(J.cambio.n); J.cambio.hecho = true; cam.getWorldPosition(J.cabeza); J.body.setTranslation(J.cabeza, true); } if (J.cambio.t >= .3) J.cambio = null; }
  J.fundido = J.cambio ? 1 - Math.abs(J.cambio.t - .15) / .15 : 0;

  const vrAgarres = J.agarres.map((g, i) => g && g.tipo !== 'prop' && ent.manos[i] ? tA.clone().subVectors(g.pos, ent.manos[i].pos) : null).filter(Boolean);
  if (vrAgarres.length) {
    // la mano queda clavada en el mundo: el cuerpo se mueve lo que se mueva la mano (al revés)
    const corr = vrAgarres.reduce((s, c) => s.add(c), new V()).divideScalar(vrAgarres.length);
    v.copy(corr).divideScalar(Math.max(dt, 1 / 144));
    J.historial.push(v.clone()); if (J.historial.length > 6) J.historial.shift();
    J.anclado = true; J.impulso.set(0, 0, 0);
  } else if (J.pc) {
    v.subVectors(J.pc.hold, J.cabeza).multiplyScalar(5); J.anclado = true; J.impulso.set(0, 0, 0);
    if (ent.chorro && ent.chorro.lengthSq() > 0 && !J.pc.f) { v.copy(ent.chorro).setLength(1.6); J.pc = null; sonar('chorro'); } // empujarse desde el agarre
  } else if (J.botas && J.normal) {
    // botas: caminar 1,2 m/s sin inercia sobre la superficie
    const n = J.normal, h = rayoSuperficie(J.cabeza, tA.copy(n).negate(), 2.6);
    if (!h) { J.normal = null; }
    else {
      const fwd = cam.getWorldDirection(tB); fwd.addScaledVector(n, -fwd.dot(n)); if (fwd.lengthSq() < 1e-4) { fwd.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(tQ)); fwd.addScaledVector(n, -fwd.dot(n)); } fwd.normalize();
      const der = new V().crossVectors(fwd, n);
      v.copy(fwd).multiplyScalar(ent.andar.y * 1.2).addScaledVector(der, ent.andar.x * 1.2);
      const alto = ent.vr ? Math.max(1, cam.position.y) : 1.6;
      v.addScaledVector(n, (alto - h.d) * (J.cambio ? 12 : 6));
      J.anclado = true; J.impulso.set(0, 0, 0);
      // pared delante: cambio de superficie
      if (!J.cambio && (ent.andar.x || ent.andar.y)) {
        const dir = tA.copy(fwd).multiplyScalar(ent.andar.y).addScaledVector(der, ent.andar.x).normalize();
        const pared = rayoSuperficie(tB.copy(J.cabeza).addScaledVector(n, .6 - alto), dir, .55);
        if (pared && pared.normal.dot(n) < .3) pegarA(pared.normal);
      }
    }
  } else {
    if (J.botas && !J.normal) { const s = superficieMasCercana(J.cabeza, 1.3); if (s) pegarA(s.normal); }
    if (J.rumbo) { // PC: deslizarse hasta el asidero y agarrarse al llegar
      const d = tA.subVectors(J.rumbo.pos, J.cabeza); const L = d.length();
      if (L < .9) { J.pc = { hold: J.cabeza.clone() }; J.rumbo = null; v.set(0, 0, 0); sonar('clic'); }
      else v.lerp(d.setLength(1.8), Math.min(1, dt * 4));
    }
    if (ent.chorro) v.addScaledVector(ent.chorro, dt * 1.2); // chorros pequeños: 1,2 m/s²
    v.add(J.impulso); J.impulso.set(0, 0, 0);
    if (J.asistida) { v.multiplyScalar(Math.exp(-.7 * dt)); if (v.length() < .03 && !ent.chorro?.lengthSq()) v.set(0, 0, 0); }
  }
  // venteo: arrastra si no estás agarrado ni con las botas puestas
  aceleracionVenteo(J.cabeza, J.ventAcc);
  if (!J.anclado) v.addScaledVector(J.ventAcc, dt);
  // cable: frena a 12 m; R / botón Y = recoger mano sobre mano
  J.cable.tenso = false;
  if (J.cable.ancla) {
    const r = tA.subVectors(J.cabeza, J.cable.ancla.pos), L = r.length(); r.normalize();
    if (ent.recoger && !J.anclado) v.addScaledVector(r, -Math.min(1.2, v.dot(r) + 1.2) * Math.min(1, dt * 6));
    if (L > J.cable.L - .02) {
      const rad = v.dot(r);
      if (rad > 0) { if (rad > 1.2) sonar('tension'); v.addScaledVector(r, -rad * 1.1); }
      v.addScaledVector(r, -(L - J.cable.L) * 4); J.cable.tenso = true;
    }
  }
  if (v.length() > 12) v.setLength(12);
  J.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
}

export function despuesFisica(dt, perder) {
  const t = J.body.translation();
  dolly.position.add(tA.set(t.x - J.cabeza.x, t.y - J.cabeza.y, t.z - J.cabeza.z));
  const lv = J.body.linvel(); J.vel.set(lv.x, lv.y, lv.z);
  if (J.anclado && (J.pc || (J.botas && J.normal))) J.vel.set(0, 0, 0);
  // perdido en el vacío sin cable
  J.cabeza.set(t.x, t.y, t.z);
  if (zonaDe(J.cabeza) === 'V' && !J.cable.ancla && J.cabeza.z < -27.5) { J.perdido += dt; if (J.perdido > 4) perder(); } else J.perdido = 0;
}
