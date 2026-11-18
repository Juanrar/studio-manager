import { and, eq, gte, lt } from 'drizzle-orm';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase } from '../../db/schema.ts';
import type { FechaDia } from '../../lib/fechas.ts';

export type AsistenciaDelDia = { fecha: FechaDia; alumnoId: number };

export async function listarAsistenciasDelPeriodo(
  ej: Ejecutor,
  desde: FechaDia,
  hasta: FechaDia,
): Promise<AsistenciaDelDia[]> {
  return ej
    .select({ fecha: clase.fecha, alumnoId: asistencia.alumnoId })
    .from(asistencia)
    .innerJoin(clase, eq(clase.id, asistencia.claseId))
    .where(and(gte(clase.fecha, desde), lt(clase.fecha, hasta)));
}
