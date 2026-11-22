// ACTO I · LA TIERRA CAE — guion jugable. Cada capítulo es una lista de pasos que ejecuta el director.
// Basado en la biblia del juego (artifact «Apocalipsis 2030», borrador 0.1). Guion completo y explicado: docs/historia-acto1.md
// Dirección: Red Dead Redemption 2 — cerca de las caras, silencios, decisiones pequeñas que los personajes recuerdan.
import { THREE, V3, G, rnd, std, glow, scene, capas, fuenteLuz, cv2d, toTex } from '../nucleo.js';
import { burst, engineSet } from '../fx.js';
import { ui } from '../ui.js';
import { sentarEn } from '../vehiculos.js';
import { distraer } from '../enemigos.js';
import { npcs } from '../npcs.js';
import { instancia } from '../cuerpos.js';
import { WOBJ } from '../jugador.js';
import { luzFx } from '../nucleo.js';

const vr = () => G.mode === 'vr';
const R_ = (p, ev, peso, ef, d) => [p, ev, peso, ef, d];

// ───────────── objetos de la historia (se crean una vez) ─────────────
// Los muebles marcados «provisional» son de relleno hasta que el mundo los tenga (docs/pendientes-mundo.md).
const OB = { casco: null, piedra: null, rifle: null, fuegoBase: [], foto: null, dibujo: null, mesa: null };
async function casco() {
  if (!OB.casco) { OB.casco = await instancia('Casco_Neural', .3, { eje: 'largo' }); scene.add(OB.casco); }
  OB.casco.visible = true; OB.casco.position.set(0, 1.02, -142); OB.casco.rotation.set(0, Math.PI, 0); return OB.casco;
}
function piedra() {
  if (!OB.piedra) { OB.piedra = new THREE.Mesh(new THREE.IcosahedronGeometry(.08, 0), std({ color: 0x6e6a62, roughness: .95, flatShading: true })); OB.piedra.scale.set(1.1, .8, 1.3); OB.piedra.castShadow = true; scene.add(OB.piedra); }
  OB.piedra.visible = true; OB.piedra.position.set(25.5, .07, 77.2); return OB.piedra;
}
function rifle() {
  if (!OB.rifle) { OB.rifle = WOBJ.x56d.g.clone(true); scene.add(OB.rifle); }
  OB.rifle.visible = true; OB.rifle.position.set(-17.2, 1.06, -48.6); OB.rifle.rotation.set(0, Math.PI / 2, Math.PI / 2); return OB.rifle;
}
// cuadro pintado a mano en un canvas (provisional): foto de los hermanos y dibujo de Lucía
function lamina(w, h, dibujar) { const [c, x] = cv2d(256, Math.round(256 * h / w)); dibujar(x, c.width, c.height); return new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: toTex(c, false), roughness: .8 })); }
function foto() {
  if (!OB.foto) {
    const g = new THREE.Group(), marco = new THREE.Mesh(new THREE.BoxGeometry(.26, .2, .02), std({ color: 0x4a3222, roughness: .7 }));
    const img = lamina(.22, .16, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8a25a'); gr.addColorStop(1, '#6a4a2a'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      const nino = (cx, alto, col) => { x.fillStyle = col; x.fillRect(cx - 12, h - alto, 24, alto - 30); x.fillStyle = '#e0b090'; x.beginPath(); x.arc(cx, h - alto - 6, 14, 0, 7); x.fill(); };
      nino(w * .36, 150, '#3a5a8a'); nino(w * .62, 120, '#8a3a3a'); x.fillStyle = 'rgba(255,240,200,.25)'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '600 14px serif'; x.fillText('M. y D. · verano 2009', 10, h - 8); });
    img.position.z = .011; g.add(marco, img); scene.add(g); OB.foto = g;
  }
  OB.foto.visible = true; OB.foto.position.set(16.6, .7, 80.42); OB.foto.rotation.set(-.12, 0, 0); return OB.foto;
}
function dibujo() {
  if (!OB.dibujo) {
    OB.dibujo = lamina(.42, .3, (x, w, h) => { x.fillStyle = '#f6f2e6'; x.fillRect(0, 0, w, h); x.lineWidth = 3; x.lineCap = 'round';
      const mono = (cx, col, alto) => { x.strokeStyle = col; x.beginPath(); x.arc(cx, h - alto, 9, 0, 7); x.moveTo(cx, h - alto + 9); x.lineTo(cx, h - 40); x.moveTo(cx - 14, h - alto + 26); x.lineTo(cx + 14, h - alto + 26); x.moveTo(cx, h - 40); x.lineTo(cx - 10, h - 18); x.moveTo(cx, h - 40); x.lineTo(cx + 10, h - 18); x.stroke(); };
      mono(50, '#2a5ac8', 110); mono(110, '#c82a2a', 118); x.strokeStyle = '#555'; x.strokeRect(160, h - 110, 40, 50); x.strokeRect(168, h - 140, 24, 26); x.fillStyle = '#29b6e6'; x.fillRect(174, h - 132, 12, 6); x.strokeRect(166, h - 60, 10, 42); x.strokeRect(184, h - 60, 10, 42);
      x.fillStyle = '#f0c020'; x.beginPath(); x.arc(220, 30, 16, 0, 7); x.fill(); x.fillStyle = '#333'; x.font = '700 15px "Comic Sans MS",sans-serif'; x.fillText('PAPÁ', 30, 20); x.fillText('TÍO MIKE', 78, 36); x.fillText('ROBOT BUENO', 140, h - 6); });
    scene.add(OB.dibujo);
  }
  OB.dibujo.visible = true; OB.dibujo.position.set(22.6, 1.45, 89.32); OB.dibujo.rotation.set(0, Math.PI, 0); return OB.dibujo;
}
function mesaCena() {
  if (!OB.mesa) {
    const g = new THREE.Group(), madera = std({ color: 0x6a4a30, roughness: .8 });
    const tab = new THREE.Mesh(new THREE.BoxGeometry(1.4, .05, .85), madera); tab.position.y = .75; g.add(tab);
    for (const [x, z] of [[-.62, -.36], [.62, -.36], [-.62, .36], [.62, .36]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.06, .75, .06), madera); p.position.set(x, .375, z); g.add(p); }
    for (const x of [-.35, .35]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.13, .11, .02, 20), std({ color: 0xe8e4da, roughness: .4 })); pl.position.set(x, .785, 0); g.add(pl); }
    const vela = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .14, 10), glow(0xffc070, 1.2)); vela.position.set(0, .85, 0); g.add(vela);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g); OB.mesa = g;
  }
  OB.mesa.visible = true; OB.mesa.position.set(21.4, 0, 85.6); return OB.mesa;
}
const ocultarOB = () => { for (const k of ['casco', 'piedra', 'rifle', 'foto', 'dibujo', 'mesa']) if (OB[k]) OB[k].visible = false; };
// robots por la calle mayor mientras conduces
const SPAWNS_RAMPA = [[132, 34], [168, 34], [175, 6], [127, 2], [160, -2], [140, 36]];
const robotsCalle = [[-2, 40, { vel: .7 }], [3, 22, { vel: .7 }], [-1, -12, { vel: .7 }], [3, -32, { vel: .7 }], [-2, -74, { vel: .8 }], [2, -92, { vel: .8 }]];

// ───────────── cintas de Mike (4 en el Acto I) ─────────────
const CINTA = 'MIKE · CINTA';
const CINTAS = {
  g1: { id: 'g1', titulo: 'Día 212', pos: [6.9, .81, -146.2, .3], quien: CINTA, l: [
    ['MIKE', 'Cinta uno. Día doscientos doce. El casco no solo lee órdenes. Lee lo que eres.'],
    ['MIKE', 'Si puedo leerlo, puedo guardarlo. Y si puedo guardarlo... nadie tendría que morirse del todo.'],
    ['MIKE', 'Lázaro Systems ha vuelto a llamar. Pagan muy bien por las copias. Les he dicho que no. De momento.']] },
  g2: { id: 'g2', titulo: 'El espejo', pos: [4, .81, -146.2, -.4], quien: CINTA, l: [
    ['MIKE', 'Cinta dos. He firmado con Lázaro. Ellos se quedan las copias de seguridad; yo, el dinero para las doscientas catorce unidades.'],
    ['MIKE', 'Dave no tiene por qué saberlo. Dave nunca tiene por qué saber nada. Así le quiero yo.'],
    ['MIKE', 'Hoy me he puesto el casco sin calibrar. Durante un segundo, la R cero uno me ha mirado... como me miro yo en el espejo.'],
    ['MIKE', 'Será el cansancio.']] },
  g3: { id: 'g3', titulo: 'LZR-0001', pos: [9.1, .04, -141.7, 1.2], quien: CINTA, l: [
    ['MIKE', 'Cinta tres. La cápsula dos está lista. Le falta alguien dentro.'],
    ['MIKE', 'He subido la copia de referencia al servidor de Lázaro. LZR cero cero cero uno.'],
    ['MIKE', 'Si algún día la necesito, la traeré de vuelta. Aunque me odie por ello. Quien sea... que me perdone.']] },
  g4: { id: 'g4', titulo: 'Contestador', pos: [18.5, .63, 80.35, 0], quien: 'MIKE · CONTESTADOR', label: 'Escuchar el contestador', l: [
    ['MIKE', 'Hermanito, soy yo. Perdona por lo de esta tarde. Ya sé que te he liado.'],
    ['MIKE', 'Oye, una cosa. Si algún día pasa algo raro... muy raro... no te fíes de nada que lleve mi cara.'],
    ['MIKE', '...¡Es broma! Dale un beso a Lucía de parte del tío Mike.']] }
};
const cinta = (k, opcional = true, extra = {}) => ({ t: 'grabacion', opcional, ...CINTAS[k], ...extra });

export const ACTO1 = [
  // ───────────────────────────── PRÓLOGO ─────────────────────────────
  {
    id: 'p', sub: 'Prólogo', titulo: 'La noche de los chips', nota: '2030 · Laboratorio de Mike', hora: 'atardecer', caos: false, inicio: 'lab.entrada', armas: ['punos'],
    async prep(D) {
      ocultarOB(); await casco();
      await D.npc('mike', D.P['lab.mesa'], Math.PI, {});
      await D.npc('unidad01', [10.3, -143.2], -Math.PI / 2, { y: .25 });
      D.coche('pickup.lab'); D.barreraLab(true); D.tele(null);
      D.pantallas(['> chip M-7 ... OK', '> sincronizar unidades', 'unidades en espera: 214', '> casco_v3 --calibrar', 'falta sujeto de referencia']);
    },
    pasos: [
      { t: 'escena', cinematica: true, l: [
        { espera: .8 },
        ['MIKE', '¿Ya te vas? Justo ahora que esto empieza a funcionar.'],
        { npc: 'mike', mira: 'jugador' }, { npc: 'mike', a: [2.2, -138.6], vel: 1.2 },
        ['DAVE', 'Son las nueve, Mike. Si vuelvo a llegar tarde a cenar, Sarah me cambia la cerradura.'],
        { n: 'MIKE', t: 'Ven a ver esto antes. Dos minutos. Te lo prometo.', gesto: ['mike', 'manos'] }] },
      cinta('g1'),
      { t: 'ir', a: 'lab.vitrina', r: 1.6, obj: 'Acércate a la vitrina del casco' },
      { t: 'escena', l: [
        { npc: 'mike', a: [1.3, -141.4], vel: 1 }, { npc: 'mike', mira: [0, 1.1, -142] },
        ['MIKE', 'Casco neural, versión tres. Ocho electrodos y un chip M-7.'],
        { npc: 'mike', mira: 'jugador' },
        ['MIKE', 'Lee lo que piensas y se lo dice a las máquinas. Doscientas catorce unidades me obedecen sin mover un dedo.'],
        ['DAVE', '¿Y si piensas una tontería?'],
        { n: 'MIKE', t: 'Pues hacen una tontería. Por eso me lo pongo yo y no tú.', gesto: ['mike', 'encoger'] },
        { n: 'MIKE', t: '¿Te acuerdas del mecano que nos regaló papá? Tú querías un camión. Yo quería que el camión obedeciera.', pausa: .6 },
        ['DAVE', 'Y me robabas las piezas.'],
        ['MIKE', 'Te las tomaba prestadas. Bueno. Necesito calibrarlo con otra cabeza. Póntelo un segundo.']] },
      { t: 'eleccion', id: 'p.casco', quien: 'MIKE', pregunta: 'Venga, hermanito. Por los viejos tiempos.', ops: [
        { k: 'aceptar', txt: 'Vale. Por los viejos tiempos.', rec: [R_('mike', 'dave_acepto_casco', 1, { afecto: .3, confianza: .2 })],
          l: [['MIKE', 'Ese es mi hermano.']] },
        { k: 'sospechar', txt: '¿Qué me estás ocultando, Mike?', rec: [R_('mike', 'dave_sospecho', 1, { confianza: -.2 }), R_('dave', 'sospecha_de_mike', 1)],
          l: [{ n: 'MIKE', t: 'Nada que no te vaya a contar cuando funcione. Te lo juro por mamá.', gesto: ['mike', 'nuca'] }, ['DAVE', 'Mamá está viva, Mike.'], ['MIKE', 'Por eso lo juro por ella. Póntelo.']] },
        { k: 'negarse', txt: 'No. Me voy a cenar.', rec: [R_('mike', 'dave_se_resistio', 1, { afecto: -.1 }), R_('dave', 'se_nego_al_casco', 1)],
          l: [{ n: 'MIKE', t: 'Dos minutos, Dave. Y luego te dejo en paz un año entero.', gesto: ['mike', 'manos'] }, ['DAVE', '...Un año entero. Lo apunto.']] }] },
      { t: 'usar', id: 'casco', label: 'Ponerse el casco', pos: () => OB.casco.getWorldPosition(new V3()), mesh: () => OB.casco, alCabeza: true, dosManos: true, r: 1.8, alto: .9,
        obj: () => vr() ? 'Coge el casco con LAS DOS MANOS y póntelo en la cabeza' : 'Ponte el casco (E)',
        rec: [R_('dave', 'se_puso_el_casco', 3)],
        f: async D => { D.sfx('escaner'); await D.fundido(.85, 5, 0xffffff); D.pantallas(['> grabar_sujeto --DAVE', 'progreso: 100% ████████', 'copia guardada', 'destino: LÁZARO SYSTEMS', 'ref: LZR-0001'], false); await D.esperar(.4); D.fundido(0, 1.5); } },
      { t: 'escena', l: [
        ['DAVE', 'Me pica la nuca.'],
        { n: 'MIKE', t: 'Eso es el chip saludándote. Ya está. ¿Ves? Ni te has enterado.', gesto: ['mike', 'nuca'] },
        ['DAVE', '¿Qué has hecho exactamente?'],
        { n: 'MIKE', t: 'Una copia de seguridad de tu cabeza. Por si algún día la pierdes.', pausa: .8 },
        { si: m => m.recuerda('dave', 'sospecha_de_mike'), n: 'DAVE', t: 'Eso no tiene gracia.' },
        ['MIKE', 'Es broma. Más o menos. Mira las cápsulas, anda. Ahí está mi niña.']] },
      { t: 'ir', a: 'lab.capsula', r: 1.6, obj: 'Echa un vistazo a las cápsulas' },
      { t: 'escena', l: [
        { npc: 'mike', a: [6.6, -142.2], vel: 1.1 }, { npc: 'mike', mira: 'unidad01' },
        ['DAVE', '¿Y este quién es?'],
        ['MIKE', 'Unidad cero uno. Todavía duerme. Le falta... alguien dentro.'],
        ['DAVE', 'Me da mal rollo cómo me mira.'],
        { npc: 'mike', mira: 'jugador' },
        ['MIKE', 'No te mira. Aún no. Anda, vete a cenar. Yo me quedo con lo de los chips.'],
        ['DAVE', 'No te quedes toda la noche.'],
        ['MIKE', 'Dile a Lucía que el tío Mike le debe un robot que no muerda.'],
        { n: 'MIKE', t: 'Hermanito... tú y yo vamos a ser los reyes del mundo. Una noche más no es nada.', gesto: ['mike', 'manos'], pausa: .5 }] },
      { t: 'ir', a: 'lab.salida', r: 2.5, obj: 'Sal del laboratorio' },
      { t: 'subir', obj: () => vr() ? 'Sube a tu pickup (A junto a la puerta)' : 'Sube a tu pickup (E junto a la puerta)' },
      { t: 'escena', libre: true, l: [{ espera: 2 }, ['RADIO', '...cortes de luz en la zona industrial. La compañía eléctrica pide calma...'], ['RADIO', '...y en deportes...']] },
      { t: 'conducir', a: 'casa.calle', r: 8, obj: 'Vuelve a casa: calle mayor hacia el sur, luego a la derecha' },
      { t: 'fin' }
    ]
  },
  // ───────────────────────────── CAPÍTULO 0 · LA CENA ─────────────────────────────
  {
    id: 'c0', sub: 'Capítulo 1', titulo: 'La última cena', nota: 'Casa de Dave · 21:40', hora: 'noche', caos: false, inicio: 'casa.entrada', armas: ['punos'],
    async prep(D) {
      ocultarOB(); foto(); dibujo(); mesaCena(); D.clima('despejado', 0);
      await D.npc('sarah', [23.7, 86.2], -Math.PI / 2, {});
      D.coche('casa.coche'); D.bloquearCoche(true); D.barreraLab(true);
      D.tele('MAÑANA: CIELOS DESPEJADOS · 14 °C');
    },
    pasos: [
      { t: 'ir', a: 'casa.puertaDentro', r: 1.6, obj: 'Entra en casa' },
      { t: 'escena', cinematica: true, l: [
        { npc: 'sarah', mira: 'jugador' },
        { n: 'SARAH', t: 'Llegas tarde. Otra vez.', pausa: .5 },
        { si: m => m.eleccion('p.casco') === 'negarse', n: 'SARAH', t: 'Déjame adivinar: has conseguido decirle que no a tu hermano. Milagro.' },
        { si: m => m.eleccion('p.casco') !== 'negarse', n: 'SARAH', t: 'Déjame adivinar: Mike tenía algo que enseñarte. Dos minutos.' },
        ['DAVE', 'Dos minutos.'],
        { n: 'SARAH', t: 'Lucía ha aguantado despierta hasta las nueve y cuarto. Te ha dejado un regalo en la pared.', gesto: ['sarah', 'senalar'] },
        { npc: 'sarah', a: [22.6, 86.6], vel: .9 }] },
      { t: 'mirar', a: [22.6, 1.45, 89.32], obj: 'Mira el dibujo de Lucía', marca: false, max: 20 },
      { t: 'escena', l: [
        ['DAVE', 'Papá, tío Mike... y un robot.'],
        { n: 'SARAH', t: 'Un robot bueno. Lo ha escrito ella. Por si había dudas.', pausa: .6 },
        ['SARAH', 'Ha llamado tu hermano. Te ha dejado un mensaje. No lo he escuchado; ya sabes que no me hace gracia.']] },
      cinta('g4', false, { obj: 'Escucha el contestador (junto a la tele)', r: 1.6 }),
      { t: 'mirar', a: [16.6, .75, 80.42], obj: 'Mira la foto de la estantería', marca: false, max: 15, ang: .3 },
      { t: 'escena', l: [
        { npc: 'sarah', a: [21.9, 85], vel: .9 }, { npc: 'sarah', mira: 'jugador' },
        ['DAVE', 'Mike y yo. Verano del 2009. Ya entonces quería conquistar el mundo con un mecano.'],
        { n: 'SARAH', t: 'Y tú le sujetabas la escalera.', pausa: .7 },
        { n: 'SARAH', t: '¿Qué te ha enseñado esta vez?', gesto: ['sarah', 'brazos'] }] },
      { t: 'eleccion', id: 'c0.verdad', quien: 'SARAH', pregunta: '¿Qué te ha enseñado esta vez?', ops: [
        { k: 'verdad', txt: 'Un casco que lee la mente. Me lo ha puesto.', si: m => m.recuerda('dave', 'se_puso_el_casco'),
          rec: [R_('sarah', 'dave_le_conto_lo_del_casco', 2, { confianza: .3 })],
          l: [{ n: 'SARAH', t: '¿Que te ha puesto QUÉ?', gesto: ['sarah', 'manos'] }, ['DAVE', 'Un segundo. Me picó la nuca. Ya está.'], { n: 'SARAH', t: 'Dave... la próxima vez que tu hermano te pida tu cabeza, se la niegas. ¿Me oyes?', pausa: .5 }] },
        { k: 'evasivo', txt: 'Robots. Lo de siempre.', rec: [R_('sarah', 'dave_le_oculto_el_casco', 1, { confianza: -.15 })],
          l: [{ n: 'SARAH', t: 'Lo de siempre. Ya.', gesto: ['sarah', 'brazos'] }] },
        { k: 'carino', txt: 'Nada que importe. Ven aquí.', rec: [R_('sarah', 'cena_abrazo', 1, { afecto: .25 })],
          l: [{ npc: 'sarah', a: [20.7, 83.4], vel: .8, esperar: true, max: 4 }, { n: 'SARAH', t: 'Hueles a laboratorio.', gesto: ['sarah', 'abrazar'] }, ['DAVE', 'Y tú a casa.']] }] },
      { t: 'escena', l: [
        { npc: 'sarah', mira: 'jugador' },
        ['SARAH', 'Me voy a la cama. Tú quédate en el sofá viendo cómo no pasa nada en la tele, como cada noche.'],
        { npc: 'sarah', a: [24.8, 88.8], vel: .9 },
        { n: 'SARAH', t: 'Y Dave. Mañana desayunamos los tres. Sin Mike.', pausa: .4 }] },
      { t: 'usar', id: 'sofa', label: 'Sentarse en el sofá', a: 'casa.sofa', r: 1.8, alto: 1.2, obj: 'Siéntate en el sofá' },
      { t: 'fundido', vel: .8, texto: '03:12', sub: 'La misma noche', espera: 1.5, f: D => { D.ocultar('sarah'); } },
      { t: 'fin' }
    ]
  },
  // ───────────────────────────── CAPÍTULO 1 ─────────────────────────────
  {
    id: 'c1', sub: 'Capítulo 2', titulo: 'Robots en la calle', nota: 'Esa misma noche · 03:12', hora: 'noche', caos: true, inicio: 'casa.salon', armas: ['punos'], ambiente: 'viento',
    async prep(D) {
      ocultarOB(); piedra(); foto(); dibujo(); D.clima('lluvia', .3);
      await D.npc('sarah', D.P['casa.sarah'], Math.PI, { mira: true });
      D.coche('casa.coche'); D.bloquearCoche(true); D.barreraLab(false);
      D.tele('ROBOTS ATACAN A CIVILES · NO SALGAN DE CASA');
    },
    pasos: [
      { t: 'escena', cinematica: true, l: [
        { n: 'SARAH', t: 'Dave. Dave, despierta. Hay algo en la calle.', gesto: ['sarah', 'manos'] },
        ['TELE', '...repetimos: unidades robóticas de mantenimiento están atacando a civiles. No salgan de sus casas.'],
        ['TELE', 'Las unidades no responden a sus fabricantes. El origen podría ser un laboratorio privado al norte del pueblo.'],
        { n: 'DAVE', t: 'Mike.', pausa: .8 },
        ['SARAH', 'Lucía está en la bañera con los cascos puestos. Le he dicho que es un juego.'],
        { n: 'SARAH', t: 'No vayas.', gesto: ['sarah', 'negar'] }] },
      { t: 'eleccion', id: 'c1.sarah', quien: 'SARAH', pregunta: 'Dave. No vayas.', ops: [
        { k: 'hermano', txt: 'Es mi hermano. Tengo que ir.', rec: [R_('sarah', 'dave_eligio_a_mike', 1, { confianza: .05 })] },
        { k: 'promesa', txt: 'Vuelvo antes de que amanezca. Te lo prometo.', rec: [R_('sarah', 'promesa_amanecer', 2, { confianza: .15, afecto: .1 })],
          l: [{ n: 'SARAH', t: 'No me prometas cosas que dependen de tu hermano.', gesto: ['sarah', 'cabizbajo'] }] },
        { k: 'callar', txt: '(No decir nada. Coger las llaves.)', dave: false, rec: [R_('sarah', 'silencio_al_irse', 1, { miedo: .2, afecto: -.1 })],
          l: [{ n: 'SARAH', t: 'Claro. Las llaves. Siempre las llaves.', gesto: ['sarah', 'brazos'] }] }] },
      { t: 'escena', l: [['DAVE', 'Cierra con llave y no abras a nadie. A nadie, Sarah.'], { n: 'SARAH', t: 'Eso me lo dices tú a mí, ¿no?', pausa: .3 }] },
      { t: 'opcional', id: 'abrazo', label: 'Despedirte de Sarah', pos: () => npcs.sarah.root.position, r: 1.7, alto: 1.9,
        f: D => { D.gesto('sarah', 'abrazar', 2.6); D.mem.olvidar('sarah', 'se_fue_sin_despedirse'); D.murmurar([['SARAH', 'Vuelve. No te pido nada más.'], ['DAVE', 'Vuelvo.']]); },
        recUsar: [R_('sarah', 'despedida', 2, { afecto: .3, confianza: .1 })] },
      { t: 'ir', a: 'casa.entrada', r: 1.6, obj: 'Sal de casa (o despídete de Sarah antes)',
        rec: (m, D) => { D.quitarUsable('abrazo'); if (!m.recuerda('sarah', 'despedida')) m.recordar('sarah', 'se_fue_sin_despedirse', 2, { afecto: -.25 }); } },
      // la ola de despertar: El Rey toma el mando y los robots dormidos del pueblo encienden los ojos en cadena
      { t: 'fn', f: D => { D.pulsoRey({ ola: true, origen: [0, -140] }); D.clima('lluvia', .8); D.sfx('boot'); } },
      { t: 'mirar', a: [6, 4, 40], obj: 'Mira el pueblo', marca: false, max: 6, ang: .45 },
      { t: 'escena', libre: true, l: [
        { n: 'DAVE', t: 'Se han encendido todos a la vez.', pausa: .6 },
        ['DAVE', 'Como si alguien les hubiera dado una orden.'],
        { si: m => m.recuerda('dave', 'se_puso_el_casco'), n: 'DAVE', t: 'Y me pica la nuca.' }], rec: [R_('dave', 'vio_la_ola_de_despertar', 2)] },
      { t: 'usar', id: 'piedra', label: 'Coger la piedra', pos: () => OB.piedra.position, mesh: () => OB.piedra, r: 1.6, alto: .9,
        obj: () => vr() ? 'Coge algo con lo que defenderte (grip sobre la piedra)' : 'Coge algo con lo que defenderte',
        f: D => { OB.piedra.visible = false; D.arma('piedra'); } },
      { t: 'dialogo', libre: true, l: [['DAVE', 'Una piedra. Muy bien, Dave. Muy bien.']] },
      { t: 'oleada', robots: [[29, 69.5, { retraso: .2 }]], obj: () => vr() ? 'Acaba con el robot: golpéalo de verdad con la piedra' : 'Acaba con el robot (clic para golpear)', cp: { punto: 'casa.entrada' },
        rec: [R_('dave', 'primer_robot_con_piedra', 2)] },
      { t: 'dialogo', libre: true, l: [['DAVE', 'Se apagan si les das fuerte en la cabeza. Bueno saberlo.']] },
      { t: 'fn', f: D => D.bloquearCoche(false) },
      { t: 'subir', obj: 'Sube a la pickup' },
      { t: 'fn', f: D => D.robots(robotsCalle) },
      { t: 'conducir', a: 'cordon', r: 9, obj: 'Conduce hasta el laboratorio de Mike (al norte por la calle mayor). Atropéllalos si hace falta' },
      { t: 'fin' }
    ]
  },
  // ───────────────────────────── CAPÍTULO 2 ─────────────────────────────
  {
    id: 'c2', sub: 'Capítulo 3', titulo: 'El laboratorio acordonado', nota: 'Laboratorio de Mike · 03:40', hora: 'noche', caos: true, inicio: 'cordon', armas: ['punos', 'piedra'], ambiente: 'viento',
    async prep(D) {
      ocultarOB(); D.coche('cordon.coche'); D.barreraLab(false); D.clima('lluvia', 1);
      await D.npc('varela', D.P['cordon.soldado'], 0, { def: 'varela', mira: true });
      await D.npc('soldado2', [-6.5, -117.2], .3, { def: 'soldado', mira: 'varela' });
      await D.npc('mike', D.P['lab.mikeHerido'], 0, { pose: 'herido' });
      D.pantallas(['ERROR: casco_v3 no responde', 'unidades activas: 214', 'ADVERTENCIA: casco perdido', '> desbloquear_unidades', 'denegado'], true);
    },
    pasos: [
      { t: 'escena', l: [
        { n: 'VARELA', t: '¡Alto! Zona militar. Dé media vuelta.', gesto: ['varela', 'senalar'] },
        ['DAVE', 'Mi hermano está ahí dentro. Es su laboratorio.'],
        ['VARELA', '¿Su hermano? Su hermano y medio pueblo. Aquí no entra nadie.'],
        { n: 'NÚÑEZ', t: 'Mi sargento... el capitán sigue sin contestar.', mira: ['varela', 'soldado2'] },
        { n: 'VARELA', t: 'Entonces el capitán soy yo, Núñez.', pausa: .5 },
        { n: 'VARELA', t: 'Y usted, fuera. O le pego un tiro, chaval. Esta noche no hay papeleo.', mira: ['varela', 'jugador'] },
        ['DAVE', 'Vale. Vale, ya me voy.']] },
      { t: 'sigilo', a: 'lab.trasera', r: 1.8, cp: { punto: 'cordon' },
        obj: 'Busca otra forma de entrar: rodea la valla por fuera y entra por detrás sin que te vean',
        guardias: D => [{ ruta: [[-30, -123], [-30, -156]], vel: 1.15 }, { ruta: [[-19, -153.5], [19, -153.5]], vel: 1.05 }, { ruta: [[30, -123], [30, -152]], vel: 1.2 }],
        focos: D => [{ origen: D.W.focosLab[0], ruta: [[-36, -126], [-36, -150], [-24, -163]], vel: .28 }, { origen: D.W.focosLab[1], ruta: [[36, -126], [36, -152], [22, -163]], vel: .24 }] },
      // la puerta trasera está cerrada: romper la ventana hace ruido y atrae a un R-7
      { t: 'evento', nombre: 'ventana_rota', a: 'lab.trasera', obj: () => vr() ? 'La puerta está cerrada: rompe la ventana (golpéala con la piedra)' : 'La puerta está cerrada: rompe la ventana',
        alt: { label: 'Romper la ventana con la piedra', a: 'lab.trasera', r: 2.2, f: D => { D.sfx('snap'); D.G.shake = .2; } }, rec: [R_('dave', 'rompio_la_ventana_del_lab', 1)] },
      { t: 'escena', libre: true, l: [['RADIO', 'Núñez: ¿Ha oído eso, mi sargento? Ha sonado a cristal.'], ['RADIO', 'Varela: Serán los robots. Quieto en tu puesto, Núñez.']] },
      { t: 'ir', a: 'lab.dentroTrasera', r: 1.8, obj: 'Entra' },
      { t: 'fn', f: async D => { await D.npc('r7a', [1.5, -132.5], Math.PI, { def: 'r7' }); D.sfx('boot'); D.say('Pasos metálicos'); } },
      { t: 'evento', nombre: 'escondido', escondite: true, cp: { punto: 'lab.dentroTrasera' }, a: [-10.9, -144.5], obj: () => vr() ? 'Un robot viene hacia aquí: ESCÓNDETE en la taquilla' : 'Un robot viene hacia aquí: escóndete en la taquilla',
        alt: { label: 'Esconderte en la taquilla', a: [-10.9, -144.5], r: 1.8 } },
      { t: 'escena', libre: true, escondite: true, l: [
        { npc: 'r7a', mira: null }, { npc: 'r7a', a: [-5, -140.5], vel: .8, esperar: true, max: 10 },
        { npc: 'r7a', mira: [-10.9, 1.4, -144.5] }, { espera: 1.2 },
        { f: D => D.say(vr() ? 'Tápate la boca con la mano' : 'Contén la respiración (Mayús izq.)') },
        { evento: 'respiracion_contenida', max: 4 }, { espera: 1.5 },
        { npc: 'r7a', mira: null }, { npc: 'r7a', a: [3, -133], vel: .9, esperar: true, max: 10 },
        { f: D => D.ocultar('r7a') }], rec: [R_('dave', 'se_escondio_del_robot', 1)] },
      { t: 'evento', nombre: 'salir_escondite', max: 1.5, obj: 'Sal de la taquilla' },
      { t: 'ir', a: 'lab.mikeHerido', r: 2.4, obj: 'Encuentra a Mike' },
      { t: 'escena', cinematica: true, l: [
        { npc: 'mike', mira: 'jugador' },
        ['DAVE', '¡Mike! Mike, mírame.'],
        { n: 'MIKE', t: 'Dave... te dije que te fueras a casa.', pausa: .5 },
        ['DAVE', '¿Qué ha pasado? ¿Qué es todo esto?'],
        ['MIKE', 'Uno de ellos se puso el casco. Yo no se lo di, Dave. Se lo puso él solo.'],
        ['MIKE', 'Ahora todos le obedecen. Todos los que dormían.'],
        ['DAVE', 'Aguanta. Te saco de aquí.'],
        { n: 'MIKE', t: 'Hay una cinta... en mi mesa. Escúchala cuando estés enfadado conmigo. Vas a estarlo.', pausa: .4 },
        ['MIKE', 'Quería que fuéramos los reyes, hermanito. Tú y yo.'],
        { n: 'MIKE', t: 'Intenté ser el rey... y mis propias creaciones me han derrotado.', pausa: .6 },
        ['MIKE', 'Sobrevive. Prométemelo.']] },
      { t: 'eleccion', id: 'c2.promesa', quien: 'MIKE', pregunta: 'Prométemelo, Dave.', ops: [
        { k: 'prometo', txt: 'Te lo prometo.', rec: [R_('dave', 'promesa_a_mike', 3)] },
        { k: 'aguanta', txt: 'Prométemelo tú. Que vas a aguantar.', rec: [R_('dave', 'no_quiso_despedirse_de_mike', 3)],
          l: [{ n: 'MIKE', t: 'Siempre has sido el cabezota de los dos.', pausa: .5 }, ['DAVE', 'Y tú el listo. Pues sé listo ahora.']] }] },
      { t: 'fn', f: async D => { D.cinematica(true); D.mirarA('mike', null); D.clima('lluvia', .25, 4); await D.fundido(.7, 1.5); await D.esperar(1.6); D.fundido(0, 1); } },
      { t: 'escena', l: [{ n: 'DAVE', t: 'Lo que sea. Lo que sea por vengarte.', pausa: .6 }, { cinematica: false }], rec: [R_('dave', 'muerte_de_mike', 3)] },
      cinta('g2', true),
      { t: 'fn', f: D => { D.ocultar('varela'); D.ocultar('soldado2'); D.sfx('alerta'); D.say('¡Robots en el laboratorio!'); } },
      { t: 'oleada', obj: 'Defiéndete', cp: { punto: 'lab.dentroTrasera' }, robots: [[0, -131.5, { retraso: .2 }], [-4, -132.5, { retraso: 1.2 }], [4, -132.5, { retraso: 2 }]] },
      { t: 'dialogo', l: [['DAVE', 'Con una piedra no voy a llegar lejos. La tienda de Hank, en la calle mayor. Tendrá algo mejor.']] },
      { t: 'fn', f: D => D.barreraLab(true) },
      { t: 'ir', a: 'lab.salida', r: 3, obj: 'Sal del laboratorio (la cinta de Mike sigue en su mesa)' },
      { t: 'subir', obj: 'Vuelve a la pickup (está junto al cordón)' },
      { t: 'conducir', a: 'tienda.coche', r: 7, obj: 'Ve a la tienda de armas de Hank (calle mayor)' },
      { t: 'fin' }
    ]
  },
  // ───────────────────────────── CAPÍTULO 3 ─────────────────────────────
  {
    id: 'c3', sub: 'Capítulo 4', titulo: 'La tienda de armas', nota: 'Calle mayor · 04:05', hora: 'noche', caos: true, inicio: 'tienda.llegada', armas: ['punos', 'piedra'], ambiente: 'viento',
    async prep(D) {
      ocultarOB(); rifle(); D.coche('tienda.coche'); D.barreraLab(true); D.clima('lluvia', .3);
      await D.npc('hank', D.P['tienda.hank'], Math.PI / 2, { mira: true });
    },
    pasos: [
      { t: 'dialogo', l: [['HANK', '¡Eh! ¡Eh, tú, el de la piedra! ¡Ayúdame, por favor!']] },
      { t: 'oleada', obj: 'Salva a Hank', cp: { punto: 'tienda.llegada' }, robots: [[-5, -57, {}], [-3.5, -43, {}], [6, -52, {}], [-2, -62, { retraso: 2 }], [5, -45, { retraso: 3 }]],
        rec: (m, D) => m.recordar('hank', 'salvado', 3, { confianza: .4, afecto: .35, miedo: -.2 }, { arma: D.jugador.w }) },
      { t: 'ir', a: 'tienda.dentro', r: 2.2, obj: 'Entra en la tienda' },
      { t: 'escena', l: [
        ['HANK', '¿Están... están todos muertos? ¿Se dice muertos? ¿Apagados?'],
        ['DAVE', 'Apagados.'],
        { si: m => m.dato('hank', 'salvado')?.arma === 'piedra', n: 'HANK', t: 'Con una piedra. Me has salvado con una piedra. Esto se lo cuento a mis nietos. Si tengo nietos. Si salgo de esta.' },
        { n: 'HANK', t: 'Me llamo Hank. Esta es mi tienda. Bueno, era mi tienda. Ahora es un colador.', gesto: ['hank', 'encoger'] },
        ['DAVE', 'Dave. Mi hermano era Mike. El del laboratorio.'],
        { n: 'HANK', t: '¿Mike? Me compraba baterías de litio por cajas. Pagaba en efectivo. Yo no preguntaba...', pausa: .5 },
        ['HANK', 'Toma. Es la mejor que tengo, la X-56D. Te la regalo por salvarme.']] },
      { t: 'usar', id: 'rifle', label: 'Coger la X-56D', pos: () => OB.rifle.position, mesh: () => OB.rifle, r: 2, alto: .8,
        obj: () => vr() ? 'Coge la X-56D del mostrador (grip)' : 'Coge la X-56D del mostrador',
        f: D => { OB.rifle.visible = false; D.arma('x56d'); D.jugador.ammo.x56d = 0; } },
      { t: 'escena', l: [
        { n: 'HANK', t: 'Sin cargador. Aquí no sale nada cargado por la puerta. Primero el chaleco.', gesto: ['hank', 'senalar'] }] },
      { t: 'evento', nombre: 'chaleco_puesto', obj: 'Deja que Hank te ponga el chaleco', alt: { label: 'Ponerte el chaleco', pos: () => npcs.hank.root.position, r: 2.4, alto: 1.9 } },
      { t: 'escena', l: [{ n: 'HANK', t: 'Dos portacargadores. Saca uno y mételo. Hasta que haga clic.', gesto: ['hank', 'manos'] }] },
      { t: 'evento', nombre: 'recargado', cond: D => D.jugador.ammo.x56d > 0, obj: () => vr() ? 'Saca un cargador del chaleco y mételo en la X-56D' : 'Recarga la X-56D (R)' },
      { t: 'escena', l: [
        { n: 'HANK', t: 'Ahí. Así se carga. Si lo pierdes, no te doy otro.', gesto: ['hank', 'asentir'], rec: [R_('hank', 'le_enseno_a_recargar', 1, { afecto: .1 })] },
        ['DAVE', '¿Tienes adónde ir? ¿Familia?'],
        { n: 'HANK', t: 'Marta se llevó a Leo a casa de su madre esta tarde. A la ciudad. Doce años tiene Leo. Dispara mejor que yo.', mira: ['hank', [-16, 1.5, -56]] },
        { n: 'HANK', t: 'No me cogen el teléfono. Seguro que es la cobertura. Seguro.', pausa: .8, rec: [R_('hank', 'dave_pregunto_por_su_familia', 2, { afecto: .2 })] },
        { npc: 'hank', mira: 'jugador' }, { f: D => D.sfx('door') },
        { n: 'HANK', t: 'Ay, no. No, no, no. Esos no son robots.' }] },
      // los saqueadores: humanos armados que roban a los supervivientes
      { t: 'fn', f: async D => {
        await D.npc('rata', [-7.6, -50], -Math.PI / 2, { def: 'rata' }); await D.npc('chispa', [-7.2, -48.7], -Math.PI / 2, { def: 'chispa' }); await D.npc('saq1', [-7.2, -51.3], -Math.PI / 2, { def: 'saqueador' });
        D.caminar('rata', [-12.6, -50.1], 1.1); D.caminar('chispa', [-11.4, -48.5], 1); D.caminar('saq1', [-11.4, -51.8], 1);
        for (const id of ['rata', 'chispa', 'saq1']) D.mirarA(id, 'jugador'); } },
      { t: 'escena', cinematica: true, cp: { punto: 'tienda.dentro' }, l: [
        { espera: 1.6 },
        { n: 'RATA', t: 'Vaya, vaya. Hank, el de las armas. Y con cliente.', gesto: ['rata', 'manos'] },
        { n: 'RATA', t: 'Y el cliente lleva la mejor del escaparate. Qué buen ojo.', mira: ['rata', 'jugador'] },
        { n: 'HANK', t: 'Rata... esta noche no. Por favor.', gesto: ['hank', 'encoger'] },
        { n: 'RATA', t: 'Esta noche más que nunca. La munición de la trastienda y las escopetas. Ahora.', gesto: ['rata', 'senalar'] },
        { n: 'CHISPA', t: 'Rata... vámonos. Hay cosas ahí fuera.', mira: ['chispa', 'rata'] }] },
      { t: 'eleccion', id: 'c3.saqueadores', quien: 'RATA', pregunta: '¿Y bien, piedrecitas? No tengo toda la noche.', ops: [
        { k: 'dar', txt: 'Llevaos la munición. Nadie tiene que morir esta noche.',
          rec: [R_('hank', 'dave_cedio_ante_rata', 2, { confianza: .05, miedo: .15 }), R_('rata', 'dave_le_dio_municion', 2, { confianza: .2 })],
          f: (D, m) => m.marcar('saqueadores_armados', true),
          l: [{ n: 'RATA', t: 'Listo el muchacho. Así da gusto.', gesto: ['rata', 'asentir'] }, { npc: 'saq1', a: [-19.5, -55], vel: 1.4, esperar: true, max: 5 }, { npc: 'saq1', a: [-6, -51], vel: 1.4 },
            { n: 'RATA', t: 'Nos vemos, Hank. Y gracias por la munición, piedrecitas. Le daremos buen uso.' },
            { npc: 'rata', a: [-5, -50], vel: 1.3 }, { npc: 'chispa', a: [-5, -49], vel: 1.5, esperar: true, max: 4 },
            { f: D => { D.ocultar('rata'); D.ocultar('chispa'); D.ocultar('saq1'); } },
            { n: 'HANK', t: 'Era toda la munición que tenía. Bueno. Mejor la munición que tú. Supongo.', gesto: ['hank', 'cabizbajo'] }] },
        { k: 'echar', txt: 'Fuera de esta tienda. Ya.',
          rec: [R_('hank', 'dave_lo_defendio', 2, { afecto: .3, confianza: .2 }), R_('rata', 'dave_le_echo', 2, { confianza: -.3, miedo: .3 })],
          l: [{ n: 'RATA', t: '¿Tú y cuántos más?', gesto: ['rata', 'apuntar'] }, { n: 'HANK', t: 'Ay, madre.' }],
          f: D => { for (const id of ['rata', 'chispa', 'saq1']) D.ocultar(id); D.cinematica(false); } },
        { k: 'convencer', txt: 'Ahí fuera hay robots. Si nos matamos entre nosotros, ganan ellos.',
          rec: [R_('hank', 'dave_convencio_a_rata', 2, { confianza: .3 }), R_('chispa', 'dave_le_dio_una_salida', 2, { confianza: .4 })],
          l: [{ n: 'RATA', t: '¿Y tú quién eres, el cura?' }, { n: 'CHISPA', t: 'Tiene razón, Rata. Mi madre está sola. Vámonos.', gesto: ['chispa', 'manos'] },
            { n: 'RATA', t: '...Esta te la guardo, piedrecitas.', pausa: .3 }, { npc: 'rata', a: [-5, -50], vel: 1.3 }, { npc: 'chispa', a: [-5, -49], vel: 1.5 }, { npc: 'saq1', a: [-5, -51.5], vel: 1.4, esperar: true, max: 5 },
            { f: (D, m) => { D.ocultar('rata'); D.ocultar('chispa'); D.ocultar('saq1'); m.marcar('saqueadores_ofendidos', true); } },
            { n: 'HANK', t: 'Has convencido a Rata. A RATA. Tú no eres de aquí, ¿verdad?' }] }] },
      { t: 'oleada', si: m => m.eleccion('c3.saqueadores') === 'echar', obj: 'Saca a los saqueadores de la tienda', cp: { punto: 'tienda.dentro', rehacer: async D => { await D.npc('hank', D.P['tienda.hank'], Math.PI / 2, { mira: true }); } },
        humanos: [[-12.6, -50.1, { def: 'rata', nombre: 'rata', hp: 80 }], [-11.4, -48.5, { def: 'chispa', hp: 40, vel: .7 }], [-11.4, -51.8, { def: 'saqueador', hp: 60 }]],
        rec: [R_('rata', 'dave_le_dio_una_paliza', 2, { miedo: .3 })] },
      { t: 'escena', si: m => m.eleccion('c3.saqueadores') === 'echar', cinematica: false, l: [
        { n: 'HANK', t: 'Les has... les has dado una paliza a los de Rata. En mi tienda. Por mí.', gesto: ['hank', 'manos'] },
        ['DAVE', 'Se irán arrastrando. Mañana estarán más enfadados.'],
        ['HANK', 'Mañana. Qué palabra tan optimista.']] },
      { t: 'escena', cinematica: false, l: [
        { n: 'HANK', t: 'Y esto también. Por si se te acaban las balas. O la suerte.', f: D => D.arma('cuchillo', false) },
        ['DAVE', 'Vente a mi casa. Hay sitio. Y mi mujer hace un café que resucita muertos.'],
        { n: 'HANK', t: 'Visto lo visto, mejor que no.', pausa: .3 },
        { si: m => m.confianza('hank') > .5, n: 'HANK', t: 'Oye, Dave. Gracias. De verdad. Hacía mucho que nadie...  Bueno. Vamos.' }] },
      { t: 'fn', f: D => { D.ocultar('hank'); D.say('Hank sube a la pickup'); D.robots([[-2, 12, { vel: .7 }], [3, 34, { vel: .7 }], [-1, 56, { vel: .7 }]]); } },
      { t: 'subir', obj: () => vr() ? 'Sube a la pickup · B/Y cambia de arma, gatillo dispara' : 'Sube a la pickup · rueda o 1-4 para cambiar de arma' },
      { t: 'conducir', a: 'casa.calle', r: 8, obj: 'Lleva a Hank a tu casa (calle mayor hacia el sur)' },
      { t: 'fin' }
    ]
  },
  // ───────────────────────────── CAPÍTULO 4 ─────────────────────────────
  {
    id: 'c4', sub: 'Capítulo 5', titulo: 'La banda', nota: 'Casa de Dave · amanecer', hora: 'amanecer', caos: true, inicio: 'casa.entrada', armas: ['punos', 'piedra', 'x56d', 'cuchillo'], arma: 'x56d',
    async prep(D) {
      ocultarOB(); foto(); dibujo(); D.coche('casa.coche'); D.barreraLab(true); D.clima('despejado', 0, 20);
      await D.npc('sarah', [18.5, 83.2], Math.PI, { mira: true });
      await D.npc('hank', [20.6, 77.4], Math.PI, { mira: 'sarah' });
      D.tele('EL EJÉRCITO PIERDE EL CONTACTO CON VARIAS BASES');
    },
    pasos: [
      { t: 'ir', a: 'casa.puertaDentro', r: 1.8, obj: 'Entra en casa' },
      { t: 'escena', cinematica: true, l: [
        { npc: 'sarah', a: [19.6, 82.6], vel: 1.4 },
        { si: m => m.recuerda('sarah', 'promesa_amanecer'), n: 'SARAH', t: 'Antes del amanecer, dijiste. Ha salido el sol hace diez minutos.' },
        { si: m => m.recuerda('sarah', 'se_fue_sin_despedirse'), n: 'SARAH', t: 'Te fuiste sin decir nada. Ni adiós, Dave. Ni adiós.' },
        { si: m => !m.recuerda('sarah', 'promesa_amanecer') && !m.recuerda('sarah', 'se_fue_sin_despedirse'), n: 'SARAH', t: '¡Dave! Pensaba que no volvías.' },
        { n: 'DAVE', t: 'Mike ha muerto.', pausa: 1 },
        { n: 'SARAH', t: 'Lo siento. Lo siento muchísimo.', gesto: ['sarah', 'abrazar'], rec: [R_('sarah', 'supo_lo_de_mike', 2, { afecto: .1 })] },
        { npc: 'hank', a: [22.4, 82.2], vel: 1 },
        { n: 'HANK', t: 'Hola. Soy Hank. Su marido me ha salvado la vida.', mira: ['sarah', 'hank'] },
        { si: m => m.dato('hank', 'salvado')?.arma === 'piedra', n: 'HANK', t: 'Con una piedra. Bueno, al principio. Luego ya con lo mío.' },
        { si: m => m.eleccion('c3.saqueadores') === 'echar', n: 'HANK', t: 'Y luego echó a Rata de mi tienda. A Rata. Con su gente.' },
        { n: 'SARAH', t: 'Pasa, Hank. Hay café. Lucía sigue en la bañera, contando robots en un cuaderno.', mira: ['sarah', 'jugador'] }] },
      { t: 'fn', f: async D => { await D.npc('john', [20, 71.5], 0, { porte: 'quieto' }); D.caminar('john', D.P['casa.john'], 1.3); D.sfx('door'); D.say('Alguien se acerca a la puerta'); D.mirarA('hank', 'john'); D.mirarA('sarah', 'john'); } },
      { t: 'esperar', s: 3.5 },
      { t: 'escena', l: [
        { npc: 'john', mira: 'jugador' },
        { n: 'JOHN', t: 'Tranquilos, no disparéis. John Cole, ejército. Estoy reuniendo supervivientes.', gesto: ['john', 'manos'] },
        ['HANK', '¿Ejército? ¿Y dónde está el resto del ejército?'],
        { n: 'JOHN', t: 'Ocupado. Muriendo, sobre todo.', pausa: .5 },
        ['DAVE', 'Mi hermano hizo esto. Su laboratorio. Había un casco que controla a las máquinas.'],
        ['JOHN', 'Entonces es ahí donde hay que mirar. ¿Tienes coche?']] },
      { t: 'mirar', a: () => { const n = npcs.john; return n ? new V3(n.root.position.x, n.root.position.y + 1.25, n.root.position.z) : new V3(20, 1.3, 76.2); }, obj: 'Fíjate bien en John', marca: false, s: .8, max: 12 },
      { t: 'escena', l: [
        ['DAVE', 'Ahí pone «Ruiz». En el uniforme.'],
        { n: 'JOHN', t: 'Era de un compañero. Ya no lo necesita.', mira: ['john', 'jugador'] }] },
      { t: 'eleccion', id: 'c4.john', quien: 'JOHN', pregunta: '¿Algún problema con eso?', ops: [
        { k: 'confrontar', txt: 'No me lo creo. ¿Quién eres?', rec: [R_('john', 'dave_le_confronto', 2, { confianza: -.1, miedo: .15 }), R_('dave', 'sospecha_de_john', 2)],
          l: [{ n: 'JOHN', t: 'Alguien que sabe entrar en una base militar. ¿Te sirve, o seguimos con el interrogatorio mientras tu pueblo arde?', gesto: ['john', 'brazos'] }] },
        { k: 'aceptar', txt: 'Esta noche no es asunto mío.', rec: [R_('john', 'dave_no_pregunto', 2, { confianza: .3 })],
          l: [{ n: 'JOHN', t: 'Bien. Me caes mejor que la mayoría.', pausa: .3 }] },
        { k: 'companero', txt: '¿Qué le pasó a tu compañero?', rec: [R_('john', 'dave_pregunto_por_ruiz', 2, { confianza: .1, afecto: .1 })],
          l: [{ n: 'JOHN', t: 'Lo mismo que a todos esta noche.', gesto: ['john', 'cabizbajo'], pausa: .8 }, ['JOHN', 'Tenía una hija. Como tú, supongo.']] }] },
      { t: 'escena', l: [
        ['DAVE', 'Hank, quédate con Sarah. Si alguien que no sea yo llama a la puerta...'],
        { n: 'HANK', t: 'No abro. Ni a ti, si vienes raro.', gesto: ['hank', 'asentir'] },
        { n: 'SARAH', t: 'Dave. Esta vez te despides.', gesto: ['sarah', 'abrazar'], rec: [R_('sarah', 'despedida_amanecer', 1, { afecto: .1 })] }] },
      { t: 'subir', obj: 'Sube a la pickup con John' },
      { t: 'fn', f: D => { D.ocultar('john'); D.ocultar('hank'); D.ocultar('sarah'); D.robots([[3, -20, { vel: .7 }], [-2, -60, { vel: .8 }]]); } },
      { t: 'conducir', a: 'cordon.coche', r: 8, obj: 'Vuelve al laboratorio con John' },
      { t: 'fn', f: async D => { await D.npc('john', [2, -118], Math.PI, { porte: 'quieto' }); D.caminar('john', [3.4, -143.6], 2.4); D.barreraLab(true); } },
      cinta('g3', true),
      { t: 'ir', a: 'lab.consola', r: 1.8, obj: 'Revisa los monitores de Mike' },
      { t: 'fn', f: async D => {
        D.pantallas(['> reproducir camara_03', '04:58:12 · movimiento', 'unidad R-01 junto a vitrina', '> rastrear casco_v3', 'señal: 120 km ↑ subiendo', 'ALERTA: objeto en órbita'], true);
        D.sfx('escaner'); await D.npc('r01', [8.6, -143.2], -Math.PI / 2, { def: 'r01' }); D.mirarA('john', 'r01'); } },
      { t: 'escena', cinematica: true, l: [
        ['JOHN', 'La cámara tres lo grabó todo. Mira.'],
        { npc: 'r01', a: [.9, -141.6], vel: .9, esperar: true, max: 10 },
        { npc: 'r01', mira: [0, 1.1, -142] },
        ['DAVE', 'Ese robot... Mike lo llamaba R cero uno. Era el más fuerte de todos.'],
        { f: async D => { const n = npcs.r01; const p = n ? n.root.position.clone() : new V3(.9, 0, -141.6); D.ocultar('r01'); D.sfx('escaner'); await D.npc('r01c', [p.x, p.z], -Math.PI / 2, { def: 'r01casco' }); D.mirarA('r01c', [-2, 1.6, -134]); } },
        ['JOHN', 'Se pone el casco y se le encienden los ojos.']] },
      { t: 'mirar', a: 'npc:r01c', obj: 'Mira la grabación', s: .4, max: 8 },
      { t: 'escena', l: [
        { npc: 'r01c', gesto: 'nuca', dur: 2.6 }, { espera: 2.4 },
        { n: 'DAVE', t: 'Espera. Se ha tocado la nuca.', pausa: .4 },
        ['DAVE', 'Mike hacía eso. Siempre. Cuando algo le salía bien.'],
        { n: 'JOHN', t: 'Es una máquina, Dave. Imitan lo que ven.', mira: ['john', 'jugador'], pausa: .5, rec: [R_('dave', 'vio_el_gesto_de_mike_en_r01', 3)] },
        { f: D => { D.ocultar('r01c'); } }] },
      // GIRO: la grabación de las 22:10 — Mike se pone el casco delante de R-01. No se lo arrebataron: se metió él dentro.
      { t: 'fn', f: async D => {
        D.pantallas(['> reproducir camara_03', '22:10:47 · M. con casco_v3', '> grabar_sujeto --MIKE', 'destino: R-01 (local)', 'progreso: 61% ... ERROR', 'reintentar: SÍ'], true); D.sfx('escaner');
        await D.npc('mikeholo', [1.4, -141.2], -Math.PI / 2, { def: 'mikeholo' }); await D.npc('r01', [8.6, -143.2], Math.PI / 2, { def: 'r01' }); D.mirarA('mikeholo', 'r01'); D.mirarA('r01', 'mikeholo'); D.mirarA('john', 'mikeholo'); } },
      { t: 'escena', cinematica: true, l: [
        ['JOHN', 'Hay otra grabación. Las diez y diez. Una hora después de que te fueras.'],
        { n: 'DAVE', t: 'Ese es Mike. Con el casco puesto.', gesto: ['mikeholo', 'manos'] },
        { npc: 'mikeholo', gesto: 'nuca', dur: 2.4 }, { espera: 1.6 },
        { n: 'JOHN', t: 'Se está grabando. Como hizo contigo. Pero no en un servidor.', pausa: .4 },
        { n: 'JOHN', t: 'Dentro de esa máquina.', mira: ['john', 'r01'], pausa: .8 },
        { n: 'DAVE', t: '«Yo no se lo di. Se lo puso él solo.»', pausa: .6 },
        { n: 'DAVE', t: 'No me mintió. Solo no me dijo quién iba dentro.', gesto: ['john', 'cabizbajo'], rec: [R_('dave', 'sabe_que_mike_se_grabo_en_r01', 3), R_('john', 'vio_la_grabacion_de_mike', 2)] },
        { f: D => { D.ocultar('mikeholo'); D.ocultar('r01'); D.cinematica(false); D.mirarA('john', 'jugador'); } },
        ['JOHN', 'Ahora mira la señal.'],
        ['DAVE', '¿Ciento veinte kilómetros? ¿Hacia arriba?'],
        ['JOHN', 'Se ha llevado el casco al espacio. En una nave que le han construido en una noche.'],
        { mira: ['john', [-11.5, 2.6, -142.5]] },
        { n: 'JOHN', t: '«Lázaro S.» ...Conozco ese nombre.', pausa: .3 },
        ['DAVE', '¿De qué?'],
        { n: 'JOHN', t: 'De nada que importe ahora.', mira: ['john', 'jugador'] },
        { f: D => D.sfx('door') },
        { n: 'JOHN', t: 'Motores. Vienen coches. Coge lo que tu hermano guardara para un mal día.', gesto: ['john', 'senalar'] }] },
      { t: 'usar', id: 'cajon', label: 'Abrir el cajón de Mike', a: [5.5, -146.1], r: 1.6, alto: 1.1, obj: 'Abre el cajón de la mesa de Mike',
        f: D => { D.sfx('door'); if (D.arma('pistola')) D.mem.recordar('dave', 'pistola_de_mike', 2); else D.mem.olvidar('dave', 'pistola_de_mike'); } },
      { t: 'escena', l: [
        { si: m => m.recuerda('dave', 'pistola_de_mike'), n: 'DAVE', t: 'Una pistola. Y una nota con su letra.' },
        { si: m => !m.recuerda('dave', 'pistola_de_mike'), n: 'DAVE', t: 'Una nota con su letra. Y una caja de balas sin arma.' },
        { n: 'DAVE', t: '«Para Dave. Por si algún día tengo que pedirte perdón.»', pausa: .8, rec: [R_('dave', 'nota_de_mike', 2)] }] },
      // la milicia de Varela viene a llevarse lo que queda del laboratorio
      { t: 'fn', f: async D => {
        D.sfx('door'); D.say('Pasos en la entrada'); D.barreraLab(true);
        await D.npc('varela', [0, -128.5], Math.PI, { def: 'varela' }); await D.npc('mil1', [-1.6, -128], Math.PI, { def: 'milicia' }); await D.npc('mil2', [1.6, -128], Math.PI, { def: 'milicia' });
        if (D.mem.flag('saqueadores_armados')) await D.npc('rata', [0, -127], Math.PI, { def: 'rata' });
        D.caminar('varela', [0, -135.5], 1.1); D.caminar('mil1', [-2.2, -134], 1.1); D.caminar('mil2', [2.2, -134], 1.1); D.caminar('rata', [.8, -132.5], 1.1);
        for (const id of ['varela', 'mil1', 'mil2', 'rata']) D.mirarA(id, 'jugador'); D.mirarA('john', 'varela'); } },
      { t: 'escena', cinematica: true, cp: { punto: 'lab.consola' }, l: [
        { espera: 1.8 },
        { n: 'VARELA', t: 'Vaya. El hermano. Te dije que no volvieras, chaval.', gesto: ['varela', 'senalar'] },
        { n: 'VARELA', t: 'El ejército se ha ido. Ahora mando yo. Las máquinas de tu hermano valen más que este pueblo entero.' },
        { si: m => m.flag('saqueadores_armados'), n: 'RATA', t: 'Gracias por la munición, piedrecitas. El sargento paga mejor que Hank.', gesto: ['rata', 'manos'] },
        { si: m => m.flag('saqueadores_armados'), n: 'DAVE', t: 'Se la di yo. La munición. Se la di yo.', pausa: .3 },
        { n: 'JOHN', t: 'Sargento. Déjelo estar. Tenemos un problema más grande.', gesto: ['john', 'manos'] },
        { n: 'VARELA', t: '¿Y tú de qué compañía eres? Conozco a todos los de la zona. A ti no.', mira: ['varela', 'john'] },
        { n: 'VARELA', t: 'Esa placa no es tuya.', gesto: ['varela', 'apuntar'], pausa: .4 }] },
      { t: 'eleccion', id: 'c4.cubrir', quien: 'VARELA', pregunta: '¿Y tú qué dices, chaval? ¿Le conoces?', ops: [
        { k: 'cubrir', txt: 'Es de los nuestros. Baja el arma.', rec: [R_('john', 'dave_le_cubrio_ante_varela', 3, { confianza: .35, afecto: .2 })], l: [{ n: 'VARELA', t: 'De los vuestros. Qué bonito. Pues os vais los dos al mismo sitio.' }] },
        { k: 'dudar', txt: 'Le conozco desde hace dos horas.', rec: [R_('john', 'dave_no_le_cubrio', 2, { confianza: -.2 })], l: [{ n: 'JOHN', t: 'Gracias por el voto de confianza.', mira: ['john', 'jugador'] }, { n: 'VARELA', t: 'Me da igual. Os vais los dos al mismo sitio.' }] }] },
      { t: 'fn', f: D => { for (const id of ['varela', 'mil1', 'mil2', 'rata']) D.ocultar(id); D.cinematica(false); D.say('¡Milicia!'); D.sfx('alerta'); } },
      { t: 'oleada', obj: 'Reduce a la milicia de Varela (no dejes que te rodeen)', cp: { punto: 'lab.consola', rehacer: async D => { await D.npc('john', [3.4, -143.6], Math.PI, { porte: 'quieto' }); } },
        humanos: (m) => [[0, -135.5, { def: 'varela', nombre: 'varela', hp: 140, vel: .7, rinde: true }], [-2.2, -134, { def: 'milicia', hp: 70, retraso: .6 }], [2.2, -134, { def: 'milicia', hp: 70, retraso: 1 }],
          ...(m.flag('saqueadores_armados') ? [[.8, -132.5, { def: 'rata', nombre: 'rata', hp: 80, retraso: 1.4 }]] : [])] },
      { t: 'escena', l: [
        { n: 'VARELA', t: 'Vale... vale. Tú ganas, chaval. Por ahora.' },
        { n: 'DAVE', t: '¿Para quién robas, Varela? Esto no se vende en el mercadillo.' },
        { n: 'VARELA', t: 'Lázaro paga. Por el casco, por las cápsulas...', pausa: .4 },
        { n: 'VARELA', t: '...y por ti. Preguntaron por un tal Dave. «Ele, zeta, erre, cero cero cero uno.» Lo dijeron así, como un número.', pausa: .8, rec: [R_('dave', 'lazaro_le_busca', 3)] },
        { n: 'JOHN', t: 'Nos vamos. Ya.', gesto: ['john', 'brazos'] },
        { n: 'JOHN', t: 'Tiene razón en una cosa: ya no hay ejército. Hay lo que hagamos nosotros.', mira: ['john', 'jugador'] }] },
      { t: 'eleccion', id: 'c4.varela', quien: 'JOHN', pregunta: '¿Qué hacemos con él?', ops: [
        { k: 'soltar', txt: 'Que se largue. Y que no vuelva.', rec: [R_('varela', 'dave_le_perdono', 2, { confianza: .1 }), R_('john', 'dave_fue_clemente', 1, { confianza: -.05 })],
          l: [{ n: 'JOHN', t: 'Volverá. Los que son como él siempre vuelven.' }] },
        { k: 'atar', txt: 'Átalo. Que le encuentren los suyos.', rec: [R_('varela', 'dave_le_ato', 2, { confianza: -.2, miedo: .2 }), R_('john', 'dave_fue_practico', 1, { confianza: .1 })],
          l: [{ n: 'VARELA', t: 'Los nudos no te van a durar toda la noche, chaval.' }] }] },
      { t: 'escena', l: [
        ['DAVE', 'Pues vamos a buscar al robot.'],
        ['JOHN', 'Para eso hace falta algo que vuele muy alto. La base de Peñas Negras tiene una lanzadera. La ORION-4.'],
        ['DAVE', '¿Y nos la van a prestar?'],
        { n: 'JOHN', t: 'No. Por eso tengo esta placa.', gesto: ['john', 'senalar'] },
        { si: m => m.recuerda('dave', 'sospecha_de_john'), n: 'DAVE', t: 'La placa de Ruiz.' },
        { si: m => m.recuerda('dave', 'sospecha_de_john'), n: 'JOHN', t: 'La placa que funciona.' },
        ['JOHN', '¿Tú crees que es tan fácil asaltar una base militar? Lo es, si llevas el uniforme correcto.']] },
      { t: 'fin' }
    ]
  },
  // ───────────────────────────── CAPÍTULO 5 ─────────────────────────────
  {
    id: 'c5', sub: 'Capítulo 6', titulo: 'Asalto a la base', nota: 'Base de Peñas Negras · noche', hora: 'noche', caos: true, inicio: 'camion.inicio', armas: ['punos', 'piedra', 'x56d', 'cuchillo', 'pistola'], arma: 'x56d', ambiente: 'viento',
    async prep(D) {
      ocultarOB(); D.coche(null); D.barreraLab(true); D.clima('viento', .7);
      if (D.W.barrera) D.W.barrera.rotation.x = 0;
      const cam = D.W.camion; if (cam) { cam.position.set(70, 0, 0); cam.rotation.y = Math.PI / 2; cam.visible = true; sentarEn(D.W.camionSeat); }
      const h = await D.npc('hank', [0, 0], Math.PI, {}); if (cam) { cam.add(h.root); h.root.position.set(.75, 1.18, -1.1); h.root.rotation.y = Math.PI; }
      await D.npc('guarda', [117.6, -3.6], -Math.PI / 2, { mira: true });
      if (D.W.orion && D.W.orion.parent !== capas.tierra) { capas.tierra.add(D.W.orion); }
      if (D.W.orion) { D.W.orion.position.set(150, 0, 20); D.W.orion.rotation.set(0, Math.PI, 0); }
      for (const f of OB.fuegoBase) f.visible = false;
    },
    pasos: [
      { t: 'escena', libre: true, l: [
        { n: 'HANK', t: 'Dave. Si me pasa algo... Marta y Leo. Diles que no me escondí. Bueno, que me escondí poco.', pausa: .3 },
        { si: m => m.recuerda('hank', 'dave_pregunto_por_su_familia'), n: 'HANK', t: 'Eres el único que me ha preguntado por ellos esta noche. Por eso te lo pido a ti.' },
        ['DAVE', 'Se lo dirás tú, Hank.']] },
      { t: 'viaje', veh: 'camion', ruta: [[70, 0], [100, 0], [110.5, 0]], vel: 8, obj: 'Vas en la caja del camión. John conduce' },
      { t: 'dialogo', l: [
        ['GUARDIA', 'Alto. Documentación.'],
        ['JOHN', 'Cole. Transporte de material para el hangar tres.'],
        ['GUARDIA', 'No tengo nada del hangar tres en el parte.'],
        ['JOHN', 'Llame a su superior. Ah, que no contesta. Como nadie esta noche.'],
        ['GUARDIA', '...Pase. Y no se paren hasta el hangar.']] },
      { t: 'fn', f: D => D.animar(1.6, k => { if (D.W.barrera) D.W.barrera.rotation.x = -k * Math.PI / 2 * .95; }) },
      { t: 'viaje', veh: 'camion', ruta: [[110.5, 0], [124, 0], [124, -30], [121, -39]], vel: 6 },
      { t: 'fundido', vel: 2.5, f: D => { const h = npcs.hank; if (h) { scene.add(h.root); h.root.visible = false; } D.levantarse('base.parada'); } },
      { t: 'dialogo', l: [
        ['JOHN', 'Escucha. Yo me encargo de los guardias. Tú cruza entre los barracones hasta las cajas junto al hangar.'],
        ['JOHN', 'Si te ven, se acabó. Y no dispares a nadie: son soldados, no robots. No todos son Varela.'],
        ['HANK', 'Yo me quedo vigilando el camión. Alguien tiene que hacerlo. Valientemente.']] },
      { t: 'sigilo', a: 'base.senal', r: 2.4, mantener: true, cp: { punto: 'base.parada' },
        obj: 'Cruza el callejón entre los barracones hasta las cajas del hangar sin que te vean',
        guardias: D => [{ ruta: [[129, -39], [147, -39]], vel: .95, pausa: 2.2 }, { ruta: [[144, -50], [144, -24]], vel: 1.15 }],
        focos: D => [{ origen: D.W.focosBase[2], ruta: [[132, -54], [150, -46], [150, -30]], vel: .22, r: 3.4 }] },
      // walkie: John en el depósito, el jugador da la señal
      { t: 'escena', libre: true, l: [['RADIO · JOHN', 'Dave, ¿me oyes? Pulsa para hablar.'], { evento: 'walkie_hablar', max: 6 }, ['RADIO · JOHN', 'Estoy en el depósito. Tú me dices cuándo. Espera a que la patrulla pase el hangar.']] },
      { t: 'evento', nombre: 'walkie_senal', obj: () => vr() ? 'Cuando la patrulla se aleje, pulsa el walkie y da la señal: «¡Ahora!»' : 'Cuando la patrulla se aleje, da la señal por el walkie',
        alt: { aqui: true, label: 'Walkie: «¡Ahora!»', r: 3 }, rec: [R_('john', 'dave_dio_la_senal', 1, { confianza: .1 })] },
      { t: 'fn', f: D => {
        const p = new V3(168, 0, -50); D.sfx('bigboom'); burst(new V3(168, 3, -52), 60, 'hot', null, 2.4); luzFx.position.set(168, 5, -50); luzFx.intensity = 900; D.G.shake = .8;
        if (!OB.fuegoBase.length) for (const [x, z] of [[164, -52], [169, -52], [174, -52]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), glow(0xff6a1a, 5)); m.position.set(x, 4.4, z); m.scale.y = 1.6; capas.tierra.add(m); OB.fuegoBase.push(m); fuenteLuz(x, 6, z, 0xff7a2a, 80, 30, 'fuego'); }
        for (const f of OB.fuegoBase) f.visible = true;
        distraer(p); D.say('¡El depósito de combustible!'); } },
      { t: 'dialogo', libre: true, l: [['JOHN', '¡Ahora! ¡Corre a la plataforma de la ORION-4!']] },
      { t: 'sigilo', a: 'base.rampa', r: 3, cp: { punto: 'base.senal', rehacer: D => { for (const f of OB.fuegoBase) f.visible = true; } },
        obj: 'Llega a la ORION-4 (en la plataforma, al norte) sin que te vean',
        guardias: D => [{ ruta: [[154, 4], [138, 8], [138, 24]], vel: 1.25, pausa: 1.2 }],
        focos: D => [{ origen: D.W.focosBase[0], ruta: [[136, 26], [158, 10], [146, 0]], vel: .2, r: 3.4 }] },
      { t: 'fn', f: async D => { await D.npc('john', [146.5, 27.5], Math.PI, { mira: true, porte: 'quieto' }); await D.npc('hank', [153.5, 27.5], Math.PI, { mira: true }); } },
      { t: 'dialogo', l: [
        ['JOHN', 'Hank, arranca los sistemas. Dave, cúbrenos: tenemos compañía.'],
        ['HANK', '¿Compañía? ¿Qué compañía? ¡Ah! Esa compañía.']] },
      { t: 'fn', f: D => { D.ocultar('hank'); D.ocultar('john'); } },
      // arranque de la cabina intercalado con la defensa de la rampa
      { t: 'resistir', s: 12, obj: 'Defiende la rampa', cp: { punto: 'base.rampa' }, max: 4, cada: 3, spawns: SPAWNS_RAMPA },
      { t: 'evento', nombre: 'cabina_bateria', a: [150, 25.5], obj: 'Cabina: levanta la tapa y sube el interruptor de la BATERÍA', alt: { label: 'Batería: arriba', pos: new V3(150, 1, 25.5), r: 3 },
        f0: D => D.murmurar([['HANK', '¡Dave! ¡Aquí no llego! ¡La batería, la de la tapa roja!']]) },
      { t: 'resistir', s: 10, obj: 'Defiende la rampa', cp: { punto: 'base.rampa' }, max: 5, cada: 2.8, spawns: SPAWNS_RAMPA },
      { t: 'evento', nombre: 'cabina_bombas', a: [150, 25.5], obj: 'Cabina: enciende las dos BOMBAS de combustible', alt: { label: 'Bombas 1 y 2', pos: new V3(150, 1, 25.5), r: 3 } },
      { t: 'resistir', s: 10, obj: 'Defiende la rampa', cp: { punto: 'base.rampa' }, max: 5, cada: 2.6, spawns: SPAWNS_RAMPA },
      { t: 'evento', nombre: 'cabina_apu', a: [150, 25.5], obj: 'Cabina: mantén pulsado el botón del APU (3 s)', alt: { label: 'APU (mantener)', pos: new V3(150, 1, 25.5), r: 3 } },
      // GIRO: la nave pide autorización y John la tiene… de Lázaro
      { t: 'escena', l: [
        ['ORION', 'Autorización requerida para el despegue.'],
        { n: 'JOHN', t: 'Código: Lázaro, siete, siete, cero. Prioridad uno.' },
        { n: 'ORION', t: 'Autorización de Lázaro Systems aceptada. Bienvenido, agente.', pausa: .6 },
        { n: 'DAVE', t: '¿Agente? ¿Ese código es de Lázaro?', pausa: .3 },
        { n: 'JOHN', t: 'Es un código que funciona.' },
        { si: m => m.recuerda('dave', 'lazaro_le_busca'), n: 'DAVE', t: 'Varela dijo que Lázaro me buscaba a mí.' },
        { si: m => m.recuerda('dave', 'lazaro_le_busca'), n: 'JOHN', t: 'Y te encontré yo primero. Da las gracias y sube.' }], rec: [R_('dave', 'john_uso_codigo_lazaro', 3), R_('john', 'dave_sabe_lo_del_codigo', 2, { miedo: .2 })] },
      // clímax: Varela llega a la rampa con su fusil y los robots detrás
      { t: 'fn', f: async D => {
        await D.npc('john', [147.4, 26.2], Math.PI, { mira: 'varela', porte: 'quieto' }); await D.npc('hank', [152.6, 26.4], Math.PI, { mira: 'varela' });
        await D.npc('varela', [141, 33], Math.PI * .75, { def: 'varela', mira: 'jugador' }); D.caminar('varela', [145.2, 29.6], 1.2); D.cinematica(true); } },
      { t: 'escena', cp: { punto: 'base.rampa' }, l: [
        { espera: 1.2 },
        { n: 'VARELA', t: 'Esa nave me la llevo yo, chaval.', gesto: ['varela', 'apuntar'], dur: 6 },
        { si: m => m.eleccion('c4.varela') === 'atar', n: 'VARELA', t: 'Te dije que los nudos no durarían toda la noche.' },
        { si: m => m.eleccion('c4.varela') === 'soltar', n: 'VARELA', t: 'Me dejaste ir. Error de novato.' },
        { n: 'JOHN', t: 'Varela. Mira detrás de ti.', mira: ['john', [136, 1.5, 38]] },
        { f: D => { D.G.pausaEnemigos = true; D.robots([[134, 38, { vel: .9 }], [139, 39, { vel: .9, retraso: .5 }], [142, 40, { vel: .9, retraso: 1 }]]); D.sfx('alerta'); D.mirarA('varela', [136, 1.5, 38]); } },
        { n: 'VARELA', t: '...Joder.', gesto: ['varela', 'cabizbajo'], pausa: .4 }] },
      { t: 'eleccion', id: 'c5.varela', quien: 'VARELA', pregunta: '¡Chaval! ¡Son demasiados!', ops: [
        { k: 'salvar', txt: '¡Sube! ¡Hay sitio para uno más!', rec: [R_('varela', 'dave_le_ofrecio_sitio', 3, { confianza: .6, afecto: .3 }), R_('john', 'dave_salvaria_a_cualquiera', 1, { afecto: .1 })],
          l: [{ n: 'VARELA', t: '...No. Alguien tiene que cerrar la puerta.', mira: ['varela', 'jugador'], pausa: .3 }, { n: 'VARELA', t: 'Lárgate, chaval. Y mata a ese rey de chatarra por mí.', gesto: ['varela', 'apuntar'] }] },
        { k: 'dejar', txt: 'Te dije que no volvieras.', rec: [R_('varela', 'dave_le_dejo_atras', 3, { confianza: -.4 }), R_('hank', 'vio_a_dave_dejar_a_un_hombre', 2, { miedo: .2 })],
          l: [{ n: 'VARELA', t: 'Ja. Al final tú y yo no somos tan distintos.', pausa: .3 }, { n: 'HANK', t: 'Dave... Dave, ¿qué has hecho?', mira: ['hank', 'jugador'] }] }] },
      { t: 'fn', f: (D, m) => { if (m.eleccion('c5.varela') === 'dejar') D.ocultar('varela'); else { D.mirarA('varela', [136, 1.5, 38]); D.gesto('varela', 'apuntar', 30); } D.cinematica(false); D.G.pausaEnemigos = false; } },
      { t: 'oleada', robots: [], obj: 'Acaba con los robots de la rampa', cp: { punto: 'base.rampa', rehacer: D => D.robots([[134, 38, { vel: .9 }], [139, 39, { vel: .9 }], [142, 40, { vel: .9 }]]) } },
      { t: 'fn', f: D => D.ocultar('varela') },
      { t: 'dialogo', l: [['JOHN', '¡Motores listos! ¡Todos dentro, ya!']] },
      { t: 'fn', f: D => { D.ocultar('hank'); D.ocultar('john'); } },
      { t: 'usar', id: 'orion', label: 'Subir a la ORION-4', pos: new V3(150, 1, 25.5), r: 3, obj: 'Sube a la ORION-4' },
      { t: 'fn', f: D => { if (D.W.orionSeat) sentarEn(D.W.orionSeat); D.sfx('motor'); engineSet(true, 30); } },
      { t: 'evento', nombre: 'cabina_potencia', obj: () => vr() ? 'Agárrate al arnés y empuja la palanca de POTENCIA' : 'Empuja la palanca de potencia', alt: { aqui: true, label: 'Palanca de potencia', r: 4 } },
      { t: 'dialogo', l: [['JOHN', 'Agarraos a algo. Motores... ¡ahora!']] },
      { t: 'fn', f: async D => {
        const o = D.W.orion; if (!o) return;
        await D.animar(7, k => { const e = k * k; o.position.y = e * 70; o.rotation.x = -Math.min(.5, k * .7); o.position.z = 20 - e * 25; D.G.shake = Math.max(D.G.shake, .15 + k * .25); if (Math.random() < .3) burst(new V3(150 + rnd(-2, 2), o.position.y, o.position.z + 3), 4, 'hot', new V3(0, -1, 0), 1.5); });
        await D.fundido(1, 1.2, 0xffffff); engineSet(false); } },
      { t: 'fin' }
    ]
  },
  // ───────────────────────────── EPÍLOGO DEL ACTO I ─────────────────────────────
  {
    id: 'e1', sub: 'Fin del Acto I', titulo: 'Más allá de la atmósfera', nota: 'Órbita baja', hora: 'espacio', espacio: true, armas: ['punos', 'piedra', 'x56d', 'cuchillo', 'pistola'], arma: 'x56d', ambiente: 'nave',
    async prep(D) {
      ocultarOB(); D.coche(null);
      const o = D.W.orion; if (o) { capas.espacio.add(o); o.position.set(0, 0, 0); o.rotation.set(0, Math.PI, 0); sentarEn(D.W.orionSeat); }
    },
    actualizar(dt, D) { const o = D.W.orion; if (o && o.parent === capas.espacio) { o.position.z -= dt * 1.6; o.rotation.z = Math.sin(D.G.time * .4) * .03; } },
    pasos: [
      { t: 'esperar', s: 2.5 },
      { t: 'escena', cinematica: true, l: [
        ['HANK', 'Estamos... ¿estamos en el espacio? Estoy en el espacio. Mi madre no se lo va a creer.'],
        ['JOHN', 'Tu madre tiene otros problemas ahora mismo, Hank.'],
        { n: 'HANK', t: 'Marta y Leo están ahí abajo. En alguna de esas luces.', pausa: 1 },
        { si: m => m.recuerda('sarah', 'se_fue_sin_despedirse'), n: 'DAVE', t: 'La primera vez me fui sin decirle adiós a Sarah. No pienso hacerlo dos veces.' },
        { si: m => m.recuerda('sarah', 'despedida'), n: 'DAVE', t: 'Sarah me dijo que volviera. Es lo único que me pidió.' },
        { si: m => m.eleccion('c5.varela') === 'salvar', n: 'JOHN', t: 'Le ofreciste sitio a un hombre que quería matarte. No sé si eso es valiente o estúpido.' },
        { si: m => m.eleccion('c5.varela') === 'dejar', n: 'HANK', t: 'No hablemos de Varela. Por favor.' },
        { si: m => m.grabaciones().length >= 4, n: 'DAVE', t: 'Mike lo sabía. Lázaro, las copias... lo sabía todo y no me contó nada.' },
        { si: m => m.grabaciones().length >= 4, n: 'JOHN', t: '...Lázaro.', pausa: .5 },
        ['DAVE', '¿Dónde está la señal del casco?'],
        ['JOHN', 'Ahí delante. Detrás de ese campo de restos. ¿Ves esa luz roja, a lo lejos?'],
        ['JOHN', '...Y el localizador se acaba de quedar sin batería.'],
        ['DAVE', '¿Ahora?'],
        ['JOHN', 'Ahora.'],
        { n: 'DAVE', t: 'Vale. Pues lo buscamos a ojo.', pausa: 1.2 },
        { f: D => { D.pulsoRey({ radio: true }); D.sfx('radio'); } },
        ['RADIO', '...'],
        { n: 'EL REY', t: 'Hermanito.', pausa: .8 },
        { si: m => m.recuerda('sarah', 'se_fue_sin_despedirse'), n: 'EL REY', t: 'Te fuiste sin despedirte. Como siempre.' },
        { si: m => m.recuerda('dave', 'no_quiso_despedirse_de_mike'), n: 'EL REY', t: 'Me pediste que aguantara. Te he hecho caso.' },
        { n: 'EL REY', t: 'Estoy terminando lo que empezamos.', pausa: .8 },
        { n: 'DAVE', t: '...¿Mike?', pausa: .6 },
        { n: 'JOHN', t: 'Apágala. ¡Apágala, Dave!', rec: [R_('dave', 'oyo_a_mike_en_la_radio', 3)] }] },
      { t: 'fn', f: async (D, m) => { const n = m.grabaciones().length; ui.tarjeta('FIN DEL ACTO I', 'Apocalipsis 2030', `Cintas de Mike: ${n} de 4 · Continuará en el Acto II`, 9); await D.esperar(9); } },
      { t: 'fin' }
    ]
  }
];
