import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// Drizzle envuelve el error del driver en `cause`, así que se recorre la cadena.
export function esViolacionUnica(error: unknown, restriccion: string): boolean {
  let actual: unknown = error;
  while (actual !== null && typeof actual === 'object') {
    const candidato = actual as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (candidato.code === '23505' && candidato.constraint_name === restriccion) return true;
    actual = candidato.cause;
  }
  return false;
}

// Patrón para `like` que busca el texto en cualquier parte. Escapa los comodines
// para que un `%` o un `_` escrito por el usuario se busque literal.
export function patronContiene(texto: string): string {
  return `%${texto.replace(/[\%_]/g, (caracter) => `\${caracter}`)}%`;
}

export function esViolacionCheck(error: unknown, restriccion: string): boolean {
  let actual: unknown = error;
  while (actual !== null && typeof actual === 'object') {
    const candidato = actual as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (candidato.code === '23514' && candidato.constraint_name === restriccion) return true;
    actual = candidato.cause;
  }
  return false;
}

// Postgres devuelve `time` como HH:MM:SS; la API usa HH:MM.
export const horaHHMM = (columna: AnyPgColumn) =>
  sql<string>`to_char(${columna}, 'HH24:MI')`;
