// La pickup por dentro: cuadro de relojes, radio con emisoras, guantera con cosas, parasoles (con la foto de la
// familia), retrovisor (PC: render a 256×64 cada 2 fotogramas; VR: espejo oscuro), limpiaparabrisas, claxon en el
// centro del volante, tiradores de puerta y llave de contacto que se gira en VR para arrancar.
// VR: tocar con la punta del dedo (botones, claxon, palanca, parasol, guantera) · agarrar la llave y girar la muñeca ·
//     agarrar el tirador interior = bajar · el exterior = subir.  PC: clic sobre cada cosa (H sigue siendo el claxon).
// Además un cuerpo cinemático sigue a la pickup: empuja los objetos y lleva lo que va en la caja.
import { THREE, V3, G, clamp, scene, renderer, cv2d, toTex, canvasPlane, std } from '../nucleo.js';
import { sfx, buzz, engineSet } from '../fx.js';
import { say } from '../ui.js';
import { car, enterCar, exitCar } from '../vehiculos.js';
import { registrar, crearProp } from './objetos.js';
import { Radio, EMISORAS, clic as sonClic, mecanico } from './sonido.js';
import { emitirRuido } from './ruido.js';
import { cuerpoCinematico, moverCinematico, alListo } from './fisica-adaptador.js';

const tA = new V3(), tB = new V3(), tQ = new THREE.Quaternion();
const MC = { negro: std({ color: 0x141518, roughness: .6 }), plast: std({ color: 0x2a2c30, roughness: .55 }), cromo: std({ color: 0xc8ccd2, metalness: 1, roughness: .2 }), techo: std({ color: 0x8a8478, roughness: .95 }), llave: std({ color: 0xb8bcc2, metalness: .9, roughness: .3 }) };
const tocables = []; // { p: () => V3 mundo, r, accion(m) }
const malla = (geo, mat, x, y, z, par = car.g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
const inter = (label, mallas, extra) => registrar({ label, mallas, activo: () => true, centro: o => mallas[0].getWorldPosition(o), ...extra });
export const cabina = { radio: new Radio(), limpia: false, limpiaT: 0, guantera: null, llave: null, espejo: null };

export function construirCoche() {
  const g = car.g;
  // ---------- cuadro ----------
  if (car.speedo) car.speedo.mesh.visible = false;
  const cuadro = canvasPlane(.36, .12, 512, (x, w, h, a) => {
    x.fillStyle = '#05070a'; x.fillRect(0, 0, w, h);
    const dial = (cx, val, max, txt, col) => { const r = h * .42; x.strokeStyle = '#2a3038'; x.lineWidth = 6; x.beginPath(); x.arc(cx, h * .55, r, Math.PI * .8, Math.PI * 2.2); x.stroke(); x.strokeStyle = col; x.beginPath(); x.arc(cx, h * .55, r, Math.PI * .8, Math.PI * .8 + Math.PI * 1.4 * clamp(val / max, 0, 1)); x.stroke(); const an = Math.PI * .8 + Math.PI * 1.4 * clamp(val / max, 0, 1); x.strokeStyle = '#ff5030'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, h * .55); x.lineTo(cx + Math.cos(an) * r * .9, h * .55 + Math.sin(an) * r * .9); x.stroke(); x.fillStyle = '#d8f4ff'; x.font = '700 30px "Chakra Petch",sans-serif'; x.textAlign = 'center'; x.fillText(txt, cx, h * .92); };
    dial(w * .2, a.v, 160, Math.round(a.v) + ' km/h', '#7ff3ff'); dial(w * .8, a.rpm, 7, (a.rpm).toFixed(1) + ' rpm×1000', '#ffcf6a');
    x.fillStyle = '#1a1e24'; x.fillRect(w * .42, h * .25, w * .16, 10); x.fillStyle = a.fuel < .2 ? '#ff4030' : '#39ff7a'; x.fillRect(w * .42, h * .25, w * .16 * a.fuel, 10);
    x.fillStyle = '#9aa7b8'; x.font = '600 18px Inter'; x.textAlign = 'center'; x.fillText('GASOIL', w * .5, h * .22);
    if (!a.motor) { x.fillStyle = '#ff3020'; x.fillRect(w * .46, h * .5, 16, 10); x.fillStyle = '#ffb000'; x.fillRect(w * .51, h * .5, 16, 10); x.fillStyle = '#9aa7b8'; x.fillText('LLAVE', w * .5, h * .8); }
  });
  cuadro.mesh.position.set(-.42, 1.205, -.585); cuadro.mesh.rotation.x = -.35; g.add(cuadro.mesh); cabina.cuadro = cuadro; cuadro.set({ v: 0, rpm: 0, fuel: .62, motor: false });

  // ---------- radio ----------
  malla(new THREE.BoxGeometry(.22, .075, .05), MC.plast, 0, 1.115, -.565);
  const pant = canvasPlane(.12, .03, 256, (x, w, h, a) => { x.fillStyle = '#081210'; x.fillRect(0, 0, w, h); x.fillStyle = a.on ? '#7dffb0' : '#1c3028'; x.font = '700 34px "Chakra Petch",monospace'; x.textAlign = 'center'; x.fillText(a.t, w / 2, h * .78); });
  pant.mesh.position.set(0, 1.135, -.539); g.add(pant.mesh); pant.set({ t: 'RADIO', on: false }); cabina.pantRadio = pant;
  const boton = (x, label, accion) => { const b = malla(new THREE.BoxGeometry(.03, .018, .012), MC.negro, x, 1.097, -.537); const t = { p: o => b.getWorldPosition(o), r: .025, accion }; tocables.push(t); inter(label, [b], { clic: d => { if (d) accion(); return true; } }); return b; };
  const sint = d => { const e = cabina.radio.sintonizar(cabina.radio.est + d); pant.set({ t: e.n.split(' ·')[0], on: cabina.radio.est > 0 }); say('RADIO · ' + e.n); sonClic(car.g.position); };
  boton(-.075, 'radio: emisora anterior', () => sint(-1)); boton(.075, 'radio: emisora siguiente', () => sint(1));
  const perilla = malla(new THREE.CylinderGeometry(.016, .016, .015, 14), MC.cromo, 0, 1.097, -.535); perilla.rotation.x = Math.PI / 2;
  const enc = () => { if (cabina.radio.est) { cabina.radio.sintonizar(0); pant.set({ t: 'RADIO', on: false }); } else sint(3); };
  tocables.push({ p: o => perilla.getWorldPosition(o), r: .025, accion: enc }); inter('radio: encender/apagar', [perilla], { clic: d => { if (d) enc(); return true; } });

  // ---------- guantera (caja bajo el salpicadero, lado del copiloto) ----------
  const gu = new THREE.Group(); gu.position.set(.42, .82, -.62); g.add(gu);
  for (const [w, h, d, x, y, z] of [[.36, .01, .2, 0, 0, 0], [.36, .01, .2, 0, .14, 0], [.01, .14, .2, -.175, .07, 0], [.01, .14, .2, .175, .07, 0], [.36, .14, .01, 0, .07, -.1]]) malla(new THREE.BoxGeometry(w, h, d), MC.negro, x, y, z, gu);
  const piv = new THREE.Group(); piv.position.set(0, 0, .1); gu.add(piv);
  const tapa = malla(new THREE.BoxGeometry(.36, .14, .015), MC.plast, 0, .07, 0, piv); malla(new THREE.BoxGeometry(.08, .015, .02), MC.cromo, 0, .12, .012, piv);
  const guantera = cabina.guantera = { ang: 0, obj: 0, abierto: () => guantera.ang > .6, alternar() { guantera.obj = guantera.obj > .5 ? 0 : 1.15; mecanico(guantera.obj ? 'cargadorFuera' : 'cargadorDentro', gu.getWorldPosition(tA)); } };
  tocables.push({ p: o => tapa.localToWorld(o.set(0, .05, .01)), r: .05, accion: () => guantera.alternar() });
  inter('guantera', [tapa], { clic: d => { if (d) guantera.alternar(); return true; } });
  crearProp('linterna', -.08, .012, 0, { padre: gu, contenedor: guantera, ry: 1.4 }); crearProp('municion', .09, .006, -.02, { padre: gu, contenedor: guantera, ry: .2 });
  cabina.pivGuantera = piv;

  // ---------- parasoles (el del conductor con la foto de Sarah y Lucía) ----------
  const [fc, fx] = cv2d(128, 96); { const gr = fx.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#d8a070'); gr.addColorStop(1, '#5a4030'); fx.fillStyle = gr; fx.fillRect(0, 0, 128, 96); fx.fillStyle = '#2a1a14'; fx.beginPath(); fx.arc(48, 40, 16, 0, 7); fx.fill(); fx.fillRect(30, 56, 36, 40); fx.beginPath(); fx.arc(86, 54, 11, 0, 7); fx.fill(); fx.fillRect(74, 66, 24, 30); fx.strokeStyle = '#f4ece0'; fx.lineWidth = 6; fx.strokeRect(0, 0, 128, 96); }
  const foto = new THREE.MeshStandardMaterial({ map: toTex(fc, false), roughness: .7 });
  cabina.visores = [-.42, .42].map(sx => {
    const p = new THREE.Group(); p.position.set(sx, 1.69, -.86); g.add(p);
    const v = malla(new THREE.BoxGeometry(.4, .012, .16), MC.techo, 0, -.008, .08, p);
    if (sx < 0) { const f = malla(new THREE.PlaneGeometry(.1, .075), foto, .08, -.0145, .08, p); f.rotation.x = Math.PI / 2; }
    const vis = { p, ang: 0, obj: 0, alternar() { vis.obj = vis.obj ? 0 : 1.35; mecanico('funda', p.getWorldPosition(tA)); } };
    tocables.push({ p: o => v.getWorldPosition(o), r: .07, accion: () => vis.alternar() }); inter('parasol', [v], { clic: d => { if (d) vis.alternar(); return true; } });
    return vis;
  });

  // ---------- retrovisor ----------
  malla(new THREE.BoxGeometry(.25, .075, .025), MC.negro, 0, 1.6, -.835);
  const rt = new THREE.WebGLRenderTarget(256, 64); rt.texture.colorSpace = THREE.SRGBColorSpace; rt.texture.wrapS = THREE.RepeatWrapping; rt.texture.repeat.x = -1; rt.texture.offset.x = 1;
  const espMat = new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }), espVR = std({ color: 0x1a2028, metalness: 1, roughness: .05 });
  const esp = malla(new THREE.PlaneGeometry(.23, .058), espMat, 0, 1.6, -.821);
  const camE = new THREE.PerspectiveCamera(38, 4, .4, 70); camE.position.set(0, 1.62, -.8); camE.rotation.y = Math.PI; g.add(camE);
  cabina.espejo = { rt, esp, espMat, espVR, camE, n: 0 };

  // ---------- limpiaparabrisas (palanca a la derecha de la columna) ----------
  cabina.brazos = [-.4, .2].map(x => { const p = new THREE.Group(); p.position.set(x, 1.01, -.86); p.rotation.x = -.25; g.add(p); const a = new THREE.Group(); p.add(a); a.rotation.z = -Math.PI / 2; malla(new THREE.BoxGeometry(.012, .55, .01), MC.negro, 0, .275, -.02, a); return a; });
  const palanca = malla(new THREE.BoxGeometry(.012, .012, .12), MC.negro, -.27, 1.1, -.57); palanca.rotation.y = -.5;
  const limp = () => { cabina.limpia = !cabina.limpia; mecanico('llave', palanca.getWorldPosition(tA)); say(cabina.limpia ? 'Limpiaparabrisas' : 'Limpiaparabrisas apagado'); };
  tocables.push({ p: o => palanca.localToWorld(o.set(0, 0, .05)), r: .04, accion: limp }); inter('limpiaparabrisas', [palanca], { clic: d => { if (d) limp(); return true; } });

  // ---------- claxon en el centro del volante ----------
  const centro = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .025, 16), MC.negro); centro.rotation.x = Math.PI / 2; car.wheelSpin.add(centro);
  let clT = 0; const claxon = () => { if (G.time < clT) return; clT = G.time + .5; sfx('horn'); emitirRuido(car.g.position, 'claxon'); };
  tocables.push({ p: o => centro.getWorldPosition(o), r: .06, accion: claxon, mantener: true }); inter('claxon', [centro], { clic: d => { if (d) claxon(); return true; } });

  // ---------- llave de contacto ----------
  const ll = new THREE.Group(); ll.position.set(-.2, 1.03, -.548); g.add(ll);
  malla(new THREE.CylinderGeometry(.016, .016, .02, 12), MC.cromo, 0, 0, 0, ll).rotation.x = Math.PI / 2;
  const cab = new THREE.Group(); ll.add(cab); malla(new THREE.BoxGeometry(.006, .03, .04), MC.llave, 0, 0, .028, cab); malla(new THREE.BoxGeometry(.03, .024, .006), MC.negro, 0, 0, .05, cab);
  const llavero = malla(new THREE.TorusGeometry(.012, .002, 4, 10), MC.llave, 0, -.02, .056, cab); llavero.rotation.x = Math.PI / 2;
  const llave = cabina.llave = { ang: 0, cab, mano: null, q0: null,
    agarre: { dist: q => cab.localToWorld(tA.set(0, 0, .04)).distanceTo(q) - .03,
      agarrar(m) { if (m.sostiene || !car.occupied) return false; llave.mano = m; m.sostiene = llave; if (m.c) m.c.prop = llave; llave.q0 = m.q.clone(); llave.a0 = llave.ang; mecanico('llave', m.pos); buzz(m.c, .3, 25); return true; },
      seguir(m) { // giro de la muñeca alrededor del eje de la llave (+Z del coche)
        car.g.getWorldQuaternion(tQ); const eje = tA.set(0, 0, 1).applyQuaternion(tQ); const d = m.q.clone().multiply(llave.q0.clone().invert());
        const giro = 2 * Math.atan2(new V3(d.x, d.y, d.z).dot(eje), d.w); llave.ang = clamp(llave.a0 - giro, 0, 1.25);
        if (llave.ang > 1.0 && !car.motor) { arrancar(); buzz(m.c, 1, 200); } },
      soltar(m) { llave.mano = null; m.sostiene = null; if (m.c) m.c.prop = null; } },
    activo: () => true, label: 'llave de contacto', mallas: cab.children, centro: o => cab.getWorldPosition(o),
    clic(d) { if (!d) return true; if (car.motor) apagar(); else arrancar(); return true; } };
  registrar(llave);

  // ---------- tiradores de puerta ----------
  const tirIn = malla(new THREE.BoxGeometry(.03, .025, .12), MC.cromo, .06, 1.0, .35, car.hinge);
  registrar({ label: 'tirador (bajar)', mallas: [tirIn], activo: () => car.occupied, centro: o => tirIn.getWorldPosition(o), clic: d => { if (d) exitCar(); return true; },
    agarre: { dist: q => tirIn.getWorldPosition(tA).distanceTo(q) - .04, agarrar: () => { if (car.occupied) exitCar(); return false; } } });
  const tirEx = car.hinge.children.find(m => m.geometry?.parameters?.depth === .14) || tirIn; // el cromado exterior de vehiculos.js
  registrar({ label: 'tirador (subir)', mallas: [tirEx], activo: () => !car.occupied && car.near, centro: o => tirEx.getWorldPosition(o),
    agarre: { dist: q => tirEx.getWorldPosition(tA).distanceTo(q) - .05, agarrar: () => { if (!car.occupied && car.near && !car.bloqueado) enterCar(); return false; } } });

  // ---------- cuerpo cinemático de la pickup (empuja objetos; lo que va en la caja viaja con ella) ----------
  alListo(() => { cabina.body = cuerpoCinematico([{ f: 'caja', m: [1, .25, 2.3], c: [0, .66, 0] }, { f: 'caja', m: [.95, .03, .6], c: [0, .93, 1.72] }, { f: 'caja', m: [.035, .18, .6], c: [.95, 1.08, 1.72] }, { f: 'caja', m: [.035, .18, .6], c: [-.95, 1.08, 1.72] }, { f: 'caja', m: [.98, .18, .035], c: [0, 1.08, 2.3] }, { f: 'caja', m: [.93, .04, 1.05], c: [0, 1.74, .15] }, { f: 'caja', m: [.95, .1, .75], c: [0, .96, -1.5] }], new V3(0, -60, 0)); });
}
export function arrancar() { if (car.motor) return; car.motor = true; engineSet(true); sfx('motor'); emitirRuido(car.g.position, 'motor'); say('Motor en marcha'); }
export function apagar() { car.motor = false; engineSet(false); mecanico('llave', car.g.position); }

const prevTip = new Map(); let gasT = 0, avisado = false;
export function actualizarCoche(dt, dedos) {
  const c = cabina; if (!c.cuadro) return;
  // física: la pickup como cuerpo cinemático
  if (c.body) { if (car.g.visible) { car.g.updateMatrixWorld(true); car.g.getWorldPosition(tA); car.g.getWorldQuaternion(tQ); moverCinematico(c.body, tA, tQ); } else moverCinematico(c.body, tB.set(0, -60, 0)); }
  if (!car.g.visible) return;
  const cerca = car.occupied || car.near;
  // cuadro a 10 Hz
  c.t = (c.t || 0) - dt; if (cerca && c.t <= 0) { c.t = .1; c.cuadro.set({ v: Math.abs(car.speed) * 3.6, rpm: car.motor ? .8 + Math.abs(car.speed) * .22 + (car.thr || 0) * 1.5 : 0, fuel: .62, motor: !!car.motor }); }
  // VR: sin girar la llave no hay gas; si insiste con el gatillo, aviso y a los 4 s arranca solo (accesibilidad)
  if (car.occupied && !car.motor) { if ((car.gasPedido || 0) > .3) { gasT += dt; if (!avisado) { say('Gira la llave de contacto (grip + giro de muñeca)'); avisado = true; } if (gasT > 4) arrancar(); } } else { gasT = 0; avisado = false; }
  // llave: posición
  const l = c.llave; if (!l.mano) l.ang += ((car.motor ? .5 : 0) - l.ang) * Math.min(1, dt * 10); l.cab.rotation.z = -l.ang;
  // guantera y parasoles
  const gu = c.guantera; gu.ang += (gu.obj - gu.ang) * Math.min(1, dt * 8); c.pivGuantera.rotation.x = gu.ang;
  for (const v of c.visores) { v.ang += (v.obj - v.ang) * Math.min(1, dt * 8); v.p.rotation.x = -v.ang; }
  // limpiaparabrisas
  if (c.limpia || c.limpiaT % 1 > .02) { c.limpiaT += dt * .9; const a = (1 - Math.cos(c.limpiaT * Math.PI * 2)) / 2 * 1.45; for (const b of c.brazos) b.rotation.z = -Math.PI / 2 + a; if (Math.floor(c.limpiaT * 2) !== c.lpT) { c.lpT = Math.floor(c.limpiaT * 2); mecanico('limpia', car.g.position); } if (!c.limpia && c.limpiaT % 1 < .03) c.limpiaT = 0; }
  // radio
  c.radio.actualizar(c.pantRadio.mesh.getWorldPosition(tA));
  // toques con la punta del dedo (VR)
  for (const d of dedos) for (const t of tocables) { const k = d.clave + tocables.indexOf(t), dentro = t.p(tA).distanceTo(d.p) < t.r, antes = prevTip.get(k); if (dentro && (!antes || t.mantener)) { t.accion(d); if (!antes) buzz(d.c, .3, 25); } prevTip.set(k, dentro); }
  // retrovisor (solo PC, dentro del coche)
  const e = c.espejo;
  if (G.mode === 'pc' && car.occupied) { e.esp.material = e.espMat; if ((e.n++ & 1) === 0) { const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; e.esp.visible = false; const prev = renderer.getRenderTarget(); renderer.setRenderTarget(e.rt); renderer.render(scene, e.camE); renderer.setRenderTarget(prev); e.esp.visible = true; renderer.shadowMap.autoUpdate = au; } }
  else e.esp.material = e.espVR;
}
