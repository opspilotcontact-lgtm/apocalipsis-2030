// Guía visual estilo RE (docs/PLAN-MAESTRO.md §2): sin flechas permanentes.
//   ámbar = interactuable importante (brillo suave / contorno) · cinta amarilla = ruta física (romper, trepar)
//   cian = tecnología de Mike · rojo = El Rey
// Ayuda progresiva: guia.pista({ objetivo, nivel, linea }) arranca el reloj del paso; a los 60 s sin progreso se
// enciende el brillo; a los 120 s Dave lo comenta (subtítulo). guia.limpiar() al cumplir el paso.
// «Guía clásica» (G.opciones.guiaClasica, apagada por defecto): rombo flotante sobre el objetivo desde el principio.
// API: guia.resaltar(idOPos, nivel = 'ambar', o) → asa · guia.quitar(asa) · guia.limpiar() · guia.pista(o) · guia.cinta(...)
import { THREE, V3, G, scene, cv2d, toTex } from '../nucleo.js';
import { PUNTOS } from '../mundo/tierra.js';
import { poner } from '../interaccion/opciones.js';
import { ui } from '../ui.js';

const COLOR = { ambar: 0xffa63a, cian: 0x29e6ff, rojo: 0xff3a2a, cinta: 0xffd21a };
const asas = new Set();
const tA = new V3();
if (G.opciones && G.opciones.guiaClasica === undefined) G.opciones.guiaClasica = false;

// textura de halo (degradado radial) compartida
const halo = (() => { const [c, x] = cv2d(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return toTex(c, false); })();
// cinta amarilla y negra (rayas diagonales)
const rayas = (() => { const [c, x] = cv2d(128, 16); x.fillStyle = '#ffd21a'; x.fillRect(0, 0, 128, 16); x.fillStyle = '#151515'; for (let i = -16; i < 128; i += 16) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + 8, 0); x.lineTo(i + 14, 0); x.lineTo(i + 6, 16); x.fill(); } const t = toTex(c, false); t.wrapS = THREE.RepeatWrapping; return t; })();

function aPunto(o, y = 1) {
  if (typeof o === 'string') { const p = PUNTOS[o]; return p ? new V3(p[0], y, p[1]) : null; }
  if (Array.isArray(o)) return o.length === 3 ? new V3(o[0], o[1], o[2]) : new V3(o[0], y, o[1]);
  if (o?.isVector3) return o.clone();
  return null;
}
// nivel: 'ambar' | 'cian' | 'rojo' | 'cinta' | número (0 = quitar, 1 = suave, 2 = latido fuerte)
// o: { y (altura del halo), escala, clasico (fuerza el rombo), ancho/alto/ry (cinta) }
export function resaltar(objetivo, nivel = 'ambar', o = {}) {
  if (nivel === 0) { limpiar(); return null; }
  const tipo = typeof nivel === 'string' ? nivel : 'ambar', fuerza = typeof nivel === 'number' ? nivel : (o.fuerza || 1);
  if (tipo === 'cinta') return cinta(objetivo, o);
  const col = COLOR[tipo] || COLOR.ambar, asa = { tipo, fuerza, partes: [], t: 0 };
  if (objetivo?.isObject3D) { // contorno: concha por detrás de las primeras mallas
    let n = 0; objetivo.traverse(m => { if (!m.isMesh || n >= 4 || m.userData.guia) return; n++;
      const s = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .25, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.userData.guia = true; s.raycast = () => {}; s.scale.setScalar(1.06); m.add(s); asa.partes.push(s); });
    objetivo.getWorldPosition(tA); asa.pos = tA.clone(); asa.pos.y += .3;
  } else asa.pos = aPunto(objetivo, o.y ?? 1);
  if (!asa.pos) return null;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: col, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sp.position.copy(asa.pos); sp.scale.setScalar(o.escala || .7); scene.add(sp); asa.partes.push(sp); asa.halo = sp;
  if (o.clasico || G.opciones?.guiaClasica) asa.partes.push(asa.rombo = rombo(asa.pos, col));
  asas.add(asa); return asa;
}
function rombo(p, col) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .85, depthTest: false, toneMapped: false })); m.renderOrder = 997; m.position.copy(p); m.position.y += .9; m.scale.y = 1.6; scene.add(m); return m; }
// cinta amarilla en X sobre una ruta física: cinta('lab.trasera') o cinta([x,y,z], { ancho, alto, ry })
const CINTAS = { 'lab.trasera': { p: [-8.5, 1.26, -147.88], ancho: 1.5, alto: 2.3, ry: Math.PI } };
export function cinta(objetivo, o = {}) {
  const pre = typeof objetivo === 'string' && CINTAS[objetivo]; const c = { ...(pre || {}), ...o };
  const p = pre ? new V3(...pre.p) : aPunto(objetivo, o.y ?? 1.3); if (!p) return null;
  const asa = { tipo: 'cinta', fuerza: 1, partes: [], t: 0, pos: p }, w = c.ancho || 1.2, h = c.alto || 1.6, L = Math.hypot(w, h), a = Math.atan2(h, w);
  for (const s of [1, -1]) { const t = rayas.clone(); t.repeat.set(L / .5, 1); t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, .09), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.copy(p); m.rotation.set(0, c.ry || 0, s * a); m.raycast = () => {}; scene.add(m); asa.partes.push(m); }
  asas.add(asa); return asa;
}
export function quitar(asa) { if (!asa) return; for (const m of asa.partes) { m.removeFromParent(); m.material?.dispose?.(); } asas.delete(asa); }
export function limpiar() { for (const a of [...asas]) quitar(a); pistaActual = null; }

// ---------- Ayuda progresiva ----------
// o: { objetivo, nivel ('ambar'…), linea: texto de Dave o { n, t }, t1 = 60, t2 = 120, alDecir: fn }
let pistaActual = null;
export function pista(o) {
  limpiar(); pistaActual = { ...o, t: 0, fase: 0, t1: o.t1 ?? 60, t2: o.t2 ?? 120 };
  if (G.opciones?.guiaClasica && o.objetivo) { pistaActual.asa = resaltar(o.objetivo, o.nivel || 'ambar', { clasico: true }); pistaActual.fase = 1; }
  return pistaActual;
}
export function progreso() { if (pistaActual) { pistaActual.t = 0; } } // el jugador hizo algo útil: reinicia el reloj
export function actualizarGuia(dt) {
  for (const a of asas) { a.t += dt;
    const k = a.fuerza >= 2 ? .55 + Math.sin(a.t * 5) * .35 : .35 + Math.sin(a.t * 2.2) * .15;
    for (const m of a.partes) if (m !== a.rombo && a.tipo !== 'cinta') m.material.opacity = m === a.halo ? k : k * .6;
    if (a.rombo) { a.rombo.rotation.y += dt * 2; a.rombo.position.y = a.pos.y + .9 + Math.sin(a.t * 2) * .06; }
  }
  const p = pistaActual; if (!p || !G.playing && G.mode !== 'vr') return;
  p.t += dt;
  if (p.fase < 1 && p.t >= p.t1 && p.objetivo) { p.asa = resaltar(p.objetivo, p.nivel || 'ambar'); p.fase = 1; }
  if (p.fase < 2 && p.t >= p.t2) { p.fase = 2; if (p.asa) p.asa.fuerza = 2;
    if (p.linea) { const n = p.linea.n || 'DAVE', t = p.linea.t || p.linea; ui.subtitulo(n, t); setTimeout(() => ui.subtitulo(null), 4000); }
    p.alDecir?.(); }
}

// ---------- Opción en el panel de Comodidad ----------
export function montarOpcion() {
  const cont = document.getElementById('comodidadBotones'); if (!cont || document.getElementById('optGuia')) return;
  const b = document.createElement('button'); b.id = 'optGuia';
  const pintar = () => { b.textContent = 'Guía clásica (marcador): ' + (G.opciones.guiaClasica ? 'sí' : 'no'); };
  b.onclick = () => { poner('guiaClasica', !G.opciones.guiaClasica); pintar(); }; pintar(); cont.appendChild(b);
}
export const guia = { resaltar, cinta, quitar, limpiar, pista, progreso, get pistaActual() { return pistaActual; } };
