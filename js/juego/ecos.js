// ECOS DEL PASADO: el chip neural de Dave le deja «imaginar el pasado» en sitios marcados.
// Cerca de un eco activo flotan motas cian y vibra el reloj (mano izquierda). Al activarlo:
//   VR: clic del joystick izquierdo, o las dos manos (grip) junto a la cabeza · PC: Q
// el mundo se apaga (esfera pegada a la cámara + niebla y exposición) y se reproduce una escena fantasma:
// figuras cian translúcidas que aparecen, caminan, gesticulan y hablan con subtítulos. Se puede repetir.
// Al terminar emite director.evento('eco_visto', { id }).
// API: ecos.registrar(id, { pos:[x,z], radio, duracion, titulo, activo, actores:{ clave:{ robot, o, nombre } },
//        guion:[{ t, actor, accion:'aparecer'|'caminar'|'gesto'|'linea'|'sonido'|'desaparecer', datos }] })
//      ecos.activo(id, bool) · ecos.reproducir(id) · ecos.parar() · ecos.cerca() · ecos.lista
import { THREE, V3, G, scene, camera, renderer, groundAt, angLerp, rnd } from '../nucleo.js';
import { makeHuman, makeRobot, animRig, holograma } from '../cuerpos.js';
import { sfx, buzz } from '../fx.js';
import { ui } from '../ui.js';
import { playerFeet, leftC, rightC, ctrl } from '../jugador.js';
import { eventoHistoria } from '../interaccion/ruido.js';

const tA = new V3(), tB = new V3();
const ECOS = {};
let actual = null, cercano = null, mezcla = 0;

// ---------- Registro ----------
export function registrar(id, def) {
  const e = { id, radio: 3, duracion: 14, activo: true, titulo: 'Eco', actores: {}, guion: [], visto: 0, ...def };
  e.guion = [...e.guion].sort((a, b) => a.t - b.t);
  e.motas = motas(e.pos); e.motas.visible = false; scene.add(e.motas);
  ECOS[id] = e; return e;
}
export function activo(id, on = true) { const e = ECOS[id]; if (!e) return false; e.activo = !!on; if (!on && actual?.e === e) parar(); return true; }

// motas que delatan el eco (24 puntos, un solo draw call)
function motas(pos) {
  const n = 24, g = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = Math.random() * 1.1, t = Math.random() * 6.3; a[i * 3] = Math.cos(t) * r; a[i * 3 + 1] = rnd(.2, 2); a[i * 3 + 2] = Math.sin(t) * r; }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x7ff3ff, size: .05, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  p.position.set(pos[0], groundAt(pos[0], pos[1], 3), pos[1]); p.frustumCulled = false; return p;
}

// ---------- Velo: esfera pegada a la cámara que desatura y tiñe ----------
const velo = new THREE.Mesh(new THREE.SphereGeometry(.4, 16, 10), new THREE.MeshBasicMaterial({ color: 0x8aa2ae, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false }));
velo.renderOrder = 990; velo.visible = false; velo.frustumCulled = false; camera.add(velo);
let nieblaBase = null, expoBase = 1; const NIEBLA_ECO = new THREE.Color(.55, .68, .74);

// ---------- Fantasmas ----------
function fantasma(def) {
  const R = def.robot ? makeRobot({ body: 0x2a2c30, dark: 0x0e0f12, accent: 0xc9a23a, eye: 0xff2a1a, ...(def.o || {}) }) : makeHuman({ camisa: 0x5a6a7a, pantalon: 0x2a2f3a, piel: 0xd9a27c, pelo: 0x2b1d14, ...(def.o || {}) });
  const mat = holograma(R.root, def.color || 0x29e6ff);
  R.root.traverse(m => { if (m.isMesh) { m.renderOrder = 1000; m.userData.enemy = null; m.raycast = () => {}; } });
  R.root.visible = false; scene.add(R.root); animRig(R, 1, { spd: 0 });
  return { R, mat, def, destino: null, vel: 1.3, spd: 0, gesto: null, objeto: null };
}
// gestos con los brazos (rotación del hombro/codo tras animRig; negativo = hacia delante)
const GESTOS = {
  telefono: (R, w) => { R.armR.sh.rotation.x = -2.3 * w; R.armR.sh.rotation.z = .5 * w; R.armR.el.rotation.x = -1.9 * w; },
  coger: (R, w) => { for (const a of [R.armL, R.armR]) { a.sh.rotation.x = -1.2 * w; a.el.rotation.x = -.6 * w; } },
  senalar: (R, w) => { R.armR.sh.rotation.x = -1.55 * w; },
  manos: (R, w) => { for (const a of [R.armL, R.armR]) { a.sh.rotation.x = -2.8 * w; } },
  correr: (R, w) => { R.spine.rotation.x = .25 * w; }
};

// ---------- Reproducción ----------
export function reproducir(id) {
  const e = ECOS[id]; if (!e) return false;
  if (actual) parar(true);
  const figs = {};
  for (const k in e.actores) figs[k] = fantasma(e.actores[k]);
  actual = { e, t: 0, i: 0, figs };
  sfx('escaner'); zumbido(true);
  ui.subtitulo('ECO', e.titulo); // (la tarjeta de capítulo tapa la pantalla: aquí no)
  return true;
}
export function parar(silencio = false) {
  if (!actual) return;
  for (const k in actual.figs) actual.figs[k].R.root.removeFromParent();
  if (actual.objeto) actual.objeto.removeFromParent();
  if (!silencio) ui.subtitulo(null);
  actual = null; zumbido(false);
}
function paso(s) {
  const f = actual.figs[s.actor], d = s.datos || {};
  switch (s.accion) {
    case 'aparecer': if (!f) break; f.R.root.visible = true; f.R.root.position.set(d.pos[0], groundAt(d.pos[0], d.pos[1], 3), d.pos[1]); f.R.root.rotation.y = d.yaw || 0; f.destino = null; break;
    case 'caminar': if (!f) break; f.destino = new V3(d.a[0], 0, d.a[1]); f.vel = d.vel || 1.3; break;
    case 'gesto': if (!f) break; f.gesto = { tipo: d.tipo, t: 0, dur: d.dur || 2.5 }; if (d.objeto) llevar(f, d.objeto); break;
    case 'linea': ui.subtitulo(f?.def.nombre || s.actor?.toUpperCase() || '', d.texto || d); sfx('blip'); break;
    case 'sonido': sfx(d.sfx || d); break;
    case 'desaparecer': if (f) f.R.root.visible = false; break;
  }
}
// objeto fantasma en la mano (el casco, un teléfono…)
function llevar(f, tipo) {
  if (actual.objeto) actual.objeto.removeFromParent();
  const geo = tipo === 'casco' ? new THREE.SphereGeometry(.14, 12, 8, 0, 6.3, 0, 1.9) : new THREE.BoxGeometry(.04, .08, .012);
  const m = new THREE.Mesh(geo, f.mat); m.renderOrder = 1000; m.position.set(0, -.08, .06); f.R.armR.grip.add(m); actual.objeto = m;
}

// ---------- Sonido: zumbido grave mientras dura el eco ----------
let osc = null;
function zumbido(on) {
  import('../audio.js').then(({ A }) => {
    const c = A.ctx; if (!c) return;
    if (on && !osc) { const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.frequency.value = 55; o2.frequency.value = 82.6; o.type = 'sine'; o2.type = 'triangle'; g.gain.value = 0; g.gain.setTargetAtTime(.05, c.currentTime, .6); o.connect(g); o2.connect(g); g.connect(A.master || c.destination); o.start(); o2.start(); osc = { o, o2, g }; }
    else if (!on && osc) { const s = osc; osc = null; s.g.gain.setTargetAtTime(0, c.currentTime, .3); setTimeout(() => { try { s.o.stop(); s.o2.stop(); } catch (er) {} }, 1500); }
  }).catch(() => {});
}

// ---------- Entrada ----------
let qPulsada = false;
addEventListener('keydown', e => { if (e.code === 'KeyQ' && !e.repeat && G.playing && G.mode === 'pc' && !G.enDialogo) qPulsada = true; });
let prevStick = false, manosT = 0;
function entradaVR(dt) {
  if (G.mode !== 'vr') return false;
  const L = leftC()?.src?.gamepad, st = !!L?.buttons[3]?.pressed, flanco = st && !prevStick; prevStick = st;
  // las dos manos con grip junto a la cabeza (0,25 m) durante 0,4 s
  camera.getWorldPosition(tA); let n = 0;
  for (const c of ctrl) { const gp = c.src?.gamepad; if (!gp || !gp.buttons[1]?.pressed) continue; c.grip.getWorldPosition(tB); if (tB.distanceTo(tA) < .25) n++; }
  manosT = n >= 2 ? manosT + dt : 0;
  if (manosT > .4) { manosT = -9; return true; }
  return flanco;
}

// ---------- Bucle ----------
let vibrado = null, pista = '';
export function actualizarEcos(dt) {
  const pf = playerFeet(tA), vr = G.mode === 'vr';
  // eco cercano y motas
  cercano = null;
  for (const id in ECOS) {
    const e = ECOS[id], d = Math.hypot(pf.x - e.pos[0], pf.z - e.pos[1]);
    e.motas.visible = e.activo && d < 30 && !actual;
    if (e.motas.visible) { e.motas.rotation.y += dt * .3; e.motas.material.opacity = .25 + Math.sin(G.time * 2.4) * .15 + (d < e.radio ? .3 : 0); }
    if (e.activo && d < e.radio) cercano = e;
  }
  // vibración del reloj y pista al entrar en la zona
  if (cercano && vibrado !== cercano.id) { vibrado = cercano.id; const iz = leftC(); buzz(iz, .5, 90); setTimeout(() => buzz(iz, .5, 90), 220); sfx('blip'); }
  if (!cercano) vibrado = null;
  const quiere = entradaVR(dt) || qPulsada; qPulsada = false;
  if (quiere) { if (actual) parar(); else if (cercano) reproducir(cercano.id); }
  if (!vr && G.playing) { const t = cercano && !actual ? 'Q · imaginar el pasado' : actual ? 'Q · volver al presente' : ''; const el = document.getElementById('hint'); if (t && (!el.textContent || el.textContent === pista)) { ui.hint(t); pista = t; } else if (!t && pista && el.textContent === pista) { ui.hint(''); pista = ''; } }
  // velo, niebla y exposición
  mezcla = Math.max(0, Math.min(1, mezcla + (actual ? dt : -dt) * 1.6));
  velo.visible = mezcla > 0; velo.material.opacity = mezcla * .5;
  if (mezcla > 0) {
    if (!nieblaBase && scene.fog) { nieblaBase = { c: scene.fog.color.clone() }; expoBase = renderer.toneMappingExposure; }
    if (scene.fog) scene.fog.color.lerpColors(nieblaBase.c, NIEBLA_ECO, mezcla);
    renderer.toneMappingExposure = expoBase * (1 - mezcla * .25);
  } else if (nieblaBase) { if (scene.fog) scene.fog.color.copy(nieblaBase.c); renderer.toneMappingExposure = expoBase; nieblaBase = null; }
  if (!actual) return;
  // guion
  const A = actual; A.t += dt;
  while (A.i < A.e.guion.length && A.e.guion[A.i].t <= A.t) paso(A.e.guion[A.i++]);
  for (const k in A.figs) {
    const f = A.figs[k], R = f.R; if (!R.root.visible) continue;
    f.spd = 0;
    if (f.destino) { const p = R.root.position, dx = f.destino.x - p.x, dz = f.destino.z - p.z, d = Math.hypot(dx, dz);
      if (d < .2) f.destino = null; else { f.spd = f.vel; R.root.rotation.y = angLerp(R.root.rotation.y, Math.atan2(dx, dz), dt * 5); p.x += Math.sin(R.root.rotation.y) * f.spd * dt; p.z += Math.cos(R.root.rotation.y) * f.spd * dt; p.y = groundAt(p.x, p.z, p.y + .5); } }
    animRig(R, dt, { spd: f.spd });
    if (f.gesto) { const g = f.gesto; g.t += dt; const w = Math.min(1, g.t / .4, Math.max(0, (g.dur - g.t) / .4)); GESTOS[g.tipo]?.(R, w); if (g.t >= g.dur) f.gesto = null; }
    f.mat.opacity = .22 + Math.random() * .1 + (Math.sin(G.time * 31 + k.length) > .92 ? .2 : 0);
  }
  if (A.t >= A.e.duracion) { const id = A.e.id; A.e.visto++; parar(); eventoHistoria('eco_visto', { id }); }
}
export const cerca = () => cercano?.id || null;
export const ecos = { registrar, activo, reproducir, parar, cerca, lista: ECOS, get actual() { return actual?.e.id || null; } };

// ---------- Tres ecos de ejemplo ----------
// laboratorio: Mike saca el casco de la vitrina y se lo da a R-01, que sale por la puerta trasera
registrar('lab_casco', { titulo: 'El casco · 04:58', pos: [0, -140.6], radio: 2.6, duracion: 17,
  actores: { mike: { nombre: 'MIKE', o: { bata: true } }, r01: { nombre: 'R-01', robot: true, o: { scale: 1.05, helmet: false } } },
  guion: [
    { t: 0, actor: 'mike', accion: 'aparecer', datos: { pos: [1.8, -139.4], yaw: Math.PI * .8 } },
    { t: 0, actor: 'r01', accion: 'aparecer', datos: { pos: [-2.4, -137.5], yaw: Math.PI * .7 } },
    { t: .6, actor: 'mike', accion: 'caminar', datos: { a: [.7, -141.1], vel: 1 } },
    { t: .8, actor: 'r01', accion: 'caminar', datos: { a: [-.8, -141], vel: .9 } },
    { t: 2.2, actor: 'mike', accion: 'linea', datos: { texto: 'Nadie más puede saber que funciona. Ni el ejército.' } },
    { t: 4.6, actor: 'mike', accion: 'gesto', datos: { tipo: 'coger', dur: 5, objeto: 'casco' } },
    { t: 5.4, actor: 'r01', accion: 'linea', datos: { texto: 'Casco_v3 recibido. ¿Destino, doctor?' } },
    { t: 8.2, actor: 'mike', accion: 'linea', datos: { texto: 'Lejos. Si me pasa algo… que Dave no lo encuentre.' } },
    { t: 9.8, actor: 'r01', accion: 'gesto', datos: { tipo: 'coger', dur: 6, objeto: 'casco' } },
    { t: 10.6, actor: 'r01', accion: 'caminar', datos: { a: [-8.5, -146.8], vel: 1.1 } },
    { t: 11.5, actor: 'mike', accion: 'gesto', datos: { tipo: 'manos', dur: 1.6 } },
    { t: 13.5, actor: 'mike', accion: 'linea', datos: { texto: 'Perdóname, hermano.' } },
    { t: 16, actor: 'r01', accion: 'desaparecer' }
  ] });
// calle: una familia huye de dos robots por el cruce
registrar('calle_familia', { titulo: 'La primera noche', pos: [58, 2], radio: 3.2, duracion: 13,
  actores: { padre: { nombre: 'PADRE', o: { camisa: 0x3a4a5a } }, madre: { nombre: 'MADRE', o: { melena: true, scale: .9 } }, nina: { nombre: 'NIÑA', o: { melena: true, scale: .58 } },
    r1: { nombre: 'R-7', robot: true, o: { antenna: true } }, r2: { nombre: 'R-7', robot: true, o: { antenna: true } } },
  guion: [
    { t: 0, actor: 'padre', accion: 'aparecer', datos: { pos: [66, 4], yaw: -Math.PI / 2 } },
    { t: 0, actor: 'madre', accion: 'aparecer', datos: { pos: [65.5, 1.5], yaw: -Math.PI / 2 } },
    { t: 0, actor: 'nina', accion: 'aparecer', datos: { pos: [66.6, 2.6], yaw: -Math.PI / 2 } },
    { t: .2, actor: 'padre', accion: 'caminar', datos: { a: [44, 4], vel: 3.4 } },
    { t: .2, actor: 'madre', accion: 'caminar', datos: { a: [44, 1.2], vel: 3.2 } },
    { t: .4, actor: 'nina', accion: 'caminar', datos: { a: [45, 2.4], vel: 3 } },
    { t: .6, actor: 'padre', accion: 'linea', datos: { texto: '¡Corred! ¡No miréis atrás!' } },
    { t: 2, actor: 'r1', accion: 'aparecer', datos: { pos: [74, 3], yaw: -Math.PI / 2 } },
    { t: 2.3, actor: 'r2', accion: 'aparecer', datos: { pos: [75, 0], yaw: -Math.PI / 2 } },
    { t: 2.4, actor: 'r1', accion: 'caminar', datos: { a: [50, 3], vel: 2.6 } },
    { t: 2.6, actor: 'r2', accion: 'caminar', datos: { a: [50, 0], vel: 2.4 } },
    { t: 3.2, actor: 'nina', accion: 'linea', datos: { texto: '¡Papá, el oso! ¡Se me ha caído!' } },
    { t: 5.4, actor: 'madre', accion: 'linea', datos: { texto: '¡Déjalo, cariño! ¡Corre!' } },
    { t: 6.5, actor: 'r1', accion: 'sonido', datos: { sfx: 'alerta' } },
    { t: 7.5, actor: 'r1', accion: 'linea', datos: { texto: 'Civiles detectados. Procediendo.' } },
    { t: 10.5, actor: 'padre', accion: 'desaparecer' }, { t: 10.5, actor: 'madre', accion: 'desaparecer' }, { t: 10.6, actor: 'nina', accion: 'desaparecer' }
  ] });
// base: John, junto al hangar, informa por teléfono (inactivo hasta que la historia lo encienda: destripa la traición)
registrar('base_john', { titulo: 'Una llamada', pos: [144, 22], radio: 3, duracion: 11, activo: false,
  actores: { john: { nombre: 'JOHN', o: { camisa: 0x4a5236, pantalon: 0x3d4330, piel: 0xc58c64, pelo: 0x111111, gorra: true, gorraColor: 0x3a4028, chaleco: 0x2f3524 } } },
  guion: [
    { t: 0, actor: 'john', accion: 'aparecer', datos: { pos: [146.5, 20.5], yaw: -Math.PI / 2 } },
    { t: .4, actor: 'john', accion: 'caminar', datos: { a: [144.6, 22.4], vel: .9 } },
    { t: 2.4, actor: 'john', accion: 'gesto', datos: { tipo: 'telefono', dur: 7.5, objeto: 'telefono' } },
    { t: 3, actor: 'john', accion: 'linea', datos: { texto: 'Soy yo. Escuche bien, no tengo mucho tiempo.' } },
    { t: 5.6, actor: 'john', accion: 'linea', datos: { texto: 'Tengo a Dave. LZR-0001 sigue vivo.' } },
    { t: 8.4, actor: 'john', accion: 'linea', datos: { texto: 'Sí. Se lo llevaré. Como acordamos.' } }
  ] });
