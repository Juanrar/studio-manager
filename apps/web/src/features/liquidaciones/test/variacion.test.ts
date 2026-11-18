import { describe, expect, it } from 'vitest';
import { variacion } from '../variacion.ts';

describe('variacion', () => {
  it('muestra el porcentaje entero con signo contra el mes anterior', () => {
    expect(variacion(112, 100)).toBe('+12%');
    expect(variacion(95, 100)).toBe('-5%');
    expect(variacion(100, 100)).toBe('0%');
  });

  it('redondea al entero más cercano y no devuelve un cero con signo', () => {
    expect(variacion(10, 3)).toBe('+233%');
    expect(variacion(1004, 1000)).toBe('0%');
    expect(variacion(996, 1000)).toBe('0%');
  });

  it('muestra una raya cuando el mes anterior es 0', () => {
    expect(variacion(500, 0)).toBe('—');
    expect(variacion(0, 0)).toBe('—');
  });

  it('con un mes anterior negativo, una mejora suma', () => {
    expect(variacion(-250, -1000)).toBe('+75%');
    expect(variacion(-1500, -1000)).toBe('-50%');
  });
});
