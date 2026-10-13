import type { AltaDeProfesorInput, Profesor } from '@studio/shared';
import { db } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { crearHorarioConSusClasesEn } from '../clases/programacion.service.ts';
import { crearProfesorEn, obtenerProfesor } from '../profesores/profesores.service.ts';

// El profesor, su porcentaje, sus horarios y sus clases, todo o nada.
export async function darDeAltaProfesor(datos: AltaDeProfesorInput, hoy: FechaDia): Promise<Profesor> {
  const id = await db.transaction(async (tx) => {
    const profesorId = await crearProfesorEn(tx, datos.profesor, hoy);
    for (const horario of datos.horarios) {
      await crearHorarioConSusClasesEn(tx, { ...horario, profesorId }, hoy);
    }
    return profesorId;
  });
  return obtenerProfesor(id, hoy);
}
