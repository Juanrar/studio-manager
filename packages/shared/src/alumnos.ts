import { z } from 'zod';
import {
  dniOpcional,
  emailOpcional,
  fechaOpcional,
  nombreSchema,
  textoOpcional,
} from './comun.ts';

const camposAlumno = {
  nombre: nombreSchema,
  apellido: nombreSchema,
  dni: dniOpcional,
  email: emailOpcional,
  telefono: textoOpcional,
  fechaNacimiento: fechaOpcional,
  contactoEmergencia: textoOpcional,
  notas: textoOpcional,
};

export const crearAlumnoSchema = z.object(camposAlumno);

export type CrearAlumnoInput = z.infer<typeof crearAlumnoSchema>;

export const actualizarAlumnoSchema = z.object({
  ...camposAlumno,
  nombre: nombreSchema.optional(),
  apellido: nombreSchema.optional(),
  activo: z.boolean().optional(),
});

export type ActualizarAlumnoInput = z.infer<typeof actualizarAlumnoSchema>;

export type Alumno = {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  contactoEmergencia: string | null;
  notas: string | null;
  activo: boolean;
};
