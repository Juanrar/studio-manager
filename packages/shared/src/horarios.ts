import { z } from 'zod';
import { diaSemanaIso, esFechaDia } from './fechas.ts';
import { fechaDiaSchema, listadoQuerySchema, nombreSchema, textoOpcional, type PersonaResumen } from './comun.ts';

export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora tiene que tener el formato HH:MM');

export const diaSemanaSchema = z
  .number()
  .int()
  .min(1, 'El día va de 1 (lunes) a 7 (domingo)')
  .max(7, 'El día va de 1 (lunes) a 7 (domingo)');

const idSchema = z.number().int().positive();

const lunesSchema = fechaDiaSchema.refine((fecha) => esFechaDia(fecha) && diaSemanaIso(fecha) === 1, {
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
    desde: lunesSchema.optional(),
    claseId: idSchema.optional(),
  })
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
  desde: lunesSchema.optional(),
});

export type ActualizarHorarioInput = z.infer<typeof actualizarHorarioSchema>;

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
