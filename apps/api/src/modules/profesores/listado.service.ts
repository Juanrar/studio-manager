import type { ProfesorEnListado } from '@studio/shared';
import type { FechaDia } from '../../lib/fechas.ts';
import { listarClases } from '../clases/clases.service.ts';
import { listarProfesores } from './profesores.service.ts';

// El listado de profesores con su carga semanal: cuántas clases activas da cada uno y en qué días.
// Vive fuera de profesores.service porque usa clases, que a su vez usa profesores.service.
export async function listarProfesoresConClases(
  incluirInactivos: boolean,
  hoy: FechaDia,
): Promise<ProfesorEnListado[]> {
  const profesores = await listarProfesores(incluirInactivos, hoy);
  // `incluirInactivos` es sobre los profesores: una clase dada de baja no cuenta nunca.
  const clases = await listarClases({ incluirInactivas: false });
  const porProfesor = Map.groupBy(clases, (clase) => clase.profesor.id);

  return profesores.map((profesor) => {
    const suyas = porProfesor.get(profesor.id) ?? [];
    return {
      ...profesor,
      clasesPorSemana: suyas.length,
      diasConClase: [...new Set(suyas.map((clase) => clase.diaSemana))].sort((a, b) => a - b),
    };
  });
}
