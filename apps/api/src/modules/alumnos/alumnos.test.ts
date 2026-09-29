import type { FastifyInstance } from 'fastify';
import type { Alumno, Pack, UsuarioPublico } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AHORA, RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import {
  crearAlumnoDeTest,
  crearClaseDeTest,
  crearPackDeTest,
  crearProfesorDeTest,
} from '../../../test/fabricas.ts';
import { registrarAsistencia } from '../asistencias/asistencias.service.ts';
import { abrirSesion } from '../clases/sesiones.service.ts';
import { anularPago, registrarPago } from '../pagos/pagos.service.ts';
import { actualizarAlumno } from './alumnos.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookie: string;
let recepcion: UsuarioPublico;

// AHORA es el martes 2026-03-10.
const HOY = '2026-03-10';

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest();
  recepcion = await crearUsuarioDeTest(RECEPCION);
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
      vigentes: 0,
      hoy: HOY,
    });
  });

  // Registra un pago como si se hubiera cobrado el día `dia` (a las 12:00 de Buenos Aires).
  async function pagar(alumno: Alumno, pack: Pack, dia: string) {
    return registrarPago(
      { alumnoId: alumno.id, packId: pack.id, medio: 'efectivo' },
      recepcion.id,
      new Date(`${dia}T15:00:00Z`),
      dia,
    );
  }

  it('trae el estado del pack, el pago en uso y la última clase, sin pagos anulados ni clases futuras, y cuenta vigentes entre los activos', async () => {
    const packX8 = await crearPackDeTest({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600 });
    const packX4 = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
    const hipHop = await crearClaseDeTest((await crearProfesorDeTest()).id, { diaSemana: 2 });
    const martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García', dni: '38555666' });
    const lucia = await crearAlumnoDeTest({ nombre: 'Lucía', apellido: 'Fernández' });
    const joaquin = await crearAlumnoDeTest({ nombre: 'Joaquín', apellido: 'Pérez' });
    const paula = await crearAlumnoDeTest({ nombre: 'Paula', apellido: 'Morales' });

    // Martina: un pack x4 anulado que vencía antes que el x8, y en el x8 una clase dada y otra anotada para el martes que viene.
    const anulado = await pagar(martina, packX4, '2026-02-25');
    await anularPago(anulado.id, 'Se cargó dos veces', AHORA, HOY);
    await pagar(martina, packX8, '2026-03-01');
    for (const martes of ['2026-03-03', '2026-03-17']) {
      const { sesion } = await abrirSesion(hipHop.id, martes);
      await registrarAsistencia(sesion.id, { alumnoId: martina.id }, recepcion.id, AHORA, HOY);
    }
    // Lucía: el pack venció el 10 de febrero sin que lo usara.
    await pagar(lucia, packX4, '2026-01-10');
    // Paula: tiene el pack vigente, pero está dada de baja.
    await pagar(paula, packX8, '2026-03-05');
    await actualizarAlumno(paula.id, { activo: false });

    const listado = await listar('incluirInactivos=true');

    expect(listado).toEqual({
      items: [
        {
          ...lucia,
          estadoPack: 'vencido',
          pagoActual: { pack: 'Pack x4', cantidadClases: 4, clasesRestantes: 4, venceEl: '2026-02-10' },
          ultimaClase: null,
        },
        {
          ...martina,
          estadoPack: 'vigente',
          pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 6, venceEl: '2026-04-01' },
          ultimaClase: '2026-03-03',
        },
        {
          ...paula,
          activo: false,
          estadoPack: 'vigente',
          pagoActual: { pack: 'Pack x8', cantidadClases: 8, clasesRestantes: 8, venceEl: '2026-04-05' },
          ultimaClase: null,
        },
        { ...joaquin, estadoPack: 'sin_pack', pagoActual: null, ultimaClase: null },
      ],
      total: 4,
      pagina: 1,
      porPagina: 20,
      vigentes: 1,
      hoy: HOY,
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
