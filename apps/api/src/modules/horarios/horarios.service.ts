import type { ActualizarHorarioInput, CrearHorarioInput, Horario } from '@studio/shared';
import { db } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionCheck } from '../../lib/postgres.ts';
import { verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './horarios.repository.ts';

export async function crearHorario(datos: CrearHorarioInput): Promise<Horario> {
  await verificarProfesorActivo(db, datos.profesorId);
  const id = await repo.insertar(db, { ...datos, nivel: datos.nivel ?? null });
  return obtenerHorario(id);
}

export async function actualizarHorario(id: number, datos: ActualizarHorarioInput): Promise<Horario> {
  if (datos.profesorId !== undefined) await verificarProfesorActivo(db, datos.profesorId);
  let existe: boolean;
  try {
    existe = await repo.actualizar(db, id, sinIndefinidos(datos));
  } catch (error) {
    // En un PATCH el esquema no ve la otra hora; la base la controla con su check.
    if (esViolacionCheck(error, 'horario_horas_validas')) {
      throw new ReglaDeNegocioError('La hora de fin tiene que ser posterior a la de inicio');
    }
    throw error;
  }
  if (!existe) throw new NoEncontradoError(`No existe el horario ${id}`);
  return obtenerHorario(id);
}

export async function obtenerHorario(id: number): Promise<Horario> {
  const encontrado = await repo.buscarPorId(db, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el horario ${id}`);
  return encontrado;
}

// No verifica al profesor como crear y actualizar: uno que no existe da una lista vacía y uno
// dado de baja da sus horarios, que es lo que muestra su ficha.
export async function listarHorarios(filtros: repo.FiltrosDeHorarios): Promise<Horario[]> {
  return repo.listar(db, filtros);
}

// Los horarios activos de un día de la semana, para la agenda.
export async function listarHorariosDelDia(diaSemana: number): Promise<Horario[]> {
  return repo.listarDelDia(db, diaSemana);
}
