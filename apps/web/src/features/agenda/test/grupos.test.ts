import { describe, expect, it } from 'vitest';
import { unaClase } from '../../../../test/datos.ts';
import { agruparPorHora } from '../grupos.ts';

describe('agruparPorHora', () => {
  it('junta las clases con el mismo inicio y fin, y separa las que terminan a otra hora', () => {
    const clases = [
      unaClase({ id: 1, horaInicio: '18:00', horaFin: '19:30' }),
      unaClase({ id: 2, horaInicio: '18:00', horaFin: '19:00' }),
      unaClase({ id: 3, horaInicio: '18:00', horaFin: '19:00' }),
      unaClase({ id: 4, horaInicio: '17:00', horaFin: '18:00' }),
    ];

    expect(agruparPorHora(clases).map((g) => [g.horaInicio, g.horaFin, g.clases.map((c) => c.id)])).toEqual([
      ['17:00', '18:00', [4]],
      ['18:00', '19:00', [2, 3]],
      ['18:00', '19:30', [1]],
    ]);
  });
});
