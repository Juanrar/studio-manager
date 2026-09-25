import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import type { Clase } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { clase, profesor, type NuevaClase } from '../../db/schema.ts';

// Postgres devuelve `time` como HH:MM:SS; la API usa HH:MM.
export const horaHHMM = (columna: AnyPgColumn) =>
  sql<string>`to_char(${columna}, 'HH24:MI')`;

const columnas = {
  id: clase.id,
  estilo: clase.estilo,
  nivel: clase.nivel,
  diaSemana: clase.diaSemana,
  horaInicio: horaHHMM(clase.horaInicio),
  horaFin: horaHHMM(clase.horaFin),
  profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
  activa: clase.activa,
};

function seleccionar(ej: Ejecutor, filtro: SQL | undefined) {
  return ej
    .select(columnas)
    .from(clase)
    .innerJoin(profesor, eq(profesor.id, clase.profesorId))
    .where(filtro)
    .orderBy(asc(clase.diaSemana), asc(clase.horaInicio), asc(clase.id));
}

export async function insertar(ej: Ejecutor, datos: NuevaClase): Promise<number> {
  const [fila] = await ej.insert(clase).values(datos).returning({ id: clase.id });
  return fila!.id;
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Clase | null> {
  const [fila] = await seleccionar(ej, eq(clase.id, id));
  return fila ?? null;
}

export async function actualizar(ej: Ejecutor, id: number, cambios: Partial<NuevaClase>): Promise<boolean> {
  if (Object.keys(cambios).length === 0) return (await buscarPorId(ej, id)) !== null;
  const filas = await ej.update(clase).set(cambios).where(eq(clase.id, id)).returning({ id: clase.id });
  return filas.length > 0;
}

export async function listar(ej: Ejecutor, incluirInactivas: boolean): Promise<Clase[]> {
  return seleccionar(ej, incluirInactivas ? undefined : eq(clase.activa, true));
}

export async function listarDelDia(ej: Ejecutor, diaSemana: number): Promise<Clase[]> {
  return seleccionar(ej, and(eq(clase.activa, true), eq(clase.diaSemana, diaSemana)));
}
