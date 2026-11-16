import { z } from 'zod';
import type { PersonaResumen } from './comun.ts';
import type { CrearClaseUnicaInput } from './clases.ts';
import { nombreSchema, textoOpcional } from './comun.ts';
import { diaSemanaSchema, horaSchema, type CrearHorarioInput } from './horarios.ts';
import { crearProfesorSchema } from './profesores.ts';

export const LARGO_MAXIMO_DEL_MENSAJE = 2000;
export const ELEMENTOS_MAXIMOS_DEL_HISTORIAL = 80;

export const CONVERSACION_LARGA = 'CONVERSACION_LARGA';

export const mensajeAlAsistenteSchema = z.object({
  historial: z.array(z.unknown()),
  mensaje: z.string().trim().min(1, 'Escribí un mensaje').max(LARGO_MAXIMO_DEL_MENSAJE, 'El mensaje es muy largo'),
});

export type MensajeAlAsistenteInput = z.infer<typeof mensajeAlAsistenteSchema>;

const horarioDelAltaSchema = z
  .object({
    estilo: nombreSchema,
    nivel: textoOpcional,
    diaSemana: diaSemanaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
  })
  .refine((horario) => horario.horaFin > horario.horaInicio, {
    message: 'La hora de fin tiene que ser posterior a la de inicio',
    path: ['horaFin'],
  });

export const altaDeProfesorSchema = z.object({
  profesor: crearProfesorSchema,
  horarios: z.array(horarioDelAltaSchema).min(1, 'Tiene que tener al menos un horario').max(14, 'Son 14 horarios como máximo'),
});

export type AltaDeProfesorInput = z.infer<typeof altaDeProfesorSchema>;

export type PropuestaDelAsistente =
  | { tipo: 'claseUnica'; datos: CrearClaseUnicaInput; profesor: PersonaResumen }
  | { tipo: 'horario'; datos: Omit<CrearHorarioInput, 'desde' | 'claseId'>; profesor: PersonaResumen }
  | { tipo: 'altaDeProfesor'; datos: AltaDeProfesorInput };

export type RespuestaDelAsistente = {
  historial: unknown[];
  texto: string;
  propuestas: PropuestaDelAsistente[];
};
