import type {
  Alumno,
  CrearAlumnoInput,
  CrearHorarioInput,
  CrearPackInput,
  CrearProfesorInput,
  Pack,
  Profesor,
} from '@studio/shared';
import { crearAlumno } from '../src/modules/alumnos/alumnos.service.ts';
import { crearHorario } from '../src/modules/horarios/horarios.service.ts';
import { crearPack } from '../src/modules/packs/packs.service.ts';
import { crearProfesor } from '../src/modules/profesores/profesores.service.ts';
import { hoyEnEstudio } from '../src/lib/fechas.ts';
import { AHORA } from './app.ts';

export const ALTA_PROFESORES = '2026-01-01';

export async function crearProfesorDeTest(datos: Partial<CrearProfesorInput> = {}): Promise<Profesor> {
  return crearProfesor({ nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000, ...datos }, ALTA_PROFESORES);
}

export async function crearHorarioDeTest(
  profesorId: number,
  datos: Partial<CrearHorarioInput> = {},
  hoy: string = hoyEnEstudio(AHORA),
) {
  return crearHorario({
    estilo: 'Hip-Hop',
    nivel: 'Inicial',
    diaSemana: 2,
    horaInicio: '19:00',
    horaFin: '20:30',
    profesorId,
    ...datos,
  }, hoy);
}

export async function crearAlumnoDeTest(datos: Partial<CrearAlumnoInput> = {}, ahora: Date = AHORA): Promise<Alumno> {
  return crearAlumno({ nombre: 'Martina', apellido: 'García', ...datos }, ahora);
}

export async function crearPackDeTest(datos: Partial<CrearPackInput> = {}): Promise<Pack> {
  return crearPack({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600, ...datos });
}
