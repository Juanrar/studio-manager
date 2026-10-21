import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../../test/db.ts';
import { crearProfesorDeTest } from '../../../../test/fabricas.ts';
import { db } from '../../../db/client.ts';
import { horario, profesor as profesorTabla } from '../../../db/schema.ts';
import { esViolacionCheck } from '../../../lib/postgres.ts';
import { listarProfesores } from '../../profesores/profesores.service.ts';
import { darDeAltaProfesor } from '../alta-de-profesor.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest();
});

afterEach(async () => {
  await app.close();
});

const HOY = '2026-03-10';

const ALTA = {
  profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000, dni: '30123456', email: '', telefono: '', aliasCbu: '' },
  horarios: [
    { estilo: 'Contemporáneo', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' },
    { estilo: 'Contemporáneo', diaSemana: 4, horaInicio: '19:00', horaFin: '20:30' },
  ],
};

describe('POST /api/asistente/altas-de-profesor', () => {
  it('crea al profesor con su porcentaje, sus dos horarios y las clases de la semana', async () => {
    await crearUsuarioDeTest(ADMIN);
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/asistente/altas-de-profesor',
      headers: { cookie },
      payload: ALTA,
    });

    expect(respuesta.statusCode).toBe(201);
    const profesor = respuesta.json();
    expect(profesor).toEqual({
      id: expect.any(Number),
      nombre: 'Lucía',
      apellido: 'Fernández',
      dni: '30123456',
      email: null,
      telefono: null,
      aliasCbu: null,
      activo: true,
      porcentajeVigenteBp: 5000,
    });

    const persona = { id: profesor.id, nombre: 'Lucía', apellido: 'Fernández' };
    const horarios = await app.inject({ method: 'GET', url: `/api/horarios?profesorId=${profesor.id}`, headers: { cookie } });
    expect(horarios.json().items).toEqual([
      { id: expect.any(Number), estilo: 'Contemporáneo', nivel: null, diaSemana: 2, horaInicio: '19:00', horaFin: '20:30', profesor: persona, activo: true },
      { id: expect.any(Number), estilo: 'Contemporáneo', nivel: null, diaSemana: 4, horaInicio: '19:00', horaFin: '20:30', profesor: persona, activo: true },
    ]);

    const clases = await app.inject({ method: 'GET', url: '/api/clases?desde=2026-03-09&hasta=2026-03-15', headers: { cookie } });
    const idsDeHorario = horarios.json().items.map((h: { id: number }) => h.id);
    expect(clases.json().items).toEqual([
      {
        id: expect.any(Number),
        horarioId: idsDeHorario[0],
        fecha: '2026-03-10',
        horaInicio: '19:00',
        horaFin: '20:30',
        estilo: 'Contemporáneo',
        nivel: null,
        estado: 'programada',
        profesor: persona,
        profesorTitular: persona,
        tieneCambios: false,
        asistentes: 0,
      },
      {
        id: expect.any(Number),
        horarioId: idsDeHorario[1],
        fecha: '2026-03-12',
        horaInicio: '19:00',
        horaFin: '20:30',
        estilo: 'Contemporáneo',
        nivel: null,
        estado: 'programada',
        profesor: persona,
        profesorTitular: persona,
        tieneCambios: false,
        asistentes: 0,
      },
    ]);
  });

  it('recepción recibe 403', async () => {
    await crearUsuarioDeTest(RECEPCION);
    const cookie = await loguear(app, RECEPCION.email, RECEPCION.password);

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/asistente/altas-de-profesor',
      headers: { cookie },
      payload: ALTA,
    });

    expect(respuesta.statusCode).toBe(403);
    expect(await listarProfesores(true, HOY)).toEqual([]);
  });

  it('sin horarios responde 400 y no crea al profesor', async () => {
    await crearUsuarioDeTest(ADMIN);
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/asistente/altas-de-profesor',
      headers: { cookie },
      payload: { ...ALTA, horarios: [] },
    });

    expect(respuesta.statusCode).toBe(400);
    expect(await listarProfesores(true, HOY)).toEqual([]);
  });
});

describe('un segundo alta de la misma persona', () => {
  it('responde 422 con otras tildes y un espacio doble, y la tabla profesor sigue con una fila', async () => {
    await crearUsuarioDeTest(ADMIN);
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);
    const alta = (profesor: Record<string, unknown>) =>
      app.inject({
        method: 'POST',
        url: '/api/asistente/altas-de-profesor',
        headers: { cookie },
        payload: { ...ALTA, profesor: { ...ALTA.profesor, ...profesor } },
      });

    const primero = await alta({ nombre: 'María José', apellido: 'Fernández', dni: '' });
    const segundo = await alta({ nombre: 'Maria  Jose', apellido: 'FERNANDEZ', dni: '' });

    expect(primero.statusCode).toBe(201);
    expect(segundo.statusCode).toBe(422);
    expect(segundo.json()).toEqual({
      error: `Ya existe María José Fernández (id ${primero.json().id}). Si es otra persona, se da de alta desde Profesores; si es la misma y está dada de baja, se reactiva desde su ficha.`,
    });
    expect(await db.select({ id: profesorTabla.id }).from(profesorTabla)).toEqual([{ id: primero.json().id }]);
    expect(await db.select().from(horario)).toHaveLength(2);
  });
});

describe('un alta con el DNI de otro profesor', () => {
  it('responde 422 y no crea nada', async () => {
    await crearUsuarioDeTest(ADMIN);
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);
    const existente = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata', dni: '30123456' });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/asistente/altas-de-profesor',
      headers: { cookie },
      payload: ALTA,
    });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'Ya existe un profesor con ese DNI' });
    expect(await db.select({ id: profesorTabla.id }).from(profesorTabla)).toEqual([{ id: existente.id }]);
    expect(await db.select().from(horario)).toEqual([]);
  });
});

describe('darDeAltaProfesor', () => {
  it('si el segundo horario viola el check, no queda ni el profesor ni el primer horario', async () => {
    // Sin Zod: el esquema ya frena este horario, así que se llama al service directo para probar la transacción.
    const datos = {
      profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000 },
      horarios: [
        { estilo: 'Contemporáneo', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' },
        { estilo: 'Contemporáneo', diaSemana: 4, horaInicio: '21:00', horaFin: '20:00' },
      ],
    };

    const error = await darDeAltaProfesor(datos as never, HOY).catch((e: unknown) => e);

    expect(esViolacionCheck(error, 'horario_horas_validas')).toBe(true);
    expect(await listarProfesores(true, HOY)).toEqual([]);
    expect(await db.select().from(horario)).toEqual([]);
  });
});
