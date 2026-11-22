// Finaliza un GLB crudo (salido de Blender) para WebXR / Quest 3 con @gltf-transform/cli 4.5.1.
//
// Uso:
//   node tools/finalizar.mjs <entrada.glb> <salida.glb> [--tex ktx2|webp] [--tam 2048] [--tam-normal 1024] [--etc1s-q 160] [--fallback-webp]
//
//   --tex ktx2 (defecto): baseColor/emissive -> ETC1S (KHR_texture_basisu), normal + metalRough -> UASTC.
//                         Necesita toktx (KTX-Software) en el PATH o en C:\Program Files\KTX-Software\bin.
//   --tex webp          : todas las texturas a WebP (EXT_texture_webp), calidad 88.
//   --fallback-webp     : con ktx2, escribe además <salida>_webp.glb (copia WebP).
// Cadena: dedup -> weld -> prune -> resize(tam) -> texturas -> meshopt (EXT_meshopt_compression).
// El script imprime cada comando; queda registro en tools/README.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const [entrada, salida] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').match(/^--(tex|tam|etc1s-q|tam-normal)$/));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const TEX = opt('tex', 'ktx2');
const TAM = opt('tam', '2048');
const FALLBACK = args.includes('--fallback-webp');
const ETC1S_Q = opt('etc1s-q', '160');
const TAM_NORMAL = opt('tam-normal', null); // p.ej. 1024: la normal UASTC 2048 pesa ~4 MB
if (!entrada || !salida) { console.error('uso: node tools/finalizar.mjs in.glb out.glb [--tex ktx2|webp] [--tam 2048] [--fallback-webp]'); process.exit(1); }

const KTX_BIN = 'C:\\Program Files\\KTX-Software\\bin';
const env = { ...process.env };
if (fs.existsSync(KTX_BIN)) env.PATH = KTX_BIN + path.delimiter + env.PATH;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gltf-fin-'));
let paso = 0;
let actual = path.resolve(entrada);
function gt(cmd, ...extra) {
  const out = path.join(tmpDir, `${String(++paso).padStart(2, '0')}_${cmd}.glb`);
  const a = ['-y', '@gltf-transform/cli@4.5.1', cmd, actual, out, ...extra];
  console.log('$ npx', a.slice(1).join(' ').replace(actual, path.basename(actual)).replace(out, path.basename(out)));
  execFileSync('npx', a, { stdio: ['ignore', 'ignore', 'inherit'], env, shell: true });
  actual = out;
  return out;
}

gt('dedup');
gt('weld');
gt('prune');
gt('resize', '--width', TAM, '--height', TAM);
if (TAM_NORMAL) gt('resize', '--pattern', '"*normal*"', '--width', TAM_NORMAL, '--height', TAM_NORMAL);
const base = actual;

function texturasWebp() { gt('webp', '--quality', '88'); }
function texturasKtx2() {
  // color y metal/rough en ETC1S (pequeño); normal en UASTC+RDO+zstd (ETC1S destroza normales)
  gt('etc1s', '--slots', '{baseColorTexture,emissiveTexture,metallicRoughnessTexture,occlusionTexture}', '--quality', ETC1S_Q);
  gt('uastc', '--slots', 'normalTexture', '--level', '2', '--rdo', '--rdo-lambda', '2', '--zstd', '18');
}

if (TEX === 'webp') texturasWebp(); else texturasKtx2();
gt('meshopt', '--level', 'medium');
fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
fs.copyFileSync(actual, salida);
console.log('->', salida, (fs.statSync(salida).size / 1048576).toFixed(2), 'MB');

if (TEX !== 'webp' && FALLBACK) {
  actual = base;
  texturasWebp();
  gt('meshopt', '--level', 'medium');
  const fb = salida.replace(/\.glb$/i, '_webp.glb');
  fs.copyFileSync(actual, fb);
  console.log('->', fb, (fs.statSync(fb).size / 1048576).toFixed(2), 'MB');
}
fs.rmSync(tmpDir, { recursive: true, force: true });
