import { describe, expect, it } from 'vitest';
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

// Responde en orden con `respuestas` y guarda lo que recibió.
function fetchFalso(respuestas: Array<{ status: number; cuerpo: unknown }>) {
  const pedidos: PedidoGrabado[] = [];
  const falso = async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) });
    const siguiente = respuestas.shift();
    if (siguiente === undefined) throw new Error('El fetch falso no tiene más respuestas');
    return new Response(JSON.stringify(siguiente.cuerpo), { status: siguiente.status });
  };
  return { falso: falso as typeof fetch, pedidos };
}

function modeloCon(respuestas: Array<{ status: number; cuerpo: unknown }>) {
  const { falso, pedidos } = fetchFalso(respuestas);
  const modelo = crearModeloGemini({ clave: 'clave-de-test', modelo: 'principal', respaldo: 'respaldo', fetch: falso });
  return { modelo, pedidos };
}

describe('crearModeloGemini', () => {
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
    const { modelo, pedidos } = modeloCon([
      { status: 503, cuerpo: { error: { message: 'high demand' } } },
      { status: 200, cuerpo: { candidates: [{ content: { role: 'model', parts: [{ text: 'Hola' }] } }] } },
    ]);

    const turno = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] });

    expect(pedidos.map((p) => p.url)).toEqual([
      'https://generativelanguage.googleapis.com/v1beta/models/principal:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/respaldo:generateContent',
    ]);
    expect(turno.texto).toBe('Hola');
  });

  it.each([
    [429, 'CUOTA_AGOTADA'],
    [503, 'MODELO_SATURADO'],
  ])('si los dos modelos responden %i, lanza ServicioNoDisponibleError con %s', async (status, codigo) => {
    const { modelo } = modeloCon([
      { status, cuerpo: {} },
      { status, cuerpo: {} },
    ]);

    const error = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServicioNoDisponibleError);
    expect(error).toMatchObject({ codigo });
  });

  it('una respuesta sin partes lanza SIN_RESPUESTA', async () => {
    const { modelo } = modeloCon([{ status: 200, cuerpo: { candidates: [{ finishReason: 'SAFETY' }] } }]);

    const error = await modelo.responder({ instrucciones: '', historial: [], herramientas: [] }).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'SIN_RESPUESTA' });
  });
});
