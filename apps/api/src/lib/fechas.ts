import { lunesDe, primerDiaDelMes, sumarDias, sumarMeses, type FechaDia } from '@studio/shared';

export {
  TZ_ESTUDIO_POR_DEFECTO,
  diaSemanaIso,
  edadEn,
  esFechaDia,
  horaEnEstudio,
  hoyEnEstudio,
  lunesDe,
  periodoDe,
  primerDiaDelMes,
  rangoDelPeriodo,
  sumarDias,
  sumarMeses,
  sumarUnMes,
  type FechaDia,
  type Periodo,
} from '@studio/shared';

export function finDelHorizonte(hoy: FechaDia): FechaDia {
  const ultimoDelMesSiguiente = sumarDias(sumarMeses(primerDiaDelMes(hoy), 2), -1);
  return sumarDias(lunesDe(ultimoDelMesSiguiente), 6);
}

export function semanasDelHorizonte(hoy: FechaDia): FechaDia[] {
  const semanas: FechaDia[] = [];
  const fin = finDelHorizonte(hoy);
  for (let lunes = lunesDe(hoy); lunes <= fin; lunes = sumarDias(lunes, 7)) semanas.push(lunes);
  return semanas;
}
