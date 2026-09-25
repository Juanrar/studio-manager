import { z } from 'zod';
import { fechaDiaSchema, nombreSchema, textoOpcional } from './comun.ts';

export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora tiene que tener el formato HH:MM');

const diaSemanaSchema = z
  .number()
  .int()
  .min(1, 'El día va de 1 (lunes) a 7 (domingo)')
  .max(7, 'El día va de 1 (lunes) a 7 (domingo)');

const idSchema = z.number().int().positive();

export const crearClaseSchema = z
  .object({
    estilo: nombreSchema,
    nivel: textoOpcional,
    diaSemana: diaSemanaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
    profesorId: idSchema,
  })
  // Las horas HH:MM se pueden comparar como texto.
  .refine((clase) => clase.horaFin > clase.horaInicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['horaFin'],
  });

export type CrearClaseInput = z.infer<typeof crearClaseSchema>;

export const actualizarClaseSchema = z.object({
  estilo: nombreSchema.optional(),
  nivel: textoOpcional,
  diaSemana: diaSemanaSchema.optional(),
  horaInicio: horaSchema.optional(),
  horaFin: horaSchema.optional(),
  profesorId: idSchema.optional(),
  activa: z.boolean().optional(),
});

export type ActualizarClaseInput = z.infer<typeof actualizarClaseSchema>;

export const abrirSesionSchema = z.object({
  claseId: idSchema,
  fecha: fechaDiaSchema,
});

export type AbrirSesionInput = z.infer<typeof abrirSesionSchema>;

export const actualizarSesionSchema = z.object({
  profesorId: idSchema.optional(),
  estado: z.enum(['programada', 'cancelada']).optional(),
});

export type ActualizarSesionInput = z.infer<typeof actualizarSesionSchema>;

export const agendaQuerySchema = z.object({
  fecha: fechaDiaSchema.optional(),
});

export type PersonaResumen = { id: number; nombre: string; apellido: string };

export type EstadoSesion = 'programada' | 'dictada' | 'cancelada';

export type Clase = {
  id: number;
  estilo: string;
  nivel: string | null;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  profesor: PersonaResumen;
  activa: boolean;
};

export type Sesion = {
  id: number;
  claseId: number;
  fecha: string;
  estado: EstadoSesion;
  profesor: PersonaResumen;
  asistentes: number;
};

export type ClaseDelDia = {
  claseId: number;
  estilo: string;
  nivel: string | null;
  horaInicio: string;
  horaFin: string;
  profesorTitular: PersonaResumen;
  sesion: Sesion | null;
};

export type AgendaDelDia = {
  fecha: string;
  items: ClaseDelDia[];
};
