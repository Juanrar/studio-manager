import { z } from 'zod';
import { fechaDiaSchema, nombreSchema, textoOpcional, type PersonaResumen } from './comun.ts';
import { horaSchema } from './horarios.ts';

// La clase de una fecha: "Hip-Hop del martes 10". Sale de un horario, se crea por adelantado y guarda
// su hora, su estilo y quién la dio de verdad.

const idSchema = z.number().int().positive();

export const actualizarClaseSchema = z.object({
  profesorId: idSchema.optional(),
  estado: z.enum(['programada', 'cancelada']).optional(),
  // Mover la clase dentro de su semana o cambiarla solo esa semana: lo hace un administrador desde la grilla.
  fecha: fechaDiaSchema.optional(),
  horaInicio: horaSchema.optional(),
  horaFin: horaSchema.optional(),
  estilo: nombreSchema.optional(),
  nivel: textoOpcional,
});

// Una clase única: un workshop o una clase de recuperación que no sale de ningún horario.
export const crearClaseUnicaSchema = z
  .object({
    fecha: fechaDiaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
    estilo: nombreSchema,
    nivel: textoOpcional,
    profesorId: idSchema,
  })
  // Las horas HH:MM se pueden comparar como texto.
  .refine((clase) => clase.horaFin > clase.horaInicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['horaFin'],
  });

export type CrearClaseUnicaInput = z.infer<typeof crearClaseUnicaSchema>;

// Los campos del PATCH que solo puede mandar un administrador. Recepción pone suplentes y cancela.
export const CAMPOS_PARA_MOVER_UNA_CLASE = ['fecha', 'horaInicio', 'horaFin', 'estilo', 'nivel'] as const;

export type ActualizarClaseInput = z.infer<typeof actualizarClaseSchema>;

// Sin fechas, el día de hoy en el estudio. Sin `hasta`, el mismo día que `desde`.
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
  // Nulo en una clase única, que no sale de ningún horario.
  horarioId: number | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estilo: string;
  nivel: string | null;
  estado: EstadoClase;
  // Quien la da de verdad: cambia si hay suplencia.
  profesor: PersonaResumen;
  // El titular del horario; nulo en una clase única.
  profesorTitular: PersonaResumen | null;
  // Si difiere de su horario (día, horas, estilo, nivel, profesor o estado). Se calcula solo de la
  // semana actual en adelante: antes la comparación sería contra el horario de hoy.
  tieneCambios: boolean;
  asistentes: number;
};

export type ClasesDelRango = {
  desde: string;
  hasta: string;
  // Último día con clases creadas por adelantado: más adelante la grilla todavía no está armada.
  finDelHorizonte: string;
  items: Clase[];
};
