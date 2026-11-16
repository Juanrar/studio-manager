import type { ListadoDeAlumnos, ListadoQuery } from '@studio/shared';
import { db } from '../../db/client.ts';
import type { FechaDia } from '../../lib/fechas.ts';
import { ultimasClases } from '../asistencias/asistencias.service.ts';
import { resumenDePacks } from '../pagos/pagos.service.ts';
import * as repo from './alumnos.repository.ts';

export async function listarAlumnos(filtros: ListadoQuery, hoy: FechaDia): Promise<ListadoDeAlumnos> {
  const { items, total } = await repo.listar(db, filtros);
  const delFiltro = await repo.listarTodos(db, filtros);
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
