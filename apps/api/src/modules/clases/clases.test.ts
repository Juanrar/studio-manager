import type { FastifyInstance } from 'fastify';
import type { Horario, Profesor } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearHorarioDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { actualizarHorario } from '../horarios/horarios.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookie: string;
let erik: Profesor;
let hipHopMartes: Horario;

// 2026-03-10 es martes; 2026-03-11, miércoles.
const MARTES = '2026-03-10';
const MIERCOLES = '2026-03-11';

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

function abrirClase(horarioId: number, fecha: string) {
  return app.inject({ method: 'POST', url: '/api/clases', payload: { horarioId, fecha }, headers: { cookie } });
}

describe('GET /api/clases/dia', () => {
  it('trae solo los horarios activos de ese día de la semana, ordenados por hora y sin clase abierta', async () => {
    const ballet = await crearHorarioDeTest(erik.id, {
      estilo: 'Ballet',
      nivel: null,
      diaSemana: 2,
      horaInicio: '18:00',
      horaFin: '19:00',
    });
    await crearHorarioDeTest(erik.id, { estilo: 'Jazz', diaSemana: 3 });
    const salsa = await crearHorarioDeTest(erik.id, { estilo: 'Salsa', diaSemana: 2, horaInicio: '21:00', horaFin: '22:00' });
    await actualizarHorario(salsa.id, { activo: false });

    const respuesta = await app.inject({ method: 'GET', url: `/api/clases/dia?fecha=${MARTES}`, headers: { cookie } });

    const erikResumen = { id: erik.id, nombre: 'Erik', apellido: 'Zapata' };
    expect(respuesta.json()).toEqual({
      fecha: MARTES,
      items: [
        {
          horarioId: ballet.id,
          estilo: 'Ballet',
          nivel: null,
          horaInicio: '18:00',
          horaFin: '19:00',
          profesorTitular: erikResumen,
          clase: null,
        },
        {
          horarioId: hipHopMartes.id,
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          horaInicio: '19:00',
          horaFin: '20:30',
          profesorTitular: erikResumen,
          clase: null,
        },
      ],
    });
  });
});

describe('POST /api/clases', () => {
  it('abrir la misma clase dos veces devuelve la misma clase', async () => {
    const primera = await abrirClase(hipHopMartes.id, MARTES);
    const segunda = await abrirClase(hipHopMartes.id, MARTES);

    expect(primera.statusCode).toBe(201);
    expect(primera.json()).toEqual({
      id: expect.any(Number),
      horarioId: hipHopMartes.id,
      fecha: MARTES,
      estado: 'programada',
      profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      asistentes: 0,
    });
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json()).toEqual(primera.json());
  });

  it('responde 422 si la fecha no cae en el día de la semana de la clase', async () => {
    const respuesta = await abrirClase(hipHopMartes.id, MIERCOLES);

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'El horario de Hip-Hop no se dicta el 2026-03-11' });
  });
});

describe('PATCH /api/clases/:id', () => {
  it('una suplencia cambia el profesor de la clase y no el titular del horario', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    const clase = (await abrirClase(hipHopMartes.id, MARTES)).json();

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/clases/${clase.id}`,
      payload: { profesorId: iaru.id },
      headers: { cookie },
    });
    const horarios = await app.inject({ method: 'GET', url: '/api/horarios', headers: { cookie } });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().profesor).toEqual({ id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' });
    expect(horarios.json().items[0].profesor).toEqual({ id: erik.id, nombre: 'Erik', apellido: 'Zapata' });
  });
});

describe('GET /api/clases/:id', () => {
  it('devuelve la clase con los datos de su horario', async () => {
    const abierta = (await abrirClase(hipHopMartes.id, MARTES)).json();

    const respuesta = await app.inject({ method: 'GET', url: `/api/clases/${abierta.id}`, headers: { cookie } });

    expect(respuesta.json()).toEqual({
      ...abierta,
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      horaInicio: '19:00',
      horaFin: '20:30',
    });
  });
});
