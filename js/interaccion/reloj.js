// Reloj de muñeca 2030 (docs/diseno-vr.md §3.17): el único HUD de Dave en VR.
//   Hora de la historia (sale de la nota del capítulo, «… · 03:12», y corre en tiempo real) · pulso = vida ·
//   mensajes (vibra la muñeca; se leen girando la muñeca hacia la cara) · batería.
//   Sustituye al panel flotante de ui.js en VR si G.opciones.reloj (si no, queda el de siempre).
//   PC: mantener Tab muestra la esfera en una esquina.
//   API para la historia: reloj.mensaje('Lucía pregunta por ti', 'SARAH') · reloj.bateria = 0..1 · window.__reloj
import { THREE, V3, G, camera, cv2d, toTex, clamp } from '../nucleo.js';
import { buzz } from '../fx.js';
import { ui } from '../ui.js';
import { mecanico } from './sonido.js';

let J = null; import('../jugador.js').then(m => { J = m; }).catch(() => {});
let D = null; import('../historia/director.js').then(m => { D = m.director; }).catch(() => {});
const [c, x] = cv2d(256, 256); const tex = toTex(c, false);
const matCara = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
export const reloj = { g: new THREE.Group(), mensajes: [], bateria: 1, mirando: false, base: null, capIdx: -2, t0: 0, abierto: null,
  mensaje(texto, de = 'SARAH') { reloj.mensajes.push({ de, texto, leido: false, t: G.time }); const iz = J?.leftC?.(); buzz(iz, .6, 120); setTimeout(() => buzz(iz, .6, 120), 260); mecanico('llave', reloj.g.getWorldPosition(new V3())); dibujar(true); },
  hora() { if (!reloj.base) return '--:--'; const m = Math.floor(reloj.base + (G.time - reloj.t0) / 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); },
  pulso() { const hp = J ? J.P.hp : 100; return Math.round(64 + (100 - hp) * .7 + (G.sigilo?.conteniendo ? 18 : 0)); }
};
{ const g = reloj.g, caja = new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: .8, roughness: .3 }), corr = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: .8 });
  const correa = new THREE.Mesh(new THREE.TorusGeometry(.034, .009, 6, 20), corr); correa.scale.set(1, 1.25, 1); correa.rotation.y = Math.PI / 2; g.add(correa);
  const cj = new THREE.Mesh(new THREE.CylinderGeometry(.021, .021, .01, 20), caja); cj.position.y = .041; g.add(cj);
  const cara = new THREE.Mesh(new THREE.CircleGeometry(.018, 24), matCara); cara.rotation.x = -Math.PI / 2; cara.position.y = .0465; g.add(cara); reloj.cara = cara;
  g.position.set(0, -.01, .1); g.rotation.set(0, 0, Math.PI / 2 * .9); g.visible = false; }
let ultKey = '';
function dibujar(forzar) {
  const msg = reloj.mensajes.find(m => !m.leido), p = reloj.pulso(), k = reloj.hora() + p + (msg ? msg.texto : '') + reloj.mirando + Math.round(reloj.bateria * 10);
  if (!forzar && k === ultKey) return; ultKey = k;
  x.clearRect(0, 0, 256, 256); x.fillStyle = '#05080c'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
  const brillo = reloj.mirando ? 1 : .35; x.globalAlpha = brillo;
  x.strokeStyle = '#29e6ff'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 118, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reloj.bateria); x.stroke();
  x.fillStyle = '#e9f6ff'; x.textAlign = 'center'; x.font = '700 64px "Chakra Petch",sans-serif'; x.fillText(reloj.hora(), 128, msg && reloj.mirando ? 92 : 118);
  const col = p < 95 ? '#39ff7a' : p < 115 ? '#ffcf6a' : '#ff4030';
  x.fillStyle = col; x.font = '700 30px "Chakra Petch",sans-serif'; x.fillText('♥ ' + p, 128, msg && reloj.mirando ? 128 : 166);
  if (msg) { x.fillStyle = '#ffcf6a'; x.font = '700 20px Inter,sans-serif'; if (!reloj.mirando) x.fillText('✉ ' + msg.de, 128, 205);
    else { x.fillText(msg.de, 128, 158); x.fillStyle = '#e9eef5'; x.font = '500 17px Inter,sans-serif'; const pal = msg.texto.split(' '); let l = '', y = 182; for (const w of pal) { if (x.measureText(l + w).width > 190) { x.fillText(l, 128, y); y += 20; l = ''; } l += w + ' '; } x.fillText(l, 128, y); } }
  x.globalAlpha = 1; tex.needsUpdate = true;
}
// ---------- PC: Tab ----------
let pcDiv = null, tab = false;
addEventListener('keydown', e => { if (e.code === 'Tab' && G.playing && G.mode === 'pc') { e.preventDefault(); tab = true; } });
addEventListener('keyup', e => { if (e.code === 'Tab') tab = false; });
function pc() { if (!pcDiv) { pcDiv = document.createElement('div'); pcDiv.style.cssText = 'position:fixed;right:18px;bottom:92px;width:150px;height:150px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 6px #1c1f24,0 6px 24px #000;pointer-events:none;display:none'; c.style.cssText = 'width:100%;height:100%'; pcDiv.appendChild(c); document.body.appendChild(pcDiv); } return pcDiv; }

const tN = new V3(), tC = new V3(), tP = new V3();
let dT = 0, leerT = 0;
export function actualizarReloj(dt) {
  // hora de la historia por capítulo
  if (D && D.capIdx !== reloj.capIdx) { reloj.capIdx = D.capIdx; const m = /(\d{1,2}):(\d{2})/.exec(D.cap?.nota || ''); reloj.base = m ? +m[1] * 60 + +m[2] : null; reloj.t0 = G.time; }
  const iz = J?.leftC?.(), vr = G.mode === 'vr' && G.opciones.reloj && !!iz;
  if (vr && reloj.g.parent !== iz.grip) iz.grip.add(reloj.g);
  reloj.g.visible = vr; if (ui.wrist?.mesh) ui.wrist.mesh.visible = !vr; // el panel flotante solo si no hay reloj
  if (vr) { reloj.cara.getWorldPosition(tP); tN.set(0, 1, 0).applyQuaternion(reloj.cara.parent.getWorldQuaternion(new THREE.Quaternion())); camera.getWorldPosition(tC).sub(tP).normalize(); reloj.mirando = tN.dot(tC) > .55 && tP.distanceTo(camera.getWorldPosition(new V3())) < .6; }
  else reloj.mirando = tab;
  if (G.mode === 'pc') pc().style.display = tab ? 'block' : 'none';
  // un mensaje se da por leído tras 3 s mirándolo
  const msg = reloj.mensajes.find(m => !m.leido); if (msg && reloj.mirando) { leerT += dt; if (leerT > 3) { msg.leido = true; leerT = 0; } } else leerT = 0;
  dT -= dt; if (dT <= 0) { dT = .5; dibujar(); }
}
if (typeof window !== 'undefined') window.__reloj = reloj;
