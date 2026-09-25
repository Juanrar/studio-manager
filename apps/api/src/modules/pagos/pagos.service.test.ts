import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AHORA, RECEPCION, crearUsuarioDeTest } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearAlumnoDeTest, crearPackDeTest } from '../../../test/fabricas.ts';
import { db } from '../../db/client.ts';
import { elegirPagoParaAsistencia, registrarPago } from './pagos.service.ts';

let base: BaseDeTest;
let alumnoId: number;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  const recepcion = await crearUsuarioDeTest(RECEPCION);
  const alumno = await crearAlumnoDeTest();
  const claseSuelta = await crearPackDeTest({ nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 });
  alumnoId = alumno.id;
  await registrarPago({ alumnoId, packId: claseSuelta.id, medio: 'efectivo' }, recepcion.id, AHORA, '2026-03-10');
});

describe('elegirPagoParaAsistencia', () => {
  // Determinístico: el test HTTP de registros simultáneos detecta la carrera solo a veces.
  it('bloquea el pago elegido hasta que termina la transacción', async () => {
    await db.transaction(async (primera) => {
      await elegirPagoParaAsistencia(primera, alumnoId, '2026-03-10');

      const segunda = db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '50ms'`);
        return elegirPagoParaAsistencia(tx, alumnoId, '2026-03-10');
      });

      await expect(segunda).rejects.toMatchObject({ cause: { code: '55P03' } });
    });
  });
});
