import { z } from 'zod';
import { listadoQuerySchema, nombreSchema, textoOpcional, type PersonaResumen } from './comun.ts';

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

export const crearHorarioSchema = z
  .object({
    estilo: nombreSchema,
    nivel: textoOpcional,
    diaSemana: diaSemanaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
    profesorId: idSchema,
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
