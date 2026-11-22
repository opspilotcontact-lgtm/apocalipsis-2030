// Sala de pruebas de ingravidez: pasillo de nave (z 0 → -12), esclusa (-12 → -15) y hangar pequeño (-15 → -27)
// con escombros flotantes y una ventana que se puede reventar. Todo por código (sin assets).
import * as THREE from 'three';
import { cajaFisica, crearProp } from './fisica.js';

const V = THREE.Vector3;
export const S = {
  estaticos: [],   // {min,max} para «¿hay superficie cerca?» (agarrar paredes)
  superficies: [], // mallas para rayos (botas, disparos)
  asideros: [],    // {pos, mesh}
  anclas: [],      // {pos, mesh}
  paneles: [],     // {pos, mesh, accion}
  puertas: {},     // in / ex: {body, mesh, base}
  mampara: null, vidrio: null,
  ventana: { centro: new V(0, 2.25, -27), min: new V(-1, 1.5, -27.3), max: new V(1, 3, -26.9) },
  inicio: new V(0, 1.3, -2),
  luzEsclusa: null, marcoVentana: null,
};

// textura de chapa con paneles y remaches
function texChapa(base, linea) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .04})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.strokeStyle = linea; x.lineWidth = 3; x.strokeRect(2, 2, 252, 252); x.beginPath(); x.moveTo(128, 2); x.lineTo(128, 254); x.stroke();
  x.fillStyle = linea; for (const a of [10, 118, 138, 246]) for (const b of [10, 246]) { x.beginPath(); x.arc(a, b, 3, 0, 7); x.fill(); x.beginPath(); x.arc(b, a, 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const M = {
  casco: new THREE.MeshStandardMaterial({ map: texChapa('#5d6672', '#3a414b'), roughness: .65, metalness: .55 }),
  suelo: new THREE.MeshStandardMaterial({ map: texChapa('#3b4048', '#24282e'), roughness: .8, metalness: .5 }),
  hangar: new THREE.MeshStandardMaterial({ map: texChapa('#4a525c', '#2c3138'), roughness: .7, metalness: .5 }),
  puerta: new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: .5, metalness: .6 }),
  caja: new THREE.MeshStandardMaterial({ color: 0x45523a, roughness: .7, metalness: .2 }),
  amarillo: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: .4, metalness: .4 }),
  naranja: new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: .35, metalness: .5, emissive: 0x401000 }),
  oscuro: new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: .6, metalness: .6 }),
  tira: new THREE.MeshBasicMaterial({ color: 0xbfe8ff }),
  tiraRoja: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
  vidrio: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: .18, roughness: .05, metalness: .1, depthWrite: false }),
  panel: new THREE.MeshBasicMaterial({ color: 0x29e6ff }),
  rojo: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
};

// UV en metros (panel de 1,2 m) para que la chapa no se estire
function uvMetros(g, w, h, d) {
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / 1.2, uv.getY(i) * dims[f][1] / 1.2); }
  return g;
}
function losa(scene, x0, y0, z0, x1, y1, z1, mat, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0, min = new V(x0, y0, z0), max = new V(x1, y1, z1);
  const m = new THREE.Mesh(uvMetros(new THREE.BoxGeometry(w, h, d), w, h, d), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); scene.add(m);
  const f = cajaFisica(min, max, !!o.cinematico);
  if (!o.cinematico) S.estaticos.push({ min, max });
  if (o.superficie !== false) S.superficies.push(m);
  return { mesh: m, ...f };
}
function asidero(scene, x, y, z, eje) {
  const g = new THREE.Group(), barra = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .36, 8), M.amarillo);
  barra.rotation.copy(eje === 'x' ? new THREE.Euler(0, 0, Math.PI / 2) : eje === 'z' ? new THREE.Euler(Math.PI / 2, 0, 0) : new THREE.Euler());
  g.add(barra); g.position.set(x, y, z); scene.add(g);
  barra.userData.asidero = S.asideros.length; S.asideros.push({ pos: g.position.clone(), mesh: barra });
}
function ancla(scene, x, y, z, rotY = 0) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(.07, .018, 8, 16), M.naranja);
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
  m.userData.ancla = S.anclas.length; S.anclas.push({ pos: m.position.clone(), mesh: m });
}
function panel(scene, x, y, z, rotY, accion, texto) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x2 = c.getContext('2d');
  x2.fillStyle = '#071018'; x2.fillRect(0, 0, 256, 128); x2.strokeStyle = accion === 'mampara' ? '#ff3a2a' : '#29e6ff'; x2.lineWidth = 6; x2.strokeRect(4, 4, 248, 120);
  x2.fillStyle = x2.strokeStyle; x2.font = '700 30px system-ui'; x2.textAlign = 'center'; x2.fillText(texto, 128, 56); x2.font = '20px system-ui'; x2.fillText(accion === 'mampara' ? 'F · tocar' : 'F · tocar · ciclo', 128, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.36, .18), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m);
  m.userData.panel = S.paneles.length; S.paneles.push({ pos: m.position.clone(), mesh: m, accion, canvas: c, tex: t });
}

export function construirSala(scene) {
  // ---- pasillo + esclusa (interior x ±1,2 · y 0..2,6 · z 0..-15) ----
  losa(scene, -1.4, -.2, -15, 1.4, 0, .2, M.suelo);
  losa(scene, -1.4, 2.6, -15, 1.4, 2.8, .2, M.casco);
  losa(scene, -1.4, 0, -15, -1.2, 2.6, .2, M.casco);
  losa(scene, 1.2, 0, -15, 1.4, 2.6, .2, M.casco);
  losa(scene, -1.2, 0, 0, 1.2, 2.6, .2, M.casco);
  // tiras de luz del techo
  for (let z = -1; z > -11.5; z -= 2) { const t = new THREE.Mesh(new THREE.BoxGeometry(.5, .02, 1.1), M.tira); t.position.set(0, 2.59, z); scene.add(t); }
  // marcos (costillas) del pasillo
  for (let z = -3; z > -12; z -= 3) { losa(scene, -1.2, 0, z - .08, -1.05, 2.6, z + .08, M.oscuro, { superficie: true }); losa(scene, 1.05, 0, z - .08, 1.2, 2.6, z + .08, M.oscuro); }
  // puertas de la esclusa (suben al techo)
  S.puertas.in = losa(scene, -1.2, 0, -12.08, 1.2, 2.6, -11.92, M.puerta, { cinematico: true });
  S.puertas.ex = losa(scene, -1.2, 0, -14.98, 1.2, 2.6, -14.82, M.puerta, { cinematico: true });
  for (const p of [S.puertas.in, S.puertas.ex]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, .12, .2), M.amarillo); b.position.y = -1.1; p.mesh.add(b); }

  // ---- hangar (interior x ±6 · y -1..5 · z -15..-27) ----
  losa(scene, -6.2, -1.2, -27.2, 6.2, -1, -15, M.hangar);
  losa(scene, -6.2, 5, -27.2, 6.2, 5.2, -15, M.hangar);
  losa(scene, -6.2, -1, -27.2, -6, 5, -15, M.hangar);
  losa(scene, 6, -1, -27.2, 6.2, 5, -15, M.hangar);
  // pared delantera con el hueco de la esclusa
  losa(scene, -6, -1, -15.2, -1.4, 5, -15, M.hangar); losa(scene, 1.4, -1, -15.2, 6, 5, -15, M.hangar);
  losa(scene, -1.4, 2.8, -15.2, 1.4, 5, -15, M.hangar); losa(scene, -1.4, -1, -15.2, 1.4, -.2, -15, M.hangar);
  // pared trasera con la ventana (x ±1 · y 1,5..3)
  losa(scene, -6, -1, -27.2, -1, 5, -27, M.hangar); losa(scene, 1, -1, -27.2, 6, 5, -27, M.hangar);
  losa(scene, -1, -1, -27.2, 1, 1.5, -27, M.hangar); losa(scene, -1, 3, -27.2, 1, 5, -27, M.hangar);
  S.vidrio = losa(scene, -1, 1.5, -27.12, 1, 3, -27.08, M.vidrio, { superficie: true });
  S.estaticos.pop(); // el vidrio no cuenta como superficie de agarre
  S.vidrio.mesh.userData.vidrio = true;
  // marco rojo de la ventana
  const marco = new THREE.Group();
  for (const [w, h, x, y] of [[2.2, .06, 0, 1.47], [2.2, .06, 0, 3.03], [.06, 1.6, -1.03, 2.25], [.06, 1.6, 1.03, 2.25]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), M.tiraRoja); t.position.set(x, y, -26.97); marco.add(t); }
  scene.add(marco); S.marcoVentana = marco;
  // mampara de emergencia (baja y tapa la ventana)
  S.mampara = losa(scene, -1.25, 3.45, -26.96, 1.25, 5, -26.86, M.puerta, { cinematico: true });
  // contenedores fijos (cobertura) y vigas
  losa(scene, -5.5, -1, -21, -3.5, .8, -19, M.caja); losa(scene, -5.5, .8, -20.6, -4.2, 2, -19.4, M.caja);
  losa(scene, 3, -1, -25.5, 5.5, .6, -23, M.caja);
  losa(scene, -.15, -1, -21.15, .15, 5, -20.85, M.oscuro);
  // luces del hangar
  for (const x of [-4, 0, 4]) for (const z of [-17.5, -24.5]) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, .03, .25), M.tira); t.position.set(x, 4.98, z); scene.add(t); }

  // ---- asideros ----
  for (let z = -1.5; z > -11.5; z -= 1.5) { asidero(scene, -1.15, 1.3, z, 'z'); asidero(scene, 1.15, 1.3, z, 'z'); asidero(scene, 0, 2.55, z - .75, 'x'); }
  asidero(scene, -1.15, 1.3, -13.5, 'z'); asidero(scene, 1.15, 1.6, -13.2, 'z'); asidero(scene, 0, 2.55, -13.5, 'x');
  for (const x of [-1.7, 1.7]) asidero(scene, x, .6, -15.25, 'y');
  for (const z of [-17.5, -20, -22.5, -25]) { asidero(scene, -5.95, .5, z, 'z'); asidero(scene, -5.95, 3.2, z, 'z'); asidero(scene, 5.95, .5, z, 'z'); asidero(scene, 5.95, 3.2, z, 'z'); }
  for (const x of [-3, 0, 3]) for (const z of [-18, -24]) asidero(scene, x, 4.95, z, 'x');
  asidero(scene, -1.35, 2.25, -26.95, 'y'); asidero(scene, 1.35, 2.25, -26.95, 'y'); asidero(scene, 0, 1.2, -26.95, 'x');
  asidero(scene, -4.5, 2.05, -20, 'x'); asidero(scene, 4.2, .65, -24.2, 'x'); asidero(scene, .2, 2, -21, 'y');
  // ---- argollas del cable ----
  ancla(scene, -1.15, .6, -11.3, Math.PI / 2); ancla(scene, 1.15, .6, -13.8, Math.PI / 2);
  ancla(scene, 2.2, 1.2, -15.25); ancla(scene, -5.95, 2, -21.5, Math.PI / 2); ancla(scene, 5.95, 2, -18.5, Math.PI / 2);
  // ---- paneles ----
  panel(scene, 1.19, 1.4, -11.3, -Math.PI / 2, 'ciclo', 'ESCLUSA');
  panel(scene, 1.19, 1.4, -13.6, -Math.PI / 2, 'ciclo', 'ESCLUSA');
  panel(scene, 2.4, 1.6, -15.21, Math.PI, 'ciclo', 'ESCLUSA');
  panel(scene, 2.1, 2.25, -26.98, 0, 'mampara', 'MAMPARA');
  // ---- luces ----
  scene.add(new THREE.HemisphereLight(0x8fa6c8, 0x1a1410, .35));
  for (const z of [-2, -6, -10]) { const l = new THREE.PointLight(0xcfe6ff, 6, 7, 1.6); l.position.set(0, 2.3, z); scene.add(l); }
  S.luzEsclusa = new THREE.PointLight(0xffb040, 5, 5, 1.6); S.luzEsclusa.position.set(0, 2.3, -13.5); scene.add(S.luzEsclusa);
  for (const x of [-3.5, 3.5]) for (const z of [-18, -24]) { const l = new THREE.PointLight(0xdfe8ff, 14, 11, 1.5); l.position.set(x, 4.4, z); scene.add(l); }
  const sol = new THREE.DirectionalLight(0xfff2e0, 1.2); sol.position.set(20, 10, -60); scene.add(sol);

  // ---- exterior: estrellas y planeta ----
  const n = 2500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new V().randomDirection().multiplyScalar(300); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false })));
  const planeta = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 32), new THREE.MeshStandardMaterial({ color: 0x2c5f9e, emissive: 0x0a1a33, roughness: .9 }));
  planeta.position.set(-60, -80, -240); scene.add(planeta);
  return S;
}

// escombros flotantes del hangar + botella de oxígeno de reserva
export function sembrarProps(scene) {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mats = [M.caja, M.oscuro, M.casco, new THREE.MeshStandardMaterial({ color: 0x7a3020, roughness: .6, metalness: .4 })];
  for (let i = 0; i < 18; i++) {
    const t = i % 3, x = rnd(-5, 5), y = rnd(0, 4), z = rnd(-26, -16);
    let geo, forma;
    if (t === 0) { const a = rnd(.25, .5), b = rnd(.2, .45), c = rnd(.25, .5); geo = new THREE.BoxGeometry(a, b, c); forma = { tipo: 'caja', x: a, y: b, z: c }; }
    else if (t === 1) { const r = rnd(.06, .14), h = rnd(.2, .6); geo = new THREE.CylinderGeometry(r, r, h, 12); forma = { tipo: 'cil', r, h }; }
    else { const a = rnd(.4, .9), c = rnd(.3, .6); geo = new THREE.BoxGeometry(a, .03, c); forma = { tipo: 'caja', x: a, y: .03, z: c }; }
    const m = new THREE.Mesh(geo, mats[i % mats.length]); m.position.set(x, y, z); m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); scene.add(m);
    crearProp(m, forma, { v: { x: rnd(-.05, .05), y: rnd(-.05, .05), z: rnd(-.05, .05) }, w: { x: rnd(-.3, .3), y: rnd(-.3, .3), z: rnd(-.3, .3) }, densidad: t === 2 ? 600 : 200 });
  }
  crearBotella(scene, new V(-4.6, 2.5, -19.9));
  // un par de cosas sueltas en el pasillo para empujarlas
  for (const z of [-5, -8]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.3, .2, .25), mats[0]); m.position.set(rnd(-.6, .6), rnd(.6, 2), z); scene.add(m); crearProp(m, { tipo: 'caja', x: .3, y: .2, z: .25 }, { w: { x: .2, y: .4, z: 0 } }); }
}

export function crearBotella(scene, pos) {
  const g = new THREE.Group(), cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .34, 14), new THREE.MeshStandardMaterial({ color: 0x2fae5a, roughness: .35, metalness: .5 }));
  const valv = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .07, 10), M.oscuro); valv.position.y = .2; g.add(cuerpo, valv);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), M.panel); luz.position.set(0, .05, .06); g.add(luz);
  g.position.copy(pos); scene.add(g);
  return crearProp(g, { tipo: 'cil', r: .06, h: .4 }, { tipo: 'botella', densidad: 400, w: { x: .1, y: .3, z: .05 }, radio: .2 });
}

// distancia de un punto a la superficie estática más cercana
export function distSuperficie(p) {
  let mejor = 1e9;
  for (const b of S.estaticos) {
    const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x), dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y), dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
    const d = Math.hypot(dx, dy, dz); if (d < mejor) mejor = d;
  }
  return mejor;
}

// zona de aire de un punto: C pasillo · A esclusa · H hangar · V vacío exterior
export function zonaDe(p) {
  if (p.z > -12 && p.z < .2 && Math.abs(p.x) < 1.3 && p.y > -.2 && p.y < 2.8) return 'C';
  if (p.z <= -12 && p.z > -15 && Math.abs(p.x) < 1.3 && p.y > -.2 && p.y < 2.8) return 'A';
  if (p.z <= -15 && p.z > -27.05 && Math.abs(p.x) < 6.1 && p.y > -1.1 && p.y < 5.1) return 'H';
  return 'V';
}
