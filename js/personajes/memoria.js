// Memoria de los personajes: qué recuerdan de lo que ha hecho Dave y cómo se sienten con él.
// Persistente (localStorage) e IDEMPOTENTE: cada recuerdo se guarda por clave «personaje:evento»,
// así que repetir un capítulo o reintentar desde un punto de control no suma dos veces.
// La relación (confianza, miedo, afecto, de -1 a 1) se calcula sumando los efectos de los recuerdos.
//
//   memoria.recordar('hank', 'salvado', 1, { confianza: .4, afecto: .3 }, { arma: 'piedra' })
//   memoria.recuerda('sarah', 'se_fue_sin_despedirse')   → true / false
//   memoria.dato('hank', 'salvado')?.arma                  → 'piedra'
//   memoria.confianza('hank') > .5
//   memoria.elegir('c3.saqueadores', 'amenazar') · memoria.eleccion('c3.saqueadores')
//   memoria.marcar('saqueadores_armados') · memoria.flag('saqueadores_armados')

const CLAVE = 'apoc2030.memoria.v1';
const EJES = ['confianza', 'miedo', 'afecto'];
const clamp1 = v => Math.max(-1, Math.min(1, v));

function vacio() { return { v: 1, eventos: {}, base: {}, elecciones: {}, flags: {}, n: 0 }; }
let E = cargar();

function cargar() {
  try { const s = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (s && s.v === 1) return { ...vacio(), ...s }; } catch (e) {}
  return vacio();
}
let pendiente = 0;
function guardar() {
  // agrupa escrituras: varias en el mismo fotograma se guardan una sola vez
  if (pendiente) return; pendiente = 1;
  queueMicrotask(() => { pendiente = 0; try { localStorage.setItem(CLAVE, JSON.stringify(E)); } catch (e) {} });
}
const k = (p, ev) => p + ':' + ev;
const oyentes = new Set();
const avisar = (tipo, d) => { for (const f of oyentes) try { f(tipo, d); } catch (e) {} };

export const memoria = {
  // ---------- escribir ----------
  // peso: 0..3 (cuánto le marcó; se usa para ordenar recuerdos en las conversaciones)
  // efectos: { confianza, miedo, afecto } en -1..1 · datos: cualquier objeto pequeño (arma usada, capítulo…)
  recordar(p, ev, peso = 1, efectos = null, datos = null) {
    const prev = E.eventos[k(p, ev)];
    E.eventos[k(p, ev)] = { p, ev, peso, ef: efectos || prev?.ef || null, d: datos ?? prev?.d ?? null, n: prev?.n ?? ++E.n, t: Date.now() };
    guardar(); avisar('recordar', { p, ev }); return this;
  },
  olvidar(p, ev) { if (E.eventos[k(p, ev)]) { delete E.eventos[k(p, ev)]; guardar(); } return this; },
  // relación de partida de cada personaje (la ponen las fichas: Hank empieza con miedo, John con confianza baja…)
  base(p, rel) { E.base[p] = { ...(E.base[p] || {}), ...rel }; guardar(); return this; },
  elegir(id, valor) { E.elecciones[id] = valor; guardar(); avisar('elegir', { id, valor }); return this; },
  marcar(flag, valor = true) { E.flags[flag] = valor; guardar(); return this; },

  // ---------- leer ----------
  recuerda(p, ev) { return !!E.eventos[k(p, ev)]; },
  dato(p, ev) { return E.eventos[k(p, ev)]?.d ?? null; },
  peso(p, ev) { return E.eventos[k(p, ev)]?.peso ?? 0; },
  eleccion(id) { return E.elecciones[id] ?? null; },
  flag(f) { return E.flags[f] ?? null; },
  rel(p) {
    const r = { confianza: 0, miedo: 0, afecto: 0, ...(E.base[p] || {}) };
    for (const e of Object.values(E.eventos)) if (e.p === p && e.ef) for (const a of EJES) if (e.ef[a]) r[a] += e.ef[a];
    for (const a of EJES) r[a] = clamp1(r[a]);
    return r;
  },
  confianza(p) { return this.rel(p).confianza; },
  miedo(p) { return this.rel(p).miedo; },
  afecto(p) { return this.rel(p).afecto; },
  // recuerdos de un personaje, los más importantes y recientes primero (para el diálogo y el prompt de IA)
  recuerdos(p, n = 8) { return Object.values(E.eventos).filter(e => e.p === p).sort((a, b) => b.peso - a.peso || b.n - a.n).slice(0, n); },
  grabaciones() { return Object.values(E.eventos).filter(e => e.p === 'dave' && e.ev.startsWith('grabacion:')).map(e => e.ev.slice(10)); },
  // describe la relación en palabras (para subtítulos de depuración o el prompt)
  describir(p) {
    const r = this.rel(p), w = (v, pos, neg) => v > .45 ? 'mucha ' + pos : v > .15 ? pos : v < -.45 ? 'mucha ' + neg : v < -.15 ? neg : null;
    return [w(r.confianza, 'confianza', 'desconfianza'), w(r.afecto, 'cariño', 'frialdad'), r.miedo > .45 ? 'mucho miedo' : r.miedo > .15 ? 'algo de miedo' : null].filter(Boolean).join(', ') || 'neutral';
  },

  // ---------- utilidades ----------
  alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
  volcar() { return JSON.parse(JSON.stringify(E)); },
  reiniciar() { E = vacio(); try { localStorage.removeItem(CLAVE); } catch (e) {} avisar('reiniciar', {}); return this; }
};
// para depurar desde la consola: __mem.rel('hank'), __mem.volcar(), __mem.reiniciar()
if (typeof window !== 'undefined') window.__mem = memoria;
