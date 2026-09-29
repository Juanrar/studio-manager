import { within } from '@testing-library/react';

// El texto de cada celda de una fila, sin lo decorativo (aria-hidden), como la inicial del avatar.
export function celdasDe(fila: HTMLElement): string[] {
  return within(fila)
    .getAllByRole('cell')
    .map((celda) => {
      const copia = celda.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('[aria-hidden="true"]').forEach((nodo) => nodo.remove());
      return copia.textContent ?? '';
    });
}
