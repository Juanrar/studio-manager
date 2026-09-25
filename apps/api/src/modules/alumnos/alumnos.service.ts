import type {
  ActualizarAlumnoInput,
  Alumno,
  CrearAlumnoInput,
  Listado,
  ListadoQuery,
} from '@studio/shared';
import { db } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
import * as repo from './alumnos.repository.ts';

export async function crearAlumno(datos: CrearAlumnoInput): Promise<Alumno> {
  try {
    return await repo.insertar(db, {
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni ?? null,
      email: datos.email ?? null,
      telefono: datos.telefono ?? null,
      fechaNacimiento: datos.fechaNacimiento ?? null,
      contactoEmergencia: datos.contactoEmergencia ?? null,
      notas: datos.notas ?? null,
    });
  } catch (error) {
    throw traducirDniRepetido(error);
  }
}

export async function actualizarAlumno(id: number, datos: ActualizarAlumnoInput): Promise<Alumno> {
  let actualizado: Alumno | null;
  try {
    actualizado = await repo.actualizar(db, id, sinIndefinidos(datos));
  } catch (error) {
    throw traducirDniRepetido(error);
  }
  if (actualizado === null) throw new NoEncontradoError(`No existe el alumno ${id}`);
  return actualizado;
}

export async function obtenerAlumno(id: number): Promise<Alumno> {
  const encontrado = await repo.buscarPorId(db, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el alumno ${id}`);
  return encontrado;
}

export async function listarAlumnos(filtros: ListadoQuery): Promise<Listado<Alumno>> {
  const { items, total } = await repo.listar(db, filtros);
  return { items, total, pagina: filtros.pagina, porPagina: filtros.porPagina };
}

function traducirDniRepetido(error: unknown): unknown {
  return esViolacionUnica(error, 'alumno_dni_unique')
    ? new ReglaDeNegocioError('Ya existe un alumno con ese DNI')
    : error;
}
