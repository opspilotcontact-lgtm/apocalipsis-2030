// Personajes de la historia con esqueleto (ActorGLB): carga con respaldo, holograma, ojos que brillan y una capa
// procedural sobre los huesos mixamorig para lo que no tiene clip (tocarse la nuca, coger con dos manos, herido en el suelo).
// Lo usan npcs.js, juego/ecos.js y juego/camaras.js. Si un .glb no carga, quien llama cae a su modelo anterior.
import { THREE, V3 } from '../nucleo.js';
import { holograma } from '../cuerpos.js';
import { precargarActor, cargarClips, crearActor } from '../combate/actor.js';
import { quitarPiel } from '../combate/piel.js';

// clips de la biblioteca (assets/personajes/anim) que usan los PNJ con esqueleto
export const CLIPS_PNJ = ['Breathing_Idle', 'Nervously_Look_Around', 'Standing_Arguing', 'Sad_Idle', 'Crying', 'Pointing', 'Head_Hit', 'Hit_Reaction', 'Big_Side_Hit', 'Talking_On_Phone', 'Sitting', 'Waving'];
const listo = {};
// promesa → true si el modelo y los clips cargaron (una sola vez por modelo)
export function prepararModelo(modelo) {
  return listo[modelo] ||= Promise.all([precargarActor(modelo), cargarClips(CLIPS_PNJ)]).then(() => true)
    .catch(e => { console.warn('[actores] ' + modelo + ' no cargó; uso el modelo anterior', e); return false; });
}

// crea el actor; o: { alto, holo (color), capa (layer), ojos: { color, sep, alto, delante }, casco (color), resDanio }
export function crearCuerpo(modelo, o = {}) {
  const holo = o.holo != null;
  const A = crearActor(modelo, { altura: o.alto, resDanio: holo || o.sinDanio ? 16 : (o.resDanio || 512) });
  const hit = new Set(A.hit);
  if (holo || o.sinDanio) for (const m of A.hit) m.raycast = () => {};
  if (holo) {
    if (A.est) { quitarPiel(A.est); A.est = null; }
    const mat = new THREE.MeshBasicMaterial({ color: o.holo, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    A.raiz.traverse(m => { if (m.isMesh && !hit.has(m)) { m.material = mat; m.castShadow = false; m.receiveShadow = false; m.raycast = () => {}; m.renderOrder = 1000; } });
    A.holoMat = mat;
  }
  A.raiz.updateMatrixWorld(true);
  if (o.ojos && A.H.Head) A.ojos = ojos(A, o.ojos);
  if (o.casco && A.H.Head) { // el casco neural sobre la cabeza (R-01 en la grabación)
    const c = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8, 0, 6.3, 0, 1.9), A.holoMat || holograma(new THREE.Group(), o.casco));
    c.renderOrder = 1000; c.raycast = () => {}; A.H.Head.getWorldPosition(_a); c.position.copy(_a).y += .1; A.H.Head.attach(c); A.casco = c;
  }
  if (o.capa != null) A.root.traverse(m => { if (m.isMesh || m.isPoints) m.layers.set(o.capa); });
  return A;
}
// dos puntos de luz pegados a la cabeza (no hay malla de ojos: se colocan delante de la cara)
function ojos(A, o) {
  const H = A.H.Head, f = new V3(0, 0, 1), g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: o.color || 0x7ff3ff, toneMapped: false });
  const geo = new THREE.SphereGeometry(o.radio || .012, 8, 6);
  H.getWorldPosition(_a);
  for (const s of o.uno ? [0] : [-1, 1]) { const m = new THREE.Mesh(geo, mat); m.position.set(_a.x + s * (o.sep ?? .033), _a.y + (o.alto ?? .03), _a.z + (o.delante ?? .1)); m.raycast = () => {}; g.add(m); }
  A.root.add(g); for (const m of [...g.children]) H.attach(m);
  g.removeFromParent(); return { mat, base: (o.color || 0x7ff3ff) };
}

// ---------- capa procedural sobre los huesos (después del mezclador) ----------
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qp = new THREE.Quaternion(), Y = new V3(0, 1, 0);
export function rotarMundo(b, eje, ang) {
  if (!b || !ang) return; b.getWorldQuaternion(_q); _q2.setFromAxisAngle(eje, ang); _q.premultiply(_q2);
  b.parent.getWorldQuaternion(_qp).invert(); b.quaternion.copy(_qp.multiply(_q)); b.updateMatrixWorld(true);
}
// gira el hueso b para que su hijo quede en la dirección dir (mundo), con peso 0..1
export function apuntar(b, hijo, dir, peso = 1) {
  if (!b || !hijo || peso <= 0) return; b.getWorldPosition(_a); hijo.getWorldPosition(_b); _c.subVectors(_b, _a).normalize();
  _q2.setFromUnitVectors(_c, _b.copy(dir).normalize()); _q.identity().slerp(_q2, Math.min(1, peso)); b.getWorldQuaternion(_q2); _q2.premultiply(_q);
  b.parent.getWorldQuaternion(_qp).invert(); b.quaternion.copy(_qp.multiply(_q2)); b.updateMatrixWorld(true);
}
// ejes del personaje: fwd (+Z del modelo) y lat (su izquierda; girar en +lat inclina hacia delante)
export function ejes(A) { const ry = A.root.rotation.y; return { fwd: new V3(Math.sin(ry), 0, Math.cos(ry)), lat: new V3(Math.cos(ry), 0, -Math.sin(ry)) }; }
const d3 = (e, f, u, l) => new V3().addScaledVector(e.fwd, f).addScaledVector(Y, u).addScaledVector(e.lat, l).normalize();

// gestos sin clip: nuca (el tic de Mike, y de R-01) · coger (dos manos al frente) · cabizbajo · rendirse
export function gestoActor(A, tipo, w, t = 0) {
  if (w <= 0) return false; const H = A.H, e = ejes(A);
  switch (tipo) {
    case 'nuca': {
      apuntar(H.RightArm, H.RightForeArm, d3(e, .15, .6, -.78), w);
      H.Neck.getWorldPosition(_d); _d.addScaledVector(e.fwd, -.07).addScaledVector(e.lat, -.02); H.RightForeArm.getWorldPosition(_e);
      apuntar(H.RightForeArm, H.RightHand, _d.sub(_e), w); // _d/_e: apuntar usa _a/_b/_c por dentro
      rotarMundo(H.Neck, e.lat, (.25 + Math.sin(t * 3) * .05) * w); return true;
    }
    case 'coger':
      for (const s of ['Left', 'Right']) { const l = s === 'Left' ? .12 : -.12; apuntar(H[s + 'Arm'], H[s + 'ForeArm'], d3(e, .8, -.55, l), w); apuntar(H[s + 'ForeArm'], H[s + 'Hand'], d3(e, .95, -.05, -l * 1.5), w); }
      return true;
    case 'cabizbajo': rotarMundo(H.Neck, e.lat, .45 * w); rotarMundo(H.Spine2, e.lat, .1 * w); return true;
    case 'rendirse':
      for (const s of ['Left', 'Right']) { const l = s === 'Left' ? .35 : -.35; apuntar(H[s + 'Arm'], H[s + 'ForeArm'], d3(e, .1, .9, l), w); apuntar(H[s + 'ForeArm'], H[s + 'Hand'], d3(e, 0, 1, l * .3), w); }
      return true;
  }
  return false;
}

// herido en el suelo, sentado contra la pared (sobre el clip «Sitting»): baja la cadera al suelo, estira las piernas,
// echa la espalda atrás, la mano derecha en el vientre y la izquierda en el suelo; respira con dificultad
export function poseHeridoActor(A, t) {
  const H = A.H, e = ejes(A); if (!H.Hips) return;
  H.Hips.getWorldPosition(_c); const suelo = A.root.position.y + .16; A.raiz.position.y += suelo - _c.y; A.raiz.updateMatrixWorld(true);
  apuntar(H.LeftUpLeg, H.LeftLeg, d3(e, 1, .02, .14), 1); apuntar(H.LeftLeg, H.LeftFoot, d3(e, 1, -.1, .1), 1);
  apuntar(H.RightUpLeg, H.RightLeg, d3(e, .7, .62, -.12), 1); apuntar(H.RightLeg, H.RightFoot, d3(e, .55, -.85, -.05), 1);
  const resp = Math.sin(t * 2.1) * .03;
  rotarMundo(H.Spine, e.lat, -.32 + resp); rotarMundo(H.Spine2, e.lat, .08);
  apuntar(H.RightArm, H.RightForeArm, d3(e, .45, -.8, .25), .9); apuntar(H.RightForeArm, H.RightHand, d3(e, .3, -.15, .9), .9);
  apuntar(H.LeftArm, H.LeftForeArm, d3(e, .1, -.85, .45), .85); apuntar(H.LeftForeArm, H.LeftHand, d3(e, .55, -.75, .3), .85);
  rotarMundo(H.Neck, e.lat, .35 + Math.sin(t * .8) * .04); rotarMundo(H.Head, Y, .25);
}
export function quitarPoseHerido(A) { if (A.raiz.position.y) { A.raiz.position.y = 0; A.raiz.updateMatrixWorld(true); } }
// parpadeo de holograma
export function parpadeo(mat, base = .22) { if (mat) mat.opacity = base + Math.random() * .1 + (Math.sin(performance.now() * .03) > .9 ? .18 : 0); }
