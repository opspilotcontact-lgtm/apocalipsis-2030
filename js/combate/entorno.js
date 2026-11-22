// Sangre y aceite en el ESCENARIO: salpicaduras en paredes y suelo, gotas, charcos que crecen y se paran.
// Todo en UN InstancedMesh (1 llamada de dibujo) con el shader de heridas: cada instancia tiene su casilla del atlas,
// su edad y su intensidad; el shader hace que empape/crezca, se seque y oscurezca el borde (anillo de sangre seca).
import { THREE, V3, G, rnd, scene, groundAt, envActivo } from '../nucleo.js';
import { rect, elegir } from './atlas.js';
import { K, matEntorno } from './heridaShader.js';

const N = 220;
const geo = new THREE.PlaneGeometry(1, 1);
const aTile = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), aHer = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), aFin = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
for (const a of [aTile, aHer, aFin]) a.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute('aTile', aTile); geo.setAttribute('aHerida', aHer); geo.setAttribute('aFin', aFin);
export const capaEntorno = new THREE.InstancedMesh(geo, matEntorno, N);
capaEntorno.frustumCulled = false; capaEntorno.receiveShadow = true; capaEntorno.renderOrder = 2; capaEntorno.count = 0;
const CERO = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < N; i++) capaEntorno.setMatrixAt(i, CERO);
scene.add(capaEntorno);
let sig = 0, usados = 0;

// superficies contra las que se busca pared/suelo (por defecto, las mallas disparables de las capas visibles)
let superficies = () => envActivo();
export const fijarSuperficies = fn => { superficies = fn; };

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new V3(), _x = new V3(), _y = new V3(), _z = new V3(), _p = new V3(), Z = new V3(0, 0, 1), UP = new V3(0, 1, 0);
// coloca una calcomanía: p (mundo), n (normal), eje (dirección del lado largo, en el plano), sx/sy (metros)
export function pegar(p, n, eje, sx, sy, cat, tipo, inten = 1, vida = 90, t0 = G.time) {
  const i = sig; sig = (sig + 1) % N; usados = Math.max(usados, sig === 0 ? N : sig); capaEntorno.count = Math.max(capaEntorno.count, usados);
  _z.copy(n).normalize();
  _x.copy(eje || _x.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))).addScaledVector(_z, -_x.dot(_z));
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).addScaledVector(_z, -_z.x);
  _x.normalize(); _y.crossVectors(_z, _x);
  _m.makeBasis(_x, _y, _z); _q.setFromRotationMatrix(_m);
  _p.copy(p).addScaledVector(_z, .004 + (i % 7) * .0006); // escalonado para que no peleen en profundidad
  _m.compose(_p, _q, _s.set(sx, sy, 1)); capaEntorno.setMatrixAt(i, _m);
  aTile.set(rect(elegir(cat)), i * 4); aHer.set([t0, tipo, Math.random(), inten], i * 4); aFin.setX(i, t0 + vida);
  capaEntorno.instanceMatrix.needsUpdate = aTile.needsUpdate = aHer.needsUpdate = aFin.needsUpdate = true;
  return i;
}

// gota que cae al suelo (las partículas la llaman al aterrizar)
export function gotaSuelo(p, r = .06, tipo = 'sangre') {
  const y = groundAt(p.x, p.z, p.y + .05, 0); if (p.y - y > 1.5) return;
  _p.set(p.x, y, p.z);
  pegar(_p, UP, null, r * 2 * rnd(.8, 1.3), r * 2 * rnd(.8, 1.3), 'gota', tipo === 'aceite' ? K.ACEITE_SALP : K.SALPICADURA, 1, tipo === 'aceite' ? 120 : 70);
}
// charco que crece despacio y se para (debajo de un cuerpo); r = radio final aproximado
export function charco(p, r = .5, tipo = 'sangre', vida = 150) {
  const y = groundAt(p.x, p.z, p.y + .3, 0); _p.set(p.x, y, p.z);
  return pegar(_p, UP, null, r * 2 * rnd(.9, 1.15), r * 2 * rnd(.9, 1.15), 'charco', tipo === 'aceite' ? K.ACEITE_CHARCO : K.CHARCO, 1, vida);
}
// mancha en el suelo sin crecer (sangre de una herida al caer, aceite de un robot)
export function manchaSuelo(p, r = .25, tipo = 'sangre') {
  const y = groundAt(p.x, p.z, p.y + .05, 0); if (p.y - y > 2.5) return; _p.set(p.x, y, p.z);
  pegar(_p, UP, null, r * 2, r * 2 * rnd(.7, 1.1), tipo === 'aceite' ? 'mancha' : 'gota', tipo === 'aceite' ? K.ACEITE_SALP : K.SALPICADURA, 1, 90);
}

// SALPICADURA DIRECCIONAL detrás del objetivo: rayos desde el impacto en la dirección de la bala; donde choquen con pared
// o suelo se pega un spray alargado según el ángulo (rasante = gotas largas, de frente = más redondo).
const ray = new THREE.Raycaster(), _d = new V3(), _n = new V3(), _nm = new THREE.Matrix3();
export function salpicarDetras(p, dir, fuerza = 1, tipo = 'sangre', alcance = 2.6) {
  const lista = superficies(); if (!lista.length) { if (Math.random() < .7) gotaSuelo(_p.copy(p).addScaledVector(dir, rnd(.4, 1.2)).setY(p.y), .08 * fuerza, tipo); return 0; }
  let n = 0; const rayos = fuerza > 1.2 ? 3 : 2;
  for (let k = 0; k < rayos; k++) {
    _d.copy(dir).add(_s.set(rnd(-.18, .18), rnd(-.22, .08), rnd(-.18, .18))).normalize();
    ray.set(p, _d); ray.far = alcance * rnd(.6, 1); ray.near = .05;
    const h = ray.intersectObjects(lista, false)[0]; if (!h) continue;
    _n.copy(h.face.normal).applyNormalMatrix(_nm.getNormalMatrix(h.object.matrixWorld)).normalize();
    if (_n.dot(_d) > 0) _n.negate();
    const cos = Math.max(.22, Math.abs(_n.dot(_d))), largo = Math.min(3.2, 1 / cos), dist = h.distance;
    const tam = (.35 + fuerza * .25) * (.6 + dist * .25) * rnd(.8, 1.2);
    // eje = dirección de la bala proyectada en la superficie (las gotas se estiran hacia donde iban)
    pegar(h.point, _n, _d, tam * largo, tam * rnd(.55, .8), 'spray', tipo === 'aceite' ? K.ACEITE_SALP : K.SALPICADURA, 1, tipo === 'aceite' ? 120 : 90);
    n++;
  }
  return n;
}
export function limpiarEntorno() { for (let i = 0; i < N; i++) { capaEntorno.setMatrixAt(i, CERO); aFin.setX(i, 0); } capaEntorno.instanceMatrix.needsUpdate = aFin.needsUpdate = true; capaEntorno.count = 0; sig = usados = 0; }
