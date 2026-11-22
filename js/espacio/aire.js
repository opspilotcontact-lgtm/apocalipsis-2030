// Aire de la sala: presión por zona (pasillo C, esclusa A, hangar H), ciclo de la esclusa, ventana reventada
// (venteo en ~4-5 s que arrastra lo suelto hacia el hueco) y mampara de emergencia.
import * as THREE from 'three';
import { F, crearProp, quitarProp } from './fisica.js';
import { S, zonaDe } from './sala.js';

const V = THREE.Vector3;
export const AIRE = {
  p: { C: 1, A: 1, H: 1, V: 0 },
  puertas: { in: { a: 1, obj: 1 }, ex: { a: 0, obj: 0 } }, // a = 0 cerrada · 1 abierta
  ciclo: null,          // { dir: 'fuera'|'dentro', fase: 'cerrar'|'bombear'|'abrir' }
  ventanaRota: false, mampara: 0, mamparaObj: 0,
  flujoVenteo: 0, flujoEsclusa: 0, eventos: [],
};
const ev = (t) => AIRE.eventos.push(t);
const tmp = new V(), _sal = new V(0, 2.25, -29);

export function pedirCiclo() {
  if (AIRE.ciclo) return false;
  const fuera = AIRE.puertas.in.a > .5; // si la interior está abierta, el ciclo es hacia el hangar
  AIRE.ciclo = { dir: fuera ? 'fuera' : 'dentro', fase: 'cerrar' };
  ev(fuera ? 'Esclusa: ciclo hacia el hangar' : 'Esclusa: ciclo hacia el pasillo');
  return true;
}
export function alternarMampara() { AIRE.mamparaObj = AIRE.mamparaObj ? 0 : 1; ev(AIRE.mamparaObj ? 'Mampara de emergencia: cerrando' : 'Mampara: abriendo'); }

export function romperVentana(scene) {
  if (AIRE.ventanaRota) return;
  AIRE.ventanaRota = true;
  F.world.removeCollider(S.vidrio.col, false); S.vidrio.mesh.visible = false;
  const mat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .5, roughness: .1 });
  for (let i = 0; i < 10; i++) {
    const a = .08 + Math.random() * .15, m = new THREE.Mesh(new THREE.BoxGeometry(a, .006, a * .8), mat);
    m.position.set((Math.random() - .5) * 1.8, 1.6 + Math.random() * 1.3, -26.9); m.rotation.set(Math.random() * 6, Math.random() * 6, 0); scene.add(m);
    crearProp(m, { tipo: 'caja', x: a, y: .006, z: a * .8 }, { tipo: 'vidrio', densidad: 2500, v: { x: 0, y: 0, z: .5 }, w: { x: 3, y: 2, z: 1 } });
  }
  ev('¡VENTANA ROTA! Despresurización del hangar');
}

const conectaHangar = (zona) => zona === 'H' || (zona === 'A' && AIRE.puertas.ex.a > .3) || (zona === 'C' && AIRE.puertas.ex.a > .3 && AIRE.puertas.in.a > .3);

// aceleración del venteo en un punto (m/s²)
export function aceleracionVenteo(p, out) {
  out.set(0, 0, 0);
  if (AIRE.flujoVenteo < .02) return out;
  const z = zonaDe(p);
  if (z === 'V') { if (p.z < -26.9 && p.z > -34) out.set(0, 0, -AIRE.flujoVenteo * 8); return out; } // chorro de salida
  if (!conectaHangar(z)) return out;
  // a través de la esclusa: primero hacia la puerta exterior, luego al hueco
  const destino = z === 'H' ? S.ventana.centro : tmp.set(0, 1.3, -15.6);
  out.subVectors(destino, p); const d = out.length() || 1;
  return out.multiplyScalar(AIRE.flujoVenteo * 16 / (1 + .12 * d) / d);
}

const _a = new V();
export function actualizarAire(dt, scene) {
  const P = AIRE.puertas, p = AIRE.p, c = AIRE.ciclo, pA0 = p.A;
  // ---- ciclo de la esclusa ----
  if (c) {
    if (c.fase === 'cerrar') { P.in.obj = 0; P.ex.obj = 0; if (P.in.a < .01 && P.ex.a < .01) { c.fase = 'bombear'; ev(c.dir === 'fuera' ? 'Despresurizando…' : 'Presurizando…'); } }
    else if (c.fase === 'bombear') {
      const obj = c.dir === 'fuera' ? p.H : 1;
      p.A += Math.sign(obj - p.A) * Math.min(Math.abs(obj - p.A), dt / 3.5);
      if (Math.abs(p.A - obj) < .01) { c.fase = 'abrir'; ev('Presión igualada · abriendo'); }
    } else { (c.dir === 'fuera' ? P.ex : P.in).obj = 1; if ((c.dir === 'fuera' ? P.ex : P.in).a > .99) AIRE.ciclo = null; }
  }
  // puertas y mampara (cinemáticas)
  for (const k of ['in', 'ex']) {
    const d = P[k]; d.a += Math.sign(d.obj - d.a) * Math.min(Math.abs(d.obj - d.a), dt / 1.4);
    const o = S.puertas[k], y = o.base.y + d.a * 2.6;
    o.body.setNextKinematicTranslation({ x: o.base.x, y, z: o.base.z }); o.mesh.position.set(o.base.x, y, o.base.z);
  }
  AIRE.mampara += Math.sign(AIRE.mamparaObj - AIRE.mampara) * Math.min(Math.abs(AIRE.mamparaObj - AIRE.mampara), dt / 1.5);
  { const o = S.mampara, y = o.base.y - AIRE.mampara * 1.95; o.body.setNextKinematicTranslation({ x: o.base.x, y, z: o.base.z }); o.mesh.position.set(o.base.x, y, o.base.z); }

  // ---- presiones ----
  const hueco = AIRE.ventanaRota && AIRE.mampara < .97;
  if (hueco) p.H -= p.H * dt / 1.4;                         // ~95 % fuera en 4-5 s
  else if (p.H < 1 && !(P.ex.a > .3 && p.A < .99)) p.H = Math.min(1, p.H + dt * .08); // soporte vital re-presuriza despacio
  if (P.ex.a > .3) { const m = (p.A + p.H) / 2, k = Math.min(1, dt * 3); p.A += (m - p.A) * k; p.H += (m - p.H) * k; }
  if (P.in.a > .3) p.A += (1 - p.A) * Math.min(1, dt * 3); // el pasillo es la nave: reserva infinita
  if (hueco && P.ex.a > .3 && P.in.a > .3) p.C = p.A; else p.C = 1;
  AIRE.flujoVenteo = hueco ? p.H : 0;
  AIRE.flujoEsclusa = Math.min(1, Math.abs(p.A - pA0) / dt * 2.5);

  // ---- venteo sobre los objetos sueltos ----
  for (let i = F.props.length - 1; i >= 0; i--) {
    const pr = F.props[i], t = pr.body.translation();
    if (pr.agarrado) continue;
    tmp.set(t.x, t.y, t.z);
    if (AIRE.flujoVenteo > .02) { aceleracionVenteo(tmp, _a); if (_a.lengthSq() > 0) pr.body.applyImpulse({ x: _a.x * pr.masa * dt, y: _a.y * pr.masa * dt, z: _a.z * pr.masa * dt }, true); }
    if (tmp.distanceTo(_sal) > 120) quitarProp(pr); // perdido en el vacío
  }
  // luz de la esclusa: ámbar normal, roja mientras bombea
  S.luzEsclusa.color.setHex(c?.fase === 'bombear' ? 0xff2a1a : 0xffb040);
  S.marcoVentana.visible = !hueco || (performance.now() % 500 < 250);
}

export const presionEn = (p) => AIRE.p[zonaDe(p)];
