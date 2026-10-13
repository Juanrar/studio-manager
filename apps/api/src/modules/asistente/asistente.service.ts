import { ZodError } from 'zod';
import type { MensajeAlAsistenteInput, PropuestaDelAsistente, RespuestaDelAsistente, Rol } from '@studio/shared';
import { esErrorDeDominio, ReglaDeNegocioError } from '../../lib/errores.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { herramientasPara, type ContextoDeHerramienta, type Herramienta, type SalidaDeHerramienta } from './herramientas.ts';
import { instrucciones } from './instrucciones.ts';
import type { LlamadaAHerramienta, ModeloDeLenguaje, ResultadoDeHerramienta } from './modelo.ts';

// Cada vuelta es un pedido al modelo y gasta cuota: un pedido normal usa 2 a 4.
const VUELTAS_MAXIMAS = 6;

export async function conversar(
  modelo: ModeloDeLenguaje,
  entrada: MensajeAlAsistenteInput,
  contexto: { hoy: FechaDia; rol: Rol },
): Promise<RespuestaDelAsistente> {
  const herramientas = herramientasPara(contexto.rol);
  const texto = instrucciones(contexto.hoy, contexto.rol);
  const propuestas: PropuestaDelAsistente[] = [];
  let historial = modelo.agregarMensaje(entrada.historial, entrada.mensaje);

  for (let vuelta = 0; vuelta < VUELTAS_MAXIMAS; vuelta++) {
    const turno = await modelo.responder({ instrucciones: texto, historial, herramientas });
    historial = turno.historial;
    if (turno.llamadas.length === 0) return { historial, texto: turno.texto, propuestas };

    const resultados: ResultadoDeHerramienta[] = [];
    for (const llamada of turno.llamadas) {
      const salida = await ejecutar(herramientas, llamada, { hoy: contexto.hoy });
      if (salida.propuesta !== undefined) propuestas.push(salida.propuesta);
      resultados.push({ llamada, resultado: salida.resultado });
    }
    historial = modelo.agregarResultados(historial, resultados);
  }
  throw new ReglaDeNegocioError('El asistente no llegó a una respuesta. Probá con un pedido más concreto.');
}

// Un error esperable vuelve al modelo para que se lo explique al usuario. Uno inesperado corta el pedido.
async function ejecutar(
  herramientas: Herramienta[],
  llamada: LlamadaAHerramienta,
  contexto: ContextoDeHerramienta,
): Promise<SalidaDeHerramienta> {
  const herramienta = herramientas.find((h) => h.nombre === llamada.nombre);
  if (herramienta === undefined) return { resultado: { error: `No existe la herramienta ${llamada.nombre}` } };
  try {
    return await herramienta.ejecutar(llamada.argumentos, contexto);
  } catch (error) {
    if (error instanceof ZodError) {
      return { resultado: { error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') } };
    }
    if (esErrorDeDominio(error)) return { resultado: { error: error.message } };
    throw error;
  }
}
