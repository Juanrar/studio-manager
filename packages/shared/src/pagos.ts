import { z } from 'zod';
import { fechaDiaSchema } from './comun.ts';
import { MEDIOS_PAGO, type MedioPago } from './constantes.ts';

const idSchema = z.number().int().positive();

export const registrarPagoSchema = z.object({
  alumnoId: idSchema,
  packId: idSchema,
  medio: z.enum(MEDIOS_PAGO),
});

export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;

export const anularPagoSchema = z.object({
  motivo: z.string().trim().min(1, 'Contá por qué se anula el pago'),
});

export const extenderVencimientoSchema = z.object({
  venceEl: fechaDiaSchema,
});

export const pagosQuerySchema = z.object({
  alumnoId: z.coerce.number().int().positive(),
});

export type Pago = {
  id: number;
  alumnoId: number;
  pack: { id: number; nombre: string };
  cantidadClases: number;
  clasesUsadas: number;
  clasesRestantes: number;
  monto: number;
  medio: MedioPago;
  fecha: string;
  venceEl: string;
  vencido: boolean;
  anulado: boolean;
  motivoAnulacion: string | null;
  registradoPor: { id: number; nombre: string };
};
