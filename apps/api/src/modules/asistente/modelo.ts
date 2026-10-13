// Lo que el asistente necesita de un modelo de lenguaje, sin depender del proveedor.

// El subconjunto de JSON Schema que entienden Gemini y Claude.
export type EsquemaDeCampo =
  | { type: 'string' | 'integer' | 'number' | 'boolean'; description?: string }
  | { type: 'array'; description?: string; items: EsquemaDeCampo }
  | EsquemaDeObjeto;

export type EsquemaDeObjeto = {
  type: 'object';
  description?: string;
  properties: Record<string, EsquemaDeCampo>;
  required: string[];
};

export type DefinicionDeHerramienta = { nombre: string; descripcion: string; parametros: EsquemaDeObjeto };

export type LlamadaAHerramienta = { id?: string; nombre: string; argumentos: Record<string, unknown> };

export type ResultadoDeHerramienta = { llamada: LlamadaAHerramienta; resultado: Record<string, unknown> };

// El historial tiene el formato del proveedor. La web lo guarda y lo devuelve sin mirarlo.
export type Historial = unknown[];

export type PedidoAlModelo = { instrucciones: string; historial: Historial; herramientas: DefinicionDeHerramienta[] };

// `historial` es el del pedido con la respuesta del modelo agregada al final.
export type TurnoDelModelo = { historial: Historial; texto: string; llamadas: LlamadaAHerramienta[] };

export interface ModeloDeLenguaje {
  agregarMensaje(historial: Historial, texto: string): Historial;
  agregarResultados(historial: Historial, resultados: ResultadoDeHerramienta[]): Historial;
  responder(pedido: PedidoAlModelo): Promise<TurnoDelModelo>;
}
