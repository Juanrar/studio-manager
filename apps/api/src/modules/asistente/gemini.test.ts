import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServicioNoDisponibleError } from '../../lib/errores.ts';
import { crearModeloGemini } from './gemini.ts';
import type { DefinicionDeHerramienta } from './modelo.ts';

const LLAMADA_A_BUSCAR = {
  role: 'model',
  parts: [
    { functionCall: { name: 'buscar_profesores', args: { texto: 'Martín' }, id: 'call_390531' }, thoughtSignature: 'firma-opaca' },
  ],
};

const BUSCAR: DefinicionDeHerramienta = {
  nombre: 'buscar_profesores',
  descripcion: 'Busca profesores activos.',
  parametros: { type: 'object', properties: { texto: { type: 'string', description: 'Nombre o apellido' } }, required: ['texto'] },
};

type PedidoGrabado = { url: string; cuerpo: unknown };

// Un `Error` hace que el fetch rechace, como con la red caída o un timeout.
type RespuestaFalsa = { status: number; cuerpo: unknown } | Error;

const URL_PRINCIPAL = 'https://generativelanguage.googleapis.com/v1beta/models/principal:generateContent';
const URL_RESPALDO = 'https://generativelanguage.googleapis.com/v1beta/models/respaldo:generateContent';
const HOLA = { status: 200, cuerpo: { candidates: [{ content: { role: 'model', parts: [{ text: 'Hola' }] } }] } };

// Responde en orden con `respuestas` y guarda lo que recibió y lo que devolvió.
function fetchFalso(respuestas: RespuestaFalsa[]) {
  const pedidos: PedidoGrabado[] = [];
  const signals: Array<AbortSignal | null | undefined> = [];
  const devueltas: Response[] = [];
  const falso = async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) });
    signals.push(init?.signal);
    const siguiente = respuestas.shift();
    if (siguiente === undefined) throw new Error('El fetch falso no tiene más respuestas');
    if (siguiente instanceof Error) throw siguiente;
    const respuesta = new Response(JSON.stringify(siguiente.cuerpo), { status: siguiente.status });
    devueltas.push(respuesta);
    return respuesta;
  };
  return { falso: falso as typeof fetch, pedidos, signals, devueltas };
}

function modeloCon(respuestas: RespuestaFalsa[]) {
  const { falso, ...grabado } = fetchFalso(respuestas);
  const modelo = crearModeloGemini({ clave: 'clave-de-test', modelo: 'principal', respaldo: 'respaldo', fetch: falso });
  return { modelo, ...grabado };
}

const SIN_NADA = { instrucciones: '', historial: [], herramientas: [] };

describe('crearModeloGemini', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manda instrucciones, historial y herramientas, y devuelve las llamadas con su id', async () => {
    const { modelo, pedidos } = modeloCon([{ status: 200, cuerpo: { candidates: [{ content: LLAMADA_A_BUSCAR }] } }]);
    const historial = modelo.agregarMensaje([], '¿Cuál es el apellido de Martín?');

    const turno = await modelo.responder({ instrucciones: 'Sos el asistente.', historial, herramientas: [BUSCAR] });

    expect(pedidos).toEqual([
      {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/principal:generateContent',
        cuerpo: {
          systemInstruction: { parts: [{ text: 'Sos el asistente.' }] },
          contents: [{ role: 'user', parts: [{ text: '¿Cuál es el apellido de Martín?' }] }],
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'buscar_profesores',
                  description: 'Busca profesores activos.',
                  parameters: {
                    type: 'OBJECT',
                    properties: { texto: { type: 'STRING', description: 'Nombre o apellido' } },
                    required: ['texto'],
                  },
                },
              ],
            },
          ],
        },
      },
    ]);
    expect(turno.llamadas).toEqual([{ id: 'call_390531', nombre: 'buscar_profesores', argumentos: { texto: 'Martín' } }]);
    expect(turno.texto).toBe('');
  });

  it('agrega al historial el content del modelo tal cual, con su thoughtSignature', async () => {
    const { modelo } = modeloCon([{ status: 200, cuerpo: { candidates: [{ content: LLAMADA_A_BUSCAR }] } }]);
    const historial = modelo.agregarMensaje([], '¿Cuál es el apellido de Martín?');

    const turno = await modelo.responder({ instrucciones: 'Sos el asistente.', historial, herramientas: [BUSCAR] });

    expect(turno.historial).toEqual([...historial, LLAMADA_A_BUSCAR]);
  });

  it('devuelve los resultados como functionResponse con el id y el nombre de la llamada', () => {
    const { modelo } = modeloCon([]);

    const historial = modelo.agregarResultados([], [
      { llamada: { id: 'call_390531', nombre: 'buscar_profesores', argumentos: {} }, resultado: { profesores: [] } },
    ]);

    expect(historial).toEqual([
      { role: 'user', parts: [{ functionResponse: { id: 'call_390531', name: 'buscar_profesores', response: { profesores: [] } } }] },
    ]);
  });

  it('une el texto de las partes y deja afuera los pensamientos', async () => {
    const { modelo } = modeloCon([
      { status: 200, cuerpo: { candidates: [{ content: { role: 'model', parts: [{ text: 'pensando', thought: true }, { text: 'El apellido ' }, { text: 'es Gómez.' }] } }] } },
    ]);

    const turno = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] });

    expect(turno).toMatchObject({ texto: 'El apellido es Gómez.', llamadas: [] });
  });

  it('si el principal está saturado, reintenta con el respaldo', async () => {
    const { modelo, pedidos } = modeloCon([{ status: 503, cuerpo: { error: { message: 'high demand' } } }, HOLA]);

    const turno = await modelo.responder(SIN_NADA);

    expect(pedidos.map((p) => p.url)).toEqual([URL_PRINCIPAL, URL_RESPALDO]);
    expect(turno.texto).toBe('Hola');
  });

  it.each([500, 504])('un %i del principal reintenta con el respaldo', async (status) => {
    const { modelo, pedidos } = modeloCon([{ status, cuerpo: {} }, HOLA]);

    const turno = await modelo.responder(SIN_NADA);

    expect(pedidos.map((p) => p.url)).toEqual([URL_PRINCIPAL, URL_RESPALDO]);
    expect(turno.texto).toBe('Hola');
  });

  it('si el pedido al principal falla por red o timeout, reintenta con el respaldo', async () => {
    const { modelo, pedidos } = modeloCon([new DOMException('The operation was aborted due to timeout', 'TimeoutError'), HOLA]);

    const turno = await modelo.responder(SIN_NADA);

    expect(pedidos.map((p) => p.url)).toEqual([URL_PRINCIPAL, URL_RESPALDO]);
    expect(turno.texto).toBe('Hola');
  });

  it('libera el cuerpo de la primera respuesta antes de reintentar', async () => {
    const { modelo, devueltas } = modeloCon([{ status: 503, cuerpo: { error: { message: 'high demand' } } }, HOLA]);

    await modelo.responder(SIN_NADA);

    expect(devueltas[0]?.bodyUsed).toBe(true);
  });

  it('cada pedido lleva un signal que lo corta a los 45 segundos', async () => {
    const corte = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(corte);
    const { modelo, signals } = modeloCon([{ status: 503, cuerpo: {} }, HOLA]);

    await modelo.responder(SIN_NADA);

    expect(timeout.mock.calls).toEqual([[45_000], [45_000]]);
    expect(signals).toHaveLength(2);
    expect(signals[0]).toBe(corte);
    expect(signals[1]).toBe(corte);
  });

  it.each([
    ['responden 429', 'CUOTA_AGOTADA', { status: 429, cuerpo: {} }],
    ['responden 503', 'MODELO_SATURADO', { status: 503, cuerpo: {} }],
    ['responden 504', 'MODELO_SATURADO', { status: 504, cuerpo: {} }],
    ['fallan por red', 'MODELO_SATURADO', new TypeError('fetch failed')],
  ])('si los dos modelos %s, lanza ServicioNoDisponibleError con %s', async (_caso, codigo, respuesta) => {
    const { modelo, pedidos } = modeloCon([respuesta, respuesta]);

    const error = await modelo.responder(SIN_NADA).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServicioNoDisponibleError);
    expect(error).toMatchObject({ codigo });
    expect(pedidos.map((p) => p.url)).toEqual([URL_PRINCIPAL, URL_RESPALDO]);
  });

  it.each([400, 403])('un %i no se reintenta y es un error genérico', async (status) => {
    const { modelo, pedidos } = modeloCon([{ status, cuerpo: { error: { message: 'API key not valid' } } }]);

    const error = await modelo.responder(SIN_NADA).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ServicioNoDisponibleError);
    expect(error).toEqual(new Error(`Gemini respondió ${status}: {"error":{"message":"API key not valid"}}`));
    expect(pedidos.map((p) => p.url)).toEqual([URL_PRINCIPAL]);
  });

  it('una respuesta sin partes lanza SIN_RESPUESTA', async () => {
    const { modelo } = modeloCon([{ status: 200, cuerpo: { candidates: [{ finishReason: 'SAFETY' }] } }]);

    const error = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] }).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'SIN_RESPUESTA' });
  });
});
