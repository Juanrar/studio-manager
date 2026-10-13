import type { LlamadaAHerramienta, ModeloDeLenguaje, PedidoAlModelo } from '../src/modules/asistente/modelo.ts';

export type TurnoGuionado = { texto?: string; llamadas?: Omit<LlamadaAHerramienta, 'id'>[] };

// Responde con los turnos del guion, en orden, y guarda cada pedido para que el test lo mire. Su historial
// es legible ({ rol, ... }), no el de Gemini.
export function crearModeloFalso(guion: TurnoGuionado[]): ModeloDeLenguaje & { pedidos: PedidoAlModelo[] } {
  const pendientes = [...guion];
  const pedidos: PedidoAlModelo[] = [];
  return {
    pedidos,
    agregarMensaje: (historial, texto) => [...historial, { rol: 'usuario', texto }],
    agregarResultados: (historial, resultados) => [
      ...historial,
      { rol: 'resultados', resultados: resultados.map((r) => ({ nombre: r.llamada.nombre, resultado: r.resultado })) },
    ],
    async responder(pedido) {
      pedidos.push(pedido);
      const turno = pendientes.shift();
      if (turno === undefined) throw new Error('El modelo falso se quedó sin guion');
      const llamadas = (turno.llamadas ?? []).map((llamada, i) => ({ id: `llamada-${pedidos.length}-${i}`, ...llamada }));
      const texto = turno.texto ?? '';
      return { historial: [...pedido.historial, { rol: 'modelo', texto, llamadas }], texto, llamadas };
    },
  };
}
