import { and, asc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { Liquidacion } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase, liquidacion, profesor, sesion, type NuevaLiquidacion } from '../../db/schema.ts';
import type { FechaDia } from '../../lib/fechas.ts';

// Este módulo es de reportes: lee asistencias y sesiones para sumar, nunca las modifica.
export type AsistenciaLiquidable = {
  profesorId: number;
  sesionId: number;
  fecha: FechaDia;
  estilo: string;
  valorClase: number;
  porcentajeBp: number;
};

export async function listarAsistenciasDelPeriodo(
  ej: Ejecutor,
  desde: FechaDia,
  hasta: FechaDia,
  profesorId?: number,
): Promise<AsistenciaLiquidable[]> {
  const filtros: SQL[] = [gte(sesion.fecha, desde), lt(sesion.fecha, hasta)];
  if (profesorId !== undefined) filtros.push(eq(sesion.profesorId, profesorId));
  return ej
    .select({
      profesorId: sesion.profesorId,
      sesionId: sesion.id,
      fecha: sesion.fecha,
      estilo: clase.estilo,
      valorClase: asistencia.valorClase,
      porcentajeBp: asistencia.porcentajeBp,
    })
    .from(asistencia)
    .innerJoin(sesion, eq(sesion.id, asistencia.sesionId))
    .innerJoin(clase, eq(clase.id, sesion.claseId))
    .where(and(...filtros))
    .orderBy(asc(sesion.fecha), asc(sesion.id));
}

const columnas = {
  id: liquidacion.id,
  profesorId: liquidacion.profesorId,
  periodo: liquidacion.periodo,
  monto: liquidacion.monto,
  pagadoEn: liquidacion.pagadoEn,
};

type FilaLiquidacion = { id: number; profesorId: number; periodo: string; monto: number; pagadoEn: Date | null };

export function aLiquidacion(fila: FilaLiquidacion): Liquidacion {
  return { ...fila, periodo: fila.periodo.slice(0, 7), pagadoEn: fila.pagadoEn?.toISOString() ?? null };
}

export async function listarDelPeriodo(ej: Ejecutor, primerDia: FechaDia): Promise<Liquidacion[]> {
  const filas = await ej.select(columnas).from(liquidacion).where(eq(liquidacion.periodo, primerDia));
  return filas.map(aLiquidacion);
}

export async function buscarCerrada(
  ej: Ejecutor,
  profesorId: number,
  primerDia: FechaDia,
): Promise<{ nombre: string; apellido: string } | null> {
  const [fila] = await ej
    .select({ nombre: profesor.nombre, apellido: profesor.apellido })
    .from(liquidacion)
    .innerJoin(profesor, eq(profesor.id, liquidacion.profesorId))
    .where(and(eq(liquidacion.profesorId, profesorId), eq(liquidacion.periodo, primerDia)));
  return fila ?? null;
}

export async function insertar(ej: Ejecutor, datos: NuevaLiquidacion): Promise<Liquidacion> {
  const [fila] = await ej.insert(liquidacion).values(datos).returning(columnas);
  return aLiquidacion(fila!);
}

export async function marcarPagada(ej: Ejecutor, id: number, ahora: Date): Promise<Liquidacion | null> {
  const [fila] = await ej
    .update(liquidacion)
    .set({ pagadoEn: ahora })
    .where(eq(liquidacion.id, id))
    .returning(columnas);
  return fila ? aLiquidacion(fila) : null;
}
