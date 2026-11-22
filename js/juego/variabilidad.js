// Variabilidad de la partida (docs/eventos.md · «Sistemas de juego · Variabilidad»): cada partida nueva tira una semilla
// (localStorage 'apoc2030.variabilidad') y con ella decide
//   · botín de cajones y taquillas (vendas, latas, coleccionables; munición casi nunca: la escasez manda),
//   · 2-3 sucesos de calle por capítulo nocturno (de un repertorio de 7),
//   · variantes de las rondas de las patrullas (puntos desplazados, sentido, velocidad, pausas),
//   · pequeñas variaciones del clima SIN salir de lo que pide el guion (si no llueve, no llueve),
//   · vecinos asomados a las ventanas y los coleccionables («fotos del pueblo» y «notas de supervivientes»).
// Partida nueva = empezar el prólogo (capítulo 0): nueva semilla y se rehace todo. Reanudar = misma semilla.
// Todo es opcional: si algo falla, el capítulo sigue (cada paso va en try/catch desde index.js).
import { THREE, V3, G, scene, camera, capOn, colliders, groundAt, dentroDeSolido, cv2d, toTex, fuenteLuz, angLerp, clamp } from '../nucleo.js';
import { makeHuman, makeRobot, animRig, PAL } from '../cuerpos.js';
import { crearProp, quitarProp, props, registrar, desregistrar } from '../interaccion/objetos.js';
import { muebles } from '../interaccion/muebles.js';
import { eventoHistoria, escucharRuido, emitirRuido } from '../interaccion/ruido.js';
import { reloj } from '../interaccion/reloj.js';
import { Radio } from '../interaccion/sonido.js';
import { W } from '../mundo/tierra.js';
import { ATM } from '../mundo/atmosfera.js';
import { sfx } from '../fx.js';
import { ui, say } from '../ui.js';
import { playerFeet, playerHead } from '../jugador.js';
import { enemies, spawn, guardias } from '../enemigos.js';
import { crear as crearNpc, quitar as quitarNpc, huir, gesto, agentes } from './npcIA.js';

let D = null; import('../historia/director.js').then(m => { D = m.director; }).catch(() => {});
let MEM = null; import('../personajes/memoria.js').then(m => { MEM = m.memoria; }).catch(() => {});
const tA = new V3(), tB = new V3(), tC = new V3();

// ---------- Semilla y estado de la partida ----------
const CLAVE = 'apoc2030.variabilidad';
export const run = { semilla: 0, col: { foto: [], nota: [] }, perro: false, lucia: false, minijuegos: {} };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// generador reproducible por clave: azar('botin')() → 0..1 (misma semilla + misma clave = misma secuencia)
export const azar = clave => mulberry((run.semilla ^ hash(clave)) >>> 0);
export const elegir = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export const barajar = (r, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function guardarRun() { try { localStorage.setItem(CLAVE, JSON.stringify(run)); } catch (e) {} }
function cargarRun() { try { const s = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (s?.semilla) Object.assign(run, s); } catch (e) {} if (!run.semilla) nuevaSemilla(); run.col ||= { foto: [], nota: [] }; run.minijuegos ||= {}; }
function nuevaSemilla() { run.semilla = (Math.random() * 4294967295) >>> 0 || 1; run.col = { foto: [], nota: [] }; run.perro = false; run.lucia = false; run.minijuegos = {}; guardarRun(); }

// ---------- Utilidades ----------
let subT = 0, subTxt = '';
// subtítulo propio solo si la historia no está hablando; se borra solo si sigue siendo el nuestro
export function decir(quien, texto, s = 2.6) {
  if (G.enDialogo || D?.hablante) return false;
  ui.subtitulo(quien, texto); subTxt = texto; subT = s; return true;
}
function actualizarSub(dt) { if (subT > 0 && (subT -= dt) <= 0) { if (document.getElementById('subT')?.textContent === subTxt) ui.subtitulo(null); subTxt = ''; } }
// punto libre cerca de (x, z): espiral hasta 3 m
export function libre(x, z, r = .5) {
  for (let k = 0; k < 24; k++) { const a = k * 2.4, d = k ? .3 + k * .12 : 0, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (!dentroDeSolido(px, pz, .3) && !dentroDeSolido(px + r, pz, .3) && !dentroDeSolido(px - r, pz, .3) && !dentroDeSolido(px, pz + r, .3) && !dentroDeSolido(px, pz - r, .3)) return [px, pz]; }
  return [x, z];
}
const distJ = (x, z) => { const p = playerFeet(tA); return Math.hypot(p.x - x, p.z - z); };
const matC = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
function caja(g, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; }
function cil(g, r, h, m, x, y, z, rx = 0, ry = 0, rz = 0, s = 10) { const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, s), m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = true; g.add(me); return me; }
const ASPECTOS = [{ camisa: 0x6a5a40, pantalon: 0x2a2a30, piel: 0xe0b090, pelo: 0x3a2a1a }, { camisa: 0x3a4a6a, pantalon: 0x30302a, piel: 0xc8946c, pelo: 0x14100c, gorra: true, gorraColor: 0x2a2a2a }, { camisa: 0x7a3a2a, pantalon: 0x22242a, piel: 0x8a5a3a, pelo: 0x0a0806, melena: true }, { camisa: 0x4a5a3a, pantalon: 0x3a3a44, piel: 0xd8a882, pelo: 0x5a3a1a, barba: true }];

// ---------- 1) Botín de cajones y taquillas ----------
// tabla: [resultado, peso]. La munición solo sale una vez por partida y con poca probabilidad (escasez F1.5).
const TABLA = [['nada', 38], ['venda', 22], ['lata', 12], ['coleccionable', 20], ['botiquin', 4], ['municion', 4]];
const anadidos = []; // props que añadimos (se quitan al rehacer la partida)
function tirar(r, tabla) { const tot = tabla.reduce((s, t) => s + t[1], 0); let x = r() * tot; for (const [v, p] of tabla) if ((x -= p) < 0) return v; return tabla[0][0]; }
function botin() {
  const r = azar('botin'); let municion = 0, n = 0;
  for (const m of muebles) {
    if (!m.meter) continue;
    const dentro = props.filter(p => p.contenedor === m && p.estado !== 'roto');
    // lo que ya había varía un poco: una venda puede faltar o ser un botiquín (nunca se tocan cintas, linternas ni munición)
    for (const p of dentro) if (p.tipo === 'venda') { const x = r(); if (x < .14) quitarProp(p); else if (x < .26) { const pos = p.root.position.clone(); quitarProp(p); poner(m, 'botiquin', pos); } }
    let res = tirar(r, TABLA); if (res === 'municion' && municion++) res = 'venda';
    if (res === 'nada') continue;
    if (res === 'coleccionable') { if (m.tipo === 'cajon') huecosColeccion.push(m); continue; }
    const libreX = [-.12, .12, 0, -.06, .06].find(x => !dentro.some(p => Math.abs(p.root.position.x - x) < .08)) ?? 0;
    const y = m.tipo === 'armario' ? (dentro[0]?.root.position.y ?? null) : null;
    if (m.tipo === 'armario' && y == null) continue;
    if (poner(m, res, new V3(libreX, y ?? 0, dentro.length ? -.05 : 0))) n++;
  }
  return n;
}
function poner(m, tipo, pos) {
  try { const p = m.tipo === 'armario' ? m.meter(tipo, pos.x, pos.y, pos.z, { ry: Math.random() * 6 }) : m.meter(tipo, pos.x, pos.z, { ry: Math.random() * 6 }); if (p) anadidos.push(p); return p; }
  catch (e) { return null; }
}

// ---------- 2) Coleccionables: fotos del pueblo y notas de supervivientes ----------
export const FOTOS = [
  ['La verbena de 2019', 'La plaza llena de farolillos. Hank, con delantal, sirve sangría. Detrás, a lápiz: «el último verano sin robots».'],
  ['Inauguración del laboratorio', 'Mike corta la cinta con unas tijeras enormes. Dave, a su lado, pone cara de no entender nada.'],
  ['Juveniles de baloncesto', 'El equipo del pueblo. Nico, el más bajito, sujeta el trofeo al revés.'],
  ['Bar Lucía, el primer día', 'El cartel recién pintado. El dueño le puso el nombre por la cría de Dave, que le dibujó las letras.'],
  ['La primera entrega', 'Un camión de Lázaro Systems en la calle mayor. Los vecinos aplauden a los R-7 como si fueran bomberos.'],
  ['La boda de Hank', 'Hank con treinta años menos y sin barriga, bailando un pasodoble. Nadie diría que es él.'],
  ['Fiestas de Peñas Negras', 'Soldados de la base contra el pueblo, partido de fútbol. Ganó el pueblo. Eso pone, al menos.'],
  ['Lucía y el robot de cartón', 'Lucía con una caja pintada en la cabeza. Con rotulador: «ROBOT BUENO. NO MUERDE».']
];
export const NOTAS = [
  ['Escaleras', 'Si lees esto: los robots suben las escaleras despacio. Ve siempre por arriba. — M.'],
  ['Al polideportivo', 'Marta: nos vamos al polideportivo con los Ortega. Lleva agua. No uses el móvil, dicen que lo rastrean.'],
  ['Día 2', 'Hemos tapado las ventanas con colchones. Toda la noche se oyen pasos metálicos en la calle.'],
  ['La radio', 'El de la radio dice que Lázaro manda ayuda. Nadie ha visto ni un camión. Solo más robots.'],
  ['Trufa', 'Le dejé mi perra a la vecina antes de irme. Si la ves, se llama Trufa. Le pierden las latas de sardinas.'],
  ['Peaje', 'Los de Varela ya no son soldados. Cobran por pasar el cordón: comida, gasolina o lo que lleves encima.'],
  ['Chispa', 'Rata nos robó el generador. El pequeño, Chispa, volvió de noche a devolvernos la gasolina. Ese chaval no es como ellos.'],
  ['Ojos rojos', 'Los de ojos rojos no miran: escuchan. Quítate los zapatos. No toses. No respires si puedes.'],
  ['La bici', 'Mamá: me fui en la bici a buscar a Leo. Vuelvo antes de que se haga de noche. Prometido. — Lucas']
];
const NOTA_BICI = 8;
export const coleccion = { objetos: [], total: { foto: FOTOS.length, nota: NOTAS.length } };
const huecosColeccion = []; // cajones que han salido con «coleccionable»
const matFoto = new Map();
function texturaCol(tipo, i) {
  const k = tipo + i; if (matFoto.has(k)) return matFoto.get(k);
  const [c, x] = cv2d(128, tipo === 'foto' ? 160 : 170), H = c.height;
  if (tipo === 'foto') { x.fillStyle = '#f2ead8'; x.fillRect(0, 0, 128, H); const g = x.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#8a7458'); g.addColorStop(1, '#4a3a28'); x.fillStyle = g; x.fillRect(8, 8, 112, 112);
    x.fillStyle = 'rgba(30,20,10,.55)'; for (let j = 0; j < 5; j++) { const px = 20 + ((i * 37 + j * 23) % 80), h = 30 + ((i * 13 + j * 7) % 30); x.beginPath(); x.arc(px, 120 - h, 8, 0, 7); x.fill(); x.fillRect(px - 9, 120 - h + 6, 18, h); }
    x.fillStyle = '#4a3a2a'; x.font = 'italic 11px serif'; x.textAlign = 'center'; x.fillText(FOTOS[i][0].slice(0, 22), 64, 142); }
  else { x.fillStyle = '#ece6d4'; x.fillRect(0, 0, 128, H); x.strokeStyle = 'rgba(80,110,160,.35)'; for (let y = 22; y < H; y += 12) { x.beginPath(); x.moveTo(6, y); x.lineTo(122, y); x.stroke(); }
    x.strokeStyle = '#2a2a40'; x.lineWidth = 1.2; for (let y = 20, j = 0; y < H - 10; y += 12, j++) { x.beginPath(); let px = 10; x.moveTo(px, y); while (px < 100 + (j * 17 % 20)) { px += 4 + ((px * 7 + j) % 5); x.lineTo(px, y - ((px + j) % 3)); } x.stroke(); } }
  const m = new THREE.MeshStandardMaterial({ map: toTex(c, false), roughness: .9, emissive: 0xfff2d0, emissiveIntensity: .06 }); matFoto.set(k, m); return m;
}
// tipo 'foto'|'nota' · i: índice en FOTOS/NOTAS · o: { x, y, z, ry, padre, contenedor }
export function crearColeccionable(tipo, i, o) {
  if (run.col[tipo].includes(i) || coleccion.objetos.some(c => c.tipo === tipo && c.i === i)) return null;
  const geo = tipo === 'foto' ? new THREE.BoxGeometry(.1, .004, .125) : new THREE.BoxGeometry(.15, .003, .2);
  const mesh = new THREE.Mesh(geo, [matC(0xe8e0cc), matC(0xe8e0cc), texturaCol(tipo, i), matC(0xd8d0bc), matC(0xe8e0cc), matC(0xe8e0cc)]);
  geo.computeBoundingBox(); mesh.position.set(o.x, (o.y || 0) + .003, o.z); mesh.rotation.y = o.ry || 0; mesh.receiveShadow = true; (o.padre || scene).add(mesh);
  const obj = { tipo, i, label: tipo === 'foto' ? 'foto del pueblo' : 'nota', root: mesh, mallas: [mesh], cogido: false, contenedor: o.contenedor || null,
    activo: () => !obj.cogido && capOn.tierra && (!obj.contenedor || obj.contenedor.abierto()),
    centro: out => mesh.getWorldPosition(out),
    agarre: { dist: p => mesh.getWorldPosition(tA).distanceTo(p) - .07, agarrar: () => { coger(obj); return false; }, seguir() {}, soltar() {} },
    pulsarE() { coger(obj); return true; } };
  registrar(obj); coleccion.objetos.push(obj); return obj;
}
function quitarColeccionable(obj) { obj.root.removeFromParent(); desregistrar(obj); const k = coleccion.objetos.indexOf(obj); if (k >= 0) coleccion.objetos.splice(k, 1); }
export function coger(obj) {
  if (obj.cogido) return; obj.cogido = true; quitarColeccionable(obj);
  const lista = obj.tipo === 'foto' ? FOTOS : NOTAS, [titulo, texto] = lista[obj.i];
  if (!run.col[obj.tipo].includes(obj.i)) run.col[obj.tipo].push(obj.i); guardarRun();
  const n = run.col[obj.tipo].length, tot = lista.length, et = obj.tipo === 'foto' ? 'FOTO' : 'NOTA';
  sfx('pickup'); say(`${et === 'FOTO' ? 'Foto' : 'Nota'} · «${titulo}» · ${n}/${tot}`);
  reloj.mensaje(texto, `${et} ${n}/${tot}`); decir(et === 'FOTO' ? 'FOTO' : 'NOTA', texto, 2 + texto.length * .045);
  eventoHistoria('coleccionable', { tipo: obj.tipo, id: obj.i, titulo, n, total: tot });
  if (obj.tipo === 'nota' && obj.i === NOTA_BICI) eventoHistoria('bici_nota');
  pintarContador(true);
}
// sitios: superficies del mundo (encimeras, mesas) y suelo de calles, parque, lab, tienda y base
const SUELO = [[-6.9, 40], [6.8, 12], [-6.7, -18], [6.9, -35], [-38.5, 37], [-30, 48], [31, 75.6], [-25, 74.2], [2.6, -128], [-14, -142], [12.6, -138], [-9.6, -55.2], [-19.5, -44], [123.2, -34.6], [133, -40.2], [152.6, -26], [118, -5], [61, 3], [-4.5, -100]];
function colocarColeccionables() {
  for (const c of [...coleccion.objetos]) quitarColeccionable(c);
  const r = azar('coleccion'), sup = barajar(r, (W.superficies || []).filter(s => s.y > .35 && s.y < 1.3)), suelo = barajar(r, SUELO), cajones = barajar(r, huecosColeccion);
  const lista = []; FOTOS.forEach((_, i) => lista.push(['foto', i])); NOTAS.forEach((_, i) => { if (i !== NOTA_BICI || !biciEnPartida) lista.push(['nota', i]); });
  for (const [tipo, i] of barajar(r, lista)) {
    const ry = r() * 6.28, q = r();
    if (q < .3 && cajones.length) { const m = cajones.pop(); crearColeccionable(tipo, i, { x: (r() - .5) * .16, y: m.g.children[0].position.y + .006, z: (r() - .5) * .1, ry, padre: m.g, contenedor: m }); continue; }
    if (q < .75 && sup.length) { const s = sup.pop(); crearColeccionable(tipo, i, { x: s.x + (r() - .5) * Math.max(0, s.w - .25), y: s.y, z: s.z + (r() - .5) * Math.max(0, s.d - .25), ry }); continue; }
    if (suelo.length) { const [x, z] = libre(...suelo.pop(), .2); crearColeccionable(tipo, i, { x, y: groundAt(x, z, 1), z, ry }); }
  }
}
// contador en la muñeca (VR: placa junto a la esfera, visible al mirar el reloj) y en PC al mantener Tab
const [cC, xC] = cv2d(256, 64), texC = toTex(cC, false);
const placa = new THREE.Mesh(new THREE.PlaneGeometry(.044, .011), new THREE.MeshBasicMaterial({ map: texC, transparent: true, toneMapped: false }));
placa.rotation.x = -Math.PI / 2; placa.position.set(0, .0468, .03); placa.visible = false;
let divC = null, ultC = '';
function pintarContador(forzar) {
  const k = run.col.foto.length + '|' + run.col.nota.length; if (!forzar && k === ultC) return; ultC = k;
  xC.clearRect(0, 0, 256, 64); xC.fillStyle = 'rgba(5,8,12,.85)'; xC.fillRect(0, 0, 256, 64); xC.font = '700 30px "Chakra Petch",sans-serif'; xC.textAlign = 'center';
  xC.fillStyle = '#ffcf6a'; xC.fillText(`▣ ${run.col.foto.length}/${FOTOS.length}`, 66, 43); xC.fillStyle = '#e9eef5'; xC.fillText(`✎ ${run.col.nota.length}/${NOTAS.length}`, 190, 43); texC.needsUpdate = true;
  if (divC) divC.textContent = `fotos ${run.col.foto.length}/${FOTOS.length} · notas ${run.col.nota.length}/${NOTAS.length}`;
}
function actualizarContador() {
  if (placa.parent !== reloj.g) reloj.g.add(placa);
  placa.visible = reloj.mirando && G.mode === 'vr';
  if (G.mode === 'pc') { if (!divC) { divC = document.createElement('div'); divC.style.cssText = 'position:fixed;right:18px;bottom:252px;width:150px;text-align:center;font:600 12px Inter,sans-serif;color:#e9eef5;background:rgba(5,8,12,.8);border-radius:8px;padding:4px 0;pointer-events:none;display:none'; document.body.appendChild(divC); pintarContador(true); } divC.style.display = reloj.mirando ? 'block' : 'none'; }
  else if (divC) divC.style.display = 'none';
}

// ---------- 3) Sucesos de calle (capítulos nocturnos) ----------
// sitios candidatos por capítulo (aceras y esquinas de la ruta); cada suceso coge uno libre
const SITIOS = {
  c1: [[8, 62], [-8, 50], [28, 72], [-18, 73.2], [7.4, 30], [-7.4, 18], [6.5, 4]],
  c2: [[-8, -96], [8, -86], [-7.5, -72], [17, -108], [-29, -111], [8, -64]],
  c3: [[7.5, -58], [-7.5, -32], [7.5, -26], [7.5, -66], [-7.8, -64], [7.4, -14]]
};
const POOL = ['superviviente', 'saqueadores', 'perro', 'cocheArdiendo', 'radioCasa', 'robotArrastra', 'bici'];
export const sucesos = { activos: [], cap: null };
let biciEnPartida = false;
let nId = 0;
const SUC = {};
// cada suceso: crear(s) al acercarse a < s.radio · actualizar(s, dt, d) · quitar(s)
SUC.superviviente = {
  radio: 32,
  crear(s) {
    s.npc = 'var_sup' + nId++; const [x, z] = s.pos; crearNpc(s.npc, { pos: [x, z], yaw: Math.random() * 6, aspecto: { ...elegir(s.r, ASPECTOS), scale: .92 } });
    const ang = s.r() * 6.28, [rx, rz] = libre(x + Math.cos(ang) * 4, z + Math.sin(ang) * 4);
    try { s.robot = spawn('r7', rx, rz, { hp: 55 }); } catch (e) { s.robot = null; }
    decir('SUPERVIVIENTE', elegir(s.r, ['¡Ayuda! ¡Que alguien me ayude!', '¡Eh! ¡Tú! ¡Me tiene acorralado!', '¡Por favor! ¡No se va!'])); s.est = 'pide'; s.t = 0;
  },
  actualizar(s, dt) {
    const a = agentes[s.npc]; if (!a) return;
    if (s.est === 'pide') { if ((s.t -= dt) <= 0) { s.t = 2.4; gesto(s.npc, 'manos', 1.6); } if (s.robot && s.robot.alive) { mirarA(a, s.robot.pos, dt); return; }
      s.est = 'gracias'; s.t = 1.2; }
    else if (s.est === 'gracias' && (s.t -= dt) <= 0) {
      s.est = 'fin'; decir('SUPERVIVIENTE', elegir(s.r, ['Gracias… Toma, es lo único que tengo.', 'Te debo una. Llévate esto.', '¡Gracias! Cógelo, a mí ya no me sirve.']));
      const p = a.root.position, item = elegir(s.r, ['venda', 'venda', 'lata', 'botiquin']); const pr = crearProp(item, p.x + .5, p.y + .9, p.z + .3, { despierto: true }); anadidos.push(pr);
      huir(s.npc, { refugio: libre(p.x + (s.r() - .5) * 30, p.z + (s.r() - .5) * 30), radio: 14 }); a.huirDe = new V3(p.x + 1, 0, p.z); a.huirT = 9;
      eventoHistoria('calle_superviviente', { salvado: true }); s.t = 10;
    } else if (s.est === 'fin' && (s.t -= dt) <= 0) s.listo = true;
  },
  quitar(s) { if (s.npc) quitarNpc(s.npc); if (s.est === 'pide') eventoHistoria('calle_superviviente', { salvado: false }); }
};
function mirarA(a, p, dt) { const q = a.root.position; a.root.rotation.y = angLerp(a.root.rotation.y, Math.atan2(p.x - q.x, p.z - q.z), dt * 4); }
// coche sencillo por código (carrocería, cabina, ruedas); quemado = negro
function cocheMalla(color, quemado) {
  const g = new THREE.Group(), m = quemado ? matC(0x151210, { roughness: 1 }) : matC(color, { metalness: .5, roughness: .4 }), cr = matC(0x0e1418, { roughness: .1, metalness: .3 }), ru = matC(0x111111);
  caja(g, 1.8, .62, 4.2, m, 0, .62, 0); caja(g, 1.62, .55, 2.1, m, 0, 1.2, -.2); caja(g, 1.64, .4, 1.9, cr, 0, 1.22, -.2);
  for (const [x, z] of [[-.85, 1.3], [.85, 1.3], [-.85, -1.35], [.85, -1.35]]) cil(g, .33, .22, ru, x, .33, z, 0, 0, Math.PI / 2, 12);
  return g;
}
SUC.saqueadores = {
  radio: 34,
  crear(s) {
    const [x, z] = s.pos; s.g = cocheMalla(elegir(s.r, [0x7a1e1e, 0x1e3a6a, 0xb8b8b0, 0x2e4a2a]), false); s.g.position.set(x, groundAt(x, z, 2), z); s.g.rotation.y = s.r() * 6.28; scene.add(s.g);
    s.npcs = [0, 1].map(k => { const id = 'var_saq' + nId++; const ang = s.g.rotation.y + (k ? 0 : Math.PI); crearNpc(id, { pos: [x + Math.sin(ang) * 1.6 + Math.cos(ang) * 1.3, z + Math.cos(ang) * 1.6 - Math.sin(ang) * 1.3], yaw: ang + Math.PI, aspecto: { camisa: [0x2a2a2e, 0x3a1a16][k], pantalon: 0x1e2024, piel: [0xc8946c, 0xe0b090][k], pelo: 0x14100c, chaleco: 0x3a1a16, barba: !k, scale: .95 } }); return id; });
    s.lineas = barajar(s.r, [['SAQUEADOR', '¡Suelta las llaves! ¡Lo vi yo primero!'], ['SAQUEADORA', '¿Tú? ¡Si no sabes ni arrancarlo!'], ['SAQUEADOR', '¡Que me lo das o te abro la cabeza!'], ['SAQUEADORA', '¡Rata dijo que el coche era para mí!'], ['SAQUEADOR', '¡Rata no manda aquí, imbécil!']]);
    s.est = 'pelea'; s.t = 0; s.k = 0;
    s.oido = escucharRuido(ev => { if (s.est === 'pelea' && /disparo|explos/.test(ev.tipo) && Math.hypot(ev.pos.x - x, ev.pos.z - z) < 30) s.huir = true; });
  },
  actualizar(s, dt, d) {
    if (s.est === 'pelea') {
      for (const id of s.npcs) { const a = agentes[id], o = agentes[s.npcs[0] === id ? s.npcs[1] : s.npcs[0]]; if (a && o) mirarA(a, o.root.position, dt); }
      if ((s.t -= dt) <= 0) { const [q, l] = s.lineas[s.k++ % s.lineas.length]; if (d < 22) decir(q, l, 2.2); gesto(s.npcs[s.k % 2], s.k % 3 ? 'manos' : 'brazos', 1.8); s.t = 2.6; }
      if (d < 9 || s.huir) {
        s.est = 'huyen'; decir('SAQUEADOR', '¡Eh! ¡Viene uno! ¡Corre!'); for (const id of s.npcs) { const a = agentes[id]; if (!a) continue; const p = a.root.position; huir(id, { refugio: libre(p.x + (p.x - s.pos[0]) * 12, p.z + (p.z - s.pos[1]) * 12), radio: 20 }); a.huirDe = playerFeet(new V3()); a.huirT = 12; }
        // se dejan lo que estaban robando
        const pr = crearProp(elegir(s.r, ['caja', 'caja', 'lata', 'venda']), s.pos[0] + 1.3, groundAt(s.pos[0], s.pos[1], 2), s.pos[1]); anadidos.push(pr);
        eventoHistoria('calle_saqueadores', { huyeron: true }); s.t = 12;
      }
    } else if ((s.t -= dt) <= 0) { for (const id of s.npcs) quitarNpc(id); s.npcs = []; }
  },
  quitar(s) { s.oido?.(); for (const id of s.npcs || []) quitarNpc(id); s.g?.removeFromParent(); }
};
// ---------- perro: si le acercas una lata, te sigue y avisa de los robots ladrando ----------
export const perro = { g: null, est: null, t: 0, ladT: 0, avisoT: 0, pasoT: 0, y: 0 };
function perroMalla() {
  const g = new THREE.Group(), m = matC(0x8a5a2a, { roughness: .95 }), o = matC(0x3a2410, { roughness: .95 });
  const cuerpo = caja(g, .26, .26, .62, m, 0, .5, 0), cab = new THREE.Group(); cab.position.set(0, .66, .36); g.add(cab);
  caja(cab, .2, .2, .22, m, 0, 0, 0); caja(cab, .13, .11, .16, o, 0, -.04, .16); caja(cab, .05, .12, .04, o, -.08, .12, -.03, 0, 0, .3); caja(cab, .05, .12, .04, o, .08, .12, -.03, 0, 0, -.3);
  const ojos = caja(cab, .14, .025, .01, new THREE.MeshBasicMaterial({ color: 0x1a1008 }), 0, .04, .112);
  const patas = [[-.09, .22], [.09, .22], [-.09, -.22], [.09, -.22]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, .4, z); g.add(p); caja(p, .07, .4, .07, m, 0, -.2, 0); return p; });
  const cola = new THREE.Group(); cola.position.set(0, .58, -.31); g.add(cola); caja(cola, .04, .04, .26, m, 0, .05, -.12, -.5);
  g.userData = { patas, cola, cab, cuerpo, ojos }; return g;
}
function ladrido(fuerte = 1) { import('../audio.js').then(({ A }) => { const c = A.ctx; if (!c) return; for (let k = 0; k < 2; k++) { const t = c.currentTime + k * .18, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(180, t + .12); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12 * fuerte, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .14); o.connect(f).connect(g).connect(A.master || c.destination); o.start(t); o.stop(t + .16); } }).catch(() => {}); }
function gemido() { import('../audio.js').then(({ A }) => { const c = A.ctx; if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1300, t + .25); o.frequency.linearRampToValueAtTime(800, t + .6); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.03, t + .05); g.gain.linearRampToValueAtTime(0, t + .6); o.connect(g).connect(A.master || c.destination); o.start(t); o.stop(t + .65); }).catch(() => {}); }
function ponerPerro(x, z, est) { if (!perro.g) { perro.g = perroMalla(); scene.add(perro.g); } perro.g.visible = true; perro.g.position.set(x, groundAt(x, z, 2), z); perro.est = est; perro.t = 0; }
SUC.perro = {
  radio: 30,
  crear(s) {
    if (run.perro) { s.listo = true; return; } // ya te sigue de antes
    const [x, z] = s.pos; ponerPerro(x, z, 'espera'); perro.g.rotation.y = s.r() * 6.28;
    // una lata cerca (la comida): si no hay ninguna a mano, aparece una tirada en la acera
    if (!props.some(p => p.tipo === 'lata' && p.estado !== 'roto' && p.root.position.distanceTo(perro.g.position) < 12)) { const [lx, lz] = libre(x + 3, z + 2, .2); anadidos.push(crearProp('lata', lx, groundAt(lx, lz, 2), lz, { v: 0xd0d4d8 })); }
  },
  actualizar(s) { if (perro.est !== 'espera') s.listo = true; },
  quitar() { if (perro.est === 'espera' && perro.g) perro.g.visible = false; }
};
function actualizarPerro(dt) {
  const g = perro.g; if (!g || !g.visible) return; if (!capOn.tierra) { g.visible = false; return; }
  const u = g.userData, pf = playerFeet(tA), p = g.position, d = Math.hypot(pf.x - p.x, pf.z - p.z); let vel = 0;
  if (perro.est === 'espera') {
    u.cola.rotation.y = Math.sin(G.time * 3) * .2; u.cab.rotation.x = Math.sin(G.time * .7) * .1;
    if ((perro.t -= dt) <= 0) { perro.t = 5 + Math.random() * 5; if (d < 18) gemido(); }
    if (d < 8) g.rotation.y = angLerp(g.rotation.y, Math.atan2(pf.x - p.x, pf.z - p.z), dt * 2);
    // comida: una lata (en la mano o en el suelo) a menos de 1,3 m de su hocico
    for (const pr of props) { if (pr.tipo !== 'lata' || pr.estado === 'roto') continue; const c = pr.root.getWorldPosition(tB); if (Math.hypot(c.x - p.x, c.z - p.z) < 1.3 && c.y < p.y + 1.4) {
      for (const m of [...pr.manos]) pr.agarre.soltar(m, false); quitarProp(pr); perro.est = 'come'; perro.t = 2.2; sfx('pickup'); run.perro = true; guardarRun();
      eventoHistoria('perro_alimentado'); decir('DAVE', 'Tranquila, bonita… ¿Trufa? Venga, conmigo.', 2.6); break; } }
  } else if (perro.est === 'come') { u.cab.rotation.x = .5 + Math.sin(G.time * 14) * .12; u.cola.rotation.y = Math.sin(G.time * 16) * .7; if ((perro.t -= dt) <= 0) { perro.est = 'sigue'; ladrido(.6); } }
  else if (perro.est === 'sigue') {
    u.cab.rotation.x = 0; const lejos = d > 2.4;
    if (d > 35) { const [x, z] = libre(pf.x - 1.5, pf.z - 1.5); p.set(x, groundAt(x, z, pf.y + .5), z); } // se quedó atrás: aparece detrás
    else if (lejos) { vel = Math.min(6, 1.6 + (d - 2.4) * 1.4); g.rotation.y = angLerp(g.rotation.y, Math.atan2(pf.x - p.x, pf.z - p.z), dt * 6); const nx = p.x + Math.sin(g.rotation.y) * vel * dt, nz = p.z + Math.cos(g.rotation.y) * vel * dt; if (!dentroDeSolido(nx, nz, p.y + .3)) { p.x = nx; p.z = nz; } p.y = groundAt(p.x, p.z, p.y + .5); }
    else g.rotation.y = angLerp(g.rotation.y, Math.atan2(pf.x - p.x, pf.z - p.z), dt * 3);
    u.cola.rotation.y = Math.sin(G.time * (vel ? 10 : 5)) * .5;
    // avisa: robot vivo a < 14 m del jugador → ladra hacia él
    perro.avisoT -= dt; let robot = null, bd = 14; for (const e of enemies) { if (!e.alive || e.humano) continue; const de = e.pos.distanceTo(pf); if (de < bd) { bd = de; robot = e; } }
    if (robot && perro.avisoT <= 0) { perro.avisoT = 6; ladrido(1); g.rotation.y = Math.atan2(robot.pos.x - p.x, robot.pos.z - p.z); eventoHistoria('perro_aviso', { dist: +bd.toFixed(1) }); }
    if (robot && perro.avisoT > 5.2) u.cab.rotation.x = -.25 + Math.sin(G.time * 30) * .08;
  }
  // patas
  perro.pasoT += dt * vel * 3.2; u.patas.forEach((q, i) => { q.rotation.x = vel ? Math.sin(perro.pasoT + (i % 2 ^ i >> 1) * Math.PI) * .6 : 0; });
}
// ---------- coche ardiendo que acaba explotando ----------
let texLlama = null;
function llama() {
  if (!texLlama) { const [c, x] = cv2d(64, 128); const gr = x.createRadialGradient(32, 96, 2, 32, 80, 60); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(.3, 'rgba(255,150,40,.85)'); gr.addColorStop(.7, 'rgba(200,50,10,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(32, 0); x.quadraticCurveTo(64, 70, 50, 128); x.lineTo(14, 128); x.quadraticCurveTo(0, 70, 32, 0); x.fill(); texLlama = toTex(c, false); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLlama, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); s.center.set(.5, 0); return s;
}
SUC.cocheArdiendo = {
  radio: 55,
  crear(s) {
    const [x, z] = s.pos; s.g = cocheMalla(0, true); s.g.position.set(x, groundAt(x, z, 2), z); s.g.rotation.y = s.r() * 6.28; scene.add(s.g);
    s.llamas = [[0, 1.3, -.2, 1.6], [.4, .9, 1.4, 1.1], [-.5, .9, -1.5, 1]].map(([lx, ly, lz, k]) => { const l = llama(); l.position.set(lx, ly, lz); l.userData.k = k; l.scale.set(.9 * k, 1.6 * k, 1); s.g.add(l); return l; });
    s.luz = fuenteLuz(x, 1.6, z, 0xff7a2a, 26, 12, 'fuego'); s.est = 'arde'; s.t = 6 + s.r() * 5;
  },
  actualizar(s, dt, d) {
    const k = s.est === 'arde' ? 1 : 1.8;
    for (const l of s.llamas) { const f = l.userData.k * k * (.85 + .2 * Math.sin(G.time * 13 + l.position.x * 7) + Math.random() * .1); l.scale.set(.9 * f, 1.6 * f, 1); }
    if (s.est === 'arde' && d < 12) { s.t -= dt; if (s.t < 2.5 && Math.random() < dt * 6) { sfx('chispas', { pos: s.g.position }); emitirRuido(s.g.position, 6, 'chasquido', 'mundo'); } // avisa: chasquidos
      if (s.t <= 0) { s.est = 'explotado'; const p = s.g.position; try { const b = crearProp('bombona', p.x, p.y + .4, p.z); b.romper(); } catch (e) { sfx('boom', { pos: p }); }
        s.g.position.y += .25; s.g.rotation.z = (s.r() - .5) * .4; s.luz.i = 60; setTimeout(() => { if (s.luz) s.luz.i = 30; }, 600); eventoHistoria('coche_explota', { dist: +d.toFixed(1) }); } }
  },
  quitar(s) { s.g?.removeFromParent(); if (s.luz) s.luz.on = false; }
};
// ---------- radio que suena dentro de una casa ----------
const EMISION = [['RADIO', '…repetimos: Lázaro Systems informa de que las unidades R-7 están siendo «recalibradas». Permanezcan en sus casas.'], ['RADIO', 'Si tiene un chip M-7 de cortesía, no se lo quite. Repetimos: no se lo quite. Un equipo pasará a recogerlo.'], ['RADIO', '…a cualquiera que oiga esto: el polideportivo ya no es seguro. No vayáis. No vay—'], ['RADIO', '…Lázaro Systems. Cuidamos de lo que más quieres. Para siempre.']];
SUC.radioCasa = {
  radio: 26,
  crear(s) {
    // la fachada más cercana: la radio suena «dentro», pegada a la pared
    let best = null, bd = 18; for (const c of colliders) { if (c.top < 3 || c.cap !== 'tierra' || c.x1 - c.x0 < 3 || c.z1 - c.z0 < 3) continue; const px = clamp(s.pos[0], c.x0, c.x1), pz = clamp(s.pos[1], c.z0, c.z1), dd = Math.hypot(px - s.pos[0], pz - s.pos[1]); if (dd < bd) { bd = dd; best = [px, pz]; } }
    s.p = new V3(...(best ? [best[0], 1.6, best[1]] : [s.pos[0], 1.6, s.pos[1]]));
    s.radio = new Radio(); s.radio.pos.copy(s.p); s.radio.sintonizar(3); s.luz = fuenteLuz(s.p.x, 2, s.p.z, 0xffcf90, 8, 5, 'parpadeo', true); s.i = 0; s.t = 0; s.oido = false;
  },
  actualizar(s, dt, d) {
    s.radio.actualizar(s.p);
    if (d < 7 && !s.oido) { s.oido = true; eventoHistoria('radio_casa'); }
    if (s.oido && d < 12 && (s.t -= dt) <= 0) { const [q, l] = EMISION[s.i % EMISION.length]; if (decir(q, l, 4.5)) { s.i++; s.t = 6; } }
  },
  quitar(s) { s.radio?.parar(); if (s.luz) s.luz.on = false; }
};
// ---------- un robot que arrastra un cuerpo (si te acercas, lo suelta y va a por ti) ----------
SUC.robotArrastra = {
  radio: 40,
  crear(s) {
    const [x, z] = s.pos, ang = s.r() * 6.28; s.R = makeRobot({ ...PAL.r7 }); s.R.root.position.set(x, groundAt(x, z, 2), z); s.R.root.rotation.y = ang; scene.add(s.R.root); animRig(s.R, 1, { spd: 0 });
    s.R.root.traverse(m => { if (m.isMesh) m.userData.enemy = null; });
    s.cuerpo = makeHuman({ ...elegir(s.r, ASPECTOS), scale: .92 }); s.cuerpo.root.position.set(0, .12, 2.2); s.cuerpo.root.rotation.x = -Math.PI / 2; s.R.root.add(s.cuerpo.root); animRig(s.cuerpo, 1, { spd: 0 });
    s.cuerpo.root.traverse(m => { if (m.isMesh) m.userData.enemy = null; });
    s.dest = libre(x - Math.sin(ang) * 18, z - Math.cos(ang) * 18); s.est = 'arrastra';
    s.oido = escucharRuido(ev => { if (/disparo|explos/.test(ev.tipo) && s.R && ev.pos && Math.hypot(ev.pos.x - s.R.root.position.x, ev.pos.z - s.R.root.position.z) < 25) s.alerta = true; });
  },
  actualizar(s, dt, d) {
    if (s.est !== 'arrastra') return; const R = s.R, p = R.root.position;
    const dx = s.dest[0] - p.x, dz = s.dest[1] - p.z, dd = Math.hypot(dx, dz);
    // anda de espaldas hacia el destino, mirando al cuerpo
    R.root.rotation.y = angLerp(R.root.rotation.y, Math.atan2(-dx, -dz), dt * 2); const v = .55;
    p.x -= Math.sin(R.root.rotation.y) * v * dt; p.z -= Math.cos(R.root.rotation.y) * v * dt; p.y = groundAt(p.x, p.z, p.y + .5);
    animRig(R, dt, { spd: -v }); s.cuerpo.root.rotation.z = Math.sin(G.time * 2.2) * .04;
    if (d < 12 || s.alerta) { // lo suelta y se convierte en enemigo de verdad
      s.est = 'enemigo'; const pos = p.clone(), yaw = R.root.rotation.y; s.cuerpo.root.getWorldPosition(tB); const cq = s.cuerpo.root.getWorldQuaternion(new THREE.Quaternion());
      scene.attach(s.cuerpo.root); s.cuerpo.root.position.copy(tB); s.cuerpo.root.quaternion.copy(cq); s.R.root.removeFromParent();
      try { const e = spawn('r7', pos.x, pos.z, { hp: 70 }); e.R.root.rotation.y = yaw; } catch (e) {}
      eventoHistoria('robot_arrastra', { interrumpido: true });
    } else if (dd < .6) { s.est = 'fin'; s.R.root.removeFromParent(); s.cuerpo.root.removeFromParent(); eventoHistoria('robot_arrastra', { interrumpido: false }); }
  },
  quitar(s) { s.oido?.(); s.R?.root.removeFromParent(); s.cuerpo?.root.removeFromParent(); }
};
// ---------- bici de un crío con una nota ----------
SUC.bici = {
  radio: 30,
  crear(s) {
    const [x, z] = s.pos, g = new THREE.Group(), m = matC(0x2a6ac0, { metalness: .5, roughness: .4 }), ru = matC(0x111111), cr = matC(0xb8bcc2, { metalness: .9, roughness: .3 });
    for (const zz of [-.42, .42]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.26, .025, 6, 18), ru); r.position.set(0, .28, zz); r.rotation.y = Math.PI / 2; g.add(r); }
    cil(g, .016, .7, m, 0, .45, 0, Math.PI / 2 - .3); cil(g, .016, .55, m, 0, .4, .2, -.5); cil(g, .016, .45, m, 0, .45, -.25, .6); cil(g, .014, .4, cr, 0, .72, .38, 0, 0, Math.PI / 2); caja(g, .1, .04, .22, matC(0x111111), 0, .7, -.22);
    g.rotation.set(0, s.r() * 6.28, Math.PI / 2 - .15, 'YXZ'); g.position.set(x, groundAt(x, z, 2) + .03, z); scene.add(g); s.g = g;
    s.nota = crearColeccionable('nota', NOTA_BICI, { x: x + .6, y: groundAt(x, z, 2), z: z + .3, ry: s.r() * 6 });
  },
  actualizar(s) { if (!s.nota || s.nota.cogido) s.listo = true; },
  quitar(s) { s.g?.removeFromParent(); }
};
// reparto por capítulo: 2-3 sucesos distintos (la bici como mucho una vez por partida)
function planCapitulo(cap) {
  const r = azar('sucesos:' + cap), sitios = barajar(r, SITIOS[cap] || []); if (!sitios.length) return [];
  const n = Math.min(sitios.length, 2 + (r() < .5 ? 1 : 0)), pool = barajar(r, POOL).filter(t => t !== 'bici' || biciCap === cap);
  return pool.slice(0, n).map((tipo, i) => ({ tipo, pos: libre(...sitios[i]), r: azar('suceso:' + cap + ':' + tipo), creado: false, listo: false }));
}
let biciCap = null; // capítulo donde sale la bici en esta partida (o ninguno)
function decidirBici() { const r = azar('bici'); biciCap = r() < .75 ? elegir(r, Object.keys(SITIOS)) : null; biciEnPartida = !!biciCap && !run.col.nota.includes(NOTA_BICI); }
function empezarSucesos(cap) {
  terminarSucesos(); sucesos.cap = cap; sucesos.activos = planCapitulo(cap);
}
function terminarSucesos() { for (const s of sucesos.activos) if (s.creado) try { SUC[s.tipo].quitar(s); } catch (e) {} sucesos.activos = []; }
function actualizarSucesos(dt) {
  for (const s of sucesos.activos) {
    if (s.listo && !s.creado) continue; const d = distJ(s.pos[0], s.pos[1]), def = SUC[s.tipo];
    if (!s.creado) { if (d < def.radio && !G.enDialogo) { s.creado = true; try { def.crear(s); } catch (e) { console.warn('[variabilidad] suceso', s.tipo, e); s.listo = true; } } continue; }
    if (!s.listo || s.tipo === 'cocheArdiendo' || s.tipo === 'radioCasa') try { def.actualizar(s, dt, d); } catch (e) { console.warn('[variabilidad] suceso', s.tipo, e); s.listo = true; }
  }
}

// ---------- 4) Patrullas: variantes de ronda ----------
const variados = new WeakSet();
function variarRuta(ruta, r) {
  const n = ruta.map(([x, z]) => { const nx = x + (r() - .5) * 2.4, nz = z + (r() - .5) * 2.4; return dentroDeSolido(nx, nz, .5) ? [x, z] : [nx, nz]; });
  if (r() < .45) n.reverse(); return n;
}
function variarPatrullas() {
  const capId = D?.cap?.id || 'x';
  guardias.forEach((g, i) => { if (variados.has(g)) return; variados.add(g); const r = azar('guardia:' + capId + ':' + i);
    if (g.ruta?.length > 1) { const ini = g.ruta[0]; g.ruta = variarRuta(g.ruta, r); g.ruta[0] = ini; } // el primer punto es donde ya está
    g.vel *= .85 + r() * .35; g.pausaMax *= .7 + r() * .8; });
  enemies.forEach((e, i) => { if (variados.has(e) || !e.ruta || e.ruta.length < 2) return; variados.add(e); const r = azar('patrulla:' + capId + ':' + i); const ini = e.ruta[0]; e.ruta = variarRuta(e.ruta, r); e.ruta[0] = ini; });
}

// ---------- 5) Clima: variación pequeña alrededor de lo que pide el guion ----------
const clima = { base: null, mio: null, t: 20 };
function actualizarClima(dt) {
  const S = ATM?.estado; if (!S || !capOn.tierra) return;
  // si el guion ha cambiado el objetivo (no fuimos nosotros), esa es la nueva base
  if (clima.mio == null || Math.abs(S.lluviaObj - clima.mio.l) > 1e-4 || Math.abs(S.vientoObj - clima.mio.v) > 1e-4) clima.base = { l: S.lluviaObj, v: S.vientoObj, n: S.nieblaObj };
  if ((clima.t -= dt) > 0) return; const r = Math.random; clima.t = 35 + r() * 50;
  const b = clima.base; S.lluviaObj = b.l > .05 ? clamp(b.l + (r() - .5) * .3, .05, 1) : b.l; // no llueve si el guion no lo pide
  S.vientoObj = clamp(b.v + (r() - .5) * .24, .1, 1); if (r() < .3) S.racha = Math.max(S.racha || 0, .6 + r() * .4);
  clima.mio = { l: S.lluviaObj, v: S.vientoObj };
}

// ---------- 6) Vecinos en las ventanas (siluetas que se esconden si las miras) ----------
let texSil = null;
function silueta() {
  if (!texSil) { const [c, x] = cv2d(64, 96); x.fillStyle = '#000'; x.beginPath(); x.arc(32, 30, 14, 0, 7); x.fill(); x.beginPath(); x.moveTo(6, 96); x.quadraticCurveTo(8, 52, 32, 50); x.quadraticCurveTo(56, 52, 58, 96); x.fill(); texSil = toTex(c, false); }
  return texSil;
}
const vecinos = [];
function ponerVecinos() {
  for (const v of vecinos) v.g.removeFromParent(); vecinos.length = 0;
  const r = azar('vecinos:' + (D?.capIdx ?? 0)), cand = [];
  for (const c of colliders) { if (c.top < 5 || c.top > 16 || c.cap !== 'tierra' || c.x1 - c.x0 < 4 || c.z1 - c.z0 < 4) continue; const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2; if (Math.abs(cx) > 80 || cz < -120 || cz > 100) continue; cand.push(c); }
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: .55, toneMapped: false, depthWrite: false });
  for (const c of barajar(r, cand).slice(0, 5)) {
    const g = new THREE.Group(), cz = c.z0 + (c.z1 - c.z0) * (.25 + r() * .5), este = Math.abs(c.x1) < Math.abs(c.x0), x = este ? c.x1 + .04 : c.x0 - .04, y = Math.min(c.top - 1.3, 3.6 + r() * .8);
    g.position.set(x, y, cz); g.rotation.y = este ? Math.PI / 2 : -Math.PI / 2;
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.1), glowM); g.add(vent);
    const sil = new THREE.Mesh(new THREE.PlaneGeometry(.5, .75), new THREE.MeshBasicMaterial({ map: silueta(), transparent: true, depthWrite: false, toneMapped: false })); sil.position.set((r() - .5) * .3, -.17, .01); g.add(sil);
    scene.add(g); vecinos.push({ g, sil, vent, y0: sil.position.y, est: 'mira', t: 0, mirada: 0 });
  }
}
function actualizarVecinos(dt) {
  if (!vecinos.length) return; const on = capOn.tierra, cab = playerHead(tA); camera.getWorldDirection(tB);
  for (const v of vecinos) {
    v.g.visible = on; if (!on) continue;
    const d = v.g.position.distanceTo(cab);
    if (v.est === 'mira') {
      // mirada del jugador: ángulo entre la vista y la ventana
      tC.subVectors(v.g.position, cab).normalize();
      v.mirada = d < 22 && tC.dot(tB) > .93 ? v.mirada + dt : Math.max(0, v.mirada - dt);
      if (v.mirada > 1.1) { v.est = 'baja'; v.t = 0; eventoHistoria('vecino_ventana', { dist: +d.toFixed(1) }); }
    } else if (v.est === 'baja') { v.t += dt; v.sil.position.y = v.y0 - v.t * 1.4; v.sil.material.opacity = Math.max(0, 1 - v.t * 1.6); if (v.t > .7) { v.est = 'fuera'; v.vent.material = v.vent.material.clone(); v.vent.material.opacity = .12; } }
  }
}

// ---------- Capítulos y partida ----------
const ultimo = { cap: -2 };
function alCambiarCapitulo(i) {
  if (i === 0 && ultimo.cap !== 0) rehacerPartida(); // empezar el prólogo = partida nueva
  ultimo.cap = i; const cap = D?.cap;
  terminarSucesos();
  if (cap && !cap.espacio && SITIOS[cap.id] && cap.hora === 'noche') empezarSucesos(cap.id);
  try { if (cap && !cap.espacio) ponerVecinos(); else for (const v of vecinos) v.g.visible = false; } catch (e) { console.warn('[variabilidad] vecinos', e); }
  // el perro que ya te sigue aparece contigo en la Tierra
  if (run.perro && cap && !cap.espacio && cap.id !== 'p') { const pf = playerFeet(tA), [x, z] = libre(pf.x - 1.6, pf.z - 1.2); ponerPerro(x, z, 'sigue'); }
  else if (perro.g && (!run.perro || cap?.espacio)) perro.g.visible = false;
}
export function rehacerPartida() {
  nuevaSemilla(); for (const p of anadidos.splice(0)) if (p.estado !== 'roto') quitarProp(p);
  huecosColeccion.length = 0; botin(); decidirBici(); colocarColeccionables(); pintarContador(true);
  if (perro.g) perro.g.visible = false; perro.est = null;
}
export function construirVariabilidad() {
  cargarRun(); botin(); decidirBici(); colocarColeccionables(); pintarContador(true);
}
let patT = 0;
export function actualizarVariabilidad(dt) {
  if (D && D.capIdx !== ultimo.cap && !D.pausa) alCambiarCapitulo(D.capIdx);
  actualizarSub(dt); actualizarContador();
  if (!capOn.tierra) { if (perro.g) perro.g.visible = false; return; }
  actualizarSucesos(dt); actualizarPerro(dt); actualizarVecinos(dt); actualizarClima(dt);
  if ((patT -= dt) <= 0) { patT = .5; variarPatrullas(); }
}
// consola: __juego.variabilidad.forzar('perro') pone un suceso a 6 m delante del jugador
export const variabilidad = {
  run, azar, sucesos, coleccion, perro, vecinos, FOTOS, NOTAS,
  rehacer: rehacerPartida,
  forzar(tipo) { const pf = playerFeet(new V3()); const s = { tipo, pos: libre(pf.x + 6, pf.z), r: azar('forzado:' + tipo + G.time), creado: true, listo: false }; SUC[tipo].crear(s); sucesos.activos.push(s); return s; },
  coger(i = 0) { const c = coleccion.objetos.filter(o => o.activo())[i]; if (c) coger(c); return c?.label; },
  estado: () => ({ semilla: run.semilla, sucesos: sucesos.activos.map(s => s.tipo + (s.creado ? '*' : '') + (s.listo ? '✓' : '')), coleccionables: coleccion.objetos.length, fotos: run.col.foto.length, notas: run.col.nota.length, perro: perro.est, anadidos: anadidos.length, vecinos: vecinos.length, bici: biciCap })
};
