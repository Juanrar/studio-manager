import { ServicioNoDisponibleError } from '../../lib/errores.ts';
import type { EsquemaDeCampo, LlamadaAHerramienta, ModeloDeLenguaje } from './modelo.ts';

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const TIEMPO_MAXIMO_POR_PEDIDO = 45_000;

const ESTADOS_DE_SATURACION = [500, 503, 504];

type Falla = 'cuota' | 'saturado';

type Parte = {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  thoughtSignature?: string;
};
type Contenido = { role: string; parts?: Parte[] };

export type OpcionesGemini = {
  clave: string;
  modelo: string;
  respaldo: string;
  fetch?: typeof fetch;
};

export function crearModeloGemini(opciones: OpcionesGemini): ModeloDeLenguaje {
  const pedirHttp = opciones.fetch ?? fetch;

  const generar = async (modelo: string, cuerpo: unknown): Promise<Response | Falla> => {
    let respuesta: Response;
    try {
      respuesta = await pedirHttp(`${URL_BASE}/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': opciones.clave, 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_POR_PEDIDO),
      });
    } catch {
      return 'saturado';
    }
    if (respuesta.status !== 429 && !ESTADOS_DE_SATURACION.includes(respuesta.status)) return respuesta;
    await respuesta.body?.cancel();
    return respuesta.status === 429 ? 'cuota' : 'saturado';
  };

  return {
    agregarMensaje: (historial, texto) => [...historial, { role: 'user', parts: [{ text: texto }] }],

    agregarResultados: (historial, resultados) => [
      ...historial,
      {
        role: 'user',
        parts: resultados.map(({ llamada, resultado }) => ({
          functionResponse: {
            ...(llamada.id === undefined ? {} : { id: llamada.id }),
            name: llamada.nombre,
            response: resultado,
          },
        })),
      },
    ],

    async responder({ instrucciones, historial, herramientas }) {
      const cuerpo = {
        systemInstruction: { parts: [{ text: instrucciones }] },
        contents: historial,
        tools: [
          {
            functionDeclarations: herramientas.map((h) => ({
              name: h.nombre,
              description: h.descripcion,
              parameters: aEsquemaDeGemini(h.parametros),
            })),
          },
        ],
      };

      let respuesta = await generar(opciones.modelo, cuerpo);
      if (typeof respuesta === 'string') respuesta = await generar(opciones.respaldo, cuerpo);
      if (respuesta === 'cuota') {
        throw new ServicioNoDisponibleError('Se alcanzó el límite de pedidos del plan gratuito. Probá en un minuto; si sigue, la cuota del día se renueva mañana.', 'CUOTA_AGOTADA');
      }
      if (respuesta === 'saturado') {
        throw new ServicioNoDisponibleError('El asistente está saturado. Probá en unos minutos.', 'MODELO_SATURADO');
      }
      if (!respuesta.ok) throw new Error(`Gemini respondió ${respuesta.status}: ${await respuesta.text()}`);

      const datos = (await respuesta.json()) as { candidates?: { content?: Contenido }[] };
      const contenido = datos.candidates?.[0]?.content;
      const partes = contenido?.parts ?? [];
      const llamadas: LlamadaAHerramienta[] = partes.flatMap((parte) =>
        parte.functionCall === undefined
          ? []
          : [
              {
                ...(parte.functionCall.id === undefined ? {} : { id: parte.functionCall.id }),
                nombre: parte.functionCall.name,
                argumentos: parte.functionCall.args ?? {},
              },
            ],
      );
      const texto = partes
        .filter((parte) => parte.thought !== true)
        .map((parte) => parte.text ?? '')
        .join('')
        .trim();
      if (contenido === undefined || (texto === '' && llamadas.length === 0)) {
        throw new ServicioNoDisponibleError('El asistente no pudo responder. Probá con otras palabras.', 'SIN_RESPUESTA');
      }
      return { historial: [...historial, contenido], texto, llamadas };
    },
  };
}

function aEsquemaDeGemini(esquema: EsquemaDeCampo): Record<string, unknown> {
  const base = {
    type: esquema.type.toUpperCase(),
    ...(esquema.description === undefined ? {} : { description: esquema.description }),
  };
  if (esquema.type === 'array') return { ...base, items: aEsquemaDeGemini(esquema.items) };
  if (esquema.type === 'object') {
    return {
      ...base,
      properties: Object.fromEntries(Object.entries(esquema.properties).map(([clave, campo]) => [clave, aEsquemaDeGemini(campo)])),
      required: esquema.required,
    };
  }
  return base;
}
