import type { DetalleDeClase, IngresosDelPeriodo, Liquidacion, ResumenProfesor } from './liquidaciones.ts';
import type { EstadoPack } from './pagos.ts';

export type Indicadores = {
  ingresos: number;
  sueldos: number;
  leQuedaAlEstudio: number;
  asistencias: number;
  alumnosActivos: number;
  alumnosNuevos: number;
  clasesPerdidas: number;
  valorPerdido: number;
};

export type FilaDelRanking = ResumenProfesor & { asistenciasMesAnterior: number };

export type TableroDelMes = {
  periodo: string;
  actual: Indicadores;
  anterior: Indicadores;
  porDia: { fecha: string; asistencias: number; cobrado: number }[];
  ingresosPorMedio: IngresosDelPeriodo['porMedio'];
  profesores: FilaDelRanking[];
  alumnosPorEstado: Record<EstadoPack, number>;
};

export type FilaPorHorario = {
  horarioId: number | null;
  estilo: string;
  diaSemana: number | null;
  horaInicio: string | null;
  clases: number;
  asistencias: number;
  monto: number;
};

export type AlumnoDeLaClase = {
  alumnoId: number;
  nombre: string;
  apellido: string;
  pack: string;
  valorClase: number;
  parte: number;
};

export type ClaseDelMes = DetalleDeClase & { alumnos: AlumnoDeLaClase[] };

export type TableroDelProfesor = {
  periodo: string;
  profesor: { id: number; nombre: string; apellido: string; aliasCbu: string | null; porcentajeBp: number | null };
  liquidacion: Liquidacion | null;
  montoCalculado: number;
  clasesDictadas: number;
  clasesCanceladas: number;
  asistencias: number;
  alumnosDistintos: number;
  suplenciasDadas: number;
  suplenciasRecibidas: number;
  sueldoPorMes: { periodo: string; monto: number }[];
  porHorario: FilaPorHorario[];
  clases: ClaseDelMes[];
};
