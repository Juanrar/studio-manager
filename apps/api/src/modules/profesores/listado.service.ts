import type { ProfesorEnListado } from '@studio/shared';
import type { FechaDia } from '../../lib/fechas.ts';
import { listarHorarios } from '../horarios/horarios.service.ts';
import { listarProfesores } from './profesores.service.ts';

export async function listarProfesoresConClases(
  incluirInactivos: boolean,
  hoy: FechaDia,
): Promise<ProfesorEnListado[]> {
  const profesores = await listarProfesores(incluirInactivos, hoy);
  const horarios = await listarHorarios({ incluirInactivos: false });
  const porProfesor = Map.groupBy(horarios, (horario) => horario.profesor.id);

  return profesores.map((profesor) => {
    const suyas = porProfesor.get(profesor.id) ?? [];
    return {
      ...profesor,
      clasesPorSemana: suyas.length,
      diasConClase: [...new Set(suyas.map((horario) => horario.diaSemana))].sort((a, b) => a - b),
    };
  });
}
