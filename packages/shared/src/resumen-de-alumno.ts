import type { PersonaResumen } from './comun.ts';

export type ResumenDeAlumno = {
  clasesTomadas: number;
  clasesEnOchoSemanas: number; // la web divide por 8
  ultimaClase: string | null; // día
  hoy: string; // día del estudio, para "Hace N días"
  estiloMasTomado: string | null;
  sueleVenir: { diasSemana: number[]; horaInicio: string } | null;
  vencidasSinUsar: number;
  totalPagado: number | null; // null para recepción
  profesores: { id: number; nombre: string; apellido: string; estilo: string; clases: number }[];
  meses: {
    mes: string; // AAAA-MM, del más viejo al actual, siempre 12
    compras: { pack: string; veces: number }[];
    tomadas: number;
    vencidas: number;
    clases: { fecha: string; estilo: string; profesor: PersonaResumen }[]; // de la más nueva a la más vieja
  }[];
};
