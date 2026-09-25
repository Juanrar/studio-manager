import type { FastifyInstance } from 'fastify';
import type { Alumno, Pack, UsuarioPublico } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  RECEPCION,
  crearAppDeTest,
  crearUsuarioDeTest,
  loguear,
  relojFijo,
} from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearAlumnoDeTest, crearPackDeTest } from '../../../test/fabricas.ts';
import { actualizarAlumno } from '../alumnos/alumnos.service.ts';
import { actualizarPack } from '../packs/packs.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookieAdmin: string;
let cookieRecepcion: string;
let recepcion: UsuarioPublico;
let martina: Alumno;
let packX8: Pack;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

// AHORA es el martes 2026-03-10 a las 12:00 en Buenos Aires.
beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest();
  await crearUsuarioDeTest(ADMIN);
  recepcion = await crearUsuarioDeTest(RECEPCION);
  cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);
  cookieRecepcion = await loguear(app, RECEPCION.email, RECEPCION.password);
  martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
  packX8 = await crearPackDeTest({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600 });
});

afterEach(async () => {
  await app.close();
});

function registrarPago(datos: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/pagos', payload: datos, headers: { cookie: cookieRecepcion } });
}

async function pagosDeMartina(appConsulta: FastifyInstance = app, cookie: string = cookieRecepcion) {
  const respuesta = await appConsulta.inject({
    method: 'GET',
    url: `/api/pagos?alumnoId=${martina.id}`,
    headers: { cookie },
  });
  expect(respuesta.statusCode).toBe(200);
  return respuesta.json().items;
}

describe('POST /api/pagos', () => {
  it('copia precio y clases del pack, vence en un mes y guarda quién cobró', async () => {
    const respuesta = await registrarPago({ alumnoId: martina.id, packId: packX8.id, medio: 'efectivo' });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({
      id: expect.any(Number),
      alumnoId: martina.id,
      pack: { id: packX8.id, nombre: 'Pack x8' },
      cantidadClases: 8,
      clasesUsadas: 0,
      clasesRestantes: 8,
      monto: 9600,
      medio: 'efectivo',
      fecha: '2026-03-10T15:00:00.000Z',
      venceEl: '2026-04-10',
      vencido: false,
      anulado: false,
      motivoAnulacion: null,
      registradoPor: { id: recepcion.id, nombre: 'Rita Recepción' },
    });
  });

  it('un aumento de precio del pack no cambia los pagos ya hechos', async () => {
    await registrarPago({ alumnoId: martina.id, packId: packX8.id, medio: 'transferencia' });

    await app.inject({
      method: 'PATCH',
      url: `/api/packs/${packX8.id}`,
      payload: { precio: 12_000, cantidadClases: 10 },
      headers: { cookie: cookieAdmin },
    });

    const [pago] = await pagosDeMartina();
    expect(pago).toMatchObject({ monto: 9600, cantidadClases: 8 });
  });

  it('responde 422 si el pack está dado de baja', async () => {
    await actualizarPack(packX8.id, { activo: false });

    const respuesta = await registrarPago({ alumnoId: martina.id, packId: packX8.id, medio: 'efectivo' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'El pack Pack x8 ya no se vende' });
  });

  it('responde 422 si el alumno está dado de baja', async () => {
    await actualizarAlumno(martina.id, { activo: false });

    const respuesta = await registrarPago({ alumnoId: martina.id, packId: packX8.id, medio: 'efectivo' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'El alumno Martina García está dado de baja' });
  });
});

describe('vencimiento', () => {
  it.each([
    ['el día del vencimiento sigue vigente', '2026-04-10T15:00:00Z', false],
    ['al día siguiente está vencido', '2026-04-11T15:00:00Z', true],
  ])('%s', async (_caso, momento, vencido) => {
    await registrarPago({ alumnoId: martina.id, packId: packX8.id, medio: 'efectivo' });

    // La sesión dura 7 días: un mes después hay que volver a loguearse.
    const appMasTarde = await crearAppDeTest({ reloj: relojFijo(new Date(momento)) });
    const cookieMasTarde = await loguear(appMasTarde, RECEPCION.email, RECEPCION.password);
    const [pago] = await pagosDeMartina(appMasTarde, cookieMasTarde);
    await appMasTarde.close();

    expect(pago.vencido).toBe(vencido);
  });

  it('solo admin lo extiende, y nunca a una fecha anterior a la compra', async () => {
    const pago = (await registrarPago({ alumnoId: martina.id, packId: packX8.id, medio: 'efectivo' })).json();
    const extender = (cookie: string, venceEl: string) =>
      app.inject({
        method: 'PATCH',
        url: `/api/pagos/${pago.id}/vencimiento`,
        payload: { venceEl },
        headers: { cookie },
      });

    const comoRecepcion = await extender(cookieRecepcion, '2026-04-30');
    const antesDeLaCompra = await extender(cookieAdmin, '2026-03-01');
    const valido = await extender(cookieAdmin, '2026-04-30');

    expect(comoRecepcion.statusCode).toBe(403);
    expect(antesDeLaCompra.statusCode).toBe(422);
    expect(antesDeLaCompra.json()).toEqual({
      error: 'El vencimiento tiene que ser posterior a la compra (2026-03-10)',
    });
    expect(valido.json().venceEl).toBe('2026-04-30');
  });
});

describe('POST /api/pagos/:id/anular', () => {
  it('marca el pago anulado con su motivo, y anularlo de nuevo responde 422', async () => {
    const pago = (await registrarPago({ alumnoId: martina.id, packId: packX8.id, medio: 'efectivo' })).json();
    const anular = () =>
      app.inject({
        method: 'POST',
        url: `/api/pagos/${pago.id}/anular`,
        payload: { motivo: 'Se cargó dos veces' },
        headers: { cookie: cookieRecepcion },
      });

    const primera = await anular();
    const segunda = await anular();

    expect(primera.statusCode).toBe(200);
    expect(primera.json()).toMatchObject({ anulado: true, motivoAnulacion: 'Se cargó dos veces' });
    expect(segunda.statusCode).toBe(422);
    expect(segunda.json()).toEqual({ error: 'El pago ya está anulado' });
  });
});
