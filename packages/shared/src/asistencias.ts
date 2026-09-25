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

// Código de error que manda la API cuando el alumno no tiene clases para usar.
export const SIN_CLASES_DISPONIBLES = 'SIN_CLASES_DISPONIBLES';

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
