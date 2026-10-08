import { describe, expect, it } from 'vitest';
import { destinoDelArrastre, posicionEnLaGrilla } from './arrastre.ts';
import { aMinutos } from './minutos.ts';

describe('posicionEnLaGrilla', () => {
  // Siete días de 100 px desde x = 100, y la grilla empieza a las 08:00 en y = 50, con 1 px por minuto.
  const caja = { left: 100, top: 50, width: 700 };

  it('da el día por la columna y los minutos por la altura', () => {
    expect(posicionEnLaGrilla(caja, { x: 355, y: 50 + 11 * 60 }, 7, 1)).toEqual({ dia: 3, minutos: aMinutos('19:00') });
  });

  it('fuera de la grilla se queda en el primer o el último día', () => {
    expect(posicionEnLaGrilla(caja, { x: 20, y: 50 }, 7, 1).dia).toBe(1);
    expect(posicionEnLaGrilla(caja, { x: 900, y: 50 }, 7, 1).dia).toBe(7);
  });
});

describe('destinoDelArrastre', () => {
  const salsa = { dia: 2, inicio: aMinutos('19:00'), fin: aMinutos('20:00') };

  it('mover conserva dónde se agarró la clase y salta de a 15 minutos, también a otro día', () => {
    // Se agarró a las 19:10 y el puntero llegó a las 20:23 del jueves: se corrió 73 minutos, que redondean a 75.
    const destino = destinoDelArrastre(
      { modo: 'mover', clase: salsa, minutosAlEmpezar: aMinutos('19:10') },
      { dia: 4, minutos: aMinutos('20:23') },
    );

    expect(destino).toEqual({ dia: 4, inicio: aMinutos('20:15'), fin: aMinutos('21:15') });
  });

  it('mover no deja la clase antes de las 08:00 ni después de las 23:00', () => {
    const arriba = destinoDelArrastre(
      { modo: 'mover', clase: salsa, minutosAlEmpezar: aMinutos('19:10') },
      { dia: 2, minutos: aMinutos('06:00') },
    );
    const abajo = destinoDelArrastre(
      { modo: 'mover', clase: salsa, minutosAlEmpezar: aMinutos('19:10') },
      { dia: 2, minutos: aMinutos('23:50') },
    );

    expect(arriba).toEqual({ dia: 2, inicio: aMinutos('08:00'), fin: aMinutos('09:00') });
    expect(abajo).toEqual({ dia: 2, inicio: aMinutos('22:00'), fin: aMinutos('23:00') });
  });

  it('estirar cambia solo el fin, con un mínimo de 15 minutos y sin pasar de las 23:00', () => {
    const corta = destinoDelArrastre({ modo: 'estirar', clase: salsa }, { dia: 5, minutos: aMinutos('19:05') });
    const larga = destinoDelArrastre({ modo: 'estirar', clase: salsa }, { dia: 5, minutos: aMinutos('23:40') });

    // El día no cambia aunque el puntero pase a otra columna.
    expect(corta).toEqual({ dia: 2, inicio: aMinutos('19:00'), fin: aMinutos('19:15') });
    expect(larga).toEqual({ dia: 2, inicio: aMinutos('19:00'), fin: aMinutos('23:00') });
  });

  it('crear va desde la franja donde se apretó hasta donde está el puntero, para abajo o para arriba', () => {
    const empiezo = { modo: 'crear' as const, dia: 3, minutosAlEmpezar: aMinutos('18:07') };

    expect(destinoDelArrastre(empiezo, { dia: 5, minutos: aMinutos('19:20') })).toEqual({
      dia: 3,
      inicio: aMinutos('18:00'),
      fin: aMinutos('19:15'),
    });
    expect(destinoDelArrastre(empiezo, { dia: 3, minutos: aMinutos('17:31') })).toEqual({
      dia: 3,
      inicio: aMinutos('17:30'),
      fin: aMinutos('18:15'),
    });
  });
});
