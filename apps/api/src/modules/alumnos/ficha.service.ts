import type { FichaDeAlumno } from '@studio/shared';
import { config } from '../../config.ts';
import { db } from '../../db/client.ts';
import { NoEncontradoError } from '../../lib/errores.ts';
import { hoyEnEstudio, type FechaDia } from '../../lib/fechas.ts';
import { resumenDePacks } from '../pagos/pagos.service.ts';
import * as repo from './alumnos.repository.ts';

// La ficha de recepción: el alumno, el día de su alta y el pack que está usando.
// Vive fuera de alumnos.service por lo mismo que el listado: pagos ya usa alumnos.service.
export async function obtenerFicha(id: number, hoy: FechaDia): Promise<FichaDeAlumno> {
  const encontrado = await repo.buscarConAlta(db, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el alumno ${id}`);
  const { creadoEn, ...alumno } = encontrado;
  const packs = await resumenDePacks([id], hoy);

  return { ...alumno, alta: hoyEnEstudio(creadoEn, config.tzEstudio), ...packs.get(id)! };
}
