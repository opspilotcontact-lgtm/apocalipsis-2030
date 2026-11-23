// Muebles con partes móviles: puertas con bisagra (puertas, armarios, nevera, taquillas) y cajones correderos.
// VR: agarra el tirador con el grip y tira; la puerta sigue a la mano alrededor de la bisagra (como una
// restricción) y al soltar conserva la inercia; el cajón sigue la proyección de la mano sobre su guía.
// PC: E sobre la puerta/cajón lo abre o lo cierra con animación. Las partes móviles son cuerpos cinemáticos:
// empujan los objetos (cerrar un cajón arrastra lo que hay dentro). Lo que hay dentro está «guardado» (sin
// cuerpo) hasta que se coge, así no choca con el mueble ni con el bloque del mostrador donde va metido.
import { THREE, V3, clamp, fundirHijos } from '../nucleo.js';
import { buzz } from '../fx.js';
import { chirrido, portazo, deslizar } from './sonido.js';
import { cuerpoFijo, cuerpoCinematico, moverCinematico, alListo } from './fisica-adaptador.js';
import { registrar, raiz, crearProp } from './objetos.js';
import { emitirRuido, eventoHistoria } from './ruido.js';

const MM = { madera: new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: .7 }), blanco: new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: .35 }), metal: new THREE.MeshStandardMaterial({ color: 0x5a6470, roughness: .45, metalness: .7 }), tirador: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: .25, metalness: .95 }), dentro: new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: .9 }), luzNevera: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xeaf4ff, emissiveIntensity: 0 }) };
export const muebles = [];
const tA = new V3(), tB = new V3(), tQ = new THREE.Quaternion(), tP = new V3();
const caja = (w, h, d, m, x, y, z, par) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; par.add(me); return me; };

// ---------- Puerta con bisagra ----------
// o: { x, y, z (bisagra), ry (orientación cerrada: el panel va por +X local), ancho, alto, grosor, max (rad), sentido (+1/-1),
//      ang (apertura inicial), mat, tiradorY, padre, label }
export function crearPuerta(o) {
  const piv = new THREE.Group(); piv.position.set(o.x, o.y || 0, o.z); piv.rotation.y = o.ry || 0; (o.padre || raiz).add(piv);
  const W = o.ancho, H = o.alto, T = o.grosor || .04, s = o.sentido || 1, max = o.max ?? 1.9, ry0 = o.ry || 0;
  const panel = caja(W, H, T, o.mat || MM.madera, W / 2, H / 2, 0, piv);
  const ty = o.tiradorY ?? H * .45, tir = new THREE.Group(); tir.position.set(W - .07, ty, 0); piv.add(tir);
  for (const sz of [1, -1]) { const t = caja(.025, .14, .025, MM.tirador, 0, 0, sz * (T / 2 + .03), tir); caja(.02, .02, .03, MM.tirador, 0, .05, sz * (T / 2 + .015), tir); caja(.02, .02, .03, MM.tirador, 0, -.05, sz * (T / 2 + .015), tir); }
  fundirHijos(tir); // tirador: 6 piezas → 1 llamada
  const p = { tipo: 'puerta', piv, panel, label: o.label || 'puerta', ang: o.ang || 0, vel: 0, obj: null, mano: null, max, s, body: null, mallas: [panel, ...tir.children], cambio: true,
    activo: () => true,
    centro: out => tir.getWorldPosition(out),
    agarre: {
      dist: q => tir.getWorldPosition(tA).distanceTo(q) - .05,
      agarrar(m) { if (m.sostiene) return false; p.mano = m; m.sostiene = p; if (m.c) m.c.prop = p; p.obj = null; buzz(m.c, .3, 30); return true; },
      seguir(m, dt) { // la mano manda: ángulo de la mano alrededor de la bisagra
        piv.parent.worldToLocal(tA.copy(m.pos)); const dx = tA.x - piv.position.x, dz = tA.z - piv.position.z;
        let a = (Math.atan2(-dz, dx) - ry0) * s; a = Math.atan2(Math.sin(a), Math.cos(a)); a = clamp(a, 0, max);
        const nv = (a - p.ang) / Math.max(dt, 1e-3); p.vel = p.vel * .5 + nv * .5; p.ang += (a - p.ang) * Math.min(1, dt * 25); p.cambio = true;
        if (Math.hypot(dx, dz) > W + .6) p.agarre.soltar(m);
      },
      soltar(m) { p.mano = null; m.sostiene = null; if (m.c) m.c.prop = null; }
    },
    pulsarE() { p.obj = p.ang > .25 ? 0 : max * .92; return true; },
    actualizar(dt) {
      const a0 = p.ang;
      if (!p.mano) {
        if (p.obj != null) { const d = p.obj - p.ang, st = Math.sign(d) * Math.min(Math.abs(d), dt * 2.4); p.vel = st / Math.max(dt, 1e-3); p.ang += st; if (Math.abs(d) < .005) p.obj = null; }
        else if (Math.abs(p.vel) > .01) { p.ang += p.vel * dt; p.vel *= Math.max(0, 1 - dt * 2.5); }
        if (p.ang <= 0) { if (p.vel < -.8) { portazo(piv.getWorldPosition(tP), clamp(-p.vel / 4, .3, 1)); emitirRuido(tP, -p.vel > 2 ? 'portazo' : 'chirrido'); } p.ang = 0; p.vel = 0; }
        if (p.ang >= max) { p.ang = max; p.vel = -p.vel * .25; }
      }
      if (Math.abs(p.ang - a0) > 1e-5 || p.cambio) { piv.rotation.y = ry0 + p.ang * s; p.cambio = false; if (Math.abs(p.vel) > .5) { chirrido(tir.getWorldPosition(tP), Math.abs(p.vel)); if (Math.random() < dt * 1.5) emitirRuido(tP, 'chirrido'); } moverPanel(); }
    }
  };
  function moverPanel() { if (!p.body) return; piv.updateMatrixWorld(true); piv.getWorldPosition(tA); piv.getWorldQuaternion(tQ); moverCinematico(p.body, tA, tQ); }
  alListo(() => { piv.updateMatrixWorld(true); p.body = cuerpoCinematico([{ f: 'caja', m: [W / 2, H / 2, T / 2], c: [W / 2, H / 2, 0] }], piv.getWorldPosition(new V3()), piv.getWorldQuaternion(new THREE.Quaternion())); });
  piv.rotation.y = ry0 + p.ang * s;
  registrar(p); muebles.push(p); return p;
}

// ---------- Cajón corredero ----------
// o: { x, y, z (centro del cajón cerrado), ry (sale hacia +Z local), ancho, alto, fondo, max, frente (material), padre, label }
export function crearCajon(o) {
  const base = new THREE.Group(); base.position.set(o.x, o.y, o.z); base.rotation.y = o.ry || 0; (o.padre || raiz).add(base);
  const g = new THREE.Group(); base.add(g);
  const W = o.ancho, H = o.alto, D = o.fondo, max = o.max ?? D * .85, fm = o.frente || MM.madera, t = .012;
  caja(W, t, D, MM.dentro, 0, -H / 2 + t / 2, 0, g); caja(t, H * .8, D, MM.dentro, -W / 2 + t / 2, -H * .1, 0, g); caja(t, H * .8, D, MM.dentro, W / 2 - t / 2, -H * .1, 0, g); caja(W, H * .8, t, MM.dentro, 0, -H * .1, -D / 2, g); fundirHijos(g); // caja interior: 4 piezas → 1 llamada
  const frente = caja(W + .02, H, .02, fm, 0, 0, D / 2 + .01, g);
  const tir = caja(W * .35, .02, .025, MM.tirador, 0, H * .1, D / 2 + .035, g);
  const c = { tipo: 'cajon', g, label: o.label || 'cajón', e: 0, vel: 0, obj: null, mano: null, max, body: null, mallas: [frente, tir], cambio: true,
    activo: () => true, abierto: () => c.e > D * .45,
    centro: out => tir.getWorldPosition(out),
    agarre: {
      dist: q => tir.getWorldPosition(tA).distanceTo(q) - .04,
      agarrar(m) { if (m.sostiene) return false; c.mano = m; m.sostiene = c; if (m.c) m.c.prop = c; c.obj = null; c.ini = { p: m.pos.clone(), e: c.e }; buzz(m.c, .3, 30); return true; },
      seguir(m, dt) { tA.set(0, 0, 1).applyQuaternion(base.getWorldQuaternion(tQ)); const e = clamp(c.ini.e + tB.subVectors(m.pos, c.ini.p).dot(tA), 0, max); c.vel = (e - c.e) / Math.max(dt, 1e-3); c.e = e; c.cambio = true; if (tB.length() > max + .5) c.agarre.soltar(m); },
      soltar(m) { c.mano = null; m.sostiene = null; if (m.c) m.c.prop = null; }
    },
    pulsarE() { c.obj = c.e > max * .3 ? 0 : max; deslizar(tir.getWorldPosition(tP)); emitirRuido(tP, 'cajon'); return true; },
    actualizar(dt) {
      const e0 = c.e;
      if (!c.mano) {
        if (c.obj != null) { const d = c.obj - c.e, st = Math.sign(d) * Math.min(Math.abs(d), dt * 1.2); c.e += st; c.vel = st / Math.max(dt, 1e-3); if (Math.abs(d) < .002) c.obj = null; }
        else if (Math.abs(c.vel) > .01) { c.e += c.vel * dt; c.vel *= Math.max(0, 1 - dt * 6); }
        if (c.e <= 0) { if (c.vel < -.4) portazo(tir.getWorldPosition(tP), .35); c.e = 0; c.vel = 0; }
        if (c.e >= max) { if (c.vel > .4) portazo(tir.getWorldPosition(tP), .25); c.e = max; c.vel = 0; }
      }
      const ab = c.abierto(); if (ab && !c.fueAbierto) eventoHistoria('cajon_abierto', { label: c.label }); c.fueAbierto = ab; // prólogo: «pásame el destornillador»
      if (Math.abs(c.e - e0) > 1e-5 || c.cambio) { g.position.z = c.e; c.cambio = false; if (c.body) { g.updateMatrixWorld(true); moverCinematico(c.body, g.getWorldPosition(tA), g.getWorldQuaternion(tQ)); } }
    },
    // mete un objeto del catálogo dentro (coordenadas locales del cajón; y = fondo del cajón)
    meter(tipo, lx, lz, op = {}) { return crearProp(tipo, lx, -H / 2 + t, lz, { ...op, padre: g, contenedor: c }); }
  };
  alListo(() => { g.updateMatrixWorld(true); c.body = cuerpoCinematico([{ f: 'caja', m: [W / 2, t / 2, D / 2], c: [0, -H / 2 + t / 2, 0] }, { f: 'caja', m: [W / 2, H * .4, t / 2], c: [0, -H * .1, -D / 2] }, { f: 'caja', m: [W / 2, H / 2, .01], c: [0, 0, D / 2 + .01] }], g.getWorldPosition(new V3()), g.getWorldQuaternion(new THREE.Quaternion())); });
  registrar(c); muebles.push(c); return c;
}

// ---------- Armario / nevera / taquilla: cuerpo fijo con baldas y una puerta ----------
// o: { x, y, z (centro de la base), ry (el frente mira a +Z local), w, h, d, mat, baldas: [y…], tipo: 'nevera'|'taquilla'|'armario', padre, label }
export function crearArmario(o) {
  const g = new THREE.Group(); g.position.set(o.x, o.y || 0, o.z); g.rotation.y = o.ry || 0; (o.padre || raiz).add(g);
  const { w, h, d } = o, t = .025, m = o.mat || (o.tipo === 'nevera' ? MM.blanco : o.tipo === 'taquilla' ? MM.metal : MM.madera);
  const paneles = [[w, t, d, 0, t / 2, 0], [w, t, d, 0, h - t / 2, 0], [t, h, d, -w / 2 + t / 2, h / 2, 0], [t, h, d, w / 2 - t / 2, h / 2, 0], [w, h, t, 0, h / 2, -d / 2 + t / 2], ...(o.baldas || []).map(y => [w - 2 * t, .015, d - t, 0, y, t / 2])];
  paneles.forEach(([a, b, c2, x, y, z], i) => caja(a, b, c2, i === 4 || i > 4 ? (o.tipo === 'nevera' && i > 4 ? new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: .5, roughness: .1 }) : m) : m, x, y, z, g));
  fundirHijos(g); // cuerpo y baldas: 1 llamada por material (antes de la puerta, la luz y lo que se meta dentro)
  let luz = null; if (o.tipo === 'nevera') { luz = caja(w * .5, .02, .06, MM.luzNevera.clone(), 0, h - .06, -d / 4, g); }
  // la puerta se abre hacia fuera: el panel va por +X local cerrado y gira hacia +Z (sentido -1 en Y)
  const puerta = crearPuerta({ x: -w / 2, y: 0, z: d / 2 + .02, ry: 0, ancho: w, alto: h, grosor: .04, max: o.max ?? 1.8, sentido: -1, mat: m, padre: g, label: o.label || (o.tipo === 'nevera' ? 'nevera' : 'armario'), tiradorY: o.tipo === 'nevera' ? h * .62 : h * .5 });
  const a = { tipo: 'armario', g, puerta, abierto: () => puerta.ang > .7, luz,
    meter(tipo, lx, ly, lz, op = {}) { return crearProp(tipo, lx, ly, lz, { ...op, padre: g, contenedor: a }); },
    actualizar() { if (luz) luz.material.emissiveIntensity = puerta.ang > .05 ? 2.2 : 0; } };
  alListo(() => { g.updateMatrixWorld(true); const q = g.getWorldQuaternion(new THREE.Quaternion()), e = new THREE.Euler().setFromQuaternion(q);
    cuerpoFijo(paneles.map(([a2, b, c2, x, y, z]) => { const p = g.localToWorld(new V3(x, y, z)); return { f: 'caja', m: [a2 / 2, b / 2, c2 / 2], c: [p.x, p.y, p.z], rx: e.x, ry: e.y, rz: e.z }; })); });
  muebles.push(a); return a;
}
export function actualizarMuebles(dt) { for (const m of muebles) m.actualizar?.(dt); }
