// Cámaras de seguridad en el laboratorio de Mike: el monitor derecho de la mesa muestra 4 cámaras.
// Botonera en la mesa (1·2·3·4 y ▶ grabación): VR = tocar con la punta del dedo · PC = mirar + E (o clic).
// Render a textura a 256×144, solo mientras alguien mira la pantalla y a ~10 fps (barato en Quest).
// La cámara 3 tiene modo «grabación»: repite en bucle el robo del casco por R-01 (holograma visible solo en la cámara,
// capa 5) con la hora grabada sobreimpresa. Emite director.evento('camara_vista', { id, grabacion }).
// API: camaras.ver(id 1..4, grabacion?) · camaras.grabacion(on) · camaras.actual · camaras.lista
import { THREE, V3, G, scene, camera, renderer, capOn, cv2d, toTex } from '../nucleo.js';
import { makeRobot, makeHuman, animRig, holograma } from '../cuerpos.js';
import { sfx, buzz } from '../fx.js';
import { registrar as registrarInter } from '../interaccion/objetos.js';
import { manosVR } from '../interaccion/index.js';
import { reloj } from '../interaccion/reloj.js';
import { eventoHistoria } from '../interaccion/ruido.js';

const tA = new V3(), tB = new V3();
const W = 256, H = 144, CAPA = 5;
export const CAMARAS = [
  { id: 1, nombre: 'LAB · SALA', pos: [10.6, 3.7, -131.2], mira: [0, .8, -142] },
  { id: 2, nombre: 'LAB · TRASERA', pos: [-3.5, 3.6, -147.2], mira: [-9.5, .8, -143.5] },
  { id: 3, nombre: 'LAB · VITRINA', pos: [3.2, 3.3, -136.8], mira: [0, 1.1, -142] },
  { id: 4, nombre: 'RECINTO · PUERTA', pos: [21.5, 7.6, -123], mira: [0, .5, -118] }
];
const cam = new THREE.PerspectiveCamera(70, W / H, .1, 80); cam.layers.enable(CAPA);
const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true }); rt.texture.colorSpace = THREE.SRGBColorSpace;
const estado = { id: 1, grab: false, t: 0, acum: 0, mirando: false, encendida: false };

// ---------- Pantalla (sobre el monitor derecho de la mesa de Mike) y rótulos ----------
const SX = 6.6, SY = 1.275, SZ = -146.79;
const grupo = new THREE.Group(); grupo.name = 'camaras'; scene.add(grupo);
const pant = new THREE.Mesh(new THREE.PlaneGeometry(.8, .45), new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xc8f0d8, toneMapped: false }));
pant.position.set(SX, SY, SZ + .006); pant.visible = false; grupo.add(pant);
const [oc, ox] = cv2d(W, H); const otex = toTex(oc, false);
const capa = new THREE.Mesh(new THREE.PlaneGeometry(.8, .45), new THREE.MeshBasicMaterial({ map: otex, transparent: true, depthWrite: false, toneMapped: false }));
capa.position.set(SX, SY, SZ + .009); capa.visible = false; grupo.add(capa);
function rotulo() {
  const c = CAMARAS[estado.id - 1];
  ox.clearRect(0, 0, W, H);
  ox.fillStyle = 'rgba(0,0,0,.05)'; for (let y = 0; y < H; y += 3) ox.fillRect(0, y, W, 1); // líneas de barrido
  ox.font = '600 11px monospace'; ox.fillStyle = '#e8ffe8'; ox.fillText(`CAM ${c.id} · ${c.nombre}`, 6, 13);
  let hora;
  if (estado.grab) { const s = Math.floor(estado.t) % 60; hora = `04:58:${String(12 + s).padStart(2, '0')}`; ox.fillStyle = '#ffcf6a'; ox.fillText('▶ GRABACIÓN', 6, H - 8); }
  else { hora = reloj.hora?.() || '--:--'; if (Math.floor(G.time * 2) % 2) { ox.fillStyle = '#ff3b2f'; ox.beginPath(); ox.arc(W - 40, 10, 4, 0, 7); ox.fill(); } ox.fillStyle = '#e8ffe8'; ox.fillText('REC', W - 32, 14); }
  ox.fillStyle = '#e8ffe8'; ox.fillText(hora, W - 66, H - 8);
  otex.needsUpdate = true;
}

// ---------- Botonera ----------
const botones = [];
const matB = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .25, roughness: .5 });
[1, 2, 3, 4, 'R'].forEach((k, i) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.07, .025, .07), matB(k === 'R' ? 0xc03020 : 0x3a6a4a));
  m.position.set(5.95 + i * .13, .795, -146.15); grupo.add(m);
  const b = { k, m, root: m, mallas: [m], label: k === 'R' ? 'grabación de la cámara 3' : 'cámara ' + k, t: 0,
    pulsarE() { pulsar(b); return true; }, clic(down) { if (down) pulsar(b); return true; } };
  registrarInter(b); botones.push(b);
});
// placa con números
{ const [c, x] = cv2d(256, 32); x.fillStyle = '#111'; x.fillRect(0, 0, 256, 32); x.fillStyle = '#cfe'; x.font = '700 18px monospace'; ['1', '2', '3', '4', '▶'].forEach((t, i) => x.fillText(t, 14 + i * 50, 22));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(.66, .08), new THREE.MeshBasicMaterial({ map: toTex(c, false), toneMapped: false })); p.rotation.x = -Math.PI / 2; p.position.set(6.21, .7826, -146.05); grupo.add(p); }
function pulsar(b) {
  b.t = .2; sfx('btn');
  if (b.k === 'R') ver(3, !(estado.id === 3 && estado.grab)); else ver(b.k, false);
}

// ---------- Grabación de la cámara 3: R-01 se lleva el casco ----------
const rob = makeRobot({ body: 0x2a2c30, dark: 0x0e0f12, accent: 0xc9a23a, eye: 0xff2a1a, scale: 1.05 });
const robMat = holograma(rob.root, 0xff5a3a);
const casco = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 8, 0, 6.3, 0, 1.9), robMat);
rob.root.traverse(m => { if (m.isMesh) { m.layers.set(CAPA); m.raycast = () => {}; } }); casco.layers.set(CAPA);
rob.root.visible = false; scene.add(rob.root, casco); animRig(rob, 1, { spd: 0 });
// recorrido: entra por la trasera, va a la vitrina, coge el casco, sale
const RUTA = [[0, [-8.5, -147.3]], [4, [-.6, -141.6]], [6.5, [-.6, -141.6]], [10.5, [-8.5, -147.3]], [12, [-8.5, -147.3]]];
function grabacion(dt) {
  estado.t += dt; const t = estado.t % 12; let i = 0; while (i < RUTA.length - 2 && RUTA[i + 1][0] <= t) i++;
  const [t0, a] = RUTA[i], [t1, b] = RUTA[i + 1], k = Math.min(1, (t - t0) / Math.max(.01, t1 - t0));
  const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k, mov = Math.hypot(b[0] - a[0], b[1] - a[1]) > .1 && k < 1;
  rob.root.visible = true; rob.root.position.set(x, 0, z); if (mov) rob.root.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); else if (i === 2) rob.root.rotation.y = Math.PI;
  animRig(rob, dt, { spd: mov ? 1.3 : 0 });
  const coger = t > 5 && t < 6.5 ? (t - 5) / 1.5 : t >= 6.5 && t < 10 ? 1 - (t - 6.5) / 3.5 * .3 : 0; rob.armR.sh.rotation.x = -1.3 * Math.min(1, coger * 2); rob.armL.sh.rotation.x = -1.3 * Math.min(1, coger * 2);
  if (t > 6) { rob.armR.grip.getWorldPosition(casco.position); } else casco.position.set(0, 1.45, -142);
  robMat.opacity = .3 + Math.random() * .15;
}

// ---------- API ----------
export function ver(id, grab = false) {
  id = Math.max(1, Math.min(4, +id || 1)); if (id !== 3) grab = false;
  const cambia = id !== estado.id || grab !== estado.grab || !estado.encendida;
  estado.id = id; estado.grab = grab; estado.encendida = true; if (grab) estado.t = 0;
  const c = CAMARAS[id - 1]; cam.position.set(...c.pos); cam.lookAt(...c.mira);
  if (cambia) eventoHistoria('camara_vista', { id, grabacion: grab });
  estado.acum = 1; return true;
}
ver(1); estado.encendida = false;

// ---------- Bucle ----------
export function actualizarCamaras(dt) {
  const on = capOn.tierra;
  camera.getWorldPosition(tA); const d = Math.hypot(tA.x - SX, tA.z - (SZ + .8));
  grupo.visible = on && d < 40;
  if (!grupo.visible) { rob.root.visible = false; casco.visible = false; return; }
  // tocar botones con el dedo (VR)
  for (const b of botones) { b.t = Math.max(0, b.t - dt); b.m.position.y = .795 - (b.t > 0 ? .008 : 0); }
  if (G.mode === 'vr') for (const m of manosVR) { if (!m.c.src || m.sostiene) continue; for (const b of botones) { b.m.getWorldPosition(tB); if (tB.distanceTo(m.tip) < .045 && b.t <= 0) { pulsar(b); buzz(m.c, .4, 30); } } }
  // ¿alguien mira la pantalla? cerca y de frente
  camera.getWorldDirection(tB);
  estado.mirando = d < 3.2 && tB.z < -.2 && on;
  if (estado.mirando && !estado.encendida) ver(estado.id);
  pant.visible = capa.visible = estado.encendida && d < 12;
  casco.visible = estado.grab; if (!estado.grab) rob.root.visible = false;
  if (!estado.mirando) return;
  if (estado.grab) grabacion(dt);
  estado.acum += dt; if (estado.acum < .1) return; estado.acum = 0;
  // render a textura (sin XR, sin recalcular sombras, sin la propia pantalla: evita el bucle de realimentación)
  const xr = renderer.xr.enabled, sh = renderer.shadowMap.autoUpdate, prev = renderer.getRenderTarget();
  pant.visible = false; capa.visible = false;
  renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
  renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = sh;
  pant.visible = capa.visible = true;
  rotulo();
}
export const camaras = { ver, grabacion: on => ver(3, on), get actual() { return { id: estado.id, grabacion: estado.grab, mirando: estado.mirando }; }, lista: CAMARAS };
