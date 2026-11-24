import {
  ahoraIso,
  carpetaDeEstado,
  comandosDeVerificacion,
  correrHook,
  esRutaDeCodigo,
  guardarEstado,
  leerEstado,
  rutaRelativa,
} from './estado.mjs';

const HERRAMIENTAS_DE_EDICION = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

function archivoEditado(entrada) {
  const { file_path, notebook_path } = entrada.tool_input ?? {};
  return file_path ?? notebook_path ?? null;
}

export function registrarVerificacion(entrada, { carpeta, raiz, ahora }) {
  const sesion = entrada.session_id;
  if (HERRAMIENTAS_DE_EDICION.includes(entrada.tool_name)) {
    const archivo = archivoEditado(entrada);
    const relativa = archivo ? rutaRelativa(raiz, archivo) : null;
    if (relativa === null || !esRutaDeCodigo(relativa)) return { codigo: 0 };
    const estado = leerEstado(carpeta, sesion);
    guardarEstado(carpeta, sesion, { ...estado, ultimoCambioDeCodigo: ahora() });
    return { codigo: 0 };
  }
  if (entrada.tool_name === 'Bash') {
    if (entrada.tool_input?.run_in_background === true) return { codigo: 0 };
    const comandos = comandosDeVerificacion(entrada.tool_input?.command ?? '');
    if (comandos.length === 0) return { codigo: 0 };
    const estado = leerEstado(carpeta, sesion);
    const hora = ahora();
    const corridos = Object.fromEntries(comandos.map((comando) => [comando, hora]));
    guardarEstado(carpeta, sesion, { ...estado, comandos: { ...estado.comandos, ...corridos } });
  }
  return { codigo: 0 };
}

correrHook(import.meta.url, (entrada, raiz) =>
  registrarVerificacion(entrada, { carpeta: carpetaDeEstado(raiz), raiz, ahora: ahoraIso }),
);
