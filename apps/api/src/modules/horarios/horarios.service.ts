import type { ActualizarHorarioInput, CrearHorarioInput, Horario } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { lunesDe, type FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionCheck } from '../../lib/postgres.ts';
import { verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './horarios.repository.ts';

// Un horario nuevo rige desde el lunes de la semana de hoy. Sus clases las crea programacion.service.
export async function crearHorario(datos: CrearHorarioInput, hoy: FechaDia, ej: Ejecutor = db): Promise<Horario> {
  await verificarProfesorActivo(ej, datos.profesorId);
  const id = await repo.insertar(ej, { ...datos, nivel: datos.nivel ?? null, vigenteDesde: lunesDe(hoy) });
  return obtenerHorario(id, ej);
}

// Cambia solo la fila del horario. Para que sus clases sigan el cambio, la ruta usa
// programacion.service.actualizarHorarioYSusClases.
export async function actualizarHorario(id: number, datos: ActualizarHorarioInput, ej: Ejecutor = db): Promise<Horario> {
  if (datos.profesorId !== undefined) await verificarProfesorActivo(ej, datos.profesorId);
  let existe: boolean;
  try {
    existe = await repo.actualizar(ej, id, sinIndefinidos(datos));
  } catch (error) {
    // En un PATCH el esquema no ve la otra hora; la base la controla con su check.
    if (esViolacionCheck(error, 'horario_horas_validas')) {
      throw new ReglaDeNegocioError('La hora de fin tiene que ser posterior a la de inicio');
    }
    throw error;
  }
  if (!existe) throw new NoEncontradoError(`No existe el horario ${id}`);
  return obtenerHorario(id, ej);
}

// Vuelve a dictarse desde la semana `desde`: las anteriores no tienen sus clases.
export async function reactivarHorario(id: number, desde: FechaDia, ej: Ejecutor = db): Promise<void> {
  await repo.actualizar(ej, id, { activo: true, vigenteDesde: desde });
}

export async function obtenerHorario(id: number, ej: Ejecutor = db): Promise<Horario> {
  const encontrado = await repo.buscarPorId(ej, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el horario ${id}`);
  return encontrado;
}

// No verifica al profesor como crear y actualizar: uno que no existe da una lista vacía y uno
// dado de baja da sus horarios, que es lo que muestra su ficha.
export async function listarHorarios(filtros: repo.FiltrosDeHorarios): Promise<Horario[]> {
  return repo.listar(db, filtros);
}

export type { HorarioParaGenerar } from './horarios.repository.ts';

// Los horarios activos con lo que el generador de clases copia. Con `horarioId`, solo ese.
export async function horariosParaGenerar(ej: Ejecutor, horarioId?: number): Promise<repo.HorarioParaGenerar[]> {
  return repo.listarParaGenerar(ej, horarioId);
}

