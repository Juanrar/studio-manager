import type {
  ClaseDelMes,
  DetalleDeClase,
  EstadoPack,
  FilaDelRanking,
  FilaPorHorario,
  Indicadores,
  ResumenProfesor,
  TableroDelMes,
  TableroDelProfesor,
} from '@studio/shared';
import { db } from '../../db/client.ts';
import { aplicarPorcentaje } from '../../lib/dinero.ts';
import { periodoDe, rangoDelPeriodo, sumarDias, sumarMeses, type FechaDia, type Periodo } from '../../lib/fechas.ts';
import { idsDeAlumnosActivos } from '../alumnos/alumnos.service.ts';
import { detalleDelPeriodo, resumenDelPeriodo } from '../liquidaciones/liquidaciones.service.ts';
import {
  alumnosNuevos,
  clasesPerdidas,
  cobradoPorDia,
  ingresosDelPeriodo,
  resumenDePacks,
} from '../pagos/pagos.service.ts';
import { obtenerProfesor } from '../profesores/profesores.service.ts';
import * as repo from './tablero.repository.ts';

const ESTADOS: EstadoPack[] = ['vigente', 'por_vencer', 'sin_clases', 'vencido', 'sin_pack'];

function sueldoDe(item: ResumenProfesor): number {
  return item.liquidacion?.monto ?? item.montoCalculado;
}

function mesDesplazado(periodo: Periodo, meses: number): Periodo {
  return periodoDe(sumarMeses(`${periodo}-01`, meses));
}

function mesAnteriorDe(periodo: Periodo): Periodo {
  return mesDesplazado(periodo, -1);
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

const MESES_DE_SUELDO = 6;
const ESTILO_DE_CLASES_UNICAS = 'Clases únicas';

function filaPorHorario(
  clases: repo.ClaseDelProfesor[],
  asistencias: repo.AsistenciaDeClase[],
): FilaPorHorario {
  const primera = clases[0]!;
  const ids = new Set(clases.map((c) => c.id));
  const suyas = asistencias.filter((a) => ids.has(a.claseId));
  return {
    horarioId: primera.horarioId,
    estilo: primera.estilo ?? ESTILO_DE_CLASES_UNICAS,
    diaSemana: primera.diaSemana,
    horaInicio: primera.horaInicio,
    clases: clases.length,
    asistencias: suyas.length,
    monto: suyas.reduce((total, a) => total + aplicarPorcentaje(a.valorClase, a.porcentajeBp), 0),
  };
}

function ordenarFilasPorHorario(filas: FilaPorHorario[]): FilaPorHorario[] {
  return filas.sort(
    (a, b) =>
      Number(a.horarioId === null) - Number(b.horarioId === null) ||
      (a.diaSemana ?? 0) - (b.diaSemana ?? 0) ||
      (a.horaInicio ?? '').localeCompare(b.horaInicio ?? ''),
  );
}

async function sueldoDelProfesor(profesorId: number, periodo: Periodo, hoy: FechaDia): Promise<number> {
  const resumen = await resumenDelPeriodo(periodo, hoy);
  const item = resumen.items.find((i) => i.profesor.id === profesorId);
  return item === undefined ? 0 : sueldoDe(item);
}

function clasesConAlumnos(detalle: DetalleDeClase[], alumnos: repo.AlumnoEnClase[]): ClaseDelMes[] {
  const porClase = Map.groupBy(alumnos, (a) => a.claseId);
  return detalle.map((deClase) => ({
    ...deClase,
    alumnos: (porClase.get(deClase.claseId) ?? []).map((a) => ({
      alumnoId: a.alumnoId,
      nombre: a.nombre,
      apellido: a.apellido,
      pack: a.pack,
      valorClase: a.valorClase,
      parte: aplicarPorcentaje(a.valorClase, a.porcentajeBp),
    })),
  }));
}

export async function tableroDelProfesor(
  profesorId: number,
  periodo: Periodo,
  hoy: FechaDia,
): Promise<TableroDelProfesor> {
  const { desde, hasta } = rangoDelPeriodo(periodo);
  const periodosDeSueldo = Array.from({ length: MESES_DE_SUELDO }, (_, i) =>
    mesDesplazado(periodo, i - (MESES_DE_SUELDO - 1)),
  );
  const [profesor, resumen, clasesDelMes, asistenciasDelMes, recibidas, detalle, alumnosDeLasClases, sueldos] = await Promise.all([
    obtenerProfesor(profesorId, hoy),
    resumenDelPeriodo(periodo, hoy),
    repo.listarClasesDelProfesor(db, profesorId, desde, hasta),
    repo.listarAsistenciasDelProfesor(db, profesorId, desde, hasta),
    repo.contarSuplenciasRecibidas(db, profesorId, desde, hasta, hoy),
    detalleDelPeriodo(profesorId, periodo),
    repo.listarAlumnosDeLasClases(db, profesorId, desde, hasta),
    Promise.all(
      periodosDeSueldo.map((p) => (p === periodo ? null : sueldoDelProfesor(profesorId, p, hoy))),
    ),
  ]);
  const item = resumen.items.find((i) => i.profesor.id === profesorId);
  const sueldoDelMes = item === undefined ? 0 : sueldoDe(item);
  const clasesConAsistencia = new Set(asistenciasDelMes.map((a) => a.claseId));
  const canceladas = clasesDelMes.filter((c) => c.estado === 'cancelada');
  const dictadas = clasesDelMes.filter(
    (c) => c.estado !== 'cancelada' && (c.fecha <= hoy || clasesConAsistencia.has(c.id)),
  );
  const asistencias = asistenciasDelMes;

  return {
    periodo,
    profesor: {
      id: profesor.id,
      nombre: profesor.nombre,
      apellido: profesor.apellido,
      aliasCbu: profesor.aliasCbu,
      porcentajeBp: profesor.porcentajeVigenteBp,
    },
    liquidacion: item?.liquidacion ?? null,
    montoCalculado: item?.montoCalculado ?? 0,
    clasesDictadas: dictadas.length,
    clasesCanceladas: canceladas.length,
    asistencias: asistencias.length,
    alumnosDistintos: new Set(asistencias.map((a) => a.alumnoId)).size,
    suplenciasDadas: dictadas.filter((c) => c.titularId !== null && c.titularId !== profesorId).length,
    suplenciasRecibidas: recibidas,
    sueldoPorMes: periodosDeSueldo.map((p, i) => ({
      periodo: p,
      monto: sueldos[i] ?? sueldoDelMes,
    })),
    porHorario: ordenarFilasPorHorario(
      [...Map.groupBy(dictadas, (c) => c.horarioId).values()].map((deHorario) =>
        filaPorHorario(deHorario, asistencias),
      ),
    ),
    clases: clasesConAlumnos(detalle, alumnosDeLasClases),
  };
}
