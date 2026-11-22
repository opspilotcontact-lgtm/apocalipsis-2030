// Física con Rapier (WASM): mundo estático generado desde los `colliders` de nucleo.js (cajas alineadas a los ejes
// y rampas) + suelo, paso fijo a 60 Hz con acumulador e interpolación, y escombros como cuerpos rígidos dinámicos.
// Si Rapier no carga (sin red, navegador viejo), todo cae a la física falsa de fx.js (toDebris) sin romper nada.
import { THREE, V3, G, colliders, capOn, rnd, scene } from '../nucleo.js';
import { toDebris } from '../fx.js';

export const FIS = { R: null, world: null, listo: false, fallo: false, paso: 1 / 60, acc: 0, alpha: 1 };
// grupos de colisión (bits): 0 = escenario, 1 = escombros, 2..7 = un bit por ragdoll (no chocan consigo mismos)
export const BIT = { ENV: 1, ESC: 2 };
export const grupos = (miembro, filtro) => ((miembro & 0xffff) << 16) | (filtro & 0xffff);
export const bitRagdoll = slot => 1 << (2 + slot);

// ---------- Arranque (asíncrono: el juego no espera a la física) ----------
export const listo = (async () => {
  try {
    const mod = await import('@dimforge/rapier3d-compat');
    const R = mod.default || mod;
    await R.init();
    FIS.R = R;
    FIS.world = new R.World({ x: 0, y: -9.81, z: 0 });
    FIS.world.timestep = FIS.paso;
    // el suelo: una losa gruesa bajo y=0 (pertenece a la capa «tierra»)
    const suelo = FIS.world.createCollider(R.ColliderDesc.cuboid(600, 1, 600).setTranslation(40, -1, -40).setFriction(.9).setCollisionGroups(grupos(BIT.ENV, 0xffff)));
    estaticos.push({ c: { cap: 'tierra', suelo: true }, col: suelo, top: 0 });
    FIS.listo = true;
    return true;
  } catch (e) { FIS.fallo = true; console.warn('[combate] Rapier no cargó; uso la física falsa de fx.js', e); return false; }
})();

// ---------- Escenario estático (sincronizado con colliders[] y con las capas visibles) ----------
const estaticos = []; let nLeidos = 0, capKey = '', revisarT = 0;
function colliderDe(c) {
  const R = FIS.R, w = c.x1 - c.x0, d = c.z1 - c.z0, top = c.top;
  if (!(top > .01) || !(w > 0) || !(d > 0)) return null;
  let desc;
  if (c.ramp) { // losa inclinada, igual que la malla de ramp() en nucleo.js
    const L = c.axis === 'z' ? d : w, W = c.axis === 'z' ? w : d, ang = Math.atan2(top, L), len = Math.hypot(L, top);
    const q = new THREE.Quaternion();
    if (c.axis === 'z') { q.setFromAxisAngle(new V3(1, 0, 0), c.up > 0 ? -ang : ang); desc = R.ColliderDesc.cuboid(W / 2, .11, len / 2); }
    else { q.setFromAxisAngle(new V3(0, 0, 1), c.up > 0 ? ang : -ang); desc = R.ColliderDesc.cuboid(len / 2, .11, W / 2); }
    desc.setTranslation((c.x0 + c.x1) / 2, top / 2 - .1, (c.z0 + c.z1) / 2).setRotation(q);
  } else desc = R.ColliderDesc.cuboid(w / 2, top / 2, d / 2).setTranslation((c.x0 + c.x1) / 2, top / 2, (c.z0 + c.z1) / 2);
  desc.setFriction(.8).setCollisionGroups(grupos(BIT.ENV, 0xffff));
  return FIS.world.createCollider(desc);
}
function sincronizarEstaticos(dt) {
  // colliders nuevos (los capítulos pueden añadir barreras en cualquier momento)
  while (nLeidos < colliders.length) { const c = colliders[nLeidos++], col = colliderDe(c); if (col) { estaticos.push({ c, col, top: c.top }); col.setEnabled(!!capOn[c.cap]); } }
  // capas encendidas/apagadas
  const k = (capOn.tierra ? 1 : 0) + (capOn.calma ? 2 : 0) + (capOn.caos ? 4 : 0) + (capOn.espacio ? 8 : 0);
  if (k !== capKey) { capKey = k; for (const s of estaticos) s.col.setEnabled(!!capOn[s.c.cap]); }
  // barreras que suben o bajan (cambian top): revisión barata cada medio segundo
  revisarT -= dt;
  if (revisarT <= 0) { revisarT = .5; for (const s of estaticos) if (!s.c.suelo && s.c.top !== s.top) { FIS.world.removeCollider(s.col, false); s.top = s.c.top; const n = colliderDe(s.c); if (n) { s.col = n; n.setEnabled(!!capOn[s.c.cap]); } else s.col = FIS.world.createCollider(FIS.R.ColliderDesc.ball(.01).setTranslation(0, -50, 0)); } }
  FIS.world.gravity = { x: 0, y: G.enEspacio ? 0 : -9.81, z: 0 };
}

// ---------- Seguimiento de cuerpos con interpolación (las Quest van a 72/90 Hz y la física a 60) ----------
const seguidos = new Set();
export function seguir(body) {
  const t = body.translation(), r = body.rotation();
  const s = { body, pp: new V3(t.x, t.y, t.z), pq: new THREE.Quaternion(r.x, r.y, r.z, r.w), cp: new V3(t.x, t.y, t.z), cq: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
  seguidos.add(s); return s;
}
export function dejar(s) { seguidos.delete(s); }
export function poseInterp(s, P, Q) { P.lerpVectors(s.pp, s.cp, FIS.alpha); Q.slerpQuaternions(s.pq, s.cq, FIS.alpha); }

// ---------- Paso fijo ----------
const despues = []; // callbacks tras cada subpaso (ragdolls, escombros)
export const alPaso = fn => despues.push(fn);
export function pasoFisica(dt) {
  if (!FIS.listo) return 0;
  sincronizarEstaticos(dt);
  FIS.acc += Math.min(dt, .1); let n = 0;
  while (FIS.acc >= FIS.paso && n < 3) {
    for (const s of seguidos) { s.pp.copy(s.cp); s.pq.copy(s.cq); }
    FIS.world.step();
    for (const s of seguidos) { const t = s.body.translation(), r = s.body.rotation(); s.cp.set(t.x, t.y, t.z); s.cq.set(r.x, r.y, r.z, r.w); }
    FIS.acc -= FIS.paso; n++;
  }
  if (n === 3) FIS.acc = Math.min(FIS.acc, FIS.paso); // si el fotograma fue muy largo no acumulamos deuda
  FIS.alpha = FIS.acc / FIS.paso;
  return n;
}

// ---------- Escombros: piezas de robot, miembros, armas, objetos ----------
export const piezas = [];
const MAX_PIEZAS = 110, _bb = new THREE.Box3(), _s = new V3(), _c = new V3(), _p = new V3(), _q = new THREE.Quaternion(), _ws = new V3();
// m: malla (o grupo) que sale volando · v: velocidad inicial (V3) · o: { vida, densidad, giro }
export function escombro(m, v, o = {}) {
  if (!FIS.listo) { if (m.isMesh) toDebris(m, v); else { m.traverse(x => { if (x.isMesh) x.userData.enemy = null; }); toDebris(m, v); } return null; }
  if (piezas.length >= MAX_PIEZAS) quitarPieza(piezas[0]);
  scene.attach(m); m.traverse(x => { if (x.isMesh) x.userData.enemy = null; });
  m.updateMatrixWorld(true);
  // caja de colisión en el marco de la pieza (con su escala de mundo)
  m.getWorldScale(_ws);
  if (m.isMesh) { const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); _bb.copy(g.boundingBox); }
  else { _bb.makeEmpty(); const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(); m.traverse(x => { if (!x.isMesh) return; const g = x.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, x.matrixWorld)); _bb.union(b); }); if (_bb.isEmpty()) _bb.setFromCenterAndSize(_c.set(0, 0, 0), _s.set(.1, .1, .1)); _ws.set(1, 1, 1).multiply(m.getWorldScale(new V3())); }
  _bb.getSize(_s).multiply(_ws); _bb.getCenter(_c).multiply(_ws);
  m.getWorldPosition(_p); m.getWorldQuaternion(_q);
  const R = FIS.R, w = FIS.world;
  const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(_p.x, _p.y, _p.z).setRotation(_q).setLinearDamping(.15).setAngularDamping(.4).setCcdEnabled(Math.min(_s.x, _s.y, _s.z) < .06));
  const gv = o.giro ?? 9;
  body.setLinvel({ x: v.x, y: v.y, z: v.z }, true); body.setAngvel({ x: rnd(-gv, gv), y: rnd(-gv, gv), z: rnd(-gv, gv) }, true);
  w.createCollider(R.ColliderDesc.cuboid(Math.max(.015, _s.x / 2), Math.max(.015, _s.y / 2), Math.max(.015, _s.z / 2)).setTranslation(_c.x, _c.y, _c.z).setDensity(o.densidad ?? 1200).setFriction(.8).setRestitution(.25).setCollisionGroups(grupos(BIT.ESC, 0xffff)), body);
  const pz = { m, body, tr: seguir(body), vida: o.vida ?? 10, quieto: 0, escala: m.scale.clone() };
  piezas.push(pz); return pz;
}
function soltarCuerpo(pz) { if (!pz.body) return; dejar(pz.tr); FIS.world.removeRigidBody(pz.body); pz.body = null; }
export function quitarPieza(pz) { soltarCuerpo(pz); pz.m.removeFromParent(); const i = piezas.indexOf(pz); if (i >= 0) piezas.splice(i, 1); }
export function actualizarPiezas(dt) {
  for (let i = piezas.length - 1; i >= 0; i--) {
    const pz = piezas[i]; pz.vida -= dt;
    if (pz.body) {
      poseInterp(pz.tr, pz.m.position, pz.m.quaternion);
      // en reposo: quitamos el cuerpo (ahorra CPU en las Quest); la malla se queda quieta donde cayó
      if (pz.body.isSleeping()) { pz.quieto += dt; if (pz.quieto > .4) soltarCuerpo(pz); } else pz.quieto = 0;
      if (pz.m.position.y < -30) pz.vida = 0;
    }
    if (pz.vida < 1.2) pz.m.scale.copy(pz.escala).multiplyScalar(Math.max(.001, pz.vida / 1.2));
    if (pz.vida <= 0) quitarPieza(pz);
  }
}
export function limpiarPiezas() { while (piezas.length) quitarPieza(piezas[0]); }
// empuja las piezas cercanas a un punto (explosiones, golpes contra el suelo)
export function empujarPiezas(p, radio, fuerza) {
  for (const pz of piezas) { if (!pz.body) continue; const t = pz.body.translation(), dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z, d = Math.hypot(dx, dy, dz); if (d > radio || d < 1e-4) continue; const k = fuerza * (1 - d / radio) * pz.body.mass() / d; pz.body.applyImpulse({ x: dx * k, y: dy * k + fuerza * .3, z: dz * k }, true); }
}
