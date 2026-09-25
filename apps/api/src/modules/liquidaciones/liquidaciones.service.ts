import type { DetalleSesion, Liquidacion, ResumenDelPeriodo } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { aplicarPorcentaje } from '../../lib/dinero.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { periodoDe, rangoDelPeriodo, type FechaDia, type Periodo } from '../../lib/fechas.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
import { listarProfesores, obtenerProfesor } from '../profesores/profesores.service.ts';
import * as repo from './liquidaciones.repository.ts';

// La parte del profesor se calcula por asistencia, con el porcentaje que quedó guardado en cada una.
function montoDe(asistencias: repo.AsistenciaLiquidable[]): number {
  return asistencias.reduce((total, a) => total + aplicarPorcentaje(a.valorClase, a.porcentajeBp), 0);
}

export async function resumenDelPeriodo(periodo: Periodo, hoy: FechaDia): Promise<ResumenDelPeriodo> {
  const { desde, hasta } = rangoDelPeriodo(periodo);
  const [profesores, asistencias, liquidaciones] = await Promise.all([
    listarProfesores(true, hoy),
    repo.listarAsistenciasDelPeriodo(db, desde, hasta),
    repo.listarDelPeriodo(db, desde),
  ]);

  const porProfesor = Map.groupBy(asistencias, (a) => a.profesorId);
  const liquidacionPorProfesor = new Map(liquidaciones.map((l) => [l.profesorId, l]));

  return {
    periodo,
    items: profesores
      .filter((p) => p.activo || porProfesor.has(p.id))
      .map((p) => {
        const suyas = porProfesor.get(p.id) ?? [];
        return {
          profesor: { id: p.id, nombre: p.nombre, apellido: p.apellido },
          asistencias: suyas.length,
          montoCalculado: montoDe(suyas),
          liquidacion: liquidacionPorProfesor.get(p.id) ?? null,
        };
      }),
  };
}

export async function detalleDelPeriodo(profesorId: number, periodo: Periodo): Promise<DetalleSesion[]> {
  const { desde, hasta } = rangoDelPeriodo(periodo);
  const asistencias = await repo.listarAsistenciasDelPeriodo(db, desde, hasta, profesorId);
  const porSesion = Map.groupBy(asistencias, (a) => a.sesionId);
  return [...porSesion.values()].map((deLaSesion) => {
    const primera = deLaSesion[0]!;
    return {
      sesionId: primera.sesionId,
      fecha: primera.fecha,
      estilo: primera.estilo,
      asistentes: deLaSesion.length,
      monto: montoDe(deLaSesion),
    };
  });
}

export async function cerrarLiquidacion(
  profesorId: number,
  periodo: Periodo,
  usuarioId: number,
  hoy: FechaDia,
): Promise<Liquidacion> {
  const { desde, hasta } = rangoDelPeriodo(periodo);
  if (hoy < hasta) throw new ReglaDeNegocioError(`El período ${periodo} todavía no terminó`);

  const profesor = await obtenerProfesor(profesorId, hoy);
  const asistencias = await repo.listarAsistenciasDelPeriodo(db, desde, hasta, profesorId);
  try {
    return await repo.insertar(db, {
      profesorId,
      periodo: desde,
      monto: montoDe(asistencias),
      registradoPor: usuarioId,
    });
  } catch (error) {
    if (esViolacionUnica(error, 'liquidacion_profesor_periodo_uq')) {
      throw new ReglaDeNegocioError(
        `La liquidación de ${periodo} de ${profesor.nombre} ${profesor.apellido} ya está cerrada`,
      );
    }
    throw error;
  }
}

export async function marcarPagada(id: number, ahora: Date): Promise<Liquidacion> {
  const liquidacion = await repo.marcarPagada(db, id, ahora);
  if (liquidacion === null) throw new NoEncontradoError(`No existe la liquidación ${id}`);
  return liquidacion;
}

// Asistencias y sesiones la llaman antes de tocar algo que cambia el sueldo de un profesor.
export async function verificarMesAbierto(ej: Ejecutor, profesorId: number, fecha: FechaDia): Promise<void> {
  const periodo = periodoDe(fecha);
  const cerrada = await repo.buscarCerrada(ej, profesorId, `${periodo}-01`);
  if (cerrada !== null) {
    throw new ReglaDeNegocioError(
      `La liquidación de ${periodo} de ${cerrada.nombre} ${cerrada.apellido} ya está cerrada`,
    );
  }
}
