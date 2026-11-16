import type { PersonaResumen } from './comun.ts';

export type ResumenDeAlumno = {
  clasesTomadas: number;
  clasesEnOchoSemanas: number;
  ultimaClase: string | null;
  hoy: string;
  estiloMasTomado: string | null;
  sueleVenir: { diasSemana: number[]; horaInicio: string } | null;
  vencidasSinUsar: number;
  totalPagado: number | null;
  profesores: { id: number; nombre: string; apellido: string; estilo: string; clases: number }[];
  meses: {
    mes: string;
    compras: { pack: string; veces: number }[];
    tomadas: number;
    vencidas: number;
    clases: { fecha: string; estilo: string; profesor: PersonaResumen }[];
  }[];
};
