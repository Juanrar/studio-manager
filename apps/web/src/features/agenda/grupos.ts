import type { Clase } from '@studio/shared';

export type GrupoDeClases = { horaInicio: string; horaFin: string; clases: Clase[] };

export function agruparPorHora(clases: Clase[]): GrupoDeClases[] {
  const grupos: GrupoDeClases[] = [];
  for (const clase of clases) {
    const existente = grupos.find((g) => g.horaInicio === clase.horaInicio && g.horaFin === clase.horaFin);
    if (existente) existente.clases.push(clase);
    else grupos.push({ horaInicio: clase.horaInicio, horaFin: clase.horaFin, clases: [clase] });
  }
  return grupos.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.horaFin.localeCompare(b.horaFin));
}
