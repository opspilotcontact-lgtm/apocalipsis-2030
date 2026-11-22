// Ragdoll con Rapier para personajes con rig por código (cuerpos.js: hips, spine, neck, armL/R{sh,el}, legL/R{hp,kn,an})
// y para personajes .glb con esqueleto mixamorig (Hips, Spine2, Head, LeftArm, LeftForeArm, LeftUpLeg, LeftLeg…).
//
// Cómo funciona:
//   · Un cuerpo rígido por segmento (pelvis, torso, cabeza, brazo, antebrazo, muslo, pierna), con el MISMO marco
//     que su grupo/hueso en el momento de morir → la pose actual es la pose inicial del ragdoll.
//   · Articulaciones: rótula (spherical) en hombros y caderas; bisagra con límites (revolute) en codos, rodillas,
//     cuello y cintura. Sin colisión entre las piezas del mismo cuerpo (bit de grupo propio), sí con el resto.
//   · Cada fotograma se escribe la pose (interpolada) de cada cuerpo en su grupo/hueso, de padre a hijo.
//   · A los pocos segundos (o cuando todo duerme) se CONGELA: se borran los cuerpos y queda el cadáver posado.
//   · Máximo 6 ragdolls simulando a la vez (Quest): al pasar del tope se congela el más viejo.
import { THREE, V3, mix } from '../nucleo.js';
import { FIS, grupos, bitRagdoll, seguir, dejar, poseInterp } from './fisica.js';

export const MAX_RAGDOLLS = 6;
export const activos = [];
const libres = [0, 1, 2, 3, 4, 5];
const _p = new V3(), _q = new THREE.Quaternion(), _s = new V3(), _a = new V3(), _b = new V3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _qi = new THREE.Quaternion();
const Y = new V3(0, 1, 0);

// ---------- Segmentos ----------
// Cada segmento: { k, o (Object3D), padre (k), forma: 'caja'|'bola'|'capsula', h (semiejes caja, local), c (centro local),
//                  r (radio local), fin (punto final local para cápsulas), art: 'bisagra'|'rotula', lim: [min,max] }
// Las medidas van en unidades LOCALES del grupo/hueso y se pasan a metros con su escala de mundo.
function segmentosRig(R) {
  const rob = !R.humano;
  const segs = [
    { k: 'pelvis', o: R.hips, forma: 'caja', h: rob ? [.19, .1, .13] : [.17, .1, .11], c: [0, 0, 0] },
    { k: 'torso', o: R.spine, padre: 'pelvis', forma: 'caja', h: rob ? [.25, .27, .15] : [.2, .27, .12], c: [0, .3, 0], art: 'bisagra', lim: [-.35, .9] },
    { k: 'cabeza', o: R.neck, padre: 'torso', forma: 'bola', r: rob ? .15 : .12, c: [0, .17, 0], art: 'bisagra', lim: [-.6, .8], perdido: 'head' }
  ];
  for (const s of ['L', 'R']) {
    const A = s === 'L' ? R.armL : R.armR, Lg = s === 'L' ? R.legL : R.legR;
    segs.push({ k: 'brazo' + s, o: A.sh, padre: 'torso', forma: 'capsula', r: rob ? .07 : .055, fin: A.el.position.toArray(), art: 'rotula', perdido: 'arm' + s });
    segs.push({ k: 'antebrazo' + s, o: A.el, padre: 'brazo' + s, forma: 'capsula', r: rob ? .065 : .048, fin: [0, -.4, 0], art: 'bisagra', lim: [-2.3, .05], perdido: 'foreArm' + s });
    segs.push({ k: 'muslo' + s, o: Lg.hp, padre: 'pelvis', forma: 'capsula', r: rob ? .085 : .07, fin: Lg.kn.position.toArray(), art: 'rotula', perdido: 'leg' + s });
    segs.push({ k: 'pierna' + s, o: Lg.kn, padre: 'muslo' + s, forma: 'capsula', r: rob ? .075 : .06, fin: [0, -.46, 0], art: 'bisagra', lim: [-.05, 2.3], perdido: 'shin' + s });
  }
  return segs;
}
// mixamorig: [k, hueso, padre, hueso final (o null), forma, radio relativo a la altura, art, lim]
const MIXAMO = [
  ['pelvis', 'Hips', null, 'Spine', 'capsula', .075],
  ['torso', 'Spine2', 'pelvis', 'Neck', 'capsula', .09, 'rotula'],
  ['cabeza', 'Head', 'torso', 'HeadTop_End', 'bola', .065, 'rotula'],
  ['brazoL', 'LeftArm', 'torso', 'LeftForeArm', 'capsula', .033, 'rotula'], ['antebrazoL', 'LeftForeArm', 'brazoL', 'LeftHand', 'capsula', .028, 'rotula'],
  ['brazoR', 'RightArm', 'torso', 'RightForeArm', 'capsula', .033, 'rotula'], ['antebrazoR', 'RightForeArm', 'brazoR', 'RightHand', 'capsula', .028, 'rotula'],
  ['musloL', 'LeftUpLeg', 'pelvis', 'LeftLeg', 'capsula', .045, 'rotula'], ['piernaL', 'LeftLeg', 'musloL', 'LeftFoot', 'capsula', .038, 'bisagra', [-.05, 2.3]],
  ['musloR', 'RightUpLeg', 'pelvis', 'RightLeg', 'capsula', .045, 'rotula'], ['piernaR', 'RightLeg', 'musloR', 'RightFoot', 'capsula', .038, 'bisagra', [-.05, 2.3]]
];
export const nombreHueso = n => n.replace(/^mixamorig\d*[:_]?/, '');
export function huesosMixamo(raiz) { const h = {}; raiz.traverse(o => { if (o.isBone) h[nombreHueso(o.name)] = o; }); return h; }
function segmentosMixamo(raiz) {
  const H = huesosMixamo(raiz); if (!H.Hips) return null;
  raiz.updateMatrixWorld(true);
  const alto = Math.max(.5, H.Head ? H.Head.getWorldPosition(_a).y - (H.LeftFoot ? H.LeftFoot.getWorldPosition(_b).y : H.Hips.getWorldPosition(_b).y - .9) + .15 : 1.75);
  const segs = [];
  for (const [k, n, padre, nFin, forma, rr, art, lim] of MIXAMO) {
    const o = H[n]; if (!o || o.scale.x < .01) continue; // miembro arrancado (hueso escalado a 0)
    o.getWorldPosition(_a);
    if (nFin && H[nFin]) H[nFin].getWorldPosition(_b); else _b.copy(_a).addScaledVector(Y, alto * .11);
    // fin en coordenadas locales del hueso (sin escala: lo pasamos a mundo luego multiplicando por la escala)
    o.getWorldScale(_s); o.getWorldQuaternion(_qi).invert();
    const fin = _b.sub(_a).applyQuaternion(_qi).divide(_s).toArray();
    const r = rr * alto / _s.x;
    segs.push(forma === 'bola' ? { k, o, padre, forma, r, c: fin.map(v => v * .5), art, lim } : { k, o, padre, forma, r, fin, art: art || 'rotula', lim });
  }
  return segs;
}

// ---------- Crear ----------
// R: rig por código (de makeRobot/makeHuman) o raíz de un .glb con SkinnedMesh mixamorig
// o: { dir (V3, dirección del golpe), fuerza (m/s extra en el segmento golpeado), zona ('head','torso'…), punto (V3),
//      vel (V3, velocidad del personaje al morir), densidad, perdidos (set de claves que no existen ya) }
export function crearRagdoll(R, o = {}) {
  if (!FIS.listo) return null;
  if (R._rag) { if (o.dir) empujar(R._rag, o.punto, o.dir, o.fuerza || 2, o.zona); return R._rag; }
  if (activos.length >= MAX_RAGDOLLS) congelar(activos[0]);
  const raiz = R.root || R; raiz.updateMatrixWorld(true);
  const segs = R.hips ? segmentosRig(R) : segmentosMixamo(raiz); if (!segs) return null;
  const perdidos = R.lost || {}, slot = libres.shift(), bit = bitRagdoll(slot);
  const W = FIS.world, RA = FIS.R, dens = o.densidad ?? (R.humano || !R.hips ? 1000 : 1800); // kg/m³
  const rag = { R, raiz, slot, t: 0, quieto: 0, partes: [], por: {}, juntas: [] };
  for (const sg of segs) {
    if (sg.perdido && perdidos[sg.perdido]) continue;
    if (sg.padre && !rag.por[sg.padre]) continue; // su padre ya no existe (miembro arrancado)
    const ob = sg.o; ob.getWorldPosition(_p); ob.getWorldQuaternion(_q); ob.getWorldScale(_s);
    const ws = _s.x;
    const body = W.createRigidBody(RA.RigidBodyDesc.dynamic().setTranslation(_p.x, _p.y, _p.z).setRotation(_q).setLinearDamping(.35).setAngularDamping(2.2).setCcdEnabled(sg.k === 'cabeza' || sg.k.startsWith('ante')));
    let cd;
    if (sg.forma === 'caja') cd = RA.ColliderDesc.cuboid(sg.h[0] * ws, sg.h[1] * ws, sg.h[2] * ws).setTranslation(sg.c[0] * ws, sg.c[1] * ws, sg.c[2] * ws);
    else if (sg.forma === 'bola') cd = RA.ColliderDesc.ball(sg.r * ws).setTranslation(sg.c[0] * ws, sg.c[1] * ws, sg.c[2] * ws);
    else {
      _a.fromArray(sg.fin).multiplyScalar(ws); const L = _a.length(), r = Math.min(sg.r * ws, L * .45);
      cd = RA.ColliderDesc.capsule(Math.max(.01, L / 2 - r), r).setTranslation(_a.x / 2, _a.y / 2, _a.z / 2).setRotation(new THREE.Quaternion().setFromUnitVectors(Y, _b.copy(_a).normalize()));
    }
    cd.setDensity(dens).setFriction(.95).setRestitution(.05).setCollisionGroups(grupos(bit, 0xffff & ~bit));
    W.createCollider(cd, body);
    const parte = { k: sg.k, o: ob, body, tr: seguir(body), ws: _s.clone() };
    rag.partes.push(parte); rag.por[sg.k] = parte;
    // articulación con el padre, en el origen del grupo/hueso hijo
    if (sg.padre) {
      const pb = rag.por[sg.padre].body, pt = pb.translation(), pr = pb.rotation();
      _qi.set(pr.x, pr.y, pr.z, pr.w).invert();
      const a1 = _a.set(_p.x - pt.x, _p.y - pt.y, _p.z - pt.z).applyQuaternion(_qi);
      let jd;
      if (sg.art === 'bisagra') { jd = RA.JointData.revolute({ x: a1.x, y: a1.y, z: a1.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }); }
      else jd = RA.JointData.spherical({ x: a1.x, y: a1.y, z: a1.z }, { x: 0, y: 0, z: 0 });
      const j = W.createImpulseJoint(jd, pb, body, true);
      if (sg.art === 'bisagra' && sg.lim && j.setLimits) j.setLimits(sg.lim[0], sg.lim[1]);
      j.setContactsEnabled?.(false);
      rag.juntas.push(j);
    }
  }
  // velocidad heredada + golpe
  if (o.vel) for (const pa of rag.partes) pa.body.setLinvel({ x: o.vel.x, y: o.vel.y, z: o.vel.z }, true);
  if (o.dir) empujar(rag, o.punto, o.dir, o.fuerza ?? 3, o.zona);
  R._rag = rag; activos.push(rag);
  return rag;
}

// zona de daño → segmento del ragdoll
const SEG_DE_ZONA = { head: 'cabeza', neck: 'cabeza', torso: 'torso', pelvis: 'pelvis' };
export function segDeZona(z) {
  if (!z) return 'torso'; if (SEG_DE_ZONA[z]) return SEG_DE_ZONA[z];
  const s = z.slice(-1);
  if (z.startsWith('upperArm')) return 'brazo' + s; if (z.startsWith('foreArm') || z.startsWith('hand')) return 'antebrazo' + s;
  if (z.startsWith('thigh')) return 'muslo' + s; if (z.startsWith('shin') || z.startsWith('foot')) return 'pierna' + s;
  return 'torso';
}
// fuerza en m/s de cambio de velocidad del segmento golpeado; el resto del cuerpo recibe un poco (arrastre)
export function empujar(rag, punto, dir, fuerza, zona) {
  const pa = rag.por[segDeZona(zona)] || rag.por.torso || rag.partes[0]; if (!pa) return;
  rag.t = Math.min(rag.t, 1.5); rag.quieto = 0;
  const m = pa.body.mass(), imp = { x: dir.x * fuerza * m, y: (dir.y * fuerza + fuerza * .25) * m, z: dir.z * fuerza * m };
  if (punto) pa.body.applyImpulseAtPoint(imp, { x: punto.x, y: punto.y, z: punto.z }, true); else pa.body.applyImpulse(imp, true);
  for (const o of rag.partes) if (o !== pa) { const k = o.body.mass() * fuerza * .18; o.body.applyImpulse({ x: dir.x * k, y: 0, z: dir.z * k }, true); }
}

// ---------- Cada fotograma ----------
export function actualizarRagdolls(dt) {
  for (let i = activos.length - 1; i >= 0; i--) {
    const rag = activos[i]; rag.t += dt;
    for (const pa of rag.partes) {
      poseInterp(pa.tr, _p, _q);
      _m.compose(_p, _q, pa.ws);
      const par = pa.o.parent; par.updateWorldMatrix(true, false);
      _inv.copy(par.matrixWorld).invert().multiply(_m);
      _inv.decompose(pa.o.position, pa.o.quaternion, pa.o.scale);
      pa.o.matrix.copy(_inv); pa.o.matrixWorld.copy(_m);
    }
    let duermen = true; for (const pa of rag.partes) if (!pa.body.isSleeping()) { duermen = false; break; }
    rag.quieto = duermen ? rag.quieto + dt : 0;
    if (rag.quieto > .3 || rag.t > 6) congelar(rag);
  }
}
// deja el cadáver posado y libera la física
export function congelar(rag) {
  const i = activos.indexOf(rag); if (i < 0) return; activos.splice(i, 1);
  for (const pa of rag.partes) { dejar(pa.tr); FIS.world.removeRigidBody(pa.body); }
  rag.partes.length = 0; rag.juntas.length = 0; libres.push(rag.slot); libres.sort(); rag.R._rag = null;
  rag.raiz.updateMatrixWorld(true);
}
export function limpiarRagdolls() { while (activos.length) congelar(activos[0]); }
// para depurar desde la consola
export const estadoRagdolls = () => ({ activos: activos.length, cuerpos: activos.reduce((n, r) => n + r.partes.length, 0) });
