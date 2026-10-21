import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../../test/db.ts';
import { crearProfesorDeTest } from '../../../../test/fabricas.ts';
import { crearModeloFalso } from '../../../../test/modelo-falso.ts';

let base: BaseDeTest;
let app: FastifyInstance | undefined;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const URL = '/api/asistente/mensajes';

async function preguntar(cookie: string, payload: object) {
  return app!.inject({ method: 'POST', url: URL, headers: { cookie }, payload });
}

describe('POST /api/asistente/mensajes', () => {
  it('busca al profesor, propone la clase única y no la crea', async () => {
    await crearUsuarioDeTest(ADMIN);
    const erik = await crearProfesorDeTest();
    const modelo = crearModeloFalso([
      { llamadas: [{ nombre: 'buscar_profesores', argumentos: { texto: 'Erik' } }] },
      {
        llamadas: [
          {
            nombre: 'proponer_clase_unica',
            argumentos: { fecha: '2026-03-11', horaInicio: '08:00', horaFin: '09:30', estilo: 'Hip-Hop', profesorId: erik.id },
          },
        ],
      },
      { texto: 'Te dejé la propuesta. Tocá Crear para confirmarla.' },
    ]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await app.inject({
      method: 'POST',
      url: URL,
      headers: { cookie },
      payload: { historial: [], mensaje: 'Creame una clase de Hip-Hop mañana de 8 a 9:30 con Erik' },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      historial: expect.any(Array),
      texto: 'Te dejé la propuesta. Tocá Crear para confirmarla.',
      propuestas: [
        {
          tipo: 'claseUnica',
          datos: { fecha: '2026-03-11', horaInicio: '08:00', horaFin: '09:30', estilo: 'Hip-Hop', profesorId: erik.id },
          profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
        },
      ],
    });
    expect(modelo.pedidos[1]?.historial.at(-1)).toEqual({
      rol: 'resultados',
      resultados: [{ nombre: 'buscar_profesores', resultado: { profesores: [{ id: erik.id, nombre: 'Erik', apellido: 'Zapata' }] } }],
    });
    const clases = await app.inject({ method: 'GET', url: '/api/clases?desde=2026-03-11', headers: { cookie } });
    expect(clases.json().items).toEqual([]);
  });

  it('le dice al modelo qué día es hoy cuando habla con un administrador', async () => {
    await crearUsuarioDeTest(ADMIN);
    const modelo = crearModeloFalso([{ texto: 'Hola' }]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: 'Hola' });

    expect(respuesta.statusCode).toBe(200);
    expect(modelo.pedidos[0]?.instrucciones).toContain('Hoy es martes 2026-03-10');
    expect(modelo.pedidos[0]?.instrucciones).not.toContain('No podés crear ni cambiar clases');
    expect(modelo.pedidos[0]?.instrucciones).toContain(
      'Si el usuario confirma con palabras, recordale que toque Crear en la tarjeta. No vuelvas a proponer lo mismo.',
    );
    expect(modelo.pedidos[0]?.instrucciones).toContain(
      'Para sumar un profesor nuevo usá proponer_alta_de_profesor. No pidas DNI, email, teléfono ni alias: se completan en la tarjeta.',
    );
  });

  it('a recepción le da solo las consultas y le avisa que no puede crear clases', async () => {
    await crearUsuarioDeTest(RECEPCION);
    const modelo = crearModeloFalso([{ texto: 'Hola' }]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, RECEPCION.email, RECEPCION.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: 'Hola' });

    expect(respuesta.statusCode).toBe(200);
    expect(modelo.pedidos[0]?.instrucciones).toContain('No podés crear ni cambiar clases');
    expect(modelo.pedidos[0]?.instrucciones).not.toContain('toque Crear en la tarjeta');
    expect(modelo.pedidos[0]?.herramientas.map((h) => h.nombre)).toEqual(['buscar_profesores', 'listar_clases']);
  });

  it('si recepción pide una herramienta de propuesta, el modelo recibe un error y no hay propuestas', async () => {
    await crearUsuarioDeTest(RECEPCION);
    const modelo = crearModeloFalso([
      {
        llamadas: [
          {
            nombre: 'proponer_clase_unica',
            argumentos: { fecha: '2026-03-11', horaInicio: '08:00', horaFin: '09:30', estilo: 'Hip-Hop', profesorId: 1 },
          },
        ],
      },
      { texto: 'No puedo crear clases.' },
    ]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, RECEPCION.email, RECEPCION.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: 'Creame una clase' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ historial: expect.any(Array), texto: 'No puedo crear clases.', propuestas: [] });
    expect(modelo.pedidos[1]?.historial.at(-1)).toEqual({
      rol: 'resultados',
      resultados: [{ nombre: 'proponer_clase_unica', resultado: { error: 'No existe la herramienta proponer_clase_unica' } }],
    });
  });

  it('un argumento inválido vuelve al modelo como error y la respuesta es 200', async () => {
    await crearUsuarioDeTest(ADMIN);
    const modelo = crearModeloFalso([
      {
        llamadas: [
          {
            nombre: 'proponer_clase_unica',
            argumentos: { fecha: '2026-03-11', horaInicio: '08:00', horaFin: '09:30', estilo: 'Hip-Hop', profesorId: 'siete' },
          },
        ],
      },
      { texto: 'Necesito el profesor.' },
    ]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: 'Creame una clase' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ historial: expect.any(Array), texto: 'Necesito el profesor.', propuestas: [] });
    expect(modelo.pedidos[1]?.historial.at(-1)).toEqual({
      rol: 'resultados',
      resultados: [{ nombre: 'proponer_clase_unica', resultado: { error: 'profesorId: Expected number, received string' } }],
    });
  });

  it('una fecha pasada vuelve al modelo como error de negocio', async () => {
    await crearUsuarioDeTest(ADMIN);
    const erik = await crearProfesorDeTest();
    const modelo = crearModeloFalso([
      {
        llamadas: [
          {
            nombre: 'proponer_clase_unica',
            argumentos: { fecha: '2026-03-09', horaInicio: '08:00', horaFin: '09:30', estilo: 'Hip-Hop', profesorId: erik.id },
          },
        ],
      },
      { texto: 'Esa fecha ya pasó.' },
    ]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: 'Creame una clase ayer' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ historial: expect.any(Array), texto: 'Esa fecha ya pasó.', propuestas: [] });
    expect(modelo.pedidos[1]?.historial.at(-1)).toEqual({
      rol: 'resultados',
      resultados: [
        { nombre: 'proponer_clase_unica', resultado: { error: 'El 2026-03-09 ya pasó: una clase nueva va de hoy en adelante' } },
      ],
    });
  });

  it('corta a las 6 vueltas si el modelo no deja de pedir herramientas', async () => {
    await crearUsuarioDeTest(ADMIN);
    const vuelta = { llamadas: [{ nombre: 'buscar_profesores', argumentos: { texto: 'Erik' } }] };
    const modelo = crearModeloFalso([vuelta, vuelta, vuelta, vuelta, vuelta, vuelta]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: 'Buscá a Erik' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'El asistente no llegó a una respuesta. Probá con un pedido más concreto.' });
    expect(modelo.pedidos).toHaveLength(6);
  });

  it('sin cookie responde 401', async () => {
    app = await crearAppDeTest({ modelo: crearModeloFalso([]) });

    const respuesta = await app.inject({ method: 'POST', url: URL, payload: { historial: [], mensaje: 'Hola' } });

    expect(respuesta.statusCode).toBe(401);
  });

  it('un mensaje en blanco responde 400', async () => {
    await crearUsuarioDeTest(ADMIN);
    app = await crearAppDeTest({ modelo: crearModeloFalso([]) });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: '  ' });

    expect(respuesta.statusCode).toBe(400);
  });

  it('un historial de más de 80 elementos responde 422 CONVERSACION_LARGA sin llamar al modelo', async () => {
    await crearUsuarioDeTest(ADMIN);
    const modelo = crearModeloFalso([{ texto: 'Hola' }]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);
    const historial = Array.from({ length: 81 }, () => ({ rol: 'usuario', texto: 'Hola' }));

    const respuesta = await preguntar(cookie, { historial, mensaje: 'Hola' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'La conversación es muy larga: empezá una nueva', codigo: 'CONVERSACION_LARGA' });
    expect(modelo.pedidos).toEqual([]);
  });

  it('un historial de 80 elementos todavía llega al modelo', async () => {
    await crearUsuarioDeTest(ADMIN);
    const modelo = crearModeloFalso([{ texto: 'Hola' }]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);
    const historial = Array.from({ length: 80 }, () => ({ rol: 'usuario', texto: 'Hola' }));

    const respuesta = await preguntar(cookie, { historial, mensaje: 'Hola' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ historial: expect.any(Array), texto: 'Hola', propuestas: [] });
    expect(modelo.pedidos).toHaveLength(1);
  });

  it('sin modelo configurado responde 503 con el código ASISTENTE_SIN_CONFIGURAR', async () => {
    await crearUsuarioDeTest(ADMIN);
    app = await crearAppDeTest();
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const respuesta = await preguntar(cookie, { historial: [], mensaje: 'Hola' });

    expect(respuesta.statusCode).toBe(503);
    expect(respuesta.json()).toEqual({
      error: 'El asistente no está configurado: falta GEMINI_API_KEY en el .env de la API',
      codigo: 'ASISTENTE_SIN_CONFIGURAR',
    });
  });

  it('un historial que vuelve en el segundo mensaje llega al modelo con el mensaje nuevo al final', async () => {
    await crearUsuarioDeTest(ADMIN);
    const modelo = crearModeloFalso([{ texto: 'Primera respuesta' }, { texto: 'Segunda respuesta' }]);
    app = await crearAppDeTest({ modelo });
    const cookie = await loguear(app, ADMIN.email, ADMIN.password);

    const primera = await preguntar(cookie, { historial: [], mensaje: 'Uno' });
    const segunda = await preguntar(cookie, { historial: primera.json().historial, mensaje: 'Dos' });

    expect(segunda.statusCode).toBe(200);
    expect(modelo.pedidos[1]?.historial).toEqual([
      { rol: 'usuario', texto: 'Uno' },
      { rol: 'modelo', texto: 'Primera respuesta', llamadas: [] },
      { rol: 'usuario', texto: 'Dos' },
    ]);
  });
});
