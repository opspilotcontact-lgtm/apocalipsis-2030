// Armas de la prueba: X-27 (fusil de pulsos, sin retroceso) frente a X-56D (balística: en ingravidez cada disparo
// te empuja ≈ 0,4 m/s hacia atrás si no estás agarrado ni con las botas pegadas). Modelos por código.
import * as THREE from 'three';
import { F } from './fisica.js';
import { S } from './sala.js';
import { sonar } from './sonido.js';

export const ARMAS = {
  x27: { nombre: 'X-27', balas: 12, cargador: 12, cadencia: .32, auto: false, impulso: 3, color: 0x29e6ff, retroceso: 0 },
  x56d: { nombre: 'X-56D', balas: 30, cargador: 30, cadencia: .11, auto: true, impulso: 2, color: 0xffd27a, retroceso: .4 },
};
export const A = { actual: 'x56d', cd: 0, modelos: {}, grupo: new THREE.Group() };
const ray = new THREE.Raycaster(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
const efectos = [];

function modelo(id) {
  const g = new THREE.Group(), b = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const metal = new THREE.MeshStandardMaterial({ color: id === 'x27' ? 0xd8dde3 : 0x2a2d31, roughness: .45, metalness: .7 });
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .7, metalness: .4 });
  if (id === 'x27') {
    b(.06, .09, .42, metal, 0, .03, -.15); b(.04, .1, .05, oscuro, 0, -.04, .02); b(.05, .06, .16, oscuro, 0, .02, .14);
    const tubo = new THREE.Mesh(new THREE.CylinderGeometry(.022, .03, .22, 12), metal); tubo.rotation.x = Math.PI / 2; tubo.position.set(0, .04, -.46); g.add(tubo);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.034, .006, 6, 16), new THREE.MeshBasicMaterial({ color: 0x29e6ff })); r.position.set(0, .04, -.38 - i * .06); g.add(r); }
    const celda = b(.035, .05, .07, new THREE.MeshBasicMaterial({ color: 0x29e6ff }), 0, -.01, -.12); g.userData.celda = celda;
  } else {
    b(.05, .08, .34, metal, 0, .05, -.14); b(.042, .065, .22, oscuro, 0, .03, .13); b(.03, .12, .05, oscuro, 0, -.04, -.15); b(.032, .1, .045, oscuro, 0, -.02, 0);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .3, 8), oscuro); c.rotation.x = Math.PI / 2; c.position.set(0, .06, -.46); g.add(c);
  }
  const boca = new THREE.Object3D(); boca.position.set(0, .05, -.6); g.add(boca); g.userData.boca = boca;
  const luz = new THREE.PointLight(ARMAS[id].color, 0, 4, 2); boca.add(luz); g.userData.luz = luz;
  return g;
}

export function crearArmas() {
  for (const id of Object.keys(ARMAS)) { A.modelos[id] = modelo(id); A.grupo.add(A.modelos[id]); }
  elegir(A.actual);
  return A.grupo;
}
export function elegir(id) { A.actual = id; for (const k in A.modelos) A.modelos[k].visible = k === id; }
export const arma = () => ARMAS[A.actual];

function trazo(a, b, color, grosor, vida) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(grosor, grosor, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.geometry.translate(0, .5, 0); g.geometry.rotateX(Math.PI / 2);
  g.position.copy(a); g.lookAt(b); g.scale.set(1, 1, a.distanceTo(b));
  S.escena.add(g); efectos.push({ m: g, vida, max: vida });
}
function chispa(p, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.copy(p); S.escena.add(m); efectos.push({ m, vida: .2, max: .2, crece: true });
}

// dispara desde la boca del arma visible. Devuelve el retroceso (m/s) a aplicar al jugador, o 0.
export function disparar(romperVentana) {
  const w = arma(); if (A.cd > 0) return 0;
  if (w.balas <= 0) { sonar('clic'); A.cd = .25; return 0; }
  A.cd = w.cadencia; w.balas--;
  const boca = A.modelos[A.actual].userData.boca; boca.getWorldPosition(tA);
  const dir = tB.set(0, 0, -1).applyQuaternion(boca.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const objetivos = [...S.superficies, ...F.props.map(p => p.mesh)];
  ray.set(tA, dir); ray.far = 80;
  const h = ray.intersectObjects(objetivos, true).find(x => x.object.visible);
  const fin = h ? h.point.clone() : tA.clone().addScaledVector(dir, 80);
  if (A.actual === 'x27') trazo(tA, fin, 0x29e6ff, .012, .14); else trazo(tA, fin, 0xffe0a0, .004, .05);
  A.modelos[A.actual].userData.luz.intensity = 3;
  sonar(A.actual);
  if (h) {
    chispa(fin, w.color);
    let o = h.object; while (o && !o.userData.prop && o.parent) o = o.parent;
    if (o?.userData.prop) { const pr = o.userData.prop; pr.body.applyImpulseAtPoint({ x: dir.x * w.impulso, y: dir.y * w.impulso, z: dir.z * w.impulso }, { x: fin.x, y: fin.y, z: fin.z }, true); }
    if (h.object.userData.vidrio) { sonar('vidrio'); romperVentana(); }
  }
  return w.retroceso;
}
export function recargar() { const w = arma(); w.balas = w.cargador; sonar('clic'); }

export function actualizarArmas(dt) {
  A.cd = Math.max(0, A.cd - dt);
  for (const id in A.modelos) { const l = A.modelos[id].userData.luz; l.intensity = Math.max(0, l.intensity - dt * 40); }
  for (let i = efectos.length - 1; i >= 0; i--) {
    const e = efectos[i]; e.vida -= dt; e.m.material.opacity = Math.max(0, e.vida / e.max);
    if (e.crece) e.m.scale.setScalar(1 + (1 - e.vida / e.max) * 2);
    if (e.vida <= 0) { e.m.removeFromParent(); e.m.geometry.dispose(); e.m.material.dispose(); efectos.splice(i, 1); }
  }
}
