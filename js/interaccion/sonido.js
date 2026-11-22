// Sonido de la interacción (WebAudio, todo sintetizado): golpes por material y fuerza, roturas, piano, puertas
// y emisoras de radio. Usa el contexto y el bus maestro de audio.js; si aún no hay audio (sin gesto), no suena nada.
import { THREE, V3, renderer, camera, rnd } from '../nucleo.js';
import { A, sonar } from '../audio.js';

let NB = null, voces = 0;
const MAXV = 16;
const ok = () => !!A.ctx && A.ctx.state !== 'closed';
function ruido() { if (!NB) { const c = A.ctx, n = c.sampleRate; NB = c.createBuffer(1, n, n); const d = NB.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return NB; }

// ---------- oyente (la cámara; en VR la del visor) ----------
const tP = new V3(), tF = new V3(), tU = new V3(), tQ = new THREE.Quaternion(), tS = new V3();
export function actualizarOyente() {
  if (!ok()) return;
  const L = A.ctx.listener, cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  cam.updateMatrixWorld(); cam.matrixWorld.decompose(tP, tQ, tS);
  tF.set(0, 0, -1).applyQuaternion(tQ); tU.set(0, 1, 0).applyQuaternion(tQ);
  if (L.positionX) { L.positionX.value = tP.x; L.positionY.value = tP.y; L.positionZ.value = tP.z; L.forwardX.value = tF.x; L.forwardY.value = tF.y; L.forwardZ.value = tF.z; L.upX.value = tU.x; L.upY.value = tU.y; L.upZ.value = tU.z; }
  else { L.setPosition(tP.x, tP.y, tP.z); L.setOrientation(tF.x, tF.y, tF.z, tU.x, tU.y, tU.z); }
}
function ponerPos(p, pos) { if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z); }
// salida con panner barato (equalpower) para sonidos cortos; HRTF solo en bucles largos (radio)
function salida(pos, vol, hrtf = false, ref = 1.2) {
  const c = A.ctx, g = c.createGain(); g.gain.value = vol;
  if (pos) { const p = c.createPanner(); p.panningModel = hrtf ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.2; p.maxDistance = 60; ponerPos(p, pos); g.connect(p).connect(A.master); return { g, p }; }
  g.connect(A.master); return { g, p: null };
}
// ---------- primitivas ----------
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); }
function tono(dest, t, f0, dur, peak, type = 'sine', f1 = f0, a = .002) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, a, peak, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + a + dur + .05); return o;
}
function ruidoF(dest, t, dur, freq, q, peak, type = 'bandpass', a = .002) {
  const c = A.ctx, s = c.createBufferSource(); s.buffer = ruido(); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain();
  env(g, t, a, peak, dur); s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * .5); s.stop(t + a + dur + .05); return s;
}
// cuenta voces: el último nodo que suena libera la voz
function voz(fin) { voces++; fin.onended = () => { voces--; }; }

// ---------- golpes por material (f: 0..1 fuerza del impacto) ----------
export function golpe(mat, pos, f = .5) {
  if (!ok() || voces >= MAXV) return;
  const c = A.ctx, t = c.currentTime, k = .15 + f * .85, { g } = salida(pos, 1);
  let ult;
  switch (mat) {
    case 'vidrio': { const b = rnd(.9, 1.15); [2600, 3900, 5400].forEach((fr, i) => ult = tono(g, t, fr * b, .14 + .08 * (2 - i), .12 * k / (i + 1))); ruidoF(g, t, .03, 6000, 1, .12 * k, 'highpass'); break; }
    case 'ceramica': { const b = rnd(.9, 1.1); [1700, 2650, 4100].forEach((fr, i) => ult = tono(g, t, fr * b, .07 + .03 * (2 - i), .13 * k / (i + 1))); ruidoF(g, t, .04, 2500, 1.2, .2 * k); break; }
    case 'metal': { const f0 = rnd(380, 720); [1, 2.76, 5.4].forEach((m, i) => ult = tono(g, t, f0 * m, .4 - i * .1, .12 * k / (i + 1))); ruidoF(g, t, .025, 3200, 1, .2 * k); break; }
    case 'lata': { const f0 = rnd(900, 1400); [1, 2.3, 3.9].forEach((m, i) => ult = tono(g, t, f0 * m, .08, .07 * k / (i + 1))); ruidoF(g, t, .03, 4200, 1, .14 * k); break; }
    case 'madera': ruidoF(g, t, .07, 900, .8, .45 * k, 'lowpass'); ult = tono(g, t, rnd(150, 210), .09, .3 * k, 'sine', 90); break;
    case 'plastico': ruidoF(g, t, .05, 1400, 1, .3 * k); ult = tono(g, t, rnd(330, 420), .05, .08 * k, 'triangle', 240); break;
    case 'carton': ruidoF(g, t, .1, 650, .7, .45 * k, 'lowpass'); ult = tono(g, t, 95, .08, .2 * k, 'sine', 60); break;
    case 'papel': ult = ruidoF(g, t, .07, 2100, .6, .18 * k); break;
    case 'goma': ruidoF(g, t, .05, 380, .7, .25 * k, 'lowpass'); ult = tono(g, t, rnd(120, 160), .12, .35 * k, 'sine', 70); break;
    default: ult = ruidoF(g, t, .06, 1000, .8, .3 * k);
  }
  if (ult) voz(ult);
}
// ---------- roturas ----------
export function rotura(mat, pos, f = 1) {
  if (!ok()) return;
  const c = A.ctx, t = c.currentTime, { g } = salida(pos, 1, false, 2);
  if (mat === 'vidrio' || mat === 'ceramica' || mat === 'pantalla') {
    const muestra = sonar('cristal', { pos, vol: .8 * f, rate: mat === 'ceramica' ? .8 : 1 });
    ruidoF(g, t, .35, mat === 'ceramica' ? 2500 : 5000, .6, .35 * f, 'highpass');
    for (let i = 0; i < (muestra ? 4 : 9); i++) tono(g, t + rnd(0, .25), rnd(2200, 6200), rnd(.05, .14), .05 * f);
    if (mat === 'pantalla') { sonar('chispas', { pos, vol: .6 }); ruidoF(g, t, .12, 180, 1, .4, 'lowpass'); }
  } else if (mat === 'madera') { ruidoF(g, t, .18, 1200, .9, .55 * f); ruidoF(g, t + .02, .25, 400, .7, .5 * f, 'lowpass'); tono(g, t, 120, .15, .35 * f, 'sine', 60); }
  else ruidoF(g, t, .2, 900, .8, .4 * f);
}
// ---------- muebles ----------
// chirrido de bisagra (v: velocidad angular) y golpe al cerrar
let chirrT = 0;
export function chirrido(pos, v) {
  if (!ok() || A.ctx.currentTime < chirrT) return; const t = A.ctx.currentTime; chirrT = t + .12;
  const { g } = salida(pos, Math.min(.5, v * .25)); tono(g, t, rnd(500, 900), .14, .06, 'sawtooth', rnd(600, 1100), .03); ruidoF(g, t, .12, 1800, 6, .05);
}
export function portazo(pos, f = 1) { if (!ok()) return; const t = A.ctx.currentTime, { g } = salida(pos, 1, false, 2); ruidoF(g, t, .12, 500, .7, .6 * f, 'lowpass'); tono(g, t, 90, .15, .4 * f, 'sine', 50); ruidoF(g, t, .04, 2500, 2, .15 * f); }
export function deslizar(pos) { if (!ok()) return; const t = A.ctx.currentTime, { g } = salida(pos, 1); ruidoF(g, t, .22, 700, 1.5, .18, 'bandpass', .05); ruidoF(g, t + .2, .05, 1500, 2, .2); }
export function clic(pos) { if (!ok()) return; const t = A.ctx.currentTime, { g } = salida(pos, 1); ruidoF(g, t, .015, 3000, 3, .3); tono(g, t, 1800, .02, .05, 'square'); }

// ---------- piano: armónicos con inarmonicidad, martillo y caída exponencial ----------
export function notaPiano(midi, pos, vel = .7) {
  if (!ok() || voces >= MAXV + 6) return null;
  const c = A.ctx, t = c.currentTime, f = 440 * Math.pow(2, (midi - 69) / 12), { g } = salida(pos, .9 * vel, false, 2.5);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, 1800 + f * 4 * vel); lp.connect(g);
  const dec = 1.4 * Math.pow(440 / f, .45), amps = [1, .55, .32, .2, .12, .07], B = .0004, oscs = [];
  amps.forEach((a, i) => { const n = i + 1, o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * n * Math.sqrt(1 + B * n * n); o.detune.value = rnd(-3, 3);
    og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(.16 * a, t + .004); og.gain.exponentialRampToValueAtTime(.0001, t + .004 + dec * (1.3 - i * .15) * 1.6);
    o.connect(og).connect(lp); o.start(t); o.stop(t + dec * 2.2 + .1); oscs.push({ o, og }); });
  ruidoF(lp, t, .02, 2500, .8, .08 * vel, 'lowpass');
  voz(oscs[0].o);
  // soltar la tecla apaga la nota (como el apagador de un piano)
  return { soltar() { const tt = c.currentTime; for (const { og } of oscs) { og.gain.cancelScheduledValues(tt); og.gain.setTargetAtTime(.0001, tt, .12); } } };
}

// ---------- radio: estática, música de garaje y boletín de emergencia ----------
export const EMISORAS = [{ n: 'APAGADA' }, { n: '104.7 · estática', tipo: 'estatica' }, { n: '91.2 FM · música', tipo: 'musica' }, { n: 'AM 1040 · emergencias', tipo: 'noticias' }];
export class Radio {
  constructor() { this.est = 0; this.pos = new V3(); this.bus = null; this.loop = null; this.sig = 0; this.paso = 0; }
  sintonizar(i) {
    this.est = ((i % EMISORAS.length) + EMISORAS.length) % EMISORAS.length;
    if (!ok()) return EMISORAS[this.est];
    this.parar(); const c = A.ctx, t = c.currentTime;
    if (!this.est) { clic(this.pos); return EMISORAS[0]; }
    const o = salida(this.pos, .55, true, 1.5), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = .45; bp.connect(o.g);
    this.bus = { ...o, bp };
    // ruido de fondo de la emisora (mucho en la estática, poco en las demás)
    const s = c.createBufferSource(); s.buffer = ruido(); s.loop = true; const sg = c.createGain(); sg.gain.value = EMISORAS[this.est].tipo === 'estatica' ? .5 : .05; s.connect(sg).connect(bp); s.start(); this.loop = s;
    ruidoF(bp, t, .25, 2500, .5, .7); // chasquido al cambiar
    this.sig = t + .25; this.paso = 0;
    return EMISORAS[this.est];
  }
  siguiente() { return this.sintonizar(this.est + 1); }
  parar() { if (this.loop) { try { this.loop.stop(); } catch (e) {} this.loop = null; } if (this.bus) { const b = this.bus; b.g.gain.setTargetAtTime(0, A.ctx.currentTime, .03); setTimeout(() => { try { b.g.disconnect(); } catch (e) {} }, 300); this.bus = null; } }
  // llamar cada fotograma con la posición de la radio: mueve el panner y programa notas/sílabas por adelantado
  actualizar(pos) {
    if (!this.bus || !ok()) return; this.pos.copy(pos); if (this.bus.p) ponerPos(this.bus.p, pos);
    const c = A.ctx, tipo = EMISORAS[this.est].tipo, d = this.bus.bp;
    while (this.sig < c.currentTime + .3) {
      const t = Math.max(this.sig, c.currentTime);
      if (tipo === 'musica') { // Am F C G, bajo + arpegio + charles
        const acordes = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], a = acordes[Math.floor(this.paso / 8) % 4], b = .31;
        if (this.paso % 4 === 0) tono(d, t, 440 * Math.pow(2, (a[0] - 12 - 69) / 12), b * 1.8, .22, 'triangle');
        tono(d, t, 440 * Math.pow(2, (a[this.paso % 3] + (this.paso % 8 > 5 ? 12 : 0) - 69) / 12), b * .9, .09, 'square');
        if (this.paso % 2) ruidoF(d, t, .03, 7000, 1, .06, 'highpass');
        this.sig = t + b / 2; this.paso++;
      } else if (tipo === 'noticias') { // sílabas con formantes y, de vez en cuando, el tono de emergencia
        if (this.paso % 40 === 39) { tono(d, t, 853, .9, .1); tono(d, t, 960, .9, .1); this.sig = t + 1.2; }
        else if (Math.random() < .14) this.sig = t + rnd(.15, .4);
        else { const dur = rnd(.07, .18); ruidoF(d, t, dur, rnd(400, 900), 4, .5, 'bandpass', .015); ruidoF(d, t, dur, rnd(1200, 2400), 5, .25, 'bandpass', .015); tono(d, t, rnd(110, 140), dur, .05, 'sawtooth'); this.sig = t + dur + rnd(.02, .06); }
        this.paso++;
      } else { if (Math.random() < .3) ruidoF(d, t, .02, 3000, 1, .4); this.sig = t + rnd(.05, .3); }
    }
  }
}
export const audioListo = ok;

// ---------- Respiración del jugador (contener / soltar / bocanada) ----------
export function respirar(tipo, pos) {
  if (!ok()) return; const t = A.ctx.currentTime, { g } = salida(null, 1);
  if (tipo === 'contener') { ruidoF(g, t, .25, 900, .8, .12, 'lowpass', .05); }
  else if (tipo === 'soltar') { ruidoF(g, t, .7, 1100, .7, .14, 'bandpass', .15); }
  else { ruidoF(g, t, .45, 1300, .6, .4, 'bandpass', .03); ruidoF(g, t + .5, .9, 900, .6, .25, 'bandpass', .2); tono(g, t, 160, .3, .05, 'sawtooth', 120); }
}
// ---------- Guitarra: cuerda pulsada (Karplus-Strong precalculado por nota) ----------
const kCache = new Map();
function karplus(f) {
  const k = Math.round(f * 10); let b = kCache.get(k); if (b) return b;
  const c = A.ctx, sr = c.sampleRate, n = Math.floor(sr * 2.4), N = Math.max(2, Math.round(sr / f)); b = c.createBuffer(1, n, sr); const d = b.getChannelData(0);
  for (let i = 0; i < N; i++) d[i] = (Math.random() * 2 - 1) * .8; for (let i = 1; i < N; i++) d[i] = (d[i] + d[i - 1]) * .5; // púa algo apagada
  for (let i = N; i < n; i++) d[i] = .4985 * (d[i - N] + d[i - N + 1]);
  kCache.set(k, b); return b;
}
export function cuerda(midi, pos, vel = .7, retardo = 0) {
  if (!ok() || voces >= MAXV + 6) return; const c = A.ctx, t = c.currentTime + retardo, { g } = salida(pos, .55 * vel, false, 2);
  const s = c.createBufferSource(); s.buffer = karplus(440 * Math.pow(2, (midi - 69) / 12)); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500 + vel * 3000;
  s.connect(lp).connect(g); s.start(t); voz(s);
}
// ---------- Bucle de siseo (extintor) ----------
export function siseo(pos) {
  if (!ok()) return null; const c = A.ctx, { g, p } = salida(pos, 0, true, 1.5), s = c.createBufferSource(); s.buffer = ruido(); s.loop = true;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; s.connect(f).connect(g); s.start(); g.gain.setTargetAtTime(.35, c.currentTime, .03);
  return { mover(q) { if (p) ponerPos(p, q); }, parar() { g.gain.setTargetAtTime(0, c.currentTime, .06); setTimeout(() => { try { s.stop(); g.disconnect(); } catch (e) {} }, 400); } };
}
// ---------- Mecánica de armas y coche ----------
export function mecanico(tipo, pos) {
  if (!ok()) return; const t = A.ctx.currentTime, { g } = salida(pos, 1);
  if (tipo === 'cargadorFuera') { ruidoF(g, t, .03, 2500, 3, .35); tono(g, t, 900, .04, .06, 'square', 600); }
  else if (tipo === 'cargadorDentro') { ruidoF(g, t, .02, 3500, 4, .5); ruidoF(g, t + .03, .03, 1800, 3, .4); tono(g, t + .03, 1400, .03, .08, 'square'); }
  else if (tipo === 'cerrojo') { ruidoF(g, t, .05, 2200, 3, .45); ruidoF(g, t + .12, .04, 3000, 3, .5); tono(g, t + .12, 1100, .04, .07, 'square'); }
  else if (tipo === 'funda') { ruidoF(g, t, .12, 1200, 1, .2, 'bandpass', .02); }
  else if (tipo === 'llave') { ruidoF(g, t, .03, 4000, 4, .3); tono(g, t, 2200, .05, .05, 'triangle'); }
  else if (tipo === 'limpia') { ruidoF(g, t, .35, 800, 2, .12, 'bandpass', .1); }
  else if (tipo === 'latido') { tono(g, t, 55, .12, .5, 'sine', 40); tono(g, t + .2, 50, .12, .35, 'sine', 38); }
}
