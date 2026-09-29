import { MESES_SIN_COMPRAR } from '@studio/shared';
import { sumarMeses, type FechaDia } from '../../lib/fechas.ts';

// Desde cuándo se cuentan los meses sin comprar es una decisión por defecto de v1 (ver el índice de features).

export type AlumnoParaBaja = {
  // El día del alta o de la última reactivación.
  activoDesde: FechaDia;
  // El día del último pago no anulado, o null si nunca compró.
  ultimaCompra: FechaDia | null;
  tienePackSinVencer: boolean;
};

export function correspondeBajaAutomatica(alumno: AlumnoParaBaja, hoy: FechaDia): boolean {
  // Un pago que el admin extendió sigue sirviendo aunque se haya comprado hace más de 2 meses.
  if (alumno.tienePackSinVencer) return false;
  // Si se lo reactivó después de su última compra, se cuenta desde la reactivación: si no, se lo daría
  // de baja apenas recepción lo reactiva.
  const desde =
    alumno.ultimaCompra !== null && alumno.ultimaCompra > alumno.activoDesde ? alumno.ultimaCompra : alumno.activoDesde;
  return sumarMeses(desde, MESES_SIN_COMPRAR) <= hoy;
}
