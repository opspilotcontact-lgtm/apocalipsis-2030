// Sonido sintetizado de la prueba (sin muestras). Regla del acto: sin aire no hay sonido del mundo; queda la
// respiración, los pitidos del traje y lo que llega por contacto (agarrado a un mamparo / el arma en la mano).
export const SON = { ctx: null };
let C, master, mundo, casco, ruido, siseo, rugido, alientoG, alientoF, fase = 0;

export function iniciarSonido() {
  if (C) { if (C.state === 'suspended') C.resume(); return; }
  try { C = SON.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = C.createGain(); master.gain.value = .8; master.connect(C.destination);
  mundo = C.createGain(); mundo.connect(master);
  casco = C.createGain(); casco.connect(master);
  const n = C.sampleRate * 2; ruido = C.createBuffer(1, n, C.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const bucle = (tipo, f, q, destino) => { const s = C.createBufferSource(); s.buffer = ruido; s.loop = true; const fl = C.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f; fl.Q.value = q; const g = C.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(destino); s.start(); return [g, fl]; };
  [siseo] = bucle('bandpass', 2600, .8, mundo);       // siseo de la esclusa (aire que entra/sale)
  [rugido] = bucle('lowpass', 380, .7, master);        // venteo: lo sientes por el traje, no se apaga del todo
  [alientoG, alientoF] = bucle('bandpass', 650, 1.2, casco);
  // zumbido de la nave (solo con aire)
  const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52; const fz = C.createBiquadFilter(); fz.type = 'lowpass'; fz.frequency.value = 140; const gz = C.createGain(); gz.gain.value = .05; o.connect(fz).connect(gz).connect(mundo); o.start();
}

// presion: 0..1 de la zona de la cabeza · contacto: agarrado a algo (oye vibración) · o2: 0..1
export function actualizarSonido(dt, { presion, contacto, flujoEsclusa, flujoVenteo, o2 }) {
  if (!C) return;
  const t = C.currentTime;
  mundo.gain.setTargetAtTime(Math.max(presion, contacto ? .3 : 0), t, .25);
  siseo.gain.setTargetAtTime(flujoEsclusa * .35, t, .1);
  rugido.gain.setTargetAtTime(flujoVenteo * .7, t, .1);
  // respiración: más rápida y fuerte bajo el 25 %
  const f = o2 < .25 ? .75 : .28; fase += dt * f;
  const e = Math.max(0, Math.sin(fase * Math.PI * 2)) ** 2;
  alientoG.gain.setTargetAtTime(e * (o2 < .25 ? .22 : .09), t, .05);
  alientoF.frequency.setTargetAtTime((fase % 1) < .5 ? 700 : 480, t, .1);
}

const tono = (destino, tipo, f0, f1, dur, vol) => { const o = C.createOscillator(), g = C.createGain(); o.type = tipo; o.frequency.setValueAtTime(f0, C.currentTime); o.frequency.exponentialRampToValueAtTime(f1, C.currentTime + dur); g.gain.setValueAtTime(vol, C.currentTime); g.gain.exponentialRampToValueAtTime(.001, C.currentTime + dur); o.connect(g).connect(destino); o.start(); o.stop(C.currentTime + dur + .02); };
const golpe = (destino, f, dur, vol) => { const s = C.createBufferSource(); s.buffer = ruido; const fl = C.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; const g = C.createGain(); g.gain.setValueAtTime(vol, C.currentTime); g.gain.exponentialRampToValueAtTime(.001, C.currentTime + dur); s.connect(fl).connect(g).connect(destino); s.start(); s.stop(C.currentTime + dur + .02); };

export function sonar(nombre) {
  if (!C) return;
  if (nombre === 'x56d') { golpe(mundo, 2200, .18, .9); golpe(casco, 300, .12, .35); }       // el culatazo llega por el brazo
  else if (nombre === 'x27') { tono(mundo, 'sine', 1800, 260, .16, .35); tono(casco, 'triangle', 420, 120, .12, .12); }
  else if (nombre === 'vidrio') { golpe(mundo, 6000, .5, .8); golpe(master, 200, .6, .5); }
  else if (nombre === 'motor') { tono(mundo, 'sawtooth', 70, 55, 1.3, .12); golpe(casco, 120, .3, .12); }
  else if (nombre === 'clic') tono(casco, 'square', 1500, 1500, .04, .08);
  else if (nombre === 'pitido') tono(casco, 'sine', 1100, 1100, .12, .12);
  else if (nombre === 'alarma') tono(casco, 'square', 880, 660, .25, .1);
  else if (nombre === 'chorro') golpe(casco, 900, .12, .05);
  else if (nombre === 'enroscar') { tono(casco, 'square', 300, 900, .3, .06); golpe(casco, 1500, .4, .15); }
  else if (nombre === 'tension') golpe(casco, 160, .25, .4);
}
