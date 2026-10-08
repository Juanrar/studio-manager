import { z } from 'zod';
import { fechaDiaSchema, listadoQuerySchema, nombreSchema, textoOpcional, type PersonaResumen } from './comun.ts';

// Lo que se repite cada semana: "Hip-Hop Inicial, los martes de 19:00 a 20:30".

export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora tiene que tener el formato HH:MM');

const diaSemanaSchema = z
  .number()
  .int()
  .min(1, 'El día va de 1 (lunes) a 7 (domingo)')
  .max(7, 'El día va de 1 (lunes) a 7 (domingo)');

const idSchema = z.number().int().positive();

// El lunes de una semana: desde ahí vale un cambio que se aplica a todas las semanas.
const lunesSchema = fechaDiaSchema.refine((fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay() === 1, {
  message: 'Tiene que ser el lunes de una semana',
});

export const crearHorarioSchema = z
  .object({
    estilo: nombreSchema,
    nivel: textoOpcional,
    diaSemana: diaSemanaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
    profesorId: idSchema,
    // La semana desde la que rige. Sin `desde`, la actual.
    desde: lunesSchema.optional(),
    // La clase única que pasa a ser la primera de la serie: "Agregar a todas las semanas" en la grilla.
    claseId: idSchema.optional(),
  })
  // Las horas HH:MM se pueden comparar como texto.
  .refine((horario) => horario.horaFin > horario.horaInicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['horaFin'],
  });

export type CrearHorarioInput = z.infer<typeof crearHorarioSchema>;

export const actualizarHorarioSchema = z.object({
  estilo: nombreSchema.optional(),
  nivel: textoOpcional,
  diaSemana: diaSemanaSchema.optional(),
  horaInicio: horaSchema.optional(),
  horaFin: horaSchema.optional(),
  profesorId: idSchema.optional(),
  activo: z.boolean().optional(),
  // Desde qué semana cambian las clases. Sin `desde`, desde hoy.
  desde: lunesSchema.optional(),
});

export type ActualizarHorarioInput = z.infer<typeof actualizarHorarioSchema>;

// El listado de horarios usa el filtro de inactivos del listado común y suma el de profesor.
export const horariosQuerySchema = listadoQuerySchema.extend({
  profesorId: z.coerce.number().int().positive().optional(),
});

export type Horario = {
  id: number;
  estilo: string;
  nivel: string | null;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  profesor: PersonaResumen;
  activo: boolean;
};
