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

  return { ...alumno, alta: diaDe(creadoEn), ...packs.get(id)! };
}

// Un hecho y el momento en que pasó, para ordenar los de un mismo día. Las clases no tienen hora en la
// actividad (`null`): van antes que el resto de su día, porque se toman con el alumno ya en el estudio.
type HechoConHora = { evento: EventoDeAlumno; instante: Date | null };

// Del hecho más nuevo al más viejo. Una clase de un día posterior a hoy todavía no pasó: está anotada.
export async function actividadDelAlumno(id: number, hoy: FechaDia): Promise<EventoDeAlumno[]> {
  const { creadoEn } = await buscarConAlta(id);
  const asistencias = await asistenciasDeAlumno(id);
  const pagos = await listarPagosDeAlumno(id, hoy);
  const cambios = await repo.listarCambiosDeEstado(db, id);

  const hechos: HechoConHora[] = [
    ...asistencias.map((asistencia) => ({
      evento: { tipo: asistencia.fecha > hoy ? ('anotado' as const) : ('asistencia' as const), ...asistencia },
      instante: null,
    })),
    ...pagos.map((pago) => {
      const instante = new Date(pago.fecha);
      const evento: EventoDeAlumno = {
        tipo: 'pago',
        fecha: diaDe(instante),
        pack: pago.pack.nombre,
        monto: pago.monto,
        medio: pago.medio,
        anulado: pago.anulado,
      };
      return { evento, instante };
    }),
    ...cambios.map((cambio) => {
      const fecha = diaDe(cambio.registradoEn);
      const evento: EventoDeAlumno = cambio.activo
        ? { tipo: 'reactivacion', fecha }
        : { tipo: 'baja', fecha, automatica: cambio.registradoPor === null };
      return { evento, instante: cambio.registradoEn };
    }),
    { evento: { tipo: 'alta', fecha: diaDe(creadoEn) }, instante: creadoEn },
  ];
  // `sort` es estable: las clases de un mismo día quedan en el orden de la consulta, de la última a la primera.
  return hechos.sort(masNuevoPrimero).map((hecho) => hecho.evento);
}

async function buscarConAlta(id: number) {
  const encontrado = await repo.buscarConAlta(db, id);
  if (encontrado === null) throw new NoEncontradoError(`No existe el alumno ${id}`);
  return encontrado;
}

function diaDe(instante: Date): FechaDia {
  return hoyEnEstudio(instante, config.tzEstudio);
}

function masNuevoPrimero(a: HechoConHora, b: HechoConHora): number {
  if (a.evento.fecha !== b.evento.fecha) return a.evento.fecha < b.evento.fecha ? 1 : -1;
  if (a.instante === null || b.instante === null) return Number(b.instante === null) - Number(a.instante === null);
  return b.instante.getTime() - a.instante.getTime();
}
