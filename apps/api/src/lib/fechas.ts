import { lunesDe, primerDiaDelMes, sumarDias, sumarMeses, type FechaDia } from '@studio/shared';

// La cuenta con días vive en `packages/shared`, que también usa la web. La API la importa de acá.
// Reexports con nombre: `export *` traería también los esquemas de `shared`.
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

// Las clases se crean por adelantado hasta el domingo de la semana que contiene el último día del mes
// siguiente: el estudio arma la grilla, como mucho, hasta el mes que viene.
export function finDelHorizonte(hoy: FechaDia): FechaDia {
  const ultimoDelMesSiguiente = sumarDias(sumarMeses(primerDiaDelMes(hoy), 2), -1);
  return sumarDias(lunesDe(ultimoDelMesSiguiente), 6);
}

// El lunes de cada semana del horizonte, desde la semana de hoy.
export function semanasDelHorizonte(hoy: FechaDia): FechaDia[] {
  const semanas: FechaDia[] = [];
  const fin = finDelHorizonte(hoy);
  for (let lunes = lunesDe(hoy); lunes <= fin; lunes = sumarDias(lunes, 7)) semanas.push(lunes);
  return semanas;
}
