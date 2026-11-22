// Heridas en personajes .glb con esqueleto (SkinnedMesh con UV): se PINTAN en una textura de daño por personaje
// (render target en el espacio UV de su malla) que el material mezcla encima de su textura con onBeforeCompile.
// Ventajas: las heridas se deforman con la piel al animar, 0 llamadas de dibujo extra en el juego, y envejecen
// igual que las calcomanías (el mismo shader las colorea; se repinta el render target cada ~0,3 s mientras evolucionan).
//
// Uso:
//   const est = prepararPiel(raizGlb, { piel: ['head','neck'], res: 1024 })   // una vez al cargar el personaje
//   golpearSkinned(est, interseccion, dir, { tipo: 'bala'|'corte'|'contundente'|'escopeta', dmg, swing })
//   (interseccion = resultado de Raycaster sobre la SkinnedMesh: point, uv, face, object)
import { THREE, V3, G, rnd, clamp, renderer } from '../nucleo.js';
import { rect, elegir } from './atlas.js';
import { K, U, matPintura, geoHerida, setHerida, getHerida } from './heridaShader.js';
import { zonaSkinned } from './danio.js';
import { salpicar } from './particulas.js';
import { salpicarDetras } from './entorno.js';
import { sfx } from '../fx.js';

const camUV = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
const estados = []; let precompilado = false;
const MAX_HERIDAS = 40;

// ---------- Material del personaje: mezcla la textura de daño (premultiplicada) ----------
function parchear(mat, rt) {
  const m = mat.clone();
  m.onBeforeCompile = sh => {
    sh.uniforms.uDanio = { value: rt.texture };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDanio; vec4 dDanio;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndDanio = texture2D(uDanio, vMapUv); diffuseColor.rgb = diffuseColor.rgb * (1.0 - dDanio.a) + dDanio.rgb;')
      // la sangre fresca brilla: menos rugosidad donde el daño es rojo y saturado
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, dDanio.a * clamp((dDanio.r - dDanio.b * 1.5) * 6.0, 0.0, 1.0));');
  };
  m.customProgramCacheKey = () => 'piel-danio';
  return m;
}
export function prepararPiel(raiz, o = {}) {
  const res = o.res || 1024, mallas = [];
  raiz.traverse(x => { if (x.isSkinnedMesh && x.material?.map && x.geometry.attributes.uv) mallas.push(x); });
  if (!mallas.length) return null;
  const rt = new THREE.WebGLRenderTarget(res, res, { depthBuffer: false, type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  rt.texture.colorSpace = THREE.NoColorSpace;
  for (const m of mallas) m.material = parchear(m.material, rt);
  const est = { raiz, mallas, rt, escena: new THREE.Scene(), heridas: [], piel: new Set(o.piel || ['head', 'neck']), sucio: true, t: Math.random() * .3, hp: o.hp ?? 100 };
  estados.push(est); limpiarRT(est);
  // precompila el shader de pintura (si no, el primer impacto congela el juego un momento)
  if (!precompilado) { precompilado = true; const q = new THREE.Mesh(geoHerida([0, 0, .1, .1], -999, 0, 0, 0, -998), matPintura); est.escena.add(q); renderer.compile(est.escena, camUV); est.escena.remove(q); q.geometry.dispose(); }
  return est;
}
function limpiarRT(est) { const p = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(); renderer.setRenderTarget(est.rt); renderer.setClearColor(0, 0); renderer.clear(true, false, false); renderer.setRenderTarget(p); renderer.setClearColor(cc, ca); }

// ---------- Geometría del triángulo golpeado: posición/UV → base tangente (metros por unidad de UV) ----------
const _a = new V3(), _b = new V3(), _c = new V3(), _e1 = new V3(), _e2 = new V3(), _T = new V3(), _B = new V3(), _n = new V3();
function baseUV(malla, face) {
  const uv = malla.geometry.attributes.uv;
  malla.getVertexPosition(face.a, _a).applyMatrix4(malla.matrixWorld);
  malla.getVertexPosition(face.b, _b).applyMatrix4(malla.matrixWorld);
  malla.getVertexPosition(face.c, _c).applyMatrix4(malla.matrixWorld);
  _e1.subVectors(_b, _a); _e2.subVectors(_c, _a); _n.crossVectors(_e1, _e2).normalize();
  const du1 = uv.getX(face.b) - uv.getX(face.a), dv1 = uv.getY(face.b) - uv.getY(face.a), du2 = uv.getX(face.c) - uv.getX(face.a), dv2 = uv.getY(face.c) - uv.getY(face.a);
  const det = du1 * dv2 - du2 * dv1; if (Math.abs(det) < 1e-10) return null;
  _T.copy(_e1).multiplyScalar(dv2).addScaledVector(_e2, -dv1).divideScalar(det); // dP/du
  _B.copy(_e2).multiplyScalar(du1).addScaledVector(_e1, -du2).divideScalar(det); // dP/dv
  return { T: _T, B: _B, n: _n };
}
// vector tangente del mundo (metros) → vector en UV (mínimos cuadrados sobre T y B)
function aUV(w, T, B, out) {
  const tt = T.dot(T), tb = T.dot(B), bb = B.dot(B), tw = T.dot(w), bw = B.dot(w), d = tt * bb - tb * tb;
  if (Math.abs(d) < 1e-12) return out.set(0, 0);
  return out.set((bb * tw - tb * bw) / d, (tt * bw - tb * tw) / d);
}
const _u1 = new THREE.Vector2(), _u2 = new THREE.Vector2(), _x = new V3(), _y = new V3(), _m = new THREE.Matrix4();
// pinta una herida: centro uv, eje en el mundo (para el lado largo), tamaños en metros
function pintar(est, base, uv, eje, tamX, tamY, tipo, cat, inten, retraso = 0, desplazaY = 0) {
  const { T, B, n } = base;
  _x.copy(eje || _x.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))).addScaledVector(n, -_x.dot(n)); if (_x.lengthSq() < 1e-6) _x.copy(T); _x.normalize();
  _y.crossVectors(n, _x).normalize();
  aUV(_x.multiplyScalar(tamX), T, B, _u1); aUV(_y.multiplyScalar(tamY), T, B, _u2);
  const t0 = G.time + retraso;
  const me = new THREE.Mesh(geoHerida(rect(elegir(cat)), t0, tipo, Math.random(), inten, t0 + 100000), matPintura);
  const cu = uv.x + _u2.x * desplazaY, cv = uv.y + _u2.y * desplazaY;
  _m.set(_u1.x, _u2.x, 0, cu, _u1.y, _u2.y, 0, cv, 0, 0, 1, 0, 0, 0, 0, 1);
  me.matrixAutoUpdate = false; me.matrix.copy(_m); me.frustumCulled = false;
  est.escena.add(me); est.heridas.push({ me, t0, tipo, uv: new THREE.Vector2(cu, cv) }); est.sucio = true;
  if (est.heridas.length > MAX_HERIDAS) { const h = est.heridas.find(h => h.tipo === K.GOTEO_PIEL || h.tipo === K.GOTEO_TELA) || est.heridas[0]; h.me.removeFromParent(); h.me.geometry.dispose(); est.heridas.splice(est.heridas.indexOf(h), 1); }
  return me;
}
// goteo hacia abajo en el mundo, expresado en UV
const _g = new V3();
function gotear(est, base, uv, tela, retraso) {
  _g.set(0, -1, 0).addScaledVector(base.n, base.n.y); if (_g.lengthSq() < .08) return; _g.normalize();
  const largo = rnd(.07, .15), ancho = rnd(.07, .1);
  // +Y de la casilla = arriba: eje X = perpendicular a la caída
  _x.crossVectors(_g, base.n).normalize();
  pintar(est, base, uv, _x, ancho, largo, tela ? K.GOTEO_TELA : K.GOTEO_PIEL, 'goteo', rnd(.55, 1), retraso, -.4);
}

// ---------- Golpe a un personaje .glb ----------
export function golpearSkinned(est, hit, dir, o = {}) {
  const malla = hit.object; if (!est || !hit.uv || !hit.face) return null;
  malla.updateMatrixWorld(true);
  const base = baseUV(malla, hit.face); if (!base) return null;
  if (base.n.dot(dir) > 0) base.n.negate();
  const zr = zonaSkinned(malla, hit.point), zona = zr?.zona || 'torso', piel = est.piel.has(zona);
  const tipo = o.tipo || 'bala', dmg = o.dmg || 12, cos = Math.abs(base.n.dot(dir)), uv = hit.uv;
  const bala = tipo === 'bala' || tipo === 'escopeta', largoB = clamp(1 / Math.max(.4, cos), 1, 2.2);
  if (bala) {
    if (cos < .32) pintar(est, base, uv, dir, (piel ? .03 : .045) * 3.2, piel ? .03 : .045, piel ? K.ROCE_PIEL : K.ROCE_TELA, 'roce', .5);
    else if (piel) { pintar(est, base, uv, dir, .075 * largoB, .075, K.BALA_PIEL, 'agujero', .7); if (Math.random() < .8) gotear(est, base, uv, false, rnd(.15, .5)); }
    else { const t = tipo === 'escopeta' ? .11 : rnd(.13, .17); pintar(est, base, uv, dir, t * largoB, t, K.BALA_TELA, 'agujero', clamp(.35 + dmg / 45, .4, .95)); if (Math.random() < .5) gotear(est, base, uv, true, rnd(.2, .6)); }
    salpicar(hit.point, tipo === 'escopeta' ? 6 : 10, 'sangre', dir.clone().multiplyScalar(.7), 1);
    salpicarDetras(hit.point, dir, dmg / 15);
    sfx('carne', { pos: hit.point });
  } else if (tipo === 'corte') {
    const eje = o.swing || dir, l = piel ? rnd(.11, .15) : .17;
    pintar(est, base, uv, eje, l, piel ? .028 : .04, piel ? K.CORTE_PIEL : K.CORTE_TELA, 'corte', .6);
    gotear(est, base, uv, !piel, rnd(.1, .5)); if (piel && Math.random() < .5) gotear(est, base, uv, false, rnd(.4, .9));
    salpicar(hit.point, 6, 'sangre', (o.swing || dir).clone().multiplyScalar(.6), .8); sfx('slash', { pos: hit.point });
  } else {
    const t = clamp(.06 + dmg / 220, .07, .17);
    if (piel) pintar(est, base, uv, null, t, t, K.MORATON, 'moraton', clamp(.45 + dmg / 40, .5, 1.1));
    else pintar(est, base, uv, null, t * 1.4, t * 1.4, K.ROZADO, 'moraton', .7);
    sfx(dmg > 24 ? 'stone' : 'punch', { pos: hit.point });
  }
  est.hp -= dmg;
  return { zona, piel };
}

// ---------- Repintado (solo mientras haya heridas que cambian) ----------
export function actualizarPiel(dt) {
  if (!estados.length) return;
  const prev = renderer.getRenderTarget(), xr = renderer.xr.enabled, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), sa = renderer.shadowMap.autoUpdate;
  let hecho = false;
  for (const est of estados) {
    est.t -= dt; if (est.t > 0 && !est.sucio) continue; est.t = .3;
    const vivo = est.heridas.some(h => G.time - h.t0 < 240);
    if (!vivo && !est.sucio) continue;
    if (!hecho) { renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; hecho = true; }
    U.uTime.value = G.time;
    renderer.setRenderTarget(est.rt); renderer.setClearColor(0, 0); renderer.clear(true, false, false);
    renderer.render(est.escena, camUV);
    est.sucio = false;
  }
  if (hecho) { renderer.setRenderTarget(prev); renderer.xr.enabled = xr; renderer.shadowMap.autoUpdate = sa; renderer.setClearColor(cc, ca); }
}
export function quitarPiel(est) { const i = estados.indexOf(est); if (i >= 0) estados.splice(i, 1); for (const h of est.heridas) h.me.geometry.dispose(); est.rt.dispose(); }
export const estadosPiel = estados;
