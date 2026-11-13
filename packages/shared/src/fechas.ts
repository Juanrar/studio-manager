export type FechaDia = string;

export const TZ_ESTUDIO_POR_DEFECTO = 'America/Argentina/Buenos_Aires';

const PATRON = /^\d{4}-\d{2}-\d{2}$/;

export function hoyEnEstudio(ahora: Date = new Date(), tz: string = TZ_ESTUDIO_POR_DEFECTO): FechaDia {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formateador.format(ahora);
}

// La hora de ahora en la zona del estudio, como HH:MM de 24 horas.
export function horaEnEstudio(ahora: Date = new Date(), tz: string = TZ_ESTUDIO_POR_DEFECTO): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    // Con h23 la medianoche es 00:00; con h24 sería 24:00.
    hourCycle: 'h23',
  }).format(ahora);
}

export function esFechaDia(valor: string): boolean {
  if (!PATRON.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

export function diaSemanaIso(fecha: FechaDia): number {
  const dia = aUtc(fecha).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function sumarUnMes(fecha: FechaDia): FechaDia {
  return sumarMeses(fecha, 1);
}

// Si el mes de destino es más corto, recorta a su último día: el 31 de enero más un mes es el 28 de febrero.
export function sumarMeses(fecha: FechaDia, meses: number): FechaDia {
  const [anio, mes, dia] = partes(fecha);
  const mesesDesdeElAnio = mes - 1 + meses;
  const anioDestino = anio + Math.floor(mesesDesdeElAnio / 12);
  const mesDestino = (((mesesDesdeElAnio % 12) + 12) % 12) + 1;
  const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino, 0)).getUTCDate();
  return formatear(anioDestino, mesDestino, Math.min(dia, ultimoDia));
}

export function sumarDias(fecha: FechaDia, dias: number): FechaDia {
  const resultado = aUtc(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return formatear(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, resultado.getUTCDate());
}

export function primerDiaDelMes(fecha: FechaDia): FechaDia {
  const [anio, mes] = partes(fecha);
  return formatear(anio, mes, 1);
}

// La semana del estudio va de lunes a domingo, como `dia_semana`.
export function lunesDe(fecha: FechaDia): FechaDia {
  return sumarDias(fecha, 1 - diaSemanaIso(fecha));
}

// Años cumplidos al día `hoy`. Quien nació un 29 de febrero cumple el 1 de marzo en un año no bisiesto.
export function edadEn(nacimiento: FechaDia, hoy: FechaDia): number {
  const [anioNacimiento, mesNacimiento, diaNacimiento] = partes(nacimiento);
  const [anio, mes, dia] = partes(hoy);
  const todaviaNoCumplio = mes < mesNacimiento || (mes === mesNacimiento && dia < diaNacimiento);
  return anio - anioNacimiento - (todaviaNoCumplio ? 1 : 0);
}

function partes(fecha: FechaDia): [number, number, number] {
  if (!esFechaDia(fecha)) {
    throw new Error(`Fecha inválida: ${fecha}. Se espera YYYY-MM-DD`);
  }
  return fecha.split('-').map(Number) as [number, number, number];
}

function aUtc(fecha: FechaDia): Date {
  const [anio, mes, dia] = partes(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function formatear(anio: number, mes: number, dia: number): FechaDia {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Un período es un mes: `AAAA-MM`.
export type Periodo = string;

// Del primer día del mes (incluido) al primer día del mes siguiente (excluido).
export function rangoDelPeriodo(periodo: Periodo): { desde: FechaDia; hasta: FechaDia } {
  const desde = `${periodo}-01`;
  return { desde, hasta: sumarUnMes(desde) };
}

export function periodoDe(fecha: FechaDia): Periodo {
  return fecha.slice(0, 7);
}
