// Actividades secundarias (momentos pequeños, estilo Red Dead): baloncesto en el parque con un chaval superviviente
// y dos encuentros ligeros por el pueblo (un gato sobre un coche y una superviviente en una ventana).
//   Baloncesto: canasta en el parque (CANASTA), pelota física del catálogo ('pelota'). El chaval recoge los rebotes,
//   te la pasa o tira. Pásasela lanzándola (VR: velocidad real de la mano · PC: clic, con ayuda de puntería si apuntas
//   al aro). «Triples»: toca el marcador (VR) o E/clic (PC) → 60 s para meter desde fuera de 6,75 m.
//   Eventos: 'canasta' {quien, triple}, 'triples_fin' {puntos}, 'encuentro_gato', 'encuentro_ventana'.
// API: actividades.activar(nombre 'baloncesto'|'gato'|'ventana', on) · actividades.triples() · actividades.estado()
import { THREE, V3, G, scene, groundAt, capOn, colliders, cv2d, toTex, rnd, angLerp } from '../nucleo.js';
import { makeHuman, animRig } from '../cuerpos.js';
import { crearProp, registrar as registrarInter } from '../interaccion/objetos.js';
import { manoPC, manosVR } from '../interaccion/index.js';
import { alListo, cuerpoFijo } from '../interaccion/fisica-adaptador.js';
import { eventoHistoria } from '../interaccion/ruido.js';
import { sfx, buzz } from '../fx.js';
import { ui } from '../ui.js';
import { playerFeet, playerHead, P } from '../jugador.js';
import { enemies, spawn } from '../enemigos.js';
import { crear as crearNpc, agentes } from './npcIA.js';

const tA = new V3(), tB = new V3(), tC = new V3(), GRAV = 9.81;
const ON = { baloncesto: true, gato: true, ventana: true };
export function activar(n, on = true) { ON[n] = !!on; }

// ---------- Baloncesto ----------
export const CANASTA = { x: -35, z: 46.5 };           // pie del poste; el tablero mira al sur (-Z, hacia la pista)
const ARO = new V3(CANASTA.x, 3.05, CANASTA.z - .75); // centro del aro
const PISTA = new V3(CANASTA.x, 0, CANASTA.z - 6);    // donde espera el chaval
const B = { pelota: null, chaval: null, est: 'espera', t: 0, ultimo: null, desde: null, prevY: 0, sost: null, marcador: null, juego: null, puntos: { jugador: 0, chaval: 0 }, pasada: false };
const mats = { blanco: new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: .6 }), gris: new THREE.MeshStandardMaterial({ color: 0x5a5e64, metalness: .6, roughness: .4 }), naranja: new THREE.MeshStandardMaterial({ color: 0xe0501a, roughness: .5 }) };
function construirCanasta() {
  const g = new THREE.Group(), y0 = groundAt(CANASTA.x, CANASTA.z, 3);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, 3.5, 10), mats.gris); poste.position.set(0, 1.75, .25);
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .55), mats.gris); brazo.position.set(0, 3.3, 0);
  const tablero = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, .04), mats.blanco); tablero.position.set(0, 3.45, -.3);
  const cuadro = new THREE.Mesh(new THREE.PlaneGeometry(.59, .45), new THREE.MeshBasicMaterial({ color: 0xc03020 })); cuadro.position.set(0, 3.3, -.323); cuadro.rotation.y = Math.PI;
  const hueco = new THREE.Mesh(new THREE.PlaneGeometry(.53, .39), mats.blanco); hueco.position.set(0, 3.3, -.324); hueco.rotation.y = Math.PI;
  const aro = new THREE.Mesh(new THREE.TorusGeometry(.23, .012, 6, 20), mats.naranja); aro.rotation.x = Math.PI / 2; aro.position.set(0, 3.05, -.75);
  // red: un cono abierto de líneas
  const red = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.CylinderGeometry(.23, .15, .4, 10, 2, true)), new THREE.LineBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: .7 })); red.position.set(0, 2.83, -.75);
  g.add(poste, brazo, tablero, cuadro, hueco, aro, red);
  for (const m of [poste, tablero, aro]) m.castShadow = true;
  g.position.set(CANASTA.x, y0, CANASTA.z); scene.add(g);
  // física: poste, tablero y aro (8 cajitas en anillo)
  alListo(() => {
    const cajas = [{ f: 'caja', m: [.08, 1.75, .08], c: [CANASTA.x, y0 + 1.75, CANASTA.z + .25] }, { f: 'caja', m: [.9, .53, .03], c: [CANASTA.x, y0 + 3.45, CANASTA.z - .3] }];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cajas.push({ f: 'caja', m: [.015, .015, .05], c: [ARO.x + Math.cos(a) * .235, y0 + 3.05, ARO.z + Math.sin(a) * .235], ry: -a }); }
    cuerpoFijo(cajas);
  });
  ARO.y = y0 + 3.05;
  // marcador
  const [c, x] = cv2d(256, 128); const tex = toTex(c, false);
  const pan = new THREE.Mesh(new THREE.PlaneGeometry(1, .5), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const soporte = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.6, .06), mats.gris);
  const mx = CANASTA.x + 3.2, mz = CANASTA.z - .2, my = groundAt(mx, mz, 3);
  soporte.position.set(mx, my + .8, mz + .05); pan.position.set(mx, my + 1.6, mz); pan.rotation.y = Math.PI; scene.add(soporte, pan);
  B.marcador = { c, x, tex, pan, dib: '' };
  registrarInter({ label: 'marcador (triples)', root: pan, mallas: [pan], pulsarE() { triples(); return true; }, clic(d) { if (d) triples(); return true; } });
  pintarMarcador();
}
function pintarMarcador() {
  const M = B.marcador; if (!M) return; const j = B.juego, k = j ? `${j.puntos}|${Math.ceil(j.t)}` : `${B.puntos.jugador}|${B.puntos.chaval}`; if (k === M.dib) return; M.dib = k;
  const x = M.x; x.fillStyle = '#0b0d10'; x.fillRect(0, 0, 256, 128); x.font = '700 18px monospace'; x.textAlign = 'center';
  if (j) { x.fillStyle = '#ffcf6a'; x.fillText('TRIPLES', 128, 26); x.font = '700 46px monospace'; x.fillStyle = '#ff5a3a'; x.fillText(String(j.puntos).padStart(2, '0'), 80, 90); x.fillStyle = '#7ff3ff'; x.fillText(String(Math.ceil(j.t)).padStart(2, '0'), 180, 90); x.font = '600 13px monospace'; x.fillStyle = '#aaa'; x.fillText('PUNTOS        TIEMPO', 128, 116); }
  else { x.fillStyle = '#ffcf6a'; x.fillText('TÚ   ·   CHAVAL', 128, 26); x.font = '700 46px monospace'; x.fillStyle = '#ff5a3a'; x.fillText(String(B.puntos.jugador), 70, 90); x.fillText(String(B.puntos.chaval), 186, 90); x.font = '600 13px monospace'; x.fillStyle = '#aaa'; x.fillText('toca: triples (60 s)', 128, 116); }
  M.tex.needsUpdate = true;
}
export function triples() { B.juego = { t: 60, puntos: 0, tiros: 0 }; sfx('objetivo'); ui.subtitulo('CHAVAL', '¡Triples! Un minuto. Yo te paso, tú tiras.'); setTimeout(() => ui.subtitulo(null), 2600); pintarMarcador(); return true; }

// tiro parabólico: velocidad para llegar de p a q en T segundos
function balistica(p, q, T, out) { return out.set((q.x - p.x) / T, (q.y - p.y) / T + .5 * GRAV * T, (q.z - p.z) / T); }
function lanzarPelota(v, desde) {
  const pr = B.pelota; B.sost = null;
  if (pr.body) { pr.body.setTranslation({ x: desde.x, y: desde.y, z: desde.z }, true); pr.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true); pr.body.setAngvel({ x: rnd(-6, 6), y: 0, z: rnd(-6, 6) }, true); }
  pr.root.position.copy(desde);
}
function manoChaval(out) { const R = B.chaval.R; R.root.updateMatrixWorld(); return out.set(0, 1.15, .38).applyMatrix4(R.root.matrixWorld); }

function actualizarBaloncesto(dt) {
  const pr = B.pelota, ag = B.chaval && agentes.chaval; if (!pr || !ag) return;
  const vis = capOn.tierra && ON.baloncesto; ag.root.visible = vis; if (!vis) return;
  const pf = playerFeet(tA), dJ = Math.hypot(pf.x - CANASTA.x, pf.z - CANASTA.z);
  if (dJ > 45) return; // lejos: nada que simular
  const pb = pr.root.position, sostenida = pr.manos.length > 0, R = ag.root;
  // ¿quién lanzó? (transición de sostenida a libre)
  if (sostenida) B.sost = null; // se la quitaste de las manos
  if (B.prevSost && !sostenida) { B.ultimo = 'jugador'; B.desde = new V3(pf.x, 0, pf.z); asistirPC(); }
  if (sostenida && B.est === 'pase') B.est = 'espera';
  B.prevSost = sostenida;
  // canasta: la pelota cruza la altura del aro hacia abajo dentro del círculo
  if (B.prevY > ARO.y && pb.y <= ARO.y && Math.hypot(pb.x - ARO.x, pb.z - ARO.z) < .2) canasta();
  B.prevY = pb.y;
  // asistencia de recepción: pase del chaval que llega al jugador
  if (B.est === 'pase' && !sostenida) {
    playerHead(tB); tB.y -= .35;
    if (G.mode === 'pc' && !manoPC.sostiene && pb.distanceTo(tB) < .9) { pr.agarre.agarrar(manoPC); B.est = 'espera'; sfx('pickup'); }
    if (G.mode === 'vr') for (const m of manosVR) if (m.c.src && !m.sostiene && pb.distanceTo(m.pos) < .3 && m.c.src.gamepad?.buttons[1]?.pressed) { pr.agarre.agarrar(m); buzz(m.c, .5, 40); B.est = 'espera'; }
    if ((B.t += dt) > 3) B.est = 'espera';
  }
  // chaval
  ag.spd = 0;
  if (B.sost) { // la tiene él
    manoChaval(tC); if (pr.body) { pr.body.setTranslation({ x: tC.x, y: tC.y, z: tC.z }, true); pr.body.setLinvel({ x: 0, y: 0, z: 0 }, true); } pb.copy(tC);
    B.t += dt; const quiere = B.juego || dJ < 12;
    const objetivo = quiere ? tB.set(pf.x, 0, pf.z) : ARO; R.rotation.y = angLerp(R.rotation.y, Math.atan2(objetivo.x - R.position.x, objetivo.z - R.position.z), dt * 5);
    if (B.t > 1.1) {
      B.t = 0; manoChaval(tC);
      if (quiere && (B.juego || Math.random() < .6)) { playerHead(tB); tB.y -= .35; balistica(tC, tB, Math.max(.6, tC.distanceTo(tB) / 9), tA); lanzarPelota(tA, tC); B.est = 'pase'; B.ultimo = 'chaval_pase'; B.t = 0; ui.subtitulo('CHAVAL', ['¡Toma!', '¡Va!', 'Tuya.', '¡A ver ese triple!'][Math.floor(Math.random() * 4)]); setTimeout(() => ui.subtitulo(null), 1400); }
      else { tB.copy(ARO).add(tA.set(rnd(-.14, .14), .05, rnd(-.14, .14))); balistica(tC, tB, 1.05, tA); lanzarPelota(tA, tC); B.est = 'espera'; B.ultimo = 'chaval'; B.desde = R.position.clone(); }
      sfx('whoosh');
    }
  } else if (!sostenida && B.est !== 'pase') { // rebote: ir a por la pelota si está a su alcance y casi parada
    const v = pr.body ? pr.body.linvel() : { x: 0, y: 0, z: 0 }, lenta = Math.hypot(v.x, v.y, v.z) < 5, dB = Math.hypot(pb.x - R.position.x, pb.z - R.position.z);
    if (lenta && dB < 14 && pb.y < 2.2) {
      if (dB > .55) { ag.spd = 2.6; R.rotation.y = angLerp(R.rotation.y, Math.atan2(pb.x - R.position.x, pb.z - R.position.z), dt * 8); R.position.x += Math.sin(R.rotation.y) * ag.spd * dt; R.position.z += Math.cos(R.rotation.y) * ag.spd * dt; }
      else { B.sost = true; B.t = 0; sfx('pickup'); }
    } else { // volver a su sitio y mirar al jugador
      const dP = Math.hypot(PISTA.x - R.position.x, PISTA.z - R.position.z);
      if (dP > .6 && (!lenta || dB >= 14)) { ag.spd = 1.4; R.rotation.y = angLerp(R.rotation.y, Math.atan2(PISTA.x - R.position.x, PISTA.z - R.position.z), dt * 5); R.position.x += Math.sin(R.rotation.y) * ag.spd * dt; R.position.z += Math.cos(R.rotation.y) * ag.spd * dt; }
      else R.rotation.y = angLerp(R.rotation.y, Math.atan2(pf.x - R.position.x, pf.z - R.position.z), dt * 3);
    }
  }
  // triples: tiempo
  if (B.juego) { B.juego.t -= dt; if (B.juego.t <= 0) { const pts = B.juego.puntos; B.juego = null; sfx('objetivo'); ui.subtitulo('CHAVAL', pts >= 9 ? `¿${pts}? Vale, eres un crack.` : pts >= 3 ? `${pts} puntos. No está mal para un viejo.` : `${pts}… Hay que entrenar.`); setTimeout(() => ui.subtitulo(null), 3000); eventoHistoria('triples_fin', { puntos: pts }); } }
  pintarMarcador();
}
// PC: si al lanzar apuntabas cerca del aro, la trayectoria se corrige a una parábola (con error según la puntería)
function asistirPC() {
  if (G.mode !== 'pc' || !B.pelota.body) return;
  const pr = B.pelota, p = pr.root.position, v = pr.body.linvel(); tA.set(v.x, v.y, v.z); if (tA.length() < 3) return;
  tB.subVectors(ARO, p); const horiz = Math.hypot(tB.x, tB.z), ang = Math.acos(Math.max(-1, Math.min(1, (tA.x * tB.x + tA.z * tB.z) / (Math.hypot(tA.x, tA.z) * horiz + 1e-6))));
  if (ang > .3 || horiz > 11) return;
  const err = ang * 1.2 + horiz * .012; tC.copy(ARO).add(tB.set(rnd(-err, err), .06, rnd(-err, err)));
  balistica(p, tC, .55 + horiz * .07, tA); pr.body.setLinvel({ x: tA.x, y: tA.y, z: tA.z }, true);
}
function canasta() {
  const quien = B.ultimo === 'jugador' ? 'jugador' : 'chaval', triple = quien === 'jugador' && B.desde && Math.hypot(B.desde.x - CANASTA.x, B.desde.z - (CANASTA.z - .75)) > 6.75;
  sfx('objetivo'); B.puntos[quien] += triple ? 3 : 2;
  if (B.juego && quien === 'jugador' && triple) B.juego.puntos += 3;
  if (quien === 'jugador') { ui.subtitulo('CHAVAL', triple ? ['¡TRIPLE!', '¡Desde casa!', '¡Toma ya!'][Math.floor(Math.random() * 3)] : ['¡Dentro!', 'Bien.', 'Suerte…'][Math.floor(Math.random() * 3)]); setTimeout(() => ui.subtitulo(null), 1300); }
  eventoHistoria('canasta', { quien, triple });
}

// ---------- Encuentro 1: gato sobre un coche ----------
const GATO = { g: null, est: 'sentado', t: 0, dir: new V3() };
function construirGato() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: .9 });
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, .32), m); cuerpo.position.y = .14;
  const cab = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), m); cab.position.set(0, .26, .17);
  const o1 = new THREE.Mesh(new THREE.ConeGeometry(.025, .05, 4), m); o1.position.set(-.035, .33, .17); const o2 = o1.clone(); o2.position.x = .035;
  const cola = new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, .3, 5), m); cola.position.set(0, .26, -.2); cola.rotation.x = -.6;
  const ojos = new THREE.Mesh(new THREE.BoxGeometry(.07, .012, .01), new THREE.MeshBasicMaterial({ color: 0xc8ff60 })); ojos.position.set(0, .275, .235);
  g.add(cuerpo, cab, o1, o2, cola, ojos); g.userData.cola = cola;
  // sobre el coche aparcado de la calle (3.4, 20) si existe; si no, en la acera
  const x = 3.4, z = 20.3, y = groundAt(x, z, 4); g.position.set(x, y, z); g.rotation.y = Math.PI * .6; scene.add(g); GATO.g = g; GATO.y0 = y;
}
function maullido() { import('../audio.js').then(({ A }) => { const c = A.ctx; if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.type = 'sawtooth'; o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(900, t + .15); o.frequency.linearRampToValueAtTime(480, t + .5); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .05); g.gain.linearRampToValueAtTime(0, t + .55); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; o.connect(f); f.connect(g); g.connect(A.master || c.destination); o.start(t); o.stop(t + .6); }).catch(() => {}); }
function actualizarGato(dt) {
  const g = GATO.g; if (!g) return; g.visible = ON.gato && capOn.tierra && GATO.est !== 'fuera'; if (!g.visible) return;
  const pf = playerFeet(tA), d = Math.hypot(pf.x - g.position.x, pf.z - g.position.z);
  g.userData.cola.rotation.z = Math.sin(G.time * (GATO.est === 'sentado' ? 2 : 9)) * .4;
  if (GATO.est === 'sentado') { if (d < 4.5) { GATO.est = 'salta'; GATO.t = 0; maullido(); GATO.dir.set(g.position.x - pf.x, 0, g.position.z - pf.z).normalize(); g.rotation.y = Math.atan2(GATO.dir.x, GATO.dir.z); eventoHistoria('encuentro_gato'); } return; }
  GATO.t += dt; g.position.addScaledVector(GATO.dir, dt * 5.5);
  const suelo = groundAt(g.position.x, g.position.z, .3); g.position.y = GATO.t < .45 ? GATO.y0 + Math.sin(GATO.t / .45 * Math.PI) * .4 - (GATO.y0 - suelo) * GATO.t / .45 : suelo + Math.abs(Math.sin(GATO.t * 14)) * .05;
  if (GATO.t > 4) GATO.est = 'fuera';
}

// ---------- Encuentro 2: superviviente en una ventana ----------
// aparece al acercarte; un robot ronda bajo su ventana; si lo tumbas, te tira un botiquín
const VENT = { pos: [-24, 18], yaw: Math.PI / 2, y: 3.1, est: 'oculta', R: null, robot: null, t: 0, marco: null };
function construirVentana() {
  // busca la fachada de un edificio cercano al punto preferido (collider alto); la mujer se asoma en ella
  let best = null, bd = 1e9; for (const c of colliders) { if (c.top < 5 || c.top > 14 || c.cap !== 'tierra') continue; const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, d = Math.hypot(cx - VENT.pos[0], cz - VENT.pos[1]); if (d < bd && c.x1 - c.x0 > 4 && c.z1 - c.z0 > 4 && Math.abs(cx) < 70 && Math.abs(cz) < 70) { bd = d; best = c; } }
  if (best) { const cz = (best.z0 + best.z1) / 2; // fachada que da a la calle principal (x = 0)
    if (Math.abs(best.x1) < Math.abs(best.x0)) { VENT.pos = [best.x1 + .05, cz]; VENT.yaw = Math.PI / 2; } else { VENT.pos = [best.x0 - .05, cz]; VENT.yaw = -Math.PI / 2; } }
  const marco = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), new THREE.MeshBasicMaterial({ color: 0x3a2a18, toneMapped: false }));
  marco.position.set(VENT.pos[0] + Math.sin(VENT.yaw) * .01, VENT.y + .2, VENT.pos[1] + Math.cos(VENT.yaw) * .01); marco.rotation.y = VENT.yaw; scene.add(marco); VENT.marco = marco;
  const R = makeHuman({ camisa: 0x6a4a5a, pantalon: 0x2a2a30, piel: 0xe0b090, pelo: 0x5a3a1a, melena: true, scale: .9 });
  R.root.position.set(VENT.pos[0] - Math.sin(VENT.yaw) * .15, VENT.y - 1.05, VENT.pos[1] - Math.cos(VENT.yaw) * .15); R.root.rotation.y = VENT.yaw; R.root.visible = false;
  R.root.traverse(m => { if (m.isMesh) m.userData.enemy = null; }); scene.add(R.root); animRig(R, 1, { spd: 0 }); VENT.R = R;
}
function actualizarVentana(dt) {
  if (!VENT.R) return; const on = ON.ventana && capOn.tierra; VENT.marco.visible = on; if (!on) { VENT.R.root.visible = false; return; }
  const pf = playerFeet(tA), d = Math.hypot(pf.x - VENT.pos[0], pf.z - VENT.pos[1]), R = VENT.R;
  if (VENT.est !== 'oculta' && VENT.est !== 'fin') animRig(R, dt, { spd: 0 });
  if (VENT.est === 'oculta' && d < 22 && !enemies.some(e => e.alive)) {
    VENT.est = 'pide'; R.root.visible = true; R.armR.sh.rotation.x = -2.6; sfx('alerta');
    ui.subtitulo('MUJER', '¡Eh! ¡Tú! ¡Hay uno ahí abajo, no me deja salir!'); setTimeout(() => ui.subtitulo(null), 3000);
    const rx = VENT.pos[0] + Math.sin(VENT.yaw) * 3, rz = VENT.pos[1] + Math.cos(VENT.yaw) * 3;
    try { VENT.robot = spawn('r7', rx, rz, { hp: 60 }); } catch (e) { console.warn('[ventana]', e); VENT.est = 'ayudado'; }
  } else if (VENT.est === 'pide') { R.armR.sh.rotation.x = -2.2 - Math.sin(G.time * 6) * .4; if (!VENT.robot || !VENT.robot.alive) { VENT.est = 'ayudado'; VENT.t = 0; } }
  else if (VENT.est === 'ayudado') {
    VENT.t += dt;
    if (VENT.t > 1.2) {
      VENT.est = 'fin'; ui.subtitulo('MUJER', '¡Gracias! ¡Toma, cógelo!'); setTimeout(() => ui.subtitulo(null), 2400);
      R.root.updateMatrixWorld(); tB.set(0, 1.3, .5).applyMatrix4(R.root.matrixWorld);
      const b = crearProp('botiquin', tB.x, tB.y, tB.z, { despierto: true }); playerHead(tC); tC.y -= .5;
      setTimeout(() => { if (b.body) { balistica(b.root.position, tC, 1.1, tA); b.body.setLinvel({ x: tA.x, y: tA.y, z: tA.z }, true); } }, 120);
      setTimeout(() => { R.root.visible = false; }, 3500); eventoHistoria('encuentro_ventana');
    }
  }
}

// ---------- Construir y bucle ----------
export function construirActividades() {
  try { construirCanasta(); } catch (e) { console.warn('[actividades] canasta', e); }
  try {
    crearNpc('chaval', { pos: [PISTA.x, PISTA.z], yaw: Math.PI, aspecto: { camisa: 0x2a5a8a, pantalon: 0x3a3a44, piel: 0xc8946c, pelo: 0x1a1410, gorra: true, gorraColor: 0xa02020, scale: .82, mangaCorta: true } });
    B.chaval = agentes.chaval;
    B.pelota = crearProp('pelota', PISTA.x + .8, groundAt(PISTA.x, PISTA.z, 3), PISTA.z - .6);
  } catch (e) { console.warn('[actividades] chaval/pelota', e); }
  try { construirGato(); } catch (e) { console.warn('[actividades] gato', e); }
  try { construirVentana(); } catch (e) { console.warn('[actividades] ventana', e); }
}
export function actualizarActividades(dt) { actualizarBaloncesto(dt); actualizarGato(dt); actualizarVentana(dt); }
export const actividades = { activar, triples, CANASTA, estado: () => ({ baloncesto: { est: B.est, sost: !!B.sost, puntos: { ...B.puntos }, juego: B.juego && { ...B.juego } }, gato: GATO.est, ventana: VENT.est, ventanaPos: VENT.pos }), _B: B };
