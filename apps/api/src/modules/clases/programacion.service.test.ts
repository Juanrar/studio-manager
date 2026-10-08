import { asc, eq } from 'drizzle-orm';
import type { Profesor } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ADMIN, RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearAlumnoDeTest, crearHorarioDeTest, crearPackDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { db } from '../../db/client.ts';
import { clase } from '../../db/schema.ts';
import { registrarAsistencia } from '../asistencias/asistencias.service.ts';
import { actualizarHorario } from '../horarios/horarios.service.ts';
import { registrarPago } from '../pagos/pagos.service.ts';
import { abrirClase, actualizarClase } from './clases.service.ts';
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

describe('PATCH /api/horarios/:id', () => {
  // El reloj de los tests marca el martes 10 de marzo: hoy hay clase, y el horizonte llega al 28 de abril.
  const MARTES = '2026-03-10';
  const MARTES_DEL_HORIZONTE = [
    '2026-03-10',
    '2026-03-17',
    '2026-03-24',
    '2026-03-31',
    '2026-04-07',
    '2026-04-14',
    '2026-04-21',
    '2026-04-28',
  ];
  let app: FastifyInstance;
  let cookie: string;
  let hipHop: { id: number };

  beforeEach(async () => {
    app = await crearAppDeTest();
    await crearUsuarioDeTest(ADMIN);
    cookie = await loguear(app, ADMIN.email, ADMIN.password);
    hipHop = await crearHorarioDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' });
    // La semana pasada ya tuvo su clase; desde esta semana las crea el generador.
    await abrirClase(hipHop.id, '2026-03-03');
    await generarClases(db, MARTES);
  });

  afterEach(async () => {
    await app.close();
  });

  function cambiarHorario(cambios: Record<string, unknown>) {
    return app.inject({ method: 'PATCH', url: `/api/horarios/${hipHop.id}`, payload: cambios, headers: { cookie } });
  }

  async function claseDel(fecha: string) {
    const [encontrada] = await db.select().from(clase).where(eq(clase.fecha, fecha));
    return encontrada!;
  }

  // Martina compra un pack x4 hoy (vence el 10 de abril) y se anota en la clase de `fecha`.
  async function anotarAMartinaEl(fecha: string) {
    const recepcion = await crearUsuarioDeTest(RECEPCION);
    const martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
    const pack = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
    const ahora = new Date(`${MARTES}T15:00:00Z`);
    await registrarPago({ alumnoId: martina.id, packId: pack.id, medio: 'efectivo' }, recepcion.id, ahora, MARTES);
    await registrarAsistencia((await claseDel(fecha)).id, { alumnoId: martina.id }, recepcion.id, ahora, MARTES);
  }

  it('cambiar la hora cambia las clases desde hoy, salvo la que tiene suplente y la de la semana pasada', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    await actualizarClase((await claseDel('2026-03-17')).id, { profesorId: iaru.id }, MARTES);

    const respuesta = await cambiarHorario({ horaInicio: '20:00', horaFin: '21:30' });

    expect(respuesta.statusCode).toBe(200);
    expect((await clasesGuardadas()).map((c) => `${c.fecha} ${c.horaInicio}`)).toEqual([
      '2026-03-03 19:00:00',
      '2026-03-10 20:00:00',
      '2026-03-17 19:00:00',
      ...MARTES_DEL_HORIZONTE.slice(2).map((fecha) => `${fecha} 20:00:00`),
    ]);
  });

  it('cambiar el día mueve cada clase a ese día de su semana, sin pasar a días que ya pasaron', async () => {
    const respuesta = await cambiarHorario({ diaSemana: 1 });

    // El lunes de esta semana ya pasó: la clase de hoy se queda el martes.
    expect(respuesta.statusCode).toBe(200);
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual([
      '2026-03-03',
      '2026-03-10',
      '2026-03-16',
      '2026-03-23',
      '2026-03-30',
      '2026-04-06',
      '2026-04-13',
      '2026-04-20',
      '2026-04-27',
    ]);
  });

  it('cambiar el día con un alumno anotado cuyo pack vence antes de la fecha nueva da 422 y no cambia nada', async () => {
    await anotarAMartinaEl('2026-04-07');

    const respuesta = await cambiarHorario({ diaSemana: 6 });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({
      error: 'La clase del 2026-04-07 tiene alumnos anotados con un pack que vence antes del 2026-04-11',
    });
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual(['2026-03-03', ...MARTES_DEL_HORIZONTE]);
    const horarios = await app.inject({ method: 'GET', url: '/api/horarios', headers: { cookie } });
    expect(horarios.json().items[0].diaSemana).toBe(2);
  });

  it('dar de baja un horario borra sus clases desde hoy sin asistencias y conserva la de la semana pasada', async () => {
    const respuesta = await cambiarHorario({ activo: false });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().activo).toBe(false);
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual(['2026-03-03']);
  });

  it('dar de baja un horario con un alumno anotado en una clase futura da 422 y no borra nada', async () => {
    await anotarAMartinaEl('2026-03-24');

    const respuesta = await cambiarHorario({ activo: false });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({
      error: 'El horario de Hip-Hop tiene alumnos anotados el 2026-03-24. Quitalos antes de darlo de baja',
    });
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual(['2026-03-03', ...MARTES_DEL_HORIZONTE]);
  });

  it('aplicar a todas desde una semana cambia esa semana y las siguientes; las anteriores y la que tiene suplente quedan', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    await actualizarClase((await claseDel('2026-04-07')).id, { profesorId: iaru.id }, MARTES);
    // Primero se movió la clase de la semana del 23 en la grilla; el aviso ofrece aplicarlo a todas.
    const delVeinticuatro = (await claseDel('2026-03-24')).id;
    await actualizarClase(delVeinticuatro, { horaInicio: '20:00', horaFin: '21:30' }, MARTES);

    const respuesta = await cambiarHorario({ horaInicio: '20:00', horaFin: '21:30', desde: '2026-03-23' });

    expect(respuesta.statusCode).toBe(200);
    expect((await clasesGuardadas()).map((c) => `${c.fecha} ${c.horaInicio}`)).toEqual([
      '2026-03-03 19:00:00',
      '2026-03-10 19:00:00',
      '2026-03-17 19:00:00',
      '2026-03-24 20:00:00',
      '2026-03-31 20:00:00',
      '2026-04-07 19:00:00',
      '2026-04-14 20:00:00',
      '2026-04-21 20:00:00',
      '2026-04-28 20:00:00',
    ]);
    const semana = await app.inject({ method: 'GET', url: '/api/clases?desde=2026-03-23&hasta=2026-03-29', headers: { cookie } });
    expect(semana.json().items).toEqual([expect.objectContaining({ id: delVeinticuatro, tieneCambios: false })]);
  });

  it('quitar de todas desde una semana borra esa semana y las siguientes, y deja las anteriores', async () => {
    const respuesta = await cambiarHorario({ activo: false, desde: '2026-03-23' });

    expect(respuesta.statusCode).toBe(200);
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual(['2026-03-03', '2026-03-10', '2026-03-17']);
  });

  it('desde tiene que ser un lunes', async () => {
    const respuesta = await cambiarHorario({ horaInicio: '20:00', horaFin: '21:30', desde: '2026-03-24' });

    expect(respuesta.statusCode).toBe(400);
  });

  it('agregar a todas convierte la clase única en la primera de un horario nuevo y crea las semanas siguientes', async () => {
    const unica = await app.inject({
      method: 'POST',
      url: '/api/clases',
      payload: { fecha: '2026-03-21', horaInicio: '11:00', horaFin: '12:00', estilo: 'Jazz', nivel: null, profesorId: erik.id },
      headers: { cookie },
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/horarios',
      payload: {
        estilo: 'Jazz',
        nivel: null,
        diaSemana: 6,
        horaInicio: '11:00',
        horaFin: '12:00',
        profesorId: erik.id,
        desde: '2026-03-16',
        claseId: unica.json().id,
      },
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(201);
    const jazz = (await clasesGuardadas()).filter((c) => c.estilo === 'Jazz');
    expect(jazz.map((c) => [c.fecha, c.horarioId])).toEqual(
      ['2026-03-21', '2026-03-28', '2026-04-04', '2026-04-11', '2026-04-18', '2026-04-25', '2026-05-02'].map((fecha) => [
        fecha,
        respuesta.json().id,
      ]),
    );
    expect(jazz[0]?.id).toBe(unica.json().id);
  });

  it('un horario nuevo no puede regir desde una semana pasada', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/horarios',
      payload: { estilo: 'Jazz', nivel: null, diaSemana: 6, horaInicio: '11:00', horaFin: '12:00', profesorId: erik.id, desde: '2026-03-02' },
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'Un horario nuevo rige desde esta semana o una posterior' });
  });

  it('reactivar un horario vuelve a crear sus clases desde esta semana', async () => {
    await cambiarHorario({ activo: false });

    const respuesta = await cambiarHorario({ activo: true });

    expect(respuesta.statusCode).toBe(200);
    expect((await clasesGuardadas()).map((c) => c.fecha)).toEqual(['2026-03-03', ...MARTES_DEL_HORIZONTE]);
  });
});
