// Cuerpo del jugador: Dave_animado.glb (ActorGLB) movido por el movimiento real del jugador.
// Vive en la capa CAPA_CUERPO: la cámara principal (y las dos de los ojos en VR, que heredan sus capas) no la ven,
// así que en primera persona no tapa nada; la ven las cámaras de seguridad (camaras.js) y la 3.ª persona de PC (tecla T;
// la V ya es «contener la respiración»). Sin sombra propia (el mapa de sombras solo pinta la capa 0).
// API: avatar.actor · avatar.terceraPersona(on?) · avatar.visible
import { THREE, V3, G, clamp, scene, camera, head, vm, envActivo } from '../nucleo.js';
import { precargarActor, cargarClips, crearActor } from '../combate/actor.js';
import { P, WEAPONS, playerFeet, clonarArma } from '../jugador.js';
import { car } from '../vehiculos.js';
import { piernaRota } from '../combate/lesiones.js';

export const CAPA_CUERPO = 6;
const CLIPS = ['Running', 'Crouched_Walking', 'Walking_Backwards', 'Left_Strafe_Walking', 'Right_Strafe_Walking', 'Injured_Walk', 'Injured_Idle', 'Rifle_Aiming_Idle', 'Head_Hit', 'Hit_Reaction', 'Big_Side_Hit'];
const tA = new V3(), tB = new V3(), prev = new V3(), vel = new V3(), ray = new THREE.Raycaster();
let A = null, yaw = 0, ini = false, tercera = false, hurtVisto = -9, arma = null, armaId = null, armaReal = false;

const enCapa = o => o.traverse(x => x.layers.set(CAPA_CUERPO));
Promise.all([precargarActor('Dave_animado'), cargarClips(CLIPS)]).then(() => {
  A = crearActor('Dave_animado', { altura: 1.8, resDanio: 256 });
  A.raiz.traverse(x => { if (x.isMesh) x.castShadow = false; });
  scene.add(A.root); enCapa(A.root); A.root.visible = false;
}).catch(e => console.warn('[avatar] Dave_animado no cargó: sin cuerpo visible', e));

function terceraPersona(on = !tercera) {
  tercera = on && G.mode === 'pc';
  if (tercera) camera.layers.enable(CAPA_CUERPO); else { camera.layers.disable(CAPA_CUERPO); camera.position.set(0, 0, 0); }
  vm.visible = !tercera && G.mode === 'pc';
  return tercera;
}
addEventListener('keydown', e => { if (e.code === 'KeyT' && !e.repeat && G.playing && G.mode === 'pc' && !G.enDialogo) terceraPersona(); });

// arma en la mano del cuerpo (solo PC: en VR el arma real ya está en el mundo, capa 0)
function ponerArma() {
  const w = WEAPONS[P.w], id = G.mode === 'pc' && !w.melee ? w.id : null;
  if (id !== armaId) { arma?.removeFromParent(); arma = id ? clonarArma(id, { sombra: false }) : null; armaId = id; armaReal = false; if (arma) { scene.add(arma); enCapa(arma); } }
  if (arma && arma.userData.real !== armaReal) { armaReal = !!arma.userData.real; enCapa(arma); } // el .glb llegó después
  if (!arma) return;
  const mano = A.H.RightHand; if (!mano) return;
  mano.getWorldPosition(arma.position); arma.rotation.set(P.pitch * .8, yaw + Math.PI, 0, 'YXZ'); arma.visible = A.root.visible;
}

export function actualizarAvatar(dt) {
  if (!A) return;
  const fuera = car.occupied || !!P.sentado || G.enEspacio || P.dead > 0;
  A.root.visible = !fuera; if (arma) arma.visible = !fuera;
  if (tercera && (G.mode !== 'pc' || car.occupied)) terceraPersona(false);
  if (fuera) { ini = false; return; }
  // posición y rumbo: PC = el dolly y P.yaw · VR = la cabeza (rumbo suavizado como el torso de las fundas)
  playerFeet(tA);
  let objetivo;
  if (G.mode === 'vr') { camera.getWorldDirection(tB); objetivo = Math.atan2(-tB.x, -tB.z) + Math.PI; tA.x -= Math.sin(objetivo) * .12; tA.z -= Math.cos(objetivo) * .12; }
  else objetivo = P.yaw + Math.PI;
  if (!ini) { prev.copy(tA); yaw = objetivo; ini = true; }
  const d = Math.atan2(Math.sin(objetivo - yaw), Math.cos(objetivo - yaw)); yaw += d * Math.min(1, dt * (G.mode === 'vr' ? 4 : 14));
  // velocidad real (desde el desplazamiento; un teletransporte no cuenta)
  tB.subVectors(tA, prev).setY(0).divideScalar(Math.max(dt, 1e-3)); prev.copy(tA);
  if (tB.length() > 15) tB.set(0, 0, 0);
  vel.lerp(tB, Math.min(1, dt * 10));
  A.root.position.copy(tA); A.root.rotation.y = yaw;
  // clip según cómo se mueve
  const s = vel.length(), fx = Math.sin(yaw), fz = Math.cos(yaw), vf = vel.x * fx + vel.z * fz, vl = vel.x * fz - vel.z * fx; // vl > 0 = izquierda
  const post = G.sigilo?.postura || 'pie', agachado = post !== 'pie', pierna = piernaRota(), fuego = !WEAPONS[P.w].melee;
  let n, ts = 1;
  if (s < .25) n = agachado ? 'Crouched_Walking' : pierna ? 'Injured_Idle' : fuego ? 'Rifle_Aiming_Idle' : 'Idle';
  else if (agachado) n = 'Crouched_Walking';
  else if (pierna) n = 'Injured_Walk';
  else if (vf < -.35 * s) n = 'Walking_Backwards';
  else if (Math.abs(vl) > Math.abs(vf) * 1.2) n = vl > 0 ? 'Left_Strafe_Walking' : 'Right_Strafe_Walking';
  else if (s > 4) n = 'Running';
  else n = 'Walk';
  if (!A.tieneClip(n)) n = A.clip(s > 4 ? 'run' : s > .25 ? 'walk' : 'idle');
  if (s >= .25) ts = clamp(s / A.velClip(n), .5, 2.2); else if (n === 'Crouched_Walking') ts = 0; // agachado quieto: la pose del clip congelada
  A.reproducir(n, .25, ts); if (A.actual) A.actual.timeScale = ts;
  // golpe recibido → reacción
  if (P.lastHurt !== hurtVisto) { if (hurtVisto > -9 && G.time - P.lastHurt < .2) A.reaccion(P.zonaHerida === 'cabeza' ? 'head' : P.zonaHerida?.startsWith('pierna') ? 'thighL' : 'torso'); hurtVisto = P.lastHurt; }
  A.mixer.update(dt); A.raiz.updateMatrixWorld(true);
  A.fase += dt * (s > .15 ? 5 * clamp(s / 1.6, .6, 2) : 0);
  A.capa(dt, {});
  ponerArma();
  // 3.ª persona (PC): cámara detrás del hombro, sin atravesar paredes
  if (tercera) {
    head.getWorldPosition(tA); tB.set(.45, .25, 2.6).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
    const L = tB.length(); ray.set(tA, tB.normalize()); ray.far = L; const h = ray.intersectObjects(envActivo(), false)[0];
    camera.position.set(.45, .25, 2.6).multiplyScalar(h ? Math.max(.2, (h.distance - .25) / L) : 1);
  }
}
export const avatar = { get actor() { return A; }, terceraPersona, get tercera() { return tercera; }, get visible() { return !!A?.root.visible; } };
if (typeof window !== 'undefined') window.__avatar = avatar;
