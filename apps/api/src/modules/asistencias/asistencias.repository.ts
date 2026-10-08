import { and, asc, desc, eq, inArray, lte, max, type SQL } from 'drizzle-orm';
import type { Asistencia, PersonaResumen } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import {
  alumno,
  asistencia,
  pack,
  pago,
  profesor,
  clase,
  type NuevaAsistencia,
} from '../../db/schema.ts';

const columnas = {
  id: asistencia.id,
  claseId: asistencia.claseId,
  alumno: { id: alumno.id, nombre: alumno.nombre, apellido: alumno.apellido },
  pagoId: asistencia.pagoId,
  pack: pack.nombre,
  valorClase: asistencia.valorClase,
  porcentajeBp: asistencia.porcentajeBp,
};

function seleccionar(ej: Ejecutor, filtro: SQL) {
  return ej
    .select(columnas)
    .from(asistencia)
    .innerJoin(alumno, eq(alumno.id, asistencia.alumnoId))
    .innerJoin(pago, eq(pago.id, asistencia.pagoId))
    .innerJoin(pack, eq(pack.id, pago.packId))
    .where(filtro);
}

export async function insertar(ej: Ejecutor, datos: NuevaAsistencia): Promise<number> {
  const [fila] = await ej.insert(asistencia).values(datos).returning({ id: asistencia.id });
  return fila!.id;
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Asistencia | null> {
  const [fila] = await seleccionar(ej, eq(asistencia.id, id));
  return fila ?? null;
}

export async function listarDeClase(ej: Ejecutor, claseId: number): Promise<Asistencia[]> {
  return seleccionar(ej, eq(asistencia.claseId, claseId)).orderBy(asc(alumno.apellido), asc(alumno.nombre));
}

// El día de la última clase de cada alumno hasta `hasta`: no cuentan las anotadas para más adelante.
export async function ultimasFechas(
  ej: Ejecutor,
  alumnoIds: number[],
  hasta: FechaDia,
): Promise<{ alumnoId: number; fecha: FechaDia | null }[]> {
  if (alumnoIds.length === 0) return [];
  return ej
    .select({ alumnoId: asistencia.alumnoId, fecha: max(clase.fecha) })
    .from(asistencia)
    .innerJoin(clase, eq(clase.id, asistencia.claseId))
    .where(and(inArray(asistencia.alumnoId, alumnoIds), lte(clase.fecha, hasta)))
    .groupBy(asistencia.alumnoId);
}

export type ClaseDeAlumno = { fecha: FechaDia; clase: string; profesor: PersonaResumen };

// Las clases de un alumno, también las anotadas para más adelante, de la más nueva a la más vieja.
// El profesor es el de la clase, que cambia si hubo suplencia; el del horario es el titular. El estilo
// es el de la clase: si después cambia el horario, lo que pasó se sigue viendo como fue.
export async function listarDeAlumno(ej: Ejecutor, alumnoId: number): Promise<ClaseDeAlumno[]> {
  return ej
    .select({
      fecha: clase.fecha,
      clase: clase.estilo,
      profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
    })
    .from(asistencia)
    .innerJoin(clase, eq(clase.id, asistencia.claseId))
    .innerJoin(profesor, eq(profesor.id, clase.profesorId))
    .where(eq(asistencia.alumnoId, alumnoId))
    .orderBy(desc(clase.fecha), desc(clase.horaInicio), desc(asistencia.id));
}

export async function borrar(ej: Ejecutor, id: number): Promise<boolean> {
  const filas = await ej.delete(asistencia).where(eq(asistencia.id, id)).returning({ id: asistencia.id });
  return filas.length > 0;
}

export async function buscarClaseDe(
  ej: Ejecutor,
  asistenciaId: number,
): Promise<{ profesorId: number; fecha: string } | null> {
  const [fila] = await ej
    .select({ profesorId: clase.profesorId, fecha: clase.fecha })
    .from(asistencia)
    .innerJoin(clase, eq(clase.id, asistencia.claseId))
    .where(eq(asistencia.id, asistenciaId));
  return fila ?? null;
}
