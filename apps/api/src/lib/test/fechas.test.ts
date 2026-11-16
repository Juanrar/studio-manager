import { describe, expect, it } from 'vitest';
import { finDelHorizonte, semanasDelHorizonte } from '../fechas.ts';

describe('finDelHorizonte', () => {
  it('es el domingo de la semana que contiene el último día del mes siguiente', () => {
    expect(finDelHorizonte('2026-10-08')).toBe('2026-12-06');
  });

  it('en diciembre, el mes siguiente es enero del año que viene', () => {
    expect(finDelHorizonte('2026-12-15')).toBe('2027-01-31');
  });

  it('un 31 de enero mira el fin de febrero, no un 31 de febrero que no existe', () => {
    expect(finDelHorizonte('2026-01-31')).toBe('2026-03-01');
  });
});

describe('semanasDelHorizonte', () => {
  it('lista el lunes de cada semana, desde la actual hasta la del fin del horizonte', () => {
    expect(semanasDelHorizonte('2026-10-08')).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
  });
});
