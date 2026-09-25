import { and, asc, count, desc, eq, gte, isNull, sql, type SQL } from 'drizzle-orm';
import type { Ejecutor } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { asistencia, pack, pago, usuario, type NuevoPago } from '../../db/schema.ts';

// Las clases usadas se cuentan cada vez: no hay un contador que se pueda desincronizar.
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

// Pagos no anulados y no vencidos en esa fecha, del que vence primero al último.
// `for update`: si otro registro está usando uno, se espera a que termine.
export async function bloquearValidos(ej: Ejecutor, alumnoId: number, fecha: FechaDia): Promise<PagoUsable[]> {
  return ej
    .select({ id: pago.id, monto: pago.monto, cantidadClases: pago.cantidadClases })
    .from(pago)
    .where(and(eq(pago.alumnoId, alumnoId), isNull(pago.anuladoEn), gte(pago.venceEl, fecha)))
    .orderBy(asc(pago.venceEl), asc(pago.fecha), asc(pago.id))
    .for('update');
}

export async function contarAsistencias(ej: Ejecutor, pagoId: number): Promise<number> {
  const [fila] = await ej.select({ total: count() }).from(asistencia).where(eq(asistencia.pagoId, pagoId));
  return fila?.total ?? 0;
}
