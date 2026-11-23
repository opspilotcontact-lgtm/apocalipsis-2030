// Vehículos: la pickup de Dave (se conduce) y los viajes guiados (camión militar, ORION-4).
import { THREE, V3, Y, G, mix, clamp, std, glow, rbox, cylG, texScratch, scene, camera, dolly, canvasPlane, textDraw, collideCircle, groundAt, rampGround, lampFactor, capas, fundirHijos } from './nucleo.js';
import { sfx, engineSet, engineTune, burst, buzz } from './fx.js';
import { P, ctrl, attachWeapon, say } from './jugador.js';
import { enemies, damageEnemy, knockdown } from './enemigos.js';

const tA = new V3(), tB = new V3(), tC = new V3(), tQ = new THREE.Quaternion(), tE = new THREE.Euler(0, 0, 0, 'YXZ');

// ---------- Pickup ----------
export const car = { g: new THREE.Group(), speed: 0, steer: 0, vy: 0, yaw: 0, pitch: 0, roll: 0, occupied: false, doorT: 0, spin: 0, wheels: [], hitCD: new Map(), air: false, prevG: 0, thr: 0, brk: 0, bloqueado: false, near: false };
car.g.rotation.order = 'YXZ'; capas.tierra.add(car.g);
const CM = { paint: std({ color: 0x6a2a1e, metalness: .55, roughness: .38, roughnessMap: texScratch }), dark: std({ color: 0x111316, roughness: .7, metalness: .3 }), chrome: std({ color: 0xc8ccd2, metalness: 1, roughness: .2 }),
  glass: std({ color: 0x0b1520, transparent: true, opacity: .32, roughness: .05, metalness: .4, depthWrite: false, side: THREE.DoubleSide }), head: glow(0xfff4dc, 1), tail: glow(0xff1a10, 1.5), bar: glow(0xfff4dc, .5), seat: std({ color: 0x2a2320, roughness: .9 }), rubber: std({ color: 0x0c0c0d, roughness: .95 }) };
{ const add = (geo, m, x, y, z, par = car.g) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; par.add(me); return me; };
  add(rbox(2, .5, 4.6), CM.paint, 0, .66, 0); add(rbox(2.04, .2, 4.3), CM.dark, 0, .42, 0); add(rbox(1.9, .2, 1.5), CM.paint, 0, .96, -1.5);
  add(rbox(1.86, .08, 2.1), CM.paint, 0, 1.74, .15);
  for (const [px, pz] of [[.9, -.9], [-.9, -.9], [.9, 1.18], [-.9, 1.18]]) add(rbox(.08, .74, .08), CM.paint, px, 1.35, pz);
  const ws = add(new THREE.BoxGeometry(1.74, .72, .03), CM.glass, 0, 1.35, -.92); ws.rotation.x = -.25; ws.castShadow = false;
  add(new THREE.BoxGeometry(.03, .6, 2.0), CM.glass, .92, 1.36, .15).castShadow = false; add(new THREE.BoxGeometry(1.74, .6, .03), CM.glass, 0, 1.36, 1.2).castShadow = false;
  add(new THREE.BoxGeometry(1.9, .06, 1.15), CM.dark, 0, .93, 1.72); add(rbox(.07, .36, 1.2), CM.paint, .95, 1.08, 1.72); add(rbox(.07, .36, 1.2), CM.paint, -.95, 1.08, 1.72); add(rbox(1.96, .36, .07), CM.paint, 0, 1.08, 2.3);
  add(rbox(2.12, .22, .22), CM.dark, 0, .52, -2.38); add(rbox(2.12, .22, .22), CM.dark, 0, .52, 2.38); add(new THREE.BoxGeometry(1.1, .24, .04), CM.dark, 0, .78, -2.31);
  add(new THREE.BoxGeometry(.36, .14, .04), CM.head, .66, .82, -2.32); add(new THREE.BoxGeometry(.36, .14, .04), CM.head, -.66, .82, -2.32);
  add(new THREE.BoxGeometry(.24, .16, .04), CM.tail, .8, .86, 2.33); add(new THREE.BoxGeometry(.24, .16, .04), CM.tail, -.8, .86, 2.33);
  add(new THREE.BoxGeometry(1.2, .08, .12), CM.bar, 0, 1.82, -.7);
  for (const sx of [-.42, .42]) { add(rbox(.55, .14, .55), CM.seat, sx, .86, .25); add(rbox(.55, .62, .12), CM.seat, sx, 1.18, .55); }
  add(rbox(1.8, .24, .42), CM.dark, 0, 1.08, -.76);
  car.wheelG = new THREE.Group(); car.wheelG.position.set(-.42, 1.15, -.5); car.wheelG.rotation.x = -1.15; car.g.add(car.wheelG);
  car.wheelSpin = new THREE.Group(); car.wheelG.add(car.wheelSpin);
  car.wheelSpin.add(new THREE.Mesh(new THREE.TorusGeometry(.17, .024, 8, 22), CM.dark)); car.wheelSpin.add(new THREE.Mesh(new THREE.BoxGeometry(.32, .03, .02), CM.dark));
  car.speedo = canvasPlane(.26, .12, 256, (x, w, h, a) => { x.fillStyle = '#05080c'; x.fillRect(0, 0, w, h); x.fillStyle = '#7ff3ff'; x.font = '700 64px "Chakra Petch",sans-serif'; x.textAlign = 'center'; x.fillText(a, w / 2, h * .62); x.font = '600 18px Inter'; x.fillText('km/h', w / 2, h * .92); });
  car.speedo.mesh.position.set(-.42, 1.22, -.58); car.speedo.mesh.rotation.x = -.35; car.g.add(car.speedo.mesh); car.speedo.set('0');
  car.hinge = new THREE.Group(); car.hinge.position.set(-1.0, 0, -.6); car.g.add(car.hinge);
  add(rbox(.07, .62, 1.15), CM.paint, 0, .76, .575, car.hinge); add(new THREE.BoxGeometry(.03, .55, 1.0), CM.glass, 0, 1.36, .55, car.hinge).castShadow = false; add(new THREE.BoxGeometry(.04, .04, .14), CM.chrome, -.05, .95, .9, car.hinge);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const st = new THREE.Group(); st.position.set(sx * .98, .42, sz * 1.45); car.g.add(st); const spn = new THREE.Group(); st.add(spn);
    const tire = new THREE.Mesh(cylG(.42, .32), CM.rubber); tire.rotation.z = Math.PI / 2; tire.castShadow = true; spn.add(tire); const rim = new THREE.Mesh(cylG(.25, .34), CM.chrome); rim.rotation.z = Math.PI / 2; spn.add(rim);
    spn.add(new THREE.Mesh(new THREE.BoxGeometry(.36, .06, .06), CM.dark)); car.wheels.push({ st, spn, front: sz < 0 }); }
  car.seat = new THREE.Object3D(); car.seat.position.set(-.42, 0, .32); car.g.add(car.seat);
  car.pasajero = new THREE.Object3D(); car.pasajero.position.set(.42, .72, .32); car.g.add(car.pasajero);
  car.light = new THREE.SpotLight(0xfff2d8, 0, 40, .55, .45, 1.5); car.light.position.set(0, .85, -2.4); car.light.target.position.set(0, 0, -16); car.g.add(car.light, car.light.target);
  fundirHijos(car.g, new Set([car.speedo.mesh])); } // carrocería: ~30 piezas → 1 llamada por material
export const carPrompt = canvasPlane(1.4, .3, 512, textDraw('#ffffff', .7, 'rgba(8,12,22,.85)')); scene.add(carPrompt.mesh); carPrompt.set('E / A · SUBIR'); carPrompt.mesh.visible = false;
export const carFwd = o => o.set(-Math.sin(car.yaw), 0, -Math.cos(car.yaw));
export function colocarCoche(x, z, yaw) { if (car.occupied) exitCar(true); car.g.position.set(x, 0, z); car.yaw = yaw; car.speed = 0; car.vy = 0; car.g.rotation.set(0, yaw, 0); car.g.visible = true; }
export function pushFromCar(p, r) { if (!car.g.visible) return; const f = carFwd(tC); for (const s of [-1.3, 0, 1.3]) { const cx = car.g.position.x + f.x * s, cz = car.g.position.z + f.z * s, dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = r + 1.0; if (d < m && d > 1e-4) { p.x += dx / d * (m - d); p.z += dz / d * (m - d); } } }

export function enterCar() {
  if (car.occupied || car.bloqueado) return; car.occupied = true; car.doorT = .9; sfx('door');
  car.motor = G.mode !== 'vr'; if (car.motor) engineSet(true); // VR: arranca girando la llave (interaccion/coche.js)
  if (G.mode === 'vr') {
    const cl = camera.position.clone(); tE.setFromQuaternion(camera.quaternion, 'YXZ'); const cy = tE.y;
    car.seat.add(dolly); dolly.rotation.set(0, -cy, 0); const off = new V3(cl.x, 0, cl.z).applyAxisAngle(Y, -cy); dolly.position.set(-off.x, 1.5 - cl.y, -off.z);
  } else { car.seat.add(dolly); dolly.position.set(0, 1.5 - 1.62, 0); P.yaw = 0; P.pitch = -.05; P.vel.set(0, 0, 0); }
  attachWeapon(); say(G.mode === 'vr' ? 'AL VOLANTE\nGatillo dcho. gas · izq. freno · A bajar' : 'AL VOLANTE\nW/S · A/D · Espacio freno · E bajar');
}
export function exitCar(force) {
  if (!car.occupied) return; if (!force && Math.abs(car.speed) > 3) { say('Frena para bajarte'); return; }
  car.occupied = false; car.doorT = .9; sfx('door'); engineSet(false);
  const exitPt = car.g.localToWorld(new V3(-2.1, 0, 0)); collideCircle(exitPt, .4, 0); exitPt.y = groundAt(exitPt.x, exitPt.z, 5);
  if (G.mode === 'vr') { dolly.getWorldQuaternion(tQ); tE.setFromQuaternion(tQ, 'YXZ'); const yaw = tE.y; scene.add(dolly); dolly.rotation.set(0, yaw, 0); dolly.position.copy(exitPt); dolly.updateMatrixWorld(true); camera.getWorldPosition(tA); dolly.position.x += exitPt.x - tA.x; dolly.position.z += exitPt.z - tA.z; }
  else { scene.add(dolly); dolly.position.copy(exitPt); P.yaw = car.yaw + P.yaw; P.pitch = 0; }
  attachWeapon();
}
export function driveCar(inp, dt) {
  const maxF = 19, maxR = 6, c = car;
  if (c.motor === false) { c.gasPedido = Math.max(inp.thr, inp.brk); inp.thr = 0; } // sin motor no hay gas
  if (inp.thr > 0) c.speed += (c.speed < -.5 ? 14 : 8.5 * (1 - Math.max(0, c.speed) / maxF)) * inp.thr * dt;
  if (inp.brk > 0) c.speed -= (c.speed > .5 ? 16 : 6 * (1 + Math.min(0, c.speed) / maxR)) * inp.brk * dt;
  if (!inp.thr && !inp.brk) c.speed = Math.sign(c.speed) * Math.max(0, Math.abs(c.speed) - 2.2 * dt);
  if (inp.hb) c.speed *= 1 - Math.min(1, 2.5 * dt);
  c.speed -= c.speed * .08 * dt; c.speed = clamp(c.speed, -maxR, maxF);
  c.steer = mix(c.steer, inp.steer * .55 * (1 - Math.min(.55, Math.abs(c.speed) / 32)), Math.min(1, dt * 6));
  c.thr = inp.thr; c.brk = inp.brk;
}
export function updateCar(dt, pf) {
  const c = car, p = c.g.position; if (!c.g.visible) { c.near = false; carPrompt.mesh.visible = false; return; }
  if (!c.occupied) { c.speed = Math.sign(c.speed) * Math.max(0, Math.abs(c.speed) - 6 * dt); c.steer = mix(c.steer, 0, dt * 3); c.thr = c.brk = 0; }
  if (!c.air) c.yaw += c.speed * Math.tan(c.steer) / 2.8 * dt * (c.steer && Math.abs(c.speed) > .1 ? 1 : 0);
  const f = carFwd(tA); p.x += f.x * c.speed * dt; p.z += f.z * c.speed * dt;
  let hitWall = false;
  for (const s of [1.35, -1.35]) { tB.set(p.x + f.x * s, 0, p.z + f.z * s); const ox = tB.x, oz = tB.z; if (collideCircle(tB, 1.0, p.y + .3)) { p.x += tB.x - ox; p.z += tB.z - oz; hitWall = true; } }
  if (hitWall && Math.abs(c.speed) > 1) { if (Math.abs(c.speed) > 6) { sfx('crash'); G.shake = Math.max(G.shake, .6); burst(tB.set(p.x + f.x * 2.3 * Math.sign(c.speed), .8, p.z + f.z * 2.3 * Math.sign(c.speed)), 18, 'hot'); for (const k of ctrl) buzz(k, 1, 150); } c.speed *= -.25; }
  const g = rampGround(p.x, p.z);
  if (!c.air) { if (p.y > g + .05) { c.air = true; } else { c.vy = (g - c.prevG) / Math.max(dt, 1e-3); p.y = g; } }
  if (c.air) { c.vy -= 20 * dt; p.y += c.vy * dt; if (p.y <= g) { if (c.vy < -4) { sfx('land'); G.shake = Math.max(G.shake, .5); for (const k of ctrl) buzz(k, .9, 120); } p.y = g; c.vy = 0; c.air = false; } }
  c.prevG = g;
  const gF = rampGround(p.x + f.x * 1.4, p.z + f.z * 1.4, .1), gB = rampGround(p.x - f.x * 1.4, p.z - f.z * 1.4, .1);
  c.pitch = mix(c.pitch, c.air ? clamp(c.vy * .03, -.35, .35) : Math.atan2(gF - gB, 2.8), Math.min(1, dt * 7));
  c.roll = mix(c.roll, -c.steer * c.speed * .012, Math.min(1, dt * 5));
  c.g.rotation.set(c.pitch, c.yaw, c.roll);
  c.spin += c.speed * dt / .42; for (const w of c.wheels) { w.spn.rotation.x = -c.spin; if (w.front) w.st.rotation.y = c.steer; }
  c.wheelSpin.rotation.z = -c.steer * 2.6;
  if (c.doorT > 0) { c.doorT -= dt; c.hinge.rotation.y = -Math.sin(clamp(1 - c.doorT / .9, 0, 1) * Math.PI) * 1.1; } else c.hinge.rotation.y = 0;
  CM.tail.emissiveIntensity = c.brk > 0 || (c.occupied && c.speed < -.2) ? 6 : 1.5; CM.head.emissiveIntensity = c.occupied ? 5 : 1;
  c.light.intensity = c.occupied ? 160 * Math.max(.15, lampFactor()) : 0;
  engineTune(38 + Math.abs(c.speed) * 7 + c.thr * 10, 300 + c.thr * 500);
  // atropellos
  if (Math.abs(c.speed) > 3) for (const e of [...enemies]) { if (!e.alive) continue; const d = Math.min(Math.hypot(e.pos.x - (p.x + f.x * 1.2), e.pos.z - (p.z + f.z * 1.2)), Math.hypot(e.pos.x - (p.x - f.x * 1.2), e.pos.z - (p.z - f.z * 1.2)));
    if (d < 1.15 + .35 * e.S && (c.hitCD.get(e) || 0) < G.time) { c.hitCD.set(e, G.time + .6); const dir = new V3(f.x * Math.sign(c.speed), .3, f.z * Math.sign(c.speed)).normalize(); tC.copy(e.pos); tC.y += 1;
      damageEnemy(e, Math.abs(c.speed) * 7, tC, dir, 'torso', true); if (e.alive) { e.push.addScaledVector(dir, Math.abs(c.speed) * .9 / e.S); if (Math.abs(c.speed) > 5) knockdown(e); } sfx('crash'); c.speed *= .82; G.shake = Math.max(G.shake, .4); } }
  // aviso para subir
  const door = c.g.localToWorld(tB.set(-1.2, 0, 0));
  const near = !c.occupied && !c.bloqueado && Math.hypot(door.x - pf.x, door.z - pf.z) < 2.6;
  carPrompt.mesh.visible = near; if (near) { carPrompt.mesh.position.set(door.x, door.y + 2.1, door.z); carPrompt.mesh.lookAt(G.CAM); }
  c.near = near;
  if (c.occupied && (G.time * 7 | 0) !== c.spT) { c.spT = G.time * 7 | 0; c.speedo.set(String(Math.round(Math.abs(c.speed) * 3.6))); }
}

// ---------- Viajes guiados: un objeto sigue una ruta con el jugador sentado dentro ----------
// ruta: [[x,z],...]; el frente del modelo es +Z (convención del pack de assets)
export const viaje = { activo: null };
export function iniciarViaje(obj, asiento, ruta, vel, onFin) {
  obj.visible = true; obj.position.set(ruta[0][0], obj.position.y, ruta[0][1]);
  sentarEn(asiento);
  viaje.activo = { obj, asiento, ruta, vel, i: 1, onFin, v: 0 }; engineSet(true, 30);
}
export function sentarEn(asiento) {
  if (car.occupied) exitCar(true);
  if (G.mode === 'vr') {
    const cl = camera.position.clone(); tE.setFromQuaternion(camera.quaternion, 'YXZ'); const cy = tE.y;
    asiento.add(dolly); dolly.rotation.set(0, Math.PI - cy, 0); const off = new V3(cl.x, 0, cl.z).applyAxisAngle(Y, Math.PI - cy); dolly.position.set(-off.x, 0, -off.z);
  } else { asiento.add(dolly); dolly.position.set(0, 0, 0); dolly.rotation.set(0, 0, 0); P.yaw = Math.PI; P.pitch = 0; P.vel.set(0, 0, 0); }
  P.sentado = asiento; attachWeapon();
}
export function levantarse(x, z, yaw = 0) {
  P.sentado = null; scene.add(dolly); dolly.rotation.set(0, 0, 0);
  if (G.mode === 'vr') { dolly.position.set(x, groundAt(x, z, 5), z); dolly.updateMatrixWorld(true); camera.getWorldPosition(tA); dolly.position.x += x - tA.x; dolly.position.z += z - tA.z; }
  else { dolly.position.set(x, groundAt(x, z, 5), z); P.yaw = yaw; P.pitch = 0; }
  attachWeapon();
}
export function actualizarViaje(dt) {
  const v = viaje.activo; if (!v) return;
  const o = v.obj, tgt = v.ruta[v.i];
  if (!tgt) { viaje.activo = null; engineSet(false); v.onFin && v.onFin(); return; }
  const dx = tgt[0] - o.position.x, dz = tgt[1] - o.position.z, d = Math.hypot(dx, dz);
  const ultimo = v.i === v.ruta.length - 1;
  v.v = mix(v.v, ultimo && d < 8 ? Math.max(1.2, d * .9) : v.vel, Math.min(1, dt * 1.5));
  if (d < .4) { v.i++; return; }
  const yaw = Math.atan2(dx, dz); o.rotation.y = angLerpY(o.rotation.y, yaw, dt * 2.2);
  const st = Math.min(d, v.v * dt); o.position.x += Math.sin(o.rotation.y) * st; o.position.z += Math.cos(o.rotation.y) * st;
  engineTune(32 + v.v * 5, 260 + v.v * 30);
  if (G.mode === 'pc') G.shake = Math.max(G.shake, .03);
}
function angLerpY(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, t); }
