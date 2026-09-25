import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  AHORA,
  crearAppDeTest,
  crearUsuarioDeTest,
  loguear,
  relojFijo,
} from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { usuario } from '../../db/schema.ts';

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

const ADMIN_PUBLICO = {
  id: expect.any(Number),
  nombre: 'Ana Admin',
  email: 'ana@estudio.test',
  rol: 'admin',
  activo: true,
};

describe('POST /api/auth/login', () => {
  it('devuelve el usuario y una cookie que sirve para /api/auth/yo', async () => {
    await crearUsuarioDeTest(ADMIN);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'Ana@Estudio.test ', password: 'clave-de-ana-1' },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual(ADMIN_PUBLICO);
    const cookie = login.cookies.find((c) => c.name === 'sid');
    expect(cookie?.httpOnly).toBe(true);

    const yo = await app.inject({
      method: 'GET',
      url: '/api/auth/yo',
      headers: { cookie: `sid=${cookie?.value}` },
    });
    expect(yo.statusCode).toBe(200);
    expect(yo.json()).toEqual(ADMIN_PUBLICO);
  });

  it.each([
    ['el email no existe', 'nadie@estudio.test', 'clave-de-ana-1'],
    ['la contraseña es incorrecta', 'ana@estudio.test', 'clave-equivocada'],
  ])('responde 401 con el mismo mensaje cuando %s', async (_caso, email, password) => {
    await crearUsuarioDeTest(ADMIN);

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });

    expect(respuesta.statusCode).toBe(401);
    expect(respuesta.json()).toEqual({ error: 'Email o contraseña incorrectos' });
    expect(respuesta.cookies).toEqual([]);
  });

  it('rechaza a un usuario desactivado aunque la contraseña sea correcta', async () => {
    const creado = await crearUsuarioDeTest(ADMIN);
    await base.db.update(usuario).set({ activo: false }).where(eq(usuario.id, creado.id));

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN.email, password: ADMIN.password },
    });

    expect(respuesta.statusCode).toBe(401);
  });
});

describe('sesión', () => {
  it('después del logout la misma cookie ya no sirve', async () => {
    await crearUsuarioDeTest(ADMIN);
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(204);

    const yo = await app.inject({ method: 'GET', url: '/api/auth/yo', headers: { cookie } });
    expect(yo.statusCode).toBe(401);
  });

  it('vence a los 7 días del login', async () => {
    await crearUsuarioDeTest(ADMIN);
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const sieteDiasYUnMinutoDespues = new Date(AHORA.getTime() + (7 * 24 * 60 + 1) * 60 * 1000);
    const appMasTarde = await crearAppDeTest({ reloj: relojFijo(sieteDiasYUnMinutoDespues) });
    const yo = await appMasTarde.inject({ method: 'GET', url: '/api/auth/yo', headers: { cookie } });
    await appMasTarde.close();

    expect(yo.statusCode).toBe(401);
  });
});
