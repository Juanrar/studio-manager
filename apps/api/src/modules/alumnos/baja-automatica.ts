import { MESES_SIN_COMPRAR } from '@studio/shared';
import { sumarMeses, type FechaDia } from '../../lib/fechas.ts';

export type AlumnoParaBaja = {
  activoDesde: FechaDia;
  ultimaCompra: FechaDia | null;
  tienePackSinVencer: boolean;
};

export function correspondeBajaAutomatica(alumno: AlumnoParaBaja, hoy: FechaDia): boolean {
  if (alumno.tienePackSinVencer) return false;
  const desde =
    alumno.ultimaCompra !== null && alumno.ultimaCompra > alumno.activoDesde ? alumno.ultimaCompra : alumno.activoDesde;
  return sumarMeses(desde, MESES_SIN_COMPRAR) <= hoy;
}
