import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Pagina } from '../index.tsx';

describe('Pagina', () => {
  it('dibuja volverA como enlace con el texto, y la flecha no cambia su nombre accesible', () => {
    render(
      <MemoryRouter>
        <Pagina titulo="Clase" volverA={{ ruta: '/agenda?fecha=2026-03-10', texto: 'Agenda' }}>
          contenido
        </Pagina>
      </MemoryRouter>,
    );

    const volver = screen.getByRole('link', { name: 'Agenda' });
    expect(volver).toHaveAttribute('href', '/agenda?fecha=2026-03-10');
    expect(volver.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(volver.textContent).toBe('Agenda');
    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });
});
