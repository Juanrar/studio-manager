// Datos de prueba creados con los services, igual que en producción. El horario es la excepción:
// se inserta directo, sin sus clases, y cada test crea las que necesita.
// Cada fábrica tiene valores por defecto válidos; el test pisa solo lo que le importa.
import { and, eq } from 'drizzle-orm';
import type {
  Alumno,
  CrearAlumnoInput,
  CrearHorarioInput,
  Horario,
  CrearPackInput,
  CrearProfesorInput,
  Pack,
  Profesor,
} from '@studio/shared';
import { crearAlumno } from '../src/modules/alumnos/alumnos.service.ts';
import { crearClasesQueFaltan } from '../src/modules/clases/clases.service.ts';
import * as horariosRepo from '../src/modules/horarios/horarios.repository.ts';
import { obtenerHorario } from '../src/modules/horarios/horarios.service.ts';
import { crearPack } from '../src/modules/packs/packs.service.ts';
import { crearProfesor } from '../src/modules/profesores/profesores.service.ts';
import { db } from '../src/db/client.ts';
import { clase, horario } from '../src/db/schema.ts';
import { diaSemanaIso, hoyEnEstudio, lunesDe, type FechaDia } from '../src/lib/fechas.ts';
import { AHORA } from './app.ts';

// El porcentaje inicial queda vigente desde esta fecha, antes del AHORA de los tests.
export const ALTA_PROFESORES = '2026-01-01';

export async function crearProfesorDeTest(datos: Partial<CrearProfesorInput> = {}): Promise<Profesor> {
  return crearProfesor({ nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000, ...datos }, ALTA_PROFESORES);
}

// El horario rige desde la semana de `hoy`; por defecto, la del AHORA de los tests. Inserta la fila
// sin pasar por `crearHorario`, que también crea las clases: acá el horario nace sin ninguna.
export async function crearHorarioDeTest(
  profesorId: number,
  datos: Partial<Omit<CrearHorarioInput, 'desde' | 'claseId'>> = {},
  hoy: string = hoyEnEstudio(AHORA),
): Promise<Horario> {
  const id = await horariosRepo.insertar(db, {
    estilo: 'Hip-Hop',
    nivel: 'Inicial',
    diaSemana: 2,
    horaInicio: '19:00',
    horaFin: '20:30',
    profesorId,
    ...datos,
    vigenteDesde: lunesDe(hoy),
  });
  return obtenerHorario(id);
}

export type ClaseDeTest = { id: number; fecha: FechaDia };

// La clase de un horario en la semana de `fecha`. Sirve para semanas pasadas, que el generador no crea.
// Si la clase de esa semana ya existe, devuelve esa.
export async function crearClaseDeTest(horarioId: number, fecha: FechaDia): Promise<ClaseDeTest> {
  const [fila] = await db.select().from(horario).where(eq(horario.id, horarioId));
  if (fila === undefined) throw new Error(`crearClaseDeTest: no existe el horario ${horarioId}`);
  if (diaSemanaIso(fecha) !== fila.diaSemana) {
    throw new Error(`crearClaseDeTest: el ${fecha} no cae en el día ${fila.diaSemana} del horario de ${fila.estilo}`);
  }
  const semana = lunesDe(fecha);
  await crearClasesQueFaltan(db, [fila], [semana]);
  const [creada] = await db
    .select({ id: clase.id, fecha: clase.fecha })
    .from(clase)
    .where(and(eq(clase.horarioId, horarioId), eq(clase.semana, semana)));
  return creada!;
}

// `ahora` es el momento del alta.
export async function crearAlumnoDeTest(datos: Partial<CrearAlumnoInput> = {}, ahora: Date = AHORA): Promise<Alumno> {
  return crearAlumno({ nombre: 'Martina', apellido: 'García', ...datos }, ahora);
}

export async function crearPackDeTest(datos: Partial<CrearPackInput> = {}): Promise<Pack> {
  return crearPack({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600, ...datos });
}
