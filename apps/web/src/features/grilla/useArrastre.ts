import { useState, type PointerEvent as EventoDePuntero, type RefObject } from 'react';
import { destinoDelArrastre, posicionEnLaGrilla, type Arrastre, type Destino } from './arrastre.ts';
import { PX_POR_MINUTO } from './minutos.ts';

const UMBRAL = 4;

export type Fantasma = Destino & { id: number | null };

export function useArrastre({
  columnas,
  cantidadDeDias,
  alSoltar,
  alTocar,
}: {
  columnas: RefObject<HTMLDivElement | null>;
  cantidadDeDias: number;
  alSoltar: (arrastre: Arrastre, destino: Destino, id: number | null) => void;
  alTocar: (arrastre: Arrastre, destino: Destino, id: number | null) => void;
}) {
  const [fantasma, setFantasma] = useState<Fantasma | null>(null);

  const posicion = (x: number, y: number) =>
    posicionEnLaGrilla(columnas.current!.getBoundingClientRect(), { x, y }, cantidadDeDias, PX_POR_MINUTO);

  function empezar(evento: EventoDePuntero, crearArrastre: (apretado: { dia: number; minutos: number }) => Arrastre, id: number | null) {
    if (evento.button !== 0) return;
    evento.preventDefault();
    evento.stopPropagation();
    const x0 = evento.clientX;
    const y0 = evento.clientY;
    const arrastre = crearArrastre(posicion(x0, y0));
    let movido = false;
    let ultimo: Destino | null = null;

    const mover = (e: PointerEvent) => {
      if (!movido && Math.hypot(e.clientX - x0, e.clientY - y0) < UMBRAL) return;
      movido = true;
      ultimo = destinoDelArrastre(arrastre, posicion(e.clientX, e.clientY));
      setFantasma({ id, ...ultimo });
    };
    const soltar = (e: PointerEvent) => {
      window.removeEventListener('pointermove', mover);
      setFantasma(null);
      if (movido && ultimo) alSoltar(arrastre, ultimo, id);
      else alTocar(arrastre, destinoDelArrastre(arrastre, posicion(e.clientX, e.clientY)), id);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar, { once: true });
  }

  return { fantasma, empezar };
}
