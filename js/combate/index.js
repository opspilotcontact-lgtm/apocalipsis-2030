// Sistema de combate: física (Rapier), ragdolls, daño por zonas, reacciones, marcas y partículas.
// Un único punto de entrada para el bucle y para la historia.
import { pasoFisica, actualizarPiezas, limpiarPiezas, FIS, listo } from './fisica.js';
import { actualizarRagdolls, limpiarRagdolls } from './ragdoll.js';
import { actualizarParticulas, limpiarParticulas } from './particulas.js';
import { actualizarMarcas, limpiarMarcas } from './marcas.js';
import { limpiarEntorno } from './entorno.js';
import { actualizarPiel } from './piel.js';
import './atlas.js';
import { actualizarDanio, limpiarCadaveres } from './danio.js';

export { FIS, listo, escombro, empujarPiezas } from './fisica.js';
export { crearRagdoll, congelar, estadoRagdolls, MAX_RAGDOLLS } from './ragdoll.js';
export { salpicar, mancha } from './particulas.js';
export { marcar, herida, goteo, marcarImpacto, nMarcas } from './marcas.js';
export { salpicarDetras, charco, gotaSuelo, manchaSuelo, fijarSuperficies, capaEntorno } from './entorno.js';
export { prepararPiel, golpearSkinned, quitarPiel } from './piel.js';
export { atlas, atlasListo, estadoAtlas } from './atlas.js';
export { K, CICLO_MORATON } from './heridaShader.js';
export { L as lesionesJugador, lesionar, curarZona, zonaParaCurar, posZona, factorPiernas, puedeCorrer, fuerzaMano, temblorMano, sangrado, reiniciarLesiones } from './lesiones.js';
export { alertar, prepararOido, robotsTeVen } from './oido.js';
export { reaccionar, brazoUtil, quitarCapa, ponerCapa } from './reacciones.js';
export { ZONAS, zonaDe, zonaSkinned, zonaDeHueso, prepararDanio, impactoZona, matarCuerpo, desprender, soltarArma, desmembrarHueso, cadaveres, mallasCadaveres, golpearCadaver, factorVelocidad } from './danio.js';

// llamar una vez por fotograma (lo hace actualizarEnemigos)
export function actualizarCombate(dt, enemigos) {
  pasoFisica(dt);
  actualizarRagdolls(dt);
  actualizarPiezas(dt);
  actualizarDanio(dt, enemigos);
  actualizarParticulas(dt);
  actualizarMarcas(dt);
  actualizarPiel(dt);
}
// al cambiar de capítulo / reiniciar oleada
export function limpiarCombate() { limpiarRagdolls(); limpiarCadaveres(); limpiarPiezas(); limpiarMarcas(); limpiarParticulas(); limpiarEntorno(); }
