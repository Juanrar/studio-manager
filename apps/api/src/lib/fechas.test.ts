import { describe, expect, it } from 'vitest';
import {
  diaSemanaIso,
  esFechaDia,
  hoyEnEstudio,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
  sumarUnMes,
} from './fechas.ts';

describe('hoyEnEstudio', () => {
  it('devuelve el día en la zona del estudio, no en UTC', () => {
    // 2026-03-10T02:00:00Z son las 23:00 del 9 de marzo en Buenos Aires
    const instante = new Date('2026-03-10T02:00:00Z');
    expect(hoyEnEstudio(instante)).toBe('2026-03-09');
  });

  it('devuelve el mismo día cuando el instante ya está dentro del día local', () => {
    const instante = new Date('2026-03-10T15:00:00Z');
    expect(hoyEnEstudio(instante)).toBe('2026-03-10');
  });
});

describe('diaSemanaIso', () => {
  it('devuelve 1 para un lunes', () => {
    expect(diaSemanaIso('2026-03-09')).toBe(1);
  });

  it('devuelve 7 para un domingo', () => {
    expect(diaSemanaIso('2026-03-15')).toBe(7);
  });
});

describe('sumarDias', () => {
  it('suma días dentro del mes y cruza al mes siguiente', () => {
    expect(sumarDias('2026-03-10', 7)).toBe('2026-03-17');
    expect(sumarDias('2026-03-28', 7)).toBe('2026-04-04');
  });

  it('cruza el fin de año', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('sumarUnMes', () => {
  it('suma un mes en un caso simple', () => {
    expect(sumarUnMes('2026-03-10')).toBe('2026-04-10');
  });

  it('recorta al último día cuando el mes siguiente es más corto', () => {
    expect(sumarUnMes('2026-01-31')).toBe('2026-02-28');
  });

  it('respeta el año bisiesto', () => {
    expect(sumarUnMes('2028-01-31')).toBe('2028-02-29');
  });

  it('cruza el cambio de año', () => {
    expect(sumarUnMes('2026-12-15')).toBe('2027-01-15');
  });
});

describe('sumarMeses', () => {
  it('suma meses y cruza el cambio de año', () => {
    expect(sumarMeses('2026-07-29', 2)).toBe('2026-09-29');
    expect(sumarMeses('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('recorta al último día del mes de destino, sin pasar por el mes del medio', () => {
    expect(sumarMeses('2026-12-31', 2)).toBe('2027-02-28');
    // Sumando de a un mes daría el 28 de marzo.
    expect(sumarMeses('2027-01-31', 2)).toBe('2027-03-31');
  });
});

describe('primerDiaDelMes', () => {
  it('devuelve el día 1 del mes de la fecha', () => {
    expect(primerDiaDelMes('2026-03-27')).toBe('2026-03-01');
  });
});

describe('esFechaDia', () => {
  it('acepta un formato válido', () => {
    expect(esFechaDia('2026-03-09')).toBe(true);
  });

  it('rechaza formatos inválidos y fechas que no existen', () => {
    expect(esFechaDia('09-03-2026')).toBe(false);
    expect(esFechaDia('2026-13-01')).toBe(false);
    expect(esFechaDia('2026-02-30')).toBe(false);
  });
});
