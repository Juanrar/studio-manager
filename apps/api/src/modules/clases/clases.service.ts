import type { ActualizarClaseInput, Clase, ClasesDelRango, CrearClaseUnicaInput } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { diaSemanaIso, finDelHorizonte, lunesDe, sumarDias, type FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionCheck } from '../../lib/postgres.ts';
import { verificarMesAbierto } from '../liquidaciones/liquidaciones.service.ts';
import { obtenerHorario } from '../horarios/horarios.service.ts';
import { porcentajeVigente, verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './clases.repository.ts';

export async function listarClases(desde: FechaDia, hasta: FechaDia, hoy: FechaDia): Promise<ClasesDelRango> {
  const items = await repo.listarRango(db, desde, hasta, lunesDe(hoy));
  return { desde, hasta, finDelHorizonte: finDelHorizonte(hoy), items };
}

export async function obtenerClase(id: number, hoy: FechaDia): Promise<Clase> {
  const encontrada = await repo.buscarPorId(db, id, lunesDe(hoy));
  if (encontrada === null) throw new NoEncontradoError(`No existe la clase ${id}`);
  return encontrada;
}

export type ClaseAbierta = { id: number; fecha: FechaDia };

export async function abrirClase(horarioId: number, fecha: FechaDia): Promise<{ clase: ClaseAbierta; creada: boolean }> {
  const horario = await obtenerHorario(horarioId);
  if (!horario.activo) throw new ReglaDeNegocioError(`El horario de ${horario.estilo} está dado de baja`);
  if (diaSemanaIso(fecha) !== horario.diaSemana) {
    throw new ReglaDeNegocioError(`El horario de ${horario.estilo} no se dicta el ${fecha}`);
  }

  const existente = await repo.buscarIdPorHorarioYFecha(db, horarioId, fecha);
  if (existente !== null) return { clase: { id: existente, fecha }, creada: false };

  const id = await repo.insertarSiNoExiste(db, {
    horarioId,
    semana: lunesDe(fecha),
    fecha,
    horaInicio: horario.horaInicio,
    horaFin: horario.horaFin,
    estilo: horario.estilo,
    nivel: horario.nivel,
    profesorId: horario.profesor.id,
  });
  const clase = await repo.buscarIdPorHorarioYFecha(db, horarioId, fecha);
  return { clase: { id: clase!, fecha }, creada: id !== null };
}

export async function actualizarClase(id: number, datos: ActualizarClaseInput, hoy: FechaDia): Promise<void> {
  await db.transaction(async (tx) => {
    const actual = await bloquearClase(tx, id);
    const fecha = datos.fecha ?? actual.fecha;
    const seMueve = [datos.fecha, datos.horaInicio, datos.horaFin, datos.estilo, datos.nivel].some((v) => v !== undefined);

    if (seMueve) {
      if (actual.fecha < hoy) {
        throw new ReglaDeNegocioError(`La clase del ${actual.fecha} ya pasó: se corrige desde la clase, no se mueve`);
      }
      const domingo = sumarDias(actual.semana, 6);
      if (fecha < actual.semana || fecha > domingo) {
        throw new ReglaDeNegocioError(`Una clase se mueve dentro de su semana: del ${actual.semana} al ${domingo}`);
      }
      if (fecha < hoy) throw new ReglaDeNegocioError('No se puede mover una clase a un día que ya pasó');
      if (fecha > actual.fecha && (await repo.hayAnotadosConPackQueVenceAntes(tx, id, fecha))) {
        throw new ReglaDeNegocioError(
          `La clase del ${actual.fecha} tiene alumnos anotados con un pack que vence antes del ${fecha}`,
        );
      }
    }

    if (datos.estado === 'cancelada' && (await repo.contarAsistencias(tx, id)) > 0) {
      throw new ReglaDeNegocioError('La clase tiene asistencias registradas. Borralas antes de cancelarla');
    }

    if (datos.profesorId !== undefined && datos.profesorId !== actual.profesorId) {
      await verificarMesAbierto(tx, actual.profesorId, actual.fecha);
      await verificarMesAbierto(tx, datos.profesorId, actual.fecha);
      await verificarProfesorActivo(tx, datos.profesorId);
      const porcentajeBp = await porcentajeVigente(tx, datos.profesorId, fecha);
      await repo.actualizarPorcentajeDeAsistencias(tx, id, porcentajeBp);
    }

    try {
      await repo.actualizar(tx, id, sinIndefinidos(datos));
    } catch (error) {
      if (esViolacionCheck(error, 'clase_horas_validas')) {
        throw new ReglaDeNegocioError('La hora de fin tiene que ser posterior a la de inicio');
      }
      throw error;
    }
  });
}

export async function crearClaseUnica(datos: CrearClaseUnicaInput, hoy: FechaDia): Promise<Clase> {
  if (datos.fecha < hoy) throw new ReglaDeNegocioError('No se puede crear una clase en un día que ya pasó');
  await verificarProfesorActivo(db, datos.profesorId);
  const id = await repo.insertar(db, { ...datos, nivel: datos.nivel ?? null, horarioId: null, semana: lunesDe(datos.fecha) });
  return obtenerClase(id, hoy);
}

export async function borrarClaseUnica(id: number, hoy: FechaDia): Promise<void> {
  await db.transaction(async (tx) => {
    const actual = await bloquearClase(tx, id);
    if (actual.horarioId !== null) throw new ReglaDeNegocioError('Una clase de un horario no se borra: se cancela');
    if (actual.fecha < hoy) throw new ReglaDeNegocioError(`La clase del ${actual.fecha} ya pasó: no se borra`);
    if ((await repo.contarAsistencias(tx, id)) > 0) {
      throw new ReglaDeNegocioError('La clase tiene asistencias registradas. Borralas antes de quitarla');
    }
    await repo.borrar(tx, id);
  });
}

export async function bloquearClase(ej: Ejecutor, id: number): Promise<repo.ClaseBloqueada> {
  const encontrada = await repo.bloquear(ej, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la clase ${id}`);
  return encontrada;
}
