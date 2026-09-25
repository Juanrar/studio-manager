import { z } from 'zod';
import { dniOpcional, emailOpcional, fechaDiaSchema, nombreSchema, textoOpcional } from './comun.ts';

export const porcentajeBpSchema = z
  .number({ invalid_type_error: 'El porcentaje tiene que ser un número' })
  .int('El porcentaje va en puntos básicos, sin decimales')
  .min(1, 'El porcentaje va de 1 a 10000 puntos básicos (10000 es el 100%)')
  .max(10_000, 'El porcentaje va de 1 a 10000 puntos básicos (10000 es el 100%)');

const datosPersonales = {
  nombre: nombreSchema,
  apellido: nombreSchema,
  dni: dniOpcional,
  email: emailOpcional,
  telefono: textoOpcional,
  aliasCbu: textoOpcional,
};

export const crearProfesorSchema = z.object({
  ...datosPersonales,
  porcentajeBp: porcentajeBpSchema,
});

export type CrearProfesorInput = z.infer<typeof crearProfesorSchema>;

export const actualizarProfesorSchema = z.object({
  ...datosPersonales,
  nombre: nombreSchema.optional(),
  apellido: nombreSchema.optional(),
  activo: z.boolean().optional(),
});

export type ActualizarProfesorInput = z.infer<typeof actualizarProfesorSchema>;

export const nuevoPorcentajeSchema = z.object({
  porcentajeBp: porcentajeBpSchema,
  vigenteDesde: fechaDiaSchema,
});

export type NuevoPorcentajeInput = z.infer<typeof nuevoPorcentajeSchema>;

export type Profesor = {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  aliasCbu: string | null;
  activo: boolean;
  porcentajeVigenteBp: number | null;
};

export type PorcentajeProfesor = {
  id: number;
  porcentajeBp: number;
  vigenteDesde: string;
};
