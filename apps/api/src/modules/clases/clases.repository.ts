import { and, count, eq, sql, type SQL } from 'drizzle-orm';
import type { EstadoClase, Clase, ClaseDetalle } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, horario, profesor, clase, type NuevaClase } from '../../db/schema.ts';
import { horaHHMM } from '../../lib/postgres.ts';
import type { FechaDia } from '../../lib/fechas.ts';

const columnas = {
  id: clase.id,
  horarioId: clase.horarioId,
  fecha: clase.fecha,
  estado: clase.estado,
  profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
  asistentes: sql<number>`(select count(*) from ${asistencia} where ${asistencia.claseId} = ${clase.id})`.mapWith(Number),
};

function seleccionar(ej: Ejecutor, filtro: SQL | undefined) {
  return ej.select(columnas).from(clase).innerJoin(profesor, eq(profesor.id, clase.profesorId)).where(filtro);
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<Clase | null> {
  const [fila] = await seleccionar(ej, eq(clase.id, id));
  return fila ?? null;
}

export async function buscarPorHorarioYFecha(ej: Ejecutor, horarioId: number, fecha: FechaDia): Promise<Clase | null> {
  const [fila] = await seleccionar(ej, and(eq(clase.horarioId, horarioId), eq(clase.fecha, fecha)));
  return fila ?? null;
}

export async function listarDeFecha(ej: Ejecutor, fecha: FechaDia): Promise<Clase[]> {
  return seleccionar(ej, eq(clase.fecha, fecha));
}

// Las que ya existían para ese horario y esa semana no se tocan. Devuelve cuántas se crearon.
export async function insertarLasQueFaltan(ej: Ejecutor, filas: NuevaClase[]): Promise<number> {
  if (filas.length === 0) return 0;
  const creadas = await ej
    .insert(clase)
    .values(filas)
    .onConflictDoNothing({ target: [clase.horarioId, clase.semana] })
    .returning({ id: clase.id });
  return creadas.length;
}

// Devuelve null si ya existía una clase para ese horario y fecha (dos pedidos a la vez).
export async function insertarSiNoExiste(ej: Ejecutor, datos: NuevaClase): Promise<number | null> {
  const [fila] = await ej.insert(clase).values(datos).onConflictDoNothing().returning({ id: clase.id });
  return fila?.id ?? null;
}

export async function actualizar(
  ej: Ejecutor,
  id: number,
  cambios: { profesorId?: number; estado?: EstadoClase },
): Promise<boolean> {
  if (Object.keys(cambios).length === 0) return (await buscarPorId(ej, id)) !== null;
  const filas = await ej.update(clase).set(cambios).where(eq(clase.id, id)).returning({ id: clase.id });
  return filas.length > 0;
}

export type ClaseBloqueada = {
  id: number;
  horarioId: number | null;
  fecha: FechaDia;
  estado: EstadoClase;
  profesorId: number;
};

// `for update`: mientras dura la transacción nadie más modifica la clase.
export async function bloquear(ej: Ejecutor, id: number): Promise<ClaseBloqueada | null> {
  const [fila] = await ej
    .select({
      id: clase.id,
      horarioId: clase.horarioId,
      fecha: clase.fecha,
      estado: clase.estado,
      profesorId: clase.profesorId,
    })
    .from(clase)
    .where(eq(clase.id, id))
    .for('update');
  return fila ?? null;
}

export async function contarAsistencias(ej: Ejecutor, claseId: number): Promise<number> {
  const [fila] = await ej.select({ total: count() }).from(asistencia).where(eq(asistencia.claseId, claseId));
  return fila?.total ?? 0;
}

// Una suplencia registrada después de tomar asistencia: el sueldo sigue a quien dio la clase.
export async function actualizarPorcentajeDeAsistencias(
  ej: Ejecutor,
  claseId: number,
  porcentajeBp: number,
): Promise<void> {
  await ej.update(asistencia).set({ porcentajeBp }).where(eq(asistencia.claseId, claseId));
}

export async function buscarDetalle(ej: Ejecutor, id: number): Promise<ClaseDetalle | null> {
  const [fila] = await ej
    .select({
      ...columnas,
      estilo: horario.estilo,
      nivel: horario.nivel,
      horaInicio: horaHHMM(horario.horaInicio),
      horaFin: horaHHMM(horario.horaFin),
    })
    .from(clase)
    .innerJoin(profesor, eq(profesor.id, clase.profesorId))
    .innerJoin(horario, eq(horario.id, clase.horarioId))
    .where(eq(clase.id, id));
  return fila ?? null;
}
