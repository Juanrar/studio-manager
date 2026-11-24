import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export { leerEstado as leerEstadoDeSesion } from '../estado.mjs';

export const RAIZ = 'C:\\proyecto';

export function carpetaTemporal() {
  return mkdtempSync(join(tmpdir(), 'hooks-verificacion-'));
}

export function leerRegistro(carpeta) {
  const archivo = join(carpeta, 'registro.jsonl');
  if (!existsSync(archivo)) return [];
  return readFileSync(archivo, 'utf8')
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => JSON.parse(linea));
}

export function escribirEstadoDeSesion(carpeta, sesion, estado) {
  writeFileSync(join(carpeta, `${sesion}.json`), JSON.stringify(estado));
}

export function escribirModo(carpeta, modo) {
  const archivo = join(carpeta, 'verificacion.json');
  writeFileSync(archivo, JSON.stringify({ modo }));
  return archivo;
}

export function entradaBash(comando, sesion = 'sesion-1') {
  return {
    session_id: sesion,
    cwd: RAIZ,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: comando, description: 'x' },
  };
}

export function entradaEdicion(archivo, sesion = 'sesion-1', herramienta = 'Edit') {
  return {
    session_id: sesion,
    cwd: RAIZ,
    hook_event_name: 'PostToolUse',
    tool_name: herramienta,
    tool_input: { file_path: archivo },
    tool_response: {},
  };
}
