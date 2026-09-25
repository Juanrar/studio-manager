import { z } from 'zod';
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
    expect(respuesta.json()).toEqual({ error: 'Ruta no encontrada' });

    await app.close();
  });
});

describe('manejo de errores', () => {
  it('un error inesperado responde 500 sin exponer el mensaje', async () => {
    const app = buildApp();
    app.get('/api/explota', async () => {
      throw new Error('password de la base: hunter2');
    });

    const respuesta = await app.inject({ method: 'GET', url: '/api/explota' });

    expect(respuesta.statusCode).toBe(500);
    expect(respuesta.json()).toEqual({ error: 'Error interno del servidor' });

    await app.close();
  });

  it('datos inválidos responden 400 con los campos que fallaron', async () => {
    const app = buildApp();
    const esquema = z.object({ nombre: z.string().min(1), edad: z.number().int() });
    app.post('/api/eco', async (request) => esquema.parse(request.body));

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/eco',
      payload: { nombre: '', edad: 'veinte' },
    });

    expect(respuesta.statusCode).toBe(400);
    expect(respuesta.json()).toEqual({
      error: 'Datos inválidos',
      detalles: [
        { campo: 'nombre', mensaje: expect.any(String) },
        { campo: 'edad', mensaje: expect.any(String) },
      ],
    });

    await app.close();
  });
});
