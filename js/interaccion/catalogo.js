// Catálogo de objetos por código: geometría barata fusionada con colores por vértice (1-2 mallas por objeto y
// solo 4 materiales compartidos para todo el catálogo), forma física, material de sonido y comportamiento.
// Convención: origen en la base del objeto (apoyado en +Y) salvo herramientas, que tienen el origen en la
// empuñadura y la punta hacia -Z (así se sujetan igual que el cuchillo en VR y apuntan donde miras en PC).
import { THREE } from '../nucleo.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

export const MAT = {
  base: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .04 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .32, metalness: .85 }),
  vidrio: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .6, roughness: .06, metalness: .1, depthWrite: false }),
  luz: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d0, emissiveIntensity: 0, roughness: .2 })
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rb = (w, h, d, r = .2) => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * r);
const cil = (r, h, s = 12, r2 = r) => new THREE.CylinderGeometry(r, r2, h, s);
const X = Math.PI / 2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _s = new THREE.Vector3(1, 1, 1);
// piezas: [geo, color, [x,y,z], [rx,ry,rz], escala?] → una sola geometría con color por vértice
export function armar(piezas) {
  const geos = piezas.map(([g, col, p = [0, 0, 0], r = [0, 0, 0], s]) => {
    let q = g.index ? g.toNonIndexed() : g.clone(); g.dispose();
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    _s.set(1, 1, 1); if (s) Array.isArray(s) ? _s.set(...s) : _s.setScalar(s);
    q.applyMatrix4(_m.compose(new THREE.Vector3(...p), _q.setFromEuler(_e.set(...r)), _s));
    _c.set(col); const n = q.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
    q.setAttribute('color', new THREE.BufferAttribute(a, 3)); return q;
  });
  const m = BGU.mergeGeometries(geos, false); geos.forEach(g => g.dispose()); m.computeBoundingBox(); m.computeBoundingSphere(); return m;
}

// ---------- Definiciones ----------
// mat: sonido · rompe: Δv (m/s) que lo rompe · rotura: tipo de fragmentos · hp: aguante a golpes/balas
// col: formas físicas (fisica-adaptador) · apoyo: altura del origen sobre la superficie al colocarlo
// herramienta: se sujeta con pose fija · punta: punto de trabajo local · golpe: daño al golpear con él
// usar: acción con el gatillo (VR) o clic (PC) · dosManos: se puede coger con las dos manos
export const TIPOS = {
  botella: { label: 'botella', mat: 'vidrio', masa: .45, rompe: 4.2, rotura: 'vidrio', apoyo: 0, var: [0x2e6b3a, 0x5a3416, 0x9fc0a8],
    mallas: v => [{ mat: 'vidrio', piezas: [[cil(.036, .19, 14), v, [0, .095, 0]], [cil(.013, .05, 14, .036), v, [0, .215, 0]], [cil(.013, .06, 10), v, [0, .27, 0]]] },
      { mat: 'base', piezas: [[cil(.0372, .07, 14), 0xe8dcc0, [0, .1, 0]], [cil(.015, .012, 10), 0xc8a030, [0, .305, 0]]] }],
    col: [{ f: 'cil', r: .036, h: .31, c: [0, .155, 0] }] },
  lata: { label: 'lata', mat: 'lata', masa: .04, apoyo: 0, var: [0xb01818, 0x1a4fa0, 0xd0d4d8],
    mallas: v => [{ mat: 'metal', piezas: [[cil(.033, .11, 14), v, [0, .061, 0]], [cil(.03, .006, 14, .033), 0xc8ccd0, [0, .119, 0]], [cil(.033, .006, 14, .03), 0xc8ccd0, [0, .003, 0]]] }],
    col: [{ f: 'cil', r: .033, h: .122, c: [0, .061, 0] }] },
  taza: { label: 'taza', mat: 'ceramica', masa: .3, rompe: 4.6, rotura: 'ceramica', apoyo: 0, var: [0xf0ece4, 0x2f5f8a, 0xb84a2a],
    mallas: v => [{ mat: 'base', piezas: [[cil(.042, .095, 16, .038), v, [0, .0475, 0]], [new THREE.TorusGeometry(.026, .007, 6, 12), v, [.046, .05, 0], [0, 0, 0]], [cil(.036, .002, 14), 0x2a1a10, [0, .09, 0]]] }],
    col: [{ f: 'cil', r: .042, h: .095, c: [0, .0475, 0] }] },
  plato: { label: 'plato', mat: 'ceramica', masa: .35, rompe: 3.8, rotura: 'ceramica', apoyo: 0, var: [0xf4f0e6],
    mallas: v => [{ mat: 'base', piezas: [[cil(.115, .016, 20, .085), v, [0, .008, 0]]] }],
    col: [{ f: 'cil', r: .112, h: .016, c: [0, .008, 0] }] },
  caja: { label: 'caja de cartón', mat: 'carton', masa: 1.2, apoyo: 0, sombra: true, var: [0xa47a4a, 0x8e6a40],
    mallas: v => [{ mat: 'base', piezas: [[rb(.42, .3, .32, .05), v, [0, .15, 0]], [box(.08, .004, .325), 0xcab890, [0, .301, 0]]] }],
    col: [{ f: 'caja', m: [.21, .15, .16], c: [0, .15, 0] }] },
  libro: { label: 'libro', mat: 'papel', masa: .5, apoyo: 0, var: [0x7a1e1e, 0x1e3a6a, 0x2e5a2e, 0x5a4a2a],
    mallas: v => [{ mat: 'base', piezas: [[box(.15, .036, .22), v, [0, .018, 0]], [box(.142, .028, .214), 0xeee6d0, [.006, .018, 0]]] }],
    col: [{ f: 'caja', m: [.075, .018, .11], c: [0, .018, 0] }] },
  pelota: { label: 'pelota', mat: 'goma', masa: .35, apoyo: .11, rebote: .78, var: [0xd04a1a],
    mallas: v => [{ mat: 'base', piezas: [[new THREE.SphereGeometry(.11, 16, 12), v], [new THREE.TorusGeometry(.1105, .004, 4, 24), 0x1a1a1a, [0, 0, 0], [X, 0, 0]], [new THREE.TorusGeometry(.1105, .004, 4, 24), 0x1a1a1a]]}],
    col: [{ f: 'bola', r: .11 }] },
  cono: { label: 'cono', mat: 'plastico', masa: 1.8, apoyo: 0, sombra: true, var: [0xe0561a],
    mallas: v => [{ mat: 'base', piezas: [[cil(.03, .46, 14, .16), v, [0, .26, 0]], [cil(.085, .07, 14, .105), 0xf0f0ea, [0, .3, 0]], [box(.36, .03, .36), 0x151515, [0, .015, 0]]] }],
    col: [{ f: 'caja', m: [.18, .015, .18], c: [0, .015, 0] }, { f: 'cono', r: .15, h: .46, c: [0, .26, 0] }] },
  silla: { label: 'silla', mat: 'madera', masa: 5, apoyo: 0, sombra: true, dosManos: true, var: [0x7a5432],
    mallas: v => [{ mat: 'base', piezas: [[box(.44, .04, .44), v, [0, .45, 0]], ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [box(.035, .45, .035), v, [a * .19, .225, b * .19]]),
      [box(.035, .45, .035), v, [-.19, .69, .19]], [box(.035, .45, .035), v, [.19, .69, .19]], [box(.44, .12, .03), v, [0, .83, .19]], [box(.44, .05, .03), v, [0, .63, .19]]] }],
    col: [{ f: 'caja', m: [.22, .02, .22], c: [0, .45, 0] }, { f: 'caja', m: [.2, .21, .2], c: [0, .215, 0] }, { f: 'caja', m: [.22, .22, .02], c: [0, .68, .19] }] },
  // ---------- herramientas (origen en la empuñadura, punta hacia -Z) ----------
  rotulador: { label: 'rotulador', mat: 'plastico', masa: .02, apoyo: .009, herramienta: true, punta: [0, 0, -.074], escribe: { ancho: 4, alfa: 1 }, var: [0x111111, 0x1a3cc8, 0xc81a1a],
    mallas: v => [{ mat: 'base', piezas: [[cil(.009, .1, 10), 0xeeeeee, [0, 0, .01], [X, 0, 0]], [cil(.0095, .045, 10), v, [0, 0, -.045], [X, 0, 0]], [cil(.003, .012, 6, .006), v, [0, 0, -.068], [X, 0, 0]]] }],
    col: [{ f: 'caja', m: [.0085, .0085, .07], c: [0, 0, -.005] }] }, // caja: un rotulador real tiene planos y no rueda hasta el borde
  tiza: { label: 'tiza', mat: 'papel', masa: .01, apoyo: .006, herramienta: true, punta: [0, 0, -.035], escribe: { ancho: 5, alfa: .85, tiza: true }, var: [0xf4f4ee, 0xf0d040],
    mallas: v => [{ mat: 'base', piezas: [[cil(.006, .07, 8), v, [0, 0, 0], [X, 0, 0]]] }],
    col: [{ f: 'caja', m: [.0055, .0055, .035] }] },
  borrador: { label: 'borrador', mat: 'madera', masa: .08, apoyo: .018, herramienta: true, punta: [0, -.018, 0], borra: 26, var: [0x6a4a2a],
    mallas: v => [{ mat: 'base', piezas: [[box(.05, .022, .13), v, [0, .006, 0]], [box(.05, .014, .13), 0x2a2a30, [0, -.011, 0]]] }],
    col: [{ f: 'caja', m: [.025, .018, .065] }] },
  llave: { label: 'llave inglesa', mat: 'metal', masa: .55, apoyo: .01, herramienta: true, punta: [0, 0, -.2], golpe: 22, var: [0x8a9098],
    mallas: v => [{ mat: 'metal', piezas: [[box(.024, .01, .2), v, [0, 0, -.06]], [box(.06, .014, .045), v, [0, 0, -.18]], [box(.02, .016, .03), 0x3a3e44, [0, 0, -.2]]] }],
    col: [{ f: 'caja', m: [.03, .01, .12], c: [0, 0, -.1] }] },
  martillo: { label: 'martillo', mat: 'madera', masa: .7, apoyo: .016, herramienta: true, punta: [0, 0, -.28], golpe: 30, var: [0x8a5a30],
    mallas: v => [{ mat: 'base', piezas: [[cil(.014, .3, 8), v, [0, 0, -.12], [X, 0, 0]]] }, { mat: 'metal', piezas: [[box(.11, .03, .03), 0x50555c, [.01, 0, -.28]]] }],
    col: [{ f: 'caja', m: [.016, .016, .15], c: [0, 0, -.12] }, { f: 'caja', m: [.055, .016, .016], c: [.01, 0, -.28] }] },
  linterna: { label: 'linterna', mat: 'metal', masa: .35, apoyo: .028, herramienta: true, punta: [0, 0, -.13], usar: 'linterna', var: [0x1a1c20],
    mallas: v => [{ mat: 'metal', piezas: [[cil(.02, .18, 12), v, [0, 0, -.02], [X, 0, 0]], [cil(.028, .05, 12, .021), v, [0, 0, -.13], [X, 0, 0]], [box(.012, .008, .03), 0xb02020, [0, .021, .0]]] }, { mat: 'luz', piezas: [[cil(.024, .004, 12), 0xffffff, [0, 0, -.156], [X, 0, 0]]] }],
    col: [{ f: 'cil', r: .025, h: .23, c: [0, 0, -.04], rx: X }] },
  radio: { label: 'radio', mat: 'plastico', masa: .9, apoyo: 0, usar: 'radio', sombra: true, var: [0x2a2c30],
    mallas: v => [{ mat: 'base', piezas: [[rb(.24, .15, .07, .15), v, [0, .075, 0]], [box(.1, .1, .004), 0x111111, [-.05, .075, .036]], [cil(.018, .01, 12), 0xb0b0a8, [.07, .1, .037], [X, 0, 0]], [box(.05, .018, .004), 0x80ff90, [.07, .05, .036]], [box(.18, .012, .012), 0x111111, [0, .158, 0]]] },
      { mat: 'metal', piezas: [[cil(.003, .22, 6), 0xc8ccd0, [.1, .26, 0]]] }],
    col: [{ f: 'caja', m: [.12, .075, .035], c: [0, .075, 0] }] },
  tuberia: { label: 'tubería', mat: 'metal', masa: 2.2, apoyo: .022, herramienta: true, dosManos: true, punta: [0, 0, -.85], golpe: 26, var: [0x6e5e56],
    mallas: v => [{ mat: 'metal', piezas: [[cil(.022, 1.1, 10), v, [0, 0, -.3], [X, 0, 0]], [cil(.028, .05, 10), 0x4a4440, [0, 0, -.85], [X, 0, 0]]] }],
    col: [{ f: 'cil', r: .024, h: 1.1, c: [0, 0, -.3], rx: X }] },
  cajaMadera: { label: 'caja de madera', mat: 'madera', masa: 7, apoyo: 0, rompe: 9, hp: 45, rotura: 'madera', sombra: true, dosManos: true, var: [0x8a6a40],
    mallas: v => { const k = 0x5e4526, p = [[box(.5, .5, .5), v, [0, .25, 0]]]; for (const y of [.02, .48]) for (const z of [-.24, .24]) p.push([box(.53, .05, .05), k, [0, y, z]]); for (const x of [-.24, .24]) for (const z of [-.24, .24]) p.push([box(.05, .5, .05), k, [x, .25, z]]); p.push([box(.6, .04, .02), k, [0, .25, .255], [0, 0, .78]], [box(.6, .04, .02), k, [0, .25, -.255], [0, 0, -.78]]); return [{ mat: 'base', piezas: p }]; },
    col: [{ f: 'caja', m: [.26, .26, .26], c: [0, .25, 0] }] },
  monitor: { label: 'monitor', mat: 'plastico', masa: 6, apoyo: 0, rompe: 6, hp: 10, rotura: 'pantalla', sombra: true, dosManos: true, var: [0xb8b4a8],
    mallas: v => [{ mat: 'base', piezas: [[rb(.42, .34, .3, .08), v, [0, .2, -.02]], [box(.3, .2, .18), v, [0, .2, -.2]], [box(.2, .03, .2), v, [0, .015, -.05]]] }, { mat: 'vidrio', piezas: [[box(.34, .26, .01), 0x1a2a30, [0, .2, .131]]] }],
    col: [{ f: 'caja', m: [.21, .17, .2], c: [0, .2, -.06] }] },
  botiquin: { label: 'botiquín', mat: 'plastico', masa: .6, apoyo: 0, usar: 'curar', var: [0xf0f0ec],
    mallas: v => [{ mat: 'base', piezas: [[rb(.26, .09, .18, .15), v, [0, .045, 0]], [box(.08, .004, .025), 0xc81a1a, [0, .091, 0]], [box(.025, .004, .08), 0xc81a1a, [0, .091, 0]]] }],
    col: [{ f: 'caja', m: [.13, .045, .09], c: [0, .045, 0] }] },
  venda: { label: 'venda', mat: 'papel', masa: .08, apoyo: 0, usar: 'venda', var: [0xeeeae0],
    mallas: v => [{ mat: 'base', piezas: [[box(.07, .045, .07), v, [0, .0225, 0]], [box(.072, .012, .072), 0xd8d2c4, [0, .03, 0]]] }],
    col: [{ f: 'caja', m: [.035, .0225, .035], c: [0, .0225, 0] }] },
  municion: { label: 'cargador de X-56D', mat: 'metal', masa: 1.1, apoyo: 0, usar: 'municion', var: [0x4a5236],
    mallas: v => [{ mat: 'metal', piezas: [[box(.22, .11, .1), v, [0, .055, 0]], [box(.222, .02, .102), 0xd9a400, [0, .07, 0]], [box(.12, .012, .02), 0x222222, [0, .116, 0]]] }],
    col: [{ f: 'caja', m: [.11, .055, .05], c: [0, .055, 0] }] },
  cinta: { label: 'grabadora de Mike', mat: 'plastico', masa: .15, apoyo: 0, usar: 'cinta', var: [0x1c1e22],
    mallas: v => [{ mat: 'base', piezas: [[rb(.06, .022, .11, .2), v, [0, .011, 0]], [box(.04, .004, .03), 0x666a70, [0, .023, -.02]], [box(.008, .004, .008), 0xff2a1a, [.018, .023, .035]]] }],
    col: [{ f: 'caja', m: [.03, .011, .055], c: [0, .011, 0] }] },
  // guitarra acústica: origen en la base del cuerpo, mástil hacia +Y, cuerdas en la cara +Z (z ≈ .052)
  guitarra: { label: 'guitarra', mat: 'madera', masa: 2.2, apoyo: 0, usar: 'guitarra', sombra: true, dosManos: false, var: [0xb0773a],
    mallas: v => [{ mat: 'base', piezas: [[cil(.19, .09, 20), v, [0, .2, 0], [X, 0, 0], [1, 1, 1]], [cil(.145, .09, 20), v, [0, .47, 0], [X, 0, 0]], [cil(.055, .092, 16), 0x1a1008, [0, .34, .002], [X, 0, 0]],
      [box(.05, .52, .03), 0x3a2414, [0, .82, .02]], [box(.075, .17, .022), 0x2a1a10, [0, 1.16, .015]], [box(.12, .02, .015), 0x1a1008, [0, .14, .05]],
      ...[-2.5, -1.5, -.5, .5, 1.5, 2.5].map(i => [box(.0016, .98, .0016), 0xd8d0c0, [i * .0075, .64, .052]])] }],
    col: [{ f: 'caja', m: [.19, .21, .045], c: [0, .3, 0] }, { f: 'caja', m: [.03, .33, .018], c: [0, .88, .02] }] },
  // extintor: origen en la maneta (se cuelga de la mano), boquilla hacia -Z
  extintor: { label: 'extintor', mat: 'metal', masa: 4.5, apoyo: .5, usar: 'extintor', herramienta: true, punta: [0, -.02, -.15], sombra: true, var: [0xc01c14],
    mallas: v => [{ mat: 'metal', piezas: [[cil(.065, .4, 14), v, [0, -.27, 0]], [new THREE.SphereGeometry(.065, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), v, [0, -.07, 0]], [cil(.018, .05, 8), 0x2a2a2a, [0, -.03, 0]],
      [box(.03, .012, .12), 0x1a1a1a, [0, .0, -.03]], [box(.025, .01, .1), 0x2a2a2a, [0, .016, -.02], [-.25, 0, 0]], [cil(.012, .09, 8), 0x111111, [0, -.02, -.11], [X, 0, 0]], [box(.13, .1, .003), 0xf4f4ec, [0, -.27, -.066]]] }],
    col: [{ f: 'cil', r: .066, h: .46, c: [0, -.25, 0] }] },
  // bombona de gas: explota con una bala o un golpe muy fuerte
  bombona: { label: 'bombona de gas', mat: 'metal', masa: 6, apoyo: 0, rompe: 11, rotura: 'explosion', hp: 1, sombra: true, dosManos: true, var: [0xe0a020, 0x2a6ac0],
    mallas: v => [{ mat: 'metal', piezas: [[cil(.12, .42, 16), v, [0, .25, 0]], [new THREE.SphereGeometry(.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), v, [0, .46, 0]], [cil(.12, .04, 16, .1), v, [0, .02, 0]], [cil(.03, .06, 8), 0x8a8a8a, [0, .6, 0]], [new THREE.TorusGeometry(.05, .008, 6, 14), 0x8a8a8a, [0, .64, 0], [X, 0, 0]], [cil(.122, .05, 16), 0x1a1a1a, [0, .3, 0]]] }],
    col: [{ f: 'cil', r: .12, h: .6, c: [0, .3, 0] }] }
};

// geometría por tipo y variante (se hace una vez)
const cache = new Map();
export function mallasDe(tipo, v) {
  const k = tipo + '|' + v; let r = cache.get(k);
  if (!r) { r = TIPOS[tipo].mallas(v).map(p => ({ mat: p.mat, geo: armar(p.piezas) })); cache.set(k, r); }
  return r;
}
