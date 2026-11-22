// Oído y patrulla de los robots (docs/diseno-vr.md §3.8): los eventos de ruido de interaccion/ruido.js crean un
// punto de investigación; el R-7 va, ESCANEA con un haz rojo visible desde los ojos (3 s) y vuelve a su ruta.
// Dos ruidos seguidos (< 8 s) o verte → ALERTA (pasa al modo de persecución de siempre).
// Los guardias humanos del sigilo también oyen: van a mirar al punto un rato y vuelven a su ronda.
//
// Uso desde la historia:  spawn('r7', x, z, { ruta: [[x,z], [x,z]…] })   (o { oido: true } para uno quieto que vigila)
// Estado del robot: e.modo = 'patrulla' | 'investigar' | 'escanear' | 'alerta'
import { THREE, V3, G, rnd, angLerp, envActivo } from '../nucleo.js';
import { escucharRuido } from '../interaccion/ruido.js';
import { sfx } from '../fx.js';

let robots = [], guardias = [], jugador = null;
// enemigos.js registra sus listas (evita importaciones circulares)
export function registrarOido(listaRobots, listaGuardias, P) { robots = listaRobots; guardias = listaGuardias; jugador = P; }

const VISTA = 11, ANG = .55, DOBLE = 8, ESCANEO = 3.2;
const matHaz = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
const geoHaz = (() => { const L = 7, g = new THREE.ConeGeometry(Math.tan(.2) * L, L, 16, 1, true); g.translate(0, -L / 2, 0); g.rotateX(-Math.PI / 2); return g; })();

export function prepararOido(e, o) {
  e.modo = 'patrulla'; e.ruta = o.ruta || null; e.ri = 1; e.rdir = 1; e.pausaR = 0; e.yawBase = o.mira ?? e.R.root.rotation.y;
  e.oidoT = -99; e.punto = new V3(); e.escT = 0; e.losT = Math.random() * .25; e.ve = false;
  const haz = new THREE.Mesh(geoHaz, matHaz); haz.position.set(0, .2, .16); haz.visible = false; haz.renderOrder = 5; e.haz = haz;
  e.sinHaz = !!e.humano; if (!e.sinHaz) e.R.neck.add(haz); // los humanos no llevan haz (oyen y miran igual)
}
export function alertar(e) { if (!e.modo || e.modo === 'alerta') return; e.modo = 'alerta'; e.state = 'chase'; if (e.haz) e.haz.visible = false; sfx('alerta', { pos: e.pos }); }

// ---------- Oyente de ruido ----------
escucharRuido(ev => {
  // contener la respiración anula los ruidos del propio cuerpo (respiración, tos)
  if (ev.fuente === 'jugador' && jugador?.()?.conteniendo && (ev.tipo === 'respiracion' || ev.tipo === 'tos')) return;
  for (const e of robots) {
    if (!e.alive || !e.modo || e.modo === 'alerta') continue;
    const d = Math.hypot(ev.pos.x - e.pos.x, ev.pos.z - e.pos.z); if (d > ev.radio) continue;
    if (G.time - e.oidoT < DOBLE && e.modo !== 'patrulla') { alertar(e); continue; } // segundo ruido: alerta
    e.oidoT = G.time; e.punto.set(ev.pos.x, 0, ev.pos.z); e.modo = 'investigar'; e.escT = 0; e.haz.visible = !e.sinHaz;
    if (!e.humano) sfx('boot', { pos: e.pos, vol: .35 });
  }
  for (const g of guardias) {
    const d = Math.hypot(ev.pos.x - g.pos.x, ev.pos.z - g.pos.z); if (d > ev.radio) continue;
    g.objetivo = new V3(ev.pos.x, 0, ev.pos.z); g.oidoHasta = G.time + 7;
  }
});

// ---------- Cerebro por fotograma (lo llama updateEnemy cuando e.modo no es 'alerta') ----------
// devuelve { want, face } · pf = pies del jugador
const ray = new THREE.Raycaster(), _o = new V3(), _d = new V3();
export function cerebroOido(e, dt, pf, ph) {
  let want = 0, face = e.R.root.rotation.y;
  if (e.modo === 'patrulla') {
    e.haz.visible = false;
    if (e.ruta && e.ruta.length > 1) {
      const t = e.ruta[e.ri], dx = t[0] - e.pos.x, dz = t[1] - e.pos.z, d = Math.hypot(dx, dz);
      if (e.pausaR > 0) { e.pausaR -= dt; face = e.yawPausa + Math.sin(G.time * 1.1) * .6; }
      else if (d < .45) { e.pausaR = 1.6; e.yawPausa = face; e.ri += e.rdir; if (e.ri >= e.ruta.length || e.ri < 0) { e.rdir *= -1; e.ri += 2 * e.rdir; } }
      else { face = Math.atan2(dx, dz); want = 1.3; }
    } else face = e.yawBase + Math.sin(G.time * .5 + e.pos.x) * .7;
  } else if (e.modo === 'investigar') {
    const dx = e.punto.x - e.pos.x, dz = e.punto.z - e.pos.z, d = Math.hypot(dx, dz);
    face = Math.atan2(dx, dz); want = d > 1.3 ? 2.1 : 0;
    if (d <= 1.3 || G.time - e.oidoT > 12) { e.modo = 'escanear'; e.escT = 0; e.yawEsc = face; }
  } else if (e.modo === 'escanear') {
    e.escT += dt; face = e.yawEsc + Math.sin(e.escT * 2.1) * .9;
    if (e.escT > ESCANEO) { e.modo = 'patrulla'; e.haz.visible = false; }
  }
  if (e.sinHaz) e.haz.visible = false;
  // el haz barre un poco por su cuenta (cabeza que busca)
  if (e.haz.visible) { e.haz.rotation.y = Math.sin(G.time * 3.1 + e.pos.z) * .25; matHaz.opacity = .08 + Math.random() * .03; }
  // ¿te ve? (cono de los ojos; agachado o en sombra se ve menos si la interacción lo indica)
  const vis = VISTA * (G.sigilo?.visMult ?? 1) * (e.modo === 'escanear' ? 1.15 : 1);
  const dx = ph.x - e.pos.x, dz = ph.z - e.pos.z, d = Math.hypot(dx, dz);
  e.ve = false;
  if (d < 1.2) e.ve = true;
  else if (d < vis) {
    const fy = e.R.root.rotation.y + (e.haz.visible ? e.haz.rotation.y : 0), c = (dx * Math.sin(fy) + dz * Math.cos(fy)) / d;
    if (c > Math.cos(ANG)) {
      e.losT -= dt;
      if (e.losT <= 0) { e.losT = .25; _o.set(e.pos.x, e.pos.y + 1.55 * e.S, e.pos.z); _d.subVectors(ph, _o); const L = _d.length(); ray.set(_o, _d.normalize()); ray.far = L - .3; e.los = ray.intersectObjects(envActivo(), false).length === 0; }
      e.ve = !!e.los;
    }
  }
  if (e.ve) { e.vistoT = (e.vistoT || 0) + dt; if (e.vistoT > (d < 4 ? .25 : .8)) alertar(e); } else e.vistoT = Math.max(0, (e.vistoT || 0) - dt);
  return { want, face };
}
// guardias: el ruido caduca y vuelven a su ronda
export function actualizarOidoGuardias() { for (const g of guardias) if (g.oidoHasta && G.time > g.oidoHasta) { g.objetivo = null; g.oidoHasta = 0; } }
export const robotsTeVen = () => robots.some(e => e.alive && e.modo && e.modo !== 'alerta' && e.ve);
export const hayPatrullas = () => robots.some(e => e.alive && e.modo && e.modo !== 'alerta');
