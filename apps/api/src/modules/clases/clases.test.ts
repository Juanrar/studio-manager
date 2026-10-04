import type { FastifyInstance } from 'fastify';
import type { Profesor } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  AHORA,
  RECEPCION,
  crearAppDeTest,
  crearUsuarioDeTest,
  loguear,
} from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearClaseDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { hoyEnEstudio } from '../../lib/fechas.ts';
import { actualizarProfesor } from '../profesores/profesores.service.ts';
import { actualizarClase } from './clases.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookieAdmin: string;
let cookieRecepcion: string;
let erik: Profesor;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest();
  await crearUsuarioDeTest(ADMIN);
  await crearUsuarioDeTest(RECEPCION);
  cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);
  cookieRecepcion = await loguear(app, RECEPCION.email, RECEPCION.password);
  erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata' });
});

afterEach(async () => {
  await app.close();
});

function crearClase(cookie: string, datos: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/clases', payload: datos, headers: { cookie } });
}

function pedirClases(consulta: string) {
  return app.inject({ method: 'GET', url: `/api/clases?${consulta}`, headers: { cookie: cookieRecepcion } });
}

const HIP_HOP_MARTES = { estilo: 'Hip-Hop', nivel: 'Inicial', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' };

describe('POST /api/clases', () => {
  it('admin crea una clase con las horas en HH:MM y recepción no puede', async () => {
    const comoAdmin = await crearClase(cookieAdmin, { ...HIP_HOP_MARTES, profesorId: erik.id });
    const comoRecepcion = await crearClase(cookieRecepcion, { ...HIP_HOP_MARTES, profesorId: erik.id });

    expect(comoAdmin.statusCode).toBe(201);
    expect(comoAdmin.json()).toEqual({
      id: expect.any(Number),
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      diaSemana: 2,
      horaInicio: '19:00',
      horaFin: '20:30',
      profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      activa: true,
    });
    expect(comoRecepcion.statusCode).toBe(403);
  });

  it('responde 400 si la hora de fin no es posterior al inicio', async () => {
    const respuesta = await crearClase(cookieAdmin, {
      ...HIP_HOP_MARTES,
      horaFin: '19:00',
      profesorId: erik.id,
    });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json().detalles.map((d: { campo: string }) => d.campo)).toEqual(['horaFin']);
  });

  it('responde 422 si el profesor está dado de baja', async () => {
    await actualizarProfesor(erik.id, { activo: false }, hoyEnEstudio(AHORA));

    const respuesta = await crearClase(cookieAdmin, { ...HIP_HOP_MARTES, profesorId: erik.id });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'El profesor Erik Zapata está dado de baja' });
  });
});

describe('PATCH /api/clases/:id', () => {
  it('responde 422 si el cambio deja la hora de fin antes del inicio', async () => {
    const clase = await crearClaseDeTest(erik.id, { horaInicio: '19:00', horaFin: '20:30' });

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/clases/${clase.id}`,
      payload: { horaFin: '18:00' },
      headers: { cookie: cookieAdmin },
    });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'La hora de fin tiene que ser posterior a la de inicio' });
  });
});

describe('GET /api/clases', () => {
  it('con profesorId trae solo las clases activas de ese profesor, ordenadas por día y hora', async () => {
    const lucia = await crearProfesorDeTest({ nombre: 'Lucía', apellido: 'Paz' });
    // Las de Erik se crean fuera de orden: el orden de la respuesta no puede salir de los ids.
    const hipHopMartes = await crearClaseDeTest(erik.id, HIP_HOP_MARTES);
    const jazzLunes = await crearClaseDeTest(erik.id, {
      estilo: 'Jazz',
      nivel: 'Avanzado',
      diaSemana: 1,
      horaInicio: '21:00',
      horaFin: '22:30',
    });
    const contemporaneoLunes = await crearClaseDeTest(erik.id, {
      estilo: 'Contemporáneo',
      nivel: 'Intermedio',
      diaSemana: 1,
      horaInicio: '18:00',
      horaFin: '19:30',
    });
    const breakLunes = await crearClaseDeTest(erik.id, {
      estilo: 'Break',
      diaSemana: 1,
      horaInicio: '19:30',
      horaFin: '21:00',
    });
    await actualizarClase(breakLunes.id, { activa: false });
    await crearClaseDeTest(lucia.id, { estilo: 'Salsa', diaSemana: 1, horaInicio: '19:00', horaFin: '20:30' });

    const respuesta = await pedirClases(`profesorId=${erik.id}`);

    const erikResumen = { id: erik.id, nombre: 'Erik', apellido: 'Zapata' };
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      items: [
        {
          id: contemporaneoLunes.id,
          estilo: 'Contemporáneo',
          nivel: 'Intermedio',
          diaSemana: 1,
          horaInicio: '18:00',
          horaFin: '19:30',
          profesor: erikResumen,
          activa: true,
        },
        {
          id: jazzLunes.id,
          estilo: 'Jazz',
          nivel: 'Avanzado',
          diaSemana: 1,
          horaInicio: '21:00',
          horaFin: '22:30',
          profesor: erikResumen,
          activa: true,
        },
        {
          id: hipHopMartes.id,
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          diaSemana: 2,
          horaInicio: '19:00',
          horaFin: '20:30',
          profesor: erikResumen,
          activa: true,
        },
      ],
    });
  });

  it('con incluirInactivos=true suma las dadas de baja de ese profesor y sigue sin traer las de otro', async () => {
    const lucia = await crearProfesorDeTest({ nombre: 'Lucía', apellido: 'Paz' });
    const hipHopMartes = await crearClaseDeTest(erik.id, HIP_HOP_MARTES);
    const breakLunes = await crearClaseDeTest(erik.id, {
      estilo: 'Break',
      nivel: null,
      diaSemana: 1,
      horaInicio: '19:30',
      horaFin: '21:00',
    });
    await actualizarClase(breakLunes.id, { activa: false });
    await crearClaseDeTest(lucia.id, { estilo: 'Salsa', diaSemana: 1, horaInicio: '19:00', horaFin: '20:30' });

    const respuesta = await pedirClases(`profesorId=${erik.id}&incluirInactivos=true`);

    const erikResumen = { id: erik.id, nombre: 'Erik', apellido: 'Zapata' };
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      items: [
        {
          id: breakLunes.id,
          estilo: 'Break',
          nivel: null,
          diaSemana: 1,
          horaInicio: '19:30',
          horaFin: '21:00',
          profesor: erikResumen,
          activa: false,
        },
        {
          id: hipHopMartes.id,
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          diaSemana: 2,
          horaInicio: '19:00',
          horaFin: '20:30',
          profesor: erikResumen,
          activa: true,
        },
      ],
    });
  });

  it('no valida al profesor: uno dado de baja trae sus clases y uno que no existe, una lista vacía', async () => {
    const hipHopMartes = await crearClaseDeTest(erik.id, HIP_HOP_MARTES);
    await actualizarProfesor(erik.id, { activo: false }, hoyEnEstudio(AHORA));

    const dadoDeBaja = await pedirClases(`profesorId=${erik.id}`);
    const inexistente = await pedirClases('profesorId=999999');

    expect(dadoDeBaja.statusCode).toBe(200);
    expect(dadoDeBaja.json()).toEqual({
      items: [
        {
          id: hipHopMartes.id,
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          diaSemana: 2,
          horaInicio: '19:00',
          horaFin: '20:30',
          profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
          activa: true,
        },
      ],
    });
    expect(inexistente.statusCode).toBe(200);
    expect(inexistente.json()).toEqual({ items: [] });
  });
});
