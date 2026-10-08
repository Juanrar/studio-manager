import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Horario, Profesor } from '@studio/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, RECEPCION, crearAppDeTest, crearUsuarioDeTest, loguear } from '../../../test/app.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../test/db.ts';
import { crearAlumnoDeTest, crearHorarioDeTest, crearPackDeTest, crearProfesorDeTest } from '../../../test/fabricas.ts';
import { db } from '../../db/client.ts';
import { clase } from '../../db/schema.ts';
import { registrarAsistencia } from '../asistencias/asistencias.service.ts';
import { registrarPago } from '../pagos/pagos.service.ts';
import { abrirClase, actualizarClase } from './clases.service.ts';
import { generarClases } from './programacion.service.ts';

let base: BaseDeTest;
let app: FastifyInstance;
let cookie: string;
let cookieAdmin: string;
let erik: Profesor;
let hipHopMartes: Horario;

// 2026-03-10 es martes; 2026-03-11, miércoles. Es el día del reloj de los tests: el horizonte llega
// hasta el domingo 3 de mayo, el de la semana que contiene el 30 de abril.
const MARTES = '2026-03-10';
const MIERCOLES = '2026-03-11';
const FIN_DEL_HORIZONTE = '2026-05-03';

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
  await crearUsuarioDeTest(ADMIN);
  cookie = await loguear(app, RECEPCION.email, RECEPCION.password);
  cookieAdmin = await loguear(app, ADMIN.email, ADMIN.password);
  erik = await crearProfesorDeTest({ nombre: 'Erik', apellido: 'Zapata' });
  hipHopMartes = await crearHorarioDeTest(erik.id, { estilo: 'Hip-Hop', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' });
});

afterEach(async () => {
  await app.close();
});

function pedirClases(consulta: string) {
  return app.inject({ method: 'GET', url: `/api/clases${consulta}`, headers: { cookie } });
}

// La clase de un horario en una fecha, ya creada por el generador o por `abrirClase`.
async function claseDe(horarioId: number, fecha: string): Promise<number> {
  const [encontrada] = await db
    .select({ id: clase.id })
    .from(clase)
    .where(and(eq(clase.horarioId, horarioId), eq(clase.fecha, fecha)));
  return encontrada!.id;
}

const erikResumen = () => ({ id: erik.id, nombre: 'Erik', apellido: 'Zapata' });

describe('GET /api/clases', () => {
  it('trae las clases del día ordenadas por hora, con las canceladas, el titular, el profesor, los cambios propios y los asistentes', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    const ballet = await crearHorarioDeTest(erik.id, {
      estilo: 'Ballet',
      nivel: null,
      diaSemana: 2,
      horaInicio: '18:00',
      horaFin: '19:00',
    });
    const salsa = await crearHorarioDeTest(erik.id, {
      estilo: 'Salsa',
      nivel: 'Avanzado',
      diaSemana: 2,
      horaInicio: '21:00',
      horaFin: '22:00',
    });
    await crearHorarioDeTest(erik.id, { estilo: 'Jazz', diaSemana: 3 });
    await generarClases(db, MARTES);
    await actualizarClase(await claseDe(ballet.id, MARTES), { estado: 'cancelada' }, MARTES);
    await actualizarClase(await claseDe(hipHopMartes.id, MARTES), { profesorId: iaru.id }, MARTES);

    const respuesta = await pedirClases(`?desde=${MARTES}&hasta=${MARTES}`);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toEqual({
      desde: MARTES,
      hasta: MARTES,
      finDelHorizonte: FIN_DEL_HORIZONTE,
      items: [
        {
          id: expect.any(Number),
          horarioId: ballet.id,
          fecha: MARTES,
          horaInicio: '18:00',
          horaFin: '19:00',
          estilo: 'Ballet',
          nivel: null,
          estado: 'cancelada',
          profesor: erikResumen(),
          profesorTitular: erikResumen(),
          tieneCambios: true,
          asistentes: 0,
        },
        {
          id: expect.any(Number),
          horarioId: hipHopMartes.id,
          fecha: MARTES,
          horaInicio: '19:00',
          horaFin: '20:30',
          estilo: 'Hip-Hop',
          nivel: 'Inicial',
          estado: 'programada',
          profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
          profesorTitular: erikResumen(),
          tieneCambios: true,
          asistentes: 0,
        },
        {
          id: expect.any(Number),
          horarioId: salsa.id,
          fecha: MARTES,
          horaInicio: '21:00',
          horaFin: '22:00',
          estilo: 'Salsa',
          nivel: 'Avanzado',
          estado: 'programada',
          profesor: erikResumen(),
          profesorTitular: erikResumen(),
          tieneCambios: false,
          asistentes: 0,
        },
      ],
    });
  });

  it('un rango de varios días viene ordenado por fecha y después por hora', async () => {
    await crearHorarioDeTest(erik.id, { estilo: 'Jazz', diaSemana: 3, horaInicio: '10:00', horaFin: '11:00' });
    await crearHorarioDeTest(erik.id, { estilo: 'Ballet', diaSemana: 2, horaInicio: '09:00', horaFin: '10:00' });
    await generarClases(db, MARTES);

    const respuesta = await pedirClases(`?desde=${MARTES}&hasta=${MIERCOLES}`);

    const items = respuesta.json().items as { fecha: string; estilo: string }[];
    expect(items.map((c) => `${c.fecha} ${c.estilo}`)).toEqual([
      `${MARTES} Ballet`,
      `${MARTES} Hip-Hop`,
      `${MIERCOLES} Jazz`,
    ]);
  });

  it('sin fechas trae el día de hoy en el estudio', async () => {
    await generarClases(db, MARTES);

    const respuesta = await pedirClases('');

    expect(respuesta.json()).toMatchObject({ desde: MARTES, hasta: MARTES, finDelHorizonte: FIN_DEL_HORIZONTE });
    expect((respuesta.json().items as { estilo: string }[]).map((c) => c.estilo)).toEqual(['Hip-Hop']);
  });

  it('una clase de una semana anterior no marca cambios propios aunque haya tenido suplente', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    const { clase: pasada } = await abrirClase(hipHopMartes.id, '2026-03-03');
    await actualizarClase(pasada.id, { profesorId: iaru.id }, MARTES);

    const respuesta = await pedirClases('?desde=2026-03-03&hasta=2026-03-03');

    expect(respuesta.json().items).toEqual([
      expect.objectContaining({
        id: pasada.id,
        profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
        tieneCambios: false,
      }),
    ]);
  });

  it('responde 400 si desde es posterior a hasta', async () => {
    const respuesta = await pedirClases(`?desde=${MIERCOLES}&hasta=${MARTES}`);

    expect(respuesta.statusCode).toBe(400);
  });
});

describe('abrirClase', () => {
  it('la clase guarda su semana y copia la hora, el estilo y el nivel del horario', async () => {
    const { clase: abierta } = await abrirClase(hipHopMartes.id, MARTES);

    const [guardada] = await db.select().from(clase).where(eq(clase.id, abierta.id));
    expect(guardada).toEqual({
      id: abierta.id,
      horarioId: hipHopMartes.id,
      semana: '2026-03-09',
      fecha: MARTES,
      horaInicio: '19:00:00',
      horaFin: '20:30:00',
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      profesorId: erik.id,
      estado: 'programada',
    });
  });
});

describe('PATCH /api/clases/:id', () => {
  it('una suplencia cambia el profesor de la clase y no el titular del horario', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    await generarClases(db, MARTES);
    const id = await claseDe(hipHopMartes.id, MARTES);

    const respuesta = await app.inject({
      method: 'PATCH',
      url: `/api/clases/${id}`,
      payload: { profesorId: iaru.id },
      headers: { cookie },
    });
    const horarios = await app.inject({ method: 'GET', url: '/api/horarios', headers: { cookie } });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      id,
      profesor: { id: iaru.id, nombre: 'Iaru', apellido: 'Speroni' },
      profesorTitular: erikResumen(),
      tieneCambios: true,
    });
    expect(horarios.json().items[0].profesor).toEqual(erikResumen());
  });
});

describe('PATCH /api/clases/:id para mover una clase', () => {
  beforeEach(async () => {
    await generarClases(db, MARTES);
  });

  function cambiar(id: number, cambios: Record<string, unknown>, conCookie = cookieAdmin) {
    return app.inject({ method: 'PATCH', url: `/api/clases/${id}`, payload: cambios, headers: { cookie: conCookie } });
  }

  async function horaYFechaDe(id: number) {
    const [guardada] = await db.select().from(clase).where(eq(clase.id, id));
    return `${guardada!.fecha} ${guardada!.horaInicio}`;
  }

  it('mover la clase del martes 17 al viernes 21:00 cambia solo esa clase y la marca con cambios propios', async () => {
    const id = await claseDe(hipHopMartes.id, '2026-03-17');
    const siguiente = await claseDe(hipHopMartes.id, '2026-03-24');

    const respuesta = await cambiar(id, { fecha: '2026-03-20', horaInicio: '21:00', horaFin: '22:30' });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      id,
      fecha: '2026-03-20',
      horaInicio: '21:00',
      horaFin: '22:30',
      tieneCambios: true,
    });
    expect(await horaYFechaDe(siguiente)).toBe('2026-03-24 19:00:00');
    const horarios = await app.inject({ method: 'GET', url: '/api/horarios', headers: { cookie } });
    expect(horarios.json().items[0]).toMatchObject({ diaSemana: 2, horaInicio: '19:00' });
  });

  it('volverla a mano a su día y su hora la deja sin cambios propios', async () => {
    const id = await claseDe(hipHopMartes.id, '2026-03-17');
    await cambiar(id, { fecha: '2026-03-20', horaInicio: '21:00', horaFin: '22:30' });

    const respuesta = await cambiar(id, { fecha: '2026-03-17', horaInicio: '19:00', horaFin: '20:30' });

    expect(respuesta.json()).toMatchObject({ fecha: '2026-03-17', tieneCambios: false });
  });

  it('cambiar el estilo y el nivel de una semana sola no toca el horario', async () => {
    const id = await claseDe(hipHopMartes.id, '2026-03-17');

    const respuesta = await cambiar(id, { estilo: 'Hip-Hop Workshop', nivel: null });

    expect(respuesta.json()).toMatchObject({ estilo: 'Hip-Hop Workshop', nivel: null, tieneCambios: true });
  });

  it('responde 422 si la fecha nueva cae en otra semana', async () => {
    const id = await claseDe(hipHopMartes.id, '2026-03-17');

    const respuesta = await cambiar(id, { fecha: '2026-03-23' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'Una clase se mueve dentro de su semana: del 2026-03-16 al 2026-03-22' });
    expect(await horaYFechaDe(id)).toBe('2026-03-17 19:00:00');
  });

  it('responde 422 si la fecha nueva ya pasó', async () => {
    const id = await claseDe(hipHopMartes.id, MARTES);

    const respuesta = await cambiar(id, { fecha: '2026-03-09' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'No se puede mover una clase a un día que ya pasó' });
  });

  it('responde 422 si la clase ya pasó', async () => {
    const { clase: pasada } = await abrirClase(hipHopMartes.id, '2026-03-03');

    const respuesta = await cambiar(pasada.id, { horaInicio: '20:00', horaFin: '21:30' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'La clase del 2026-03-03 ya pasó: se corrige desde la clase, no se mueve' });
  });

  it('responde 422 si la hora de fin no es posterior a la de inicio', async () => {
    const id = await claseDe(hipHopMartes.id, '2026-03-17');

    const respuesta = await cambiar(id, { horaFin: '18:00' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'La hora de fin tiene que ser posterior a la de inicio' });
  });

  it('responde 422 y no cambia nada si un anotado tiene un pack que vence antes de la fecha nueva', async () => {
    const recepcion = await crearUsuarioDeTest({ ...RECEPCION, email: 'otra@estudio.test' });
    const martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
    const pack = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
    const ahora = new Date(`${MARTES}T15:00:00Z`);
    // Comprado hoy, vence el 10 de abril.
    await registrarPago({ alumnoId: martina.id, packId: pack.id, medio: 'efectivo' }, recepcion.id, ahora, MARTES);
    const id = await claseDe(hipHopMartes.id, '2026-04-07');
    await registrarAsistencia(id, { alumnoId: martina.id }, recepcion.id, ahora, MARTES);

    const respuesta = await cambiar(id, { fecha: '2026-04-11' });

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({
      error: 'La clase del 2026-04-07 tiene alumnos anotados con un pack que vence antes del 2026-04-11',
    });
    expect(await horaYFechaDe(id)).toBe('2026-04-07 19:00:00');
  });

  it('recepción puede poner un suplente o cancelar, pero no mover ni cambiar la hora o el estilo', async () => {
    const iaru = await crearProfesorDeTest({ nombre: 'Iaru', apellido: 'Speroni' });
    const id = await claseDe(hipHopMartes.id, '2026-03-17');

    const suplente = await cambiar(id, { profesorId: iaru.id }, cookie);
    const cancelar = await cambiar(id, { estado: 'cancelada' }, cookie);
    const mover = await cambiar(id, { fecha: '2026-03-20' }, cookie);
    const estilo = await cambiar(id, { estilo: 'Otro' }, cookie);

    expect([suplente.statusCode, cancelar.statusCode, mover.statusCode, estilo.statusCode]).toEqual([200, 200, 403, 403]);
    expect(await horaYFechaDe(id)).toBe('2026-03-17 19:00:00');
  });
});

describe('POST /api/clases: una clase única', () => {
  // Sábado 14 de marzo: un workshop que no sale de ningún horario.
  const WORKSHOP = { fecha: '2026-03-14', horaInicio: '18:00', horaFin: '20:00', estilo: 'Tango', nivel: 'Workshop' };

  function crearUnica(datos: Record<string, unknown>, conCookie = cookieAdmin) {
    return app.inject({ method: 'POST', url: '/api/clases', payload: datos, headers: { cookie: conCookie } });
  }

  it('crea una clase sin horario, sin titular y con cambios propios: existe solo esa semana', async () => {
    const respuesta = await crearUnica({ ...WORKSHOP, profesorId: erik.id });

    expect(respuesta.statusCode).toBe(201);
    expect(respuesta.json()).toEqual({
      id: expect.any(Number),
      horarioId: null,
      fecha: '2026-03-14',
      horaInicio: '18:00',
      horaFin: '20:00',
      estilo: 'Tango',
      nivel: 'Workshop',
      estado: 'programada',
      profesor: erikResumen(),
      profesorTitular: null,
      tieneCambios: true,
      asistentes: 0,
    });
  });

  it('el generador no la repite en otras semanas', async () => {
    await crearUnica({ ...WORKSHOP, profesorId: erik.id });

    await generarClases(db, MARTES);

    const tangos = await db.select({ fecha: clase.fecha }).from(clase).where(eq(clase.estilo, 'Tango'));
    expect(tangos).toEqual([{ fecha: '2026-03-14' }]);
  });

  it('responde 422 en un día que ya pasó, 400 si la hora de fin no es posterior y 403 para recepción', async () => {
    const pasada = await crearUnica({ ...WORKSHOP, fecha: '2026-03-09', profesorId: erik.id });
    const horas = await crearUnica({ ...WORKSHOP, horaFin: '17:00', profesorId: erik.id });
    const recepcion = await crearUnica({ ...WORKSHOP, profesorId: erik.id }, cookie);

    expect([pasada.statusCode, horas.statusCode, recepcion.statusCode]).toEqual([422, 400, 403]);
    expect(pasada.json()).toEqual({ error: 'No se puede crear una clase en un día que ya pasó' });
  });

  it('recibe asistencias con el pack y suma en el detalle de la liquidación del profesor', async () => {
    const workshop = (await crearUnica({ ...WORKSHOP, profesorId: erik.id })).json();
    const recepcion = await crearUsuarioDeTest({ ...RECEPCION, email: 'otra@estudio.test' });
    const martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
    const pack = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
    const ahora = new Date(`${MARTES}T15:00:00Z`);
    await registrarPago({ alumnoId: martina.id, packId: pack.id, medio: 'efectivo' }, recepcion.id, ahora, MARTES);
    await registrarAsistencia(workshop.id, { alumnoId: martina.id }, recepcion.id, ahora, MARTES);

    const detalle = await app.inject({
      method: 'GET',
      url: `/api/liquidaciones/detalle?profesorId=${erik.id}&periodo=2026-03`,
      headers: { cookie: cookieAdmin },
    });

    // Pack x4 de $5.200: $1.300 la clase, el 50% para Erik.
    expect(detalle.json()).toEqual({
      items: [{ claseId: workshop.id, fecha: '2026-03-14', estilo: 'Tango', asistentes: 1, monto: 650 }],
    });
  });
});

describe('DELETE /api/clases/:id', () => {
  function borrar(id: number, conCookie = cookieAdmin) {
    return app.inject({ method: 'DELETE', url: `/api/clases/${id}`, headers: { cookie: conCookie } });
  }

  async function crearWorkshop() {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/clases',
      payload: { fecha: '2026-03-14', horaInicio: '18:00', horaFin: '20:00', estilo: 'Tango', nivel: null, profesorId: erik.id },
      headers: { cookie: cookieAdmin },
    });
    return respuesta.json().id as number;
  }

  it('borra una clase única futura sin asistencias', async () => {
    const id = await crearWorkshop();

    const respuesta = await borrar(id);

    expect(respuesta.statusCode).toBe(204);
    expect(await db.select().from(clase).where(eq(clase.id, id))).toEqual([]);
  });

  it('una clase de un horario no se borra: se cancela', async () => {
    await generarClases(db, MARTES);
    const id = await claseDe(hipHopMartes.id, '2026-03-17');

    const respuesta = await borrar(id);

    expect(respuesta.statusCode).toBe(422);
    expect(respuesta.json()).toEqual({ error: 'Una clase de un horario no se borra: se cancela' });
  });

  it('una clase única con asistencias no se borra, y recepción no puede borrar', async () => {
    const id = await crearWorkshop();
    const recepcion = await crearUsuarioDeTest({ ...RECEPCION, email: 'otra@estudio.test' });
    const martina = await crearAlumnoDeTest({ nombre: 'Martina', apellido: 'García' });
    const pack = await crearPackDeTest({ nombre: 'Pack x4', cantidadClases: 4, precio: 5200 });
    const ahora = new Date(`${MARTES}T15:00:00Z`);
    await registrarPago({ alumnoId: martina.id, packId: pack.id, medio: 'efectivo' }, recepcion.id, ahora, MARTES);
    await registrarAsistencia(id, { alumnoId: martina.id }, recepcion.id, ahora, MARTES);

    const conAsistencias = await borrar(id);
    const comoRecepcion = await borrar(id, cookie);

    expect([conAsistencias.statusCode, comoRecepcion.statusCode]).toEqual([422, 403]);
    expect(conAsistencias.json()).toEqual({ error: 'La clase tiene asistencias registradas. Borralas antes de quitarla' });
  });
});

describe('GET /api/clases/:id', () => {
  it('devuelve la clase con su hora, su estilo y el titular del horario', async () => {
    await generarClases(db, MARTES);
    const id = await claseDe(hipHopMartes.id, MARTES);

    const respuesta = await app.inject({ method: 'GET', url: `/api/clases/${id}`, headers: { cookie } });

    expect(respuesta.json()).toEqual({
      id,
      horarioId: hipHopMartes.id,
      fecha: MARTES,
      horaInicio: '19:00',
      horaFin: '20:30',
      estilo: 'Hip-Hop',
      nivel: 'Inicial',
      estado: 'programada',
      profesor: erikResumen(),
      profesorTitular: erikResumen(),
      tieneCambios: false,
      asistentes: 0,
    });
  });
});
