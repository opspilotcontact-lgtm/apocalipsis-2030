// Minijuegos diegéticos, opcionales y cortos (docs/eventos.md · «Sistemas de juego · Minijuegos»):
//   · Galería de tiro detrás de la tienda de Hank: botellas y latas sobre un tablón; campana = ronda de 40 s.
//     Las balas de práctica «corren de su cuenta»: al acabar se devuelven (la escasez del capítulo no cambia).
//   · Dardos junto a la entrada de la casa de Dave: dardos físicos (VR: velocidad real de la mano) y diana de verdad.
//   · Piano de casa: «la canción de Lucía» (partitura en el atril y la tecla siguiente marcada) → recuerdo y afecto.
//   · HORSE con el chaval de la cancha (encima de actividades.js, sin tocarlo: usa la pelota y el marcador que ya hay).
//   · Puerta de servicio de la valla oeste de la base: caja de alarma con tres cables (ruta alternativa).
//   · Emisoras ocultas en el dial de las radios: anuncios de Lázaro, la entrevista de Mike y una estación de números.
// Eventos: galeria_inicio · galeria_fin · dardos_ronda · piano_melodia · horse_fin · valla_cortada · valla_alarma · radio_oculta
import { THREE, V3, G, M, scene, camera, capOn, colliders, groundAt, pieza, cv2d, toTex, fuenteLuz, clamp } from '../nucleo.js';
import { crearProp, quitarProp, props, registrar, quitarCuerpo } from '../interaccion/objetos.js';
import { TIPOS } from '../interaccion/catalogo.js';
import { pianos } from '../interaccion/instrumentos.js';
import { EMISORAS, chirrido, clic as sonClic } from '../interaccion/sonido.js';
import { cuerpoFijo, alListo } from '../interaccion/fisica-adaptador.js';
import { eventoHistoria, emitirRuido } from '../interaccion/ruido.js';
import { reloj } from '../interaccion/reloj.js';
import { sfx } from '../fx.js';
import { say } from '../ui.js';
import { P, playerFeet } from '../jugador.js';
import { npcs } from '../npcs.js';
import { actividades, CANASTA } from './actividades.js';
import { run, guardarRun, azar, elegir, barajar, decir } from './variabilidad.js';

let MEM = null; import('../personajes/memoria.js').then(m => { MEM = m.memoria; }).catch(() => {});
const tA = new V3(), tB = new V3(), tC = new V3(), tQ = new THREE.Quaternion(), Z = new V3(0, 0, -1);
const X = Math.PI / 2;
const matC = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .75, ...o });
function caja(g, w, h, d, m, x, y, z, ry = 0) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.rotation.y = ry; me.castShadow = me.receiveShadow = true; g.add(me); return me; }
const FIJO = { abierto: () => true }; // «contenedor» para lo que queda clavado o en su bandeja (sin cuerpo hasta que se coge)
// botón diegético: PC = E o clic mirándolo · VR = grip sobre él (no se coge: se acciona)
function boton(label, malla, fn, radio = .12) {
  const o = { label, root: malla, mallas: [malla], activo: () => capOn.tierra && malla.visible, centro: out => malla.getWorldPosition(out),
    agarre: { dist: p => malla.getWorldPosition(tA).distanceTo(p) - radio, agarrar: () => { fn(); return false; }, seguir() {}, soltar() {} },
    pulsarE() { fn(); return true; }, clic(d) { if (d) fn(); return true; } };
  registrar(o); return o;
}
function panel(w, h, px = 256) { const [c, x] = cv2d(px, Math.round(px * h / w)); const tex = toTex(c, false); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); return { m, c, x, tex }; }
const hankCerca = r => { const h = npcs.hank; if (!h?.root?.visible) return false; const pf = playerFeet(tA); return h.root.position.distanceTo(tB.set(pf.x, h.root.position.y, pf.z)) < r; };

// ---------- 1) Galería de tiro (detrás de la tienda de Hank) ----------
export const GALERIA = { x: -31.5, z: -50, tirador: [-24.5, -50] };
const GAL = { g: null, dianas: [], ronda: null, cartel: null, mejor: 0 };
function construirGaleria() {
  const g = new THREE.Group(), y0 = groundAt(GALERIA.x, GALERIA.z, 2), mad = matC(0x6a4a2a), osc = matC(0x3a2a18);
  g.position.set(GALERIA.x, y0, GALERIA.z); scene.add(g); GAL.g = g;
  // dos bidones y un tablón; detrás, un parapeto de sacos (de atrezo)
  for (const z of [-1.9, 1.9]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.29, .29, .88, 14), matC(0x3a5a3a, { metalness: .5, roughness: .5 })); b.position.set(0, .44, z); b.castShadow = true; g.add(b); }
  caja(g, .32, .05, 4.4, mad, 0, .905, 0);
  for (let i = 0; i < 6; i++) caja(g, .5, .32, .9, matC(0xb8a47a, { roughness: 1 }), -1.6, .16 + Math.floor(i / 3) * .32, -1 + (i % 3) * 1);
  // marca de tiro en el suelo y la campana de Hank en un poste
  const marca = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .08), new THREE.MeshBasicMaterial({ color: 0xe8d040, toneMapped: false })); marca.rotation.set(-X, 0, X); marca.position.set(GALERIA.tirador[0] - GALERIA.x, .015, 0); g.add(marca);
  const poste = caja(g, .08, 1.5, .08, osc, GALERIA.tirador[0] - GALERIA.x, .75, 1.2);
  const campana = new THREE.Mesh(new THREE.CylinderGeometry(.04, .09, .12, 12, 1, true), matC(0xc8a040, { metalness: .9, roughness: .3, side: THREE.DoubleSide })); campana.position.set(GALERIA.tirador[0] - GALERIA.x, 1.42, 1.32); g.add(campana);
  boton('campana (galería de tiro)', campana, empezarGaleria);
  const cartel = panel(.9, .45); cartel.m.position.set(GALERIA.tirador[0] - GALERIA.x, 1.95, 1.2); cartel.m.rotation.y = -X; g.add(cartel.m); GAL.cartel = cartel; pintarGaleria();
  alListo(() => { g.updateMatrixWorld(true); const c = g.localToWorld(new V3(0, .905, 0)); cuerpoFijo([{ f: 'caja', m: [.16, .025, 2.2], c: [c.x, c.y, c.z] }, ...[-1.9, 1.9].map(z => { const p = g.localToWorld(new V3(0, .44, z)); return { f: 'cil', r: .29, h: .88, c: [p.x, p.y, p.z] }; })]); });
  ponerDianas();
}
function ponerDianas() {
  for (const d of GAL.dianas) if (d.pr.estado !== 'roto') quitarProp(d.pr); GAL.dianas = [];
  const y = GAL.g.position.y + .93;
  [-1.7, -1.05, -.4, .3, .95, 1.65].forEach((z, i) => { const pr = crearProp(i % 2 ? 'lata' : 'botella', GALERIA.x, y, GALERIA.z + z, { ry: Math.random() * 6 }); GAL.dianas.push({ pr, p0: pr.root.position.clone(), caida: false }); });
}
function pintarGaleria() {
  const { x, tex } = GAL.cartel, r = GAL.ronda; x.fillStyle = '#2a1e12'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#c8a040'; x.lineWidth = 4; x.strokeRect(4, 4, 248, 120); x.textAlign = 'center'; x.fillStyle = '#ffcf6a';
  x.font = '700 20px "Chakra Petch",sans-serif'; x.fillText('GALERÍA DE HANK', 128, 30);
  x.font = '700 40px "Chakra Petch",sans-serif'; x.fillStyle = '#fff'; x.fillText(r ? `${r.puntos}  ·  ${Math.ceil(r.t)}s` : `récord ${GAL.mejor}`, 128, 80);
  x.font = '500 14px Inter,sans-serif'; x.fillStyle = '#c8b898'; x.fillText(r ? 'botellas y latas al suelo' : 'toca la campana', 128, 110); tex.needsUpdate = true;
}
function empezarGaleria() {
  if (GAL.ronda) return; ponerDianas(); sfx('objetivo'); sonClic(GAL.g.position);
  GAL.ronda = { t: 40, puntos: 0, ammo: { ...P.ammo }, carg: JSON.stringify(P.cargadores || {}), pintado: '' };
  if (hankCerca(25)) decir('HANK', 'A ver esa puntería. Las balas de práctica las pago yo… por esta vez.');
  else decir('DAVE', 'Botellas y latas. Cuarenta segundos.', 2);
  eventoHistoria('galeria_inicio');
}
function actualizarGaleria(dt) {
  if (!GAL.g) return; const r = GAL.ronda;
  for (const d of GAL.dianas) { if (d.caida) continue; const p = d.pr.root.position; if (d.pr.estado === 'roto' || d.p0.y - p.y > .25 || Math.hypot(p.x - d.p0.x, p.z - d.p0.z) > .35) { d.caida = true; if (r) { r.puntos++; sfx('blip'); } } }
  if (!r) return;
  r.t -= dt; if (GAL.dianas.every(d => d.caida)) { r.limpio = Math.max(0, Math.round(r.t)); r.t = 0; }
  const k = r.puntos + '|' + Math.ceil(r.t); if (k !== r.pintado) { r.pintado = k; pintarGaleria(); }
  if (r.t > 0) return;
  // fin: puntos (+ bonus por tiempo si las tumbaste todas) y se devuelven las balas gastadas
  GAL.ronda = null; const pts = r.puntos + Math.floor((r.limpio || 0) / 5); // bonus: 1 punto por cada 5 s que sobren
  Object.assign(P.ammo, r.ammo); try { P.cargadores = JSON.parse(r.carg); } catch (e) {}
  GAL.mejor = Math.max(GAL.mejor, pts); run.minijuegos.galeria = GAL.mejor; guardarRun(); pintarGaleria(); sfx('objetivo');
  const linea = pts >= 6 ? '¡Todas! Así se hace, chico. Dave… ¿dónde aprendiste eso?' : pts >= 4 ? 'No está mal. Con eso no te comes un robot, pero no está mal.' : pts >= 1 ? 'Bueno… al menos no le has dado a mi camión.' : '¿Cero? Mejor ve con la piedra.';
  if (hankCerca(25)) decir('HANK', linea, 3.4); else say(`Galería · ${pts} de 6`);
  eventoHistoria('galeria_fin', { puntos: pts, total: 6, limpio: !!r.limpio });
}

// ---------- 2) Dardos (entrada de la casa de Dave) ----------
export const DIANA = { x: 13.0, y: 1.73, z: 82.6, ry: -Math.PI / 2 }; // delante de la fachada oeste (separada: los dardos clavados no tocan la pared), mira a −X; raya en x ≈ 10,6
const SECT = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const DAR = { g: null, dardos: [], ronda: { lanzados: [], puntos: 0, t: 0 }, cartel: null, mejor: 0, bandeja: [] };
const cilG = (r, h, s = 8, r2 = r) => new THREE.CylinderGeometry(r, r2, h, s);
TIPOS.dardo ||= { label: 'dardo', mat: 'metal', masa: .025, apoyo: .006, herramienta: true, punta: [0, 0, -.13], var: [0xc81a1a, 0x1a3cc8, 0x1a8a3a],
  mallas: v => [{ mat: 'metal', piezas: [[cilG(.0035, .06), 0xb8bcc2, [0, 0, -.07], [X, 0, 0]], [cilG(.0008, .035, 4, .003), 0xd8d8d8, [0, 0, -.115], [X, 0, 0]]] },
    { mat: 'base', piezas: [[cilG(.0042, .05), 0x1a1a1a, [0, 0, -.015], [X, 0, 0]], [new THREE.BoxGeometry(.03, .0015, .04), v, [0, 0, .03]], [new THREE.BoxGeometry(.0015, .03, .04), v, [0, 0, .03]]] }],
  col: [{ f: 'caja', m: [.006, .006, .07], c: [0, 0, -.05] }] };
function texDiana() {
  const [c, x] = cv2d(512, 512), C = 256, R = 230, k = R / .17; // .17 m = doble exterior
  x.fillStyle = '#121212'; x.beginPath(); x.arc(C, C, 255, 0, 7); x.fill();
  const anillo = (r0, r1, cols) => { for (let i = 0; i < 20; i++) { const a0 = (i * 18 - 99) * Math.PI / 180, a1 = a0 + Math.PI / 10; x.fillStyle = cols[i % 2]; x.beginPath(); x.arc(C, C, r1 * k, a0, a1); x.arc(C, C, r0 * k, a1, a0, true); x.closePath(); x.fill(); } };
  anillo(.016, .162, ['#151515', '#efe2c0']); anillo(.162, .17, ['#c81e1e', '#1a7a3a']); anillo(.099, .107, ['#c81e1e', '#1a7a3a']);
  x.fillStyle = '#1a7a3a'; x.beginPath(); x.arc(C, C, .016 * k, 0, 7); x.fill(); x.fillStyle = '#c81e1e'; x.beginPath(); x.arc(C, C, .0064 * k, 0, 7); x.fill();
  x.fillStyle = '#eee'; x.font = '700 22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  SECT.forEach((n, i) => { const a = (i * 18 - 90) * Math.PI / 180; x.fillText(String(n), C + Math.cos(a) * 243, C + Math.sin(a) * 243); });
  return toTex(c, false);
}
function construirDardos() {
  const g = new THREE.Group(); g.position.set(DIANA.x, groundAt(DIANA.x, DIANA.z, 2), DIANA.z); g.rotation.y = DIANA.ry; scene.add(g); DAR.g = g;
  const mad = matC(0x5a3e28);
  caja(g, .08, 2.2, .08, mad, -.42, 1.1, -.06); caja(g, .08, 2.2, .08, mad, .42, 1.1, -.06); caja(g, .95, .95, .03, matC(0x3a2a1a), 0, DIANA.y, -.035);
  const cara = new THREE.Mesh(new THREE.CircleGeometry(.225, 40), new THREE.MeshStandardMaterial({ map: texDiana(), roughness: .95 })); cara.position.set(0, DIANA.y, .001); g.add(cara);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(.226, .01, 6, 40), matC(0x8a8e94, { metalness: .8, roughness: .3 })); aro.position.set(0, DIANA.y, .004); g.add(aro);
  // bandeja con los tres dardos y una pizarra con la puntuación
  caja(g, .5, .03, .14, mad, 0, 1.0, .07);
  DAR.bandeja = [-.12, 0, .12].map(lx => new V3(lx, 1.03, .07));
  const cartel = panel(.5, .3); cartel.m.position.set(.75, 1.55, 0); g.add(cartel.m); DAR.cartel = cartel; pintarDardos();
  // raya de tiro a 2,37 m
  const raya = new THREE.Mesh(new THREE.PlaneGeometry(.8, .05), new THREE.MeshBasicMaterial({ color: 0xe8e8e2, toneMapped: false })); raya.rotation.x = -X; raya.position.set(0, .015, 2.37); g.add(raya);
  alListo(() => { g.updateMatrixWorld(true); const c = g.localToWorld(new V3(0, 1.0, .07)); cuerpoFijo([{ f: 'caja', m: [.25, .015, .07], c: [c.x, c.y, c.z], ry: g.rotation.y }]); });
  recogerDardos();
}
function recogerDardos() {
  for (const d of DAR.dardos) if (d.estado !== 'roto' && d.estado !== 'sostenido') quitarProp(d);
  const quedan = DAR.dardos.filter(d => d.estado === 'sostenido'); DAR.dardos = [...quedan];
  const cols = TIPOS.dardo.var;
  for (let i = quedan.length; i < 3; i++) { const p = DAR.g.localToWorld(DAR.bandeja[i].clone()); const pr = crearProp('dardo', p.x, p.y, p.z, { v: cols[i], contenedor: FIJO, ry: DAR.g.rotation.y + Math.PI / 2 }); pr.root.position.set(p.x, p.y, p.z); DAR.dardos.push(pr); }
  DAR.ronda = { lanzados: [], puntos: 0, t: 0, marcas: [] }; pintarDardos();
}
function pintarDardos() {
  const { x, tex } = DAR.cartel, r = DAR.ronda; x.fillStyle = '#1e2a22'; x.fillRect(0, 0, 256, 154); x.textAlign = 'center'; x.fillStyle = '#e8e8e2';
  x.font = '600 18px "Chakra Petch",sans-serif'; x.fillText('DARDOS', 128, 26);
  x.font = '700 22px "Chakra Petch",sans-serif'; x.fillText((r.marcas || []).map(m => m).join('  +  ') || '—', 128, 66);
  x.font = '700 38px "Chakra Petch",sans-serif'; x.fillStyle = '#ffcf6a'; x.fillText(String(r.puntos), 128, 112);
  x.font = '500 13px Inter,sans-serif'; x.fillStyle = '#9ab0a0'; x.fillText(`récord ${DAR.mejor} · 3 dardos`, 128, 142); tex.needsUpdate = true;
}
function puntuar(lx, ly) {
  const r = Math.hypot(lx, ly); if (r > .17) return [0, 'fuera'];
  if (r < .0064) return [50, 'DIANA']; if (r < .016) return [25, '25'];
  let a = Math.atan2(lx, ly) * 180 / Math.PI; a = (a + 360 + 9) % 360; const n = SECT[Math.floor(a / 18) % 20];
  if (r > .162) return [n * 2, 'D' + n]; if (r > .099 && r < .107) return [n * 3, 'T' + n]; return [n, String(n)];
}
function clavar(pr, local, dir) {
  quitarCuerpo(pr); for (const m of [...pr.manos]) pr.agarre.soltar(m, false);
  pr.estado = 'guardado'; pr.contenedor = FIJO; DAR.g.localToWorld(tA.copy(local)); pr.root.position.copy(tA).addScaledVector(dir, -.02 + Math.random() * .015);
  pr.root.quaternion.setFromUnitVectors(Z, dir); sfx('stone', { pos: tA }); emitirRuido(tA, 2, 'impacto');
}
// PC: el dardo sale de la mano (abajo a la derecha); se corrige para que vaya a donde apunta la mira (con su caída)
function asistirPC(pr) {
  if (G.mode !== 'pc' || !pr.body) return; const v = pr.body.linvel(), sp = Math.hypot(v.x, v.y, v.z); if (sp < 3) return;
  camera.getWorldPosition(tA); camera.getWorldDirection(tB); const o = DAR.g.worldToLocal(tA.clone()), d = DAR.g.worldToLocal(tA.clone().add(tB)).sub(o);
  if (d.z >= -.05 || o.z < .3 || o.z > 6) return; const k = -o.z / d.z, obj = DAR.g.localToWorld(o.addScaledVector(d, k)), p = pr.root.position, T = p.distanceTo(obj) / sp;
  pr.body.setLinvel({ x: (obj.x - p.x) / T, y: (obj.y - p.y) / T + 4.905 * T, z: (obj.z - p.z) / T }, true);
}
function actualizarDardos(dt) {
  if (!DAR.g) return; const r = DAR.ronda;
  for (const pr of DAR.dardos) {
    if (pr.estado === 'roto') continue;
    if (pr.estado === 'sostenido') { pr.enMano = true; continue; }
    if (pr.enMano && pr.estado === 'libre') { pr.enMano = false; if (!r.lanzados.includes(pr)) { r.lanzados.push(pr); pr.vuelo = 0; pr.res = null; asistirPC(pr); } }
    if (pr.estado !== 'libre' || !pr.body || pr.res) continue;
    const v = pr.body.linvel(); tB.set(v.x, v.y, v.z); const sp = tB.length(); pr.vuelo += dt;
    if (sp > 2) { // vuela de punta y, si va a cruzar el plano de la diana en el próximo instante, se clava
      tQ.setFromUnitVectors(Z, tC.copy(tB).normalize()); pr.body.setRotation(tQ, true); pr.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const p0 = DAR.g.worldToLocal(pr.root.position.clone()), p1 = DAR.g.worldToLocal(pr.root.position.clone().addScaledVector(tB, dt * 1.6 + .02));
      if (p0.z > .0 && p1.z <= .0) { const k = p0.z / (p0.z - p1.z), lx = p0.x + (p1.x - p0.x) * k, ly = p0.y + (p1.y - p0.y) * k - DIANA.y;
        if (Math.abs(lx) < .47 && Math.abs(ly) < .47) { const [pts, et] = puntuar(lx, ly); clavar(pr, tA.set(lx, ly + DIANA.y, .002), tC); pr.res = { pts, et }; r.puntos += pts; r.marcas.push(et === 'fuera' ? '0' : et); pintarDardos(); if (pts >= 50) eventoHistoria('dardo_diana'); } }
    } else if (pr.vuelo > .4) pr.res = { pts: 0, et: '0' }; // se quedó corto o rebotó: cuenta como cero
  }
  if (r.lanzados.length >= 3 && r.lanzados.every(p => p.res || p.estado === 'roto') && !r.fin) {
    r.fin = true; r.t = 4; DAR.mejor = Math.max(DAR.mejor, r.puntos); run.minijuegos.dardos = DAR.mejor; guardarRun(); pintarDardos(); sfx('objetivo');
    say(`Dardos · ${r.puntos} puntos`); if (r.puntos >= 100) decir('DAVE', r.puntos >= 140 ? '¡Ja! Que venga Hank ahora.' : 'Nada mal para estar a oscuras.', 2.2);
    eventoHistoria('dardos_ronda', { puntos: r.puntos, dardos: r.lanzados.map(p => p.res?.et || '0') });
  }
  if (r.fin && (r.t -= dt) <= 0) recogerDardos();
}

// ---------- 3) Piano: la canción de Lucía ----------
const CANCION = [67, 64, 64, 65, 62, 62, 60, 64, 67]; // Sol Mi Mi Fa Re Re Do Mi Sol
const NOMBRE = { 60: 'Do', 62: 'Re', 64: 'Mi', 65: 'Fa', 67: 'Sol' };
const PIA = { pi: null, k: 0, t: 0, hoja: null, marca: null };
function construirPiano() {
  const pi = pianos[0]; if (!pi) return; PIA.pi = pi;
  const hoja = panel(.36, .2, 360); hoja.m.position.set(0, 1.02, .036); hoja.m.rotation.x = -.2; hoja.m.material.toneMapped = true; pi.g.add(hoja.m); PIA.hoja = hoja;
  const marca = new THREE.Mesh(new THREE.SphereGeometry(.007, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffcf6a, toneMapped: false })); pi.g.add(marca); PIA.marca = marca;
  const orig = pi.pulsar.bind(pi);
  pi.pulsar = (t, vel) => { orig(t, vel); try { notaPiano(t.midi); } catch (e) {} };
  pintarHoja();
}
function notaPiano(midi) {
  if (midi === CANCION[PIA.k]) { PIA.k++; PIA.t = 6; } else PIA.k = midi === CANCION[0] ? 1 : 0;
  if (PIA.k === CANCION.length) { PIA.k = 0; completaCancion(); }
  pintarHoja();
}
function completaCancion() {
  const primera = !run.lucia; run.lucia = true; guardarRun(); sfx('objetivo');
  if (primera) {
    decir('LUCÍA', '«¡Otra vez, papá! ¡Otra vez! Y ahora tú cantas la parte del robot.»', 4);
    try { MEM?.recordar('dave', 'cancion_lucia', 2, { afecto: .25 }, { minijuego: 'piano' }); } catch (e) {}
    reloj.mensaje('Te sabes la canción de Lucía de memoria. Tus manos se acuerdan aunque tú no quieras.', 'RECUERDO');
  } else decir('DAVE', 'La canción de Lucía…', 2);
  eventoHistoria('piano_melodia', { cancion: 'lucia', primera });
}
function pintarHoja() {
  const h = PIA.hoja; if (!h) return; const { x, tex, c } = h; x.fillStyle = '#f2ecdc'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#3a2a1a'; x.textAlign = 'center'; x.font = 'italic 600 22px serif'; x.fillText('La canción de Lucía', 180, 30);
  x.strokeStyle = 'rgba(40,30,20,.5)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(14, 60 + i * 12); x.lineTo(346, 60 + i * 12); x.stroke(); }
  CANCION.forEach((m, i) => { const px = 34 + i * 37, py = 132 - (m - 60) * 6.4; x.fillStyle = i < PIA.k ? '#c87a1a' : '#2a1e14'; x.beginPath(); x.ellipse(px, py, 8, 6, -.3, 0, 7); x.fill(); x.fillRect(px + 6, py - 34, 2, 34);
    x.font = '600 15px serif'; x.fillText(NOMBRE[m], px, 186); });
  x.font = 'italic 13px serif'; x.fillStyle = '#7a6a5a'; x.fillText('(con letra de Lucía, 6 años)', 180, 50); tex.needsUpdate = true;
}
function actualizarPiano(dt) {
  if (!PIA.pi) return; if (PIA.k && (PIA.t -= dt) <= 0) { PIA.k = 0; pintarHoja(); }
  const t = PIA.pi.teclas.find(q => q.midi === CANCION[PIA.k]);
  if (t) { PIA.marca.position.set(t.x, .78, t.negra ? .2 : .23); PIA.marca.scale.setScalar(1 + Math.sin(G.time * 6) * .25); }
}

// ---------- 4) HORSE con el chaval ----------
const LETRAS = 'HORSE';
const HOR = { on: false, turno: null, marca: null, letras: { j: 0, c: 0 }, espera: 0, antes: 0, enMano: false, cartel: null, aro: null, t: 0, spot: null, desde: null };
function construirHorse() {
  const mx = CANASTA.x - 3.2, mz = CANASTA.z - 1.2, y = groundAt(mx, mz, 3), g = new THREE.Group(); g.position.set(mx, y, mz); scene.add(g);
  caja(g, .06, 1.3, .06, matC(0x5a5e64, { metalness: .6 }), 0, .65, 0);
  const c = panel(.7, .42); c.m.position.set(0, 1.45, 0); c.m.rotation.y = Math.PI; g.add(c.m); HOR.cartel = c;
  boton('pizarra (HORSE con el chaval)', c.m, empezarHorse, .3);
  const aro = new THREE.Mesh(new THREE.RingGeometry(.75, .9, 32), new THREE.MeshBasicMaterial({ color: 0xffcf6a, transparent: true, opacity: .6, toneMapped: false, depthWrite: false })); aro.rotation.x = -X; aro.visible = false; scene.add(aro); HOR.aro = aro;
  pintarHorse();
}
function pintarHorse() {
  const { x, tex } = HOR.cartel, L = n => LETRAS.split('').map((ch, i) => i < n ? ch : '·').join(' ');
  x.fillStyle = '#14181c'; x.fillRect(0, 0, 256, 154); x.textAlign = 'center'; x.fillStyle = '#ffcf6a'; x.font = '700 20px "Chakra Petch",sans-serif'; x.fillText('H O R S E', 128, 28);
  x.font = '700 26px monospace'; x.fillStyle = '#ff5a3a'; x.fillText('TÚ  ' + L(HOR.letras.j), 128, 70); x.fillStyle = '#7ff3ff'; x.fillText('ÉL  ' + L(HOR.letras.c), 128, 106);
  x.font = '500 13px Inter,sans-serif'; x.fillStyle = '#aaa'; x.fillText(HOR.on ? ({ jugador: 'tu tiro: desde el círculo', igualar: 'iguala su tiro', chaval: 'tira él…' }[HOR.turno] || '') : 'toca: jugar con el chaval', 128, 140); tex.needsUpdate = true;
}
function nuevoSitio() { const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, d = 3.5 + Math.random() * 3.8; HOR.spot = [CANASTA.x + Math.cos(a) * d, CANASTA.z - .75 + Math.sin(a) * d]; HOR.aro.position.set(HOR.spot[0], groundAt(HOR.spot[0], HOR.spot[1], 3) + .02, HOR.spot[1]); HOR.aro.visible = true; }
function empezarHorse() {
  if (HOR.on) return; HOR.on = true; HOR.letras = { j: 0, c: 0 }; HOR.turno = 'jugador'; nuevoSitio(); pintarHorse(); sfx('objetivo');
  decir('CHAVAL', 'HORSE. Tira desde el círculo: si la metes, la tengo que meter yo. Si fallas, elijo yo.', 3.6);
}
function letra(quien) {
  HOR.letras[quien]++; pintarHorse(); const n = HOR.letras[quien];
  if (n >= LETRAS.length) { HOR.on = false; HOR.aro.visible = false; const gana = quien === 'j' ? 'chaval' : 'jugador'; sfx('objetivo');
    decir('CHAVAL', gana === 'jugador' ? '¡Va, vale! Me has ganado. La revancha mañana… si hay mañana.' : '¡HORSE! Gané. No llores, eh.', 3);
    eventoHistoria('horse_fin', { gana, letrasJugador: HOR.letras.j, letrasChaval: HOR.letras.c }); pintarHorse(); return true; }
  return false;
}
function tiroChaval(dist) { return Math.random() < clamp(.88 - dist * .07, .3, .82); }
function actualizarHorse(dt) {
  const B = actividades._B; if (!HOR.on || !B?.pelota) return;
  const pr = B.pelota, enMano = pr.manos.length > 0, pf = playerFeet(tA);
  if (HOR.turno === 'chaval') { // tira él (narrado): si la mete, te toca igualar desde ahí
    if ((HOR.t -= dt) > 0) return; const d = Math.hypot(HOR.spot[0] - CANASTA.x, HOR.spot[1] - CANASTA.z);
    if (tiroChaval(d)) { decir('CHAVAL', elegir(Math.random, ['¡Dentro! Te toca. Desde ahí.', 'Limpia. A ver tú.', '¡Chof! Iguálala.']), 2.4); HOR.turno = 'igualar'; }
    else { decir('CHAVAL', elegir(Math.random, ['Uf, fuera. Elige tú.', 'Bah, el viento. Tu turno.']), 2.2); HOR.turno = 'jugador'; nuevoSitio(); }
    pintarHorse(); return;
  }
  if (HOR.enMano && !enMano) { // lanzamiento del jugador
    const dentro = Math.hypot(pf.x - HOR.spot[0], pf.z - HOR.spot[1]) < .95;
    if (!dentro) decir('CHAVAL', '¡Desde el círculo, listo!', 1.6); else { HOR.espera = 3.2; HOR.antes = B.puntos.jugador; }
  }
  HOR.enMano = enMano;
  if (HOR.espera > 0) {
    const metio = B.puntos.jugador > HOR.antes; HOR.espera -= dt;
    if (!metio && HOR.espera > 0) return; HOR.espera = 0;
    if (HOR.turno === 'jugador') {
      if (metio) { const d = Math.hypot(HOR.spot[0] - CANASTA.x, HOR.spot[1] - CANASTA.z);
        if (tiroChaval(d)) decir('CHAVAL', 'La meto yo también. Fácil.', 1.8); else { decir('CHAVAL', '¡Nooo! Vale, letra para mí.', 1.8); if (letra('c')) return; }
        nuevoSitio(); }
      else { HOR.turno = 'chaval'; HOR.t = 2.2; nuevoSitio(); decir('CHAVAL', 'Fallaste. Elijo yo: desde aquí.', 1.8); }
    } else if (HOR.turno === 'igualar') {
      if (!metio && letra('j')) return; decir('CHAVAL', metio ? 'Bien igualada. Tu turno.' : '¡Letra! Tu turno.', 1.8); HOR.turno = 'jugador'; nuevoSitio();
    }
    pintarHorse();
  }
}

// ---------- 5) Puerta de servicio en la valla oeste de la base (cables de la alarma) ----------
export const PUERTA = { x: 115, z0: -37.2, z1: -35.8, h: 3.2, id: 'base_oeste' };
const PUE = { piv: null, abierta: false, ang: 0, col: null, cables: [], correcto: null, alarmaT: 0, luz: null, nota: null, cortados: 0 };
// ANTES de hornear: parte el plano de la valla y su colisión para dejar el hueco de la puerta
function abrirHuecoValla() {
  let tramo = null;
  scene.traverse(o => { if (!tramo && o.isMesh && o.material === M.valla && o.geometry?.parameters && Math.abs(o.position.x - PUERTA.x) < .05 && Math.abs(o.rotation.y - X) < .01) { const L = o.geometry.parameters.width, c = o.position.z; if (PUERTA.z0 > c - L / 2 && PUERTA.z1 < c + L / 2) tramo = o; } });
  const col = colliders.find(c => Math.abs((c.x0 + c.x1) / 2 - PUERTA.x) < .05 && c.z0 < PUERTA.z0 && c.z1 > PUERTA.z1 && c.top >= 3);
  if (!tramo || !col) return false;
  const L = tramo.geometry.parameters.width, h = tramo.geometry.parameters.height, c = tramo.position.z, a0 = c - L / 2, a1 = c + L / 2;
  for (const [s0, s1] of [[a0, PUERTA.z0], [PUERTA.z1, a1]]) { const l = s1 - s0, g = new THREE.PlaneGeometry(l, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * l / 1.5, uv.getY(i) * h / 1.5); const m = new THREE.Mesh(g, M.valla); m.rotation.y = X; pieza(m, PUERTA.x, h / 2, (s0 + s1) / 2, { shoot: false }); }
  tramo.removeFromParent();
  colliders.push({ ...col, z0: PUERTA.z1 }); col.z1 = PUERTA.z0;
  PUE.col = { ...col, z0: PUERTA.z0, z1: PUERTA.z1 }; colliders.push(PUE.col); // la propia puerta, mientras esté cerrada
  return true;
}
function construirPuerta() {
  if (!abrirHuecoValla()) { console.warn('[minijuegos] valla oeste no encontrada: sin puerta de servicio'); return; }
  const W = PUERTA.z1 - PUERTA.z0, H = 2.4, acero = matC(0x6a7078, { metalness: .7, roughness: .4 }), r = azar('puerta');
  const piv = new THREE.Group(); piv.position.set(PUERTA.x, 0, PUERTA.z0); scene.add(piv); PUE.piv = piv;
  const panelV = new THREE.Mesh(new THREE.PlaneGeometry(W - .1, H - .1), M.valla); panelV.rotation.y = X; panelV.position.set(0, H / 2, W / 2); piv.add(panelV);
  for (const [h, z, y] of [[H, .025, H / 2], [H, W - .025, H / 2], [.05, W / 2, .03], [.05, W / 2, H - .03]]) caja(piv, .05, h, z === W / 2 ? W : .05, acero, 0, y, z); // marco
  // por encima del marco, un tramo de valla fijo hasta la altura del resto (y la placa)
  const sobre = new THREE.Mesh(new THREE.PlaneGeometry(W, PUERTA.h - H), M.valla); sobre.rotation.y = X; sobre.position.set(PUERTA.x, H + (PUERTA.h - H) / 2, (PUERTA.z0 + PUERTA.z1) / 2); scene.add(sobre);
  // caja de alarma con tres cables (cara exterior, x < 115) y una nota del de mantenimiento
  const g = new THREE.Group(); g.position.set(PUERTA.x - .14, 1.35, PUERTA.z1 + .35); g.rotation.y = -X; scene.add(g);
  caja(g, .3, .36, .1, matC(0x8a8a50), 0, 0, 0); const led = caja(g, .04, .04, .02, new THREE.MeshBasicMaterial({ color: 0x30ff60, toneMapped: false }), .1, .13, .06); PUE.led = led;
  const colores = [['rojo', 0xc81e1e], ['azul', 0x1e4ac8], ['amarillo', 0xe0c020]];
  PUE.correcto = elegir(r, ['azul', 'amarillo']);
  colores.forEach(([n, c], i) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .26, 6), matC(c, { roughness: .5 })); k.rotation.z = .25 - i * .25; k.position.set(-.08 + i * .08, -.1, .07); g.add(k); const cb = { n, k, cortado: false }; PUE.cables.push(cb); boton(`cable ${n} (alarma)`, k, () => cortar(cb), .05); });
  const nota = new THREE.Mesh(new THREE.PlaneGeometry(.14, .18), new THREE.MeshStandardMaterial({ map: (() => { const [c, x] = cv2d(128, 160); x.fillStyle = '#ece6d4'; x.fillRect(0, 0, 128, 160); x.fillStyle = '#2a2a40'; x.font = '600 12px serif'; ['PUERTA 3 (servicio)', 'Si se queda pillada:', 'cortar el ' + PUE.correcto.toUpperCase() + '.', 'NUNCA el rojo,', 'que salta la sirena.', '— Ibáñez, manten.'].forEach((t, i) => x.fillText(t, 8, 24 + i * 22)); return toTex(c, false); })(), roughness: .9 }));
  nota.position.set(.26, .02, .051); g.add(nota);
  boton('nota de mantenimiento', nota, () => decir('NOTA', `«Puerta 3: si se queda pillada, cortar el ${PUE.correcto}. NUNCA el rojo, que salta la sirena.»`, 3.4), .1);
  PUE.luz = fuenteLuz(PUERTA.x - .5, 2.6, PUERTA.z1 + .3, 0xff2010, 0, 10, 'alarma'); PUE.luz.on = false;
}
function cortar(cb) {
  if (cb.cortado || PUE.abierta) return; cb.cortado = true; cb.k.scale.y = .45; cb.k.position.y -= .06; sonClic(cb.k.getWorldPosition(tA)); sfx('snap', { pos: tA }); PUE.cortados++;
  const ok = cb.n === PUE.correcto;
  if (!ok) { PUE.alarmaT = 8; PUE.luz.on = true; PUE.luz.i = 30; PUE.led.material.color.setHex(0xff2010); sfx('alerta'); emitirRuido(tA, 40, 'alarma', 'mundo'); eventoHistoria('valla_alarma', { id: PUERTA.id, cable: cb.n }); decir('DAVE', 'Mierda. Mierda, mierda.', 1.6); }
  // con el bueno se suelta el cierre; con uno malo también (el cierre falla abierto), pero suena la sirena
  abrirPuerta(!ok);
}
function abrirPuerta(alarma) { PUE.abierta = true; const i = colliders.indexOf(PUE.col); if (i >= 0) colliders.splice(i, 1); chirrido(PUE.piv.getWorldPosition(tA), 1.4); eventoHistoria('valla_cortada', { id: PUERTA.id, alarma: !!alarma }); }
function actualizarPuerta(dt) {
  if (!PUE.piv) return;
  if (PUE.abierta && PUE.ang < 1.75) { PUE.ang = Math.min(1.75, PUE.ang + dt * 1.1); PUE.piv.rotation.y = PUE.ang; } // abre hacia dentro de la base (+X)
  if (PUE.alarmaT > 0) { PUE.alarmaT -= dt; if (Math.random() < dt * 1.2) { emitirRuido(PUE.piv.position, 30, 'alarma', 'mundo'); sfx('alerta'); } if (PUE.alarmaT <= 0) PUE.luz.on = false; }
}

// ---------- 6) Emisoras ocultas en el dial ----------
const OCULTAS = {
  lazaro: { n: '88.3 · ???', tipo: 'musica', l: [['RADIO', '♪ Lázaro Systems… ♪ ¿Cansado de perder a los que quieres?'], ['RADIO', 'Con el chip M-7, los tuyos se quedan contigo. Para siempre. Literalmente.'], ['RADIO', 'Lázaro Systems. Nadie se va del todo. ♪']] },
  mike: { n: '99.9 · ???', tipo: 'noticias', l: [['RADIO · 2028', '—Doctor Mike, ¿de verdad cree que una máquina puede sentir?'], ['MIKE', 'No lo sé. Pero si copias a alguien entero… ¿quién te dice que la copia no te echa de menos?'], ['RADIO · 2028', '¿Y usted se copiaría?'], ['MIKE', 'Yo no. Mi hermano sí. Él es el que vale la pena.']] },
  numeros: { n: '1610 AM · ???', tipo: 'estatica', l: [['RADIO', '…ele, zeta, erre. Cero, cero, cero, uno. Repito: cero, cero, cero, uno…'], ['RADIO', '…siete, siete, cero. Agente, confirme recepción…']] }
};
const RAD = { idx: {}, cola: [], t: 0, oidas: new Set() };
function construirEmisoras() {
  const r = azar('dial'); // en cada partida aparecen dos de las tres, en otro orden
  for (const id of barajar(r, Object.keys(OCULTAS)).slice(0, 2)) { const o = OCULTAS[id]; RAD.idx[EMISORAS.length] = id; EMISORAS.push({ n: o.n, tipo: o.tipo, oculta: id }); }
}
function actualizarEmisoras(dt) {
  for (const pr of props) { const rd = pr.radio; if (!rd || pr.estado === 'roto') continue; if (rd.est !== pr._estPrev) { pr._estPrev = rd.est; const id = RAD.idx[rd.est]; if (id) { RAD.cola = [...OCULTAS[id].l]; RAD.t = .6; if (!RAD.oidas.has(id)) { RAD.oidas.add(id); eventoHistoria('radio_oculta', { id }); } } else RAD.cola = []; } }
  if (RAD.cola.length && (RAD.t -= dt) <= 0) { const [q, l] = RAD.cola[0]; if (decir(q, l, 2 + l.length * .05)) { RAD.cola.shift(); RAD.t = 2.3 + l.length * .05; } else RAD.t = 1; }
}

// ---------- Construir y bucle ----------
const pasos = { galeria: construirGaleria, dardos: construirDardos, piano: construirPiano, horse: construirHorse, puerta: construirPuerta, emisoras: construirEmisoras };
export function construirMinijuegos() { for (const k in pasos) try { pasos[k](); } catch (e) { console.warn('[minijuegos] ' + k, e); } GAL.mejor = run.minijuegos.galeria || 0; DAR.mejor = run.minijuegos.dardos || 0; }
const err = {};
export function actualizarMinijuegos(dt) {
  if (!capOn.tierra) return;
  for (const [k, f] of [['galeria', actualizarGaleria], ['dardos', actualizarDardos], ['piano', actualizarPiano], ['horse', actualizarHorse], ['puerta', actualizarPuerta], ['emisoras', actualizarEmisoras]])
    try { f(dt); } catch (e) { if (!err[k]) { err[k] = 1; console.warn('[minijuegos] ' + k, e); } }
}
export const minijuegos = { GALERIA, DIANA, PUERTA, empezarGaleria, empezarHorse, recogerDardos, cortar: n => { const c = PUE.cables.find(q => q.n === n); if (c) cortar(c); return PUE.abierta; }, tocar: midi => notaPiano(midi), CANCION,
  estado: () => ({ galeria: GAL.ronda ? { ...GAL.ronda } : { mejor: GAL.mejor }, dardos: { puntos: DAR.ronda.puntos, lanzados: DAR.ronda.lanzados.length, mejor: DAR.mejor, dardos: DAR.dardos.length }, piano: { k: PIA.k, lucia: run.lucia }, horse: { on: HOR.on, turno: HOR.turno, letras: { ...HOR.letras } }, puerta: { abierta: PUE.abierta, correcto: PUE.correcto, alarma: PUE.alarmaT > 0 }, emisoras: Object.values(RAD.idx) }) };
