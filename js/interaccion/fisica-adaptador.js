// Adaptador de física para la interacción: reutiliza el mundo Rapier del sistema de combate (js/combate/fisica.js).
// Así hay UN solo mundo: los objetos chocan con el escenario, con los escombros y con los ragdolls.
// El paso de física lo da el combate (actualizarCombate dentro de actualizarEnemigos); aquí no se avanza el mundo,
// salvo en bancos de prueba que llaman a pasoFisica directamente.
import { THREE } from '../nucleo.js';
import { FIS, listo, seguir, dejar, poseInterp, grupos, BIT, pasoFisica } from '../combate/fisica.js';
export { FIS, listo, seguir, dejar, poseInterp, pasoFisica };

// bits de colisión propios (el combate usa 0 = escenario, 1 = escombros, 2..7 = ragdolls)
export const BITS = { ENV: BIT.ENV, ESC: BIT.ESC, PROP: 1 << 8, JUG: 1 << 9, MANO: 1 << 10 };
export const GR = {
  libre: grupos(BITS.PROP, 0xffff),
  sostenido: grupos(BITS.PROP, 0xffff & ~(BITS.JUG | BITS.MANO)), // lo que llevas en la mano no choca contigo
  jugador: grupos(BITS.JUG, BITS.PROP),
  mano: grupos(BITS.MANO, BITS.PROP),
  fijo: grupos(BITS.ENV, 0xffff)
};
export const fisicaLista = () => FIS.listo;
// ejecuta fn en cuanto Rapier esté listo (o nunca, si no carga)
export function alListo(fn) { if (FIS.listo) fn(); else listo.then(ok => { if (ok) fn(); }); }

const _q = new THREE.Quaternion();
// forma: { f: 'caja'|'cil'|'bola'|'cono'|'capsula', m: [hx,hy,hz] | r, h, c: [x,y,z], rx/ry/rz (giro de la forma) }
export function descForma(s) {
  const R = FIS.R; let d;
  if (s.f === 'caja') d = R.ColliderDesc.cuboid(s.m[0], s.m[1], s.m[2]);
  else if (s.f === 'cil') d = R.ColliderDesc.cylinder(s.h / 2, s.r);
  else if (s.f === 'cono') d = R.ColliderDesc.cone(s.h / 2, s.r);
  else if (s.f === 'capsula') d = R.ColliderDesc.capsule(s.h / 2, s.r);
  else d = R.ColliderDesc.ball(s.r);
  const c = s.c || [0, 0, 0]; d.setTranslation(c[0], c[1], c[2]);
  if (s.rx || s.ry || s.rz) { _q.setFromEuler(new THREE.Euler(s.rx || 0, s.ry || 0, s.rz || 0)); d.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }); }
  return d;
}
export function volumenForma(s) {
  if (s.f === 'caja') return 8 * s.m[0] * s.m[1] * s.m[2];
  if (s.f === 'cil') return Math.PI * s.r * s.r * s.h;
  if (s.f === 'cono') return Math.PI * s.r * s.r * s.h / 3;
  if (s.f === 'capsula') return Math.PI * s.r * s.r * (s.h + 4 / 3 * s.r);
  return 4 / 3 * Math.PI * s.r ** 3;
}
// cuerpo fijo hecho de cajas en coordenadas de mundo (paneles de muebles, bandejas, suelos interiores)
export function cuerpoFijo(cajas) {
  if (!FIS.listo) return null;
  const R = FIS.R, b = FIS.world.createRigidBody(R.RigidBodyDesc.fixed());
  for (const s of cajas) FIS.world.createCollider(descForma(s).setFriction(.8).setCollisionGroups(GR.fijo), b);
  return b;
}
// cuerpo cinemático (puertas, cajones, mano, jugador): se mueve con setNextKinematic*
export function cuerpoCinematico(formas, pos, q, grupo = GR.fijo) {
  if (!FIS.listo) return null;
  const R = FIS.R, b = FIS.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z).setRotation(q ? { x: q.x, y: q.y, z: q.z, w: q.w } : { x: 0, y: 0, z: 0, w: 1 }));
  for (const s of formas) FIS.world.createCollider(descForma(s).setFriction(.7).setCollisionGroups(grupo), b);
  return b;
}
export function moverCinematico(b, pos, q) { if (!b) return; b.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z }); if (q) b.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); }
export function quitarCuerpo(b) { if (b && FIS.world) FIS.world.removeRigidBody(b); }
