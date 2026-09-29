import { describe, expect, it } from 'vitest';
import { estadoDelPack, type PagoDeAlumno } from './estado-del-pack.ts';

// Martes 10 de marzo de 2026, igual que el reloj de los tests de integración.
const HOY = '2026-03-10';

function pago(datos: Partial<PagoDeAlumno>): PagoDeAlumno {
  return { id: 1, pack: 'Pack x8', cantidadClases: 8, clasesUsadas: 0, venceEl: '2026-04-01', ...datos };
}

describe('estadoDelPack', () => {
  it('con clases y más de 7 días de margen, el pack está vigente', () => {
    expect(estadoDelPack([pago({ clasesUsadas: 3 })], HOY)).toEqual({
      estadoPack: 'vigente',
      pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 5, venceEl: '2026-04-01' },
    });
  });

  it('si queda una clase, el pack está por vencer', () => {
    expect(estadoDelPack([pago({ clasesUsadas: 7 })], HOY)).toEqual({
      estadoPack: 'por_vencer',
      pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 1, venceEl: '2026-04-01' },
    });
  });

  it('si vence en 7 días está por vencer, y en 8 días todavía está vigente', () => {
    expect(estadoDelPack([pago({ venceEl: '2026-03-17' })], HOY).estadoPack).toBe('por_vencer');
    expect(estadoDelPack([pago({ venceEl: '2026-03-18' })], HOY).estadoPack).toBe('vigente');
  });

  it('el día del vencimiento el pack todavía sirve', () => {
    expect(estadoDelPack([pago({ pack: 'Pack x4', cantidadClases: 4, venceEl: HOY })], HOY)).toEqual({
      estadoPack: 'por_vencer',
      pagoActual: { pack: 'Pack x4', cantidadClases: 4, clasesRestantes: 4, venceEl: HOY },
    });
  });

  it('con el pack siguiente ya pagado, el que se termina no lo pone por vencer, y se muestra el que se usa primero', () => {
    const siguiente = pago({ id: 2, pack: 'Pack x4', cantidadClases: 4, venceEl: '2026-04-09' });
    const enUso = pago({ id: 1, clasesUsadas: 7, venceEl: '2026-03-15' });

    expect(estadoDelPack([siguiente, enUso], HOY)).toEqual({
      estadoPack: 'vigente',
      pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 1, venceEl: '2026-03-15' },
    });
  });

  it('con pagos sin vencer pero sin clases, queda sin clases y muestra el que vence último', () => {
    const pagos = [
      pago({ id: 1, clasesUsadas: 2, venceEl: '2026-03-01' }),
      pago({ id: 2, pack: 'Pack x4', cantidadClases: 4, clasesUsadas: 4, venceEl: '2026-03-20' }),
      pago({ id: 3, pack: 'Clase suelta', cantidadClases: 1, clasesUsadas: 1, venceEl: '2026-04-05' }),
    ];

    expect(estadoDelPack(pagos, HOY)).toEqual({
      estadoPack: 'sin_clases',
      pagoActual: { pack: 'Clase suelta', cantidadClases: 1, clasesRestantes: 0, venceEl: '2026-04-05' },
    });
  });

  it('con todos los pagos vencidos, queda vencido y muestra el último con las clases que no usó', () => {
    const pagos = [
      pago({ id: 2, pack: 'Pack x4', cantidadClases: 4, clasesUsadas: 2, venceEl: '2026-03-09' }),
      pago({ id: 1, clasesUsadas: 6, venceEl: '2026-02-01' }),
    ];

    expect(estadoDelPack(pagos, HOY)).toEqual({
      estadoPack: 'vencido',
      pagoActual: { pack: 'Pack x4', cantidadClases: 4, clasesRestantes: 2, venceEl: '2026-03-09' },
    });
  });

  it('sin pagos, no tiene pack', () => {
    expect(estadoDelPack([], HOY)).toEqual({ estadoPack: 'sin_pack', pagoActual: null });
  });
});
