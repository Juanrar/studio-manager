import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Horario } from '@studio/shared';
import { unProfesor } from '../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

describe('/horarios', () => {
  it('crear un horario del martes manda diaSemana 2 y las horas en HH:MM', async () => {
    conSesion(ADMIN);
    let cuerpoRecibido: unknown;
    servidor.use(
      http.get('/api/horarios', () => HttpResponse.json({ items: [] })),
      http.get('/api/profesores', () => HttpResponse.json({ items: [unProfesor({ id: 1, nombre: 'Erik', apellido: 'Zapata' })] })),
      http.post('/api/horarios', async ({ request }) => {
        cuerpoRecibido = await request.json();
        const horario: Horario = {
          id: 5,
          estilo: 'Hip-Hop',
          nivel: null,
          diaSemana: 2,
          horaInicio: '19:00',
          horaFin: '20:30',
          profesor: { id: 1, nombre: 'Erik', apellido: 'Zapata' },
          activo: true,
        };
        return HttpResponse.json(horario, { status: 201 });
      }),
    );
    const { usuario } = renderizarEn('/horarios');

    await usuario.click(await screen.findByRole('button', { name: 'Nueva clase' }));
    expect(screen.getByRole('link', { name: 'Horarios' })).toHaveAttribute('aria-current', 'page');
    const dialogo = screen.getByRole('dialog', { name: 'Nueva clase' });
    await usuario.type(within(dialogo).getByLabelText('Estilo'), 'Hip-Hop');
    await usuario.selectOptions(within(dialogo).getByLabelText('Día'), 'Martes');
    await usuario.type(within(dialogo).getByLabelText('Empieza'), '19:00');
    await usuario.type(within(dialogo).getByLabelText('Termina'), '20:30');
    await within(dialogo).findByRole('option', { name: 'Erik Zapata' });
    await usuario.selectOptions(within(dialogo).getByLabelText('Profesor titular'), 'Erik Zapata');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(cuerpoRecibido).toMatchObject({
        estilo: 'Hip-Hop',
        diaSemana: 2,
        horaInicio: '19:00',
        horaFin: '20:30',
        profesorId: 1,
      }),
    );
  });
});
