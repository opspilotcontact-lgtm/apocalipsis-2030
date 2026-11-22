// Cabina física de la ORION-4 (cap. 6, docs/eventos.md §2): panel de arranque junto a la rampa y palanca de
// potencia junto al asiento. Cada control es una pieza con bisagra que se agarra (VR: grip y la mano manda el
// ángulo, como las puertas de muebles.js) o se acciona mirando + E (PC). Orden real: tapa roja → BATERÍA →
// BOMBAS 1 y 2 → APU (mantener 3 s) → POTENCIA. El panel está muerto sin batería; los LED y la pantalla reaccionan.
// Los eventos (cabina_bateria / _bombas / _apu / _potencia) se emiten solo cuando el paso de la historia los espera,
// así hacerlo antes de tiempo no se pierde: en cuanto llega el paso, el estado ya cumple y avanza.
import { THREE, V3, G, clamp, cv2d, toTex } from '../nucleo.js';
import { buzz, sfx } from '../fx.js';
import { W } from '../mundo/tierra.js';
import { registrar, raiz } from './objetos.js';
import { clic, mecanico } from './sonido.js';
import { eventoHistoria } from './ruido.js';

let D = null; import('../historia/director.js').then(m => { D = m.director; }).catch(() => {});
const tA = new V3();
const MC = {
  panel: new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: .55, metalness: .6 }),
  borde: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .7, metalness: .4 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: .25, metalness: .95 }),
  tapa: new THREE.MeshStandardMaterial({ color: 0xc01a12, roughness: .35, metalness: .2, transparent: true, opacity: .92 }),
  pomo: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .5 }),
  amarillo: new THREE.MeshStandardMaterial({ color: 0xe8b400, roughness: .4 })
};
const caja = (w, h, d, m, x, y, z, par) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = false; me.receiveShadow = true; par.add(me); return me; };
const led = (par, x, y, z) => { const m = new THREE.MeshStandardMaterial({ color: 0x080808, emissive: 0x000000, emissiveIntensity: 2.5, toneMapped: false }); const me = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .008, 10), m); me.rotation.x = Math.PI / 2; me.position.set(x, y, z); par.add(me); return m; };
const ponLed = (m, c) => { m.emissive.setHex(c); m.color.setHex(c ? 0x222222 : 0x080808); };

export const cabinaOrion = { construida: false, bateria: false, tapa: false, bombas: [false, false], apu: 0, apuListo: false, potencia: false, controles: [], pantalla: null };
const C = cabinaOrion;
const listo = () => C.bateria;

// ---------- Pieza con bisagra (eje X local del pivote) ----------
// o: { padre, x, y, z, th0 (ángulo de reposo de la punta en el plano YZ), min, max (rad), largo, label, mallas(piv) → [mallas],
//      umbral (ángulo a partir del cual cuenta como «activado»), activo() }
function bisagra(o) {
  const piv = new THREE.Group(); piv.position.set(o.x, o.y, o.z); o.padre.add(piv);
  const mallas = o.mallas(piv), punta = new THREE.Object3D(); punta.position.set(0, Math.cos(o.th0) * o.largo, Math.sin(o.th0) * o.largo); piv.add(punta);
  const sentido = Math.sign(o.max + o.min) || 1; // hacia dónde «se activa»
  const p = { tipo: 'mando', label: o.label, piv, mallas, ang: 0, obj: null, mano: null,
    on: () => sentido > 0 ? p.ang > o.umbral : p.ang < o.umbral,
    activo: () => (o.activo ? o.activo() : true) && piv.parent?.visible !== false,
    centro: out => punta.getWorldPosition(out),
    agarre: {
      dist: q => punta.getWorldPosition(tA).distanceTo(q) - .03,
      agarrar(m) { if (m.sostiene || !p.activo()) return false; p.mano = m; m.sostiene = p; if (m.c) m.c.prop = p; p.obj = null; buzz(m.c, .3, 25); return true; },
      seguir(m) {
        piv.parent.worldToLocal(tA.copy(m.pos)); const dy = tA.y - piv.position.y, dz = tA.z - piv.position.z;
        let a = Math.atan2(dz, dy) - o.th0; a = Math.atan2(Math.sin(a), Math.cos(a));
        const prevOn = p.on(); p.ang = clamp(a, Math.min(o.min, o.max), Math.max(o.min, o.max)); piv.rotation.x = p.ang;
        if (p.on() !== prevOn) { clic(punta.getWorldPosition(tA)); buzz(m.c, .7, 40); }
        if (Math.hypot(dy, dz) > o.largo + .45) p.agarre.soltar(m);
      },
      soltar(m) { p.mano = null; m.sostiene = null; if (m.c) m.c.prop = null; p.obj = p.on() ? o.max : o.min; } // encaja en el extremo
    },
    pulsarE() { if (!p.activo()) { o.bloqueado?.(); return true; } p.obj = p.on() ? o.min : o.max; clic(punta.getWorldPosition(tA)); return true; },
    actualizar(dt) { if (p.mano || p.obj == null) return; const d = p.obj - p.ang, st = Math.sign(d) * Math.min(Math.abs(d), dt * 7); p.ang += st; piv.rotation.x = p.ang; if (Math.abs(d) < .002) p.obj = null; }
  };
  registrar(p); C.controles.push(p); return p;
}

// ---------- Botón del APU (mantener 3 s) ----------
function boton(padre, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); padre.add(g);
  caja(.07, .07, .012, MC.amarillo, 0, 0, .006, g);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.022, .024, .02, 16), MC.pomo); cap.rotation.x = Math.PI / 2; cap.position.z = .022; g.add(cap);
  const b = { tipo: 'mando', label: 'botón del APU', mallas: [cap], pulsado: false, pc: false, root: g,
    activo: () => listo() && C.bombas[0] && C.bombas[1],
    centro: out => cap.getWorldPosition(out),
    clic(down) { if (!b.activo()) { if (down) aviso(); return !!down; } b.pc = !!down; return true; },
    pulsarE() { if (!b.activo()) { aviso(); return true; } b.pc = true; return true; }
  };
  registrar(b); C.boton = b; C.botonCap = cap; return b;
}
function aviso() { const s = !C.bateria ? 'Sin batería: el panel está muerto' : !(C.bombas[0] && C.bombas[1]) ? 'Faltan las bombas de combustible' : ''; if (s) import('../ui.js').then(u => u.say(s)).catch(() => {}); }

// ---------- Pantalla del panel ----------
function pantalla(padre, x, y, z) {
  const [c, x2] = cv2d(256, 96), t = toTex(c, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.2, .075), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); m.position.set(x, y, z); padre.add(m);
  let k = '';
  return { set(lin, col) { const kk = lin.join('|') + col; if (kk === k) return; k = kk; x2.fillStyle = '#050807'; x2.fillRect(0, 0, 256, 96); x2.fillStyle = col; x2.font = '600 22px monospace'; lin.forEach((l, i) => x2.fillText(l, 10, 30 + i * 28)); t.needsUpdate = true; } };
}
function rotulo(padre, txt, x, y, z, w = .09) {
  const [c, x2] = cv2d(128, 32); x2.fillStyle = '#e8e8e0'; x2.font = '700 20px "Chakra Petch",sans-serif'; x2.textAlign = 'center'; x2.fillText(txt, 64, 23);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: toTex(c, false), transparent: true, depthWrite: false })); m.position.set(x, y, z); padre.add(m); return m;
}

// interruptor de palanca (con su pomo) sobre la cara del panel: reposo abajo, activado arriba
function interruptor(padre, x, y, label, activo, bloqueado) {
  return bisagra({ padre, x, y, z: .012, th0: Math.atan2(.87, -.5), min: 0, max: -1.05, umbral: -.5, largo: .04, label, activo, bloqueado,
    mallas: piv => { const v = new THREE.Mesh(new THREE.CylinderGeometry(.005, .006, .04, 8), MC.metal); v.position.set(0, Math.cos(Math.atan2(.87, -.5)) * .02, Math.sin(Math.atan2(.87, -.5)) * .02); v.rotation.x = Math.atan2(.87, -.5); piv.add(v);
      const pomo = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), MC.metal); pomo.position.set(0, -.5 * .04, .87 * .04); piv.add(pomo); return [v, pomo]; } });
}

// ---------- Montaje ----------
export function construirCabinaOrion() {
  if (C.construida || !W.orion) return false; C.construida = true;
  // 1) panel de arranque en un pedestal al pie de la rampa (Hank no llega desde dentro)
  const ped = new THREE.Group(); ped.position.set(148.3, 0, 25.6); ped.rotation.y = Math.PI / 2 + .35; raiz.add(ped);
  caja(.3, 1.0, .3, MC.borde, 0, .5, 0, ped);
  const pan = new THREE.Group(); pan.position.set(0, 1.08, .05); pan.rotation.x = -.62; ped.add(pan);
  caja(.5, .34, .04, MC.panel, 0, 0, -.02, pan); caja(.52, .36, .02, MC.borde, 0, 0, -.045, pan);
  caja(.5, .02, .05, MC.amarillo, 0, .18, -.01, pan); // franja de aviso
  C.pantalla = pantalla(pan, .13, .1, .002);
  rotulo(pan, 'BATERÍA', -.17, -.06, .002); rotulo(pan, 'BOMBA 1', -.06, -.06, .002); rotulo(pan, 'BOMBA 2', .04, -.06, .002); rotulo(pan, 'APU', .16, -.13, .002, .06);
  C.ledBat = led(pan, -.17, .07, .004); C.ledB1 = led(pan, -.06, .07, .004); C.ledB2 = led(pan, .04, .07, .004); C.ledApu = led(pan, .16, -.02, .004);
  // batería bajo tapa roja con bisagra arriba
  C.swBat = interruptor(pan, -.17, .0, 'interruptor de la batería', () => C.tapa, () => import('../ui.js').then(u => u.say('Primero levanta la tapa roja')));
  C.tapaP = bisagra({ padre: pan, x: -.17, y: .045, z: .03, th0: Math.PI, min: 0, max: -2.1, umbral: -1.0, largo: .085, label: 'tapa roja',
    mallas: piv => { const t = caja(.05, .085, .045, MC.tapa, 0, -.0425, 0, piv); return [t]; } });
  C.swB1 = interruptor(pan, -.06, .0, 'bomba 1', listo, aviso); C.swB2 = interruptor(pan, .04, .0, 'bomba 2', listo, aviso);
  boton(pan, .16, -.07, .0);
  C.panel = pan;
  // 2) palanca de potencia junto al asiento (cuelga de la nave: despega con ella)
  const seat = W.orionSeat; if (seat) {
    const g = new THREE.Group(); g.position.set(.3, .62, .42); seat.add(g); const s = 1 / (W.orion.scale.x || 1); g.scale.setScalar(s);
    caja(.08, .06, .22, MC.borde, 0, -.03, 0, g); rotulo(g, 'POTENCIA', 0, .001, -.05, .07).rotation.x = -Math.PI / 2;
    C.ledPot = led(g, 0, 0, .09);
    C.palanca = bisagra({ padre: g, x: 0, y: 0, z: -.04, th0: Math.atan2(-.35, .94), min: 0, max: .85, umbral: .6, largo: .2, label: 'palanca de potencia', activo: () => C.apuListo,
      bloqueado: () => import('../ui.js').then(u => u.say('Sin APU no hay potencia')),
      mallas: piv => { const th = Math.atan2(-.35, .94), v = new THREE.Mesh(new THREE.CylinderGeometry(.01, .012, .2, 8), MC.metal); v.position.set(0, Math.cos(th) * .1, Math.sin(th) * .1); v.rotation.x = th; piv.add(v);
        const pomo = new THREE.Mesh(new THREE.BoxGeometry(.05, .035, .035), MC.pomo); pomo.position.set(0, Math.cos(th) * .2, Math.sin(th) * .2); piv.add(pomo); return [pomo, v]; } });
  }
  return true;
}

// ---------- Bucle (lo llama index.js) ----------
let capPrev = null, pasoPrev = null, emitido = false;
function reiniciar() { C.bateria = C.tapa = C.apuListo = C.potencia = false; C.bombas = [false, false]; C.apu = 0; for (const p of C.controles) { p.ang = 0; p.obj = null; p.piv.rotation.x = 0; } emitido = false; }
export function actualizarCabinaOrion(dt, manos) {
  if (!C.construida) { if (W.orion) construirCabinaOrion(); return; }
  if (D?.cap !== capPrev) { capPrev = D?.cap; reiniciar(); }
  for (const p of C.controles) p.actualizar(dt);
  const antes = { b: C.bateria, b1: C.bombas[0], b2: C.bombas[1] };
  C.tapa = C.tapaP.on(); C.bateria = C.tapa && C.swBat.on() || (C.bateria && C.swBat.on());
  C.bombas = [listo() && C.swB1.on(), listo() && C.swB2.on()];
  if (C.bateria && !antes.b) { sfx('boot', { pos: C.panel.getWorldPosition(tA) }); }
  if ((C.bombas[0] && !antes.b1) || (C.bombas[1] && !antes.b2)) mecanico('cerrojo', C.panel.getWorldPosition(tA));
  // APU: dedo (VR, mano libre) sobre el botón, o clic/E mantenido (PC, mirándolo)
  let pulsa = false;
  if (C.boton.activo()) {
    if (G.mode === 'vr') for (const m of manos || []) if (m.c?.src && !m.sostiene && m.tip.distanceTo(C.botonCap.getWorldPosition(tA)) < .035) { pulsa = true; buzz(m.c, .25, 20); }
    if (C.boton.pc) { const ap = window.__inter?.apuntado?.(); if (G.mode === 'pc' && ap?.object?.userData.inter === C.boton) pulsa = true; else C.boton.pc = false; }
  }
  C.botonCap.position.z = pulsa ? .012 : .022;
  if (!C.apuListo) { if (pulsa) { if (C.apu === 0) sfx('motor'); C.apu = Math.min(3, C.apu + dt); if (C.apu >= 3) { C.apuListo = true; sfx('objetivo'); } } else C.apu = Math.max(0, C.apu - dt * 2); }
  C.potencia = C.apuListo && !!C.palanca?.on();
  // luces
  ponLed(C.ledBat, C.bateria ? 0x39ff7a : C.tapa ? 0xff3020 : 0);
  ponLed(C.ledB1, C.bombas[0] ? 0x39ff7a : listo() ? 0xff9a20 : 0); ponLed(C.ledB2, C.bombas[1] ? 0x39ff7a : listo() ? 0xff9a20 : 0);
  ponLed(C.ledApu, C.apuListo ? 0x39ff7a : C.apu > 0 ? (Math.sin(G.time * 18) > 0 ? 0xffb000 : 0) : 0);
  if (C.ledPot) ponLed(C.ledPot, C.potencia ? 0x39ff7a : C.apuListo ? 0xffb000 : 0);
  C.pantalla.set(!C.bateria ? ['', ''] : !C.apuListo ? ['ORION-4  28V', C.apu > 0 ? 'APU ' + Math.round(C.apu / 3 * 100) + '%' : (C.bombas[0] && C.bombas[1] ? 'APU: MANTENER' : 'COMB: BOMBAS')] : ['APU OK', C.potencia ? 'POTENCIA' : 'LISTO'], C.apuListo ? '#39ff7a' : '#ffb000');
  // eventos: solo cuando el paso actual los espera
  const p = D?.paso; if (p !== pasoPrev) { pasoPrev = p; emitido = false; } if (p?.t !== 'evento' || emitido) return;
  const ok = { cabina_bateria: C.bateria, cabina_bombas: C.bombas[0] && C.bombas[1], cabina_apu: C.apuListo, cabina_potencia: C.potencia }[p.nombre];
  if (ok) { emitido = true; eventoHistoria(p.nombre); }
}
if (typeof window !== 'undefined') window.__cabina = cabinaOrion;
