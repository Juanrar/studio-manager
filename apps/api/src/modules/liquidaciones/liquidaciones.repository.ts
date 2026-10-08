import { and, asc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { Liquidacion } from '@studio/shared';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase, liquidacion, profesor, type NuevaLiquidacion } from '../../db/schema.ts';
import type { FechaDia } from '../../lib/fechas.ts';

// Este módulo es de reportes: lee asistencias y clases para sumar, nunca las modifica.
export type AsistenciaLiquidable = {
  profesorId: number;
  claseId: number;
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
  const filtros: SQL[] = [gte(clase.fecha, desde), lt(clase.fecha, hasta)];
  if (profesorId !== undefined) filtros.push(eq(clase.profesorId, profesorId));
  return ej
    .select({
      profesorId: clase.profesorId,
      claseId: clase.id,
      fecha: clase.fecha,
      // El estilo de la clase y no el del horario: el detalle de un mes no cambia si después cambia el horario.
      estilo: clase.estilo,
      valorClase: asistencia.valorClase,
      porcentajeBp: asistencia.porcentajeBp,
    })
    .from(asistencia)
    .innerJoin(clase, eq(clase.id, asistencia.claseId))
    .where(and(...filtros))
    .orderBy(asc(clase.fecha), asc(clase.id));
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
