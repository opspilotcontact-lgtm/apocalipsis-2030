// IA de «caja de arena» para supervivientes y compañeros: conductas simples y baratas que la historia puede encender.
//   rutina   · pasea entre puntos con pausas y gestos
//   seguir   · sigue al jugador a cierta distancia, rodeando obstáculos con dirección simple (rayos de colliders)
//   huir     · huye de robots y de ruidos fuertes (disparos) usando la API de ruido de interaccion/ruido.js
//   reaccionar · mira al jugador cuando se acerca y se encoge con los disparos cercanos
//   ayudar   · dispara (o lanza piedras) a los robots que van a por el jugador (lista de enemigos de enemigos.js)
// Cuerpos admitidos (adaptador):
//   'npc'   → personaje de npcs.js (se mueve con su propio destino/animación; aquí solo se le marca el paso)
//   'actor' → ActorGLB (js/combate/actor.js): a.actualizar(dt, { vel, mirar })
//   'rig'   → humano/robot por código creado aquí (makeHuman/makeRobot + animRig)
import { THREE, V3, G, scene, groundAt, collideCircle, angLerp, clamp, rnd } from '../nucleo.js';
import { makeHuman, makeRobot, animRig } from '../cuerpos.js';
import { npcs, gesto as gestoNpc, mirarA as mirarNpc } from '../npcs.js';
import { enemies, damageEnemy } from '../enemigos.js';
import { escucharRuido } from '../interaccion/ruido.js';
import { tracer, sfx } from '../fx.js';
import { playerFeet } from '../jugador.js';

const tA = new V3(), tB = new V3(), tC = new V3();
export const agentes = {};

// ---------- Cuerpos ----------
// crea un humano por código gestionado por la IA · o: { robot: true, aspecto: opciones de makeHuman/makeRobot, pos: [x,z], yaw }
export function crear(id, o = {}) {
  const R = o.robot ? makeRobot(o.aspecto || {}) : makeHuman(o.aspecto || { camisa: 0x445566, pantalon: 0x2a2a30, piel: 0xd0a07a, pelo: 0x1a1410 });
  scene.add(R.root); R.root.traverse(m => { if (m.isMesh) m.userData.enemy = null; });
  const p = o.pos || [0, 0]; R.root.position.set(p[0], groundAt(p[0], p[1], 3), p[1]); R.root.rotation.y = o.yaw || 0;
  animRig(R, 1, { spd: 0 });
  return adoptar(id, { tipo: 'rig', R, root: R.root });
}
// adopta un cuerpo existente: adoptar('mike') (npcs.js) · adoptar('x', actorGLB) · adoptar('x', { tipo:'rig', R, root })
export function adoptar(id, cuerpo) {
  let c = cuerpo;
  if (!c) { const n = npcs[id]; if (!n) return null; c = { tipo: 'npc', n, root: n.root }; }
  else if (c.actualizar && c.root && !c.tipo) c = { tipo: 'actor', a: c, root: c.root };
  const ag = agentes[id] = { id, ...c, modo: null, spd: 0, vel: 1.4, objetivo: null, mirar: null, flinch: 0, reaccionar: false, huirDe: null, huirT: 0, cd: 0, idx: 0, pausa: 0, gestoT: rnd(3, 7), visto: false };
  return ag;
}
export function quitar(id) { const a = agentes[id]; if (!a) return; if (a.tipo === 'rig') a.root.removeFromParent(); delete agentes[id]; }
export function parar(id) { const a = agentes[id]; if (!a) return; a.modo = null; a.objetivo = null; if (a.tipo === 'npc') a.n.destino = null; }

// ---------- Conductas (API pública) ----------
// puntos: [[x,z],…] · o: { vel, pausa: [min,max] s, gestos: ['manos','nuca',…], bucle: true }
export function rutina(id, puntos, o = {}) { const a = agentes[id] || adoptar(id); if (!a) return null; Object.assign(a, { modo: 'rutina', puntos, idx: 0, pausa: 0, vel: o.vel ?? 1.2, pausaR: o.pausa || [1.5, 4], gestos: o.gestos || ['manos', 'nuca', 'brazos'], bucle: o.bucle !== false }); return a; }
// o: { dist (m, por defecto 2.2), vel }
export function seguir(id, o = {}) { const a = agentes[id] || adoptar(id); if (!a) return null; Object.assign(a, { modo: 'seguir', dist: o.dist ?? 2.2, vel: o.vel ?? 1.6 }); return a; }
// o: { radio (de robots, 12 m), oido: true (huye de disparos/explosiones), refugio: [x,z] opcional }
export function huir(id, o = {}) { const a = agentes[id] || adoptar(id); if (!a) return null; Object.assign(a, { modo: 'huir', radioHuir: o.radio ?? 12, oido: o.oido !== false, refugio: o.refugio || null, vel: o.vel ?? 3.6 }); return a; }
// capa que se suma a cualquier modo: mira al jugador si está cerca y se encoge con disparos
export function reaccionar(id, on = true, o = {}) { const a = agentes[id] || adoptar(id); if (!a) return null; a.reaccionar = on; a.radioMirar = o.radio ?? 4; return a; }
// o: { dano (por disparo, 14), cadencia (s, 0.9), alcance (m, 22), arma: 'pistola'|'piedra', seguir: true }
export function ayudar(id, o = {}) { const a = agentes[id] || adoptar(id); if (!a) return null; Object.assign(a, { modo: 'ayudar', dano: o.dano ?? 14, cadencia: o.cadencia ?? .9, alcance: o.alcance ?? 22, arma: o.arma || 'pistola', dist: o.dist ?? 2.6, vel: o.vel ?? 1.8, sigue: o.seguir !== false }); return a; }
export function gesto(id, tipo, dur = 2) { const a = agentes[id]; if (!a) return; if (a.tipo === 'npc') gestoNpc(id, tipo, dur); else if (a.tipo === 'rig') a.gestoRig = { t: 0, dur }; }

// ---------- Oído: disparos y explosiones cercanas ----------
escucharRuido(ev => {
  const fuerte = ev.radio >= 15 || /disparo|explos|boom|cristal/.test(ev.tipo);
  for (const id in agentes) {
    const a = agentes[id], p = a.root.position, d = Math.hypot(ev.pos.x - p.x, ev.pos.z - p.z);
    if (d > ev.radio) continue;
    if (a.reaccionar && fuerte && d < 20) a.flinch = 1;
    if (a.modo === 'huir' && a.oido && fuerte) { a.huirDe = new V3(ev.pos.x, 0, ev.pos.z); a.huirT = 5; }
  }
});

// ---------- Dirección con esquiva simple ----------
// prueba la dirección deseada y ±30/60/90°; elige la primera sin collider a 1,2 m
function libre(p, dir, dist) { tC.copy(p).addScaledVector(dir, dist); tC.y = 0; const x = tC.x, z = tC.z; collideCircle(tC, .35, p.y + .2); return Math.hypot(tC.x - x, tC.z - z) < .05; }
const ANG = [0, .5, -.5, 1, -1, 1.6, -1.6];
function dirLibre(a, dir) { const p = a.root.position; for (const k of ANG) { tB.copy(dir).applyAxisAngle(THREE.Object3D.DEFAULT_UP, k); if (libre(p, tB, 1.2)) return tB; } return tB.copy(dir); }

// mover hacia un punto: devuelve la distancia restante
function irHacia(a, x, z, vel, dt, parar = .3) {
  const p = a.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d < parar) { a.spd = 0; if (a.tipo === 'npc') a.n.destino = null; return d; }
  tA.set(dx / d, 0, dz / d); const dir = d > 1.5 ? dirLibre(a, tA) : tA;
  if (a.tipo === 'npc') { a.n.destino ||= new V3(); a.n.destino.set(p.x + dir.x * Math.min(d, 1.5), 0, p.z + dir.z * Math.min(d, 1.5)); a.n.vel = vel; a.n.llegada = null; return d; }
  a.spd = vel * Math.min(1, d / .8 + .3);
  a.root.rotation.y = angLerp(a.root.rotation.y, Math.atan2(dir.x, dir.z), dt * 6);
  p.x += Math.sin(a.root.rotation.y) * a.spd * dt; p.z += Math.cos(a.root.rotation.y) * a.spd * dt;
  return d;
}
function quieto(a) { a.spd = 0; if (a.tipo === 'npc' && a.n.destino && a.modo) a.n.destino = null; }
function mirarHacia(a, pt, dt) { if (a.tipo === 'npc') return; const p = a.root.position; a.root.rotation.y = angLerp(a.root.rotation.y, Math.atan2(pt.x - p.x, pt.z - p.z), dt * 4); }

function robotCerca(p, radio) { let best = null, bd = radio; for (const e of enemies) { if (!e.alive || e.kind === 'villano') continue; const d = e.pos.distanceTo(p); if (d < bd) { bd = d; best = e; } } return best; }
// enemigo que va a por el jugador: el vivo más cercano al jugador dentro del alcance del compañero
function objetivoAyuda(a, pf) { let best = null, bd = 1e9; for (const e of enemies) { if (!e.alive) continue; const dA = e.pos.distanceTo(a.root.position); if (dA > a.alcance) continue; const dJ = e.pos.distanceTo(pf); if (dJ < bd) { bd = dJ; best = e; } } return best; }

function disparar(a, e) {
  a.root.updateMatrixWorld(); tA.copy(a.root.position); tA.y += 1.35; tB.copy(e.pos); tB.y += 1.2 + rnd(-.2, .3);
  const dir = tC.subVectors(tB, tA).normalize(), acierto = Math.random() < .7;
  if (a.arma === 'piedra') { sfx('whoosh'); if (acierto) setTimeout(() => { if (e.alive) damageEnemy(e, a.dano * .6, tB.clone(), dir.clone(), 'torso', true); }, 350); return; }
  tracer(tA.clone(), acierto ? tB.clone() : tB.clone().add(new V3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)))); sfx('pistol');
  if (acierto) try { damageEnemy(e, a.dano, tB.clone(), dir.clone(), 'torso', false); } catch (er) { console.warn('[npcIA] daño', er); }
}

// ---------- Bucle ----------
export function actualizarNpcIA(dt) {
  const pf = playerFeet(tA.clone());
  for (const id in agentes) {
    const a = agentes[id]; if (!a.root.parent || !a.root.visible) continue;
    const p = a.root.position;
    if (a.modo) a.spd = 0; // sin modo, el que lo controla desde fuera fija spd (actividades)
    switch (a.modo) {
      case 'rutina': {
        if (!a.puntos?.length) break;
        if (a.pausa > 0) { a.pausa -= dt; quieto(a); a.gestoT -= dt; if (a.gestoT <= 0) { a.gestoT = rnd(4, 8); gesto(id, a.gestos[Math.floor(Math.random() * a.gestos.length)], 2); } break; }
        const q = a.puntos[a.idx];
        if (irHacia(a, q[0], q[1], a.vel, dt, .35) < .35) { a.pausa = rnd(a.pausaR[0], a.pausaR[1]); a.idx = a.bucle ? (a.idx + 1) % a.puntos.length : Math.min(a.idx + 1, a.puntos.length - 1); }
        break;
      }
      case 'ayudar': {
        a.cd -= dt; const e = objetivoAyuda(a, pf);
        if (e) { quieto(a); mirarHacia(a, e.pos, dt); if (a.tipo === 'npc') mirarNpc(id, [e.pos.x, e.pos.z]); if (a.cd <= 0) { a.cd = a.cadencia * rnd(.8, 1.3); disparar(a, e); } break; }
        if (a.tipo === 'npc' && a.n.mirar && a.n.mirar !== 'jugador') mirarNpc(id, null);
        if (!a.sigue) break;
      } // sin objetivo: sigue al jugador
      // falls through
      case 'seguir': {
        const d = Math.hypot(pf.x - p.x, pf.z - p.z);
        if (d > (a.dist || 2.2) + .6) { tB.set(pf.x - p.x, 0, pf.z - p.z).normalize(); irHacia(a, pf.x - tB.x * a.dist, pf.z - tB.z * a.dist, d > 7 ? a.vel * 2 : a.vel, dt, .2); }
        else { quieto(a); mirarHacia(a, pf, dt); }
        if (d > 40 && a.tipo !== 'npc') p.set(pf.x - 2, groundAt(pf.x - 2, pf.z, 3), pf.z); // se quedó muy atrás: aparece detrás
        break;
      }
      case 'huir': {
        const r = robotCerca(p, a.radioHuir); if (r) { a.huirDe = r.pos.clone(); a.huirT = 2; }
        a.huirT -= dt;
        if (a.huirT > 0 && a.huirDe) {
          if (a.refugio) irHacia(a, a.refugio[0], a.refugio[1], a.vel, dt, .5);
          else { tB.set(p.x - a.huirDe.x, 0, p.z - a.huirDe.z).normalize(); irHacia(a, p.x + tB.x * 4, p.z + tB.z * 4, a.vel, dt, .1); }
        } else quieto(a);
        break;
      }
      default: break;
    }
    // reaccionar: mirar al jugador cercano, encogerse con disparos
    if (a.reaccionar) {
      const d = Math.hypot(pf.x - p.x, pf.z - p.z), cerca = d < a.radioMirar;
      if (a.tipo === 'npc') { if (cerca !== a.visto && (!a.modo || a.modo === 'rutina')) mirarNpc(id, cerca ? true : null); if (a.flinch === 1) gestoNpc(id, 'manos', 1); }
      else if (cerca && a.spd < .1 && !a.modo) mirarHacia(a, pf, dt);
      a.visto = cerca;
    }
    // cuerpo propio: animación, choque con el escenario y altura del suelo
    if (a.tipo === 'rig') {
      collideCircle(p, .3, p.y + .2); p.y = groundAt(p.x, p.z, p.y + .5);
      animRig(a.R, dt, { spd: a.spd });
      const b = a.R.root.children[0]; if (b) b.rotation.x = -a.flinch * .35;
    } else if (a.tipo === 'actor') {
      if (a.modo) { collideCircle(p, .3, p.y + .2); p.y = groundAt(p.x, p.z, p.y + .5); }
      a.a.actualizar(dt, { vel: a.spd, mirar: a.reaccionar && a.visto ? tB.set(pf.x, pf.y + 1.6, pf.z) : null, dolor: a.flinch });
    } else if (a.tipo === 'npc' && a.modo) collideCircle(p, .3, p.y + .2);
    a.flinch = Math.max(0, a.flinch - dt * 2.5);
  }
}
export const npcIA = { crear, adoptar, quitar, parar, rutina, seguir, huir, reaccionar, ayudar, gesto, agentes, actualizar: actualizarNpcIA };
