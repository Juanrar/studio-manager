import { asc, eq } from 'drizzle-orm';
import type { Profesor } from '@studio/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearHorarioDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { db } from '../../db/client.ts';
import { clase } from '../../db/schema.ts';
import { actualizarHorario } from '../horarios/horarios.service.ts';
import { generarClases } from './programacion.service.ts';

let base: BaseDeTest;
let erik: Profesor;

// Jueves 8 de octubre de 2026: el horizonte va de la semana del 5 de octubre a la del 30 de noviembre.
const HOY = '2026-10-08';
const JUEVES_DEL_HORIZONTE = [
  '2026-10-08',
  '2026-10-15',
  '2026-10-22',
  '2026-10-29',
  '2026-11-05',
  '2026-11-12',
  '2026-11-19',
  '2026-11-26',
  '2026-12-03',
];

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata' });
});

const salsaDelJueves = (hoy?: string) =>
  crearHorarioDeTest(erik.id, { estilo: 'Salsa', nivel: 'Inicial', diaSemana: 4, horaInicio: '20:00', horaFin: '21:00' }, hoy);

function clasesGuardadas() {
  return db.select().from(clase).orderBy(asc(clase.fecha), asc(clase.id));
}

describe('generarClases', () => {
  it('crea una clase por semana del horizonte, el día del horario y con sus datos copiados', async () => {
    const salsa = await salsaDelJueves();

    const creadas = await generarClases(db, HOY);

    const guardadas = await clasesGuardadas();
    expect(creadas).toBe(9);
    expect(guardadas.map((c) => c.fecha)).toEqual(JUEVES_DEL_HORIZONTE);
    expect(guardadas[0]).toEqual({
      id: expect.any(Number),
      horarioId: salsa.id,
      semana: '2026-10-05',
      fecha: '2026-10-08',
      horaInicio: '20:00:00',
      horaFin: '21:00:00',
      estilo: 'Salsa',
      nivel: 'Inicial',
      profesorId: erik.id,
      estado: 'programada',
    });
    expect(guardadas.at(-1)?.semana).toBe('2026-11-30');
  });

  it('correrlo dos veces deja las mismas clases', async () => {
    await salsaDelJueves();

    await generarClases(db, HOY);
    const segunda = await generarClases(db, HOY);

    expect(segunda).toBe(0);
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual(JUEVES_DEL_HORIZONTE);
  });

  it('una clase movida a otro día de su semana no hace que se cree otra en el día del horario', async () => {
    await salsaDelJueves();
    await generarClases(db, HOY);
    // La feature 26 mueve clases desde la grilla; acá se mueve con un update directo.
    await db.update(clase).set({ fecha: '2026-10-16' }).where(eq(clase.fecha, '2026-10-15'));

    await generarClases(db, HOY);

    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual([
      '2026-10-08',
      '2026-10-16',
      ...JUEVES_DEL_HORIZONTE.slice(2),
    ]);
  });

  it('un horario que rige desde la semana del 19 de octubre no tiene clases antes', async () => {
    await salsaDelJueves('2026-10-19');

    await generarClases(db, HOY);

    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual(JUEVES_DEL_HORIZONTE.slice(2));
  });

  it('no crea clases en semanas pasadas, aunque el horario rija desde antes', async () => {
    // Rige desde la semana del 9 de marzo, el AHORA de los tests.
    await salsaDelJueves();

    await generarClases(db, HOY);

    expect((await clasesGuardadas())[0]?.fecha).toBe('2026-10-08');
  });

  it('un horario dado de baja no genera clases', async () => {
    const salsa = await salsaDelJueves();
    await actualizarHorario(salsa.id, { activo: false });

    expect(await generarClases(db, HOY)).toBe(0);
    expect(await clasesGuardadas()).toEqual([]);
  });

  it('con un horario elegido, genera solo las clases de ese horario', async () => {
    const salsa = await salsaDelJueves();
    await crearHorarioDeTest(erik.id, { estilo: 'Tango', diaSemana: 5 });

    await generarClases(db, HOY, salsa.id);

    expect(new Set((await clasesGuardadas()).map((c) => c.estilo))).toEqual(new Set(['Salsa']));
  });
});

describe('POST /api/horarios', () => {
  it('crea las clases del horizonte del horario sin esperar a la tarea', async () => {
    const app = await crearAppDeTest();
    await crearUsuarioDeTest(ADMIN);
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/horarios',
      payload: { estilo: 'Hip-Hop', nivel: null, diaSemana: 2, horaInicio: '19:00', horaFin: '20:30', profesorId: erik.id },
      headers: { cookie },
    });
    await app.close();

    // El reloj de los tests marca el martes 10 de marzo: el horizonte llega a la semana del 27 de abril.
    expect(respuesta.statusCode).toBe(201);
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual([
      '2026-03-10',
      '2026-03-17',
      '2026-03-24',
      '2026-03-31',
      '2026-04-07',
      '2026-04-14',
      '2026-04-21',
      '2026-04-28',
    ]);
  });
});
