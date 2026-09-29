import { and, asc, desc, eq, inArray, lte, max, type SQL } from 'drizzle-orm';
import type { Asistencia, PersonaResumen } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import {
  alumno,
  asistencia,
  clase,
  pack,
  pago,
  profesor,
  sesion,
  type NuevaAsistencia,
} from '../../db/schema.ts';

const columnas = {
  id: asistencia.id,
  sesionId: asistencia.sesionId,
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

export async function listarDeSesion(ej: Ejecutor, sesionId: number): Promise<Asistencia[]> {
  return seleccionar(ej, eq(asistencia.sesionId, sesionId)).orderBy(asc(alumno.apellido), asc(alumno.nombre));
}

// El día de la última clase de cada alumno hasta `hasta`: no cuentan las anotadas para más adelante.
export async function ultimasFechas(
  ej: Ejecutor,
  alumnoIds: number[],
  hasta: FechaDia,
): Promise<{ alumnoId: number; fecha: FechaDia | null }[]> {
  if (alumnoIds.length === 0) return [];
  return ej
    .select({ alumnoId: asistencia.alumnoId, fecha: max(sesion.fecha) })
    .from(asistencia)
    .innerJoin(sesion, eq(sesion.id, asistencia.sesionId))
    .where(and(inArray(asistencia.alumnoId, alumnoIds), lte(sesion.fecha, hasta)))
    .groupBy(asistencia.alumnoId);
}

export type ClaseDeAlumno = { fecha: FechaDia; clase: string; profesor: PersonaResumen };

// Las clases de un alumno hasta `hasta`, de la más nueva a la más vieja. El profesor es el de la
// sesión, que cambia si hubo suplencia; el de la clase es el titular.
export async function listarDeAlumno(ej: Ejecutor, alumnoId: number, hasta: FechaDia): Promise<ClaseDeAlumno[]> {
  return ej
    .select({
      fecha: sesion.fecha,
      clase: clase.estilo,
      profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
    })
    .from(asistencia)
    .innerJoin(sesion, eq(sesion.id, asistencia.sesionId))
    .innerJoin(clase, eq(clase.id, sesion.claseId))
    .innerJoin(profesor, eq(profesor.id, sesion.profesorId))
    .where(and(eq(asistencia.alumnoId, alumnoId), lte(sesion.fecha, hasta)))
    .orderBy(desc(sesion.fecha), desc(clase.horaInicio), desc(asistencia.id));
}

export async function borrar(ej: Ejecutor, id: number): Promise<boolean> {
  const filas = await ej.delete(asistencia).where(eq(asistencia.id, id)).returning({ id: asistencia.id });
  return filas.length > 0;
}

export async function buscarSesionDe(
  ej: Ejecutor,
  asistenciaId: number,
): Promise<{ profesorId: number; fecha: string } | null> {
  const [fila] = await ej
    .select({ profesorId: sesion.profesorId, fecha: sesion.fecha })
    .from(asistencia)
    .innerJoin(sesion, eq(sesion.id, asistencia.sesionId))
    .where(eq(asistencia.id, asistenciaId));
  return fila ?? null;
}
