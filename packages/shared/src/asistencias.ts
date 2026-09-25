import { z } from 'zod';
import { MEDIOS_PAGO } from './constantes.ts';

const idSchema = z.number().int().positive();

export const registrarAsistenciaSchema = z.object({
  alumnoId: idSchema,
  // Si el alumno no tiene clases disponibles, recepción puede cobrar en el acto.
  cobrar: z
    .object({
      packId: idSchema,
      medio: z.enum(MEDIOS_PAGO),
    })
    .optional(),
});

export type RegistrarAsistenciaInput = z.infer<typeof registrarAsistenciaSchema>;

export type Asistencia = {
  id: number;
  sesionId: number;
  alumno: { id: number; nombre: string; apellido: string };
  pagoId: number;
  pack: string;
  valorClase: number;
  porcentajeBp: number;
};
