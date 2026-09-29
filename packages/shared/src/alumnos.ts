import { z } from 'zod';
import type { Listado } from './comun.ts';
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

// Una fila del listado de recepción: el alumno, el pack que está usando y el día de su última clase.
export type AlumnoEnListado = Alumno & ResumenDelPack & { ultimaClase: string | null };

// GET /api/alumnos/:id: el alumno, el día de su alta en la zona del estudio y el pack que está usando.
export type FichaDeAlumno = Alumno & ResumenDelPack & { alta: string };

// `vigentes` cuenta los alumnos activos del filtro con el pack vigente, en todas las páginas.
// `hoy` es el día del estudio para el que se calcularon los estados.
export type ListadoDeAlumnos = Listado<AlumnoEnListado> & { vigentes: number; hoy: string };
