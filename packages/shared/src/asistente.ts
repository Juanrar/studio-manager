import { z } from 'zod';
import type { PersonaResumen } from './comun.ts';
import type { CrearClaseUnicaInput } from './clases.ts';
import type { CrearHorarioInput } from './horarios.ts';

export const LARGO_MAXIMO_DEL_MENSAJE = 2000;
// Cada pedido suma de 4 a 6 elementos al historial: el mensaje, las llamadas a funciones, sus resultados y el
// texto final. Con 80 entran unos 15 a 20 pedidos.
export const ELEMENTOS_MAXIMOS_DEL_HISTORIAL = 80;

// Código de error que manda la API cuando el historial pasa de ELEMENTOS_MAXIMOS_DEL_HISTORIAL.
export const CONVERSACION_LARGA = 'CONVERSACION_LARGA';

export const mensajeAlAsistenteSchema = z.object({
  // Lo arma el proveedor del modelo: la web lo devuelve sin mirarlo. El largo lo controla la API, que
  // responde CONVERSACION_LARGA para que la web ofrezca empezar de nuevo.
  historial: z.array(z.unknown()),
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
