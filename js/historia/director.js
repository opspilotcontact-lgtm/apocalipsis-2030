// Director de historia: ejecuta los capítulos como una lista de pasos (datos), con puntos de control y memoria.
// Tipos de paso:
//   evento      espera un evento de otro sistema (director.evento('nombre')) o una condición `cond`; `alt` = alternativa jugable con E/A; `max` = sigue solo
//   dialogo · ir · usar · subir · conducir · oleada · resistir · sigilo · viaje · fundido · fn · esperar · fin   (los de siempre)
//   escena      momento montado: líneas con pausas, NPC que caminan a marcas, miran, gesticulan, ramas por memoria
//   eleccion    elegir respuesta (2-3) mirándola + E / A / clic, o con 1-3; se guarda en la memoria
//   mirar       espera a que el jugador mire algo (un punto, un objeto o un NPC)
//   grabacion   cinta de Mike: objeto que se coge y se escucha (opcional: no bloquea la historia)
//   opcional    objeto que se puede usar o no, sin parar la historia (despedirse, coger algo…)
//   cinematica  bandas negras en PC (en VR no hace nada): { on: true|false }
// Cualquier paso admite: si (m, D) => bool (si es falso se salta) · rec: [[personaje, evento, peso, efectos, datos]] |
//   (m, D) => … (memoria que se escribe al COMPLETAR el paso) · et: 'etiqueta' (destino de un salto) · cp: punto de control.
// Líneas (en dialogo, escena y las respuestas de eleccion): ['HANK', 'texto', f] o { n, t, si, gesto, mira, pausa, f }
//   t puede ser una función (m, D) => 'texto' · si: (m, D) => bool · gesto: [npc, tipo] · mira: [npc, objetivo] · pausa: segundos de silencio después.
// Acciones de escena además de líneas: { espera } · { npc, a: [x,z], vel, esperar } · { npc, mira } · { npc, gesto, dur }
//   { f: D => … } (puede ser async) · { si, entonces: [...], sino: [...] } · { cinematica: bool } · { rec: [...] }
import { THREE, V3, G, clamp, scene, camera, canvasPlane, wrapText, aplicarHora, setCapa } from '../nucleo.js';
import { fundido, sfx, ambiente, engineSet } from '../fx.js';
import { ui, say } from '../ui.js';
import { P, WEAPONS, playerFeet, teleport, usable, quitarUsable, limpiarUsables, darArma, attachWeapon } from '../jugador.js';
import { car, colocarCoche, exitCar, viaje, iniciarViaje, levantarse } from '../vehiculos.js';
import { spawn, enemies, limpiarEnemigos, vivos, guardia, foco, limpiarSigilo, deteccion } from '../enemigos.js';
import { makeHuman, animRig, poseHerido } from '../cuerpos.js';
import { npc, npcs, ocultar, ocultarTodos, caminarA, mirarA, gesto, aspecto } from '../npcs.js';
import { PUNTOS, P3, W } from '../mundo/tierra.js';
import { memoria } from '../personajes/memoria.js';
import { FICHAS } from '../personajes/fichas.js';

const tA = new V3(), tB = new V3(), tC = new V3();
// quién mueve la boca con cada nombre de subtítulo
const HABLA = { MIKE: 'mike', SARAH: 'sarah', HANK: 'hank', JOHN: 'john', SOLDADO: 'soldado1', GUARDIA: 'guarda', VARELA: 'varela', 'NÚÑEZ': 'soldado2', RATA: 'rata', CHISPA: 'chispa', 'EL REY': 'elrey' };
const punto = k => Array.isArray(k) ? new V3(k[0], 0, k[1]) : k instanceof V3 ? k : P3(k);

// ---------- Marcador del objetivo: columna de luz + rombo ----------
const marca = new THREE.Group();
{ const col = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcf6a, transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })); col.position.y = 20; marca.add(col);
  const rombo = new THREE.Mesh(new THREE.OctahedronGeometry(.25), new THREE.MeshBasicMaterial({ color: 0xffcf6a, toneMapped: false })); rombo.position.y = 2.6; rombo.scale.y = 1.5; marca.add(rombo); marca.userData.rombo = rombo; }
marca.visible = false; scene.add(marca);
function marcar(p) { if (!p) { marca.visible = false; return; } marca.position.set(p.x, 0, p.z); marca.visible = true; }

// ---------- Voces sintetizadas (opcional) ----------
const VOZ_EXTRA = { RADIO: [1, 1.1], TELE: [1.25, 1.1], SOLDADO: [.85, 1.05], GUARDIA: [.8, 1], 'NÚÑEZ': [.95, 1.1], MILICIANO: [.9, 1.05], SAQUEADOR: [1, 1.1], CINTA: [1.1, 1.0], CONTESTADOR: [1.1, 1.0] };
function voz(n) {
  if (VOZ_EXTRA[n]) return VOZ_EXTRA[n];
  const id = HABLA[n] || n.toLowerCase(); const f = FICHAS[id] || (/MIKE/.test(n) ? FICHAS.mike : null);
  return f?.voz ? [f.voz.tono, f.voz.ritmo] : [1, 1];
}
let vozEs = null;
function hablar(n, t) {
  if (!G.voces || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); if (!vozEs) vozEs = speechSynthesis.getVoices().find(v => /^es(-|_)ES/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^es/i.test(v.lang)) || null;
    const u = new SpeechSynthesisUtterance(t); u.lang = 'es-ES'; if (vozEs) u.voice = vozEs; const [p, r] = voz(n); u.pitch = p; u.rate = r * 1.05; speechSynthesis.speak(u); } catch (e) {}
}
const callar = () => { if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {} };

// ---------- Bandas de cine (solo PC) ----------
const bandas = [];
function crearBandas() {
  if (bandas.length || typeof document === 'undefined') return;
  for (const lado of ['top', 'bottom']) { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:0;right:0;${lado}:0;height:0;background:#000;z-index:4;pointer-events:none;transition:height .9s ease`; document.body.appendChild(d); bandas.push(d); }
}
function cinematica(on) { crearBandas(); const h = on && G.mode === 'pc' ? '11vh' : '0'; for (const b of bandas) b.style.height = h; }

// ---------- Elección: tarjetas en el mundo, delante del jugador ----------
const tarjetas = [0, 1, 2].map(() => {
  const c = canvasPlane(.66, .2, 512, (x, w, h, a) => {
    x.fillStyle = a.sel ? 'rgba(255,207,106,.95)' : 'rgba(8,12,22,.86)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 22); x.fill();
    x.strokeStyle = a.sel ? '#fff' : 'rgba(255,207,106,.6)'; x.lineWidth = 4; x.stroke();
    x.fillStyle = a.sel ? '#141008' : '#ffcf6a'; x.font = '700 34px "Chakra Petch",sans-serif'; x.fillText(String(a.i + 1), 22, 56);
    x.fillStyle = a.sel ? '#141008' : '#eef2f6'; x.font = '600 29px Inter,sans-serif'; wrapText(x, a.t, w - 92).slice(0, 3).forEach((l, i, arr) => x.fillText(l, 66, h / 2 + 10 + (i - (arr.length - 1) / 2) * 34));
  });
  c.mesh.renderOrder = 993; c.mesh.material.depthTest = false; c.mesh.visible = false; scene.add(c.mesh); return c;
});
let pista = null;
function pistaEleccion(on) {
  if (typeof document === 'undefined') return;
  if (!pista) { pista = document.createElement('div'); pista.style.cssText = 'position:fixed;left:50%;bottom:24vh;transform:translateX(-50%);z-index:5;pointer-events:none;font:600 14px Inter,sans-serif;color:#ffcf6a;background:rgba(8,12,22,.7);padding:6px 12px;border-radius:8px;letter-spacing:.04em'; document.body.appendChild(pista); }
  pista.textContent = 'Mira una respuesta y pulsa E (o clic) · también 1-3'; pista.style.display = on && G.mode === 'pc' ? 'block' : 'none';
}

// ---------- Cintas de Mike: objeto que se coge ----------
const cintaGeo = new THREE.BoxGeometry(.16, .05, .1), cintaMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: .5, metalness: .4 }), ledMat = new THREE.MeshBasicMaterial({ color: 0xff3020, toneMapped: false });
const cintas = {};
function mallaCinta(id, pos) {
  let g = cintas[id];
  if (!g) { g = new THREE.Group(); const b = new THREE.Mesh(cintaGeo, cintaMat); b.castShadow = true; g.add(b); const l = new THREE.Mesh(new THREE.BoxGeometry(.018, .012, .018), ledMat); l.position.set(.055, .03, .03); g.add(l); g.userData.led = l; scene.add(g); cintas[id] = g; }
  g.position.set(pos[0], pos[1], pos[2]); g.rotation.set(0, (pos[3] || 0), 0); g.visible = true; return g;
}

// ---------- Enemigos humanos (saqueadores, milicia) ----------
// Se crean como un R-7 y se les cambia el cuerpo por un humano con la misma IA de persecución y golpe.
// No mueren reventados: al quedarse sin vida caen al suelo (o se rinden sentados) y salen del combate.
// TODO(combate): un tipo 'humano' propio en enemigos.js con armas de fuego, cobertura y rendición.
const humanos = [], caidos = [];
const FRASES_CAIDA = ['¡Vale, vale! ¡Me rindo!', '¡Para! ¡Para!', 'Ah… mi pierna…', '¡No dispares!'];
function crearHumano(x, z, o = {}) {
  const e = spawn('r7', x, z, { vel: o.vel || .8, hp: o.hp || 60 });
  const R = makeHuman(aspecto(o.def || 'saqueador'));
  R.root.position.copy(e.R.root.position); R.root.rotation.y = e.R.root.rotation.y; e.R.root.removeFromParent(); scene.add(R.root);
  e.R = R; e.pos = R.root.position; e.S = R.S; e.boot = 1; e.limbHP = {}; e.reach = 1.35; e.humano = o.def || 'saqueador'; e.rinde = !!o.rinde; e.nombre = o.nombre || null;
  e.atkCD = (o.retraso || 0) + .8;
  for (const m of R.hit) m.userData.enemy = e;
  let hp = e.hpMax;
  Object.defineProperty(e, 'hp', { configurable: true, get: () => hp, set: v => { if (v <= 0 && e.alive) { hp = .01; e.caido = true; } else hp = v; } });
  humanos.push(e); return e;
}
function neutralizar(e) {
  e.alive = false; const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  e.bar.g.removeFromParent(); for (const m of e.R.hit) m.userData.enemy = null;
  caidos.push({ R: e.R, t: 0, sentado: e.rinde }); sfx('hurt'); G.shake = Math.max(G.shake, .15);
  say(e.rinde ? '¡Basta! ¡Basta, me rindo!' : FRASES_CAIDA[Math.floor(Math.random() * FRASES_CAIDA.length)]);
  director.humanosCaidos++;
  if (e.nombre) memoria.recordar('dave', 'derroto_' + e.nombre, 1);
}

export const director = {
  capitulos: [], capIdx: -1, cap: null, pasoIdx: -1, paso: null, t: 0, token: 0, pausa: true, hablante: null, cp: null, onFin: null,
  linea: null, cola: [], cinta: null, elec: null, humanosCaidos: 0,

  registrar(caps) { this.capitulos = caps; },
  progreso() {
    try {
      // v2: se insertó «La última cena» en la posición 1; los guardados antiguos (>= 1) suben un capítulo
      if (localStorage.getItem('apoc2030.capv') !== '2') { const v = +localStorage.getItem('apoc2030.cap') || 0; if (v >= 1) localStorage.setItem('apoc2030.cap', String(v + 1)); localStorage.setItem('apoc2030.capv', '2'); }
      return +localStorage.getItem('apoc2030.cap') || 0;
    } catch (e) { return 0; }
  },
  guardar(i) { try { if (i > this.progreso()) localStorage.setItem('apoc2030.cap', String(i)); } catch (e) {} },

  async iniciarCapitulo(i) {
    const tok = ++this.token; this.pausa = true; G.enDialogo = false;
    this.capIdx = i; this.cap = this.capitulos[i]; this.guardar(i);
    await fundido(1, 2.5); if (tok !== this.token) return;
    this.limpiar(true);
    await this.prepararCap(); if (tok !== this.token) return;
    this.cp = { pasoIdx: 0, inv: [...P.inv], w: P.w, punto: this.cap.inicio, rehacer: null };
    ui.tarjeta(this.cap.titulo, this.cap.sub, this.cap.nota);
    sfx('objetivo');
    fundido(0, .8);
    this.pausa = false; this.irAPaso(0);
  },
  async prepararCap() {
    const c = this.cap;
    aplicarHora(c.hora || 'noche'); setCapa('calma', !c.caos); setCapa('caos', !!c.caos); setCapa('tierra', !c.espacio); setCapa('espacio', !!c.espacio); G.enEspacio = !!c.espacio;
    ambiente(c.ambiente || null);
    P.inv = (c.armas || ['punos']).filter(k => WEAPONS[k]); if (!P.inv.length) P.inv = ['punos']; P.w = WEAPONS[c.arma] ? c.arma : P.inv[P.inv.length - 1]; for (const k of P.inv) if (WEAPONS[k].mag) P.ammo[k] = WEAPONS[k].mag;
    P.hp = 100; P.dead = 0;
    if (c.inicio) { const p = PUNTOS[c.inicio]; teleport(p[0], p[1], p[2] || 0); }
    attachWeapon();
    if (c.prep) await c.prep(API);
  },
  limpiar(todo) {
    limpiarEnemigos(); limpiarSigilo(); limpiarUsables(); marcar(null); ui.subtitulo(null); ui.objetivo('');
    if (viaje.activo) { viaje.activo = null; engineSet(false); }
    if (todo) { ocultarTodos(); if (car.occupied) exitCar(true); car.bloqueado = false; P.sentado = null; P.bloqueoMov = false; G.pausaEnemigos = false; for (const k in cintas) cintas[k].visible = false; this.opcionales = []; }
    humanos.length = 0; for (const c of caidos) c.R.root.removeFromParent(); caidos.length = 0;
    this.cerrarEleccion(); this.cortarLinea(); this.cola = []; this.cinta = null; cinematica(false);
    this.hablante = null; G.enDialogo = false; callar();
  },

  // ---------- pasos ----------
  irAPaso(i) {
    const pasos = this.cap.pasos; this.pasoIdx = i; this.paso = pasos[i]; this.t = 0; this.hablante = null; G.enDialogo = false; this.cortarLinea(); this.cerrarEleccion();
    const p = this.paso; if (!p) return this.terminarCap();
    if (p.si && !p.si(memoria, API)) return this.irAPaso(i + 1);
    if (p.cp) this.cp = { pasoIdx: i, inv: [...P.inv], w: P.w, punto: p.cp.punto, rehacer: p.cp.rehacer };
    if (p.obj) { ui.objetivo(typeof p.obj === 'function' ? p.obj(API) : p.obj); sfx('objetivo'); }
    const tok = this.token;
    const sig = () => { if (tok === this.token && this.paso === p) this.avanzar(); };
    switch (p.t) {
      case 'dialogo': case 'escena':
        G.enDialogo = !p.libre; if (p.cinematica) cinematica(true);
        this.correr(p.l || p.acc, p).then(ok => { if (p.cinematica) cinematica(false); if (ok) sig(); }); break;
      case 'eleccion': this.abrirEleccion(p).then(ok => ok && sig()); break;
      case 'mirar': this.mirT = 0; if (p.marca !== false) marcar(this.objetivoMirada(p.a)); break;
      case 'grabacion': {
        const reg = () => this.ponerCinta(p, () => { if (!p.opcional) sig(); }, reg);
        reg(); if (p.opcional) { (this.opcionales ||= []).push(reg); sig(); break; }
        if (p.marca !== false) marcar(new V3(p.pos[0], 0, p.pos[2])); break; }
      case 'opcional': {
        const pos = typeof p.pos === 'function' ? p.pos : punto(p.a);
        const reg = () => usable({ id: p.id, pos, r: p.r || 1.8, label: p.label, alto: p.alto, mesh: p.mesh ? p.mesh() : null, on: () => { quitarUsable(p.id); this.opcionales = this.opcionales.filter(o => o !== reg); if (p.f) p.f(API, memoria); this.escribir(p.recUsar); } });
        reg(); (this.opcionales ||= []).push(reg); sig(); break; }
      case 'cinematica': cinematica(p.on !== false); sig(); break;
      case 'evento': {
        // espera un evento de otro sistema (interacción, combate…) o una condición; con alternativa jugable mientras no exista
        if (p.a) marcar(punto(p.a));
        if (p.f0) p.f0(API, memoria);
        if (p.alt) { const alt = p.alt, pos = alt.aqui ? () => playerFeet(new V3()).setY(playerFeet(new V3()).y + .9) : alt.pos || punto(alt.a || p.a);
          usable({ id: 'alt-' + p.nombre, pos, r: alt.r || 2, label: alt.label, alto: alt.alto, on: () => { quitarUsable('alt-' + p.nombre); if (alt.f) alt.f(API, memoria); this.evento(p.nombre, { alternativa: true }); } }); }
        break; }
      case 'ir': marcar(p.marca === false ? null : punto(p.a)); break;
      case 'conducir': marcar(punto(p.a)); break;
      case 'subir': marcar(car.g.position); break;
      case 'usar': {
        const pos = p.pos ? p.pos : punto(p.a);
        usable({ id: p.id, pos, r: p.r || 1.8, label: p.label, mesh: p.mesh ? p.mesh() : null, alCabeza: p.alCabeza, alto: p.alto, on: () => { quitarUsable(p.id); marcar(null); if (p.f) p.f(API, memoria); sig(); } });
        if (p.marca !== false) marcar(typeof pos === 'function' ? pos() : pos);
        break; }
      case 'oleada':
        for (const [x, z, o] of (typeof p.robots === 'function' ? p.robots(memoria, API) : p.robots) || []) spawn('r7', x, z, o || {});
        for (const [x, z, o] of (typeof p.humanos === 'function' ? p.humanos(memoria, API) : p.humanos) || []) crearHumano(x, z, o || {});
        break;
      case 'resistir': this.resT = 0; break;
      case 'sigilo':
        for (const g of (typeof p.guardias === 'function' ? p.guardias(API) : p.guardias) || []) guardia(g.ruta, g);
        for (const f of (typeof p.focos === 'function' ? p.focos(API) : p.focos) || []) foco(f.origen, f.ruta, f);
        deteccion.v = 0; deteccion.activa = true; marcar(punto(p.a)); break;
      case 'viaje': { const o = p.veh === 'camion' ? W.camion : W.orion, s = p.veh === 'camion' ? W.camionSeat : W.orionSeat; if (!o) { sig(); break; } if (p.f0) p.f0(API); iniciarViaje(o, s, p.ruta, p.vel || 7, sig); break; }
      case 'fundido': (async () => { await fundido(1, p.vel || 2); if (tok !== this.token) return; if (p.f) await p.f(API, memoria); if (p.texto) ui.tarjeta(p.texto, p.sub, null, 3.2); if (p.espera) await this.esperar(p.espera); fundido(0, .9); sig(); })(); break;
      case 'fn': Promise.resolve(p.f(API, memoria)).then(sig); break;
      case 'esperar': break;
      case 'fin': this.terminarCap(); break;
    }
  },
  // completar el paso actual: escribir su memoria y pasar al siguiente (o saltar a una etiqueta)
  avanzar(etiqueta) {
    const p = this.paso; if (p) this.escribir(p.rec);
    if (etiqueta) { const j = this.cap.pasos.findIndex(q => q.et === etiqueta); if (j >= 0) return this.irAPaso(j); }
    this.irAPaso(this.pasoIdx + 1);
  },
  escribir(rec) {
    if (!rec) return;
    if (typeof rec === 'function') return rec(memoria, API);
    for (const r of rec) memoria.recordar(...r);
  },
  esperar(s) { return new Promise(r => setTimeout(r, s * 1000)); },

  // ---------- líneas y escenas ----------
  // muestra una línea y espera a que acabe (tiempo de lectura) o a que el jugador la salte
  decir(n, t) {
    this.cortarLinea(true);
    ui.subtitulo(n, t); this.hablante = HABLA[n] || null; sfx(n === 'RADIO' || n === 'TELE' || n === 'CINTA' || n === 'CONTESTADOR' ? 'radio' : 'blip'); hablar(n, t);
    return new Promise(res => { this.linea = { t: 0, dur: clamp(1.6 + t.length * .055, 2.4, 8), res }; });
  },
  cortarLinea(porFlujo) {
    if (this.cinta && porFlujo) { this.cola.unshift(this.cinta.l); this.cinta = null; }
    if (this.linea) { const r = this.linea.res; this.linea = null; r(); }
  },
  async correr(lista, p, anidado = false) {
    const tok = this.token, vivo = () => tok === this.token && this.paso === p;
    for (let l of lista || []) {
      if (!vivo()) return false;
      if (Array.isArray(l)) l = { n: l[0], t: l[1], f: l[2] };
      if (l.entonces || l.sino) { const c = l.si ? l.si(memoria, API) : true; const ok = await this.correr(c ? l.entonces : l.sino, p, true); if (!ok) return false; continue; }
      if (l.si && !l.si(memoria, API)) continue;
      if (l.cinematica !== undefined) cinematica(l.cinematica);
      if (l.rec) this.escribir(l.rec);
      if (l.npc && l.a) { const pr = caminarA(l.npc, l.a, l.vel || 1.3); if (l.esperar) await Promise.race([pr, this.esperar(l.max || 12)]); }
      if (l.npc && l.mira !== undefined) mirarA(l.npc, l.mira);
      if (l.npc && l.gesto) gesto(l.npc, l.gesto, l.dur);
      if (l.gesto && !l.npc) gesto(l.gesto[0], l.gesto[1], l.gesto[2] ?? l.dur);
      if (l.mira && !l.npc) mirarA(l.mira[0], l.mira[1]);
      if (l.f && !l.n) await l.f(API, memoria);
      if (l.espera) await this.esperar(l.espera);
      if (l.evento) await this.esperarEvento(l.evento, l.max || 6);
      if (!vivo()) return false;
      if (l.n) {
        const txt = typeof l.t === 'function' ? l.t(memoria, API) : l.t;
        const pr = this.decir(l.n, txt);
        if (l.f) l.f(API, memoria);
        await pr;
        if (!vivo()) return false;
        ui.subtitulo(null); this.hablante = null;
        if (l.pausa) await this.esperar(l.pausa);
      }
    }
    if (!vivo()) return false;
    if (!anidado) { ui.subtitulo(null); this.hablante = null; G.enDialogo = false; callar(); }
    return true;
  },
  saltar() {
    if (this.elec) { if (this.elec.t > .5 && this.elec.sel >= 0) this.confirmarEleccion(); return; }
    if (this.linea && this.linea.t > .35 && !this.paso?.libre) { callar(); this.cortarLinea(); return; }
    if (this.cinta && this.cinta.t > .35) { callar(); this.cinta = null; ui.subtitulo(null); }
  },
  // eventos que emiten otros sistemas: director.evento('escondido'), director.evento('walkie_senal')… (lista en docs/eventos.md)
  eventos: {}, esperas: [],
  evento(nombre, datos) {
    this.eventos[nombre] = { t: G.time, datos };
    if (nombre === 'robotCaido' && this.paso?.t === 'oleada' && this.paso.alCaer) this.paso.alCaer(API, vivos());
    for (const w of [...this.esperas]) if (w.nombre === nombre) { this.esperas.splice(this.esperas.indexOf(w), 1); w.res(datos ?? true); }
    const p = this.paso;
    if (p?.t === 'evento' && p.nombre === nombre && !this.pausa) { quitarUsable('alt-' + nombre); marcar(null); if (p.alAcabar) p.alAcabar(API, memoria, datos); this.avanzar(); }
    if (nombre === 'descubierto' && p?.escondite && !this.pausa) this.fallo('TE HA ENCONTRADO');
  },
  // promesa que se resuelve con el evento (o tras max segundos con null)
  esperarEvento(nombre, max = 0) {
    return new Promise(res => { const w = { nombre, res }; this.esperas.push(w); if (max) setTimeout(() => { const i = this.esperas.indexOf(w); if (i >= 0) { this.esperas.splice(i, 1); res(null); } }, max * 1000); });
  },

  // ---------- elección ----------
  abrirEleccion(p) {
    const ops = p.ops.filter(o => !o.si || o.si(memoria, API));
    G.enDialogo = true; P.bloqueoMov = true;
    if (p.pregunta) { ui.subtitulo(p.quien || 'DAVE', p.pregunta); this.hablante = HABLA[p.quien] || null; hablar(p.quien || 'DAVE', p.pregunta); }
    // ancla: delante de la cabeza, algo por debajo de la mirada
    camera.getWorldPosition(tA); camera.getWorldDirection(tB); tB.y = 0; tB.normalize();
    const yaw0 = Math.atan2(tB.x, tB.z), sep = ops.length > 2 ? .5 : .36, R = 1.45;
    ops.forEach((o, i) => {
      const c = tarjetas[i], a = yaw0 + (i - (ops.length - 1) / 2) * -sep;
      c.mesh.position.set(tA.x + Math.sin(a) * R, tA.y - .32, tA.z + Math.cos(a) * R); c.mesh.lookAt(tA.x, tA.y - .32, tA.z); c.mesh.visible = true; c.set({ i, t: o.txt, sel: false }); c.yaw = a;
    });
    pistaEleccion(true); sfx('objetivo');
    return new Promise(res => { this.elec = { p, ops, sel: -1, t: 0, res }; });
  },
  async confirmarEleccion(idx) {
    const e = this.elec; if (!e) return; if (idx !== undefined) e.sel = idx; if (e.sel < 0 || e.sel >= e.ops.length) return;
    const p = e.p, o = e.ops[e.sel], tok = this.token;
    this.cerrarEleccion(); sfx('btn'); P.bloqueoMov = false; ui.subtitulo(null);
    memoria.elegir(p.id, o.k ?? e.sel);
    // las otras respuestas se olvidan (por si se repite el capítulo) y se escribe la elegida
    for (const q of p.ops) if (q !== o && Array.isArray(q.rec)) for (const r of q.rec) memoria.olvidar(r[0], r[1]);
    this.escribir(o.rec);
    G.enDialogo = true;
    const lineas = [...(o.dave !== false ? [['DAVE', o.dice || o.txt]] : []), ...(o.l || [])];
    const ok = await this.correr(lineas, p);
    if (!ok || tok !== this.token) return;
    if (o.f) await o.f(API, memoria);
    if (o.ir) { if (this.paso === p) this.avanzar(o.ir); return; }
    e.res(true);
  },
  cerrarEleccion() { for (const c of tarjetas) c.mesh.visible = false; pistaEleccion(false); if (this.elec) { this.elec = null; P.bloqueoMov = false; } },

  // ---------- mirar ----------
  objetivoMirada(a) {
    if (typeof a === 'function') return a(API);
    if (typeof a === 'string' && a.startsWith('npc:')) { const n = npcs[a.slice(4)]; if (!n) return null; return tC.copy(n.root.position).setY(n.root.position.y + 1.5); }
    if (typeof a === 'string') { const p = PUNTOS[a]; return tC.set(p[0], 1.2, p[1]); }
    if (Array.isArray(a)) return a.length === 3 ? tC.set(a[0], a[1], a[2]) : tC.set(a[0], 1.2, a[1]);
    return a;
  },
  mirando(a, ang = .22) {
    const q = this.objetivoMirada(a); if (!q) return false;
    camera.getWorldPosition(tA); camera.getWorldDirection(tB); tA.subVectors(q, tA); const d = tA.length(); if (d < .01) return true;
    // cuanto más cerca, más ancho el cono (un cuadro a 1 m se ve aunque no lo centres)
    return tB.dot(tA.divideScalar(d)) > Math.cos(ang + Math.min(.25, .12 / d));
  },

  // ---------- cintas ----------
  ponerCinta(p, alAcabar, reg) {
    const g = mallaCinta(p.id, p.pos);
    usable({ id: 'cinta-' + p.id, pos: g.position, r: p.r || 1.7, alto: .7, label: p.label || 'Escuchar la cinta', mesh: g, on: () => {
      quitarUsable('cinta-' + p.id); g.visible = false; if (!p.opcional) marcar(null); sfx('pickup');
      if (this.opcionales) this.opcionales = this.opcionales.filter(o => o !== reg);
      memoria.recordar('dave', 'grabacion:' + p.id, 2, null, { titulo: p.titulo });
      if (p.titulo) say('CINTA · ' + p.titulo);
      const n = p.quien || 'CINTA';
      for (const l of p.l) this.cola.push(Array.isArray(l) ? { n: l[0] === 'MIKE' ? n : l[0], t: l[1] } : l);
      this.cola.push({ fin: alAcabar });
    } });
  },

  actualizar(dt) {
    for (const a of [...anims]) { a.t += dt; const k = Math.min(1, a.t / a.dur); a.fn(k); if (k >= 1) { anims.splice(anims.indexOf(a), 1); a.res(); } }
    // enemigos humanos que caen y caídos que se quedan en el suelo
    for (const e of [...humanos]) if (e.caido && e.alive) { neutralizar(e); humanos.splice(humanos.indexOf(e), 1); }
    for (const c of caidos) { c.t += dt; if (c.sentado) poseHerido(c.R, G.time); else animRig(c.R, dt, { spd: 0, down: Math.min(1, c.t * 2.2) }); }
    if (this.cap?.actualizar && !this.pausa) this.cap.actualizar(dt, API);
    // línea en pantalla (flujo) y cintas (cuando el flujo calla)
    if (this.linea) { this.linea.t += dt; if (this.linea.t > this.linea.dur) this.cortarLinea(); }
    else if (this.cinta) { this.cinta.t += dt; if (this.cinta.t > this.cinta.dur) { this.cinta = null; ui.subtitulo(null); } }
    else if (this.cola.length && !this.elec && !G.enDialogo) {
      const l = this.cola.shift();
      if (l.fin) { if (l.fin) l.fin(); }
      else { ui.subtitulo(l.n, l.t); hablar(l.n, l.t); sfx('radio'); this.cinta = { l, t: 0, dur: clamp(1.8 + l.t.length * .058, 2.6, 8.5) }; }
    }
    for (const k in cintas) { const g = cintas[k]; if (g.visible) g.userData.led.visible = Math.sin(G.time * 5) > 0; }
    if (this.elec) {
      this.elec.t += dt; camera.getWorldDirection(tB); const yaw = Math.atan2(tB.x, tB.z);
      let best = -1, bd = .3; this.elec.ops.forEach((o, i) => { const d = Math.abs(((tarjetas[i].yaw - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI); if (d < bd) { bd = d; best = i; } });
      if (best >= 0 && best !== this.elec.sel) { if (this.elec.sel >= 0) tarjetas[this.elec.sel].set({ ...tarjetas[this.elec.sel].arg, sel: false }); tarjetas[best].set({ ...tarjetas[best].arg, sel: true }); this.elec.sel = best; sfx('blip'); }
    }
    if (this.pausa || !this.paso) return;
    const p = this.paso; this.t += dt;
    if (marca.visible) { marca.userData.rombo.rotation.y += dt * 2; marca.userData.rombo.position.y = 2.6 + Math.sin(G.time * 2) * .15; }
    if (p.t === 'subir' && marca.visible) marca.position.set(car.g.position.x, 0, car.g.position.z);
    const pf = playerFeet(tA);
    const cerca = (k, r) => { const q = punto(k); return Math.hypot(pf.x - q.x, pf.z - q.z) < r; };
    switch (p.t) {
      case 'ir': if (cerca(p.a, p.r || 2)) this.avanzar(); break;
      case 'subir': if (car.occupied) this.avanzar(); break;
      case 'conducir': if (car.occupied && cerca(p.a, p.r || 6) && Math.abs(car.speed) < (p.parar ? 2 : 99)) { if (p.bajar) exitCar(true); this.avanzar(); } else if (!car.occupied && cerca(p.a, p.r || 6) && p.aPie) this.avanzar(); break;
      case 'oleada': if (this.t > .5 && vivos() === 0) this.avanzar(); break;
      case 'resistir': {
        const quedan = Math.max(0, Math.ceil(p.s - this.t)); ui.objetivo(p.obj + ' · ' + quedan + ' s');
        this.resT -= dt; if (this.resT <= 0 && vivos() < (p.max || 6)) { this.resT = p.cada || 3.5; const [x, z] = p.spawns[Math.floor(Math.random() * p.spawns.length)]; spawn('r7', x, z, { vel: 1.1 }); }
        if (this.t >= p.s) { limpiarEnemigos(); this.avanzar(); } break; }
      case 'sigilo': if (cerca(p.a, p.r || 2)) { deteccion.activa = false; if (!p.mantener) limpiarSigilo(); this.avanzar(); } break;
      case 'esperar': if (this.t >= p.s) this.avanzar(); break;
      case 'evento': if ((p.cond && p.cond(API, memoria)) || (p.max && this.t > p.max)) this.evento(p.nombre, { auto: true }); break;
      case 'mirar': {
        if (this.mirando(p.a, p.ang)) this.mirT += dt; else this.mirT = Math.max(0, this.mirT - dt * 2);
        if (this.mirT >= (p.s ?? .5) || this.t > (p.max || 30)) { marcar(null); this.avanzar(); } break; }
    }
  },

  // morir o ser visto: volver al último punto de control
  morir() { this.reintentar('HAS CAÍDO'); },
  fallo(msg) { this.reintentar(msg); },
  async reintentar(msg) {
    if (this.pausa) return;
    const tok = ++this.token; this.pausa = true; say(msg);
    await fundido(1, 1.2); if (tok !== this.token) return;
    const opc = this.opcionales || [];
    this.limpiar(false);
    const cp = this.cp;
    P.inv = [...cp.inv]; P.w = cp.w; P.hp = 100; P.dead = 0; for (const k of P.inv) if (WEAPONS[k]?.mag) P.ammo[k] = WEAPONS[k].mag;
    if (cp.pasoIdx === 0) { ocultarTodos(); this.opcionales = []; await this.prepararCap(); }
    else { const p = PUNTOS[cp.punto]; teleport(p[0], p[1], p[2] || 0); if (cp.rehacer) await cp.rehacer(API); this.opcionales = opc; for (const f of opc) f(); }
    attachWeapon();
    ui.tarjeta(msg, 'Reintentando', null, 2);
    if (tok !== this.token) return;
    fundido(0, 1); this.pausa = false; this.irAPaso(cp.pasoIdx);
  },
  async terminarCap() {
    this.paso = null; marcar(null); ui.objetivo(''); cinematica(false);
    const sig = this.capIdx + 1;
    if (sig < this.capitulos.length) this.iniciarCapitulo(sig);
    else { this.pausa = true; this.guardar(sig); if (this.onFin) this.onFin(); }
  },
  detener() { this.token++; this.pausa = true; this.limpiar(true); },
  objetivoActual() { return ui.obj; }
};

// teclas 1-3 durante una elección (antes de que el jugador las use para cambiar de arma)
if (typeof window !== 'undefined') addEventListener('keydown', e => {
  if (!director.elec) return; const i = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
  if (i !== undefined && i < director.elec.ops.length) { e.stopImmediatePropagation(); e.preventDefault(); director.confirmarEleccion(i); }
}, true);

if (typeof window !== 'undefined') window.__evento = (n, d) => director.evento(n, d);

// ---------- API para los guiones de capítulo ----------
const anims = [];
// animación por tiempo: fn(k) con k de 0 a 1; devuelve una promesa
function animar(dur, fn) { return new Promise(res => anims.push({ t: 0, dur, fn, res })); }
export const API = {
  animar, bloquearCoche: on => { car.bloqueado = on; },
  get P() { return PUNTOS; }, get W() { return W; }, punto,
  npc, ocultar, say, caminar: caminarA, mirarA, gesto,
  get mem() { return memoria; },
  hora: n => aplicarHora(n),
  caos: on => { setCapa('calma', !on); setCapa('caos', on); },
  coche(k, visible = true) { if (!k) { car.g.visible = false; return; } const p = PUNTOS[k]; colocarCoche(p[0], p[1], p[2] || 0); car.g.visible = visible; },
  tp(k) { const p = PUNTOS[k]; teleport(p[0], p[1], p[2] || 0); },
  // da un arma si existe en WEAPONS (la pistola la añade otro agente): devuelve false si aún no existe
  arma: (id, eq = true) => { if (!WEAPONS[id]) { console.info('[historia] arma aún no disponible:', id); return false; } darArma(id, eq); return true; },
  tieneArma: id => !!WEAPONS[id],
  // ganchos de otros sistemas (opcionales: si nadie los implementa, no hacen nada)
  //   clima('lluvia'|'despejado'|'viento', intensidad 0..1) · pulsoRey({ ola, origen }) — los implementa el mundo en W.clima / W.pulsoRey (o G.*)
  clima: (tipo, i = 1, dur) => { try { (W.clima || G.clima || window.__clima)?.(tipo, i, dur); } catch (e) { console.warn('[historia] clima', e); } },
  pulsoRey: (o = {}) => { try { (W.pulsoRey || G.pulsoRey || window.__pulsoRey)?.(o); } catch (e) { console.warn('[historia] pulsoRey', e); } },
  evento: (n, d) => director.evento(n, d),
  esperarEvento: (n, max) => director.esperarEvento(n, max),
  tele(t) { W.tele?.set(t ? { t, bg: '#101826' } : {}); },
  pantallas(lineas, alerta = false) { for (const s of W.pantallas) s.set({ l: lineas, alerta }); },
  barreraLab(abierta) { if (!W.barreraLab) return; W.barreraLab.m.visible = !abierta; W.barreraLab.c.top = abierta ? 0 : 1.1; },
  robots(lista) { for (const [x, z, o] of lista) spawn('r7', x, z, o || {}); },
  humanos(lista) { for (const [x, z, o] of lista) crearHumano(x, z, o || {}); },
  cinematica,
  // líneas que suenan sin parar el juego (se oyen cuando no hay diálogo): [['SARAH', '…'], …]
  murmurar(lineas) { for (const l of lineas) director.cola.push(Array.isArray(l) ? { n: l[0], t: l[1] } : l); },
  quitarUsable,
  esperar: s => new Promise(r => setTimeout(r, s * 1000)),
  levantarse: (k) => { const p = PUNTOS[k]; levantarse(p[0], p[1], p[2] || 0); },
  sfx, fundido, setCapa, aplicarHora,
  get G() { return G; }, get jugador() { return P; }
};
