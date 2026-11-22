// Atmósfera: clima (lluvia, niebla, viento), vida ambiental y la «ola de despertar» de El Rey.
// Todo barato para Quest: cada sistema es UNA llamada de dibujo (instancias / Points / shader) y sin CPU por
// partícula salvo los pocos objetos que lo necesitan (papeles, pájaros). Se actualiza desde el gancho
// porFotograma de nucleo.js (no hace falta tocar main.js).
//   clima(tipo: 'lluvia'|'despejado'|'niebla'|'viento', intensidad 0..1, transición s = 3)
//   pulsoRey({ ola = true, origen = [0, -139], radio = true })
// Ambos se exponen en W.clima / W.pulsoRey (tierra.js) para el director de la historia y en window.__clima / __pulsoRey.
import { THREE, V3, G, scene, camera, renderer, UMundo, fuentes, luzExtra, materialesVentana, capOn, capas, cv2d, toTex, canvasTex, rnd, clamp, TIMES, porFotograma, alHora, cielo } from '../nucleo.js';
import { A as AUD } from '../audio.js';
import { escucharRuido } from '../interaccion/ruido.js';

const S = { lluvia: 0, lluviaObj: 0, niebla: 0, nieblaObj: 0, viento: .25, vientoObj: .25, vel: 1 / 3, racha: 0, bajoTecho: false };
// interiores cubiertos (x0, z0, x1, z1, altura del techo): ahí no llueve y la lluvia suena «en el tejado»
const CUBIERTOS = [[14, 79.5, 26, 89.5, 3.2], [-22, -57, -9, -43, 4.2], [-11.8, -147.8, 11.8, -130.2, 6.5], [148, -34, 172, -6, 11], [125, -36, 139, -28, 4.6], [125, -50, 139, -42, 4.6], [22.5, -37.5, 27.5, -30.5, 3.2], [116.9, -10, 120.1, -7, 2.7]];
export const bajoTecho = p => { for (const c of CUBIERTOS) if (p.x > c[0] && p.x < c[2] && p.z > c[1] && p.z < c[3] && p.y < c[4] + .5) return true; return false; };

// ---------- Lluvia: 1600 rayas instanciadas en un cilindro que sigue a la cabeza (1 llamada) ----------
const NL = 1600, RL = 13, HL = 14;
const lluviaMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: true,
  uniforms: { ...THREE.UniformsLib.fog, uCam: { value: new V3() }, uTime: UMundo.uTime, uRain: { value: 0 }, uWind: UMundo.uWind, uCub: { value: CUBIERTOS.map(c => new THREE.Vector4(c[0], c[1], c[2], c[3])) }, uCubY: { value: CUBIERTOS.map(c => c[4]) } },
  vertexShader: `attribute vec4 off; uniform vec3 uCam; uniform float uTime, uRain; uniform vec3 uWind; uniform vec4 uCub[8]; uniform float uCubY[8]; varying float vA; varying float vV;
  #include <fog_pars_vertex>
  void main(){
    float y = mod(off.y - uTime * (8.5 + off.w * 3.0), ${HL.toFixed(1)});
    vec3 c = vec3(0.0, uCam.y - 4.0 + y, 0.0);
    c.xz = uCam.xz + mod(off.xz - uCam.xz + ${RL.toFixed(1)}, ${(RL * 2).toFixed(1)}) - ${RL.toFixed(1)};
    c.xz += uWind.xz * (${HL.toFixed(1)} - y) * .045;
    vA = step(off.w, uRain);
    for (int i = 0; i < 8; i++) if (c.x > uCub[i].x && c.x < uCub[i].z && c.z > uCub[i].y && c.z < uCub[i].w && c.y < uCubY[i]) vA = 0.0;
    vec4 mvPosition = viewMatrix * vec4(c, 1.0);
    vec3 arriba = (viewMatrix * vec4(uWind.x * .06, 1.0, uWind.z * .06, 0.0)).xyz;
    mvPosition.xyz += vec3(position.x, 0.0, 0.0) + arriba * position.y * (.9 + uRain * .5);
    vV = uv.y; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`,
  fragmentShader: `uniform float uRain; varying float vA; varying float vV;
  #include <fog_pars_fragment>
  void main(){ if (vA < .5) discard; gl_FragColor = vec4(vec3(.75, .8, .88), (.18 + .2 * uRain) * sin(vV * 3.14159));
  #include <fog_fragment>
  }`
});
const lluvia = (() => {
  const base = new THREE.PlaneGeometry(.011, .55); base.translate(0, .275, 0);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  const off = new Float32Array(NL * 4); for (let i = 0; i < NL; i++) { off[i * 4] = rnd(-RL, RL); off[i * 4 + 1] = rnd(0, HL); off[i * 4 + 2] = rnd(-RL, RL); off[i * 4 + 3] = Math.random(); }
  g.setAttribute('off', new THREE.InstancedBufferAttribute(off, 4)); g.instanceCount = NL;
  const m = new THREE.Mesh(g, lluviaMat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m); return m;
})();

// ---------- Viento en la vegetación, cables, banderas y ropa tendida (vertex shader, sin CPU) ----------
// k = amplitud; modo 'arbol' (crece con la altura) o 'tela' (crece con la distancia al borde sujeto, uv)
export function conViento(mat, k = 1, modo = 'arbol') {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); sh.uniforms.uTime = UMundo.uTime; sh.uniforms.uWind = UMundo.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec3 uWind;')
      .replace('#include <begin_vertex>', modo === 'tela'
        ? `#include <begin_vertex>
           { float sujeto = clamp(uv.x, 0.0, 1.0); float w = length(uWind.xz); vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
             float o = sin(uTime * (3.0 + w * .5) + uv.x * 6.0 + wp.x * .2) * .5 + sin(uTime * 5.3 + uv.y * 4.0) * .25;
             transformed.z += o * sujeto * ${(.12 * k).toFixed(3)} * (.4 + w * .25); transformed.y -= sujeto * sujeto * .08 * (1.0 - clamp(w * .2, 0.0, .8)); }`
        : `#include <begin_vertex>
           { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; float h = clamp((wp.y - 1.5) / 4.0, 0.0, 1.0); float w = length(uWind.xz);
             float s = sin(uTime * 1.7 + wp.x * .35 + wp.z * .27) * .6 + sin(uTime * 3.9 + wp.z * .9) * .25;
             transformed.xz += (uWind.xz * .05 * (.6 + .4 * s) + vec2(s, -s * .6) * .03 * w) * h * ${k.toFixed(3)}; }`);
  };
  mat.customProgramCacheKey = () => 'viento-' + modo + k; mat.needsUpdate = true; return mat;
}

// ---------- Papeles y hojas que vuelan con las rachas (24 instancias, física barata en CPU) ----------
const papelTex = canvasTex(128, (x, s) => { x.clearRect(0, 0, s, s); x.fillStyle = '#e8e2d2'; x.fillRect(4, 4, 58, 76); x.fillStyle = '#555'; for (let l = 0; l < 9; l++) x.fillRect(10, 12 + l * 7, rnd(25, 46), 3); x.fillStyle = '#7a5a2a'; x.beginPath(); x.ellipse(96, 32, 22, 12, .6, 0, 7); x.fill(); x.fillStyle = '#9a7a3a'; x.beginPath(); x.ellipse(96, 96, 20, 11, -.4, 0, 7); x.fill(); x.fillStyle = '#d8d0c0'; x.fillRect(68, 70, 50, 40); }, false);
const NP = 24, papeles = new THREE.InstancedMesh(new THREE.PlaneGeometry(.32, .42), new THREE.MeshStandardMaterial({ map: papelTex, alphaTest: .5, side: THREE.DoubleSide, roughness: .9 }), NP);
papeles.frustumCulled = false; papeles.castShadow = false; scene.add(papeles);
const P = []; for (let i = 0; i < NP; i++) P.push({ p: new V3(1e4, 0, 0), v: new V3(), r: new THREE.Euler(), w: new V3(), suelo: true, uv: i % 2 });
{ const uv = papeles.geometry.attributes.uv; } // (las dos mitades del lienzo: papel y hoja; se elige con la escala)

// ---------- Tendedero (patio de Dave) y banderas de la base ----------
function tendedero() {
  const g = new THREE.BufferGeometry(), piezas = [], cols = [0xe8e4dc, 0x6a8ab8, 0xd8a0a0, 0xf0e8c0, 0x8aa06a];
  for (let i = 0; i < 5; i++) { const w = rnd(.6, 1.1), h = rnd(.6, 1.0), p = new THREE.PlaneGeometry(w, h, 6, 6); p.translate(0, -h / 2, 0); // uv.x lo usamos como «distancia al borde sujeto» → girar uv
    const uv = p.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, 1 - uv.getY(k), uv.getX(k));
    p.translate(15.3 + i * 1.6, 2.05, 92.2); const c = new THREE.Color(cols[i]), col = new Float32Array(p.attributes.position.count * 3); for (let k = 0; k < col.length; k += 3) { col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; } p.setAttribute('color', new THREE.BufferAttribute(col, 3)); piezas.push(p); }
  const ropa = new THREE.Mesh(mergeSimple(piezas), conViento(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .95 }), 1.2, 'tela'));
  ropa.castShadow = true; capas.tierra.add(ropa);
  const poste = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, metalness: .6, roughness: .5 });
  for (const x of [14.6, 23.6]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.2, 6), poste); m.position.set(x, 1.1, 92.2); capas.tierra.add(m); }
  const cuerda = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 9, 4), poste); cuerda.rotation.z = Math.PI / 2; cuerda.position.set(19.1, 2.08, 92.2); capas.tierra.add(cuerda);
}
function mergeSimple(gs) { let n = 0; for (const g of gs) n += g.index ? g.index.count : g.attributes.position.count; const out = new THREE.BufferGeometry(), names = ['position', 'normal', 'uv', 'color'], arr = {};
  for (const a of names) arr[a] = []; for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; for (const a of names) if (g.attributes[a]) arr[a].push(...g.attributes[a].array); }
  out.setAttribute('position', new THREE.Float32BufferAttribute(arr.position, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(arr.normal, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(arr.uv, 2)); if (arr.color.length) out.setAttribute('color', new THREE.Float32BufferAttribute(arr.color, 3)); return out; }
function banderas(mat) {
  const gs = []; for (const z of [8, 11]) { const p = new THREE.PlaneGeometry(1.8, 1.1, 10, 5); p.translate(.9 + 121.06, 7.4, z); gs.push(p); }
  const m = new THREE.Mesh(mergeSimple(gs), conViento(mat, 2.2, 'tela')); m.castShadow = true; capas.tierra.add(m);
}

// ---------- Vaho del aliento (pool de 6 sprites delante de la boca) ----------
const vahoTex = canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, false);
const vahos = []; for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: vahoTex, transparent: true, depthWrite: false, opacity: 0, color: 0xdfe6ee })); sp.visible = false; scene.add(sp); vahos.push({ sp, t: 0, v: new V3() }); }
let vahoT = 2, vahoI = 0;

// ---------- Pájaros posados en cables y tejados que huyen con el ruido (24 instancias, aleteo en shader) ----------
const pajaroMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: .8, side: THREE.DoubleSide });
pajaroMat.onBeforeCompile = sh => { sh.uniforms.uTime = UMundo.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
  .replace('#include <begin_vertex>', '#include <begin_vertex>\n { float ala = abs(position.x); transformed.y += ala * sin(uTime * 22.0 + float(gl_InstanceID) * 1.7) * .9 * step(.01, ala); }'); };
const pajaroGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .07, -.16, .01, -.02, 0, 0, -.05, 0, 0, .07, 0, 0, -.05, .16, .01, -.02, 0, -.02, .09, 0, 0, -.09, 0, .02, 0], 3)); g.computeVertexNormals(); return g; })();
const NB = 24, pajaros = new THREE.InstancedMesh(pajaroGeo, pajaroMat, NB); pajaros.frustumCulled = false; scene.add(pajaros);
const posaderos = [[-30, 8.15, 63.8, 14, 'z'], [-15, 12.45, 32, 8, 'x'], [7.6, 8.15, -78, 12, 'z']];
const B = []; for (let i = 0; i < NB; i++) { const [x, y, z, L, eje] = posaderos[i % 3], o = rnd(-L / 2, L / 2); const casa = new V3(x + (eje === 'x' ? o * 0 : o), y, z + (eje === 'x' ? o : 0)); B.push({ casa, p: casa.clone(), v: new V3(), huye: 0, ry: rnd(0, 6), vuelve: 0 }); }
function espantar(pos, radio) { for (const b of B) if (b.huye <= 0 && b.p.distanceTo(new V3(pos.x, pos.y, pos.z)) < Math.max(25, radio * .8)) { b.huye = rnd(6, 9); b.v.set(rnd(-1, 1), rnd(1.2, 2.2), rnd(-1, 1)).normalize().multiplyScalar(rnd(6, 9)); b.vuelve = rnd(35, 60); } }
try { escucharRuido(ev => { if (ev.radio >= 8 || ev.tipo === 'disparo') espantar(ev.pos, ev.radio); }); } catch (e) {}

// ---------- Columnas de humo (32 cuadros instanciados, billboard y subida en el shader) ----------
const humoTex = canvasTex(128, (x, s) => { x.clearRect(0, 0, s, s); for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(rnd(35, 93), rnd(35, 93), 0, s / 2, s / 2, rnd(25, 60)); g.addColorStop(0, 'rgba(70,66,62,.22)'); g.addColorStop(1, 'rgba(70,66,62,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); } }, false);
const COLS = [[-5, 8, 1], [8, -40, 1.2], [30, 8, .9], [-80, -150, 6], [70, -165, 7], [175, 85, 6], [-90, 60, 5]];
const humoMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
  uniforms: { ...THREE.UniformsLib.fog, map: { value: humoTex }, uTime: UMundo.uTime, uWind: UMundo.uWind, uOp: { value: 0 } },
  vertexShader: `attribute vec4 col; attribute float fase; uniform float uTime; uniform vec3 uWind; varying vec2 vUv; varying float vA;
  #include <fog_pars_vertex>
  void main(){ float t = fract(uTime * .045 * (1.0 + col.w * .02) + fase); float esc = col.w; vec3 c = col.xyz + vec3(0.0, t * 9.0 * esc, 0.0) + vec3(uWind.x, 0.0, uWind.z) * t * t * 3.0 * esc;
    vec4 mvPosition = viewMatrix * vec4(c, 1.0); mvPosition.xy += position.xy * (1.2 + t * 4.0) * esc; vUv = uv; vA = smoothstep(0.0, .15, t) * (1.0 - t); gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`,
  fragmentShader: `uniform sampler2D map; uniform float uOp; varying vec2 vUv; varying float vA;
  #include <fog_pars_fragment>
  void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(t.rgb * 1.3, t.a * vA * uOp * 2.5);
  #include <fog_fragment>
  }` });
const humo = (() => { const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  const n = COLS.length * 7, col = new Float32Array(n * 4), fase = new Float32Array(n); let k = 0; for (const [x, z, e] of COLS) for (let i = 0; i < 7; i++, k++) { col.set([x, e > 2 ? 0 : 1.4, z, e], k * 4); fase[k] = i / 7 + rnd(0, .05); }
  g.setAttribute('col', new THREE.InstancedBufferAttribute(col, 4)); g.setAttribute('fase', new THREE.InstancedBufferAttribute(fase, 1)); g.instanceCount = n;
  const m = new THREE.Mesh(g, humoMat); m.frustumCulled = false; m.renderOrder = 4; scene.add(m); return m; })();

// ---------- Ojos rojos: patrullas lejanas por las laderas + robots dormidos del pueblo (ola de despertar) ----------
const NO = 140, ojosMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  uniforms: { uTime: UMundo.uTime, uPulso: { value: -1 }, uFlash: { value: 0 }, uOrigen: { value: new THREE.Vector2(0, -139) }, uPatrulla: { value: 0 }, uPx: { value: 1 } },
  vertexShader: `attribute vec4 dat; uniform float uTime, uPulso, uFlash, uPatrulla, uPx; uniform vec2 uOrigen; varying float vA;
  void main(){ vec3 p = position; float on;
    if (dat.x < .5) { float a = dat.y + uTime * dat.z; p.x += cos(a) * dat.w; p.z += sin(a) * dat.w * .7; on = uPatrulla * (step(.06, fract(uTime * .37 + dat.y)) ); }
    else { float d = length(p.xz - uOrigen); on = uPulso < 0.0 ? 0.0 : smoothstep(d / 38.0, d / 38.0 + .25, uPulso) * (.75 + .25 * sin(uTime * 3.0 + dat.y)); }
    vA = clamp(on + uFlash * step(.5, on + uPatrulla), 0.0, 1.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(uPx * 220.0 / -mv.z, 1.5, 7.0); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ if (vA < .02) discard; float r = length(gl_PointCoord - .5); float a = smoothstep(.5, .05, r); gl_FragColor = vec4(vec3(1.0, .12, .05) * a * vA * 2.0, a * vA); }` });
const ojos = (() => { const pos = [], dat = []; const par = (x, y, z, d) => { const ang = rnd(0, 6.28); for (const s of [-1, 1]) { pos.push(x + Math.cos(ang) * .07 * s, y, z + Math.sin(ang) * .07 * s); dat.push(...d); } };
  for (let i = 0; i < 30; i++) { const a = rnd(0, Math.PI * 2), r = rnd(120, 165); par(43 + Math.cos(a) * r, rnd(3, 14), -35 + Math.sin(a) * r, [0, rnd(0, 6.28), rnd(-.02, .02), rnd(4, 14)]); }
  // robots dormidos del pueblo: portales, calles, dentro de las tiendas, en la base
  for (let i = 0; i < 40; i++) { let x, z; do { x = rnd(-60, 150); z = rnd(-160, 95); } while (Math.abs(x) < 4.5 && z > -120 && z < 70); par(x, rnd(1.4, 1.75), z, [1, rnd(0, 6), 0, 0]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('dat', new THREE.Float32BufferAttribute(dat, 4));
  const p = new THREE.Points(g, ojosMat); p.frustumCulled = false; p.renderOrder = 6; capas.tierra.add(p); return p; })();

// ---------- Siluetas en ventanas que cierran la cortina si las miras (8 instancias) ----------
const silTex = canvasTex(128, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#ffcf90'); g.addColorStop(1, '#a05a20'); x.fillStyle = g; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(20,10,5,.92)'; x.beginPath(); x.arc(s * .5, s * .38, s * .12, 0, 7); x.fill(); x.beginPath(); x.ellipse(s * .5, s * .85, s * .25, s * .32, 0, 0, 7); x.fill(); }, false);
const silMat = new THREE.MeshBasicMaterial({ map: silTex, fog: true });
silMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float cort; varying float vCort;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCort = cort;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCort;').replace('#include <map_fragment>', '#include <map_fragment>\n if (vMapUv.x < vCort) diffuseColor.rgb = vec3(.25, .12, .06) * (1.0 - vCort * .7) + vec3(.03) * step(.5, fract(vMapUv.x * 14.0));'); };
// ventanas reales de la textura de fachada (cada 3 m; primer piso y = 3,66..5,4; segundo 6,66..8,4)
const VENT = [[-8.97, 4.53, 34.5, Math.PI / 2], [-8.97, 7.53, 28.5, Math.PI / 2], [-8.97, 4.53, 16.5, Math.PI / 2], [8.97, 7.53, 14.5, -Math.PI / 2], [8.97, 4.53, 29.5, -Math.PI / 2], [8.97, 4.53, 47.5, -Math.PI / 2]];
const siluetas = (() => { const g = new THREE.PlaneGeometry(1.62, 1.7); const im = new THREE.InstancedMesh(g, silMat, VENT.length); const cort = new Float32Array(VENT.length); g.setAttribute('cort', new THREE.InstancedBufferAttribute(cort, 1));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); VENT.forEach(([x, y, z, ry], i) => { m4.compose(new V3(x + Math.sign(x) * .015, y, z), q.setFromAxisAngle(new V3(0, 1, 0), ry), new V3(1, 1, 1)); im.setMatrixAt(i, m4); });
  im.frustumCulled = false; capas.tierra.add(im); return { im, cort, est: VENT.map(() => ({ c: 0, cerrar: false })) }; })();

// ---------- Audio: lluvia (fuera / en el tejado), sirenas y perros lejanos, chirrido de radio ----------
let AU = null;
function audioListo() { const ctx = AUD.ctx; if (!ctx) return null; if (AU) return AU;
  const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b = .97 * b + .03 * w; d[i] = w * .6 + b * 2; }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const fuera = ctx.createBiquadFilter(); fuera.type = 'highpass'; fuera.frequency.value = 900; const gF = ctx.createGain(); gF.gain.value = 0;
  const dentro = ctx.createBiquadFilter(); dentro.type = 'lowpass'; dentro.frequency.value = 420; const gD = ctx.createGain(); gD.gain.value = 0;
  src.connect(fuera).connect(gF).connect(AUD.master); src.connect(dentro).connect(gD).connect(AUD.master); src.start();
  AU = { ctx, gF, gD, buf, proxLejano: 6 }; return AU; }
function lejano(tipo) { const A = audioListo(); if (!A) return; const ctx = A.ctx, t = ctx.currentTime, ang = rnd(0, Math.PI * 2), r = rnd(90, 180);
  const pan = ctx.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 25; pan.rolloffFactor = .6;
  const px = G.CAM.x + Math.cos(ang) * r, pz = G.CAM.z + Math.sin(ang) * r; if (pan.positionX) { pan.positionX.value = px; pan.positionY.value = 5; pan.positionZ.value = pz; } else pan.setPosition(px, 5, pz);
  const g = ctx.createGain(); g.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; g.connect(lp).connect(pan).connect(AUD.master); if (AUD.reverb) { const s = ctx.createGain(); s.gain.value = .6; lp.connect(s).connect(AUD.reverb); }
  if (tipo === 'sirena') { const o = ctx.createOscillator(); o.type = 'sawtooth'; const dur = rnd(5, 8); for (let k = 0; k < dur / .9; k++) { o.frequency.setValueAtTime(620, t + k * .9); o.frequency.linearRampToValueAtTime(980, t + k * .9 + .45); o.frequency.linearRampToValueAtTime(620, t + k * .9 + .9); } o.frequency.setTargetAtTime(500, t + dur * .7, 1.5); // se aleja (Doppler aproximado)
    g.gain.linearRampToValueAtTime(.05, t + 1.2); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g); o.start(t); o.stop(t + dur + .1); }
  else { for (let k = 0; k < Math.floor(rnd(2, 5)); k++) { const t0 = t + k * rnd(.32, .55), s = ctx.createBufferSource(); s.buffer = A.buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(550, 800); bp.Q.value = 4; const e = ctx.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(.5, t0 + .02); e.gain.exponentialRampToValueAtTime(.001, t0 + .18);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(rnd(380, 460), t0); o.frequency.exponentialRampToValueAtTime(220, t0 + .15); const eo = ctx.createGain(); eo.gain.setValueAtTime(0, t0); eo.gain.linearRampToValueAtTime(.12, t0 + .01); eo.gain.exponentialRampToValueAtTime(.001, t0 + .16);
      s.connect(bp).connect(e).connect(g); o.connect(eo).connect(g); s.start(t0, rnd(0, 1.5)); s.stop(t0 + .25); o.start(t0); o.stop(t0 + .2); } g.gain.value = .5; }
}
function chirridoRadio(dur = 2.2) { const A = audioListo(); if (!A) return; const ctx = A.ctx, t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = A.buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.setValueAtTime(2400, t); for (let k = 0; k < 12; k++) bp.frequency.setValueAtTime(rnd(600, 3800), t + k * dur / 12);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .05); g.gain.setValueAtTime(.35, t + dur * .8); g.gain.linearRampToValueAtTime(0, t + dur);
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(140, t); for (let k = 0; k < 20; k++) o.frequency.setValueAtTime(rnd(90, 900), t + k * dur / 20); const go = ctx.createGain(); go.gain.value = .05;
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(48, t); sub.frequency.exponentialRampToValueAtTime(28, t + dur); const gs = ctx.createGain(); gs.gain.setValueAtTime(.5, t); gs.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(bp).connect(g).connect(AUD.master); o.connect(go).connect(g); sub.connect(gs).connect(AUD.master); s.start(t); s.stop(t + dur); o.start(t); o.stop(t + dur); sub.start(t); sub.stop(t + dur); }

// ---------- API ----------
export function clima(tipo = 'despejado', i = 1, dur = 3) {
  i = clamp(+i || 0, 0, 1); S.vel = 1 / Math.max(.1, dur);
  if (tipo === 'lluvia') { S.lluviaObj = i; S.vientoObj = Math.max(S.vientoObj, .3 + i * .4); }
  else if (tipo === 'niebla') { S.nieblaObj = i; }
  else if (tipo === 'viento') { S.vientoObj = i; S.lluviaObj = 0; }
  else { S.lluviaObj = 0; S.nieblaObj = 0; S.vientoObj = .2; }
}
let pulso = null; const apagadas = [];
export function pulsoRey(o = {}) {
  const ola = o.ola !== false, origen = o.origen || [0, -139];
  ojosMat.uniforms.uOrigen.value.set(origen[0], origen[1]); ojosMat.uniforms.uFlash.value = 1.2;
  if (o.radio !== false) chirridoRadio(ola ? 3 : 2);
  if (ola) { ojosMat.uniforms.uPulso.value = 0; pulso = { t: 0, origen: new THREE.Vector2(origen[0], origen[1]) };
    // farolas: se apagan por sectores según llega la ola (las interiores no)
    for (const f of fuentes) if (!f.interior && f.on && f.cap === 'tierra' && (f.tipo === 'fijo' || f.tipo === 'parpadeo')) { const d = Math.hypot(f.p.x - origen[0], f.p.z - origen[1]); apagadas.push({ f, t: d / 38 + rnd(.1, .6) }); } }
  else { pulso = pulso || { t: 0, origen: new THREE.Vector2(origen[0], origen[1]) }; }
}
// al cambiar de capítulo/hora: farolas de vuelta, ojos dormidos apagados
alHora.push(() => { for (const a of apagadas) a.f.on = true; apagadas.length = 0; pulso = null; ojosMat.uniforms.uPulso.value = -1; });
export const ATM = { clima, pulsoRey, conViento, bajoTecho, espantar, estado: S };
if (typeof window !== 'undefined') { window.__clima = clima; window.__pulsoRey = pulsoRey; }

// ---------- Construcción (lo llama tierra.js al final) y bucle ----------
export function construirAtmosfera(o = {}) {
  tendedero(); if (o.banderaMat) banderas(o.banderaMat);
  for (const m of o.vegetacion || []) conViento(m, 1, 'arbol');
  for (const m of o.cables || []) conViento(m, .5, 'arbol');
  porFotograma.push(actualizar);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), tA = new V3(), tF = new V3();
let lejT = 10;
function actualizar(dt, cam) {
  const T = TIMES[G.hora] || TIMES.noche, tierra = capOn.tierra && !G.enEspacio;
  // transiciones suaves
  const ap = (a, b) => a + clamp(b - a, -S.vel * dt, S.vel * dt);
  S.lluvia = ap(S.lluvia, tierra ? S.lluviaObj : 0); S.niebla = ap(S.niebla, S.nieblaObj); S.viento = ap(S.viento, S.vientoObj);
  // viento con rachas
  const t = G.time; S.racha = .55 + .3 * Math.sin(t * .37) + .15 * Math.sin(t * 1.3 + 1.7); const fuerza = S.viento * 9 * S.racha;
  UMundo.uWind.value.set(Math.cos(.6), 0, Math.sin(.6)).multiplyScalar(fuerza);
  // lluvia, suelo mojado y niebla
  lluvia.visible = S.lluvia > .01; lluviaMat.uniforms.uRain.value = S.lluvia; lluviaMat.uniforms.uCam.value.copy(cam);
  UMundo.uRain.value = S.lluvia; UMundo.uWet.value = Math.max(T.wet || 0, Math.min(1, S.lluvia * 1.4));
  if (scene.fog && G.fogOn && T.ff < 500) { const k = 1 - .65 * S.niebla - .2 * S.lluvia; scene.fog.near = T.fn * k; scene.fog.far = T.ff * (1 - .55 * S.niebla - .25 * S.lluvia); }
  if (cielo?.U) { cielo.U.nubes.value = Math.max(T.nubes || 0, S.lluvia * .95); cielo.U.glowAmt.value = Math.max(T.incendio || 0, capOn.caos ? .55 : 0); }
  S.bajoTecho = bajoTecho(cam);
  // audio de lluvia: fuera (siseo) ↔ dentro (tamborileo grave)
  const A = audioListo(); if (A) { const tt = A.ctx.currentTime, v = S.lluvia * (G.enEspacio ? 0 : 1); A.gF.gain.setTargetAtTime(S.bajoTecho ? v * .04 : v * .22, tt, .25); A.gD.gain.setTargetAtTime(S.bajoTecho ? v * .5 : v * .1, tt, .25);
    lejT -= dt; if (lejT <= 0 && tierra && (G.hora === 'noche' || capOn.caos)) { lejT = rnd(9, 26); lejano(Math.random() < .45 ? 'sirena' : 'perro'); } }
  // humo (solo en el caos o con incendio)
  humoMat.uniforms.uOp.value += ((capOn.caos && tierra ? 1 : 0) - humoMat.uniforms.uOp.value) * Math.min(1, dt); humo.visible = humoMat.uniforms.uOp.value > .01;
  // ojos: patrullas de noche en el caos; ola de despertar
  ojosMat.uniforms.uPatrulla.value = capOn.caos && tierra && G.hora === 'noche' ? 1 : 0; ojosMat.uniforms.uPx.value = renderer.getPixelRatio(); ojosMat.uniforms.uFlash.value = Math.max(0, ojosMat.uniforms.uFlash.value - dt * 1.5);
  if (pulso) { pulso.t += dt; ojosMat.uniforms.uPulso.value = pulso.t;
    for (const a of apagadas) if (a.f.on && pulso.t > a.t) { a.f.on = false; }
    const k = clamp(1 - (pulso.t - 1.5) / 4, .18, 1); if (luzExtra.halo) luzExtra.halo.opacity = (T.lamp || 0) * .9 * k; if (luzExtra.pool) luzExtra.pool.opacity = (T.lamp || 0) * .85 * k; if (luzExtra.cone) luzExtra.cone.opacity = (T.lamp || 0) * .045 * k; }
  // vaho del aliento (noche y amanecer, al aire libre)
  vahoT -= dt; if (vahoT <= 0 && tierra && (G.hora === 'noche' || G.hora === 'amanecer') && !S.bajoTecho) { vahoT = rnd(3, 4.2); const v = vahos[vahoI++ % vahos.length]; camera.getWorldDirection(tF); v.sp.position.copy(cam).addScaledVector(tF, .16).add(tA.set(0, -.09, 0)); v.v.copy(tF).multiplyScalar(.25).add(tA.set(0, .08, 0)); v.t = 1.3; v.sp.visible = true; }
  for (const v of vahos) if (v.t > 0) { v.t -= dt; v.sp.position.addScaledVector(v.v, dt); v.sp.position.addScaledVector(UMundo.uWind.value, dt * .03); const k = 1 - v.t / 1.3; v.sp.scale.setScalar(.06 + k * .32); v.sp.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI) * .35; if (v.t <= 0) v.sp.visible = false; }
  // papeles: se reciclan alrededor del jugador y vuelan con las rachas
  papeles.visible = tierra && capOn.caos;
  if (papeles.visible) { const w = UMundo.uWind.value; P.forEach((p, i) => {
    if (p.p.distanceToSquared(cam) > 26 * 26) { const a = rnd(0, 6.28), r = rnd(6, 20); p.p.set(cam.x + Math.cos(a) * r, .02, cam.z + Math.sin(a) * r); p.v.set(0, 0, 0); p.suelo = true; p.r.set(-Math.PI / 2, 0, rnd(0, 6)); }
    if (p.suelo && fuerza * S.racha > 3.5 && Math.random() < dt * .4) { p.suelo = false; p.v.set(w.x * .4, rnd(1, 2.5), w.z * .4); p.w.set(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)); }
    if (!p.suelo) { p.v.x += (w.x * .6 - p.v.x) * dt; p.v.z += (w.z * .6 - p.v.z) * dt; p.v.y -= 2.2 * dt; p.p.addScaledVector(p.v, dt); p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; p.r.z += p.w.z * dt; if (p.p.y < .02) { p.p.y = .02; p.suelo = true; p.r.set(-Math.PI / 2, 0, p.r.z); } }
    _m.compose(p.p, _q.setFromEuler(p.r), _s.set(i % 2 ? .5 : 1, i % 2 ? .5 : 1, 1)); papeles.setMatrixAt(i, _m); }); papeles.instanceMatrix.needsUpdate = true; }
  // pájaros
  pajaros.visible = tierra;
  if (pajaros.visible) { B.forEach((b, i) => { if (b.huye > 0) { b.huye -= dt; b.v.y += dt * .5; b.p.addScaledVector(b.v, dt); b.ry = Math.atan2(b.v.x, b.v.z); if (b.huye <= 0) b.p.set(0, -200, 0); }
      else if (b.vuelve > 0) { b.vuelve -= dt; if (b.vuelve <= 0) b.p.copy(b.casa); } else { b.p.copy(b.casa); b.ry += Math.sin(t * .5 + i) * dt * .3; }
      _m.compose(b.p, _q.setFromAxisAngle(tA.set(0, 1, 0), b.ry), _s.setScalar(b.huye > 0 ? 1.6 : 1)); pajaros.setMatrixAt(i, _m); }); pajaros.instanceMatrix.needsUpdate = true; }
  // siluetas: si las miras de cerca, cierran la cortina
  if (tierra) { camera.getWorldDirection(tF); let cambia = false; siluetas.est.forEach((e, i) => { const [x, y, z] = VENT[i]; tA.set(x - cam.x, y - cam.y, z - cam.z); const d = tA.length(); if (!e.cerrar && d < 30 && tA.normalize().dot(tF) > .985) e.cerrar = true; const obj = e.cerrar ? 1 : 0; if (e.c !== obj) { e.c = clamp(e.c + (obj - e.c > 0 ? 1 : -1) * dt * 1.5, 0, 1); siluetas.cort[i] = e.c; cambia = true; } }); if (cambia) siluetas.im.geometry.attributes.cort.needsUpdate = true; }
}
