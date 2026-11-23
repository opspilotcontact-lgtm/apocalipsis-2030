// Iluminación de interiores · «la receta de la farola» (Bloque 1, mejora rápida)
// Lo que hace que la carretera mojada se vea bien es contraste: luz que cae de un sitio, rincones oscuros y
// superficies que reflejan lo que hay alrededor. Los interiores tenían lo contrario: luz ambiente plana del cielo,
// puntos de luz sin sombra y reflejos del HDRI de fuera. Este módulo, por sala:
//  1) Oclusión de esquinas en el shader (cero llamadas, cero texturas): cada sala es una caja conocida; un punto
//     cerca de DOS planos de la caja (rincón, encuentro pared-suelo o pared-techo) se oscurece.
//  2) Una luz principal con sombra (SpotLight que se muda a la sala donde estás: una sola en todo el juego, así
//     no cambia el número de luces y nada se recompila al entrar o salir).
//  3) Sonda de reflejo: la sala se fotografía a sí misma (cubemap → PMREM) la primera vez que entras y pasa a ser
//     el entorno mientras estás dentro: los suelos y metales reflejan SUS lámparas, y la luz ambiente sale de sus
//     propias paredes (un rebote barato) en vez del cielo de fuera.
//  4) Dentro, la luz del cielo (hemisférica) baja: las lámparas mandan.
// ?salas=0 desactiva todo para comparar.
import { THREE, V3, G, scene, renderer, hemi, sun, dolly, TIMES, porFotograma, alHora, capOn } from '../nucleo.js';

const OFF = new URLSearchParams(location.search).get('salas') === '0';

// Cajas INTERIORES (cara de dentro de las paredes) en coordenadas de mundo. luz = luz principal con sombra.
export const SALAS = [
  { id: 'casaDave', min: [14.15, 0, 79.65], max: [25.85, 3.18, 89.35], hemi: .25, env: .22,
    luz: { p: [17.2, 3.08, 84.5], obj: [17.6, 0, 84.8], c: 0xffd3a0, i: 42, d: 11, ang: 1.25 } },
  { id: 'lab', min: [-11.58, 0, -147.58], max: [11.58, 6.5, -130.42], hemi: .25, env: .26,
    luz: { p: [0, 6.1, -139.5], obj: [0, 0, -139], c: 0xe6f0ff, i: 110, d: 20, ang: 1.15 } },
  { id: 'tienda', min: [-21.83, 0, -56.83], max: [-9.17, 4.18, -43.17], hemi: .25, env: .22,
    luz: { p: [-15.5, 4.1, -50], obj: [-15.5, 0, -50], c: 0xffe8c0, i: 40, d: 13, ang: 1.25 } }
];

// ---------- 1) Oclusión de esquinas (inyectada en todos los materiales con luz) ----------
const v3 = a => `vec3(${a.map(n => (+n).toFixed(3)).join(',')})`;
// Sin bucles ni arrays (el compilador D3D de Windows y el de las Quest tardan mucho con ellos): una comprobación
// desenrollada por sala. Las salas son grandes, así que por eje basta la pared más cercana: m1 = la superficie
// misma, m2 = arista (encuentro de dos planos), m3 = rincón (tres planos).
const dentroGL = s => `all(greaterThan(p, ${v3(s.min.map(n => n - .06))})) && all(lessThan(p, ${v3(s.max.map(n => n + .06))}))`;
const GLSL_SALAS = `
varying vec3 vSalaW;
float salaK(vec3 d, float suelo){
  float m1 = min(d.x, min(d.y, d.z)), m3 = max(d.x, max(d.y, d.z)), m2 = d.x + d.y + d.z - m1 - m3;
  return mix(.32, 1.0, smoothstep(0.0, .85, m2)) * mix(.7, 1.0, smoothstep(0.0, 1.3, m3)) * mix(.78, 1.0, smoothstep(0.0, .5, suelo));
}
float salaAO(vec3 p){
${SALAS.map(s => `  if (${dentroGL(s)}) { vec3 a = ${v3(s.min)}; return salaK(max(min(p - a, ${v3(s.max)} - p), 0.0), max(p.y - a.y, 0.0)); }`).join('\n')}
  return 1.0;
}
bool salaDentro(vec3 p){ return ${SALAS.map(s => `(${dentroGL(s)})`).join(' || ')}; }
`;
if (!OFF) {
  // la varying se declara en fog_pars_vertex (lo incluyen los materiales con luz, no los de sombra/profundidad)
  THREE.ShaderChunk.fog_pars_vertex = 'varying vec3 vSalaW;\n#define SALA_W\n' +THREE.ShaderChunk.fog_pars_vertex;
  THREE.ShaderChunk.project_vertex += `
#ifdef SALA_W
{ vec4 sw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  sw = instanceMatrix * sw;
#endif
  vSalaW = (modelMatrix * sw).xyz; }
#endif`;
  THREE.ShaderChunk.lights_pars_begin = GLSL_SALAS + THREE.ShaderChunk.lights_pars_begin;
  THREE.ShaderChunk.lights_fragment_end += `
{ float sk = salaAO(vSalaW);
  // los plafones alumbran hacia abajo: lo que mira al suelo dentro de una sala (techos) solo recibe rebote
  if (salaDentro(vSalaW)) { float abajo = smoothstep(.4, .9, -inverseTransformDirection(normal, viewMatrix).y);
    reflectedLight.directDiffuse *= 1.0 - .8 * abajo; reflectedLight.directSpecular *= 1.0 - .8 * abajo; }
#if defined(SALA_HORNO) && defined(USE_LIGHTMAP)
  // receptor horneado (mundo/horneado.js): R = visibilidad de las lámparas, G = oclusión ambiental real
  vec2 hv = texture2D(lightMap, vLightMapUv).rg; float ka = hv.g * mix(1.0, sk, .4), kd = mix(1.0, hv.r, .75) * mix(1.0, sk, .3);
  reflectedLight.indirectDiffuse *= ka; reflectedLight.indirectSpecular *= mix(1.0, ka, .75);
  reflectedLight.directDiffuse *= kd; reflectedLight.directSpecular *= kd; }
#else
  reflectedLight.indirectDiffuse *= sk; reflectedLight.indirectSpecular *= mix(1.0, sk, .75);
  reflectedLight.directDiffuse *= mix(1.0, sk, .6); reflectedLight.directSpecular *= mix(1.0, sk, .45); }
#endif`;
}

// ---------- 2) Luz principal con sombra (una, se muda de sala) ----------
const foco = new THREE.SpotLight(0xffffff, 0, 12, 1.2, 1, 2);
foco.castShadow = !OFF; foco.shadow.mapSize.set(512, 512); // 512: memoria de texturas (la penumbra y el horneado disimulan la resolución) foco.shadow.bias = -.0006; foco.shadow.normalBias = .025;
foco.shadow.camera.near = .2; foco.shadow.autoUpdate = false; foco.position.set(0, -90, 0);
scene.add(foco, foco.target);

// ---------- 3) Sondas de reflejo ----------
const pmrem = new THREE.PMREMGenerator(renderer);
// Ojo: renderizar la escena a una textura normal compila OTRA variante de cada shader (salida lineal, sin tonemapping):
// la primera foto costaba ~4,5 s de tirón al entrar. Marcado como destino «XR», three usa la misma variante que la
// pantalla (sRGB + ACES) → cero programas nuevos. La textura es sRGB de 8 bits: al muestrear se decodifica a lineal.
const rtCubo = new THREE.WebGLCubeRenderTarget(128, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace });
rtCubo.isXRRenderTarget = true;
const camCubo = new THREE.CubeCamera(.05, 40, rtCubo);
function fotografiar(S) {
  const c = new V3().fromArray(S.min).add(new V3().fromArray(S.max)).multiplyScalar(.5); c.y = Math.min(1.6, S.max[1] - .3);
  camCubo.position.copy(c); camCubo.updateMatrixWorld(true);
  const env = scene.environment, vis = dolly.visible; dolly.visible = false;
  scene.environment = S.sonda?.texture || env; // primer rebote con lo que haya
  const xr = renderer.xr.enabled; renderer.xr.enabled = false; // en sesión VR la CubeCamera no debe usar la cámara estéreo
  camCubo.update(renderer, scene);
  renderer.xr.enabled = xr; dolly.visible = vis; scene.environment = env;
  const viejo = S.sonda; S.sonda = pmrem.fromCubemap(rtCubo.texture); viejo?.dispose();
  S.horaSonda = G.hora;
}

// ---------- 4) Cada fotograma: ¿en qué sala estás? ----------
let actual = null, ultimo = null, t = 0, fuera = null, esperaFoto = 0;
const dentro = (S, p, m = 0) => p.x > S.min[0] - m && p.x < S.max[0] + m && p.z > S.min[2] - m && p.z < S.max[2] + m && p.y < S.max[1] + 1;
function ponerFoco(S) {
  const L = S.luz; foco.position.fromArray(L.p); foco.target.position.fromArray(L.obj); foco.target.updateMatrixWorld();
  foco.color.setHex(L.c); foco.distance = L.d; foco.angle = L.ang; foco.penumbra = 1; foco.shadow.camera.far = L.d;
  foco.shadow.needsUpdate = true;
}
function cadaFotograma(dt, pos) {
  if (OFF || G.enEspacio || !capOn.tierra) { if (actual || t > 0) { actual = null; t = 0; foco.intensity = 0; foco.shadow.autoUpdate = false; } aplicar(); return; }
  if (!actual || !dentro(actual, pos, .4)) {
    const n = SALAS.find(S => dentro(S, pos)) || null;
    if (n !== actual) { actual = n; if (n) { for (const o of SALAS) if (o !== n && o.sonda) { o.sonda.dispose(); o.sonda = null; } /* una sonda viva (~1,5 MB): memoria de texturas */ ultimo = n; ponerFoco(n); esperaFoto = .35; } }
  }
  // el foco sigue encendido en el umbral (40 cm de margen); la sombra solo se recalcula dentro
  const cerca = actual && dentro(actual, pos);
  t = Math.min(1, Math.max(0, t + (cerca ? dt : -dt) * 2.5));
  if (actual) { foco.intensity = actual.luz.i; foco.shadow.autoUpdate = !!cerca; }
  else foco.intensity = 0, foco.shadow.autoUpdate = false;
  // la foto de la sala, un instante después de entrar (para que el reparto de luces puntuales ya esté hecho)
  if (actual && cerca && (esperaFoto -= dt) <= 0 && (!actual.sonda || actual.horaSonda !== G.hora)) fotografiar(actual);
  aplicar();
}
function aplicar() {
  const T = TIMES[G.hora]; if (!T) return;
  const S = actual || ultimo, k = t * t * (3 - 2 * t);
  hemi.intensity = T.hi * (1 - k * (1 - (S?.hemi ?? 1)));
  if (scene.environment && scene.environment !== S?.sonda?.texture && !SALAS.some(s => s.sonda?.texture === scene.environment)) fuera = scene.environment;
  if (S?.sonda && k > .5) {
    scene.environment = S.sonda.texture; scene.environmentRotation.y = 0; scene.environmentIntensity = S.env;
    sun.shadow.autoUpdate = false; // de noche, dentro, la sombra de la luna no se ve: se congela y se ahorra el pase
  } else {
    if (fuera && scene.environment !== fuera) { scene.environment = fuera; scene.environmentRotation.y = T.rotE || 0; }
    scene.environmentIntensity = T.env; sun.shadow.autoUpdate = true;
  }
}
porFotograma.push(cadaFotograma);
alHora.push(() => { for (const S of SALAS) S.horaSonda = null; }); // nueva hora → la sala se vuelve a fotografiar al entrar
window.__salas = { SALAS, foco, fotografiar: id => fotografiar(SALAS.find(s => s.id === id)) };
