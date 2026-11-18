import type { IngresosDelPeriodo, ResumenProfesor } from './liquidaciones.ts';
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
