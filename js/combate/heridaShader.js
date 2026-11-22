// Shader de heridas: colorea los campos del atlas según TIPO de superficie y EDAD.
// Lo comparten tres materiales (un único código GLSL):
//   · matCuerpo  : calcomanías en cuerpos por código (MeshStandard + onBeforeCompile; iluminadas, con relieve)
//   · matEntorno : salpicaduras/charcos en suelo y paredes (InstancedMesh → 1 llamada de dibujo para todas)
//   · matPintura : pinta las heridas en el espacio UV de un .glb con esqueleto (render target por personaje)
// Atributos por calcomanía: aTile (u0,v0,du,dv del atlas), aHerida (t0, tipo, semilla, intensidad), aFin (hora de borrado).
import { THREE } from '../nucleo.js';
import { atlas } from './atlas.js';

export const K = { MORATON: 0, BALA_TELA: 1, BALA_PIEL: 2, CORTE_PIEL: 3, CORTE_TELA: 4, ROCE_PIEL: 5, ROCE_TELA: 6, MANCHA_TELA: 7, GOTEO_PIEL: 8, GOTEO_TELA: 9, SALPICADURA: 10, CHARCO: 11, ABOLLADURA: 12, ARANAZO: 13, HOLLIN: 14, CABLES: 15, ROZADO: 16, ACEITE_SALP: 17, ACEITE_CHARCO: 18, MANCHA_PIEL: 19 };
// segundos que dura un ciclo completo de moratón (rojo → morado-azul → amarillo-verde), comprimido para el juego
export const CICLO_MORATON = 180;
export const U = { uAtlas: { value: atlas }, uTime: { value: 0 } };

export const GLSL = /* glsl */`
uniform sampler2D uAtlas; uniform float uTime;
varying vec2 vUvH; varying vec4 vH; varying float vFin;
vec4 hCol; float hRough; float hMetal; vec3 hEmis; float hAlt;
vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
// sangre que empapa/crece: umbral sobre el campo A que baja con el tiempo; borde más oscuro al secar (anillo de café)
vec4 sangre(float A, float G, float age, float inten, float tCrece, vec3 humeda, vec3 seca, float tSeca, out float rough) {
  float grow = 1.0 - exp(-age / tCrece);
  float thF = 1.0 - clamp(inten, 0.05, 1.0) * 0.92;
  float th = mix(0.985, thF, grow);
  float vis = smoothstep(th, th + 0.045, A);
  float ring = vis * (1.0 - smoothstep(th + 0.03, th + 0.2, A));
  float dry = smoothstep(tSeca * 0.25, tSeca, age);
  vec3 c = mix(humeda, seca, dry);
  // la tela chupa: borde exterior más claro y difuso, centro más cargado; anillo oscuro al secar
  c *= mix(1.35, 0.72, smoothstep(th + 0.04, th + 0.5, A));
  c *= 1.0 - 0.55 * ring * (0.08 + dry * 0.9); // el cerco oscuro aparece al secarse, no es un contorno
  c *= 1.0 - 0.22 * G;
  rough = mix(0.16, 0.82, dry) + ring * 0.1;
  return vec4(c, vis);
}
void herida() {
  vec4 tx = texture2D(uAtlas, vUvH);
  float A = tx.a, G = tx.g, Bd = tx.b, Hh = tx.r - 0.5;
  float age = max(0.0, uTime - vH.x), inten = vH.w, sd = vH.z;
  int k = int(vH.y + 0.5);
  vec3 c = vec3(0.0); float a = 0.0, rough = 0.6, metal = 0.0, alt = Hh; vec3 e = vec3(0.0);
  if (k == 0) { // MORATÓN: rojo → morado → azul-morado → verdoso apagado → amarillo-marrón (los bordes cambian antes)
    float P = age / ${CICLO_MORATON.toFixed(1)} + (1.0 - A) * 0.12 - G * 0.06;
    vec3 rojo = vec3(0.60, 0.24, 0.25), morado = vec3(0.40, 0.17, 0.30), azul = vec3(0.27, 0.19, 0.33), verde = vec3(0.52, 0.50, 0.34), amarillo = vec3(0.70, 0.60, 0.40);
    c = mix(rojo, morado, smoothstep(0.03, 0.2, P));
    c = mix(c, azul, smoothstep(0.22, 0.45, P) * (0.4 + 0.6 * G));
    c = mix(c, verde, smoothstep(0.48, 0.72, P) * (1.0 - G * 0.6));
    c = mix(c, amarillo, smoothstep(0.7, 1.0, P));
    c *= (1.0 - 0.35 * G * (1.0 - smoothstep(0.5, 1.0, P))) * (0.85 + 0.3 * Bd);
    float hinch = smoothstep(0.0, 8.0, age) * (1.0 - smoothstep(40.0, ${CICLO_MORATON.toFixed(1)}, age));
    a = smoothstep(0.04, 0.6, A) * clamp(inten, 0.35, 1.0) * smoothstep(0.0, 3.0, age + 0.6) * (1.0 - 0.6 * smoothstep(0.6, 1.3, P)) * 0.8;
    rough = 0.55; alt = A * 0.5 * hinch;
  } else if (k == 1 || k == 7 || k == 4 || k == 6 || k == 9) { // TELA: sangre oscura que empapa + agujero/rotura
    float r; vec4 s = sangre(A, G, age, inten, k == 9 ? 0.8 : 3.5, vec3(0.2, 0.008, 0.014), vec3(0.11, 0.035, 0.03), 80.0, r);
    c = s.rgb; a = s.a * 0.93; rough = r;
    if (k == 1) { float hole = G; c = mix(c, vec3(0.02, 0.005, 0.005), hole); a = max(a, hole);
      c = mix(c, c * 0.45 + vec3(0.03, 0.025, 0.02), Bd * 0.8 * (1.0 - hole)); a = max(a, Bd * 0.8); alt = -hole * 0.45 + Bd * 0.12; rough = mix(rough, 0.95, Bd * (1.0 - hole)); }
    if (k == 4) { c = mix(c, vec3(0.04, 0.0, 0.0), G); a = max(a, G); c = mix(c, vec3(0.1, 0.08, 0.07), Bd * 0.5); a = max(a, Bd * 0.6); alt = -G * 0.8 + Bd * 0.3; }
    if (k == 6) { c = mix(c, vec3(0.42, 0.38, 0.34), G * 0.6); a = max(a, G * 0.55); alt = -G * 0.15; }
    if (k == 9) { float grow = 1.0 - pow(1.0 - clamp(age / 1.6, 0.0, 1.0), 2.0); float vis = step(G, grow * inten) * smoothstep(0.1, 0.5, A);
      c = mix(vec3(0.30, 0.02, 0.03), vec3(0.16, 0.05, 0.04), smoothstep(20.0, 80.0, age)); a = vis * 0.9; rough = mix(0.15, 0.8, smoothstep(20.0, 80.0, age)); alt = 0.0; }
  } else if (k == 2 || k == 3 || k == 5 || k == 8 || k == 19) { // PIEL: sangre brillante, carne, labios rosados
    float dry = smoothstep(25.0, 110.0, age);
    vec3 fresca = vec3(0.52, 0.02, 0.04), seca = vec3(0.24, 0.05, 0.04);
    vec3 sang = mix(fresca, seca, dry);
    rough = mix(0.12, 0.6, dry);
    if (k == 2) { // entrada de bala en piel: agujero oscuro, anillo de abrasión, halo enrojecido, sangre que sale
      float r; vec4 s = sangre(A, G, age, inten * 0.6, 2.0, vec3(0.5, 0.02, 0.04), vec3(0.24, 0.05, 0.04), 110.0, r);
      c = mix(vec3(0.55, 0.22, 0.2), s.rgb, s.a); a = max(A * 0.3, s.a * 0.95); rough = mix(0.5, r, s.a);
      c = mix(c, vec3(0.6, 0.12, 0.12), Bd); a = max(a, Bd * 0.9);
      c = mix(c, vec3(0.06, 0.0, 0.0), G); a = max(a, G); alt = -G + Bd * 0.15;
    } else if (k == 3) { // corte: carne profunda, labios abiertos, enrojecimiento
      c = mix(vec3(0.6, 0.25, 0.22), vec3(0.75, 0.38, 0.35), Bd); a = max(A * 0.35, Bd * 0.85);
      c = mix(c, mix(vec3(0.32, 0.0, 0.02), vec3(0.16, 0.03, 0.02), dry), G); a = max(a, G);
      rough = mix(0.5, mix(0.08, 0.5, dry), G); alt = -G * 0.9 + Bd * 0.35;
    } else if (k == 5) { // rozadura: piel levantada en estrías, roja y brillante
      c = mix(vec3(0.6, 0.22, 0.2), mix(vec3(0.62, 0.12, 0.1), vec3(0.35, 0.1, 0.07), dry), G); a = max(Bd * 0.45, G * 0.9); alt = -G * 0.2;
    } else if (k == 8) { // goteo en piel
      float grow = 1.0 - pow(1.0 - clamp(age / 1.4, 0.0, 1.0), 2.0); float vis = step(G, grow * inten) * smoothstep(0.1, 0.5, A);
      c = sang; a = vis * 0.95; alt = A * 0.15 * vis;
    } else { // mancha de sangre sobre piel
      float r; vec4 s = sangre(A, G, age, inten, 1.0, fresca, seca, 110.0, r); c = s.rgb; a = s.a * 0.92; rough = r; alt = 0.0;
    }
  } else if (k == 10 || k == 11 || k == 17 || k == 18) { // ENTORNO: salpicaduras y charcos (sangre o aceite)
    bool oil = k >= 17; bool pool = (k == 11 || k == 18);
    float r; vec4 s = sangre(A, G, age, inten, pool ? 9.0 : 0.25, oil ? vec3(0.04, 0.035, 0.03) : vec3(0.30, 0.012, 0.02), oil ? vec3(0.03, 0.028, 0.025) : vec3(0.13, 0.035, 0.03), oil ? 9999.0 : (pool ? 160.0 : 70.0), r);
    c = s.rgb * (pool ? 1.0 : mix(1.15, 0.6, G)); a = s.a * (pool ? 0.97 : mix(0.6, 0.95, G)); rough = oil ? 0.08 + Bd * 0.1 : r; metal = oil ? 0.2 : 0.0; alt = pool ? 0.04 * s.a : 0.0;
    if (oil) c += vec3(0.02, 0.03, 0.05) * Bd * s.a; // irisado leve
  } else if (k == 12) { // ABOLLADURA: la pintura salta y deja el metal desnudo (claro); el fondo del cráter, oscuro y caliente
    float hondo = clamp((0.5 - tx.r) * 2.4, 0.0, 1.0);
    c = mix(vec3(0.72, 0.72, 0.74), vec3(0.1, 0.09, 0.085), smoothstep(0.15, 0.75, hondo));
    c = mix(c, vec3(0.85, 0.85, 0.88), Bd * 0.7);
    a = max(G * 0.95, Bd * 0.9); metal = 0.9 - hondo * 0.5; rough = mix(0.3, 0.6, hondo); alt = Hh * 1.8;
    e = vec3(1.0, 0.36, 0.06) * smoothstep(0.4, 1.0, hondo) * exp(-age * 1.2) * 3.0;
  } else if (k == 13) { // ARAÑAZO de metal
    c = mix(vec3(0.05), vec3(0.72, 0.72, 0.75), Bd); a = max(G * 0.6, Bd * 0.95); metal = Bd; rough = mix(0.75, 0.25, Bd); alt = -Bd * 0.3;
  } else if (k == 14) { // HOLLÍN / quemadura: negro mate, centro al rojo que se apaga
    c = vec3(0.025, 0.022, 0.02) * (0.7 + 0.6 * Bd); a = A * 0.92; rough = 0.95; alt = 0.0;
    e = vec3(1.0, 0.3, 0.05) * G * exp(-age * 0.7) * 4.0;
  } else if (k == 15) { // CABLES expuestos: agujero oscuro, borde de chapa, cables que chisporrotean
    c = mix(vec3(0.015), vec3(0.6, 0.6, 0.62), Bd); a = max(A, Bd); metal = Bd; rough = 0.5; alt = Hh * 1.4;
    float fl = 0.55 + 0.45 * sin(uTime * 17.0 + sd * 40.0) * sin(uTime * 5.3 + sd * 9.0);
    c = mix(c, vec3(0.2, 0.7, 0.9), G); e = mix(vec3(0.15, 0.8, 1.0), vec3(1.0, 0.5, 0.1), step(0.5, fract(sd * 7.0))) * G * fl * 3.0;
  } else if (k == 16) { // ROZADO en tela por golpe: polvo y arruga, muy sutil
    c = mix(vec3(0.0), vec3(0.45, 0.42, 0.38), smoothstep(0.3, 0.8, Bd)); a = A * 0.22 * clamp(inten, 0.3, 1.0); rough = 0.95; alt = A * 0.1;
  }
  float fade = clamp((vFin - uTime) / 3.0, 0.0, 1.0);
  hCol = vec4(s2l(c), a * fade); hRough = clamp(rough, 0.04, 1.0); hMetal = metal; hEmis = e * fade; hAlt = alt * fade;
}
`;
const VERT_DECL = 'attribute vec4 aTile; attribute vec4 aHerida; attribute float aFin; varying vec2 vUvH; varying vec4 vH; varying float vFin;\n';
const VERT_SET = 'vUvH = aTile.xy + uv * aTile.zw; vH = aHerida; vFin = aFin;\n';
// relieve a partir de la derivada en pantalla de hAlt (sin tangentes)
const BUMP = /* glsl */`
{ float hb = hAlt * 0.012; vec2 dH = vec2(dFdx(hb), dFdy(hb));
  vec3 sX = dFdx(-vViewPosition), sY = dFdy(-vViewPosition), R1 = cross(sY, normal), R2 = cross(normal, sX);
  float det = dot(sX, R1) * faceDirection; vec3 gr = sign(det) * (dH.x * R1 + dH.y * R2);
  normal = normalize(abs(det) * normal - gr); }
`;
function inyectar(sh) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = VERT_DECL + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n' + VERT_SET);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + GLSL)
    .replace('#include <map_fragment>', 'herida(); diffuseColor.rgb = hCol.rgb; diffuseColor.a *= hCol.a; if (diffuseColor.a < 0.004) discard;')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = hRough;')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = hMetal;')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + BUMP)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += hEmis;');
}
function matHerida(nombre) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: .6, metalness: 0 });
  m.onBeforeCompile = inyectar; m.customProgramCacheKey = () => 'herida-' + nombre; m.name = 'herida-' + nombre;
  return m;
}
export const matCuerpo = matHerida('cuerpo');
export const matEntorno = matHerida('entorno');
// pintura en espacio UV (sin luz: el material del personaje ya la aplica)
export const matPintura = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: VERT_DECL + 'void main() { ' + VERT_SET + ' gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: GLSL + 'void main() { herida(); gl_FragColor = vec4(hCol.rgb, hCol.a); }'
});
// atributos de una calcomanía suelta (geometría propia de 4 vértices)
export function geoHerida(tile, t0, tipo, semilla, inten, fin) {
  const g = new THREE.PlaneGeometry(1, 1), n = 4;
  g.setAttribute('aTile', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => tile[i % 4]), 4));
  g.setAttribute('aHerida', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => [t0, tipo, semilla, inten][i % 4]), 4));
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(new Float32Array(n).fill(fin), 1));
  return g;
}
export function setHerida(g, comp, v) { const at = g.attributes.aHerida; for (let i = 0; i < at.count; i++) at.setComponent(i, comp, v); at.needsUpdate = true; }
export const getHerida = (g, comp) => g.attributes.aHerida.getComponent(0, comp);
