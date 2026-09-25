// Datos de prueba creados con los services, igual que en producción.
// Cada fábrica tiene valores por defecto válidos; el test pisa solo lo que le importa.
import type { CrearClaseInput, CrearProfesorInput, Profesor } from '@studio/shared';
import { crearClase } from '../src/modules/clases/clases.service.ts';
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
