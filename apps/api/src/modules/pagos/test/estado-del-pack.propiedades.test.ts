import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FechaDia } from '../../../lib/fechas.ts';
import { estadoDelPack, type PagoDeAlumno } from '../estado-del-pack.ts';

const MS_POR_DIA = 86_400_000;
const PRIMER_DIA = Date.UTC(1900, 0, 1) / MS_POR_DIA;
const ULTIMO_DIA = Date.UTC(2200, 11, 31) / MS_POR_DIA;

function aFechaDia(dia: number): FechaDia {
  return new Date(dia * MS_POR_DIA).toISOString().slice(0, 10);
}

const pagoSinIdNiVencimiento = fc
  .integer({ min: 1, max: 20 })
  .chain((cantidadClases) =>
    fc.record({
      pack: fc.constantFrom('Pack x4', 'Pack x8', 'Pase libre'),
      cantidadClases: fc.constant(cantidadClases),
      clasesUsadas: fc.integer({ min: 0, max: cantidadClases }),
      diasHastaElVencimiento: fc.integer({ min: -60, max: 60 }),
    }),
  );

const hoyConPagos = fc
  .record({
    hoy: fc.integer({ min: PRIMER_DIA + 60, max: ULTIMO_DIA - 60 }),
    pagos: fc.array(pagoSinIdNiVencimiento, { minLength: 1, maxLength: 6 }),
  })
  .map(({ hoy, pagos }) => ({
    hoy: aFechaDia(hoy),
    pagos: pagos.map(
      ({ diasHastaElVencimiento, ...pago }, indice): PagoDeAlumno => ({
        id: indice + 1,
        ...pago,
        venceEl: aFechaDia(hoy + diasHastaElVencimiento),
      }),
    ),
  }));

describe('estadoDelPack, propiedades', () => {
  it('con pagos que no usaron más clases que las del pack, las restantes del pago actual están entre 0 y las del pack', () => {
    fc.assert(
      fc.property(hoyConPagos, ({ hoy, pagos }) => {
        const { pagoActual } = estadoDelPack(pagos, hoy);
        expect(pagoActual).not.toBeNull();
        expect(pagoActual!.clasesRestantes).toBeGreaterThanOrEqual(0);
        expect(pagoActual!.clasesRestantes).toBeLessThanOrEqual(pagoActual!.cantidadClases);
      }),
    );
  });

  it('sin pagos, el estado es sin_pack y no hay pago actual', () => {
    fc.assert(
      fc.property(fc.integer({ min: PRIMER_DIA, max: ULTIMO_DIA }), (dia) => {
        expect(estadoDelPack([], aFechaDia(dia))).toEqual({ estadoPack: 'sin_pack', pagoActual: null });
      }),
    );
  });
});
