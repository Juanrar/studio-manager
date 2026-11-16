import { z } from 'zod';
import { fechaDiaSchema, nombreSchema, textoOpcional, type PersonaResumen } from './comun.ts';
import { horaSchema } from './horarios.ts';

const idSchema = z.number().int().positive();

export const actualizarClaseSchema = z.object({
  profesorId: idSchema.optional(),
  estado: z.enum(['programada', 'cancelada']).optional(),
  fecha: fechaDiaSchema.optional(),
  horaInicio: horaSchema.optional(),
  horaFin: horaSchema.optional(),
  estilo: nombreSchema.optional(),
  nivel: textoOpcional,
});

export const crearClaseUnicaSchema = z
  .object({
    fecha: fechaDiaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
    estilo: nombreSchema,
    nivel: textoOpcional,
    profesorId: idSchema,
  })
  .refine((clase) => clase.horaFin > clase.horaInicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['horaFin'],
  });

export type CrearClaseUnicaInput = z.infer<typeof crearClaseUnicaSchema>;

export const CAMPOS_PARA_MOVER_UNA_CLASE = ['fecha', 'horaInicio', 'horaFin', 'estilo', 'nivel'] as const;

export type ActualizarClaseInput = z.infer<typeof actualizarClaseSchema>;

export const clasesQuerySchema = z
  .object({
    desde: fechaDiaSchema.optional(),
    hasta: fechaDiaSchema.optional(),
  })
  .refine((consulta) => consulta.desde === undefined || consulta.hasta === undefined || consulta.desde <= consulta.hasta, {
    message: 'La fecha de inicio tiene que ser anterior o igual a la de fin',
    path: ['hasta'],
  });

export type EstadoClase = 'programada' | 'dictada' | 'cancelada';

export type Clase = {
  id: number;
  horarioId: number | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estilo: string;
  nivel: string | null;
  estado: EstadoClase;
  profesor: PersonaResumen;
  profesorTitular: PersonaResumen | null;
  tieneCambios: boolean;
  asistentes: number;
};

export type ClasesDelRango = {
  desde: string;
  hasta: string;
  finDelHorizonte: string;
  items: Clase[];
};
