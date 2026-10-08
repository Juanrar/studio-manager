import { z } from 'zod';
import { fechaDiaSchema, type PersonaResumen } from './comun.ts';

// La clase de una fecha. Todavía se llama sesión: la tarea 3 de la feature 24 la renombra.

const idSchema = z.number().int().positive();

export const abrirSesionSchema = z.object({
  horarioId: idSchema,
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

export type EstadoSesion = 'programada' | 'dictada' | 'cancelada';

export type Sesion = {
  id: number;
  horarioId: number;
  fecha: string;
  estado: EstadoSesion;
  profesor: PersonaResumen;
  asistentes: number;
};

export type SesionDetalle = Sesion & {
  estilo: string;
  nivel: string | null;
  horaInicio: string;
  horaFin: string;
};

export type HorarioDelDia = {
  horarioId: number;
  estilo: string;
  nivel: string | null;
  horaInicio: string;
  horaFin: string;
  profesorTitular: PersonaResumen;
  sesion: Sesion | null;
};

export type AgendaDelDia = {
  fecha: string;
  items: HorarioDelDia[];
};
