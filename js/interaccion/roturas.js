// Roturas: botellas, platos, tazas, monitores y cristales estallan en fragmentos físicos; las cajas de madera
// se parten en tablones. Los fragmentos son escombros del sistema de combate (escombro(): cuerpo Rapier, se
// duermen, se encogen y desaparecen a los 10 s; si Rapier no cargó, caen con la física falsa de fx.js).
import { THREE, V3, rnd, scene, dinamicos, addCollider } from '../nucleo.js';
import { burst } from '../fx.js';
import { escombro } from '../combate/fisica.js';
import { rotura } from './sonido.js';
import { cuerpoFijo, quitarCuerpo, alListo } from './fisica-adaptador.js';
import { emitirRuido, eventoHistoria } from './ruido.js';
import { registrar, desregistrar, ganchos } from './objetos.js';
import { say } from '../ui.js';

// geometrías compartidas: una astilla de cristal (prisma triangular fino), un trozo de loza y un tablón
const gAstilla = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.05, .012); s.lineTo(.012, .06); s.lineTo(0, 0); const g = new THREE.ExtrudeGeometry(s, { depth: .003, bevelEnabled: false }); g.center(); return g; })();
const gLoza = (() => { const g = new THREE.CylinderGeometry(.04, .045, .012, 3); return g; })();
const gTablon = new THREE.BoxGeometry(.5, .04, .1);
const gPlaca = new THREE.BoxGeometry(.06, .04, .02);
const mats = new Map();
function matDe(tipo, color) {
  const k = tipo + color; let m = mats.get(k);
  if (!m) {
    if (tipo === 'vidrio' || tipo === 'pantalla') m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: .65, roughness: .05, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
    else m = new THREE.MeshStandardMaterial({ color, roughness: tipo === 'madera' ? .8 : .4 });
    mats.set(k, m);
  }
  return m;
}
const tV = new V3();
// pos: centro del objeto · vel: su velocidad (los trozos la heredan) · n: número de trozos · tam: radio de reparto
export function fragmentar(tipo, pos, vel, color, n = 7, tam = .08, fuerza = 1) {
  rotura(tipo, pos, Math.min(1, .5 + fuerza * .5));
  const geo = tipo === 'madera' ? gTablon : tipo === 'ceramica' ? gLoza : gAstilla;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, matDe(tipo, tipo === 'pantalla' && i % 3 ? 0x2a2c30 : color));
    if (tipo === 'pantalla' && i % 3) m.geometry = gPlaca;
    m.position.set(pos.x + rnd(-tam, tam), pos.y + rnd(-tam * .5, tam), pos.z + rnd(-tam, tam));
    m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); if (tipo !== 'madera') m.scale.setScalar(rnd(.6, 1.4));
    m.castShadow = tipo === 'madera'; scene.add(m);
    const v = new V3(rnd(-1.6, 1.6), rnd(.6, 2.4), rnd(-1.6, 1.6)).multiplyScalar(fuerza);
    if (vel) v.addScaledVector(vel, .4);
    escombro(m, v, { vida: 10, densidad: tipo === 'madera' ? .6 : 2.4, giro: 12 });
  }
  if (tipo === 'pantalla') burst(pos, 12, 'hot');
  else burst(pos, tipo === 'madera' ? 8 : 5, 'dust');
}

// ---------- Cristales fijos (ventanas, vitrinas, marcos): se rompen con balas, golpes de puño u objetos lanzados ----------
export const cristales = [];
export function crearCristal(w, h, x, y, z, ry = 0, padre = scene) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matDe('vidrio', 0xcfe8f0)); mesh.position.set(x, y, z); mesh.rotation.y = ry; padre.add(mesh);
  const c = { mesh, w, h, roto: false, body: null, label: 'cristal' };
  mesh.userData.prop = c; dinamicos.push(mesh);
  alListo(() => { mesh.updateMatrixWorld(true); const p = mesh.getWorldPosition(new V3()), q = mesh.getWorldQuaternion(new THREE.Quaternion()); const e = new THREE.Euler().setFromQuaternion(q);
    c.body = cuerpoFijo([{ f: 'caja', m: [w / 2, h / 2, .004], c: [p.x, p.y, p.z], rx: e.x, ry: e.y, rz: e.z }]); });
  c.romper = (punto, dir) => {
    if (c.roto) return; c.roto = true; mesh.visible = false; quitarCuerpo(c.body); c.body = null;
    const i = dinamicos.indexOf(mesh); if (i >= 0) dinamicos.splice(i, 1);
    const p = mesh.getWorldPosition(new V3()); const n = Math.min(14, Math.round(w * h * 14) + 5);
    fragmentar('vidrio', punto || p, dir ? dir.clone().multiplyScalar(2) : null, 0xcfe8f0, n, Math.max(w, h) * .4, .8);
  };
  // impacto de bala o golpe (lo llama applyHit / la interacción)
  c.golpe = (punto, dir) => { c.romper(punto, dir); return true; };
  // ¿un punto del mundo está pegado al cristal? (para puños y objetos lanzados)
  const _l = new V3();
  c.toca = (p, margen = .05) => { if (c.roto) return false; _l.copy(p); mesh.worldToLocal(_l); return Math.abs(_l.z) < margen && Math.abs(_l.x) < w / 2 + margen && Math.abs(_l.y) < h / 2 + margen; };
  c.reponer = () => { if (!c.roto) return; c.roto = false; mesh.visible = true; dinamicos.push(mesh); alListo(() => { const p = mesh.getWorldPosition(new V3()), e = new THREE.Euler().setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())); c.body = cuerpoFijo([{ f: 'caja', m: [w / 2, h / 2, .004], c: [p.x, p.y, p.z], rx: e.x, ry: e.y, rz: e.z }]); }); };
  cristales.push(c); return c;
}

// ---------- Ventanas para entrar (docs/diseno-vr.md §3.7) ----------
// El marco bloquea al jugador (colisor de nucleo) hasta que se quitan los trozos que quedan clavados tras romperla.
// Romper: bala, objeto lanzado o sostenido (> 2,5 m/s), culata/arma cuerpo a cuerpo, codo (mano por detrás del pecho
// moviéndose hacia atrás) → sin corte · puño desnudo → −10 y corte. Ruido de 15 m. Quitar trozos: VR agarrar o barrer
// con algo en la mano · PC F (o E) mirando al trozo. Agarrar un trozo con la mano desnuda corta un poco (−3).
export const ventanas = [];
const gTrozo = (() => { const s = new THREE.Shape(); s.moveTo(-.08, 0); s.lineTo(.09, 0); s.lineTo(.01, .17); s.lineTo(-.08, 0); return new THREE.ShapeGeometry(s); })();
export function crearVentana(o) {
  const c = crearCristal(o.w, o.h, o.x, o.y, o.z, o.ry || 0, o.padre); c.label = o.label || 'ventana'; c.ventana = true;
  // colisor del marco para el jugador (caja alineada a los ejes que cubre el hueco)
  const cs = Math.abs(Math.cos(o.ry || 0)), sn = Math.abs(Math.sin(o.ry || 0)), hx = (o.w * cs + .3 * sn) / 2, hz = (o.w * sn + .3 * cs) / 2;
  c.col = o.marco === false ? null : addCollider(o.x - hx, o.x + hx, o.z - hz, o.z + hz, o.y + o.h / 2 + .05);
  c.trozos = [];
  const romperBase = c.romper;
  c.romper = (punto, dir, op = {}) => {
    if (c.roto) return; romperBase(punto, dir); const p = punto || c.mesh.getWorldPosition(new V3());
    emitirRuido(p, 'cristal'); ganchos.romperCristal?.(c, op); eventoHistoria('ventana_rota', { corte: !!op.corte, ventana: c.label }); // gancho para el combate / la historia
    if (op.corte && ganchos.hurtPlayer) { ganchos.hurtPlayer(10, null, op.mano === 'left' ? 'brazoI' : 'brazoD'); say('Te has cortado la mano'); }
    // trozos que quedan en el marco
    for (const [lx, ly, rz] of [[-o.w / 2 + .05, -o.h / 2 + .02, 0], [o.w / 2 - .05, -o.h / 2 + .02, .3], [-o.w / 2 + .02, o.h / 4, -Math.PI / 2], [o.w / 2 - .02, -o.h / 5, Math.PI / 2], [0, o.h / 2 - .02, Math.PI]]) {
      const m = new THREE.Mesh(gTrozo, matDe('vidrio', 0xcfe8f0)); m.position.set(lx, ly, 0); m.rotation.z = rz; m.scale.setScalar(rnd(.7, 1.3)); c.mesh.parent.add(m); m.position.applyMatrix4(c.mesh.matrix); m.quaternion.copy(c.mesh.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), rz));
      const t = { label: 'trozo de cristal', mallas: [m], mesh: m, activo: () => true, centro: q => m.getWorldPosition(q) };
      t.agarre = { dist: q => m.getWorldPosition(new V3()).distanceTo(q) - .06, agarrar: mano => { quitarTrozo(c, t, mano.vel, !mano.sostiene && !mano.pc); return false; } };
      t.pulsarE = () => { quitarTrozo(c, t, null, false); return true; };
      registrar(t); c.trozos.push(t);
    }
  };
  c.golpe = (punto, dir) => { c.romper(punto, dir); return true; };
  c.reponerVentana = () => { for (const t of [...c.trozos]) { t.mesh.removeFromParent(); desregistrar(t); } c.trozos.length = 0; c.reponer(); if (c.col) c.col.top = o.y + o.h / 2 + .05; };
  c.mallas = [c.mesh]; c.activo = () => !c.roto; c.centro = q => c.mesh.getWorldPosition(q); registrar(c); // la mira de PC la encuentra (F = golpear)
  ventanas.push(c); return c;
}
function quitarTrozo(c, t, vel, manoDesnuda) {
  const i = c.trozos.indexOf(t); if (i < 0) return; c.trozos.splice(i, 1); desregistrar(t);
  const m = t.mesh, p = m.getWorldPosition(new V3()); scene.attach(m);
  escombro(m, vel ? vel.clone().multiplyScalar(.6) : new V3(rnd(-.5, .5), .3, rnd(-.5, .5)), { vida: 6, densidad: 2.4, giro: 6 });
  rotura('vidrio', p, .25); emitirRuido(p, 3, 'cristalPisado');
  if (manoDesnuda && ganchos.hurtPlayer) ganchos.hurtPlayer(3, null, 'brazo');
  if (!c.trozos.length && c.col) { c.col.top = 0; say('Hueco despejado'); }
}
