import { describe, expect, it } from 'vitest';
import { fechaDiaSchema } from '../comun.ts';
import {
  diaSemanaIso,
  edadEn,
  esFechaDia,
  horaEnEstudio,
  hoyEnEstudio,
  lunesDe,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
  sumarUnMes,
} from '../fechas.ts';
import { crearHorarioSchema } from '../horarios.ts';

describe('hoyEnEstudio', () => {
  it('devuelve el día en la zona del estudio, no en UTC', () => {
    // 2026-03-10T02:00:00Z son las 23:00 del 9 de marzo en Buenos Aires
    const instante = new Date('2026-03-10T02:00:00Z');
    expect(hoyEnEstudio(instante)).toBe('2026-03-09');
  });

  it('devuelve el mismo día cuando el instante ya está dentro del día local', () => {
    const instante = new Date('2026-03-10T15:00:00Z');
    expect(hoyEnEstudio(instante)).toBe('2026-03-10');
  });
});

describe('diaSemanaIso', () => {
  it('devuelve 1 para un lunes', () => {
    expect(diaSemanaIso('2026-03-09')).toBe(1);
  });

  it('devuelve 7 para un domingo', () => {
    expect(diaSemanaIso('2026-03-15')).toBe(7);
  });
});

describe('sumarDias', () => {
  it('suma días dentro del mes y cruza al mes siguiente', () => {
    expect(sumarDias('2026-03-10', 7)).toBe('2026-03-17');
    expect(sumarDias('2026-03-28', 7)).toBe('2026-04-04');
  });

  it('cruza el fin de año', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('sumarUnMes', () => {
  it('suma un mes en un caso simple', () => {
    expect(sumarUnMes('2026-03-10')).toBe('2026-04-10');
  });

  it('recorta al último día cuando el mes siguiente es más corto', () => {
    expect(sumarUnMes('2026-01-31')).toBe('2026-02-28');
  });

  it('respeta el año bisiesto', () => {
    expect(sumarUnMes('2028-01-31')).toBe('2028-02-29');
  });

  it('cruza el cambio de año', () => {
    expect(sumarUnMes('2026-12-15')).toBe('2027-01-15');
  });
});

describe('sumarMeses', () => {
  it('suma meses y cruza el cambio de año', () => {
    expect(sumarMeses('2026-07-29', 2)).toBe('2026-09-29');
    expect(sumarMeses('2026-11-15', 2)).toBe('2027-01-15');
  });

  it('recorta al último día del mes de destino, sin pasar por el mes del medio', () => {
    expect(sumarMeses('2026-12-31', 2)).toBe('2027-02-28');
    // Sumando de a un mes daría el 28 de marzo.
    expect(sumarMeses('2027-01-31', 2)).toBe('2027-03-31');
  });
});

describe('primerDiaDelMes', () => {
  it('devuelve el día 1 del mes de la fecha', () => {
    expect(primerDiaDelMes('2026-03-27')).toBe('2026-03-01');
  });
});

describe('esFechaDia', () => {
  it('acepta un formato válido', () => {
    expect(esFechaDia('2026-03-09')).toBe(true);
  });

  it('rechaza formatos inválidos y fechas que no existen', () => {
    expect(esFechaDia('09-03-2026')).toBe(false);
    expect(esFechaDia('2026-13-01')).toBe(false);
    expect(esFechaDia('2026-02-30')).toBe(false);
  });
});

describe('lunesDe', () => {
  it('devuelve el lunes de la semana, que va de lunes a domingo', () => {
    expect(lunesDe('2026-10-08')).toBe('2026-10-05'); // jueves
    expect(lunesDe('2026-10-05')).toBe('2026-10-05'); // el mismo lunes
    expect(lunesDe('2026-10-11')).toBe('2026-10-05'); // domingo: es el fin de esa semana, no el comienzo de otra
  });

  it('cruza al mes y al año anteriores', () => {
    expect(lunesDe('2026-11-01')).toBe('2026-10-26');
    expect(lunesDe('2027-01-01')).toBe('2026-12-28');
  });
});

describe('horaEnEstudio', () => {
  it('devuelve la hora en la zona del estudio, no en UTC', () => {
    // 2026-03-10T02:30:00Z son las 23:30 del 9 de marzo en Buenos Aires
    expect(horaEnEstudio(new Date('2026-03-10T02:30:00Z'))).toBe('23:30');
  });

  it('escribe la medianoche como 00:00, no como 24:00', () => {
    expect(horaEnEstudio(new Date('2026-03-10T03:00:00Z'))).toBe('00:00');
  });
});

describe('sumarMeses hacia atrás', () => {
  it('recorta al último día cuando el mes anterior es más corto', () => {
    // 2026 no es bisiesto.
    expect(sumarMeses('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('de enero pasa a diciembre del año anterior', () => {
    expect(sumarMeses('2026-01-15', -1)).toBe('2025-12-15');
  });
});

describe('edadEn', () => {
  it('el día antes del cumpleaños da un año menos', () => {
    expect(edadEn('2010-05-20', '2026-05-19')).toBe(15);
  });

  it('el día del cumpleaños da el año nuevo', () => {
    expect(edadEn('2010-05-20', '2026-05-20')).toBe(16);
  });

  it('quien nació un 29 de febrero cumple el 1 de marzo en un año no bisiesto', () => {
    expect(edadEn('2012-02-29', '2026-02-28')).toBe(13);
    expect(edadEn('2012-02-29', '2026-03-01')).toBe(14);
  });
});

describe('fechaDiaSchema', () => {
  it('acepta un día que existe', () => {
    expect(fechaDiaSchema.safeParse('2026-03-09')).toEqual({ success: true, data: '2026-03-09' });
  });

  it('rechaza un día que no existe', () => {
    const resultado = fechaDiaSchema.safeParse('2026-02-30');
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((issue) => issue.message)).toEqual(['La fecha no existe']);
  });

  it('rechaza un formato inválido', () => {
    const resultado = fechaDiaSchema.safeParse('09-03-2026');
    expect(resultado.success).toBe(false);
    // El refine corre aunque el formato ya haya fallado: salen los dos mensajes, primero el del formato.
    expect(resultado.error?.issues.map((issue) => issue.message)).toEqual([
      'La fecha tiene que tener el formato AAAA-MM-DD',
      'La fecha no existe',
    ]);
  });
});

describe('crearHorarioSchema', () => {
  const horario = { estilo: 'Hip-Hop', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30', profesorId: 1 };

  it('rechaza un `desde` que no es lunes', () => {
    // El 10 de marzo de 2026 es martes.
    const resultado = crearHorarioSchema.safeParse({ ...horario, desde: '2026-03-10' });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((issue) => ({ path: issue.path, message: issue.message }))).toEqual([
      { path: ['desde'], message: 'Tiene que ser el lunes de una semana' },
    ]);
  });

  it('acepta un `desde` que es lunes', () => {
    expect(crearHorarioSchema.safeParse({ ...horario, desde: '2026-03-09' })).toEqual({
      success: true,
      data: { ...horario, desde: '2026-03-09' },
    });
  });
});
