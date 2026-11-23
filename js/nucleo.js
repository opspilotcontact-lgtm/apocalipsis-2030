// Núcleo del motor: render, materiales, cielo, capas del mundo, construcción, colisiones y luces.
// Todo lo que construye el mundo pasa por aquí para que las colisiones y la fusión de geometría
// sepan a qué capa pertenece cada pieza (tierra, calma, caos, espacio).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };
export const V3 = THREE.Vector3, Y = new V3(0, 1, 0), XA = new V3(1, 0, 0);
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const angLerp = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, t); };
export const $ = s => document.querySelector(s);

// Estado compartido del juego
export const G = { mode: 'pc', playing: false, freeMode: false, time: 0, hora: 'noche', fogOn: true, shake: 0, hitT: 0, CAM: new V3(), quality: 1, enEspacio: false, pausaJuego: false };

// ---------- Render ----------
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
document.body.prepend(renderer.domElement);
// Niebla de altura para TODOS los materiales (cero llamadas extra): la niebla lineal de siempre se atenúa con la
// altura de mundo, así se acumula a ras de suelo y los tejados y cerros asoman por encima.
THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
 varying float vFogDepth; varying float vFogY;
#endif`;
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
 vFogDepth = - mvPosition.z; vFogY = dot(viewMatrix[1].xyz, mvPosition.xyz - viewMatrix[3].xyz);
#endif`;
THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth; varying float vFogY;');
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace('gl_FragColor.rgb = mix', 'fogFactor *= mix(1.0, exp(-max(0.0, vFogY - 1.0) * .075), .7); gl_FragColor.rgb = mix');
export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x10141f, 6, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
const salaRT = pmrem.fromScene(new RoomEnvironment(), .04); let envSala = salaRT.texture; scene.environment = envSala; // reserva hasta que llegue el HDRI
export const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 330);
export const dolly = new THREE.Group(); scene.add(dolly);
export const head = new THREE.Group(); head.position.y = 1.62; dolly.add(head); head.add(camera);
export const vm = new THREE.Group(); camera.add(vm);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- Geometrías compartidas ----------
const GC = new Map();
export const rbox = (w, h, d) => { const k = `${w}|${h}|${d}`; let g = GC.get(k); if (!g) { g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * .22); GC.set(k, g); } return g; };
export const sphG = r => { const k = 's' + r; let g = GC.get(k); if (!g) { g = new THREE.SphereGeometry(r, 12, 8); GC.set(k, g); } return g; };
export const cylG = (r, l) => { const k = `c${r}|${l}`; let g = GC.get(k); if (!g) { g = new THREE.CylinderGeometry(r, r, l, 10); GC.set(k, g); } return g; };

// ---------- Texturas ----------
export function cv2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function toTex(c, rep = true) { const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
export function canvasTex(size, draw, rep = true) { const [c, x] = cv2d(size, size); draw(x, size); return toTex(c, rep); }
export function grain(x, s, base, amt, n, h = s) {
  if (base) { x.fillStyle = base; x.fillRect(0, 0, s, h); }
  for (let i = 0; i < n; i++) { const v = Math.random() < .5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * amt})`; const r = Math.random() * 3 + .5; x.fillRect(Math.random() * s, Math.random() * h, r, r); }
}
// ---------- Texturas PBR reales (Poly Haven, CC0) ----------
// assets/texturas/<id>_{diff,nor_gl,arm}.ktx2 (Basis: color/arm ETC1S, normales UASTC) → en la GPU quedan
// comprimidas (ASTC/ETC2 en Quest, BC en PC): ~4-8 veces menos memoria que una imagen RGBA.
// arm = R: oclusión, G: rugosidad, B: metal (así las lee three.js).
// Convención: block()/flat() escalan las UV en metros (1 unidad de UV = o.s metros); rep ajusta cuántas
// veces se repite la textura dentro de esa unidad para que una baldosa real mida unos 2-4 m.
const TEXR = 'assets/texturas/';
export const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/').detectSupport(renderer);
const texCache = new Map(); // nombre → { base, copias[], datos }
function volcar(c, t) { c.image = t.image; c.mipmaps = t.mipmaps; c.format = t.format; c.type = t.type; c.minFilter = t.minFilter; c.magFilter = THREE.LinearFilter; c.generateMipmaps = false; c.needsUpdate = true; }
export function texPBR(nombre, srgb, rep = 1) {
  let e = texCache.get(nombre);
  if (!e) {
    e = { copias: [], datos: null, base: new THREE.CompressedTexture([], 1, 1) }; texCache.set(nombre, e);
    ktx2.load(TEXR + nombre + '.ktx2', t => { e.datos = t; for (const c of e.copias) volcar(c, t); }, undefined, err => console.warn('Textura', nombre, err));
  }
  const t = e.base.clone(); e.copias.push(t); // misma fuente (Source) → una sola subida a la GPU, repetición propia
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (e.datos) volcar(t, e.datos); else t.version = 0; // clone() marca needsUpdate: sin datos todavía no debe subirse
  return t;
}
const tex = texPBR;
// material PBR completo a partir de un id de Poly Haven
// o.macro: variación de color a gran escala por posición de mundo (rompe la repetición de la baldosa)
export function pbr(id, o = {}) {
  const rep = o.rep ?? 1, arm = o.sinArm ? null : tex(id + '_arm', false, rep);
  const p = { map: tex(id + '_diff', true, rep), normalMap: o.sinNormal ? null : tex(id + '_nor_gl', false, rep), roughness: 1, metalness: arm ? 1 : 0 };
  if (arm) Object.assign(p, { roughnessMap: arm, metalnessMap: arm, aoMap: arm, aoMapIntensity: o.ao ?? 1 });
  const ns = o.normalScale, macro = o.macro; for (const k of ['rep', 'sinArm', 'ao', 'normalScale', 'macro', 'sinNormal']) delete o[k];
  const m = new THREE.MeshStandardMaterial({ ...p, ...o });
  if (ns !== undefined) m.normalScale.setScalar(ns);
  if (macro) conMacro(m, macro === true ? .22 : macro);
  return m;
}
// ruido de valor en GLSL para mezclar suelos y charcos por posición de mundo (sin texturas extra)
const GLSL_RUIDO = `
varying vec3 vWPos;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float ruido(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ return ruido(p)*.55 + ruido(p*2.03+7.1)*.3 + ruido(p*4.1+3.7)*.15; }
`;
function conPosMundo(shader) {
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_RUIDO);
}
// variación de color a gran escala por posición de mundo (para paredes y suelos que se repiten mucho)
function conMacro(m, k) {
  m.onBeforeCompile = sh => { conPosMundo(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float mv = fbm(vWPos.xz * .07 + vWPos.y * .11) ; diffuseColor.rgb *= 1.0 - ${k.toFixed(3)} * .5 + ${k.toFixed(3)} * mv;`);
  };
  m.customProgramCacheKey = () => 'macro' + k;
}
// uniformes compartidos que cambian con la hora (los toca aplicarHora)
export const UMundo = { uWet: { value: 0 }, uTime: { value: 0 }, uRain: { value: 0 }, uWind: { value: new THREE.Vector3(1, 0, .3) } };

// asfalto: a 3 m por baldosa, con charcos y efecto mojado de noche
const matAsfalto = pbr('asphalt_02', { rep: 2, normalScale: 1.1 });
matAsfalto.onBeforeCompile = sh => {
  sh.uniforms.uWet = UMundo.uWet; sh.uniforms.uRain = UMundo.uRain; sh.uniforms.uTime = UMundo.uTime; conPosMundo(sh);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet, uRain, uTime;')
    .replace('#include <map_fragment>', `#include <map_fragment>
      float charco = smoothstep(.6, .68, fbm(vWPos.xz * .13)) * uWet;
      float humedo = uWet * (.55 + .45 * fbm(vWPos.xz * .5));
      diffuseColor.rgb *= mix(1.0, .62, humedo); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .35, charco);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, roughnessFactor * .45, humedo); roughnessFactor = mix(roughnessFactor, .04, charco);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = normalize(mix(normal, normalize(vNormal) * faceDirection, charco));
      if (uRain > .01 && charco > .01) { // ondas de gotas en los charcos
        vec2 cel = floor(vWPos.xz * 1.4), f = fract(vWPos.xz * 1.4) - .5 - (vec2(h21(cel + 3.1), h21(cel + 7.3)) - .5) * .5;
        float ph = fract(uTime * 1.1 + h21(cel)), r = length(f), ring = sin((r - ph * .45) * 55.0) * smoothstep(.45 * ph + .06, .45 * ph, r) * (1.0 - ph);
        vec2 dr = normalize(f + 1e-4); normal = normalize(normal + (viewMatrix * vec4(dr.x, 0.0, dr.y, 0.0)).xyz * ring * .45 * uRain * charco); }`);
};
matAsfalto.customProgramCacheKey = () => 'asfalto-mojado';

// tierra fuera de las calles: hierba y barro con hojas mezclados por ruido de mundo
const matTierra = pbr('grass_path_2', { rep: 1.2, normalScale: 1 });
const barro = tex('brown_mud_leaves_01_diff', true, 1);
matTierra.onBeforeCompile = sh => {
  sh.uniforms.mudMap = { value: barro }; conPosMundo(sh);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D mudMap;')
    .replace('#include <map_fragment>', `
      float kBarro = smoothstep(.4, .62, fbm(vWPos.xz * .045) * .7 + fbm(vWPos.xz * .23) * .3);
      vec4 cHierba = texture2D(map, vMapUv), cBarro = texture2D(mudMap, vMapUv * .83 + .37);
      diffuseColor *= mix(cHierba, cBarro, kBarro) * (.85 + .3 * ruido(vWPos.xz * .02));`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, roughnessFactor * .8, kBarro);`);
};
matTierra.customProgramCacheKey = () => 'tierra-mezcla';

// paneles e interiores que siguen siendo de lienzo (llevan rótulos o franjas propias)
const texPanelIn = canvasTex(256, (x, s) => { grain(x, s, '#d2d4d6', .06, 1500); x.strokeStyle = 'rgba(40,50,60,.35)'; x.lineWidth = 3; x.strokeRect(2, 2, s - 4, s - 4); x.fillStyle = 'rgba(41,230,255,.25)'; x.fillRect(0, s * .78, s, 6); });
const texCrate = canvasTex(256, (x, s) => { grain(x, s, '#3f4a3a', .2, 3000); x.strokeStyle = '#2a3226'; x.lineWidth = 14; x.strokeRect(7, 7, s - 14, s - 14); x.beginPath(); x.moveTo(10, 10); x.lineTo(s - 10, s - 10); x.stroke(); x.fillStyle = 'rgba(230,200,60,.8)'; x.font = 'bold 34px sans-serif'; x.fillText('M-2030', 60, s - 30); });
const texHazard = canvasTex(256, (x, s) => { x.fillStyle = '#1b1b1b'; x.fillRect(0, 0, s, s); x.fillStyle = '#d9a400'; for (let i = -s; i < s * 2; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 0); x.lineTo(i + 32 - s, s); x.lineTo(i - s, s); x.fill(); } grain(x, s, null, .25, 2500); });
export const texScratch = canvasTex(256, (x, s) => { grain(x, s, '#9a9a9a', .3, 4000); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; for (let i = 0; i < 60; i++) { x.beginPath(); const a = Math.random() * s, b = Math.random() * s; x.moveTo(a, b); x.lineTo(a + rnd(-40, 40), b + rnd(-10, 10)); x.stroke(); } });
const texValla = canvasTex(128, (x, s) => { x.clearRect(0, 0, s, s); x.strokeStyle = 'rgba(170,175,180,1)'; x.lineWidth = 3; for (let i = -s; i < s * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, s); x.stroke(); x.beginPath(); x.moveTo(i, s); x.lineTo(i + s, 0); x.stroke(); } });
const texTejado = canvasTex(256, (x, s) => { grain(x, s, '#5c2f22', .2, 3000); x.strokeStyle = 'rgba(20,8,4,.55)'; x.lineWidth = 3; for (let j = 0; j < s; j += 24) { x.beginPath(); x.moveTo(0, j); x.lineTo(s, j); x.stroke(); for (let i = (j / 24 % 2) * 16; i < s; i += 32) { x.beginPath(); x.moveTo(i, j); x.lineTo(i, j + 24); x.stroke(); } } });
const texLona = canvasTex(256, (x, s) => { grain(x, s, '#4f5638', .22, 4000); x.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < s; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke(); } });

// ---------- Fachadas: ladrillo/enlucido real + ventanas pintadas encima ----------
// color (sRGB), relieve (normal), rugosidad (cristal brillante) y emisivo (ventanas encendidas) comparten
// el mismo reparto de ventanas. El lienzo se pinta con colores planos y se rehace al llegar las fotos.
function cargaImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
function fachada({ dif, nor, tinte, marco, cols, filas, prob, rep = 4, w = 1024, wn = 512, comparte = null }) {
  const [bc, bx] = cv2d(w, w), [ec, ex] = comparte ? [null, null] : cv2d(512, 512), [nc, nx] = comparte ? [null, null] : cv2d(wn, wn), [rc, rx] = comparte ? [null, null] : cv2d(256, 256);
  const huecos = comparte ? comparte.huecos : [];
  if (!comparte) {
    const cw = 1 / cols, ch = 1 / filas;
    for (let i = 0; i < cols; i++) for (let j = 0; j < filas; j++) huecos.push({ X: i * cw + cw * .22, Y: j * ch + ch * .2, W: cw * .56, H: ch * .58, luz: Math.random() < prob ? (Math.random() < .75 ? '#ffb468' : '#9fd2ff') : null, cortina: Math.random() });
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 512, 512);
    for (const h of huecos) if (h.luz) { const s = 512, g = ex.createRadialGradient((h.X + h.W * rnd(.3, .7)) * s, (h.Y + h.H * .25) * s, 2, (h.X + h.W / 2) * s, (h.Y + h.H / 2) * s, h.W * s * .9); g.addColorStop(0, h.luz); g.addColorStop(1, h.luz === '#ffb468' ? '#5a2c0c' : '#1c3450'); ex.fillStyle = g; ex.fillRect(h.X * s, h.Y * s, h.W * s, h.H * s); ex.fillStyle = 'rgba(0,0,0,.35)'; ex.fillRect(h.X * s, (h.Y + h.H * rnd(.55, .8)) * s, h.W * s * rnd(.3, .8), h.H * s); ex.fillStyle = 'rgba(0,0,0,.5)'; ex.fillRect(h.X * s + h.W * s / 2 - 2, h.Y * s, 4, h.H * s); if (h.cortina < .4) { ex.fillStyle = 'rgba(0,0,0,.55)'; ex.fillRect(h.X * s, h.Y * s, h.W * s * h.cortina * 1.6, h.H * s); } }
  }
  const map = toTex(bc), em = comparte ? comparte.em : toTex(ec);
  const nm = comparte ? comparte.nm : toTex(nc); if (!comparte) nm.colorSpace = THREE.NoColorSpace;
  const rm = comparte ? comparte.rm : toTex(rc); if (!comparte) rm.colorSpace = THREE.NoColorSpace;
  const pintar = (x, s, img, plano, f) => {
    if (img) { const t = s / rep; for (let i = 0; i < rep; i++) for (let j = 0; j < rep; j++) x.drawImage(img, i * t, j * t, t, t); } else { x.fillStyle = plano; x.fillRect(0, 0, s, s); }
    f(x, s);
  };
  const ventanas = (x, s, cMarco, cCristal, cRefl, cornisa) => {
    for (let j = 1; j <= filas; j++) { x.fillStyle = cornisa; x.fillRect(0, j / filas * s - s * .012, s, s * .018); }
    for (const h of huecos) { const X = h.X * s, Y = h.Y * s, W = h.W * s, H = h.H * s, b = s * .01;
      x.fillStyle = cMarco; x.fillRect(X - b, Y - b, W + 2 * b, H + 2 * b); x.fillRect(X - b * 2, Y + H, W + b * 4, b * 1.6);
      x.fillStyle = cCristal; x.fillRect(X, Y, W, H); if (cRefl) { x.fillStyle = cRefl; x.fillRect(X, Y, W, H * .35); }
      x.fillStyle = cMarco; x.fillRect(X + W / 2 - b * .5, Y, b, H); }
  };
  const rehacer = (iDif, iNor) => {
    pintar(bx, w, iDif, '#7a7266', (x, s) => {
      if (tinte) { x.globalCompositeOperation = 'multiply'; x.fillStyle = tinte; x.fillRect(0, 0, s, s); x.globalCompositeOperation = 'source-over'; }
      ventanas(x, s, marco, '#10151c', 'rgba(140,165,190,.14)', 'rgba(205,200,190,.85)');
      grain(x, s, null, .08, 4000);
    }); map.needsUpdate = true;
    if (!comparte) {
      pintar(nx, wn, iNor, 'rgb(128,128,255)', (x, s) => ventanas(x, s, 'rgb(128,128,255)', 'rgb(128,128,255)', null, 'rgb(128,160,235)')); nm.needsUpdate = true;
      rx.fillStyle = 'rgb(220,220,220)'; rx.fillRect(0, 0, 256, 256); ventanas(rx, 256, 'rgb(140,140,140)', 'rgb(18,18,18)', null, 'rgb(190,190,190)'); rm.needsUpdate = true;
    }
  };
  rehacer(null, null);
  Promise.all([cargaImg(TEXR + dif + '_diff.webp'), comparte ? null : cargaImg(TEXR + (nor || dif) + '_nor_gl.webp')]).then(([a, b]) => rehacer(a, b));
  return { map, em, nm, rm, huecos };
}
const fBld = fachada({ dif: 'red_brick_03', tinte: '#b9a89a', marco: '#3e3a35', cols: 4, filas: 4, prob: .42, rep: 3 });
const fCasa = fachada({ dif: 'painted_plaster_wall', tinte: '#e6d7bb', marco: '#efe9dc', cols: 2, filas: 2, prob: .5, rep: 2, w: 512 }); // casas: 2×2 huecos, 512 basta (−4 MB cada una)
const fCasa2 = fachada({ dif: 'painted_plaster_wall', tinte: '#a9b6bd', marco: '#dcdcd4', cols: 2, filas: 2, rep: 2, w: 512, comparte: fCasa });
// ---------- Lienzos horneados a KTX2 (memoria de texturas) ----------
// Los lienzos grandes y estáticos (fachadas, atlas de rótulos) se hornean una vez a assets/texturas/lienzos/<id>.ktx2
// (ver PLAN §9, comando con toktx). Si el .ktx2 existe, sus datos sustituyen a los del lienzo en la MISMA textura
// (comprimida en la GPU: ~1 B/px en vez de 4 + mipmaps); si no, se queda el lienzo. ?lienzos=0 los ignora.
const LIENZOS = new Map(), SIN_KTX = new URLSearchParams(location.search).get('lienzos') === '0';
export function hornearLienzo(t, id) {
  if (LIENZOS.has(id)) return t; LIENZOS.set(id, { t, c: t.image });
  if (!SIN_KTX) ktx2.load(TEXR + 'lienzos/' + id + '.ktx2', k => { const cs = t.colorSpace;
    Object.assign(t, { isCompressedTexture: true, image: k.image, mipmaps: k.mipmaps, format: k.format, type: k.type, generateMipmaps: false, flipY: false, minFilter: k.minFilter, magFilter: THREE.LinearFilter });
    t.colorSpace = cs; t.needsUpdate = true; k.dispose(); }, undefined, () => {});
  return t;
}
// depuración: manda cada lienzo registrado (volteado: el .ktx2 va con flipY=false) como PNG a un receptor local
window.__exportarLienzos = async (url = 'http://127.0.0.1:8799/') => { const r = [];
  for (const [id, { c }] of LIENZOS) { const [o, x] = cv2d(c.width, c.height); x.translate(0, c.height); x.scale(1, -1); x.drawImage(c, 0, 0);
    const b = await new Promise(res => o.toBlob(res, 'image/png')); await fetch(url + id + '.png', { method: 'POST', body: b }); r.push(id + ' ' + c.width + '×' + c.height); }
  return r; };
for (const [n, f] of [['bld', fBld], ['casa', fCasa]]) for (const k of ['map', 'em', 'nm', 'rm']) hornearLienzo(f[k], `fachada_${n}_${k}`);
hornearLienzo(fCasa2.map, 'fachada_casa2_map');
const facMat = (f, o = {}) => std({ map: f.map, normalMap: f.nm, roughnessMap: f.rm, roughness: 1, metalness: 0, emissiveMap: f.em, emissive: 0xffffff, emissiveIntensity: 1.2, ...o });

export const glow = (c, i) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i });
export const std = o => new THREE.MeshStandardMaterial(o);
export const M = {
  asphalt: matAsfalto,
  concrete: pbr('concrete_floor_worn_001', { rep: .9, macro: .3 }),
  tierra: matTierra,
  cerro: pbr('aerial_grass_rock', { rep: 1, color: 0x9a9a8a, sinArm: true, roughness: .95 }),
  lab: pbr('corrugated_iron_02', { rep: 1.5, color: 0xb4bcc4, macro: .25 }),
  labIn: std({ map: texPanelIn, normalMap: tex('painted_plaster_wall_nor_gl', false, 1), normalScale: new THREE.Vector2(.35, .35), roughness: .62, metalness: .05 }),
  tiles: pbr('floor_tiles_06', { rep: 1, color: 0xdfe4e8, macro: .15, roughness: .38 }), // pulido: refleja las lámparas de la sala
  tilesGastado: pbr('worn_tile_floor', { rep: 1, macro: .2 }),
  crate: std({ map: texCrate, normalMap: tex('rough_wood_nor_gl', false, 1), roughness: .75, metalness: .15 }),
  dark: std({ color: 0x15171b, roughness: .55, metalness: .6, roughnessMap: texScratch }),
  steel: std({ color: 0x7a8088, roughness: .4, metalness: .9, roughnessMap: texScratch, normalMap: tex('metal_plate_nor_gl', false, .5), normalScale: new THREE.Vector2(.4, .4) }),
  rust: pbr('rusty_metal_02', { rep: 1, color: 0x6e5e56 }),
  wood: pbr('rough_wood', { rep: 1, color: 0xc0a080 }),
  puddle: std({ color: 0x07090c, roughness: .04, metalness: .95 }),
  hazard: std({ map: texHazard, normalMap: tex('concrete_floor_worn_001_nor_gl', false, 1), roughness: .75 }),
  bld: facMat(fBld),
  bld2: facMat(fBld, { color: 0xa8b0bc }),
  casa: facMat(fCasa, { emissiveIntensity: 1 }),
  casa2: facMat(fCasa2, { emissiveMap: fCasa.em, emissiveIntensity: 1 }),
  pared: pbr('white_plaster_02', { rep: .45, color: 0xfff8ee, normalScale: .3, macro: .1, roughness: .9 }),
  suelo: pbr('laminate_floor_02', { rep: 1, macro: .12 }),
  tejado: std({ map: texTejado, normalMap: tex('red_brick_03_nor_gl', false, 1), roughness: .85 }),
  valla: std({ map: texValla, alphaTest: .5, side: THREE.DoubleSide, roughness: .5, metalness: .6 }),
  oliva: std({ color: 0x4a5236, roughness: .75, metalness: .2, normalMap: tex('metal_plate_nor_gl', false, .5) }),
  lona: std({ map: texLona, roughness: .95, side: THREE.DoubleSide }),
  cristal: std({ color: 0xdff4ff, transparent: true, opacity: .16, roughness: .05, metalness: .2, depthWrite: false }),
  line: new THREE.MeshStandardMaterial({ color: 0xd8d4c4, transparent: true, opacity: .8, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  // atrezo urbano
  bolsa: std({ color: 0x0c0d0f, roughness: .28, metalness: 0 }),
  goma: std({ color: 0x18181a, roughness: .92 }),
  cono: std({ color: 0xe0561a, roughness: .55, emissive: 0x401000, emissiveIntensity: .2 }),
  tapa: pbr('metal_plate', { rep: 1, color: 0x6a6460 }),
  poste: pbr('rough_wood', { rep: 1, color: 0x6a5a48 }),
  cable: std({ color: 0x0a0a0a, roughness: .6 }),
  // interiores y decorado (los de vertexColors comparten material: el color va en cada vértice → menos llamadas)
  azulejo: pbr('long_white_tiles', { rep: 1, color: 0xf4f1ea }),
  cuero: pbr('fabric_leather_02', { rep: 1.5 }),
  tela: std({ vertexColors: true, normalMap: tex('book_pattern_nor_gl', false, 2), roughnessMap: tex('book_pattern_arm', false, 2), roughness: 1, metalness: 0 }),
  mantel: pbr('fabric_pattern_07', { rep: 2, side: THREE.DoubleSide }),
  alfombra: std({ map: canvasTex(512, (x, s) => { // alfombra de dibujo clásico (lienzo) con el relieve de una moqueta real
    x.fillStyle = '#7a2420'; x.fillRect(0, 0, s, s); x.strokeStyle = '#d8b878'; x.lineWidth = 10; x.strokeRect(18, 18, s - 36, s - 36); x.strokeStyle = '#1e2a4a'; x.lineWidth = 22; x.strokeRect(44, 44, s - 88, s - 88);
    x.fillStyle = '#1e2a4a'; x.beginPath(); x.moveTo(s / 2, 110); x.lineTo(s - 120, s / 2); x.lineTo(s / 2, s - 110); x.lineTo(120, s / 2); x.closePath(); x.fill(); x.fillStyle = '#d8b878'; x.beginPath(); x.moveTo(s / 2, 170); x.lineTo(s - 180, s / 2); x.lineTo(s / 2, s - 170); x.lineTo(180, s / 2); x.closePath(); x.fill();
    x.fillStyle = '#7a2420'; x.beginPath(); x.arc(s / 2, s / 2, 40, 0, 7); x.fill(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.fillStyle = i % 2 ? '#d8b878' : '#2a5a4a'; x.beginPath(); x.arc(s / 2 + Math.cos(a) * 200, s / 2 + Math.sin(a) * 200, 9, 0, 7); x.fill(); }
    grain(x, s, null, .25, 20000); }, false), normalMap: tex('dirty_carpet_nor_gl', false, 3), roughness: 1 }),
  mueble: pbr('wood_cabinet_worn_long', { rep: 1 }),
  madMesa: pbr('wood_table_001', { rep: 1 }),
  techo: std({ color: 0xf2eee6, roughness: .95, normalMap: tex('white_plaster_02_nor_gl', false, 1), normalScale: new THREE.Vector2(.25, .25), emissive: 0x16130f }), // enlucido liso (rebote de luz falso)
  techoLab: std({ map: canvasTex(256, (x, s) => { grain(x, s, '#e9ebec', .05, 3000); for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(80,90,100,.35)'; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); } x.strokeStyle = '#9aa2aa'; x.lineWidth = 6; x.strokeRect(0, 0, s, s); }), roughness: .9, emissive: 0x1a1c1e }), // placas acústicas 0,6 m
  persiana: pbr('painted_metal_shutter', { rep: 1 }),
  acera: pbr('large_grey_tiles', { rep: .5, macro: .25 }),
  chapa: pbr('corrugated_iron_02', { rep: 1 }),
  chapaV: std({ vertexColors: true, normalMap: tex('corrugated_iron_02_nor_gl', false, 1), roughnessMap: tex('corrugated_iron_02_arm', false, 1), roughness: 1, metalness: .35 }),
  pintado: std({ vertexColors: true, roughness: .55, metalness: 0, normalMap: tex('white_plaster_02_nor_gl', false, 1), normalScale: new THREE.Vector2(.25, .25) }),
  metalV: std({ vertexColors: true, roughness: .28, metalness: .92, roughnessMap: texScratch }),
  brillo: std({ vertexColors: true, roughness: .12, metalness: .05 }),
  pintura: std({ vertexColors: true, roughness: .3, metalness: .55, roughnessMap: texScratch }),
  vidrioCoche: std({ color: 0x18222c, transparent: true, opacity: .55, roughness: .04, metalness: .4, depthWrite: false }),
  lampara: glow(0xffe2b8, 3.2),
  neonC: glow(0x29e6ff, 4), neonR: glow(0xff2a2a, 3), sodium: glow(0xffb35a, 5), fire: glow(0xff6a1a, 5), led: glow(0x3cff6a, 4), white: glow(0xeaf4ff, 3)
};

// ---------- Etiquetas de texto en 3D ----------
export const labels = [];
export function canvasPlane(w, h, px, draw) {
  const [c, x] = cv2d(px, Math.round(px * h / w)); const t = toTex(c, false);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
  const L = { mesh, arg: null, set(a) { L.arg = a; x.clearRect(0, 0, c.width, c.height); draw(x, c.width, c.height, a); t.needsUpdate = true; } };
  labels.push(L); return L;
}
export const textDraw = (color, size, bg) => (x, w, h, a) => {
  if (bg) { x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 18); x.fill(); }
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = String(a).split('\n'), fs = size * h / Math.max(1, lines.length * .8);
  lines.forEach((ln, i) => { let z = i ? fs * .62 : fs; x.font = `700 ${z}px "Chakra Petch",sans-serif`; const mw = x.measureText(ln).width; if (mw > w * .9) { z *= w * .9 / mw; x.font = `700 ${z}px "Chakra Petch",sans-serif`; } x.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.0); });
};
// texto con salto de línea automático para paneles grandes
export function wrapText(x, text, maxW) {
  const out = []; for (const par of String(text).split('\n')) { let line = ''; for (const w of par.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); }
  return out;
}

// ---------- Capas del mundo ----------
// tierra: todo el mapa · calma/caos: estado del pueblo y del laboratorio · espacio: órbita
export const capas = { tierra: new THREE.Group(), calma: new THREE.Group(), caos: new THREE.Group(), espacio: new THREE.Group() };
capas.tierra.add(capas.calma, capas.caos); scene.add(capas.tierra, capas.espacio);
export const capOn = { tierra: true, calma: true, caos: false, espacio: false };
export function setCapa(nombre, on) {
  capas[nombre].visible = on;
  capOn.tierra = capas.tierra.visible; capOn.espacio = capas.espacio.visible;
  capOn.calma = capOn.tierra && capas.calma.visible; capOn.caos = capOn.tierra && capas.caos.visible;
  if (!on) { clearTimeout(liberarT); liberarT = setTimeout(liberarOcultas, 5000); }
}
// Memoria de texturas: lo que solo usan capas ocultas (calma/caos/espacio/tierra) se libera de la GPU a los 5 s.
// No se pierde nada: la imagen sigue en JS y three.js la vuelve a subir cuando la capa se vea otra vez.
let liberarT = 0;
const texDe = (o, f) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k in m) if (m[k]?.isTexture) f(m[k]); };
function liberarOcultas() {
  const ocultas = Object.values(capas).filter(c => !c.visible); if (!ocultas.length) return;
  const usadas = new Set(), recorrer = o => { if (ocultas.includes(o)) return; texDe(o, t => usadas.add(t)); for (const h of o.children) recorrer(h); };
  recorrer(scene); if (scene.environment) usadas.add(scene.environment);
  for (const c of ocultas) c.traverse(o => texDe(o, t => { if (!usadas.has(t)) { t.dispose(); usadas.add(t); } }));
}
setCapa('caos', false); setCapa('espacio', false);

// ---------- Construcción ----------
// B guarda la capa y el origen actuales: en('caos', 0, -113, () => {...}) construye desplazado y en esa capa.
export const B = { cap: 'tierra', ox: 0, oz: 0, zona: null };
// Zonas de decorado (interiores, manzanas): sus mallas fusionadas se ocultan cuando la cámara está lejos
// (fusionar todo el mapa en una malla impide el recorte por frustum; así cada zona se recorta sola).
export const zonas = new Map(); // nombre → { c: V3, r, mallas: [] }
export function zona(nombre, x, z, r, fn) { if (!zonas.has(nombre)) zonas.set(nombre, { c: new V3(x, 0, z), r, mallas: [] }); const p = B.zona; B.zona = nombre; try { fn(); } finally { B.zona = p; } }
export function en(cap, ox, oz, fn) { const p = { ...B }; B.cap = cap; B.ox = ox; B.oz = oz; try { fn(); } finally { Object.assign(B, p); } }
export const colliders = [];
const envPor = { tierra: [], calma: [], caos: [], espacio: [] };
export const dinamicos = []; // objetos disparables que no se fusionan (botones, puertas…)
export function markStatic(m, shoot = true) { m.userData.static = true; m.userData.shoot = shoot; m.userData.cap = B.cap; m.userData.zona = B.zona; return m; }
function scaleUV(geo, w, h, d, s) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / s, uv.getY(j) * dims[f][1] / s); }
  uv.needsUpdate = true;
}
export function addCollider(x0, x1, z0, z1, top, extra) { const c = { x0: x0 + B.ox, x1: x1 + B.ox, z0: z0 + B.oz, z1: z1 + B.oz, top, cap: B.cap, ...extra }; colliders.push(c); return c; }
export function block(x, z, w, d, h, mat, o = {}) {
  const y = o.y || 0, g = new THREE.BoxGeometry(w, h, d); scaleUV(g, w, h, d, o.s || 2);
  const m = new THREE.Mesh(g, mat);
  if (o.par) m.position.set(x, y + h / 2, z); else m.position.set(x + B.ox, y + h / 2, z + B.oz);
  if (o.ry) m.rotation.y = o.ry;
  m.castShadow = o.cast !== false; m.receiveShadow = true; (o.par || capas[B.cap]).add(m);
  if (!o.par) markStatic(m, o.shoot !== false);
  if (o.collide !== false && !o.par) addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h);
  return m;
}
export function cyl(x, z, r, h, mat, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, o.r2 ?? r, h, o.seg || 16), mat); m.position.set(x + B.ox, (o.y || 0) + h / 2, z + B.oz);
  m.castShadow = o.cast !== false; m.receiveShadow = true; capas[B.cap].add(m); markStatic(m, o.shoot !== false);
  if (o.collide !== false) addCollider(x - r, x + r, z - r, z + r, (o.y || 0) + h);
  return m;
}
export function flat(x, z, w, d, mat, y = .012, ry = 0, us = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  if (us) { const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / us, uv.getY(i) * d / us); }
  m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x + B.ox, y, z + B.oz); m.receiveShadow = true; capas[B.cap].add(m); return markStatic(m, false);
}
// pieza suelta (malla ya creada) colocada en coordenadas locales de la obra actual
export function pieza(m, x, y, z, o = {}) { m.position.set(x + B.ox, y, z + B.oz); if (o.ry) m.rotation.y = o.ry; m.castShadow = o.cast !== false; m.receiveShadow = true; capas[B.cap].add(m); if (o.static !== false) markStatic(m, o.shoot !== false); return m; }
export function rampH(c, x, z) { let t = c.axis === 'z' ? (z - c.z0) / (c.z1 - c.z0) : (x - c.x0) / (c.x1 - c.x0); if (c.up < 0) t = 1 - t; return c.top * clamp(t, 0, 1); }
export function ramp(x0, x1, z0, z1, h, axis, up, mat = M.hazard) {
  addCollider(x0, x1, z0, z1, h, { ramp: true, axis, up });
  const L = axis === 'z' ? z1 - z0 : x1 - x0, W = axis === 'z' ? x1 - x0 : z1 - z0, ang = Math.atan2(h, L), len = Math.hypot(L, h);
  const m = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? W : len, .22, axis === 'z' ? len : W), mat);
  m.position.set((x0 + x1) / 2 + B.ox, h / 2 - .1, (z0 + z1) / 2 + B.oz);
  if (axis === 'z') m.rotation.x = up > 0 ? -ang : ang; else m.rotation.z = up > 0 ? ang : -ang;
  m.castShadow = m.receiveShadow = true; capas[B.cap].add(m); markStatic(m);
}
export const crate = (x, z, s, y = 0) => block(x, z, s, s, s, M.crate, { y, s });

// ---------- Colisiones ----------
export const BOUNDS = { x0: -95, x1: 182, z0: -178, z1: 108 };
const activo = c => capOn[c.cap];
export function collideCircle(p, r, feetY) {
  let moved = false;
  for (const c of colliders) {
    if (c.ramp || !activo(c) || feetY >= c.top - .05) continue;
    const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue; moved = true;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else { const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === t) p.z = c.z0 - r; else p.z = c.z1 + r; }
  }
  if (!G.enEspacio) {
    const bx0 = BOUNDS.x0 + r, bx1 = BOUNDS.x1 - r, bz0 = BOUNDS.z0 + r, bz1 = BOUNDS.z1 - r;
    if (p.x < bx0 || p.x > bx1 || p.z < bz0 || p.z > bz1) moved = true;
    p.x = clamp(p.x, bx0, bx1); p.z = clamp(p.z, bz0, bz1);
  }
  return moved;
}
export function groundAt(x, z, feetY, r = .2) { let g = 0; for (const c of colliders) if (activo(c) && x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) { const t = c.ramp ? rampH(c, x, z) : c.top; if (t <= feetY + .45 && t > g) g = t; } return g; }
export function rampGround(x, z, r = .4) { let g = 0; for (const c of colliders) if (c.ramp && activo(c) && x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) { const t = rampH(c, x, z); if (t > g) g = t; } return g; }
export function dentroDeSolido(x, z, y) { for (const c of colliders) if (!c.ramp && activo(c) && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y < c.top) return true; return false; }
// mallas contra las que chocan los disparos (solo las de capas visibles)
export function envActivo() { const t = []; for (const k in envPor) if (capOn[k]) for (const m of envPor[k]) t.push(m); for (const m of dinamicos) if (m.visible) t.push(m); return t; }

// ---------- Fusión de geometría estática (menos llamadas de dibujo en las Quest) ----------
export function hornear() {
  scene.updateMatrixWorld(true);
  for (const cap in capas) {
    const root = capas[cap], groups = new Map(), list = [];
    for (const ch of root.children) ch.traverse(o => { if (o.isMesh && o.userData.static && o.userData.cap === cap) list.push(o); });
    for (const m of list) { const k = m.material.uuid + '|' + (m.castShadow ? 1 : 0) + '|' + (m.userData.shoot ? 1 : 0) + '|' + (m.userData.zona || '') + '|' + (m.userData.lm || '') /* lm: receptor de luz horneada (mundo/horneado.js) */; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    for (const arr of groups.values()) {
      const zn = arr[0].userData.zona, Z = zn && zonas.get(zn);
      if (arr.length < 2) { if (arr[0].userData.shoot) envPor[cap].push(arr[0]); if (Z) Z.mallas.push(arr[0]); continue; }
      const vc = !!arr[0].material.vertexColors, keep = vc ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
      const geos = arr.map(m => { let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!keep.includes(a)) g.deleteAttribute(a); const n = g.attributes.position.count; if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); if (vc && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3)); g.morphAttributes = {}; return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); });
      const merged = BGU.mergeGeometries(geos, false); geos.forEach(g => g.dispose());
      if (!merged) { for (const m of arr) if (m.userData.shoot) envPor[cap].push(m); continue; }
      const mm = new THREE.Mesh(merged, arr[0].material); mm.castShadow = arr[0].castShadow; mm.receiveShadow = true; mm.userData.cap = cap; mm.userData.zona = zn; mm.userData.lm = arr[0].userData.lm; root.add(mm); if (Z) Z.mallas.push(mm);
      if (arr[0].userData.shoot) envPor[cap].push(mm);
      for (const m of arr) m.removeFromParent();
    }
  }
}

// Fusiona por material las mallas HIJAS DIRECTAS de un grupo que se mueve entero (p. ej. la carrocería de la pickup):
// una llamada por material en vez de una por pieza. Solo mallas sin hijos y que nadie más referencia.
export function fundirHijos(par, excluir = new Set()) {
  const grupos = new Map();
  for (const m of [...par.children]) {
    if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.children.length || excluir.has(m) || Array.isArray(m.material)) continue;
    const k = m.material.uuid + '|' + m.castShadow; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(m);
  }
  for (const arr of grupos.values()) {
    if (arr.length < 2) continue;
    const geos = arr.map(m => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g.applyMatrix4(m.matrix); });
    const merged = BGU.mergeGeometries(geos, false); geos.forEach(g => g.dispose()); if (!merged) continue;
    const mm = new THREE.Mesh(merged, arr[0].material); mm.castShadow = arr[0].castShadow; mm.receiveShadow = arr[0].receiveShadow; par.add(mm);
    for (const m of arr) m.removeFromParent();
  }
}

// ---------- Recorte por niebla y por tamaño (menos llamadas sin perder nada visible) ----------
// 1) Niebla: la niebla lineal deja en color de niebla todo lo que está a más de fog.far de PROFUNDIDAD de vista; a ras
//    de suelo (niebla de altura ≈ 1) eso es invisible, pero three lo seguía dibujando (cámara far 330): de noche (far 62)
//    los trastos físicos, camiones y robots de la base/lab a 80-200 m costaban ~250 llamadas. Se descarta lo que está
//    entero más allá de fog.far + margen y cuya caja no pasa de lejania.alto (lo alto asoma sobre la niebla de altura).
//    Respeta material.fog === false (luna, shaders del cielo).
// 2) Detalle: la pieza suelta (no estática) que ocupa menos de ~2-3 px (radio < detalle × distancia) no se dibuja
//    (botones, tornillos y trastos pequeños del interior de la pickup, cajones lejanos...).
// Solo durante el render principal (main.js activa lejania.on; también vale para su sombra) y nunca con
// userData.sinLejania. Las cámaras del lab y demás render a textura no se ven afectadas.
export const lejania = { on: false, c: new V3(), f: new V3(0, 0, -1), margen: 5, alto: 3.5, detalle: .0025 };
{
  const _s = new THREE.Sphere(), _b = new THREE.Box3(), base = THREE.Frustum.prototype.intersectsObject;
  const conNiebla = m => (Array.isArray(m) ? m.every(x => x.fog !== false) : m && m.fog !== false);
  THREE.Frustum.prototype.intersectsObject = function (o) {
    if (!lejania.on || o.userData.sinLejania) return base.call(this, o);
    const g = o.geometry;
    if (o.boundingSphere !== undefined) { if (o.boundingSphere === null) o.computeBoundingSphere(); _s.copy(o.boundingSphere); }
    else { if (!g) return base.call(this, o); if (g.boundingSphere === null) g.computeBoundingSphere(); _s.copy(g.boundingSphere); }
    _s.applyMatrix4(o.matrixWorld);
    const C = lejania.c, dx = _s.center.x - C.x, dy = _s.center.y - C.y, dz = _s.center.z - C.z;
    if (!o.userData.static && _s.radius * _s.radius < lejania.detalle * lejania.detalle * (dx * dx + dy * dy + dz * dz)) return false;
    const F = scene.fog;
    if (F && F.far < 500 && dx * lejania.f.x + dy * lejania.f.y + dz * lejania.f.z - _s.radius > F.far + lejania.margen && conNiebla(o.material)) {
      let top = _s.center.y + _s.radius;
      if (top >= lejania.alto && o.boundingSphere === undefined && g) { if (g.boundingBox === null) g.computeBoundingBox(); top = _b.copy(g.boundingBox).applyMatrix4(o.matrixWorld).max.y; }
      if (top < lejania.alto) return false;
    }
    return this.intersectsSphere(_s);
  };
}

// ---------- Cielo y hora del día ----------
// Domo procedural: degradado + sol/halo + halo de luna + Vía Láctea + resplandor de la ciudad/incendios en el
// horizonte + capa de nubes (amanecer/atardecer y noches nubladas) + nebulosa (espacio). Todo en un shader,
// una sola llamada de dibujo. Las estrellas son Points con tamaño, color y centelleo propios.
const RUIDO_SKY = `
float hs(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hs(i), hs(i + vec3(1,0,0)), f.x), mix(hs(i + vec3(0,1,0)), hs(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hs(i + vec3(0,0,1)), hs(i + vec3(1,0,1)), f.x), mix(hs(i + vec3(0,1,1)), hs(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ return n3(p) * .5 + n3(p * 2.1 + 3.1) * .27 + n3(p * 4.3 + 7.7) * .15 + n3(p * 8.7 + 1.3) * .08; }
`;
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunD: { value: new V3(0, 1, 0) }, sunC: { value: new THREE.Color() }, sunVis: { value: 0 },
    moonD: { value: new V3(0, 1, 0) }, moonVis: { value: 0 }, galN: { value: new V3(.35, .55, .76).normalize() }, milky: { value: 0 }, nebula: { value: 0 },
    glowC: { value: new THREE.Color(0xff7a3a) }, glowD: { value: new V3(-1, 0, -.3).normalize() }, glowAmt: { value: 0 }, cityC: { value: new THREE.Color(0xffa860) }, cityAmt: { value: 0 },
    nubes: { value: 0 }, nubeC: { value: new THREE.Color() }, uTime: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top, bot, sunD, sunC, moonD, galN, glowC, glowD, cityC, nubeC; uniform float sunVis, moonVis, milky, nebula, glowAmt, cityAmt, nubes, uTime; varying vec3 vP;
${RUIDO_SKY}
void main(){
  vec3 d = normalize(vP); float h = clamp(d.y * 1.6 + .12, 0.0, 1.0);
  vec3 col = mix(bot, top, pow(h, .8));
  float sd = max(dot(d, sunD), 0.0); col += sunC * sunVis * (pow(sd, 6.0) * .45 + pow(sd, 60.0) * .6 + smoothstep(.9994, .9997, sd) * 6.0);
  float md = max(dot(d, moonD), 0.0); col += vec3(.55, .65, .85) * moonVis * (pow(md, 40.0) * .18 + pow(md, 400.0) * .3);
  // Vía Láctea: banda alrededor de un gran círculo con polvo oscuro
  float band = 1.0 - abs(dot(d, galN)); float mw = pow(band, 7.0) * (.4 + .9 * fbm3(d * 6.0)) * (1.0 - .7 * smoothstep(.55, .75, fbm3(d * 11.0 + 4.0)) * pow(band, 12.0));
  col += vec3(.55, .6, .75) * mw * milky * smoothstep(-.05, .25, d.y + nebula);
  // nebulosa del espacio
  if (nebula > 0.0) { float nb = fbm3(d * 2.5 + 9.0); col += (vec3(.25, .05, .35) * smoothstep(.45, .8, nb) + vec3(.02, .1, .25) * smoothstep(.5, .9, fbm3(d * 4.0 + 2.0))) * nebula; }
  // horizonte: resplandor de la ciudad (alrededor) e incendios (en una dirección)
  float hz = exp(-max(d.y, 0.0) * 9.0) * step(-.08, d.y);
  col += cityC * hz * cityAmt + glowC * hz * glowAmt * pow(max(dot(normalize(d.xz + 1e-4), normalize(glowD.xz)), 0.0), 3.0);
  // nubes proyectadas sobre un plano alto (se mueven con el tiempo)
  if (nubes > 0.0 && d.y > 0.0) { vec2 uv = d.xz / (d.y + .12) * .55 + vec2(uTime * .004, uTime * .0015);
    float n = fbm3(vec3(uv * 1.6, uTime * .01)); float c = smoothstep(.48, .78, n) * nubes * smoothstep(0.0, .18, d.y);
    vec3 cc = mix(nubeC * .55, nubeC + sunC * sunVis * .8 * pow(sd, 3.0), smoothstep(.5, .85, n)) + vec3(.4, .45, .55) * moonVis * pow(md, 6.0) * .5;
    col = mix(col, cc, c); }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`
});
export const sky = new THREE.Mesh(new THREE.SphereGeometry(210, 32, 20), skyMat); sky.renderOrder = -10; scene.add(sky);
export const cielo = { U: skyMat.uniforms }; // la atmósfera toca sus uniformes (nubes, incendio, resplandor)
// estrellas: magnitudes variadas (muchas tenues, pocas brillantes), color según temperatura, centelleo suave;
// el 35 % se concentran en la banda de la Vía Láctea
const starMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uPx: { value: 1 }, uSuelo: { value: 1 } },
  vertexShader: 'attribute float tam; attribute float fase; attribute vec3 col; uniform float uTime, uPx, uSuelo; varying vec3 vC; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float tw = .75 + .25 * sin(uTime * (1.5 + fase) + fase * 20.0); vC = col; vA = tw * mix(1.0, smoothstep(-.02, .12, normalize(position).y), uSuelo); gl_PointSize = tam * uPx; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform float uAlpha; varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); float a = smoothstep(.5, .0, r); a = a * a; gl_FragColor = vec4(vC * a * vA * uAlpha, 1.0); }'
});
function starField(n, yMin, yMax) {
  const g = new THREE.BufferGeometry(), a = [], tam = [], fase = [], col = [], galN = skyMat.uniforms.galN.value, t = new V3(), u = new V3();
  t.set(1, 0, 0).cross(galN).normalize(); u.copy(galN).cross(t);
  for (let i = 0; i < n; i++) {
    let v; if (Math.random() < .35) { const ang = rnd(0, Math.PI * 2); v = t.clone().multiplyScalar(Math.cos(ang)).addScaledVector(u, Math.sin(ang)).addScaledVector(galN, rnd(-.12, .12) * rnd(0, 1)); }
    else v = new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
    v.normalize(); if (v.y < yMin || v.y > yMax) { i--; continue; } v.multiplyScalar(200); a.push(v.x, v.y, v.z);
    const m = Math.pow(Math.random(), 3.2); tam.push(1.2 + m * 4.2); fase.push(Math.random() * 3);
    const k = Math.random(); const c = k < .15 ? [1, .78, .6] : k < .3 ? [.7, .8, 1] : [.95, .95, 1]; const b = .35 + m * 1.4; col.push(c[0] * b, c[1] * b, c[2] * b);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.setAttribute('tam', new THREE.Float32BufferAttribute(tam, 1)); g.setAttribute('fase', new THREE.Float32BufferAttribute(fase, 1)); g.setAttribute('col', new THREE.Float32BufferAttribute(col, 3));
  const p = new THREE.Points(g, starMat); p.frustumCulled = false; sky.add(p); return p;
}
const starsUp = starField(2600, .02, 1), starsDown = starField(2200, -1, .02);
// luna con cráteres (lienzo) y halo aditivo
const moonTex = canvasTex(256, (x, s) => { const g = x.createRadialGradient(s * .45, s * .4, 10, s / 2, s / 2, s / 2); g.addColorStop(0, '#f4f2ea'); g.addColorStop(1, '#b8b8b0'); x.fillStyle = g; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(90,95,105,${rnd(.15, .35)})`; x.beginPath(); x.ellipse(rnd(40, 216), rnd(40, 216), rnd(18, 55), rnd(14, 45), rnd(0, 3), 0, 7); x.fill(); }
  for (let i = 0; i < 70; i++) { const r = rnd(2, 9), cx = rnd(10, 246), cy = rnd(10, 246); x.strokeStyle = 'rgba(70,70,75,.35)'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); x.fillStyle = 'rgba(255,255,250,.18)'; x.beginPath(); x.arc(cx - r * .3, cy - r * .3, r * .6, 0, 7); x.fill(); } }, false);
const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 28, 18), new THREE.MeshBasicMaterial({ map: moonTex, color: 0xe8eef8, fog: false })); sky.add(moon);
const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(200,215,255,.55)'); g.addColorStop(.2, 'rgba(160,180,235,.22)'); g.addColorStop(1, 'rgba(120,140,200,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, false), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
moonHalo.scale.setScalar(70); moon.add(moonHalo);
export const hemi = new THREE.HemisphereLight(0x3a4878, 0x0c0b10, .45); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0x8fb0ff, 1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 140 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
export const sunDir = new V3();
// hdri: entorno de reflejos/luz ambiente (Poly Haven 1K) · bg: usar el HDRI desenfocado como cielo (solo de día)
export const TIMES = {
  noche: { n: 'noche', top: 0x050a1c, bot: 0x161b2a, fog: 0x0d121d, fn: 5, ff: 62, sun: 0x7f9fff, si: .75, sp: [-14, 24, 10], ht: 0x2a3a6a, hg: 0x0a0a0e, hi: .44, exp: 1.44, lamp: 1, stars: 1, env: .62, win: 1.5, hdri: 'dikhololo_night', rotE: 0, wet: 1, sv: 0, mv: 1, milky: .9, nubes: .35, nubeC: 0x1a2030, ciudad: .22, incendio: 0 },
  atardecer: { n: 'atardecer', top: 0x2d3a6b, bot: 0xff8a4a, fog: 0x7a5a5a, fn: 14, ff: 110, sun: 0xffa060, si: 2.8, sp: [-30, 7, -14], ht: 0x8a78a8, hg: 0x3a2618, hi: .45, exp: .95, lamp: .6, stars: 0, env: .7, win: .7, hdri: 'venice_sunset', rotE: 2.2, wet: .2, sv: 1, mv: 0, milky: 0, nubes: .55, nubeC: 0x6a5a78, ciudad: .05, incendio: 0 },
  amanecer: { n: 'amanecer', top: 0x3a4a7a, bot: 0xffb07a, fog: 0x8f7a74, fn: 14, ff: 110, sun: 0xffc090, si: 2.4, sp: [32, 8, 18], ht: 0x9a90b8, hg: 0x3a2a20, hi: .45, exp: .95, lamp: .45, stars: 0, env: .65, win: .6, hdri: 'kiara_1_dawn', rotE: -.6, wet: .45, sv: 1, mv: 0, milky: 0, nubes: .5, nubeC: 0x8a7a90, ciudad: 0, incendio: 0 },
  dia: { n: 'día', top: 0x5d9be0, bot: 0xcfe2f2, fog: 0xb4c2cc, fn: 30, ff: 160, sun: 0xfff1dc, si: 3, sp: [12, 30, 8], ht: 0xc8dcff, hg: 0x6a5a48, hi: .6, exp: .9, lamp: .12, stars: 0, env: 1, win: .04, hdri: 'kloofendal_overcast_puresky', bg: .35, bgI: 1, rotE: 0, wet: 0, sv: .6, mv: 0, milky: 0, nubes: .4, nubeC: 0xe8ecf0, ciudad: 0, incendio: 0 },
  espacio: { n: 'espacio', top: 0x010208, bot: 0x02040c, fog: 0x000000, fn: 900, ff: 1000, sun: 0xffffff, si: 3.4, sp: [40, 20, 30], ht: 0x334466, hg: 0x000000, hi: .15, exp: 1.1, lamp: 0, stars: 2, env: .25, win: 0, hdri: 'dikhololo_night', rotE: 0, wet: 0, sv: 0, mv: 0, milky: 1.2, nebula: 1, nubes: 0, nubeC: 0, ciudad: 0, incendio: 0 }
};
// HDRI → PMREM, con caché (se cargan solo cuando hace falta cada hora)
const hdriCache = new Map(), rgbe = new RGBELoader(); let salaLibre = false;
// el HDRI 1K se reduce a 512×256 antes del PMREM: mapa de entorno 384×512 (1,5 MB) en vez de 768×1024 (6 MB);
// los reflejos ya son borrosos y de noche apenas se notan
function mitadHDR(t) {
  const { data: d, width: w, height: h } = t.image; if (!(d instanceof Uint16Array) || w < 1024) return;
  const W = w >> 1, H = h >> 1, o = new Uint16Array(W * H * 4), f = THREE.DataUtils.fromHalfFloat;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = ((y * 2) * w + x * 2) * 4, b = a + w * 4, k = (y * W + x) * 4;
    for (let c = 0; c < 4; c++) o[k + c] = THREE.DataUtils.toHalfFloat((f(d[a + c]) + f(d[a + 4 + c]) + f(d[b + c]) + f(d[b + 4 + c])) * .25); }
  t.image = { data: o, width: W, height: H }; t.needsUpdate = true;
}
function cargarHDRI(id) {
  if (!hdriCache.has(id)) hdriCache.set(id, new Promise(res => rgbe.load('assets/hdri/' + id + '_1k.hdr', t => { mitadHDR(t); const e = pmrem.fromEquirectangular(t).texture; t.dispose();
    if (!salaLibre) { salaLibre = true; salaRT.dispose(); envSala = e; } /* la sala de reserva (6 MB) sobra en cuanto hay un HDRI */ res(e); }, undefined, () => res(null))));
  return hdriCache.get(id);
}
function ponerEntorno(T) {
  cargarHDRI(T.hdri).then(e => {
    if (TIMES[G.hora] !== T) return;
    scene.environment = e || envSala; scene.environmentRotation.y = T.rotE || 0;
    if (T.bg && e) { scene.background = e; scene.backgroundBlurriness = T.bg; scene.backgroundIntensity = T.bgI ?? 1; scene.backgroundRotation.y = T.rotE || 0; sky.visible = false; }
    else { scene.background = null; sky.visible = true; }
  });
}
export const materialesVentana = [M.bld, M.bld2, M.casa, M.casa2];
export const luzExtra = { pool: null, cone: null, halo: null, llama: null }; // materiales que dependen de la hora (los pone tierra.js)
export function aplicarHora(n) {
  const T = TIMES[n]; G.hora = n;
  skyMat.uniforms.top.value.setHex(T.top); skyMat.uniforms.bot.value.setHex(T.bot);
  scene.fog.color.setHex(T.fog); scene.fog.near = G.fogOn ? T.fn : 900; scene.fog.far = G.fogOn ? T.ff : 1000;
  sun.color.setHex(T.sun); sun.intensity = T.si; sunDir.set(...T.sp).normalize();
  hemi.color.setHex(T.ht); hemi.groundColor.setHex(T.hg); hemi.intensity = T.hi;
  renderer.toneMappingExposure = T.exp; scene.environmentIntensity = T.env;
  starsUp.visible = !!T.stars; starsDown.visible = T.stars === 2; moon.visible = T.stars === 1;
  moon.position.copy(sunDir).multiplyScalar(175); moon.lookAt(0, 0, 0);
  const U = skyMat.uniforms; U.sunD.value.copy(sunDir); U.sunC.value.setHex(T.sun); U.sunVis.value = T.sv || 0; U.moonD.value.copy(sunDir); U.moonVis.value = T.mv || 0;
  U.milky.value = T.milky || 0; U.nebula.value = T.nebula || 0; U.nubes.value = T.nubes || 0; U.nubeC.value.setHex(T.nubeC || 0); U.cityAmt.value = T.ciudad || 0; U.glowAmt.value = T.incendio || 0;
  starMat.uniforms.uPx.value = renderer.getPixelRatio(); starMat.uniforms.uSuelo.value = T.stars === 2 ? 0 : 1;
  for (const m of materialesVentana) m.emissiveIntensity = T.win;
  if (luzExtra.pool) luzExtra.pool.opacity = T.lamp * .85;
  if (luzExtra.cone) luzExtra.cone.opacity = T.lamp * .045;
  if (luzExtra.halo) luzExtra.halo.opacity = T.lamp * .9;
  UMundo.uWet.value = T.wet || 0;
  if (!T.bg) { scene.background = null; sky.visible = true; }
  ponerEntorno(T);
  for (const fn of alHora) try { fn(n); } catch (e) { console.warn('[hora]', e); }
}
export const lampFactor = () => TIMES[G.hora].lamp;
// ganchos para otros sistemas del mundo (atmósfera): cada fotograma y al cambiar de hora
export const porFotograma = []; // fn(dt, posCamara)
export const alHora = [];       // fn(nombreHora)

// ---------- Luces puntuales: un grupo fijo que se reparte entre las fuentes más cercanas ----------
// (en las Quest cada luz extra encarece todos los materiales; 6 luces vivas bastan)
export const fuentes = [];
export function fuenteLuz(x, y, z, color, i, d, tipo = 'fijo', interior = false) { const f = { p: new V3(x + B.ox, y, z + B.oz), c: new THREE.Color(color), i, d, tipo, interior, cap: B.cap, on: true, ph: Math.random() * 9 }; fuentes.push(f); return f; }
const pool = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.position.set(0, -80, 0); scene.add(l); pool.push({ l, f: null }); }
export const luzFx = new THREE.PointLight(0xffb060, 0, 18, 2); luzFx.position.set(0, -50, 0); scene.add(luzFx);
let luzT = 0;
export function actualizarLuces(dt, pos) {
  luzT -= dt;
  if (luzT <= 0) {
    luzT = .25;
    const cand = fuentes.filter(f => f.on && capOn[f.cap] && f.p.distanceToSquared(pos) < 55 * 55).sort((a, b) => a.p.distanceToSquared(pos) - b.p.distanceToSquared(pos)).slice(0, pool.length);
    for (const Z of zonas.values()) { const v = Z.c.distanceToSquared(pos) < Z.r * Z.r; for (const m of Z.mallas) m.visible = v; }
    pool.forEach((s, i) => { const f = cand[i] || null; s.f = f; if (f) { s.l.position.copy(f.p); s.l.color.copy(f.c); s.l.distance = f.d; } else { s.l.intensity = 0; s.l.position.set(0, -80, 0); } });
  }
  const lamp = lampFactor(), t = G.time;
  for (const s of pool) {
    const f = s.f; if (!f) continue;
    let k = f.interior ? 1 : lamp;
    if (f.tipo === 'fuego') k = Math.max(k, .5) * (.8 + .2 * Math.sin(t * 23 + f.ph) + .1 * Math.sin(t * 7.3) + rnd(-.08, .08));
    else if (f.tipo === 'neon') k *= .55 + .45 * Math.sin(t * 4.2 + f.ph);
    else if (f.tipo === 'parpadeo') k *= Math.random() < .03 ? .15 : 1;
    else if (f.tipo === 'alarma') k = Math.sin(t * 7 + f.ph) > 0 ? 1 : .05;
    s.l.intensity = f.i * k;
  }
  luzFx.intensity = Math.max(0, luzFx.intensity - dt * 300);
  skyMat.uniforms.uTime.value = t; starMat.uniforms.uTime.value = t; UMundo.uTime.value = t;
  for (const fn of porFotograma) fn(dt, pos);
  if (luzExtra.llama) luzExtra.llama.opacity = .75 + .2 * Math.sin(t * 17) + .1 * Math.sin(t * 5.3);
}
