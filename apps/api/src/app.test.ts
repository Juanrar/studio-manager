import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

describe('GET /api/health', () => {
  it('responde 200 con estado ok', async () => {
    const app = buildApp();
    const respuesta = await app.inject({ method: 'GET', url: '/api/health' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ estado: 'ok' });

    await app.close();
  });

  it('responde 404 en una ruta que no existe', async () => {
    const app = buildApp();
    const respuesta = await app.inject({ method: 'GET', url: '/api/no-existe' });

    expect(respuesta.statusCode).toBe(404);

    await app.close();
  });
});
