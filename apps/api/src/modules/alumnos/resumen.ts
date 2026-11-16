import type { PersonaResumen, ResumenDeAlumno } from '@studio/shared';
import { diaSemanaIso, periodoDe, primerDiaDelMes, sumarDias, sumarMeses, type FechaDia } from '../../lib/fechas.ts';

const DIAS_DE_ACTIVIDAD_RECIENTE = 56;
const MESES_DEL_GRAFICO = 12;
const MAX_PROFESORES = 4;
const MAX_DIAS_QUE_SUELE_VENIR = 2;

export type ClaseParaResumen = { fecha: FechaDia; horaInicio: string; clase: string; profesor: PersonaResumen };

export type PagoParaResumen = {
  dia: FechaDia;
  pack: string;
  cantidadClases: number;
  clasesUsadas: number;
  monto: number;
  vencido: boolean;
};

export function resumir(
  clases: ClaseParaResumen[],
  pagos: PagoParaResumen[],
  hoy: FechaDia,
): ResumenDeAlumno & { totalPagado: number } {
  const tomadas = clases.filter((c) => c.fecha <= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const primerMes = primerDiaDelMes(sumarMeses(primerDiaDelMes(hoy), -(MESES_DEL_GRAFICO - 1)));
  const meses = Array.from({ length: MESES_DEL_GRAFICO }, (_, i) => periodoDe(sumarMeses(primerMes, i)));

  const desdeOchoSemanas = sumarDias(hoy, -DIAS_DE_ACTIVIDAD_RECIENTE);
  const enOchoSemanas = tomadas.filter((c) => c.fecha > desdeOchoSemanas);
  const enDoceMeses = tomadas.filter((c) => c.fecha >= primerMes);

  const mesesResumen = meses.map((mes) => {
    const deLaCompra = pagos.filter((p) => periodoDe(p.dia) === mes);
    const compras: { pack: string; veces: number }[] = [];
    for (const pago of deLaCompra) {
      const existente = compras.find((c) => c.pack === pago.pack);
      if (existente) existente.veces += 1;
      else compras.push({ pack: pago.pack, veces: 1 });
    }
    const delMes = enDoceMeses.filter((c) => periodoDe(c.fecha) === mes);
    return {
      mes,
      compras,
      tomadas: delMes.length,
      vencidas: deLaCompra
        .filter((p) => p.vencido)
        .reduce((suma, p) => suma + Math.max(p.cantidadClases - p.clasesUsadas, 0), 0),
      clases: delMes.map((c) => ({ fecha: c.fecha, estilo: c.clase, profesor: c.profesor })),
    };
  });

  return {
    clasesTomadas: tomadas.length,
    clasesEnOchoSemanas: enOchoSemanas.length,
    ultimaClase: tomadas[0]?.fecha ?? null,
    hoy,
    estiloMasTomado: masFrecuente(enDoceMeses, (c) => c.clase)[0]?.clave ?? null,
    sueleVenir: sueleVenir(enOchoSemanas),
    vencidasSinUsar: mesesResumen.reduce((suma, m) => suma + m.vencidas, 0),
    totalPagado: pagos.reduce((suma, p) => suma + p.monto, 0),
    profesores: profesoresDe(tomadas),
    meses: mesesResumen,
  };
}

function masFrecuente<T>(
  clases: T[],
  clave: (clase: T) => string,
): { clave: string; cantidad: number; clases: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const clase of clases) {
    const k = clave(clase);
    grupos.set(k, [...(grupos.get(k) ?? []), clase]);
  }
  return [...grupos.entries()]
    .map(([k, delGrupo]) => ({ clave: k, cantidad: delGrupo.length, clases: delGrupo }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

function sueleVenir(recientes: ClaseParaResumen[]): ResumenDeAlumno['sueleVenir'] {
  if (recientes.length < 2) return null;
  const hora = masFrecuente(recientes, (c) => c.horaInicio)[0]!;
  const dias = masFrecuente(hora.clases, (c) => String(diaSemanaIso(c.fecha)))
    .slice(0, MAX_DIAS_QUE_SUELE_VENIR)
    .map((d) => Number(d.clave))
    .sort((a, b) => a - b);
  return { diasSemana: dias, horaInicio: hora.clave };
}

function profesoresDe(tomadas: ClaseParaResumen[]): ResumenDeAlumno['profesores'] {
  return masFrecuente(tomadas, (c) => String(c.profesor.id))
    .slice(0, MAX_PROFESORES)
    .map(({ cantidad, clases }) => ({
      ...clases[0]!.profesor,
      estilo: masFrecuente(clases, (c) => c.clase)[0]!.clave,
      clases: cantidad,
    }));
}
