// Interfaz: HUD de PC (DOM) y paneles en 3D para VR (subtítulos, tarjetas de capítulo, muñeca).
import { THREE, V3, G, $, mix, camera, scene, canvasPlane, wrapText } from './nucleo.js';

const COL = { DAVE: '#7ff3ff', MIKE: '#ffb468', SARAH: '#ffa0c0', HANK: '#c8f07a', JOHN: '#d8c89a', SOLDADO: '#ff8a6a', GUARDIA: '#ff8a6a', RADIO: '#9aa7b8', TELE: '#9aa7b8', LOCUTORA: '#9aa7b8', 'UNIDAD 01': '#29e6ff', VARELA: '#e8a060', 'NÚÑEZ': '#ff8a6a', RATA: '#d9b26a', CHISPA: '#e0c890', MILICIANO: '#ff8a6a', 'MIKE · CINTA': '#ffcf9a', 'MIKE · CONTESTADOR': '#ffcf9a', 'EL REY': '#ff3b3b', 'RADIO · JOHN': '#d8c89a', ORION: '#9fd8ff', NICO: '#9fe0a0' };
export const colorDe = n => COL[n] || '#e9eef5';

// ---------- Paneles VR que siguen la mirada con suavidad ----------
const sigue = new THREE.Group(); scene.add(sigue);
const sub = canvasPlane(1.5, .36, 1024, (x, w, h, a) => {
  x.fillStyle = 'rgba(6,9,16,.86)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 26); x.fill();
  x.font = '700 40px "Chakra Petch",sans-serif'; x.fillStyle = colorDe(a.n); x.fillText(a.n, 34, 58);
  x.font = '500 36px Inter,sans-serif'; x.fillStyle = '#eef2f6'; wrapText(x, a.t, w - 68).slice(0, 3).forEach((l, i) => x.fillText(l, 34, 112 + i * 46));
});
sub.mesh.position.set(0, -.42, -1.5); sub.mesh.renderOrder = 990; sub.mesh.material.depthTest = false; sigue.add(sub.mesh); sub.mesh.visible = false;
const card = canvasPlane(1.8, .6, 1024, (x, w, h, a) => {
  x.fillStyle = 'rgba(4,6,12,.9)'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff3b1f'; x.fillRect(0, h - 8, w, 8);
  x.textAlign = 'center'; x.fillStyle = '#9aa7b8'; x.font = '600 34px Inter,sans-serif'; x.fillText(a.s || '', w / 2, 80);
  x.fillStyle = '#ffffff'; x.font = '700 76px "Chakra Petch",sans-serif'; x.fillText(a.t, w / 2, 190);
  if (a.n) { x.fillStyle = '#7ff3ff'; x.font = '500 30px Inter,sans-serif'; x.fillText(a.n, w / 2, 262); }
});
card.mesh.position.set(0, .05, -2.2); card.mesh.renderOrder = 995; card.mesh.material.depthTest = false; sigue.add(card.mesh); card.mesh.visible = false;
const toastVR = canvasPlane(1.2, .16, 1024, (x, w, h, a) => { x.fillStyle = 'rgba(8,12,22,.85)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 20); x.fill(); x.fillStyle = '#ffcf6a'; x.textAlign = 'center'; x.font = '700 50px "Chakra Petch",sans-serif'; x.fillText(a, w / 2, h / 2 + 18); });
toastVR.mesh.position.set(0, .32, -1.6); toastVR.mesh.renderOrder = 991; toastVR.mesh.material.depthTest = false; sigue.add(toastVR.mesh); toastVR.mesh.visible = false;
// muñeca izquierda
const wrist = canvasPlane(.19, .12, 512, (x, w, h, a) => {
  x.fillStyle = 'rgba(8,12,22,.92)'; x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 18); x.fill();
  x.fillStyle = '#ffcf6a'; x.font = '700 26px "Chakra Petch",sans-serif'; wrapText(x, a.obj || '', w - 32).slice(0, 3).forEach((l, i) => x.fillText(l, 16, 38 + i * 30));
  x.fillStyle = '#1d2433'; x.fillRect(16, 140, w - 32, 14); x.fillStyle = a.hp > 30 ? '#29e6ff' : '#ff3b1f'; x.fillRect(16, 140, (w - 32) * a.hp / 100, 14);
  if (a.det > 0) { x.fillStyle = '#3a1010'; x.fillRect(16, 160, w - 32, 10); x.fillStyle = '#ff3b1f'; x.fillRect(16, 160, (w - 32) * a.det, 10); }
  x.fillStyle = '#fff'; x.font = '700 34px "Chakra Petch",sans-serif'; x.fillText(a.w, 16, 214); x.textAlign = 'right'; x.fillText(a.ammo, w - 16, 214);
  x.textAlign = 'left'; x.fillStyle = '#9aa7b8'; x.font = '500 20px Inter,sans-serif'; x.fillText(a.msg || '', 16, h - 22);
});
wrist.mesh.position.set(0, .07, .1); wrist.mesh.rotation.x = -.6;

let toastT = 0, cardT = 0, wristKey = '', hudKey = '';
export const ui = {
  wrist,
  hint(t) { const el = $('#hint'); if (el && el.textContent !== t) el.textContent = t; },
  objetivo(t) { ui.obj = t || ''; const el = $('#obj'); if (el) { el.textContent = t || ''; el.hidden = !t; } },
  subtitulo(n, t) {
    const el = $('#sub'); if (n) { $('#subN').textContent = n; $('#subN').style.color = colorDe(n); $('#subT').textContent = t; el.hidden = false; sub.set({ n, t }); sub.mesh.visible = G.mode === 'vr'; }
    else { el.hidden = true; sub.mesh.visible = false; }
  },
  tarjeta(t, s, n, dur = 4.5) { $('#cardT').textContent = t; $('#cardS').textContent = s || ''; $('#cardN').textContent = n || ''; $('#card').classList.add('on'); card.set({ t, s, n }); card.mesh.visible = G.mode === 'vr'; cardT = dur; },
  ocultarTarjeta() { cardT = 0; $('#card').classList.remove('on'); card.mesh.visible = false; },
  obj: ''
};
export function say(t) { ui.lastMsg = t; const el = $('#toast'); el.textContent = t.replace('\n', ' · '); el.classList.add('on'); toastT = 2.6; toastVR.set(t.split('\n')[0]); toastVR.mesh.visible = G.mode === 'vr'; }

const tQ = new THREE.Quaternion(), tE = new THREE.Euler(0, 0, 0, 'YXZ'), tP = new V3();
export function actualizarUI(dt, est) {
  // el grupo de paneles sigue a la cabeza con retardo (más cómodo en VR que pegarlo a la cara)
  camera.getWorldPosition(tP); camera.getWorldQuaternion(tQ); tE.setFromQuaternion(tQ, 'YXZ');
  sigue.position.lerp(tP, Math.min(1, dt * 8)); sigue.rotation.y = sigue.rotation.y + (((tE.y - sigue.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) { $('#toast').classList.remove('on'); toastVR.mesh.visible = false; } }
  if (cardT > 0) { cardT -= dt; if (cardT <= 0) ui.ocultarTarjeta(); }
  // muñeca (VR)
  if (G.mode === 'vr') {
    const k = ui.obj + est.hp + est.w + est.ammo + (est.det * 10 | 0) + (ui.lastMsg || '');
    if (k !== wristKey) { wristKey = k; wrist.set({ obj: ui.obj, hp: est.hp, w: est.w, ammo: est.ammo, det: est.det, msg: (ui.lastMsg || '').split('\n')[0].slice(0, 34) }); }
    wrist.mesh.lookAt(G.CAM);
  }
  // HUD de PC
  const key = est.w + est.ammo + est.hp; if (key !== hudKey) { hudKey = key; $('#wName').textContent = est.w; $('#ammo').textContent = est.ammo; $('#hpNum').textContent = est.hp; $('#hpFill').style.width = est.hp + '%'; }
  const det = $('#det'); det.hidden = !(est.det > 0); if (est.det > 0) { $('#detFill').style.width = (est.det * 100) + '%'; det.classList.toggle('visto', !!est.visto); }
  $('#cross').classList.toggle('hit', G.hitT > 0);
}
