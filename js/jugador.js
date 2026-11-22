// Jugador: movimiento PC/VR, armas, disparo, golpes físicos con las manos y objetos que se usan o se agarran.
import { THREE, V3, Y, XA, G, mix, clamp, rnd, $, renderer, scene, camera, dolly, head, vm, std, glow, rbox, cylG, texScratch, canvasPlane, textDraw, collideCircle, groundAt, envActivo } from './nucleo.js';
import { sfx, burst, tracer, fogonazo, buzz, hurt, trGeo, audio } from './fx.js';
import { car, enterCar, exitCar, driveCar, pushFromCar } from './vehiculos.js';
import { enemies, damageEnemy, enemyMeshes, corpseMeshes, pointInMesh } from './enemigos.js';
import { golpearCadaver } from './combate/index.js';
import { registrarJugador, lesionar, actualizarLesiones, reiniciarLesiones, factorPiernas, puedeCorrer, fuerzaMano, temblorMano } from './combate/lesiones.js';
import { say, ui } from './ui.js';
import { director } from './historia/director.js';
import { emitirRuido } from './interaccion/ruido.js';
import { cargarGLB } from './combate/actor.js';
import './interaccion/opciones.js'; // G.opciones (comodidad) antes de que nada las lea
export { say };

const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), tQ = new THREE.Quaternion();

export const P = { vel: new V3(), onGround: true, hp: 100, lastHurt: -9, yaw: 0, pitch: 0, w: 'punos', inv: ['punos'], ammo: { x56d: 30 }, cargadores: { x56d: [], pistola: [] }, reloading: 0, fireCD: 0, swing: -1, swingHit: false, side: 0, trigger: false, dead: 0, recoil: 0, bob: 0, trigPrev: false, bPrev: false, yPrev: false, aPrev: false, xPrev: false, snap: false, sentado: null, inmune: false, bloqueoMov: false };
export const WEAPONS = {
  punos: { id: 'punos', name: 'Puños', melee: true, dmg: 16, reach: 1.9, dur: .3, snd: 'punch', tipo: 'contundente' },
  piedra: { id: 'piedra', name: 'Piedra', melee: true, dmg: 32, reach: 2.0, dur: .42, snd: 'stone', tipo: 'contundente' },
  cuchillo: { id: 'cuchillo', name: 'Cuchillo táctico', melee: true, dmg: 28, reach: 2.1, dur: .26, snd: 'slash', tipo: 'corte' },
  x56d: { id: 'x56d', name: 'X-56D', melee: false, dmg: 17, mag: 30, rate: .09, auto: true, spread: .012, snd: 'rifle', kick: .55, tipo: 'bala', cerca: 30, lejos: 90 },
  pistola: { id: 'pistola', name: 'Pistola', melee: false, dmg: 24, mag: 12, rate: .2, auto: false, spread: .01, snd: 'pistol', kick: .8, tipo: 'bala', cerca: 12, lejos: 45 },
  // escopeta Arda (cap. 4/6): 8 perdigones, letal de cerca, casi inútil lejos; el tipo 'escopeta' desmiembra al matar
  escopeta: { id: 'escopeta', name: 'Escopeta Arda', melee: false, dmg: 11, perdigones: 8, mag: 6, rate: .85, auto: false, spread: .055, snd: 'escopeta', kick: 1.7, tipo: 'escopeta', cerca: 5, lejos: 22 }
};
const WM = { gun: std({ color: 0x3a3f47, metalness: .8, roughness: .35, roughnessMap: texScratch }), dark: std({ color: 0x14161a, metalness: .5, roughness: .6 }), steel: std({ color: 0xb8bec6, metalness: .95, roughness: .2 }), wood: std({ color: 0x4a2f1c, roughness: .8 }), roca: std({ color: 0x6e6a62, roughness: .95, flatShading: true }), glow: glow(0x2fb6ff, 3), holo: glow(0xff3b1f, 4), skin: std({ color: 0xc89a78, roughness: .7 }) };
function makeWeapon(id) {
  const g = new THREE.Group(), muzzle = new THREE.Object3D(), tip = new THREE.Object3D(); muzzle.name = 'boca'; tip.name = 'punta';
  const b = (w, h, d, m, x, y, z, rx = 0) => { const me = new THREE.Mesh(rbox(w, h, d), m); me.position.set(x, y, z); me.rotation.x = rx; g.add(me); return me; };
  const c = (r, l, m, x, y, z) => { const me = new THREE.Mesh(cylG(r, l), m); me.rotation.x = Math.PI / 2; me.position.set(x, y, z); g.add(me); };
  if (id === 'x56d') { b(.05, .08, .34, WM.gun, 0, .05, -.14); c(.013, .3, WM.dark, 0, .06, -.46); b(.042, .065, .22, WM.dark, 0, .03, .13); g.userData.cargador = b(.03, .12, .05, WM.dark, 0, -.04, -.15, .15); g.userData.cargador.name = 'cargador'; b(.032, .1, .045, WM.dark, 0, -.02, 0, .25); b(.055, .05, .16, WM.dark, 0, .045, -.38);
    b(.03, .04, .06, WM.dark, 0, .11, -.1); const ring = new THREE.Mesh(new THREE.TorusGeometry(.018, .003, 6, 16), WM.holo); ring.position.set(0, .13, -.1); g.add(ring); muzzle.position.set(0, .06, -.62); }
  if (id === 'pistola') { b(.032, .036, .19, WM.gun, 0, .045, -.05); b(.03, .1, .045, WM.dark, 0, -.015, .03, .2); b(.006, .012, .02, WM.dark, 0, .07, -.13); g.userData.cargador = b(.024, .03, .034, WM.steel, 0, -.07, .045, .2); muzzle.position.set(0, .045, -.15); }
  if (id === 'escopeta') { c(.016, .5, WM.dark, .017, .055, -.36); c(.016, .5, WM.dark, -.017, .055, -.36); b(.07, .07, .2, WM.wood, 0, .03, -.05); b(.06, .05, .16, WM.wood, 0, .03, -.3); b(.045, .1, .26, WM.wood, 0, -.01, .19, -.15); muzzle.position.set(0, .055, -.62); }
  if (id === 'piedra') { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(.075, 0), WM.roca); r.scale.set(1.1, .85, 1.3); r.position.set(0, 0, -.05); g.add(r); tip.position.set(0, 0, -.06); }
  if (id === 'cuchillo') { b(.03, .035, .12, WM.dark, 0, 0, .02); const bl = b(.006, .03, .17, WM.steel, 0, .004, -.12); tip.position.set(0, 0, -.2); }
  g.add(muzzle, tip); return { g, muzzle, tip };
}
export const WOBJ = Object.fromEntries(Object.keys(WEAPONS).map(k => [k, makeWeapon(k)]));
// ---------- Armas reales (.glb, KTX2 + meshopt) ----------
// Origen = empty «Empunadura» (la mano), cañón hacia -Z, «Boca» = origen de balas, trazadoras y fogonazo.
// Hasta que carga se ve el modelo por código; las copias (mostrador de Hank, funda) se visten al llegar.
const GLB_ARMAS = { x56d: 'assets/armas/X56D.glb' };
const armaReal = {}, pendientes = [];
const matOculto = new THREE.MeshBasicMaterial({ visible: false });
function vestir(g, id) {
  const R = armaReal[id]; if (!R || g.userData.real) return g;
  for (const c of g.children) if (c.isMesh) { if (c.name === 'cargador') c.material = matOculto; else c.visible = false; } // el cargador queda (LEDs, recarga física)
  const m = R.escena.clone(true); m.position.copy(R.emp).negate(); m.name = 'modeloReal';
  const sombra = !g.userData.sinSombra; m.traverse(x => { if (x.isMesh) { x.castShadow = sombra; x.receiveShadow = true; } });
  g.add(m); g.userData.real = true;
  if (id === 'x56d' && g === WOBJ[id]?.g) ocultableCargador(g, m);
  const boca = g.getObjectByName('boca'); if (boca && R.boca) boca.position.copy(R.boca);
  return g;
}
// el cargador del .glb va en la misma malla que el arma: en la recarga física de VR se recorta con un discard
// por una caja (coordenadas del arma: x libre, y < .03, z ∈ [-.27, -.11]) para que se vea el pozo vacío
function ocultableCargador(g, m) {
  const u = g.userData.uSinCarg = { value: 0 }; g.updateMatrixWorld(true);
  m.traverse(x => { if (!x.isMesh) return; const inv = new THREE.Matrix4().copy(x.matrixWorld).invert().multiply(g.matrixWorld);
    const a = new V3(-1, -1, -.27).applyMatrix4(inv), b = new V3(1, .03, -.11).applyMatrix4(inv), mn = a.clone().min(b), mx = a.clone().max(b);
    const mat = x.material = x.material.clone();
    mat.onBeforeCompile = sh => { sh.uniforms.uSinCarg = u; sh.uniforms.uCMin = { value: mn }; sh.uniforms.uCMax = { value: mx };
      sh.vertexShader = 'varying vec3 vPosCarg;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosCarg = position;');
      sh.fragmentShader = 'uniform float uSinCarg; uniform vec3 uCMin, uCMax; varying vec3 vPosCarg;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\nif (uSinCarg > .5 && all(greaterThan(vPosCarg, uCMin)) && all(lessThan(vPosCarg, uCMax))) discard;'); };
    mat.customProgramCacheKey = () => 'sinCargX56';
  });
}
// copia de un arma que se viste con el .glb en cuanto llega (o: { sombra: false })
export function clonarArma(id, o = {}) {
  const g = WOBJ[id].g.clone(true); if (o.sombra === false) { g.userData.sinSombra = true; g.traverse(x => { if (x.isMesh) x.castShadow = false; }); }
  if (armaReal[id]) vestir(g, id); else if (GLB_ARMAS[id]) pendientes.push([g, id]);
  return g;
}
setTimeout(() => { for (const id in GLB_ARMAS) cargarGLB(GLB_ARMAS[id]).then(gl => {
  gl.scene.updateMatrixWorld(true); const emp = new V3(), e = gl.scene.getObjectByName('Empunadura'), b = gl.scene.getObjectByName('Boca');
  if (e) e.getWorldPosition(emp);
  armaReal[id] = { escena: gl.scene, emp, boca: b ? b.getWorldPosition(new V3()).sub(emp) : null };
  vestir(WOBJ[id].g, id); for (const [g, k] of pendientes.splice(0)) vestir(g, k);
  if (id === 'x56d') VMPOS.x56d = [.15, -.29, -.33, 0, .03, 0]; // la boca del .glb va 9 cm más alta que la del modelo por código
  if (P.w === id) attachWeapon();
}).catch(err => console.warn('[armas] ' + id + ' .glb no cargó, sigo con el modelo por código', err)); }, 0);
const VMPOS = { x56d: [.17, -.21, -.36, 0, .03, 0], escopeta: [.16, -.22, -.34, 0, .03, 0], pistola: [.17, -.2, -.4, 0, 0, 0], piedra: [.24, -.25, -.45, .3, 0, 0], cuchillo: [.24, -.24, -.42, .9, .2, -.3], punos: [0, 0, 0, 0, 0, 0] };
const fistsVM = new THREE.Group(); vm.add(fistsVM);
const fists = [1, -1].map(sd => { const f = new THREE.Group(); f.add(new THREE.Mesh(rbox(.085, .085, .12), WM.skin)); f.position.set(.2 * sd, -.24, -.42); f.userData.rest = f.position.clone(); fistsVM.add(f); return f; });

// ---------- Mandos de las Quest ----------
export const ctrl = [0, 1].map(i => { const grip = renderer.xr.getControllerGrip(i), ray = renderer.xr.getController(i); dolly.add(grip, ray); return { grip, ray, src: null, hand: null, prev: {}, cd: 0, mesh: null, gripPrev: false, held: null }; });
registrarJugador({ P, ctrl, buzz, morir: () => morirJugador() });
export const rightC = () => ctrl.find(c => c.hand === 'right' && c.src), leftC = () => ctrl.find(c => c.hand === 'left' && c.src);
function buildHand(c) { if (c.mesh) return; const g = new THREE.Group(); const palm = new THREE.Mesh(rbox(.075, .09, .11), WM.skin); palm.position.set(0, -.01, .01); g.add(palm); c.grip.add(g); c.mesh = g; }
ctrl.forEach(c => {
  c.ray.addEventListener('connected', e => { c.src = e.data; c.hand = e.data.handedness; buildHand(c); if (c.hand === 'left') c.grip.add(ui.wrist.mesh); if (G.mode === 'vr') attachWeapon(); });
  c.ray.addEventListener('disconnected', () => { c.src = null; });
});
let gunCal = 0;
export function attachWeapon() {
  for (const k in WOBJ) WOBJ[k].g.removeFromParent();
  const w = WEAPONS[P.w], o = WOBJ[w.id], hide = car.occupied || !!P.sentado;
  fistsVM.visible = G.mode === 'pc' && w.id === 'punos' && !hide;
  if (hide) { P.reloading = 0; P.swing = -1; return; }
  if (w.id === 'punos') return;
  if (G.mode === 'vr') { const r = rightC(); if (r) { if (w.melee) { r.grip.add(o.g); o.g.position.set(0, -.01, -.02); o.g.rotation.set(0, 0, 0); } else { dolly.add(o.g); syncVRGun(); } } }
  else { vm.add(o.g); const v = VMPOS[w.id]; o.g.position.set(v[0], v[1], v[2]); o.g.rotation.set(v[3], v[4], v[5]); }
  P.reloading = 0; P.swing = -1;
}
function syncVRGun() {
  const w = WEAPONS[P.w]; if (w.melee || car.occupied) return; const r = rightC(); if (!r) return; const o = WOBJ[w.id].g; if (o.parent !== dolly) return;
  o.position.copy(r.grip.position); o.quaternion.copy(r.ray.quaternion); if (gunCal) o.quaternion.multiply(tQ.setFromAxisAngle(XA, gunCal)); o.translateY(-.01); o.translateZ(.02);
  if (P.sway > 0) { const t = G.time * 13; o.rotateX(Math.sin(t) * .09 * P.sway); o.rotateZ(Math.cos(t * .8) * .12 * P.sway); }
  const tm = temblorMano('right'); if (tm) { const t = G.time * 23; o.rotateX(Math.sin(t) * .02 * tm); o.rotateY(Math.sin(t * 1.3 + 1) * .02 * tm); } // brazo roto: la mano tiembla
  P.ajusteArma?.(o); // interacción: apuntar con dos manos
}
export function darArma(id, equipar = true) { if (!P.inv.includes(id)) P.inv.push(id); if (WEAPONS[id].mag) P.ammo[id] = WEAPONS[id].mag; if (equipar) { P.w = id; attachWeapon(); } sfx('pickup'); }
export function cycleWeapon(d) { const i = P.inv.indexOf(P.w); P.w = P.inv[(i + d + P.inv.length) % P.inv.length]; attachWeapon(); sfx('btn'); }
export function setWeapon(id) { if (!P.inv.includes(id) || id === P.w) return; P.w = id; attachWeapon(); sfx('btn'); }

// ---------- Posición del jugador ----------
const _pf = new V3();
export function playerFeet(o) { if (car.occupied) return o.copy(car.g.position); if (P.sentado) return P.sentado.getWorldPosition(o); if (G.mode === 'vr') { camera.getWorldPosition(o); o.y = dolly.getWorldPosition(_pf).y; } else dolly.getWorldPosition(o); return o; }
export function playerHead(o) { return G.mode === 'vr' ? camera.getWorldPosition(o) : head.getWorldPosition(o); }
// mueve al jugador a un punto (x,z) mirando hacia yaw
export function teleport(x, z, yaw = 0) {
  if (car.occupied) exitCar(true); P.sentado = null; scene.add(dolly); P.vel.set(0, 0, 0);
  const y = groundAt(x, z, 9);
  if (G.mode === 'vr') { dolly.rotation.set(0, 0, 0); dolly.position.set(x, y, z); dolly.updateMatrixWorld(true); camera.getWorldPosition(tA); const e = new THREE.Euler().setFromQuaternion(camera.getWorldQuaternion(tQ), 'YXZ'); snapTurnBy(yaw - e.y); camera.getWorldPosition(tA); dolly.position.x += x - tA.x; dolly.position.z += z - tA.z; }
  else { dolly.rotation.set(0, 0, 0); dolly.position.set(x, y, z); P.yaw = yaw; P.pitch = 0; }
  attachWeapon();
}

// ---------- Daño al jugador ----------
// zona: 'torso' (por defecto) · 'cabeza' (visión roja fuerte y sacudida) · 'brazoI'/'brazoD'/'brazo' (vibración en esa
// mano y el arma se tambalea) · 'pierna' (frena unos instantes)
// tipo: 'contundente' (por defecto) · 'bala' | 'corte' | 'escopeta' (sangran) · 'caida' → huesos rotos y sangrado (combate/lesiones.js)
export function hurtPlayer(d, from, zona = 'torso', tipo = 'contundente') {
  if (P.dead > 0 || P.inmune) return;
  P.hp -= d; P.lastHurt = G.time; P.zonaHerida = zona; hurt.a = Math.min(1, hurt.a + .5 + d / 40); sfx('hurt'); G.shake = Math.max(G.shake, .35);
  lesionar(d, zona, tipo);
  const sacude = G.mode === 'pc' || G.opciones?.sacudida; // en VR la cámara no se mueve salvo que el jugador lo pida
  if (zona === 'cabeza') { hurt.a = 1; if (sacude) { G.shake = Math.max(G.shake, .75); P.mareo = Math.min(1.5, (P.mareo || 0) + .9); } for (const c of ctrl) buzz(c, 1, 160); }
  else if (zona.startsWith('brazo')) { const mano = zona === 'brazoI' ? 'left' : zona === 'brazoD' ? 'right' : null; for (const c of ctrl) buzz(c, !mano || c.hand === mano ? 1 : .25, !mano || c.hand === mano ? 220 : 60); P.sway = Math.min(1.5, (P.sway || 0) + 1); }
  else if (zona === 'pierna') { P.lento = 1.2; for (const c of ctrl) buzz(c, .6, 140); }
  else for (const c of ctrl) buzz(c, .8, 120);
  if (from && !car.occupied && !P.sentado) { const f = playerFeet(new V3()); tA.subVectors(f, from).setY(0); if (tA.lengthSq() > 1e-4) { tA.normalize(); if (G.mode === 'pc') P.vel.addScaledVector(tA, 5); else if (G.opciones?.sacudida) dolly.position.addScaledVector(tA, .12); } }
  if (P.hp <= 0) morirJugador();
}
function morirJugador() { if (P.dead > 0) return; P.hp = 0; P.dead = 1.6; say('HAS CAÍDO'); director.morir(); }

// ---------- Objetos que se usan (E / A) o se agarran (grip) ----------
export const usables = new Map();
// def: { id, pos: V3 | () => V3, r, label, on(), mesh (opcional, para agarrar en VR), alCabeza (llevarlo a la cabeza) }
export function usable(def) { const u = { r: 1.7, activo: true, ...def }; usables.set(u.id, u); return u; }
export function quitarUsable(id) { const u = usables.get(id); if (u?.mesh && u.home) restaurarAgarre(u); usables.delete(id); }
export function limpiarUsables() { for (const id of [...usables.keys()]) quitarUsable(id); }
const uPos = u => typeof u.pos === 'function' ? u.pos() : u.pos;
function usableCercano(pf, mirada) {
  let best = null, bd = 1e9;
  for (const u of usables.values()) { if (!u.activo) continue; const p = uPos(u); const d = Math.hypot(p.x - pf.x, p.z - pf.z); if (d > u.r || Math.abs(p.y - pf.y) > 2.8) continue;
    if (mirada && d > .8) { tD.set(p.x - pf.x, 0, p.z - pf.z).normalize(); if (tD.dot(mirada) < .25) continue; }
    if (d < bd) { bd = d; best = u; } }
  return best;
}
function usar(u) { if (!u || G.enDialogo) return; sfx('btn'); u.on(); }
const prompt = canvasPlane(1.6, .3, 512, textDraw('#ffffff', .7, 'rgba(8,12,22,.85)')); prompt.mesh.visible = false; scene.add(prompt.mesh);
let promptKey = '';
function restaurarAgarre(u) { if (!u.home) return; u.home.par.add(u.mesh); u.mesh.position.copy(u.home.p); u.mesh.quaternion.copy(u.home.q); u.home = null; }

// ---------- Disparo y golpes ----------
const ray = new THREE.Raycaster();
const targets = () => envActivo().concat(enemyMeshes(), corpseMeshes(), G.npcHit?.() || []); // G.npcHit: PNJ heribles (npcs.js)
function muzzleRay(o, d) { const w = WOBJ[P.w]; w.muzzle.getWorldPosition(o); w.muzzle.getWorldQuaternion(tQ); d.set(0, 0, -1).applyQuaternion(tQ); }
// tipo: 'bala' | 'contundente' | 'corte' | 'escopeta' (por defecto, el del arma equipada)
// extra (opcional): { swing: V3 } dirección del tajo (cortes orientados a lo largo del movimiento)
export function applyHit(obj, point, d, dmg, melee, tipo, extra = {}) {
  const u = obj.userData; tipo ||= WEAPONS[P.w].tipo || (melee ? 'contundente' : 'bala');
  const z = u.zona, mult = melee ? 1 : z === 'head' ? 2 : z === 'neck' ? 1.6 : u.part === 'arm' || u.part === 'leg' ? .75 : 1;
  if (u.enemy) { damageEnemy(u.enemy, dmg * mult, point, d, u.part, melee, u.limb, { zona: z, tipo, malla: obj, swing: extra.swing }); return true; }
  if (u.npcId) { G.herirNpc?.(u.npcId, dmg * mult, point, d, z, tipo); return true; } // fuego amigo: Hank se queja, no muere
  if (u.cadaver) { golpearCadaver(u.cadaver, { dmg: dmg * mult, punto: point, dir: d, zona: z, tipo, malla: obj, swing: extra.swing }); return true; }
  if (u.prop?.golpe) return u.prop.golpe(point, d, dmg, tipo) !== false; // objetos de la interacción (botellas, cristales…)
  return false;
}
export function tryFire() {
  const w = WEAPONS[P.w]; if (car.occupied || P.sentado || G.enDialogo) return;
  if (w.melee) { if (G.mode === 'pc') startSwing(); return; }
  if (P.reloading > 0 || P.fireCD > 0) return;
  if (P.ammo[w.id] <= 0) { sfx('empty'); startReload(); return; }
  P.ammo[w.id]--; P.fireCD = w.rate; P.recoil = Math.min(1.5, P.recoil + w.kick);
  const o = new V3(), d = new V3();
  if (G.mode === 'vr') muzzleRay(o, d); else { camera.getWorldPosition(o); camera.getWorldDirection(d); }
  const sp = w.spread * (P.pulsoFirme ? .35 : 1) * (P.dosManos ? .5 : 1) * (1 + temblorMano('right') * .8); // respiración contenida / dos manos / brazo roto
  const mz = WOBJ[w.id].muzzle, mp = mz.getWorldPosition(new V3()), base = d.clone(), lista = targets();
  for (let k = 0; k < (w.perdigones || 1); k++) {
    d.copy(base); d.x += rnd(-sp, sp); d.y += rnd(-sp, sp); d.z += rnd(-sp, sp); d.normalize();
    ray.set(o, d); ray.far = 120;
    const hit = ray.intersectObjects(lista, false)[0];
    const end = hit ? hit.point : o.clone().addScaledVector(d, 80);
    if (k < 3) tracer(mp, end);
    // caída de daño con la distancia (perdigones y pistola mucho más que el fusil)
    const dmg = hit ? w.dmg * clamp(1 - (hit.distance - (w.cerca ?? 40)) / Math.max(1, (w.lejos ?? 120) - (w.cerca ?? 40)) * .7, .3, 1) : 0;
    if (hit && !applyHit(hit.object, hit.point, d, dmg, false)) { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : d.clone().negate(); burst(hit.point, w.perdigones ? 2 : 6, 'dust', n); }
  }
  fogonazo(mz); emitirRuido(mp, 'disparo');
  sfx(w.snd); buzz(rightC(), w.perdigones ? 1 : .55, w.perdigones ? 90 : 40); if (G.mode === 'pc') G.shake = Math.max(G.shake, .08 * w.kick);
  if (P.ammo[w.id] <= 0) startReload();
}
export function startReload() { const w = WEAPONS[P.w]; if (G.mode === 'vr' && !w.melee && G.opciones?.recarga !== 'automatica') return; // VR: recarga física (interaccion/armas.js)
  if (w.melee || P.reloading > 0 || P.ammo[w.id] >= w.mag) return;
  if (!cargadoresDe(w.id).length) { if (!P.avisoSinCarg || G.time - P.avisoSinCarg > 2) { P.avisoSinCarg = G.time; say('No quedan cargadores'); sfx('empty'); } return; }
  P.reloading = 1.3; sfx('reload'); }
// escasez (F1.5): la munición solo sale de cargadores encontrados; el chaleco guarda las balas de cada cargador
export const cargadoresDe = id => (P.cargadores ||= {})[id] ||= [];
// saca el cargador más lleno del chaleco (null si no hay); el que estaba puesto vuelve al chaleco si le quedan balas
export function tomarCargador(id, devolver = 0) { const r = cargadoresDe(id); if (devolver > 0) r.push(devolver); r.sort((a, b) => b - a); return r.length ? r.shift() : null; }
export function darCargadores(id, n = 1, balas = WEAPONS[id]?.mag || 0) { const r = cargadoresDe(id); for (let i = 0; i < n; i++) r.push(balas); return r.length; }
function startSwing() { if (P.swing >= 0) return; P.swing = 0; P.swingHit = false; P.side ^= 1; sfx('whoosh'); }
function meleePC() {
  const w = WEAPONS[P.w], o = new V3(), d = camera.getWorldDirection(new V3()); camera.getWorldPosition(o);
  ray.set(o, d); ray.far = w.reach;
  const meshes = enemyMeshes().concat(corpseMeshes()); let hit = ray.intersectObjects(meshes, false)[0];
  if (!hit) { outer: for (let s = .3; s <= w.reach; s += .18) { tA.copy(o).addScaledVector(d, s); for (const m of meshes) if (pointInMesh(tA, m, .3)) { hit = { object: m, point: tA.clone() }; break outer; } } }
  // tajo de PC: barrido lateral (alterna de lado en cada golpe) y algo hacia abajo
  const swing = new V3().crossVectors(d, Y).normalize().multiplyScalar(P.side ? 1 : -1).addScaledVector(Y, -.35).normalize();
  if (hit) { applyHit(hit.object, hit.point, d, w.dmg * fuerzaMano('right'), true, w.tipo, { swing }); sfx(w.snd); }
}

// ---------- VR ----------
const laser = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: .5, toneMapped: false, depthWrite: false })); laser.visible = false; scene.add(laser);
const laserDot = new THREE.Mesh(new THREE.SphereGeometry(.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a40, toneMapped: false })); laserDot.visible = false; scene.add(laserDot);
function snapTurnBy(a) { camera.getWorldPosition(tA); dolly.position.sub(tA).applyAxisAngle(Y, a).add(tA); dolly.rotation.y += a; }
export function updateVR(dt, pf) {
  const Lc = leftC(), Rc = rightC(), L = Lc?.src?.gamepad, Rg = Rc?.src?.gamepad, w = WEAPONS[P.w];
  const ab = !!Rg?.buttons[4]?.pressed, aEdge = ab && !P.aPrev; P.aPrev = ab;
  if (aEdge && G.enDialogo) { director.saltar(); return; }
  if (car.occupied) {
    driveCar({ thr: Rg?.buttons[0]?.value || 0, brk: L?.buttons[0]?.value || 0, steer: -(L?.axes[2] || 0), hb: !!Rg?.buttons[1]?.pressed }, dt);
    if (aEdge) exitCar(); laser.visible = laserDot.visible = false; prompt.mesh.visible = false; return;
  }
  if (P.sentado) { laser.visible = laserDot.visible = false; prompt.mesh.visible = false; if (Rg) { const x = Rg.axes[2] || 0; if (Math.abs(x) > .7) { if (!P.snap) { P.snap = true; snapTurnBy(-Math.sign(x) * Math.PI / 6); } } else if (Math.abs(x) < .3) P.snap = false; } return; }
  if (L && !P.bloqueoMov) { const x = L.axes[2] || 0, y = L.axes[3] || 0; if (Math.hypot(x, y) > .15) { camera.getWorldDirection(tA); tA.y = 0; tA.normalize(); tB.crossVectors(tA, Y).normalize(); const sp = (L.buttons[3]?.pressed && puedeCorrer() ? 4.4 : 2.7) * dt * (P.lento > 0 ? .5 : 1) * factorPiernas(); dolly.position.addScaledVector(tB, x * sp).addScaledVector(tA, -y * sp); } }
  if (Rg) { const x = Rg.axes[2] || 0; if (G.opciones?.giro === 'suave') { if (Math.abs(x) > .2) snapTurnBy(-x * (G.opciones.giroVel || 120) * Math.PI / 180 * dt); }
    else if (Math.abs(x) > .7) { if (!P.snap) { P.snap = true; snapTurnBy(-Math.sign(x) * (G.opciones?.giroGrados || 30) * Math.PI / 180); } } else if (Math.abs(x) < .3) P.snap = false; }
  camera.getWorldPosition(tA); const ox = tA.x, oz = tA.z; collideCircle(tA, .25, dolly.position.y); if (!G.bajoCoche) pushFromCar(tA, .25); dolly.position.x += tA.x - ox; dolly.position.z += tA.z - oz;
  const g = groundAt(tA.x, tA.z, dolly.position.y); dolly.position.y = g > dolly.position.y ? g : Math.max(g, dolly.position.y - 6 * dt);
  syncVRGun();
  const trig = (Rg?.buttons[0]?.value || 0) > .6; if (trig && (!P.trigPrev || w.auto) && !Rc?.prop) tryFire(); P.trigPrev = trig;
  const b = !!Rg?.buttons[5]?.pressed; if (b && !P.bPrev) cycleWeapon(1); P.bPrev = b;
  const yb = !!L?.buttons[5]?.pressed; if (yb && !P.yPrev) { if (P.agacharVR) P.agacharVR(); else cycleWeapon(-1); } P.yPrev = yb; // Y: agacharse (interacción)
  const xb = !!L?.buttons[4]?.pressed; if (xb && !P.xPrev) { const C = [0, -.2, -.4, .2]; gunCal = C[(C.indexOf(gunCal) + 1) % C.length]; say('Ángulo del arma: ' + Math.round(gunCal * 57.3) + '°'); } P.xPrev = xb;
  // usar (A): objeto cercano > coche > recargar
  camera.getWorldDirection(tC); tC.y = 0; tC.normalize();
  const u = usableCercano(pf, null);
  if (aEdge) { if (u) usar(u); else if (car.near) enterCar(); else if (!P.accionArma?.()) startReload(); } // A: soltar el cargador (recarga física)
  promptAt(u, 'A');
  // agarrar con el grip (objetos con malla)
  for (const c of ctrl) { if (!c.src) continue; const gp = !!c.src.gamepad?.buttons[1]?.pressed;
    if (gp && !c.gripPrev && !c.held && !c.prop) { c.grip.getWorldPosition(tC); for (const uu of usables.values()) { if (!uu.activo || !uu.mesh) continue; uu.mesh.getWorldPosition(tD); if (tD.distanceTo(tC) < .32) { c.held = uu; uu.home = { par: uu.mesh.parent, p: uu.mesh.position.clone(), q: uu.mesh.quaternion.clone() }; c.grip.attach(uu.mesh); buzz(c, .5, 50); sfx('pickup'); if (!uu.alCabeza) { c.held = null; restaurarAgarre(uu); usar(uu); } break; } } }
    if (c.held) { const uu = c.held; uu.mesh.getWorldPosition(tD); camera.getWorldPosition(tC); if (tD.distanceTo(tC) < .3) { c.held = null; restaurarAgarre(uu); usar(uu); } }
    if (!gp && c.gripPrev && c.held) { restaurarAgarre(c.held); c.held = null; }
    c.gripPrev = gp; }
  // golpes físicos (puño izquierdo siempre; derecho con el arma cuerpo a cuerpo)
  for (const c of ctrl) {
    if (!c.src) continue; c.cd -= dt; if (c.held || c.prop) continue;
    const pts = [];
    if (c.hand === 'left' || (w.melee && w.id === 'punos')) pts.push(['fist', c.grip.localToWorld(new V3(0, 0, -.04)), 15]);
    if (c.hand === 'right' && w.melee && w.id !== 'punos') pts.push(['tip', WOBJ[w.id].tip.getWorldPosition(new V3()), w.dmg]);
    for (const [key, p, base] of pts) {
      const prev = c.prev[key]; c.prev[key] = p; if (!prev) continue;
      const vel = new V3().subVectors(p, prev).divideScalar(Math.max(dt, 1e-3)), speed = vel.length();
      if (speed < 1.2 || c.cd > 0) continue;
      let done = false;
      for (let s = 0; s <= 1 && !done; s += .5) { tD.lerpVectors(prev, p, s);
        for (const e of enemies) { if (done) break; if (Math.hypot(e.pos.x - tD.x, e.pos.z - tD.z) > 1.6 * e.S) continue;
          for (const m of e.R.hit) if (pointInMesh(tD, m, .05)) { const dmg = base * clamp(speed / 3.5, .6, 2.2) * fuerzaMano(c.hand); damageEnemy(e, dmg, tD.clone(), vel.clone().normalize(), m.userData.part, true, m.userData.limb, { zona: m.userData.zona, tipo: key === 'tip' ? w.tipo : 'contundente', malla: m, swing: vel.clone().normalize() }); sfx(key === 'tip' ? w.snd : 'punch'); buzz(c, clamp(speed / 5, .3, 1), 70); c.cd = .28; done = true; break; } } }
    }
  }
  if (Rc && !w.melee) { const o = new V3(), d = new V3(); muzzleRay(o, d); ray.set(o, d); ray.far = 40; const h = ray.intersectObjects(targets(), false)[0]; const end = h ? h.point : o.clone().addScaledVector(d, 40);
    laser.visible = true; laser.position.copy(o); laser.lookAt(end); laser.scale.set(.003, .003, o.distanceTo(end)); laserDot.visible = !!h; if (h) laserDot.position.copy(h.point); }
  else laser.visible = laserDot.visible = false;
}
function promptAt(u, key) {
  if (!u || G.enDialogo) { prompt.mesh.visible = false; return; }
  const p = uPos(u); prompt.mesh.visible = true; prompt.mesh.position.set(p.x, p.y + (u.alto ?? 1.9), p.z); prompt.mesh.lookAt(G.CAM);
  const k = key + u.label; if (k !== promptKey) { promptKey = k; prompt.set(key + ' · ' + u.label); }
}

// ---------- PC ----------
export const keys = {};
export function updatePC(dt, pf) {
  if (G.freeMode) { if (keys.ArrowLeft) P.yaw += dt * 2.2; if (keys.ArrowRight) P.yaw -= dt * 2.2; }
  if (car.occupied) {
    driveCar({ thr: keys.KeyW ? 1 : 0, brk: keys.KeyS ? 1 : 0, steer: (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), hb: !!keys.Space }, dt);
    dolly.rotation.y = P.yaw; head.rotation.x = P.pitch; head.position.y = 1.62; ui.hint(''); prompt.mesh.visible = false; return;
  }
  if (P.sentado) { dolly.rotation.y = P.yaw; head.rotation.x = P.pitch; head.position.y = 1.62; ui.hint(''); prompt.mesh.visible = false; return; }
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sp = (P.bloqueoMov ? 0 : (keys.ShiftLeft || keys.ShiftRight) && puedeCorrer() ? 6 : 3.4) * (P.lento > 0 ? .5 : 1) * factorPiernas();
  tA.set(str, 0, -fwd); if (tA.lengthSq() > 0) tA.normalize().applyAxisAngle(Y, P.yaw);
  const acc = Math.min(1, (P.onGround ? 12 : 3) * dt);
  P.vel.x = mix(P.vel.x, tA.x * sp, acc); P.vel.z = mix(P.vel.z, tA.z * sp, acc);
  if (keys.Space && P.onGround && !P.bloqueoMov) { P.vel.y = 6.2; P.onGround = false; }
  P.vel.y -= 20 * dt;
  const p = dolly.position; p.addScaledVector(P.vel, dt);
  const g = groundAt(p.x, p.z, p.y);
  if (p.y <= g) { p.y = g; P.vel.y = 0; P.onGround = true; } else P.onGround = p.y - g < .02;
  collideCircle(p, .35, p.y); if (!G.bajoCoche) pushFromCar(p, .35);
  dolly.rotation.y = P.yaw; head.rotation.x = P.pitch;
  const hs = Math.hypot(P.vel.x, P.vel.z); P.bob += dt * hs * 1.9;
  head.position.y = 1.62 + Math.sin(P.bob * 2) * .03 * Math.min(1, hs / 3);
  if (P.trigger && WEAPONS[P.w].auto) tryFire();
  const look = tC.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  const u = usableCercano(pf, look); P.usable = u; promptAt(u, 'E');
  ui.hint(G.enDialogo ? '' : u ? 'E · ' + u.label : car.near ? 'E · subir a la pickup' : '');
}
export function updateViewmodel(dt) {
  const w = WEAPONS[P.w], hs = Math.hypot(P.vel.x, P.vel.z), bob = Math.min(1, hs / 3);
  vm.position.set(Math.cos(P.bob) * .012 * bob, Math.abs(Math.sin(P.bob)) * .012 * bob - P.recoil * .01, P.recoil * .05); vm.rotation.set(P.recoil * .12, 0, 0);
  if (P.sway > 0) { const t = G.time * 13; vm.rotation.x += Math.sin(t) * .06 * P.sway; vm.rotation.z += Math.cos(t * .8) * .09 * P.sway; vm.position.x += Math.sin(t * .7) * .02 * P.sway; }
  const tm = temblorMano('right'); if (tm) { const t = G.time * 23; vm.rotation.x += Math.sin(t) * .015 * tm; vm.rotation.y += Math.sin(t * 1.3 + 1) * .015 * tm; }
  if (P.mareo > 0) head.rotation.z = Math.sin(G.time * 2.3) * .05 * P.mareo; else if (head.rotation.z) head.rotation.z = 0;
  if (P.reloading > 0) { const q = Math.sin((1 - P.reloading / 1.3) * Math.PI); vm.rotation.x -= q * .7; vm.position.y -= q * .12; }
  const o = WOBJ[w.id], v = VMPOS[w.id];
  if (w.melee && w.id !== 'punos') { const s = P.swing; let px = v[0], py = v[1], pz = v[2], rx = v[3];
    if (s >= 0) { const q = Math.sin(Math.min(1, s) * Math.PI); px -= q * .18; py += q * .08; pz -= q * .3; rx -= q * 1.2; }
    o.g.position.set(px, py, pz); o.g.rotation.set(rx, v[4], v[5]); }
  fists.forEach((f, i) => { f.position.copy(f.userData.rest); if (P.swing >= 0 && i === P.side) { const q = Math.sin(Math.min(1, P.swing) * Math.PI); f.position.x *= 1 - q * .7; f.position.y += q * .1; f.position.z -= q * .35; } });
}
// avance de recarga y golpes de PC (cada fotograma)
export function updateArmas(dt) {
  if (P.dead > 0) reiniciarLesiones(); else actualizarLesiones(dt);
  P.fireCD -= dt;
  if (P.reloading > 0) { P.reloading -= dt; if (P.reloading <= 0) { P.reloading = 0; const w = WEAPONS[P.w]; if (!w.melee) { const b = tomarCargador(w.id, P.ammo[w.id]); P.ammo[w.id] = b ?? P.ammo[w.id]; } } }
  if (P.swing >= 0) { const w = WEAPONS[P.w]; P.swing += dt / w.dur; if (!P.swingHit && P.swing > .4) { P.swingHit = true; meleePC(); } if (P.swing >= 1) P.swing = -1; }
  if (P.dead <= 0 && G.time - P.lastHurt > 4 && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 8);
  P.recoil = Math.max(0, P.recoil - dt * 6);
  // secuelas de los golpes recibidos por zona
  if (P.sway > 0) P.sway = Math.max(0, P.sway - dt * .8); if (P.lento > 0) P.lento -= dt; if (P.mareo > 0) P.mareo = Math.max(0, P.mareo - dt * .6);
}
export function interactuarPC() {
  if (G.enDialogo) { director.saltar(); return; }
  if (car.occupied) { exitCar(); return; }
  if (P.usable) { usar(P.usable); return; }
  if (car.near) { enterCar(); return; }
}
export function iniciarInputPC(cvs) {
  document.addEventListener('mousemove', e => {
    if (!G.playing) return; let dx = 0, dy = 0;
    if (document.pointerLockElement === cvs) { dx = e.movementX; dy = e.movementY; } else if (G.freeMode && G.drag) { dx = e.clientX - G.drag.x; dy = e.clientY - G.drag.y; G.drag = { x: e.clientX, y: e.clientY }; }
    P.yaw -= dx * .0022; P.pitch = clamp(P.pitch - dy * .0022, -1.45, 1.45);
  });
  cvs.addEventListener('mousedown', e => { if (!G.playing || e.button !== 0) return; G.drag = { x: e.clientX, y: e.clientY }; if (G.enDialogo) { director.saltar(); return; } P.trigger = true; tryFire(); });
  addEventListener('mouseup', e => { if (e.button !== 0) return; P.trigger = false; G.drag = null; });
  cvs.addEventListener('wheel', e => { if (G.playing && !car.occupied) cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  addEventListener('keydown', e => {
    if (!G.playing) return; keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); if (e.repeat) return;
    const d = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code]; if (d !== undefined && !car.occupied && P.inv[d]) setWeapon(P.inv[d]);
    if (e.code === 'KeyR') startReload(); if (e.code === 'KeyE' || e.code === 'Enter') interactuarPC();
    if (e.code === 'KeyH' && car.occupied) sfx('horn');
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
}
