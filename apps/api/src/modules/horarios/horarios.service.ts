import type { ActualizarHorarioInput, CrearHorarioInput, Horario } from '@studio/shared';
import { db, type Ejecutor } from '../../db/client.ts';
import { NoEncontradoError, ReglaDeNegocioError } from '../../lib/errores.ts';
import { lunesDe, type FechaDia } from '../../lib/fechas.ts';
import { sinIndefinidos } from '../../lib/objetos.ts';
import { esViolacionCheck } from '../../lib/postgres.ts';
import { verificarProfesorActivo } from '../profesores/profesores.service.ts';
import * as repo from './horarios.repository.ts';

export async function crearHorario(datos: CrearHorarioInput, hoy: FechaDia, ej: Ejecutor = db): Promise<Horario> {
  const { desde, claseId: _claseId, ...horario } = datos;
  const vigenteDesde = desde ?? lunesDe(hoy);
  if (vigenteDesde < lunesDe(hoy)) throw new ReglaDeNegocioError('Un horario nuevo rige desde esta semana o una posterior');
  await verificarProfesorActivo(ej, horario.profesorId);
  const id = await repo.insertar(ej, { ...horario, nivel: horario.nivel ?? null, vigenteDesde });
  return obtenerHorario(id, ej);
}

export async function actualizarHorario(id: number, datos: ActualizarHorarioInput, ej: Ejecutor = db): Promise<Horario> {
  const { desde: _desde, ...cambios } = datos;
  if (cambios.profesorId !== undefined) await verificarProfesorActivo(ej, cambios.profesorId);
  let existe: boolean;
  try {
    existe = await repo.actualizar(ej, id, sinIndefinidos(cambios));
  } catch (error) {
    if (esViolacionCheck(error, 'horario_horas_validas')) {
      throw new ReglaDeNegocioError('La hora de fin tiene que ser posterior a la de inicio');
    }
    throw error;
  }
  if (!existe) throw new NoEncontradoError(`No existe el horario ${id}`);
  return obtenerHorario(id, ej);
}

export async function reactivarHorario(id: number, desde: FechaDia, ej: Ejecutor = db): Promise<void> {
  await repo.actualizar(ej, id, { activo: true, vigenteDesde: desde });
}

export async function obtenerHorario(id: number, ej: Ejecutor = db): Promise<Horario> {
  const encontrado = await repo.buscarPorId(ej, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el horario ${id}`);
  return encontrado;
}

export async function listarHorarios(filtros: repo.FiltrosDeHorarios): Promise<Horario[]> {
  return repo.listar(db, filtros);
}

export type { HorarioParaGenerar } from './horarios.repository.ts';

export async function horariosParaGenerar(ej: Ejecutor, horarioId?: number): Promise<repo.HorarioParaGenerar[]> {
  return repo.listarParaGenerar(ej, horarioId);
}

