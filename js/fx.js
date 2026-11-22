// Efectos: chispas, trazadoras, fogonazo, números de daño, escombros, fundidos y sonido procedural.
import { THREE, V3, G, scene, camera, rnd, canvasTex, cv2d, toTex, groundAt } from './nucleo.js';
import { iniciarAudio, sonar, A } from './audio.js';

const tD = new V3();
// ---------- Chispas ----------
const sparkGeo = new THREE.BoxGeometry(.035, .035, .035);
const SM = { hot: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }), dust: new THREE.MeshBasicMaterial({ color: 0x8f8a80 }), blue: new THREE.MeshBasicMaterial({ color: 0x9ff6ff, toneMapped: false }), oil: new THREE.MeshBasicMaterial({ color: 0x1a1410 }) };
const sparks = []; let spI = 0;
for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(sparkGeo, SM.hot); m.visible = false; scene.add(m); sparks.push({ m, v: new V3(), life: 0, max: 1 }); }
export function burst(pos, n, type, dir, spd = 1) { for (let i = 0; i < n; i++) { const s = sparks[spI++ % sparks.length]; s.m.material = SM[type]; s.m.position.copy(pos); s.m.visible = true; s.v.set(rnd(-1, 1), rnd(-.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.5, 5) * spd); if (dir) s.v.addScaledVector(dir, 2.5); s.life = s.max = rnd(.25, .6); } }
// ---------- Trazadoras ----------
export const trGeo = new THREE.BoxGeometry(1, 1, 1); trGeo.translate(0, 0, .5);
const tracers = []; let trI = 0;
for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, toneMapped: false, depthWrite: false })); m.visible = false; scene.add(m); tracers.push({ m, life: 0 }); }
export function tracer(a, b) { const t = tracers[trI++ % tracers.length]; t.m.position.copy(a); t.m.lookAt(b); t.m.scale.set(.012, .012, a.distanceTo(b)); t.life = .07; t.m.visible = true; t.m.material.opacity = 1; }
// ---------- Fogonazo ----------
const flashTex = canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(.3, 'rgba(255,170,60,.9)'); g.addColorStop(1, 'rgba(255,90,0,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, false);
export const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); flash.scale.setScalar(.2); flash.visible = false;
let flashT = 0;
export function fogonazo(muzzle) { muzzle.add(flash); flash.visible = true; flashT = .05; flash.material.rotation = Math.random() * 6; }
// ---------- Números de daño ----------
const nums = []; let numI = 0;
for (let i = 0; i < 14; i++) { const [c] = cv2d(128, 64); const t = toTex(c, false); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, toneMapped: false })); s.renderOrder = 999; s.scale.set(.42, .21, 1); s.visible = false; scene.add(s); nums.push({ s, c, t, life: 0 }); }
export function dmgNumber(pos, v, crit) { const n = nums[numI++ % nums.length], x = n.c.getContext('2d'); x.clearRect(0, 0, 128, 64); x.font = '700 44px "Chakra Petch",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = '#000'; x.fillStyle = crit ? '#ff5a3a' : '#fff'; x.strokeText(v, 64, 32); x.fillText(v, 64, 32); n.t.needsUpdate = true; n.s.position.copy(pos).add(tD.set(rnd(-.15, .15), .25, rnd(-.15, .15))); n.life = .9; n.s.visible = true; }
// ---------- Escombros (piezas de robot que salen volando) ----------
export const debris = [];
export function toDebris(m, v) { scene.attach(m); m.userData.enemy = null; debris.push({ m, v, av: new V3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)), life: 8 }); }
export function limpiarEscombros() { for (const d of debris) d.m.removeFromParent(); debris.length = 0; }
// ---------- Polvo en el aire ----------
export const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xd8d0c0, size: .035, transparent: true, opacity: .45, depthWrite: false }));
{ const a = new Float32Array(450 * 3); for (let i = 0; i < a.length; i += 3) { a[i] = rnd(-12, 12); a[i + 1] = rnd(.2, 5); a[i + 2] = rnd(-12, 12); } dust.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); } scene.add(dust); dust.frustumCulled = false;
// ---------- Esferas pegadas a la cámara: daño y fundido (funcionan igual en PC y en VR) ----------
const hurtSphere = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff1a00, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, toneMapped: false })); hurtSphere.renderOrder = 1000; camera.add(hurtSphere);
const fadeSphere = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 8), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, toneMapped: false })); fadeSphere.renderOrder = 1001; camera.add(fadeSphere);
// ojo: dentro de una sesión VR el requestAnimationFrame de la ventana se pausa; las esperas se resuelven en actualizarFx
export const fade = { v: 0, target: 0, speed: 2, waiters: [] };
export function fundido(a, speed = 2, color = 0x000000) { fade.target = a; fade.speed = speed; fadeSphere.material.color.setHex(color); return new Promise(r => fade.waiters.push(r)); }
export const hurt = { a: 0 };

export function actualizarFx(dt) {
  for (const d of debris) { d.v.y -= 12 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.av.x * dt; d.m.rotation.y += d.av.y * dt; d.m.rotation.z += d.av.z * dt;
    const g = groundAt(d.m.position.x, d.m.position.z, d.m.position.y, 0) + .06; if (d.m.position.y < g) { d.m.position.y = g; d.v.y *= -.35; d.v.x *= .7; d.v.z *= .7; d.av.multiplyScalar(.7); }
    d.life -= dt; if (d.life < 1.2) d.m.scale.multiplyScalar(Math.max(0, 1 - dt * 3)); }
  for (let i = debris.length - 1; i >= 0; i--) if (debris[i].life <= 0) { debris[i].m.removeFromParent(); debris.splice(i, 1); }
  for (const s of sparks) if (s.life > 0) { s.life -= dt; s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt); if (s.m.position.y < .02) { s.m.position.y = .02; s.v.y *= -.3; } s.m.scale.setScalar(Math.max(.01, s.life / s.max)); if (s.life <= 0) s.m.visible = false; }
  for (const t of tracers) if (t.life > 0) { t.life -= dt; t.m.material.opacity = Math.max(0, t.life / .07); if (t.life <= 0) t.m.visible = false; }
  for (const n of nums) if (n.life > 0) { n.life -= dt; n.s.position.y += dt * .9; n.s.material.opacity = Math.min(1, n.life * 2); if (n.life <= 0) n.s.visible = false; }
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.visible = false; }
  if (dust.visible) { const a = dust.geometry.attributes.position.array, C = G.CAM; for (let i = 0; i < a.length; i += 3) { a[i] += Math.sin(G.time * .3 + i) * dt * .05; a[i + 1] += dt * .03; if (a[i + 1] > C.y + 4) a[i + 1] = C.y - 1.4; if (a[i + 1] < C.y - 2) a[i + 1] = C.y + 3; if (a[i] - C.x > 12) a[i] -= 24; if (C.x - a[i] > 12) a[i] += 24; if (a[i + 2] - C.z > 12) a[i + 2] -= 24; if (C.z - a[i + 2] > 12) a[i + 2] += 24; } dust.geometry.attributes.position.needsUpdate = true; }
  hurt.a = Math.max(0, hurt.a - dt * 1.8);
  const dom = document.getElementById('hurt'); if (dom) dom.style.opacity = G.mode === 'pc' ? hurt.a : 0;
  hurtSphere.material.opacity = G.mode === 'vr' ? hurt.a * .45 : 0;
  // fundido
  if (fade.v !== fade.target) { const s = fade.speed * dt; fade.v = fade.v < fade.target ? Math.min(fade.target, fade.v + s) : Math.max(fade.target, fade.v - s); }
  if (fade.v === fade.target && fade.waiters.length) { const w = fade.waiters.splice(0); w.forEach(r => r()); }
  fadeSphere.material.opacity = fade.v; fadeSphere.visible = fade.v > .001;
}

// ---------- Audio: muestras reales (audio.js) con sonido procedural de reserva ----------
let AC = null, NB = null, engine = null, master = null;
export function audio() { try { const S0 = iniciarAudio(); if (!AC) { AC = S0.ctx; master = S0.master; const n = AC.sampleRate; NB = AC.createBuffer(1, n, n); const d = NB.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } } catch (e) { AC = null; } }
function envG(t, a, peak, dec) { const g = AC.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); return g; }
function nz(t, dur, freq, q, peak, type = 'lowpass', dest = master) { const s = AC.createBufferSource(); s.buffer = NB; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f).connect(envG(t, .004, peak, dur)).connect(dest); s.start(t, Math.random() * .4); s.stop(t + dur + .05); }
function tn(t, dur, f0, f1, type, peak) { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); o.connect(envG(t, .005, peak, dur)).connect(master); o.start(t); o.stop(t + dur + .05); }
// disparo procedural en tres capas: chasquido (agudo, muy corto) + cuerpo (grave) + cola (eco de calle)
function disparoProc(t, k = 1, grave = 1) {
  nz(t, .035, 2500, .7, .55 * k, 'highpass');
  nz(t, .16 * grave, 900, .8, .6 * k); tn(t, .14 * grave, 150 / grave, 45, 'sine', .45 * k);
  nz(t + .02, .55 * grave, 520, .5, .16 * k, 'lowpass', A.reverb || master);
}
const S = (n, o) => sonar(n, o);
// sfx(k) sigue igual que antes; o (opcional) admite { pos, vol, rate } para sonido 3D
export function sfx(k, o = {}) { if (!AC) return; const t = AC.currentTime; try { switch (k) {
  case 'pistol': if (!S('pistola', { vol: .9, rev: .5, ...o })) disparoProc(t, .9, 1); break;
  case 'rifle': if (!S('rifle', { vol: .75, rev: .45, var: .04, ...o })) disparoProc(t, .7, .8); break;
  case 'shotgun': case 'escopeta': if (!S('escopeta', { vol: 1, rev: .55, ...o })) disparoProc(t, 1.1, 1.5); break;
  case 'smg': if (!S('smg', { vol: .7, rev: .4, var: .05, ...o })) disparoProc(t, .6, .7); break;
  case 'hit': if (!S('balaMetal', { vol: .55, rev: .2, var: .12, ...o })) { tn(t, .09, 1400 + rnd(-200, 200), 700, 'square', .07); nz(t, .06, 5000, 2, .12, 'bandpass'); } break;
  case 'carne': if (!S('balaCarne', { vol: .7, ...o })) nz(t, .1, 600, 1, .4); break;
  case 'punch': if (!S('punch', { vol: .9, rev: .15, ...o })) { nz(t, .14, 500, 1, .5); tn(t, .16, 160, 50, 'sine', .4); tn(t, .1, 900, 500, 'triangle', .08); } break;
  case 'kick': if (!S('kick', { vol: 1, rev: .15, ...o })) { nz(t, .2, 400, 1, .6); tn(t, .2, 120, 40, 'sine', .5); } break;
  case 'stone': if (S('golpeSeco', { vol: .9, rev: .15, ...o })) S('hueso', { vol: .45, rev: 0, ...o }); else { nz(t, .12, 700, 1.2, .55); tn(t, .14, 220, 70, 'triangle', .3); } break;
  case 'hueso': if (!S('hueso', { vol: .8, ...o })) nz(t, .08, 3000, 2, .4, 'bandpass'); break;
  case 'slash': if (!S('cuchillo', { vol: .8, rev: .15, ...o })) { nz(t, .1, 4000, 1.5, .25, 'bandpass'); tn(t, .08, 1600, 900, 'triangle', .07); } break;
  case 'whoosh': nz(t, .2, 900, .6, .08, 'bandpass'); break;
  case 'clang': if (!S('metal', { vol: .8, rev: .4, var: .1, ...o })) { tn(t, .35, 420, 380, 'triangle', .2); tn(t, .35, 1260, 1200, 'sine', .07); nz(t, .1, 2500, 1, .2); } break;
  case 'chispas': if (!S('chispas', { vol: .5, ...o })) nz(t, .2, 6000, 2, .15, 'bandpass'); break;
  case 'hurt': S('balaCarne', { vol: .5, rev: 0 }); tn(t, .25, 140, 60, 'sawtooth', .16); break;
  case 'boom': if (S('explosion', { vol: 1, rev: .5, ...o })) S('chispas', { vol: .5, retardo: .05, ...o }); else { nz(t, .9, 700, .5, .7); tn(t, .6, 90, 30, 'sine', .5); } break;
  case 'bigboom': if (S('explosionGrande', { vol: 1, rev: .6, var: .02, ...o })) S('retumbo', { vol: 1, rev: .3, var: 0, ...o }); else { nz(t, 1.8, 400, .4, .9); tn(t, 1.4, 70, 22, 'sine', .7); } break;
  case 'snap': if (S('hueso', { vol: .9, ...o })) { S('chispas', { vol: .6, ...o }); S('metal', { vol: .4, rate: .8, ...o }); } else { nz(t, .25, 1800, 1, .4); tn(t, .2, 600, 120, 'square', .1); } break;
  case 'btn': tn(t, .06, 880, 880, 'square', .05); tn(t + .06, .08, 1320, 1320, 'square', .04); break;
  case 'blip': tn(t, .04, 660 + rnd(-40, 40), 660, 'triangle', .035); break;
  case 'empty': tn(t, .04, 2000, 1800, 'square', .04); break;
  case 'reload': nz(t, .05, 3000, 3, .15, 'bandpass'); nz(t + .55, .06, 2000, 3, .2, 'bandpass'); break;
  case 'boot': if (!S('servo', { vol: .45, rev: .3, var: .1, ...o })) tn(t, 1.2, 60, 240, 'sawtooth', .07); break;
  case 'crash': if (S('choque', { vol: .9, rev: .4, ...o })) S('metal', { vol: .7, rate: .7, ...o }); else { nz(t, .5, 900, .7, .6); tn(t, .3, 120, 40, 'square', .2); } break;
  case 'door': nz(t, .08, 1200, 2, .3, 'bandpass'); tn(t, .1, 220, 120, 'square', .08); break;
  case 'horn': tn(t, .45, 392, 392, 'square', .08); tn(t, .45, 494, 494, 'square', .06); break;
  case 'land': if (!S('kick', { vol: .9, rate: .7, ...o })) { nz(t, .25, 400, 1, .5); tn(t, .2, 80, 40, 'sine', .4); } break;
  case 'pickup': if (!S('recoger', { vol: .6, rev: .1, ...o })) { tn(t, .08, 520, 780, 'triangle', .1); tn(t + .08, .12, 780, 1040, 'triangle', .08); } break;
  case 'objetivo': tn(t, .12, 523, 523, 'triangle', .09); tn(t + .12, .12, 659, 659, 'triangle', .09); tn(t + .24, .22, 784, 784, 'triangle', .09); break;
  case 'alerta': tn(t, .18, 900, 900, 'square', .07); tn(t + .2, .18, 700, 700, 'square', .07); break;
  case 'visto': tn(t, .5, 300, 120, 'sawtooth', .14); nz(t, .3, 1500, 1, .2); break;
  case 'escaner': for (let i = 0; i < 8; i++) tn(t + i * .09, .07, 600 + i * 120, 620 + i * 120, 'sine', .05); break;
  case 'radio': nz(t, .35, 2500, 2, .08, 'bandpass'); break;
  case 'motor': tn(t, 2.5, 50, 140, 'sawtooth', .12); nz(t, 2.5, 300, .5, .4); break;
  case 'emp': if (!S('emp', { vol: .7, ...o })) tn(t, .8, 800, 60, 'sawtooth', .1); break;
  case 'cristal': if (!S('cristal', { vol: .7, ...o })) nz(t, .3, 7000, 1, .3, 'highpass'); break;
} } catch (e) {} }
export function engineSet(on, base = 38) {
  if (!AC) return;
  if (on && !engine) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = AC.createGain(); g.gain.value = .045; o.connect(f).connect(g).connect(master); o.start(); engine = { o, g, f }; }
  if (!on && engine) { const t = AC.currentTime; engine.g.gain.setTargetAtTime(0, t, .08); engine.o.stop(t + .5); engine = null; }
}
export function engineTune(freq, filt) { if (engine && AC) { engine.o.frequency.setTargetAtTime(freq, AC.currentTime, .08); engine.f.frequency.setTargetAtTime(filt, AC.currentTime, .1); } }
// ambiente: zumbido de alarma/viento según el capítulo
let amb = null;
export function ambiente(tipo) {
  if (!AC) return; if (amb) { const t = AC.currentTime; amb.g.gain.setTargetAtTime(0, t, .4); const a = amb; setTimeout(() => { try { a.s.stop(); } catch (e) {} }, 2500); amb = null; }
  if (!tipo) return;
  const s = AC.createBufferSource(); s.buffer = NB; s.loop = true; const f = AC.createBiquadFilter(); const g = AC.createGain(); g.gain.value = 0;
  if (tipo === 'viento') { f.type = 'lowpass'; f.frequency.value = 420; }
  else if (tipo === 'nave') { f.type = 'lowpass'; f.frequency.value = 160; }
  else { f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = .4; }
  s.connect(f).connect(g).connect(master); s.start(); g.gain.setTargetAtTime(tipo === 'nave' ? .25 : .05, AC.currentTime, 1.2); amb = { s, g };
}
export const buzz = (c, i, ms) => { try { c?.src?.gamepad?.hapticActuators?.[0]?.pulse(i, ms); } catch (e) {} };
