// Linterna del hombro: la interacción ya la engancha (VR: mano al hombro + grip la saca, gatillo junto al hombro la
// enciende; PC: L). Aquí: el jugador EMPIEZA con una linterna en el hombro, el haz visible (cono aditivo) con motas de
// polvo, y una batería que se gasta encendida, parpadea al final y se recarga sola apagada (o agitándola en VR).
// API: linterna.bateria (0..1) · linterna.recargar(v) · linterna.dar() (pone una nueva en el hombro si está vacío)
import { THREE, V3, G, scene } from '../nucleo.js';
import { crearProp, props } from '../interaccion/objetos.js';
import { linternaEncendida } from '../interaccion/objetos.js';
import { hombro, guardarLinterna } from '../interaccion/armas.js';
import { manosVR } from '../interaccion/index.js';

const tA = new V3(), tB = new V3();
let luz = null;
const est = { bateria: 1, parpadeo: 0 };

// cono del haz: abierto, aditivo, se desvanece hacia la punta con un degradado de vértices
const geo = new THREE.ConeGeometry(1.5, 6, 20, 1, true); geo.translate(0, -3, 0); geo.rotateX(-Math.PI / 2); // punta en el origen, abre hacia -Z
{ const c = [], p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 - Math.min(1, -p.getZ(i) / 6); c.push(k, k, k); } geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
const cono = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff0d0, vertexColors: true, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
cono.visible = false; cono.renderOrder = 4; cono.raycast = () => {}; scene.add(cono);
// motas: 70 puntos dentro del cono, derivan despacio
const N = 70, mg = new THREE.BufferGeometry(), mp = new Float32Array(N * 3), mv = [];
for (let i = 0; i < N; i++) { const z = -(.4 + Math.random() * 4.5), r = Math.random() * -z * .22, a = Math.random() * 6.3; mp.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 3); mv.push([(Math.random() - .5) * .03, (Math.random() - .5) * .02, (Math.random() - .5) * .03]); }
mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
const motas = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xfff6e0, size: .012, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
motas.frustumCulled = false; cono.add(motas);

export function dar() {
  if (hombro.prop) return hombro.prop;
  try { const pr = crearProp('linterna', 0, -50, 0); pr.deJugador = true; guardarLinterna(pr); return pr; } catch (e) { console.warn('[linterna]', e); return null; }
}
export function recargar(v = 1) { est.bateria = Math.min(1, est.bateria + v); }

export function actualizarLinterna(dt) {
  if (!luz) { scene.traverse(o => { if (!luz && o.isSpotLight && o.color.getHex() === 0xfff2d8) luz = o; }); if (!luz) return; }
  const pr = linternaEncendida();
  if (!pr || luz.intensity <= 0) { cono.visible = false; est.bateria = Math.min(1, est.bateria + dt * .02); return; }
  est.bateria = Math.max(0, est.bateria - dt / 240); // ~4 min de luz continua
  // agitar la linterna en la mano (VR) la recarga un poco (dinamo)
  for (const m of manosVR) if (m.sostiene === pr && m.vel.length() > 3) est.bateria = Math.min(1, est.bateria + dt * .08);
  let k = est.bateria > .25 ? 1 : .35 + est.bateria * 2.6;
  if (est.bateria < .3) { est.parpadeo -= dt; if (est.parpadeo <= 0) est.parpadeo = Math.random() * (est.bateria * 8 + .3); if (est.parpadeo < .08) k *= Math.random() * .3; }
  if (est.bateria <= 0) k = .08;
  luz.intensity *= k;
  cono.visible = k > .1; cono.position.copy(luz.position); cono.lookAt(luz.target.position); cono.rotateY(Math.PI); // lookAt apunta +Z; el cono abre hacia -Z
  cono.material.opacity = .06 * k;
  for (let i = 0; i < N; i++) { const v = mv[i]; mp[i * 3] += v[0] * dt; mp[i * 3 + 1] += v[1] * dt; mp[i * 3 + 2] += v[2] * dt; if (Math.abs(mp[i * 3]) > 1 || Math.abs(mp[i * 3 + 1]) > 1) { mp[i * 3] *= -.5; mp[i * 3 + 1] *= -.5; } }
  mg.attributes.position.needsUpdate = true;
}
export const linterna = { dar, recargar, get bateria() { return est.bateria; }, set bateria(v) { est.bateria = v; } };
