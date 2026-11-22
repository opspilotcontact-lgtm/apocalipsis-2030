// Órbita: la Tierra abajo, asteroides, restos de naves y La Corona a lo lejos. Cierre del Acto I y base del Acto II.
import { THREE, V3, G, rnd, std, glow, cv2d, toTex, capas, M, rbox, sunDir, camera } from '../nucleo.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

export const ESP = { asteroides: [], corona: null, tierra: null, restos: [] };

// Tierra procedural: continentes por ruido 3D sobre la esfera (sin costura), color por latitud y altura,
// mapa de relieve, luces de ciudades (emisivo) y una capa de nubes aparte. Se calcula una vez (1024×512).
function ruido3() {
  const P = new Uint8Array(512); const p = [...Array(256).keys()].sort(() => Math.random() - .5); for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const f = t => t * t * (3 - 2 * t), L = (a, b, t) => a + (b - a) * t, h = (i, j, k) => P[P[P[i & 255] + (j & 255)] + (k & 255)] / 255;
  const n = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = f(x - i), v = f(y - j), w = f(z - k);
    return L(L(L(h(i, j, k), h(i + 1, j, k), u), L(h(i, j + 1, k), h(i + 1, j + 1, k), u), v), L(L(h(i, j, k + 1), h(i + 1, j, k + 1), u), L(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), u), v), w); };
  return (x, y, z, oct = 5) => { let s = 0, a = .5, fr = 1, tot = 0; for (let o = 0; o < oct; o++) { s += a * n(x * fr, y * fr, z * fr); tot += a; a *= .5; fr *= 2.03; } return s / tot; };
}
// se calcula a 512×256 por tandas de filas (sin bloquear el arranque) y se amplía a 1024×512 con suavizado
function texturasTierra(listo) {
  const W = 512, H = 256, fbm = ruido3(), fbmN = ruido3();
  const [c, x] = cv2d(W, H), [bc, bx] = cv2d(W, H), [ec, ex] = cv2d(W, H), [nc, nx] = cv2d(W, H);
  const im = x.createImageData(W, H), ib = bx.createImageData(W, H), ie = ex.createImageData(W, H), inb = nx.createImageData(W, H);
  let j = 0;
  const tanda = () => { const fin = Math.min(H, j + 16); for (; j < fin; j++) { const lat = (j / H - .5) * Math.PI, cy = Math.sin(-lat), cr = Math.cos(lat);
    for (let i = 0; i < W; i++) { const lon = i / W * Math.PI * 2, px = Math.cos(lon) * cr, pz = Math.sin(lon) * cr, k = (j * W + i) * 4;
      const hgt = fbm(px * 1.6 + 5, cy * 1.6, pz * 1.6, 6), tierra = hgt > .52, al = Math.abs(cy);
      let r, g, b;
      if (tierra) { const e = Math.min(1, (hgt - .52) * 6), seco = fbm(px * 3 + 9, cy * 3, pz * 3, 3), desierto = Math.max(0, 1 - Math.abs(al - .38) * 4) * Math.max(0, seco - .4) * 2.5;
        r = 50 + e * 50 + desierto * 120; g = 74 + e * 25 + desierto * 70; b = 32 + e * 18 + desierto * 30;
        if (e > .6) { r += 35; g += 28; b += 22; } }
      else { const d = Math.min(1, (.52 - hgt) * 8); r = 6 + (1 - d) * 24; g = 24 + (1 - d) * 52; b = 62 + (1 - d) * 62; }
      if (al > .86 + (fbm(px * 4, cy * 4, pz * 4, 2) - .5) * .14) { r = g = 232; b = 242; }
      im.data[k] = r; im.data[k + 1] = g; im.data[k + 2] = b; im.data[k + 3] = 255;
      const bh = tierra ? 90 + (hgt - .52) * 700 : 40; ib.data[k] = ib.data[k + 1] = ib.data[k + 2] = Math.min(255, bh); ib.data[k + 3] = 255;
      const ciudad = tierra && al < .7 && fbm(px * 9, cy * 9, pz * 9, 2) > .6 && Math.random() < .22 ? Math.random() : 0; ie.data[k] = 255 * ciudad; ie.data[k + 1] = 170 * ciudad; ie.data[k + 2] = 90 * ciudad; ie.data[k + 3] = 255;
      const cl = fbmN(px * 2.2, cy * 3.2, pz * 2.2, 6), nube = Math.max(0, Math.min(1, (cl - .5) * 4)); inb.data[k] = inb.data[k + 1] = inb.data[k + 2] = 255; inb.data[k + 3] = 255 * nube * .9; } }
    if (j < H) { setTimeout(tanda, 0); return; }
    x.putImageData(im, 0, 0); bx.putImageData(ib, 0, 0); ex.putImageData(ie, 0, 0); nx.putImageData(inb, 0, 0);
    const amplia = src => { const [c2, x2] = cv2d(W * 2, H * 2); x2.imageSmoothingQuality = 'high'; x2.drawImage(src, 0, 0, W * 2, H * 2); return toTex(c2, false); };
    const map = amplia(c), bump = amplia(bc), em = amplia(ec), nubes = amplia(nc); bump.colorSpace = THREE.NoColorSpace;
    for (const t of [map, bump, em, nubes]) t.wrapS = THREE.RepeatWrapping;
    listo({ map, bump, em, nubes });
  };
  setTimeout(tanda, 0);
}
// texturas PBR reutilizadas de assets/texturas para rocas y chatarra
const TLe = new THREE.TextureLoader();
const txE = (n, srgb, rep = 1) => { const t = TLe.load('assets/texturas/' + n + '.webp'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; };
function haloTex() { const [c, x] = cv2d(64, 64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return toTex(c, false); }
function roca(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + (Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * Math.sin(v.z * 1.9 + seed * 2)) * .28; v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}

// fusiona mallas sueltas (posición/rotación/escala ya puestas) en una sola geometría
function fundir(mallas) { const gs = mallas.map(m => { m.updateMatrix(); const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); return g.applyMatrix4(m.matrix); }); return BGU.mergeGeometries(gs, false); }
const U_SOL = { value: new V3(0, 1, 0) }; // dirección del sol en espacio de vista (se actualiza cada fotograma)
export function construirEspacio() {
  const E = capas.espacio;
  // ---- la Tierra: mapa procedural, relieve, nubes, luces de ciudad SOLO en la cara de noche y atmósfera con dispersión ----
  const matT = std({ color: 0x1a3a6a, roughness: .75, metalness: 0, emissive: 0xffb070, emissiveIntensity: 0 });
  matT.onBeforeCompile = sh => { sh.uniforms.uSol = U_SOL; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSol;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep(.12, -.3, dot(normal, uSol)) * 2.5;'); };
  const tierra = new THREE.Mesh(new THREE.SphereGeometry(150, 96, 48), matT);
  tierra.position.set(0, -205, -40); tierra.rotation.z = .35; E.add(tierra); ESP.tierra = tierra;
  const matN = std({ transparent: true, opacity: 0, roughness: 1, depthWrite: false });
  const nubes = new THREE.Mesh(new THREE.SphereGeometry(151.2, 96, 48), matN);
  tierra.add(nubes); ESP.nubes = nubes;
  texturasTierra(TT => { Object.assign(matT, { map: TT.map, bumpMap: TT.bump, bumpScale: 2.2, emissiveMap: TT.em, emissiveIntensity: .45 }); matT.color.set(0xffffff); matT.needsUpdate = true;
    Object.assign(matN, { map: TT.nubes, opacity: 1 }); matN.needsUpdate = true; });
  const atm = new THREE.Mesh(new THREE.SphereGeometry(157, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uSol: U_SOL },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uSol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 + dot(vN, vV), 0.0, 1.0), 3.5); float dia = dot(-vN, uSol); float luz = smoothstep(-.35, .25, dia); vec3 c = mix(vec3(1.0, .45, .2), vec3(.35, .62, 1.0), smoothstep(-.1, .35, dia)); gl_FragColor = vec4(c * f * 1.8 * luz, f * luz); }'
  }));
  atm.position.copy(tierra.position); E.add(atm);
  // ---- resplandor del sol (sprite grande + brillo) siempre en la dirección de la luz ----
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const [c, x] = cv2d(256, 256); let g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(.06, 'rgba(255,250,235,.95)'); g.addColorStop(.2, 'rgba(255,220,170,.25)'); g.addColorStop(1, 'rgba(255,200,150,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,240,220,.25)'; x.lineWidth = 3; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI; x.beginPath(); x.moveTo(128 - Math.cos(a) * 128, 128 - Math.sin(a) * 128); x.lineTo(128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128); x.stroke(); } return toTex(c, false); })(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  glare.scale.setScalar(60); E.add(glare); ESP.glare = glare;
  // ---- asteroides: 4 formas base instanciadas (4 llamadas en vez de 46) ----
  const rocaMat = std({ map: txE('rusty_metal_02_diff', true, 2), color: 0x8a8278, normalMap: txE('concrete_floor_worn_001_nor_gl', false, 2), normalScale: new THREE.Vector2(1.4, 1.4), roughnessMap: txE('rusty_metal_02_arm', false, 2), roughness: 1, metalness: .1, flatShading: true });
  ESP.rocas = [];
  for (let k = 0; k < 4; k++) { const n = 14, im = new THREE.InstancedMesh(roca(1, k * 3.7 + 1), rocaMat, n); im.frustumCulled = false; const est = [];
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), d = rnd(28, 130); est.push({ p: new V3(Math.cos(a) * d, rnd(-18, 34), -Math.abs(Math.sin(a) * d) - rnd(10, 60)), s: rnd(.5, 4.8) * (Math.random() < .1 ? 2 : 1), q: new THREE.Quaternion().random(), w: new V3(rnd(-.3, .3), rnd(-.3, .3), rnd(-.3, .3)), v: new V3(rnd(-.4, .4), rnd(-.15, .15), rnd(-.2, .5)) }); }
    E.add(im); ESP.rocas.push({ im, est }); }
  // ---- campo de restos: placas, vigas, paneles solares rotos y cables (instanciados por tipo) ----
  const casco = std({ color: 0xc8ccd4, metalness: .7, roughness: .4, map: txE('metal_plate_diff', true), normalMap: txE('metal_plate_nor_gl', false) }), quemado = std({ map: txE('rusty_metal_02_diff', true), normalMap: txE('rusty_metal_02_nor_gl', false), color: 0x6a605a, metalness: .5, roughness: .8 });
  const solar = std({ map: (() => { const [c, x] = cv2d(128, 128); x.fillStyle = '#0a1a3a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#8a9ab0'; x.lineWidth = 2; for (let i = 0; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); } return toTex(c, false); })(), metalness: .6, roughness: .25 });
  ESP.restosI = [];
  for (const [geo, mat, n] of [[new THREE.BoxGeometry(2, .12, 1.4), casco, 16], [new THREE.BoxGeometry(1.8, .15, 1.2), quemado, 12], [new THREE.CylinderGeometry(.12, .12, 4, 6), quemado, 10], [new THREE.BoxGeometry(3, .04, 1.5), solar, 8]]) {
    const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; const est = [];
    for (let i = 0; i < n; i++) est.push({ p: new V3(rnd(-45, 45), rnd(-6, 16), rnd(-75, -22)), s: rnd(.5, 1.6), q: new THREE.Quaternion().random(), w: new V3(rnd(-.5, .5), rnd(-.5, .5), rnd(-.5, .5)), v: new V3() });
    E.add(im); ESP.restosI.push({ im, est }); }
  { // la nave equivocada (acto II): un casco cilíndrico con una brecha
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 22, 20, 1, true), std({ color: 0xc9ccd2, metalness: .55, roughness: .4, side: THREE.DoubleSide, map: txE('metal_plate_diff', true, 3), normalMap: txE('metal_plate_nor_gl', false, 3) }));
    body.rotation.z = Math.PI / 2; g.add(body);
    for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), casco); cap.rotation.z = -s * Math.PI / 2; cap.position.x = s * 11; g.add(cap); }
    for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.8, .5), glow(0x9fd2ff, 2)); w.position.set(-8 + i * 3, .8, 3.22); g.add(w); }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(10, .1, 3.5), solar); panel.position.set(0, 0, -6); g.add(panel);
    const halo = new THREE.SpriteMaterial({ map: haloTex(), color: 0x7fc8ff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const z of [-1.4, 1.4]) { const tob = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.2, 1.4, 16, 1, true), std({ color: 0x2a2c30, metalness: .8, roughness: .35, side: THREE.DoubleSide })); tob.rotation.z = Math.PI / 2; tob.position.set(-14.6, 0, z); g.add(tob);
      const n = new THREE.Mesh(new THREE.CircleGeometry(.85, 16), glow(0x6fd0ff, 6)); n.rotation.y = -Math.PI / 2; n.position.set(-15.25, 0, z); g.add(n);
      const sp = new THREE.Sprite(halo); sp.scale.setScalar(5); sp.position.set(-15.8, 0, z); g.add(sp); }
    g.position.set(-26, 6, -58); g.rotation.set(.2, .5, .15); E.add(g); ESP.nave = g;
  }
  { // La Corona: anillo de chatarra con púas, radios, tubos y un núcleo; luces rojas que laten en cadena
    const g = new THREE.Group(), chat = std({ color: 0x4a4440, metalness: .75, roughness: .55, map: txE('rusty_metal_02_diff', true, 3), normalMap: txE('rusty_metal_02_nor_gl', false, 3) });
    const piezas = [new THREE.Mesh(new THREE.TorusGeometry(16, 3, 12, 48)), new THREE.Mesh(new THREE.TorusGeometry(10, .8, 8, 36))];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, L = rnd(6, 15), sp = new THREE.Mesh(new THREE.ConeGeometry(rnd(.8, 1.4), L, 5)); sp.position.set(Math.cos(a) * (18 + L * .3), Math.sin(a) * (18 + L * .3), rnd(-1, 1)); sp.rotation.z = a - Math.PI / 2; piezas.push(sp); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, sp = new THREE.Mesh(new THREE.BoxGeometry(.8, 12, .8)); sp.position.set(Math.cos(a) * 9.5, Math.sin(a) * 9.5, 0); sp.rotation.z = a - Math.PI / 2; piezas.push(sp); }
    for (let i = 0; i < 60; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(rnd(1, 4.5), rnd(1, 4.5), rnd(1, 4.5))); const a = rnd(0, Math.PI * 2), d = rnd(13, 21); b.position.set(Math.cos(a) * d, Math.sin(a) * d, rnd(-3.5, 3.5)); b.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); piezas.push(b); }
    for (let i = 0; i < 16; i++) { const a = rnd(0, Math.PI * 2), t = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, rnd(8, 16), 6)); t.position.set(Math.cos(a) * 16, Math.sin(a) * 16, rnd(-3, 3)); t.rotation.set(rnd(0, 3), rnd(0, 3), 0); piezas.push(t); }
    g.add(new THREE.Mesh(fundir(piezas), chat));
    const rojo = glow(0xff2a1a, 5), luces = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(.6, 8, 6)); l.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 3.3); luces.push(l); }
    g.add(new THREE.Mesh(fundir(luces), rojo)); ESP.rojo = rojo;
    const haloR = new THREE.SpriteMaterial({ map: haloTex(), color: 0xff2a1a, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: .8 }); ESP.haloR = haloR;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, s = new THREE.Sprite(haloR); s.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 3.6); s.scale.setScalar(5); g.add(s); }
    const core = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), glow(0xff3b1f, 3)); g.add(core); ESP.nucleo = core;
    const cs = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xff3010, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); cs.scale.setScalar(26); g.add(cs);
    g.position.set(40, 30, -175); g.rotation.set(.3, -.6, 0); E.add(g); ESP.corona = g;
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _e = new THREE.Euler();
function moverInst(lista, dt) { for (const { im, est } of lista) { est.forEach((o, i) => { o.p.addScaledVector(o.v, dt); _e.set(o.w.x * dt, o.w.y * dt, o.w.z * dt); o.q.multiply(_q.setFromEuler(_e)); _m.compose(o.p, o.q, _s.setScalar(o.s)); im.setMatrixAt(i, _m); }); im.instanceMatrix.needsUpdate = true; } }
export function actualizarEspacio(dt) {
  if (ESP.rocas) moverInst(ESP.rocas, dt); if (ESP.restosI) moverInst(ESP.restosI, dt);
  const t = G.time;
  if (ESP.corona) ESP.corona.rotation.z += dt * .05;
  if (ESP.rojo) { ESP.rojo.emissiveIntensity = 3 + 4 * Math.pow(.5 + .5 * Math.sin(t * 2.2), 4); ESP.haloR.opacity = .35 + .6 * Math.pow(.5 + .5 * Math.sin(t * 2.2), 4); }
  if (ESP.nucleo) ESP.nucleo.material.emissiveIntensity = 2.5 + Math.sin(t * 1.3) * .8;
  if (ESP.tierra) ESP.tierra.rotation.y += dt * .004;
  if (ESP.nubes) ESP.nubes.rotation.y += dt * .0025;
  U_SOL.value.copy(sunDir).transformDirection(camera.matrixWorldInverse);
  if (ESP.glare) ESP.glare.position.copy(G.CAM).addScaledVector(sunDir, 180);
}
