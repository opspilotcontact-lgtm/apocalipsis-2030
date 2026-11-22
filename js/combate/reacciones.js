// Reacciones al dolor y posturas de daño, como CAPA encima de animRig (cuerpos.js) sin tocarlo:
//   quitarCapa(R)  → antes de animRig: devuelve cada hueso al valor que dejó animRig el fotograma anterior
//   ponerCapa(e,dt)→ después de animRig: suma reacciones (cabeza, vientre, hombro, rodilla), cojera, brazo roto
//                    colgando, aturdimiento y arrastre (robot sin piernas).
// Así animRig sigue interpolando su propia pose y la capa nunca se acumula.
import { mix, clamp } from '../nucleo.js';

// ---------- Capa reversible ----------
function guarda(R, o, ax, pos = false) { (R._capa ||= []).push([o, ax, pos ? o.position[ax] : o.rotation[ax], pos]); }
const suma = (R, o, ax, v) => { if (!v) return; guarda(R, o, ax); o.rotation[ax] += v; };
const fija = (R, o, ax, v) => { guarda(R, o, ax); o.rotation[ax] = v; };
export function quitarCapa(R) {
  const c = R._capa; if (!c || !c.length) return;
  for (let i = c.length - 1; i >= 0; i--) { const [o, ax, v, pos] = c[i]; if (pos) o.position[ax] = v; else o.rotation[ax] = v; }
  c.length = 0;
}

// ---------- Reacción por zona (con variantes al azar dentro de cada zona) ----------
// e.dolor = canales 0..1 que decaen solos; cada golpe elige una variante para que no se repita siempre igual
// lado: +1 golpe desde la izquierda del personaje, -1 desde la derecha (x local de la dirección del golpe)
const CANALES = ['cab', 'cabY', 'cabZ', 'menton', 'vientre', 'atras', 'giro', 'hombroL', 'hombroR', 'fueraL', 'fueraR', 'rodillaL', 'rodillaR', 'patadaL', 'patadaR'];
const sube = (d, k, v, max = 1.3) => { d[k] = clamp(d[k] + v, -max, max); };
export function reaccionar(e, zona, lado, fuerza, tipo = 'bala') {
  const d = e.dolor ||= Object.fromEntries(CANALES.map(k => [k, 0]));
  const f = clamp(fuerza, .2, 1.2) * (tipo === 'contundente' ? 1.15 : 1), s = zona.endsWith('L') ? 'L' : zona.endsWith('R') ? 'R' : null, r = Math.random();
  const ld = lado || (Math.random() < .5 ? -1 : 1);
  if (zona === 'head' || zona === 'neck') {
    if (r < .45) { sube(d, 'cab', f); sube(d, 'cabY', -ld * f * .6); }            // latigazo hacia atrás
    else if (r < .8) { sube(d, 'cabY', -ld * f * 1.2); sube(d, 'cabZ', ld * f * .8); sube(d, 'cab', f * .3); } // giro de cara (gancho)
    else { sube(d, 'menton', f); sube(d, 'atras', f * .4); }                       // cabeza hacia abajo y paso atrás
  } else if (zona === 'torso' || zona === 'pelvis') {
    if (r < .45 || tipo === 'contundente' && r < .7) { sube(d, 'vientre', f * (zona === 'pelvis' ? 1.1 : .85)); sube(d, 'menton', f * .3); } // se dobla
    else if (r < .8) { sube(d, 'giro', -ld * f * .9); sube(d, 'hombro' + (ld > 0 ? 'L' : 'R'), f * .5); } // giro del tronco
    else { sube(d, 'atras', f); sube(d, 'cab', f * .4); }                         // se arquea hacia atrás
  } else if (zona.startsWith('upperArm') || zona.startsWith('foreArm') || zona.startsWith('hand')) {
    if (r < .55) { sube(d, 'hombro' + s, f); sube(d, 'giro', (s === 'L' ? 1 : -1) * f * .4); }
    else { sube(d, 'fuera' + s, f); sube(d, 'hombro' + s, f * .4); }              // el brazo sale despedido hacia fuera
  } else if (zona.startsWith('thigh') || zona.startsWith('shin') || zona.startsWith('foot')) {
    if (r < .6) sube(d, 'rodilla' + s, f);                                        // la rodilla cede
    else { sube(d, 'patada' + s, f); sube(d, 'vientre', f * .25); }               // la pierna se va hacia atrás
  }
}

export function ponerCapa(e, dt) {
  const R = e.R, d = e.dolor; R._capa ||= [];
  const t = R.t, ph = R.phase, amp = R.amp;
  // --- reacciones (decaen con un muelle rápido)
  if (d) {
    const k = Math.min(1, dt * 3.4); for (const n in d) d[n] = mix(d[n], 0, k);
    suma(R, R.neck, 'x', -d.cab * .75 + d.menton * .55 + d.vientre * .3); suma(R, R.neck, 'y', d.cabY * .55); suma(R, R.neck, 'z', d.cabZ * .35);
    suma(R, R.spine, 'x', -d.cab * .18 + d.vientre * .65 - d.atras * .45); suma(R, R.spine, 'y', d.giro * .55 + (d.hombroL - d.hombroR) * .35); suma(R, R.spine, 'z', d.cabZ * .12 + (d.rodillaR - d.rodillaL) * .2);
    suma(R, R.legL.kn, 'x', d.vientre * .35 + d.rodillaL * 1.1 + d.atras * .2); suma(R, R.legR.kn, 'x', d.vientre * .35 + d.rodillaR * 1.1 + d.atras * .2);
    suma(R, R.legL.hp, 'x', -d.rodillaL * .5 + d.patadaL * .7 - d.atras * .15); suma(R, R.legR.hp, 'x', -d.rodillaR * .5 + d.patadaR * .7 - d.atras * .15);
    suma(R, R.armL.sh, 'x', d.hombroL * .7 + d.atras * .3); suma(R, R.armR.sh, 'x', d.hombroR * .7 + d.atras * .3);
    suma(R, R.armL.sh, 'z', d.hombroL * .35 + d.fueraL * .9); suma(R, R.armR.sh, 'z', -d.hombroR * .35 - d.fueraR * .9);
    suma(R, R.armL.el, 'x', d.fueraL * .6); suma(R, R.armR.el, 'x', d.fueraR * .6);
    const baja = Math.max(d.vientre * .06, d.rodillaL * .12, d.rodillaR * .12, d.atras * .03);
    if (baja > .002) { guarda(R, R.hips, 'y', true); R.hips.position.y -= baja; }
  }
  // --- cojera (pierna dañada o rota): la cadera cae cuando apoya la pierna mala
  const cj = e.cojera || 0;
  if (cj > .01 && amp > .05) {
    const lado = e.cojeraLado || 'L', apoyo = lado === 'L' ? Math.max(0, Math.sin(ph)) : Math.max(0, -Math.sin(ph));
    guarda(R, R.hips, 'y', true); R.hips.position.y -= apoyo * cj * .09 * amp;
    suma(R, R.spine, 'z', (lado === 'L' ? 1 : -1) * apoyo * cj * .22 * amp);
    const pierna = lado === 'L' ? R.legL : R.legR; suma(R, pierna.kn, 'x', -apoyo * cj * .25 * amp); // rígida al apoyar
  }
  // --- brazo roto: cuelga muerto y se balancea con el paso
  for (const s of ['L', 'R']) {
    if (!e.roto?.['arm' + s]) continue; const A = s === 'L' ? R.armL : R.armR;
    fija(R, A.sh, 'x', Math.sin(ph) * .18 * amp + .08); fija(R, A.sh, 'z', s === 'L' ? .06 : -.06); fija(R, A.el, 'x', -.12 + Math.sin(ph + .6) * .1 * amp);
  }
  // --- aturdido: balanceo de borracho
  if (e.aturdido > 0) {
    const a = Math.min(1, e.aturdido);
    suma(R, R.spine, 'z', Math.sin(t * 2.7) * .16 * a); suma(R, R.spine, 'x', .12 * a); suma(R, R.neck, 'x', (.25 + Math.sin(t * 3.9) * .15) * a); suma(R, R.neck, 'z', Math.sin(t * 2.1) * .3 * a);
    suma(R, R.armL.sh, 'z', .25 * a); suma(R, R.armR.sh, 'z', -.25 * a);
  }
  // --- arrastre (robot sin pierna): animRig ya lo tumba con down=1; los brazos tiran del cuerpo
  if (e.arrastre) {
    const c = e.ciclo || 0;
    for (const s of ['L', 'R']) {
      const A = s === 'L' ? R.armL : R.armR, f = s === 'L' ? c : c + Math.PI;
      fija(R, A.sh, 'x', -2.5 + Math.sin(f) * .55); fija(R, A.sh, 'z', s === 'L' ? .35 : -.35); fija(R, A.el, 'x', -.25 - Math.max(0, Math.cos(f)) * .9);
    }
    fija(R, R.neck, 'x', -.7); suma(R, R.spine, 'z', Math.sin(c) * .08);
  }
}

// ¿puede pegar con ese brazo? (no perdido, no roto)
export const brazoUtil = (e, s) => !e.R.lost['arm' + s] && !e.R.lost['foreArm' + s] && !e.roto?.['arm' + s];
