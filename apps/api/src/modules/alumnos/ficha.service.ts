import type { EventoDeAlumno, FichaDeAlumno } from '@studio/shared';
import { config } from '../../config.ts';
import { db } from '../../db/client.ts';
import { NoEncontradoError } from '../../lib/errores.ts';
import { hoyEnEstudio, type FechaDia } from '../../lib/fechas.ts';
import { asistenciasDeAlumno } from '../asistencias/asistencias.service.ts';
import { listarPagosDeAlumno, resumenDePacks } from '../pagos/pagos.service.ts';
import * as repo from './alumnos.repository.ts';

// La ficha de recepción y la actividad del alumno. Viven fuera de alumnos.service por lo mismo
// que el listado: pagos y asistencias ya usan alumnos.service.

export async function obtenerFicha(id: number, hoy: FechaDia): Promise<FichaDeAlumno> {
  const { creadoEn, ...alumno } = await buscarConAlta(id);
  const packs = await resumenDePacks([id], hoy);

  return { ...alumno, alta: hoyEnEstudio(creadoEn, config.tzEstudio), ...packs.get(id)! };
}

// Del hecho más nuevo al más viejo. Una clase de un día posterior a hoy todavía no pasó: está anotada.
export async function actividadDelAlumno(id: number, hoy: FechaDia): Promise<EventoDeAlumno[]> {
  const { creadoEn } = await buscarConAlta(id);
  const asistencias = await asistenciasDeAlumno(id);
  const pagos = await listarPagosDeAlumno(id, hoy);

  const eventos: EventoDeAlumno[] = [
    ...asistencias.map((asistencia) => ({
      tipo: asistencia.fecha > hoy ? ('anotado' as const) : ('asistencia' as const),
      ...asistencia,
    })),
    ...pagos.map((pago) => ({
      tipo: 'pago' as const,
      fecha: hoyEnEstudio(new Date(pago.fecha), config.tzEstudio),
      pack: pago.pack.nombre,
      monto: pago.monto,
      medio: pago.medio,
      anulado: pago.anulado,
    })),
    { tipo: 'alta', fecha: hoyEnEstudio(creadoEn, config.tzEstudio) },
  ];
  // `sort` es estable: en un mismo día y tipo queda el orden de cada consulta, que ya es del más nuevo al más viejo.
  return eventos.sort(masNuevoPrimero);
}

async function buscarConAlta(id: number) {
  const encontrado = await repo.buscarConAlta(db, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el alumno ${id}`);
  return encontrado;
}

// En un mismo día, al revés de como pasa cuando alguien se anota, paga y toma su primera clase.
const ORDEN_EN_EL_DIA: Record<EventoDeAlumno['tipo'], number> = { anotado: 0, asistencia: 0, pago: 1, alta: 2 };

function masNuevoPrimero(a: EventoDeAlumno, b: EventoDeAlumno): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  return ORDEN_EN_EL_DIA[a.tipo] - ORDEN_EN_EL_DIA[b.tipo];
}
