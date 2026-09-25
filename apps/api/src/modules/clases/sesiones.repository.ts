import { and, count, eq, sql, type SQL } from 'drizzle-orm';
import type { EstadoSesion, Sesion, SesionDetalle } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase, profesor, sesion, type NuevaSesion } from '../../db/schema.ts';
import { horaHHMM } from './clases.repository.ts';
import type { FechaDia } from '../../lib/fechas.ts';

const columnas = {
  id: sesion.id,
  claseId: sesion.claseId,
  fecha: sesion.fecha,
  estado: sesion.estado,
  profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
  asistentes: sql<number>`(select count(*) from ${asistencia} where ${asistencia.sesionId} = ${sesion.id})`.mapWith(Number),
};

function seleccionar(ej: Ejecutor, filtro: SQL | undefined) {
  return ej.select(columnas).from(sesion).innerJoin(profesor, eq(profesor.id, sesion.profesorId)).where(filtro);
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Sesion | null> {
  const [fila] = await seleccionar(ej, eq(sesion.id, id));
  return fila ?? null;
}

export async function buscarPorClaseYFecha(ej: Ejecutor, claseId: number, fecha: FechaDia): Promise<Sesion | null> {
  const [fila] = await seleccionar(ej, and(eq(sesion.claseId, claseId), eq(sesion.fecha, fecha)));
  return fila ?? null;
}

export async function listarDeFecha(ej: Ejecutor, fecha: FechaDia): Promise<Sesion[]> {
  return seleccionar(ej, eq(sesion.fecha, fecha));
}

// Devuelve null si ya existía una sesión para esa clase y fecha (dos pedidos a la vez).
export async function insertarSiNoExiste(ej: Ejecutor, datos: NuevaSesion): Promise<number | null> {
  const [fila] = await ej.insert(sesion).values(datos).onConflictDoNothing().returning({ id: sesion.id });
  return fila?.id ?? null;
}

export async function actualizar(
  ej: Ejecutor,
  id: number,
  cambios: { profesorId?: number; estado?: EstadoSesion },
): Promise<boolean> {
  if (Object.keys(cambios).length === 0) return (await buscarPorId(ej, id)) !== null;
  const filas = await ej.update(sesion).set(cambios).where(eq(sesion.id, id)).returning({ id: sesion.id });
  return filas.length > 0;
}

export type SesionBloqueada = {
  id: number;
  claseId: number;
  fecha: FechaDia;
  estado: EstadoSesion;
  profesorId: number;
};

// `for update`: mientras dura la transacción nadie más modifica la sesión.
export async function bloquear(ej: Ejecutor, id: number): Promise<SesionBloqueada | null> {
  const [fila] = await ej
    .select({
      id: sesion.id,
      claseId: sesion.claseId,
      fecha: sesion.fecha,
      estado: sesion.estado,
      profesorId: sesion.profesorId,
    })
    .from(sesion)
    .where(eq(sesion.id, id))
    .for('update');
  return fila ?? null;
}

export async function contarAsistencias(ej: Ejecutor, sesionId: number): Promise<number> {
  const [fila] = await ej.select({ total: count() }).from(asistencia).where(eq(asistencia.sesionId, sesionId));
  return fila?.total ?? 0;
}

// Una suplencia registrada después de tomar asistencia: el sueldo sigue a quien dio la clase.
export async function actualizarPorcentajeDeAsistencias(
  ej: Ejecutor,
  sesionId: number,
  porcentajeBp: number,
): Promise<void> {
  await ej.update(asistencia).set({ porcentajeBp }).where(eq(asistencia.sesionId, sesionId));
}

export async function buscarDetalle(ej: Ejecutor, id: number): Promise<SesionDetalle | null> {
  const [fila] = await ej
    .select({
      ...columnas,
      estilo: clase.estilo,
      nivel: clase.nivel,
      horaInicio: horaHHMM(clase.horaInicio),
      horaFin: horaHHMM(clase.horaFin),
    })
    .from(sesion)
    .innerJoin(profesor, eq(profesor.id, sesion.profesorId))
    .innerJoin(clase, eq(clase.id, sesion.claseId))
    .where(eq(sesion.id, id));
  return fila ?? null;
}
