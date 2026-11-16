import { z } from 'zod';
import type { PersonaResumen } from './comun.ts';
import type { Listado } from './comun.ts';
import type { MedioPago } from './constantes.ts';
import type { ResumenDelPack } from './pagos.ts';
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

export type AlumnoEnListado = Alumno & ResumenDelPack & { ultimaClase: string | null };

export type FichaDeAlumno = Alumno & ResumenDelPack & { alta: string };

export type EventoDeAlumno =
  | { tipo: 'asistencia' | 'anotado'; fecha: string; clase: string; profesor: PersonaResumen }
  | { tipo: 'pago'; fecha: string; pack: string; monto: number; medio: MedioPago; anulado: boolean }
  | { tipo: 'baja'; fecha: string; automatica: boolean }
  | { tipo: 'reactivacion'; fecha: string }
  | { tipo: 'alta'; fecha: string };

export type ListadoDeAlumnos = Listado<AlumnoEnListado> & { vigentes: number; hoy: string };
