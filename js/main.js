// Arranque: construye el mundo, monta el menú y el bucle principal (PC y VR comparten todo).
import { conectarPerf } from './perf.js'; // primero: con ?stats engancha WebGL antes de la primera textura
import { THREE, V3, G, $, renderer, scene, capas, camera, dolly, head, vm, sky, sun, sunDir, aplicarHora, hornear, actualizarLuces, labels, rnd, lejania } from './nucleo.js';
import { actualizarFx, audio, dust, ambiente } from './fx.js';
import './mundo/iluminacion.js'; // salas: oclusión de esquinas, luz con sombra y reflejos propios (antes de compilar materiales)
import { modelo } from './cuerpos.js';
import { construirTierra } from './mundo/tierra.js';
import { construirEspacio, actualizarEspacio } from './mundo/espacio.js';
import { P, WEAPONS, updateVR, updatePC, updateViewmodel, updateArmas, playerFeet, iniciarInputPC, attachWeapon } from './jugador.js';
import { car, updateCar, exitCar, actualizarViaje } from './vehiculos.js';
import { actualizarEnemigos, actualizarSigilo, deteccion } from './enemigos.js';
import { actualizarNpcs } from './npcs.js';
import { ui, actualizarUI } from './ui.js';
import { director } from './historia/director.js';
import { ACTO1 } from './historia/acto1.js';
import { construirInteraccion, antesJugador, actualizarInteraccion, entradaPC } from './interaccion/index.js';
import { memoria } from './personajes/memoria.js';
import { construirJuego, actualizarJuego } from './juego/index.js';

const note = m => { const el = $('#vrNote'); if (el) el.textContent = m; };
note('Construyendo el mundo…');
// precarga de modelos en segundo plano (evita tirones al empezar cada capítulo)
for (const n of ['Unidad01', 'El_Rey', 'Casco_Neural']) modelo(n).catch(() => {});
await construirTierra();
await construirInteraccion(); // objetos, muebles, cristales, pickup por dentro (antes de hornear: lo fijo se fusiona)
construirJuego(); // ecos, cámaras, linterna, actividades, guía, música (js/juego)
construirEspacio();
hornear();
aplicarHora('atardecer');
director.registrar(ACTO1);

// ---------- Menú ----------
let seleccion = Math.min(director.progreso(), ACTO1.length - 1), enCurso = false;
function pintarMenu() {
  const prog = director.progreso();
  $('#continuar').textContent = enCurso ? 'Seguir jugando' : prog > 0 && prog < ACTO1.length ? `Continuar · ${ACTO1[prog].sub}` : 'Empezar el Acto I';
  $('#caps').innerHTML = ACTO1.map((c, i) => `<button class="cap${i === seleccion ? ' sel' : ''}" data-i="${i}"><span>${c.sub}</span>${c.titulo}</button>`).join('');
  document.querySelectorAll('#caps .cap').forEach(b => b.onclick = () => { seleccion = +b.dataset.i; enCurso = false; pintarMenu(); });
}
director.onFin = () => { enCurso = false; seleccion = 0; setPlaying(false); if (renderer.xr.isPresenting) renderer.xr.getSession()?.end(); pintarMenu(); };
pintarMenu();
function empezarSiHaceFalta() { if (!enCurso) { enCurso = true; const prog = director.progreso(); director.iniciarCapitulo(seleccion ?? Math.min(prog, ACTO1.length - 1)); } }
function setPlaying(on) { G.playing = on; $('#menu').hidden = on; $('#hud').hidden = !on; P.trigger = false; if (!on) { G.freeMode = false; } pintarMenu(); }
const cvs = renderer.domElement;
entradaPC(cvs); // la interacción escucha antes que jugador.js (coger/lanzar/usar)
iniciarInputPC(cvs);
$('#continuar').addEventListener('click', () => { audio(); empezarSiHaceFalta(); try { const r = cvs.requestPointerLock(); if (r && r.catch) r.catch(() => { G.freeMode = true; setPlaying(true); }); } catch (e) { G.freeMode = true; setPlaying(true); } });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === cvs) { G.freeMode = false; setPlaying(true); } else if (!G.freeMode && G.mode === 'pc') setPlaying(false); });
document.addEventListener('pointerlockerror', () => { G.freeMode = true; setPlaying(true); });
addEventListener('keydown', e => { if (e.code === 'Escape' && G.freeMode) setPlaying(false); });
$('#tShadow').addEventListener('click', () => { sun.castShadow = !sun.castShadow; $('#tShadow').textContent = 'Sombras: ' + (sun.castShadow ? 'sí' : 'no'); });
$('#tQual').addEventListener('click', () => { G.quality = G.quality ? 0 : 1; setShadowRes(G.quality ? 2048 : 1024); renderer.setPixelRatio(G.quality ? Math.min(devicePixelRatio, 1.5) : 1); dust.visible = !!G.quality; $('#tQual').textContent = 'Calidad: ' + (G.quality ? 'alta' : 'media'); });
$('#tVoz').addEventListener('click', () => { G.voces = !G.voces; $('#tVoz').textContent = 'Voces: ' + (G.voces ? 'sí' : 'no'); if (!G.voces && window.speechSynthesis) speechSynthesis.cancel(); });
$('#borrar').addEventListener('click', () => { try { localStorage.removeItem('apoc2030.cap'); } catch (e) {} memoria.reiniciar(); seleccion = 0; enCurso = false; pintarMenu(); });
function setShadowRes(n) { sun.shadow.mapSize.set(n, n); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }

// ---------- VR ----------
const vrBtn = $('#enterVR');
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { vrBtn.disabled = !ok; note(ok ? 'WebXR disponible: pulsa «Entrar en VR» con las gafas puestas.' : 'Este navegador no tiene VR. Abre este mismo enlace en el navegador de las Quest.'); }).catch(() => note('No se pudo comprobar WebXR aquí.'));
else note('Sin WebXR en este navegador (o la página no usa HTTPS). En las Quest sí funciona.');
vrBtn.addEventListener('click', async () => { audio(); try { const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }); renderer.xr.setReferenceSpaceType('local-floor'); await renderer.xr.setSession(s); } catch (e) { note('El navegador bloqueó la sesión VR (' + e.name + '). Abre la página con HTTPS en las Quest.'); } });
renderer.xr.addEventListener('sessionstart', () => {
  if (car.occupied) exitCar(true); const f = playerFeet(new V3());
  G.mode = 'vr'; G.playing = false; dolly.add(camera); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  if (!P.sentado) { scene.add(dolly); dolly.position.set(f.x, f.y, f.z); dolly.rotation.y = P.yaw; }
  vm.visible = false; $('#menu').hidden = true; $('#hud').hidden = true; renderer.xr.setFoveation?.(1); setShadowRes(1024); attachWeapon();
  empezarSiHaceFalta();
});
renderer.xr.addEventListener('sessionend', () => {
  if (car.occupied) exitCar(true); G.mode = 'pc'; head.add(camera); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); dolly.rotation.y = 0;
  vm.visible = true; setShadowRes(G.quality ? 2048 : 1024); attachWeapon(); setPlaying(false);
});

// ---------- Depuración (consola) ----------
window.__cap = i => { seleccion = i; enCurso = true; director.iniciarCapitulo(i); };
window.__paso = i => director.irAPaso(i);
window.__dbg = () => ({ cap: director.capIdx, paso: director.pasoIdx, tipo: director.paso?.t, obj: ui.obj, pos: playerFeet(new V3()).toArray().map(v => +v.toFixed(1)), hp: P.hp, arma: P.w, coche: car.occupied, det: +deteccion.v.toFixed(2) });
window.__tp = (x, z, yaw = 0) => { import('./jugador.js').then(j => j.teleport(x, z, yaw)); };
window.__look = (yaw, pitch) => { P.yaw = yaw; P.pitch = pitch; };
window.__inmune = (on = true) => { P.inmune = on; };
const tickPerf = conectarPerf(renderer, scene, capas); // window.__perf() → memoria de texturas, llamadas, triángulos

document.fonts?.ready.then(() => { for (const l of labels) if (l.arg !== null) l.set(l.arg); });
note(navigator.xr ? $('#vrNote').textContent : 'Listo.');
$('#cargando')?.remove();

// ---------- Bucle ----------
const clock = new THREE.Clock(), tA = new V3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(.05, clock.getDelta()); G.time += dt;
  camera.getWorldPosition(G.CAM);
  const activo = G.mode === 'vr' || G.playing;
  const pf = playerFeet(tA);
  if (activo) antesJugador(dt);
  if (activo && P.dead <= 0) { if (G.mode === 'vr') updateVR(dt, pf); else updatePC(dt, pf); }
  if (activo) actualizarInteraccion(dt, playerFeet(tA), { cuerpoJugador: !car.occupied && !P.sentado });
  if (activo) {
    updateArmas(dt);
    actualizarEnemigos(dt); actualizarSigilo(dt);
    updateCar(dt, pf); actualizarViaje(dt);
    director.actualizar(dt);
  }
  if (P.dead > 0) P.dead -= dt;
  actualizarNpcs(dt, director.hablante);
  if (G.enEspacio) actualizarEspacio(dt);
  if (G.mode === 'pc') {
    updateViewmodel(dt);
    G.shake = Math.max(0, G.shake - dt * 2.5); camera.rotation.set(rnd(-1, 1) * G.shake * .02, rnd(-1, 1) * G.shake * .02, rnd(-1, 1) * G.shake * .015);
  } else G.shake = Math.max(0, G.shake - dt * 2.5);
  G.hitT -= dt;
  actualizarFx(dt);
  actualizarLuces(dt, G.CAM);
  // el sol (y su sombra) sigue al jugador
  tA.copy(pf); tA.x = Math.round(tA.x); tA.z = Math.round(tA.z); sun.target.position.set(tA.x, 0, tA.z); sun.position.copy(sun.target.position).addScaledVector(sunDir, 70);
  sky.position.copy(G.CAM);
  const w = WEAPONS[P.w];
  actualizarUI(dt, { hp: Math.max(0, Math.ceil(P.hp)), w: car.occupied ? 'Al volante' : P.sentado ? 'Sentado' : w.name, ammo: car.occupied ? Math.round(Math.abs(car.speed) * 3.6) + ' km/h' : w.melee ? '∞' : P.reloading > 0 ? 'Recargando…' : `${P.ammo[w.id]} · ${(P.cargadores?.[w.id] || []).length} carg.`, det: deteccion.activa || deteccion.v > 0 ? deteccion.v : 0, visto: deteccion.visto });
  actualizarJuego(dt); // sistemas de juego (js/juego): también hace el render a textura de las cámaras
  // recorte por niebla solo en el render principal (las cámaras del lab y demás render a textura no lo usan)
  camera.getWorldPosition(lejania.c); camera.getWorldDirection(lejania.f); lejania.on = true;
  renderer.render(scene, camera); lejania.on = false;
  tickPerf?.();
});
