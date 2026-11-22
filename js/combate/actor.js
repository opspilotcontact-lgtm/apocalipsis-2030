// ActorGLB: personaje realista con esqueleto mixamorig como actor de combate (y, más adelante, de historia).
// Ver docs/actor-glb.md. Resumen:
//   await precargarActor('Dave_animado')               // una vez (carga el .glb con KTX2 + meshopt)
//   const a = crearActor('Dave_animado', { altura })    // clon con SkeletonUtils: mezclador, hitboxes, textura de daño
//   a.root (Group a colocar) · a.actualizar(dt, { vel, mirar, ataque }) cada fotograma
//   a.reproducir('HitHead') · a.herida(punto, dir, tipo, dmg) · a.desmembrar('head'|'armL'…) · a.morir({dir, punto, fuerza})
// Biblioteca de clips: los del propio .glb + los que el agente de assets deje en assets/personajes/anim/<Nombre>.glb
// (un clip por archivo, mismo esqueleto mixamorig, «en el sitio»). Si un clip no existe, se usa un sustituto
// (tabla ALIAS) y, para golpes y puñetazos, la capa procedural sobre los huesos.
import { THREE, V3, G, clamp, mix, rnd, renderer, scene } from '../nucleo.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { huesosMixamo, crearRagdoll } from './ragdoll.js';
import { prepararPiel, golpearSkinned, quitarPiel } from './piel.js';
import { desmembrarHueso } from './danio.js';
import { salpicar } from './particulas.js';
import { charco } from './entorno.js';

let loader = null;
function cargador() {
  if (loader) return loader;
  const ktx = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').detectSupport(renderer);
  return loader = new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
}
// cualquier .glb del proyecto (armas, props) con el mismo cargador KTX2 + meshopt
export const cargarGLB = ruta => cargador().loadAsync(ruta);
// ---------- Modelos y clips ----------
const modelos = new Map();   // nombre → Promise<base>
const base = new Map();      // nombre → { escena, clips: Map, vel: Map }
export const clipsExtra = new Map(); // nombre de clip → { clip, vel }
export function precargarActor(nombre, ruta = `assets/personajes/${nombre}.glb`) {
  if (!modelos.has(nombre)) modelos.set(nombre, cargador().loadAsync(ruta).then(g => {
    const clips = new Map(), vel = new Map();
    g.animations.forEach((c, i) => { clips.set(c.name, c); const ex = g.parser.json.animations?.[i]?.extras; if (ex?.velocidad_raiz_mps) vel.set(c.name, ex.velocidad_raiz_mps); });
    g.scene.traverse(x => { if (x.isSkinnedMesh) indice(x.geometry); }); // índice de triángulos por hueso: 1 vez por modelo
    const b = { escena: g.scene, clips, vel }; base.set(nombre, b); return b;
  }));
  return modelos.get(nombre);
}
export const actorListo = nombre => base.has(nombre);
// carga clips sueltos de la biblioteca (los que falten se ignoran sin error)
const pedidos = new Map();
export function cargarClips(nombres, carpeta = 'assets/personajes/anim') {
  return Promise.all(nombres.map(n => {
    if (clipsExtra.has(n)) return true;
    if (!pedidos.has(n)) pedidos.set(n, cargador().loadAsync(`${carpeta}/${encodeURIComponent(n)}.glb`).then(g => {
      const c = g.animations[0]; if (!c) return false; c.name = n;
      const e = { clip: c, vel: g.parser.json.animations?.[0]?.extras?.velocidad_raiz_mps || 0 };
      // la biblioteca usa guiones bajos (Head_Hit); ALIAS y el código antiguo, espacios (Head Hit): valen los dos
      clipsExtra.set(n, e); clipsExtra.set(n.replace(/_/g, ' '), e); return true;
    }).catch(() => false));
    return pedidos.get(n);
  }));
}
export function registrarClip(nombre, clip, vel = 0) { clip.name = nombre; clipsExtra.set(nombre, { clip, vel }); }
// sustitutos en orden de preferencia
export const ALIAS = {
  idle: ['Idle', 'Breathing Idle', 'Rifle Idle'], walk: ['Walk', 'Walking'], run: ['Running', 'Run'],
  cojo: ['Injured Walk'], cojoQuieto: ['Injured Idle'], punch: ['Punching', 'Punch'],
  golpeCabeza: ['HitHead', 'Head Hit'], golpeTorso: ['Stomach Hit', 'Hit Reaction'], golpeLado: ['Big Side Hit', 'Hit Reaction'],
  morir: ['Dying', 'Falling Back Death', 'Death From Front Headshot'], levantarse: ['Getting Up'], buscar: ['Nervously Look Around']
};
export const LIBRERIA_SUGERIDA = ['Running', 'Injured Walk', 'Injured Idle', 'Punching', 'Stomach Hit', 'Hit Reaction', 'Big Side Hit', 'Head Hit', 'Getting Up', 'Dying', 'Falling Back Death', 'Death From Front Headshot', 'Nervously Look Around', 'Rifle Idle', 'Firing Rifle', 'Right Strafe Walking', 'Crouched Walking'];

// ---------- Hitboxes invisibles por hueso (raycast barato; el skinned mesh solo se rayea 1 vez para pintar) ----------
const matHit = new THREE.MeshBasicMaterial({ visible: false });
// [hueso, hijo (para la longitud), zona, radio (m), forma]
const HIT = [
  ['Head', 'HeadTop_End', 'head', .11, 'bola'], ['Neck', 'Head', 'neck', .06], ['Spine2', 'Neck', 'torso', .17], ['Spine1', 'Spine2', 'torso', .16], ['Spine', 'Spine1', 'pelvis', .15], ['Hips', 'Spine', 'pelvis', .16],
  ...['Left', 'Right'].flatMap(s => { const k = s[0]; return [[s + 'Arm', s + 'ForeArm', 'upperArm' + k, .055], [s + 'ForeArm', s + 'Hand', 'foreArm' + k, .045], [s + 'Hand', s + 'HandMiddle1', 'hand' + k, .045], [s + 'UpLeg', s + 'Leg', 'thigh' + k, .08], [s + 'Leg', s + 'Foot', 'shin' + k, .06], [s + 'Foot', s + 'ToeBase', 'foot' + k, .05]]; })
];
const _a = new V3(), _b = new V3(), _c = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qp = new THREE.Quaternion(), Y = new V3(0, 1, 0);
function crearHitboxes(H, raiz) {
  raiz.updateMatrixWorld(true); const out = [];
  for (const [n, nh, zona, r, forma] of HIT) {
    const b = H[n]; if (!b) continue; b.getWorldPosition(_a);
    const h = H[nh]; if (h) h.getWorldPosition(_b); else _b.copy(_a).add(_c.set(0, .2, 0));
    const L = Math.max(r * 1.2, _a.distanceTo(_b));
    const geo = forma === 'bola' ? new THREE.SphereGeometry(r, 8, 6) : new THREE.CylinderGeometry(r, r, L, 8);
    const m = new THREE.Mesh(geo, matHit); m.position.lerpVectors(_a, _b, .5);
    if (forma !== 'bola') m.quaternion.setFromUnitVectors(Y, _c.subVectors(_b, _a).normalize());
    scene.add(m); b.attach(m); m.userData.zona = zona; m.userData.part = zona === 'head' ? 'head' : zona.startsWith('upperArm') || zona.startsWith('foreArm') || zona.startsWith('hand') ? 'arm' : zona.startsWith('thigh') || zona.startsWith('shin') || zona.startsWith('foot') ? 'leg' : 'torso';
    m.geometry.computeBoundingBox(); out.push(m);
  }
  return out;
}

// ---------- Rayo rápido en la pose de reposo: triángulos agrupados por hueso dominante (se calcula 1 vez por modelo) ----------
function indice(geo) {
  if (geo.userData.indiceHuesos) return geo.userData.indiceHuesos;
  const P = geo.attributes.position, UV = geo.attributes.uv, J = geo.attributes.skinIndex, Wt = geo.attributes.skinWeight, n = P.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), dom = new Int16Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = P.getX(i); pos[i * 3 + 1] = P.getY(i); pos[i * 3 + 2] = P.getZ(i); uv[i * 2] = UV.getX(i); uv[i * 2 + 1] = UV.getY(i);
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = Wt.getComponent(i, k); if (w > bw) { bw = w; best = J.getComponent(i, k); } } dom[i] = best; }
  const idx = geo.index ? geo.index.array : null, nt = idx ? idx.length / 3 : n / 3, listas = new Map();
  for (let t = 0; t < nt; t++) { const a = idx ? idx[t * 3] : t * 3, bnum = dom[a]; let l = listas.get(bnum); if (!l) listas.set(bnum, l = []); l.push(t); }
  for (const [k, l] of listas) listas.set(k, Int32Array.from(l));
  return geo.userData.indiceHuesos = { pos, uv, idx, listas };
}
// Möller–Trumbore sobre los triángulos de unos huesos · o, d en el espacio de la geometría
function rayoHuesos(I, huesos, o, d) {
  const { pos, uv, idx, listas } = I; let mejor = Infinity, res = null;
  for (const h of huesos) { const l = listas.get(h); if (!l) continue;
    for (let k = 0; k < l.length; k++) { const t = l[k], a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2], e1x = pos[b * 3] - ax, e1y = pos[b * 3 + 1] - ay, e1z = pos[b * 3 + 2] - az, e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az;
      const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue; const inv = 1 / det, tx = o.x - ax, ty = o.y - ay, tz = o.z - az, u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d.x * qx + d.y * qy + d.z * qz) * inv; if (v < 0 || u + v > 1) continue;
      const dist = (e2x * qx + e2y * qy + e2z * qz) * inv; if (dist <= 0 || dist >= mejor) continue;
      mejor = dist; const w = 1 - u - v; res = { dist, face: { a, b, c }, uv: new THREE.Vector2(uv[a * 2] * w + uv[b * 2] * u + uv[c * 2] * v, uv[a * 2 + 1] * w + uv[b * 2 + 1] * u + uv[c * 2 + 1] * v) };
    } }
  return res;
}

// ---------- Rotaciones de hueso en espacio de mundo (independientes de los ejes de cada hueso) ----------
function rotarMundo(b, eje, ang) {
  if (!b || !ang) return; b.getWorldQuaternion(_q); _q2.setFromAxisAngle(eje, ang); _q.premultiply(_q2);
  b.parent.getWorldQuaternion(_qp).invert(); b.quaternion.copy(_qp.multiply(_q)); b.updateMatrixWorld(true);
}
function apuntar(b, hijo, dir, peso) {
  if (!b || !hijo || peso <= 0) return; b.getWorldPosition(_a); hijo.getWorldPosition(_b); _c.subVectors(_b, _a).normalize();
  _q2.setFromUnitVectors(_c, dir); _q.identity().slerp(_q2, Math.min(1, peso)); b.getWorldQuaternion(_q2); _q2.premultiply(_q);
  b.parent.getWorldQuaternion(_qp).invert(); b.quaternion.copy(_qp.multiply(_q2)); b.updateMatrixWorld(true);
}

// ---------- Actor ----------
export class ActorGLB {
  constructor(nombre, o = {}) {
    const B = base.get(nombre); if (!B) throw new Error('ActorGLB: precarga primero ' + nombre);
    this.nombre = nombre; this.B = B;
    this.root = new THREE.Group(); this.raiz = SkeletonUtils.clone(B.escena); this.root.add(this.raiz);
    if (o.altura) { this.raiz.updateMatrixWorld(true); this.raiz.traverse(x => { if (x.isSkinnedMesh) { x.skeleton.update(); x.boundingBox = null; } }); const bb = new THREE.Box3().setFromObject(this.raiz); /* sin matrices al día la piel mide ~0 y la escala se dispara */this.raiz.scale.multiplyScalar(o.altura / (bb.max.y - bb.min.y)); }
    this.escala = this.raiz.scale.x;
    this.raiz.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; x.frustumCulled = false; } });
    this.H = huesosMixamo(this.raiz); this.malla = null; this.raiz.traverse(x => { if (x.isSkinnedMesh && !this.malla) this.malla = x; });
    // esfera enorme: el rayo exacto contra la piel no depende de la pose de reposo (y no se recalcula, que es caro)
    // copia ESTÁTICA (pose de reposo) de la malla para el rayo de pintar: rayear la malla con piel cuesta 0,4-6 s
    // (aplica los huesos a 22k triángulos); aquí se lleva el rayo al espacio de reposo con la matriz del hueso golpeado
    if (this.malla) { this.bind = indice(this.malla.geometry); }
    this.mixer = new THREE.AnimationMixer(this.raiz); this.acc = new Map(); this.actual = null; this.unaVez = null;
    this.est = prepararPiel(this.raiz, { piel: o.piel || ['head', 'neck', 'handL', 'handR'], hp: 1e9, res: o.resDanio || 1024 });
    this.hit = crearHitboxes(this.H, this.raiz);
    this.muerto = false; this.dolor = null; this.roto = {}; this.t = Math.random() * 9; this.fase = 0; this.pintadas = 0;
    this.mirarPeso = 0; this.mirarA = new V3();
    this.mixer.addEventListener('finished', ev => { if (ev.action === this.unaVez) { this.unaVez.fadeOut(.25); this.unaVez = null; } });
    this.reproducir(this.clip('idle'));
  }
  // ---------- Clips ----------
  tieneClip(n) { return this.B.clips.has(n) || clipsExtra.has(n); }
  clip(alias) { for (const n of ALIAS[alias] || [alias]) if (this.tieneClip(n)) return n; return null; }
  velClip(n) { return (this.B.vel.get(n) || clipsExtra.get(n)?.vel || (n && /run/i.test(n) ? 3.5 : 1.5)) * this.escala; }
  accion(n) {
    if (!n) return null; let a = this.acc.get(n); if (a) return a;
    const c = this.B.clips.get(n) || clipsExtra.get(n)?.clip; if (!c) return null;
    a = this.mixer.clipAction(c); this.acc.set(n, a); return a;
  }
  // bucle con fundido cruzado
  reproducir(n, fade = .25, ts = 1) {
    const a = this.accion(n); if (!a) return false; a.timeScale = ts;
    if (this.actual === a) return true;
    a.reset(); a.setLoop(THREE.LoopRepeat); a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(fade).play();
    if (this.actual) this.actual.fadeOut(fade); this.actual = a; return true;
  }
  // un solo disparo por encima del bucle (golpe, puñetazo); devuelve false si no hay clip
  unDisparo(n, fade = .12, ts = 1) {
    const a = this.accion(n); if (!a) return false;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.timeScale = ts; a.setEffectiveWeight(1); a.fadeIn(fade).play();
    if (this.unaVez && this.unaVez !== a) this.unaVez.fadeOut(fade); this.unaVez = a; return true;
  }
  // ---------- Golpes ----------
  // zona de daño → clip de reacción si existe; si no, la capa procedural (e.dolor) hace el trabajo
  reaccion(zona) {
    const n = zona === 'head' || zona === 'neck' ? this.clip('golpeCabeza') : zona === 'torso' || zona === 'pelvis' ? this.clip('golpeTorso') : this.clip('golpeLado');
    return n ? this.unDisparo(n, .08, rnd(1, 1.25)) : false;
  }
  // pinta la herida exacta (1 rayo contra la malla con piel) y devuelve { zona, piel }
  // hueso: el de la hitbox golpeada (si no, el más cercano)
  herida(punto, dir, tipo, dmg, swing, hueso) {
    if (!this.malla || !this.bind || this.pintadas > 3) return null; this.pintadas++;
    const sk = this.malla.skeleton; let i = hueso ? sk.bones.indexOf(hueso) : -1;
    if (i < 0) { let md = 1e9; sk.bones.forEach((b, k) => { const d = b.getWorldPosition(_c).distanceTo(punto); if (d < md) { md = d; i = k; } }); }
    const M = ActorGLB._m.multiplyMatrices(sk.bones[i].matrixWorld, sk.boneInverses[i]).multiply(this.malla.bindMatrix), Mi = ActorGLB._mi.copy(M).invert();
    _a.copy(punto).addScaledVector(dir, -.45).applyMatrix4(Mi); _b.copy(dir).transformDirection(Mi);
    // el hueso golpeado, su padre y sus hijos (los bordes entre huesos)
    const b = sk.bones[i], vec = [i]; if (b.parent?.isBone) vec.push(sk.bones.indexOf(b.parent)); for (const c of b.children) if (c.isBone) vec.push(sk.bones.indexOf(c));
    const h = rayoHuesos(this.bind, vec, _a, _b); if (!h) return null;
    const pW = _a.addScaledVector(_b, h.dist).applyMatrix4(M);
    return golpearSkinned(this.est, { object: this.malla, point: pW, uv: h.uv, face: h.face }, dir, { tipo, dmg, swing });
  }
  // desmembrar: escala el hueso a 0 (la malla se cierra) y suelta un miembro rígido + muñón con sangre
  desmembrar(seg, dir) {
    const s = seg.slice(-1) === 'L' ? 'Left' : 'Right';
    const n = seg === 'head' ? 'Head' : seg.startsWith('arm') ? s + 'Arm' : seg.startsWith('foreArm') ? s + 'ForeArm' : seg.startsWith('leg') ? s + 'UpLeg' : s + 'Leg';
    const b = this.H[n]; if (!b || b.scale.x < .01) return null;
    const quitar = new Set(); b.traverse(x => { if (x.isMesh) quitar.add(x); }); this.hit = this.hit.filter(m => !quitar.has(m));
    const m = desmembrarHueso(this.raiz, n, dir, seg === 'head' ? ActorGLB.matPiel : seg.startsWith('leg') || seg.startsWith('shin') ? ActorGLB.matPantalon : ActorGLB.matMiembro);
    const p = b.parent.getWorldPosition(new V3()); const mun = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), ActorGLB.matMunon); scene.add(mun); mun.position.copy(b.getWorldPosition(new V3())); b.parent.attach(mun);
    salpicar(p, 20, 'sangre', null, 1.2);
    return m;
  }
  // ---------- Muerte ----------
  // R: objeto que guarda el ragdoll (el adaptador del enemigo, o la raíz del actor)
  morir(o = {}, R = this.raiz) {
    if (this.muerto) return null; this.muerto = true; this.mixer.stopAllAction(); this.raiz.updateMatrixWorld(true);
    const rag = crearRagdoll(R, o);
    if (!rag) { const n = this.clip('morir'); if (n) { this.muerto = false; this.unDisparo(n); this.accion(n).clampWhenFinished = true; this.muertoClip = true; } }
    return rag;
  }
  // ---------- Cada fotograma ----------
  // st: { vel (m/s), mirar (V3 o null), ataque (0..1 o -1), cojera (0..1), cojeraLado 'L'|'R', aturdido, dolor (canales de reacciones.js), rotos {armL,armR,legL,legR} }
  actualizar(dt, st = {}) {
    if (this.muerto && !this.muertoClip) return;
    this.t += dt; this.pintadas = 0;
    const v = Math.abs(st.vel || 0), roto = st.rotos || {}, pierna = roto.legL || roto.legR;
    if (!this.muertoClip) {
      // locomoción con velocidad de la animación igualada a la real (pies que no patinan)
      let n, ts = 1;
      if (v < .15) n = (pierna && this.clip('cojoQuieto')) || this.clip('idle');
      else {
        const corre = v > 2.6 && !pierna && this.clip('run');
        n = corre || (pierna && this.clip('cojo')) || this.clip('walk');
        ts = clamp(v / this.velClip(n), .5, 2.2);
      }
      this.reproducir(n, .3, ts); if (this.actual) this.actual.timeScale = ts;
      if (st.ataque >= 0 && st.ataque < .1 && !this.unaVez) this.unDisparo(this.clip('punch'), .1, 1.3);
    }
    this.mixer.update(dt); this.raiz.updateMatrixWorld(true);
    if (this.muertoClip) return;
    this.fase += dt * (v > .15 ? 5 * clamp(v / 1.6, .6, 2) : 0);
    this.capa(dt, st);
  }
  // capa procedural sobre los huesos (después del mezclador): reacciones, mirar, cojera, brazo roto, puñetazo sin clip
  capa(dt, st) {
    const H = this.H, ry = this.root.rotation.y, f = _a.set(Math.sin(ry), 0, Math.cos(ry)), izq = _b.set(Math.cos(ry), 0, -Math.sin(ry)); // izq = up × forward
    const fwd = f.clone(), lat = izq.clone();
    const d = st.dolor, roto = st.rotos || {};
    if (d) {
      rotarMundo(H.Spine1, lat, d.vientre * .5 - d.atras * .35 - d.cab * .12); rotarMundo(H.Spine2, Y, d.giro * .45 + (d.hombroL - d.hombroR) * .3);
      rotarMundo(H.Neck, lat, -d.cab * .45 + d.menton * .4); rotarMundo(H.Head, Y, d.cabY * .5); rotarMundo(H.Head, fwd, d.cabZ * .35);
      rotarMundo(H.LeftLeg, lat, d.rodillaL * .9); rotarMundo(H.RightLeg, lat, d.rodillaR * .9);
      rotarMundo(H.LeftUpLeg, lat, -d.rodillaL * .35 + d.patadaL * .5); rotarMundo(H.RightUpLeg, lat, -d.rodillaR * .35 + d.patadaR * .5);
      rotarMundo(H.LeftArm, fwd, -d.fueraL * .8); rotarMundo(H.RightArm, fwd, d.fueraR * .8);
      rotarMundo(H.LeftShoulder, lat, -d.hombroL * .3); rotarMundo(H.RightShoulder, lat, -d.hombroR * .3);
      const baja = Math.max(d.vientre * .05, d.rodillaL * .1, d.rodillaR * .1);
      if (baja > .002 && H.Hips) { H.Hips.getWorldPosition(_c); _c.y -= baja; H.Hips.position.copy(H.Hips.parent.worldToLocal(_c)); H.Hips.updateMatrixWorld(true); }
    }
    // cojera procedural (si no hay clip de andar herido): cadera que cae al apoyar la pierna mala, pierna rígida
    if ((st.cojera || 0) > .01 && !this.tieneClip('Injured Walk')) {
      const s = st.cojeraLado || 'L', apoyo = Math.max(0, s === 'L' ? Math.sin(this.fase) : -Math.sin(this.fase)) * st.cojera;
      if (H.Hips) { H.Hips.getWorldPosition(_c); _c.y -= apoyo * .06; H.Hips.position.copy(H.Hips.parent.worldToLocal(_c)); H.Hips.updateMatrixWorld(true); }
      rotarMundo(H.Spine, fwd, (s === 'L' ? 1 : -1) * apoyo * .12); rotarMundo(H[(s === 'L' ? 'Left' : 'Right') + 'Leg'], lat, -apoyo * .3);
    }
    // brazo roto: cuelga
    for (const s of ['L', 'R']) if (roto['arm' + s]) { const p = s === 'L' ? 'Left' : 'Right'; _c.set(0, -1, 0).addScaledVector(fwd, Math.sin(this.fase) * .12); apuntar(H[p + 'Arm'], H[p + 'ForeArm'], _c.normalize(), .85); apuntar(H[p + 'ForeArm'], H[p + 'Hand'], _c, .8); }
    // puñetazo procedural (sin clip): el brazo derecho se dispara al frente
    if (st.ataque >= 0 && !this.tieneClip('Punching') && !roto.armR) {
      const t = st.ataque, w = t < .55 ? t / .55 * .3 : t < .72 ? .3 + (t - .55) / .17 * .7 : 1 - (t - .72) / .28;
      _c.copy(fwd).addScaledVector(Y, .15).normalize(); apuntar(H.RightArm, H.RightForeArm, _c, w * .9); apuntar(H.RightForeArm, H.RightHand, _c, w);
      rotarMundo(H.Spine2, Y, -w * .35);
    }
    // aturdido: balanceo
    if (st.aturdido > 0) { const a = Math.min(1, st.aturdido); rotarMundo(H.Spine, fwd, Math.sin(this.t * 2.7) * .1 * a); rotarMundo(H.Head, lat, (.2 + Math.sin(this.t * 3.9) * .1) * a); }
    // mirar a un punto (cabeza y cuello, con límites)
    const objetivo = st.mirar; this.mirarPeso = mix(this.mirarPeso, objetivo ? 1 : 0, Math.min(1, dt * 4));
    if (objetivo) this.mirarA.copy(objetivo);
    if (this.mirarPeso > .02 && H.Head) {
      H.Head.getWorldPosition(_c); const dx = this.mirarA.x - _c.x, dy = this.mirarA.y - _c.y, dz = this.mirarA.z - _c.z;
      let yaw = Math.atan2(dx, dz) - ry; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      yaw = clamp(yaw, -1.1, 1.1) * this.mirarPeso; const pt = clamp(pitch, -.6, .5) * this.mirarPeso;
      rotarMundo(H.Neck, Y, yaw * .4); rotarMundo(H.Head, Y, yaw * .6); rotarMundo(H.Neck, lat, -pt * .4); rotarMundo(H.Head, lat, -pt * .6);
    }
  }
  quitar() { this.root.removeFromParent(); if (this.est) quitarPiel(this.est); }
}
ActorGLB._ray = new THREE.Raycaster(); ActorGLB._m = new THREE.Matrix4(); ActorGLB._mi = new THREE.Matrix4();
ActorGLB.matMunon = new THREE.MeshStandardMaterial({ color: 0x5a0508, roughness: .35 });
// miembro suelto (aproximado: el .glb no se puede partir sin cortar la malla) · se pueden cambiar por personaje
ActorGLB.matMiembro = new THREE.MeshStandardMaterial({ color: 0x5b5e45, roughness: .85 });
ActorGLB.matPiel = new THREE.MeshStandardMaterial({ color: 0xb98a6a, roughness: .6 });
ActorGLB.matPantalon = new THREE.MeshStandardMaterial({ color: 0x3d434d, roughness: .9 });
export function crearActor(nombre, o) { return new ActorGLB(nombre, o); }
