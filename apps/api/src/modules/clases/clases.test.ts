import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Horario, Profesor } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearHorarioDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { db } from '../../db/client.ts';
import { clase } from '../../db/schema.ts';
import { abrirClase, actualizarClase } from './clases.service.ts';
import { generarClases } from './programacion.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookie: string;
let erik: Profesor;
let hipHopMartes: Horario;

// 2026-03-10 es martes; 2026-03-11, miércoles. Es el día del reloj de los tests: el horizonte llega
// hasta el domingo 3 de mayo, el de la semana que contiene el 30 de abril.
const MARTES = '2026-03-10';
const MIERCOLES = '2026-03-11';
const FIN_DEL_HORIZONTE = '2026-05-03';

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest();
  await crearUsuarioDeTest(RECEPCION);
  cookie = await loguear(app, RECEPCION.email, RECEPCION.password);
  erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata' });
  hipHopMartes = await crearHorarioDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' });
});

afterEach(async () => {
  await app.close();
});

function pedirClases(consulta: string) {
  return app.inject({ method: 'GET', url: `/api/clases${consulta}`, headers: { cookie } });
}

// La clase de un horario en una fecha, ya creada por el generador o por `abrirClase`.
async function claseDe(horarioId: number, fecha: string): Promise<number> {
  const [encontrada] = await db
    .select({ id: clase.id })
    .from(clase)
    .where(and(eq(clase.horarioId, horarioId), eq(clase.fecha, fecha)));
  return encontrada!.id;
}

const erikResumen = () => ({ id: erik.id, nombre: 'Erik', apellido: 'Zapata' });

describe('GET /api/clases', () => {
  it('trae las clases del día ordenadas por hora, con las canceladas, el titular, el profesor, los cambios propios y los asistentes', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    const ballet = await crearHorarioDeTest(erik.id, {
      estilo: 'Ballet',
      nivel: null,
      diaSemana: 2,
      horaInicio: '18:00',
      horaFin: '19:00',
    });
    const salsa = await crearHorarioDeTest(erik.id, {
      estilo: 'Salsa',
      nivel: 'Avanzado',
      diaSemana: 2,
      horaInicio: '21:00',
      horaFin: '22:00',
    });
    await crearHorarioDeTest(erik.id, { estilo: 'Jazz', diaSemana: 3 });
    await generarClases(db, MARTES);
    await actualizarClase(await claseDe(ballet.id, MARTES), { estado: 'cancelada' });
    await actualizarClase(await claseDe(hipHopMartes.id, MARTES), { profesorId: iaru.id });

    const respuesta = await pedirClases(`?desde=${MARTES}&hasta=${MARTES}`);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      desde: MARTES,
      hasta: MARTES,
      finDelHorizonte: FIN_DEL_HORIZONTE,
      items: [
        {
          id: expect.any(Number),
          horarioId: ballet.id,
          fecha: MARTES,
          horaInicio: '18:00',
          horaFin: '19:00',
          estilo: 'Ballet',
          nivel: null,
          estado: 'cancelada',
          profesor: erikResumen(),
          profesorTitular: erikResumen(),
          tieneCambios: true,
          asistentes: 0,
        },
        {
          id: expect.any(Number),
          horarioId: hipHopMartes.id,
          fecha: MARTES,
          horaInicio: '19:00',
          horaFin: '20:30',
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          estado: 'programada',
          profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
          profesorTitular: erikResumen(),
          tieneCambios: true,
          asistentes: 0,
        },
        {
          id: expect.any(Number),
          horarioId: salsa.id,
          fecha: MARTES,
          horaInicio: '21:00',
          horaFin: '22:00',
          estilo: 'Salsa',
          nivel: 'Avanzado',
          estado: 'programada',
          profesor: erikResumen(),
          profesorTitular: erikResumen(),
          tieneCambios: false,
          asistentes: 0,
        },
      ],
    });
  });

  it('un rango de varios días viene ordenado por fecha y después por hora', async () => {
    await crearHorarioDeTest(erik.id, { estilo: 'Jazz', diaSemana: 3, horaInicio: '10:00', horaFin: '11:00' });
    await crearHorarioDeTest(erik.id, { estilo: 'Ballet', diaSemana: 2, horaInicio: '09:00', horaFin: '10:00' });
    await generarClases(db, MARTES);

    const respuesta = await pedirClases(`?desde=${MARTES}&hasta=${MIERCOLES}`);

    const items = respuesta.json().items as { fecha: string; estilo: string }[];
    expect(items.map((c) => `${c.fecha} ${c.estilo}`)).toEqual([
      `${MARTES} Ballet`,
      `${MARTES} Hip-Hop`,
      `${MIERCOLES} Jazz`,
    ]);
  });

  it('sin fechas trae el día de hoy en el estudio', async () => {
    await generarClases(db, MARTES);

    const respuesta = await pedirClases('');

    expect(respuesta.json()).toMatchObject({ desde: MARTES, hasta: MARTES, finDelHorizonte: FIN_DEL_HORIZONTE });
    expect((respuesta.json().items as { estilo: string }[]).map((c) => c.estilo)).toEqual(['Hip-Hop']);
  });

  it('una clase de una semana anterior no marca cambios propios aunque haya tenido suplente', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    const { clase: pasada } = await abrirClase(hipHopMartes.id, '2026-03-03');
    await actualizarClase(pasada.id, { profesorId: iaru.id });

    const respuesta = await pedirClases('?desde=2026-03-03&hasta=2026-03-03');

    expect(respuesta.json().items).toEqual([
      expect.objectContaining({
        id: pasada.id,
        profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
        tieneCambios: false,
      }),
    ]);
  });

  it('responde 400 si desde es posterior a hasta', async () => {
    const respuesta = await pedirClases(`?desde=${MIERCOLES}&hasta=${MARTES}`);

    expect(respuesta.statusCode).toBe(400);
  });

  it('ya no se abre una clase por HTTP: las crea el generador', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/clases',
      payload: { horarioId: hipHopMartes.id, fecha: MARTES },
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(404);
  });
});

describe('abrirClase', () => {
  it('la clase guarda su semana y copia la hora, el estilo y el nivel del horario', async () => {
    const { clase: abierta } = await abrirClase(hipHopMartes.id, MARTES);

    const [guardada] = await db.select().from(clase).where(eq(clase.id, abierta.id));
    expect(guardada).toEqual({
      id: abierta.id,
      horarioId: hipHopMartes.id,
      semana: '2026-03-09',
      fecha: MARTES,
      horaInicio: '19:00:00',
      horaFin: '20:30:00',
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      profesorId: erik.id,
      estado: 'programada',
    });
  });
});

describe('PATCH /api/clases/:id', () => {
  it('una suplencia cambia el profesor de la clase y no el titular del horario', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    await generarClases(db, MARTES);
    const id = await claseDe(hipHopMartes.id, MARTES);

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/clases/${id}`,
      payload: { profesorId: iaru.id },
      headers: { cookie },
    });
    const horarios = await app.inject({ method: 'GET', url: '/api/horarios', headers: { cookie } });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      id,
      profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
      profesorTitular: erikResumen(),
      tieneCambios: true,
    });
    expect(horarios.json().items[0].profesor).toEqual(erikResumen());
  });
});

describe('GET /api/clases/:id', () => {
  it('devuelve la clase con su hora, su estilo y el titular del horario', async () => {
    await generarClases(db, MARTES);
    const id = await claseDe(hipHopMartes.id, MARTES);

    const respuesta = await app.inject({ method: 'GET', url: `/api/clases/${id}`, headers: { cookie } });

    expect(respuesta.json()).toEqual({
      id,
      horarioId: hipHopMartes.id,
      fecha: MARTES,
      horaInicio: '19:00',
      horaFin: '20:30',
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      estado: 'programada',
      profesor: erikResumen(),
      profesorTitular: erikResumen(),
      tieneCambios: false,
      asistentes: 0,
    });
  });
});
