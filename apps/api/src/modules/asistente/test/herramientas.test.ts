import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { crearHorarioDeTest, crearProfesorDeTest } from '../../../../test/fabricas.ts';
import { levantarBaseDeTest, type BaseDeTest } from '../../../../test/db.ts';
import { clase, profesor } from '../../../db/schema.ts';
import { ReglaDeNegocioError } from '../../../lib/errores.ts';
import { generarClases } from '../../clases/programacion.service.ts';
import { actualizarProfesor } from '../../profesores/profesores.service.ts';
import { herramientasPara } from '../herramientas.ts';
import { PROPUESTA_MOSTRADA } from '../propuestas.ts';

const HOY = '2026-03-10';
const CONTEXTO = { hoy: HOY };

let base: BaseDeTest;

beforeAll(async () => {
  base = await levantarBaseDeTest();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
});

function herramienta(nombre: string) {
  const encontrada = herramientasPara('admin').find((h) => h.nombre === nombre);
  if (!encontrada) throw new Error(`No existe la herramienta ${nombre}`);
  return encontrada;
}

describe('buscar_profesores', () => {
  it('encuentra por nombre y por nombre y apellido, sin tildes, y solo devuelve id, nombre y apellido', async () => {
    const martin = await crearProfesorDeTest({
      nombre: 'Martín',
      apellido: 'Gómez',
      dni: '30111222',
      email: 'martin@estudio.test',
      telefono: '1155556666',
    });
    const baja = await crearProfesorDeTest({ nombre: 'Martín', apellido: 'Gómez' });
    await actualizarProfesor(baja.id, { activo: false }, HOY);
    const esperado = { resultado: { profesores: [{ id: martin.id, nombre: 'Martín', apellido: 'Gómez' }] } };

    expect(await herramienta('buscar_profesores').ejecutar({ texto: 'martin' }, CONTEXTO)).toEqual(esperado);
    expect(await herramienta('buscar_profesores').ejecutar({ texto: 'gomez martin' }, CONTEXTO)).toEqual(esperado);
  });
});

describe('listar_clases', () => {
  it('devuelve la clase del horario con su profesor y que se repite', async () => {
    const erik = await crearProfesorDeTest();
    await crearHorarioDeTest(erik.id, {}, HOY);
    await generarClases(base.db, HOY);

    const salida = await herramienta('listar_clases').ejecutar({ desde: '2026-03-09', hasta: '2026-03-15' }, CONTEXTO);

    expect(salida).toEqual({
      resultado: {
        finDelHorizonte: expect.any(String),
        clases: [
          {
            id: expect.any(Number),
            fecha: '2026-03-10',
            horaInicio: '19:00',
            horaFin: '20:30',
            estilo: 'Hip-Hop',
            nivel: 'Inicial',
            profesor: 'Erik Zapata',
            estado: 'programada',
            repiteCadaSemana: true,
          },
        ],
      },
    });
  });

  it('rechaza un rango de más de 31 días', async () => {
    await expect(
      herramienta('listar_clases').ejecutar({ desde: '2026-03-01', hasta: '2026-04-15' }, CONTEXTO),
    ).rejects.toThrow(ReglaDeNegocioError);
  });
});

describe('proponer_clase_unica', () => {
  const datos = { fecha: '2026-03-12', horaInicio: '18:00', horaFin: '19:00', estilo: 'Workshop', profesorId: 0 };

  it('devuelve la propuesta y no crea la clase', async () => {
    const erik = await crearProfesorDeTest();
    const salida = await herramienta('proponer_clase_unica').ejecutar({ ...datos, profesorId: erik.id }, CONTEXTO);

    expect(salida).toEqual({
      resultado: PROPUESTA_MOSTRADA,
      propuesta: {
        tipo: 'claseUnica',
        datos: { ...datos, profesorId: erik.id },
        profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      },
    });
    expect(await base.db.select().from(clase)).toEqual([]);
  });

  it('rechaza una fecha pasada', async () => {
    const erik = await crearProfesorDeTest();
    await expect(
      herramienta('proponer_clase_unica').ejecutar({ ...datos, fecha: '2026-03-09', profesorId: erik.id }, CONTEXTO),
    ).rejects.toThrow('El 2026-03-09 ya pasó: una clase nueva va de hoy en adelante');
  });

  it('rechaza un profesor dado de baja', async () => {
    const erik = await crearProfesorDeTest();
    await actualizarProfesor(erik.id, { activo: false }, HOY);
    await expect(
      herramienta('proponer_clase_unica').ejecutar({ ...datos, profesorId: erik.id }, CONTEXTO),
    ).rejects.toThrow('El profesor Erik Zapata está dado de baja');
  });

  it('rechaza una hora de fin anterior a la de inicio', async () => {
    const erik = await crearProfesorDeTest();
    await expect(
      herramienta('proponer_clase_unica').ejecutar(
        { ...datos, horaInicio: '19:00', horaFin: '18:00', profesorId: erik.id },
        CONTEXTO,
      ),
    ).rejects.toThrow(ZodError);
  });
});

describe('proponer_horario', () => {
  const datos = { diaSemana: 3, horaInicio: '18:00', horaFin: '19:00', estilo: 'Jazz', nivel: 'Medio' };

  it('descarta desde: el horario rige desde esta semana', async () => {
    const erik = await crearProfesorDeTest();
    const salida = await herramienta('proponer_horario').ejecutar(
      { ...datos, profesorId: erik.id, desde: '2026-03-09' },
      CONTEXTO,
    );

    expect(salida).toEqual({
      resultado: PROPUESTA_MOSTRADA,
      propuesta: {
        tipo: 'horario',
        datos: { ...datos, profesorId: erik.id },
        profesor: { id: erik.id, nombre: 'Erik', apellido: 'Zapata' },
      },
    });
  });

  it('rechaza un día de la semana que no existe', async () => {
    const erik = await crearProfesorDeTest();
    await expect(
      herramienta('proponer_horario').ejecutar({ ...datos, diaSemana: 8, profesorId: erik.id }, CONTEXTO),
    ).rejects.toThrow(ZodError);
  });
});

describe('proponer_alta_de_profesor', () => {
  const horarios = [
    { estilo: 'Contemporáneo', diaSemana: 2, horaInicio: '19:00', horaFin: '20:30' },
    { estilo: 'Contemporáneo', diaSemana: 4, horaInicio: '19:00', horaFin: '20:30' },
  ];
  const argumentos = { nombre: 'Lucía', apellido: 'Fernández', porcentaje: 50, horarios };

  it('pasa el porcentaje a puntos básicos, devuelve la propuesta y no crea al profesor', async () => {
    const salida = await herramienta('proponer_alta_de_profesor').ejecutar(argumentos, CONTEXTO);

    expect(salida).toEqual({
      resultado: PROPUESTA_MOSTRADA,
      propuesta: {
        tipo: 'altaDeProfesor',
        datos: { profesor: { nombre: 'Lucía', apellido: 'Fernández', porcentajeBp: 5000 }, horarios },
      },
    });
    expect(await base.db.select().from(profesor)).toEqual([]);
  });

  it.each([0, 150, 50.5])('rechaza el porcentaje %s', async (porcentaje) => {
    await expect(
      herramienta('proponer_alta_de_profesor').ejecutar({ ...argumentos, porcentaje }, CONTEXTO),
    ).rejects.toThrow(ZodError);
  });

  it('rechaza una lista de horarios vacía', async () => {
    await expect(
      herramienta('proponer_alta_de_profesor').ejecutar({ ...argumentos, horarios: [] }, CONTEXTO),
    ).rejects.toThrow(ZodError);
  });

  it('avisa con su id si ya hay un profesor con ese nombre, aunque esté dado de baja y sin tildes', async () => {
    const existente = await crearProfesorDeTest({ nombre: 'Lucia', apellido: 'Fernandez' });
    await actualizarProfesor(existente.id, { activo: false }, HOY);

    await expect(herramienta('proponer_alta_de_profesor').ejecutar(argumentos, CONTEXTO)).rejects.toThrow(
      new ReglaDeNegocioError(
        `Ya existe Lucia Fernandez (id ${existente.id}). Preguntá si es la misma persona. Si es otra, se da de alta desde Profesores; si es la misma y está dada de baja, se reactiva desde su ficha.`,
      ),
    );
  });
});

describe('herramientasPara', () => {
  it('recepción solo consulta y el administrador también propone', () => {
    expect(herramientasPara('recepcion').map((h) => h.nombre)).toEqual(['buscar_profesores', 'listar_clases']);
    expect(herramientasPara('admin').map((h) => h.nombre)).toEqual([
      'buscar_profesores',
      'listar_clases',
      'proponer_clase_unica',
      'proponer_horario',
      'proponer_alta_de_profesor',
    ]);
  });
});
