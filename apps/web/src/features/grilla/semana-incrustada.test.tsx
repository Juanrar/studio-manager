import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { unaClase } from '../../../test/datos.ts';
import { fechasDeLaSemana } from '../asistente/grillaDeLaPropuesta.ts';
import { VistaDeSemana } from './VistaDeSemana.tsx';

describe('VistaDeSemana incrustada', () => {
  it('dibuja la clase de las 19:00 en el rango 18:00 a 22:00, sin ser un botón', () => {
    const clase = unaClase({ id: -1, fecha: '2026-10-13', estilo: 'Salsa', nivel: null, horaInicio: '19:00', horaFin: '20:30' });
    render(<VistaDeSemana fechas={fechasDeLaSemana('2026-10-13')} clases={[clase]} hoy="2026-10-13" incrustada={{ inicio: 1080, fin: 1320 }} />);

    const martes = screen.getByRole('group', { name: 'Martes 13' });
    const enLaGrilla = screen.getByLabelText(/^Salsa, 19:00 a 20:30/);
    expect(within(martes).getByLabelText(/^Salsa, 19:00 a 20:30/)).toBe(enLaGrilla);
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('22:00')).toBeInTheDocument();
    expect(screen.queryByText('08:00')).not.toBeInTheDocument();
    expect(enLaGrilla.style.top).toBe('64px');
  });
});
