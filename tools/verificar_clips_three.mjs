// Verifica clips de assets/personajes/anim con three r170 (el consumidor real) aplicándolos a Dave_animado.
globalThis.self = globalThis; URL.createObjectURL = () => 'data:,'; URL.revokeObjectURL = () => {}; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const R = process.argv[2];
const ld = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cargar = (p) => { const b = fs.readFileSync(p); return new Promise((ok, ko) => ld.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '', ok, ko)); };
console.error = () => {}; console.warn = () => {};
const dave = await cargar(`${R}/assets_src/derivados/Dave_animado_crudo.glb`);
const root = dave.scene; root.updateMatrixWorld(true);
const B = (n) => root.getObjectByName(n);
const P = ['mixamorigHips', 'mixamorigHead', 'mixamorigLeftHand', 'mixamorigRightHand', 'mixamorigLeftFoot', 'mixamorigRightFoot'];
const pos = () => P.map(n => B(n).getWorldPosition(new THREE.Vector3()));
function muestrear(clip, ts) {
  const mx = new THREE.AnimationMixer(root); const ac = mx.clipAction(clip); ac.play();
  return ts.map(t => { mx.setTime(t * clip.duration); root.updateMatrixWorld(true); return pos(); });
}
const ts = [0, 0.25, 0.5, 0.75];
// referencia: el Walk propio de Dave_animado (verificado en Blender) contra Walking de la biblioteca
const ref = muestrear(dave.animations.find(c => c.name === 'Walk'), ts);
const files = fs.readdirSync(`${R}/assets/personajes/anim`).filter(f => f.endsWith('.glb')).sort();
for (const f of files) {
  const g = await cargar(`${R}/assets/personajes/anim/${f}`);
  const c = g.animations[0];
  const faltan = c.tracks.filter(t => !B(t.name.split('.')[0])).length;
  const esc = c.tracks.filter(t => t.name.endsWith('.scale')).length;
  const m = muestrear(c, ts);
  let diag = [];
  for (const fr of m) {
    const [h, hd, lh, rh, lf, rf] = fr;
    if (fr.some(v => !isFinite(v.x + v.y + v.z))) diag.push('NaN');
    if (hd.distanceTo(h) < 0.35 || hd.distanceTo(h) > 0.8) diag.push('cuello?');
    if (lh.distanceTo(hd) > 1.1 || rh.distanceTo(hd) > 1.1) diag.push('mano lejos');
    if (lf.distanceTo(h) > 1.1 || rf.distanceTo(h) > 1.1) diag.push('pie lejos');
  }
  let vsRef = '';
  if (f === 'Walking.glb') vsRef = ' |Δ vs Walk de Dave máx ' + Math.max(...m.flatMap((fr, i) => fr.map((v, k) => v.distanceTo(ref[i][k])))).toFixed(4) + ' m';
  const [h0, hd0] = m[0];
  console.log(`${f.padEnd(28)} ${c.duration.toFixed(2)}s pistas ${c.tracks.length} sin_hueso ${faltan} escala ${esc} hips_y ${h0.y.toFixed(2)} cabeza_y ${hd0.y.toFixed(2)} ${[...new Set(diag)].join(',') || 'OK'}${vsRef} extras ${JSON.stringify(g.parser.json.animations[0].extras || {})}`);
}
