import type { FastifyInstance } from 'fastify';
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
import { actualizarClase } from '../clases/clases.service.ts';
import { actualizarProfesor } from './profesores.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookieAdmin: string;
let cookieRecepcion: string;

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
});

afterEach(async () => {
  await app.close();
});

const MALENA = { nombre: 'Malena', apellido: 'Rosas', aliasCbu: 'malena.rosas.mp', porcentajeBp: 5250 };

function crearProfesor(cookie: string, datos: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/profesores', payload: datos, headers: { cookie } });
}

function pedirProfesores(consulta = '') {
  return app.inject({ method: 'GET', url: `/api/profesores${consulta}`, headers: { cookie: cookieRecepcion } });
}

describe('/api/profesores', () => {
  it('admin crea un profesor con 52,5% y el listado lo muestra vigente', async () => {
    const creado = await crearProfesor(cookieAdmin, MALENA);
    const listado = await app.inject({ method: 'GET', url: '/api/profesores', headers: { cookie: cookieAdmin } });

    expect(creado.statusCode).toBe(201);
    expect(listado.json()).toEqual({
      items: [
        {
          id: expect.any(Number),
          nombre: 'Malena',
          apellido: 'Rosas',
          dni: null,
          email: null,
          telefono: null,
          aliasCbu: 'malena.rosas.mp',
          activo: true,
          porcentajeVigenteBp: 5250,
          clasesPorSemana: 0,
          diasConClase: [],
        },
      ],
    });
  });

  it('recepción puede listar profesores pero no crearlos', async () => {
    const listado = await app.inject({ method: 'GET', url: '/api/profesores', headers: { cookie: cookieRecepcion } });
    const alta = await crearProfesor(cookieRecepcion, MALENA);

    expect(listado.statusCode).toBe(200);
    expect(alta.statusCode).toBe(403);
  });

  it('responde 400 con un porcentaje de más de 10000 puntos básicos', async () => {
    const respuesta = await crearProfesor(cookieAdmin, { ...MALENA, porcentajeBp: 10_001 });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json().detalles.map((d: { campo: string }) => d.campo)).toEqual(['porcentajeBp']);
  });

  it('responde 422 si ya hay un porcentaje con la misma fecha', async () => {
    const profesor = (await crearProfesor(cookieAdmin, MALENA)).json();
    const cargar = () =>
      app.inject({
        method: 'POST',
        url: `/api/profesores/${profesor.id}/porcentajes`,
        payload: { porcentajeBp: 6000, vigenteDesde: '2026-04-01' },
        headers: { cookie: cookieAdmin },
      });

    const primero = await cargar();
    const repetido = await cargar();

    expect(primero.statusCode).toBe(201);
    expect(repetido.statusCode).toBe(422);
    expect(repetido.json()).toEqual({ error: 'El profesor ya tiene un porcentaje desde el 2026-04-01' });
  });
});

describe('GET /api/profesores con las clases de la semana', () => {
  it('trae clasesPorSemana y diasConClase sin repetir y ordenados, y en 0 y [] para quien no tiene clases', async () => {
    const erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata' });
    const lucia = await crearProfesorDeTest({ nombre: 'Lucía', apellido: 'Paz' });
    // Las de Erik se crean fuera de orden: el listado no puede depender del orden de los ids.
    await crearClaseDeTest(erik.id, {
      estilo: 'Contemporáneo',
      diaSemana: 3,
      horaInicio: '20:00',
      horaFin: '21:30',
    });
    await crearClaseDeTest(erik.id, { estilo: 'Jazz', diaSemana: 1, horaInicio: '21:00', horaFin: '22:30' });
    await crearClaseDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 1, horaInicio: '18:00', horaFin: '19:30' });
    // Un viernes dado de baja: no suma una clase ni agrega el día.
    const breakViernes = await crearClaseDeTest(erik.id, {
      estilo: 'Break',
      diaSemana: 5,
      horaInicio: '19:00',
      horaFin: '20:30',
    });
    await actualizarClase(breakViernes.id, { activa: false });

    const respuesta = await pedirProfesores();

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      items: [
        {
          id: lucia.id,
          nombre: 'Lucía',
          apellido: 'Paz',
          dni: null,
          email: null,
          telefono: null,
          aliasCbu: null,
          activo: true,
          porcentajeVigenteBp: 5000,
          clasesPorSemana: 0,
          diasConClase: [],
        },
        {
          id: erik.id,
          nombre: 'Erik',
          apellido: 'Zapata',
          dni: null,
          email: null,
          telefono: null,
          aliasCbu: null,
          activo: true,
          porcentajeVigenteBp: 5000,
          clasesPorSemana: 3,
          diasConClase: [1, 3],
        },
      ],
    });
  });

  it('no cuenta las clases dadas de baja aunque el listado pida incluirInactivos=true', async () => {
    const erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata' });
    const lucia = await crearProfesorDeTest({ nombre: 'Lucía', apellido: 'Paz' });
    await crearClaseDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' });
    const breakLunes = await crearClaseDeTest(erik.id, {
      estilo: 'Break',
      diaSemana: 1,
      horaInicio: '19:30',
      horaFin: '21:00',
    });
    await actualizarClase(breakLunes.id, { activa: false });
    // Lucía se fue y sus clases se dieron de baja: el listado la muestra, pero sin carga semanal.
    const salsaViernes = await crearClaseDeTest(lucia.id, {
      estilo: 'Salsa',
      diaSemana: 5,
      horaInicio: '19:00',
      horaFin: '20:30',
    });
    await actualizarClase(salsaViernes.id, { activa: false });
    await actualizarProfesor(lucia.id, { activo: false }, hoyEnEstudio(AHORA));

    const respuesta = await pedirProfesores('?incluirInactivos=true');

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      items: [
        {
          id: lucia.id,
          nombre: 'Lucía',
          apellido: 'Paz',
          dni: null,
          email: null,
          telefono: null,
          aliasCbu: null,
          activo: false,
          porcentajeVigenteBp: 5000,
          clasesPorSemana: 0,
          diasConClase: [],
        },
        {
          id: erik.id,
          nombre: 'Erik',
          apellido: 'Zapata',
          dni: null,
          email: null,
          telefono: null,
          aliasCbu: null,
          activo: true,
          porcentajeVigenteBp: 5000,
          clasesPorSemana: 1,
          diasConClase: [2],
        },
      ],
    });
  });
});
