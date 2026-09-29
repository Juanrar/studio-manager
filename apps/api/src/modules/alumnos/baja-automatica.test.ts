import { describe, expect, it } from 'vitest';
import { correspondeBajaAutomatica, type AlumnoParaBaja } from './baja-automatica.ts';

// Martes 10 de marzo de 2026, igual que el reloj de los tests de integración.
const HOY = '2026-03-10';

function alumno(datos: Partial<AlumnoParaBaja>): AlumnoParaBaja {
  return { activoDesde: '2025-10-01', ultimaCompra: null, tienePackSinVencer: false, ...datos };
}

describe('correspondeBajaAutomatica', () => {
  it('a los 2 meses de la última compra corresponde la baja, y un día antes no', () => {
    expect(correspondeBajaAutomatica(alumno({ ultimaCompra: '2026-01-10' }), HOY)).toBe(true);
    expect(correspondeBajaAutomatica(alumno({ ultimaCompra: '2026-01-11' }), HOY)).toBe(false);
  });

  it('si nunca compró, se cuenta desde el alta', () => {
    expect(correspondeBajaAutomatica(alumno({ activoDesde: '2026-01-10' }), HOY)).toBe(true);
    expect(correspondeBajaAutomatica(alumno({ activoDesde: '2026-01-11' }), HOY)).toBe(false);
  });

  it('una reactivación posterior a la última compra vuelve a contar desde ella', () => {
    expect(correspondeBajaAutomatica(alumno({ ultimaCompra: '2025-11-01', activoDesde: '2026-02-01' }), HOY)).toBe(
      false,
    );
  });

  it('con un pago sin vencer no corresponde la baja, aunque la compra tenga más de 2 meses', () => {
    expect(correspondeBajaAutomatica(alumno({ ultimaCompra: '2025-12-01', tienePackSinVencer: true }), HOY)).toBe(
      false,
    );
  });
});
