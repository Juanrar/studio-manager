import type { ActualizarAlumnoInput, Alumno, CrearAlumnoInput } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
import * as repo from './alumnos.repository.ts';

export async function crearAlumno(datos: CrearAlumnoInput, ahora: Date): Promise<Alumno> {
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
      creadoEn: ahora,
    });
  } catch (error) {
    throw traducirDniRepetido(error);
  }
}

export async function actualizarAlumno(
  id: number,
  datos: ActualizarAlumnoInput,
  usuarioId: number,
  ahora: Date,
): Promise<Alumno> {
  return db.transaction(async (tx) => {
    const antes = await repo.bloquear(tx, id);
    if (antes === null) throw new NoEncontradoError(`No existe el alumno ${id}`);

    let actualizado: Alumno | null;
    try {
      actualizado = await repo.actualizar(tx, id, sinIndefinidos(datos));
    } catch (error) {
      throw traducirDniRepetido(error);
    }
    if (datos.activo !== undefined && datos.activo !== antes.activo) {
      await repo.registrarCambiosDeEstado(tx, [
        { alumnoId: id, activo: datos.activo, registradoPor: usuarioId, registradoEn: ahora },
      ]);
    }
    return actualizado!;
  });
}

export async function reactivarPorCompra(ej: Ejecutor, id: number, usuarioId: number, ahora: Date): Promise<void> {
  const antes = await repo.bloquear(ej, id);
  if (antes === null || antes.activo) return;
  await repo.actualizar(ej, id, { activo: true });
  await repo.registrarCambiosDeEstado(ej, [{ alumnoId: id, activo: true, registradoPor: usuarioId, registradoEn: ahora }]);
}

export async function obtenerAlumno(id: number): Promise<Alumno> {
  const encontrado = await repo.buscarPorId(db, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el alumno ${id}`);
  return encontrado;
}

function traducirDniRepetido(error: unknown): unknown {
  return esViolacionUnica(error, 'alumno_dni_unique')
    ? new ReglaDeNegocioError('Ya existe un alumno con ese DNI')
    : error;
}

export async function idsDeAlumnosActivos(): Promise<number[]> {
  return repo.listarIdsActivos(db);
}
