import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { db } from '../../db/client.ts';
import { ReglaDeNegocioError } from '../../lib/errores.ts';
import { agregarPorcentaje, crearProfesor, porcentajeVigente } from './profesores.service.ts';

let base: BaseDeTest;
let profesorId: number;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

// Alta el 1 de enero con 50%, y desde el 1 de marzo pasa a 60%.
beforeEach(async () => {
  await base.limpiar();
  const profesor = await crearProfesor(
    { nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000 },
    '2026-01-01',
  );
  profesorId = profesor.id;
  await agregarPorcentaje(profesorId, { porcentajeBp: 6000, vigenteDesde: '2026-03-01' });
});

describe('porcentajeVigente', () => {
  it.each([
    ['el día anterior al cambio usa el porcentaje viejo', '2026-02-28', 5000],
    ['el día del cambio ya usa el nuevo', '2026-03-01', 6000],
    ['después del cambio usa el nuevo', '2026-07-15', 6000],
  ])('%s', async (_caso, fecha, esperado) => {
    expect(await porcentajeVigente(db, profesorId, fecha)).toBe(esperado);
  });

  it('antes del primer porcentaje es un error de regla de negocio', async () => {
    await expect(porcentajeVigente(db, profesorId, '2025-12-31')).rejects.toThrow(
      new ReglaDeNegocioError('El profesor no tiene un porcentaje vigente el 2025-12-31'),
    );
  });
});
