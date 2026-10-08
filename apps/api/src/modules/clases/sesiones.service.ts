import type { ActualizarSesionInput, AgendaDelDia, Sesion, SesionDetalle } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { diaSemanaIso, type FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { verificarMesAbierto } from '../liquidaciones/liquidaciones.service.ts';
import { listarHorariosDelDia, obtenerHorario } from '../horarios/horarios.service.ts';
import { porcentajeVigente, verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './sesiones.repository.ts';

export async function agendaDelDia(fecha: FechaDia): Promise<AgendaDelDia> {
  const [horarios, sesiones] = await Promise.all([
    listarHorariosDelDia(diaSemanaIso(fecha)),
    repo.listarDeFecha(db, fecha),
  ]);
  const sesionPorHorario = new Map(sesiones.map((s) => [s.horarioId, s]));

  return {
    fecha,
    items: horarios.map((horario) => ({
      horarioId: horario.id,
      estilo: horario.estilo,
      nivel: horario.nivel,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
      profesorTitular: horario.profesor,
      sesion: sesionPorHorario.get(horario.id) ?? null,
    })),
  };
}

// Abrir dos veces la misma sesión devuelve la existente: un doble clic no es un error.
export async function abrirSesion(horarioId: number, fecha: FechaDia): Promise<{ sesion: Sesion; creada: boolean }> {
  const horario = await obtenerHorario(horarioId);
  if (!horario.activo) throw new ReglaDeNegocioError(`El horario de ${horario.estilo} está dado de baja`);
  if (diaSemanaIso(fecha) !== horario.diaSemana) {
    throw new ReglaDeNegocioError(`El horario de ${horario.estilo} no se dicta el ${fecha}`);
  }

  const existente = await repo.buscarPorHorarioYFecha(db, horarioId, fecha);
  if (existente !== null) return { sesion: existente, creada: false };

  const id = await repo.insertarSiNoExiste(db, { horarioId, fecha, profesorId: horario.profesor.id });
  const sesion = await repo.buscarPorHorarioYFecha(db, horarioId, fecha);
  return { sesion: sesion!, creada: id !== null };
}

export async function actualizarSesion(id: number, datos: ActualizarSesionInput): Promise<Sesion> {
  await db.transaction(async (tx) => {
    const actual = await bloquearSesion(tx, id);

    if (datos.estado === 'cancelada' && (await repo.contarAsistencias(tx, id)) > 0) {
      throw new ReglaDeNegocioError('La clase tiene asistencias registradas. Borralas antes de cancelarla');
    }

    if (datos.profesorId !== undefined && datos.profesorId !== actual.profesorId) {
      // La suplencia mueve el sueldo de esta clase de un profesor a otro: los dos meses tienen que estar abiertos.
      await verificarMesAbierto(tx, actual.profesorId, actual.fecha);
      await verificarMesAbierto(tx, datos.profesorId, actual.fecha);
      await verificarProfesorActivo(tx, datos.profesorId);
      const porcentajeBp = await porcentajeVigente(tx, datos.profesorId, actual.fecha);
      await repo.actualizarPorcentajeDeAsistencias(tx, id, porcentajeBp);
    }

    await repo.actualizar(tx, id, sinIndefinidos(datos));
  });
  return obtenerSesion(id);
}

export async function obtenerSesion(id: number): Promise<Sesion> {
  const encontrada = await repo.buscarPorId(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la sesión ${id}`);
  return encontrada;
}

// La usa asistencias dentro de su transacción.
export async function bloquearSesion(ej: Ejecutor, id: number): Promise<repo.SesionBloqueada> {
  const encontrada = await repo.bloquear(ej, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la sesión ${id}`);
  return encontrada;
}

export async function obtenerDetalleDeSesion(id: number): Promise<SesionDetalle> {
  const encontrada = await repo.buscarDetalle(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la sesión ${id}`);
  return encontrada;
}
