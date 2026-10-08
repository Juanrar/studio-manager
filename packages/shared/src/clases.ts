import { z } from 'zod';
import { fechaDiaSchema, type PersonaResumen } from './comun.ts';

// La clase de una fecha: "Hip-Hop del martes 10". Sale de un horario y guarda quién la dio de verdad.

const idSchema = z.number().int().positive();

export const abrirClaseSchema = z.object({
  horarioId: idSchema,
  fecha: fechaDiaSchema,
});

export type AbrirClaseInput = z.infer<typeof abrirClaseSchema>;

export const actualizarClaseSchema = z.object({
  profesorId: idSchema.optional(),
  estado: z.enum(['programada', 'cancelada']).optional(),
});

export type ActualizarClaseInput = z.infer<typeof actualizarClaseSchema>;

export const agendaQuerySchema = z.object({
  fecha: fechaDiaSchema.optional(),
});

export type EstadoClase = 'programada' | 'dictada' | 'cancelada';

export type Clase = {
  id: number;
  horarioId: number;
  fecha: string;
  estado: EstadoClase;
  profesor: PersonaResumen;
  asistentes: number;
};

export type ClaseDetalle = Clase & {
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
  clase: Clase | null;
};

export type AgendaDelDia = {
  fecha: string;
  items: HorarioDelDia[];
};
