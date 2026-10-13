import type { AltaDeProfesorInput, Profesor } from '@studio/shared';
import { db } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { crearHorarioConSusClasesEn } from '../clases/programacion.service.ts';
import { buscarHomonimo, crearProfesorEn, obtenerProfesor } from '../profesores/profesores.service.ts';

// El profesor, su porcentaje, sus horarios y sus clases, todo o nada.
export async function darDeAltaProfesor(datos: AltaDeProfesorInput, hoy: FechaDia): Promise<Profesor> {
  const id = await db.transaction(async (tx) => {
    // La propuesta ya lo controló, pero dos tarjetas de la misma persona pueden estar abiertas a la vez.
    const repetido = await buscarHomonimo(tx, datos.profesor.nombre, datos.profesor.apellido, hoy);
    if (repetido !== null) {
      throw new ReglaDeNegocioError(
        `Ya existe ${repetido.nombre} ${repetido.apellido} (id ${repetido.id}). Si es otra persona, se da de alta desde Profesores; si es la misma y está dada de baja, se reactiva desde su ficha.`,
      );
    }
    const profesorId = await crearProfesorEn(tx, datos.profesor, hoy);
    for (const horario of datos.horarios) {
      await crearHorarioConSusClasesEn(tx, { ...horario, profesorId }, hoy);
    }
    return profesorId;
  });
  return obtenerProfesor(id, hoy);
}
