// Objetos agarrables: cuerpos rígidos que se cogen con cualquier mano (o con las dos si son largos), se lanzan con
// la velocidad real de la mano, chocan con el mundo, suenan según su material y la fuerza del golpe, se rompen
// y se usan (linterna, radio, botiquín, munición, grabadora). También es el registro común de «interactivos»
// (muebles, teclas, cristales…) para que PC y VR los encuentren igual.
import { THREE, V3, G, clamp, rnd, scene, capas, capOn, dinamicos, groundAt, dentroDeSolido, luzFx } from '../nucleo.js';
import { sfx, buzz, burst } from '../fx.js';
import { say, ui } from '../ui.js';
// jugador.js y enemigos.js se cargan en diferido: así este módulo (y su banco de prueba) no depende de toda la
// cadena del juego, y no hay importaciones circulares cuando jugador.js use la interacción.
export const ganchos = { P: null, enemies: [], damageEnemy: null, pointInMesh: null, hurtPlayer: null };
import('../jugador.js').then(m => { ganchos.P = m.P; ganchos.hurtPlayer = m.hurtPlayer; }).catch(() => {});
import('../enemigos.js').then(m => { ganchos.enemies = m.enemies; ganchos.damageEnemy = m.damageEnemy; ganchos.pointInMesh = m.pointInMesh; }).catch(() => {});
import { empujarPiezas } from '../combate/fisica.js';
import { FIS, GR, seguir, dejar, poseInterp, descForma, volumenForma } from './fisica-adaptador.js';
import { TIPOS, MAT, mallasDe } from './catalogo.js';
import { golpe as sonGolpe, Radio, clic as sonClic, siseo, cuerda } from './sonido.js';
import { emitirRuido, eventoHistoria } from './ruido.js';
import { fragmentar, cristales } from './roturas.js';

const tA = new V3(), tB = new V3(), tC = new V3(), tQ = new THREE.Quaternion(), tQ2 = new THREE.Quaternion(), tM = new THREE.Matrix4(), tM2 = new THREE.Matrix4(), tS = new V3(1, 1, 1);
export const CFG = { radioSim: 25, radioQuitar: 32, radioVer: 34, lanzar: 1.12 };

// ---------- Registro común de interactivos ----------
// obj: { label, mallas: [], activo(): bool, agarre: { dist(p): m, agarrar(mano), seguir(mano, dt), soltar(mano, lanzar) },
//        pulsarE(hit): bool (PC, tecla E), clic(down, hit): bool (PC, clic izquierdo), centro(out): V3 }
export const interactivos = [];
export function registrar(obj) { interactivos.push(obj); for (const m of obj.mallas || []) m.userData.inter = obj; return obj; }
export function desregistrar(obj) { const i = interactivos.indexOf(obj); if (i >= 0) interactivos.splice(i, 1); }

// ---------- Objetos ----------
export const props = [];
export const raiz = new THREE.Group(); raiz.name = 'interaccion'; capas.tierra.add(raiz);
export function usarRaiz(padre) { padre.add(raiz); } // los bancos de prueba cuelgan todo de la escena
const luzLinterna = new THREE.SpotLight(0xfff2d8, 0, 22, .42, .5, 1.4); luzLinterna.position.set(0, -60, 0); scene.add(luzLinterna, luzLinterna.target);
let linternaOn = null;
export const linternaEncendida = () => linternaOn;

class Prop {
  constructor(tipo, o) {
    const def = TIPOS[tipo]; this.tipo = tipo; this.def = def; this.label = o.label || def.label;
    this.color = o.v ?? def.var[Math.floor(Math.random() * def.var.length)];
    this.root = new THREE.Group(); this.mallas = [];
    for (const { mat, geo } of mallasDe(tipo, this.color)) {
      const m = new THREE.Mesh(geo, mat === 'luz' ? MAT.luz.clone() : MAT[mat]); m.castShadow = !!def.sombra; m.receiveShadow = true;
      m.userData.prop = this; m.userData.inter = this; this.root.add(m); this.mallas.push(m); if (mat === 'luz') this.lente = m;
    }
    this.body = null; this.tr = null; this.estado = 'libre'; this.manos = []; this.vprev = new V3(); this.vcmd = null; this.cd = 0; this.hitCD = 0;
    this.hp = def.hp ?? 0; this.contenedor = o.contenedor || null; this.fake = null; this.fantasma = false; this.lejos = 0;
    this.radioSim = o.radioSim ?? CFG.radioSim;
    const vol = def.col.reduce((s, c) => s + volumenForma(c), 0); this.densidad = def.masa / Math.max(1e-6, vol);
    this.agarre = { dist: p => this.distA(p), agarrar: m => agarrarProp(this, m), seguir: (m, dt) => seguirProp(this, m, dt), soltar: (m, l) => soltarProp(this, m, l) };
  }
  get masa() { return this.def.masa; }
  activo() { return this.estado !== 'roto' && this.root.visible && (!this.contenedor || this.contenedor.abierto()); }
  centro(o) { const bb = this.mallas[0].geometry.boundingBox; return this.root.localToWorld(bb.getCenter(o)); }
  // distancia de un punto del mundo a la caja del objeto (0 si está dentro)
  distA(p) {
    tA.copy(p); this.root.worldToLocal(tA); let d2 = 0;
    for (const m of this.mallas) { const b = m.geometry.boundingBox; const dx = Math.max(b.min.x - tA.x, 0, tA.x - b.max.x), dy = Math.max(b.min.y - tA.y, 0, tA.y - b.max.y), dz = Math.max(b.min.z - tA.z, 0, tA.z - b.max.z); const d = dx * dx + dy * dy + dz * dz; d2 = d2 ? Math.min(d2, d) : d; }
    return Math.sqrt(d2);
  }
  pulsarE() { return agarrarProp(this, manoPCRef.m); }
  // bala, golpe o explosión (lo llama applyHit desde jugador.js y la interacción)
  golpe(punto, dir, dmg = 15, tipo = 'bala') {
    if (this.estado === 'roto') return true;
    if (this.def.usar === 'extintor' && tipo !== 'contundente') { this.pinchado = 2.6; if (!this.body) crearCuerpo(this, true); }
    // lo frágil (vidrio, loza, pantallas sin hp alto) cae a la primera bala; lo que tiene aguante (cajas) va perdiendo hp
    if (this.def.rompe && !this.def.hp && (tipo === 'bala' || tipo === 'escopeta' || dmg >= 12)) { this.romper(dir ? dir.clone().multiplyScalar(2) : null); return true; }
    if (this.def.rompe && this.def.hp <= 12 && (tipo === 'bala' || tipo === 'escopeta')) { this.romper(dir ? dir.clone().multiplyScalar(2) : null); return true; }
    if (this.hp) { this.hp -= dmg; if (this.hp <= 0) { this.romper(dir ? dir.clone().multiplyScalar(2) : null); return true; } }
    if (!this.body) crearCuerpo(this, true);
    if (this.body) { const k = dmg * .03 * (tipo === 'bala' ? 1 : 1.6); this.body.applyImpulseAtPoint({ x: dir.x * k, y: dir.y * k + k * .2, z: dir.z * k }, { x: punto.x, y: punto.y, z: punto.z }, true); }
    sonGolpe(this.def.mat, punto, .7); if (tipo === 'bala') burst(punto, 4, this.def.mat === 'metal' ? 'hot' : 'dust');
    return true;
  }
  romper(vel) {
    if (this.estado === 'roto') return; const def = this.def;
    for (const m of [...this.manos]) soltarProp(this, m, false);
    const p = this.centro(new V3()), v = vel || (this.body ? new V3().copy(this.body.linvel()) : null);
    this.estado = 'roto'; quitarCuerpo(this); this.root.visible = false; if (this.radio) this.radio.parar(); if (linternaOn === this) apagarLinterna();
    for (const m of this.mallas) { const i = dinamicos.indexOf(m); if (i >= 0) dinamicos.splice(i, 1); }
    if (def.rotura === 'explosion') { explotar(p, this); return; }
    emitirRuido(p, def.rotura === 'madera' ? 8 : 12, 'rotura');
    const n = { vidrio: 7, ceramica: 6, madera: 6, pantalla: 9 }[def.rotura] || 5, tam = this.mallas[0].geometry.boundingSphere.radius * .6;
    fragmentar(def.rotura, p, v, def.rotura === 'madera' ? 0x8a6a40 : def.rotura === 'pantalla' ? 0x1a2a30 : this.color, n, tam, 1);
  }
}
const manoPCRef = { m: null };
export function ponerManoPC(m) { manoPCRef.m = m; }

// tipo: clave de TIPOS · o: { ry, v (variante de color), contenedor, padre, label, despierto }
export function crearProp(tipo, x, y, z, o = {}) {
  const pr = new Prop(tipo, o); pr.root.position.set(x, y + (pr.def.apoyo || 0), z); if (o.ry) pr.root.rotation.y = o.ry; if (o.rx) pr.root.rotation.x = o.rx; if (o.rz) pr.root.rotation.z = o.rz;
  (o.padre || raiz).add(pr.root); if (pr.contenedor) pr.estado = 'guardado';
  for (const m of pr.mallas) dinamicos.push(m); // las balas los encuentran (envActivo)
  props.push(pr); registrar(pr); return pr;
}
export function quitarProp(pr) { quitarCuerpo(pr); pr.root.removeFromParent(); pr.estado = 'roto'; for (const m of pr.mallas) { const i = dinamicos.indexOf(m); if (i >= 0) dinamicos.splice(i, 1); } const i = props.indexOf(pr); if (i >= 0) props.splice(i, 1); desregistrar(pr); }

// ---------- Cuerpo físico (solo cerca del jugador) ----------
function crearCuerpo(pr, despierto) {
  if (!FIS.listo || pr.body || pr.estado === 'roto') return null;
  const R = FIS.R, d = pr.def; pr.root.updateMatrixWorld(true); pr.root.matrixWorld.decompose(tA, tQ, tB);
  const desc = R.RigidBodyDesc.dynamic().setTranslation(tA.x, tA.y, tA.z).setRotation({ x: tQ.x, y: tQ.y, z: tQ.z, w: tQ.w }).setLinearDamping(.05).setAngularDamping(d.col.some(c => c.f === 'cil' || c.f === 'bola') ? .9 : .3) /* lo redondo no rueda eternamente */.setCcdEnabled(d.masa < .6 || !!d.herramienta);
  if (!despierto) desc.setSleeping(true);
  const b = FIS.world.createRigidBody(desc);
  for (const s of d.col) FIS.world.createCollider(descForma(s).setDensity(pr.densidad).setFriction(d.friccion ?? .6).setRestitution(d.rebote ?? .12).setCollisionGroups(pr.manos.length ? GR.sostenido : GR.libre), b);
  pr.body = b; pr.tr = seguir(b); pr.vprev.set(0, 0, 0); return b;
}
function quitarCuerpo(pr) { if (!pr.body) return; dejar(pr.tr); FIS.world.removeRigidBody(pr.body); pr.body = null; pr.tr = null; }
function gruposCuerpo(pr, g) { if (!pr.body) return; const n = pr.body.numColliders(); for (let i = 0; i < n; i++) pr.body.collider(i).setCollisionGroups(g); }

// ---------- Agarrar, sostener, soltar ----------
// mano: { id, pc, c (mando), pos, q (pose de agarre en el mundo), vel, angVel, hist, sostiene }
export function agarrarProp(pr, mano) {
  if (!pr.activo() || mano.sostiene) return false;
  if (pr.manos.length && !(pr.def.dosManos && pr.manos.length === 1)) { const otra = pr.manos[0]; soltarProp(pr, otra, false, true); } // pasar de una mano a otra
  if (pr.contenedor) { raiz.attach(pr.root); pr.contenedor = null; }
  pr.root.updateMatrixWorld(true);
  const dos = pr.manos.length === 1;
  mano.sostiene = pr; mano.rel = new THREE.Matrix4(); mano.pLocal = pr.root.worldToLocal(mano.pos.clone());
  if (!dos) {
    if (pr.def.herramienta) mano.rel.makeTranslation(0, mano.pc ? 0 : -.01, mano.pc ? 0 : -.03); // pose fija de herramienta
    else { tM.compose(mano.pos, mano.q, tS).invert(); mano.rel.multiplyMatrices(tM, pr.root.matrixWorld);
      if (mano.pc) { // en PC el objeto viene al punto de sujeción (centro delante de la cámara), conservando su giro
        mano.rel.decompose(tA, tQ, tB); pr.mallas[0].geometry.boundingBox.getCenter(tA).applyQuaternion(tQ).negate(); mano.rel.compose(tA, tQ, tS); mano.pLocal.copy(pr.mallas[0].geometry.boundingBox.getCenter(tC)); } }
  }
  pr.manos.push(mano); pr.estado = 'sostenido';
  if (!pr.body) { if (FIS.listo && dentroDeSolido(pr.root.position.x, pr.root.position.z, pr.root.position.y)) pr.fantasma = true; else crearCuerpo(pr, true); }
  if (pr.body) { pr.body.wakeUp(); pr.body.setGravityScale(0, true); gruposCuerpo(pr, GR.sostenido); }
  pr.atraeT = .5; // medio segundo para llegar a la mano (en PC se coge desde lejos, como los guantes de Alyx)
  pr.fake = null; buzz(mano.c, .35, 30); sonGolpe(pr.def.mat, pr.root.position, .15);
  if (mano.c) mano.c.prop = pr; // jugador.js no agarra usables ni golpea con esa mano
  return true;
}
const tT = new V3(), tTQ = new THREE.Quaternion();
// pose objetivo del objeto según la(s) mano(s)
function objetivo(pr, outP, outQ) {
  const m1 = pr.manos[0]; tM.compose(m1.pos, m1.q, tS).multiply(m1.rel); tM.decompose(outP, outQ, tB);
  const m2 = pr.manos[1];
  if (m2) { // dos manos: el eje entre las manos manda la orientación
    const a = tC.copy(m2.pLocal).sub(m1.pLocal).applyQuaternion(outQ).normalize(), b = tA.subVectors(m2.pos, m1.pos).normalize();
    tQ2.setFromUnitVectors(a, b); outQ.premultiply(tQ2);
    outP.copy(m1.pos).sub(tB.copy(m1.pLocal).applyQuaternion(outQ));
  }
}
export function seguirProp(pr, mano, dt) {
  if (pr.manos[0] !== mano) return; // la mano principal mueve; la segunda solo orienta
  objetivo(pr, tT, tTQ);
  if (pr.fantasma && !dentroDeSolido(tT.x, tT.z, tT.y)) { pr.fantasma = false; pr.root.position.copy(tT); pr.root.quaternion.copy(tTQ); crearCuerpo(pr, true); if (pr.body) { pr.body.setGravityScale(0, true); gruposCuerpo(pr, GR.sostenido); } }
  if (!pr.body) { pr.root.position.copy(tT); pr.root.quaternion.copy(tTQ); return; }
  const b = pr.body, t = b.translation(), r = b.rotation(), paso = Math.max(FIS.paso, 1e-3);
  // impacto mientras se sostiene: lo que pedimos frente a lo que la física dejó hacer
  if (pr.vcmd) { const lv = b.linvel(), dv = Math.hypot(lv.x - pr.vcmd.x, lv.y - pr.vcmd.y, lv.z - pr.vcmd.z); if (dv > 1.4 && pr.cd <= 0) { impacto(pr, dv, tA.set(t.x, t.y, t.z)); for (const m of pr.manos) buzz(m.c, clamp(dv / 6, .2, 1), 40); } }
  const pesado = 1 / (1 + pr.masa * .12), vmax = 30 * pesado;
  tA.set((tT.x - t.x) / paso, (tT.y - t.y) / paso, (tT.z - t.z) / paso).multiplyScalar(.85); if (tA.length() > vmax) tA.setLength(vmax);
  b.setLinvel(tA, true); pr.vcmd = tA.clone();
  tQ.set(r.x, r.y, r.z, r.w); tQ2.copy(tTQ).multiply(tQ.invert()); if (tQ2.w < 0) { tQ2.x = -tQ2.x; tQ2.y = -tQ2.y; tQ2.z = -tQ2.z; tQ2.w = -tQ2.w; }
  const ang = 2 * Math.acos(clamp(tQ2.w, -1, 1)), s = Math.sqrt(1 - tQ2.w * tQ2.w);
  if (s > 1e-4) { const k = Math.min(ang / paso * .8, 40 * pesado) / s; b.setAngvel({ x: tQ2.x * k, y: tQ2.y * k, z: tQ2.z * k }, true); } else b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  // dibujo: si el cuerpo va pegado a la mano se pinta en la mano (sin retardo); si algo lo frena, donde está de verdad
  if (Math.hypot(tT.x - t.x, tT.y - t.y, tT.z - t.z) < .035) { pr.root.position.copy(tT); pr.root.quaternion.copy(tTQ); }
  else poseInterp(pr.tr, pr.root.position, pr.root.quaternion);
  // separado más de medio metro (atascado tras una pared): se suelta
  pr.atraeT -= dt; if (pr.atraeT <= 0 && Math.hypot(tT.x - t.x, tT.y - t.y, tT.z - t.z) > .6) soltarProp(pr, mano, false);
}
// lanzar: true usa la velocidad de la mano (VR) o la dirección de la mirada (PC, mano.lanzarDir)
export function soltarProp(pr, mano, lanzar = true, pasando = false) {
  const i = pr.manos.indexOf(mano); if (i < 0) return; pr.manos.splice(i, 1); mano.sostiene = null; if (mano.c) mano.c.prop = null;
  if (pr.manos.length) { const m = pr.manos[0]; pr.root.updateMatrixWorld(true); tM.compose(m.pos, m.q, tS).invert(); m.rel.multiplyMatrices(tM, pr.root.matrixWorld); return; }
  pr.estado = 'libre'; pr.vcmd = null; pr.fantasma = false;
  const v = new V3(), w = new V3();
  if (lanzar && mano.pc) { v.copy(mano.lanzarDir).multiplyScalar(clamp(10 / Math.sqrt(pr.masa + .2), 3.5, 12)).add(mano.vel); w.set(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)); }
  else if (lanzar) { v.copy(mano.velLanzar()).multiplyScalar(CFG.lanzar / Math.max(1, Math.sqrt(pr.masa / 2.5))); w.copy(mano.angVel); }
  else if (!pasando) v.copy(mano.vel).multiplyScalar(.5);
  if (pr.body) { gruposCuerpo(pr, GR.libre); pr.body.setGravityScale(1, true); pr.body.setLinvel(v, true); pr.body.setAngvel(w, true); pr.vprev.copy(v); }
  else if (!FIS.listo) pr.fake = { v, w };
  if (v.length() > 3) sfx('whoosh');
}

// ---------- Golpes, roturas y daño ----------
function impacto(pr, dv, pos) {
  pr.cd = .07; const d = pr.def;
  if (d.rompe && dv > d.rompe) { pr.romper(); return; }
  sonGolpe(d.mat, pos, clamp((dv - .8) / 7, 0, 1));
  if (dv > 2.5) emitirRuido(pos, ({ lata: 6, carton: 8, metal: 7, vidrio: 6, ceramica: 6 }[d.mat] || 5) * clamp(dv / 6, .5, 1.2), 'impacto');
  if (dv > 3) for (const c of cristales) if (c.toca(pos, .12)) c.romper(pos, pr.body ? new V3().copy(pr.body.linvel()) : null);
}
function golpearEnemigos(p, vel, speed, dmgBase, quien) {
  const { enemies, damageEnemy, pointInMesh } = ganchos; if (!damageEnemy) return false;
  for (const e of enemies) { if (!e.alive || Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > 1.6 * e.S) continue;
    for (const m of e.R.hit) if (pointInMesh(p, m, .06)) { const dir = vel.clone().normalize(); damageEnemy(e, dmgBase * clamp(speed / 5, .5, 2.2), p.clone(), dir, m.userData.part, true, m.userData.limb, { zona: m.userData.zona, tipo: 'contundente', malla: m }); sfx(quien.def.mat === 'metal' ? 'clang' : 'punch', { pos: p }); return true; } }
  return false;
}

// ---------- Usos (gatillo en VR, clic en PC) ----------
function apagarLinterna() { if (linternaOn?.lente) linternaOn.lente.material.emissiveIntensity = 0; linternaOn = null; luzLinterna.intensity = 0; luzLinterna.position.set(0, -60, 0); }
let cintaCola = [], cintaT = -9;
export const LINEAS_CINTA = [['MIKE', 'Nota de voz. Si alguien encuentra esto... no te fíes de la radio oficial.'], ['MIKE', 'El chip M-7 no guarda recuerdos. Guarda a la persona entera. Por eso lo quieren.'], ['MIKE', 'Fin de la nota. Borra esto después de oírlo.']];
export function usarProp(pr, on, mano) {
  const u = pr.def.usar; if (!u) return false;
  if (u === 'linterna') { if (!on) return true; if (linternaOn === pr) apagarLinterna(); else { if (linternaOn) apagarLinterna(); linternaOn = pr; pr.lente.material.emissiveIntensity = 6; } sonClic(pr.root.position); return true; }
  if (u === 'extintor') { pr.rociando = on; return true; }
  if (!on) return true;
  if (u === 'guitarra') { const ac = ACORDES[pr.acorde = ((pr.acorde ?? -1) + 1) % ACORDES.length]; rasguear(pr, ac, 1, .8); return true; }
  if (u === 'radio') { eventoHistoria('walkie_hablar'); eventoHistoria('walkie_senal'); pr.radio ||= new Radio(); pr.radio.pos.copy(pr.root.position); const e = pr.radio.siguiente(); say('RADIO · ' + e.n); return true; }
  const P = ganchos.P;
  if (u === 'curar') { if (!P) return false; P.hp = Math.min(100, P.hp + 50); sfx('pickup'); say('Botiquín · +50 salud'); quitarProp(pr); if (mano) { mano.sostiene = null; if (mano.c) mano.c.prop = null; } return true; }
  if (u === 'venda') { if (!P) return false; P.hp = Math.min(100, P.hp + 20); import('../combate/lesiones.js').then(Ls => { for (const z of Ls.ZONAS_JUGADOR) if (Ls.L[z].sangra > 0) Ls.curarZona(z, 'venda'); }).catch(() => {}); sfx('pickup'); say('Venda · +20 salud, deja de sangrar'); quitarProp(pr); if (mano) { mano.sostiene = null; if (mano.c) mano.c.prop = null; } return true; }
  // escasez (F1.5): cada caja es UN cargador lleno que va al chaleco; es la única fuente de munición
  if (u === 'municion') { if (P) { const r = ((P.cargadores ||= {}).x56d ||= []); r.push(30); say(P.inv.includes('x56d') ? 'Cargador de X-56D · ' + r.length + ' en el chaleco' : 'Un cargador de 5,56 · lo guardas'); } sfx('reload'); quitarProp(pr); if (mano) { mano.sostiene = null; if (mano.c) mano.c.prop = null; } return true; }
  if (u === 'cinta') { if (cintaCola.length) return true; cintaCola = [...(pr.lineas || LINEAS_CINTA)]; cintaT = 0; sonClic(pr.root.position); return true; }
  return false;
}

// ---------- Bucle ----------
const pj = new V3(); let nCuerpos = 0;
export function estadoObjetos() { return { objetos: props.length, cuerpos: nCuerpos, despiertos: props.filter(p => p.body && !p.body.isSleeping()).length, visibles: props.filter(p => p.root.visible && p.estado !== 'roto').length }; }
export function actualizarObjetos(dt, jugador) {
  pj.copy(jugador); nCuerpos = 0;
  for (const pr of props) {
    if (pr.estado === 'roto') continue;
    pr.cd -= dt; pr.hitCD -= dt;
    const pos = pr.root.getWorldPosition(tC), d = pos.distanceTo(pj);
    if (pr.estado === 'guardado') continue;
    if (pr.estado !== 'sostenido') pr.root.visible = d < CFG.radioVer;
    // cuerpos solo cerca: se crean dormidos al acercarse y se quitan lejos y en reposo
    if (!pr.body && pr.estado === 'libre' && d < pr.radioSim && FIS.listo && !pr.fake) crearCuerpo(pr, false);
    if (pr.body && pr.estado === 'libre' && d > CFG.radioQuitar && pr.body.isSleeping()) { quitarCuerpo(pr); continue; }
    if (pr.body) nCuerpos++;
    if (pr.estado === 'sostenido') continue;
    if (pr.fake) { const f = pr.fake; f.v.y -= 9.8 * dt; pr.root.position.addScaledVector(f.v, dt); pr.root.rotation.x += f.w.x * dt; pr.root.rotation.z += f.w.z * dt; const g = groundAt(pr.root.position.x, pr.root.position.z, pr.root.position.y + .3) + (pr.def.apoyo || 0); if (pr.root.position.y < g) { pr.root.position.y = g; if (f.v.y < -2) impacto(pr, -f.v.y, pr.root.position); f.v.multiplyScalar(.4); f.v.y = Math.abs(f.v.y) * .3; f.w.multiplyScalar(.5); if (f.v.length() < .3) { pr.fake = null; pr.root.rotation.x = pr.root.rotation.z = 0; } } continue; }
    if (!pr.body || pr.body.isSleeping()) continue;
    poseInterp(pr.tr, pr.root.position, pr.root.quaternion);
    const lv = pr.body.linvel(); tA.set(lv.x, lv.y, lv.z);
    const dv = tA.distanceTo(pr.vprev) - 9.81 * dt; // la gravedad no cuenta como golpe
    if (dv > 1 && pr.cd <= 0) impacto(pr, dv, pos);
    const sp = pr.vprev.length();
    if (sp > 5 && pr.hitCD <= 0 && golpearEnemigos(pos, pr.vprev, sp, pr.masa * 10 + 6, pr)) { pr.hitCD = .4; pr.body.setLinvel({ x: -lv.x * .3, y: lv.y * .3, z: -lv.z * .3 }, true); }
    pr.vprev.copy(tA);
    if (pr.root.position.y < -20) quitarProp(pr);
  }
  // herramientas sostenidas: golpes con la punta y linterna
  for (const pr of props) {
    if (pr.estado !== 'sostenido') continue; const m = pr.manos[0];
    if (pr.def.golpe && !m.pc) { const pt = pr.root.localToWorld(tA.fromArray(pr.def.punta)); if (pr.puntaPrev) { const v = tB.subVectors(pt, pr.puntaPrev).divideScalar(Math.max(dt, 1e-3)), sp = v.length(); if (sp > 1.6 && pr.hitCD <= 0 && golpearEnemigos(pt, v, sp, pr.def.golpe, pr)) { pr.hitCD = .3; buzz(m.c, 1, 70); } } (pr.puntaPrev ||= new V3()).copy(pt); }
  }
  if (linternaOn) { if (linternaOn.estado === 'roto' || !linternaOn.root.parent) apagarLinterna(); else { linternaOn.root.localToWorld(luzLinterna.position.set(0, 0, -.16)); linternaOn.root.localToWorld(luzLinterna.target.position.set(0, 0, -4)); luzLinterna.intensity = 60; } }
  for (const pr of props) if (pr.radio) pr.radio.actualizar(pr.root.getWorldPosition(tA));
  actualizarExtintores(dt);
  // grabadora: subtítulos uno tras otro
  if (cintaCola.length) { cintaT -= dt; if (cintaT <= 0) { const l = cintaCola.shift(); if (l) { ui.subtitulo(l[0], l[1]); cintaT = 1.2 + l[1].length * .055; } } }
  else if (cintaT > -1 && cintaT !== -9) { cintaT -= dt; if (cintaT <= 0) { ui.subtitulo(null); cintaT = -9; } }
}
// empuje radial (explosiones, extintor…)
export function empujarObjetos(p, radio, fuerza) {
  for (const pr of props) { if (pr.estado !== 'libre') continue; const c = pr.root.position, d = c.distanceTo(p); if (d > radio) continue; if (!pr.body) crearCuerpo(pr, true); if (!pr.body) continue; const k = fuerza * (1 - d / radio) * pr.body.mass(); tA.subVectors(c, p).normalize(); pr.body.applyImpulse({ x: tA.x * k, y: tA.y * k + k * .4, z: tA.z * k }, true); }
  empujarPiezas(p, radio, fuerza);
}
export { crearCuerpo, quitarCuerpo, luzLinterna, luzFx };

// ---------- Guitarra: acordes con Karplus-Strong (los usa también instrumentos.js para el rasgueo en VR) ----------
const AFIN = [40, 45, 50, 55, 59, 64];
export const ACORDES = [{ n: 'Mim', t: [0, 2, 2, 0, 0, 0] }, { n: 'Do', t: [-1, 3, 2, 0, 1, 0] }, { n: 'Sol', t: [3, 2, 0, 0, 0, 3] }, { n: 'Re', t: [-1, -1, 0, 2, 3, 2] }];
export function rasguear(pr, ac, dir = 1, vel = .7) {
  const p = pr.root.getWorldPosition(new V3()); const orden = dir > 0 ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
  orden.forEach((i, k) => { if (ac.t[i] >= 0) cuerda(AFIN[i] + ac.t[i], p, vel, k * .014); });
  emitirRuido(p, 6, 'musica'); for (const m of pr.manos) buzz(m.c, .25, 30);
}
// ---------- Extintor: chorro de partículas (1 llamada), siseo, empuje y extintor pinchado que sale volando ----------
const NP = 160, pPos = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pVida = new Float32Array(NP); let pI = 0;
const gP = new THREE.BufferGeometry(); gP.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const nube = new THREE.Points(gP, new THREE.PointsMaterial({ color: 0xf2f4f6, size: .12, transparent: true, opacity: .55, depthWrite: false, sizeAttenuation: true }));
nube.frustumCulled = false; nube.visible = false; scene.add(nube); for (let i = 0; i < NP; i++) pPos[i * 3 + 1] = -99;
const tN = new V3(), tN2 = new V3();
function actualizarExtintores(dt) {
  let vivo = false;
  for (const pr of props) {
    if (pr.def.usar !== 'extintor' || pr.estado === 'roto') continue;
    const sale = pr.rociando || pr.pinchado > 0;
    if (pr.pinchado > 0) pr.pinchado -= dt;
    if (sale) {
      pr.root.localToWorld(tN.fromArray(pr.def.punta)); tN2.set(0, 0, -1).transformDirection(pr.root.matrixWorld);
      for (let k = 0; k < 4; k++) { const i = pI++ % NP; pPos[i * 3] = tN.x; pPos[i * 3 + 1] = tN.y; pPos[i * 3 + 2] = tN.z; pVel[i * 3] = tN2.x * 6 + rnd(-.8, .8); pVel[i * 3 + 1] = tN2.y * 6 + rnd(-.6, .9); pVel[i * 3 + 2] = tN2.z * 6 + rnd(-.8, .8); pVida[i] = rnd(.5, .9); }
      pr.siseo ||= siseo(tN); pr.siseo?.mover(tN);
      if (pr.pinchado > 0 && pr.body && pr.estado === 'libre') { const k = 22 * dt; pr.body.applyImpulseAtPoint({ x: -tN2.x * k, y: -tN2.y * k + 2 * dt, z: -tN2.z * k }, { x: tN.x, y: tN.y, z: tN.z }, true); }
      if (Math.random() < dt * 3) emitirRuido(tN, 6, 'extintor');
    } else if (pr.siseo) { pr.siseo.parar(); pr.siseo = null; }
  }
  for (let i = 0; i < NP; i++) { if (pVida[i] <= 0) continue; vivo = true; pVida[i] -= dt; const f = Math.max(0, 1 - dt * 2.2); pVel[i * 3] *= f; pVel[i * 3 + 1] = pVel[i * 3 + 1] * f + .4 * dt; pVel[i * 3 + 2] *= f; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; if (pVida[i] <= 0) pPos[i * 3 + 1] = -99; }
  nube.visible = vivo; if (vivo) gP.attributes.position.needsUpdate = true;
}
// ---------- Explosión (bombona de gas) ----------
function explotar(p, pr) {
  sfx('boom', { pos: p }); burst(p, 30, 'hot', null, 1.6); burst(p, 14, 'dust');
  luzFx.position.copy(p); luzFx.position.y += .5; luzFx.intensity = 260; G.shake = Math.max(G.shake, .6);
  emitirRuido(p, 45, 'explosion');
  empujarObjetos(p, 5, 7);
  const { enemies, damageEnemy } = ganchos;
  if (damageEnemy) for (const e of [...enemies]) { if (!e.alive) continue; const d = e.pos.distanceTo(p); if (d < 5) damageEnemy(e, 90 * (1 - d / 5) + 10, e.pos.clone().setY(e.pos.y + 1), new V3().subVectors(e.pos, p).setY(.4).normalize(), 'torso', false, null, { tipo: 'explosivo' }); }
  if (ganchos.hurtPlayer && ganchos.P) { const jp = new V3(); import('../jugador.js').then(j => { j.playerFeet(jp); const d = jp.distanceTo(p); if (d < 4) ganchos.hurtPlayer(Math.round(45 * (1 - d / 4)), p, 'torso'); }); }
}
