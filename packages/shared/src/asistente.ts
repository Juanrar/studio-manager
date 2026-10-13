import { z } from 'zod';
import type { PersonaResumen } from './comun.ts';
import type { CrearClaseUnicaInput } from './clases.ts';
import type { CrearHorarioInput } from './horarios.ts';

export const LARGO_MAXIMO_DEL_MENSAJE = 2000;
// Cada vuelta suma dos elementos al historial: con 80 entra una conversación larga.
export const ELEMENTOS_MAXIMOS_DEL_HISTORIAL = 80;

export const mensajeAlAsistenteSchema = z.object({
  // Lo arma el proveedor del modelo: la web lo devuelve sin mirarlo.
  historial: z.array(z.unknown()).max(ELEMENTOS_MAXIMOS_DEL_HISTORIAL, 'La conversación es muy larga: empezá una nueva'),
  mensaje: z.string().trim().min(1, 'Escribí un mensaje').max(LARGO_MAXIMO_DEL_MENSAJE, 'El mensaje es muy largo'),
});

export type MensajeAlAsistenteInput = z.infer<typeof mensajeAlAsistenteSchema>;

// Algo que el asistente propone crear. Se crea recién cuando el usuario toca "Crear".
export type PropuestaDelAsistente =
  | { tipo: 'claseUnica'; datos: CrearClaseUnicaInput; profesor: PersonaResumen }
  | { tipo: 'horario'; datos: Omit<CrearHorarioInput, 'desde' | 'claseId'>; profesor: PersonaResumen };

export type RespuestaDelAsistente = {
  historial: unknown[];
  texto: string;
  propuestas: PropuestaDelAsistente[];
};
