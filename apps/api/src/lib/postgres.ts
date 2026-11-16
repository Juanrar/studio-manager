import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export function esViolacionUnica(error: unknown, restriccion: string): boolean {
  let actual: unknown = error;
  while (actual !== null && typeof actual === 'object') {
    const candidato = actual as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (candidato.code === '23505' && candidato.constraint_name === restriccion) return true;
    actual = candidato.cause;
  }
  return false;
}

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

export const horaHHMM = (columna: AnyPgColumn) =>
  sql<string>`to_char(${columna}, 'HH24:MI')`;
