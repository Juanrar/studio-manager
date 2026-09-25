import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest();
  await crearUsuarioDeTest(RECEPCION);
  cookie = await loguear(app, RECEPCION.email, RECEPCION.password);
});

afterEach(async () => {
  await app.close();
});

async function crear(datos: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/alumnos', payload: datos, headers: { cookie } });
}

async function listar(query: string) {
  const respuesta = await app.inject({ method: 'GET', url: `/api/alumnos?${query}`, headers: { cookie } });
  expect(respuesta.statusCode).toBe(200);
  return respuesta.json();
}

describe('/api/alumnos', () => {
  it('responde 401 sin sesión', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/alumnos' });

    expect(respuesta.statusCode).toBe(401);
  });

  it('crea un alumno solo con nombre y apellido, y guarda el resto en null', async () => {
    const respuesta = await crear({ nombre: 'Lucía', apellido: 'Ferreyra', email: '', dni: '' });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({
      id: expect.any(Number),
      nombre: 'Lucía',
      apellido: 'Ferreyra',
      dni: null,
      email: null,
      telefono: null,
      fechaNacimiento: null,
      contactoEmergencia: null,
      notas: null,
      activo: true,
    });
  });

  it('responde 422 si el DNI ya es de otro alumno', async () => {
    await crear({ nombre: 'Lucía', apellido: 'Ferreyra', dni: '40111222' });

    const respuesta = await crear({ nombre: 'Otra', apellido: 'Persona', dni: '40111222' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'Ya existe un alumno con ese DNI' });
  });
});

describe('GET /api/alumnos', () => {
  it('busca por apellido sin importar tildes ni mayúsculas, y por DNI', async () => {
    await crear({ nombre: 'Martina', apellido: 'García', dni: '38555666' });
    await crear({ nombre: 'Joaquín', apellido: 'Pérez', dni: '41222333' });

    const porApellido = await listar('q=GARCIA');
    const porDni = await listar('q=41222');

    expect(porApellido.items.map((a: { apellido: string }) => a.apellido)).toEqual(['García']);
    expect(porDni.items.map((a: { apellido: string }) => a.apellido)).toEqual(['Pérez']);
  });

  it('no lista a los dados de baja salvo que se pida con incluirInactivos', async () => {
    await crear({ nombre: 'Activa', apellido: 'Alvarez' });
    const baja = (await crear({ nombre: 'Baja', apellido: 'Benitez' })).json();
    await app.inject({
      method: 'PATCH',
      url: `/api/alumnos/${baja.id}`,
      payload: { activo: false },
      headers: { cookie },
    });

    const soloActivos = await listar('');
    const todos = await listar('incluirInactivos=true');

    expect(soloActivos.items.map((a: { apellido: string }) => a.apellido)).toEqual(['Alvarez']);
    expect(todos.items.map((a: { apellido: string }) => a.apellido)).toEqual(['Alvarez', 'Benitez']);
  });

  it('total cuenta todos los resultados aunque la página traiga menos', async () => {
    for (const apellido of ['Acosta', 'Bravo', 'Castro']) {
      await crear({ nombre: 'Alumno', apellido });
    }

    const segundaPagina = await listar('porPagina=2&pagina=2');

    expect(segundaPagina).toEqual({
      items: [expect.objectContaining({ apellido: 'Castro' })],
      total: 3,
      pagina: 2,
      porPagina: 2,
    });
  });
});

describe('PATCH /api/alumnos/:id', () => {
  it('cambia solo los campos enviados', async () => {
    const creado = (
      await crear({
        nombre: 'Lucía',
        apellido: 'Ferreyra',
        email: 'lucia@correo.test',
        telefono: '11 5555-0000',
      })
    ).json();

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/alumnos/${creado.id}`,
      payload: { telefono: '11 5555-9999' },
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({ ...creado, telefono: '11 5555-9999' });
  });
});
