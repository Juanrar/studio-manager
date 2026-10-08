import { eq } from 'drizzle-orm';
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
import { db } from '../../db/client.ts';
import { horario as tablaHorario } from '../../db/schema.ts';
import { crearHorarioDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { hoyEnEstudio } from '../../lib/fechas.ts';
import { actualizarProfesor } from '../profesores/profesores.service.ts';
import { actualizarHorario } from './horarios.service.ts';

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

function crearHorario(cookie: string, datos: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/horarios', payload: datos, headers: { cookie } });
}

function pedirHorarios(consulta: string) {
  return app.inject({ method: 'GET', url: `/api/horarios?${consulta}`, headers: { cookie: cookieRecepcion } });
}

const HIP_HOP_MARTES = { estilo: 'Hip-Hop', nivel: 'Inicial', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' };

describe('POST /api/horarios', () => {
  it('admin crea un horario con las horas en HH:MM y recepción no puede', async () => {
    const comoAdmin = await crearHorario(cookieAdmin, { ...HIP_HOP_MARTES, profesorId: erik.id });
    const comoRecepcion = await crearHorario(cookieRecepcion, { ...HIP_HOP_MARTES, profesorId: erik.id });

    expect(comoAdmin.statusCode).toBe(201);
    expect(comoAdmin.json()).toEqual({
      id: expect.any(Number),
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      diaSemana: 2,
      horaInicio: '19:00',
      horaFin: '20:30',
      profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      activo: true,
    });
    expect(comoRecepcion.statusCode).toBe(403);
  });

  it('el horario rige desde el lunes de la semana en que se crea', async () => {
    const respuesta = await crearHorario(cookieAdmin, { ...HIP_HOP_MARTES, profesorId: erik.id });

    const [guardado] = await db.select().from(tablaHorario).where(eq(tablaHorario.id, respuesta.json().id));
    // El reloj de los tests marca el martes 2026-03-10.
    expect(guardado?.vigenteDesde).toBe('2026-03-09');
  });

  it('responde 400 si la hora de fin no es posterior al inicio', async () => {
    const respuesta = await crearHorario(cookieAdmin, {
      ...HIP_HOP_MARTES,
      horaFin: '19:00',
      profesorId: erik.id,
    });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json().detalles.map((d: { campo: string }) => d.campo)).toEqual(['horaFin']);
  });

  it('responde 422 si el profesor está dado de baja', async () => {
    await actualizarProfesor(erik.id, { activo: false }, hoyEnEstudio(AHORA));

    const respuesta = await crearHorario(cookieAdmin, { ...HIP_HOP_MARTES, profesorId: erik.id });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'El profesor Erik Zapata está dado de baja' });
  });
});

describe('PATCH /api/horarios/:id', () => {
  it('responde 422 si el cambio deja la hora de fin antes del inicio', async () => {
    const horario = await crearHorarioDeTest(erik.id, { horaInicio: '19:00', horaFin: '20:30' });

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/horarios/${horario.id}`,
      payload: { horaFin: '18:00' },
      headers: { cookie: cookieAdmin },
    });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'La hora de fin tiene que ser posterior a la de inicio' });
  });
});

describe('GET /api/horarios', () => {
  it('con profesorId trae solo los horarios activos de ese profesor, ordenados por día y hora', async () => {
    const lucia = await crearProfesorDeTest({ nombre: 'Lucía', apellido: 'Paz' });
    // Las de Erik se crean fuera de orden: el orden de la respuesta no puede salir de los ids.
    const hipHopMartes = await crearHorarioDeTest(erik.id, HIP_HOP_MARTES);
    const jazzLunes = await crearHorarioDeTest(erik.id, {
      estilo: 'Jazz',
      nivel: 'Avanzado',
      diaSemana: 1,
      horaInicio: '21:00',
      horaFin: '22:30',
    });
    const contemporaneoLunes = await crearHorarioDeTest(erik.id, {
      estilo: 'Contemporáneo',
      nivel: 'Intermedio',
      diaSemana: 1,
      horaInicio: '18:00',
      horaFin: '19:30',
    });
    const breakLunes = await crearHorarioDeTest(erik.id, {
      estilo: 'Break',
      diaSemana: 1,
      horaInicio: '19:30',
      horaFin: '21:00',
    });
    await actualizarHorario(breakLunes.id, { activo: false });
    await crearHorarioDeTest(lucia.id, { estilo: 'Salsa', diaSemana: 1, horaInicio: '19:00', horaFin: '20:30' });

    const respuesta = await pedirHorarios(`profesorId=${erik.id}`);

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
          activo: true,
        },
        {
          id: jazzLunes.id,
          estilo: 'Jazz',
          nivel: 'Avanzado',
          diaSemana: 1,
          horaInicio: '21:00',
          horaFin: '22:30',
          profesor: erikResumen,
          activo: true,
        },
        {
          id: hipHopMartes.id,
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          diaSemana: 2,
          horaInicio: '19:00',
          horaFin: '20:30',
          profesor: erikResumen,
          activo: true,
        },
      ],
    });
  });

  it('con incluirInactivos=true suma los dados de baja de ese profesor y sigue sin traer los de otro', async () => {
    const lucia = await crearProfesorDeTest({ nombre: 'Lucía', apellido: 'Paz' });
    const hipHopMartes = await crearHorarioDeTest(erik.id, HIP_HOP_MARTES);
    const breakLunes = await crearHorarioDeTest(erik.id, {
      estilo: 'Break',
      nivel: null,
      diaSemana: 1,
      horaInicio: '19:30',
      horaFin: '21:00',
    });
    await actualizarHorario(breakLunes.id, { activo: false });
    await crearHorarioDeTest(lucia.id, { estilo: 'Salsa', diaSemana: 1, horaInicio: '19:00', horaFin: '20:30' });

    const respuesta = await pedirHorarios(`profesorId=${erik.id}&incluirInactivos=true`);

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
          activo: false,
        },
        {
          id: hipHopMartes.id,
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          diaSemana: 2,
          horaInicio: '19:00',
          horaFin: '20:30',
          profesor: erikResumen,
          activo: true,
        },
      ],
    });
  });

  it('sin profesorId trae los activos de todos los profesores, y con incluirInactivos=true también los dados de baja', async () => {
    const lucia = await crearProfesorDeTest({ nombre: 'Lucía', apellido: 'Paz' });
    const hipHopMartes = await crearHorarioDeTest(erik.id, HIP_HOP_MARTES);
    const breakLunes = await crearHorarioDeTest(erik.id, {
      estilo: 'Break',
      nivel: null,
      diaSemana: 1,
      horaInicio: '19:30',
      horaFin: '21:00',
    });
    await actualizarHorario(breakLunes.id, { activo: false });
    const salsaLunes = await crearHorarioDeTest(lucia.id, {
      estilo: 'Salsa',
      nivel: null,
      diaSemana: 1,
      horaInicio: '19:00',
      horaFin: '20:30',
    });

    const activas = await app.inject({ method: 'GET', url: '/api/horarios', headers: { cookie: cookieRecepcion } });
    const todas = await pedirHorarios('incluirInactivos=true');

    const salsa = {
      id: salsaLunes.id,
      estilo: 'Salsa',
      nivel: null,
      diaSemana: 1,
      horaInicio: '19:00',
      horaFin: '20:30',
      profesor: { id: lucia.id, nombre: 'Lucía', apellido: 'Paz' },
      activo: true,
    };
    const hipHop = {
      id: hipHopMartes.id,
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      diaSemana: 2,
      horaInicio: '19:00',
      horaFin: '20:30',
      profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      activo: true,
    };
    expect(activas.statusCode).toBe(200);
    expect(activas.json()).toEqual({ items: [salsa, hipHop] });
    expect(todas.statusCode).toBe(200);
    expect(todas.json()).toEqual({
      items: [
        salsa,
        {
          id: breakLunes.id,
          estilo: 'Break',
          nivel: null,
          diaSemana: 1,
          horaInicio: '19:30',
          horaFin: '21:00',
          profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
          activo: false,
        },
        hipHop,
      ],
    });
  });

  it('no valida al profesor: uno dado de baja trae sus horarios y uno que no existe, una lista vacía', async () => {
    const hipHopMartes = await crearHorarioDeTest(erik.id, HIP_HOP_MARTES);
    await actualizarProfesor(erik.id, { activo: false }, hoyEnEstudio(AHORA));

    const dadoDeBaja = await pedirHorarios(`profesorId=${erik.id}`);
    const inexistente = await pedirHorarios('profesorId=999999');

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
          activo: true,
        },
      ],
    });
    expect(inexistente.statusCode).toBe(200);
    expect(inexistente.json()).toEqual({ items: [] });
  });
});
