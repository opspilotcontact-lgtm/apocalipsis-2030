// Uso: node tools/inspeccionar_glb.mjs archivo.glb [--json]
// Lee el chunk JSON de un GLB y resume tris, skins, animaciones, bounds, texturas, nodos ancla.
import fs from 'node:fs';
import path from 'node:path';

function leerGLB(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('no es GLB: ' + file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  return { json, size: buf.length };
}

function mat4(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  const [x, y, z, w] = r;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0,
    (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0,
    (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1];
}
function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
function tp(m, p) { return [0, 1, 2].map(i => m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]); }

export function resumir(file) {
  const { json, size } = leerGLB(file);
  let tris = 0;
  const meshTris = (mi) => {
    let t = 0;
    for (const p of json.meshes[mi].primitives) {
      const mode = p.mode ?? 4;
      const n = p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count;
      if (mode === 4) t += n / 3;
    }
    return t;
  };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const anchors = [];
  const visit = (ni, parent) => {
    const n = json.nodes[ni];
    const m = mul(parent, mat4(n));
    if (n.mesh !== undefined) {
      tris += meshTris(n.mesh);
      for (const p of json.meshes[n.mesh].primitives) {
        const a = json.accessors[p.attributes.POSITION];
        if (!a.min) continue;
        const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
        const dq = (v) => a.normalized ? v.map(x => Math.max(x / NORM[a.componentType], -1)) : v;
        a.min = dq(a.min); a.max = dq(a.max); a.normalized = false;
        for (let i = 0; i < 8; i++) {
          const c = [i & 1 ? a.max[0] : a.min[0], i & 2 ? a.max[1] : a.min[1], i & 4 ? a.max[2] : a.min[2]];
          const w = n.skin !== undefined ? c : tp(m, c); // skinned: bind pose aprox. (mesh space)
          for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]); }
        }
      }
    } else if (!(n.children && n.children.length) && n.name && !(json.skins || []).some(s => s.joints.includes(ni))) {
      anchors.push({ name: n.name, pos: tp(m, [0, 0, 0]).map(v => +v.toFixed(3)) });
    }
    for (const c of n.children || []) visit(c, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const scene = json.scenes[json.scene ?? 0];
  for (const r of scene.nodes) visit(r, I);
  const slotDe = {};
  for (const m of json.materials || []) {
    const pbr = m.pbrMetallicRoughness || {};
    const marcar = (t, n) => { if (t) { const tex = json.textures[t.index]; const src = tex.source ?? Object.values(tex.extensions || {})[0]?.source; slotDe[src] = n; } };
    marcar(pbr.baseColorTexture, 'baseColor'); marcar(pbr.metallicRoughnessTexture, 'metalRough');
    marcar(m.normalTexture, 'normal'); marcar(m.emissiveTexture, 'emissive'); marcar(m.occlusionTexture, 'occlusion');
  }
  const imgs = (json.images || []).map((i, k) => (slotDe[k] || '?') + ':' + (i.mimeType || path.extname(i.uri || '')));
  const texSizes = (json.images || []).map(i => {
    if (i.bufferView === undefined) return null;
    return json.bufferViews[i.bufferView].byteLength;
  });
  return {
    file: path.basename(file), bytes: size, MB: +(size / 1048576).toFixed(2), tris: Math.round(tris),
    meshes: (json.meshes || []).length, materials: (json.materials || []).map(m => m.name),
    skins: (json.skins || []).map(s => s.joints.length), animations: (json.animations || []).map(a => a.name),
    images: imgs, imageBytes: texSizes,
    bounds: { min: min.map(v => +v.toFixed(3)), max: max.map(v => +v.toFixed(3)), size: max.map((v, i) => +(v - min[i]).toFixed(3)) },
    extensionsUsed: json.extensionsUsed || [], anchors,
    rootNodes: scene.nodes.map(i => ({ name: json.nodes[i].name, rot: json.nodes[i].rotation, s: json.nodes[i].scale, t: json.nodes[i].translation })),
  };
}

if (process.argv[1] && process.argv[1].endsWith('inspeccionar_glb.mjs')) {
  for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
    const r = resumir(f);
    console.log(JSON.stringify(r, null, process.argv.includes('--json') ? 2 : 0));
  }
}
