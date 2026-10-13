import { describe, expect, it } from 'vitest';
import type { AltaDeProfesorInput, Clase } from '@studio/shared';
import { clasesDeLaPropuesta, fechasDeLaSemana, rangoDeHoras } from './grillaDeLaPropuesta.ts';

function unAlta(horarios: { diaSemana: number; horaInicio: string; horaFin: string }[]): AltaDeProfesorInput {
  return {
    profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000 },
    horarios: horarios.map((horario) => ({ estilo: 'Salsa', nivel: 'Inicial', ...horario })),
  } as AltaDeProfesorInput;
}

// Martes 13 de octubre de 2026.
const HOY = '2026-10-13';

function unaClaseDe(horaInicio: string, horaFin: string): Clase {
  return clasesDeLaPropuesta(unAlta([{ diaSemana: 2, horaInicio, horaFin }]), HOY)[0]!;
}

describe('clasesDeLaPropuesta', () => {
  it('convierte cada horario en una clase de la semana de hoy', () => {
    const clases = clasesDeLaPropuesta(
      unAlta([
        { diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' },
        { diaSemana: 4, horaInicio: '19:00', horaFin: '20:30' },
      ]),
      HOY,
    );
    const comun = {
      horarioId: null,
      horaInicio: '19:00',
      horaFin: '20:30',
      estilo: 'Salsa',
      nivel: 'Inicial',
      estado: 'programada',
      profesor: { id: 0, nombre: 'Lucía', apellido: 'Fernández' },
      profesorTitular: null,
      tieneCambios: false,
      asistentes: 0,
    };
    expect(clases).toEqual([
      { ...comun, id: -1, fecha: '2026-10-13' },
      { ...comun, id: -2, fecha: '2026-10-15' },
    ]);
  });
});

describe('rangoDeHoras', () => {
  it('de 19:00 a 20:30 va de 18:00 a 22:00', () => {
    const clases = clasesDeLaPropuesta(
      unAlta([
        { diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' },
        { diaSemana: 4, horaInicio: '19:00', horaFin: '20:30' },
      ]),
      HOY,
    );
    expect(rangoDeHoras(clases)).toEqual({ inicio: 1080, fin: 1320 });
  });

  it('una clase de 07:00 a 08:00 empieza a las 06:00', () => {
    expect(rangoDeHoras([unaClaseDe('07:00', '08:00')])).toEqual({ inicio: 360, fin: 540 });
  });

  it('una clase de 23:00 a 23:30 llega hasta las 24:00 y no más', () => {
    expect(rangoDeHoras([unaClaseDe('23:00', '23:30')])).toEqual({ inicio: 1320, fin: 1440 });
  });
});

describe('fechasDeLaSemana', () => {
  it('va del lunes al domingo de la semana de hoy', () => {
    expect(fechasDeLaSemana(HOY)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });
});
