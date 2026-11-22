// Medición de rendimiento: memoria de texturas en GPU, llamadas y triángulos.
// Con ?stats se espía WebGL (texStorage/texImage/compressed*) para sumar los bytes REALES que se reservan
// por textura (mipmaps y formato incluidos) y se muestra un contador en pantalla. window.__perf() imprime la
// tabla en consola y devuelve el resumen (sin ?stats: estimación desde las texturas de la escena).
// Se importa ANTES que nucleo.js (main.js) para enganchar WebGL antes de la primera subida.
const STATS = new URLSearchParams(location.search).has('stats');

// bytes por píxel de formatos sin comprimir y bytes por bloque 4×4 de los comprimidos
const BPP = { 0x8058: 4, 0x8C43: 4, 0x8051: 4, 0x8C41: 4, 0x881A: 8, 0x8814: 16, 0x881B: 8, 0x8815: 16, 0x8229: 1, 0x822B: 2, 0x822D: 2, 0x822F: 4, 0x822E: 4, 0x8230: 8,
  0x81A5: 2, 0x81A6: 4, 0x8CAC: 4, 0x88F0: 4, 0x8CAD: 8, 0x8C3A: 4, 0x8C3D: 4, 0x8059: 4, 0x8D62: 2, 0x8056: 2, 0x8057: 2 };
const BLOQUE = { 0x83F0: 8, 0x83F1: 8, 0x83F2: 16, 0x83F3: 16, 0x8C4C: 8, 0x8C4D: 8, 0x8C4E: 16, 0x8C4F: 16, 0x8E8C: 16, 0x8E8D: 16, 0x8DBB: 8, 0x8DBC: 8, 0x8DBD: 16, 0x8DBE: 16,
  0x9274: 8, 0x9275: 8, 0x9276: 8, 0x9277: 8, 0x9278: 16, 0x9279: 16, 0x93B0: 16, 0x93D0: 16, 0x8D64: 8 };
const FMT = { 0x8058: 'RGBA8', 0x8C43: 'sRGB8_A8', 0x8051: 'RGB8', 0x881A: 'RGBA16F', 0x8814: 'RGBA32F', 0x8229: 'R8', 0x822B: 'RG8', 0x81A6: 'D24', 0x88F0: 'D24S8', 0x8CAC: 'D32F', 0x81A5: 'D16',
  0x8E8C: 'BC7', 0x8E8D: 'BC7s', 0x83F0: 'BC1', 0x83F1: 'BC1a', 0x83F3: 'BC3', 0x8C4C: 'BC1s', 0x8C4F: 'BC3s', 0x9274: 'ETC2', 0x9278: 'ETC2a', 0x9279: 'ETC2as', 0x93B0: 'ASTC', 0x93D0: 'ASTCs' };
// formato/tipo sin tamaño (texImage2D con internalformat genérico)
const bppSuelto = (fmt, tipo) => { const c = { 0x1908: 4, 0x1907: 3, 0x1903: 1, 0x8227: 2, 0x1909: 1, 0x190A: 2, 0x1906: 1, 0x1902: 4 }[fmt] || 4; const b = { 0x1406: 4, 0x140B: 2, 0x8D61: 2, 0x1405: 4, 0x84FA: 0 }[tipo] ?? 1; return tipo === 0x84FA ? 4 : c * b; };
const nivel = (fmt, w, h) => BLOQUE[fmt] ? Math.ceil(w / 4) * Math.ceil(h / 4) * BLOQUE[fmt] : w * h * (BPP[fmt] || 4);

const tex = new Map(); // WebGLTexture → { niveles: Map('nivel|cara' → bytes), inmutable, w, h, fmt }
const rbs = new Map(); // WebGLRenderbuffer → bytes
let gl2Ctx = null;
if (STATS && typeof WebGL2RenderingContext !== 'undefined') {
  const P = WebGL2RenderingContext.prototype, unidad = new Map(); let activa = 0;
  const atado = (t) => unidad.get(activa + '|' + (t >= 0x8515 && t <= 0x851A ? 0x8513 : t));
  const info = (t) => { const k = atado(t); if (!k) return null; let o = tex.get(k); if (!o) { o = { niveles: new Map(), inmutable: false, w: 0, h: 0, fmt: 0 }; tex.set(k, o); } return o; };
  const cara = t => (t >= 0x8515 && t <= 0x851A ? t - 0x8515 : 0);
  const envolver = (n, f) => { const o = P[n]; P[n] = function (...a) { gl2Ctx = this; try { f.apply(this, a); } catch (e) { /* la medición nunca rompe el juego */ } return o.apply(this, a); }; };
  envolver('activeTexture', u => { activa = u; });
  envolver('bindTexture', (t, x) => { unidad.set(activa + '|' + t, x); });
  envolver('deleteTexture', x => tex.delete(x));
  envolver('texStorage2D', (t, lv, fmt, w, h) => { const o = info(t); if (!o) return; o.inmutable = true; o.w = w; o.h = h; o.fmt = fmt; o.niveles.clear(); const caras = t === 0x8513 ? 6 : 1;
    for (let l = 0; l < lv; l++) o.niveles.set(l + '|0', nivel(fmt, Math.max(1, w >> l), Math.max(1, h >> l)) * caras); });
  envolver('texStorage3D', (t, lv, fmt, w, h, d) => { const o = info(t); if (!o) return; o.inmutable = true; o.w = w; o.h = h; o.fmt = fmt; o.niveles.clear(); for (let l = 0; l < lv; l++) o.niveles.set(l + '|0', nivel(fmt, Math.max(1, w >> l), Math.max(1, h >> l)) * Math.max(1, t === 0x806F ? d >> l : d)); });
  envolver('texImage2D', function (t, l, ifmt, ...r) { const o = info(t); if (!o || o.inmutable) return; let w, h, fmt, tipo;
    if (r.length >= 6) { [w, h, , fmt, tipo] = r; } else { [fmt, tipo] = r; const s = r[2]; w = s?.videoWidth || s?.naturalWidth || s?.width || 0; h = s?.videoHeight || s?.naturalHeight || s?.height || 0; }
    const b = BPP[ifmt] ? w * h * BPP[ifmt] : w * h * bppSuelto(fmt, tipo); o.niveles.set(l + '|' + cara(t), b); if (l === 0) { o.w = w; o.h = h; o.fmt = ifmt; } });
  envolver('compressedTexImage2D', (t, l, fmt, w, h, b0, d) => { const o = info(t); if (!o || o.inmutable) return; o.niveles.set(l + '|' + cara(t), nivel(fmt, w, h)); if (l === 0) { o.w = w; o.h = h; o.fmt = fmt; } });
  envolver('generateMipmap', t => { const o = info(t); if (!o || o.inmutable || !o.w) return; const caras = t === 0x8513 ? 6 : 1; const b0 = (o.niveles.get('0|0') || 0);
    let w = o.w, h = o.h, l = 1; while (w > 1 || h > 1) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); for (let c = 0; c < caras; c++) o.niveles.set(l + '|' + c, b0 * (w * h) / (o.w * o.h)); l++; } });
  envolver('bindRenderbuffer', (t, x) => { unidad.set('rb', x); });
  envolver('deleteRenderbuffer', x => rbs.delete(x));
  envolver('renderbufferStorage', (t, fmt, w, h) => { const x = unidad.get('rb'); if (x) rbs.set(x, w * h * (BPP[fmt] || 4)); });
  envolver('renderbufferStorageMultisample', (t, s, fmt, w, h) => { const x = unidad.get('rb'); if (x) rbs.set(x, w * h * (BPP[fmt] || 4) * Math.max(1, s)); });
}
const bytesDe = o => { let s = 0; for (const b of o.niveles.values()) s += b; return s; };
const MB = b => +(b / 1048576).toFixed(1);

let R = null, S = null;
// estimación sin espía: tamaño de la imagen × bytes del formato × 4/3 si lleva mipmaps
function estimar(t) {
  if (t.isCompressedTexture) { let s = 0; for (const m of t.mipmaps || []) s += m.data?.byteLength || 0; return s * (t.isCubeTexture ? 6 : 1); }
  const i = t.image; if (!i) return 0; const w = i.width || i.videoWidth || 0, h = i.height || i.videoHeight || 0; const bpp = t.type === 1016 ? 8 : t.type === 1015 ? 16 : 4;
  return w * h * bpp * (t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003 ? 4 / 3 : 1) * (Array.isArray(i) ? 6 : 1);
}
function origen(t) {
  if (t.name) return t.name; const i = t.image;
  if (i?.src) return decodeURIComponent(i.src.split('/').slice(-2).join('/')).slice(0, 60);
  if (i?.tagName === 'CANVAS' || i instanceof (globalThis.OffscreenCanvas || Object)) return 'lienzo ' + (i.dataset?.n || '') + i.width + '×' + i.height;
  if (t.isRenderTargetTexture || t.isFramebufferTexture) return 'render ' + (i?.width || '') + '×' + (i?.height || '');
  return (t.isCompressedTexture ? 'ktx2 ' : t.isDataTexture ? 'datos ' : '') + (i?.width || t.mipmaps?.[0]?.width || '?') + '×' + (i?.height || t.mipmaps?.[0]?.height || '?');
}
// todas las texturas de la escena (visibles o no) con su capa y quién las usa
function texturasEscena() {
  const m = new Map(), capaDe = o => { for (let p = o; p; p = p.parent) if (p.userData?.capa) return p.userData.capa; return ''; };
  const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  S.traverse(o => { const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const mt of mats) for (const k in mt) { const t = mt[k]; if (!t || !t.isTexture) continue;
    let e = m.get(t); if (!e) { e = { t, usos: 0, visible: false, capas: new Set(), props: new Set() }; m.set(t, e); } e.usos++; e.props.add(k); if (vis(o)) e.visible = true; const c = capaDe(o); if (c) e.capas.add(c); } });
  for (const t of [S.environment, S.background]) if (t?.isTexture && !m.has(t)) m.set(t, { t, usos: 1, visible: true, capas: new Set(['entorno']), props: new Set(['env']) });
  return m;
}
// subir: sube a la GPU todas las texturas de lo visible (peor caso del capítulo, como si se recorriera entero)
export function medir({ log = true, top = 25, subir = false } = {}) {
  if (!R) return null;
  const esc = texturasEscena(), filas = [];
  if (subir) for (const e of esc.values()) if (e.visible) try { R.initTexture(e.t); } catch (er) { /* imagen aún sin cargar */ }
  let total = 0, rb = 0;
  for (const b of rbs.values()) rb += b;
  const glDe = t => R.properties.get(t)?.__webglTexture;
  const vistos = new Set();
  for (const e of esc.values()) { const g = glDe(e.t), o = g && tex.get(g); if (g) vistos.add(g); const b = o ? bytesDe(o) : estimar(e.t);
    filas.push({ textura: origen(e.t), MB: MB(b), b, fmt: o ? (FMT[o.fmt] || o.fmt.toString(16)) : e.t.isCompressedTexture ? 'comp' : 'est', tam: o ? o.w + '×' + o.h : '', usos: e.usos, visible: e.visible, capa: [...e.capas].join(','), prop: [...e.props].join(',') }); }
  let huerfanas = 0, nHuerf = 0; const fuera = []; // render targets, sombras, PMREM, texturas ya sin material
  if (STATS) { for (const [g, o] of tex) total += bytesDe(o); for (const [g, o] of tex) if (!vistos.has(g)) { huerfanas += bytesDe(o); nHuerf++; fuera.push(`${o.w}×${o.h} ${FMT[o.fmt] || o.fmt.toString(16)} ${MB(bytesDe(o))}`); } }
  else total = filas.reduce((s, f) => s + f.b, 0);
  filas.sort((a, b) => b.b - a.b);
  const porCapa = {}; for (const f of filas) { const k = f.visible ? 'visible' : 'oculta:' + (f.capa || '-'); porCapa[k] = (porCapa[k] || 0) + f.b; }
  const info = R.info, res = { texGPU_MB: MB(total), medida: STATS ? 'espía WebGL' : 'estimada', texturas: STATS ? tex.size : info.memory.textures, enEscena_MB: MB(filas.reduce((s, f) => s + f.b, 0)),
    fueraEscena_MB: MB(huerfanas), fueraEscena_n: nHuerf, fueraEscena: fuera, renderbuffers_MB: MB(rb), geometrias: info.memory.geometries, llamadas: info.render.calls, triangulos: info.render.triangles,
    porCapa: Object.fromEntries(Object.entries(porCapa).map(([k, v]) => [k, MB(v)])) };
  if (log) { console.log('[perf]', JSON.stringify(res)); console.table(filas.slice(0, top).map(({ b, ...f }) => f)); }
  res.filas = filas; return res;
}
export function conectarPerf(renderer, scene, capas = {}) {
  R = renderer; S = scene; for (const k in capas) capas[k].userData.capa = k; window.__perf = medir;
  if (!STATS) return;
  const el = document.createElement('div'); el.style.cssText = 'position:fixed;right:8px;top:8px;z-index:99;font:12px/1.35 monospace;color:#cfe;background:rgba(0,0,0,.6);padding:4px 8px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(el); let n = 0, t0 = performance.now();
  return () => { n++; const t = performance.now(); if (t - t0 < 500) return; const fps = n * 1000 / (t - t0); n = 0; t0 = t; let b = 0; for (const o of tex.values()) b += bytesDe(o);
    el.textContent = `${fps.toFixed(0)} fps · ${R.info.render.calls} llam · ${(R.info.render.triangles / 1000).toFixed(0)}k tri\ntex ${MB(b)} MB (${tex.size})`; };
}
