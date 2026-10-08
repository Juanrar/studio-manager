import type { ActualizarClaseInput, AgendaDelDia, Clase, ClaseDetalle } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { diaSemanaIso, type FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { verificarMesAbierto } from '../liquidaciones/liquidaciones.service.ts';
import { listarHorariosDelDia, obtenerHorario } from '../horarios/horarios.service.ts';
import { porcentajeVigente, verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './clases.repository.ts';

export async function agendaDelDia(fecha: FechaDia): Promise<AgendaDelDia> {
  const [horarios, clases] = await Promise.all([
    listarHorariosDelDia(diaSemanaIso(fecha)),
    repo.listarDeFecha(db, fecha),
  ]);
  const clasePorHorario = new Map(clases.map((s) => [s.horarioId, s]));

  return {
    fecha,
    items: horarios.map((horario) => ({
      horarioId: horario.id,
      estilo: horario.estilo,
      nivel: horario.nivel,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
      profesorTitular: horario.profesor,
      clase: clasePorHorario.get(horario.id) ?? null,
    })),
  };
}

// Abrir dos veces la misma clase devuelve la existente: un doble clic no es un error.
export async function abrirClase(horarioId: number, fecha: FechaDia): Promise<{ clase: Clase; creada: boolean }> {
  const horario = await obtenerHorario(horarioId);
  if (!horario.activo) throw new ReglaDeNegocioError(`El horario de ${horario.estilo} está dado de baja`);
  if (diaSemanaIso(fecha) !== horario.diaSemana) {
    throw new ReglaDeNegocioError(`El horario de ${horario.estilo} no se dicta el ${fecha}`);
  }

  const existente = await repo.buscarPorHorarioYFecha(db, horarioId, fecha);
  if (existente !== null) return { clase: existente, creada: false };

  const id = await repo.insertarSiNoExiste(db, { horarioId, fecha, profesorId: horario.profesor.id });
  const clase = await repo.buscarPorHorarioYFecha(db, horarioId, fecha);
  return { clase: clase!, creada: id !== null };
}

export async function actualizarClase(id: number, datos: ActualizarClaseInput): Promise<Clase> {
  await db.transaction(async (tx) => {
    const actual = await bloquearClase(tx, id);

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
  return obtenerClase(id);
}

export async function obtenerClase(id: number): Promise<Clase> {
  const encontrada = await repo.buscarPorId(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la clase ${id}`);
  return encontrada;
}

// La usa asistencias dentro de su transacción.
export async function bloquearClase(ej: Ejecutor, id: number): Promise<repo.ClaseBloqueada> {
  const encontrada = await repo.bloquear(ej, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la clase ${id}`);
  return encontrada;
}

export async function obtenerDetalleDeClase(id: number): Promise<ClaseDetalle> {
  const encontrada = await repo.buscarDetalle(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la clase ${id}`);
  return encontrada;
}
