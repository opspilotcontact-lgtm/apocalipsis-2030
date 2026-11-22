// Personajes de la historia: humanos por código (con esqueleto) y modelos .glb texturizados (sin esqueleto).
// Vida: miran con la cabeza (y giran el cuerpo si hace falta), respiran, cambian el peso de pierna,
// echan miradas, hacen gestos al hablar y caminan a marcas (caminarA devuelve una promesa).
import { THREE, V3, G, angLerp, clamp, scene, groundAt } from './nucleo.js';
import { makeHuman, makeRobot, animRig, poseHerido, instancia, holograma } from './cuerpos.js';
import { playerFeet, playerHead } from './jugador.js';
import { FICHAS } from './personajes/fichas.js';

// ry: giro extra para que el frente del modelo mire a +Z · ficha: de dónde sale el porte y el gesto propio
const DEF = {
  mike: { tipo: 'rig', ficha: 'mike', o: { camisa: 0x5a6a7a, pantalon: 0x2a2f3a, piel: 0xd9a27c, pelo: 0x2b1d14, bata: true } },
  sarah: { tipo: 'rig', ficha: 'sarah', o: { camisa: 0x7a3a4a, pantalon: 0x30343c, piel: 0xe0b090, pelo: 0x6a3a1a, melena: true, scale: .9 } },
  john: { tipo: 'rig', ficha: 'john', o: { camisa: 0x4a5236, pantalon: 0x3d4330, piel: 0xc58c64, pelo: 0x111111, gorra: true, gorraColor: 0x3a4028, chaleco: 0x2f3524, zapato: 0x5a4030 } },
  soldado: { tipo: 'rig', o: { camisa: 0x4a5236, pantalon: 0x3d4330, piel: 0xe0b090, pelo: 0x1a1410, casco: true, gorraColor: 0x3a4028, chaleco: 0x2f3524 } },
  guarda: { tipo: 'rig', o: { camisa: 0x4a5236, pantalon: 0x3d4330, piel: 0x8a5a3a, pelo: 0x111111, gorra: true, gorraColor: 0x3a4028 } },
  // acto I: el sargento del cordón que monta su milicia, sus hombres y los saqueadores del pueblo
  varela: { tipo: 'rig', ficha: 'varela', o: { camisa: 0x4a5236, pantalon: 0x3d4330, piel: 0xc8946c, pelo: 0x3a3a38, barba: true, gorra: true, gorraColor: 0x2a2f22, chaleco: 0x23281c, scale: 1 } },
  milicia: { tipo: 'rig', o: { camisa: 0x55583e, pantalon: 0x2e2a24, piel: 0xd0a07a, pelo: 0x1a1410, casco: true, gorraColor: 0x3a4028, chaleco: 0x3a2e22 } },
  rata: { tipo: 'rig', ficha: 'rata', o: { camisa: 0x3a2a20, pantalon: 0x2a2a30, piel: 0xd7a684, pelo: 0x14100c, barba: true, mangaCorta: true } },
  chispa: { tipo: 'rig', ficha: 'chispa', o: { camisa: 0x8a2a20, pantalon: 0x3a3a44, piel: 0xe6b894, pelo: 0x6a4a2a, scale: .9 } },
  saqueador: { tipo: 'rig', o: { camisa: 0x4a4a3a, pantalon: 0x2a2a2a, piel: 0xb07a54, pelo: 0x0e0c0a, gorra: true, gorraColor: 0x1a1a1a } },
  // R-01 en la grabación de la cámara 3 (holograma con esqueleto: puede hacer el gesto de Mike)
  r01: { tipo: 'robot', ficha: 'elrey', holo: 0xff5a3a, o: { body: 0x2a2c30, dark: 0x0e0f12, accent: 0xc9a23a, eye: 0xff2a1a, scale: 1.05 } },
  r01casco: { tipo: 'robot', ficha: 'elrey', holo: 0xff5a3a, o: { body: 0x2a2c30, dark: 0x0e0f12, accent: 0xc9a23a, eye: 0xff2a1a, scale: 1.05, helmet: true } },
  // Mike en la grabación de las 22:10 (holograma)
  mikeholo: { tipo: 'rig', ficha: 'mike', holo: 0x29e6ff, o: { camisa: 0x5a6a7a, pantalon: 0x2a2f3a, piel: 0xd9a27c, pelo: 0x2b1d14, bata: true } },
  // Nico, 13 años, solo en la cancha del parque a las 3 de la madrugada (acto I, opcional)
  nico: { tipo: 'rig', o: { camisa: 0x2a5a9a, pantalon: 0x2a2a30, piel: 0xd8a882, pelo: 0x2a1a10, mangaCorta: true, scale: .78 } },
  // R-7 que patrulla y escanea en una escena (no combate: es un actor)
  r7: { tipo: 'robot', o: { body: 0x4a4f57, dark: 0x1a1c20, accent: 0x8a1a12, eye: 0xff2a1a, antenna: true, scale: .95 } },
  hank: { tipo: 'glb', ficha: 'hank', modelo: 'Hank', alto: 1.78, ry: 0 },
  unidad01: { tipo: 'glb', ficha: 'unidad01', modelo: 'Unidad01', alto: 1.85, ry: 0 },
  elrey: { tipo: 'glb', ficha: 'elrey', modelo: 'El_Rey', alto: 2.05, ry: 0 }
};
// aspecto de un humano (para que el director cree enemigos humanos con la misma cara que el NPC)
export const aspecto = key => DEF[key]?.o || DEF.saqueador.o;
export const npcs = {};

// id: nombre único; def: clave en DEF (por defecto = id) · punto [x,z] · yaw (0 = mirando al sur, +Z)
// o: { pose: 'pie'|'herido', mira: true (al jugador) | 'id' | [x,z] , holo: true, y, porte }
export async function npc(id, punto, yaw = 0, o = {}) {
  const key = o.def || id, d = DEF[key];
  let n = npcs[id];
  if (!n) {
    if (d.tipo === 'rig') { const R = makeHuman(d.o); n = { id, R, root: R.root, tipo: 'rig' }; if (d.holo) n.holoMat = holograma(R.root, d.holo); }
    else if (d.tipo === 'robot') { const R = makeRobot(d.o); n = { id, R, root: R.root, tipo: 'rig' }; if (d.holo) { n.holoMat = holograma(R.root, d.holo); R.root.traverse(m => { if (m.isMesh) m.userData.enemy = null; }); } }
    else { const g = await instancia(d.modelo, d.alto, { ry: d.ry }); n = { id, g, root: g, tipo: 'glb', inner: g.children[0] }; }
    npcs[id] = n; scene.add(n.root);
    const f = FICHAS[d.ficha || key] || {};
    n.porte = f.porte || 'firme'; n.tic = f.gestoTic || null;
    n.off = {}; n.cab = { y: 0, x: 0 }; n.fase = Math.random() * 9; n.miradaT = 2 + Math.random() * 4; n.mirada = null; n.cruce = 0; n.ticT = 4 + Math.random() * 4;
  }
  if (n.llegada) { n.llegada(); n.llegada = null; }
  n.pose = o.pose || 'pie'; n.destino = null; n.spd = 0; n.gesto = null; n.cruce = 0;
  n.mirar = o.mira === true ? 'jugador' : o.mira || null;
  if (o.porte) n.porte = o.porte;
  n.root.visible = true; n.root.position.set(punto[0], o.y ?? groundAt(punto[0], punto[1], 3), punto[1]); n.root.rotation.set(0, yaw, 0); n.yawBase = yaw;
  if (n.inner) n.inner.rotation.set(0, n.inner.rotation.y, 0);
  if (o.holo && n.tipo === 'glb' && !n.holoMat) n.holoMat = holograma(n.g);
  return n;
}
export function ocultar(id) { const n = npcs[id]; if (n) { n.root.visible = false; n.destino = null; if (n.llegada) { n.llegada(); n.llegada = null; } } }
export function ocultarTodos() { for (const id in npcs) ocultar(id); }
// camina hasta [x,z]; la promesa se resuelve al llegar (o si se oculta / se le manda a otro sitio)
export function caminarA(id, punto, vel = 1.4) {
  const n = npcs[id]; if (!n || !n.root.visible) return Promise.resolve();
  if (n.llegada) n.llegada();
  n.destino = new V3(punto[0], 0, punto[1]); n.vel = vel;
  return new Promise(r => { n.llegada = r; });
}
// a quién mira: 'jugador' | id de otro NPC | [x,z] | [x,y,z] | V3 | null (al frente)
export function mirarA(id, obj) { const n = npcs[id]; if (n) n.mirar = obj === true ? 'jugador' : obj || null; }
// gestos: senalar · negar · asentir · encoger · manos · nuca · brazos · abrazar · rendirse · apuntar · cabizbajo · llorar · telefono
export function gesto(id, tipo, dur = 2.2) { const n = npcs[id]; if (n) n.gesto = { tipo, t: 0, dur }; }

// ---------- objetivo de la mirada ----------
const tA = new V3(), tB = new V3();
function puntoMirada(n, o) {
  if (o === 'jugador') return playerHead(tB);
  if (typeof o === 'string') { const m = npcs[o]; if (!m || !m.root.visible) return null; tB.copy(m.root.position); tB.y += 1.55; return tB; }
  if (Array.isArray(o)) return o.length === 3 ? tB.set(o[0], o[1], o[2]) : tB.set(o[0], 1.5, o[1]);
  if (o && o.isVector3) return tB.copy(o);
  return null;
}
const wrap = a => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

// ---------- desplazamientos de articulaciones (se suman a lo que pone animRig y se quitan antes del siguiente) ----------
const J = {
  'neck.x': R => [R.neck, 'x'], 'neck.y': R => [R.neck, 'y'], 'spine.x': R => [R.spine, 'x'], 'spine.y': R => [R.spine, 'y'], 'spine.z': R => [R.spine, 'z'],
  'armL.sh.x': R => [R.armL.sh, 'x'], 'armL.sh.z': R => [R.armL.sh, 'z'], 'armL.el.x': R => [R.armL.el, 'x'],
  'armR.sh.x': R => [R.armR.sh, 'x'], 'armR.sh.z': R => [R.armR.sh, 'z'], 'armR.el.x': R => [R.armR.el, 'x']
};
function quitarOff(n) { for (const k in n.off) { const [o, p] = J[k](n.R); o.rotation[p] -= n.off[k]; } n.off = {}; }
function ponerOff(n, off) { for (const k in off) { if (!off[k]) continue; const [o, p] = J[k](n.R); o.rotation[p] += off[k]; } n.off = off; }
const sumar = (a, b, w = 1) => { if (w <= 0) return a; for (const k in b) a[k] = (a[k] || 0) + b[k] * w; return a; };
function poseGesto(tipo, t) {
  switch (tipo) {
    case 'senalar': return { 'armR.sh.x': -1.35, 'armR.el.x': .3, 'neck.y': -.15 };
    case 'negar': return { 'neck.y': Math.sin(t * 9) * .32 };
    case 'asentir': return { 'neck.x': .06 + Math.sin(t * 8) * .16 };
    case 'encoger': return { 'armL.sh.z': .28, 'armR.sh.z': -.28, 'armL.el.x': -.9, 'armR.el.x': -.9, 'armL.sh.x': -.3, 'armR.sh.x': -.3, 'neck.x': -.06 };
    case 'manos': return { 'armL.sh.x': -.65, 'armR.sh.x': -.65, 'armL.el.x': -.55, 'armR.el.x': -.55, 'armL.sh.z': .28, 'armR.sh.z': -.28 };
    case 'nuca': return { 'armR.sh.x': -2.5, 'armR.sh.z': .35, 'armR.el.x': -1.9, 'neck.x': .22 };
    case 'brazos': return { 'armL.sh.x': -.5, 'armL.sh.z': -.32, 'armL.el.x': -1.75, 'armR.sh.x': -.5, 'armR.sh.z': .32, 'armR.el.x': -1.75 };
    case 'abrazar': return { 'armL.sh.x': -1.25, 'armR.sh.x': -1.25, 'armL.sh.z': -.25, 'armR.sh.z': .25, 'armL.el.x': -1.05, 'armR.el.x': -1.05, 'neck.x': .15 };
    case 'rendirse': return { 'armL.sh.x': -2.8, 'armR.sh.x': -2.8, 'armL.sh.z': .3, 'armR.sh.z': -.3, 'armL.el.x': -.5, 'armR.el.x': -.5 };
    case 'apuntar': return { 'armR.sh.x': -1.45, 'armR.el.x': .2, 'armL.sh.x': -1.3, 'armL.sh.z': -.45, 'armL.el.x': -.6, 'spine.y': -.18 };
    case 'cabizbajo': return { 'neck.x': .45, 'spine.x': .08 };
    case 'llorar': return { 'neck.x': .5, 'armR.sh.x': -1.7, 'armR.sh.z': .3, 'armR.el.x': -2.0, 'spine.x': .1 };
    case 'telefono': return { 'armR.sh.x': -.9, 'armR.sh.z': .6, 'armR.el.x': -2.3, 'neck.y': .2, 'neck.x': .1 };
  }
  return {};
}
// porte en reposo según la ficha
function poseReposo(n, t, habla) {
  const o = {}, nerv = n.porte === 'nervioso' || n.porte === 'inquieto';
  o['spine.z'] = Math.sin(t * (nerv ? .9 : .45) + n.fase) * (nerv ? .04 : .025);           // cambio de peso
  if (n.porte === 'altivo') { o['neck.x'] = -.1; o['spine.x'] = -.04; }
  if (n.porte === 'calido') o['spine.z'] += .02;
  if (nerv && !habla) { o['armR.el.x'] = Math.sin(t * 2.3 + n.fase) * .12 - .1; o['armL.el.x'] = Math.sin(t * 1.7) * .1 - .1; }
  return o;
}

// ---------- bucle ----------
export function actualizarNpcs(dt, hablante) {
  for (const id in npcs) {
    const n = npcs[id]; if (!n.root.visible) continue;
    const habla = hablante === id ? 1 : 0;
    let spd = 0;
    // caminar a la marca
    if (n.destino) {
      const dx = n.destino.x - n.root.position.x, dz = n.destino.z - n.root.position.z, d = Math.hypot(dx, dz);
      if (d < .25) { n.destino = null; if (n.llegada) { n.llegada(); n.llegada = null; } }
      else { spd = n.vel * Math.min(1, d / .6 + .35); n.root.rotation.y = angLerp(n.root.rotation.y, Math.atan2(dx, dz), dt * 5); n.root.position.x += Math.sin(n.root.rotation.y) * spd * dt; n.root.position.z += Math.cos(n.root.rotation.y) * spd * dt; n.root.position.y = groundAt(n.root.position.x, n.root.position.z, n.root.position.y + .3); }
    }
    // mirada: objetivo + miradas perdidas de vez en cuando (si no habla)
    n.miradaT -= dt;
    if (n.miradaT <= 0) {
      if (n.mirada) { n.mirada = null; n.miradaT = (n.porte === 'nervioso' ? 2 : 4.5) + Math.random() * 4; }
      else if (!habla && !n.destino) { n.mirada = (Math.random() - .5) * 1.6; n.miradaT = .8 + Math.random() * 1.4; }
      else n.miradaT = 1.5;
    }
    let relY = 0, relX = 0;
    const objetivo = n.pose === 'herido' ? (n.mirar ? n.mirar : null) : n.mirar;
    const pm = objetivo ? puntoMirada(n, objetivo) : null;
    if (pm) {
      const yaw = Math.atan2(pm.x - n.root.position.x, pm.z - n.root.position.z);
      relY = wrap(yaw - n.root.rotation.y);
      // si la cabeza no llega, gira el cuerpo (quieto y de pie)
      if (!n.destino && n.pose !== 'herido' && Math.abs(relY) > (habla ? .5 : .95)) { n.root.rotation.y = angLerp(n.root.rotation.y, yaw, dt * 2.4); relY = wrap(yaw - n.root.rotation.y); }
      const alto = n.tipo === 'rig' ? 1.55 * (n.R.S / .94) : 1.6, dist = Math.max(.5, Math.hypot(pm.x - n.root.position.x, pm.z - n.root.position.z));
      relX = -Math.atan2(pm.y - (n.root.position.y + alto), dist) * .7;
    }
    if (n.mirada !== null && n.mirada !== undefined && !habla) relY += n.mirada;
    n.cab.y += (clamp(relY, -1.05, 1.05) * .9 - n.cab.y) * Math.min(1, dt * 4);
    n.cab.x += (clamp(relX, -.45, .45) - n.cab.x) * Math.min(1, dt * 4);
    // gesto en curso (con entrada y salida suaves)
    let gw = 0, gt = null, gtt = 0;
    if (n.gesto) { const g = n.gesto; g.t += dt; gtt = g.t; gt = g.tipo; gw = Math.min(1, g.t / .35, (g.dur - g.t) / .45); if (g.t >= g.dur) n.gesto = null; }
    // gesto propio al hablar, de vez en cuando (Mike se toca la nuca, Hank se encoge…)
    if (habla && n.tic && !n.gesto) { n.ticT -= dt; if (n.ticT <= 0) { n.ticT = 6 + Math.random() * 6; n.gesto = { tipo: n.tic, t: 0, dur: 1.8 }; } }
    // brazos cruzados en reposo (John, Sarah, Varela) cuando no hablan ni andan
    const cruzar = (n.porte === 'quieto' || n.tic === 'brazos') && !habla && !n.destino && !n.gesto && n.pose !== 'herido';
    n.cruce += ((cruzar ? 1 : 0) - n.cruce) * Math.min(1, dt * 1.5);

    if (n.tipo === 'rig') {
      quitarOff(n);
      if (n.pose === 'herido') poseHerido(n.R, G.time); else animRig(n.R, dt, { spd, habla });
      const off = { 'neck.y': n.cab.y, 'neck.x': n.cab.x * (n.pose === 'herido' ? .4 : 1) };
      if (n.pose !== 'herido') { sumar(off, poseReposo(n, G.time, habla), 1 - gw); sumar(off, poseGesto('brazos', 0), n.cruce * (1 - gw)); }
      if (gt) sumar(off, poseGesto(gt, gtt), gw);
      ponerOff(n, off);
      if (n.holoMat) n.holoMat.opacity = .2 + Math.random() * .1 + (Math.sin(G.time * 30) > .9 ? .18 : 0);
    } else {
      // modelo sin esqueleto: gira el cuerpo hacia lo que mira, respira, cabecea al hablar y se balancea al andar
      if (pm && !n.destino && Math.abs(relY) > .15) n.root.rotation.y = angLerp(n.root.rotation.y, n.root.rotation.y + relY, dt * 1.6);
      const s = 1 + Math.sin(G.time * 1.8 + n.fase) * .006 + habla * Math.abs(Math.sin(G.time * 7)) * .01; n.g.scale.set(1, s, 1);
      if (n.inner) {
        let rx = habla * Math.sin(G.time * 5.5) * .025, rz = Math.sin(G.time * .5 + n.fase) * .012;
        if (gt === 'asentir') rx += Math.sin(gtt * 8) * .05 * gw; if (gt === 'negar') n.inner.rotation.y += Math.sin(gtt * 9) * .01 * gw;
        if (gt === 'cabizbajo' || gt === 'llorar') rx += .08 * gw; if (gt === 'encoger') rz += Math.sin(gtt * 6) * .02 * gw;
        if (spd > 0) { rz += Math.sin(G.time * 7) * .035; n.inner.position.y = Math.abs(Math.sin(G.time * 7)) * .04; } else n.inner.position.y *= .9;
        n.inner.rotation.x = rx; n.inner.rotation.z = rz;
      }
      if (n.holoMat) n.holoMat.opacity = .22 + Math.random() * .12 + (Math.sin(G.time * 30) > .9 ? .2 : 0);
    }
  }
}
