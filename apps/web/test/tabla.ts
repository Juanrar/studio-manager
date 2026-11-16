import { within } from '@testing-library/react';

export function celdasDe(fila: HTMLElement): string[] {
  return within(fila)
    .getAllByRole('cell')
    .map((celda) => {
      const copia = celda.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('[aria-hidden="true"]').forEach((nodo) => nodo.remove());
      return copia.textContent ?? '';
    });
}
