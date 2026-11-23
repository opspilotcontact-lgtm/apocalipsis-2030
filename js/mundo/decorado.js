// Decorado estático: muebles, arquitectura, rótulos, coches y atrezo que nunca se mueve.
// Todo se construye con mallas estáticas que hornear() fusiona por material y por zona (cada zona se oculta
// cuando la cámara está lejos). Los materiales con vertexColors (pintado, metalV, brillo, tela, pintura)
// llevan el color en cada vértice, así decenas de objetos distintos comparten una sola llamada de dibujo.
// Las superficies libres (encimeras, mesas, estantes) se listan en `superficies` para que el sistema de
// interacción ponga encima los objetos que se cogen.
import { THREE, V3, M, std, glow, pieza, addCollider, B, zona, cv2d, toTex, canvasTex, fuenteLuz, rnd, rbox, markStatic, materialesVentana, texPBR, en, hornearLienzo } from '../nucleo.js';

export const superficies = []; // { zona, x, y, z, w, d, ry } en coordenadas de mundo (centro de la cara superior)
const supf = (x, y, z, w, d, ry = 0) => superficies.push({ zona: B.zona, x: x + B.ox, y, z: z + B.oz, w, d, ry });

// ---------- Ayudas de construcción ----------
const _c = new THREE.Color();
function colorear(g, hex) { _c.set(hex ?? 0xffffff); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function uvCaja(g, w, h, d, s) { const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / s, uv.getY(j) * dims[f][1] / s); } }
// grupo de un mueble: coordenadas locales, giro ry; al hornear sus piezas se fusionan con el resto
function grupo(x, y, z, ry = 0) { const g = new THREE.Group(); pieza(g, x, y, z, { ry, static: false, cast: false }); return g; }
function meter(par, m, x, y, z, o = {}) {
  m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = !!o.cast; m.receiveShadow = true; markStatic(m, o.shoot !== false); par.add(m); return m;
}
function geoColor(g, mat, c) { if (mat.vertexColors) colorear(g, c); return g; }
// caja w×h×d con el centro en (x,y,z) locales del grupo
function bx(par, w, h, d, mat, x, y, z, o = {}) { const g = new THREE.BoxGeometry(w, h, d); uvCaja(g, w, h, d, o.s || 1); return meter(par, new THREE.Mesh(geoColor(g, mat, o.c), mat), x, y, z, o); }
function rb(par, w, h, d, mat, x, y, z, o = {}) { const g = rbox(w, h, d).clone(); return meter(par, new THREE.Mesh(geoColor(g, mat, o.c), mat), x, y, z, o); }
function ci(par, r, h, mat, x, y, z, o = {}) { const g = new THREE.CylinderGeometry(r, o.r2 ?? r, h, o.seg || 12, 1, !!o.abierto); return meter(par, new THREE.Mesh(geoColor(g, mat, o.c), mat), x, y, z, o); }
function es(par, r, mat, x, y, z, o = {}) { const g = new THREE.SphereGeometry(r, o.seg || 10, o.seg2 || 8); if (o.sy) g.scale(1, o.sy, 1); return meter(par, new THREE.Mesh(geoColor(g, mat, o.c), mat), x, y, z, o); }
function to(par, r, t, mat, x, y, z, o = {}) { const g = new THREE.TorusGeometry(r, t, o.seg || 6, o.seg2 || 16, o.arco || Math.PI * 2); return meter(par, new THREE.Mesh(geoColor(g, mat, o.c), mat), x, y, z, o); }
// plano con UV recortadas a un rectángulo del atlas (r = [x, y, w, h] en píxeles del lienzo W×H)
function pl(par, w, h, mat, x, y, z, o = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  if (o.r) { const [rx, ry, rw, rh] = o.r, W = o.W || 2048, H = o.H || 1024, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / W, 1 - (ry + (1 - uv.getY(i)) * rh) / H); }
  else if (o.s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / o.s, uv.getY(i) * h / o.s); }
  return meter(par, new THREE.Mesh(geoColor(g, mat, o.c), mat), x, y, z, o);
}
// barra entre dos puntos (tubos, patas inclinadas, pilares)
function barra(par, a, b, r, mat, o = {}) { const d = new V3().subVectors(b, a), L = d.length(), g = new THREE.CylinderGeometry(r, r, L, o.seg || 6); g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize())); return meter(par, new THREE.Mesh(geoColor(g, mat, o.c), mat), a.x, a.y, a.z, o); }
// colisión de una caja girada (caja envolvente alineada a los ejes)
function colGirado(x, z, w, d, ry, top) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2; addCollider(x - hx, x + hx, z - hz, z + hz, top); }

// ---------- Atlas de rótulos, fotos, carteles y pantallas (un lienzo, dos materiales) ----------
const AW = 2048, AH = 1024;
const [atC, atX] = cv2d(AW, AH);
export const RECT = {};
function cel(nombre, x, y, w, h, dibujar) { RECT[nombre] = [x, y, w, h]; atX.save(); atX.beginPath(); atX.rect(x, y, w, h); atX.clip(); atX.translate(x, y); dibujar(atX, w, h); atX.restore(); }
const fuente = (px, peso = 700) => `${peso} ${px}px "Chakra Petch","Arial Narrow",sans-serif`;
function ruidoLienzo(x, w, h, n, a) { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},${Math.random() * a})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }
// rótulos de tiendas
const TIENDAS = [['FARMACIA', '#0f6e3a', '#e9fff1', '✚'], ['BAR LUCÍA', '#5a1e14', '#ffd9a0', ''], ['PANADERÍA EL TRIGAL', '#6b4a1e', '#fff0cc', ''], ['FERRETERÍA HNOS. GIL', '#1d3a66', '#ffffff', ''], ['PELUQUERÍA MARI', '#6a1d4a', '#ffe0f2', ''], ['ESTANCO', '#7a1414', '#ffde6a', 'T'], ['ULTRAMARINOS', '#2b4a2a', '#f4ecd0', '']];
TIENDAS.forEach(([t, fondo, letra, ic], i) => cel('rot' + i, 0, i * 96, 512, 96, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, fondo); g.addColorStop(1, '#111'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = letra; x.font = fuente(46); x.textAlign = 'center'; x.textBaseline = 'middle'; let z = 46; while (x.measureText(t).width > w - 70 && z > 20) { z -= 2; x.font = fuente(z); } x.fillText(t, w / 2 + (ic ? 18 : 0), h / 2 + 2);
  if (ic) { x.fillStyle = ic === '✚' ? '#3cff7a' : '#ffde6a'; x.font = fuente(54); x.fillText(ic, 42, h / 2 + 2); }
  ruidoLienzo(x, w, h, 600, .12);
}));
// escaparates: interiores iluminados vistos a través del cristal (estantes, productos, lámparas, siluetas)
const INTER = [['#ffd59a', '#7a4a20'], ['#fff1d6', '#2c5a38'], ['#ffc98a', '#5a2c18'], ['#d8ecff', '#2a3e5a']];
INTER.forEach(([luz, mueble], i) => cel('esc' + i, 512 + i * 384, 0, 384, 256, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, luz); g.addColorStop(.7, '#6a5040'); g.addColorStop(1, '#1a1410'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 3; k++) { const lx = w * (.2 + k * .3); const rg = x.createRadialGradient(lx, 8, 2, lx, 40, 90); rg.addColorStop(0, 'rgba(255,255,240,.9)'); rg.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = rg; x.fillRect(0, 0, w, 120); }
  x.fillStyle = mueble; for (let s = 0; s < 4; s++) { const y = 60 + s * 42; x.fillRect(10, y, w * .42, 6); x.fillRect(w * .58, y, w * .4, 6); for (let p = 0; p < 9; p++) { x.fillStyle = `hsl(${rnd(0, 360)},${rnd(12, 40)}%,${rnd(28, 55)}%)`; x.fillRect(14 + p * 17, y - rnd(12, 30), 12, 30); x.fillRect(w * .58 + 4 + p * 16, y - rnd(12, 30), 11, 30); } x.fillStyle = mueble; }
  x.fillStyle = 'rgba(30,20,15,.85)'; x.fillRect(w * .3, h * .62, w * .4, h * .38); // mostrador
  if (i % 2 === 0) { x.fillStyle = 'rgba(20,14,10,.8)'; x.beginPath(); x.arc(w * .5, h * .42, 16, 0, 7); x.fill(); x.fillRect(w * .5 - 20, h * .46, 40, 60); } // dependiente
  ruidoLienzo(x, w, h, 500, .1);
}));
// grafitis y carteles pegados (pared baja de los edificios)
const GRAF = ['NO A LOS R7', 'LÁZARO MIENTE', 'RESISTE', 'FIESTAS 2030', 'SE ALQUILA', 'CONCIERTO'];
GRAF.forEach((t, i) => cel('gr' + i, 512 + i * 256, 256, 256, 256, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  if (i < 3) { x.save(); x.translate(w / 2, h / 2); x.rotate(rnd(-.25, .15)); x.font = fuente(44); x.textAlign = 'center'; x.lineJoin = 'round'; x.lineWidth = 12; x.strokeStyle = ['#111', '#fff', '#222'][i]; x.strokeText(t, 0, 0); x.fillStyle = ['#ff3b2f', '#29c6ff', '#ffd400'][i]; x.fillText(t, 0, 0); x.restore(); for (let k = 0; k < 14; k++) { x.fillStyle = x.fillStyle; x.fillRect(rnd(30, 220), rnd(140, 170), 3, rnd(6, 40)); } }
  else { x.fillStyle = ['#f2e6c8', '#ffffff', '#1d1d24'][i - 3]; x.fillRect(30, 20, w - 60, h - 40); x.fillStyle = ['#a01818', '#1a4a9a', '#ffcf40'][i - 3]; x.font = fuente(30); x.textAlign = 'center'; x.fillText(t, w / 2, 70); x.font = fuente(16, 500); x.fillStyle = '#333'; for (let l = 0; l < 6; l++) x.fillRect(50, 100 + l * 18, rnd(80, 150), 6); x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(w - 30, h - 20); x.lineTo(w - 90, h - 20); x.lineTo(w - 30, h - 80); x.fill(); }
}));
// fotos familiares, dibujos de niños y cuadros
function foto(x, w, h, cielo, gente) { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, cielo); g.addColorStop(.6, '#d8c8a8'); g.addColorStop(1, '#6a7a4a'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let p = 0; p < gente; p++) { const px = w * (.25 + p * .5 / Math.max(1, gente - 1)), s = p === gente - 1 && gente > 2 ? .65 : 1; x.fillStyle = ['#5a3a2a', '#c86a4a', '#2a3a6a', '#e0b070'][p % 4]; x.beginPath(); x.arc(px, h * (.48 + (1 - s) * .2), 16 * s, 0, 7); x.fill(); x.fillRect(px - 20 * s, h * (.56 + (1 - s) * .2), 40 * s, h * .5); } x.strokeStyle = '#fff'; x.lineWidth = 14; x.strokeRect(0, 0, w, h); }
cel('foto0', 512, 512, 256, 256, (x, w, h) => foto(x, w, h, '#8ec3ff', 3));
cel('foto1', 768, 512, 256, 256, (x, w, h) => foto(x, w, h, '#ffb070', 2));
cel('foto2', 1024, 512, 256, 256, (x, w, h) => foto(x, w, h, '#a0d0ff', 4));
cel('dibujo0', 1280, 512, 256, 256, (x, w, h) => { x.fillStyle = '#fbfbf4'; x.fillRect(0, 0, w, h); x.lineWidth = 6; x.lineCap = 'round'; x.strokeStyle = '#e8a000'; x.beginPath(); x.arc(200, 50, 26, 0, 7); x.stroke(); for (let k = 0; k < 8; k++) { const a = k * .8; x.beginPath(); x.moveTo(200 + Math.cos(a) * 34, 50 + Math.sin(a) * 34); x.lineTo(200 + Math.cos(a) * 50, 50 + Math.sin(a) * 50); x.stroke(); } x.strokeStyle = '#c0282a'; x.strokeRect(50, 120, 100, 80); x.beginPath(); x.moveTo(40, 120); x.lineTo(100, 70); x.lineTo(160, 120); x.stroke(); x.strokeStyle = '#2a60c0'; x.strokeRect(85, 160, 26, 40); x.strokeStyle = '#2a9a3a'; x.beginPath(); x.moveTo(0, 210); x.quadraticCurveTo(128, 190, 256, 215); x.stroke(); x.fillStyle = '#555'; x.font = '700 22px "Comic Sans MS",cursive'; x.fillText('MI CASA', 140, 245); });
cel('dibujo1', 1536, 512, 256, 256, (x, w, h) => { x.fillStyle = '#fffdf2'; x.fillRect(0, 0, w, h); x.lineWidth = 5; x.lineCap = 'round'; const fig = (fx, s, c) => { x.strokeStyle = c; x.beginPath(); x.arc(fx, 90, 18 * s, 0, 7); x.moveTo(fx, 90 + 18 * s); x.lineTo(fx, 160); x.moveTo(fx - 28 * s, 120); x.lineTo(fx + 28 * s, 120); x.moveTo(fx, 160); x.lineTo(fx - 18, 205); x.moveTo(fx, 160); x.lineTo(fx + 18, 205); x.stroke(); }; fig(60, 1.1, '#2a60c0'); fig(130, 1, '#d0308a'); fig(200, .7, '#e07000'); x.fillStyle = '#222'; x.font = '700 20px "Comic Sans MS",cursive'; x.fillText('PAPÁ  MAMÁ  YO', 22, 245); x.fillStyle = '#e02020'; x.beginPath(); x.arc(95, 40, 10, 0, 7); x.arc(110, 40, 10, 0, 7); x.fill(); });
cel('cuadro0', 1792, 512, 256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f0b070'); g.addColorStop(.55, '#d8705a'); g.addColorStop(.56, '#3a4a5a'); g.addColorStop(1, '#1a2430'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff4c0'; x.beginPath(); x.arc(150, 130, 28, 0, 7); x.fill(); x.fillStyle = 'rgba(20,30,40,.8)'; x.beginPath(); x.moveTo(0, 150); x.lineTo(70, 90); x.lineTo(130, 140); x.lineTo(256, 100); x.lineTo(256, 160); x.lineTo(0, 170); x.fill(); ruidoLienzo(x, w, h, 900, .15); });
// laboratorio: carteles de seguridad, tabla periódica, pantallas con código
cel('seg0', 512, 768, 256, 256, (x, w, h) => { x.fillStyle = '#ffd400'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.beginPath(); x.moveTo(128, 30); x.lineTo(230, 200); x.lineTo(26, 200); x.closePath(); x.fill(); x.fillStyle = '#ffd400'; x.beginPath(); x.moveTo(128, 62); x.lineTo(205, 188); x.lineTo(51, 188); x.closePath(); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.moveTo(140, 80); x.lineTo(110, 140); x.lineTo(132, 140); x.lineTo(115, 180); x.lineTo(150, 125); x.lineTo(128, 125); x.closePath(); x.fill(); x.font = fuente(24); x.textAlign = 'center'; x.fillText('ALTO VOLTAJE', 128, 236); });
cel('seg1', 768, 768, 256, 256, (x, w, h) => { x.fillStyle = '#0a7a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = fuente(58); x.textAlign = 'center'; x.fillText('SALIDA', 128, 150); x.beginPath(); x.moveTo(40, 180); x.lineTo(90, 180); x.lineTo(90, 165); x.lineTo(120, 195); x.lineTo(90, 225); x.lineTo(90, 210); x.lineTo(40, 210); x.fill(); });
cel('tabla', 1024, 768, 256, 256, (x, w, h) => { x.fillStyle = '#f4f4ee'; x.fillRect(0, 0, w, h); const cols = ['#ffb0a0', '#ffe0a0', '#b0e0ff', '#c0ffc0', '#e0c0ff']; for (let r = 0; r < 7; r++) for (let c = 0; c < 18; c++) { if (r === 0 && c > 0 && c < 17) continue; if ((r === 1 || r === 2) && c > 1 && c < 12) continue; x.fillStyle = cols[(c + r) % 5]; x.fillRect(8 + c * 13.4, 40 + r * 24, 12, 22); } x.fillStyle = '#223'; x.font = fuente(18); x.fillText('TABLA PERIÓDICA', 40, 28); });
cel('codigo', 1280, 768, 256, 256, (x, w, h) => { x.fillStyle = '#03120a'; x.fillRect(0, 0, w, h); x.font = '500 11px monospace'; for (let l = 0; l < 20; l++) { x.fillStyle = ['#4cff8a', '#29e6ff', '#ffcf6a', '#7a8a90'][l % 4]; x.fillText('  '.repeat(l % 4) + ['def copia(sujeto):', 'chip.leer(ondas)', 'if alfa > beta:', 'return conciencia', 'sync(LZR-0001)', '# NO EJECUTAR'][l % 6], 6, 14 + l * 12); } });
cel('grafica', 1536, 768, 256, 256, (x, w, h) => { x.fillStyle = '#05080f'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(41,230,255,.2)'; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } x.strokeStyle = '#29e6ff'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i < w; i++) x.lineTo(i, 128 + Math.sin(i * .07) * 40 * Math.sin(i * .013) + rnd(-4, 4)); x.stroke(); x.strokeStyle = '#ff5a4a'; x.beginPath(); for (let i = 0; i < w; i++) x.lineTo(i, 200 + Math.sin(i * .2) * 10); x.stroke(); });
cel('reloj', 1792, 768, 256, 256, (x, w, h) => { x.fillStyle = '#f8f8f4'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill(); x.strokeStyle = '#222'; x.lineWidth = 10; x.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; x.lineWidth = 6; x.beginPath(); x.moveTo(128 + Math.cos(a) * 95, 128 + Math.sin(a) * 95); x.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); x.stroke(); } x.lineWidth = 8; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + 50, 128 - 30); x.moveTo(128, 128); x.lineTo(128 - 10, 128 - 85); x.stroke(); });
// anuncio de la marquesina
cel('anuncio', 0, 672, 512, 352, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0b1a3a'); g.addColorStop(1, '#3a0b2a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#29e6ff'; x.font = fuente(46); x.fillText('LÁZARO SYSTEMS', 30, 90); x.fillStyle = '#fff'; x.font = fuente(26, 500); x.fillText('Tu ayudante R-7 desde 99 €/mes', 30, 140); x.fillStyle = 'rgba(200,220,255,.85)'; x.beginPath(); x.arc(380, 240, 70, 0, 7); x.fill(); x.fillStyle = '#0b1a3a'; x.fillRect(340, 225, 80, 14); x.fillStyle = '#ff3b1f'; x.fillRect(350, 228, 60, 8); x.fillStyle = '#ffcf6a'; x.font = fuente(22); x.fillText('«Nunca más solo»', 30, 300); });
const atlasTex = hornearLienzo(toTex(atC, false), 'atlas_decorado'); atlasTex.anisotropy = 8; // KTX2 horneado si existe (10,7 → ~2,7 MB)
const rotulo = std({ map: atlasTex, roughness: .6, metalness: 0 });                                           // fotos, carteles (sin luz propia)
const rotuloLuz = std({ map: atlasTex, emissiveMap: atlasTex, emissive: 0xffffff, emissiveIntensity: 1, roughness: .35 }); // rótulos y pantallas encendidas
const escaparate = std({ map: atlasTex, emissiveMap: atlasTex, emissive: 0xffffff, emissiveIntensity: 1, roughness: .06, metalness: .2 });
const graffiti = std({ map: atlasTex, transparent: true, alphaTest: .35, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
materialesVentana.push(rotuloLuz, escaparate); // aplicarHora regula su brillo con la hora del día

// lomos de libros (estanterías de casa y de la tienda)
const libros = std({ map: canvasTex(512, (x, s) => {
  x.fillStyle = '#2a1e14'; x.fillRect(0, 0, s, s);
  for (let fila = 0; fila < 4; fila++) { let px = 0; const y0 = fila * 128; while (px < s) { const w = rnd(10, 26), hh = rnd(90, 124); x.fillStyle = `hsl(${[0, 25, 40, 120, 200, 220, 280][Math.floor(rnd(0, 7))]},${rnd(25, 60)}%,${rnd(18, 45)}%)`; x.fillRect(px, y0 + 128 - hh, w - 1.5, hh); x.fillStyle = 'rgba(230,200,120,.7)'; x.fillRect(px + 2, y0 + 128 - hh + 10, w - 5, 3); x.fillRect(px + 2, y0 + 128 - hh + rnd(30, 60), w - 5, rnd(6, 14)); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px + w - 4, y0 + 128 - hh, 2, hh); px += w; } }
}), roughness: .8 });
// rayas del toldo (multiplicadas por el color de cada vértice)
const toldo = std({ map: canvasTex(64, (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#cfcfcf'; x.fillRect(i * 8, 0, 8, s); } x.fillStyle = 'rgba(0,0,0,.08)'; for (let k = 0; k < 300; k++) x.fillRect(Math.random() * s, Math.random() * s, 1, 1); }), vertexColors: true, roughness: .9, side: THREE.DoubleSide });
const cristalVentana = std({ color: 0x0c1622, roughness: .04, metalness: .3, emissive: 0x0a1626, emissiveIntensity: .5 });
export const hojas = std({ color: 0x3e6a2e, roughness: .8, side: THREE.DoubleSide, flatShading: true });

// ---------- Coche procedural (carrocería con pasos de rueda, cristales, interior y luces) ----------
const perfilCoche = (() => {
  const s = new THREE.Shape(); s.moveTo(-2.15, .3); s.lineTo(-1.77, .3); s.absarc(-1.35, .33, .42, Math.PI, 0, true); s.lineTo(.93, .3); s.absarc(1.35, .33, .42, Math.PI, 0, true);
  s.lineTo(2.15, .3); s.lineTo(2.22, .55); s.lineTo(2.16, .78); s.quadraticCurveTo(1.6, .94, .9, .98); s.lineTo(-1.5, 1.0); s.quadraticCurveTo(-2.06, .99, -2.2, .8); s.lineTo(-2.22, .45); s.lineTo(-2.15, .3);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: .06, bevelSize: .05, bevelSegments: 2, curveSegments: 8 }); g.translate(0, 0, -.85); return g;
})();
const cabinaCoche = (() => { const s = new THREE.Shape(); s.moveTo(.9, .98); s.lineTo(.08, 1.42); s.lineTo(-.92, 1.44); s.lineTo(-1.55, 1.0); s.lineTo(.9, .98); const g = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 1 }); g.translate(0, 0, -.75); return g; })();
const COLORES_COCHE = [0x7a1e1e, 0x1e3a6a, 0xb8b8b0, 0x2a2c30, 0x4a5a3a, 0xd8d4c8, 0x6a4a2a];
// eje largo del coche = z local (como los bloques viejos: ry = 0 → morro hacia +z)
export function coche(x, z, ry = 0, o = {}) {
  const q = !!o.quemado, col = o.color ?? COLORES_COCHE[Math.floor(Math.random() * COLORES_COCHE.length)];
  const g = grupo(x, q ? -.12 : 0, z, ry), k = new THREE.Group(); k.rotation.y = -Math.PI / 2; g.add(k); // dentro de k el largo va por x
  const carr = q ? M.rust : M.pintura, cc = q ? undefined : col;
  meter(k, new THREE.Mesh(geoColor(perfilCoche.clone(), carr, cc), carr), 0, 0, 0, { cast: true });
  if (!q) meter(k, new THREE.Mesh(cabinaCoche.clone(), M.vidrioCoche), 0, 0, 0, { shoot: false });
  // techo y pilares (pintura)
  bx(k, 1.02, .05, 1.56, carr, -.42, 1.45, 0, { c: cc, cast: true });
  for (const sz of [-.77, .77]) { bx(k, .07, .46, .06, carr, -.42, 1.21, sz, { c: cc }); barra(k, new V3(.88, .99, sz), new V3(.08, 1.43, sz), .035, carr, { c: cc }); barra(k, new V3(-1.53, 1.01, sz), new V3(-.92, 1.44, sz), .045, carr, { c: cc }); }
  // paragolpes, rejilla, matrícula, retrovisores, tiradores
  for (const sx of [-1, 1]) { bx(k, .14, .2, 1.84, M.pintado, sx * 2.22, .42, 0, { c: 0x1a1a1c }); bx(k, .03, .12, .52, M.pintado, sx * 2.29, .42, 0, { c: 0xe8e8e0 }); }
  bx(k, .04, .14, .9, M.pintado, 2.21, .66, 0, { c: 0x0e0e10 });
  for (const sz of [-1, 1]) { bx(k, .16, .1, .12, carr, .78, 1.05, sz * .96, { c: cc }); bx(k, .12, .025, .03, M.metalV, .1, .86, sz * .91, { c: 0xc8ccd0 }); bx(k, .12, .025, .03, M.metalV, -.85, .86, sz * .91, { c: 0xc8ccd0 }); }
  // faros y pilotos
  for (const sz of [-.62, .62]) { bx(k, .05, .13, .32, q ? M.pintado : M.brillo, 2.19, .7, sz, { c: q ? 0x1a1a1a : 0xf4f1e6 }); bx(k, .05, .12, .3, M.brillo, -2.21, .78, sz, { c: q ? 0x2a1010 : 0xa0140e }); }
  // ruedas (neumático + llanta); el quemado se queda sobre las llantas
  for (const sx of [-1.35, 1.35]) for (const sz of [-.8, .8]) { if (!q) ci(k, .33, .22, M.goma, sx, .33, sz, { rx: Math.PI / 2, seg: 16 }); ci(k, .2, .24, M.metalV, sx, .33, sz * 1.005, { rx: Math.PI / 2, seg: 10, c: q ? 0x3a3430 : 0x9aa0a8 }); }
  // interior: asientos, salpicadero, volante
  const tap = q ? 0x0c0b0a : 0x2a2826;
  for (const sz of [-.38, .38]) { bx(k, .5, .14, .5, M.tela, .05, .72, sz, { c: tap }); bx(k, .12, .6, .5, M.tela, -.25, 1.0, sz, { c: tap, rz: -.15 }); }
  bx(k, .5, .14, 1.36, M.tela, -1.05, .72, 0, { c: tap }); bx(k, .12, .55, 1.36, M.tela, -1.35, .98, 0, { c: tap, rz: -.2 });
  bx(k, .4, .2, 1.5, M.pintado, .72, .98, 0, { c: q ? 0x0a0a0a : 0x1c1c1e }); if (!q) to(k, .17, .022, M.metalV, .48, 1.05, -.38, { ry: Math.PI / 2, rz: .4, c: 0x202022 });
  // colisión (como el bloque antiguo: 1,9 × 4,3)
  colGirado(x, z, 1.9, 4.4, ry, 1.1);
  return g;
}

// ---------- Casa de Dave (x 14..26, z 79.5..89.5; puerta al norte en x 19..21) ----------
export function casaDave() {
  zona('casaDave', 20, 84.5, 34, () => {
    const H = 3.2, xi0 = 14.15, xi1 = 25.85, zi0 = 79.65, zi1 = 89.35;
    const raiz = grupo(0, 0, 0);
    // suelo de cocina (baldosa) sobre el laminado, rodapiés, marcos de puerta, interruptor
    pl(raiz, xi1 - 20.6, zi1 - zi0, M.tiles, (20.6 + xi1) / 2, .036, (zi0 + zi1) / 2, { rx: -Math.PI / 2, s: 1.2, shoot: false });
    bx(raiz, .04, .012, zi1 - zi0, M.metalV, 20.6, .04, (zi0 + zi1) / 2, { c: 0xb0a890 }); // perfil de transición
    const rod = 0xf2eee6;
    for (const [x0, x1] of [[xi0, 19], [21, xi1]]) bx(raiz, x1 - x0, .09, .018, M.pintado, (x0 + x1) / 2, .045, zi0 + .009, { c: rod });
    bx(raiz, xi1 - xi0, .09, .018, M.pintado, (xi0 + xi1) / 2, .045, zi1 - .009, { c: rod });
    for (const xx of [xi0 + .009, xi1 - .009]) bx(raiz, .018, .09, zi1 - zi0, M.pintado, xx, .045, (zi0 + zi1) / 2, { c: rod });
    for (const zz of [79.32, zi0 + .02]) { for (const xx of [18.96, 21.04]) bx(raiz, .08, 2.34, .04, M.pintado, xx, 1.17, zz, { c: 0xf4f0e8 }); bx(raiz, 2.16, .08, .04, M.pintado, 20, 2.34, zz, { c: 0xf4f0e8 }); }
    bx(raiz, .08, .12, .012, M.pintado, 21.3, 1.15, zi0 + .006, { c: 0xf8f8f4 }); bx(raiz, .02, .04, .01, M.pintado, 21.3, 1.15, zi0 + .014, { c: 0xd8d8d0 });
    // ventanas interiores con cortinas (pared norte) y otra en la cocina
    for (const [vx, ancho] of [[15.6, 1.3], [23.8, 1.2]]) {
      pl(raiz, ancho, 1.25, cristalVentana, vx, 1.62, zi0 + .015, { shoot: false });
      for (const dx of [-ancho / 2, ancho / 2]) bx(raiz, .06, 1.37, .06, M.pintado, vx + dx, 1.62, zi0 + .03, { c: 0xf6f4ee });
      for (const dy of [-.63, .63, 0]) bx(raiz, ancho + .12, .06, dy ? .1 : .04, M.pintado, vx, 1.62 + dy, zi0 + (dy < 0 ? .06 : .03), { c: 0xf6f4ee });
      bx(raiz, .03, .03, .03, M.pintado, vx, 1.62, zi0 + .05, { c: 0xf6f4ee });
      ci(raiz, .015, ancho + .9, M.metalV, vx, 2.42, zi0 + .12, { rz: Math.PI / 2, c: 0x8a7a60 });
      const tc = vx < 20 ? 0xb85a3a : 0xe8dcc0;
      for (const sx of [-1, 1]) for (let p = 0; p < 4; p++) ci(raiz, .055, 2.0, M.tela, vx + sx * (ancho / 2 + .1 + p * .09), 1.42, zi0 + .14 + (p % 2) * .03, { c: tc, seg: 6 });
    }
    // lámparas de techo: plafón en el salón, colgante sobre la mesa
    ci(raiz, .22, .06, M.pintado, 17.2, H - .05, 84.5, { c: 0xf0f0ea }); ci(raiz, .19, .02, M.lampara, 17.2, H - .085, 84.5, { shoot: false });
    ci(raiz, .006, .9, M.metalV, 22.6, H - .45, 82.7, { c: 0x222222 }); ci(raiz, .06, .28, M.metalV, 22.6, H - 1.0, 82.7, { r2: .26, abierto: true, c: 0x2a4a3a, seg: 16 }); es(raiz, .06, M.lampara, 22.6, H - 1.1, 82.7, { shoot: false });
    fuenteLuz(22.6, 2.0, 82.7, 0xffcf90, 30, 9, 'fijo', true); fuenteLuz(15.2, 1.5, 88.6, 0xffb870, 8, 5, 'fijo', true); fuenteLuz(23.2, 1.45, 88.6, 0xfff0d8, 6, 4, 'fijo', true); // lámparas con pantalla: charco de luz corto

    // --- Cocina en L: encimera sur (x 20.9..25.85) y este (z 85.35..88.75), nevera en la esquina este ---
    const fr = 0x8fa58c, enc = (x, z, w, d) => { bx(raiz, w, .04, d, M.madMesa, x, .9, z, { s: .8 }); supf(x, .92, z, w - .05, d - .05); };
    const modulos = (x0, x1, z, horiz) => { const L = x1 - x0, n = Math.max(1, Math.round(L / .6)), w = L / n;
      for (let i = 0; i < n; i++) { const c = x0 + w * (i + .5);
        if (horiz) { bx(raiz, w - .01, .76, .56, M.pintado, c, .48, z, { c: 0xe8e4da }); bx(raiz, w - .03, .7, .02, M.pintado, c, .5, z - .29, { c: fr }); bx(raiz, w * .5, .018, .025, M.metalV, c, .78, z - .31, { c: 0xc8ccd0 }); }
        else { bx(raiz, .56, .76, w - .01, M.pintado, z, .48, c, { c: 0xe8e4da }); bx(raiz, .02, .7, w - .03, M.pintado, z - .29, .5, c, { c: fr }); bx(raiz, .025, .018, w * .5, M.metalV, z - .31, .78, c, { c: 0xc8ccd0 }); } } };
    bx(raiz, 25.85 - 20.9, .1, .5, M.pintado, (20.9 + 25.85) / 2, .05, 89.05, { c: 0x2a2826 });
    modulos(20.9, 23.9, 89.05, true); modulos(25.0, 25.85, 89.05, true);
    enc(22.4, 89.05, 3.0, .62); enc(25.425, 89.05, .85, .62);
    modulos(85.35, 88.45, 25.55, false); enc(25.55, 86.9, .62, 3.1);
    addCollider(20.9, 25.85, 88.74, zi1, .92); addCollider(25.24, xi1, 84.55, 88.75, .92);
    // fregadero (x 22.4) con grifo
    bx(raiz, .62, .02, .44, M.metalV, 22.4, .925, 89.05, { c: 0xb8bcc0 }); bx(raiz, .54, .03, .36, M.metalV, 22.4, .905, 89.05, { c: 0x6a6e72 });
    ci(raiz, .018, .32, M.metalV, 22.4, 1.08, 89.28, { c: 0xd8dce0 }); to(raiz, .1, .016, M.metalV, 22.4, 1.24, 89.18, { arco: Math.PI, rx: Math.PI / 2, rz: Math.PI / 2, ry: Math.PI / 2, c: 0xd8dce0 });
    // placa y horno (x 24.45)
    bx(raiz, 1.05, .76, .56, M.pintado, 24.45, .48, 89.05, { c: 0x1a1a1c }); bx(raiz, .9, .55, .02, M.brillo, 24.45, .45, 88.76, { c: 0x080808 }); bx(raiz, .7, .03, .03, M.metalV, 24.45, .78, 88.74, { c: 0xc0c4c8 });
    bx(raiz, 1.05, .03, .6, M.brillo, 24.45, .92, 89.05, { c: 0x0a0a0b });
    for (const [dx, dz, r] of [[-.24, -.12, .1], [.24, -.12, .08], [-.24, .14, .08], [.24, .14, .11]]) to(raiz, r, .008, M.metalV, 24.45 + dx, .937, 89.05 + dz, { rx: Math.PI / 2, c: 0x6a6a6a });
    for (let i = 0; i < 4; i++) ci(raiz, .02, .03, M.metalV, 24.1 + i * .23, .84, 88.74, { rx: Math.PI / 2, c: 0xb0b4b8 });
    supf(24.45, .94, 89.05, 1.0, .55);
    // salpicadero de azulejo y muebles altos + campana
    pl(raiz, 25.85 - 20.9, .6, M.azulejo, (20.9 + 25.85) / 2, 1.22, zi1 - .012, { ry: Math.PI, s: .6, shoot: false });
    pl(raiz, 3.4, .6, M.azulejo, xi1 - .012, 1.22, 87.05, { ry: -Math.PI / 2, s: .6, shoot: false });
    for (const [x0, x1] of [[20.9, 23.9], [25.0, 25.85]]) { const n = Math.round((x1 - x0) / .6), w = (x1 - x0) / n; for (let i = 0; i < n; i++) { const c = x0 + w * (i + .5); bx(raiz, w - .01, .72, .34, M.pintado, c, 1.9, 89.17, { c: 0xe8e4da }); bx(raiz, w - .03, .68, .02, M.pintado, c, 1.9, 88.99, { c: fr }); bx(raiz, .018, .1, .025, M.metalV, c + w * .35, 1.62, 88.97, { c: 0xc8ccd0 }); } }
    bx(raiz, 2.9, .015, .04, M.lampara, 22.4, 1.535, 89.02, { shoot: false }); // tira de luz bajo los muebles altos
    bx(raiz, .9, .12, .5, M.metalV, 24.45, 1.62, 89.1, { c: 0xb8bcc0 }); bx(raiz, .3, .7, .25, M.metalV, 24.45, 2.03, 89.22, { c: 0xb8bcc0 });
    // nevera con dibujos e imanes
    bx(raiz, .64, 1.86, .66, M.brillo, 25.53, .93, 84.93, { c: 0xeeeeea }); bx(raiz, .02, .7, .64, M.pintado, 25.2, 1.45, 84.93, { c: 0xe0e0dc }); bx(raiz, .02, 1.06, .64, M.pintado, 25.2, .55, 84.93, { c: 0xe8e8e4 });
    bx(raiz, .03, .4, .03, M.metalV, 25.18, 1.3, 84.68, { c: 0xc0c4c8 }); bx(raiz, .03, .4, .03, M.metalV, 25.18, .9, 84.68, { c: 0xc0c4c8 });
    pl(raiz, .3, .3, rotulo, 25.185, 1.52, 85.05, { ry: -Math.PI / 2, r: RECT.dibujo0, rz: .06, shoot: false }); pl(raiz, .28, .28, rotulo, 25.185, 1.15, 84.85, { ry: -Math.PI / 2, r: RECT.dibujo1, rz: -.05, shoot: false });
    for (const [dy, dz, c] of [[.18, .12, 0xe02020], [-.2, -.05, 0x2060e0], [.02, -.2, 0xe0c000]]) es(raiz, .018, M.brillo, 25.18, 1.38 + dy, 84.95 + dz, { c });
    addCollider(25.2, xi1, 84.55, 85.3, 1.86);
    // mesa de comedor con mantel y 4 sillas
    const mesa = grupo(22.6, 0, 82.7);
    bx(mesa, 1.3, .04, .85, M.madMesa, 0, .74, 0, { s: .8 }); for (const [a, b] of [[-.58, -.35], [.58, -.35], [-.58, .35], [.58, .35]]) bx(mesa, .05, .72, .05, M.madMesa, a, .36, b);
    bx(mesa, 1.0, .006, .5, M.mantel, 0, .763, 0, { s: .5 });
    addCollider(21.95, 23.25, 82.27, 83.13, .76); supf(22.6, .77, 82.7, 1.25, .8);
    for (const [sx, sz, r] of [[-.33, -.72, 0], [.33, -.72, 0], [-.33, .72, Math.PI], [.33, .72, Math.PI]]) { const s = grupo(22.6 + sx, 0, 82.7 + sz, r); silla(s, 0xe8d8b8); cambiar(s, 'painted_wooden_chair_01'); }
    // perchero junto a la puerta con abrigos y zapatos
    bx(raiz, .9, .06, .03, M.madMesa, 21.85, 1.68, zi0 + .02); for (let i = 0; i < 4; i++) ci(raiz, .012, .08, M.metalV, 21.5 + i * .23, 1.66, zi0 + .07, { rx: Math.PI / 2, c: 0x2a2a2a });
    rb(raiz, .38, .85, .14, M.tela, 21.6, 1.2, zi0 + .12, { c: 0x2a3a5a }); rb(raiz, .34, .75, .13, M.tela, 22.05, 1.26, zi0 + .12, { c: 0x7a3020 });
    for (const [x, c] of [[21.5, 0x1a1410], [21.75, 0x1a1410], [22.15, 0xd8d0c0], [22.38, 0xd8d0c0]]) rb(raiz, .1, .08, .26, M.pintado, x, .04, zi0 + .2, { c });

    // --- Salón ---
    pl(raiz, 3.2, 2.3, M.alfombra, 17.5, .036, 86.5, { rx: -Math.PI / 2, shoot: false });
    // sofá de cuero con cojines (encima de la colisión de siempre)
    const sofa = grupo(17.5, 0, 88.9);
    bx(sofa, 2.9, .3, .86, M.cuero, 0, .27, 0, { s: .8 }); bx(sofa, 2.9, .5, .22, M.cuero, 0, .62, .32, { s: .8 });
    for (const sx of [-1, 1]) rb(sofa, .22, .62, .88, M.cuero, sx * 1.36, .36, 0);
    for (let i = 0; i < 3; i++) { rb(sofa, .82, .16, .64, M.cuero, -.84 + i * .84, .5, -.06); rb(sofa, .8, .48, .2, M.cuero, -.84 + i * .84, .8, .2, { rx: -.12 }); }
    rb(sofa, .42, .4, .14, M.tela, -1.0, .76, .06, { rx: -.3, rz: .2, c: 0xd8a040 }); rb(sofa, .4, .38, .14, M.tela, 1.0, .76, .06, { rx: -.3, rz: -.15, c: 0x3a6a7a });
    rb(sofa, .9, .04, .5, M.tela, .3, .6, -.05, { rz: .05, c: 0xa04838 }); // manta
    for (const sx of [-1.35, 1.35]) for (const sz of [-.35, .35]) ci(sofa, .025, .1, M.metalV, sx, .05, sz, { c: 0x2a2a2a });
    addCollider(16, 19, 88.45, zi1, .45); cambiar(sofa, 'Sofa_01', Math.PI);
    // mesa baja con revistero
    const mb = grupo(17.5, 0, 86.6);
    bx(mb, 1.2, .05, .66, M.madMesa, 0, .42, 0, { s: .8 }); bx(mb, 1.1, .02, .56, M.madMesa, 0, .14, 0); for (const [a, b] of [[-.55, -.28], [.55, -.28], [-.55, .28], [.55, .28]]) bx(mb, .045, .42, .045, M.madMesa, a, .21, b);
    for (let i = 0; i < 3; i++) bx(mb, .3, .012, .22, M.pintado, -.3 + i * .05, .16 + i * .012, rnd(-.1, .1), { ry: rnd(-.3, .3), c: [0xc83030, 0x2a5a9a, 0xe8e0c8][i] });
    addCollider(16.85, 18.15, 86.28, 86.92, .45); supf(17.5, .445, 86.6, 1.15, .6); cambiar(mb, 'modern_coffee_table_01', Math.PI / 2);
    // sillón (mirando al este)
    const so = grupo(15.1, 0, 86.3, Math.PI / 2);
    bx(so, .86, .3, .8, M.tela, 0, .27, 0, { c: 0x4a6a3a }); rb(so, .7, .14, .6, M.tela, 0, .48, .02, { c: 0x557a44 }); rb(so, .86, .6, .2, M.tela, 0, .72, -.32, { c: 0x4a6a3a, rx: .1 });
    for (const sx of [-1, 1]) rb(so, .16, .52, .8, M.tela, sx * .37, .42, 0, { c: 0x4a6a3a }); for (const sx of [-.35, .35]) for (const sz of [-.33, .33]) ci(so, .025, .12, M.madMesa, sx, .06, sz);
    addCollider(14.65, 15.55, 85.85, 86.75, .45); cambiar(so, 'GreenChair_01');
    // mueble de la tele + marco de la tele (la pantalla la pone la historia)
    const mt = grupo(17.5, 0, 80.3);
    bx(mt, 2.2, .5, .45, M.mueble, 0, .3, 0, { s: .8 }); bx(mt, 2.2, .05, .45, M.pintado, 0, .025, 0, { c: 0x1a1612 });
    for (let i = 0; i < 3; i++) { bx(mt, .7, .4, .015, M.mueble, -.73 + i * .73, .3, .228, { s: .8 }); bx(mt, .18, .018, .02, M.metalV, -.73 + i * .73, .44, .24, { c: 0x2a2a2a }); }
    addCollider(16.4, 18.6, 80.075, 80.525, .55); supf(17.5, .55, 80.3, 2.1, .4);
    bx(raiz, 1.72, 1.02, .05, M.brillo, 17.5, 1.25, 80.07, { c: 0x050505 }); bx(raiz, .3, .2, .06, M.pintado, 17.5, 1.25, 79.99, { c: 0x111111 });
    // estantería llena de libros (pared oeste)
    const es1 = grupo(14.33, 0, 82.5);
    for (const dz of [-.89, .89]) bx(es1, .34, 2.0, .03, M.mueble, 0, 1.0, dz, { s: .8 }); bx(es1, .02, 2.0, 1.8, M.mueble, -.16, 1.0, 0, { s: .8 });
    for (let i = 0; i <= 5; i++) bx(es1, .34, .025, 1.75, M.mueble, 0, .05 + i * .39, 0, { s: .8 });
    for (let i = 0; i < 4; i++) { const n = 2 + (i % 2); let z = -.86; for (let k = 0; k < n; k++) { const L = rnd(.35, .6), hh = rnd(.24, .3); pl(es1, L, hh, libros, .12, .07 + i * .39 + hh / 2, z + L / 2, { ry: Math.PI / 2, r: [rnd(0, 250), Math.floor(rnd(0, 4)) * 128, 420 * L, 128], W: 512, H: 512, shoot: false }); bx(es1, .26, hh, L, M.pintado, -.02, .07 + i * .39 + hh / 2, z + L / 2, { c: 0x3a2a1a }); z += L + rnd(.05, .15); if (z > .7) break; } }
    rb(es1, .12, .16, .12, M.brillo, .02, 2.03 - .39 + .09, .5, { c: 0x2a6a8a }); es(es1, .07, M.brillo, .02, 1.25, .62, { c: 0xd8c090 });
    addCollider(xi0, 14.52, 81.6, 83.4, 2.0); supf(14.36, 2.03, 82.5, .3, 1.7, Math.PI / 2);
    // mesita con lámpara junto al sofá, lámpara de pie, planta grande
    const mx = grupo(15.55, 0, 88.95); bx(mx, .45, .04, .45, M.madMesa, 0, .55, 0); bx(mx, .04, .55, .04, M.madMesa, 0, .27, 0); bx(mx, .3, .02, .3, M.madMesa, 0, .02, 0);
    ci(mx, .06, .3, M.brillo, 0, .72, 0, { r2: .09, c: 0x3a5a7a }); ci(mx, .12, .2, M.pintado, 0, .96, 0, { r2: .17, abierto: true, c: 0xf4e8d0, seg: 16 }); es(mx, .045, M.lampara, 0, .92, 0, { shoot: false });
    supf(15.55, .57, 88.95, .4, .4);
    const lp = grupo(14.55, 0, 87.6); ci(lp, .16, .03, M.metalV, 0, .015, 0, { c: 0x222222 }); ci(lp, .015, 1.6, M.metalV, 0, .8, 0, { c: 0x222222 }); ci(lp, .17, .28, M.pintado, 0, 1.68, 0, { r2: .22, abierto: true, c: 0xeadcc0, seg: 16 }); es(lp, .05, M.lampara, 0, 1.62, 0, { shoot: false });
    planta(14.62, 80.15, 1.2); planta(25.4, 80.1, .8);
    // cuadros y fotos (pared sur sobre el sofá, pared oeste)
    for (const [x, r, w, h] of [[16.55, 'foto0', .42, .32], [17.5, 'cuadro0', .7, .5], [18.45, 'foto2', .42, .32]]) { bx(raiz, w + .06, h + .06, .025, M.pintado, x, 1.75, zi1 - .013, { c: 0x2a1e14 }); pl(raiz, w, h, rotulo, x, 1.75, zi1 - .027, { ry: Math.PI, r: RECT[r], shoot: false }); }
    for (const [z, r] of [[85.2, 'foto1'], [84.5, 'dibujo1']]) { bx(raiz, .025, .34, .44, M.pintado, xi0 + .013, 1.6, z, { c: 0xf0ece0 }); pl(raiz, .38, .28, rotulo, xi0 + .027, 1.6, z, { ry: Math.PI / 2, r: RECT[r], shoot: false }); }
    // juguetes sobre la alfombra
    es(raiz, .09, M.brillo, 18.6, .125, 85.9, { c: 0xd02a2a }); for (let i = 0; i < 5; i++) bx(raiz, .07, .07, .07, M.brillo, 16.4 + rnd(-.2, .2), .07 + (i > 2 ? .07 : 0), 85.8 + rnd(-.15, .15), { ry: rnd(0, 1.5), c: [0xe0c020, 0x2a7ad0, 0x30b040, 0xe05020, 0xa040c0][i] });
    rb(raiz, .2, .07, .1, M.brillo, 17.9, .07, 85.5, { ry: .5, c: 0x2a60e0 }); for (const dx of [-.07, .07]) for (const dz of [-.05, .05]) ci(raiz, .02, .02, M.goma, 17.9 + dx, .035, 85.5 + dz, { rx: Math.PI / 2 });
  });
}
// ---------- Modelos realistas en el decorado (Poly Haven CC0, assets/props) ----------
// cambiar(grupo, id, giro): al construir se apunta; modelosCasa() (antes de hornear) carga el .glb y, si llega,
// quita las piezas por código del grupo y pone el modelo encajado en su caja (las colisiones no se tocan).
// Sus mallas se marcan estáticas: hornear() fusiona las copias que comparten material (4 sillas = 1 llamada).
const cambios = [];
function cambiar(g, id, ry = 0) { cambios.push({ g, id, ry, cap: B.cap, zona: B.zona }); }
function aFloat(geo) { for (const k of Object.keys(geo.attributes)) { const a = geo.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
  const n = a.count, s = a.itemSize, f = new Float32Array(n * s); for (let i = 0; i < n; i++) for (let j = 0; j < s; j++) f[i * s + j] = a.getComponent ? a.getComponent(i, j) : [a.getX, a.getY, a.getZ, a.getW][j].call(a, i);
  geo.setAttribute(k, new THREE.BufferAttribute(f, s)); } }
export async function modelosCasa() {
  const { cargarProp, encajarEn, SIN_MODELOS } = await import('../interaccion/catalogo.js'); if (SIN_MODELOS) return;
  const ids = [...new Set(cambios.map(c => c.id))], esc = new Map(await Promise.all(ids.map(async id => [id, await cargarProp(id)])));
  for (const e of esc.values()) e?.traverse(o => { if (o.isMesh) aFloat(o.geometry); });
  const caja = new THREE.Box3(), b = new THREE.Box3();
  for (const c of cambios) { const e = esc.get(c.id); if (!e) continue;
    caja.makeEmpty(); for (const m of c.g.children) if (m.isMesh) { m.geometry.boundingBox || m.geometry.computeBoundingBox(); m.updateMatrix(); caja.union(b.copy(m.geometry.boundingBox).applyMatrix4(m.matrix)); }
    for (const m of [...c.g.children]) if (m.isMesh) { m.removeFromParent(); m.geometry.dispose(); }
    const v = encajarEn(e.clone(), caja, [0, c.ry, 0]); c.g.add(v);
    v.traverse(o => { if (!o.isMesh) return; o.castShadow = false; o.receiveShadow = true; o.userData.static = true; o.userData.shoot = true; o.userData.cap = c.cap; o.userData.zona = c.zona; }); }
}
function silla(g, c) { bx(g, .42, .04, .42, M.madMesa, 0, .45, 0); for (const [a, b] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) bx(g, .035, .45, .035, M.madMesa, a, .225, b); for (const a of [-.18, .18]) bx(g, .035, .5, .035, M.madMesa, a, .72, -.18); for (let i = 0; i < 3; i++) bx(g, .36, .05, .02, M.madMesa, 0, .6 + i * .13, -.18); rb(g, .38, .04, .38, M.tela, 0, .485, .01, { c }); }
function planta(x, z, s = 1) {
  const g = grupo(x, 0, z); ci(g, .17 * s, .36 * s, M.brillo, 0, .18 * s, 0, { r2: .13 * s, c: 0xb8603a, seg: 14 }); ci(g, .16 * s, .02, M.pintado, 0, .35 * s, 0, { c: 0x2a1e14 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, L = rnd(.35, .6) * s; const h = new THREE.PlaneGeometry(.16 * s, L); h.translate(0, L / 2, 0); h.rotateX(-rnd(.3, .9)); h.rotateY(a); meter(g, new THREE.Mesh(h, hojas), 0, .34 * s, 0, { shoot: false }); }
}

// ---------- Laboratorio de Mike (coordenadas locales: el origen ya está desplazado a z = -112) ----------
export function labMike() {
  zona('lab', 0, -139, 30, () => {
    const r = grupo(0, 0, 0), Y = 6.28;
    // techo de placas con luminarias (sustituye la chapa vista desde abajo)
    pl(r, 23.2, 17.2, M.techoLab, 0, Y, -27, { rx: Math.PI / 2, s: .6, shoot: false });
    for (let i = 0; i < 3; i++) for (const sx of [-5.5, 5.5]) { bx(r, 2.6, .06, .66, M.metalV, sx, Y - .03, -22 - i * 5, { c: 0xd8dade }); }
    for (let i = 0; i < 4; i++) for (const sx of [0]) { bx(r, .62, .05, .62, M.metalV, sx, Y - .025, -21 - i * 4.6, { c: 0xd8dade }); pl(r, .5, .5, M.white, sx, Y - .055, -21 - i * 4.6, { rx: Math.PI / 2, shoot: false }); }
    // conducto de ventilación y bandeja de cables
    bx(r, .7, .5, 17, M.metalV, -3, 5.55, -27, { c: 0xb8bcc2 }); for (let z = -35; z <= -19; z += 1.6) { bx(r, .76, .56, .05, M.metalV, -3, 5.55, z, { c: 0x9aa0a6 }); } for (let z = -34; z <= -20; z += 3.2) for (const dx of [-.38, .38]) ci(r, .01, .5, M.metalV, -3 + dx, 6.0, z, { c: 0x555a60 });
    bx(r, .7, .35, .7, M.metalV, -3, 5.12, -25, { c: 0xb8bcc2 }); bx(r, .6, .02, .6, M.pintado, -3, 4.94, -25, { c: 0x444a50 });
    bx(r, .45, .02, 17, M.metalV, 3.5, 5.7, -27, { c: 0x8a9096 }); for (const dx of [-.22, .22]) bx(r, .02, .1, 17, M.metalV, 3.5 + dx, 5.75, -27, { c: 0x8a9096 });
    for (let k = 0; k < 5; k++) ci(r, .025, 17, M.pintado, 3.36 + k * .07, 5.74, -27, { rx: Math.PI / 2, seg: 6, c: [0x111111, 0x2a2a2a, 0x8a1a1a, 0x1a3a8a, 0x111111][k] });
    // luces de emergencia y salida
    pl(r, .5, .25, rotuloLuz, 0, 3.6, -18.43, { ry: Math.PI, r: RECT.seg1, shoot: false }); pl(r, .5, .25, rotuloLuz, -8.5, 4.2, -35.57, { r: RECT.seg1, shoot: false });
    for (const [x, z, ry] of [[3.2, -18.45, Math.PI], [-6.2, -35.55, 0]]) { bx(r, .3, .12, .1, M.pintado, x, 3.2, z, { c: 0xe8e8e8 }); bx(r, .24, .06, .02, M.neonR, x, 3.2, z + (ry ? -.05 : .05), { shoot: false }); }
    // carteles, reloj, extintor y botiquín
    pl(r, .6, .6, rotulo, -2.2, 2.5, -35.57, { r: RECT.seg0, shoot: false }); pl(r, 1.1, 1.1, rotulo, 11.57, 2.6, -33.5, { ry: -Math.PI / 2, r: RECT.tabla, shoot: false });
    pl(r, .5, .5, rotulo, -11.57, 4.4, -24, { ry: Math.PI / 2, r: RECT.reloj, shoot: false });
    ci(r, .09, .55, M.brillo, 2.3, .55, -18.55, { c: 0xc01010 }); ci(r, .03, .1, M.pintado, 2.3, .88, -18.55, { c: 0x111111 }); bx(r, .2, .05, .05, M.metalV, 2.3, .6, -18.42, { c: 0x333333 });
    bx(r, .4, .3, .12, M.pintado, -2.4, 1.6, -18.5, { c: 0xf4f4f0 }); bx(r, .14, .04, .02, M.neonR, -2.4, 1.62, -18.56, { shoot: false }); bx(r, .04, .14, .02, M.neonR, -2.4, 1.62, -18.56, { shoot: false });
    // banco de trabajo con panel de herramientas (rincón suroeste)
    const bt = grupo(-11.1, 0, -33.4, Math.PI / 2);
    bx(bt, 2.0, .06, .72, M.madMesa, 0, .9, 0, { s: .8 }); for (const [a, b] of [[-.95, -.32], [.95, -.32], [-.95, .32], [.95, .32]]) bx(bt, .05, .87, .05, M.metalV, a, .435, b, { c: 0x2a3a5a }); bx(bt, 1.9, .03, .6, M.metalV, 0, .2, 0, { c: 0x2a3a5a });
    for (let i = 0; i < 3; i++) bx(bt, .45, .25, .5, M.metalV, -.6 + i * .6, .35, 0, { c: 0xb02020 });
    bx(bt, 1.9, 1.0, .02, M.pintado, 0, 1.65, -.36, { c: 0x8a8f94 });
    for (let i = 0; i < 9; i++) { const x = -.8 + i * .2, L = rnd(.15, .35); bx(bt, .03, L, .02, M.metalV, x, 1.7 - L / 2 + .2, -.33, { c: [0xc0c4c8, 0xd04020, 0x2a2a2a][i % 3] }); }
    bx(bt, .14, .12, .2, M.metalV, .78, .99, -.15, { c: 0x2a4a8a }); ci(bt, .02, .2, M.metalV, .78, 1.05, -.03, { rx: Math.PI / 2, c: 0xc0c4c8 });
    addCollider(-11.58, -10.74, -34.4, -32.4, .93); supf(-11.1, .93, -33.4, .65, 1.4, Math.PI / 2);
    // vitrina extractora (rincón noroeste)
    const vx = grupo(-11.15, 0, -21.4, Math.PI / 2);
    bx(vx, 1.6, .9, .75, M.pintado, 0, .45, 0, { c: 0xd8dade }); bx(vx, 1.6, .04, .75, M.brillo, 0, .92, 0, { c: 0x1a1a1c }); bx(vx, 1.6, .25, .78, M.pintado, 0, 2.2, 0, { c: 0xd8dade });
    for (const sx of [-.78, .78]) bx(vx, .05, 1.2, .75, M.pintado, sx, 1.5, 0, { c: 0xd8dade }); pl(vx, 1.5, 1.0, M.cristal, 0, 1.45, .37, { shoot: false }); bx(vx, 1.5, .05, .05, M.metalV, 0, 1.0, .38, { c: 0x9aa0a6 });
    bx(vx, .3, 3.8, .3, M.metalV, 0, 4.3, -.15, { c: 0xb8bcc2 });
    addCollider(-11.58, -10.75, -22.2, -20.6, 2.3); supf(-11.15, .94, -21.4, .6, 1.4, Math.PI / 2);
    // estantería de piezas de robot (pared norte)
    const pr = grupo(-8.8, 0, -18.66);
    for (const sx of [-1.4, 1.4]) bx(pr, .04, 2.0, .45, M.metalV, sx, 1.0, 0, { c: 0x3a4048 });
    for (let i = 0; i < 4; i++) { const y = .1 + i * .6; bx(pr, 2.8, .03, .45, M.metalV, 0, y, 0, { c: 0x6a7078 });
      for (let k = 0; k < 5; k++) { const x = -1.15 + k * .55 + rnd(-.05, .05), t = (i + k) % 4;
        if (t === 0) es(pr, .13, M.metalV, x, y + .14, 0, { c: 0x9aa0a8 }); else if (t === 1) ci(pr, .06, .4, M.metalV, x, y + .07, 0, { rz: Math.PI / 2, c: 0x7a8088 }); else if (t === 2) bx(pr, .22, .06, .16, M.brillo, x, y + .05, 0, { c: 0x1a5a2a }); else { rb(pr, .2, .2, .2, M.metalV, x, y + .12, 0, { c: 0x2a6aa8 }); } } }
    addCollider(-10.25, -7.35, -18.9, -18.4, 2.0);
    // taquillas (pared norte, lado este)
    const tq = grupo(8.0, 0, -18.68);
    for (let i = 0; i < 4; i++) { const x = -1.05 + i * .7; bx(tq, .68, 1.9, .48, M.metalV, x, .95, 0, { c: 0x5a7088 }); for (let v = 0; v < 4; v++) bx(tq, .4, .015, .01, M.pintado, x, 1.6 + v * .05, -.245, { c: 0x1a2028 }); bx(tq, .03, .14, .03, M.metalV, x + .25, 1.1, -.25, { c: 0xc0c4c8 }); bx(tq, .5, .1, .01, M.pintado, x, 1.82, -.245, { c: 0xe8e8e0 }); }
    addCollider(6.6, 9.4, -18.95, -18.4, 1.9);
    // racks extra y cables por el suelo hasta la mesa de Mike
    for (let k = 0; k < 4; k++) barra(r, new V3(1.4, .03, -34.85 + k * .07), new V3(3.7, .03, -34.6 + k * .05), .022, M.pintado, { c: [0x111111, 0x1a3a8a, 0x111111, 0xd0a000][k] });
    bx(r, 2.3, .03, .3, M.pintado, 2.55, .015, -34.7, { c: 0xd0a000 });
    // pantallas y teclado en la mesa del fondo (-5.5, -21.2) y silla
    for (const dx of [-.5, .5]) { bx(r, .62, .38, .04, M.brillo, -5.5 + dx, 1.25, -20.85, { c: 0x111214 }); pl(r, .56, .32, rotuloLuz, -5.5 + dx, 1.25, -20.876, { ry: Math.PI, r: dx < 0 ? RECT.codigo : RECT.grafica, shoot: false }); bx(r, .06, .25, .06, M.metalV, -5.5 + dx, 1.0, -20.8, { c: 0x2a2a2a }); }
    bx(r, .45, .02, .15, M.brillo, -5.5, .91, -21.45, { c: 0x1a1a1c }); supf(-5.5, .91, -21.2, 2.4, .9);
    sillaOficina(-5.5, -22.15, 0); sillaOficina(6.4, -33.5, Math.PI + .4);
  });
}
function sillaOficina(x, z, ry) { const g = grupo(x, 0, z, ry); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; bx(g, .32, .03, .05, M.metalV, Math.cos(a) * .16, .06, Math.sin(a) * .16, { ry: -a, c: 0x1a1a1a }); es(g, .03, M.goma, Math.cos(a) * .3, .03, Math.sin(a) * .3); } ci(g, .025, .38, M.metalV, 0, .26, 0, { c: 0x888c90 }); rb(g, .48, .08, .46, M.tela, 0, .48, 0, { c: 0x22262c }); rb(g, .44, .55, .07, M.tela, 0, .86, .22, { c: 0x22262c, rx: -.1 }); for (const sx of [-.25, .25]) bx(g, .04, .03, .28, M.pintado, sx, .66, .02, { c: 0x111111 }); }

// ---------- Manzana de la calle mayor (z 5..60): fachadas comerciales, mobiliario urbano ----------
// detalle de fachada para un edificio (llamado desde edificio()): escaparate a pie de calle, toldo y rótulo,
// balcones, aparatos de aire, bajantes y grafitis. cara: 'x+', 'x-', 'z+', 'z-' = lado que da a la calle
let nTienda = 0;
export function fachadaDetalle(x, z, w, d, h, cara) {
  const ry = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI }[cara];
  const ancho = cara[0] === 'x' ? d : w, prof = cara[0] === 'x' ? w : d;
  const cx = x + (cara === 'x+' ? w / 2 : cara === 'x-' ? -w / 2 : 0), cz = z + (cara === 'z+' ? d / 2 : cara === 'z-' ? -d / 2 : 0);
  const g = grupo(cx, 0, cz, ry); // local: x = a lo largo de la fachada, +z = hacia la calle
  const t = nTienda++ % TIENDAS.length, colT = [0x1f6a3a, 0x8a2a1a, 0x8a6a2a, 0x1e3a6a, 0x7a2a5a, 0x6a1a1a, 0x2a4a2a][t];
  const L = Math.min(ancho - 1.2, 9);
  // bajo comercial: zócalo, pilastras, escaparates, puerta, rótulo y toldo
  bx(g, ancho + .02, .45, .08, M.pintado, 0, .225, .04, { c: 0x2a2624 });
  bx(g, L + .3, 2.9, .06, M.pintado, 0, 1.45, .03, { c: colT });
  const nE = 2, we = (L - 1.3) / nE;
  for (let i = 0; i < nE; i++) { const ex = -L / 2 + we * (i + .5) + (i ? 1.3 : 0); pl(g, we - .25, 1.85, escaparate, ex, 1.45, .065, { r: RECT['esc' + ((t + i) % 4)], shoot: false }); bx(g, we - .15, .08, .1, M.pintado, ex, .5, .08, { c: 0xd8d4c8 }); }
  const px = -L / 2 + we + .65; pl(g, 1.0, 2.2, escaparate, px, 1.1, .062, { r: RECT['esc' + ((t + 2) % 4)], shoot: false }); for (const dx of [-.52, .52]) bx(g, .06, 2.3, .1, M.metalV, px + dx, 1.15, .08, { c: 0x2a2a2a }); bx(g, 1.1, .06, .1, M.metalV, px, 2.28, .08, { c: 0x2a2a2a }); bx(g, .03, .5, .04, M.metalV, px + .35, 1.1, .12, { c: 0xc0c4c8 });
  pl(g, Math.min(L * .7, 5), .55, rotuloLuz, 0, 3.15, .12, { r: RECT['rot' + t], shoot: false }); bx(g, Math.min(L * .7, 5) + .1, .62, .06, M.pintado, 0, 3.15, .08, { c: 0x111111 });
  { const tg = new THREE.PlaneGeometry(L * .92, 1.25, 1, 1); tg.rotateX(-Math.PI / 2 + .42); colorear(tg, colT === 0x1e3a6a ? 0x2a4a8a : [0xb02020, 0x2a6a3a, 0xd08a20, 0x2a4a8a][t % 4]); const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L * .92 / 1.2, uv.getY(i)); meter(g, new THREE.Mesh(tg, toldo), 0, 2.62, .6, { shoot: false, cast: true }); for (const sx of [-1, 1]) barra(g, new V3(sx * L * .45, 2.85, .1), new V3(sx * L * .45, 2.37, 1.15), .015, M.metalV, { c: 0x2a2a2a }); }
  // pisos: balcones bajo algunas ventanas (las ventanas de la textura van cada 3 m), aire acondicionado
  const filas = Math.floor((h - .5) / 3);
  for (let j = 1; j < filas; j++) for (let i = 0; i < Math.floor(ancho / 3); i++) {
    const vx = -ancho / 2 + 1.5 + i * 3, vy = 3 * j + .66 - .05; if (Math.random() < .45) {
      bx(g, 2.0, .12, .85, M.concrete, vx, vy, .43, { s: 2, cast: true });
      bx(g, 2.0, .04, .04, M.metalV, vx, vy + 1.0, .84, { c: 0x2a2a2a }); for (let b = 0; b <= 10; b++) bx(g, .02, .95, .02, M.metalV, vx - .98 + b * .196, vy + .52, .84, { c: 0x2a2a2a }); for (const sx of [-1, 1]) bx(g, .04, .04, .85, M.metalV, vx + sx * .98, vy + 1.0, .43, { c: 0x2a2a2a });
      if (Math.random() < .5) ci(g, .16, .3, M.brillo, vx + .7, vy + .21, .55, { r2: .12, c: 0xb8603a }); if (Math.random() < .3) bx(g, 1.4, .02, .5, M.tela, vx - .2, vy + 1.0, .7, { rx: .3, c: [0xd04040, 0xe8e0c0, 0x2a6ab0][Math.floor(rnd(0, 3))] });
    } else if (Math.random() < .5) { const ax = vx + (Math.random() < .5 ? -1.2 : 1.2); bx(g, .8, .55, .32, M.pintado, ax, vy + .5, .16, { c: 0xd8d8d2 }); for (let k = 0; k < 5; k++) bx(g, .6, .02, .01, M.pintado, ax, vy + .3 + k * .09, .325, { c: 0x6a6a6a }); }
  }
  // bajantes en las esquinas y grafiti/cartel en el zócalo
  for (const sx of [-1, 1]) { ci(g, .05, h, M.metalV, sx * (ancho / 2 - .15), h / 2, .1, { c: 0x5a5e62, seg: 8 }); bx(g, .14, .1, .14, M.metalV, sx * (ancho / 2 - .15), .05, .14, { c: 0x5a5e62 }); }
  if (Math.random() < .7) pl(g, 1.0, 1.0, graffiti, (Math.random() < .5 ? -1 : 1) * (L / 2 + .2), 1.2, .085, { r: RECT['gr' + Math.floor(rnd(0, 6))], shoot: false });
}

// mobiliario de la calle mayor
export function manzana() {
  zona('manzana1', 0, 32, 60, () => {
    const r = grupo(0, 0, 0);
    const banco = (x, z, ry) => { const g = grupo(x, 0, z, ry); for (let i = 0; i < 4; i++) bx(g, 1.7, .04, .09, M.madMesa, 0, .45, -.18 + i * .12); for (let i = 0; i < 3; i++) bx(g, 1.7, .09, .03, M.madMesa, 0, .62 + i * .12, .24, { rx: -.15 }); for (const sx of [-.75, .75]) { bx(g, .05, .45, .5, M.metalV, sx, .225, 0, { c: 0x1e2a22 }); bx(g, .05, .5, .05, M.metalV, sx, .7, .25, { c: 0x1e2a22 }); } colGirado(x, z, 1.75, .6, ry, .5); };
    const papelera = (x, z) => { ci(r, .22, .8, M.metalV, x, .4, z, { c: 0x2a5a3a, seg: 14 }); ci(r, .24, .05, M.metalV, x, .81, z, { c: 0x1a3a26, seg: 14 }); bx(r, .1, .9, .1, M.metalV, x, .45, z - .27, { c: 0x333333 }); addCollider(x - .25, x + .25, z - .25, z + .25, .85); };
    const boca = (x, z) => { ci(r, .11, .55, M.brillo, x, .275, z, { c: 0xb01818 }); es(r, .12, M.brillo, x, .58, z, { sy: .7, c: 0xb01818 }); for (const a of [0, Math.PI]) ci(r, .05, .14, M.brillo, x + Math.cos(a) * .14, .38, z, { rz: Math.PI / 2, c: 0xb01818 }); addCollider(x - .13, x + .13, z - .13, z + .13, .65); };
    const jardinera = (x, z) => { bx(r, 1.3, .45, 1.3, M.concrete, x, .225, z, { s: 1.2 }); pl(r, 1.1, 1.1, M.tierra, x, .44, z, { rx: -Math.PI / 2, shoot: false }); addCollider(x - .65, x + .65, z - .65, z + .65, .45);
      ci(r, .08, 2.2, M.madMesa, x, 1.5, z, { r2: .11, c: 0x4a3a2a }); for (const [dx, dy, dz, rr] of [[0, 3.0, 0, 1.1], [.4, 3.5, -.2, .8], [-.35, 3.4, .3, .75]]) meter(r, new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), hojas), x + dx, dy, z + dz, { cast: true, shoot: false }); };
    for (const [x, z, ry] of [[-7.5, 17, Math.PI / 2], [7.5, 44, -Math.PI / 2], [-7.5, 50, Math.PI / 2]]) banco(x, z, ry);
    for (const [x, z] of [[-5.5, 12], [5.5, 26], [-5.5, 33], [5.5, 55]]) papelera(x, z);
    for (const [x, z] of [[5.5, 15], [-5.5, 46]]) boca(x, z);
    for (const [x, z] of [[-7, 28], [7, 20], [7, 58]]) jardinera(x, z);
    // marquesina del autobús (acera este)
    { const g = grupo(7.3, 0, 37.5, -Math.PI / 2);
      for (const sx of [-1.6, 1.6]) bx(g, .08, 2.5, .08, M.metalV, sx, 1.25, -.5, { c: 0x6a7078 }); bx(g, 3.5, .08, 1.5, M.metalV, 0, 2.52, .1, { c: 0x6a7078 }); bx(g, 3.4, .03, 1.4, M.cristal, 0, 2.47, .1, { shoot: false });
      pl(g, 3.1, 2.0, M.cristal, 0, 1.35, -.52, { shoot: false }); pl(g, 1.2, .9, rotuloLuz, -1.0, 1.4, -.48, { r: RECT.anuncio, shoot: false }); pl(g, 1.2, .9, rotuloLuz, -1.0, 1.4, -.56, { ry: Math.PI, r: RECT.anuncio, shoot: false });
      for (let i = 0; i < 3; i++) bx(g, 1.6, .04, .1, M.metalV, .8, .48, -.25 + i * .12, { c: 0x9aa0a6 });
      ci(r, .04, 2.8, M.metalV, 6.2, 1.4, 35.4, { c: 0x6a7078 }); ci(r, .25, .03, M.brillo, 6.2, 2.7, 35.4, { rx: Math.PI / 2, c: 0x1a4ab0 }); colGirado(7.3, 37.5, 3.3, .2, 0, 2.5); }
    // cabina de teléfono (acera oeste)
    { const g = grupo(-7.5, 0, 25.5, Math.PI / 2); for (const [sx, sz] of [[-.45, -.45], [.45, -.45], [-.45, .45], [.45, .45]]) bx(g, .06, 2.2, .06, M.metalV, sx, 1.1, sz, { c: 0x1a3a7a }); bx(g, 1.0, .25, 1.0, M.pintado, 0, 2.3, 0, { c: 0x1a3a7a }); for (const [a, b, rr] of [[0, -.45, 0], [-.45, 0, Math.PI / 2], [.45, 0, Math.PI / 2]]) pl(g, .85, 1.6, M.cristal, a, 1.2, b, { ry: rr, shoot: false }); bx(g, .3, .45, .15, M.metalV, 0, 1.45, -.38, { c: 0x2a2a2a }); bx(g, .9, .14, .02, M.brillo, 0, 2.3, .51, { c: 0xe8c020, shoot: false }); addCollider(-8, -7, 25, 26, 2.4); }
    // pasos de cebra y líneas de borde
    for (const s of [-1, 1]) { for (let k = 0; k < 8; k++) pl(r, .5, 2.6, M.line, -4.2 + k * 1.2, .028, s * 7.6, { rx: -Math.PI / 2, shoot: false }); bx(r, 9.6, .004, .3, M.line, 0, .026, s * 9.2, { shoot: false }); }
    for (const s of [-1, 1]) for (let k = 0; k < 8; k++) pl(r, 2.6, .5, M.line, s * 7.6, .028, -4.2 + k * 1.2, { rx: -Math.PI / 2, shoot: false });
    for (const s of [-1, 1]) bx(r, .12, .004, 54, M.line, s * 4.6, .026, 36, { shoot: false });
  });
}

// ---------- Tienda de armas de Hank (x -22..-9, z -57..-43; puerta al este) ----------
const lienzoTienda = (() => { const [c, x] = cv2d(1024, 512);
  // carteles de la tienda: caza, prohibido, neón ARMAS, diana, calendario
  x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#2a3a1e'; x.fillRect(10, 10, 236, 236); x.fillStyle = '#d8b878'; x.font = fuente(26); x.textAlign = 'center'; x.fillText('TEMPORADA', 128, 50); x.fillText('DE CAZA 2030', 128, 80); x.fillStyle = '#1a1208'; x.beginPath(); x.ellipse(128, 170, 50, 30, 0, 0, 7); x.fill(); x.fillRect(90, 180, 8, 50); x.fillRect(160, 180, 8, 50); x.beginPath(); x.arc(180, 130, 16, 0, 7); x.fill(); x.strokeStyle = '#1a1208'; x.lineWidth = 4; x.beginPath(); x.moveTo(180, 115); x.lineTo(170, 90); x.lineTo(160, 95); x.moveTo(175, 100); x.lineTo(190, 85); x.stroke();
  x.fillStyle = '#ffffff'; x.fillRect(256, 0, 256, 256); x.fillStyle = '#b01010'; x.beginPath(); x.arc(384, 90, 60, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(384, 90, 46, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = fuente(18); x.fillText('PROHIBIDO', 384, 190); x.fillText('CARGAR ARMAS', 384, 214); x.fillText('DENTRO', 384, 238); x.fillRect(360, 70, 48, 14); x.fillStyle = '#b01010'; x.save(); x.translate(384, 90); x.rotate(-.8); x.fillRect(-50, -5, 100, 10); x.restore();
  x.fillStyle = '#0a0606'; x.fillRect(512, 0, 512, 256); x.font = fuente(120); x.shadowColor = '#ff2a10'; x.shadowBlur = 30; x.fillStyle = '#ff5030'; x.fillText('ARMAS', 768, 170); x.shadowBlur = 0; x.strokeStyle = '#ffd0c0'; x.lineWidth = 2; x.strokeText('ARMAS', 768, 170);
  x.fillStyle = '#f4f0e6'; x.fillRect(0, 256, 256, 256); for (let r = 5; r > 0; r--) { x.fillStyle = r % 2 ? '#111' : '#f4f0e6'; x.beginPath(); x.arc(128, 384, r * 22, 0, 7); x.fill(); } x.fillStyle = '#d02020'; x.beginPath(); x.arc(128, 384, 10, 0, 7); x.fill(); for (let k = 0; k < 7; k++) { x.fillStyle = '#222'; x.beginPath(); x.arc(128 + rnd(-40, 40), 384 + rnd(-40, 40), 4, 0, 7); x.fill(); }
  x.fillStyle = '#f8f6f0'; x.fillRect(256, 256, 256, 256); x.fillStyle = '#7a1a1a'; x.fillRect(256, 256, 256, 50); x.fillStyle = '#fff'; x.font = fuente(26); x.fillText('NOVIEMBRE', 384, 290); x.fillStyle = '#333'; x.font = fuente(16, 500); for (let d = 0; d < 30; d++) x.fillText(String(d + 1), 280 + (d % 7) * 34, 330 + Math.floor(d / 7) * 34); x.strokeStyle = '#c01010'; x.lineWidth = 3; x.beginPath(); x.arc(280 + 2 * 34, 330 + 3 * 34 - 5, 14, 0, 7); x.stroke();
  return toTex(c, false); })();
const cartelT = std({ map: lienzoTienda, roughness: .7 }), neonT = std({ map: lienzoTienda, emissiveMap: lienzoTienda, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: .4, side: THREE.DoubleSide });
const RT = { caza: [0, 0, 256, 256], prohibido: [256, 0, 256, 256], neon: [512, 0, 512, 256], diana: [0, 256, 256, 256], calendario: [256, 256, 256, 256] };
// silueta de arma larga (culata de madera + cajón + cañón) a lo largo de +z local
function armaLarga(g, x, y, z, tipo = 0) { const L = tipo ? 1.0 : 1.15;
  bx(g, .05, .14, .38, M.madMesa, x, y, z - L / 2 + .19, { rx: tipo ? 0 : -.08 }); bx(g, .05, .1, .34, M.metalV, x, y + .02, z - L / 2 + .55, { c: 0x1a1c1e }); ci(g, .014, L - .7, M.metalV, x, y + .05, z + .1, { rx: Math.PI / 2, seg: 6, c: 0x222426 });
  if (tipo) ci(g, .022, .5, M.madMesa, x, y - .01, z + .12, { rx: Math.PI / 2, seg: 6 }); else bx(g, .03, .14, .05, M.metalV, x, y - .08, z - .02, { c: 0x1a1c1e }); }
export function tiendaHank() {
  zona('tienda', -15.5, -50, 30, () => {
    const r = grupo(0, 0, 0), xi0 = -21.85, zi0 = -56.85, zi1 = -43.15, H = 4.2;
    // fluorescentes del techo
    for (const z of [-53, -47]) { bx(r, 1.3, .08, .22, M.metalV, -15.5, H - .06, z, { c: 0xd8dade }); bx(r, 1.2, .03, .12, M.lampara, -15.5, H - .11, z, { shoot: false }); }
    // panel de armas largas en la pared oeste (detrás del mostrador)
    bx(r, .04, 1.9, 5.6, M.mueble, xi0 + .02, 1.75, -50, { s: .8 }); for (const y of [1.15, 1.75, 2.35]) bx(r, .06, .04, 5.4, M.madMesa, xi0 + .07, y - .16, -50);
    for (let i = 0; i < 12; i++) { const g = grupo(xi0 + .12, 1.5 + Math.floor(i / 6) * .6, -52.4 + (i % 6) * .9 + (i > 5 ? .45 : 0)); g.rotation.x = -Math.PI / 2 + .05; armaLarga(g, 0, 0, 0, i % 3 === 1 ? 1 : 0); }
    pl(r, .7, .7, cartelT, xi0 + .03, 3.2, -52.2, { ry: Math.PI / 2, r: RT.caza, W: 1024, H: 512, shoot: false }); pl(r, .6, .6, cartelT, xi0 + .03, 3.2, -47.8, { ry: Math.PI / 2, r: RT.diana, W: 1024, H: 512, shoot: false });
    // mostrador-vitrina con pistolas sobre terciopelo (misma colisión que el bloque antiguo)
    const mo = grupo(-17.2, 0, -50);
    bx(mo, .8, .55, 5, M.mueble, 0, .275, 0, { s: .8 }); bx(mo, .82, .05, 5.02, M.madMesa, 0, .57, 0); bx(mo, .7, .02, 4.9, M.tela, 0, .6, 0, { c: 0x5a1018 });
    for (let i = 0; i < 8; i++) { const z = -2.1 + i * .6; bx(mo, .16, .04, .2, M.metalV, rnd(-.15, .15), .63, z, { ry: rnd(-.5, .5), c: [0x1a1c1e, 0x2a2c2e, 0x8a8e92][i % 3] }); bx(mo, .05, .04, .1, M.madMesa, .04, .63, z + .06, { ry: rnd(-.5, .5) }); }
    for (const sx of [-.4, .4]) bx(mo, .02, .42, 5, M.cristal, sx, .8, 0, { shoot: false }); bx(mo, .8, .02, 5, M.cristal, 0, 1.0, 0, { shoot: false });
    for (const [a, b] of [[-.4, -2.5], [.4, -2.5], [-.4, 2.5], [.4, 2.5]]) bx(mo, .03, .45, .03, M.metalV, a, .8, b, { c: 0xb0b4b8 });
    addCollider(-17.6, -16.8, -52.5, -47.5, 1); supf(-17.2, 1.0, -50, .7, 4.8);
    // caja registradora
    const cr = grupo(-17.25, 1.0, -52.0, Math.PI / 2); bx(cr, .36, .12, .32, M.pintado, 0, .06, 0, { c: 0x2a2a2c }); bx(cr, .3, .1, .2, M.pintado, 0, .16, -.05, { rx: -.5, c: 0x1a1a1c }); bx(cr, .2, .12, .02, M.brillo, 0, .3, .05, { c: 0x103a20 }); for (let i = 0; i < 12; i++) bx(cr, .035, .015, .035, M.pintado, -.1 + (i % 4) * .065, .21, -.08 + Math.floor(i / 4) * .045, { rx: -.5, c: 0xd8d4c8 });
    // estanterías de munición (norte y sur) abiertas, con cajas de balas
    for (const z of [-55.6, -44.4]) { const s = grupo(-15.5, 0, z, z < -50 ? 0 : Math.PI);
      for (let k = -2; k <= 2; k++) bx(s, .04, 2.4, .45, M.metalV, k * 2.2, 1.2, 0, { c: 0x2a3038 });
      for (let n = 0; n < 5; n++) { const y = .12 + n * .55; bx(s, 8.9, .03, .45, M.metalV, 0, y, 0, { c: 0x5a6068 });
        for (let b = 0; b < 26; b++) { const bxp = -4.3 + b * .34 + rnd(-.03, .03); if (Math.random() < .18) continue; const hh = rnd(.08, .16); bx(s, .12, hh, .16, M.pintado, bxp, y + .015 + hh / 2, rnd(-.12, .08), { ry: rnd(-.15, .15), c: [0x2a6a2a, 0xb08a20, 0x8a1a1a, 0x1a3a7a, 0x3a3a3a][Math.floor(rnd(0, 5))] }); if (Math.random() < .4) bx(s, .12, hh, .16, M.pintado, bxp, y + .015 + hh * 1.5, rnd(-.12, .08), { c: 0x8a1a1a }); } }
      addCollider(-20, -11, z - .25, z + .25, 2.4); }
    // trofeos de caza
    for (const [x, z, ry] of [[-12.2, zi1 - .02, Math.PI], [-12.2, zi0 + .02, 0], [-19.6, zi0 + .02, 0]]) { const t = grupo(x, 2.95, z, ry);
      es(t, .2, M.madMesa, 0, 0, .02, { sy: .25, seg: 12 }); es(t, .16, M.tela, 0, .05, .16, { c: 0x6a4a2a, seg: 10 }); bx(t, .12, .12, .3, M.tela, 0, .02, .32, { c: 0x6a4a2a }); bx(t, .06, .04, .06, M.pintado, 0, .02, .47, { c: 0x111111 });
      for (const sx of [-1, 1]) { barra(t, new V3(sx * .06, .18, .14), new V3(sx * .3, .55, .1), .012, M.pintado, { c: 0xd8c8a8 }); barra(t, new V3(sx * .2, .38, .12), new V3(sx * .1, .6, .15), .01, M.pintado, { c: 0xd8c8a8 }); barra(t, new V3(sx * .27, .48, .1), new V3(sx * .42, .62, .08), .01, M.pintado, { c: 0xd8c8a8 }); es(t, .015, M.brillo, sx * .07, .1, .27, { c: 0x050505 }); } }
    // banco de trabajo del fondo y calendario
    const bt = grupo(-21.5, 0, -45.3, Math.PI / 2); bx(bt, 1.6, .05, .6, M.madMesa, 0, .9, 0); for (const [a, b] of [[-.75, -.25], [.75, -.25], [-.75, .25], [.75, .25]]) bx(bt, .05, .88, .05, M.madMesa, a, .44, b); bx(bt, .16, .14, .2, M.metalV, .6, .99, -.1, { c: 0x2a4a8a }); armaLarga(bt, -.2, .96, .05, 1);
    addCollider(-21.85, -21.2, -46.1, -44.5, .92); supf(-21.5, .93, -45.3, .55, 1.0, Math.PI / 2);
    pl(r, .45, .45, cartelT, -21.83, 1.7, -45.3, { ry: Math.PI / 2, r: RT.calendario, W: 1024, H: 512, shoot: false }); pl(r, .5, .5, cartelT, -9.18, 2.6, -53.2, { ry: -Math.PI / 2, r: RT.prohibido, W: 1024, H: 512, shoot: false });
    // felpudo, rejas de las ventanas (por fuera) y banderola de neón ARMAS
    bx(r, .9, .015, 1.4, M.tela, -9.75, .02, -50, { c: 0x2a2420 });
    for (const [z0, z1] of [[-55.2, -52.4], [-47.6, -44.8]]) { for (let z = z0; z <= z1 + .01; z += .14) bx(r, .03, 1.6, .03, M.metalV, -8.8, 1.6, z, { c: 0x1a1a1a }); for (const y of [.85, 2.35]) bx(r, .04, .05, z1 - z0, M.metalV, -8.8, y, (z0 + z1) / 2, { c: 0x1a1a1a }); }
    bx(r, 1.2, .04, .04, M.metalV, -8.4, 3.95, -46.4, { c: 0x222222 }); pl(r, 1.1, .55, neonT, -8.1, 3.6, -46.4, { r: RT.neon, W: 1024, H: 512, shoot: false });
    fuenteLuz(-8.0, 3.4, -46.4, 0xff4020, 6, 5, 'neon');
  });
  // caos: armas por el suelo, cajas de balas reventadas, cristales del mostrador
  en('caos', 0, 0, () => zona('tiendaCaos', -15.5, -50, 30, () => { const c = grupo(0, 0, 0);
    for (let i = 0; i < 4; i++) { const g = grupo(-19 + i * 1.3, .06, -49 + rnd(-1.5, 1.5), rnd(0, 3)); g.rotation.z = Math.PI / 2; armaLarga(g, 0, 0, 0, i % 2); }
    for (let i = 0; i < 30; i++) bx(c, .12, .1, .16, M.pintado, rnd(-20.5, -12), .05, rnd(-55, -45), { ry: rnd(0, 3), rz: rnd(-.3, .3), c: [0x2a6a2a, 0xb08a20, 0x8a1a1a][i % 3] });
    for (let i = 0; i < 40; i++) ci(c, .006, .025, M.metalV, rnd(-20, -12), .015, rnd(-55, -45), { rz: Math.PI / 2, ry: rnd(0, 3), seg: 5, c: 0xc8a040 });
    for (let i = 0; i < 25; i++) pl(c, rnd(.05, .2), rnd(.05, .2), M.cristal, rnd(-17.8, -16.5), .035, rnd(-52.5, -47.5), { rx: -Math.PI / 2, rz: rnd(0, 3), shoot: false });
  }));
}

// ---------- Base militar de Peñas Negras: detalle ----------
const alambre = std({ map: canvasTex(128, (x, s) => { x.clearRect(0, 0, s, s); x.strokeStyle = '#b8bcc0'; x.lineWidth = 3; for (let i = -s; i < s * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s * .6, s); x.stroke(); } x.fillStyle = '#d0d4d8'; for (let i = 0; i < 40; i++) { const a = Math.random() * s, b = Math.random() * s; x.fillRect(a, b, 6, 2); x.fillRect(a + 2, b - 2, 2, 6); } }), alphaTest: .5, side: THREE.DoubleSide, roughness: .4, metalness: .8 });
export const banderaMat = std({ map: canvasTex(128, (x, s) => { x.fillStyle = '#2a3a22'; x.fillRect(0, 0, s, s); x.fillStyle = '#c8a040'; x.fillRect(0, s * .42, s, s * .16); x.fillStyle = '#111'; x.beginPath(); x.arc(s / 2, s / 2, 22, 0, 7); x.fill(); x.fillStyle = '#c8a040'; x.font = fuente(20); x.textAlign = 'center'; x.fillText('PN', s / 2, s / 2 + 7); }, false), side: THREE.DoubleSide, roughness: .9 });
function contenedor(x, z, ry, y, c) { const g = grupo(x, y, z, ry); bx(g, 2.44, 2.59, 6.06, M.chapaV, 0, 1.295, 0, { s: 1.2, cast: true, c });
  for (const sx of [-.95, -.25, .25, .95]) bx(g, .04, 2.3, .06, M.metalV, sx, 1.3, 3.06, { c: 0x6a6e72 }); for (const sx of [-.6, .6]) bx(g, .02, 2.3, .02, M.pintado, sx, 1.3, 3.04, { c: 0x111111 });
  colGirado(x, z, 2.44, 6.06, ry, y + 2.59); }
export function baseDetalle() {
  zona('base', 147, -11, 80, () => {
    const r = grupo(0, 0, 0);
    // concertina sobre las vallas (cilindro abierto con textura de alambre recortada)
    for (const [x0, z0, x1, z1, h] of [[115, -62, 115, -5, 3.2], [115, 5, 115, 40, 3.2], [178, -62, 178, 40, 3.2], [115, -62, 178, -62, 3.2], [115, 40, 178, 40, 3.2]]) {
      const L = Math.hypot(x1 - x0, z1 - z0), g = new THREE.CylinderGeometry(.28, .28, L, 8, 1, true); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * L / .5);
      const ejeZ = x0 === x1; meter(r, new THREE.Mesh(g, alambre), (x0 + x1) / 2, h + .3, (z0 + z1) / 2, { rx: ejeZ ? Math.PI / 2 : 0, rz: ejeZ ? 0 : Math.PI / 2, shoot: false }); }
    // muros de sacos terreros (cobertura)
    const sacosFila = (x, z, n, ry, alto = 3) => { const g = grupo(x, 0, z, ry); for (let k = 0; k < alto; k++) for (let i = 0; i < n; i++) rb(g, .62, .2, .36, M.tela, (i - (n - 1) / 2) * .6 + (k % 2) * .3, .1 + k * .19, 0, { c: [0x8a7a55, 0x7a6a48, 0x948460][(i + k) % 3], ry: rnd(-.08, .08) }); colGirado(x, z, n * .6 + .3, .4, ry, alto * .19 + .05); };
    sacosFila(128, -14, 7, Math.PI / 2); sacosFila(156, -42, 6, 0); sacosFila(134, 22, 6, Math.PI / 2); sacosFila(160, 12, 5, 0, 2); sacosFila(121, 14.5, 4, 0, 4);
    // contenedores marítimos
    contenedor(121.5, 21, 0, 0, 0x2a5a8a); contenedor(124.6, 21, 0, 0, 0x8a3a1a); contenedor(123, 21, 0, 2.6, 0x3a6a3a);
    // radar
    { const g = grupo(165, 0, 35); ci(g, .25, 6, M.metalV, 0, 3, 0, { c: 0x6a7068, r2: .35 }); bx(g, 1.2, .6, 1.2, M.metalV, 0, 6.2, 0, { c: 0x4a5048 });
      const d = new THREE.SphereGeometry(2.2, 20, 8, 0, Math.PI * 2, 0, .55); d.translate(0, -2.2, 0); d.rotateX(-Math.PI / 2 - .6); meter(g, new THREE.Mesh(colorear(d, 0xd8dcd8), M.pintado), 0, 7.2, -.2, { cast: true }); barra(g, new V3(0, 6.8, 0), new V3(0, 7.9, -1.6), .04, M.metalV, { c: 0x6a7068 }); addCollider(164.6, 165.4, 34.6, 35.4, 6); }
    // mástiles (las banderas las ondea atmosfera.js)
    for (const z of [8, 11]) { ci(r, .06, 8, M.metalV, 121, 4, z, { c: 0xc8ccd0 }); es(r, .1, M.metalV, 121, 8.05, z, { c: 0xd8b040 }); addCollider(120.9, 121.1, z - .1, z + .1, 8); }
    // todoterrenos verde oliva
    coche(131, 4, Math.PI / 2, { color: 0x4a5236 }); coche(158, -48, 0, { color: 0x4a5236 });
    // focos en la fachada del hangar
    for (const z of [-30, -10]) { bx(r, .3, .3, .5, M.metalV, 147.6, 9.2, z, { c: 0x2a2a2a }); bx(r, .02, .26, .44, M.white, 147.44, 9.2, z, { shoot: false }); fuenteLuz(146.5, 8.8, z, 0xeaf4ff, 26, 18); }
    for (const [x, z] of [[112, -7], [118, 6.5]]) { ci(r, .04, 2.2, M.metalV, x, 1.1, z, { c: 0x888c90 }); pl(r, .6, .6, cartelT, x - .05, 2.0, z, { ry: -Math.PI / 2, r: RT.prohibido, W: 1024, H: 512, shoot: false }); }
    // barracones: puerta, escalón, farol, aire acondicionado y ventanas
    for (const z of [-32, -46]) { bx(r, 1.0, 2.1, .06, M.pintado, 132, 1.05, z + 4.03, { c: 0x3a4a2a }); bx(r, 1.4, .18, .7, M.concrete, 132, .09, z + 4.35); bx(r, .2, .15, .12, M.lampara, 132, 2.45, z + 4.06, { shoot: false }); bx(r, .9, .6, .35, M.pintado, 127, 3.2, z + 4.2, { c: 0xd0d0c8 }); for (const x of [126, 129, 135, 138]) bx(r, 1.0, .7, .05, M.brillo, x, 2.3, z + 4.03, { c: 0x0c1218 }); }
    // interior del hangar: puente grúa, carros de herramientas, tuberías de combustible
    for (const z of [-32.5, -7.5]) bx(r, 23, .35, .3, M.metalV, 160, 9.8, z, { c: 0xc8a020 }); bx(r, .5, .5, 25, M.metalV, 162, 9.4, -20, { c: 0xc8a020 }); bx(r, .8, .6, .8, M.metalV, 162, 8.9, -16, { c: 0x2a2a2a }); ci(r, .012, 5, M.metalV, 162, 6.1, -16, { c: 0x888888 }); to(r, .15, .03, M.metalV, 162, 3.5, -16, { arco: Math.PI * 1.4, c: 0xd0a020 });
    for (const [x, z] of [[165, -30], [169.5, -23]]) { const g = grupo(x, 0, z, rnd(0, 1)); bx(g, .9, .8, .5, M.metalV, 0, .55, 0, { c: 0xb01818 }); for (let i = 0; i < 4; i++) bx(g, .86, .02, .46, M.metalV, 0, .3 + i * .2, .01, { c: 0x6a0808 }); for (const [a, b] of [[-.4, -.2], [.4, -.2], [-.4, .2], [.4, .2]]) ci(g, .06, .05, M.goma, a, .06, b, { rx: Math.PI / 2 }); addCollider(x - .5, x + .5, z - .5, z + .5, .95); supf(x, .95, z, .8, .45); }
    for (const y of [.8, 1.15]) bx(r, 22, .14, .14, M.metalV, 160, y, -33.4, { c: y < 1 ? 0x8a6a1a : 0x5a6a7a }); for (let x = 151; x < 171; x += 4) { ci(r, .1, .08, M.metalV, x, 1.15, -33.25, { rx: Math.PI / 2, c: 0xb01818 }); bx(r, .1, .5, .1, M.metalV, x, .5, -33.4, { c: 0x5a6a7a }); }
  });
}
