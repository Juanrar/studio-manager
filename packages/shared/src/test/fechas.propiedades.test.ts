import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { esFechaDia, lunesDe, sumarDias, sumarMeses, type FechaDia } from '../fechas.ts';

const MS_POR_DIA = 86_400_000;
const PRIMER_DIA = Date.UTC(1900, 0, 1) / MS_POR_DIA;
const ULTIMO_DIA = Date.UTC(2200, 11, 31) / MS_POR_DIA;

const fechaDia: fc.Arbitrary<FechaDia> = fc
  .integer({ min: PRIMER_DIA, max: ULTIMO_DIA })
  .map((dia) => new Date(dia * MS_POR_DIA).toISOString().slice(0, 10));

const ultimoDiaDeUnMes: fc.Arbitrary<FechaDia> = fc
  .record({ anio: fc.integer({ min: 1900, max: 2200 }), mes: fc.integer({ min: 1, max: 12 }) })
  .map(({ anio, mes }) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10));

const fechaConFinesDeMes = fc.oneof(fechaDia, ultimoDiaDeUnMes);

const CORRIDAS_DE_SUMAR_MESES = { numRuns: 1_000 };

function partes(fecha: FechaDia): [number, number, number] {
  return fecha.split('-').map(Number) as [number, number, number];
}

function diaDesdeElOrigen(fecha: FechaDia): number {
  const [anio, mes, dia] = partes(fecha);
  return Date.UTC(anio, mes - 1, dia) / MS_POR_DIA;
}

function esLunes(fecha: FechaDia): boolean {
  return new Date(diaDesdeElOrigen(fecha) * MS_POR_DIA).getUTCDay() === 1;
}

describe('sumarDias, propiedades', () => {
  it('sumar n días y después restarlos devuelve la misma fecha', () => {
    fc.assert(
      fc.property(fechaDia, fc.integer({ min: -36_500, max: 36_500 }), (fecha, n) => {
        expect(sumarDias(sumarDias(fecha, n), -n)).toBe(fecha);
      }),
    );
  });

  it('da una fecha válida que está a n días de la original', () => {
    fc.assert(
      fc.property(fechaDia, fc.integer({ min: -36_500, max: 36_500 }), (fecha, n) => {
        const resultado = sumarDias(fecha, n);
        expect(esFechaDia(resultado)).toBe(true);
        expect(diaDesdeElOrigen(resultado) - diaDesdeElOrigen(fecha)).toBe(n);
      }),
    );
  });
});

describe('lunesDe, propiedades', () => {
  it('es un lunes, no es posterior a la fecha y está a menos de 7 días', () => {
    fc.assert(
      fc.property(fechaDia, (fecha) => {
        const lunes = lunesDe(fecha);
        const distancia = diaDesdeElOrigen(fecha) - diaDesdeElOrigen(lunes);
        expect(esFechaDia(lunes)).toBe(true);
        expect(esLunes(lunes)).toBe(true);
        expect(distancia).toBeGreaterThanOrEqual(0);
        expect(distancia).toBeLessThan(7);
      }),
    );
  });
});

describe('sumarMeses, propiedades', () => {
  it('da una fecha válida, en el mes que corresponde, con un día que no supera al original', () => {
    fc.assert(
      fc.property(fechaConFinesDeMes, fc.integer({ min: -1_200, max: 1_200 }), (fecha, n) => {
        const resultado = sumarMeses(fecha, n);
        const [anio, mes, dia] = partes(fecha);
        const [anioResultado, mesResultado, diaResultado] = partes(resultado);
        expect(esFechaDia(resultado)).toBe(true);
        expect(anioResultado * 12 + mesResultado).toBe(anio * 12 + mes + n);
        expect(diaResultado).toBeLessThanOrEqual(dia);
      }),
      CORRIDAS_DE_SUMAR_MESES,
    );
  });

  it('conserva el día, o lo recorta al último día del mes', () => {
    fc.assert(
      fc.property(fechaConFinesDeMes, fc.integer({ min: -1_200, max: 1_200 }), (fecha, n) => {
        const resultado = sumarMeses(fecha, n);
        const conservaElDia = partes(resultado)[2] === partes(fecha)[2];
        const esElUltimoDelMes = partes(sumarDias(resultado, 1))[2] === 1;
        expect(conservaElDia || esElUltimoDelMes).toBe(true);
      }),
      CORRIDAS_DE_SUMAR_MESES,
    );
  });
});
