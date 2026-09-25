const formateadorPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

// El dinero es entero, en pesos: 9600 se muestra como $9.600.
export function formatearPesos(monto: number): string {
  return formateadorPesos.format(monto).replace(/\s/g, '');
}

// Los porcentajes vienen en puntos básicos: 5250 se muestra como 52,5%.
export function formatearPorcentaje(puntosBasicos: number): string {
  return `${(puntosBasicos / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
}

export function porcentajeABp(porcentaje: number): number {
  return Math.round(porcentaje * 100);
}

// AAAA-MM-DD a DD/MM/AAAA.
export function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

// AAAA-MM-DD a "martes 10 de marzo". Se calcula en UTC porque la fecha no tiene hora.
export function formatearFechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

export const DIAS_DE_LA_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// 1 es lunes, 7 es domingo (ISO), igual que la API.
export function nombreDelDia(diaSemana: number): string {
  return DIAS_DE_LA_SEMANA[diaSemana - 1] ?? '';
}

export function formatearPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number) as [number, number];
  const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(anio, mes - 1, 1)),
  );
  return `${nombre} de ${anio}`;
}

// Día de hoy en la zona del estudio, como AAAA-MM-DD.
export function hoyEnEstudio(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export const NOMBRES_MEDIO_DE_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  otro: 'Otro',
};

// Un instante ISO a DD/MM/AAAA, con el día del estudio.
export function formatearInstante(instante: string): string {
  return formatearFecha(hoyEnEstudio(new Date(instante)));
}

// "52,5" o "52.5" a 5250 puntos básicos. Devuelve null si no es un número.
export function textoAPorcentajeBp(texto: string): number | null {
  const numero = Number(texto.trim().replace(',', '.'));
  if (texto.trim() === '' || !Number.isFinite(numero)) return null;
  return porcentajeABp(numero);
}
