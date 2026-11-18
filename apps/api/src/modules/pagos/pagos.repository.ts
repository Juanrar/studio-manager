import { and, asc, count, desc, eq, gte, inArray, isNull, lt, max, sql, type SQL } from 'drizzle-orm';
import type { Ejecutor } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { asistencia, pack, pago, usuario, type NuevoPago } from '../../db/schema.ts';
import type { PagoDeAlumno } from './estado-del-pack.ts';

export const clasesUsadasSql = sql<number>`(
  select count(*) from ${asistencia} where ${asistencia.pagoId} = ${pago.id}
)`.mapWith(Number);

const columnas = {
  id: pago.id,
  alumnoId: pago.alumnoId,
  pack: { id: pack.id, nombre: pack.nombre },
  cantidadClases: pago.cantidadClases,
  clasesUsadas: clasesUsadasSql,
  monto: pago.monto,
  medio: pago.medio,
  fecha: pago.fecha,
  venceEl: pago.venceEl,
  anuladoEn: pago.anuladoEn,
  motivoAnulacion: pago.motivoAnulacion,
  registradoPor: { id: usuario.id, nombre: usuario.nombre },
};

export type FilaPago = {
  id: number;
  alumnoId: number;
  pack: { id: number; nombre: string };
  cantidadClases: number;
  clasesUsadas: number;
  monto: number;
  medio: NuevoPago['medio'];
  fecha: Date;
  venceEl: string;
  anuladoEn: Date | null;
  motivoAnulacion: string | null;
  registradoPor: { id: number; nombre: string };
};

function seleccionar(ej: Ejecutor, filtro: SQL) {
  return ej
    .select(columnas)
    .from(pago)
    .innerJoin(pack, eq(pack.id, pago.packId))
    .innerJoin(usuario, eq(usuario.id, pago.registradoPor))
    .where(filtro);
}

export async function insertar(ej: Ejecutor, datos: NuevoPago): Promise<number> {
  const [fila] = await ej.insert(pago).values(datos).returning({ id: pago.id });
  return fila!.id;
}

export async function buscarPorId(ej: Ejecutor, id: number): Promise<FilaPago | null> {
  const [fila] = await seleccionar(ej, eq(pago.id, id));
  return fila ?? null;
}

export async function listarDeAlumno(ej: Ejecutor, alumnoId: number): Promise<FilaPago[]> {
  return seleccionar(ej, eq(pago.alumnoId, alumnoId)).orderBy(desc(pago.fecha), desc(pago.id));
}

export async function bloquear(
  ej: Ejecutor,
  id: number,
): Promise<{ id: number; fecha: Date; anuladoEn: Date | null } | null> {
  const [fila] = await ej
    .select({ id: pago.id, fecha: pago.fecha, anuladoEn: pago.anuladoEn })
    .from(pago)
    .where(eq(pago.id, id))
    .for('update');
  return fila ?? null;
}

export async function actualizar(
  ej: Ejecutor,
  id: number,
  cambios: Partial<Pick<NuevoPago, 'anuladoEn' | 'motivoAnulacion' | 'venceEl'>>,
): Promise<void> {
  await ej.update(pago).set(cambios).where(eq(pago.id, id));
}

export type PagoUsable = { id: number; monto: number; cantidadClases: number };

export async function bloquearValidos(ej: Ejecutor, alumnoId: number, fecha: FechaDia): Promise<PagoUsable[]> {
  return ej
    .select({ id: pago.id, monto: pago.monto, cantidadClases: pago.cantidadClases })
    .from(pago)
    .where(and(eq(pago.alumnoId, alumnoId), isNull(pago.anuladoEn), gte(pago.venceEl, fecha)))
    .orderBy(asc(pago.venceEl), asc(pago.fecha), asc(pago.id))
    .for('update');
}

export async function listarParaEstadoDelPack(
  ej: Ejecutor,
  alumnoIds: number[],
  hoy: FechaDia,
): Promise<(PagoDeAlumno & { alumnoId: number })[]> {
  if (alumnoIds.length === 0) return [];
  const columnasDelEstado = {
    id: pago.id,
    alumnoId: pago.alumnoId,
    pack: pack.nombre,
    cantidadClases: pago.cantidadClases,
    clasesUsadas: clasesUsadasSql,
    venceEl: pago.venceEl,
  };
  const noAnulados = and(inArray(pago.alumnoId, alumnoIds), isNull(pago.anuladoEn));

  const sinVencer = await ej
    .select(columnasDelEstado)
    .from(pago)
    .innerJoin(pack, eq(pack.id, pago.packId))
    .where(and(noAnulados, gte(pago.venceEl, hoy)));
  const ultimos = await ej
    .selectDistinctOn([pago.alumnoId], columnasDelEstado)
    .from(pago)
    .innerJoin(pack, eq(pack.id, pago.packId))
    .where(noAnulados)
    .orderBy(pago.alumnoId, desc(pago.venceEl), desc(pago.id));

  const yaEstan = new Set(sinVencer.map((fila) => fila.id));
  return [...sinVencer, ...ultimos.filter((fila) => !yaEstan.has(fila.id))];
}

export async function listarComprasDeAlumnos(
  ej: Ejecutor,
  alumnoIds: number[],
  hoy: FechaDia,
): Promise<{ alumnoId: number; ultimaCompra: Date | null; sinVencer: boolean }[]> {
  if (alumnoIds.length === 0) return [];
  return ej
    .select({
      alumnoId: pago.alumnoId,
      ultimaCompra: max(pago.fecha),
      sinVencer: sql<boolean>`bool_or(${pago.venceEl} >= ${hoy})`,
    })
    .from(pago)
    .where(and(inArray(pago.alumnoId, alumnoIds), isNull(pago.anuladoEn)))
    .groupBy(pago.alumnoId);
}

export async function contarAsistencias(ej: Ejecutor, pagoId: number): Promise<number> {
  const [fila] = await ej.select({ total: count() }).from(asistencia).where(eq(asistencia.pagoId, pagoId));
  return fila?.total ?? 0;
}

export async function ingresosPorMedio(
  ej: Ejecutor,
  desde: FechaDia,
  hasta: FechaDia,
  tz: string,
): Promise<{ medio: NuevoPago['medio']; cantidad: number; total: number }[]> {
  const dia = sql`(${pago.fecha} at time zone ${tz})::date`;
  return ej
    .select({
      medio: pago.medio,
      cantidad: count(),
      total: sql<number>`coalesce(sum(${pago.monto}), 0)`.mapWith(Number),
    })
    .from(pago)
    .where(and(isNull(pago.anuladoEn), sql`${dia} >= ${desde}`, sql`${dia} < ${hasta}`))
    .groupBy(pago.medio)
    .orderBy(asc(pago.medio));
}

export async function cobradoPorDia(
  ej: Ejecutor,
  desde: FechaDia,
  hasta: FechaDia,
  tz: string,
): Promise<{ fecha: FechaDia; total: number }[]> {
  const dia = sql`(${pago.fecha} at time zone ${tz})::date`;
  return ej
    .select({
      fecha: sql<string>`to_char(${dia}, 'YYYY-MM-DD')`,
      total: sql<number>`sum(${pago.monto})`.mapWith(Number),
    })
    .from(pago)
    .where(and(isNull(pago.anuladoEn), sql`${dia} >= ${desde}`, sql`${dia} < ${hasta}`))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

export async function contarAlumnosNuevos(
  ej: Ejecutor,
  desde: FechaDia,
  hasta: FechaDia,
  tz: string,
): Promise<number> {
  const primerDia = sql`(min(${pago.fecha}) at time zone ${tz})::date`;
  const filas = await ej
    .select({ alumnoId: pago.alumnoId })
    .from(pago)
    .where(isNull(pago.anuladoEn))
    .groupBy(pago.alumnoId)
    .having(and(sql`${primerDia} >= ${desde}`, sql`${primerDia} < ${hasta}`));
  return filas.length;
}

export type PagoVencido = { monto: number; cantidadClases: number; clasesUsadas: number };

export async function listarVencidosEnElPeriodo(
  ej: Ejecutor,
  desde: FechaDia,
  hasta: FechaDia,
  hoy: FechaDia,
): Promise<PagoVencido[]> {
  return ej
    .select({ monto: pago.monto, cantidadClases: pago.cantidadClases, clasesUsadas: count(asistencia.id) })
    .from(pago)
    .leftJoin(asistencia, eq(asistencia.pagoId, pago.id))
    .where(and(isNull(pago.anuladoEn), gte(pago.venceEl, desde), lt(pago.venceEl, hasta), lt(pago.venceEl, hoy)))
    .groupBy(pago.id);
}
