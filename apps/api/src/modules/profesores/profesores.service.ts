import type {
  ActualizarProfesorInput,
  CrearProfesorInput,
  NuevoPorcentajeInput,
  PorcentajeProfesor,
  Profesor,
} from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
import * as repo from './profesores.repository.ts';

// El porcentaje inicial queda vigente desde el día del alta.
export async function crearProfesor(datos: CrearProfesorInput, hoy: FechaDia): Promise<Profesor> {
  const { porcentajeBp, ...personales } = datos;
  const id = await db.transaction(async (tx) => {
    const nuevoId = await repo.insertar(tx, {
      nombre: personales.nombre,
      apellido: personales.apellido,
      dni: personales.dni ?? null,
      email: personales.email ?? null,
      telefono: personales.telefono ?? null,
      aliasCbu: personales.aliasCbu ?? null,
    });
    await repo.insertarPorcentaje(tx, { profesorId: nuevoId, porcentajeBp, vigenteDesde: hoy });
    return nuevoId;
  });
  return obtenerProfesor(id, hoy);
}

export async function actualizarProfesor(
  id: number,
  datos: ActualizarProfesorInput,
  hoy: FechaDia,
): Promise<Profesor> {
  const existe = await repo.actualizar(db, id, sinIndefinidos(datos));
  if (!existe) throw new NoEncontradoError(`No existe el profesor ${id}`);
  return obtenerProfesor(id, hoy);
}

export async function obtenerProfesor(id: number, hoy: FechaDia): Promise<Profesor> {
  const encontrado = await repo.buscarPorId(db, id, hoy);
  if (encontrado === null) throw new NoEncontradoError(`No existe el profesor ${id}`);
  return encontrado;
}

export async function listarProfesores(incluirInactivos: boolean, hoy: FechaDia): Promise<Profesor[]> {
  return repo.listar(db, incluirInactivos, hoy);
}

export async function agregarPorcentaje(
  profesorId: number,
  datos: NuevoPorcentajeInput,
): Promise<PorcentajeProfesor> {
  if (!(await repo.existe(db, profesorId))) throw new NoEncontradoError(`No existe el profesor ${profesorId}`);
  try {
    return await repo.insertarPorcentaje(db, { profesorId, ...datos });
  } catch (error) {
    if (esViolacionUnica(error, 'porcentaje_profesor_vigencia_uq')) {
      throw new ReglaDeNegocioError(`El profesor ya tiene un porcentaje desde el ${datos.vigenteDesde}`);
    }
    throw error;
  }
}

export async function listarPorcentajes(profesorId: number): Promise<PorcentajeProfesor[]> {
  return repo.listarPorcentajes(db, profesorId);
}

// La usa asistencias dentro de su transacción, por eso recibe el ejecutor.
export async function porcentajeVigente(ej: Ejecutor, profesorId: number, fecha: FechaDia): Promise<number> {
  const porcentaje = await repo.buscarPorcentajeVigente(ej, profesorId, fecha);
  if (porcentaje === null) {
    throw new ReglaDeNegocioError(`El profesor no tiene un porcentaje vigente el ${fecha}`);
  }
  return porcentaje;
}
