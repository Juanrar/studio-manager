import { describe, expect, it } from 'vitest';
import { resumir, type ClaseParaResumen, type PagoParaResumen } from '../resumen.ts';

const HOY = '2026-03-10';

const erik = { id: 1, nombre: 'Erik', apellido: 'Zapata' };
const julia = { id: 2, nombre: 'Julia', apellido: 'Paz' };

const clases: ClaseParaResumen[] = [
  { fecha: '2026-03-17', horaInicio: '19:00', clase: 'Jazz', profesor: erik },
  { fecha: '2026-03-10', horaInicio: '19:00', clase: 'Jazz', profesor: julia },
  { fecha: '2026-03-05', horaInicio: '19:00', clase: 'Jazz', profesor: erik },
  { fecha: '2026-03-03', horaInicio: '19:00', clase: 'Jazz', profesor: erik },
  { fecha: '2026-02-26', horaInicio: '18:00', clase: 'Salsa', profesor: erik },
  { fecha: '2026-01-13', horaInicio: '19:00', clase: 'Salsa', profesor: erik },
  { fecha: '2025-03-20', horaInicio: '19:00', clase: 'Salsa', profesor: erik },
];

const pagos: PagoParaResumen[] = [
  { dia: '2026-01-10', pack: 'Pack x4', cantidadClases: 4, clasesUsadas: 1, monto: 5200, vencido: true },
  { dia: '2026-02-20', pack: 'Clase suelta', cantidadClases: 1, clasesUsadas: 1, monto: 1500, vencido: true },
  { dia: '2026-02-20', pack: 'Clase suelta', cantidadClases: 1, clasesUsadas: 1, monto: 1500, vencido: true },
  { dia: '2026-03-02', pack: 'Pack x8', cantidadClases: 8, clasesUsadas: 3, monto: 9600, vencido: false },
];

const vacio = (mes: string) => ({ mes, compras: [], tomadas: 0, vencidas: 0, clases: [] });
const DOCE_MESES_VACIOS = [
  '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
].map(vacio);

describe('resumir', () => {
  it('calcula todos los indicadores y los 12 meses', () => {
    expect(resumir(clases, pagos, HOY)).toEqual({
      clasesTomadas: 6,
      clasesEnOchoSemanas: 4,
      ultimaClase: '2026-03-10',
      hoy: HOY,
      estiloMasTomado: 'Jazz',
      sueleVenir: { diasSemana: [2, 4], horaInicio: '19:00' },
      vencidasSinUsar: 3,
      totalPagado: 17800,
      profesores: [
        { ...erik, estilo: 'Salsa', clases: 5 },
        { ...julia, estilo: 'Jazz', clases: 1 },
      ],
      meses: [
        ...['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'].map(vacio),
        {
          mes: '2026-01', compras: [{ pack: 'Pack x4', veces: 1 }], tomadas: 1, vencidas: 3,
          clases: [{ fecha: '2026-01-13', estilo: 'Salsa', profesor: erik }],
        },
        {
          mes: '2026-02', compras: [{ pack: 'Clase suelta', veces: 2 }], tomadas: 1, vencidas: 0,
          clases: [{ fecha: '2026-02-26', estilo: 'Salsa', profesor: erik }],
        },
        {
          mes: '2026-03', compras: [{ pack: 'Pack x8', veces: 1 }], tomadas: 3, vencidas: 0,
          clases: [
            { fecha: '2026-03-10', estilo: 'Jazz', profesor: julia },
            { fecha: '2026-03-05', estilo: 'Jazz', profesor: erik },
            { fecha: '2026-03-03', estilo: 'Jazz', profesor: erik },
          ],
        },
      ],
    });
  });

  it('sin clases ni pagos devuelve ceros, nulos y 12 meses vacíos', () => {
    expect(resumir([], [], HOY)).toEqual({
      clasesTomadas: 0,
      clasesEnOchoSemanas: 0,
      ultimaClase: null,
      hoy: HOY,
      estiloMasTomado: null,
      sueleVenir: null,
      vencidasSinUsar: 0,
      totalPagado: 0,
      profesores: [],
      meses: DOCE_MESES_VACIOS,
    });
  });

  it('ante un empate de estilos gana el de la clase más reciente', () => {
    const resumen = resumir(
      [
        { fecha: '2026-03-03', horaInicio: '19:00', clase: 'Jazz', profesor: erik },
        { fecha: '2026-03-05', horaInicio: '19:00', clase: 'Salsa', profesor: erik },
      ],
      [],
      HOY,
    );
    expect(resumen.estiloMasTomado).toBe('Salsa');
  });

  it('devuelve solo los cuatro profesores con más clases', () => {
    const profesor = (id: number) => ({ id, nombre: `P${id}`, apellido: `A${id}` });
    const dar = (id: number, fecha: string) => ({ fecha, horaInicio: '19:00', clase: 'Jazz', profesor: profesor(id) });
    const resumen = resumir(
      [
        dar(1, '2026-03-02'), dar(1, '2026-03-03'), dar(1, '2026-03-04'), dar(1, '2026-03-05'),
        dar(2, '2026-03-02'), dar(2, '2026-03-03'), dar(2, '2026-03-04'),
        dar(3, '2026-03-02'), dar(3, '2026-03-03'),
        dar(4, '2026-03-06'), dar(4, '2026-03-07'),
        dar(5, '2026-03-08'),
      ],
      [],
      HOY,
    );
    expect(resumen.profesores).toEqual([
      { ...profesor(1), estilo: 'Jazz', clases: 4 },
      { ...profesor(2), estilo: 'Jazz', clases: 3 },
      { ...profesor(4), estilo: 'Jazz', clases: 2 },
      { ...profesor(3), estilo: 'Jazz', clases: 2 },
    ]);
  });
});
