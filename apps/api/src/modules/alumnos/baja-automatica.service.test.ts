import { isNull } from 'drizzle-orm';
import type { Alumno, Pack, UsuarioPublico } from '@studio/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AHORA, RECEPCION, crearUsuarioDeTest } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearAlumnoDeTest, crearPackDeTest } from '../../../test/fabricas.ts';
import { alumno, cambioEstadoAlumno } from '../../db/schema.ts';
import { anularPago, extenderVencimiento, registrarPago } from '../pagos/pagos.service.ts';
import { actualizarAlumno } from './alumnos.service.ts';
import { darDeBajaPorNoComprar } from './baja-automatica.service.ts';

let base: BaseDeTest;
let recepcion: UsuarioPublico;
let pack: Pack;

// AHORA es el martes 2026-03-10.
const HOY = '2026-03-10';

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  recepcion = await crearUsuarioDeTest(RECEPCION);
  pack = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
});

// El día `dia` a las 12:00 de Buenos Aires.
function aLas12(dia: string): Date {
  return new Date(`${dia}T15:00:00Z`);
}

async function comprar(quien: Alumno, dia: string) {
  return registrarPago({ alumnoId: quien.id, packId: pack.id, medio: 'efectivo' }, recepcion.id, aLas12(dia), dia);
}

async function bajasAutomaticas() {
  return base.db
    .select({
      alumnoId: cambioEstadoAlumno.alumnoId,
      activo: cambioEstadoAlumno.activo,
      registradoEn: cambioEstadoAlumno.registradoEn,
    })
    .from(cambioEstadoAlumno)
    .where(isNull(cambioEstadoAlumno.registradoPor))
    .orderBy(cambioEstadoAlumno.alumnoId);
}

describe('darDeBajaPorNoComprar', () => {
  it('da de baja a quien pasó 2 meses sin comprar, ignora pagos anulados y a los ya dados de baja, lo registra como automático y no repite nada si corre otra vez', async () => {
    // Compró hace 2 meses justos.
    const lucia = await crearAlumnoDeTest({ nombre: 'Lucía' }, aLas12('2025-12-01'));
    await comprar(lucia, '2026-01-10');
    // Compró un día después: todavía no le toca.
    const martina = await crearAlumnoDeTest({ nombre: 'Martina' }, aLas12('2025-12-01'));
    await comprar(martina, '2026-01-11');
    // Nunca compró y se anotó hace 2 meses.
    const joaquin = await crearAlumnoDeTest({ nombre: 'Joaquín' }, aLas12('2026-01-10'));
    // Compró en diciembre, pero el admin le extendió el pack hasta el 20 de marzo.
    const paula = await crearAlumnoDeTest({ nombre: 'Paula' }, aLas12('2025-10-01'));
    const extendido = await comprar(paula, '2025-12-01');
    await extenderVencimiento(extendido.id, '2026-03-20', HOY);
    // Compró en noviembre, pero se lo reactivó el 20 de enero.
    const tomas = await crearAlumnoDeTest({ nombre: 'Tomás' }, aLas12('2025-10-01'));
    await comprar(tomas, '2025-11-01');
    await actualizarAlumno(tomas.id, { activo: false }, recepcion.id, aLas12('2025-12-15'));
    await actualizarAlumno(tomas.id, { activo: true }, recepcion.id, aLas12('2026-01-20'));
    // Ya estaba dada de baja a mano.
    const valentina = await crearAlumnoDeTest({ nombre: 'Valentina' }, aLas12('2025-06-01'));
    await actualizarAlumno(valentina.id, { activo: false }, recepcion.id, aLas12('2025-09-01'));
    // Su pago de febrero se anuló: la última compra es la de diciembre.
    const sofia = await crearAlumnoDeTest({ nombre: 'Sofía' }, aLas12('2025-10-01'));
    await comprar(sofia, '2025-12-01');
    const anulado = await comprar(sofia, '2026-02-20');
    await anularPago(anulado.id, 'Se cargó dos veces', AHORA, HOY);

    const dados = await darDeBajaPorNoComprar(AHORA, HOY);

    expect(dados).toEqual([lucia.id, joaquin.id, sofia.id]);
    expect(await base.db.select({ id: alumno.id, activo: alumno.activo }).from(alumno).orderBy(alumno.id)).toEqual([
      { id: lucia.id, activo: false },
      { id: martina.id, activo: true },
      { id: joaquin.id, activo: false },
      { id: paula.id, activo: true },
      { id: tomas.id, activo: true },
      { id: valentina.id, activo: false },
      { id: sofia.id, activo: false },
    ]);
    expect(await bajasAutomaticas()).toEqual([
      { alumnoId: lucia.id, activo: false, registradoEn: AHORA },
      { alumnoId: joaquin.id, activo: false, registradoEn: AHORA },
      { alumnoId: sofia.id, activo: false, registradoEn: AHORA },
    ]);

    expect(await darDeBajaPorNoComprar(AHORA, HOY)).toEqual([]);
    expect(await bajasAutomaticas()).toHaveLength(3);
  });
});
