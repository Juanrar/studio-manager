import type { Rol } from '@studio/shared';

const formateadorPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatearPesos(monto: number): string {
  return formateadorPesos.format(monto).replace(/\s/g, '');
}

export function formatearPorcentaje(puntosBasicos: number): string {
  return `${(puntosBasicos / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
}

export function porcentajeABp(porcentaje: number): number {
  return Math.round(porcentaje * 100);
}

export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

export function formatearFechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const MESES_CORTOS = MESES.map((mes) => mes.slice(0, 3));

export function formatearDiaYMes(fecha: string): string {
  const [, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return `${dia} ${MESES_CORTOS[mes - 1]}`;
}

export function formatearFechaCorta(fecha: string, hoy: string): string {
  const anio = fecha.slice(0, 4);
  return anio === hoy.slice(0, 4) ? formatearDiaYMes(fecha) : `${formatearDiaYMes(fecha)} ${anio}`;
}

export function nombreDelMes(periodo: string): string {
  const nombre = MESES[Number(periodo.slice(5, 7)) - 1] ?? '';
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
}

export function formatearMes(periodo: string): string {
  return `${nombreDelMes(periodo)} ${periodo.slice(0, 4)}`;
}

export const DIAS_DE_LA_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function nombreDelDia(diaSemana: number): string {
  return DIAS_DE_LA_SEMANA[diaSemana - 1] ?? '';
}

const DIAS_ABREVIADOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function abreviaturaDelDia(diaSemana: number): string {
  return DIAS_ABREVIADOS[diaSemana - 1] ?? '';
}

export function formatearPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number) as [number, number];
  const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, 1)),
  );
  return `${nombre} de ${anio}`;
}

export function hoyEnEstudio(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export function horaEnEstudio(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function diaDeLaSemana(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return ((new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay() + 6) % 7) + 1;
}

export function lunesDe(fecha: string): string {
  return sumarDias(fecha, 1 - diaDeLaSemana(fecha));
}

export const NOMBRES_ROL: Record<Rol, string> = { admin: 'Administración', recepcion: 'Recepción' };

export const NOMBRES_MEDIO_DE_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  otro: 'Otro',
};

export function formatearInstante(instante: string): string {
  return formatearFecha(hoyEnEstudio(new Date(instante)));
}

export function textoAPorcentajeBp(texto: string): number | null {
  const numero = Number(texto.trim().replace(',', '.'));
  if (texto.trim() === '' || !Number.isFinite(numero)) return null;
  return porcentajeABp(numero);
}

export function periodoAnterior(fecha: string): string {
  const [anio, mes] = fecha.split('-').map(Number) as [number, number];
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`;
}

export function haceCuanto(fecha: string, hoy: string): string {
  const dias = Math.round((Date.parse(hoy) - Date.parse(fecha)) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  return dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}
