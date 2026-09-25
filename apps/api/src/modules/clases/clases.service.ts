import type { ActualizarClaseInput, Clase, CrearClaseInput } from '@studio/shared';
import { db } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionCheck } from '../../lib/postgres.ts';
import { verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './clases.repository.ts';

export async function crearClase(datos: CrearClaseInput): Promise<Clase> {
  await verificarProfesorActivo(db, datos.profesorId);
  const id = await repo.insertar(db, { ...datos, nivel: datos.nivel ?? null });
  return obtenerClase(id);
}

export async function actualizarClase(id: number, datos: ActualizarClaseInput): Promise<Clase> {
  if (datos.profesorId !== undefined) await verificarProfesorActivo(db, datos.profesorId);
  let existe: boolean;
  try {
    existe = await repo.actualizar(db, id, sinIndefinidos(datos));
  } catch (error) {
    // En un PATCH el esquema no ve la otra hora; la base la controla con su check.
    if (esViolacionCheck(error, 'clase_horario_valido')) {
      throw new ReglaDeNegocioError('La hora de fin tiene que ser posterior a la de inicio');
    }
    throw error;
  }
  if (!existe) throw new NoEncontradoError(`No existe la clase ${id}`);
  return obtenerClase(id);
}

export async function obtenerClase(id: number): Promise<Clase> {
  const encontrada = await repo.buscarPorId(db, id);
  if (encontrada === null) throw new NoEncontradoError(`No existe la clase ${id}`);
  return encontrada;
}

export async function listarClases(incluirInactivas: boolean): Promise<Clase[]> {
  return repo.listar(db, incluirInactivas);
}
