import { describe, expect, it } from 'vitest';
import { detalleACsv } from './csv.ts';

describe('detalleACsv', () => {
  it('usa punto y coma, fechas DD/MM/AAAA y cierra con el total', () => {
    const csv = detalleACsv([
      { sesionId: 1, fecha: '2026-03-03', estilo: 'Hip-Hop', asistentes: 1, monto: 650 },
      { sesionId: 2, fecha: '2026-03-10', estilo: 'Hip-Hop; avanzado', asistentes: 2, monto: 1400 },
    ]);

    expect(csv).toBe(
      [
        'Fecha;Clase;Asistentes;Monto',
        '03/03/2026;Hip-Hop;1;650',
        '10/03/2026;"Hip-Hop; avanzado";2;1400',
        'Total;;3;2050',
      ].join('\r\n'),
    );
  });
});
