// Reparto de objetos y piezas interactivas por el mapa (Acto I). Presupuesto ~150 objetos dinámicos; la física
// solo existe cerca del jugador (objetos.js crea los cuerpos dormidos a < 25 m y los quita lejos).
//   1) Encima de las superficies libres que publica el mundo (W.superficies de decorado.js): juegos por zona y altura.
//   2) Piezas fijas: piano, guitarra, consola con cajón (linterna, T-27), pizarras, cuaderno, taquillas para esconderse,
//      cajón de Mike (grabadora), puerta trasera acristalada del lab (T-16), caja registradora, taquilla de la tienda.
//   3) Basura en las aceras, la base y lanzables junto a cada zona de sigilo (T-28).
import { THREE, V3, rnd, pieza, addCollider, dentroDeSolido, std } from '../nucleo.js';
import { W } from '../mundo/tierra.js';
import { crearProp, props } from './objetos.js';
import { crearSuperficie } from './escritura.js';
import { crearPiano } from './instrumentos.js';
import { crearCajon, crearArmario } from './muebles.js';
import { crearTaquilla } from './sigilo.js';
import { crearVentana } from './roturas.js';
import { cuerpoFijo, alListo } from './fisica-adaptador.js';
import { LINEAS_CINTA } from './objetos.js';

export const MAX = 150;
const lleno = () => props.length >= MAX;
const MD = { madera: std({ color: 0x5a3e28, roughness: .7 }), negro: std({ color: 0x1c1d20, roughness: .5, metalness: .3 }), gris: std({ color: 0x8a8e94, roughness: .5, metalness: .6 }) };
const caja = (w, h, d, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); pieza(m, x, y + h / 2, z, { ry }); return m; };
function poner(tipo, x, y, z, o = {}) { if (lleno()) return null; if (!o.sinComprobar && dentroDeSolido(x, z, y + .05)) return null; return crearProp(tipo, x, y, z, o); }

// ---------- 1) encima de las superficies ----------
const JUEGOS = {
  cocina: [['taza', 'plato', 'botella', 'lata'], 3],
  comedor: [['plato', 'plato', 'taza', 'botella'], 4],
  mesaBaja: [['libro', 'libro', 'taza'], 2],
  mueble: [['radio', 'libro'], 1],
  mesita: [['taza', 'libro'], 1],
  taller: [['llave', 'martillo', 'linterna', 'caja'], 3],
  laboratorio: [['monitor', 'taza', 'libro', 'rotulador', 'lata'], 3],
  calle: [['botella', 'lata', 'caja'], 2]
};
function juegoDe(s) {
  if (s.y > 1.6) return null; // estantes altos: nada (se caería todo al tocarlos)
  if (s.zona === 'casaDave') { if (Math.abs(s.y - .445) < .03) return 'mesaBaja'; if (Math.abs(s.y - .55) < .03) return 'mueble'; if (Math.abs(s.y - .77) < .03) return 'comedor'; if (Math.abs(s.y - .57) < .03) return 'mesita'; return s.y > .85 ? 'cocina' : 'mesita'; }
  if (s.zona === 'lab') return Math.abs(s.y - .93) < .02 ? 'taller' : 'laboratorio';
  return 'calle';
}
function sobreSuperficies() {
  const lista = W.superficies || []; let n = 0;
  for (const s of lista) {
    const j = juegoDe(s); if (!j) continue; const [tipos, max] = JUEGOS[j];
    const cuantos = Math.max(1, Math.min(max, Math.floor(s.w * s.d / .09))), usados = [];
    for (let i = 0; i < cuantos && !lleno(); i++) {
      for (let k = 0; k < 8; k++) { // posición libre dentro del rectángulo (girado ry), separada de lo ya puesto
        const lx = rnd(-s.w / 2 + .1, s.w / 2 - .1), lz = rnd(-s.d / 2 + .1, s.d / 2 - .1), c = Math.cos(s.ry || 0), sn = Math.sin(s.ry || 0);
        const x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c;
        if (usados.some(u => Math.hypot(u[0] - x, u[1] - z) < .2)) continue;
        const t = tipos[(i + Math.floor(Math.random() * tipos.length)) % tipos.length];
        if (t === 'monitor' && (s.w < .6 || s.d < .45)) continue;
        if (poner(t, x, s.y, z, { ry: rnd(0, 6.28), sinComprobar: true })) { usados.push([x, z]); n++; }
        break;
      }
    }
  }
  return n;
}

// ---------- 2) piezas fijas ----------
function casa() {
  // piano en la pared oeste, bajo las fotos (entre la estantería y el sillón)
  crearPiano({ x: 14.47, z: 84.6, ry: Math.PI / 2 }); addCollider(14.17, 14.77, 83.95, 85.25, 1.25);
  poner('silla', 15.35, 0, 84.6, { ry: Math.PI / 2, v: 0x4a3020 });
  // guitarra apoyada en la pared sur, entre el sofá y la cocina
  poner('guitarra', 19.9, 0, 89.02, { ry: Math.PI, rx: .24, sinComprobar: true });
  // consola de la entrada con cajón: la linterna del cap. 2
  caja(.8, .04, .35, MD.madera, 23.4, .74, 79.88); for (const sx of [-.37, .37]) caja(.04, .74, .33, MD.madera, 23.4 + sx, 0, 79.88); caja(.76, .2, .02, MD.madera, 23.4, .52, 79.72);
  addCollider(23.0, 23.8, 79.7, 80.06, .78);
  const cj = crearCajon({ x: 23.4, y: .66, z: 79.92, ry: 0, ancho: .6, alto: .1, fondo: .26, label: 'cajón de la entrada' }); cj.meter('linterna', -.1, 0, { ry: 1.5 }); cj.meter('rotulador', .15, .02, { ry: 1.6, v: 0x1a3cc8 });
  poner('libro', 23.6, .78, 79.9, { ry: .4, sinComprobar: true });
  // pizarra de tiza de la cocina (pared este) con su repisa, tiza y borrador
  crearSuperficie({ id: 'casa.tiza', tipo: 'tiza', w: .7, h: .5, px: 384, x: 25.82, y: 1.5, z: 82.1, ry: -Math.PI / 2 });
  caja(.07, .02, .6, MD.madera, 25.79, 1.22, 82.1); alListo(() => cuerpoFijo([{ f: 'caja', m: [.035, .01, .3], c: [25.79, 1.23, 82.1] }]));
  poner('tiza', 25.79, 1.24, 81.95, { sinComprobar: true }); poner('tiza', 25.79, 1.24, 82.0, { v: 0xf0d040, sinComprobar: true }); poner('borrador', 25.79, 1.24, 82.25, { ry: 0, sinComprobar: true });
  // cuaderno de Dave sobre la mesa baja, con un boli
  crearSuperficie({ id: 'casa.cuaderno', tipo: 'cuaderno', w: .21, h: .3, px: 256, x: 17.15, y: .449, z: 86.62, rx: -Math.PI / 2, ry: .2 });
  poner('rotulador', 17.4, .45, 86.5, { ry: 1.2, v: 0x1a3cc8, sinComprobar: true });
  poner('pelota', 18.6, 0, 85.2); poner('caja', 15.0, 0, 80.4, { ry: .3 }); poner('caja', 15.0, .3, 80.4, { ry: .1, sinComprobar: true });
}
function lab() {
  // pizarra blanca en la pared del fondo con su bandeja
  crearSuperficie({ id: 'lab.pizarra', tipo: 'pizarra', w: 1.8, h: 1.1, px: 512, x: -5.5, y: 1.55, z: -147.555 });
  caja(1.0, .025, .08, MD.gris, -5.5, .975, -147.52); alListo(() => cuerpoFijo([{ f: 'caja', m: [.5, .0125, .04], c: [-5.5, .9875, -147.52] }]));
  poner('rotulador', -5.85, 1.0, -147.52, { ry: 1.57, sinComprobar: true }); poner('rotulador', -5.7, 1.0, -147.52, { ry: 1.57, v: 0x1a3cc8, sinComprobar: true }); poner('rotulador', -5.55, 1.0, -147.52, { ry: 1.57, v: 0xc81a1a, sinComprobar: true });
  poner('borrador', -5.2, 1.0, -147.52, { ry: 1.57, sinComprobar: true });
  // taquillas para esconderse (pared del fondo, junto a la mesa de Mike)
  crearTaquilla(8.7, -147.28, 0); crearTaquilla(9.36, -147.28, 0);
  crearTaquilla(-11.25, -143.65, Math.PI / 2); // la del pasillo de la historia (cap. 3); en (-10.9,-144.5) pisa el banco de trabajo del mundo
  // cajón de la mesa de Mike con la grabadora
  const cj = crearCajon({ x: 6.6, y: .66, z: -146.21, ry: 0, ancho: .5, alto: .12, fondo: .45, label: 'cajón de Mike' });
  const g = cj.meter('cinta', -.08, 0); if (g) g.lineas = LINEAS_CINTA; cj.meter('rotulador', .12, .05, { ry: 1.5, v: 0xc81a1a });
  // puerta trasera acristalada: entrar rompiendo el cristal (ruido 15 m) y quitando los trozos del marco
  W.puertaTraseraLab = crearVentana({ x: -8.5, y: 1.26, z: -147.8, w: 1.58, h: 2.5, ry: 0, label: 'puerta trasera acristalada' });
  poner('extintor', 11.2, 0, -134.5); poner('cajaMadera', 10.6, 0, -146.6); poner('silla', 4.8, 0, -145.4, { ry: Math.PI });
  // lanzables junto a la trasera (zona de sigilo del cap. 3) y en el pasillo
  for (const [t, x, z] of [['lata', -6.2, -151.2], ['botella', -6.6, -151.6], ['lata', -10.8, -152.4], ['botella', -11.4, -151.1], ['caja', -12.6, -150.4]]) poner(t, x, 0, z, { ry: rnd(0, 6) });
  for (const [t, x, z] of [['lata', 7.6, -146.9], ['botella', 2.2, -132.2]]) poner(t, x, 0, z);
}
function tienda() {
  // caja registradora sobre el mostrador con cajón hacia Hank
  caja(.38, .2, .34, MD.negro, -17.2, 1.06, -51.7); caja(.3, .1, .03, MD.gris, -17.2, 1.26, -51.6);
  const cj = crearCajon({ x: -17.33, y: 1.11, z: -51.7, ry: -Math.PI / 2, ancho: .3, alto: .07, fondo: .26, label: 'caja registradora' }); cj.meter('municion', 0, 0, { ry: 1.57 });
  // taquilla de la tienda con botiquín y munición
  const tq = crearArmario({ x: -21.55, z: -46.2, ry: Math.PI / 2, w: .6, h: 1.8, d: .5, tipo: 'taquilla', baldas: [.9, 1.4], label: 'taquilla de Hank' });
  tq.meter('botiquin', 0, .915, 0); tq.meter('municion', 0, 1.415, 0);
  poner('extintor', -9.6, 0, -53.0); poner('bombona', -21.3, 0, -47.4); poner('bombona', -21.3, 0, -54.8, { v: 0x2a6ac0 });
  for (const [t, x, y, z, ry] of [['radio', -17.3, 1.06, -52.3, 1.4], ['lata', -17.1, 1.06, -49.7, 0], ['botella', -17.35, 1.06, -50.2, 0], ['llave', -16.95, 1.06, -50.9, .3], ['martillo', -17.2, 1.06, -47.9, 1.2]]) poner(t, x, y, z, { ry, sinComprobar: true });
  for (const [t, x, z] of [['caja', -12.5, -55.0], ['caja', -11.8, -45.0], ['tuberia', -19.6, -53.4], ['cajaMadera', -10.3, -44.0]]) poner(t, x, 0, z, { ry: rnd(-.4, .4) });
  for (const [x, z] of [[-6.6, -53.8], [-6.9, -46.4]]) poner('cono', x, 0, z);
}
function calle() {
  // aceras de la calle mayor (x = ±6.5) y de la residencial (z ≈ 74,6): basura que se puede patear y lanzar
  for (let i = 0; i < 14 && !lleno(); i++) { const lado = i % 2 ? 6.6 : -6.6, z = rnd(-62, 60); if (Math.abs(z) < 8 || (lado < 0 && z > -53 && z < -47)) continue; poner(['botella', 'lata', 'lata', 'caja'][i % 4], lado + rnd(-.8, .8), 0, z, { ry: rnd(0, 6), rz: i % 4 === 1 ? Math.PI / 2 : 0 }); }
  for (let i = 0; i < 8 && !lleno(); i++) { const x = rnd(-40, 40); if (Math.abs(x - 20) < 2) continue; poner(['lata', 'botella', 'caja', 'cono'][i % 4], x, 0, rnd(73.8, 74.8), { ry: rnd(0, 6) }); }
}
function base() {
  // delante de los barracones (lado oeste, x ≈ 123,5): cajas, bombonas y lanzables (zona de sigilo del cap. 6)
  for (const [t, x, z, o] of [['cajaMadera', 123.6, -28.5], ['cajaMadera', 123.4, -29.3], ['cajaMadera', 123.5, -28.9, { y: .5 }], ['bombona', 124.0, -36.2], ['bombona', 124.2, -42.8],
    ['lata', 123.0, -38.5], ['botella', 123.2, -39.1], ['lata', 122.8, -44.9], ['botella', 123.1, -50.2], ['cono', 122.5, -25.0], ['cono', 122.5, -53.0], ['tuberia', 124.3, -47.5], ['caja', 123.8, -33.0], ['extintor', 124.5, -40.0]])
    poner(t, x, o?.y || 0, z, { ry: rnd(-.5, .5), sinComprobar: !!o?.y });
}
export function repartir() {
  casa(); lab(); tienda();
  const n = sobreSuperficies();
  calle(); base();
  return { objetos: props.length, sobreSuperficies: n, superficiesMundo: (W.superficies || []).length };
}
