// Instrumentos: piano vertical de 3 octavas (Do3-Do6). Las teclas son dos InstancedMesh (2 llamadas de dibujo).
// VR: la punta de los dedos (de cada mando) baja la tecla al tocarla desde arriba; la fuerza sale de la velocidad
// de bajada. PC: clic sobre la tecla (mantener = mantener la nota). Suena con el sintetizador de sonido.js.
import { THREE, V3, clamp } from '../nucleo.js';
import { buzz } from '../fx.js';
import { notaPiano } from './sonido.js';
import { cuerpoFijo, alListo } from './fisica-adaptador.js';
import { registrar, raiz, props, ACORDES, rasguear } from './objetos.js';

const MP = { caja: new THREE.MeshStandardMaterial({ color: 0x1c110b, roughness: .28, metalness: .05 }), blanca: new THREE.MeshStandardMaterial({ color: 0xf2eee2, roughness: .35 }), negra: new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: .3 }), laton: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: .3, metalness: .9 }) };
export const pianos = [];
// o: { x, y, z, ry, padre } · el teclado mira a +Z local
export function crearPiano(o) {
  const g = new THREE.Group(); g.position.set(o.x, o.y || 0, o.z); g.rotation.y = o.ry || 0; (o.padre || raiz).add(g);
  const W = 1.3, add = (w, h, d, x, y, z, m = MP.caja) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; g.add(me); return me; };
  add(W, 1.25, .3, 0, .625, -.15); add(W, .06, .3, 0, .69, .15); add(.06, .2, .3, -W / 2 + .03, .76, .15); add(.06, .2, .3, W / 2 - .03, .76, .15);
  add(.9, .14, .02, 0, .88, .01); add(.5, .22, .015, 0, 1.0, .02).rotation.x = -.2; add(W + .04, .03, .34, 0, 1.265, -.14);
  for (const sx of [-1, 1]) add(.05, .66, .05, sx * .6, .33, .27);
  for (const sx of [-.06, .06]) add(.025, .015, .07, sx, .06, .05, MP.laton);
  // teclas
  const ww = .03, wl = .15, bw = .017, bl = .095, top = .74, z0 = .3, teclas = [], blancas = [], negras = [];
  const patron = [0, 2, 4, 5, 7, 9, 11], conNegra = [1, 1, 0, 1, 1, 1, 0];
  for (let i = 0; i < 22; i++) { const oct = Math.floor(i / 7), k = i % 7; blancas.push({ midi: 48 + oct * 12 + patron[k], x: -11 * ww + ww * (i + .5), negra: false }); if (conNegra[k] && i < 21) negras.push({ midi: 48 + oct * 12 + patron[k] + 1, x: -11 * ww + ww * (i + 1), negra: true }); }
  const iw = new THREE.InstancedMesh(new THREE.BoxGeometry(ww - .0015, .02, wl), MP.blanca, blancas.length), ib = new THREE.InstancedMesh(new THREE.BoxGeometry(bw, .018, bl), MP.negra, negras.length);
  iw.castShadow = ib.castShadow = false; iw.receiveShadow = true; g.add(iw, ib);
  const M = new THREE.Matrix4();
  const colocar = t => { M.makeTranslation(t.x, t.negra ? top + .009 - t.baja : top - .01 - t.baja, t.negra ? z0 - wl + bl / 2 : z0 - wl / 2); (t.negra ? ib : iw).setMatrixAt(t.i, M); (t.negra ? ib : iw).instanceMatrix.needsUpdate = true; };
  blancas.forEach((t, i) => { t.i = i; t.baja = 0; teclas.push(t); colocar(t); }); negras.forEach((t, i) => { t.i = i; t.baja = 0; teclas.push(t); colocar(t); });
  iw.computeBoundingSphere(); ib.computeBoundingSphere();
  const pos = new V3();
  const piano = { g, teclas, W, iw, ib, label: 'piano', mallas: [iw, ib], porDedo: new Map(), raton: null,
    pulsar(t, vel) { t.n = (t.n || 0) + 1; if (t.n > 1) return; t.baja = .008; colocar(t); t.nota = notaPiano(t.midi, g.localToWorld(pos.set(t.x, top, 0)), vel); },
    soltar(t) { t.n = Math.max(0, (t.n || 0) - 1); if (t.n) return; t.baja = 0; colocar(t); t.nota?.soltar(); t.nota = null; },
    // PC: clic sobre una instancia
    clic(down, hit) { if (down) { if (!hit || hit.instanceId == null) return false; const t = teclas.find(q => q.negra === (hit.object === ib) && q.i === hit.instanceId); if (!t) return false; piano.raton = t; piano.pulsar(t, .75); return true; } if (piano.raton) { piano.soltar(piano.raton); piano.raton = null; } return true; },
    // tecla bajo un punto local (o null)
    teclaEn(l) {
      if (Math.abs(l.x) > 11 * ww || l.z > z0 + .01 || l.z < z0 - wl) return null;
      if (l.z < z0 - wl + bl && l.y < top + .02 && l.y > top - .025) { const t = negras.find(q => Math.abs(q.x - l.x) < bw / 2 + .002); if (t) return t; }
      if (l.y < top + .002 && l.y > top - .03) return blancas[clamp(Math.floor((l.x + 11 * ww) / ww), 0, 21)];
      return null;
    }
  };
  alListo(() => { g.updateMatrixWorld(true); const c = g.localToWorld(new V3(0, .37, 0)), c2 = g.localToWorld(new V3(0, .9, -.15)); cuerpoFijo([{ f: 'caja', m: [W / 2, .36, .3], c: [c.x, c.y, c.z], ry: g.rotation.y }, { f: 'caja', m: [W / 2, .36, .15], c: [c2.x, c2.y, c2.z], ry: g.rotation.y }]); });
  registrar(piano); pianos.push(piano); return piano;
}
const tL = new V3(), tB = new V3();
// dedos: [{ clave, p: V3 mundo, c: mando }] (puntas de los dedos de cada mano)
export function actualizarInstrumentos(dt, dedos) {
  for (const pi of pianos) {
    for (const d of dedos) {
      tL.copy(d.p); pi.g.worldToLocal(tL);
      const prev = pi.porDedo.get(d.clave), t = pi.teclaEn(tL);
      const vy = prev ? (prev.y - tL.y) / Math.max(dt, 1e-3) : .5;
      if (t !== prev?.t) { if (prev?.t) pi.soltar(prev.t); if (t) { pi.pulsar(t, clamp(.35 + vy * .5, .25, 1)); buzz(d.c, .2, 20); } }
      pi.porDedo.set(d.clave, { t, y: tL.y });
    }
  }  // guitarras: la punta del dedo cruza el plano de las cuerdas sobre la boca → rasgueo (abajo/arriba)
  for (const pr of props) {
    if (pr.tipo !== 'guitarra' || pr.estado === 'roto') continue; pr.porDedo ||= new Map();
    for (const d of dedos) {
      if (pr.manos.some(m => m.id === d.clave)) continue; // la mano que la sujeta no rasguea
      tL.copy(d.p); pr.root.worldToLocal(tL); const lado = tL.z > .052, prev = pr.porDedo.get(d.clave);
      const dentro = Math.abs(tL.x) < .14 && tL.y > .06 && tL.y < .44 && Math.abs(tL.z - .052) < .09;
      if (prev && dentro && prev.lado !== lado) {
        // acorde según dónde sujeta la otra mano el mástil (4 trastes «de juego»); si nadie la sujeta, Mi menor
        let ac = ACORDES[0]; const m = pr.manos[0]; if (m) { tB.copy(m.pos); pr.root.worldToLocal(tB); if (tB.y > .6) ac = ACORDES[Math.min(3, Math.floor((tB.y - .6) / .14))]; }
        const vy = (tL.y - prev.y) / Math.max(dt, 1e-3); rasguear(pr, ac, vy < 0 ? 1 : -1, clamp(.4 + Math.abs(vy) * .25, .3, 1)); buzz(d.c, .3, 25);
      }
      pr.porDedo.set(d.clave, { lado, y: tL.y });
    }
  }
}
