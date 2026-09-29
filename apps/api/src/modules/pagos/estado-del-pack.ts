import type { EstadoPack, PagoActual } from '@studio/shared';
import { sumarDias, type FechaDia } from '../../lib/fechas.ts';

// Decisión por defecto de v1 (ver el índice de features): se avisa cuando queda una clase o una semana.
const CLASES_PARA_AVISAR = 1;
const DIAS_PARA_AVISAR = 7;

// Un pago no anulado del alumno. Las clases usadas se cuentan en la base.
export type PagoDeAlumno = {
  id: number;
  pack: string;
  cantidadClases: number;
  clasesUsadas: number;
  venceEl: FechaDia;
};

// Recibe los pagos no anulados del alumno: por lo menos los que no vencieron y el último.
export function estadoDelPack(
  pagos: PagoDeAlumno[],
  hoy: FechaDia,
): { estadoPack: EstadoPack; pagoActual: PagoActual | null } {
  // El día del vencimiento todavía vale, igual que al registrar una asistencia.
  const sinVencer = pagos.filter((pago) => pago.venceEl >= hoy);
  // Mismo orden que usa la asistencia para elegir el pago: el que vence primero.
  const queSirven = sinVencer.filter((pago) => restantes(pago) > 0).sort(porVencimiento);

  const enUso = queSirven[0];
  if (enUso !== undefined) {
    // Se miran todos los que sirven: a quien ya pagó el pack siguiente no hay que cobrarle.
    const clasesQueLeQuedan = queSirven.reduce((suma, pago) => suma + restantes(pago), 0);
    const ultimoVencimiento = queSirven.at(-1)!.venceEl;
    const porVencer =
      clasesQueLeQuedan <= CLASES_PARA_AVISAR || ultimoVencimiento <= sumarDias(hoy, DIAS_PARA_AVISAR);
    return { estadoPack: porVencer ? 'por_vencer' : 'vigente', pagoActual: aPagoActual(enUso) };
  }

  const ultimoSinVencer = sinVencer.sort(porVencimiento).at(-1);
  if (ultimoSinVencer !== undefined) return { estadoPack: 'sin_clases', pagoActual: aPagoActual(ultimoSinVencer) };

  const ultimo = [...pagos].sort(porVencimiento).at(-1);
  if (ultimo !== undefined) return { estadoPack: 'vencido', pagoActual: aPagoActual(ultimo) };

  return { estadoPack: 'sin_pack', pagoActual: null };
}

function restantes(pago: PagoDeAlumno): number {
  return pago.cantidadClases - pago.clasesUsadas;
}

// Los ids crecen con la fecha de cobro: a igual vencimiento, primero el que se pagó antes.
function porVencimiento(a: PagoDeAlumno, b: PagoDeAlumno): number {
  if (a.venceEl !== b.venceEl) return a.venceEl < b.venceEl ? -1 : 1;
  return a.id - b.id;
}

function aPagoActual(pago: PagoDeAlumno): PagoActual {
  return {
    pack: pago.pack,
    cantidadClases: pago.cantidadClases,
    clasesRestantes: restantes(pago),
    venceEl: pago.venceEl,
  };
}
