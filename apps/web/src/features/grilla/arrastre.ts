import { FIN_GRILLA, INICIO_GRILLA, PASO } from './minutos.ts';

export type Caja = { left: number; top: number; width: number };
export type Posicion = { dia: number; minutos: number };
export type Destino = { dia: number; inicio: number; fin: number };

type ClaseEnLaGrilla = { dia: number; inicio: number; fin: number };

export type Arrastre =
  | { modo: 'mover'; clase: ClaseEnLaGrilla; minutosAlEmpezar: number }
  | { modo: 'estirar'; clase: ClaseEnLaGrilla }
  | { modo: 'crear'; dia: number; minutosAlEmpezar: number };

const redondear = (minutos: number) => Math.round(minutos / PASO) * PASO;
const piso = (minutos: number) => Math.floor(minutos / PASO) * PASO;
const limitar = (n: number, minimo: number, maximo: number) => Math.min(Math.max(n, minimo), maximo);

export function posicionEnLaGrilla(caja: Caja, punto: { x: number; y: number }, cantidadDeDias: number, pxPorMinuto: number): Posicion {
  const dia = limitar(Math.floor(((punto.x - caja.left) / caja.width) * cantidadDeDias), 0, cantidadDeDias - 1) + 1;
  return { dia, minutos: INICIO_GRILLA + (punto.y - caja.top) / pxPorMinuto };
}

export function destinoDelArrastre(arrastre: Arrastre, puntero: Posicion): Destino {
  if (arrastre.modo === 'mover') {
    const { clase } = arrastre;
    const duracion = clase.fin - clase.inicio;
    const inicio = limitar(
      redondear(clase.inicio + puntero.minutos - arrastre.minutosAlEmpezar),
      INICIO_GRILLA,
      FIN_GRILLA - duracion,
    );
    return { dia: puntero.dia, inicio, fin: inicio + duracion };
  }
  if (arrastre.modo === 'estirar') {
    const { clase } = arrastre;
    return { dia: clase.dia, inicio: clase.inicio, fin: limitar(redondear(puntero.minutos), clase.inicio + PASO, FIN_GRILLA) };
  }
  const desde = piso(arrastre.minutosAlEmpezar);
  const hasta = redondear(puntero.minutos);
  return {
    dia: arrastre.dia,
    inicio: limitar(Math.min(desde, hasta), INICIO_GRILLA, FIN_GRILLA - PASO),
    fin: limitar(Math.max(hasta, desde + PASO), INICIO_GRILLA + PASO, FIN_GRILLA),
  };
}
