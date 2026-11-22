// Traje EVA: oxígeno como recurso visible (anillo de 8 LEDs en la muñeca izquierda, rima con los 8 electrodos),
// botella de reserva que se cambia desenroscando ¾ de vuelta (VR: girar la muñeca con la botella junto al pecho;
// PC: O) y una pantallita de estado en la muñeca.
import * as THREE from 'three';
import { quitarProp } from './fisica.js';
import { sonar } from './sonido.js';

export const O2 = { botella: 1, reservas: 0, duracion: 240, rapido: 1, cambiando: 0, sinAire: 0, giro: 0, giroPrev: null };
const tA = new THREE.Vector3(), tQ = new THREE.Quaternion();
let leds = [], matsLed = [], etq = null, pintarT = 0, parpadeo = 0;

export function crearMuneca() {
  const g = new THREE.Group();
  const banda = new THREE.Mesh(new THREE.CylinderGeometry(.042, .045, .07, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: .7, metalness: .4, side: THREE.DoubleSide }));
  banda.rotation.x = Math.PI / 2; g.add(banda);
  const cara = new THREE.Mesh(new THREE.CylinderGeometry(.036, .036, .01, 24), new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: .4, metalness: .6 }));
  cara.position.y = .045; g.add(cara);
  leds = []; matsLed = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, m = new THREE.MeshBasicMaterial({ color: 0x29e6ff });
    const l = new THREE.Mesh(new THREE.SphereGeometry(.0055, 8, 6), m); l.position.set(Math.sin(a) * .026, .051, -Math.cos(a) * .026);
    g.add(l); leds.push(l); matsLed.push(m);
  }
  const c = document.createElement('canvas'); c.width = 256; c.height = 112;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(.1, .044), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  p.rotation.x = -Math.PI / 2; p.position.set(0, .052, .062); g.add(p);
  etq = { c, t };
  return g;
}

export function actualizarO2(dt, vacio, aviso) {
  const antes = O2.botella;
  if (vacio) O2.botella = Math.max(0, O2.botella - dt / O2.duracion * O2.rapido);
  if (antes >= .25 && O2.botella < .25) { sonar('alarma'); aviso('Oxígeno bajo el 25 %'); }
  if (O2.cambiando > 0) { O2.cambiando -= dt; if (O2.cambiando <= 0) { O2.botella = 1; O2.reservas--; sonar('enroscar'); aviso('Botella nueva enroscada · O2 100 %'); } }
  if (O2.botella <= 0) O2.sinAire += dt; else O2.sinAire = 0;
  // LEDs: cian > 50 % · ámbar · rojo parpadeando < 25 %
  parpadeo += dt; const n = Math.ceil(O2.botella * 8 - 1e-6);
  const col = O2.botella > .5 ? 0x29e6ff : O2.botella > .25 ? 0xffb020 : 0xff2a1a, apaga = O2.botella < .25 && (parpadeo % .6) < .3;
  for (let i = 0; i < 8; i++) matsLed[i].color.setHex(i < n && !apaga ? col : 0x14181e);
}

export function pintarMuneca(dt, lineas) {
  pintarT -= dt; if (pintarT > 0 || !etq) return; pintarT = .25;
  const x = etq.c.getContext('2d'); x.clearRect(0, 0, 256, 112); x.fillStyle = 'rgba(4,10,16,.85)'; x.fillRect(0, 0, 256, 112);
  x.fillStyle = '#9fefff'; x.font = '600 22px ui-monospace,monospace';
  lineas.slice(0, 4).forEach((l, i) => x.fillText(l, 8, 26 + i * 26));
  etq.t.needsUpdate = true;
}

export function cambiarBotellaPC(aviso) {
  if (O2.cambiando > 0) return;
  if (O2.reservas <= 0) { aviso('No llevas botella de reserva (la verde del hangar: mírala + E)'); return; }
  O2.cambiando = 1.6; sonar('enroscar'); aviso('Desenroscando la vacía… enroscando la llena');
}
export function recogerBotella(pr, aviso) { quitarProp(pr); O2.reservas++; sonar('clic'); aviso('Botella de reserva al pecho (O para cambiar)'); }

// VR: con la botella en la mano junto al pecho, girar la muñeca ¾ de vuelta (≈ 4,7 rad acumulados)
export function giroBotellaVR(dt, pr, grip, cabeza, aviso) {
  if (!pr) { O2.giro = 0; O2.giroPrev = null; return false; }
  grip.getWorldPosition(tA);
  const pecho = cabeza.clone().add(new THREE.Vector3(0, -.38, 0));
  if (tA.distanceTo(pecho) > .32) { O2.giro = 0; O2.giroPrev = null; return false; }
  grip.getWorldQuaternion(tQ);
  const eje = new THREE.Vector3(0, 0, -1).applyQuaternion(tQ), lado = new THREE.Vector3(1, 0, 0).applyQuaternion(tQ);
  if (O2.giroPrev) {
    // ángulo girado alrededor del eje del antebrazo desde el fotograma anterior
    const prev = O2.giroPrev.clone().addScaledVector(eje, -O2.giroPrev.dot(eje)).normalize();
    const d = Math.atan2(new THREE.Vector3().crossVectors(prev, lado).dot(eje), prev.dot(lado));
    O2.giro += Math.abs(d);
  }
  O2.giroPrev = lado.clone();
  if (O2.giro > 4.7) { quitarProp(pr); O2.botella = 1; O2.giro = 0; O2.giroPrev = null; sonar('enroscar'); aviso('Botella enroscada · O2 100 %'); return true; }
  return false;
}
