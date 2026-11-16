import type { AltaDeProfesorInput, Clase } from '@studio/shared';
import { lunesDe, sumarDias } from '../../lib/formato.ts';
import { aMinutos } from '../grilla/minutos.ts';

export function fechasDeLaSemana(hoy: string): string[] {
  const lunes = lunesDe(hoy);
  return Array.from({ length: 7 }, (_, indice) => sumarDias(lunes, indice));
}

export function clasesDeLaPropuesta(alta: AltaDeProfesorInput, hoy: string): Clase[] {
  const lunes = lunesDe(hoy);
  const { nombre, apellido } = alta.profesor;
  return alta.horarios.map((horario, indice) => ({
    id: -(indice + 1),
    horarioId: null,
    fecha: sumarDias(lunes, horario.diaSemana - 1),
    horaInicio: horario.horaInicio,
    horaFin: horario.horaFin,
    estilo: horario.estilo,
    nivel: horario.nivel ?? null,
    estado: 'programada',
    profesor: { id: 0, nombre, apellido },
    profesorTitular: null,
    tieneCambios: false,
    asistentes: 0,
  }));
}

export function rangoDeHoras(clases: Clase[]): { inicio: number; fin: number } {
  const inicios = clases.map((clase) => aMinutos(clase.horaInicio));
  const fines = clases.map((clase) => aMinutos(clase.horaFin));
  return {
    inicio: Math.max(0, (Math.floor(Math.min(...inicios) / 60) - 1) * 60),
    fin: Math.min(1440, (Math.ceil(Math.max(...fines) / 60) + 1) * 60),
  };
}
