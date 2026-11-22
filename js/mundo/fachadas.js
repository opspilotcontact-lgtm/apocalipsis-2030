// Fachadas variadas del pueblo (exterior creíble tipo GTA, no se entra).
// edificioVariado() sustituye al bloque uniforme de edificio() en tierra.js con la MISMA colisión (block x,z,w,d,h):
//  · estilos: ladrillo, estuco de color, piedra, azulejo; zócalo de piedra, cornisas e impostas, suciedad/humedad por shader
//  · pisos con ventanas de verdad (jambas, alféizar, persiana enrollable a medias o bajada, contraventanas), balcones con
//    barandilla, aires acondicionados, bajantes, tendederos y macetas; remates: pretil, tejado a un agua o ático retranqueado
//  · bajo comercial con ESCAPARATE de interior falso (interior mapping sobre el cristal: habitación + capa delantera +
//    reflejo), rótulo luminoso (algunos parpadean), toldo, banderola; o portal/cochera en los residenciales
//  · noche: ventanas encendidas al azar con cortinas/persianas/visillos pintados en el shader (sin texturas)
//  · caos: el mismo escaparate saqueado, a oscuras con parpadeo y el cristal roto, o la persiana metálica bajada
// Todo es estático y se fusiona por material en hornear(); los detalles viven en la zona 'fachadas' (se ocultan lejos).
// Texturas: un único atlas 2048 KTX2 (assets/texturas/interiores_tiendas.ktx2, tools/atlas_interiores.py) + las PBR que
// ya usa el juego (misma Source → sin memoria extra) + dos lienzos de 64 px.
import { THREE, V3, M, std, pieza, block, B, en, zona, canvasTex, texPBR, markStatic, materialesVentana, ktx2, UMundo, capas } from '../nucleo.js';

export const FACHADAS_ON = !new URLSearchParams(location.search).has('fachadasViejas');

// ---------- Azar con semilla (cada edificio sale siempre igual) ----------
function azar(x, z) {
  let a = (Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(z * 10) | 0, 19349663) ^ 0x2030) >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.r = (a0, a1) => a0 + (a1 - a0) * f(); f.de = arr => arr[Math.floor(f() * arr.length) % arr.length]; f.si = p => f() < p; return f;
}

// ---------- GLSL compartido ----------
const GLSL = `
varying vec3 vFP; varying vec3 vFN;
float fh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float fr(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
vec2 celdaUV(float i, vec2 l){ float c = mod(i, 4.0), r = floor(i / 4.0 + .001); return vec2((c + l.x) * .25, 1.0 - (r + 1.0 - l.y) * .25); }
`;
function conMundo(sh) {
  sh.uniforms.uTime = UMundo.uTime;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFP; varying vec3 vFN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFP = (modelMatrix * vec4(transformed, 1.0)).xyz; vFN = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\n' + GLSL);
}

// ---------- Atlas de interiores y rótulos ----------
// celdas 512: 0 farmacia · 1 panadería · 2 ferretería · 3 bar · 4 peluquería · 5 kiosco · 6 ropa · 7 electrónica ·
// 8 móviles · 9 inmobiliaria · 10-11 saqueadas · 12-13 capa delantera (verde = transparente) · 14 grietas · 15 rótulos
const marcador = new THREE.DataTexture(new Uint8Array([46, 38, 30, 255]), 1, 1); marcador.colorSpace = THREE.SRGBColorSpace; marcador.needsUpdate = true;
const TIPOS = ['farmacia', 'panaderia', 'ferreteria', 'bar', 'peluqueria', 'kiosco', 'ropa', 'electronica', 'moviles', 'inmobiliaria'];
const CAPA_DEL = { farmacia: 13, panaderia: 12, ferreteria: 13, bar: 12, peluqueria: 13, kiosco: 12, ropa: 13, electronica: 13, moviles: 13, inmobiliaria: 0 };
const COLOR_T = { farmacia: 0x1f6a3a, panaderia: 0x7a5228, ferreteria: 0x1e3a6a, bar: 0x5a1e14, peluqueria: 0x6a1d4a, kiosco: 0x8a1a1a, ropa: 0x1c1c1e, electronica: 0x1a4a7a, moviles: 0xc85a18, inmobiliaria: 0x2a3c34 };

// escaparate: interior mapping (Golus) sobre el plano del cristal. vColor = (celda, capa delantera, luz/roto)
const matInterior = std({ map: marcador, vertexColors: true, roughness: .05, metalness: .12, emissive: 0xffffff, emissiveIntensity: 1, envMapIntensity: 1.2 });
matInterior.onBeforeCompile = sh => {
  conMundo(sh);
  sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
    float iCelda = floor(vColor.r * 16.0 + .01), iCapa = floor(vColor.g * 16.0 + .01);
    float iRoto = step(.5, vColor.b), iLuz = (vColor.b - iRoto * .5) * 2.0;
    vec3 Nn = normalize(vFN), Tg = normalize(cross(vec3(0.0, 1.0, 0.0), Nn));
    vec3 Vw = vFP - cameraPosition; vec3 vt = vec3(dot(Vw, Tg), Vw.y, dot(Vw, Nn));
    vec2 ruv = fract(vMapUv), bahia = floor(vMapUv);
    // caja de la habitación: 1 uv = 2,4 m de ancho × 2,1 m de alto; pared del fondo = mitad central de la foto
    vec3 rv = vec3(vt.x / 1.2, vt.y / 1.05, -vt.z / 1.2);
    vec3 pp = vec3(ruv * 2.0 - 1.0, -1.0), idv = 1.0 / rv, kk = abs(idv) - pp * idv;
    pp += min(min(kk.x, kk.y), kk.z) * rv;
    float ti = pp.z * .5 + .5; ti = (1.0 - 1.0 / (clamp(ti, 0.0, 1.0) + 1.0)) * 2.0;
    vec2 iuv = pp.xy * mix(1.0, .5, ti) * .5 + .5;
    if (mod(bahia.x, 2.0) > .5) iuv.x = 1.0 - iuv.x; // bahías vecinas en espejo
    vec2 gx = dFdx(vMapUv) * .25, gy = dFdy(vMapUv) * .25;
    vec3 iCol = textureGrad(map, celdaUV(iCelda, clamp(iuv, .004, .996)), gx, gy).rgb;
    // capa delantera (repisa del escaparate / mostrador) a 0,35 m tras el cristal, con su paralaje
    if (iCapa > 11.5) {
      vec2 fuv = ruv + vt.xy / max(-vt.z, .05) * vec2(.35 / 2.4, .35 / 2.1);
      if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
        vec3 f = textureGrad(map, celdaUV(iCapa, fuv), gx, gy).rgb; float a = 1.0 - smoothstep(.12, .35, f.g - max(f.r, f.b));
        iCol = mix(iCol, f, a);
      }
    }
    // caos: luz que parpadea y cristal roto
    float parp = mix(1.0, .35 + .65 * step(.35, fh(vec2(floor(uTime * 9.0), bahia.x + iCelda * 7.0))), iRoto);
    iLuz *= parp;
    if (iRoto > .5) { vec3 cr = textureGrad(map, celdaUV(14.0, ruv), gx, gy).rgb; float ca = 1.0 - smoothstep(.12, .35, cr.g - max(cr.r, cr.b)); iCol = mix(iCol, vec3(.75, .8, .85) * (.25 + iLuz), ca * .85); }
    iCol *= .82 + .18 * fr(vFP.xz * 3.0 + vFP.y * 2.0); // polvo del cristal
    diffuseColor.rgb = iCol * .28;`)
    .replace('#include <color_fragment>', '')
    .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = iCol * iLuz * (.2 + .6 * emissive.r);');
};
matInterior.customProgramCacheKey = () => 'fach-interior';

// ventanas de vivienda: cristal + marco + cortinas pintados en el shader. vColor = (encendida, estilo, tono)
const matVidrio = std({ map: marcador, vertexColors: true, roughness: .06, metalness: .25, emissive: 0xffffff, emissiveIntensity: 1, envMapIntensity: 1.1 });
matVidrio.onBeforeCompile = sh => {
  conMundo(sh);
  sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
    vec2 u = vMapUv; float lit = vColor.r, est = vColor.g, ton = vColor.b;
    vec3 luzC = ton > .82 ? vec3(.62, .78, 1.0) : mix(vec3(1.0, .55, .24), vec3(1.0, .72, .42), fract(ton * 5.1));
    float lamp = .45 + .55 * clamp(1.0 - length((u - vec2(.5 + (fract(ton * 3.3) - .5) * .5, .85)) * vec2(1.1, .9)), 0.0, 1.0);
    float cort = 1.0;
    if (est < .34) { float a = .14 + .22 * fract(ton * 7.3); float e = clamp(smoothstep(a, a - .04, u.x) + smoothstep(1.0 - a, 1.04 - a, u.x), 0.0, 1.0);
      cort = mix(1.0, .42 * (.7 + .3 * sin(u.x * 80.0)), e); }
    else if (est < .67) { float b = .25 + .6 * fract(ton * 13.1); cort = mix(1.0, .16 + .05 * step(.5, fract(u.y * 46.0)), step(1.0 - b, u.y)); }
    else cort = .5 + .14 * sin(u.x * 60.0 + sin(u.y * 3.0) * 2.0);
    float tv = step(.93, ton) * (.55 + .45 * sin(uTime * 7.0 + ton * 40.0) * sin(uTime * 2.3 + 1.7));
    vec3 em = luzC * lamp * cort * lit * mix(1.0, tv, step(.93, ton));
    // marco (blanco o madera) y montante central
    float mk = max(max(step(u.x, .045), step(.955, u.x)), max(max(step(u.y, .035), step(.965, u.y)), step(abs(u.x - .5), .016)));
    vec3 cMarco = fract(ton * 3.7) < .55 ? vec3(.78, .76, .72) : vec3(.26, .17, .1);
    diffuseColor.rgb = mix(vec3(.018, .022, .028) + vec3(.03) * cort, cMarco, mk);
    em *= 1.0 - mk;`)
    .replace('#include <color_fragment>', '')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .6, mk);')
    .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = em * emissive.r * .9;');
};
matVidrio.customProgramCacheKey = () => 'fach-vidrio';

// rótulos (franjas de la celda 15) con parpadeo en los que lo piden. vColor = (parpadea, semilla, 1)
const matRotulo = std({ map: marcador, emissiveMap: marcador, vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1, roughness: .35 });
matRotulo.onBeforeCompile = sh => {
  conMundo(sh);
  sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float ph = floor(uTime * 11.0 + vColor.g * 91.0), nn = fh(vec2(ph, vColor.g * 77.0));
      totalEmissiveRadiance *= (.35 + .65 * emissive.r) * mix(1.0, step(.2, nn) * (.7 + .3 * nn), step(.5, vColor.r));`);
};
matRotulo.customProgramCacheKey = () => 'fach-rotulo';
materialesVentana.push(matInterior, matVidrio, matRotulo); // aplicarHora regula su brillo con la hora (noche 1,5 · día ,04)
ktx2.load('assets/texturas/interiores_tiendas.ktx2', t => {
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.name = 'atlas interiores_tiendas';
  for (const m of [matInterior, matVidrio, matRotulo]) { m.map = t; if (m.emissiveMap) m.emissiveMap = t; m.needsUpdate = true; }
}, undefined, e => console.warn('[fachadas] atlas de interiores', e));
const RECT_ROT = k => [1536, 1536 + k * 51, 512, 51]; // franja k de la celda 15

// ---------- Muros con suciedad: humedad abajo, chorretones bajo cornisas, manchas grandes ----------
const T = (id, srgb) => texPBR(id, srgb, 1);
function muro(id, o = {}) {
  const m = std({ map: T(id + '_diff', true), normalMap: T(id + '_nor_gl', false), roughnessMap: o.sinArm ? null : T(id + '_arm', false), roughness: o.sinArm ? .92 : 1, metalness: 0, vertexColors: true });
  m.onBeforeCompile = sh => { conMundo(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float hY = vFP.y, along = vFP.x + vFP.z;
      float humedad = 1.0 - .3 * (1.0 - smoothstep(.0, .7 + .7 * fr(vec2(along * .9, 3.1)), hY));
      float chorro = smoothstep(.62, .9, fr(vec2(along * 2.7, hY * .07 + fr(vec2(along * .5, 1.0)) * 2.0))) * (.5 + .5 * fract(hY / 3.0));
      diffuseColor.rgb *= humedad * (1.0 - .2 * chorro) * (.86 + .26 * fr(vec2(along * .12, hY * .15)));`);
  };
  m.customProgramCacheKey = () => 'fach-muro';
  return m;
}
// solo texturas que el juego ya carga (misma Source, 0 MB extra) salvo el color del ladrillo (sin arm: rugosidad fija)
const muroLadrillo = muro('red_brick_03', { sinArm: true }), muroEstuco = muro('white_plaster_02'), muroPiedra = muro('concrete_floor_worn_001'), muroAzulejo = muro('long_white_tiles');
const persianaV = std({ map: T('painted_metal_shutter_diff', true), normalMap: T('painted_metal_shutter_nor_gl', false), roughness: .7, metalness: .2, vertexColors: true, side: THREE.DoubleSide });
const baranda = std({ map: canvasTex(64, (x, s) => { x.clearRect(0, 0, s, s); x.fillStyle = '#fff'; x.fillRect(s * .42, 0, s * .16, s); x.fillRect(0, s * .9, s, s * .1); }), alphaTest: .5, side: THREE.DoubleSide, color: 0x1e1f21, roughness: .45, metalness: .8 });
const toldoMat = std({ map: canvasTex(64, (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#d4d0c8'; x.fillRect(i * 8, 0, 8, s); } x.fillStyle = 'rgba(0,0,0,.1)'; for (let k = 0; k < 260; k++) x.fillRect(Math.random() * s, Math.random() * s, 1, 1); }), vertexColors: true, roughness: .92, side: THREE.DoubleSide });

// ---------- Ayudas de geometría (coordenadas locales de la fachada: x a lo largo, +z hacia la calle) ----------
const _c = new THREE.Color();
function color(g, hex) { _c.set(hex ?? 0xffffff); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function colorRGB(g, r, gg, b) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function malla(par, g, mat, x, y, z, o = {}) {
  if (mat.vertexColors && !g.attributes.color) color(g, o.c);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = !!o.cast; m.receiveShadow = true; markStatic(m, !!o.shoot); if (par.userData.capa) m.userData.cap = par.userData.capa; par.add(m); return m;
}
function caja(par, w, h, d, mat, x, y, z, o = {}) {
  const g = new THREE.BoxGeometry(w, h, d), s = o.s || 1, uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / s, uv.getY(j) * dims[f][1] / s); }
  return malla(par, g, mat, x, y, z, o);
}
function plano(par, w, h, mat, x, y, z, o = {}) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  if (o.uv) { const [u0, v0, u1, v1] = o.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); }
  else if (o.rect) { const [rx, ry, rw, rh] = o.rect; for (let i = 0; i < uv.count; i++) uv.setXY(i, (rx + uv.getX(i) * rw) / 2048, 1 - (ry + (1 - uv.getY(i)) * rh) / 2048); }
  else if (o.s) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / o.s, uv.getY(i) * h / o.s);
  if (o.rgb) colorRGB(g, ...o.rgb);
  return malla(par, g, mat, x, y, z, o);
}
function tubo(par, r, h, mat, x, y, z, o = {}) { return malla(par, new THREE.CylinderGeometry(r, o.r2 ?? r, h, o.seg || 8), mat, x, y, z, o); }
// grupo de la fachada en una capa (calma/caos/tierra): misma posición y giro
// (las mallas heredan la capa del grupo: hornear() fusiona cada una en su capa)
function grupoCapa(cap, cx = 0, cz = 0, ry = 0) { let g; en(cap, B.ox, B.oz, () => { g = new THREE.Group(); g.userData.capa = cap; pieza(g, cx, 0, cz, { ry, static: false, cast: false }); }); return g; }

// ---------- Estilos ----------
const ESTILOS = [
  { n: 'ladrillo', mat: muroLadrillo, s: 2.4, tintes: [0xffffff, 0xeadccc, 0xd6c2b2], moldura: 0xe6dccb, persiana: true },
  { n: 'estuco', mat: muroEstuco, s: 2.2, tintes: [0xf0d9a6, 0xe9b892, 0xf3eee2, 0xb9cfd9, 0xcad6b2, 0xe2c6d4, 0xe8cf8a], moldura: 0xf7f2e6, persiana: true },
  { n: 'piedra', mat: muroPiedra, s: 2, tintes: [0xe0d2b8, 0xcfc2aa, 0xd8d0c4], moldura: 0xeee6d6, contra: true },
  { n: 'azulejo', mat: muroAzulejo, s: 1.2, tintes: [0xbcd3e3, 0xcfe3cf, 0xf0ece2, 0xe8d6b8], moldura: 0xffffff, contra: true }
];
const COLOR_CONTRA = [0x2f5a3a, 0x5a3a22, 0x2a4a6a, 0x6a2a22, 0x3a3a38];
const COLOR_MARCO_PERS = [0xe8e4dc, 0xcfc8bc, 0x8a7a64, 0x5a4a38];

// ---------- Reparto: los 10 tipos de tienda en la calle mayor, luego viviendas, cocheras y repetidos ----------
let nEdif = 0;
const REPARTO = ['farmacia', 'bar', 'panaderia', 'ferreteria', 'peluqueria', 'kiosco', 'ropa', 'electronica', 'moviles', 'inmobiliaria', 'casa', 'bar', 'cochera', 'casa', 'kiosco', 'cochera', 'ropa', 'casa'];
export const estadisticas = { edificios: 0, escaparates: 0, ventanas: 0, balcones: 0 };

// ---------- Edificio ----------
// misma colisión y forma de balas que el antiguo block(x,z,w,d,h,mat,{s:12}); el resto es visual
export function edificioVariado(x, z, w, d, h, cara) {
  const R = azar(x, z), est = ESTILOS[(nEdif * 3 + Math.floor(R() * 4)) % 4], tinte = R.de(est.tintes);
  const uso = REPARTO[nEdif % REPARTO.length]; nEdif++; estadisticas.edificios++;
  const cuerpo = block(x, z, w, d, h, est.mat, { s: est.s }); color(cuerpo.geometry, tinte);
  // tapa del tejado (como el antiguo remate de hormigón)
  block(x, z, w + .2, d + .2, .25, M.concrete, { y: h, collide: false, s: 3 });
  const ry = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI }[cara];
  const ancho = cara[0] === 'x' ? d : w, prof = cara[0] === 'x' ? w : d;
  const cx = x + (cara === 'x+' ? w / 2 : cara === 'x-' ? -w / 2 : 0), cz = z + (cara === 'z+' ? d / 2 : cara === 'z-' ? -d / 2 : 0);
  zona('fachadas', 0, 0, 135, () => {
    const g = grupoCapa('tierra', cx, cz, ry), gCalma = grupoCapa('calma', cx, cz, ry), gCaos = grupoCapa('caos', cx, cz, ry);
    pisos(g, R, est, tinte, ancho, h);
    remate(g, R, est, tinte, ancho, prof, h);
    if (uso === 'casa' || uso === 'cochera') bajoVivienda(g, R, est, ancho, uso);
    else bajoComercial(g, gCalma, gCaos, R, est, ancho, uso);
    // caras laterales y trasera: ventanas sencillas (sin ellas quedan medianeras ciegas enormes de noche)
    for (const c of ['x+', 'x-', 'z+', 'z-']) if (c !== cara) caraSecundaria(R, est, x, z, w, d, h, c);
    // bajantes en una o las dos esquinas
    const cB = R.de([0x5a5e62, 0x6a5040, 0x3a3c3e]);
    for (const sx of R.si(.5) ? [-1, 1] : [R.si(.5) ? -1 : 1]) { tubo(g, .055, h - .1, M.metalV, sx * (ancho / 2 - .14), h / 2, .1, { c: cB }); caja(g, .2, .16, .18, M.metalV, sx * (ancho / 2 - .14), h - .12, .1, { c: cB }); caja(g, .14, .08, .2, M.metalV, sx * (ancho / 2 - .14), .04, .14, { c: cB }); }
  });
}

function caraSecundaria(R, est, x, z, w, d, h, c) {
  const ry = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI }[c], ancho = c[0] === 'x' ? d : w;
  const g = grupoCapa('tierra', x + (c === 'x+' ? w / 2 : c === 'x-' ? -w / 2 : 0), z + (c === 'z+' ? d / 2 : c === 'z-' ? -d / 2 : 0), ry);
  const nb = Math.floor((ancho - 1) / 3.2), bw = (ancho - 1) / Math.max(1, nb), ciega = R.si(.25);
  if (ciega || nb < 1) return;
  for (let y = 4.7; y < h - 1; y += 3.0) for (let i = 0; i < nb; i++) {
    if (R.si(.3)) continue;
    const vx = -ancho / 2 + .5 + bw * (i + .5), vw = .95, vh = 1.3;
    plano(g, vw, vh, matVidrio, vx, y, .012, { rgb: [R.si(.35) ? 1 : 0, R(), R()] });
    caja(g, vw + .2, .06, .14, M.pintado, vx, y - vh / 2 - .03, .07, { c: est.moldura });
    caja(g, vw + .16, .1, .06, M.pintado, vx, y + vh / 2 + .05, .03, { c: est.moldura });
    if (R.si(.4)) { const f = R.r(.3, 1); plano(g, vw, vh * f, persianaV, vx, y + vh / 2 - vh * f / 2, .03, { c: 0xcfc8bc, uv: [0, 0, vw / 1.2, vh * f / 1.2] }); }
  }
}

// pisos altos: impostas, ventanas/balcones por bahía, aires y macetas
function pisos(g, R, est, tinte, ancho, h) {
  const H0 = 3.4, nP = Math.max(1, Math.floor((h - H0 - .25) / 3.0)), nb = Math.max(2, Math.round(ancho / 3.1)), bw = ancho / nb;
  const vw = R.r(1.0, 1.3), mold = est.moldura, marcoPers = R.de(COLOR_MARCO_PERS), cContra = R.de(COLOR_CONTRA);
  const corrido = R.si(.3); // primer piso con balcón corrido
  // impostas entre pisos y sobre el bajo
  for (let j = 0; j <= nP; j++) caja(g, ancho + .04, j ? .12 : .22, j ? .08 : .14, M.pintado, 0, H0 + j * 3.0 - (j ? .06 : .02), j ? .04 : .07, { c: mold });
  for (let j = 0; j < nP; j++) {
    const y0 = H0 + j * 3.0;
    if (corrido && j === 0) balcon(g, R, 0, y0, ancho - .6, .9);
    for (let i = 0; i < nb; i++) {
      const bx = -ancho / 2 + bw * (i + .5), esBalcon = corrido && j === 0 ? true : R.si(j === 0 ? .45 : .3);
      const vh = esBalcon ? 2.25 : 1.45, vy = esBalcon ? y0 + .05 + vh / 2 : y0 + .95 + vh / 2, ww = esBalcon ? Math.min(vw, 1.05) : vw;
      ventana(g, R, est, bx, vy, ww, vh, mold, marcoPers, cContra, esBalcon);
      if (esBalcon && !(corrido && j === 0)) balcon(g, R, bx, y0, Math.min(bw * .8, 2.2), .75);
      else if (!esBalcon) caja(g, ww + .26, .07, .17, M.pintado, bx, vy - vh / 2 - .04, .085, { c: mold }); // alféizar
      if (R.si(.16) && !esBalcon) aire(g, R, bx + (R.si(.5) ? -1 : 1) * (ww / 2 + .55), vy - .35);
      if (esBalcon && R.si(.12)) aire(g, R, bx + .7, y0 + .5, .55);
    }
  }
}
function ventana(g, R, est, x, y, w, h, mold, marcoPers, cContra, puerta) {
  estadisticas.ventanas++;
  // jambas y dintel (recercado) que sobresalen: el cristal queda hundido
  const jw = est.n === 'ladrillo' ? .1 : .14, cj = est.n === 'ladrillo' ? 0xd8cfc0 : mold;
  for (const sx of [-1, 1]) caja(g, jw, h + jw, .07, M.pintado, x + sx * (w / 2 + jw / 2), y + jw / 2 - .02, .035, { c: cj });
  caja(g, w + jw * 2 + (est.n === 'piedra' ? .2 : 0), est.n === 'piedra' ? .22 : jw, .08, M.pintado, x, y + h / 2 + jw / 2, .04, { c: cj });
  const lit = R.si(.48) ? 1 : 0, estilo = R(), tono = R();
  plano(g, w, h, matVidrio, x, y, .012, { rgb: [lit, estilo, tono] });
  // persiana enrollable (cajón + lamas bajadas una fracción) o contraventanas
  if (est.persiana && R.si(.8)) {
    const f = R.si(.18) ? 1 : R.si(.45) ? R.r(.15, .7) : 0;
    caja(g, w + .04, .2, .1, M.pintado, x, y + h / 2 - .1, .05, { c: marcoPers });
    if (f > 0) plano(g, w, h * f, persianaV, x, y + h / 2 - h * f / 2, .03, { c: marcoPers, uv: [0, 0, w / 1.2, h * f / 1.2] });
  } else if (est.contra) {
    const cerrada = R.si(.22);
    for (const sx of [-1, 1]) plano(g, w / 2, h, persianaV, cerrada ? x + sx * w / 4 : x + sx * (w / 2 + jw + w / 4), y, cerrada ? .04 : .075, { c: cContra, uv: [0, 0, w / 2.4, h / 1.2] });
  }
}
function balcon(g, R, x, y0, L, p) {
  estadisticas.balcones++;
  caja(g, L, .14, p, M.concrete, x, y0 + .02, p / 2, { s: 2, cast: true });
  plano(g, L, .95, baranda, x, y0 + .55, p - .02, { uv: [0, 0, L / .13, 1] });
  for (const sx of [-1, 1]) plano(g, p - .04, .95, baranda, x + sx * (L / 2 - .02), y0 + .55, p / 2, { ry: Math.PI / 2, uv: [0, 0, p / .13, 1] });
  caja(g, L + .04, .045, .05, M.metalV, x, y0 + 1.04, p - .02, { c: 0x1e1f21 });
  if (R.si(.5)) { const n = 1 + Math.floor(R() * 3); for (let k = 0; k < n; k++) { const px = x + R.r(-L / 2 + .3, L / 2 - .3); tubo(g, .14, .26, M.brillo, px, y0 + .22, p - .25, { r2: .1, c: R.de([0xb8603a, 0x8a4a2a, 0x2a2a2a]) }); malla(g, new THREE.IcosahedronGeometry(R.r(.18, .3), 0), M.pintado, px, y0 + .5, p - .25, { c: 0x3a5a2a }); } }
  if (R.si(.18)) { // tendedero
    caja(g, L * .8, .012, .012, M.metalV, x, y0 + 1.7, p - .1, { c: 0x888888 });
    for (let k = 0; k < 4; k++) plano(g, R.r(.3, .55), R.r(.35, .6), toldoMat, x - L * .35 + k * L * .22, y0 + 1.42, p - .1, { c: R.de([0xe8e4dc, 0x3a5a9a, 0xc83a3a, 0x2a2a2a, 0xe8c840]) });
  }
}
function aire(g, R, x, y, z0 = 0) {
  caja(g, .8, .55, .3, M.pintado, x, y, z0 + .16, { c: R.de([0xdcdcd6, 0xc8c8c0, 0xe8e8e2]) });
  tubo(g, .2, .02, M.metalV, x - .12, y, z0 + .32, { rx: Math.PI / 2, seg: 14, c: 0x3a3a3a });
  if (!z0) for (const sx of [-.3, .3]) caja(g, .03, .03, .3, M.metalV, x + sx, y - .3, .15, { c: 0x2a2a2a });
}

// remate: cornisa + pretil, tejado a un agua o ático; trastos en la cubierta
function remate(g, R, est, tinte, ancho, prof, h) {
  const tipo = R.de(['pretil', 'pretil', 'tejado', 'atico']);
  caja(g, ancho + .3, .28, .42, M.pintado, 0, h - .14, .19, { c: est.moldura, cast: true });
  if (R.si(.6)) for (let i = 0; i < Math.floor(ancho / .45); i++) caja(g, .14, .12, .12, M.pintado, -ancho / 2 + .25 + i * .45, h - .34, .06, { c: est.moldura }); // ménsulas
  if (tipo === 'pretil') {
    const ph = R.r(.7, 1.2); caja(g, ancho, ph, .25, est.mat, 0, h + ph / 2, -.125, { c: tinte, s: est.s }); caja(g, ancho + .1, .08, .32, M.concrete, 0, h + ph + .04, -.125);
  } else if (tipo === 'tejado') {
    const sube = R.r(1.4, 2.2), L = Math.hypot(prof + .5, sube), gt = new THREE.PlaneGeometry(ancho + .5, L); gt.rotateX(-Math.PI / 2 + Math.atan2(sube, prof + .5));
    { const uv = gt.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (ancho + .5) / 2.2, uv.getY(i) * L / 2.2); }
    malla(g, gt, M.tejado, 0, h + sube / 2 + .05, -prof / 2 + .25, { cast: true });
    for (const sx of [-1, 1]) { // hastiales triangulares bajo el faldón
      const P = [[0, 0, 0], [0, 0, -prof], [0, sube, -prof]], o = sx > 0 ? [0, 1, 2] : [0, 2, 1], pos = [], uv = [];
      for (const i of o) { pos.push(sx * ancho / 2, h + P[i][1], P[i][2]); uv.push(P[i][2] / est.s, P[i][1] / est.s); }
      const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gs.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gs.computeVertexNormals();
      malla(g, gs, est.mat, 0, 0, 0, { c: tinte });
    }
    tubo(g, .07, ancho + .4, M.metalV, 0, h - .02, .62, { rz: Math.PI / 2, c: 0x6a6e72 }); // canalón
  } else {
    const aw = ancho - 1.6, ad = Math.min(prof - 3, 6), ah = 2.7;
    caja(g, aw, ah, ad, est.mat, 0, h + ah / 2, -2.2 - ad / 2, { c: tinte, s: est.s, cast: true });
    caja(g, aw + .3, .18, ad + .3, M.concrete, 0, h + ah + .09, -2.2 - ad / 2);
    for (const sx of [-.25, .25]) plano(g, 1.6, 2.1, matVidrio, sx * aw, h + 1.15, -2.19, { rgb: [R.si(.5) ? 1 : 0, .8, R()] });
    plano(g, ancho - .2, 1.0, baranda, 0, h + .55, -.05, { uv: [0, 0, (ancho - .2) / .13, 1] }); caja(g, ancho - .2, .05, .05, M.metalV, 0, h + 1.05, -.05, { c: 0x1e1f21 });
    if (R.si(.6)) { caja(g, 2.2, .04, 1.8, toldoMat, -aw * .25, h + 2.3, -1.3, { c: R.de([0xc83a2a, 0x2a6a3a, 0xe8e0c8]) }); }
  }
  // trastos en la cubierta: depósito, antena, chimenea
  const zt = -prof * .55;
  if (R.si(.55)) { tubo(g, .55, 1.1, M.pintado, R.r(-ancho / 3, ancho / 3), h + 1.6, zt, { seg: 12, c: 0xd8d8d0 }); }
  if (R.si(.7)) { const ax = R.r(-ancho / 3, ancho / 3); tubo(g, .025, 3.2, M.metalV, ax, h + 1.6, zt + 1, { c: 0x8a8e92 }); for (let k = 0; k < 3; k++) caja(g, .9 - k * .2, .02, .02, M.metalV, ax, h + 2.4 + k * .35, zt + 1, { c: 0x8a8e92 }); }
  if (R.si(.5)) caja(g, .55, 1.3, .55, est.mat, R.r(-ancho / 2.5, ancho / 2.5), h + (tipo === 'tejado' ? 1.9 : .65), zt - .8, { c: tinte, s: est.s });
}

// bajo comercial: pilastras, rótulo, escaparates con interior, puerta, toldo, banderola
function bajoComercial(g, gCalma, gCaos, R, est, ancho, tipo) {
  const ti = TIPOS.indexOf(tipo), colT = COLOR_T[tipo], L = Math.min(ancho - 1.0, 9.5), H0 = 3.4;
  estadisticas.escaparates++;
  // zócalo de piedra a lo ancho, pilastras y faja del rótulo
  caja(g, ancho + .02, .55, .07, muroPiedra, 0, .275, .035, { c: 0x9a948a, s: 1.5 });
  for (const sx of [-1, 1]) caja(g, .38, H0 - .1, .14, M.pintado, sx * (L / 2 + .19), (H0 - .1) / 2, .07, { c: est.n === 'ladrillo' ? 0x3a3634 : est.moldura });
  caja(g, L + .76, .7, .14, M.pintado, 0, H0 - .45, .07, { c: colT });
  const rl = Math.min(L * .72, 5.2);
  plano(g, rl, rl / 10, matRotulo, 0, H0 - .45, .145, { rect: RECT_ROT(ti), rgb: [R.si(.3) ? 1 : 0, R(), 1] });
  // reparto: escaparate | puerta | escaparate
  const pw = 1.05, ey = 1.55, eh = 2.0, cel = (ti + .5) / 16, capa = CAPA_DEL[tipo] ? (CAPA_DEL[tipo] + .5) / 16 : 0;
  const lado = R.si(.5) ? -1 : 1, px = lado * (L / 2 - pw / 2 - .05);
  const ew = (L - pw - .3) / 2, x0 = lado > 0 ? -L / 2 + .05 + ew / 2 : -L / 2 + pw + .15 + ew / 2;
  const huecos = [[x0, ew], [x0 + ew + .1, ew]];
  const persianaCaos = R.si(.4);
  for (const [hx, hw] of huecos) {
    const bahias = Math.max(1, Math.round(hw / 2.4));
    plano(gCalma, hw, eh, matInterior, hx, ey, .03, { uv: [0, 0, bahias, 1], rgb: [cel, capa, .49] });
    if (persianaCaos) plano(gCaos, hw + .1, eh + .3, persianaV, hx, ey + .15, .05, { c: 0x8a8c8a, uv: [0, 0, hw / 1.5, (eh + .3) / 1.5] });
    else plano(gCaos, hw, eh, matInterior, hx, ey, .03, { uv: [0, 0, bahias, 1], rgb: [(10 + (ti % 2) + .5) / 16, 0, .5 + .08] });
    caja(g, hw + .08, .06, .12, M.metalV, hx, ey - eh / 2 - .03, .07, { c: 0x2a2a2a }); caja(g, hw + .08, .06, .1, M.metalV, hx, ey + eh / 2 + .03, .06, { c: 0x2a2a2a });
    for (const sx of [-1, 1]) caja(g, .06, eh, .1, M.metalV, hx + sx * hw / 2, ey, .06, { c: 0x2a2a2a });
    if (hw > 2.6) caja(g, .05, eh, .08, M.metalV, hx, ey, .06, { c: 0x2a2a2a });
  }
  // puerta acristalada (mismo interior) con marco y tirador
  plano(gCalma, pw - .1, 2.3, matInterior, px, 1.17, .03, { uv: [.2, 0, .6, 1], rgb: [cel, 0, .49] });
  if (persianaCaos) plano(gCaos, pw + .05, 2.5, persianaV, px, 1.27, .05, { c: 0x8a8c8a, uv: [0, 0, .7, 1.6] });
  else plano(gCaos, pw - .1, 2.3, matInterior, px, 1.17, .03, { uv: [.2, 0, .6, 1], rgb: [(10 + (ti % 2) + .5) / 16, 0, .5 + .08] });
  for (const sx of [-1, 1]) caja(g, .07, 2.4, .1, M.metalV, px + sx * pw / 2, 1.2, .06, { c: 0x2a2a2a }); caja(g, pw + .07, .07, .1, M.metalV, px, 2.37, .06, { c: 0x2a2a2a });
  caja(g, .03, .45, .05, M.metalV, px - lado * .32, 1.1, .1, { c: 0xc0c4c8 });
  // cajón de la persiana metálica sobre el hueco
  caja(g, L, .26, .2, M.pintado, 0, 2.72, .1, { c: 0x6a6c6a });
  // toldo
  if (R.si(.55) && tipo !== 'inmobiliaria') {
    const tw = L * .94, tg = new THREE.PlaneGeometry(tw, 1.3); tg.rotateX(-Math.PI / 2 + .45);
    { const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * tw / 1.2, uv.getY(i)); }
    malla(g, tg, toldoMat, 0, 2.56, .62, { c: R.de([0xb02020, 0x2a6a3a, 0xd08a20, 0x2a4a8a, 0x5a3a22, colT]), cast: true });
    caja(g, tw, .2, .03, toldoMat, 0, 2.18, 1.2, { c: 0xf0ece0 }); // faldón
    for (const sx of [-1, 1]) caja(g, .03, .03, 1.25, M.metalV, sx * tw * .46, 2.55, .62, { rx: .45, c: 0x2a2a2a });
  }
  // banderola perpendicular (cruz verde que parpadea en la farmacia)
  if (tipo === 'farmacia') {
    const bx = (lado > 0 ? -1 : 1) * (L / 2 + .2); caja(g, .04, .04, .6, M.metalV, bx, 3.05, .3, { c: 0x2a2a2a });
    for (const sx of [-1, 1]) plano(g, .72, .72, matRotulo, bx + sx * .045, 3.05, .75, { ry: sx * Math.PI / 2, rect: [1536 + 19, 1536 + 10, 30, 30], rgb: [1, .37, 1] });
    caja(g, .08, .78, .78, M.pintado, bx, 3.05, .75, { c: 0x111111 });
  } else if (R.si(.45)) {
    const bx = (lado > 0 ? -1 : 1) * (L / 2 + .2); caja(g, .04, .04, .55, M.metalV, bx, 3.0, .28, { c: 0x2a2a2a });
    caja(g, .07, .5, .9, M.pintado, bx, 3.0, .78, { c: colT });
    for (const sx of [-1, 1]) plano(g, .85, .085, matRotulo, bx + sx * .04, 3.0, .78, { ry: sx * Math.PI / 2, rect: RECT_ROT(ti), rgb: [R.si(.4) ? 1 : 0, R(), 1] });
  }
  // caos: cristales en la acera delante de los escaparates rotos
  if (!persianaCaos) for (let k = 0; k < 18; k++) { const s = R.r(.04, .16); plano(gCaos, s, s * R.r(.5, 1.3), M.cristal, R.r(-L / 2, L / 2), .025, R.r(.2, 1.6), { rx: -Math.PI / 2, rz: R.r(0, 3) }); }
}

// bajo de vivienda: portal con recercado de piedra + ventanas con reja, o cochera con persiana metálica
function bajoVivienda(g, R, est, ancho, uso) {
  caja(g, ancho + .02, .8, .07, muroPiedra, 0, .4, .035, { c: 0x9a948a, s: 1.5 });
  const px = R.r(-ancho / 4, ancho / 4);
  // portal de madera de doble hoja con montante
  caja(g, 1.9, 3.0, .1, M.pintado, px, 1.5, .05, { c: est.moldura });
  caja(g, 1.6, 2.5, .06, M.mueble, px, 1.25, .1, { s: .8 });
  caja(g, .02, 2.5, .07, M.pintado, px, 1.25, .13, { c: 0x2a1e14 });
  plano(g, 1.5, .32, matVidrio, px, 2.72, .11, { rgb: [R.si(.5) ? 1 : 0, .9, .3] });
  for (const sx of [-.12, .12]) tubo(g, .025, .05, M.metalV, px + sx, 1.2, .15, { rx: Math.PI / 2, c: 0xb8a060 });
  caja(g, 2.1, .14, .5, M.concrete, px, .07, .25); // escalón
  if (uso === 'cochera') {
    const cx = px > 0 ? px - 3.4 : px + 3.4;
    caja(g, 2.9, 2.75, .08, M.pintado, cx, 1.375, .04, { c: 0x3a3a38 });
    plano(g, 2.7, 2.6, persianaV, cx, 1.3, .085, { c: R.de([0x8a8c8a, 0x5a6a5a, 0x7a6a5a]), uv: [0, 0, 2.7 / 1.5, 2.6 / 1.5] });
  } else for (const sx of [-1, 1]) {
    const wx = px + sx * 2.6; if (Math.abs(wx) > ancho / 2 - .9) continue;
    plano(g, 1.1, 1.4, matVidrio, wx, 1.75, .012, { rgb: [R.si(.35) ? 1 : 0, .5, R()] });
    for (const s2 of [-1, 1]) caja(g, .12, 1.52, .07, M.pintado, wx + s2 * .61, 1.75, .035, { c: est.moldura }); caja(g, 1.34, .12, .08, M.pintado, wx, 2.51, .04, { c: est.moldura });
    plano(g, 1.2, 1.5, baranda, wx, 1.75, .14, { uv: [0, 0, 1.2 / .11, 1] }); // reja
    caja(g, 1.36, .07, .17, M.pintado, wx, .99, .085, { c: est.moldura });
  }
}

// ---------- Pulido de calle: atrezo sin colisión, charcos que solo brillan mojados ----------
const charcoMat = std({ color: 0x0a0c0e, roughness: .03, metalness: .9, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
charcoMat.onBeforeCompile = sh => { sh.uniforms.uWet = UMundo.uWet; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet;').replace('#include <opaque_fragment>', 'diffuseColor.a = .82 * uWet;\n#include <opaque_fragment>'); };
charcoMat.customProgramCacheKey = () => 'fach-charco'; charcoMat.opacity = 1;
const gCharco = (() => { const g = new THREE.CircleGeometry(1, 20), p = g.attributes.position; for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)), r = .7 + .3 * Math.sin(a * 3 + 1) * Math.cos(a * 2); p.setXY(i, p.getX(i) * r, p.getY(i) * r); } return g; })();
export function calleViva() {
  if (!FACHADAS_ON) return;
  const R = azar(7, 7);
  zona('fachadas', 0, 0, 135, () => {
    const g = grupoCapa('tierra');
    // charcos junto a los bordillos y en los baches de la calzada (solo se ven con el suelo mojado)
    for (let k = 0; k < 26; k++) { const z = R.r(-60, 66), x = R.si(.6) ? R.de([-4.6, 4.6]) + R.r(-.3, .3) : R.r(-3, 3); if (Math.abs(z) < 7) continue; const m = malla(g, gCharco.clone(), charcoMat, x, .03, z, { rx: -Math.PI / 2, rz: R.r(0, 6) }); m.scale.set(R.r(.5, 1.6), R.r(.4, 1), 1); }
    for (let k = 0; k < 10; k++) { const x = R.r(-50, 50), z = R.de([-1, 1]) * R.r(1.5, 4.2); if (Math.abs(x) < 7) continue; const m = malla(g, gCharco.clone(), charcoMat, x, .031, z, { rx: -Math.PI / 2, rz: R.r(0, 6) }); m.scale.set(R.r(.6, 1.8), R.r(.4, 1), 1); }
    // calma: macetas, cajas de cartón y cubos junto a las fachadas de la calle mayor
    const gc = grupoCapa('calma');
    for (const s of [-1, 1]) for (let z = -54; z < 58; z += R.r(3, 7)) {
      if (Math.abs(z) < 9 || (z > -24 && z < -21) || (z > -9 && z < -7)) continue;
      const x = s * R.r(8.35, 8.6), t = R();
      if (t < .35) { tubo(gc, .22, .45, M.brillo, x, .225, z, { r2: .17, seg: 12, c: R.de([0xb8603a, 0x8a4a2a, 0x3a3a3a]) }); malla(gc, new THREE.IcosahedronGeometry(.32, 1), M.pintado, x, .7, z, { c: 0x3a5a2a }); }
      else if (t < .55) { for (let k = 0; k < 1 + Math.floor(R() * 3); k++) caja(gc, R.r(.35, .6), R.r(.25, .45), R.r(.3, .5), M.pintado, x - s * R.r(0, .3), .15 + k * .32, z + R.r(-.3, .3), { ry: R.r(-.3, .3), c: R.de([0xa88a5a, 0x9a7a4a, 0xb89a6a]) }); }
      else if (t < .7) { tubo(gc, .28, .9, M.pintado, x, .45, z, { seg: 12, c: R.de([0x2a5a3a, 0x3a3a3a, 0x2a4a7a]) }); tubo(gc, .3, .06, M.pintado, x, .92, z, { seg: 12, c: 0x1a1a1a }); }
    }
    // caos: papeles y escombro menudo junto a las fachadas
    const gx = grupoCapa('caos');
    for (let k = 0; k < 60; k++) { const s = R.de([-1, 1]); plano(gx, R.r(.2, .32), R.r(.25, .4), M.pintado, s * R.r(5.5, 8.5), .02, R.r(-58, 64), { rx: -Math.PI / 2, rz: R.r(0, 6), c: R.de([0xe8e4d8, 0xd8d0c0, 0xf0ece4]) }); }
    for (let k = 0; k < 40; k++) { const s = R.r(.1, .35); caja(gx, s, s * .5, s * 1.2, M.concrete, R.de([-1, 1]) * R.r(7, 8.6), s * .25, R.r(-58, 64), { ry: R.r(0, 3), s: 1 }); }
  });
}
