export const INICIO_GRILLA = 8 * 60;
export const FIN_GRILLA = 23 * 60;
export const PASO = 15;
export const PX_POR_MINUTO = 1.05;

export function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number) as [number, number];
  return horas * 60 + minutos;
}

export function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}
