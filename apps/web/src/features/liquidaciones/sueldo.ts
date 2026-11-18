import type { Liquidacion } from '@studio/shared';
import { formatearPesos } from '../../lib/formato.ts';

export const SIN_DATO = '—';

interface ConSueldo {
  liquidacion: Liquidacion | null;
  montoCalculado: number;
}

export function sueldoDe({ liquidacion, montoCalculado }: ConSueldo): number {
  return liquidacion?.monto ?? montoCalculado;
}

export function calculadoHoy({ liquidacion, montoCalculado }: ConSueldo): string | null {
  if (liquidacion === null || liquidacion.monto === montoCalculado) return null;
  return `Calculado hoy: ${formatearPesos(montoCalculado)}`;
}
