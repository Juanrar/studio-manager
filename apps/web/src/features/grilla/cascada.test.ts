import { describe, expect, it } from 'vitest';
import { acomodarEnCascada } from './cascada.ts';
import { aMinutos } from './minutos.ts';

const clase = (id: number, fecha: string, inicio: string, fin: string) => ({
  id,
  fecha,
  inicio: aMinutos(inicio),
  fin: aMinutos(fin),
});

describe('acomodarEnCascada', () => {
  it('dos clases que empiezan a la misma hora van lado a lado', () => {
    const lugares = acomodarEnCascada([clase(1, '2026-10-05', '19:00', '20:30'), clase(2, '2026-10-05', '19:00', '20:00')]);

    expect(lugares.get(1)).toEqual({ sangria: 0, carril: 0, carriles: 2 });
    expect(lugares.get(2)).toEqual({ sangria: 0, carril: 1, carriles: 2 });
  });

  it('una que empieza 30 minutos o más después se dibuja encima, con sangría', () => {
    const lugares = acomodarEnCascada([
      clase(1, '2026-10-06', '19:00', '20:00'),
      clase(2, '2026-10-06', '19:30', '21:00'),
      clase(3, '2026-10-06', '20:00', '21:00'),
    ]);

    expect(lugares.get(1)).toEqual({ sangria: 0, carril: 0, carriles: 1 });
    expect(lugares.get(2)).toEqual({ sangria: 1, carril: 0, carriles: 1 });
    // A las 20:00 la primera ya terminó, pero la segunda sigue: va una sangría más adentro.
    expect(lugares.get(3)).toEqual({ sangria: 2, carril: 0, carriles: 1 });
  });

  it('una que empieza cuando la anterior ya terminó vuelve al borde', () => {
    const lugares = acomodarEnCascada([clase(1, '2026-10-06', '19:00', '20:00'), clase(2, '2026-10-06', '20:00', '21:00')]);

    expect(lugares.get(2)).toEqual({ sangria: 0, carril: 0, carriles: 1 });
  });

  it('clases de días distintos no se mezclan aunque tengan la misma hora', () => {
    // El prototipo ordenaba sin el día y dos clases de días distintos compartían carril.
    const lugares = acomodarEnCascada([clase(1, '2026-10-05', '10:00', '11:00'), clase(2, '2026-10-06', '10:00', '11:00')]);

    expect(lugares.get(1)).toEqual({ sangria: 0, carril: 0, carriles: 1 });
    expect(lugares.get(2)).toEqual({ sangria: 0, carril: 0, carriles: 1 });
  });
});
