import type { FastifyInstance } from 'fastify';
import type { Alumno, Asistencia, Pack, Profesor, Sesion, UsuarioPublico } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  AHORA,
  RECEPCION,
  crearAppDeTest,
  crearUsuarioDeTest,
  loguear,
  relojFijo,
} from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import {
  crearAlumnoDeTest,
  crearClaseDeTest,
  crearPackDeTest,
  crearProfesorDeTest,
} from '../../../test/fabricas.ts';
import { registrarAsistencia } from '../asistencias/asistencias.service.ts';
import { abrirSesion } from '../clases/sesiones.service.ts';
import { registrarPago } from '../pagos/pagos.service.ts';

// Los tests corren el 5 de abril de 2026, con marzo ya terminado.
const CINCO_DE_ABRIL = new Date('2026-04-05T15:00:00Z');

let base: BaseDeTest;
let app: FastifyInstance;
let cookieAdmin: string;
let recepcion: UsuarioPublico;
let erik: Profesor;
let iaru: Profesor;
let martina: Alumno;
let joaquin: Alumno;
let packX4: Pack;
let claseSuelta: Pack;
let sesion3DeMarzo: Sesion;
let sesion10DeMarzo: Sesion;
let asistenciaDeMartinaEl10: Asistencia;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

async function pagar(alumno: Alumno, pack: Pack, dia: string, medio: 'efectivo' | 'transferencia' = 'efectivo') {
  return registrarPago({ alumnoId: alumno.id, packId: pack.id, medio }, recepcion.id, new Date(`${dia}T15:00:00Z`), dia);
}

async function asistir(sesion: Sesion, alumno: Alumno) {
  return registrarAsistencia(sesion.id, { alumnoId: alumno.id }, recepcion.id, AHORA, '2026-03-10');
}

// Erik (50%) da Hip-Hop los martes. Martina usa un pack x4 ($1300 la clase) el 24/2, el 3/3 y el 10/3.
// Joaquín paga una clase suelta ($1500) el 10/3. Iaru (60%) no tiene clases.
// Erik en marzo: 650 + 650 + 750 = 2050.
beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest({ reloj: relojFijo(CINCO_DE_ABRIL) });
  await crearUsuarioDeTest(ADMIN);
  recepcion = await crearUsuarioDeTest(RECEPCION);
  cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);

  erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000 });
  iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni', porcentajeBp: 6000 });
  const hipHop = await crearClaseDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2 });
  const sesion24DeFebrero = (await abrirSesion(hipHop.id, '2026-02-24')).sesion;
  sesion3DeMarzo = (await abrirSesion(hipHop.id, '2026-03-03')).sesion;
  sesion10DeMarzo = (await abrirSesion(hipHop.id, '2026-03-10')).sesion;

  martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
  joaquin = await crearAlumnoDeTest({ nombre: 'Joaquín', apellido: 'Pérez' });
  packX4 = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
  claseSuelta = await crearPackDeTest({ nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 });

  await pagar(martina, packX4, '2026-02-20');
  await pagar(joaquin, claseSuelta, '2026-03-10');
  await asistir(sesion24DeFebrero, martina);
  await asistir(sesion3DeMarzo, martina);
  asistenciaDeMartinaEl10 = await asistir(sesion10DeMarzo, martina);
  await asistir(sesion10DeMarzo, joaquin);
});

afterEach(async () => {
  await app.close();
});

function get(url: string, cookie = cookieAdmin) {
  return app.inject({ method: 'GET', url, headers: { cookie } });
}

function cerrar(periodo: string, appCierre = app, cookie = cookieAdmin) {
  return appCierre.inject({
    method: 'POST',
    url: '/api/liquidaciones',
    payload: { profesorId: erik.id, periodo },
    headers: { cookie },
  });
}

describe('GET /api/liquidaciones', () => {
  it('suma por profesor solo las asistencias del mes, e incluye a los profesores sin asistencias', async () => {
    const respuesta = await get('/api/liquidaciones?periodo=2026-03');

    expect(respuesta.json()).toEqual({
      periodo: '2026-03',
      items: [
        {
          profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
          asistencias: 0,
          montoCalculado: 0,
          liquidacion: null,
        },
        {
          profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
          asistencias: 3,
          montoCalculado: 2050,
          liquidacion: null,
        },
      ],
    });
  });

  it('el detalle agrupa por sesión con su monto', async () => {
    const respuesta = await get(`/api/liquidaciones/detalle?profesorId=${erik.id}&periodo=2026-03`);

    expect(respuesta.json()).toEqual({
      items: [
        { sesionId: sesion3DeMarzo.id, fecha: '2026-03-03', estilo: 'Hip-Hop', asistentes: 1, monto: 650 },
        { sesionId: sesion10DeMarzo.id, fecha: '2026-03-10', estilo: 'Hip-Hop', asistentes: 2, monto: 1400 },
      ],
    });
  });

  it('recepción no accede a liquidaciones ni a ingresos', async () => {
    const cookieRecepcion = await loguear(app, RECEPCION.email, RECEPCION.password);

    const liquidaciones = await get('/api/liquidaciones?periodo=2026-03', cookieRecepcion);
    const ingresos = await get('/api/pagos/ingresos?periodo=2026-03', cookieRecepcion);

    expect([liquidaciones.statusCode, ingresos.statusCode]).toEqual([403, 403]);
  });
});

describe('POST /api/liquidaciones', () => {
  it('guarda el monto calculado, y cerrar de nuevo responde 422', async () => {
    const primera = await cerrar('2026-03');
    const segunda = await cerrar('2026-03');

    expect(primera.statusCode).toBe(201);
    expect(primera.json()).toEqual({
      id: expect.any(Number),
      profesorId: erik.id,
      periodo: '2026-03',
      monto: 2050,
      pagadoEn: null,
    });
    expect(segunda.statusCode).toBe(422);
    expect(segunda.json()).toEqual({ error: 'La liquidación de 2026-03 de Erik Zapata ya está cerrada' });
  });

  it('no cierra un mes que todavía no terminó', async () => {
    const appDelDiez = await crearAppDeTest({ reloj: relojFijo(AHORA) });
    const cookie = await loguear(appDelDiez, ADMIN.email, ADMIN.password);

    const respuesta = await cerrar('2026-03', appDelDiez, cookie);
    await appDelDiez.close();

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'El período 2026-03 todavía no terminó' });
  });
});
