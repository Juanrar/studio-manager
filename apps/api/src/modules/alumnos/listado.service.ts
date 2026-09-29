import type { ListadoDeAlumnos, ListadoQuery } from '@studio/shared';
import { db } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { ultimasClases } from '../asistencias/asistencias.service.ts';
import { resumenDePacks } from '../pagos/pagos.service.ts';
import * as repo from './alumnos.repository.ts';

// El listado de recepción: cada alumno con el pack que está usando y el día de su última clase.
// Vive fuera de alumnos.service porque usa pagos y asistencias, que a su vez usan alumnos.service.
export async function listarAlumnos(filtros: ListadoQuery, hoy: FechaDia): Promise<ListadoDeAlumnos> {
  const { items, total } = await repo.listar(db, filtros);
  const delFiltro = await repo.listarTodos(db, filtros);
  // Se suman los de la página por si alguien se dio de alta entre las dos consultas.
  const ids = new Set([...delFiltro, ...items].map((alumno) => alumno.id));
  const packs = await resumenDePacks([...ids], hoy);
  const ultimas = await ultimasClases(items.map((alumno) => alumno.id), hoy);

  return {
    items: items.map((alumno) => ({
      ...alumno,
      ...packs.get(alumno.id)!,
      ultimaClase: ultimas.get(alumno.id) ?? null,
    })),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
    vigentes: delFiltro.filter((alumno) => alumno.activo && packs.get(alumno.id)?.estadoPack === 'vigente').length,
    hoy,
  };
}
