// Partículas baratas de combate: sangre, aceite, chispas y refrigerante del núcleo.
// Dos InstancedMesh (2 llamadas de dibujo, da igual cuántas partículas haya): gotas mate (sangre/aceite) y gotas
// brillantes (chispas/núcleo, sin tone mapping). Al caer al suelo, las gotas dejan una calcomanía en la capa de entorno.
import { THREE, V3, G, rnd, scene, groundAt } from '../nucleo.js';
import { gotaSuelo, manchaSuelo } from './entorno.js';

const N_GOTAS = 320, N_BRILLO = 260;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _e = new THREE.Euler(), _c = new THREE.Color();
const OCULTA = new THREE.Matrix4().makeScale(0, 0, 0);

function crearPool(n, geo, mat) {
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < n; i++) { im.setMatrixAt(i, OCULTA); im.setColorAt(i, _c.setRGB(1, 1, 1)); }
  scene.add(im);
  const ps = []; for (let i = 0; i < n; i++) ps.push({ p: new V3(), v: new V3(), vida: 0, max: 1, tam: .03, tipo: '', rot: 0 });
  return { im, ps, i: 0, sucio: false };
}
const geoGota = new THREE.BoxGeometry(1, 1, 1);
const gotas = crearPool(N_GOTAS, new THREE.IcosahedronGeometry(.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .2, metalness: 0 })); // gotas brillantes (mojadas)
const brillo = crearPool(N_BRILLO, geoGota, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
// colores por tipo: [color, gravedad, rebote, ¿mancha al caer?]
const TIPO = {
  sangre: { c: 0x5a0306, g: 9.8, reb: 0, mancha: .35, pool: gotas },
  sangreOsc: { c: 0x2e0204, g: 9.8, reb: 0, mancha: .25, pool: gotas },
  aceite: { c: 0x0d0a08, g: 9.8, reb: 0, mancha: .4, pool: gotas },
  chispa: { c: 0xffb347, g: 7, reb: .35, mancha: 0, pool: brillo },
  chispaBlanca: { c: 0xfff0c8, g: 5, reb: .4, mancha: 0, pool: brillo },
  nucleo: { c: 0x29e6ff, g: 3, reb: .3, mancha: 0, pool: brillo }
};
// lanza n partículas desde pos; dir (opcional) sesga la salida; spd escala la velocidad
export function salpicar(pos, n, tipo = 'sangre', dir = null, spd = 1, tam = 1) {
  const T = TIPO[tipo] || TIPO.sangre, P = T.pool;
  for (let k = 0; k < n; k++) {
    const idx = P.i, p = P.ps[idx]; P.i = (P.i + 1) % P.ps.length;
    p.p.copy(pos); p.v.set(rnd(-1, 1), rnd(-.1, 1.1), rnd(-1, 1)).normalize().multiplyScalar(rnd(.8, 3.2) * spd);
    if (dir) p.v.addScaledVector(dir, rnd(1, 3) * spd);
    p.vida = p.max = rnd(.35, .9); p.tam = rnd(.012, .03) * tam * (T.pool === brillo ? .8 : 1); p.tipo = tipo; p.rot = rnd(0, 6);
    P.im.setColorAt(idx, _c.setHex(T.c));
  }
  P.im.instanceColor.needsUpdate = true; P.sucio = true;
}
// mancha en el suelo (compatibilidad): ahora la pone la capa de entorno con el atlas de heridas
export function mancha(p, r = .25, tipo = 'sangre') { manchaSuelo(p, r, tipo === 'sangreOsc' ? 'sangre' : tipo); }

function moverPool(P, dt) {
  if (!P.sucio) return; let vivos = 0;
  for (let i = 0; i < P.ps.length; i++) {
    const p = P.ps[i]; if (p.vida <= 0) continue;
    const T = TIPO[p.tipo]; p.vida -= dt;
    p.v.y -= T.g * dt; p.p.addScaledVector(p.v, dt);
    const suelo = p.p.y < .6 ? groundAt(p.p.x, p.p.z, p.p.y + .1, 0) : (i & 7) === 0 ? groundAt(p.p.x, p.p.z, p.p.y + .1, 0) : -99;
    if (p.p.y < suelo + .01) {
      if (T.mancha && Math.random() < T.mancha) gotaSuelo(p.p, rnd(.025, .07) * (p.tam / .02), p.tipo === 'aceite' ? 'aceite' : 'sangre');
      if (T.reb) { p.p.y = suelo + .01; p.v.y *= -T.reb; p.v.x *= .6; p.v.z *= .6; } else p.vida = 0;
    }
    if (p.vida <= 0) { P.im.setMatrixAt(i, OCULTA); continue; }
    vivos++;
    const k = Math.max(.05, p.vida / p.max), sz = p.tam * (P === brillo ? k : .6 + .4 * k);
    // gotas estiradas en la dirección de la velocidad (parecen chorros)
    const sp = p.v.length(); _q.setFromUnitVectors(Y1, _s.copy(p.v).divideScalar(sp || 1));
    _m.compose(p.p, _q, _s.set(sz, sz * (1 + Math.min(3, sp * .35)), sz)); P.im.setMatrixAt(i, _m);
  }
  P.im.instanceMatrix.needsUpdate = true; if (!vivos) P.sucio = false;
}
const Y1 = new V3(0, 1, 0);
export function actualizarParticulas(dt) { moverPool(gotas, dt); moverPool(brillo, dt); }
export function limpiarParticulas() { for (const P of [gotas, brillo]) { for (let i = 0; i < P.ps.length; i++) { P.ps[i].vida = 0; P.im.setMatrixAt(i, OCULTA); } P.im.instanceMatrix.needsUpdate = true; P.sucio = false; } }
