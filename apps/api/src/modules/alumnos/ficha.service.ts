import type { EventoDeAlumno, FichaDeAlumno, ResumenDeAlumno, Rol } from '@studio/shared';
import { config } from '../../config.ts';
import { db } from '../../db/client.ts';
import { NoEncontradoError } from '../../lib/errores.ts';
import { hoyEnEstudio, type FechaDia } from '../../lib/fechas.ts';
import { asistenciasDeAlumno } from '../asistencias/asistencias.service.ts';
import { listarPagosDeAlumno, resumenDePacks } from '../pagos/pagos.service.ts';
import * as repo from './alumnos.repository.ts';
import { resumir } from './resumen.ts';

export async function obtenerFicha(id: number, hoy: FechaDia): Promise<FichaDeAlumno> {
  const { creadoEn, ...alumno } = await buscarConAlta(id);
  const packs = await resumenDePacks([id], hoy);

  return { ...alumno, alta: diaDe(creadoEn), ...packs.get(id)! };
}

type HechoConHora = { evento: EventoDeAlumno; instante: Date | null };

export async function actividadDelAlumno(id: number, hoy: FechaDia): Promise<EventoDeAlumno[]> {
  const { creadoEn } = await buscarConAlta(id);
  const asistencias = await asistenciasDeAlumno(id);
  const pagos = await listarPagosDeAlumno(id, hoy);
  const cambios = await repo.listarCambiosDeEstado(db, id);

  const hechos: HechoConHora[] = [
    ...asistencias.map(({ fecha, clase, profesor }) => ({
      evento: { tipo: fecha > hoy ? ('anotado' as const) : ('asistencia' as const), fecha, clase, profesor },
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
  return hechos.sort(masNuevoPrimero).map((hecho) => hecho.evento);
}

export async function resumenDelAlumno(id: number, hoy: FechaDia, rol: Rol): Promise<ResumenDeAlumno> {
  await buscarConAlta(id);
  const clases = await asistenciasDeAlumno(id);
  const pagos = (await listarPagosDeAlumno(id, hoy))
    .filter((pago) => !pago.anulado)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .map((pago) => ({
      dia: diaDe(new Date(pago.fecha)),
      pack: pago.pack.nombre,
      cantidadClases: pago.cantidadClases,
      clasesUsadas: pago.clasesUsadas,
      monto: pago.monto,
      vencido: pago.vencido,
    }));

  const resumen = resumir(clases, pagos, hoy);
  return { ...resumen, totalPagado: rol === 'admin' ? resumen.totalPagado : null };
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
