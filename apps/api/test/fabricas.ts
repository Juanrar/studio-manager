// Datos de prueba creados con los services, igual que en producción.
// Cada fábrica tiene valores por defecto válidos; el test pisa solo lo que le importa.
import type {
  Alumno,
  CrearAlumnoInput,
  CrearClaseInput,
  CrearPackInput,
  CrearProfesorInput,
  Pack,
  Profesor,
} from '@studio/shared';
import { crearAlumno } from '../src/modules/alumnos/alumnos.service.ts';
import { crearClase } from '../src/modules/clases/clases.service.ts';
import { crearPack } from '../src/modules/packs/packs.service.ts';
import { crearProfesor } from '../src/modules/profesores/profesores.service.ts';

// El porcentaje inicial queda vigente desde esta fecha, antes del AHORA de los tests.
export const ALTA_PROFESORES = '2026-01-01';

export async function crearProfesorDeTest(datos: Partial<CrearProfesorInput> = {}): Promise<Profesor> {
  return crearProfesor({ nombre: 'Erik', apellido: 'Zapata', porcentajeBp: 5000, ...datos }, ALTA_PROFESORES);
}

export async function crearClaseDeTest(profesorId: number, datos: Partial<CrearClaseInput> = {}) {
  return crearClase({
    estilo: 'Hip-Hop',
    nivel: 'Inicial',
    diaSemana: 2,
    horaInicio: '19:00',
    horaFin: '20:30',
    profesorId,
    ...datos,
  });
}

export async function crearAlumnoDeTest(datos: Partial<CrearAlumnoInput> = {}): Promise<Alumno> {
  return crearAlumno({ nombre: 'Martina', apellido: 'García', ...datos });
}

export async function crearPackDeTest(datos: Partial<CrearPackInput> = {}): Promise<Pack> {
  return crearPack({ nombre: 'Pack x8', cantidadClases: 8, precio: 9600, ...datos });
}
