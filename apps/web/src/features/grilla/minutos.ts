// La grilla trabaja en minutos desde las 00:00: "19:30" es 1170. Va de 08:00 a 23:00 en franjas de 15.
export const INICIO_GRILLA = 8 * 60;
export const FIN_GRILLA = 23 * 60;
export const PASO = 15;
// Alto de un minuto en la grilla: 63 px por hora, como en DayFlow.
export const PX_POR_MINUTO = 1.05;

export function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number) as [number, number];
  return horas * 60 + minutos;
}

export function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}
