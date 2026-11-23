// Horneado de luz de las salas EN EL NAVEGADOR, al cargar (Bloque 1, parte 2).
// Por qué no en Blender: el mundo se construye por código con azar en cada carga; un lightmap hecho fuera no
// casaría con la geometría. Aquí se hornea la geometría que hay de verdad, en la GPU, en ~1-3 s.
//
// Qué se hornea: en las superficies grandes y finas de cada sala (suelo, paredes, techo, alfombras) una textura con
//   R = visibilidad de las lámparas de la sala (sombras suaves de muebles y personajes fijos),
//   G = oclusión ambiental real (cuánto de la sala ve cada punto: bajo la mesa, detrás del sofá, rincones).
// Cómo: cientos de muestras; en cada una una luz de horneado (SpotLight con sombra, solo en una escena aparte) se
// coloca en una lámpara con un poco de desplazamiento (sombra suave) o en un punto al azar de la sala (oclusión);
// se pinta su mapa de sombras con la escena real y se acumula, en el espacio UV del lightmap, visibilidad × peso
// y peso (mezcla aditiva en media precisión). Al final R/G, B/A → textura de 8 bits con relleno de bordes.
// En juego: lightMap en el canal uv1 con intensidad 0 (three no lo suma) y el chunk de luces de iluminacion.js lo
// usa como multiplicador de la luz directa e indirecta. ?horno=0 lo desactiva.
import { THREE, V3, scene, camera, renderer, capas, fuentes, sun, materialesVentana } from '../nucleo.js';
import { SALAS } from './iluminacion.js';

const OFF = new URLSearchParams(location.search).get('horno') === '0' || new URLSearchParams(location.search).get('salas') === '0';
const RES = 512, PAD = 2;

const dentroCaja = (S, p, m) => p.x > S.min[0] - m && p.x < S.max[0] + m && p.z > S.min[2] - m && p.z < S.max[2] + m && p.y > S.min[1] - m && p.y < S.max[1] + m;

// 1) Antes de hornear(): marca las piezas estáticas grandes y finas de cada sala para que se fusionen aparte
export function marcarReceptores() {
  if (OFF) return 0;
  scene.updateMatrixWorld(true);
  const caja = new THREE.Box3(), tam = new V3(), cen = new V3(); let n = 0;
  for (const cap of ['tierra', 'calma']) capas[cap].traverse(o => {
    if (!o.isMesh || !o.userData.static || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (materialesVentana.includes(o.material) || o.material.transparent || o.material.alphaTest > 0 || !o.material.isMeshStandardMaterial) return;
    caja.setFromObject(o); caja.getSize(tam); caja.getCenter(cen);
    const d = [tam.x, tam.y, tam.z].sort((a, b) => a - b);
    if (d[0] > .45 || d[1] * d[2] < 1.5) return; // fino y grande: suelos, paredes, techos, alfombras
    const S = SALAS.find(S => dentroCaja(S, caja.min, .45) && dentroCaja(S, caja.max, .45)); if (!S) return; // entera dentro (el patio del lab no)
    o.userData.lm = S.id; n++;
  });
  return n;
}

// 2) UV del lightmap: cartas planas (triángulos del mismo plano alineado) empaquetadas por filas
function uvLightmap(mallas, S) {
  const cartas = [], centro = new V3(...S.min).add(new V3(...S.max)).multiplyScalar(.5);
  for (const m of mallas) {
    if (m.geometry.index) m.geometry = m.geometry.toNonIndexed(); // (la indexada puede estar compartida: no se libera)
    const g = m.geometry, P = g.attributes.position, N = P.count, mapa = new Map(), carta = new Int32Array(N / 3);
    const a = new V3(), b = new V3(), c = new V3(), n = new V3();
    m.updateMatrixWorld();
    for (let t = 0; t < N / 3; t++) {
      a.fromBufferAttribute(P, t * 3).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(P, t * 3 + 1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(P, t * 3 + 2).applyMatrix4(m.matrixWorld);
      n.subVectors(c, b).cross(new V3().subVectors(a, b)).normalize();
      const ax = Math.abs(n.x) > Math.abs(n.y) ? (Math.abs(n.x) > Math.abs(n.z) ? 0 : 2) : (Math.abs(n.y) > Math.abs(n.z) ? 1 : 2);
      if (n.dot(new V3().subVectors(centro, a)) < 0) { carta[t] = -1; continue; } // cara exterior: no se hornea
      const s = n.getComponent(ax) >= 0 ? 1 : -1, off = Math.round(a.getComponent(ax) * 20);
      const k = ax + '|' + s + '|' + off;
      let C = mapa.get(k);
      if (!C) { C = { ax, u: [2, 0, 0][ax], v: [1, 2, 1][ax], x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, idx: cartas.length }; mapa.set(k, C); cartas.push(C); } // plano YZ → (z,y) · XZ → (x,z) · XY → (x,y)
      for (const p of [a, b, c]) { const u = p.getComponent(C.u), v = p.getComponent(C.v); C.x0 = Math.min(C.x0, u); C.x1 = Math.max(C.x1, u); C.y0 = Math.min(C.y0, v); C.y1 = Math.max(C.y1, v); }
      carta[t] = C.idx;
    }
    m.userData._carta = carta;
  }
  // densidad: que todo quepa en ~70 % del atlas, como mucho 25 texels/m
  const area = cartas.reduce((s, C) => s + (C.x1 - C.x0 + .1) * (C.y1 - C.y0 + .1), 0);
  let dens = Math.min(25, Math.sqrt(.7 * RES * RES / area));
  for (let intento = 0; intento < 8; intento++, dens *= .9) { // empaquetado por filas (de más alta a más baja)
    const orden = [...cartas].sort((p, q) => (q.y1 - q.y0) - (p.y1 - p.y0)); let x = 8, y = 0, fila = 8, cabe = true; // 8×8 px reservados (caras exteriores)
    for (const C of orden) {
      C.w = Math.ceil((C.x1 - C.x0) * dens) + PAD * 2; C.h = Math.ceil((C.y1 - C.y0) * dens) + PAD * 2;
      if (x + C.w > RES) { x = 0; y += fila; fila = 0; }
      if (C.w > RES || y + C.h > RES) { cabe = false; break; }
      C.px = x; C.py = y; x += C.w; fila = Math.max(fila, C.h);
    }
    if (cabe) break;
  }
  const w = new V3();
  for (const m of mallas) {
    const P = m.geometry.attributes.position, uv = new Float32Array(P.count * 2), carta = m.userData._carta;
    for (let i = 0; i < P.count; i++) {
      const ci = carta[(i / 3) | 0]; if (ci < 0) { uv[i * 2] = uv[i * 2 + 1] = 3 / RES; continue; }
      const C = cartas[ci]; w.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
      uv[i * 2] = (C.px + PAD + (w.getComponent(C.u) - C.x0) * dens) / RES; uv[i * 2 + 1] = (C.py + PAD + (w.getComponent(C.v) - C.y0) * dens) / RES;
    }
    m.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2)); delete m.userData._carta;
  }
  return dens;
}

// 3) Material de horneado: dibuja en espacio UV y acumula visibilidad × peso
function matHorno() {
  const m = new THREE.ShadowMaterial({ side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true });
  Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }); // suma pura (también el alfa)
  m.uniforms = { uLuz: { value: new V3() }, uDir: { value: new V3(0, -1, 0) }, uCos: { value: .2 }, uPeso: { value: 1 }, uModo: { value: 0 }, uK: { value: .15 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.uniforms);
    sh.vertexShader = 'attribute vec2 uv1;\nvarying vec3 vBW; varying vec3 vBN;\n' + sh.vertexShader.replace(/}\s*$/, `
  vBW = (modelMatrix * vec4(transformed, 1.0)).xyz; vBN = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = vec4(uv1 * 2.0 - 1.0, 0.0, 1.0); }`);
    sh.fragmentShader = 'uniform vec3 uLuz, uDir; uniform float uCos, uPeso, uModo, uK;\nvarying vec3 vBW; varying vec3 vBN;\n' + sh.fragmentShader
      .replace(/gl_FragColor = vec4\( color, opacity \* \( 1\.0 - getShadowMask\(\) \) \);/, `
  vec3 L = uLuz - vBW; float d = length(L); L /= max(d, 1e-4);
  float w = max(dot(normalize(vBN), L), 0.0) * smoothstep(uCos, uCos + .06, dot(-L, uDir)) * uPeso / (1.0 + d * d * uK);
  float vis = getShadowMask();
  gl_FragColor = uModo < .5 ? vec4(vis * w, w, 0.0, 0.0) : vec4(0.0, 0.0, vis * w, w);`)
      .replace('#include <tonemapping_fragment>', '').replace('#include <colorspace_fragment>', '').replace('#include <fog_fragment>', '');
  };
  return m;
}
// final: cociente y relleno de bordes (los texels vacíos toman la media de sus vecinos con dato)
const matFinal = new THREE.ShaderMaterial({
  uniforms: { tA: { value: null }, px: { value: 1 / RES } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tA; uniform float px; varying vec2 vUv;
  vec4 dato(vec2 o){ vec4 a = texture2D(tA, vUv + o * px); return vec4(a.g > 1e-3 ? a.r / a.g : -1.0, a.a > 1e-3 ? a.b / a.a : -1.0, 0.0, 0.0); }
  void main(){ vec4 c = dato(vec2(0));
    if (c.x < 0.0 || c.y < 0.0) { vec2 s = vec2(0); vec2 n = vec2(0);
      for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec4 d = dato(vec2(i, j)); if (d.x >= 0.0) { s.x += d.x; n.x++; } if (d.y >= 0.0) { s.y += d.y; n.y++; } }
      if (c.x < 0.0) c.x = n.x > 0.0 ? s.x / n.x : 1.0; if (c.y < 0.0) c.y = n.y > 0.0 ? s.y / n.y : 1.0; }
    gl_FragColor = vec4(clamp(c.xy, 0.0, 1.0), 0.0, 1.0); }`,
  depthTest: false, depthWrite: false
});
const fantasmas = {};
const fantasma = lado => fantasmas[lado] ||= new THREE.MeshBasicMaterial({ side: lado, colorWrite: false, depthWrite: false, depthTest: false });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matFinal); quad.frustumCulled = false;
const escQuad = new THREE.Scene(); escQuad.add(quad);

// 4) Hornear todas las salas (después de hornear() y aplicarHora)
export async function hornearSalas(aviso = () => {}) {
  if (OFF) return;
  const t0 = performance.now();
  scene.updateMatrixWorld(true);
  const luz = new THREE.SpotLight(0xffffff, 1, 16, 1.35, 0, 2); luz.castShadow = true; luz.shadow.mapSize.set(1024, 1024);
  luz.shadow.bias = -.0008; luz.shadow.normalBias = .03; luz.shadow.camera.near = .1; luz.shadow.autoUpdate = false;
  const esc = new THREE.Scene(); esc.add(luz, luz.target);
  const mat = matHorno(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // la sombra del sol podría colarse en getShadowMask: el material de horneado vive en otra escena sin sol, así que no
  const prev = { cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), rt: renderer.getRenderTarget(), auto: renderer.autoClear, xr: renderer.xr.enabled, sm: renderer.shadowMap.autoUpdate, sunU: sun.shadow.autoUpdate };
  renderer.xr.enabled = false; renderer.autoClear = false; renderer.shadowMap.autoUpdate = true; sun.shadow.autoUpdate = false;
  const informe = [];
  for (const S of SALAS) {
    const mallas = [];
    for (const cap of ['tierra', 'calma']) for (const o of capas[cap].children) if (o.isMesh && o.userData.lm === S.id) mallas.push(o);
    if (!mallas.length) continue;
    const dens = uvLightmap(mallas, S);
    for (const m of mallas) { const c = new THREE.Mesh(m.geometry, mat); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); c.matrixWorld.copy(m.matrixWorld); c.frustumCulled = false; c.receiveShadow = true; esc.add(c); }
    // fantasmas: copias de todo lo que proyecta sombra cerca de la sala (misma geometría, sin color: solo cuentan en el
    // pase de sombras). La cámara ortográfica del horneado no los ve (están fuera de su volumen) y no cuestan nada más.
    const zona = new THREE.Box3(new V3(...S.min).subScalar(1.5), new V3(...S.max).addScalar(1.5)), bb = new THREE.Box3();
    scene.traverseVisible(o => {
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry?.attributes.position) return;
      // en juego muchos muebles no proyectan (rendimiento), pero en el horneado sí: todo lo que proyecta o es estático, menos cristales
      const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (!(o.castShadow || o.userData.cap) || mt?.transparent || mt?.isShaderMaterial) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      if (o.isInstancedMesh) { bb.makeEmpty(); o.computeBoundingBox?.(); if (o.boundingBox) bb.copy(o.boundingBox).applyMatrix4(o.matrixWorld); }
      if (bb.isEmpty() || !bb.intersectsBox(zona)) return;
      const lado = Array.isArray(o.material) ? THREE.FrontSide : o.material.side;
      const f = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, fantasma(lado), o.count) : new THREE.Mesh(o.geometry, fantasma(lado));
      if (o.isInstancedMesh) f.instanceMatrix = o.instanceMatrix;
      f.matrixAutoUpdate = false; f.matrix.copy(o.matrixWorld); f.matrixWorld.copy(o.matrixWorld); f.castShadow = true; esc.add(f);
    });
    const acum = new THREE.WebGLRenderTarget(RES, RES, { type: THREE.HalfFloatType, depthBuffer: false });
    renderer.setRenderTarget(acum); renderer.setClearColor(0x000000, 0); renderer.clear();
    // muestras: lámparas de la sala (directa, con desplazamiento) y puntos al azar (oclusión ambiental)
    const lamparas = fuentes.filter(f => f.interior && f.tipo !== 'alarma' && f.tipo !== 'neon' && dentroCaja(S, f.p, .2)).map(f => ({ p: f.p.clone(), i: f.i }));
    lamparas.push({ p: new V3().fromArray(S.luz.p), i: S.luz.i * .5 });
    const muestras = [], NL = 40, NA = 112;
    for (const L of lamparas) for (let k = 0; k < NL; k++) muestras.push({ modo: 0, p: L.p.clone().add(new V3((Math.random() - .5) * .45, -Math.random() * .1, (Math.random() - .5) * .45)), dir: new V3(0, -1, 0), peso: L.i / 30 });
    const ejes = [new V3(0, -1, 0), new V3(0, 1, 0), new V3(1, 0, 0), new V3(-1, 0, 0), new V3(0, 0, 1), new V3(0, 0, -1)];
    for (let k = 0; k < NA; k++) {
      const p = new V3(THREE.MathUtils.lerp(S.min[0] + .4, S.max[0] - .4, Math.random()), THREE.MathUtils.lerp(.3, S.max[1] - .3, Math.random()), THREE.MathUtils.lerp(S.min[2] + .4, S.max[2] - .4, Math.random()));
      muestras.push({ modo: 1, p, dir: ejes[k % 6], peso: 1 });
    }
    for (let k = 0; k < muestras.length; k++) {
      const M = muestras[k];
      luz.position.copy(M.p); luz.target.position.copy(M.p).add(M.dir); luz.updateMatrixWorld(); luz.target.updateMatrixWorld();
      luz.shadow.camera.far = 16;
      luz.shadow.needsUpdate = true; // el render de abajo pinta la sombra (fantasmas) y acumula (receptores)
      mat.uniforms.uLuz.value.copy(M.p); mat.uniforms.uDir.value.copy(M.dir); mat.uniforms.uCos.value = Math.cos(1.35); mat.uniforms.uPeso.value = M.peso; mat.uniforms.uModo.value = M.modo; mat.uniforms.uK.value = M.modo ? .08 : .15;
      renderer.setRenderTarget(acum); renderer.render(esc, cam);
      if (k % 24 === 23) { aviso(`Horneando la luz · ${S.id} ${Math.round(k / muestras.length * 100)} %`); await new Promise(r => setTimeout(r, 0)); }
    }
    // final → textura de 8 bits (canal uv1)
    const fin = new THREE.WebGLRenderTarget(RES, RES, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    fin.texture.channel = 1; fin.texture.colorSpace = THREE.NoColorSpace;
    matFinal.uniforms.tA.value = acum.texture; renderer.setRenderTarget(fin); renderer.clear(); renderer.render(escQuad, cam);
    acum.dispose(); for (const c of [...esc.children]) if (c.isMesh) esc.remove(c); // (geometrías compartidas: no se liberan)
    // materiales propios de los receptores (mismo shader + horneado)
    const porMat = new Map();
    for (const m of mallas) {
      let n = porMat.get(m.material);
      if (!n) { const o = m.material; n = o.clone(); n.onBeforeCompile = o.onBeforeCompile; const k0 = o.customProgramCacheKey?.bind(o); n.customProgramCacheKey = () => (k0 ? k0() : '') + '|horno';
        n.lightMap = fin.texture; n.lightMapIntensity = 0; n.defines = { ...(o.defines || {}), SALA_HORNO: '' }; porMat.set(o, n); }
      m.material = n;
    }
    S.horno = fin;
    informe.push(`${S.id}: ${mallas.length} mallas, ${muestras.length} muestras, ${dens.toFixed(1)} px/m`);
  }
  luz.shadow.dispose(); mat.dispose();
  // precompilar los materiales horneados (si no, la primera vez que se ve cada sala hay un tirón de segundos: el
  // compilador D3D de Windows tarda ~2 s por shader PBR). compileAsync usa KHR_parallel_shader_compile: no bloquea.
  const pre = new THREE.Scene();
  for (const S of SALAS) for (const cap of ['tierra', 'calma']) for (const o of capas[cap].children) if (o.isMesh && o.userData.lm === S.id && o.material.defines?.SALA_HORNO !== undefined) { const m = new THREE.Mesh(o.geometry, o.material); m.receiveShadow = o.receiveShadow; m.castShadow = o.castShadow; pre.add(m); } // mismas banderas = misma variante de shader
  try { aviso('Preparando las salas…'); await renderer.compileAsync(pre, camera, scene); } catch (e) { console.warn('[horno] precompilado', e); }
  renderer.setClearColor(prev.cc, prev.ca); renderer.setRenderTarget(prev.rt); renderer.autoClear = prev.auto; renderer.xr.enabled = prev.xr; renderer.shadowMap.autoUpdate = prev.sm; sun.shadow.autoUpdate = prev.sunU; sun.shadow.needsUpdate = true;
  console.info(`[horno] ${Math.round(performance.now() - t0)} ms · ${informe.join(' · ')}`);
}
