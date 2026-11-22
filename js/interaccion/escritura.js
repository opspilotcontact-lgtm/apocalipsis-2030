// Superficies en las que se escribe: pizarra blanca (rotulador), pizarra de tiza y cuaderno.
// VR: la punta del rotulador/tiza que sostienes pinta donde toca la superficie (y el cuerpo físico choca con ella,
// así que la punta «apoya» de verdad). PC: con un rotulador o tiza en la mano, mantén el clic apuntando a la
// superficie. El borrador borra. Cada superficie se guarda en localStorage (apoc2030.trazo.<id>).
import { THREE, V3, cv2d, toTex, rnd } from '../nucleo.js';
import { buzz } from '../fx.js';
import { golpe as sonGolpe } from './sonido.js';
import { cuerpoFijo, alListo } from './fisica-adaptador.js';
import { registrar, raiz } from './objetos.js';

export const superficies = [];
const FONDOS = {
  pizarra: (x, w, h) => { x.fillStyle = '#f2f4f2'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(40,60,90,.05)'; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(rnd(0, w), rnd(0, h), rnd(30, 120), rnd(8, 30), rnd(0, 3), 0, 7); x.fill(); } }, // restos de lo que ya se borró
  tiza: (x, w, h) => { x.fillStyle = '#25392d'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(230,240,230,${Math.random() * .05})`; x.fillRect(rnd(0, w), rnd(0, h), rnd(1, 6), rnd(1, 3)); } },
  cuaderno: (x, w, h) => { x.fillStyle = '#f4efe0'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(70,110,200,.35)'; x.lineWidth = 1; for (let y = h * .1; y < h; y += h / 26) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } x.strokeStyle = 'rgba(210,60,60,.45)'; x.beginPath(); x.moveTo(w * .12, 0); x.lineTo(w * .12, h); x.stroke(); }
};
const MARCOS = { pizarra: 0x9aa2aa, tiza: 0x6a4a2a, cuaderno: null };
// o: { id, tipo: 'pizarra'|'tiza'|'cuaderno', w, h, px, x, y, z, ry, rx (cuaderno tumbado: -PI/2), padre }
export function crearSuperficie(o) {
  const px = o.px || 512, py = Math.round(px * o.h / o.w), [c, x] = cv2d(px, py), [bc, bx] = cv2d(px, py);
  FONDOS[o.tipo](bx, px, py); x.drawImage(bc, 0, 0);
  const tex = toTex(c, false);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshStandardMaterial({ map: tex, roughness: o.tipo === 'pizarra' ? .3 : .9, metalness: 0 }));
  mesh.position.set(o.x, o.y, o.z); mesh.rotation.set(o.rx || 0, o.ry || 0, 0, 'YXZ'); mesh.receiveShadow = true;
  const padre = o.padre || raiz; padre.add(mesh);
  if (MARCOS[o.tipo]) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: MARCOS[o.tipo], roughness: .5, metalness: o.tipo === 'pizarra' ? .7 : 0 }), b = .035;
    for (const [w, h, X, Y] of [[o.w + 2 * b, b, 0, o.h / 2 + b / 2], [o.w + 2 * b, b, 0, -o.h / 2 - b / 2], [b, o.h, -o.w / 2 - b / 2, 0], [b, o.h, o.w / 2 + b / 2, 0]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, .03), m); p.position.set(X, Y, -.008); g.add(p); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, .012), m); back.position.z = -.012; g.add(back); mesh.add(g); }
  const s = { id: o.id, tipo: o.tipo, w: o.w, h: o.h, px, py, c, x, bc, tex, mesh, sucio: false, guardarT: 0, ult: new Map(), label: o.tipo === 'cuaderno' ? 'cuaderno' : 'pizarra', mallas: [mesh] };
  try { const d = localStorage.getItem('apoc2030.trazo.' + o.id); if (d) { const im = new Image(); im.onload = () => { x.drawImage(im, 0, 0); tex.needsUpdate = true; }; im.src = d; } } catch (e) {}
  alListo(() => { mesh.updateMatrixWorld(true); const p = mesh.localToWorld(new V3(0, 0, -.011)), e = new THREE.Euler().setFromQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())); cuerpoFijo([{ f: 'caja', m: [o.w / 2, o.h / 2, .01], c: [p.x, p.y, p.z], rx: e.x, ry: e.y, rz: e.z }]); });
  superficies.push(s); registrar(s); return s;
}
const css = hex => '#' + hex.toString(16).padStart(6, '0');
// pinta (o borra) de la posición local (lx, ly) en metros; clave: quien pinta (para unir trazos)
function pintar(s, lx, ly, herr, clave) {
  const u = (lx / s.w + .5) * s.px, v = (.5 - ly / s.h) * s.py, prev = s.ult.get(clave), x = s.x, k = s.px / 512;
  const a = prev || { u, v };
  if (herr.def.borra) { const r = herr.def.borra * k, n = Math.max(1, Math.ceil(Math.hypot(u - a.u, v - a.v) / (r * .5)));
    for (let i = 1; i <= n; i++) { const cu = a.u + (u - a.u) * i / n, cv = a.v + (v - a.v) * i / n; x.save(); x.beginPath(); x.rect(cu - r, cv - r * .45, r * 2, r * .9); x.clip(); x.globalAlpha = s.tipo === 'tiza' ? .55 : 1; x.drawImage(s.bc, 0, 0); x.restore(); } }
  else { const e = herr.def.escribe, w = e.ancho * k * (s.tipo === 'cuaderno' ? .45 : 1);
    x.strokeStyle = css(herr.color); x.lineCap = x.lineJoin = 'round'; x.globalAlpha = e.alfa;
    if (e.tiza) { for (let i = 0; i < 3; i++) { x.lineWidth = w * rnd(.4, 1); x.beginPath(); x.moveTo(a.u + rnd(-1, 1), a.v + rnd(-1, 1)); x.lineTo(u + rnd(-1, 1), v + rnd(-1, 1)); x.stroke(); } }
    else { x.lineWidth = w; x.beginPath(); x.moveTo(a.u, a.v); x.lineTo(u + (prev ? 0 : .01), v); x.stroke(); }
    x.globalAlpha = 1; }
  s.ult.set(clave, { u, v }); s.sucio = true; s.guardarT = 1.2;
}
function levantar(clave) { for (const s of superficies) s.ult.delete(clave); }
const tL = new V3(), tP = new V3();
let frame = 0, sonT = 0;
// manos: lista de manos (VR y PC) · rayoPC(): hit de la mira contra una superficie (o null)
export function actualizarEscritura(dt, manos, rayoPC) {
  frame++; sonT -= dt;
  for (const m of manos) {
    const pr = m.sostiene, clave = m.id;
    if (!pr || !(pr.def.escribe || pr.def.borra)) { levantar(clave); continue; }
    let toco = false;
    if (m.pc) { // PC: clic mantenido sobre la superficie
      const h = m.usando ? rayoPC(superficies.map(s => s.mesh)) : null;
      if (h && h.distance < 2.6) { const s = superficies.find(q => q.mesh === h.object); tL.copy(h.point); s.mesh.worldToLocal(tL); pintar(s, tL.x, tL.y, pr, clave); toco = true; }
    } else { // VR: la punta toca la superficie
      pr.root.localToWorld(tP.fromArray(pr.def.punta));
      for (const s of superficies) { tL.copy(tP); s.mesh.worldToLocal(tL); if (tL.z < .016 && tL.z > -.03 && Math.abs(tL.x) < s.w / 2 && Math.abs(tL.y) < s.h / 2) { pintar(s, tL.x, tL.y, pr, clave); toco = true; if (frame % 4 === 0) buzz(m.c, .12, 15); break; } }
    }
    if (!toco) levantar(clave);
    else if (sonT <= 0) { sonT = .14; sonGolpe('papel', tP.copy(pr.root.position), pr.def.borra ? .25 : .06); }
  }
  for (const s of superficies) {
    if (s.sucio && frame % 2 === 0) { s.tex.needsUpdate = true; s.sucio = false; }
    if (s.guardarT > 0) { s.guardarT -= dt; if (s.guardarT <= 0) try { localStorage.setItem('apoc2030.trazo.' + s.id, s.c.toDataURL('image/png')); } catch (e) {} }
  }
}
export function limpiarSuperficie(id) { const s = superficies.find(q => q.id === id); if (!s) return; s.x.drawImage(s.bc, 0, 0); s.tex.needsUpdate = true; try { localStorage.removeItem('apoc2030.trazo.' + id); } catch (e) {} }
// trazo de prueba (depuración): puntos [[lx, ly], …] en metros locales
export function trazoPrueba(id, pts, herr) { const s = superficies.find(q => q.id === id); if (!s) return false; for (const [a, b] of pts) pintar(s, a, b, herr, 'prueba'); levantar('prueba'); return true; }
