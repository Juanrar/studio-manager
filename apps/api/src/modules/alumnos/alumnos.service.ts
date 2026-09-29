import type { ActualizarAlumnoInput, Alumno, CrearAlumnoInput } from '@studio/shared';
import { db } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionUnica } from '../../lib/postgres.ts';
import * as repo from './alumnos.repository.ts';

// El alta toma el reloj de la app, no el de la base: la ficha muestra ese día.
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

// Si cambia `activo`, queda registrado quién dio de baja o reactivó y cuándo: la actividad lo muestra
// y la baja automática cuenta los 2 meses sin comprar desde la última reactivación.
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
    // No es null: el alumno existe y quedó bloqueado hasta el final de la transacción.
    return actualizado!;
  });
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
