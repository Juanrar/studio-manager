import { and, asc, count, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Clase, EstadoClase } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase, horario, pago, profesor, type NuevaClase } from '../../db/schema.ts';
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

export async function insertar(ej: Ejecutor, datos: NuevaClase): Promise<number> {
  const [fila] = await ej.insert(clase).values(datos).returning({ id: clase.id });
  return fila!.id;
}

export async function borrar(ej: Ejecutor, id: number): Promise<void> {
  await ej.delete(clase).where(eq(clase.id, id));
}

// Devuelve null si ya existía una clase para ese horario y fecha (dos pedidos a la vez).
export async function insertarSiNoExiste(ej: Ejecutor, datos: NuevaClase): Promise<number | null> {
  const [fila] = await ej.insert(clase).values(datos).onConflictDoNothing().returning({ id: clase.id });
  return fila?.id ?? null;
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

// `for update`: mientras dura la transacción nadie más modifica la clase.
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

// Una suplencia registrada después de tomar asistencia: el sueldo sigue a quien dio la clase.
export async function actualizarPorcentajeDeAsistencias(
  ej: Ejecutor,
  claseId: number,
  porcentajeBp: number,
): Promise<void> {
  await ej.update(asistencia).set({ porcentajeBp }).where(eq(asistencia.claseId, claseId));
}

// Lo que una clase copia de su horario: con esto se compara si sigue igual y se la actualiza.
export type DatosDeHorario = {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  estilo: string;
  nivel: string | null;
  profesorId: number;
};

// Las clases de un horario desde `desde` que todavía son iguales a él: las que no tienen cambios propios.
export async function igualesAlHorario(
  ej: Ejecutor,
  horarioId: number,
  datos: DatosDeHorario,
  desde: FechaDia,
): Promise<{ id: number; semana: FechaDia; fecha: FechaDia }[]> {
  return ej
    .select({ id: clase.id, semana: clase.semana, fecha: clase.fecha })
    .from(clase)
    .where(
      and(
        eq(clase.horarioId, horarioId),
        gte(clase.fecha, desde),
        sql`extract(isodow from ${clase.fecha}) = ${datos.diaSemana}`,
        eq(clase.horaInicio, datos.horaInicio),
        eq(clase.horaFin, datos.horaFin),
        eq(clase.estilo, datos.estilo),
        datos.nivel === null ? isNull(clase.nivel) : eq(clase.nivel, datos.nivel),
        eq(clase.profesorId, datos.profesorId),
        eq(clase.estado, 'programada'),
      ),
    )
    .orderBy(asc(clase.fecha));
}

export async function copiarDelHorario(
  ej: Ejecutor,
  id: number,
  fecha: FechaDia,
  datos: Omit<DatosDeHorario, 'diaSemana'>,
): Promise<void> {
  await ej.update(clase).set({ fecha, ...datos }).where(eq(clase.id, id));
}

// Si algún anotado pagó con un pack que vence antes de `fecha`, la clase no puede pasar a ese día.
export async function hayAnotadosConPackQueVenceAntes(ej: Ejecutor, claseId: number, fecha: FechaDia): Promise<boolean> {
  const [fila] = await ej
    .select({ id: asistencia.id })
    .from(asistencia)
    .innerJoin(pago, eq(pago.id, asistencia.pagoId))
    .where(and(eq(asistencia.claseId, claseId), sql`${pago.venceEl} < ${fecha}::date`))
    .limit(1);
  return fila !== undefined;
}

// La primera clase de un horario desde `desde` con alguien anotado, o null.
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

// Borra las clases de un horario desde `desde`. Quien la llama ya verificó que no tienen asistencias:
// una clase futura sin asistencias no tiene historial.
export async function borrarDesde(ej: Ejecutor, horarioId: number, desde: FechaDia): Promise<void> {
  await ej.delete(clase).where(and(eq(clase.horarioId, horarioId), gte(clase.fecha, desde)));
}
