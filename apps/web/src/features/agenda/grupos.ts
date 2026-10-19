import type { Clase } from '@studio/shared';

export type GrupoDeClases = { horaInicio: string; horaFin: string; clases: Clase[] };

// Junta las clases con la misma hora de inicio y de fin. Dos clases que empiezan juntas y terminan a otra hora
// van en grupos separados: un grupo tiene una sola hora de fin. Dentro de cada grupo conserva el orden de entrada.
export function agruparPorHora(clases: Clase[]): GrupoDeClases[] {
  const grupos: GrupoDeClases[] = [];
  for (const clase of clases) {
    const existente = grupos.find((g) => g.horaInicio === clase.horaInicio && g.horaFin === clase.horaFin);
    if (existente) existente.clases.push(clase);
    else grupos.push({ horaInicio: clase.horaInicio, horaFin: clase.horaFin, clases: [clase] });
  }
  return grupos.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.horaFin.localeCompare(b.horaFin));
}
