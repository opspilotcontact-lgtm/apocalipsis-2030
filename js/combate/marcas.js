// Heridas en el CUERPO de personajes por código (cajas por pieza): calcomanías hijas de la pieza golpeada.
//
// Cada herida es un quad con el shader de heridas (heridaShader.js) y una casilla al azar del atlas (atlas.js):
//   · contexto: piel (cabeza, manos, brazos de manga corta) / tela / metal (robot) → otro tipo de herida
//   · orientación: pegada a la cara de la pieza con su normal; el lado largo sigue la bala o el tajo
//     (rozaduras y cortes a lo largo de la trayectoria; un disparo rasante se alarga)
//   · tiempo: el moratón pasa de rojo a morado-azul y a amarillo-verde; la sangre empapa la tela y se seca;
//     los goteos bajan en la dirección de la GRAVEDAD (calculada al herir) y se paran
//   · acumulación: golpes en el mismo sitio agrandan y oscurecen la herida existente en vez de apilar copias
// Personajes .glb con esqueleto: NO usan esto, pintan en su textura de daño (piel.js) y se deforman con la malla.
import { THREE, V3, G, rnd, clamp } from '../nucleo.js';
import { rect, elegir } from './atlas.js';
import { K, U, matCuerpo, geoHerida, setHerida, getHerida } from './heridaShader.js';

const MAX_POR_CUERPO = 16, MAX_TOTAL = 48;
const todas = [];
const _p = new V3(), _n = new V3(), _x = new V3(), _y = new V3(), _z = new V3(), _ws = new V3(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _d = new V3(), _w = new V3();

// Proyecta un punto (mundo) a la cara más cercana de la caja de la malla → p y n en coordenadas LOCALES
export function superficie(m, puntoMundo, outP, outN) {
  const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
  outP.copy(puntoMundo).applyMatrix4(_inv.copy(m.matrixWorld).invert());
  outP.clamp(bb.min, bb.max);
  const d = [outP.x - bb.min.x, bb.max.x - outP.x, outP.y - bb.min.y, bb.max.y - outP.y, outP.z - bb.min.z, bb.max.z - outP.z];
  let k = 0; for (let i = 1; i < 6; i++) if (d[i] < d[k]) k = i;
  const ax = k >> 1, sg = k & 1 ? 1 : -1; outN.set(0, 0, 0).setComponent(ax, sg);
  outP.setComponent(ax, sg > 0 ? bb.max.getComponent(ax) : bb.min.getComponent(ax));
  return outP;
}
// Entrada del rayo (punto - dir) en la caja de la malla: la cara que de verdad mira al tirador
const _o = new V3(), _r = new V3();
export function superficieRayo(m, puntoMundo, dirMundo, outP, outN) {
  const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox;
  _inv.copy(m.matrixWorld).invert();
  _r.copy(dirMundo).transformDirection(_inv);
  _o.copy(puntoMundo).applyMatrix4(_inv).addScaledVector(_r, -1);
  let tmin = -1e9, tmax = 1e9, eje = -1, sg = 0;
  for (let a = 0; a < 3; a++) {
    const o = _o.getComponent(a), d = _r.getComponent(a), lo = bb.min.getComponent(a), hi = bb.max.getComponent(a);
    if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) return superficie(m, puntoMundo, outP, outN); continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d, s1 = -1; if (t1 > t2) { [t1, t2] = [t2, t1]; s1 = 1; }
    if (t1 > tmin) { tmin = t1; eje = a; sg = s1; } if (t2 < tmax) tmax = t2;
  }
  if (tmin > tmax || eje < 0) return superficie(m, puntoMundo, outP, outN);
  outP.copy(_o).addScaledVector(_r, tmin); outN.set(0, 0, 0).setComponent(eje, sg);
  outP.clamp(bb.min, bb.max); return outP;
}
// dirección del mundo → local de la malla (sin escala)
const aLocal = (m, v, out) => out.copy(v).applyQuaternion(m.getWorldQuaternion(_q).invert()).normalize();
const grupoDe = t => t === K.MORATON ? 'mor' : (t === K.BALA_TELA || t === K.BALA_PIEL) ? 'bala' : (t === K.GOTEO_PIEL || t === K.GOTEO_TELA) ? 'got' : (t === K.ABOLLADURA || t === K.ARANAZO || t === K.HOLLIN) ? 'met' : 'otro';

// Crea (o refuerza) una herida. o: { tipo (K), cat (atlas), tam (m, lado corto), largo (estiramiento), eje (V3 mundo),
//   inten, dueño, vida (s), juntar (radio en m para fusionar con una existente; 0 = nunca) }
export function herida(malla, punto, o) {
  if (!malla?.geometry) return null;
  malla.updateWorldMatrix(true, false);
  superficie(malla, punto, _p, _n);
  const dueño = o.dueño, lista = dueño ? (dueño._marcas ||= []) : null, gr = grupoDe(o.tipo);
  // ¿hay una igual muy cerca en la misma pieza? → la agranda y oscurece
  if (lista && o.juntar) for (const mc of lista) {
    if (mc.malla !== malla || mc.gr !== gr) continue;
    if (mc.m.position.distanceTo(_p) * mc.ws > o.juntar) continue;
    const f = Math.min(1.18, mc.escMax / mc.esc); if (f > 1.001) { mc.m.scale.x *= f; mc.m.scale.y *= f; mc.esc *= f; }
    setHerida(mc.m.geometry, 3, Math.min(1.25, getHerida(mc.m.geometry, 3) + .22));
    if (o.tipo === K.MORATON) setHerida(mc.m.geometry, 0, getHerida(mc.m.geometry, 0) - 7); // golpe sobre golpe: más maduro y oscuro
    return mc;
  }
  if (lista && lista.length >= MAX_POR_CUERPO) quitar(lista.find(mc => mc.gr === 'got') || lista[0]);
  if (todas.length >= MAX_TOTAL) quitar(todas.find(mc => mc.gr === 'got') || todas[0]);
  // marco: z = normal de la cara; x = eje (bala/tajo) proyectado en la cara, o al azar
  _z.copy(_n);
  if (o.eje) { aLocal(malla, o.eje, _x); _x.addScaledVector(_z, -_x.dot(_z)); }
  if (!o.eje || _x.lengthSq() < .02) { _x.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); _x.addScaledVector(_z, -_x.dot(_z)); }
  if (o.rotY) { _y.copy(o.rotY); _x.crossVectors(_y, _z); }
  _x.normalize(); _y.crossVectors(_z, _x).normalize();
  _m.makeBasis(_x, _y, _z);
  const t0 = G.time + (o.retraso || 0), vida = o.vida ?? 240;
  const geo = geoHerida(rect(o.tile ?? elegir(o.cat)), t0, o.tipo, Math.random(), o.inten ?? 1, t0 + vida);
  const me = new THREE.Mesh(geo, matCuerpo);
  me.quaternion.setFromRotationMatrix(_m);
  malla.getWorldScale(_ws); const ws = _ws.x;
  const tam = o.tam * rnd(.85, 1.15), largo = o.largo || 1;
  me.scale.set(tam * largo / ws, tam / ws, 1);
  me.position.copy(_p).addScaledVector(_n, .0012 + todas.length % 5 * .0003);
  if (o.desplaza) me.position.addScaledVector(_y, o.desplaza / ws);
  // que no sobresalga de la cara de la caja (un quad no se dobla por la arista): se encoge y se recoloca dentro
  { const bb = malla.geometry.boundingBox, ax = Math.abs(_z.x) > .5 ? 0 : Math.abs(_z.y) > .5 ? 1 : 2; let f = 1;
    const mg = Math.min(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * .08;
    // se encoge alrededor del punto de impacto (la herida no se mueve) hasta un mínimo; si aun así no cabe, se desplaza
    for (let a = 0; a < 3; a++) { if (a === ax) continue; const ext = Math.abs(_x.getComponent(a)) * me.scale.x / 2 + Math.abs(_y.getComponent(a)) * me.scale.y / 2, c = me.position.getComponent(a), disp = Math.min(c - bb.min.getComponent(a), bb.max.getComponent(a) - c) - mg; if (ext > disp) f = Math.min(f, Math.max(0, disp) / ext); }
    f = Math.max(f, o.minEsc ?? .4);
    me.scale.x *= f; me.scale.y *= f;
    for (let a = 0; a < 3; a++) { if (a === ax) continue; const ext = Math.abs(_x.getComponent(a)) * me.scale.x / 2 + Math.abs(_y.getComponent(a)) * me.scale.y / 2, lo = bb.min.getComponent(a) + mg + ext, hi = bb.max.getComponent(a) - mg - ext; me.position.setComponent(a, lo > hi ? (lo + hi) / 2 : clamp(me.position.getComponent(a), lo, hi)); } }
  me.renderOrder = 3 + (gr === 'got' ? 1 : 0); me.receiveShadow = true; me.castShadow = false; me.userData.herida = true;
  malla.add(me);
  const mc = { m: me, malla, gr, lista, ws, esc: 1, escMax: o.escMax || 1.8 };
  todas.push(mc); if (lista) lista.push(mc);
  return mc;
}
// GOTEO: reguero que baja desde la herida siguiendo la gravedad (en el plano de la cara), sin salirse de la pieza
export function goteo(malla, punto, o = {}) {
  const pun = punto.clone(); malla.updateWorldMatrix(true, false);
  superficie(malla, pun, _p, _n);
  aLocal(malla, _d.set(0, -1, 0), _w); _w.addScaledVector(_n, -_w.dot(_n));
  if (_w.lengthSq() < .08) return null; // cara horizontal: la sangre no corre
  _w.normalize();
  // distancia hasta el borde de la cara en esa dirección (en metros)
  const bb = malla.geometry.boundingBox; let t = 1e9;
  for (let a = 0; a < 3; a++) { const d = _w.getComponent(a); if (Math.abs(d) < 1e-4) continue; const lim = d > 0 ? bb.max.getComponent(a) : bb.min.getComponent(a); t = Math.min(t, (lim - _p.getComponent(a)) / d); }
  malla.getWorldScale(_ws); const disp = Math.max(0, t * _ws.x - .01);
  const largo = Math.min(o.largo ?? rnd(.07, .16), disp * 1.15); if (largo < .03) return null;
  const ancho = o.ancho ?? rnd(.07, .1); // ancho del quad: el reguero ocupa ~1/8 de la casilla
  _y.copy(_w).negate(); // el +Y de la casilla apunta hacia arriba
  return herida(malla, pun, { tipo: o.tela ? K.GOTEO_TELA : K.GOTEO_PIEL, cat: 'goteo', tam: largo, largo: ancho / largo, rotY: _y.clone(), desplaza: -largo * .4, inten: rnd(.55, 1), dueño: o.dueño, vida: o.vida ?? 200, retraso: o.retraso ?? rnd(.15, .5), juntar: 0 });
}

// ---------- Decisión según contexto ----------
// o: { tipo: 'bala'|'escopeta'|'corte'|'contundente'|'explosivo', dmg, superficie: 'piel'|'tela'|'metal', swing (V3), dueño }
// devuelve { salida: V3|null } (punto de salida de la bala si atraviesa, para salpicar detrás)
export function marcarImpacto(malla, punto, dir, o) {
  const sup = o.superficie, tipo = o.tipo, dmg = o.dmg || 10, d = o.dueño, res = { salida: null };
  malla.updateWorldMatrix(true, false); superficieRayo(malla, punto, dir, _p, _n);
  const nW = _n.clone().applyQuaternion(malla.getWorldQuaternion(_q)).normalize(), cos = Math.abs(nW.dot(dir));
  const pW = _p.clone().applyMatrix4(malla.matrixWorld);
  const eje = tipo === 'corte' ? (o.swing || dir) : dir;
  const largoBala = clamp(1 / Math.max(.4, cos), 1, 2.2);
  if (sup === 'metal') {
    if (tipo === 'explosivo') herida(malla, pW, { tipo: K.HOLLIN, cat: 'hollin', tam: .3, dueño: d, juntar: .12 });
    else if (tipo === 'corte') herida(malla, pW, { tipo: K.ARANAZO, cat: 'aranazo', tam: .07, largo: 2.6, eje, dueño: d, juntar: 0 });
    else if (tipo === 'contundente') { herida(malla, pW, { tipo: K.ABOLLADURA, cat: 'abolladura', tam: clamp(.08 + dmg / 260, .09, .2), dueño: d, juntar: .05 }); if (Math.random() < .6) herida(malla, pW, { tipo: K.ARANAZO, cat: 'aranazo', tam: .05, largo: 2.4, eje: dir, dueño: d }); }
    else { herida(malla, pW, { tipo: K.ABOLLADURA, cat: 'abolladura', tam: clamp(.06 + dmg / 300, .07, .12) * (tipo === 'escopeta' ? .7 : 1), largo: largoBala, eje: dir, dueño: d, juntar: .02, minEsc: .5 });
      if (Math.random() < .35) herida(malla, pW, { tipo: K.HOLLIN, cat: 'hollin', tam: .07, dueño: d, juntar: .04 });
      if (cos < .45) herida(malla, pW, { tipo: K.ARANAZO, cat: 'aranazo', tam: .04, largo: 2.6, eje: dir, dueño: d }); }
    return res;
  }
  const piel = sup === 'piel', bala = tipo === 'bala' || tipo === 'escopeta';
  if (bala) {
    if (cos < .32) { // rasante: rozadura a lo largo de la trayectoria
      herida(malla, pW, { tipo: piel ? K.ROCE_PIEL : K.ROCE_TELA, cat: 'roce', tam: piel ? .03 : .045, largo: 3.2, eje: dir, dueño: d, inten: .5 });
      if (piel) goteo(malla, pW, { dueño: d, largo: .06 });
    } else if (piel) {
      herida(malla, pW, { tipo: K.BALA_PIEL, cat: 'agujero', tam: tipo === 'escopeta' ? .05 : .075, largo: largoBala, eje: dir, dueño: d, inten: .7, juntar: .012 });
      if (Math.random() < .8) goteo(malla, pW, { dueño: d });
    } else {
      herida(malla, pW, { tipo: K.BALA_TELA, cat: 'agujero', tam: tipo === 'escopeta' ? .16 : rnd(.2, .26), largo: largoBala, eje: dir, dueño: d, inten: clamp(.35 + dmg / 45, .4, .95), juntar: .02, escMax: 1.5 });
      if (Math.random() < .45) goteo(malla, pW, { dueño: d, tela: true, ancho: .1 });
    }
    // orificio de salida: la bala atraviesa la pieza si pega fuerte y de frente
    if (cos >= .32 && dmg >= 14 && Math.random() < .55 && tipo !== 'escopeta') {
      const sal = _w.copy(pW).addScaledVector(dir, .5); superficie(malla, sal, _p, _n);
      const sW = _p.clone().applyMatrix4(malla.matrixWorld);
      if (sW.distanceTo(pW) > .05) { herida(malla, sW, { tipo: piel ? K.BALA_PIEL : K.BALA_TELA, cat: 'salida', tam: piel ? .12 : .3, eje: dir, dueño: d, inten: .9, juntar: .03 }); res.salida = sW; }
    }
  } else if (tipo === 'corte') {
    herida(malla, pW, { tipo: piel ? K.CORTE_PIEL : K.CORTE_TELA, cat: 'corte', tam: piel ? .028 : .04, largo: piel ? rnd(4, 5.5) : 4.2, eje, dueño: d, inten: .6 });
    const n = piel ? 1 + (Math.random() < .5 ? 1 : 0) : (Math.random() < .5 ? 1 : 0);
    for (let i = 0; i < n; i++) goteo(malla, _w.copy(pW).addScaledVector(_x.copy(eje).normalize(), rnd(-.03, .03)), { dueño: d, tela: !piel, retraso: rnd(.1, .8) });
  } else if (tipo === 'contundente' || tipo === 'explosivo') {
    if (piel) {
      herida(malla, pW, { tipo: K.MORATON, cat: 'moraton', tam: clamp(.09 + dmg / 160, .11, .22), dueño: d, inten: clamp(.45 + dmg / 40, .5, 1.1), juntar: .04, minEsc: .55 });
      if (dmg >= 24 && Math.random() < .7) { herida(malla, pW, { tipo: K.CORTE_PIEL, cat: 'corte', tam: .016, largo: 3, dueño: d, inten: .5 }); goteo(malla, pW, { dueño: d, largo: .07 }); }
    } else herida(malla, pW, { tipo: K.ROZADO, cat: 'moraton', tam: clamp(.1 + dmg / 200, .1, .2), dueño: d, inten: .7, juntar: .06 });
  }
  return res;
}

function quitar(mc) { if (!mc) return; mc.m.removeFromParent(); mc.m.geometry.dispose(); let i = todas.indexOf(mc); if (i >= 0) todas.splice(i, 1); if (mc.lista) { i = mc.lista.indexOf(mc); if (i >= 0) mc.lista.splice(i, 1); } }
export function quitarMarcasDe(dueño) { if (dueño?._marcas) while (dueño._marcas.length) quitar(dueño._marcas[0]); }
export function limpiarMarcas() { while (todas.length) quitar(todas[0]); }
export const nMarcas = () => todas.length;
// el reloj del shader (una sola uniform para todas las heridas)
export function actualizarMarcas() { U.uTime.value = G.time; }
// compatibilidad con la API anterior: marcar(malla, punto, 'moraton'|'sangre', tam, normal, dueño)
export function marcar(obj, punto, tipo = 'moraton', tam = .09, normal = null, dueño = null) {
  return herida(obj, punto, tipo === 'sangre' ? { tipo: K.BALA_TELA, cat: 'mancha', tam: tam * 2, dueño, juntar: .03 } : { tipo: K.MORATON, cat: 'moraton', tam, dueño, juntar: .04 });
}
