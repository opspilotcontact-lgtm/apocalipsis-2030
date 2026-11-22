// Conversación libre con los personajes (preparado para IA; HOY no hay red).
//
// Hoy: `responder()` devuelve frases escritas a mano según la ficha, la memoria y palabras clave.
// Mañana: el MISMO `responder()` llamará a un backend. Lo que falta para eso:
//
//   TODO(backend): montar un proxy propio (p. ej. /api/conversar en un servidor pequeño, Worker o función)
//   que guarde la API key del modelo en el SERVIDOR. NUNCA poner una clave en este archivo ni en ningún
//   archivo del cliente: todo lo que se sirve al navegador es público.
//   El cliente enviaría { personaje, prompt: construirPrompt(...), texto } y el proxy devolvería { linea, accion? }.
//   El juego VALIDA cualquier acción que proponga la IA antes de ejecutarla (biblia: «la IA habla y elige;
//   el juego valida cada acción»).
//
// Uso futuro: const t = await conversacion.responder('hank', '¿Estás bien?', { escena: 'tienda tras el ataque' })

import { FICHAS } from './fichas.js';
import { memoria } from './memoria.js';

// ---------- Prompt (lo que recibiría el modelo) ----------
export function construirPrompt(id, contexto = {}) {
  const f = FICHAS[id]; if (!f) return '';
  const rel = memoria.rel(id);
  const recuerdos = memoria.recuerdos(id, 8).map(r => `- ${r.ev.replace(/_/g, ' ')}${r.d ? ' (' + JSON.stringify(r.d) + ')' : ''}`).join('\n') || '- (nada todavía)';
  return [
    `Eres ${f.nombre}. ${f.rol}`,
    f.rasgos ? `Carácter: ${f.rasgos.join(', ')}.` : '',
    f.voz?.estilo ? `Cómo hablas: ${f.voz.estilo}${f.voz.muletillas ? ' Muletillas: ' + f.voz.muletillas.join(' / ') : ''}` : '',
    f.miedos ? `Miedos: ${f.miedos.join(', ')}.` : '', f.metas ? `Quieres: ${f.metas.join(', ')}.` : '',
    f.familia ? `Familia: ${f.familia}` : '', f.relacionDave ? `Con Dave: ${f.relacionDave}` : '',
    f.secretos ? `Secretos (NO los reveles salvo que la escena lo pida explícitamente): ${f.secretos.join(' ')}` : '',
    `Lo que sientes ahora por Dave: ${memoria.describir(id)} (confianza ${rel.confianza.toFixed(2)}, miedo ${rel.miedo.toFixed(2)}, afecto ${rel.afecto.toFixed(2)}).`,
    `Lo que recuerdas de esta noche:\n${recuerdos}`,
    contexto.escena ? `Escena actual: ${contexto.escena}` : '',
    'Responde en español de España, en una o dos frases cortas, como en una película: nada de listas ni explicaciones. Año 2030, la noche en que los robots se rebelan.'
  ].filter(Boolean).join('\n');
}

// ---------- Respuestas enlatadas (hoy) ----------
const CLAVES = [
  [/familia|marta|leo|hijo|mujer/i, { hank: ['Marta no me coge el teléfono. Seguro que es la cobertura. Seguro.', 'Leo tiene doce años y ya dispara mejor que yo. Al menos eso me digo.'], sarah: ['Lucía está bien. Asustada, pero bien. Como yo.'] }],
  [/mike|hermano/i, { sarah: ['Tu hermano siempre quiso más. Y tú siempre le sujetabas la escalera.'], hank: ['¿Mike? Me compraba baterías de litio por cajas. Pagaba en efectivo. Yo no preguntaba.'], john: ['Tu hermano hizo algo muy gordo, Dave. Lo siento. Pero hay que moverse.'] }],
  [/placa|ruiz|militar|quién eres/i, { john: ['¿Importa? Esta noche lo único que importa es si sabes disparar.', 'Era de un compañero. Ya no la necesita.'] }],
  [/miedo|asustad/i, { hank: ['¿Miedo? Yo no. Bueno, un poco. Bastante. ¿Se nota?'], john: ['El miedo es información. Úsalo.'], sarah: ['Claro que tengo miedo, Dave. Por eso no te pido que no vayas. Te pido que vuelvas.'] }],
  [/gracias/i, { hank: ['¿Gracias a mí? Tú me salvaste con una piedra. Estamos en paz. Bueno, casi.'], john: ['No me des las gracias. Aún no ha terminado.'], sarah: ['Dámelas cuando estés en casa.'] }]
];
const GENERICAS = {
  hank: ['Bueno… vale. Sí. Lo que tú digas.', 'Perdona, hablo mucho cuando estoy nervioso. O sea, siempre.'],
  john: ['Ocupado.', '¿Tú crees?', 'Luego. Ahora no.'],
  sarah: ['Dave. Mírame. ¿Estás bien de verdad?', 'Ya.'],
  mike: ['Hermanito… dos minutos. Te lo prometo.'],
  varela: ['Aquí no hay papeleo, chaval.'],
  elrey: ['Estoy terminando lo que empezaste.']
};
const azar = a => a[Math.floor(Math.random() * a.length)];

export const conversacion = {
  backend: null, // TODO(backend): { url: '/api/conversar' } cuando exista el proxy. Sin claves aquí.
  construirPrompt,
  // devuelve una promesa con la línea del personaje (la interfaz no cambia cuando haya IA)
  async responder(id, textoJugador, contexto = {}) {
    const prompt = construirPrompt(id, contexto);
    if (this.backend) {
      // TODO(backend): descomentar cuando exista el proxy propio.
      // const r = await fetch(this.backend.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personaje: id, prompt, texto: textoJugador }) });
      // const { linea } = await r.json(); return linea;
    }
    for (const [re, por] of CLAVES) if (re.test(textoJugador) && por[id]) return azar(por[id]);
    // matiz por relación: si desconfía o tiene miedo, se le nota
    const rel = memoria.rel(id);
    if (rel.confianza < -.4) return id === 'john' ? 'No tengo por qué contarte nada.' : 'Déjalo, Dave.';
    if (rel.miedo > .6 && id === 'hank') return 'Vale, vale. No me grites. ¿Te estaba gritando yo? Perdón.';
    void prompt;
    return azar(GENERICAS[id] || ['…']);
  }
};
if (typeof window !== 'undefined') window.__conv = conversacion;
