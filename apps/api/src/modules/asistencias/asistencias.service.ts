import { SIN_CLASES_DISPONIBLES, type Asistencia, type RegistrarAsistenciaInput } from '@studio/shared';
import { db } from '../../db/client.ts';
import { dividirEnPartes } from '../../lib/dinero.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
import { obtenerAlumno } from '../alumnos/alumnos.service.ts';
import { bloquearSesion } from '../clases/sesiones.service.ts';
import { verificarMesAbierto } from '../liquidaciones/liquidaciones.service.ts';
import { elegirPagoParaAsistencia, registrarPagoEn } from '../pagos/pagos.service.ts';
import { porcentajeVigente } from '../profesores/profesores.service.ts';
import * as repo from './asistencias.repository.ts';

export async function registrarAsistencia(
  sesionId: number,
  datos: RegistrarAsistenciaInput,
  usuarioId: number,
  ahora: Date,
  hoy: FechaDia,
): Promise<Asistencia> {
  const alumno = await obtenerAlumno(datos.alumnoId);
  const nombreCompleto = `${alumno.nombre} ${alumno.apellido}`;
  if (!alumno.activo) throw new ReglaDeNegocioError(`El alumno ${nombreCompleto} está dado de baja`);

  const id = await db.transaction(async (tx) => {
    const sesion = await bloquearSesion(tx, sesionId);
    if (sesion.estado === 'cancelada') throw new ReglaDeNegocioError('La clase está cancelada');
    await verificarMesAbierto(tx, sesion.profesorId, sesion.fecha);

    let pago = await elegirPagoParaAsistencia(tx, alumno.id, sesion.fecha);
    if (pago === null) {
      if (datos.cobrar === undefined) {
        throw new ReglaDeNegocioError(
          `${nombreCompleto} no tiene clases disponibles para el ${sesion.fecha}`,
          SIN_CLASES_DISPONIBLES,
        );
      }
      pago = await registrarPagoEn(tx, { alumnoId: alumno.id, ...datos.cobrar }, usuarioId, ahora, hoy);
    }

    const porcentajeBp = await porcentajeVigente(tx, sesion.profesorId, sesion.fecha);
    try {
      return await repo.insertar(tx, {
        sesionId: sesion.id,
        alumnoId: alumno.id,
        pagoId: pago.id,
        valorClase: dividirEnPartes(pago.monto, pago.cantidadClases),
        porcentajeBp,
        registradoPor: usuarioId,
        registradoEn: ahora,
      });
    } catch (error) {
      if (esViolacionUnica(error, 'asistencia_sesion_alumno_uq')) {
        throw new ReglaDeNegocioError(`${nombreCompleto} ya tiene la asistencia registrada en esta clase`);
      }
      throw error;
    }
  });

  return obtenerAsistencia(id);
}

export async function obtenerAsistencia(id: number): Promise<Asistencia> {
  const encontrada = await repo.buscarPorId(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la asistencia ${id}`);
  return encontrada;
}

export async function listarAsistenciasDeSesion(sesionId: number): Promise<Asistencia[]> {
  return repo.listarDeSesion(db, sesionId);
}

// Borrarla devuelve la clase al pack: las clases restantes se calculan contando asistencias.
export async function borrarAsistencia(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const sesion = await repo.buscarSesionDe(tx, id);
    if (sesion === null) throw new NoEncontradoError(`No existe la asistencia ${id}`);
    await verificarMesAbierto(tx, sesion.profesorId, sesion.fecha);
    await repo.borrar(tx, id);
  });
}
