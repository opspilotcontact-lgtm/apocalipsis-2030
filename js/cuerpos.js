// Cuerpos: robots y humanos por código (mismo esqueleto, mismas animaciones) y modelos .glb estáticos.
import { THREE, mix, clamp, std, glow, rbox, sphG, cylG, texScratch } from './nucleo.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- Robots ----------
const sharedM = new Map();
function robotMats(o) {
  const key = o.dark + '|' + o.accent; let s = sharedM.get(key);
  if (!s) { s = { mDark: std({ color: o.dark || 0x1c1f24, metalness: .6, roughness: .5, roughnessMap: texScratch }), mAcc: std({ color: o.accent, metalness: .35, roughness: .45, roughnessMap: texScratch }), mJoint: std({ color: 0x2a2e34, metalness: .9, roughness: .3 }) }; sharedM.set(key, s); }
  return { ...s, mBody: std({ color: o.body, metalness: .75, roughness: .35, roughnessMap: texScratch, bumpMap: texScratch, bumpScale: .4 }), mEye: glow(o.eye, 3) };
}
function kit(par0, hit) {
  const add = (geo, m, par, x, y, z, part, limb) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; me.userData.part = part || 'torso'; if (limb) me.userData.limb = limb; par.add(me); hit.push(me); return me; };
  return {
    add,
    box: (w, h, d, m, par, x = 0, y = 0, z = 0, part, limb) => add(rbox(w, h, d), m, par, x, y, z, part, limb),
    sph: (r, m, par, x, y, z, part, limb) => add(sphG(r), m, par, x, y, z, part, limb),
    cy: (r, l, m, par, x, y, z, part, limb, rx = 0) => { const me = add(cylG(r, l), m, par, x, y, z, part, limb); me.rotation.x = rx; return me; },
    grp: (par, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); par.add(g); return g; }
  };
}
export function makeRobot(o) {
  const S = o.scale || 1, root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(S); root.add(body);
  const { mBody, mDark, mAcc, mEye, mJoint } = robotMats(o), hit = [];
  const { box, sph, cy, grp } = kit(body, hit);
  const hips = grp(body, 0, .95, 0);
  box(.38, .17, .24, mDark, hips); box(.32, .06, .27, mAcc, hips, 0, .07, 0);
  const spine = grp(hips, 0, .08, 0);
  box(.28, .18, .2, mDark, spine, 0, .07, 0);
  box(.54, .44, .32, mBody, spine, 0, .34, 0);
  const plate = box(.4, .2, .05, mAcc, spine, 0, .4, .165);
  box(.1, .025, .02, mEye, spine, .18, .22, .165); box(.1, .025, .02, mEye, spine, -.18, .22, .165);
  cy(.055, .035, mEye, spine, 0, .25, .175, 'torso', null, Math.PI / 2);
  box(.26, .24, .14, mDark, spine, 0, .36, -.21);
  cy(.04, .08, mEye, spine, .08, .22, -.28, 'torso', null, Math.PI / 2); cy(.04, .08, mEye, spine, -.08, .22, -.28, 'torso', null, Math.PI / 2);
  const neck = grp(spine, 0, .57, 0);
  cy(.05, .09, mJoint, neck, 0, .04, 0, 'head');
  box(.26, .25, .28, mBody, neck, 0, .18, 0, 'head'); box(.2, .06, .06, mDark, neck, 0, .08, .12, 'head');
  box(.22, .06, .03, mEye, neck, 0, .2, .14, 'head'); box(.05, .11, .16, mAcc, neck, .145, .18, 0, 'head'); box(.05, .11, .16, mAcc, neck, -.145, .18, 0, 'head');
  if (o.helmet) { box(.32, .07, .34, mAcc, neck, 0, .33, 0, 'head'); box(.03, .24, .03, mEye, neck, .1, .46, -.05, 'head'); box(.03, .24, .03, mEye, neck, -.1, .46, -.05, 'head'); }
  else if (o.antenna) { cy(.01, .2, mDark, neck, .09, .4, -.06, 'head'); sph(.022, mEye, neck, .09, .51, -.06, 'head'); }
  const arm = sd => { const limb = sd > 0 ? 'armL' : 'armR', sh = grp(spine, .35 * sd, .48, 0);
    sph(.085, mJoint, sh, 0, 0, 0, 'arm', limb); box(.2, .15, .24, mAcc, sh, .03 * sd, .04, 0, 'arm', limb); box(.11, .28, .11, mBody, sh, 0, -.18, 0, 'arm', limb);
    const el = grp(sh, 0, -.34, 0); sph(.06, mJoint, el, 0, 0, 0, 'arm', limb); box(.105, .27, .105, mDark, el, 0, -.16, 0, 'arm', limb);
    cy(.018, .2, mJoint, el, .065 * sd, -.15, 0, 'arm', limb); box(.12, .11, .13, mBody, el, 0, -.34, 0, 'arm', limb); box(.11, .05, .05, mDark, el, 0, -.41, .03, 'arm', limb);
    return { sh, el, grip: grp(el, 0, -.36, .02) }; };
  const leg = sd => { const limb = sd > 0 ? 'legL' : 'legR', hp = grp(hips, .12 * sd, -.06, 0);
    sph(.075, mJoint, hp, 0, 0, 0, 'leg', limb); box(.16, .4, .17, mBody, hp, 0, -.22, 0, 'leg', limb); cy(.02, .3, mJoint, hp, .095 * sd, -.22, .02, 'leg', limb);
    const kn = grp(hp, 0, -.44, 0); sph(.07, mJoint, kn, 0, 0, 0, 'leg', limb); box(.13, .1, .07, mAcc, kn, 0, 0, .085, 'leg', limb); box(.13, .39, .14, mDark, kn, 0, -.21, 0, 'leg', limb);
    const an = grp(kn, 0, -.42, 0); box(.16, .075, .28, mBody, an, 0, 0, .05, 'leg', limb); box(.15, .035, .08, mAcc, an, 0, .045, .15, 'leg', limb);
    return { hp, kn, an }; };
  return { root, body, hips, spine, neck, plate, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1), hit, mBody, mEye, S, phase: 0, amp: 0, run: 0, t: Math.random() * 9, flash: 0, lost: {} };
}
export const PAL = {
  dave: { body: 0x8c939c, dark: 0x1e2329, accent: 0x2fb6ff, eye: 0x5fd8ff },
  r7: { body: 0x4a4f57, dark: 0x1a1c20, accent: 0x8a1a12, eye: 0xff2a1a, antenna: true, scale: .95 }
};

// ---------- Humanos (mismo esqueleto: animRig los mueve igual) ----------
// o: { camisa, pantalon, piel, pelo, bata, gorra, casco, melena, barba, zapato, scale }
export function makeHuman(o) {
  const S = o.scale || .94, root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(S); root.add(body);
  const hit = [], { box, sph, cy, grp } = kit(body, hit);
  const mC = std({ color: o.camisa, roughness: .85 }), mP = std({ color: o.pantalon, roughness: .9 }), mS = std({ color: o.piel, roughness: .7 }),
    mH = std({ color: o.pelo, roughness: .9 }), mZ = std({ color: o.zapato || 0x1d1a17, roughness: .7 }), mE = std({ color: 0x111111, roughness: .3 });
  const mB = o.bata ? std({ color: 0xe8ecef, roughness: .8 }) : null, mG = o.gorra || o.casco ? std({ color: o.gorraColor || o.camisa, roughness: .8 }) : null;
  const hips = grp(body, 0, .95, 0);
  box(.34, .16, .22, mP, hips);
  const spine = grp(hips, 0, .08, 0);
  box(.3, .2, .2, mC, spine, 0, .08, 0); box(.4, .36, .24, mC, spine, 0, .33, 0);
  if (mB) { box(.43, .62, .27, mB, spine, 0, .2, 0); box(.12, .3, .02, mC, spine, 0, .38, .135); }
  if (o.chaleco) box(.42, .34, .26, std({ color: o.chaleco, roughness: .8 }), spine, 0, .32, 0);
  const neck = grp(spine, 0, .53, 0);
  cy(.05, .08, mS, neck, 0, .03, 0, 'head');
  box(.19, .24, .21, mS, neck, 0, .17, .005, 'head');
  box(.035, .05, .04, mS, neck, 0, .15, .115, 'head'); // nariz
  box(.03, .016, .01, mE, neck, .045, .2, .112, 'head'); box(.03, .016, .01, mE, neck, -.045, .2, .112, 'head');
  box(.2, .07, .22, mH, neck, 0, .29, -.005, 'head'); box(.2, .16, .05, mH, neck, 0, .21, -.1, 'head');
  if (o.melena) box(.21, .3, .07, mH, neck, 0, .12, -.1, 'head');
  if (o.barba) box(.17, .07, .05, mH, neck, 0, .08, .085, 'head');
  if (o.gorra) { box(.22, .07, .23, mG, neck, 0, .32, 0, 'head'); box(.18, .015, .09, mG, neck, 0, .29, .14, 'head'); }
  if (o.casco) box(.25, .12, .26, mG, neck, 0, .33, -.005, 'head');
  const arm = sd => { const limb = sd > 0 ? 'armL' : 'armR', sh = grp(spine, .24 * sd, .47, 0);
    sph(.065, mB || mC, sh, 0, 0, 0, 'arm', limb); box(.1, .3, .1, mB || mC, sh, 0, -.16, 0, 'arm', limb);
    const el = grp(sh, 0, -.32, 0); box(.085, .27, .085, o.mangaCorta ? mS : (mB || mC), el, 0, -.14, 0, 'arm', limb); box(.07, .09, .045, mS, el, 0, -.32, 0, 'arm', limb);
    return { sh, el, grip: grp(el, 0, -.34, .02) }; };
  const leg = sd => { const limb = sd > 0 ? 'legL' : 'legR', hp = grp(hips, .1 * sd, -.06, 0);
    box(.13, .42, .14, mP, hp, 0, -.22, 0, 'leg', limb);
    const kn = grp(hp, 0, -.44, 0); box(.11, .4, .12, mP, kn, 0, -.21, 0, 'leg', limb);
    const an = grp(kn, 0, -.42, 0); box(.11, .07, .25, mZ, an, 0, -.01, .05, 'leg', limb);
    return { hp, kn, an }; };
  return { root, body, hips, spine, neck, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1), hit, mBody: mC, mEye: mE, S, phase: 0, amp: 0, run: 0, t: Math.random() * 9, flash: 0, lost: {}, humano: true };
}

// st: spd, atk, atkLeft, cast, aim, twoHand, pitch, flinch(-1..1), twist, lean, headSnap, down, boot, habla
export function animRig(R, dt, st) {
  R.t += dt;
  const spd = Math.abs(st.spd || 0), dirS = (st.spd || 0) < 0 ? -1 : 1;
  R.amp = mix(R.amp, Math.min(1, spd / 1.8), Math.min(1, dt * 6)); R.run = mix(R.run, clamp((spd - 3) / 1.8, 0, 1), Math.min(1, dt * 5));
  if (spd > .05) R.phase += dt * (3.2 + spd * 1.2) / R.S * dirS;
  const a = R.amp, rn = R.run, p = R.phase, s = Math.sin(p), c = Math.cos(p), LA = .5 + rn * .35;
  let lhx = -s * LA * a, rhx = s * LA * a, lkx = a * (.1 + Math.max(0, c) * (.8 + rn * .6)), rkx = a * (.1 + Math.max(0, -c) * (.8 + rn * .6));
  const AA = (.4 + rn * .5) * a;
  let lsx = s * AA, rsx = -s * AA, lex = -(.18 + .25 * a + rn * .9), rex = lex, lsz = .07, rsz = -.07;
  let spx = rn * .28 + a * .04, spy = s * .1 * a, spz = 0, hy = .95 - .03 * a - .05 * rn + Math.abs(s) * .035 * a, hdx = 0, hdy = -spy * .6;
  const br = Math.sin(R.t * 1.7) * (1 - a); spx += br * .015; hdx += br * .03;
  if (st.habla) { hdx += Math.sin(R.t * 9) * .05 * st.habla; hdy += Math.sin(R.t * 2.3) * .12 * st.habla; rex = mix(rex, -.9 + Math.sin(R.t * 3) * .25, st.habla * .7); rsx = mix(rsx, -.35, st.habla * .6); }
  if (st.aim) { const w = st.aim, pt = st.pitch || 0; rsx = mix(rsx, -1.45 - pt, w); rex = mix(rex, -.05, w); rsz = mix(rsz, .04, w); if (st.twoHand) { lsx = mix(lsx, -1.25 - pt, w); lex = mix(lex, -.7, w); lsz = mix(lsz, -.5, w); } spy *= 1 - w * .7; }
  if (st.cast > 0) { const w = st.cast; rsx = mix(rsx, -1.5, w); rex = mix(rex, 0, w); lsx = mix(lsx, -1.3, w); lex = mix(lex, -.3, w); lsz = mix(lsz, -.3, w); spx -= .08 * w; }
  if (st.atk >= 0) { const t = st.atk; let sx, ex, sy;
    if (t < .55) { const q = t / .55; sx = .7 * q; ex = -1.9 * q; sy = -.55 * q; } else if (t < .72) { const q = (t - .55) / .17; sx = .7 - 2.3 * q; ex = -1.9 + 1.8 * q; sy = -.55 + 1.1 * q; } else { const q = (t - .72) / .28; sx = -1.6 * (1 - q); ex = -.1 - .3 * q; sy = .55 * (1 - q); }
    if (st.atkLeft) { lsx = sx; lex = ex; spy = -sy; rsx = -.4; rex = -1.2; } else { rsx = sx; rex = ex; spy = sy; lsx = -.4; lex = -1.2; } }
  const f = st.flinch || 0; spx -= f * .45; hdx -= f * .35; lsx += f * .4; rsx += f * .4;
  spy += (st.twist || 0) * .6; spz += (st.lean || 0) * .35; hdx -= (st.headSnap || 0) * .7;
  const b = 1 - (st.boot ?? 1);
  if (b > 0) { hy -= b * .38; spx += b; lhx -= b * 1.1; rhx -= b * 1.1; lkx += b * 2; rkx += b * 2; lsx = mix(lsx, -.3, b); rsx = mix(rsx, -.3, b); hdx += b * .5; }
  const dn = st.down || 0;
  if (dn > 0) { lkx += dn * .5; rkx += dn * .5; lsz += dn * .8; rsz -= dn * .8; lsx -= dn * .5; rsx -= dn * .5; hdx -= dn * .2; }
  R.body.rotation.x = -dn * 1.48; R.body.position.y = dn * .14 * R.S;
  const k = Math.min(1, dt * 16), L = (o, pr, v) => { o.rotation[pr] = mix(o.rotation[pr], v, k); };
  R.hips.position.y = mix(R.hips.position.y, hy, k);
  L(R.spine, 'x', spx); L(R.spine, 'y', spy); L(R.spine, 'z', spz); L(R.neck, 'x', hdx); L(R.neck, 'y', hdy);
  L(R.legL.hp, 'x', lhx); L(R.legR.hp, 'x', rhx); L(R.legL.kn, 'x', lkx); L(R.legR.kn, 'x', rkx);
  L(R.legL.an, 'x', -(lhx + lkx) * .8); L(R.legR.an, 'x', -(rhx + rkx) * .8);
  L(R.armL.sh, 'x', lsx); L(R.armR.sh, 'x', rsx); L(R.armL.el, 'x', lex); L(R.armR.el, 'x', rex); L(R.armL.sh, 'z', lsz); L(R.armR.sh, 'z', rsz);
  R.flash = Math.max(0, R.flash - dt * 5); R.mBody.emissive.setRGB(R.flash * .9, R.flash * .45, R.flash * .25);
}
// postura fija: sentado en el suelo contra una pared (Mike herido)
export function poseHerido(R, t) {
  R.hips.position.y = .2; R.body.rotation.x = 0; R.body.position.y = 0;
  R.spine.rotation.set(-.42, 0, .08); R.neck.rotation.set(.45 + Math.sin(t * .8) * .04, .25, 0);
  R.legL.hp.rotation.set(-1.5, 0, .12); R.legR.hp.rotation.set(-1.3, 0, -.18); R.legL.kn.rotation.x = .35; R.legR.kn.rotation.x = .9; R.legL.an.rotation.x = 0; R.legR.an.rotation.x = -.3;
  R.armL.sh.rotation.set(.2, 0, .25); R.armL.el.rotation.x = -.4; R.armR.sh.rotation.set(-.6, 0, -.2); R.armR.el.rotation.x = -1.3;
  R.mBody.emissive.setRGB(0, 0, 0);
}
export const staticPose = (R, st) => { for (let i = 0; i < 3; i++) animRig(R, 1, st); };

// ---------- Modelos .glb (personajes texturizados sin esqueleto, vehículos y objetos del pack) ----------
const loader = new GLTFLoader();
const cache = {};
export const cargando = { n: 0 };
export function modelo(nombre) {
  if (!cache[nombre]) { cargando.n++; cache[nombre] = new Promise((res, rej) => loader.load(`assets/modelos/${nombre}.glb`, g => { cargando.n--; res(g.scene); }, undefined, e => { cargando.n--; rej(e); })); }
  return cache[nombre];
}
// Devuelve un grupo con el modelo de pie, centrado en XZ, con los pies en y=0 y la altura pedida.
export async function instancia(nombre, alto, o = {}) {
  const src = await modelo(nombre), s = src.clone(true), g = new THREE.Group(); g.add(s);
  if (o.ry) s.rotation.y = o.ry; // girar antes de medir, para que el centrado tenga en cuenta el giro
  const box = new THREE.Box3().setFromObject(s), size = box.getSize(new THREE.Vector3());
  const ref = o.eje === 'largo' ? Math.max(size.x, size.z) : size.y;
  if (alto) s.scale.multiplyScalar(alto / ref);
  box.setFromObject(s); const c = box.getCenter(new THREE.Vector3());
  s.position.x -= c.x; s.position.z -= c.z; s.position.y -= box.min.y;
  s.traverse(m => { if (m.isMesh) { m.castShadow = o.sombra !== false; m.receiveShadow = true; } });
  return g;
}
// convierte un modelo en holograma (para la grabación de la cámara de seguridad)
export function holograma(g, color = 0x29e6ff) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  g.traverse(m => { if (m.isMesh) { m.material = mat; m.castShadow = false; } });
  return mat;
}
