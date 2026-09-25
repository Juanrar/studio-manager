import type { FastifyInstance } from 'fastify';
import type { Clase, Profesor } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearClaseDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { actualizarClase } from './clases.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookie: string;
let erik: Profesor;
let hipHopMartes: Clase;

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
  hipHopMartes = await crearClaseDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' });
});

afterEach(async () => {
  await app.close();
});

function abrirSesion(claseId: number, fecha: string) {
  return app.inject({ method: 'POST', url: '/api/sesiones', payload: { claseId, fecha }, headers: { cookie } });
}

describe('GET /api/sesiones/dia', () => {
  it('trae solo las clases activas de ese día de la semana, ordenadas por hora y sin sesión', async () => {
    const ballet = await crearClaseDeTest(erik.id, {
      estilo: 'Ballet',
      nivel: null,
      diaSemana: 2,
      horaInicio: '18:00',
      horaFin: '19:00',
    });
    await crearClaseDeTest(erik.id, { estilo: 'Jazz', diaSemana: 3 });
    const salsa = await crearClaseDeTest(erik.id, { estilo: 'Salsa', diaSemana: 2, horaInicio: '21:00', horaFin: '22:00' });
    await actualizarClase(salsa.id, { activa: false });

    const respuesta = await app.inject({ method: 'GET', url: `/api/sesiones/dia?fecha=${MARTES}`, headers: { cookie } });

    const erikResumen = { id: erik.id, nombre: 'Erik', apellido: 'Zapata' };
    expect(respuesta.json()).toEqual({
      fecha: MARTES,
      items: [
        {
          claseId: ballet.id,
          estilo: 'Ballet',
          nivel: null,
          horaInicio: '18:00',
          horaFin: '19:00',
          profesorTitular: erikResumen,
          sesion: null,
        },
        {
          claseId: hipHopMartes.id,
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          horaInicio: '19:00',
          horaFin: '20:30',
          profesorTitular: erikResumen,
          sesion: null,
        },
      ],
    });
  });
});

describe('POST /api/sesiones', () => {
  it('abrir la misma sesión dos veces devuelve la misma sesión', async () => {
    const primera = await abrirSesion(hipHopMartes.id, MARTES);
    const segunda = await abrirSesion(hipHopMartes.id, MARTES);

    expect(primera.statusCode).toBe(201);
    expect(primera.json()).toEqual({
      id: expect.any(Number),
      claseId: hipHopMartes.id,
      fecha: MARTES,
      estado: 'programada',
      profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      asistentes: 0,
    });
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json()).toEqual(primera.json());
  });

  it('responde 422 si la fecha no cae en el día de la semana de la clase', async () => {
    const respuesta = await abrirSesion(hipHopMartes.id, MIERCOLES);

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'La clase Hip-Hop no se dicta el 2026-03-11' });
  });
});

describe('PATCH /api/sesiones/:id', () => {
  it('una suplencia cambia el profesor de la sesión y no el titular de la clase', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    const sesion = (await abrirSesion(hipHopMartes.id, MARTES)).json();

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/sesiones/${sesion.id}`,
      payload: { profesorId: iaru.id },
      headers: { cookie },
    });
    const clases = await app.inject({ method: 'GET', url: '/api/clases', headers: { cookie } });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().profesor).toEqual({ id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' });
    expect(clases.json().items[0].profesor).toEqual({ id: erik.id, nombre: 'Erik', apellido: 'Zapata' });
  });
});

describe('GET /api/sesiones/:id', () => {
  it('devuelve la sesión con los datos de su clase', async () => {
    const abierta = (await abrirSesion(hipHopMartes.id, MARTES)).json();

    const respuesta = await app.inject({ method: 'GET', url: `/api/sesiones/${abierta.id}`, headers: { cookie } });

    expect(respuesta.json()).toEqual({
      ...abierta,
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      horaInicio: '19:00',
      horaFin: '20:30',
    });
  });
});
