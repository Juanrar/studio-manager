import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  RECEPCION,
  crearAppDeTest,
  crearUsuarioDeTest,
  loguear,
} from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';

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
