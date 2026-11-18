import type { EstadoPack, FilaDelRanking, Indicadores, ResumenProfesor, TableroDelMes } from '@studio/shared';
import { db } from '../../db/client.ts';
import { rangoDelPeriodo, sumarDias, sumarMeses, type FechaDia, type Periodo } from '../../lib/fechas.ts';
import { idsDeAlumnosActivos } from '../alumnos/alumnos.service.ts';
import { resumenDelPeriodo } from '../liquidaciones/liquidaciones.service.ts';
import {
  alumnosNuevos,
  clasesPerdidas,
  cobradoPorDia,
  ingresosDelPeriodo,
  resumenDePacks,
} from '../pagos/pagos.service.ts';
import * as repo from './tablero.repository.ts';

const ESTADOS: EstadoPack[] = ['vigente', 'por_vencer', 'sin_clases', 'vencido', 'sin_pack'];

function sueldoDe(item: ResumenProfesor): number {
  return item.liquidacion?.monto ?? item.montoCalculado;
}

function mesAnteriorDe(periodo: Periodo): Periodo {
  return sumarMeses(`${periodo}-01`, -1).slice(0, 7);
}

async function indicadoresDe(
  periodo: Periodo,
  hoy: FechaDia,
  ingresos: number,
  profesores: ResumenProfesor[],
  asistencias: repo.AsistenciaDelDia[],
): Promise<Indicadores> {
  const [nuevos, perdidas] = await Promise.all([alumnosNuevos(periodo), clasesPerdidas(periodo, hoy)]);
  const sueldos = profesores.reduce((total, item) => total + sueldoDe(item), 0);
  return {
    ingresos,
    sueldos,
    leQuedaAlEstudio: ingresos - sueldos,
    asistencias: asistencias.length,
    alumnosActivos: new Set(asistencias.map((a) => a.alumnoId)).size,
    alumnosNuevos: nuevos,
    clasesPerdidas: perdidas.clases,
    valorPerdido: perdidas.valor,
  };
}

async function datosDelMes(periodo: Periodo, hoy: FechaDia) {
  const { desde, hasta } = rangoDelPeriodo(periodo);
  const [resumen, ingresos, asistencias] = await Promise.all([
    resumenDelPeriodo(periodo, hoy),
    ingresosDelPeriodo(periodo),
    repo.listarAsistenciasDelPeriodo(db, desde, hasta),
  ]);
  const indicadores = await indicadoresDe(periodo, hoy, ingresos.total, resumen.items, asistencias);
  return { resumen, ingresos, asistencias, indicadores };
}

function diasDelPeriodo(periodo: Periodo): FechaDia[] {
  const { desde, hasta } = rangoDelPeriodo(periodo);
  const dias: FechaDia[] = [];
  for (let dia = desde; dia < hasta; dia = sumarDias(dia, 1)) dias.push(dia);
  return dias;
}

function rankingDe(actual: ResumenProfesor[], anterior: ResumenProfesor[]): FilaDelRanking[] {
  const delMesAnterior = new Map(anterior.map((item) => [item.profesor.id, item.asistencias]));
  return actual
    .map((item) => ({ ...item, asistenciasMesAnterior: delMesAnterior.get(item.profesor.id) ?? 0 }))
    .sort(
      (a, b) =>
        b.asistencias - a.asistencias ||
        a.profesor.apellido.localeCompare(b.profesor.apellido, 'es') ||
        a.profesor.nombre.localeCompare(b.profesor.nombre, 'es'),
    );
}

async function alumnosPorEstado(hoy: FechaDia): Promise<Record<EstadoPack, number>> {
  const ids = await idsDeAlumnosActivos();
  const resumenes = await resumenDePacks(ids, hoy);
  const cuenta = Object.fromEntries(ESTADOS.map((estado) => [estado, 0])) as Record<EstadoPack, number>;
  for (const { estadoPack } of resumenes.values()) cuenta[estadoPack] += 1;
  return cuenta;
}

export async function tableroDelMes(periodo: Periodo, hoy: FechaDia): Promise<TableroDelMes> {
  const [actual, anterior, cobrado, estados] = await Promise.all([
    datosDelMes(periodo, hoy),
    datosDelMes(mesAnteriorDe(periodo), hoy),
    cobradoPorDia(periodo),
    alumnosPorEstado(hoy),
  ]);
  const asistenciasPorDia = Map.groupBy(actual.asistencias, (a) => a.fecha);

  return {
    periodo,
    actual: actual.indicadores,
    anterior: anterior.indicadores,
    porDia: diasDelPeriodo(periodo).map((fecha) => ({
      fecha,
      asistencias: asistenciasPorDia.get(fecha)?.length ?? 0,
      cobrado: cobrado.get(fecha) ?? 0,
    })),
    ingresosPorMedio: actual.ingresos.porMedio,
    profesores: rankingDe(actual.resumen.items, anterior.resumen.items),
    alumnosPorEstado: estados,
  };
}
