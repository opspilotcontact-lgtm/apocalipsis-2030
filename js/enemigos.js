// Enemigos: robots R-7 que persiguen y golpean; guardias con linterna y focos que barren (sigilo).
import { THREE, V3, G, mix, clamp, rnd, angLerp, scene, canvasPlane, textDraw, collideCircle, groundAt, envActivo, capas } from './nucleo.js';
import { makeRobot, makeHuman, animRig, PAL } from './cuerpos.js';
import { burst, dmgNumber, sfx, limpiarEscombros } from './fx.js';
import { P, playerFeet, playerHead, hurtPlayer } from './jugador.js';
import { car, pushFromCar } from './vehiculos.js';
import { say } from './ui.js';
import { director } from './historia/director.js';
import { luzFx } from './nucleo.js';
import { crearActor, actorListo, precargarActor } from './combate/actor.js';
import { registrarOido, prepararOido, alertar, cerebroOido, actualizarOidoGuardias, robotsTeVen, hayPatrullas } from './combate/oido.js';
import { actualizarCombate, limpiarCombate, prepararDanio, impactoZona, matarCuerpo, zonaDe, quitarCapa, ponerCapa, brazoUtil, factorVelocidad, escombro, mallasCadaveres } from './combate/index.js';

const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3();
export const enemies = [];
export const enemyMeshes = () => { const t = []; for (const e of enemies) for (const m of e.R.hit) t.push(m); return t; };
// cadáveres (siguen siendo golpeables: el ragdoll reacciona) — userData.cadaver en cada malla
export const corpseMeshes = mallasCadaveres;
const _inv = new THREE.Matrix4(), _lp = new V3(), _wc = new V3();
export function pointInMesh(p, m, margin) {
  const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingSphere) g.computeBoundingSphere();
  const s = m.matrixWorld.getMaxScaleOnAxis(); _wc.copy(g.boundingSphere.center).applyMatrix4(m.matrixWorld);
  if (_wc.distanceTo(p) > g.boundingSphere.radius * s + margin) return false;
  _lp.copy(p).applyMatrix4(_inv.copy(m.matrixWorld).invert()); const bb = g.boundingBox, mm = margin / s;
  return _lp.x > bb.min.x - mm && _lp.x < bb.max.x + mm && _lp.y > bb.min.y - mm && _lp.y < bb.max.y + mm && _lp.z > bb.min.z - mm && _lp.z < bb.max.z + mm;
}
function makeBar(w, color) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(w + .04, .07), new THREE.MeshBasicMaterial({ color: 0x0a0d14, transparent: true, opacity: .85, toneMapped: false })));
  const fg = new THREE.PlaneGeometry(w, .045); fg.translate(w / 2, 0, 0); const fill = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color, toneMapped: false })); fill.position.set(-w / 2, 0, .002); g.add(fill);
  scene.add(g); g.visible = false; return { g, fill };
}
// kind: 'r7' (infantería) · 'r7d' (dormido: arranca con el ojo apagado y se levanta) · 'villano' (humano hostil)
// o: { hp, vel, retraso, humano: paleta de makeHuman (para humanos), arma: true (lleva un arma en la mano derecha),
//      ruta: [[x,z],…] patrulla con oído (combate/oido.js) · oido: true (vigila quieto y oye) · mira: yaw al vigilar,
//      modelo: 'Dave_animado' → humano realista .glb con esqueleto (combate/actor.js; hay que precargarActor antes) }
// rig «adaptador» de un ActorGLB: expone lo que el combate usa del rig por código (root, hit, lost, spine, manos)
function rigActor(nombre, o) {
  if (!actorListo(nombre)) { precargarActor(nombre); console.warn('[enemigos] ' + nombre + ' sin precargar: uso el humano por código'); return null; }
  const A = crearActor(nombre, o), H = A.H;
  return { root: A.root, hit: A.hit, S: 1, lost: {}, humano: true, esActor: true, actor: A, spine: H.Spine1 || H.Spine, armL: { grip: H.LeftHand }, armR: { grip: H.RightHand }, flash: 0, t: 0 };
}
export const VILLANO = { camisa: 0x2a2a2e, pantalon: 0x1e2024, piel: 0xc8946c, pelo: 0x14100c, chaleco: 0x3a1a16, zapato: 0x111111, barba: true };
export function spawn(kind, x, z, o = {}) {
  const humano = kind === 'villano' || !!o.humano;
  const cfg = humano ? { ...VILLANO, ...(o.humano === true ? {} : o.humano) } : { ...PAL.r7 };
  const R = (humano && o.modelo && rigActor(o.modelo, o)) || (humano ? makeHuman(cfg) : makeRobot(cfg)); R.root.position.set(x, groundAt(x, z, 3), z); scene.add(R.root);
  const e = { kind, R, pos: R.root.position, S: R.S, hpMax: o.hp || (humano ? 100 : 80), state: 'chase', t: 0, atkCD: 1 + rnd(0, .6), stagger: 0, flinch: 0, twist: 0, lean: 0, headSnap: 0, down: 0, downT: 0, boot: humano ? 1 : -(o.retraso || 0), alive: true, push: new V3(), speedCur: 0, atkPhase: -1, reach: humano ? 1.3 : 1.55, lastHit: -9, struck: false, stuck: 0, detourT: 0, detour: 1, flank: rnd(-.5, .5), vel: o.vel || 1, humano };
  e.hp = e.hpMax; for (const m of R.hit) m.userData.enemy = e;
  prepararDanio(e);
  if (o.ruta || o.oido) prepararOido(e, o);
  if (o.arma && R.esActor) { const a = new THREE.Mesh(new THREE.BoxGeometry(.05, .08, .42), new THREE.MeshStandardMaterial({ color: 0x24272c, metalness: .7, roughness: .4 })); R.root.updateMatrixWorld(true); R.armR.grip.getWorldPosition(a.position); a.position.y -= .02; scene.add(a); R.armR.grip.attach(a); e.arma = a; }
  else if (o.arma) { const a = new THREE.Mesh(new THREE.BoxGeometry(.05, .08, .42), new THREE.MeshStandardMaterial({ color: 0x24272c, metalness: .7, roughness: .4 })); a.position.set(0, -.02, .12); a.castShadow = true; R.armR.grip.add(a); e.arma = a; }
  e.bar = makeBar(.7, '#ff5a3a');
  const pf = playerFeet(tA); R.root.rotation.y = Math.atan2(pf.x - x, pf.z - z);
  if (R.esActor) R.actor.actualizar(0, {}); else if (humano) animRig(R, 1, { spd: 0 }); else { animRig(R, 1, { spd: 0, boot: 0 }); R.mEye.emissiveIntensity = 0; }
  enemies.push(e); return e;
}
export function removeEnemy(e, dejarCuerpo = false) { if (!dejarCuerpo) e.R.root.removeFromParent(); e.bar.g.removeFromParent(); const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); }
export function limpiarEnemigos() { while (enemies.length) removeEnemy(enemies[0]); limpiarEscombros(); limpiarCombate(); }
export const vivos = () => enemies.filter(e => e.alive).length;
export function knockdown(e) { if (e.downT > 0 || !e.alive) return; e.downT = 2.5; e.state = 'chase'; e.atkPhase = -1; sfx('clang'); }
// o (opcional): { zona, tipo: 'bala'|'contundente'|'corte'|'escopeta'|'explosivo', malla }
export function damageEnemy(e, dmg, point, dir, part, melee, limb, o = {}) {
  if (!e.alive) return;
  if (e.modo) alertar(e); // un robot que patrulla y recibe un golpe deja de buscar: te ha encontrado
  const zona = o.zona || zonaDe(o.malla, part, limb, point), tipo = o.tipo || (melee ? 'contundente' : 'bala');
  e.hp -= dmg; e.R.flash = 1; e.lastHit = G.time; if (e.boot < 1) e.boot = 1;
  const ry = e.R.root.rotation.y, lx = dir.x * Math.cos(ry) - dir.z * Math.sin(ry), lz = dir.x * Math.sin(ry) + dir.z * Math.cos(ry), amt = clamp(dmg / 22, .25, 1);
  e.twist = clamp(e.twist - lx * amt * 1.2, -1, 1); e.lean = clamp(e.lean - lx * amt, -1, 1); e.flinch = clamp(e.flinch + (lz < 0 ? 1 : -.6) * amt, -1, 1);
  if (zona === 'head' || zona === 'neck') e.headSnap = 1;
  tA.set(dir.x, 0, dir.z); if (tA.lengthSq() > 1e-6) e.push.addScaledVector(tA.normalize(), (melee ? 4 : 1.2) * dmg / 20);
  if (dmg >= 24) { e.stagger = .35; e.state = 'chase'; e.atkPhase = -1; }
  if (melee && dmg >= 40) knockdown(e);
  const letal = impactoZona(e, { dmg, punto: point, dir, zona, tipo, malla: o.malla, lx, swing: o.swing });
  if (!e.humano) burst(point, melee ? 8 : 4, zona === 'head' ? 'blue' : 'hot', tB.copy(dir).negate());
  dmgNumber(point, Math.round(dmg), zona === 'head'); // el sonido del impacto lo elige combate/danio.js según superficie y arma
  G.hitT = .12; if (melee) G.shake = Math.max(G.shake, .25);
  e.bar.g.visible = true;
  if (letal) e.hp = Math.min(e.hp, 0);
  if (e.hp <= 0) killEnemy(e, dir, { zona, dmg, tipo, punto: point });
}
function killEnemy(e, dir, info = { dmg: 99 }) {
  e.alive = false; e.R.root.updateMatrixWorld(true);
  quitarCapa(e.R);
  // ragdoll (o cadáver posado si no hay física); los robots con daño enorme siguen explotando en piezas
  if (matarCuerpo(e, { ...info, dir }) === 'ragdoll') {
    if (!e.humano) { sfx('clang'); G.shake = Math.max(G.shake, .2); }
    removeEnemy(e, true);
    director.evento(e.humano ? 'humanoCaido' : 'robotCaido');
    return;
  }
  const ms = []; e.R.root.traverse(o => { if (o.isMesh) ms.push(o); });
  for (const m of ms) escombro(m, new V3(rnd(-2.5, 2.5), rnd(2, 5), rnd(-2.5, 2.5)).addScaledVector(dir, 3));
  tC.copy(e.pos); tC.y += 1.2 * e.S; burst(tC, 34, 'hot'); burst(tC, 12, 'oil'); luzFx.position.copy(tC); luzFx.intensity = 50;
  sfx('boom'); G.shake = Math.max(G.shake, .3); removeEnemy(e);
  director.evento('robotCaido');
}
function updateEnemy(e, dt) {
  // parón de impacto: la animación se frena un instante tras un golpe
  if (e.hitStop > 0) { e.hitStop -= dt; dt *= .12; }
  const R = e.R, pf = playerFeet(tC), dx = pf.x - e.pos.x, dz = pf.z - e.pos.z, dist = Math.hypot(dx, dz), dy = Math.abs(pf.y - e.pos.y);
  e.atkCD -= dt; e.detourT -= dt;
  const dec = Math.min(1, dt * 3); e.flinch = mix(e.flinch, 0, dec); e.twist = mix(e.twist, 0, dec); e.lean = mix(e.lean, 0, dec); e.headSnap = Math.max(0, e.headSnap - dt * 4);
  let want = 0; let face = Math.atan2(dx, dz) + (e.detourT > 0 && e.state === 'chase' ? e.detour * 1.3 : 0) + (dist > 3 ? e.flank : 0);
  if (e.boot < 1) { e.boot = Math.min(1, e.boot + dt / 1.6); if (e.boot === 0 || (e.boot > 0 && e.boot - dt / 1.6 <= 0)) sfx('boot'); R.mEye.emissiveIntensity = e.boot <= 0 ? 0 : (Math.random() < .3 ? .3 : 3) * e.boot; if (e.boot >= 1) R.mEye.emissiveIntensity = 3; }
  else if (e.downT > 0) { e.downT -= dt; const tt = 2.5 - e.downT; e.down = tt < .35 ? tt / .35 : tt < 1.6 ? 1 : Math.max(0, 1 - (tt - 1.6) / .9); if (e.downT <= 0) e.down = 0; }
  else if (e.stagger > 0) { e.stagger -= dt; }
  else if (P.dead > 0 || G.pausaEnemigos) want = 0;
  else if (e.aturdido > 0) want = .4;
  else if (e.modo && e.modo !== 'alerta') { const r = cerebroOido(e, dt, pf, playerHead(tD)); want = r.want; face = r.face; }
  else if (e.state === 'attack') {
    e.t += dt; const dur = 1; e.atkPhase = e.t / dur;
    if (!e.struck && e.atkPhase > .62) { e.struck = true; const fwd = R.root.rotation.y; if (dist < e.reach + .5 && dy < 1.4 && Math.abs(angLerp(fwd, Math.atan2(dx, dz), 1) - fwd) < 1) { const lostAll = !brazoUtil(e, 'L') && !brazoUtil(e, 'R'); hurtPlayer((e.humano ? 8 : 10) * (lostAll ? .4 : 1), e.pos, zonaGolpe(e)); sfx(e.humano ? 'punch' : 'clang'); } }
    if (e.t >= dur) { e.state = 'chase'; e.atkCD = 1.3; e.atkPhase = -1; }
  } else {
    if (dist < e.reach && e.atkCD <= 0 && dy < 1.4 && !car.occupied) { e.state = 'attack'; e.t = 0; e.struck = false; }
    else if (dist > e.reach * .85) want = (dist > 6 ? 3.6 : 2.5) * e.vel;
  }
  want *= factorVelocidad(e);
  if (e.arrastre) { e.down = 1; e.ciclo += dt * (1.5 + Math.abs(e.speedCur) * 4); }
  const active = e.boot >= 1 && e.downT <= 0 && P.dead <= 0;
  if (active) R.root.rotation.y = angLerp(R.root.rotation.y, face, dt * (e.state === 'attack' ? 3 : 6));
  e.speedCur = mix(e.speedCur, e.stagger > 0 ? -.8 : want, Math.min(1, dt * 5));
  const fy = R.root.rotation.y, bx = e.pos.x, bz = e.pos.z;
  e.pos.x += Math.sin(fy) * e.speedCur * dt + e.push.x * dt; e.pos.z += Math.cos(fy) * e.speedCur * dt + e.push.z * dt; e.push.multiplyScalar(Math.max(0, 1 - dt * 5));
  for (const o of enemies) { if (o === e) continue; const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d = Math.hypot(ox, oz), m = .45 * (e.S + o.S); if (d < m && d > 1e-4) { e.pos.x += ox / d * (m - d) * .5; e.pos.z += oz / d * (m - d) * .5; } }
  if (!car.occupied && !P.sentado) { const m = .35 + .4 * e.S; if (dist < m && dist > 1e-4 && dy < 1.5) { const k = (m - dist) / dist * .5; e.pos.x -= dx * k; e.pos.z -= dz * k; } }
  pushFromCar(e.pos, .4 * e.S);
  collideCircle(e.pos, .4 * e.S, e.pos.y);
  e.pos.y = mix(e.pos.y, groundAt(e.pos.x, e.pos.z, e.pos.y), Math.min(1, dt * 10));
  if (want > .5) { const moved = Math.hypot(e.pos.x - bx, e.pos.z - bz); e.stuck = moved < want * dt * .35 ? e.stuck + dt : Math.max(0, e.stuck - dt); if (e.stuck > .35 && e.detourT <= 0) { e.detourT = 1.4; e.detour = Math.random() < .5 ? -1 : 1; e.stuck = 0; } }
  if (R.esActor) {
    if (e.dolor) { const k = Math.min(1, dt * 3.4); for (const n in e.dolor) e.dolor[n] = mix(e.dolor[n], 0, k); }
    const alerta = !e.modo || e.modo === 'alerta';
    R.actor.root.rotation.y = R.root.rotation.y;
    R.actor.actualizar(dt, { vel: e.arrastre ? 0 : e.speedCur, mirar: alerta && dist < 12 ? playerHead(tD) : null, ataque: e.state === 'attack' ? e.atkPhase : -1, cojera: e.cojera, cojeraLado: e.cojeraLado, aturdido: e.aturdido, dolor: e.dolor, rotos: e.roto });
  } else {
  quitarCapa(R);
  animRig(R, dt, { spd: e.arrastre ? 0 : e.speedCur, atk: e.state === 'attack' && !e.arrastre ? e.atkPhase : -1, atkLeft: !brazoUtil(e, 'R') && brazoUtil(e, 'L'), flinch: e.flinch, twist: e.twist, lean: e.lean, headSnap: e.headSnap, down: e.down, boot: clamp(e.boot, 0, 1) });
  ponerCapa(e, dt);
  }
  e.bar.g.position.set(e.pos.x, e.pos.y + (2.3 - e.down * 1.6) * e.S + .12, e.pos.z); e.bar.g.lookAt(G.CAM); e.bar.fill.scale.x = Math.max(.001, e.hp / e.hpMax);
}
export function actualizarEnemigos(dt) { for (const e of [...enemies]) updateEnemy(e, dt); actualizarCombate(dt, enemies); }
// dónde le da el enemigo al jugador (VR: la zona cambia el efecto)
function zonaGolpe(e) { if (e.arrastre) return 'pierna'; const r = Math.random(); return r < .25 ? 'cabeza' : r < .7 ? 'torso' : r < .85 ? 'brazoI' : 'brazoD'; }

// ---------- Sigilo: guardias con linterna y focos ----------
export const guardias = [], focos = [];
export const deteccion = { v: 0, activa: false, visto: false, avisoT: 0 };
registrarOido(enemies, guardias, () => P); // P por función: jugador.js y enemigos.js se importan en ciclo
const linternaMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
const GUARDIA = { camisa: 0x4a5236, pantalon: 0x3d4330, piel: 0xc58c64, pelo: 0x1a1410, casco: true, gorraColor: 0x3a4028, chaleco: 0x2f3524 };
const VISTA = 10, ANG = 0.5; // metros y medio ángulo (rad) de la linterna
// ruta: [[x,z],...] (se recorre ida y vuelta) · o: { vel, pausa, mira (yaw fijo si no hay ruta) }
export function guardia(ruta, o = {}) {
  const R = makeHuman({ ...GUARDIA, piel: [0xc58c64, 0xe0b090, 0x8a5a3a][guardias.length % 3] });
  const [x, z] = ruta[0]; R.root.position.set(x, groundAt(x, z, 3), z); scene.add(R.root);
  const geo = new THREE.ConeGeometry(Math.tan(ANG) * VISTA, VISTA, 18, 1, true); geo.translate(0, -VISTA / 2, 0); geo.rotateX(-Math.PI / 2);
  const cono = new THREE.Mesh(geo, linternaMat); cono.position.y = 1.45; cono.rotation.x = .1; R.root.add(cono);
  const g = { R, pos: R.root.position, ruta, i: 1, dir: 1, vel: o.vel || 1.25, pausa: 0, pausaMax: o.pausa ?? 1.6, yawBase: o.mira ?? 0, cono, ve: false, losT: Math.random() * .2, los: false, objetivo: null, quieto: ruta.length < 2 };
  R.root.rotation.y = g.quieto ? g.yawBase : Math.atan2(ruta[1][0] - x, ruta[1][1] - z);
  guardias.push(g); return g;
}
// foco en una torre: el haz barre entre los puntos de la ruta (ida y vuelta)
const focoMat = new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: .06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
const manchaMat = new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
export function foco(origen, ruta, o = {}) {
  // haz a lo largo de +Z: estrecho en la lámpara (z=0), ancho en el suelo (z=1); se escala en Z hasta la mancha
  const geo = new THREE.CylinderGeometry(.25, o.r || 3.2, 1, 16, 1, true); geo.translate(0, -.5, 0); geo.rotateX(-Math.PI / 2);
  const haz = new THREE.Mesh(geo, focoMat); scene.add(haz);
  const mancha = new THREE.Mesh(new THREE.CircleGeometry(o.r || 3.2, 28), manchaMat); mancha.rotation.x = -Math.PI / 2; scene.add(mancha);
  const lampara = new THREE.Mesh(new THREE.CylinderGeometry(.35, .45, .6, 12), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xeaf4ff, emissiveIntensity: 3 })); lampara.position.copy(origen); scene.add(lampara);
  const f = { origen: origen.clone(), ruta, t: o.fase || 0, vel: o.vel || .12, r: o.r || 3.2, haz, mancha, lampara, punto: new V3(), objetivo: null };
  focos.push(f); return f;
}
export function limpiarSigilo() {
  for (const g of guardias) g.R.root.removeFromParent(); guardias.length = 0;
  for (const f of focos) { f.haz.removeFromParent(); f.mancha.removeFromParent(); f.lampara.removeFromParent(); } focos.length = 0;
  deteccion.v = 0; deteccion.activa = false; deteccion.visto = false;
}
// manda a todos a mirar/ir hacia un punto (la distracción de John)
export function distraer(p) { for (const g of guardias) g.objetivo = p.clone(); for (const f of focos) f.objetivo = p.clone(); }
const ray = new THREE.Raycaster();
export function actualizarSigilo(dt) {
  actualizarOidoGuardias();
  if (!guardias.length && !focos.length && !hayPatrullas()) return;
  const ph = playerHead(tA), pf = playerFeet(tB); let visto = false, ganancia = 0;
  // justicia del sigilo: agacharse/tumbarse (G.sigilo.visibilidad) y la distancia frenan el medidor; escondido no te ven
  const vis = G.sigilo ? (G.sigilo.escondido ? 0 : clamp(G.sigilo.visibilidad ?? 1, 0, 1)) : 1;
  for (const g of guardias) {
    const R = g.R; let spd = 0, yaw = R.root.rotation.y;
    if (g.objetivo) {
      const dx = g.objetivo.x - g.pos.x, dz = g.objetivo.z - g.pos.z, d = Math.hypot(dx, dz);
      yaw = Math.atan2(dx, dz); if (d > 14) spd = 3.2;
    } else if (!g.quieto) {
      const tgt = g.ruta[g.i], dx = tgt[0] - g.pos.x, dz = tgt[1] - g.pos.z, d = Math.hypot(dx, dz);
      if (g.pausa > 0) { g.pausa -= dt; yaw = g.yawPausa + Math.sin(G.time * 1.3) * .7; }
      else if (d < .3) { g.pausa = g.pausaMax; g.yawPausa = yaw; g.i += g.dir; if (g.i >= g.ruta.length || g.i < 0) { g.dir *= -1; g.i += 2 * g.dir; } }
      else { yaw = Math.atan2(dx, dz); spd = g.vel; }
    } else yaw = g.yawBase + Math.sin(G.time * .6 + g.losT * 9) * .6;
    R.root.rotation.y = angLerp(R.root.rotation.y, yaw, dt * 4);
    g.pos.x += Math.sin(R.root.rotation.y) * spd * dt; g.pos.z += Math.cos(R.root.rotation.y) * spd * dt;
    collideCircle(g.pos, .3, g.pos.y);
    animRig(R, dt, { spd });
    // ¿ve al jugador?
    if (!deteccion.activa || P.sentado) { g.ve = false; continue; }
    tC.set(ph.x - g.pos.x, 0, ph.z - g.pos.z); const d = tC.length();
    if (vis <= 0) { g.ve = false; continue; }
    if (d < 1.4) { g.ve = true; visto = true; ganancia = Math.max(ganancia, 2); continue; }
    if (d > VISTA) { g.ve = false; continue; }
    const fwdx = Math.sin(R.root.rotation.y), fwdz = Math.cos(R.root.rotation.y), cos = (tC.x * fwdx + tC.z * fwdz) / d;
    if (cos < Math.cos(ANG)) { g.ve = false; continue; }
    g.losT -= dt; if (g.losT <= 0) { g.losT = .2; const eye = new V3(g.pos.x, g.pos.y + 1.6, g.pos.z), dir = new V3().subVectors(ph, eye); const L = dir.length(); ray.set(eye, dir.normalize()); ray.far = L - .3; g.los = ray.intersectObjects(envActivo(), false).length === 0; }
    g.ve = g.los; if (g.ve) { visto = true; ganancia = Math.max(ganancia, (d < 4 ? 1.3 : 1.3 - (d - 4) / (VISTA - 4) * .7) * Math.max(.35, vis)); } // ~0,8 s a quemarropa, ~1,7 s a 10 m de pie, ~4,5 s tumbado
  }
  for (const f of focos) {
    if (f.objetivo) f.punto.lerp(tC.set(f.objetivo.x, 0, f.objetivo.z), Math.min(1, dt * 1.5));
    else { f.t += dt * f.vel; const n = f.ruta.length - 1, u = (Math.sin(f.t) * .5 + .5) * n, i = Math.min(n - 1, Math.floor(u)), k = u - i; f.punto.set(mix(f.ruta[i][0], f.ruta[i + 1][0], k), 0, mix(f.ruta[i][1], f.ruta[i + 1][1], k)); }
    f.punto.y = .05; f.mancha.position.copy(f.punto);
    f.haz.position.copy(f.origen); const L = f.origen.distanceTo(f.punto); f.haz.scale.set(1, 1, L); f.haz.lookAt(f.punto);
    if (deteccion.activa && !P.sentado && vis > 0 && Math.hypot(pf.x - f.punto.x, pf.z - f.punto.z) < f.r * .9) { visto = true; ganancia = Math.max(ganancia, Math.max(.6, vis)); }
  }
  if (deteccion.activa && robotsTeVen()) { visto = true; ganancia = Math.max(ganancia, 1); } // los R-7 que patrullan también cuentan para el medidor
  if (!deteccion.activa) return;
  deteccion.visto = visto;
  deteccion.v = clamp(deteccion.v + (visto ? dt * 1.1 * ganancia : -dt * .45), 0, 1);
  deteccion.avisoT -= dt; if (visto && deteccion.avisoT <= 0) { deteccion.avisoT = 1; sfx('alerta'); }
  if (deteccion.v >= 1) { deteccion.activa = false; sfx('visto'); director.fallo('¡TE HAN VISTO!'); }
}
