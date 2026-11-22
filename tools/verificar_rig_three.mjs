// Verifica personajes riggeados (autorig.py) con three r170: carga cada GLB y le aplica sus clips propios y los
// compartidos de assets/personajes/anim (Walking, Running, Head_Hit). Informa alturas de cadera/cabeza/pies.
//   node verificar_rig_three.mjs <raiz del repo> assets/personajes/Mike_animado_webp.glb ...
// (three@0.170.0 instalado junto al script; los *_webp.glb no necesitan KTX2Loader)
globalThis.self = globalThis; URL.createObjectURL = () => 'data:,'; URL.revokeObjectURL = () => {}; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
globalThis.Image = class { constructor() { this.height = 1; } set src(v) { setTimeout(() => this.onload && this.onload(), 0); } };
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const [R, ...glbs] = process.argv.slice(2);
const ld = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cargar = (p) => { const b = fs.readFileSync(p); return new Promise((ok, ko) => ld.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '', ok, ko)); };
console.error = () => {}; console.warn = () => {};
const lib = {};
for (const n of ['Walking', 'Running', 'Head_Hit']) lib[n] = (await cargar(`${R}/assets/personajes/anim/${n}.glb`)).animations[0];
for (const f of glbs) {
  const g = await cargar(`${R}/${f}`);
  const root = g.scene; root.updateMatrixWorld(true);
  const B = (n) => root.getObjectByName(n);
  const sk = []; root.traverse(o => { if (o.isSkinnedMesh) sk.push(o); });
  const box = new THREE.Box3().setFromObject(root);
  const P = ['mixamorigHips', 'mixamorigHead', 'mixamorigLeftFoot', 'mixamorigRightFoot', 'mixamorigLeftHand'];
  const H = box.max.y - box.min.y;
  console.log(`${f}: skinned ${sk.length}, huesos ${sk[0]?.skeleton.bones.length}, alto reposo ${H.toFixed(3)} m, clips [${g.animations.map(c => c.name)}]`);
  const clips = [...g.animations.map(c => ['propio:' + c.name, c]), ...Object.entries(lib)];
  for (const [nom, clip] of clips) {
    const mx = new THREE.AnimationMixer(root); const ac = mx.clipAction(clip); ac.play();
    const faltan = clip.tracks.filter(t => !B(t.name.split('.')[0])).length;
    let r = { hips: [9, -9], head: [9, -9], pie: 9 }, mal = false;
    for (const t of [0, 0.2, 0.4, 0.6, 0.8]) {
      mx.setTime(t * clip.duration); root.updateMatrixWorld(true);
      const [h, hd, lf, rf] = P.map(n => B(n).getWorldPosition(new THREE.Vector3()));
      if (![h, hd, lf, rf].every(v => isFinite(v.x + v.y + v.z))) mal = true;
      r.hips = [Math.min(r.hips[0], h.y), Math.max(r.hips[1], h.y)];
      r.head = [Math.min(r.head[0], hd.y), Math.max(r.head[1], hd.y)];
      r.pie = Math.min(r.pie, lf.y, rf.y);
    }
    mx.stopAllAction(); mx.uncacheRoot(root);
    const ok = !mal && faltan === 0 && r.head[1] > r.hips[1] && r.hips[0] > 0.3 * H && r.pie > -0.08 * H;
    console.log(`  ${nom.padEnd(16)} sin_hueso ${faltan} cadera_y ${r.hips.map(v => v.toFixed(2)).join('..')} cabeza_y ${r.head.map(v => v.toFixed(2)).join('..')} pie_min ${r.pie.toFixed(2)} ${ok ? 'OK' : 'REVISAR'}`);
  }
}
