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

function crearPack(cookie: string, datos: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/packs', payload: datos, headers: { cookie } });
}

describe('/api/packs', () => {
  it('admin crea un pack y recepción no puede', async () => {
    const comoAdmin = await crearPack(cookieAdmin, { nombre: 'Pack x8', cantidadClases: 8, precio: 9600 });
    const comoRecepcion = await crearPack(cookieRecepcion, {
      nombre: 'Pack trucho',
      cantidadClases: 8,
      precio: 1,
    });

    expect(comoAdmin.statusCode).toBe(201);
    expect(comoAdmin.json()).toEqual({
      id: expect.any(Number),
      nombre: 'Pack x8',
      cantidadClases: 8,
      precio: 9600,
      activo: true,
    });
    expect(comoRecepcion.statusCode).toBe(403);
  });

  it('responde 400 si el precio tiene centavos', async () => {
    const respuesta = await crearPack(cookieAdmin, { nombre: 'Pack x4', cantidadClases: 4, precio: 5199.99 });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json().detalles).toEqual([
      { campo: 'precio', mensaje: 'El precio es en pesos enteros, sin centavos' },
    ]);
  });

  it('lista solo los packs activos salvo que se pida incluirInactivos', async () => {
    await crearPack(cookieAdmin, { nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 });
    const viejo = (await crearPack(cookieAdmin, { nombre: 'Pack x12', cantidadClases: 12, precio: 13000 })).json();
    await app.inject({
      method: 'PATCH',
      url: `/api/packs/${viejo.id}`,
      payload: { activo: false },
      headers: { cookie: cookieAdmin },
    });

    const activos = await app.inject({ method: 'GET', url: '/api/packs', headers: { cookie: cookieRecepcion } });
    const todos = await app.inject({
      method: 'GET',
      url: '/api/packs?incluirInactivos=true',
      headers: { cookie: cookieRecepcion },
    });

    expect(activos.json().items.map((p: { nombre: string }) => p.nombre)).toEqual(['Clase suelta']);
    expect(todos.json().items.map((p: { nombre: string }) => p.nombre)).toEqual(['Clase suelta', 'Pack x12']);
  });
});
