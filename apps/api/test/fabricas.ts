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

export const ALTA_PROFESORES = '2026-01-01';

export async function crearProfesorDeTest(datos: Partial<CrearProfesorInput> = {}): Promise<Profesor> {
  return crearProfesor({ nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000, ...datos }, ALTA_PROFESORES);
}

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

export async function crearAlumnoDeTest(datos: Partial<CrearAlumnoInput> = {}, ahora: Date = AHORA): Promise<Alumno> {
  return crearAlumno({ nombre: 'Martina', apellido: 'García', ...datos }, ahora);
}

export async function crearPackDeTest(datos: Partial<CrearPackInput> = {}): Promise<Pack> {
  return crearPack({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600, ...datos });
}
