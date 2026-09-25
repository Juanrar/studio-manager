import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';

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

const NUEVO_RECEPCIONISTA = {
  nombre: 'Tomás Turno Tarde',
  email: 'tomas@estudio.test',
  password: 'clave-de-tomas-1',
  rol: 'recepcion',
};

describe('permisos de /api/usuarios', () => {
  it('responde 401 sin sesión y 403 a recepción', async () => {
    await crearUsuarioDeTest(RECEPCION);
    const cookieRecepcion = await loguear(app, RECEPCION.email, RECEPCION.password);

    const sinSesion = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      payload: NUEVO_RECEPCIONISTA,
    });
    const comoRecepcion = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      payload: NUEVO_RECEPCIONISTA,
      headers: { cookie: cookieRecepcion },
    });

    expect(sinSesion.statusCode).toBe(401);
    expect(comoRecepcion.statusCode).toBe(403);
  });
});

describe('POST /api/usuarios', () => {
  it('crea un usuario que después puede iniciar sesión', async () => {
    await crearUsuarioDeTest(ADMIN);
    const cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      payload: NUEVO_RECEPCIONISTA,
      headers: { cookie: cookieAdmin },
    });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({
      id: expect.any(Number),
      nombre: 'Tomás Turno Tarde',
      email: 'tomas@estudio.test',
      rol: 'recepcion',
      activo: true,
    });
    await expect(loguear(app, 'tomas@estudio.test', 'clave-de-tomas-1')).resolves.toMatch(/^sid=/);
  });
});

describe('PATCH /api/usuarios/:id', () => {
  // La búsqueda de sesión ya ignora usuarios inactivos, así que para ver que las
  // sesiones se borraron hay que reactivar al usuario y probar la cookie vieja.
  it('desactivar a un usuario cierra sus sesiones abiertas', async () => {
    await crearUsuarioDeTest(ADMIN);
    const recepcion = await crearUsuarioDeTest(RECEPCION);
    const cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);
    const cookieRecepcion = await loguear(app, RECEPCION.email, RECEPCION.password);

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/usuarios/${recepcion.id}`,
      payload: { activo: false },
      headers: { cookie: cookieAdmin },
    });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({ id: recepcion.id, activo: false });

    await app.inject({
      method: 'PATCH',
      url: `/api/usuarios/${recepcion.id}`,
      payload: { activo: true },
      headers: { cookie: cookieAdmin },
    });

    const yo = await app.inject({
      method: 'GET',
      url: '/api/auth/yo',
      headers: { cookie: cookieRecepcion },
    });
    expect(yo.statusCode).toBe(401);
  });

  it('cambiar la contraseña cierra las sesiones abiertas', async () => {
    await crearUsuarioDeTest(ADMIN);
    const recepcion = await crearUsuarioDeTest(RECEPCION);
    const cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);
    const cookieRecepcion = await loguear(app, RECEPCION.email, RECEPCION.password);

    await app.inject({
      method: 'PATCH',
      url: `/api/usuarios/${recepcion.id}`,
      payload: { password: 'clave-nueva-de-rita' },
      headers: { cookie: cookieAdmin },
    });

    const yo = await app.inject({
      method: 'GET',
      url: '/api/auth/yo',
      headers: { cookie: cookieRecepcion },
    });
    expect(yo.statusCode).toBe(401);
    await expect(loguear(app, RECEPCION.email, 'clave-nueva-de-rita')).resolves.toMatch(/^sid=/);
  });
});
