import { describe, expect, it } from 'vitest';
import { finDelHorizonte, semanasDelHorizonte } from '../fechas.ts';

// Los tests de la cuenta con días están en packages/shared/src/test/fechas.test.ts.

describe('finDelHorizonte', () => {
  it('es el domingo de la semana que contiene el último día del mes siguiente', () => {
    // El 30 de noviembre es lunes: la semana va hasta el domingo 6 de diciembre.
    expect(finDelHorizonte('2026-10-08')).toBe('2026-12-06');
  });

  it('en diciembre, el mes siguiente es enero del año que viene', () => {
    // El 31 de enero de 2027 es domingo: la semana termina ese mismo día.
    expect(finDelHorizonte('2026-12-15')).toBe('2027-01-31');
  });

  it('un 31 de enero mira el fin de febrero, no un 31 de febrero que no existe', () => {
    // El 28 de febrero de 2026 es sábado: la semana termina el domingo 1 de marzo.
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
