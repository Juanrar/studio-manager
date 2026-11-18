import { and, count, eq, exists, gte, lt, lte, ne, or } from 'drizzle-orm';
import type { Ejecutor } from '../../db/client.ts';
import { asistencia, clase, horario } from '../../db/schema.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { horaHHMM } from '../../lib/postgres.ts';

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

export type ClaseDelProfesor = {
  id: number;
  estado: 'programada' | 'dictada' | 'cancelada';
  fecha: FechaDia;
  horarioId: number | null;
  titularId: number | null;
  estilo: string | null;
  diaSemana: number | null;
  horaInicio: string | null;
};

export async function listarClasesDelProfesor(
  ej: Ejecutor,
  profesorId: number,
  desde: FechaDia,
  hasta: FechaDia,
): Promise<ClaseDelProfesor[]> {
  return ej
    .select({
      id: clase.id,
      estado: clase.estado,
      fecha: clase.fecha,
      horarioId: clase.horarioId,
      titularId: horario.profesorId,
      estilo: horario.estilo,
      diaSemana: horario.diaSemana,
      horaInicio: horaHHMM(horario.horaInicio),
    })
    .from(clase)
    .leftJoin(horario, eq(horario.id, clase.horarioId))
    .where(and(eq(clase.profesorId, profesorId), gte(clase.fecha, desde), lt(clase.fecha, hasta)));
}

export type AsistenciaDeClase = { claseId: number; alumnoId: number; valorClase: number; porcentajeBp: number };

export async function listarAsistenciasDelProfesor(
  ej: Ejecutor,
  profesorId: number,
  desde: FechaDia,
  hasta: FechaDia,
): Promise<AsistenciaDeClase[]> {
  return ej
    .select({
      claseId: asistencia.claseId,
      alumnoId: asistencia.alumnoId,
      valorClase: asistencia.valorClase,
      porcentajeBp: asistencia.porcentajeBp,
    })
    .from(asistencia)
    .innerJoin(clase, eq(clase.id, asistencia.claseId))
    .where(and(eq(clase.profesorId, profesorId), gte(clase.fecha, desde), lt(clase.fecha, hasta)));
}

export async function contarSuplenciasRecibidas(
  ej: Ejecutor,
  profesorId: number,
  desde: FechaDia,
  hasta: FechaDia,
  hoy: FechaDia,
): Promise<number> {
  const [fila] = await ej
    .select({ total: count() })
    .from(clase)
    .innerJoin(horario, eq(horario.id, clase.horarioId))
    .where(
      and(
        eq(horario.profesorId, profesorId),
        ne(clase.profesorId, profesorId),
        ne(clase.estado, 'cancelada'),
        gte(clase.fecha, desde),
        lt(clase.fecha, hasta),
        or(
          lte(clase.fecha, hoy),
          exists(ej.select({ uno: asistencia.id }).from(asistencia).where(eq(asistencia.claseId, clase.id))),
        ),
      ),
    );
  return fila?.total ?? 0;
}
