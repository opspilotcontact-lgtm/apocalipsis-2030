// Mundo Rapier PROPIO con gravedad 0 para las pruebas del Acto II (ingravidez).
// No usa js/combate/fisica.js: aquél está atado a los colliders de nucleo.js, a una losa de suelo en y=0 y a fx.js.
import * as THREE from 'three';

export const F = { R: null, world: null, listo: false, props: [] };

export async function iniciarFisica() {
  const mod = await import('@dimforge/rapier3d-compat');
  const R = mod.default || mod;
  await R.init();
  F.R = R; F.world = new R.World({ x: 0, y: 0, z: 0 }); F.listo = true;
  return F;
}

// caja alineada a los ejes, estática o cinemática (puertas, mampara)
export function cajaFisica(min, max, cinematico = false) {
  const R = F.R, cx = (min.x + max.x) / 2, cy = (min.y + max.y) / 2, cz = (min.z + max.z) / 2;
  const desc = R.ColliderDesc.cuboid((max.x - min.x) / 2, (max.y - min.y) / 2, (max.z - min.z) / 2).setFriction(.7).setRestitution(.15);
  if (!cinematico) return { col: F.world.createCollider(desc.setTranslation(cx, cy, cz)) };
  const body = F.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(cx, cy, cz));
  return { body, col: F.world.createCollider(desc, body), base: new THREE.Vector3(cx, cy, cz) };
}

// objeto flotante: forma = {tipo:'caja',x,y,z} | {tipo:'cil',r,h} | {tipo:'bola',r}
export function crearProp(mesh, forma, o = {}) {
  const R = F.R, p = mesh.position, q = mesh.quaternion, dens = o.densidad ?? 250;
  const body = F.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    .setCcdEnabled(true).setLinearDamping(0).setAngularDamping(.02));
  let cd, vol;
  if (forma.tipo === 'bola') { cd = R.ColliderDesc.ball(forma.r); vol = 4 / 3 * Math.PI * forma.r ** 3; }
  else if (forma.tipo === 'cil') { cd = R.ColliderDesc.cylinder(forma.h / 2, forma.r); vol = Math.PI * forma.r ** 2 * forma.h; }
  else { cd = R.ColliderDesc.cuboid(forma.x / 2, forma.y / 2, forma.z / 2); vol = forma.x * forma.y * forma.z; }
  const col = F.world.createCollider(cd.setDensity(dens).setRestitution(.35).setFriction(.5), body);
  if (o.v) body.setLinvel(o.v, true);
  if (o.w) body.setAngvel(o.w, true);
  const pr = { mesh, body, col, masa: dens * vol, radio: o.radio ?? Math.cbrt(vol) * .7, tipo: o.tipo || 'resto' };
  mesh.userData.prop = pr; F.props.push(pr);
  return pr;
}

export function quitarProp(pr) {
  const i = F.props.indexOf(pr); if (i < 0) return;
  F.props.splice(i, 1); F.world.removeRigidBody(pr.body); pr.mesh.removeFromParent();
}

// un paso por fotograma con dt variable (las Quest van a 72/90 Hz; así el jugador no tiembla)
export function pasoFisica(dt) {
  F.world.timestep = Math.min(Math.max(dt, 1 / 144), 1 / 30);
  F.world.step();
  for (const pr of F.props) {
    const t = pr.body.translation(), r = pr.body.rotation();
    pr.mesh.position.set(t.x, t.y, t.z); pr.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
