// Daño por ZONA para robots y humanos.
// Zonas: head, neck, torso, pelvis, upperArmL/R, foreArmL/R, handL/R, thighL/R, shinL/R, footL/R
// (L = izquierda del personaje = +X local en el rig por código, igual que «Left» en mixamorig).
//
// Robots: cada zona tiene su vida; al romperse la pieza se suelta (cabeza, brazo por hombro o codo, pierna por
//   cadera o rodilla) con chispas + aceite; sin pierna se arrastra con los brazos; el torso dañado deja ver el
//   núcleo brillante; el muñón suelta chispas unos segundos; pierna tocada = cojera; perder el brazo del arma la tira.
// Humanos: moratones (rojo → morado con el tiempo) y sangre en el punto exacto; huesos rotos por golpes
//   contundentes (pierna = cojera ×0.5, brazo = cuelga y no pega con él); golpe fuerte en la cabeza = aturdido;
//   al morir por daño alto en brazo/pierna/cabeza: desmembramiento básico (miembro como cuerpo rígido + muñón).
import { THREE, V3, G, rnd, clamp, glow, std, sphG, scene } from '../nucleo.js';
import { sfx, burst } from '../fx.js';
import { staticPose } from '../cuerpos.js';
import { FIS, escombro } from './fisica.js';
import { salpicar, mancha } from './particulas.js';
import { marcarImpacto, herida, quitarMarcasDe } from './marcas.js';
import { K } from './heridaShader.js';
import { salpicarDetras, charco, manchaSuelo } from './entorno.js';
import { reaccionar } from './reacciones.js';
import { crearRagdoll, congelar, huesosMixamo, nombreHueso } from './ragdoll.js';

const tA = new V3(), tB = new V3(), tC = new V3();

// ---------- Tablas ----------
const VIDA_ROBOT = { head: 45, neck: 45, torso: 110, pelvis: 90, upperArm: 40, foreArm: 32, hand: 22, thigh: 60, shin: 48, foot: 30 };
const VIDA_HUMANO = { head: 30, neck: 25, torso: 100, pelvis: 70, upperArm: 45, foreArm: 40, hand: 25, thigh: 60, shin: 50, foot: 30 };
export const ZONAS = ['head', 'neck', 'torso', 'pelvis', ...['upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot'].flatMap(z => [z + 'L', z + 'R'])];
const base = z => z.replace(/[LR]$/, '');
const lado = z => (z.endsWith('L') ? 'L' : z.endsWith('R') ? 'R' : null);
// qué pieza se suelta al romperse cada zona (clave de R.lost)
export function segmentoDeZona(z) {
  const b = base(z), s = lado(z);
  if (b === 'head' || b === 'neck') return 'head';
  if (b === 'upperArm') return 'arm' + s; if (b === 'foreArm' || b === 'hand') return 'foreArm' + s;
  if (b === 'thigh') return 'leg' + s; if (b === 'shin' || b === 'foot') return 'shin' + s;
  return null;
}
const miembro = z => { const b = base(z), s = lado(z); return s ? (['upperArm', 'foreArm', 'hand'].includes(b) ? 'arm' : 'leg') + s : null; };

// ---------- Zonas en el rig por código (userData.zona en cada malla golpeable) ----------
export function etiquetarZonas(R) {
  const mapa = new Map([[R.hips, 'pelvis'], [R.spine, 'torso']]);
  for (const s of ['L', 'R']) { const A = s === 'L' ? R.armL : R.armR, Lg = s === 'L' ? R.legL : R.legR; mapa.set(A.sh, 'upperArm' + s); mapa.set(A.el, 'foreArm' + s); mapa.set(Lg.hp, 'thigh' + s); mapa.set(Lg.kn, 'shin' + s); mapa.set(Lg.an, 'foot' + s); }
  for (const m of R.hit) {
    const p = m.parent; let z = mapa.get(p);
    if (p === R.neck) z = m.position.y < .075 ? 'neck' : 'head';
    if (z && z.startsWith('foreArm') && m.position.y < -.28) z = 'hand' + lado(z);
    m.userData.zona = z || 'torso';
  }
}
// ---------- Zonas en SkinnedMesh mixamorig ----------
const HUESO_ZONA = { Head: 'head', HeadTop_End: 'head', Neck: 'neck', Spine2: 'torso', Spine1: 'torso', Spine: 'pelvis', Hips: 'pelvis' };
for (const s of ['Left', 'Right']) { const k = s[0]; Object.assign(HUESO_ZONA, { [s + 'Shoulder']: 'upperArm' + k, [s + 'Arm']: 'upperArm' + k, [s + 'ForeArm']: 'foreArm' + k, [s + 'Hand']: 'hand' + k, [s + 'UpLeg']: 'thigh' + k, [s + 'Leg']: 'shin' + k, [s + 'Foot']: 'foot' + k, [s + 'ToeBase']: 'foot' + k }); }
export const zonaDeHueso = nombre => { const n = nombreHueso(nombre); return HUESO_ZONA[n] || (n.startsWith('LeftHand') ? 'handL' : n.startsWith('RightHand') ? 'handR' : null); };
// hueso más cercano al punto (distancia al segmento hueso → primer hijo hueso) · devuelve { hueso, zona }
export function zonaSkinned(malla, punto) {
  const bones = malla.skeleton?.bones || []; let mejor = null, md = 1e9;
  for (const b of bones) {
    const z = zonaDeHueso(b.name); if (!z) continue;
    b.getWorldPosition(tA); const hijo = b.children.find(c => c.isBone);
    if (hijo) { hijo.getWorldPosition(tB); const ab = tB.sub(tA), t = clamp(tC.subVectors(punto, tA).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); tC.copy(tA).addScaledVector(ab, t); } else tC.copy(tA);
    const d = tC.distanceTo(punto); if (d < md) { md = d; mejor = { hueso: b, zona: z }; }
  }
  return mejor;
}
// zona a partir de lo que tengamos (malla con userData.zona, part/limb antiguos, hueso…)
export function zonaDe(malla, part, limb, punto) {
  if (malla?.userData?.zona) return malla.userData.zona;
  if (malla?.isSkinnedMesh && punto) { const z = zonaSkinned(malla, punto); if (z) return z.zona; }
  if (part === 'head') return 'head';
  if (part === 'arm') return 'upperArm' + (limb === 'armR' ? 'R' : 'L');
  if (part === 'leg') return 'thigh' + (limb === 'legR' ? 'R' : 'L');
  return 'torso';
}

// ---------- Preparar un enemigo (se llama al crearlo) ----------
const matMunonRobot = glow(0xff6a1a, 2.2), matMunonSangre = std({ color: 0x5a0508, roughness: .35, metalness: 0 });
const geoMunon = new THREE.CylinderGeometry(1, 1, .3, 10);
export function prepararDanio(e) {
  const R = e.R, rob = !R.humano, T = rob ? VIDA_ROBOT : VIDA_HUMANO;
  if (!R.esActor) etiquetarZonas(R); // ActorGLB: sus hitboxes por hueso ya traen userData.zona
  // material de piel (rig humano): el del cuello. Lo demás es ropa. En robots todo es metal.
  R._matPiel = !rob && !R.esActor ? R.hit.find(m => m.userData.zona === 'neck')?.material : null;
  e.zonas = {}; for (const z of ZONAS) { const v = T[base(z)]; e.zonas[z] = { hp: v, max: v }; }
  e.golpes = { armL: 0, armR: 0, legL: 0, legR: 0 }; e.roto = {}; e.aturdido = 0; e.cojera = 0; e.arrastre = false; e.ciclo = 0;
  if (rob) { // núcleo bajo la placa del pecho (oculto hasta que el torso se rompe)
    const mat = glow(0x29e6ff, 0); const n = new THREE.Mesh(sphG(.085), mat); n.position.set(0, .4, .12); n.visible = false; R.spine.add(n); e.nucleo = { m: n, mat, on: false };
  }
}

// ---------- Golpe ----------
// o: { dmg, punto (V3), dir (V3 normalizada), zona, tipo: 'bala'|'contundente'|'corte'|'escopeta'|'explosivo', malla, lx (x local del golpe) }
// devuelve true si el golpe debe matar sí o sí (p. ej. cabeza de robot arrancada)
export function impactoZona(e, o) {
  const R = e.R, rob = !R.humano, z = o.zona || 'torso', dmg = o.dmg, tipo = o.tipo || 'bala', punto = o.punto, dir = o.dir;
  const Z = e.zonas?.[z]; if (Z) Z.hp -= dmg;
  reaccionar(e, z, o.lx || 0, clamp(dmg / 25, .25, 1.2), tipo);
  // parón de impacto: el cuerpo se «congela» un instante (más con golpes fuertes) → el golpe se siente
  e.hitStop = Math.max(e.hitStop || 0, tipo === 'bala' ? .035 : clamp(dmg / 260, .05, .12));
  const b = base(z), s = lado(z);
  // aturdido por golpe fuerte en la cabeza
  if ((b === 'head' || b === 'neck') && (dmg >= 22 || (tipo === 'contundente' && dmg >= 15))) { e.aturdido = Math.max(e.aturdido, rob ? 1.4 : 2.4); e.stagger = Math.max(e.stagger || 0, .4); }
  if (rob) return impactoRobot(e, z, Z, o);
  impactoHumano(e, z, Z, o); return false;
}

function impactoRobot(e, z, Z, o) {
  const R = e.R, b = base(z), dir = o.dir, punto = o.punto, tipo = o.tipo || 'bala', rebote = tA.copy(dir).negate();
  // marcas en el blindaje (abolladura, arañazo, hollín) — nunca sangre
  const malla = o.malla && R.hit.includes(o.malla) ? o.malla : R.hit.find(m => m.userData.zona === z);
  if (malla) marcarImpacto(malla, punto, dir, { tipo, dmg: o.dmg, superficie: 'metal', swing: o.swing, dueño: e });
  // chispas variadas: lluvia, chasquido corto o descarga eléctrica
  const r = Math.random();
  if (tipo === 'contundente') { salpicar(punto, 8 + Math.floor(o.dmg / 3), 'chispa', rebote, .9); sfx('clang', { pos: punto }); }
  else if (r < .45) { salpicar(punto, 12 + Math.floor(Math.random() * 12), 'chispa', rebote, 1.4); salpicar(punto, 4, 'chispaBlanca', rebote, 1.8); sfx('hit', { pos: punto }); }
  else if (r < .8) { salpicar(punto, 5, 'chispaBlanca', rebote, 1); burst(punto, 3, 'hot', rebote); sfx('hit', { pos: punto }); }
  else { salpicar(punto, 7, 'nucleo', rebote, 1.2); salpicar(punto, 5, 'chispa', null, .8); sfx('chispas', { pos: punto }); }
  if (o.dmg > 20 && Math.random() < .5) { salpicar(punto, 5, 'aceite', rebote, .7); salpicarDetras(punto, dir, .7, 'aceite', 1.6); }
  // torso: la placa salta y se ve el núcleo
  if (b === 'torso' && Z && e.nucleo && !e.nucleo.on && Z.hp < Z.max * .55) {
    e.nucleo.on = true; e.nucleo.m.visible = true;
    if (R.plate && R.plate.parent) { const i = R.hit.indexOf(R.plate); if (i >= 0) R.hit.splice(i, 1); R.plate.getWorldPosition(tB); escombro(R.plate, new V3(dir.x * 3 + rnd(-1, 1), rnd(1.5, 3), dir.z * 3 + rnd(-1, 1)), { vida: 12 }); salpicar(tB, 14, 'chispa'); salpicar(tB, 8, 'nucleo'); sfx('clang'); }
    // cables al aire alrededor del núcleo (en la pieza grande del pecho)
    const vol = m => { const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); const s = g.boundingBox.getSize(tC); return s.x * s.y * s.z; }, pecho = R.hit.filter(m => m.parent === R.spine).sort((x, y) => vol(y) - vol(x))[0];
    if (pecho) { tC.set(0, .4, .2); R.spine.localToWorld(tC); herida(pecho, tC, { tipo: K.CABLES, cat: 'cables', tam: .2, dueño: e, vida: 9999 }); }
  }
  if (b === 'torso' && e.nucleo?.on) salpicar(punto, 5, 'nucleo', null, 1.2);
  // cojera según el daño de las piernas
  actualizarCojera(e);
  // rotura → se suelta la pieza
  if (Z && Z.hp <= 0) {
    const seg = segmentoDeZona(z);
    if (seg && !R.lost[seg]) {
      desprender(e, seg, dir);
      if (seg === 'head') return true; // sin cabeza el robot cae
      if (seg.startsWith('leg') || seg.startsWith('shin')) { e.arrastre = true; e.cojera = 0; sfx('land'); }
    }
  }
  return false;
}
function actualizarCojera(e) {
  let peor = 0, l = 'L';
  for (const s of ['L', 'R']) { const a = e.zonas['thigh' + s], b = e.zonas['shin' + s], f = e.zonas['foot' + s]; const d = 1 - Math.min(a.hp / a.max, b.hp / b.max, f.hp / f.max * 1.5); if (d > peor) { peor = d; l = s; } if (e.roto?.['leg' + s]) { peor = Math.max(peor, 1); l = s; } }
  e.cojera = clamp((peor - .25) / .55, 0, 1); e.cojeraLado = l;
}

function impactoHumano(e, z, Z, o) {
  const R = e.R, b = base(z), s = lado(z), dir = o.dir, punto = o.punto, tipo = o.tipo || 'bala', dmg = o.dmg;
  if (R.esActor) { impactoActor(e, z, Z, o); return; }
  let malla = o.malla && R.hit.includes(o.malla) ? o.malla : R.hit.find(m => m.userData.zona === z);
  // piezas diminutas (nariz, ojos) o pelo/barba de la cara: la herida va a la pieza grande de piel de esa zona
  if (malla && (z === 'head' || z === 'neck')) { const g = malla.geometry; if (!g.boundingBox) g.computeBoundingBox(); const sz = g.boundingBox.getSize(tC); if (Math.max(sz.x, sz.y, sz.z) < .09 || malla.material !== R._matPiel) { const piel = mayorDe(R, z, R._matPiel); if (piel && (malla.material !== R._matPiel || piel !== malla)) malla = piel; } }
  const corta = tipo === 'bala' || tipo === 'corte' || tipo === 'escopeta';
  // herida según la superficie: piel (cabeza, manos, mangas cortas) o tela
  const sup = malla && R._matPiel && malla.material === R._matPiel ? 'piel' : 'tela';
  const res = malla ? marcarImpacto(malla, punto, dir, { tipo, dmg, superficie: sup, swing: o.swing, dueño: e }) : { salida: null };
  // sangre: chorro en la dirección de la bala, salpicadura en la pared de detrás (desde la salida si atraviesa)
  if (tipo === 'bala' || tipo === 'escopeta') {
    salpicar(punto, tipo === 'escopeta' ? 7 : 6, 'sangre', tA.copy(dir).multiplyScalar(.5), .9);
    const desde = res.salida || punto; if (res.salida) salpicar(res.salida, 12, 'sangre', tA.copy(dir).multiplyScalar(1.2), 1.3);
    salpicarDetras(desde, dir, res.salida ? 1.4 : .8);
    sfx('carne', { pos: punto, vol: rnd(.55, .85) }); if (z === 'head' && Math.random() < .6) sfx('hueso', { pos: punto, vol: .5 });
  } else if (tipo === 'corte') {
    salpicar(punto, 7, 'sangre', tA.copy(o.swing || dir).multiplyScalar(.8), .9); if (Math.random() < .5) salpicarDetras(punto, o.swing || dir, .5, 'sangre', 1.4);
    sfx('slash', { pos: punto }); sfx('carne', { pos: punto, vol: .35 });
  } else {
    if (dmg > 20 && sup === 'piel') salpicar(punto, 3, 'sangre', tA.copy(dir).negate(), .5);
    sfx(dmg > 24 ? 'stone' : Math.random() < .5 ? 'punch' : 'kick', { pos: punto, vol: clamp(.5 + dmg / 40, .5, 1) });
    if (dmg > 22 && Math.random() < .4) sfx('hueso', { pos: punto, vol: .45 });
  }
  // huesos rotos: se acumula el daño contundente por miembro
  const mb = miembro(z);
  if (mb && !e.roto[mb]) {
    e.golpes[mb] += tipo === 'contundente' ? dmg : dmg * .35;
    if (e.golpes[mb] >= 40 || (Z && Z.hp <= 0)) romper(e, mb, punto);
  }
  actualizarCojera(e);
}
function mayorDe(R, z, mat) { let mejor = null, mv = 0; for (const m of R.hit) { if (m.userData.zona !== z || (mat && m.material !== mat)) continue; const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); const v = g.boundingBox.getSize(tC).lengthSq(); if (v > mv) { mv = v; mejor = m; } } return mejor; }
// ActorGLB (.glb con esqueleto): herida pintada en su textura de daño (piel.js), clip de reacción si existe
function impactoActor(e, z, Z, o) {
  const A = e.R.actor, tipo = o.tipo || 'bala', dmg = o.dmg;
  const r = A.herida(o.punto, o.dir, tipo, dmg, o.swing, o.malla?.parent?.isBone ? o.malla.parent : null);
  if (!r) { if (tipo !== 'contundente') { salpicar(o.punto, 6, 'sangre', tA.copy(o.dir).multiplyScalar(.5), .9); salpicarDetras(o.punto, o.dir, .8); } sfx(tipo === 'contundente' ? 'punch' : 'carne', { pos: o.punto }); }
  if (dmg >= 12 || base(z) === 'head') A.reaccion(z);
  const mb = miembro(z);
  if (mb && !e.roto[mb]) { e.golpes[mb] += tipo === 'contundente' ? dmg : dmg * .35; if (e.golpes[mb] >= 40 || (Z && Z.hp <= 0)) romper(e, mb, o.punto); }
  actualizarCojera(e);
}
function romper(e, mb, punto) {
  e.roto[mb] = true; sfx('snap'); salpicar(punto, 4, 'sangreOsc', null, .6);
  if (mb.startsWith('arm')) soltarArma(e, mb.slice(-1));
  if (mb.startsWith('leg')) { e.cojeraLado = mb.slice(-1); e.stagger = Math.max(e.stagger || 0, .6); }
}

// ---------- Soltar piezas ----------
const grupoDe = (R, seg) => seg === 'head' ? R.neck : seg.startsWith('arm') ? R['arm' + seg.slice(-1)].sh : seg.startsWith('foreArm') ? R['arm' + seg.slice(-1)].el : seg.startsWith('leg') ? R['leg' + seg.slice(-1)].hp : R['leg' + seg.slice(-1)].kn;
export function desprender(e, seg, dir, fuerza = 1) {
  const R = e.R || e, rob = !R.humano; if (R.lost[seg]) return null;
  const s = seg.slice(-1);
  if (R.esActor) { if ((seg.startsWith('foreArm') && R.lost['arm' + s]) || (seg.startsWith('shin') && R.lost['leg' + s])) return null; R.lost[seg] = true; if (seg.startsWith('arm')) R.lost['foreArm' + s] = true; if (seg.startsWith('leg')) R.lost['shin' + s] = true; R.hit.length = 0; R.hit.push(...R.actor.hit); const m = R.actor.desmembrar(seg, dir); R.hit.length = 0; R.hit.push(...R.actor.hit); return m; }
  if (seg.startsWith('foreArm') && R.lost['arm' + s]) return null;
  if (seg.startsWith('shin') && R.lost['leg' + s]) return null;
  const g = grupoDe(R, seg); R.lost[seg] = true;
  if (seg.startsWith('arm')) R.lost['foreArm' + s] = true;
  if (seg.startsWith('leg')) R.lost['shin' + s] = true;
  R.root.updateMatrixWorld(true);
  if (seg.startsWith('arm') || seg.startsWith('foreArm')) soltarArma(e, s);
  // todas las mallas del miembro (con sus marcas) en un grupo que vuela como UN cuerpo rígido
  const ms = []; g.traverse(o => { if (o.isMesh && o.userData.part) ms.push(o); });
  for (const m of ms) { const i = R.hit.indexOf(m); if (i >= 0) R.hit.splice(i, 1); }
  const pieza = new THREE.Group(); g.getWorldPosition(pieza.position); g.getWorldQuaternion(pieza.quaternion); g.getWorldScale(pieza.scale);
  scene.add(pieza); for (const m of ms) pieza.attach(m);
  // muñones: en el cuerpo (sigue al padre) y en el miembro suelto
  const r = seg === 'head' ? .055 : seg.startsWith('leg') ? .065 : seg.startsWith('arm') ? .05 : .045;
  const mun = new THREE.Mesh(geoMunon, rob ? matMunonRobot : matMunonSangre); mun.scale.set(r, r, r); g.add(mun); mun.userData.munon = true;
  const mun2 = mun.clone(); pieza.add(mun2);
  tA.set(dir.x, 0, dir.z).normalize();
  escombro(pieza, new V3(tA.x * 3 * fuerza + rnd(-1, 1), rnd(1.8, 3.5) * fuerza, tA.z * 3 * fuerza + rnd(-1, 1)), { vida: 16, giro: 7, densidad: rob ? 1800 : 1000 });
  g.getWorldPosition(tB);
  if (rob) { burst(tB, 14, 'hot'); salpicar(tB, 22, 'chispa', null, 1.3); salpicar(tB, 12, 'aceite', null, 1); manchaSuelo(tB, .35, 'aceite'); salpicarDetras(tB, tA, 1, 'aceite'); sfx('snap', { pos: tB }); }
  else { salpicar(tB, 26, 'sangre', null, 1.2); manchaSuelo(tB, .3); salpicarDetras(tB, tA, 1.6); sfx('snap', { pos: tB }); }
  emisores.push({ o: g, t: rob ? 4 : 2.5, cd: 0, tipo: rob ? 'chispa' : 'sangre' });
  return pieza;
}
// el arma (o lo que lleve en la mano) cae
export function soltarArma(e, s) {
  const R = e.R || e, A = s === 'L' ? R.armL : R.armR; if (!A?.grip) return;
  for (const c of [...A.grip.children]) { c.getWorldPosition(tA); escombro(c, new V3(rnd(-1, 1), rnd(1, 2.5), rnd(-1, 1)), { vida: 20, giro: 4, densidad: 1500 }); }
  if (s === 'R' && e.arma) e.arma = null;
}

// ---------- Morir ----------
// info: { zona, dmg, tipo, punto, dir } · devuelve 'ragdoll' | 'explota' (el llamador hace la explosión clásica)
export function matarCuerpo(e, info) {
  const R = e.R, rob = !R.humano, dir = info.dir || tA.set(0, 0, 1), z = info.zona || 'torso', tipo = info.tipo || 'bala';
  const pesado = info.dmg >= 30 || tipo === 'escopeta' || (tipo === 'contundente' && info.dmg >= 26);
  if (rob && (info.dmg >= 60 || tipo === 'explosivo' || !FIS.listo)) return 'explota';
  for (const m of R.hit) { m.userData.enemy = null; }
  // desmembramiento básico de humanos al morir por daño alto en miembro o cabeza
  if (!rob && pesado) { const seg = segmentoDeZona(z); if (seg) desprender(e, seg, dir, 1.2); }
  if (rob) { tB.copy(info.punto || R.root.position); salpicar(tB, 20, 'chispa', null, 1.4); salpicar(tB, 10, 'aceite'); if (e.nucleo) { e.nucleo.mat.emissiveIntensity = 0; } }
  else if (info.punto) salpicar(info.punto, 14, 'sangre', dir, 1);
  // charco bajo el cuerpo cuando ya ha caído (crece despacio y se para)
  pendientes.push({ t: rob ? 1.2 : 1.6, fn: () => { R.spine.getWorldPosition(tC); charco(tC, rob ? rnd(.3, .45) : rnd(.45, .7), rob ? 'aceite' : 'sangre'); } });
  const vel = new V3(Math.sin(R.root.rotation.y) * (e.speedCur || 0), 0, Math.cos(R.root.rotation.y) * (e.speedCur || 0)).add(e.push || tC.set(0, 0, 0));
  if (vel.length() > 3) vel.setLength(3); // varios golpes en el mismo fotograma no lanzan el cuerpo a la otra punta
  const fuerza = clamp(info.dmg / 9, 1.5, 7) * (tipo === 'escopeta' ? 1.6 : 1);
  const rag = R.esActor ? R.actor.morir({ dir, fuerza, zona: z, punto: info.punto, vel }, R) : crearRagdoll(R, { dir, fuerza, zona: z, punto: info.punto, vel });
  if (!rag && !R.esActor) staticPose(R, { spd: 0, down: 1 }); // sin física: tumbado en el suelo
  const c = { R, e, t: 0, rob };
  for (const m of R.hit) m.userData.cadaver = c;
  cadaveres.push(c); if (cadaveres.length > MAX_CADAVERES) quitarCadaver(cadaveres[0]);
  return 'ragdoll';
}

// ---------- Cadáveres (se pueden seguir golpeando: reaccionan con la física) ----------
export const cadaveres = []; const MAX_CADAVERES = 14;
export const mallasCadaveres = () => { const t = []; for (const c of cadaveres) for (const m of c.R.hit) t.push(m); return t; };
export function golpearCadaver(c, o) {
  const R = c.R, z = o.zona || (o.malla && o.malla.userData.zona) || 'torso', dir = o.dir, tipo = o.tipo || 'bala';
  if (c.rob) { salpicar(o.punto, 8, 'chispa', tA.copy(dir).negate()); if (o.malla) marcarImpacto(o.malla, o.punto, dir, { tipo, dmg: o.dmg, superficie: 'metal', dueño: c.e }); sfx('hit', { pos: o.punto }); }
  else if (R.esActor) { salpicar(o.punto, 8, 'sangre', dir); R.actor.pintadas = 0; R.actor.herida(o.punto, dir, tipo, o.dmg, o.swing, o.malla?.parent?.isBone ? o.malla.parent : null); }
  else { salpicar(o.punto, 8, 'sangre', dir); if (o.malla) { const sup = c.R._matPiel && o.malla.material === c.R._matPiel ? 'piel' : 'tela'; const res = marcarImpacto(o.malla, o.punto, dir, { tipo, dmg: o.dmg, superficie: sup, swing: o.swing, dueño: c.e }); if (tipo !== 'contundente') salpicarDetras(res.salida || o.punto, dir, 1); } sfx(tipo === 'contundente' ? 'punch' : 'carne', { pos: o.punto }); }
  if (!c.rob && (o.dmg >= 30 || tipo === 'escopeta')) { const seg = segmentoDeZona(z); if (seg && !R.lost[seg]) { if (R._rag) congelar(R._rag); /* se reconstruye sin ese miembro */ desprender(c.e, seg, dir, 1); } }
  if (c.rob && o.dmg >= 25) { const seg = segmentoDeZona(z); if (seg && !R.lost[seg] && Math.random() < .5) { if (R._rag) congelar(R._rag); desprender(c.e, seg, dir, 1); } }
  crearRagdoll(R, { dir, fuerza: clamp(o.dmg / 10, 1, 5), zona: z, punto: o.punto });
  c.t = 0;
}
export function quitarCadaver(c) { if (c.R._rag) congelar(c.R._rag); quitarMarcasDe(c.e); if (c.R.esActor) c.R.actor.quitar(); c.R.root.removeFromParent(); const i = cadaveres.indexOf(c); if (i >= 0) cadaveres.splice(i, 1); }
export function limpiarCadaveres() { while (cadaveres.length) quitarCadaver(cadaveres[0]); emisores.length = 0; pendientes.length = 0; }

// ---------- Muñones que chispean / sangran ----------
export const emisores = [];
const pendientes = [];
export function actualizarDanio(dt, enemigos) {
  for (let i = pendientes.length - 1; i >= 0; i--) { const p = pendientes[i]; p.t -= dt; if (p.t <= 0) { pendientes.splice(i, 1); p.fn(); } }
  for (let i = emisores.length - 1; i >= 0; i--) {
    const em = emisores[i]; em.t -= dt; em.cd -= dt;
    if (em.cd <= 0 && em.o.parent) { em.cd = em.tipo === 'chispa' ? rnd(.05, .14) : rnd(.08, .18); em.o.getWorldPosition(tA); salpicar(tA, em.tipo === 'chispa' ? 3 : 2, em.tipo, null, em.tipo === 'chispa' ? 1.1 : .35); if (em.tipo === 'chispa' && Math.random() < .2) { burst(tA, 2, 'hot'); if (Math.random() < .3) sfx('chispas', { pos: tA, vol: .3 }); } }
    if (em.t <= 0) emisores.splice(i, 1);
  }
  if (enemigos) for (const e of enemigos) {
    if (e.aturdido > 0) e.aturdido -= dt;
    if (e.nucleo?.on) e.nucleo.mat.emissiveIntensity = 2.5 + Math.sin(G.time * 9 + e.pos.x) * 1.5 + (Math.random() < .05 ? 3 : 0);
  }
}
// multiplicador de velocidad por heridas
export function factorVelocidad(e) {
  if (e.arrastre) return .22;
  let f = 1 - (e.cojera || 0) * .45;
  if (e.roto?.legL || e.roto?.legR) f = Math.min(f, .5);
  if (e.aturdido > 0) f *= .35;
  return f;
}

// ---------- Personajes .glb con esqueleto (mixamorig): desmembrar escalando el hueso a 0 ----------
// devuelve una cápsula con el material de la malla como miembro suelto (el .glb no se puede partir sin cortar la malla)
export function desmembrarHueso(raiz, nombreBase, dir, material) {
  const H = huesosMixamo(raiz), b = H[nombreBase]; if (!b) return null;
  b.getWorldPosition(tA); const hijo = b.children.find(c => c.isBone); const L = hijo ? hijo.getWorldPosition(tB).distanceTo(tA) * 1.6 : .25;
  b.scale.setScalar(1e-4);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(L * .16, L, 3, 8), material || matMunonSangre); m.position.copy(tA); raiz.parent?.add(m);
  escombro(m, new V3(dir.x * 3, 2.5, dir.z * 3), { vida: 14 });
  salpicar(tA, 24, 'sangre', null, 1.2); manchaSuelo(tA, .3); salpicarDetras(tA, dir, 1.4); emisores.push({ o: b.parent || b, t: 2.5, cd: 0, tipo: 'sangre' });
  return m;
}
