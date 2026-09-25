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
