// Capa musical adaptativa (procedural, sin descargas): tres estados que se funden.
//   calma   · pad suave en Re menor (zonas seguras: casa de Dave, tienda de Hank)
//   tension · pad más oscuro + latido grave lento (robots cerca o te están buscando)
//   combate · pulso rápido de percusión filtrada + pad disonante (robots persiguiéndote cerca)
// El estado se decide solo por los enemigos cercanos y la detección del sigilo; la historia puede forzarlo.
// API: musica.forzar('calma'|'tension'|'combate'|null) · musica.zonaSegura(on) · musica.volumen(0..1) · musica.estado
import { G } from '../nucleo.js';
import { enemies, deteccion } from '../enemigos.js';
import { playerFeet } from '../jugador.js';
import { V3 } from '../nucleo.js';

const ACORDES = { calma: [146.8, 174.6, 220, 293.7], tension: [138.6, 164.8, 207.7, 277.2], combate: [130.8, 155.6, 185, 246.9] };
const est = { actual: 'calma', forzado: null, segura: false, vol: .5, ctx: null, capas: {}, latidoT: 0, cambioT: 0 };
const tA = new V3();

function montar(A) {
  const c = A.ctx, sal = c.createGain(); sal.gain.value = est.vol * .5; sal.connect(A.master || c.destination); est.sal = sal; est.ctx = c;
  for (const k in ACORDES) {
    const g = c.createGain(); g.gain.value = 0; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = k === 'calma' ? 700 : k === 'tension' ? 500 : 900; f.Q.value = .7;
    f.connect(g); g.connect(sal);
    // cuatro voces con desafinado lento (LFO de frecuencia) = pad
    for (const hz of ACORDES[k]) { const o = c.createOscillator(); o.type = k === 'combate' ? 'sawtooth' : 'triangle'; o.frequency.value = hz / 2; o.detune.value = (Math.random() - .5) * 14;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .07 + Math.random() * .1; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune); lfo.start();
      const vg = c.createGain(); vg.gain.value = .05; o.connect(vg); vg.connect(f); o.start(); }
    est.capas[k] = { g, f };
  }
  // ruido para la percusión
  const n = c.sampleRate * .3, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); est.ruido = b;
}
function golpe(frec, vol, ruido = false) {
  const c = est.ctx, t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + (ruido ? .12 : .35)); g.connect(est.sal);
  if (ruido) { const s = c.createBufferSource(); s.buffer = est.ruido; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; s.connect(f); f.connect(g); s.start(t); }
  else { const o = c.createOscillator(); o.frequency.setValueAtTime(frec, t); o.frequency.exponentialRampToValueAtTime(frec * .5, t + .3); o.connect(g); o.start(t); o.stop(t + .4); }
}
function decidir() {
  if (est.forzado) return est.forzado;
  if (est.segura) return 'calma';
  const pf = playerFeet(tA); let cerca = 0, persigue = false;
  for (const e of enemies) { if (!e.alive) continue; const d = e.pos.distanceTo(pf); if (d < 40) cerca++; if (d < 18 && e.state === 'chase' && e.boot >= 1) persigue = true; }
  if (persigue || deteccion.visto) return 'combate';
  if (cerca || deteccion.activa && deteccion.v > .15) return 'tension';
  return 'calma';
}
let A = null; import('../audio.js').then(m => { A = m.A; }).catch(() => {});
export function actualizarMusica(dt) {
  if (!A?.ctx) return; if (!est.ctx) { try { montar(A); } catch (e) { console.warn('[musica]', e); A = null; return; } }
  const quiere = decidir();
  // histéresis: no cambiar más de una vez cada 3 s (salvo para subir a combate)
  est.cambioT -= dt; if (quiere !== est.actual && (est.cambioT <= 0 || quiere === 'combate')) { est.actual = quiere; est.cambioT = 3; }
  const activo = G.playing || G.mode === 'vr', t = est.ctx.currentTime;
  for (const k in est.capas) est.capas[k].g.gain.setTargetAtTime(activo && k === est.actual ? 1 : 0, t, k === 'combate' ? .4 : 1.6);
  est.sal.gain.setTargetAtTime(est.vol * .5, t, .3);
  if (!activo) return;
  est.latidoT -= dt;
  if (est.actual === 'tension' && est.latidoT <= 0) { est.latidoT = 1.4; golpe(55, .25); setTimeout(() => est.ctx && golpe(50, .15), 260); }
  if (est.actual === 'combate' && est.latidoT <= 0) { est.latidoT = .25; const k = Math.round(G.time * 4) % 4; if (k === 0 || k === 2) golpe(60, .3); else golpe(0, .08, true); }
}
export const musica = { forzar(e) { est.forzado = e || null; }, zonaSegura(on = true) { est.segura = !!on; }, volumen(v) { est.vol = Math.max(0, Math.min(1, v)); }, get estado() { return est.actual; } };
