import type { FastifyInstance } from 'fastify';
import type { Alumno, Asistencia, Pack, Profesor, UsuarioPublico } from '@studio/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  AHORA,
  RECEPCION,
  crearAppDeTest,
  crearUsuarioDeTest,
  loguear,
  relojFijo,
} from '../../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../../test/db.ts';
import {
  crearAlumnoDeTest,
  crearClaseDeTest,
  crearHorarioDeTest,
  crearPackDeTest,
  crearProfesorDeTest,
  type ClaseDeTest,
} from '../../../../test/fabricas.ts';
import { db } from '../../../db/client.ts';
import { liquidacion } from '../../../db/schema.ts';
import { actualizarAlumno } from '../../alumnos/alumnos.service.ts';
import { registrarAsistencia } from '../../asistencias/asistencias.service.ts';
import { registrarPago } from '../../pagos/pagos.service.ts';
import { agregarPorcentaje } from '../../profesores/profesores.service.ts';

const CINCO_DE_ABRIL = new Date('2026-04-05T15:00:00Z');

let base: BaseDeTest;
let app: FastifyInstance;
let cookieAdmin: string;
let recepcion: UsuarioPublico;
let erik: Profesor;
let iaru: Profesor;
let martina: Alumno;
let bruno: Alumno;
let lucia: Alumno;
let packX4: Pack;
let claseSuelta: Pack;
let jazzDeIaru: number;
let asistenciaDeMartinaConIaru: Asistencia;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

async function pagar(alumno: Alumno, pack: Pack, dia: string) {
  return registrarPago(
    { alumnoId: alumno.id, packId: pack.id, medio: 'efectivo' },
    recepcion.id,
    new Date(`${dia}T15:00:00Z`),
    dia,
  );
}

async function asistir(clase: ClaseDeTest, alumno: Alumno) {
  return registrarAsistencia(clase.id, { alumnoId: alumno.id }, recepcion.id, AHORA, '2026-03-10');
}

beforeEach(async () => {
  await base.limpiar();
  app = await crearAppDeTest({ reloj: relojFijo(CINCO_DE_ABRIL) });
  await crearUsuarioDeTest(ADMIN);
  recepcion = await crearUsuarioDeTest(RECEPCION);
  cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);

  erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000 });
  iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni', porcentajeBp: 6000 });
  const hipHop = await crearHorarioDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2 });
  const jazz = await crearHorarioDeTest(iaru.id, { estilo: 'Jazz', diaSemana: 4 });
  jazzDeIaru = jazz.id;
  const clase24DeFebrero = await crearClaseDeTest(hipHop.id, '2026-02-24');
  const clase3DeMarzo = await crearClaseDeTest(hipHop.id, '2026-03-03');
  const clase10DeMarzo = await crearClaseDeTest(hipHop.id, '2026-03-10');
  const clase12DeMarzo = await crearClaseDeTest(jazz.id, '2026-03-12');

  martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
  const joaquin = await crearAlumnoDeTest({ nombre: 'Joaquín', apellido: 'Pérez' });
  bruno = await crearAlumnoDeTest({ nombre: 'Bruno', apellido: 'Díaz' });
  lucia = await crearAlumnoDeTest({ nombre: 'Lucía', apellido: 'Gómez' });
  const sofia = await crearAlumnoDeTest({ nombre: 'Sofía', apellido: 'Ruiz' });
  const ana = await crearAlumnoDeTest({ nombre: 'Ana', apellido: 'Vega' });
  packX4 = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
  claseSuelta = await crearPackDeTest({ nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 });

  await pagar(bruno, claseSuelta, '2026-01-05');
  await pagar(martina, packX4, '2026-02-10');
  await pagar(joaquin, claseSuelta, '2026-03-10');
  await pagar(martina, packX4, '2026-03-12');
  const pagoAnulado = await pagar(sofia, packX4, '2026-03-15');
  await pagar(lucia, packX4, '2026-03-20');
  await app.inject({
    method: 'POST',
    url: `/api/pagos/${pagoAnulado.id}/anular`,
    payload: { motivo: 'Se cobró dos veces' },
    headers: { cookie: cookieAdmin },
  });
  await actualizarAlumno(ana.id, { activo: false }, recepcion.id, AHORA);

  await asistir(clase24DeFebrero, martina);
  await asistir(clase3DeMarzo, martina);
  await asistir(clase10DeMarzo, joaquin);
  asistenciaDeMartinaConIaru = await asistir(clase12DeMarzo, martina);
  await agregarPorcentaje(erik.id, { porcentajeBp: 8000, vigenteDesde: '2026-04-01' });
});

afterEach(async () => {
  await app.close();
});

function get(url: string, cookie = cookieAdmin) {
  return app.inject({ method: 'GET', url, headers: { cookie } });
}

describe('GET /api/tablero', () => {
  it('calcula los indicadores del mes con el porcentaje copiado, sin pagos anulados ni packs que vencen más adelante', async () => {
    const respuesta = await get('/api/tablero?periodo=2026-03');

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().actual).toEqual({
      ingresos: 11900,
      sueldos: 2180,
      leQuedaAlEstudio: 9720,
      asistencias: 3,
      alumnosActivos: 2,
      alumnosNuevos: 2,
      clasesPerdidas: 2,
      valorPerdido: 2600,
    });
  });

  it('deja negativo lo que le queda al estudio cuando los sueldos superan los ingresos', async () => {
    const clase2DeAbril = await crearClaseDeTest(jazzDeIaru, '2026-04-02');
    await asistir(clase2DeAbril, martina);
    await asistir(clase2DeAbril, lucia);

    const respuesta = await get('/api/tablero?periodo=2026-04');

    expect(respuesta.json().actual).toEqual({
      ingresos: 0,
      sueldos: 1560,
      leQuedaAlEstudio: -1560,
      asistencias: 2,
      alumnosActivos: 2,
      alumnosNuevos: 0,
      clasesPerdidas: 0,
      valorPerdido: 0,
    });
  });

  it('trae los indicadores del mes anterior y cuenta como nuevo a quien pagó por primera vez en ese mes', async () => {
    const respuesta = await get('/api/tablero?periodo=2026-03');

    expect(respuesta.json().anterior).toEqual({
      ingresos: 5200,
      sueldos: 650,
      leQuedaAlEstudio: 4550,
      asistencias: 1,
      alumnosActivos: 1,
      alumnosNuevos: 1,
      clasesPerdidas: 1,
      valorPerdido: 1500,
    });
    expect(respuesta.json().profesores).toEqual([
      {
        profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
        asistencias: 2,
        montoCalculado: 1400,
        liquidacion: null,
        asistenciasMesAnterior: 1,
      },
      {
        profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
        asistencias: 1,
        montoCalculado: 780,
        liquidacion: null,
        asistenciasMesAnterior: 0,
      },
    ]);
  });

  it('suma el monto guardado de una liquidación cerrada aunque cambie la asistencia de otro profesor abierto', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/liquidaciones',
      payload: { profesorId: erik.id, periodo: '2026-03' },
      headers: { cookie: cookieAdmin },
    });
    await db.update(liquidacion).set({ monto: 1500 }).where(eq(liquidacion.profesorId, erik.id));
    await app.inject({
      method: 'DELETE',
      url: `/api/asistencias/${asistenciaDeMartinaConIaru.id}`,
      headers: { cookie: cookieAdmin },
    });

    const respuesta = await get('/api/tablero?periodo=2026-03');

    expect(respuesta.json().actual.sueldos).toBe(1500);
    expect(respuesta.json().actual.leQuedaAlEstudio).toBe(10400);
    expect(respuesta.json().profesores).toEqual([
      {
        profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
        asistencias: 2,
        montoCalculado: 1400,
        liquidacion: { id: expect.any(Number), profesorId: erik.id, periodo: '2026-03', monto: 1500, pagadoEn: null },
        asistenciasMesAnterior: 1,
      },
      {
        profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
        asistencias: 0,
        montoCalculado: 0,
        liquidacion: null,
        asistenciasMesAnterior: 0,
      },
    ]);
  });

  it('devuelve un elemento por día del mes y ubica un pago de las 23:30 en su día del estudio', async () => {
    await registrarPago(
      { alumnoId: bruno.id, packId: claseSuelta.id, medio: 'efectivo' },
      recepcion.id,
      new Date('2026-04-01T02:30:00Z'),
      '2026-03-31',
    );

    const respuesta = await get('/api/tablero?periodo=2026-03');

    const porDia = respuesta.json().porDia;
    expect(porDia).toHaveLength(31);
    const conActividad: Record<string, { asistencias: number; cobrado: number }> = {
      '2026-03-03': { asistencias: 1, cobrado: 0 },
      '2026-03-10': { asistencias: 1, cobrado: 1500 },
      '2026-03-12': { asistencias: 1, cobrado: 5200 },
      '2026-03-20': { asistencias: 0, cobrado: 5200 },
      '2026-03-31': { asistencias: 0, cobrado: 1500 },
    };
    const esperado = Array.from({ length: 31 }, (_, i) => {
      const fecha = `2026-03-${String(i + 1).padStart(2, '0')}`;
      return { fecha, ...(conActividad[fecha] ?? { asistencias: 0, cobrado: 0 }) };
    });
    expect(porDia).toEqual(esperado);
  });

  it('cuenta los alumnos activos por estado del pack y deja afuera a los dados de baja', async () => {
    const respuesta = await get('/api/tablero?periodo=2026-03');

    expect(respuesta.json().alumnosPorEstado).toEqual({
      vigente: 1,
      por_vencer: 1,
      sin_clases: 1,
      vencido: 1,
      sin_pack: 1,
    });
  });

  it('recepción recibe 403', async () => {
    const cookieRecepcion = await loguear(app, RECEPCION.email, RECEPCION.password);

    const respuesta = await get('/api/tablero?periodo=2026-03', cookieRecepcion);

    expect(respuesta.statusCode).toBe(403);
  });
});
