export type DetalleError = { campo: string; mensaje: string };

// Todo error de la API llega así: el status, el mensaje de `{ error }` y los campos inválidos.
export class ErrorDeApi extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
    readonly detalles: DetalleError[] = [],
    // Algunos errores de negocio traen un código para que la pantalla decida qué ofrecer.
    readonly codigo?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeApi';
  }
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type ValorQuery = string | number | boolean | undefined | null;

async function pedir<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  const opciones: RequestInit = { method: metodo, credentials: 'same-origin' };
  if (cuerpo !== undefined) {
    opciones.headers = { 'content-type': 'application/json' };
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(new URL(`/api${ruta}`, window.location.origin), opciones);
  if (respuesta.status === 204) return undefined as T;

  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = datos as { error?: string; detalles?: DetalleError[]; codigo?: string } | null;
    throw new ErrorDeApi(
      respuesta.status,
      error?.error ?? 'Ocurrió un error inesperado. Probá de nuevo.',
      error?.detalles ?? [],
      error?.codigo,
    );
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string) => pedir<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>('POST', ruta, cuerpo ?? {}),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
  delete: (ruta: string) => pedir<void>('DELETE', ruta),
};

export function conQuery(ruta: string, parametros: Record<string, ValorQuery>): string {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') query.set(clave, String(valor));
  }
  const texto = query.toString();
  return texto === '' ? ruta : `${ruta}?${texto}`;
}

export function mensajeDeError(error: unknown): string {
  return error instanceof ErrorDeApi ? error.message : 'Ocurrió un error inesperado. Probá de nuevo.';
}
