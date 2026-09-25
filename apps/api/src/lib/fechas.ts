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
  const [anio, mes, dia] = partes(fecha);
  const anioDestino = mes === 12 ? anio + 1 : anio;
  const mesDestino = mes === 12 ? 1 : mes + 1;
  const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino, 0)).getUTCDate();
  const diaDestino = Math.min(dia, ultimoDia);
  return formatear(anioDestino, mesDestino, diaDestino);
}

export function primerDiaDelMes(fecha: FechaDia): FechaDia {
  const [anio, mes] = partes(fecha);
  return formatear(anio, mes, 1);
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
