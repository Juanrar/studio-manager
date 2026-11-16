import { and, asc, count, eq, gte, lte, not, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Clase, EstadoClase } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase, horario, pago, profesor, type Horario as FilaHorario, type NuevaClase } from '../../db/schema.ts';
import { horaHHMM } from '../../lib/postgres.ts';
import type { FechaDia } from '../../lib/fechas.ts';

const titular = alias(profesor, 'titular');

const COPIADAS_DEL_HORARIO = ['horaInicio', 'horaFin', 'estilo', 'nivel', 'profesorId'] as const;
type CopiadaDelHorario = (typeof COPIADAS_DEL_HORARIO)[number];

export type HorarioDeLaClase = Pick<FilaHorario, 'id' | 'diaSemana' | CopiadaDelHorario>;

export function copiadasDe(delHorario: HorarioDeLaClase): Pick<NuevaClase, CopiadaDelHorario> {
  return Object.fromEntries(COPIADAS_DEL_HORARIO.map((columna) => [columna, delHorario[columna]])) as Pick<
    NuevaClase,
    CopiadaDelHorario
  >;
}

const difiereDeSuHorario = sql<boolean>`(extract(isodow from ${clase.fecha}) <> ${horario.diaSemana}
  or ${sql.join(
    COPIADAS_DEL_HORARIO.map((columna) => sql`${clase[columna]} is distinct from ${horario[columna]}`),
    sql` or `,
  )}
  or ${clase.estado} <> 'programada')`;

const tieneCambios = (lunesActual: FechaDia) => sql<boolean>`case
  when ${clase.horarioId} is null then true
  when ${clase.semana} < ${lunesActual}::date then false
  else ${difiereDeSuHorario}
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

export async function insertarLasQueFaltan(ej: Ejecutor, filas: NuevaClase[]): Promise<number> {
  if (filas.length === 0) return 0;
  const creadas = await ej
    .insert(clase)
    .values(filas)
    .onConflictDoNothing({ target: [clase.horarioId, clase.semana] })
    .returning({ id: clase.id });
  return creadas.length;
}

export async function insertar(ej: Ejecutor, datos: NuevaClase): Promise<number> {
  const [fila] = await ej.insert(clase).values(datos).returning({ id: clase.id });
  return fila!.id;
}

export async function asignarHorario(ej: Ejecutor, id: number, horarioId: number): Promise<void> {
  await ej.update(clase).set({ horarioId }).where(eq(clase.id, id));
}

export async function borrar(ej: Ejecutor, id: number): Promise<void> {
  await ej.delete(clase).where(eq(clase.id, id));
}

export async function actualizar(
  ej: Ejecutor,
  id: number,
  cambios: {
    profesorId?: number;
    estado?: EstadoClase;
    fecha?: FechaDia;
    horaInicio?: string;
    horaFin?: string;
    estilo?: string;
    nivel?: string | null;
  },
): Promise<boolean> {
  if (Object.keys(cambios).length === 0) return (await bloquear(ej, id)) !== null;
  const filas = await ej.update(clase).set(cambios).where(eq(clase.id, id)).returning({ id: clase.id });
  return filas.length > 0;
}

export type ClaseBloqueada = {
  id: number;
  horarioId: number | null;
  semana: FechaDia;
  fecha: FechaDia;
  estado: EstadoClase;
  profesorId: number;
};

export async function bloquear(ej: Ejecutor, id: number): Promise<ClaseBloqueada | null> {
  const [fila] = await ej
    .select({
      id: clase.id,
      horarioId: clase.horarioId,
      semana: clase.semana,
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

export async function actualizarPorcentajeDeAsistencias(
  ej: Ejecutor,
  claseId: number,
  porcentajeBp: number,
): Promise<void> {
  await ej.update(asistencia).set({ porcentajeBp }).where(eq(asistencia.claseId, claseId));
}

export async function sinCambiosPropiosDesde(
  ej: Ejecutor,
  horarioId: number,
  desde: FechaDia,
): Promise<{ id: number; semana: FechaDia; fecha: FechaDia; profesorId: number }[]> {
  return ej
    .select({ id: clase.id, semana: clase.semana, fecha: clase.fecha, profesorId: clase.profesorId })
    .from(clase)
    .innerJoin(horario, eq(horario.id, clase.horarioId))
    .where(and(eq(clase.horarioId, horarioId), gte(clase.fecha, desde), not(difiereDeSuHorario)))
    .orderBy(asc(clase.fecha));
}

export async function copiarDelHorario(ej: Ejecutor, id: number, fecha: FechaDia): Promise<void> {
  const delHorario = Object.fromEntries(
    COPIADAS_DEL_HORARIO.map((columna) => [columna, sql`${horario[columna]}`]),
  ) as Record<CopiadaDelHorario, SQL>;
  await ej
    .update(clase)
    .set({ fecha, ...delHorario })
    .from(horario)
    .where(and(eq(clase.id, id), eq(horario.id, clase.horarioId)));
}

export async function hayAnotadosConPackQueVenceAntes(ej: Ejecutor, claseId: number, fecha: FechaDia): Promise<boolean> {
  const [fila] = await ej
    .select({ id: asistencia.id })
    .from(asistencia)
    .innerJoin(pago, eq(pago.id, asistencia.pagoId))
    .where(and(eq(asistencia.claseId, claseId), sql`${pago.venceEl} < ${fecha}::date`))
    .limit(1);
  return fila !== undefined;
}

export async function primeraConAsistenciasDesde(ej: Ejecutor, horarioId: number, desde: FechaDia): Promise<FechaDia | null> {
  const [fila] = await ej
    .select({ fecha: clase.fecha })
    .from(clase)
    .innerJoin(asistencia, eq(asistencia.claseId, clase.id))
    .where(and(eq(clase.horarioId, horarioId), gte(clase.fecha, desde)))
    .orderBy(asc(clase.fecha))
    .limit(1);
  return fila?.fecha ?? null;
}

export async function borrarDesde(ej: Ejecutor, horarioId: number, desde: FechaDia): Promise<void> {
  await ej.delete(clase).where(and(eq(clase.horarioId, horarioId), gte(clase.fecha, desde)));
}
