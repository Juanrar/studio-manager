import { z } from 'zod';
import type { PersonaResumen } from './clases.ts';
import type { MedioPago } from './constantes.ts';

export const periodoSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El período tiene que tener el formato AAAA-MM');

export const periodoQuerySchema = z.object({ periodo: periodoSchema });

export const detalleLiquidacionQuerySchema = z.object({
  periodo: periodoSchema,
  profesorId: z.coerce.number().int().positive(),
});

export const cerrarLiquidacionSchema = z.object({
  profesorId: z.number().int().positive(),
  periodo: periodoSchema,
});

export type Liquidacion = {
  id: number;
  profesorId: number;
  periodo: string;
  monto: number;
  pagadoEn: string | null;
};

export type ResumenProfesor = {
  profesor: PersonaResumen;
  asistencias: number;
  montoCalculado: number;
  liquidacion: Liquidacion | null;
};

export type ResumenDelPeriodo = { periodo: string; items: ResumenProfesor[] };

export type DetalleSesion = {
  sesionId: number;
  fecha: string;
  estilo: string;
  asistentes: number;
  monto: number;
};

export type IngresosDelPeriodo = {
  periodo: string;
  total: number;
  porMedio: { medio: MedioPago; cantidad: number; total: number }[];
};
