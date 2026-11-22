// Comodidad (docs/diseno-vr.md §6): opciones persistentes en G.opciones (localStorage, con try/catch),
// el panel «Comodidad» del menú y la viñeta (visión en túnel) al moverse o girar en VR.
//   G.opciones.sacudida  → empujón de cámara al recibir daño en VR (por defecto NO; lo lee hurtPlayer y el combate)
//   G.opciones.giro      → 'pasos' | 'suave' · giroGrados 30/45/90 · giroVel °/s
//   G.opciones.vineta    → 'no' | 'suave' | 'fuerte'
//   G.opciones.sentado   → suma altura virtual (y la calibración con los dos grips + dos gatillos 2 s)
//   G.opciones.recarga   → 'fisica' | 'asistida' | 'automatica' (VR)
//   G.opciones.reloj     → reloj 2030 en la muñeca como HUD en VR (si no, el panel flotante de siempre)
import { THREE, G, camera, cv2d, toTex, clamp, dolly } from '../nucleo.js';

const CLAVE = 'apoc2030.opciones';
export const DEF = { sacudida: false, giro: 'pasos', giroGrados: 30, giroVel: 120, vineta: 'suave', sentado: false, alturaExtra: 0, recarga: 'fisica', reloj: true, agacharBoton: true };
function cargar() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch (e) { return { ...DEF }; } }
G.opciones = cargar();
export function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(G.opciones)); } catch (e) {} }
export function poner(k, v) { G.opciones[k] = v; guardar(); }

// ---------- Panel «Comodidad» en el menú (se inyecta, no hace falta tocar index.html) ----------
const CICLOS = [
  ['vineta', 'Visión en túnel al moverte', [['no', 'no'], ['suave', 'suave'], ['fuerte', 'fuerte']]],
  ['giro', 'Giro', [['pasos30', 'por pasos 30°'], ['pasos45', 'por pasos 45°'], ['pasos90', 'por pasos 90°'], ['suave', 'suave']]],
  ['sentado', 'Modo sentado', [[false, 'no'], [true, 'sí']]],
  ['sacudida', 'Empujón al recibir daño (VR)', [[false, 'no'], [true, 'sí']]],
  ['recarga', 'Recarga en VR', [['fisica', 'física'], ['asistida', 'asistida'], ['automatica', 'automática']]],
  ['reloj', 'Reloj de muñeca como HUD (VR)', [[true, 'sí'], [false, 'no']]]
];
const valorDe = k => k === 'giro' ? (G.opciones.giro === 'suave' ? 'suave' : 'pasos' + G.opciones.giroGrados) : G.opciones[k];
function aplicar(k, v) { if (k === 'giro') { if (v === 'suave') poner('giro', 'suave'); else { G.opciones.giroGrados = +v.slice(5); poner('giro', 'pasos'); } } else poner(k, v); }
export function montarMenu() {
  const card = document.querySelector('#menu .card'); if (!card || document.getElementById('comodidad')) return;
  const sec = document.createElement('div'); sec.id = 'comodidad';
  sec.innerHTML = '<h2>COMODIDAD</h2><div class="row set" id="comodidadBotones"></div><p class="foot">En VR: <b>Y</b> agacharse · <b>stick dcho. abajo</b> tumbarse · tapar la boca con la mano izquierda + grip para contener la respiración · los dos grips + los dos gatillos 2 s = calibrar altura. PC: <b>C</b> agacharse · <b>Z</b> tumbarse · <b>V</b> contener la respiración · <b>Tab</b> reloj.</p>';
  const caps = card.querySelector('#caps'); card.insertBefore(sec, caps ? caps.nextSibling : null);
  const cont = sec.querySelector('#comodidadBotones');
  for (const [k, nombre, vals] of CICLOS) {
    const b = document.createElement('button'); const pintar = () => { const v = valorDe(k), e = vals.find(x => x[0] === v) || vals[0]; b.textContent = nombre + ': ' + e[1]; };
    b.onclick = () => { const v = valorDe(k), i = vals.findIndex(x => x[0] === v); aplicar(k, vals[(i + 1) % vals.length][0]); pintar(); };
    pintar(); cont.appendChild(b);
  }
}

// ---------- Viñeta: un plano con un agujero degradado pegado a la cámara (funciona en VR, 1 llamada) ----------
const [vc, vx] = cv2d(256, 256); { const g = vx.createRadialGradient(128, 128, 40, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,1)'); vx.fillStyle = g; vx.fillRect(0, 0, 256, 256); }
const vinMat = new THREE.MeshBasicMaterial({ map: toTex(vc, false), transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
export const vineta = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), vinMat); vineta.position.z = -.12; vineta.renderOrder = 998; vineta.visible = false; camera.add(vineta);
// oscuro extra (ahogo al contener la respiración, etc.): 0..1
export const vinetaExtra = { v: 0 };
let prevP = null, prevY = 0, nivel = 0;
export function actualizarVineta(dt) {
  const p = dolly.getWorldPosition(new THREE.Vector3()), y = dolly.rotation.y;
  let mov = 0;
  if (prevP && G.mode === 'vr' && G.opciones.vineta !== 'no') {
    const v = Math.hypot(p.x - prevP.x, p.z - prevP.z) / Math.max(dt, 1e-3), w = Math.abs(Math.atan2(Math.sin(y - prevY), Math.cos(y - prevY))) / Math.max(dt, 1e-3);
    if (v < 20 && w < 60) mov = clamp(v / 2.5, 0, 1) * .7 + clamp(w / 2, 0, 1); // los saltos (teletransporte, pasos de giro) se ignoran por la cota
    mov *= G.opciones.vineta === 'fuerte' ? 1 : .6;
  }
  prevP = p; prevY = y;
  nivel += (Math.min(1, mov) - nivel) * Math.min(1, dt * 8);
  const o = Math.max(nivel * .85, vinetaExtra.v);
  vinMat.opacity = o; vineta.visible = o > .01; vineta.scale.setScalar(1.25 - o * .45);
}
