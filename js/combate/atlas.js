// Atlas de heridas generado por código al arrancar (sin descargas): 1024×1024, 64 casillas de 128 px
// (128 px por herida de 5-25 cm = 5-25 px/cm, de sobra incluso de cerca en VR; 4 MB en GPU).
// Cada casilla NO guarda colores sino CAMPOS que el shader colorea según el tipo de superficie y la edad:
//   R = relieve (0.5 neutro; <0.5 hundido, >0.5 hinchado)   → bump en el shader
//   G = núcleo (agujero, corte, centro del moratón, progreso del goteo, alambres que brillan…)
//   B = detalle (fibras rotas, labios del corte, moteado, arañazos de metal…)
//   A = campo de cobertura tipo distancia (1 en el centro → 0 en el borde, borde irregular)
//       el shader lo usa con un umbral que se mueve con el tiempo: la sangre empapa y crece, el charco se extiende.
// Así una misma casilla sirve para tela, piel, suelo o metal, y la herida envejece sin regenerar texturas.
// Se genera en trozos (unas casillas por tarea) para no congelar el arranque en las Quest.
import { THREE } from '../nucleo.js';

export const TAM = 1024, CAS = 128, POR_FILA = TAM / CAS;
const datos = new Uint8Array(TAM * TAM * 4);
export const atlas = new THREE.DataTexture(datos, TAM, TAM, THREE.RGBAFormat);
atlas.generateMipmaps = true; atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter;
atlas.colorSpace = THREE.NoColorSpace; atlas.anisotropy = 4; atlas.flipY = false;

// ---------- Ruido con semilla ----------
function prng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const VAL = new Float32Array(512), PERM = new Uint16Array(1024);
{ const r = prng(1234); for (let i = 0; i < 512; i++) { VAL[i] = r(); PERM[i] = i; } for (let i = 511; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [PERM[i], PERM[j]] = [PERM[j], PERM[i]]; } for (let i = 0; i < 512; i++) PERM[i + 512] = PERM[i]; }
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 511, Yy = yi & 511;
  const a = VAL[PERM[X + PERM[Yy]] & 511], b = VAL[PERM[X + 1 + PERM[Yy]] & 511], c = VAL[PERM[X + PERM[Yy + 1]] & 511], d = VAL[PERM[X + 1 + PERM[Yy + 1]] & 511];
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); n += a; f *= 2.03; a *= .5; } return s / n; }
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cl = x => x < 0 ? 0 : x > 1 ? 1 : x;
// ruido angular continuo (sin costura en ±π), con tabla precalculada por (k, s, o): la función es cara y se repite
const LUTS = [];
function ang(a, k, s, o = 3) {
  let L = null; for (let i = 0; i < LUTS.length; i++) { const e = LUTS[i]; if (e.k === k && e.s === s && e.o === o) { L = e.t; break; } }
  if (!L) { L = new Float32Array(513); for (let i = 0; i <= 512; i++) { const b = i / 512 * Math.PI * 2 - Math.PI; L[i] = fbm(Math.cos(b) * k + s, Math.sin(b) * k + s * 1.7, o); } LUTS.push({ k, s, o, t: L }); if (LUTS.length > 24) LUTS.shift(); }
  const f = (a + Math.PI) / (Math.PI * 2) * 512, i = f | 0, r = f - i; return L[i] + (L[Math.min(512, i + 1)] - L[i]) * r;
}

// ---------- Generadores: (x, y en [-1,1], y hacia ARRIBA) → [R, G, B, A] ----------
// Todas las formas alargadas van a lo largo de +X (el código las orienta según la dirección del golpe).
const GEN = {
  // agujero de bala (entrada) en tela/piel: agujero irregular, anillo de fibras/quemadura, campo de empapado
  agujero(r, salida) {
    const s = r() * 50, rh = salida ? .17 + r() * .08 : .075 + r() * .035, jagA = salida ? .45 : .14, sx = 1 + r() * .25;
    const sats = []; for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = .35 + r() * .45; sats.push([Math.cos(a) * d, Math.sin(a) * d, .04 + r() * .08]); }
    return (x, y) => {
      const rr0 = Math.hypot(x * sx, y), a = Math.atan2(y, x);
      const jag = 1 + (ang(a, 2.2, s) - .5) * 2 * jagA + (salida ? (ang(a, 7, s + 9, 2) - .5) * .6 : 0);
      const q = rr0 / (rh * jag);
      const hole = ss(1.08, .86, q);
      const fibK = ang(a, 14, s + 3, 2), fib = (1 - ss(1, 1.6 + fibK * 1.4, q)) * (q > .9 ? 1 : 0) * ss(.35, .7, fibK);
      const quem = salida ? 0 : (1 - ss(.9, 2.8, q)) * (.45 + .55 * fbm(x * 9 + s, y * 9)) * .7;
      const w = fbm(x * 2.3 + s, y * 2.3 - s), rs = rr0 / (.72 * (1 + (w - .5) * 1.1));
      let A = cl(1 - rs); A = Math.pow(A, .85);
      for (const [cx, cy, cr] of sats) A = Math.max(A, cl(1 - Math.hypot(x - cx, y - cy) / cr) * .55);
      A = Math.max(A, hole, fib * .9);
      return [.5 - hole * .5 + fib * .15, hole, Math.max(fib, quem), A];
    };
  },
  // rozadura: tira alargada con estrías longitudinales
  roce(r) {
    const s = r() * 50, L = .8 + r() * .12, W = .16 + r() * .1, cur = (r() - .5) * .3;
    return (x, y) => {
      const t = x / L; if (Math.abs(t) >= 1) return [.5, 0, 0, 0];
      const cy = cur * (1 - t * t) + (fbm(x * 2 + s, s) - .5) * .12, w = W * Math.pow(1 - t * t, .55) * (.75 + .5 * fbm(x * 3 + s, 2)), d = Math.abs(y - cy) / w;
      const est = .45 + .55 * vn(x * 5 + s, y * 70);
      const core = ss(1.05, .35, d) * est * ss(1, .7, Math.abs(t));
      const halo = ss(2.6, .7, d) * (1 - Math.abs(t) * .6);
      return [.5 - core * .2, core, halo * (.6 + .4 * fbm(x * 8, y * 8 + s)), Math.max(core, halo * .75)];
    };
  },
  // corte de cuchillo: línea fina en forma de lente con labios abiertos
  corte(r) {
    const s = r() * 50, L = .82 + r() * .12, W = .035 + r() * .025, cur = (r() - .5) * .25;
    return (x, y) => {
      const t = x / L; if (Math.abs(t) >= 1.08) return [.5, 0, 0, 0];
      const tt = Math.min(1, Math.abs(t)), cy = cur * (1 - t * t) + (vn(x * 6 + s, 3) - .5) * .03;
      const w = W * Math.pow(1 - tt * tt, .5) * (.8 + .4 * vn(x * 9 + s, 7)) + .004, d = Math.abs(y - cy);
      const core = ss(w * 1.05, w * .35, d);
      const lip = cl(ss(w * 3.2, w * 1.1, d) - core * .7);
      const halo = ss(.22, 0, d) * Math.pow(1 - tt, .7);
      return [.5 - core * .45 + lip * .25, core, lip, Math.max(core, lip * .9, halo * .7)];
    };
  },
  // moratón: varias manchas superpuestas deformadas por ruido (nunca un círculo)
  moraton(r) {
    const s = r() * 50, n = 3 + Math.floor(r() * 4), bl = [];
    for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r() * .32; bl.push([Math.cos(a) * d, Math.sin(a) * d * .8, .22 + r() * .25, .5 + r() * .5]); }
    return (x, y) => {
      const wx = x + (fbm(x * 2 + s, y * 2) - .5) * .5, wy = y + (fbm(x * 2 - s, y * 2 + 5) - .5) * .5;
      let f = 0; for (const [cx, cy, cr, k] of bl) { const d2 = ((wx - cx) ** 2 + (wy - cy) ** 2) / (cr * cr); f += k * Math.exp(-d2 * 1.6); }
      f *= .6 + .8 * fbm(x * 3.5 + s, y * 3.5);
      const A = ss(.12, .95, f), core = ss(.65, 1.35, f * (.75 + .5 * fbm(x * 7, y * 7 - s)));
      return [.5 + A * .3, core, fbm(x * 16 + s, y * 16, 3), A];
    };
  },
  // mancha de sangre empapando (borde irregular + gotas satélite)
  mancha(r) {
    const s = r() * 50, sats = []; for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = .4 + r() * .45; sats.push([Math.cos(a) * d, Math.sin(a) * d, .03 + r() * .09]); }
    const el = .75 + r() * .4;
    return (x, y) => {
      const rr = Math.hypot(x * el, y), a = Math.atan2(y, x), rad = .62 * (1 + (ang(a, 1.8, s) - .5) * .9 + (ang(a, 5, s + 4, 2) - .5) * .25);
      let A = cl(1 - rr / rad); A = Math.max(A, 0);
      for (const [cx, cy, cr] of sats) A = Math.max(A, cl(1 - Math.hypot(x - cx, y - cy) / cr) * .5);
      return [.5 + A * .05, ss(.4, .95, A) * (.6 + .4 * fbm(x * 6, y * 6 + s)), 0, A];
    };
  },
  // salpicadura direccional: impacto a la izquierda y gotas alargadas hacia +X (más pequeñas cuanto más lejos)
  spray(r) {
    const s = r() * 50, gotas = [], n = 28 + Math.floor(r() * 18);
    for (let i = 0; i < n; i++) { const t = Math.pow(r(), .8), x = -.45 + t * 1.35, y = (r() - .5) * (.15 + t * .9), sz = (.06 + r() * .06) * (1.1 - t * .75), lg = 1 + t * (2 + r() * 3); gotas.push([x, y, sz, lg]); }
    return (x, y) => {
      const a = Math.atan2(y, x + .55), rr = Math.hypot((x + .55) * 1.25, y), rad = .3 * (1 + (ang(a, 2.5, s) - .5) * 1.1);
      let A = cl(1 - rr / rad), G = A;
      for (const [cx, cy, sz, lg] of gotas) { const dx = (x - cx) / (sz * lg), dy = (y - cy) / sz, d = Math.hypot(dx, dy); if (d < 1) { const v = 1 - d; if (v > A) A = v; G = Math.max(G, v * .8); } }
      // regueros finos desde el impacto
      const rq = Math.abs(y - (fbm(x * 2 + s, 1) - .5) * .4) / (.012 + .02 * cl(1 - (x + .45)));
      if (x > -.4 && x < .7) A = Math.max(A, cl(1 - rq) * ss(.75, .2, x) * .8);
      return [.5, G, 0, A * ss(1, .9, Math.abs(x)) * ss(1, .9, Math.abs(y))];
    };
  },
  // goteo: reguero que baja (hacia -Y) y termina en gota; G = progreso a lo largo del reguero (0 arriba → 1 en la gota)
  goteo(r) {
    const s = r() * 50, y0 = .9, y1 = -.55 - r() * .25, W = .07 + r() * .05;
    return (x, y) => {
      const L = y0 - y1, t = (y0 - y) / L;
      const cx = (fbm(y * 2.5 + s, 1) - .5) * .22, w = W * (1 - t * .35) * (.8 + .4 * vn(y * 7 + s, 2)), d = Math.abs(x - cx);
      let A = 0; if (t >= 0 && t <= 1) A = ss(w, w * .45, d);
      const bulbo = cl(1 - Math.hypot(x - cx * .9, (y - y1) * 1.25) / (W * 1.75));
      A = Math.max(A, bulbo);
      const top = cl(1 - Math.hypot(x - cx, y - y0) / (W * 1.4)); A = Math.max(A, top);
      return [.5 + A * .08, cl(t), 0, A];
    };
  },
  // abolladura de metal: cráter con reborde, pintura aplastada, arañazos radiales
  abolladura(r) {
    const s = r() * 50, R0 = .42 + r() * .15, el = 1 + r() * .5;
    return (x, y) => {
      const a = Math.atan2(y, x), rq = Math.hypot(x * el, y) / (R0 * (1 + (ang(a, 2, s) - .5) * .5));
      const bowl = ss(1, 0, rq), rim = Math.exp(-(((rq - 1.05) / .12) ** 2));
      const pint = ss(1.15, .45, rq) * (.5 + .5 * fbm(x * 6 + s, y * 6));
      const ar = ss(.55, .85, ang(a, 22, s + 2, 2)) * ss(1.9, .7, rq) * (rq > .6 ? 1 : 0);
      return [.5 - bowl * .45 + rim * .18, pint, ar, Math.max(pint * .9, ar, rim * .6)];
    };
  },
  // arañazos de metal: varias rayas casi paralelas a lo largo de X
  aranazo(r) {
    const s = r() * 50, n = 4 + Math.floor(r() * 6), L = [];
    for (let i = 0; i < n; i++) L.push([(r() - .5) * .7, (r() - .5) * .18, -.9 + r() * .4, .45 + r() * .5, .006 + r() * .016]);
    return (x, y) => {
      let B = 0, G = 0;
      for (const [y0, sl, xa, xb, w] of L) { if (x < xa || x > xb) continue; const d = Math.abs(y - (y0 + sl * x + (vn(x * 8 + s, y0 * 9) - .5) * .02)), tap = ss(xa, xa + .15, x) * ss(xb, xb - .15, x); B = Math.max(B, ss(w, w * .3, d) * tap); G = Math.max(G, ss(w * 4, w, d) * tap * ss(.4, .7, vn(x * 20 + s, y * 20))); }
      return [.5 - B * .2, G, B, Math.max(B, G * .8)];
    };
  },
  // quemadura/hollín
  hollin(r) {
    const s = r() * 50;
    return (x, y) => {
      const a = Math.atan2(y, x), rq = Math.hypot(x, y) / (.8 * (1 + (ang(a, 2.4, s) - .5) * .9));
      const soot = ss(1, .1, rq) * (.55 + .45 * fbm(x * 5 + s, y * 5));
      return [.5, ss(.4, 0, rq), ss(.5, .8, ang(a, 10, s, 2)) * ss(1.1, .5, rq), soot];
    };
  },
  // agujero en el blindaje con cables que brillan
  cables(r) {
    const s = r() * 50, R0 = .38 + r() * .1, c = []; for (let i = 0; i < 4; i++) c.push([r() * 6.28, (r() - .5) * .5, .5 + r() * 1.5]);
    return (x, y) => {
      const a = Math.atan2(y, x), rq = Math.hypot(x, y) / (R0 * (1 + (ang(a, 3, s) - .5) * .8));
      const hole = ss(1.02, .9, rq), borde = Math.exp(-(((rq - 1.08) / .12) ** 2)) * ss(.3, .6, ang(a, 9, s + 1, 2));
      let G = 0; for (const [f, o, k] of c) { const d = Math.abs(y - (o + Math.sin(x * k * 3 + f) * .15)); G = Math.max(G, ss(.035, .01, d)); }
      G *= hole;
      return [.5 - hole * .4 + borde * .2, G, borde, Math.max(hole, borde)];
    };
  },
  // charco grande con lóbulos (campo lineal desde el centro: crece hacia fuera con el umbral)
  charco(r) {
    const s = r() * 50, sats = []; for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = .62 + r() * .25; sats.push([Math.cos(a) * d, Math.sin(a) * d, .04 + r() * .07]); }
    return (x, y) => {
      const a = Math.atan2(y, x), rr = Math.hypot(x, y), rad = .72 * (1 + (ang(a, 1.5, s) - .5) * .7 + (ang(a, 4, s + 6, 2) - .5) * .3);
      let A = cl(1 - rr / rad);
      for (const [cx, cy, cr] of sats) A = Math.max(A, cl(1 - Math.hypot(x - cx, y - cy) / cr) * .12);
      return [.5 + A * .05, ss(.3, 1, A), fbm(x * 10 + s, y * 10, 3), A * ss(1, .92, Math.max(Math.abs(x), Math.abs(y)))];
    };
  },
  // gota en el suelo (pequeña, con corona)
  gota(r) {
    const s = r() * 50, n = 5 + Math.floor(r() * 6), co = []; for (let i = 0; i < n; i++) { const a = r() * 6.28; co.push([a, .45 + r() * .35, .05 + r() * .07]); }
    return (x, y) => {
      const a = Math.atan2(y, x), rr = Math.hypot(x, y), rad = .38 * (1 + (ang(a, 3, s) - .5) * .5);
      let A = cl(1 - rr / rad);
      for (const [b, d, cr] of co) A = Math.max(A, cl(1 - Math.hypot(x - Math.cos(b) * d, y - Math.sin(b) * d) / cr) * .6);
      return [.5, ss(.3, .9, A), 0, A];
    };
  }
};
// ---------- Catálogo: categoría → generador × variantes ----------
const PLAN = [['agujero', 6, false], ['salida', 3, true], ['roce', 4], ['corte', 4], ['moraton', 8], ['mancha', 5], ['spray', 6], ['goteo', 4], ['abolladura', 4], ['aranazo', 4], ['hollin', 3], ['cables', 2], ['charco', 4], ['gota', 6]];
export const CATS = {}; const tareas = [];
{ let i = 0; for (const [cat, n, extra] of PLAN) { CATS[cat] = []; for (let k = 0; k < n; k++) { CATS[cat].push(i); tareas.push([i, cat === 'salida' ? 'agujero' : cat, extra, 9000 + i * 131]); i++; } } }
export const N_CASILLAS = tareas.length;
// rectángulo UV de la casilla i (u0, v0, du, dv) con medio texel de margen
export function rect(i) { const cx = i % POR_FILA, cy = Math.floor(i / POR_FILA), m = 1.5 / TAM; return [cx / POR_FILA + m, cy / POR_FILA + m, 1 / POR_FILA - 2 * m, 1 / POR_FILA - 2 * m]; }
export const elegir = cat => { const l = CATS[cat]; return l[Math.floor(Math.random() * l.length)]; };

function generar(i, gen, extra, seed) {
  const f = GEN[gen](prng(seed), extra), cx = (i % POR_FILA) * CAS, cy = Math.floor(i / POR_FILA) * CAS;
  for (let j = 0; j < CAS; j++) {
    const y = (j + .5) / CAS * 2 - 1, fila = ((cy + j) * TAM + cx) * 4;
    for (let k = 0; k < CAS; k++) {
      const x = (k + .5) / CAS * 2 - 1, v = f(x, y), e = ss(1, .93, Math.max(Math.abs(x), Math.abs(y)));
      const o = fila + k * 4;
      datos[o] = cl(v[0] * e + .5 * (1 - e)) * 255; datos[o + 1] = cl(v[1] * e) * 255; datos[o + 2] = cl(v[2] * e) * 255; datos[o + 3] = cl(v[3] * e) * 255;
    }
  }
}
// por defecto el campo neutro (relieve 0.5) para que el mip no oscurezca
for (let i = 0; i < datos.length; i += 4) datos[i] = 128;
export const estadoAtlas = { listas: 0, ms: 0 };
export const atlasListo = new Promise(res => {
  let n = 0; const t0 = performance.now();
  const paso = () => {
    const lim = performance.now() + 12; // ~12 ms por tarea
    while (n < tareas.length && performance.now() < lim) { const [i, g, ex, sd] = tareas[n++]; generar(i, g, ex, sd); }
    estadoAtlas.listas = n;
    if (n < tareas.length) canal.port2.postMessage(0);
    else { atlas.needsUpdate = true; estadoAtlas.ms = Math.round(performance.now() - t0); res(true); }
  };
  // MessageChannel en vez de setTimeout: no lo frena el navegador en pestañas en segundo plano
  const canal = new MessageChannel(); canal.port1.onmessage = paso; canal.port2.postMessage(0);
});
