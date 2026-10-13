import type { AltaDeProfesorInput, Clase } from '@studio/shared';
import { lunesDe, sumarDias } from '../../lib/formato.ts';
import { aMinutos } from '../grilla/minutos.ts';

// Lo que el alta propone, convertido en lo que dibuja la grilla: las clases de la semana de hoy.

// Los siete días de la semana de `hoy`, de lunes a domingo.
export function fechasDeLaSemana(hoy: string): string[] {
  const lunes = lunesDe(hoy);
  return Array.from({ length: 7 }, (_, indice) => sumarDias(lunes, indice));
}

// Cada horario pasa a ser una clase de esta semana. Los ids son negativos para no chocar con los reales.
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

// De una hora en punto antes de la primera clase a una hora en punto después de la última, entre 00:00 y 24:00.
export function rangoDeHoras(clases: Clase[]): { inicio: number; fin: number } {
  const inicios = clases.map((clase) => aMinutos(clase.horaInicio));
  const fines = clases.map((clase) => aMinutos(clase.horaFin));
  return {
    inicio: Math.max(0, (Math.floor(Math.min(...inicios) / 60) - 1) * 60),
    fin: Math.min(1440, (Math.ceil(Math.max(...fines) / 60) + 1) * 60),
  };
}
