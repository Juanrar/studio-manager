import { and, asc, count, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Clase, EstadoClase } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase, horario, profesor, type NuevaClase } from '../../db/schema.ts';
import { horaHHMM } from '../../lib/postgres.ts';
import type { FechaDia } from '../../lib/fechas.ts';

const titular = alias(profesor, 'titular');

// Una clase tiene cambios propios si difiere de su horario. Solo se mira de la semana actual en
// adelante: una clase pasada se compararía con el horario de hoy. Una clase única, sin horario, existe
// solo esa semana.
const tieneCambios = (lunesActual: FechaDia) => sql<boolean>`case
  when ${clase.horarioId} is null then true
  when ${clase.semana} < ${lunesActual}::date then false
  else extract(isodow from ${clase.fecha}) <> ${horario.diaSemana}
    or ${clase.horaInicio} <> ${horario.horaInicio}
    or ${clase.horaFin} <> ${horario.horaFin}
    or ${clase.estilo} <> ${horario.estilo}
    or ${clase.nivel} is distinct from ${horario.nivel}
    or ${clase.profesorId} <> ${horario.profesorId}
    or ${clase.estado} <> 'programada'
end`;

const columnas = (lunesActual: FechaDia) => ({
  id: clase.id,
  horarioId: clase.horarioId,
  fecha: clase.fecha,
  horaInicio: horaHHMM(clase.horaInicio),
  horaFin: horaHHMM(clase.horaFin),
  estilo: clase.estilo,
  nivel: clase.nivel,
  estado: clase.estado,
  profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
  profesorTitular: { id: titular.id, nombre: titular.nombre, apellido: titular.apellido },
  tieneCambios: tieneCambios(lunesActual),
  asistentes: sql<number>`(select count(*) from ${asistencia} where ${asistencia.claseId} = ${clase.id})`.mapWith(Number),
});

function seleccionar(ej: Ejecutor, lunesActual: FechaDia, filtro: SQL | undefined) {
  return ej
    .select(columnas(lunesActual))
    .from(clase)
    .innerJoin(profesor, eq(profesor.id, clase.profesorId))
    .leftJoin(horario, eq(horario.id, clase.horarioId))
    .leftJoin(titular, eq(titular.id, horario.profesorId))
    .where(filtro)
    .orderBy(asc(clase.fecha), asc(clase.horaInicio), asc(clase.id));
}

export async function buscarPorId(ej: Ejecutor, id: number, lunesActual: FechaDia): Promise<Clase | null> {
  const [fila] = await seleccionar(ej, lunesActual, eq(clase.id, id));
  return fila ?? null;
}

export async function listarRango(ej: Ejecutor, desde: FechaDia, hasta: FechaDia, lunesActual: FechaDia): Promise<Clase[]> {
  return seleccionar(ej, lunesActual, and(gte(clase.fecha, desde), lte(clase.fecha, hasta)));
}

export async function buscarIdPorHorarioYFecha(ej: Ejecutor, horarioId: number, fecha: FechaDia): Promise<number | null> {
  const [fila] = await ej
    .select({ id: clase.id })
    .from(clase)
    .where(and(eq(clase.horarioId, horarioId), eq(clase.fecha, fecha)));
  return fila?.id ?? null;
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
  if (Object.keys(cambios).length === 0) return (await bloquear(ej, id)) !== null;
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
