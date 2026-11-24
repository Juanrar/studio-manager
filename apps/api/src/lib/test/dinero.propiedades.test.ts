import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aplicarPorcentaje, dividirEnPartes } from '../dinero.ts';

const monto = fc.integer({ min: 0, max: 100_000_000_000 });
const porcentajeBp = fc.integer({ min: 1, max: 10_000 });
const porcentajeBpMenorAlTotal = fc.integer({ min: 1, max: 9_999 });
const partes = fc.integer({ min: 1, max: 1_000 });

describe('aplicarPorcentaje, propiedades', () => {
  it('da un monto entre 0 y el monto original', () => {
    fc.assert(
      fc.property(monto, porcentajeBp, (m, bp) => {
        const resultado = aplicarPorcentaje(m, bp);
        expect(resultado).toBeGreaterThanOrEqual(0);
        expect(resultado).toBeLessThanOrEqual(m);
      }),
    );
  });

  it('con 10000 puntos básicos da el monto original', () => {
    fc.assert(
      fc.property(monto, (m) => {
        expect(aplicarPorcentaje(m, 10_000)).toBe(m);
      }),
    );
  });

  it('no baja cuando sube el porcentaje', () => {
    fc.assert(
      fc.property(monto, porcentajeBp, porcentajeBp, (m, a, b) => {
        const [menor, mayor] = a <= b ? [a, b] : [b, a];
        expect(aplicarPorcentaje(m, menor)).toBeLessThanOrEqual(aplicarPorcentaje(m, mayor));
      }),
    );
  });

  it('un porcentaje y su complemento suman el monto con un peso de diferencia como mucho', () => {
    fc.assert(
      fc.property(monto, porcentajeBpMenorAlTotal, (m, bp) => {
        const suma = aplicarPorcentaje(m, bp) + aplicarPorcentaje(m, 10_000 - bp);
        expect(Math.abs(suma - m)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('se aleja del valor exacto en medio peso como mucho', () => {
    fc.assert(
      fc.property(monto, porcentajeBp, (m, bp) => {
        const exacto = (m * bp) / 10_000;
        expect(Math.abs(aplicarPorcentaje(m, bp) - exacto)).toBeLessThanOrEqual(0.5);
      }),
    );
  });
});

describe('dividirEnPartes, propiedades', () => {
  it('multiplicado por la cantidad de partes se aleja del total en la mitad de las partes como mucho', () => {
    fc.assert(
      fc.property(monto, partes, (total, n) => {
        expect(Math.abs(dividirEnPartes(total, n) * n - total)).toBeLessThanOrEqual(n / 2);
      }),
    );
  });
});
