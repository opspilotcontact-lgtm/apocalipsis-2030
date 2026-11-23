// El mapa de la Tierra: pueblo, casa de Dave, tienda de Hank, carretera, laboratorio de Mike y base militar.
// Escala real en metros. Norte = -Z. Las piezas de "calma" solo existen antes del ataque; las de "caos", después.
import { THREE, V3, rnd, M, std, glow, block, cyl, flat, pieza, crate, en, B, capas, fuenteLuz, canvasPlane, textDraw, toTex, cv2d, canvasTex, rbox, cylG, luzExtra, addCollider, colliders } from '../nucleo.js';
import { makeRobot, staticPose, PAL, instancia } from '../cuerpos.js';
import { casaDave, modelosCasa, labMike, manzana, fachadaDetalle, coche as cocheProc, superficies, tiendaHank, baseDetalle, banderaMat, hojas } from './decorado.js';
import { construirAtmosfera, clima, pulsoRey } from './atmosfera.js';
import { edificioVariado, calleViva, FACHADAS_ON } from './fachadas.js';

// ---------- Puntos de la historia: [x, z, yaw] (yaw del jugador: 0 = mirando al norte) ----------
export const PUNTOS = {
  'lab.entrada': [0, -133, 0], 'lab.mesa': [4.6, -145.2], 'lab.vitrina': [0, -140.6], 'lab.capsula': [8.6, -143.5], 'lab.salida': [0, -126],
  'lab.mikeHerido': [2.3, -146.75], 'lab.trasera': [-8.5, -150.5], 'lab.dentroTrasera': [-8.5, -146, Math.PI], 'lab.consola': [5.2, -144.6],
  'lab.agujero': [-10.75, -160.5], 'compound.esquina': [-28, -117],
  'cordon': [0, -109], 'cordon.soldado': [1.5, -116.2], 'cordon.coche': [0, -101, 0],
  'pickup.lab': [8, -124, Math.PI], 'pickup.labDia': [6, -114, Math.PI],
  'casa.calle': [20, 72], 'casa.entrada': [20, 77.5, Math.PI], 'casa.salon': [16.5, 84.6, -1.1], 'casa.sofa': [17.5, 88.5], 'casa.coche': [11, 75.5, 0], 'casa.piedra': [25.5, 77.2], 'casa.sarah': [22.5, 87.5],
  'casa.hank': [23.5, 84.5], 'casa.john': [20, 76.2], 'casa.puertaDentro': [20, 81.5, Math.PI],
  'tienda.puerta': [-6, -50, Math.PI / 2], 'tienda.dentro': [-12.5, -50, Math.PI / 2], 'tienda.llegada': [1.5, -38.5, Math.PI / 2], 'tienda.hank': [-18.6, -50.5], 'tienda.coche': [2.5, -42, Math.PI], 'tienda.rifle': [-17.2, -48.6],
  'calle.norte': [0, -30], 'calle.centro': [0, 8], 'cruce.este': [60, 0],
  'camion.inicio': [70, 0, Math.PI / 2], 'base.puerta': [109, 0], 'base.parada': [121, -39, -Math.PI / 2], 'base.callejon': [140, -39],
  'base.senal': [139.5, -26.5], 'base.cobertura': [146, -6], 'base.orion': [150, 20], 'base.deposito': [168, -50], 'base.rampa': [150, 26.5]
};
export const P3 = k => { const p = PUNTOS[k]; return new V3(p[0], 0, p[1]); };

// objetos vivos que la historia necesita tocar
export const W = { pantallas: [], tele: null, barrera: null, focosBase: [], focosLab: [], camionesCordon: [], orion: null, orionSeat: null, camion: null, camionSeat: null, casco: null, capsulas: [], lab: { rotos: [] }, senalLab: null, colosoBase: null, superficies: [] };

// ---------- Piezas reutilizables ----------
const poolMat = new THREE.MeshBasicMaterial({ map: canvasTex(128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,190,110,.9)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const coneMat = new THREE.MeshBasicMaterial({ color: 0xffb35a, transparent: true, opacity: .05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
luzExtra.pool = poolMat; luzExtra.cone = coneMat;
const hoja = std({ color: 0x2f4a26, roughness: .95, flatShading: true }), hoja2 = std({ color: 0x3e5a2a, roughness: .95, flatShading: true }), tronco = std({ color: 0x3b2a1c, roughness: .95 });
const coche = [std({ color: 0x7a1e1e, metalness: .5, roughness: .4 }), std({ color: 0x1e3a6a, metalness: .5, roughness: .4 }), std({ color: 0xb8b8b0, metalness: .5, roughness: .4 })];
const sofaMat = std({ color: 0x5a4a3a, roughness: .95 }), sacoMat = std({ map: M.lona.map, color: 0xd8c4a0, roughness: 1 });
// halos de las farolas y resplandor de los fuegos: un único Points por capa (1 llamada de dibujo para todos)
const texHalo = canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,235,200,.55)'); g.addColorStop(.5, 'rgba(255,200,140,.12)'); g.addColorStop(1, 'rgba(255,180,120,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, false);
const haloMat = new THREE.PointsMaterial({ map: texHalo, color: 0xffc078, size: 2.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true });
const haloFuegoMat = new THREE.PointsMaterial({ map: texHalo, color: 0xff7a2a, size: 3.4, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true });
luzExtra.halo = haloMat;
const halos = { tierra: [], caos: [] };
// llamas: dos planos cruzados con una llama pintada (aditivos, se fusionan entre sí)
const texLlama = canvasTex(128, (x, s) => { x.clearRect(0, 0, s, s); for (let k = 0; k < 3; k++) { const cx = s / 2 + (k - 1) * s * .14, g = x.createRadialGradient(cx, s * .78, 2, cx, s * .62, s * (.42 - k * .06)); g.addColorStop(0, 'rgba(255,240,190,.95)'); g.addColorStop(.35, 'rgba(255,150,40,.7)'); g.addColorStop(1, 'rgba(200,40,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(cx - s * .2, s); x.quadraticCurveTo(cx - s * .28, s * .45, cx, s * (.08 + k * .1)); x.quadraticCurveTo(cx + s * .28, s * .45, cx + s * .2, s); x.fill(); } }, false);
const llamaMat = new THREE.MeshBasicMaterial({ map: texLlama, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
luzExtra.llama = llamaMat;
// geometrías del atrezo (compartidas; hornear() las fusiona por material)
const gBolsa = (() => { const g = new THREE.IcosahedronGeometry(.32, 1), p = g.attributes.position, v = new V3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.y *= .72; v.multiplyScalar(1 + Math.sin(v.x * 9 + v.z * 7) * .08); if (v.y < -.12) v.y = -.12; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })();
const gRueda = new THREE.TorusGeometry(.32, .12, 6, 14).rotateX(Math.PI / 2);
const gCono = new THREE.ConeGeometry(.15, .52, 10);

function farola(x, z, ry = 0) {
  cyl(x, z, .09, 5.8, M.dark, { seg: 8 });
  const ax = x - Math.sin(ry + Math.PI / 2) * .6, az = z - Math.cos(ry + Math.PI / 2) * .6;
  block((x + ax) / 2, (z + az) / 2, .7, .12, .1, M.dark, { y: 5.7, collide: false, ry });
  block(ax, az, .4, .28, .08, M.sodium, { y: 5.6, collide: false, cast: false, ry, shoot: false });
  flat(ax, az, 6, 6, poolMat, .03);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.5, 16, 1, true), coneMat); pieza(cone, ax, 2.85, az, { cast: false, shoot: false });
  fuenteLuz(ax, 5.3, az, 0xffb35a, 40, 18); // farola: charco de luz que guía (exposición nocturna, bloque B)
  halos[B.cap === 'caos' ? 'caos' : 'tierra'].push(ax + B.ox, 5.45, az + B.oz);
}
function arbol(x, z, s = 1) {
  cyl(x, z, .18 * s, 2.2 * s, tronco, { seg: 7 });
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * s, 0), Math.random() < .5 ? hoja : hoja2); c.scale.y = 1.25; pieza(c, x, 3.2 * s, z, { shoot: false });
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 0), hoja); pieza(c2, x + .5 * s, 4.3 * s, z - .3 * s, { shoot: false });
}
function edificio(x, z, w, d, h, mat, cara) { if (cara && FACHADAS_ON) return edificioVariado(x, z, w, d, h, cara); // fachadas variadas (misma colisión); ?fachadasViejas = la de antes
  block(x, z, w, d, h, mat, { s: 12 }); block(x, z, w + .4, d + .4, .4, M.concrete, { y: h, collide: false, s: 3 }); if (cara) fachadaDetalle(x, z, w, d, h, cara); }
function cocheAparcado(x, z, ry, mi) { cocheProc(x, z, ry, { color: [0x7a1e1e, 0x1e3a6a, 0xb8b8b0][mi % 3] }); }
function cocheQuemado(x, z, ry = 0) { cocheProc(x, z, ry, { quemado: true }); }
function fuego(x, z, s = 1) {
  const b = cyl(x, z, .36 * s, .95 * s, M.rust, { r2: .34 * s });
  const ft = new THREE.Mesh(new THREE.CircleGeometry(.32 * s, 16), M.fire); ft.rotation.x = -Math.PI / 2; pieza(ft, x, .96 * s, z, { cast: false, shoot: false });
  for (const r of [0, Math.PI / 2, Math.PI / 4]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(.9 * s, 1.25 * s), llamaMat); pieza(f, x, .96 * s + .58 * s, z, { ry: r, cast: false, shoot: false }); }
  halos.caos.push(x + B.ox, 1.5 * s, z + B.oz);
  fuenteLuz(x, 1.6 * s, z, 0xff7a2a, 22 * s, 13, 'fuego');
  return b;
}
// valla metálica recta (eje X o Z) con huecos [[a,b],...]
function valla(eje, fijo, a0, a1, h = 2.6, huecos = []) {
  const tramos = []; let cur = a0;
  for (const [g0, g1] of [...huecos].sort((p, q) => p[0] - q[0])) { if (g0 > cur) tramos.push([cur, g0]); cur = Math.max(cur, g1); }
  if (cur < a1) tramos.push([cur, a1]);
  for (const [s0, s1] of tramos) {
    const L = s1 - s0, c = (s0 + s1) / 2; if (L < .05) continue;
    const g = new THREE.PlaneGeometry(L, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 1.5, uv.getY(i) * h / 1.5);
    const m = new THREE.Mesh(g, M.valla);
    if (eje === 'x') { pieza(m, c, h / 2, fijo, { shoot: false }); addCollider(s0, s1, fijo - .12, fijo + .12, h); }
    else { m.rotation.y = Math.PI / 2; pieza(m, fijo, h / 2, c, { shoot: false }); addCollider(fijo - .12, fijo + .12, s0, s1, h); }
    for (let t = s0; t <= s1 + .01; t += Math.max(1, L / Math.ceil(L / 3))) { const px = eje === 'x' ? t : fijo, pz = eje === 'x' ? fijo : t; const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, h + .2, 6), M.steel); pieza(p, px, (h + .2) / 2, pz, { shoot: false }); }
  }
}
function sacos(x, z, w, d, h = 1.1) { block(x, z, w, d, h, sacoMat, { s: .6 }); }
function torre(x, z, h = 8) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(x + dx, z + dz, .1, h, M.steel, { seg: 6, collide: false });
  addCollider(x - 1.1, x + 1.1, z - 1.1, z + 1.1, 2.2);
  block(x, z, 3, 3, .2, M.dark, { y: h, collide: false }); block(x, z, 3, .1, 1, M.steel, { y: h + .2, collide: false }); block(x, z - 1.45, 3, .1, 1, M.steel, { y: h + .2, collide: false });
}
// letrero luminoso
function letrero(texto, w, h, x, y, z, ry, color = '#ffcf6a', bg = 'rgba(30,10,8,.92)') { const l = canvasPlane(w, h, 1024, textDraw(color, .7, bg)); l.mesh.rotation.y = ry; pieza(l.mesh, x, y, z, { static: false, cast: false }); l.set(texto); return l; }

// ---------- Construcción ----------
export async function construirTierra() {
  // suelo general + cerros alrededor (cierran el horizonte con la niebla)
  flat(43.5, -35, 300, 310, M.tierra, 0, 0, 4);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
    const r = 175 + rnd(-10, 15), x = 43 + Math.cos(a) * r * 1.05, z = -35 + Math.sin(a) * r, h = rnd(18, 42);
    const rr = rnd(35, 55), g = new THREE.ConeGeometry(rr, h, 7, 3); { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rr * 6.3 / 9, uv.getY(i) * h / 9); } const m = new THREE.Mesh(g, M.cerro); m.scale.z = rnd(.6, 1); pieza(m, x, h / 2 - 2, z, { shoot: false, cast: false });
  }
  calles(); pueblo(); casas(); casaDave(); tienda(); carreteraNorte(); recinto(); detalleCalle(); manzana(); calleViva();
  W.superficies = superficies;
  en('tierra', 0, -112, () => { laboratorio(); labMike(); });
  base();
  // halos: un Points por capa
  for (const cap of ['tierra', 'caos']) { if (!halos[cap].length) continue; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(halos[cap], 3)); const p = new THREE.Points(g, cap === 'caos' ? haloFuegoMat : haloMat); p.renderOrder = 5; capas[cap].add(p); }
  await Promise.all([modelosTierra(), modelosCasa().catch(e => console.warn('[decorado] modelos de la casa', e))]);
  // atmósfera: viento en árboles/cables/banderas/ropa, lluvia, vida ambiental; ganchos de la historia
  construirAtmosfera({ banderaMat, vegetacion: [hoja, hoja2, hojas], cables: [M.cable] });
  W.clima = clima; W.pulsoRey = pulsoRey;
}

function calles() {
  // calle mayor (N-S), cruce (E-O), calle residencial y carretera norte
  flat(0, 4, 10, 132, M.asphalt, .01, 0, 6);
  flat(27.5, 0, 175, 10, M.asphalt, .011, 0, 6);
  flat(0, 70, 100, 10, M.asphalt, .012, 0, 6);
  flat(0, -91, 10, 58, M.asphalt, .01, 0, 6);
  flat(123, 0, 18, 10, M.asphalt, .011, 0, 6);
  for (const s of [-6.5, 6.5]) flat(s, 4, 3, 122, M.acera, .02, 0, 3);
  for (const s of [-6.5, 6.5]) flat(-33, s, 46, 3, M.acera, .02, 0, 3), flat(36, s, 50, 3, M.acera, .02, 0, 3);
  for (let k = -116; k <= 68; k += 4) if (Math.abs(k) > 6) flat(0, k, .18, 2, M.line, .025);
  for (let k = -56; k <= 128; k += 4) if (Math.abs(k) > 6) flat(k, 0, 2, .18, M.line, .025);
  for (let k = -44; k <= 44; k += 4) if (Math.abs(k) > 6) flat(k, 70, 2, .18, M.line, .025);
}

function pueblo() {
  const oeste = [[-14, 14, 9, M.bld], [-32, 14, 12, M.bld2], [14, 14, 8, M.bld2], [32, 14, 10, M.bld], [50, 14, 7, M.bld2]];
  for (const [z, d, h, m] of oeste) edificio(-15, z, 12, d, h, m, 'x+');
  const este = [[-14, 14, 10, M.bld2], [-52, 12, 8, M.bld], [14, 14, 12, M.bld], [32, 14, 8, M.bld2], [50, 14, 9, M.bld]];
  for (const [z, d, h, m] of este) edificio(15, z, 12, d, h, m, 'x-');
  for (const [x, z, h, m] of [[-33, -15, 11, M.bld], [-49, -15, 8, M.bld2], [34, -15, 9, M.bld2], [50, -15, 13, M.bld], [-33, 15, 7, M.bld2], [-49, 15, 10, M.bld], [34, 15, 8, M.bld], [50, 15, 6, M.bld2]]) edificio(x, z, 13, 12, h, m, z < 0 ? 'z+' : 'z-');
  // gasolinera
  block(18, -31, .8, .6, 1.6, M.neonR); block(18, -37, .8, .6, 1.6, M.neonR);
  block(18, -34, 8, 10, .25, M.dark, { y: 4.4, collide: false }); for (const [x, z] of [[14.5, -30], [14.5, -38], [21.5, -30], [21.5, -38]]) cyl(x, z, .14, 4.4, M.steel, { seg: 8 });
  block(25, -34, 5, 7, 3.2, M.bld2, { s: 6 }); letrero('GASOLINERA', 4, .7, 22.45, 2.6, -34, -Math.PI / 2, '#ffffff', 'rgba(150,20,20,.95)');
  fuenteLuz(18, 4, -34, 0xeaf4ff, 18, 14, 'parpadeo');
  // farolas
  for (const z of [-56, -36, -20, 22, 40, 58]) farola(-8.6, z, Math.PI), farola(8.6, z + 9, 0);
  for (const x of [-40, 26, 44]) farola(x, -8.6, Math.PI / 2);
  // parque pequeño
  for (const [x, z] of [[-32, 30], [-40, 36], [-30, 44], [-46, 28], [36, 36], [44, 42], [30, 46]]) arbol(x, z, rnd(.85, 1.15));
  // calma: coches aparcados y vida normal
  en('calma', 0, 0, () => {
    cocheAparcado(-3.4, -24, 0, 0); cocheAparcado(3.4, 20, 0, 1); cocheAparcado(-3.4, 36, 0, 2); cocheAparcado(24, 3.4, Math.PI / 2, 0); cocheAparcado(-40, -3.4, Math.PI / 2, 1);
  });
  // caos: coches quemados, fuegos, cajas y escombros
  en('caos', 0, 0, () => {
    cocheQuemado(-2.8, -24, .3); cocheQuemado(3, 18, -.4); cocheQuemado(24, 2.5, Math.PI / 2 + .3); cocheQuemado(-2, 46, .1);
    fuego(-5, 8); fuego(8, -40, 1.2); fuego(-26, -6); fuego(30, 8, .9); fuego(-6, 60);
    for (const [x, z, s] of [[3, -7, 1.2], [4.2, -7.2, .9], [-6, -8, 1.2], [9, 3, 1], [-9, 13, 1.1], [-3.5, 30, 1], [3.8, 52, 1.1]]) crate(x, z, s);
    block(-1, 26, 2.4, .6, .9, M.concrete); block(3, -58, 2.4, .6, .9, M.concrete); block(-3, -59.5, 2.4, .6, .9, M.concrete);
    atrezoCaos();
    for (let i = 0; i < 70; i++) { const s = rnd(.08, .3); const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * .6, s * 1.2), M.concrete); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); pieza(m, rnd(-8, 8), s * .3, rnd(-60, 68), { shoot: false }); }
  });
}

function casas() {
  // casas de la calle residencial (lado sur). La de Dave (x=20) tiene interior.
  for (const [x, m] of [[-36, M.casa2], [-18, M.casa], [38, M.casa2]]) { block(x, 84, 10, 9, 6, m, { s: 6 }); tejado(x, 84, 10, 9, 6); arbol(x + 6, 77); }
  // casa de Dave: paredes con hueco de puerta al norte (z=79.5) y ventanas
  const X = 20, Z0 = 79.5, Z1 = 89.5, X0 = 14, X1 = 26, H = 3.2;
  block((X0 + 19) / 2, Z0, 19 - X0, .3, H, M.casa, { s: 6 }); block((21 + X1) / 2, Z0, X1 - 21, .3, H, M.casa, { s: 6 }); block(20, Z0, 2, .3, H - 2.3, M.casa, { y: 2.3, collide: false, s: 6 });
  block(20, Z1, X1 - X0, .3, H, M.casa, { s: 6 }); block(X0, (Z0 + Z1) / 2, .3, Z1 - Z0, H, M.casa, { s: 6 }); block(X1, (Z0 + Z1) / 2, .3, Z1 - Z0, H, M.casa, { s: 6 });
  block(20, (Z0 + Z1) / 2, X1 - X0 + .3, Z1 - Z0 + .3, 2.8, M.casa, { y: H, collide: false, s: 6 }); tejado(20, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, H + 2.8);
  flat(20, (Z0 + Z1) / 2, X1 - X0 - .3, Z1 - Z0 - .3, M.suelo, .03, 0, 2);
  { const t = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - .3, Z1 - Z0 - .3), M.techo); { const uv = t.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 11.7 / 2, uv.getY(i) * 9.7 / 2); } t.rotation.x = Math.PI / 2; pieza(t, 20, H - .02, (Z0 + Z1) / 2, { shoot: false, cast: false }); } // techo
  for (const [x, z, w, d, ry] of [[16.5, Z0 + .17, 5, H, 0], [23.5, Z0 + .17, 5, H, 0], [20, Z1 - .17, X1 - X0, H, Math.PI], [X0 + .17, (Z0 + Z1) / 2, Z1 - Z0, H, Math.PI / 2], [X1 - .17, (Z0 + Z1) / 2, Z1 - Z0, H, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.pared); uvMetros(m.geometry, w, d, .9); m.rotation.y = ry; pieza(m, x, d / 2, z, { shoot: false }); }
  // muebles: sofá, mesa, tele, cocina
  W.tele = canvasPlane(1.6, .9, 512, (x, w, h, a) => { x.fillStyle = a.bg || '#0a0d12'; x.fillRect(0, 0, w, h); if (!a.t) return; x.fillStyle = '#c81818'; x.fillRect(0, h * .68, w, h * .16); x.fillStyle = '#fff'; x.font = '700 34px "Chakra Petch",sans-serif'; x.fillText('ÚLTIMA HORA', 16, h * .79); x.font = '600 24px Inter,sans-serif'; x.fillText(a.t, 16, h * .94); x.fillStyle = '#8aa'; x.fillRect(w * .3, h * .1, w * .4, h * .5); x.fillStyle = '#ff3b1f'; x.beginPath(); x.arc(w * .5, h * .3, 18, 0, 7); x.fill(); });
  W.tele.mesh.rotation.y = Math.PI; pieza(W.tele.mesh, 17.5, 1.25, 80.12, { static: false, cast: false }); W.tele.set({});
  // (la luz general sin lámpara que aplanaba la casa la sustituye el plafón con sombra de iluminacion.js)
  // jardín: valla baja de madera y camino
  for (const [x0, x1] of [[14, 19], [21, 26]]) block((x0 + x1) / 2, 75.6, x1 - x0, .12, .7, M.wood, { s: 1 });
  block(14, 77.5, .12, 3.8, .7, M.wood, { s: 1 }); block(26, 77.5, .12, 3.8, .7, M.wood, { s: 1, collide: false });
  flat(20, 77.5, 1.6, 4, M.concrete, .02, 0, 1.5); flat(11, 77, 4, 4.5, M.concrete, .02, 0, 2);
  farola(8.6, 66, 0); farola(30, 75.4, Math.PI); arbol(28, 92); arbol(10, 92, 1.2);
}
function uvMetros(g, w, d, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * d / s); }
function tejado(x, z, w, d, y) {
  const g = new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.02, 2.4, 4, 1); g.rotateY(Math.PI / 4); const m = new THREE.Mesh(g, M.tejado); m.scale.set(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45); pieza(m, x, y + 1.2, z, { shoot: false });
}

function tienda() {
  // tienda de armas de Hank: x∈[-22,-9], z∈[-57,-43], puerta al este (calle mayor)
  const X0 = -22, X1 = -9, Z0 = -57, Z1 = -43, H = 4.2;
  block(-15.5, Z0, X1 - X0, .3, H, M.bld2, { s: 12 }); block(-15.5, Z1, X1 - X0, .3, H, M.bld2, { s: 12 }); block(X0, -50, .3, Z1 - Z0, H, M.bld2, { s: 12 });
  block(X1, (Z0 - 51.6) / 2, .3, -51.6 - Z0, H, M.bld2, { s: 12 }); block(X1, (-48.4 + Z1) / 2, .3, Z1 + 48.4, H, M.bld2, { s: 12 }); block(X1, -50, .3, 3.2, H - 2.6, M.bld2, { y: 2.6, collide: false, s: 12 });
  block(-15.5, -50, X1 - X0 + .4, Z1 - Z0 + .4, 3, M.bld2, { y: H, collide: false, s: 12 }); block(-15.5, -50, X1 - X0 + .8, Z1 - Z0 + .8, .4, M.concrete, { y: H + 3, collide: false });
  flat(-15.5, -50, X1 - X0 - .3, Z1 - Z0 - .3, M.tilesGastado, .03, 0, 2.5);
  { const t = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - .3, Z1 - Z0 - .3), M.techo); t.rotation.x = Math.PI / 2; pieza(t, -15.5, H - .02, -50, { shoot: false, cast: false }); } // techo
  for (const [x, z, w, d, ry] of [[-15.5, Z0 + .17, 13, H, 0], [-15.5, Z1 - .17, 13, H, Math.PI], [X0 + .17, -50, 14, H, Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.pared); uvMetros(m.geometry, w, d, .9); m.rotation.y = ry; pieza(m, x, d / 2, z, { shoot: false }); }
  letrero('ARMAS · HANK', 5, .9, -8.8, 3.4, -50, Math.PI / 2);
  // mostrador y estanterías
  fuenteLuz(-15.5, 3.6, -50, 0xfff0d0, 14, 11, 'parpadeo', true);
  en('caos', 0, 0, () => { crate(-12, -46, .9); crate(-13, -54, .8); block(-11.5, -52, 2, .8, .9, M.wood, { s: 1, ry: .6 }); });
  tiendaHank();
}

function carreteraNorte() {
  for (const z of [-70, -86, -102]) farola(-6.5, z, Math.PI);
  // árboles repartidos sin pisar carreteras, edificios ni vallas
  const zonas = [[-60, 60, -116, -66, 26], [-88, -26, -60, 62, 22], [58, 110, -60, 95, 22], [-88, 110, 95, 104, 10], [-88, -30, -170, -120, 10], [30, 110, -170, -70, 14]];
  for (const [x0, x1, z0, z1, n] of zonas) { let k = 0; for (let t = 0; t < n * 8 && k < n; t++) { const x = rnd(x0, x1), z = rnd(z0, z1); if (sitioLibre(x, z)) { arbol(x, z, rnd(.8, 1.3)); k++; } } }
}

function recinto() {
  // valla del laboratorio: x∈[-24,24], z∈[-158,-120]; puerta al sur (x∈[-5,5]); agujero detrás en x∈[-12,-9.5]
  flat(0, -139, 48, 38, M.concrete, .015, 0, 4);
  valla('x', -120, -24, 24, 2.6, [[-5, 5]]); valla('x', -158, -24, 24, 2.6, [[-12, -9.5]]); valla('z', -24, -158, -120); valla('z', 24, -158, -120);
  torre(-21.5, -123, 7); torre(21.5, -123, 7);
  en('caos', 0, 0, () => {
    // cordón militar delante de la puerta
    { const m = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, .5), M.hazard); pieza(m, 0, .55, -119.2, { static: false }); W.barreraLab = { m, c: addCollider(-5, 5, -119.45, -118.95, 1.1) }; }
    sacos(-8, -116, 4, 1); sacos(8, -116, 4, 1); sacos(-24.5, -118, 1, 3); sacos(24.5, -118, 1, 3);
    const s = letrero('ZONA MILITAR · PROHIBIDO EL PASO', 5.5, .6, 0, 1.6, -118.9, 0, '#111', 'rgba(230,190,30,.95)');
    flat(-10.75, -158.3, 3, .8, M.dark, .02); // tierra removida en el agujero de la valla
  });
}

// ---------- Laboratorio de Mike (coordenadas locales; el origen se desplaza a z=-112) ----------
function laboratorio() {
  // paredes: trasera con puerta en x∈[-9.3,-7.7]
  block(-10.65, -35.8, 2.7, .4, 6.5, M.lab, { s: 3 }); block(2.15, -35.8, 19.7, .4, 6.5, M.lab, { s: 3 }); block(-8.5, -35.8, 1.6, .4, 3.9, M.lab, { y: 2.6, collide: false, s: 3 });
  block(-11.8, -27, .4, 18, 6.5, M.lab, { s: 3 }); block(11.8, -27, .4, 18, 6.5, M.lab, { s: 3 });
  block(-6.8, -18.2, 10.4, .4, 6.5, M.lab, { s: 3 }); block(6.8, -18.2, 10.4, .4, 6.5, M.lab, { s: 3 }); block(0, -18.2, 3.2, .4, 3.1, M.lab, { y: 3.4, collide: false });
  block(0, -27, 24.4, 18.4, .35, M.lab, { y: 6.5, collide: false, s: 3 });
  for (const x of [-1.62, 1.62]) block(x, -17.95, .14, .12, 3.45, M.neonC, { collide: false, cast: false, shoot: false });
  block(0, -17.95, 3.38, .12, .14, M.neonC, { y: 3.4, collide: false, cast: false, shoot: false });
  letrero('LABORATORIO · M.', 5, .8, 0, 4.9, -17.97, 0, '#7ff3ff', null);
  for (const wx of [-8, -5, 5, 8]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .9), glow(0xffb060, 1.6)); pieza(w, wx, 4.8, -17.98, { static: false, cast: false }); }
  // interior
  flat(0, -27, 23.2, 17.2, M.tiles, .02, 0, 2);
  for (const [x, z, w, d, ry] of [[-11.58, -27, 17.2, 6.4, Math.PI / 2], [11.58, -27, 17.2, 6.4, -Math.PI / 2], [0, -35.58, 23.2, 6.4, 0], [-6.7, -18.42, 10, 6.4, Math.PI], [6.7, -18.42, 10, 6.4, Math.PI]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.labIn); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
    m.rotation.y = ry; pieza(m, x, d / 2, z, { shoot: false });
  }
  for (let i = 0; i < 3; i++) for (const sx of [-5.5, 5.5]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .5), M.white); p.rotation.x = Math.PI / 2; pieza(p, sx, 6.21, -22 - i * 5, { shoot: false, cast: false }); }
  flat(-7, -27, 7, 12, M.hazard, .025, 0, 3);
  fuenteLuz(-5.5, 5.4, -27, 0xdfefff, 16, 13, 'fijo', true); fuenteLuz(5.5, 5.4, -27, 0xdfefff, 16, 13, 'fijo', true);
  // pasillo trasero (taquilla y puerta acristalada): fluorescente que parpadea + piloto rojo de emergencia sobre la puerta
  fuenteLuz(-9.6, 3.1, -31.6, 0xfff0d8, 8, 8, 'parpadeo', true); fuenteLuz(-8.5, 2.9, -35.2, 0xff3020, 3.5, 5, 'fijo', true);
  // planos en las paredes
  const poster = (c, w, h, x, y, z, ry, rz = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: toTex(c, false), roughness: .85 })); m.rotation.set(0, ry, rz); pieza(m, x, y, z, { shoot: false, cast: false }); };
  poster(blueprint('robot', 'R-01'), 2.4, 1.8, 11.56, 3.2, -22.5, -Math.PI / 2, .02);
  poster(blueprint('casco', 'CASCO v3'), 2.4, 1.8, 11.56, 3.6, -28.5, -Math.PI / 2, -.03);
  poster(blueprint('chip', 'CHIP M-7'), 2, 1.5, -3.5, 3.3, -35.56, 0, .02);
  poster(blueprint('nave', 'NAVE'), 2, 1.5, 8.5, 3.6, -35.56, 0, -.02);
  { const [c, x] = cv2d(512, 300); x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 512, 300); x.strokeStyle = '#2048a8'; x.fillStyle = '#2048a8'; x.lineWidth = 3; x.font = '700 30px "Chakra Petch",sans-serif'; x.fillText('¿LA COPIA ES LA PERSONA?', 30, 60);
    x.font = '500 22px "Chakra Petch",sans-serif'; x.fillText('DAVE → conciencia → robot', 40, 130); x.fillStyle = '#c0282a'; x.fillText('ORIGINAL ≠ COPIA', 300, 220); x.strokeStyle = '#c0282a'; x.beginPath(); x.ellipse(390, 212, 120, 30, 0, 0, 7); x.stroke();
    x.strokeStyle = '#2048a8'; x.beginPath(); x.moveTo(330, 140); x.lineTo(380, 185); x.stroke(); x.fillStyle = '#333'; x.fillText('¿y el casco?', 50, 250); x.fillText('Lázaro S. → copias', 40, 285);
    poster(c, 3.2, 1.9, -11.56, 2.6, -30.5, Math.PI / 2); }
  // mesa de Mike con monitores, racks
  block(5.5, -34.6, 3.4, 1.2, .78, M.wood, { s: 1 }); block(-5.5, -21.2, 2.6, 1, .9, M.wood, { s: 1 });
  for (let i = 0; i < 3; i++) { block(4.4 + i * 1.1, -34.85, .9, .08, .55, M.dark, { y: 1.0, collide: false });
    const s = canvasPlane(.82, .48, 256, (x, w, h, a) => { x.fillStyle = a.alerta ? '#1a0404' : '#04110a'; x.fillRect(0, 0, w, h); x.fillStyle = a.alerta ? '#ff5a4a' : '#4cff8a'; x.font = '600 13px monospace'; a.l.forEach((ln, j) => x.fillText(ln, 8, 18 + j * 15)); });
    pieza(s.mesh, 4.4 + i * 1.1, 1.275, -34.8, { static: false, cast: false }); W.pantallas.push(s); s.set({ l: ['> chip M-7 ... OK'] }); }
  for (let i = 0; i < 3; i++) { block(-1 + i * 1, -35, .85, 1, 2.2, M.dark); const [c, x] = cv2d(64, 256); x.fillStyle = '#0a0c10'; x.fillRect(0, 0, 64, 256); for (let r = 0; r < 32; r++) for (let k = 0; k < 4; k++) { x.fillStyle = Math.random() < .5 ? ['#3cff6a', '#29e6ff', '#ffb000', '#ff3b2f'][Math.floor(Math.random() * 4)] : '#111'; x.fillRect(8 + k * 13, 4 + r * 8, 6, 3); }
    const t = toTex(c); t.repeat.set(1, .5); const m = new THREE.Mesh(new THREE.PlaneGeometry(.7, 2), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); pieza(m, -1 + i * 1, 1.1, -34.48, { static: false, cast: false }); }
  // vitrina del casco (el casco lo coloca la historia)
  cyl(0, -30, .45, 1, M.steel, { seg: 20 });
  en('calma', B.ox, B.oz, () => { const gl = new THREE.Mesh(new THREE.BoxGeometry(.8, .8, .8), M.cristal); pieza(gl, 0, 1.4, -30, { static: false, cast: false, shoot: false }); });
  en('caos', B.ox, B.oz, () => {
    const l = canvasPlane(1.6, .4, 512, textDraw('#ff6a50', .7, 'rgba(20,6,6,.9)')); pieza(l.mesh, 0, .55, -29.53, { static: false, cast: false }); l.set('CASCO NEURONAL v3\nROBADO');
    for (let i = 0; i < 26; i++) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(rnd(.04, .14), rnd(.04, .14)), M.cristal); sh.rotation.set(-Math.PI / 2, 0, rnd(0, 3)); pieza(sh, rnd(-1.2, 1.2), .03, -30 + rnd(-1.2, 1.2), { static: false, cast: false, shoot: false }); }
    fuenteLuz(0, 5, -27, 0xff2a1a, 42, 20, 'alarma', true);
    crate(-3, -24, .9); crate(3.5, -28, .8); block(-5.5, -22.5, 2.6, 1, .9, M.wood, { s: 1, ry: .5, collide: false });
  });
  // cápsulas (la segunda guarda a la Unidad 01)
  for (const z of [-20.8, -31.2]) {
    cyl(10.3, z, .78, .25, M.hazard, { seg: 24 }); block(11.3, z, .3, 1.5, 2.8, M.dark, { collide: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.72, .05, 8, 28), M.neonC); ring.rotation.x = Math.PI / 2; pieza(ring, 10.3, 2.55, z, { shoot: false, cast: false });
    cyl(10.3, z, .78, .15, M.steel, { seg: 24, y: 2.6, collide: false });
    addCollider(9.6, 11, z - .75, z + .75, 2.6);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(.74, .74, 2.35, 24, 1, true), M.cristal);
    if (z > -25) { en('calma', B.ox, B.oz, () => pieza(glass, 10.3, 1.42, z, { static: false, cast: false, shoot: false })); }
    else pieza(glass, 10.3, 1.42, z, { static: false, cast: false, shoot: false });
    W.capsulas.push(new V3(10.3 + B.ox, .25, z + B.oz));
  }
  // pecera
  const TANK = new V3(10.6, 1.55, -26);
  block(TANK.x, TANK.z, 1.1, 3.4, .85, M.dark, { s: 1 });
  { const water = new THREE.Mesh(new THREE.BoxGeometry(.92, 1.15, 3.12), std({ color: 0x1b7fa8, transparent: true, opacity: .3, emissive: 0x08405a, emissiveIntensity: 1, roughness: .1, depthWrite: false })); pieza(water, TANK.x, TANK.y - .05, TANK.z, { static: false, cast: false, shoot: false });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 3.2), M.cristal); pieza(glass, TANK.x, TANK.y, TANK.z, { static: false, cast: false, shoot: false }); }
  // robots a medio montar
  { const R = makeRobot({ ...PAL.dave, body: 0x7a8088 }); staticPose(R, { spd: 0 }); R.armR.sh.rotation.z = -1.1; R.neck.removeFromParent(); R.armL.sh.removeFromParent(); R.plate.removeFromParent();
    R.root.rotation.y = Math.PI / 2; pieza(R.root, -8.5, 0, -24, { static: false });
    for (const [x, z] of [[-9.1, -24.6], [-9.1, -23.4], [-7.9, -24.6], [-7.9, -23.4]]) cyl(x, z, .05, 2.6, M.steel, { seg: 8, collide: false });
    block(-8.5, -24, 1.4, 1.4, .08, M.steel, { y: 2.6, collide: false }); addCollider(-9.2, -7.8, -24.7, -23.3, 2.6); }
  { const R = makeRobot({ ...PAL.dave, body: 0x6c727a, eye: 0x223344 }); R.legL.hp.removeFromParent(); R.legR.hp.removeFromParent(); staticPose(R, { spd: 0, boot: 1 }); R.mEye.emissiveIntensity = 0; pieza(R.root, -4.5, 1.3, -31, { static: false });
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 3.8, 4), M.steel); pieza(l, -4.5, 4.4, -31, { static: false }); }
  { const R = makeRobot({ ...PAL.dave, body: 0x9aa0a8 }); R.spine.removeFromParent(); staticPose(R, { spd: 0 }); pieza(R.root, -10.4, .3, -28.6, { static: false }); cyl(-10.4, -28.6, .6, .3, M.steel, { seg: 24 }); }
}
function blueprint(kind, title) {
  const [c, x] = cv2d(512, 384); const g = x.createLinearGradient(0, 0, 512, 384); g.addColorStop(0, '#15528f'); g.addColorStop(1, '#0b2f5c'); x.fillStyle = g; x.fillRect(0, 0, 512, 384);
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1; for (let i = 0; i < 512; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 384); x.stroke(); } for (let j = 0; j < 384; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(512, j); x.stroke(); }
  x.strokeStyle = 'rgba(235,245,255,.9)'; x.fillStyle = '#eaf4ff'; x.lineWidth = 2; x.strokeRect(10, 10, 492, 364); x.strokeRect(330, 312, 172, 62);
  x.font = '700 15px "Chakra Petch",sans-serif'; x.fillText('PROYECTO ' + title, 338, 334); x.font = '500 12px "Chakra Petch",sans-serif'; x.fillText('M. · LAB 2030 · HOJA ' + Math.ceil(Math.random() * 9), 338, 356);
  const L = (a, b, c2, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); };
  const tag = (t, a, b, c2, d) => { L(a, b, c2, d); x.fillText(t, c2 + 4, d + 4); };
  x.font = '500 13px "Chakra Petch",sans-serif';
  if (kind === 'robot') { const cx = 150; x.strokeRect(cx - 24, 40, 48, 44); x.strokeRect(cx - 46, 92, 92, 96); x.strokeRect(cx - 70, 96, 20, 84); x.strokeRect(cx + 50, 96, 20, 84); x.strokeRect(cx - 40, 196, 32, 120); x.strokeRect(cx + 8, 196, 32, 120); x.beginPath(); x.arc(cx, 130, 12, 0, 7); x.stroke(); L(cx - 18, 58, cx + 18, 58);
    L(250, 40, 250, 316); L(244, 40, 256, 40); L(244, 316, 256, 316); x.fillText('1.85 m', 258, 180); tag('NÚCLEO', cx + 12, 130, 270, 110); tag('SERVO HOMBRO', cx + 60, 100, 300, 70); tag('VISOR', cx + 18, 58, 300, 40); }
  if (kind === 'casco') { x.beginPath(); x.arc(200, 210, 120, Math.PI, 0); x.lineTo(320, 250); x.lineTo(80, 250); x.closePath(); x.stroke(); x.beginPath(); x.arc(200, 210, 95, Math.PI, 0); x.stroke();
    for (let i = 0; i < 8; i++) { const a = Math.PI + (i + .5) * Math.PI / 8; x.beginPath(); x.arc(200 + Math.cos(a) * 108, 210 + Math.sin(a) * 108, 5, 0, 7); x.fill(); }
    tag('ELECTRODOS ×8', 300, 140, 350, 100); tag('CHIP M-7', 200, 230, 350, 230); x.strokeRect(185, 222, 30, 18);
    x.beginPath(); for (let i = 0; i < 160; i++) x.lineTo(40 + i * 2, 300 + Math.sin(i * .25) * 10 * Math.sin(i * .03)); x.stroke(); x.fillText('ONDAS α / β → ÓRDENES', 40, 290); }
  if (kind === 'chip') { x.strokeRect(150, 110, 140, 140); x.strokeRect(180, 140, 80, 80); for (let i = 0; i < 9; i++) { L(160 + i * 15, 110, 160 + i * 15, 90); L(160 + i * 15, 250, 160 + i * 15, 270); L(150, 120 + i * 15, 130, 120 + i * 15); L(290, 120 + i * 15, 310, 120 + i * 15); }
    x.font = '700 16px "Chakra Petch",sans-serif'; x.fillText('CHIP DE CONCIENCIA', 150, 60); x.font = '500 13px "Chakra Petch",sans-serif'; tag('NÚCLEO NEURONAL', 260, 180, 330, 170); x.fillText('copia ≠ original', 40, 330); }
  if (kind === 'nave') { x.beginPath(); x.moveTo(250, 50); x.lineTo(320, 200); x.lineTo(420, 260); x.lineTo(320, 260); x.lineTo(290, 300); x.lineTo(210, 300); x.lineTo(180, 260); x.lineTo(80, 260); x.lineTo(180, 200); x.closePath(); x.stroke();
    x.beginPath(); x.arc(250, 140, 22, 0, 7); x.stroke(); tag('CABINA', 270, 140, 340, 110); tag('PROPULSOR', 260, 300, 340, 330); x.fillText('LA CORONA ?', 30, 40); }
  return c;
}

// ---------- Base militar de Peñas Negras: x∈[115,178], z∈[-62,40] ----------
function base() {
  flat(147, -11, 60, 100, M.concrete, .016, 0, 4);
  valla('z', 115, -62, 40, 3.2, [[-5, 5]]); valla('z', 178, -62, 40, 3.2); valla('x', -62, 115, 178, 3.2); valla('x', 40, 115, 178, 3.2);
  // garita y barrera
  block(118.5, -8.5, 3, 3, 2.7, M.casa2, { s: 3 }); block(118.5, -8.5, 3.4, 3.4, .25, M.dark, { y: 2.7, collide: false });
  letrero('BASE PEÑAS NEGRAS · CONTROL', 4.5, .5, 116.95, 3.4, -8.5, -Math.PI / 2, '#fff', 'rgba(40,52,30,.95)');
  { const g = new THREE.Group(); const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 9.5), M.hazard); arm.position.z = 4.75; g.add(arm); pieza(g, 116.3, 1.05, -4.8, { static: false }); W.barrera = g; cyl(116.3, -5.2, .18, 1.1, M.dark, { seg: 8 }); }
  fuenteLuz(118.5, 3.4, -5, 0xffe6b0, 18, 12);
  // barracones
  for (const z of [-32, -46]) { block(132, z, 14, 8, 4.6, M.casa2, { s: 6 }); block(132, z, 14.6, 8.6, .3, M.oliva, { y: 4.6, collide: false }); fuenteLuz(124.6, 3.6, z, 0xffd9a0, 10, 9); }
  // hangar abierto al oeste (x=148)
  const HX0 = 148, HX1 = 172, HZ0 = -34, HZ1 = -6, HH = 11;
  block((HX0 + HX1) / 2, HZ0, HX1 - HX0, .5, HH, M.lab, { s: 4 }); block((HX0 + HX1) / 2, HZ1, HX1 - HX0, .5, HH, M.lab, { s: 4 }); block(HX1, (HZ0 + HZ1) / 2, .5, HZ1 - HZ0, HH, M.lab, { s: 4 });
  block((HX0 + HX1) / 2, (HZ0 + HZ1) / 2, HX1 - HX0 + 1, HZ1 - HZ0 + 1, .5, M.lab, { y: HH, collide: false, s: 4 });
  block(HX0, (HZ0 + HZ1) / 2, .5, HZ1 - HZ0, 3, M.lab, { y: HH - 3, collide: false, s: 4 });
  letrero('HANGAR 3', 6, 1.2, HX0 - .3, HH - 1.5, (HZ0 + HZ1) / 2, -Math.PI / 2, '#fff', 'rgba(10,10,10,.85)');
  for (let i = 0; i < 6; i++) crate(152 + (i % 3) * 1.4, -30 + Math.floor(i / 3) * 1.4, 1.2);
  fuenteLuz(160, 9, -20, 0xdfefff, 30, 22, 'fijo', true);
  // depósito de combustible (lo vuela John)
  for (const [x, z] of [[164, -52], [169, -52], [174, -52]]) { cyl(x, z, 2, 4.2, M.steel, { seg: 20 }); cyl(x, z, 2.05, .3, M.hazard, { seg: 20, y: 3.2, collide: false }); }
  valla('x', -57, 160, 177, 1.6); letrero('COMBUSTIBLE', 3, .5, 169, 2, -56.8, Math.PI, '#111', 'rgba(230,190,30,.95)');
  // plataforma de lanzamiento de la ORION-4
  { const pad = new THREE.Mesh(new THREE.CircleGeometry(10, 40), M.concrete); pad.rotation.x = -Math.PI / 2; pieza(pad, 150, .03, 20, { shoot: false }); const ring = new THREE.Mesh(new THREE.RingGeometry(9.2, 10, 40), M.hazard); ring.rotation.x = -Math.PI / 2; pieza(ring, 150, .04, 20, { shoot: false }); }
  for (const [x, z] of [[140, 10], [160, 10], [140, 30], [160, 30]]) { cyl(x, z, .12, 7, M.dark, { seg: 8 }); block(x, z, .8, .8, .3, M.white, { y: 7, collide: false, cast: false, shoot: false }); fuenteLuz(x, 6.8, z, 0xeaf4ff, 30, 16); }
  // coberturas en la explanada (cajas, sacos)
  for (const [x, z, s] of [[141, -30, 1.2], [141.8, -28.6, 1], [144, -17, 1.2], [145.2, -15.8, 1], [138, 0, 1.2], [143, 6, 1.1], [139.5, 14, 1.2], [156, 6, 1.2], [157.2, 7.2, .9]]) crate(x, z, s);
  sacos(147, -4, 4, 1); sacos(134, 10, 1, 4); sacos(162, 0, 4, 1);
  // torres de vigilancia (los focos que barren son dinámicos: los pone enemigos.js)
  for (const [x, z] of [[124, -56], [128, 33], [173, 34]]) torre(x, z, 8);
  W.focosBase = [[128, 33], [173, 34], [124, -56]].map(([x, z]) => new V3(x, 9.2, z));
  W.focosLab = [new V3(-21.5, 8.2, -123), new V3(21.5, 8.2, -123)];
  for (const z of [-20, 20]) farola(119, z, Math.PI);
  baseDetalle();
}

// ---------- Detalle de calle: bordillos, alcantarillas, señales, postes con cables (todo estático y fusionado) ----------
const texStop = canvasTex(128, (x, s) => { x.clearRect(0, 0, s, s); x.fillStyle = '#eee'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; x.lineTo(s / 2 + Math.cos(a) * s * .5, s / 2 + Math.sin(a) * s * .5); } x.fill(); x.fillStyle = '#b3161b'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; x.lineTo(s / 2 + Math.cos(a) * s * .45, s / 2 + Math.sin(a) * s * .45); } x.fill(); x.fillStyle = '#fff'; x.font = 'bold 36px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('STOP', s / 2, s / 2 + 2); }, false);
const texVel = canvasTex(128, (x, s) => { x.clearRect(0, 0, s, s); x.fillStyle = '#eee'; x.beginPath(); x.arc(s / 2, s / 2, s * .5, 0, 7); x.fill(); x.strokeStyle = '#c8161b'; x.lineWidth = 13; x.beginPath(); x.arc(s / 2, s / 2, s * .42, 0, 7); x.stroke(); x.fillStyle = '#111'; x.font = 'bold 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('50', s / 2, s / 2 + 3); }, false);
const stopMat = std({ map: texStop, alphaTest: .5, roughness: .4 }), velMat = std({ map: texVel, alphaTest: .5, roughness: .4 }), dorsoSenal = std({ map: texStop, alphaTest: .5, color: 0x6a6e72, roughness: .5, metalness: .6 });
function senal(x, z, ry, mat) {
  cyl(x, z, .035, 2.4, M.steel, { seg: 6, collide: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(.75, .75), mat); pieza(p, x - Math.sin(ry) * .04, 2.35, z - Math.cos(ry) * .04, { ry, shoot: false, cast: false });
  const d = new THREE.Mesh(new THREE.PlaneGeometry(.75, .75), dorsoSenal); pieza(d, x - Math.sin(ry) * .03, 2.35, z - Math.cos(ry) * .03, { ry: ry + Math.PI, shoot: false, cast: false }); // dorso metálico
}
function lineaPostes(pts, eje) {
  // eje: hacia dónde apunta la cruceta ('x' o 'z')
  const off = [-.7, 0, .7], Hc = 7.9;
  pts.forEach(([x, z]) => {
    cyl(x, z, .13, 8.4, M.poste, { seg: 8, r2: .16 });
    block(x, z, eje === 'x' ? 1.7 : .12, eje === 'x' ? .12 : 1.7, .12, M.poste, { y: Hc, collide: false, s: 1 });
    for (const o of off) { const ai = new THREE.Mesh(cylG(.04, .14), M.dark); pieza(ai, x + (eje === 'x' ? o : 0), Hc + .19, z + (eje === 'z' ? o : 0)); }
  });
  for (let i = 0; i < pts.length - 1; i++) for (const o of off) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], dx = eje === 'x' ? o : 0, dz = eje === 'z' ? o : 0, L = Math.hypot(x1 - x0, z1 - z0), caida = .35 + L * .018;
    const cp = []; for (let k = 0; k <= 8; k++) { const t = k / 8; cp.push(new V3(x0 + (x1 - x0) * t + dx + B.ox, Hc + .26 - caida * 4 * t * (1 - t), z0 + (z1 - z0) * t + dz + B.oz)); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 12, .016, 4), M.cable); pieza(m, 0, 0, 0, { shoot: false, cast: false });
  }
}
function detalleCalle() {
  // bordillos con altura (solo visuales: no frenan al coche ni al jugador)
  const bord = (x, z, w, d) => block(x, z, w, d, .14, M.concrete, { collide: false, s: 1.5 }); // mismo grupo de fusión que el resto del hormigón
  for (const sx of [-5.05, 5.05]) { bord(sx, -31, .22, 52); bord(sx, 35.5, .22, 59); }
  for (const sz of [-5.05, 5.05]) { bord(-31.5, sz, 49, .22); bord(34.5, sz, 53, .22); }
  // tapas de alcantarilla
  for (const [x, z] of [[2.2, -30], [-2, 15], [2, 45], [20, -1.5], [-25, 2], [45, 1.8], [0, -80], [10, 71.2], [-1.6, -100], [90, -1]]) { const t = new THREE.Mesh(new THREE.CircleGeometry(.42, 16), M.tapa); t.rotation.x = -Math.PI / 2; pieza(t, x, .022, z, { shoot: false, cast: false }); }
  // señales
  senal(-5.6, 7.6, 0, stopMat); senal(5.6, -7.6, Math.PI, stopMat); senal(7.6, 5.6, -Math.PI / 2, stopMat);
  senal(-5.7, -72, 0, velMat); senal(5.7, -96, Math.PI, velMat); senal(60, -5.8, Math.PI / 2, velMat);
  // tendido eléctrico: calle residencial y carretera norte
  lineaPostes([[-44, 63.8], [-30, 63.8], [-14, 63.8], [14, 63.8], [30, 63.8], [44, 63.8]], 'z');
  lineaPostes([[7.6, -62], [7.6, -78], [7.6, -94]], 'x');
}
// basura, neumáticos, palés y conos del caos (sin colisión: no estorban a la historia)
function atrezoCaos() {
  const bolsa = (x, z) => { const m = new THREE.Mesh(gBolsa, M.bolsa); m.scale.setScalar(rnd(.8, 1.2)); pieza(m, x, .12, z, { ry: rnd(0, 6), shoot: false, cast: false }); };
  for (const [x, z] of [[-8.2, -12], [8.3, 9], [-8.1, 24], [8.2, 31], [-8.3, 44], [8.1, -26], [-8.2, -40], [8.3, 53], [-30, -8.2], [40, 8.2], [-48, 8.1]]) { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) bolsa(x + rnd(-.5, .5), z + rnd(-.7, .7)); }
  const rueda = (x, z, y = .12, rx = 0) => { const m = new THREE.Mesh(gRueda, M.goma); m.rotation.x = rx; pieza(m, x, y, z, { ry: rnd(0, 3), shoot: false, cast: false }); };
  rueda(-4.6, -21.5); rueda(-4.4, -21.6, .36); rueda(4.4, 15.6); rueda(26.5, 4.4); rueda(-3.6, 49, .3, 1.3); rueda(1.2, -3.4, .3, 1.5);
  const pale = (x, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry), P = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
    for (const d of [-.5, 0, .5]) { const [px, pz] = P(d, 0); block(px, pz, .1, 1.2, .1, M.wood, { collide: false, s: 1, ry }); }
    for (const d of [-.5, -.25, 0, .25, .5]) { const [px, pz] = P(0, d); block(px, pz, 1.2, .14, .025, M.wood, { y: .1, collide: false, s: 1, ry }); } };
  pale(12, -27, .3); pale(12.2, -27.1, .5); pale(-8, 30, 1.2); pale(-26, -9.5, .1); pale(23, 7.5, -.4);
  const cono = (x, z, caido) => { const m = new THREE.Mesh(gCono, M.cono); if (caido) { m.rotation.z = Math.PI / 2; pieza(m, x, .15, z, { ry: rnd(0, 6), shoot: false, cast: false }); } else pieza(m, x, .26, z, { shoot: false, cast: false }); };
  for (const [x, z, c] of [[-3.5, -105.5], [-1.8, -106, 1], [1.8, -106], [3.5, -105.5, 1], [4, 10.5], [5, 12, 1], [-4.2, -64]]) cono(x, z, c);
  // sacos terreros apilados junto a los coches quemados
  for (const [x, z, ry] of [[-6, 46, 0], [6.2, -46, Math.PI / 2]]) for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(rbox(.62, .18, .34), sacoMat); pieza(m, x + (i - 2) * .64 * Math.cos(ry) + (k % 2) * .3, .09 + k * .18, z + (i - 2) * .64 * Math.sin(ry), { ry }); }
}

// ---------- Modelos texturizados del pack ----------
async function modelosTierra() {
  try {
    const [cam1, cam2, cam3, orion, camion, coloso] = await Promise.all([
      instancia('Camion_Militar', 3.47), instancia('Camion_Militar', 3.47), instancia('Camion_Militar', 3.47),
      instancia('Lanzadera_ORION4', 3.05), instancia('Camion_Militar', 3.47), instancia('Coloso', 2.6)]);
    // cordón del laboratorio (caos)
    cam1.position.set(-10, 0, -112); cam1.rotation.y = .4; capas.caos.add(cam1); addColl(cam1, 1.4, 3.6, 'caos');
    cam2.position.set(10.5, 0, -113); cam2.rotation.y = -.5; capas.caos.add(cam2); addColl(cam2, 1.4, 3.6, 'caos');
    // base: camión aparcado
    cam3.position.set(140, 0, -54); cam3.rotation.y = Math.PI / 2; capas.tierra.add(cam3); addColl(cam3, 3.6, 1.4, 'tierra');
    // ORION-4 en la plataforma, morro al norte
    orion.position.set(150, 0, 20); orion.rotation.y = Math.PI; capas.tierra.add(orion); W.orion = orion;
    W.orionSeat = new THREE.Object3D(); W.orionSeat.position.set(0, 1.05, 1.2); orion.add(W.orionSeat);
    W.orionColl = addColl(orion, 3.5, 3.2, 'tierra', 2.2);
    // el camión del asalto (lo conduce John; el jugador va en la caja)
    camion.position.set(...[70, 0, 0]); camion.rotation.y = Math.PI / 2; capas.tierra.add(camion); camion.visible = false; W.camion = camion;
    W.camionSeat = new THREE.Object3D(); W.camionSeat.position.set(0, 1.18, -2.1); camion.add(W.camionSeat);
    // Coloso dormido en el hangar (presagio del acto II)
    coloso.position.set(166, 0, -14); coloso.rotation.y = -Math.PI / 2; capas.tierra.add(coloso); W.colosoBase = coloso; addColl(coloso, .9, .9, 'tierra');
  } catch (e) { console.warn('No se pudieron cargar los modelos de la Tierra', e); }
}
function addColl(o, hx, hz, cap, top = 2.6) {
  // caja de colisión aproximada, alineada a los ejes según el giro
  const swap = Math.abs(Math.sin(o.rotation.y)) > .7, ax = swap ? hz : hx, az = swap ? hx : hz;
  const c = { x0: o.position.x - ax, x1: o.position.x + ax, z0: o.position.z - az, z1: o.position.z + az, top, cap };
  colliders.push(c); return c;
}
// ¿se puede plantar algo aquí? (fuera de carreteras, edificios, vallas y recintos)
function sitioLibre(x, z, r = 2.5) {
  if (Math.abs(x) < 10 && z < 76 && z > -122) return false;           // calle mayor y carretera norte
  if (Math.abs(z) < 9 && x > -62 && x < 130) return false;            // cruce y carretera a la base
  if (Math.abs(z - 70) < 8 && Math.abs(x) < 54) return false;         // calle residencial
  if (x > -27 && x < 27 && z > -161 && z < -117) return false;        // recinto del laboratorio
  if (x > 112 && x < 181 && z > -65 && z < 43) return false;          // base militar
  for (const c of colliders) if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return false;
  return true;
}
