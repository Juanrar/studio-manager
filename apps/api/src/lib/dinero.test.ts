import { describe, expect, it } from 'vitest';
import { aplicarPorcentaje, dividirEnPartes, formatearPesos, verificarPesos } from './dinero.ts';

describe('verificarPesos', () => {
  it('devuelve el valor cuando es un entero', () => {
    expect(verificarPesos(8000)).toBe(8000);
    expect(verificarPesos(0)).toBe(0);
  });

  it('rechaza montos con decimales', () => {
    expect(() => verificarPesos(19.99)).toThrow();
  });

  it('rechaza valores que no son finitos', () => {
    expect(() => verificarPesos(Number.NaN)).toThrow();
    expect(() => verificarPesos(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('dividirEnPartes', () => {
  it('divide un pack en partes exactas', () => {
    expect(dividirEnPartes(9600, 8)).toBe(1200);
  });

  it('redondea al peso más cercano cuando no es exacto', () => {
    // 5200 dividido en 3 da 1733,33 y redondea para abajo
    expect(dividirEnPartes(5200, 3)).toBe(1733);
    // 1001 dividido en 2 da 500,5 y redondea para arriba
    expect(dividirEnPartes(1001, 2)).toBe(501);
  });

  it('rechaza una cantidad de partes menor o igual a cero', () => {
    expect(() => dividirEnPartes(9600, 0)).toThrow();
    expect(() => dividirEnPartes(9600, -2)).toThrow();
  });

  it('rechaza un total con decimales', () => {
    expect(() => dividirEnPartes(9600.5, 8)).toThrow();
  });
});

describe('aplicarPorcentaje', () => {
  it('calcula el 50 por ciento', () => {
    expect(aplicarPorcentaje(1200, 5000)).toBe(600);
  });

  it('calcula el 100 por ciento', () => {
    expect(aplicarPorcentaje(1200, 10_000)).toBe(1200);
  });

  it('acepta porcentajes con decimales expresados en puntos básicos', () => {
    // 52,5% de 1200 es 630
    expect(aplicarPorcentaje(1200, 5250)).toBe(630);
  });

  it('redondea al peso más cercano', () => {
    // 60% de 1733 es 1039,8 y redondea a 1040
    expect(aplicarPorcentaje(1733, 6000)).toBe(1040);
    // 33,33% de 1 peso redondea a 0
    expect(aplicarPorcentaje(1, 3333)).toBe(0);
  });

  it('rechaza porcentajes fuera del rango 1 a 10000', () => {
    expect(() => aplicarPorcentaje(1200, 0)).toThrow();
    expect(() => aplicarPorcentaje(1200, 10_001)).toThrow();
  });
});

describe('formatearPesos', () => {
  it('muestra el monto sin decimales y con separador de miles', () => {
    expect(formatearPesos(9600)).toBe('$9.600');
    expect(formatearPesos(1500)).toBe('$1.500');
  });
});
