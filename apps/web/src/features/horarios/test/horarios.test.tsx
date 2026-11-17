import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Horario } from '@studio/shared';
import { unProfesor } from '../../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../../test/render.tsx';
import { servidor } from '../../../../test/servidor.ts';

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

  it('las tablas de cada día usan los mismos anchos de columna para que queden alineadas', async () => {
    conSesion(ADMIN);
    const delLunes: Horario = {
      id: 1,
      estilo: 'HIP HOP',
      nivel: 'intermedio',
      diaSemana: 1,
      horaInicio: '17:00',
      horaFin: '18:00',
      profesor: { id: 1, nombre: 'Erik Nicolas', apellido: 'Zapata' },
      activo: true,
    };
    const delMiercoles: Horario = {
      id: 2,
      estilo: 'Urbano',
      nivel: 'Inicial',
      diaSemana: 3,
      horaInicio: '18:00',
      horaFin: '19:30',
      profesor: { id: 2, nombre: 'Juan Carlos', apellido: 'Lorenzo' },
      activo: true,
    };
    servidor.use(http.get('/api/horarios', () => HttpResponse.json({ items: [delLunes, delMiercoles] })));
    renderizarEn('/horarios');

    await screen.findByText('Juan Carlos Lorenzo');
    const tablas = screen.getAllByRole('table');
    const anchosDe = (tabla: HTMLElement) =>
      [...tabla.querySelectorAll('col')].map((columna) => columna.style.width);

    expect(tablas).toHaveLength(2);
    expect(tablas.map((tabla) => tabla.classList.contains('table-fixed'))).toEqual([true, true]);
    expect(anchosDe(tablas[0]!)).toEqual(['14%', '16%', '14%', '22%', '14%', '20%']);
    expect(anchosDe(tablas[1]!)).toEqual(['14%', '16%', '14%', '22%', '14%', '20%']);
  });
});
