// Gestor de audio con muestras reales (WAV CC0 en assets/sonido/) sobre WebAudio.
// - iniciarAudio(): crea el contexto (hace falta un gesto del usuario) y carga las muestras en segundo plano.
// - sonar(nombre, { pos, vol, rate }): reproduce una variante al azar; con pos suena en 3D (PannerNode HRTF)
//   respecto a la cámara (también dentro de VR). Devuelve false si la muestra aún no está cargada,
//   para que quien llama use el sonido procedural de reserva.
import { THREE, renderer, camera, V3 } from './nucleo.js';

const RUTA = 'assets/sonido/';
// nombre lógico → variantes (archivos sin extensión)
export const BANCO = {
  punch: ['punch1', 'punch2', 'punch3'],
  kick: ['kick1', 'kick2'],
  golpeSeco: ['golpeSeco'],
  hueso: ['hueso1', 'hueso2'],
  metal: ['metal1', 'metal2'],
  balaMetal: ['balaMetal1', 'balaMetal2'],
  balaCarne: ['balaCarne'],
  servo: ['servo'],
  chispas: ['chispas1', 'chispas2'],
  explosion: ['explosion'],
  explosionGrande: ['explosionGrande'],
  retumbo: ['retumbo'],
  choque: ['choque'],
  cuchillo: ['cuchillo1', 'cuchillo2'],
  recoger: ['recoger'],
  desenvainar: ['desenvainar'],
  cristal: ['cristal'],
  emp: ['emp'],
  // armas reales (The Free Firearm Sound Library, CC0)
  rifle: ['armas/rifle1', 'armas/rifle2'],
  pistola: ['armas/pistola1', 'armas/pistola2'],
  escopeta: ['armas/escopeta1', 'armas/escopeta2'],
  smg: ['armas/smg1', 'armas/smg2']
};

export const A = { ctx: null, master: null, seco: null, reverb: null, buf: new Map(), cargando: false };

// respuesta al impulso sintética (sala/calle corta) para dar cola a disparos y golpes
function impulso(ctx, dur = .9, caida = 3.2) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida); }
  return b;
}

export function iniciarAudio() {
  if (!A.ctx) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // cadena: voces → (seco + envío a reverb) → compresor → salida
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .18;
    const master = ctx.createGain(); master.gain.value = 1; master.connect(comp).connect(ctx.destination);
    const reverb = ctx.createConvolver(); reverb.buffer = impulso(ctx); const rv = ctx.createGain(); rv.gain.value = .22; reverb.connect(rv).connect(master);
    const envio = ctx.createGain(); envio.gain.value = 1; envio.connect(reverb);
    Object.assign(A, { ctx, master, reverb: envio });
    cargarMuestras();
  }
  if (A.ctx.state === 'suspended') A.ctx.resume();
  return A;
}

async function cargar(f) {
  try {
    const r = await fetch(RUTA + f + '.wav'); if (!r.ok) return;
    const ab = await r.arrayBuffer();
    A.buf.set(f, await A.ctx.decodeAudioData(ab));
  } catch (e) { /* sin la muestra se usa el sonido procedural */ }
}
function cargarMuestras() {
  if (A.cargando) return; A.cargando = true;
  const todos = new Set(Object.values(BANCO).flat());
  // de pocas en pocas para no bloquear la red al arrancar
  const cola = [...todos]; const hilo = async () => { while (cola.length) await cargar(cola.shift()); };
  Promise.all([hilo(), hilo(), hilo()]);
}

// oyente = cámara (en VR, la cámara del visor)
const tP = new V3(), tF = new V3(), tU = new V3(), tmpQ = new THREE.Quaternion(), tmpS = new V3();
function actualizarOyente() {
  const L = A.ctx.listener, cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  cam.matrixWorld.decompose(tP, tmpQ, tmpS);
  tF.set(0, 0, -1).applyQuaternion(tmpQ); tU.set(0, 1, 0).applyQuaternion(tmpQ);
  if (L.positionX) { const t = A.ctx.currentTime; L.positionX.setValueAtTime(tP.x, t); L.positionY.setValueAtTime(tP.y, t); L.positionZ.setValueAtTime(tP.z, t); L.forwardX.setValueAtTime(tF.x, t); L.forwardY.setValueAtTime(tF.y, t); L.forwardZ.setValueAtTime(tF.z, t); L.upX.setValueAtTime(tU.x, t); L.upY.setValueAtTime(tU.y, t); L.upZ.setValueAtTime(tU.z, t); }
  else { L.setPosition(tP.x, tP.y, tP.z); L.setOrientation(tF.x, tF.y, tF.z, tU.x, tU.y, tU.z); }
}

let voces = 0; const MAX_VOCES = 24;
// opciones: pos (Vector3 del mundo), vol (0..), rate (velocidad), var (variación de tono, por defecto ±6 %), rev (envío a reverb 0..1), retardo (s)
export function sonar(nombre, o = {}) {
  if (!A.ctx) return false;
  const lista = BANCO[nombre]; if (!lista) return false;
  const disp = lista.filter(f => A.buf.has(f)); if (!disp.length) return false;
  if (voces >= MAX_VOCES) return true; // saturado: se descarta sin caer al procedural
  const ctx = A.ctx, t = ctx.currentTime + (o.retardo || 0);
  const src = ctx.createBufferSource(); src.buffer = A.buf.get(disp[Math.floor(Math.random() * disp.length)]);
  const va = o.var ?? .06; src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * va);
  const g = ctx.createGain(); g.gain.value = o.vol ?? 1;
  let out = g;
  if (o.pos) {
    actualizarOyente();
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = o.ref || 2; p.rolloffFactor = 1; p.maxDistance = 200;
    if (p.positionX) { p.positionX.value = o.pos.x; p.positionY.value = o.pos.y; p.positionZ.value = o.pos.z; } else p.setPosition(o.pos.x, o.pos.y, o.pos.z);
    g.connect(p); out = p;
  }
  src.connect(g); out.connect(A.master);
  const rev = o.rev ?? .35; if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; out.connect(s).connect(A.reverb); }
  voces++; src.onended = () => { voces--; try { src.disconnect(); g.disconnect(); out.disconnect(); } catch (e) {} };
  src.start(t);
  return true;
}
export const muestraLista = nombre => !!BANCO[nombre]?.some(f => A.buf.has(f));
