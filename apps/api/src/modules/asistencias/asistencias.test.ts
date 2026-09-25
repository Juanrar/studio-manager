import type { FastifyInstance } from 'fastify';
import type { Alumno, Clase, Pack, Profesor, Sesion, UsuarioPublico } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AHORA, RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import {
  crearAlumnoDeTest,
  crearClaseDeTest,
  crearPackDeTest,
  crearProfesorDeTest,
} from '../../../test/fabricas.ts';
import { abrirSesion, actualizarSesion } from '../clases/sesiones.service.ts';
import { anularPago, obtenerPago, registrarPago } from '../pagos/pagos.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookie: string;
let recepcion: UsuarioPublico;
let erik: Profesor;
let hipHop: Clase;
let sesion: Sesion;
let martina: Alumno;
let packX4: Pack;
let claseSuelta: Pack;

// Martes 2026-03-10: la sesión de Hip-Hop de las 19:00 con Erik (50%).
const MARTES = '2026-03-10';

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
  erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000 });
  hipHop = await crearClaseDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' });
  sesion = (await abrirSesion(hipHop.id, MARTES)).sesion;
  martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
  packX4 = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
  claseSuelta = await crearPackDeTest({ nombre: 'Clase suelta', cantidadClases: 1, precio: 1500 });
});

afterEach(async () => {
  await app.close();
});

// Registra un pago como si se hubiera cobrado el día `dia` (a las 12:00 de Buenos Aires).
async function pagar(pack: Pack, dia = MARTES) {
  return registrarPago(
    { alumnoId: martina.id, packId: pack.id, medio: 'efectivo' },
    recepcion.id,
    new Date(`${dia}T15:00:00Z`),
    dia,
  );
}

function registrar(sesionId: number, cuerpo: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `/api/sesiones/${sesionId}/asistencias`,
    payload: cuerpo,
    headers: { cookie },
  });
}

async function restantes(pagoId: number) {
  return (await obtenerPago(pagoId, MARTES)).clasesRestantes;
}

async function otraSesionDelMartes() {
  const ballet = await crearClaseDeTest(erik.id, { estilo: 'Ballet', diaSemana: 2, horaInicio: '18:00', horaFin: '19:00' });
  return (await abrirSesion(ballet.id, MARTES)).sesion;
}

describe('POST /api/sesiones/:id/asistencias', () => {
  it('con un pack vigente fija valor y porcentaje, y descuenta una clase', async () => {
    const pago = await pagar(packX4);

    const respuesta = await registrar(sesion.id, { alumnoId: martina.id });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({
      id: expect.any(Number),
      sesionId: sesion.id,
      alumno: { id: martina.id, nombre: 'Martina', apellido: 'García' },
      pagoId: pago.id,
      pack: 'Pack x4',
      valorClase: 1300,
      porcentajeBp: 5000,
    });
    expect(await restantes(pago.id)).toBe(3);
  });

  it('con dos pagos válidos usa el que vence primero', async () => {
    const venceEl20DeMarzo = await pagar(packX4, '2026-02-20');
    await pagar(packX4, MARTES);

    const respuesta = await registrar(sesion.id, { alumnoId: martina.id });

    expect(respuesta.json().pagoId).toBe(venceEl20DeMarzo.id);
  });

  it('no usa pagos vencidos, anulados ni sin clases restantes', async () => {
    await pagar(packX4, '2026-02-01'); // venció el 2026-03-01
    await pagar(claseSuelta);
    await registrar((await otraSesionDelMartes()).id, { alumnoId: martina.id }); // usa la clase suelta
    const anulado = await pagar(packX4);
    await anularPago(anulado.id, 'Error de carga', AHORA, MARTES);

    const respuesta = await registrar(sesion.id, { alumnoId: martina.id });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({
      error: 'Martina García no tiene clases disponibles para el 2026-03-10',
      codigo: 'SIN_CLASES_DISPONIBLES',
    });
  });

  it('sin pago válido y con cobrar, registra una clase suelta en el acto y la usa', async () => {
    const respuesta = await registrar(sesion.id, {
      alumnoId: martina.id,
      cobrar: { packId: claseSuelta.id, medio: 'transferencia' },
    });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toMatchObject({ pack: 'Clase suelta', valorClase: 1500 });
    expect(await restantes(respuesta.json().pagoId)).toBe(0);
  });

  it('responde 422 si el alumno ya tiene asistencia en esa sesión', async () => {
    await pagar(packX4);
    await registrar(sesion.id, { alumnoId: martina.id });

    const repetida = await registrar(sesion.id, { alumnoId: martina.id });

    expect(repetida.statusCode).toBe(422);
    expect(repetida.json()).toEqual({ error: 'Martina García ya tiene la asistencia registrada en esta clase' });
  });

  it('responde 422 si la sesión está cancelada', async () => {
    await pagar(packX4);
    await actualizarSesion(sesion.id, { estado: 'cancelada' });

    const respuesta = await registrar(sesion.id, { alumnoId: martina.id });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'La clase está cancelada' });
  });

  it('registros simultáneos no pueden usar la misma última clase', async () => {
    await pagar(claseSuelta);
    // Seis clases del martes, una por hora, y un intento de asistencia en cada una a la vez.
    const sesiones = [sesion];
    for (const hora of ['10', '11', '12', '13', '14']) {
      const clase = await crearClaseDeTest(erik.id, { estilo: `Clase ${hora}`, horaInicio: `${hora}:00`, horaFin: `${hora}:50` });
      sesiones.push((await abrirSesion(clase.id, MARTES)).sesion);
    }

    const respuestas = await Promise.all(sesiones.map((s) => registrar(s.id, { alumnoId: martina.id })));

    expect(respuestas.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(respuestas.filter((r) => r.statusCode === 422)).toHaveLength(5);
  });
});

describe('DELETE /api/asistencias/:id', () => {
  it('devuelve la clase al pack', async () => {
    const pago = await pagar(packX4);
    const asistencia = (await registrar(sesion.id, { alumnoId: martina.id })).json();

    const respuesta = await app.inject({
      method: 'DELETE',
      url: `/api/asistencias/${asistencia.id}`,
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(204);
    expect(await restantes(pago.id)).toBe(4);
  });
});

describe('reglas que dependen de las asistencias', () => {
  it('no se cancela una sesión con asistencias', async () => {
    await pagar(packX4);
    await registrar(sesion.id, { alumnoId: martina.id });

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/sesiones/${sesion.id}`,
      payload: { estado: 'cancelada' },
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({
      error: 'La clase tiene asistencias registradas. Borralas antes de cancelarla',
    });
  });

  it('una suplencia recalcula el porcentaje de las asistencias ya tomadas', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni', porcentajeBp: 6000 });
    await pagar(packX4);
    await registrar(sesion.id, { alumnoId: martina.id });

    await app.inject({
      method: 'PATCH',
      url: `/api/sesiones/${sesion.id}`,
      payload: { profesorId: iaru.id },
      headers: { cookie },
    });
    const asistencias = await app.inject({
      method: 'GET',
      url: `/api/sesiones/${sesion.id}/asistencias`,
      headers: { cookie },
    });

    expect(asistencias.json().items.map((a: { porcentajeBp: number }) => a.porcentajeBp)).toEqual([6000]);
  });

  it('no se anula un pago con asistencias', async () => {
    const pago = await pagar(packX4);
    await registrar(sesion.id, { alumnoId: martina.id });

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/pagos/${pago.id}/anular`,
      payload: { motivo: 'Error de carga' },
      headers: { cookie },
    });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({
      error: 'El pago tiene asistencias registradas. Borralas antes de anularlo',
    });
  });
});
