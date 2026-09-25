import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Profesor } from '@studio/shared';
import { unProfesor } from '../../../test/datos.ts';
import { ADMIN, conSesion, renderizarEn } from '../../../test/render.tsx';
import { servidor } from '../../../test/servidor.ts';

function profesoresDelEstudio(profesores: Profesor[]) {
  conSesion(ADMIN);
  servidor.use(http.get('/api/profesores', () => HttpResponse.json({ items: profesores })));
  return renderizarEn('/profesores');
}

describe('/profesores', () => {
  it('crear un profesor con "52,5" manda 5250 puntos básicos', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.post('/api/profesores', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json(unProfesor({ id: 7, nombre: 'Malena', apellido: 'Rosas', porcentajeVigenteBp: 5250 }), {
          status: 201,
        });
      }),
    );
    const { usuario } = profesoresDelEstudio([]);

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo profesor' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo profesor' });
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Malena');
    await usuario.type(within(dialogo).getByLabelText('Apellido'), 'Rosas');
    await usuario.type(within(dialogo).getByLabelText('Porcentaje por alumno (%)'), '52,5');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(cuerpoRecibido).toMatchObject({ nombre: 'Malena', apellido: 'Rosas', porcentajeBp: 5250 }));
  });

  it('cargar un porcentaje nuevo manda puntos básicos y la fecha de vigencia', async () => {
    let cuerpoRecibido: unknown;
    servidor.use(
      http.get('/api/profesores/1/porcentajes', () =>
        HttpResponse.json({ items: [{ id: 1, porcentajeBp: 5000, vigenteDesde: '2026-01-01' }] }),
      ),
      http.post('/api/profesores/1/porcentajes', async ({ request }) => {
        cuerpoRecibido = await request.json();
        return HttpResponse.json({ id: 2, porcentajeBp: 6000, vigenteDesde: '2026-04-01' }, { status: 201 });
      }),
    );
    const { usuario } = profesoresDelEstudio([unProfesor({ id: 1, nombre: 'Erik', apellido: 'Zapata', porcentajeVigenteBp: 5000 })]);

    const fila = await screen.findByRole('row', { name: /Zapata/ });
    expect(within(fila).getByText('50%')).toBeInTheDocument();
    await usuario.click(within(fila).getByRole('button', { name: 'Porcentajes' }));
    const dialogo = screen.getByRole('dialog', { name: 'Porcentajes de Erik Zapata' });
    await usuario.type(within(dialogo).getByLabelText('Nuevo porcentaje (%)'), '60');
    await usuario.type(within(dialogo).getByLabelText('Vigente desde'), '2026-04-01');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(cuerpoRecibido).toEqual({ porcentajeBp: 6000, vigenteDesde: '2026-04-01' }));
  });
});
