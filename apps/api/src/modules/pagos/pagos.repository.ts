import { desc, eq, sql, type SQL } from 'drizzle-orm';
import type { Ejecutor } from '../../db/client.ts';
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
