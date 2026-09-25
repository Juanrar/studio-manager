import { z } from 'zod';
import { nombreSchema, precioSchema } from './comun.ts';

const cantidadClasesSchema = z
  .number({ invalid_type_error: 'La cantidad de clases tiene que ser un número' })
  .int('La cantidad de clases tiene que ser un número entero')
  .min(1, 'El pack tiene que tener al menos una clase');

export const crearPackSchema = z.object({
  nombre: nombreSchema,
  cantidadClases: cantidadClasesSchema,
  precio: precioSchema,
});

export type CrearPackInput = z.infer<typeof crearPackSchema>;

export const actualizarPackSchema = z.object({
  nombre: nombreSchema.optional(),
  cantidadClases: cantidadClasesSchema.optional(),
  precio: precioSchema.optional(),
  activo: z.boolean().optional(),
});

export type ActualizarPackInput = z.infer<typeof actualizarPackSchema>;

export type Pack = {
  id: number;
  nombre: string;
  cantidadClases: number;
  precio: number;
  activo: boolean;
};
